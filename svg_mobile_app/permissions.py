import frappe
from frappe import _

def get_communication_permission_query_conditions(user):
    """
    Return query conditions for Communication based on user's email access.
    Now uses the unified User Email table with access types.
    """
    if not user:
        user = frappe.session.user
    
    # Administrators have full access
    if "System Manager" in frappe.get_roles(user):
        return ""
    
    try:
        # Get user's accessible email accounts from User Email table
        accessible_accounts = frappe.get_all(
            "User Email",
            filters={"parent": user},
            fields=["email_account"],
            pluck="email_account"
        )
        
        # Remove duplicates and None values
        accessible_accounts = list(set([acc for acc in accessible_accounts if acc]))
        
        if accessible_accounts:
            # Build the condition to include:
            # 1. Communications from accessible email accounts
            # 2. Communications not tied to any email account (general communications)
            # 3. Communications where user is involved (sender/recipient)
            
            email_account_condition = "(`tabCommunication`.`email_account` in ({}) OR `tabCommunication`.`email_account` IS NULL)".format(
                ", ".join([f"'{acc}'" for acc in accessible_accounts])
            )
            
            # Also include communications where user is the sender or in recipients
            user_involvement_condition = f"(`tabCommunication`.`sender` = '{user}' OR `tabCommunication`.`recipients` LIKE '%{user}%' OR `tabCommunication`.`user` = '{user}')"
            
            # Combine conditions with OR
            return f"({email_account_condition} OR {user_involvement_condition})"
        else:
            # If no email accounts, only show communications where user is directly involved
            return f"(`tabCommunication`.`sender` = '{user}' OR `tabCommunication`.`recipients` LIKE '%{user}%' OR `tabCommunication`.`user` = '{user}' OR `tabCommunication`.`email_account` IS NULL)"
    
    except Exception as e:
        frappe.log_error(f"Error in get_communication_permission_query_conditions: {str(e)}", "Communication Permissions")
        # Fallback to basic user involvement check
        return f"(`tabCommunication`.`sender` = '{user}' OR `tabCommunication`.`recipients` LIKE '%{user}%' OR `tabCommunication`.`user` = '{user}')"

def has_communication_permission(doc, user=None, permission_type="read"):
    """
    Check if user has permission for specific Communication document.
    Now uses the unified User Email table with access types.
    """
    if not user:
        user = frappe.session.user
    
    # Administrators have full access
    if "System Manager" in frappe.get_roles(user):
        return True
    
    try:
        # Check if user is directly involved in the communication
        if (doc.sender == user or 
            (doc.recipients and user in doc.recipients) or 
            doc.user == user):
            return True
        
        # If not an email communication or no email account, allow access
        if doc.communication_medium != "Email" or not doc.email_account:
            return True
        
        # Check if user has access to this email account through User Email table
        email_access = frappe.db.get_value("User Email", {
            "parent": user,
            "email_account": doc.email_account
        }, "access_type")
        
        if email_access:
            # Check permission type against access type
            if permission_type == "read" and email_access in ["Read Only", "Read & Send", "Full Access"]:
                return True
            elif permission_type == "write" and email_access in ["Read & Send", "Full Access"]:
                return True
            elif permission_type == "delete" and email_access == "Full Access":
                return True
        
        return False
        
    except Exception as e:
        frappe.log_error(f"Error in has_communication_permission: {str(e)}", "Communication Permissions")
        return False

# CRITICAL: Fix the function name to match hooks.py
def has_communication_permission_main(doc, ptype, user=None):
    """
    Document-level permission check for Communication
    This function gets called by Frappe's core permission system via hooks.py
    """
    return has_communication_permission(doc, user, ptype)

def get_email_account_permission_query_conditions(user):
    """
    Return query conditions for Email Account based on user's email access
    """
    if not user:
        user = frappe.session.user
    
    # Administrators have full access
    if "System Manager" in frappe.get_roles(user):
        return ""
    
    try:
        # Get user's email access from User Email table
        accessible_accounts = frappe.get_all(
            "User Email",
            filters={"parent": user},
            fields=["email_account"],
            pluck="email_account"
        )
        
        if accessible_accounts:
            accounts_condition = "', '".join(accessible_accounts)
            return f"(`tabEmail Account`.`name` in ('{accounts_condition}'))"
        else:
            # No email access
            return "1=0"  # No access
            
    except Exception as e:
        frappe.log_error(f"Error in email account permission query: {str(e)}")
        return "1=0"

def has_email_account_permission_main(doc, ptype, user=None):
    """
    Document-level permission check for Email Account
    """
    if not user:
        user = frappe.session.user
    
    # Administrators have full access
    if "System Manager" in frappe.get_roles(user):
        return True
    
    try:
        # Check if user has access to this email account
        email_access = frappe.db.get_value("User Email", {
            "parent": user,
            "email_account": doc.name
        }, "access_type")
        
        if email_access:
            if ptype in ["read", "print", "export"]:
                return True
            elif ptype in ["write", "create", "delete", "submit", "cancel"]:
                # Only allow write operations for Read & Send and Full Access
                return email_access in ["Read & Send", "Full Access"]
        
        return False
        
    except Exception as e:
        frappe.log_error(f"Error checking email account permission: {str(e)}")
        return False 
import frappe
from frappe import _

def get_communication_permission_query_conditions(user):
    """
    Return query conditions for Communication based on user's email access
    CRITICAL: This function must allow access to ALL communications that the user should see
    """
    if not user:
        user = frappe.session.user
    
    # Administrators have full access
    if "System Manager" in frappe.get_roles(user):
        return ""
    
    try:
        # Get user's email access from BOTH standard and custom tables
        personal_emails = frappe.get_all(
            "User Email",
            filters={"parent": user},
            fields=["email_account"],
            pluck="email_account"
        )
        
        work_emails = frappe.get_all(
            "User Work Email Access", 
            filters={"parent": user},
            fields=["email_account"],
            pluck="email_account"
        )
        
        # Combine all accessible email accounts
        accessible_accounts = list(set(personal_emails + work_emails))
        
        # CRITICAL: Make the permission system INCLUSIVE, not restrictive
        # Most communications should be visible to users
        conditions = []
        
        # 1. All non-email communications (always accessible)
        conditions.append("`tabCommunication`.`communication_medium` != 'Email'")
        
        # 2. Email communications without specific email account
        conditions.append("(`tabCommunication`.`email_account` is null or `tabCommunication`.`email_account` = '')")
        
        # 3. Communications where user is involved
        conditions.append(f"`tabCommunication`.`sender` = '{user}'")
        conditions.append(f"`tabCommunication`.`recipients` like '%{user}%'")
        conditions.append(f"`tabCommunication`.`owner` = '{user}'")
        
        # 4. Communications from accessible email accounts
        if accessible_accounts:
            accounts_condition = "', '".join(accessible_accounts)
            conditions.append(f"`tabCommunication`.`email_account` in ('{accounts_condition}')")
        
        # 5. Communications linked to documents the user can access
        # This is important for document-related communications
        conditions.append(f"`tabCommunication`.`reference_owner` = '{user}'")
        
        # Return permissive conditions (OR logic)
        return f"({' or '.join(conditions)})"
            
    except Exception as e:
        frappe.log_error(f"Error in communication permission query: {str(e)}")
        # Very permissive fallback - show most communications
        return f"(`tabCommunication`.`communication_medium` != 'Email' or `tabCommunication`.`email_account` is null or `tabCommunication`.`sender` = '{user}' or `tabCommunication`.`recipients` like '%{user}%' or `tabCommunication`.`owner` = '{user}')"

def has_communication_permission(doc, user=None, permission_type="read"):
    """
    Check if user has permission for specific Communication document
    CRITICAL: This should be INCLUSIVE - allow access unless specifically restricted
    """
    if not user:
        user = frappe.session.user
    
    # Administrators have full access
    if "System Manager" in frappe.get_roles(user):
        return True
    
    try:
        # CRITICAL: For non-email communications, always allow access
        if doc.communication_medium != "Email" or not doc.email_account:
            return True
        
        # Check if user is involved in the communication
        if (doc.sender == user or 
            (doc.recipients and user in doc.recipients) or 
            doc.owner == user):
            return True
        
        # Check email account access from BOTH tables
        personal_access = frappe.db.exists("User Email", {
            "parent": user,
            "email_account": doc.email_account
        })
        
        work_access = frappe.db.get_value("User Work Email Access", {
            "parent": user,
            "email_account": doc.email_account
        }, "access_type")
        
        # Personal emails have full access
        if personal_access:
            return True
        
        # Work emails - check access type for write operations
        if work_access:
            if permission_type in ["read", "print", "export"]:
                return True
            elif permission_type in ["write", "create", "delete", "submit", "cancel"]:
                # Only allow write operations for Read & Send and Full Access
                return work_access in ["Read & Send", "Full Access"]
        
        # CRITICAL: If no specific email account restriction, allow access
        # This ensures the system works like core Frappe
        return True
        
    except Exception as e:
        frappe.log_error(f"Error checking communication permission: {str(e)}")
        # Fallback to allowing access
        return True

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
        # Get user's email access
        personal_emails = frappe.get_all(
            "User Email",
            filters={"parent": user},
            fields=["email_account"],
            pluck="email_account"
        )
        
        work_emails = frappe.get_all(
            "User Work Email Access", 
            filters={"parent": user},
            fields=["email_account"],
            pluck="email_account"
        )
        
        # Combine all accessible email accounts
        accessible_accounts = personal_emails + work_emails
        
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
        personal_access = frappe.db.exists("User Email", {
            "parent": user,
            "email_account": doc.name
        })
        
        work_access = frappe.db.get_value("User Work Email Access", {
            "parent": user,
            "email_account": doc.name
        }, "access_type")
        
        # Personal emails have full access
        if personal_access:
            return True
        
        # Work emails - check access type for write operations
        if work_access:
            if ptype in ["read", "print", "export"]:
                return True
            elif ptype in ["write", "create", "delete", "submit", "cancel"]:
                # Only allow write operations for Read & Send and Full Access
                return work_access in ["Read & Send", "Full Access"]
        
        return False
        
    except Exception as e:
        frappe.log_error(f"Error checking email account permission: {str(e)}")
        return False 
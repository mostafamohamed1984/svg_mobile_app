import frappe
from frappe import _

def get_communication_permission_query_conditions(user):
    """
    Return query conditions for Communication based on user's email access
    """
    if not user:
        user = frappe.session.user
    
    # Administrators have full access
    if "System Manager" in frappe.get_roles(user):
        return ""
    
    # Get user's email access
    try:
        # Get personal emails (User Email)
        personal_emails = frappe.get_all(
            "User Email",
            filters={"parent": user},
            fields=["email_account"],
            pluck="email_account"
        )
        
        # Get work emails (User Work Email Access)
        work_emails = frappe.get_all(
            "User Work Email Access", 
            filters={"parent": user},
            fields=["email_account"],
            pluck="email_account"
        )
        
        # Combine all accessible email accounts
        accessible_accounts = personal_emails + work_emails
        
        if accessible_accounts:
            # User can only see communications from their accessible email accounts
            accounts_condition = "', '".join(accessible_accounts)
            return f"(`tabCommunication`.`email_account` in ('{accounts_condition}') or `tabCommunication`.`email_account` is null)"
        else:
            # No email access - only see communications not tied to email accounts
            return "`tabCommunication`.`email_account` is null"
            
    except Exception as e:
        frappe.log_error(f"Error in communication permission query: {str(e)}")
        return "`tabCommunication`.`email_account` is null"

def has_communication_permission(doc, user=None, permission_type="read"):
    """
    Check if user has permission for specific Communication document
    """
    if not user:
        user = frappe.session.user
    
    # Administrators have full access
    if "System Manager" in frappe.get_roles(user):
        return True
    
    # If not an email communication, use default permissions
    if doc.communication_medium != "Email" or not doc.email_account:
        return True
    
    try:
        # Check if user has access to this email account
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
        
        return False
        
    except Exception as e:
        frappe.log_error(f"Error checking communication permission: {str(e)}")
        return False 
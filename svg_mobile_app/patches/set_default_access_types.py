import frappe
from frappe.utils import today

def execute():
    """
    Set default values for new access type fields in existing User Email records
    """
    try:
        # Update all existing User Email records that don't have access_type set
        frappe.db.sql("""
            UPDATE `tabUser Email` 
            SET 
                access_type = 'Full Access',
                granted_date = %s,
                description = 'Existing personal email access'
            WHERE 
                (access_type IS NULL OR access_type = '')
                AND (granted_date IS NULL OR granted_date = '')
        """, (today(),))
        
        frappe.db.commit()
        
        print("Successfully updated existing User Email records with default access types")
        
    except Exception as e:
        frappe.log_error(f"Error in set_default_access_types patch: {str(e)}", "User Email Patch")
        print(f"Patch failed: {str(e)}")
        raise 
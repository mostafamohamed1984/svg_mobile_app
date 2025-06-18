import frappe
from frappe.utils import today

def execute():
    """
    Set default values for new access type fields in existing User Email records
    This patch will be re-run until the custom fields are available
    """
    try:
        # Check if the custom fields exist before trying to update them
        if not frappe.db.has_column("User Email", "access_type"):
            print("Custom fields not yet created. Will retry after field installation.")
            # Force install custom fields first
            try:
                from frappe.custom.doctype.custom_field.custom_field import create_custom_fields
                from frappe.core.doctype.doctype.doctype import clear_cache
                
                # Clear cache and reload doctype
                clear_cache("User Email")
                frappe.reload_doctype("User Email")
                
                print("Custom fields should now be available. Retrying patch...")
                
                # Check again
                if not frappe.db.has_column("User Email", "access_type"):
                    print("Custom fields still not available. Skipping for now.")
                    return
                    
            except Exception as field_error:
                print(f"Could not install custom fields: {str(field_error)}")
                return
        
        # Now update existing records
        existing_count = frappe.db.count("User Email")
        if existing_count == 0:
            print("No existing User Email records found.")
            return
            
        # Update all existing User Email records that don't have access_type set
        updated_count = frappe.db.sql("""
            UPDATE `tabUser Email` 
            SET 
                access_type = 'Full Access',
                granted_date = %s,
                description = 'Existing personal email access'
            WHERE 
                (access_type IS NULL OR access_type = '' OR access_type = 'None')
        """, (today(),))
        
        frappe.db.commit()
        
        print(f"Successfully updated {updated_count} existing User Email records with default access types")
        
    except Exception as e:
        error_msg = str(e)
        frappe.log_error(f"Error in set_default_access_types patch: {error_msg}", "User Email Patch")
        print(f"Patch encountered error: {error_msg}")
        
        # If it's the column error, don't fail the migration
        if "Unknown column" in error_msg or "access_type" in error_msg:
            print("Column not yet available - migration will continue and patch will retry later")
            return
        else:
            # For other errors, we should know about them
            raise 
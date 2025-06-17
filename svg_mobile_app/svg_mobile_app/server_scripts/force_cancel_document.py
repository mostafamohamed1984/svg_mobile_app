import frappe

@frappe.whitelist()
def force_cancel_document(doctype, name):
    """
    Force cancel a document by ignoring linked documents.
    This is useful for breaking circular dependencies between documents.
    
    Args:
        doctype (str): The DocType of the document to cancel
        name (str): The name (ID) of the document to cancel
    
    Returns:
        dict: Status of the operation
    """
    try:
        # Get the document
        doc = frappe.get_doc(doctype, name)
        
        # Set flag to ignore linked documents during cancellation
        doc.flags.ignore_links = True
        
        # Cancel the document
        doc.cancel()
        
        # Commit the transaction
        frappe.db.commit()
        
        return {
            "success": True,
            "message": f"{doctype} {name} has been successfully cancelled."
        }
    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(f"Error cancelling {doctype} {name}: {str(e)}")
        return {
            "success": False,
            "message": f"Error cancelling document: {str(e)}"
        } 
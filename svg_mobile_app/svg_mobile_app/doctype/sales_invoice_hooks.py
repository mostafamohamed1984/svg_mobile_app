import frappe

def on_cancel_sales_invoice(doc, method=None):
    """Handle Sales Invoice cancellation by ignoring linked documents"""
    # Ignore linked documents to prevent infinite loop
    doc.ignore_linked_doctypes = ("Project Contractors", "Project Claim")

def on_trash_sales_invoice(doc, method=None):
    """Handle Sales Invoice deletion by clearing references"""
    if not doc.custom_for_project:
        return
    
    try:
        # Get the Project Contractor document
        project_contractor = frappe.get_doc("Project Contractors", doc.custom_for_project)
        
        # Clear sales_invoice references in Project Items
        for project_item in project_contractor.items:
            if project_item.sales_invoice == doc.name:
                frappe.db.set_value("Project Items", project_item.name, "sales_invoice", None)
        
        # Clear sales_invoice references in Fees and Deposits
        for fee_item in project_contractor.fees_and_deposits:
            if fee_item.sales_invoice == doc.name:
                frappe.db.set_value("Fees and Deposits", fee_item.name, "sales_invoice", None)
        
        frappe.db.commit()
        
    except Exception as e:
        frappe.log_error(f"Error clearing Sales Invoice references in Project Contractor {doc.custom_for_project}: {str(e)}")

def on_submit_sales_invoice(doc, method=None):
    """
    Update the sales_invoice reference in Project Items and Fees and Deposits tables
    when a Sales Invoice is submitted
    """
    if not doc.custom_for_project:
        return
    
    # Get the Project Contractor document
    project_contractor = frappe.get_doc("Project Contractors", doc.custom_for_project)
    
    # Update Project Items
    for item in doc.items:
        # Find matching items in Project Items table
        for project_item in project_contractor.items:
            if (project_item.item == item.item_code and 
                project_item.invoiced == 1 and 
                not project_item.sales_invoice):
                # Update the sales_invoice field
                frappe.db.set_value("Project Items", project_item.name, "sales_invoice", doc.name)
    
    # Update Fees and Deposits
    for item in doc.items:
        # Find matching items in Fees and Deposits table
        for fee_item in project_contractor.fees_and_deposits:
            if fee_item.item == item.item_code and not fee_item.sales_invoice:
                # Update the sales_invoice field
                frappe.db.set_value("Fees and Deposits", fee_item.name, "sales_invoice", doc.name)
    
    frappe.msgprint(f"Sales Invoice references updated in Project Contractor {doc.custom_for_project}") 
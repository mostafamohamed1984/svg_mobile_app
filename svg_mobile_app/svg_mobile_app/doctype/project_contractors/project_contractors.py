# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import json


class ProjectContractors(Document):
	pass


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_items_by_company(doctype, txt, searchfield, start, page_len, filters):
    """
    Custom query to filter items by company from item_defaults table
    """
    company = filters.get('company')
    
    # Debug log to verify the company value
    frappe.logger().debug(f"Filtering items for company: {company}")
    
    # Get items that have an Item Default entry for this company
    items = frappe.db.sql("""
        SELECT 
            i.name, i.item_name, i.description
        FROM 
            `tabItem` i
        INNER JOIN 
            `tabItem Default` id ON i.name = id.parent
        WHERE 
            id.company = %s
            AND (i.name LIKE %s OR i.item_name LIKE %s)
        GROUP BY
            i.name
        ORDER BY 
            i.name
        LIMIT %s, %s
    """, (
        company, 
        f"%{txt}%", 
        f"%{txt}%",
        start, 
        page_len
    ))
    
    # Log the result count
    frappe.logger().debug(f"Found {len(items)} items for company {company}")
    
    return items

@frappe.whitelist()
def check_project_claims_for_advances(project_contractors):
    """
    Check if there are Project Claims created for the fees and deposits items
    
    Args:
        project_contractors (str): Name of the Project Contractors document
    
    Returns:
        dict: Status and list of eligible items
    """
    # Get the Project Contractors document
    project_contractors_doc = frappe.get_doc("Project Contractors", project_contractors)
    
    if project_contractors_doc.docstatus != 1:
        return {"status": "error", "message": "Project Contractors document must be submitted"}
    
    # Get all sales invoices created for this Project Contractors
    sales_invoices = frappe.get_all(
        "Sales Invoice",
        filters={
            "custom_for_project": project_contractors,
            "docstatus": 1
        },
        pluck="name"
    )
    
    if not sales_invoices:
        return {
            "status": "info",
            "message": "No Sales Invoices found for this Project Contractors",
            "has_eligible_items": False
        }
    
    # Get all Project Claims that reference these Sales Invoices
    project_claims = frappe.get_all(
        "Project Claim",
        filters={
            "reference_invoice": ["in", sales_invoices],
            "docstatus": 1
        },
        pluck="name"
    )
    
    # Also check for Project Claims that might have these invoices in the invoice_references field
    for invoice in sales_invoices:
        additional_claims = frappe.get_all(
            "Project Claim",
            filters=[
                ["docstatus", "=", 1],
                ["invoice_references", "like", f"%{invoice}%"]
            ],
            pluck="name"
        )
        project_claims.extend(additional_claims)
    
    # Remove duplicates
    project_claims = list(set(project_claims))
    
    if not project_claims:
        return {
            "status": "info",
            "message": "No Project Claims found for the Sales Invoices of this Project Contractors",
            "has_eligible_items": False
        }
    
    # Get all claim items from these Project Claims
    claim_items = frappe.get_all(
        "Claim Items",
        filters={
            "parent": ["in", project_claims],
            "parenttype": "Project Claim"
        },
        fields=["item", "invoice_reference", "parent"]
    )
    
    # Create a map of items to their Project Claims
    item_claim_map = {}
    for claim_item in claim_items:
        if claim_item.item not in item_claim_map:
            item_claim_map[claim_item.item] = claim_item.parent
    
    # Check which fees and deposits items have Project Claims but don't have Employee Advances created
    eligible_items = []
    
    for item in project_contractors_doc.fees_and_deposits:
        if not item.employee_advance_created and item.item in item_claim_map:
            # Update the item with the Project Claim reference
            item.project_claim = item_claim_map[item.item]
            eligible_items.append(item.item)
    
    # Save the document to update the Project Claim references
    if eligible_items:
        project_contractors_doc.save()
    
    return {
        "status": "success",
        "has_eligible_items": len(eligible_items) > 0,
        "eligible_items": eligible_items
    }

@frappe.whitelist()
def create_employee_advances(project_contractors, advances):
    """
    Create Employee Advances from fees and deposits items
    
    Args:
        project_contractors (str): Name of the Project Contractors document
        advances (list): List of dictionaries containing advance details
            Each dict should have: employee, purpose, advance_amount, item, project_claim
    
    Returns:
        dict: Status and list of created Employee Advance documents
    """
    if isinstance(advances, str):
        advances = json.loads(advances)
    
    if not advances:
        return {"status": "error", "message": "No advances to create"}
    
    # Get the Project Contractors document
    project_contractors_doc = frappe.get_doc("Project Contractors", project_contractors)
    
    if project_contractors_doc.docstatus != 1:
        return {"status": "error", "message": "Project Contractors document must be submitted"}
    
    # Get company from the Project Contractors document
    company = project_contractors_doc.company
    
    # Get default advance account for the company
    default_advance_account = get_default_advance_account(company)
    if not default_advance_account:
        return {"status": "error", "message": f"No default advance account found for company {company}"}
    
    # Create Employee Advances
    created_advances = []
    updated_fees_and_deposits = []
    
    for advance_data in advances:
        try:
            # Verify that there's a Project Claim for this item
            project_claim = advance_data.get("project_claim")
            if not project_claim:
                # Try to find a Project Claim for this item
                project_claim = find_project_claim_for_item(advance_data.get("item"))
                if not project_claim:
                    continue  # Skip this item if no Project Claim is found
            
            # Create Employee Advance
            employee_advance = frappe.new_doc("Employee Advance")
            employee_advance.employee = advance_data.get("employee")
            employee_advance.purpose = advance_data.get("purpose")
            employee_advance.advance_amount = advance_data.get("advance_amount")
            employee_advance.posting_date = frappe.utils.today()
            employee_advance.company = company
            employee_advance.advance_account = default_advance_account
            
            # Add custom fields if they exist
            if frappe.get_meta("Employee Advance").has_field("custom_type"):
                employee_advance.custom_type = "Advance"
                
            # Add reference to Project Contractors
            if frappe.get_meta("Employee Advance").has_field("project_contractors_reference"):
                employee_advance.project_contractors_reference = project_contractors
            
            # Add reference to the specific item
            if frappe.get_meta("Employee Advance").has_field("item_reference"):
                employee_advance.item_reference = advance_data.get("item")
            
            # Add reference to the Project Claim
            if frappe.get_meta("Employee Advance").has_field("project_claim_reference"):
                employee_advance.project_claim_reference = project_claim
            
            # Save the Employee Advance
            employee_advance.insert()
            
            # Submit the Employee Advance
            employee_advance.submit()
            
            created_advances.append(employee_advance.name)
            
            # Add a comment to link back to Project Contractors and Project Claim
            employee_advance.add_comment(
                'Comment',
                text=f"Created from Project Contractors: {project_contractors}, Project Claim: {project_claim}"
            )
            
            # Track which fees and deposits item this advance was created for
            item = advance_data.get("item")
            if item:
                # Find the index of this item in the fees_and_deposits table
                for i, fee_item in enumerate(project_contractors_doc.fees_and_deposits):
                    if fee_item.item == item:
                        # Update the fees_and_deposits table
                        updated_fees_and_deposits.append({
                            "idx": i,
                            "item": item,
                            "employee_advance": employee_advance.name,
                            "project_claim": project_claim
                        })
                        break
            
            frappe.db.commit()
        except Exception as e:
            frappe.db.rollback()
            frappe.log_error(frappe.get_traceback(), f"Error creating Employee Advance from Project Contractors {project_contractors}")
            return {"status": "error", "message": str(e)}
    
    # Update the fees_and_deposits table to mark items as having had advances created
    if updated_fees_and_deposits:
        update_fees_and_deposits(project_contractors, updated_fees_and_deposits)
    
    return {
        "status": "success", 
        "message": f"Created {len(created_advances)} Employee Advances", 
        "advances": created_advances
    }

def find_project_claim_for_item(item_code):
    """
    Find a Project Claim for a specific item
    
    Args:
        item_code (str): Item code to search for
    
    Returns:
        str: Project Claim name or None
    """
    claim_items = frappe.get_all(
        "Claim Items",
        filters={
            "item": item_code,
            "parenttype": "Project Claim",
            "parent": ["in", frappe.get_all("Project Claim", filters={"docstatus": 1}, pluck="name")]
        },
        fields=["parent"],
        limit=1
    )
    
    return claim_items[0].parent if claim_items else None

def update_fees_and_deposits(project_contractors, updated_items):
    """
    Update the fees_and_deposits table to mark items as having had advances created
    
    Args:
        project_contractors (str): Name of the Project Contractors document
        updated_items (list): List of dictionaries containing item details to update
            Each dict should have: idx, item, employee_advance, project_claim
    """
    # Get the Project Contractors document
    doc = frappe.get_doc("Project Contractors", project_contractors)
    
    # Update the fees_and_deposits table
    for update_item in updated_items:
        idx = update_item.get("idx")
        if idx < len(doc.fees_and_deposits):
            fee_item = doc.fees_and_deposits[idx]
            if fee_item.item == update_item.get("item"):
                fee_item.employee_advance_created = 1
                fee_item.employee_advance = update_item.get("employee_advance")
                fee_item.project_claim = update_item.get("project_claim")
    
    # Save the document
    doc.save()

def get_default_advance_account(company):
    """
    Get the default advance account for the company
    
    Args:
        company (str): Company name
        
    Returns:
        str: Default advance account
    """
    # Try to get from company defaults
    default_account = frappe.get_cached_value('Company', company, 'default_employee_advance_account')
    
    if not default_account:
        # Try to find an account with "Employee Advance" in the name
        accounts = frappe.get_all(
            "Account",
            filters={
                "company": company,
                "account_type": "Payable",
                "is_group": 0,
                "name": ["like", "%Employee Advance%"]
            },
            fields=["name"]
        )
        
        if accounts:
            default_account = accounts[0].name
    
    if not default_account:
        # Try to find any payable account
        accounts = frappe.get_all(
            "Account",
            filters={
                "company": company,
                "account_type": "Payable",
                "is_group": 0
            },
            fields=["name"],
            limit=1
        )
        
        if accounts:
            default_account = accounts[0].name
    
    return default_account

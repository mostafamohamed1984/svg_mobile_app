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
def check_project_claims_for_advances(project_contractors, include_partial_advances=False):
    """
    Check if there are Project Claims created for the fees and deposits items
    
    Args:
        project_contractors (str): Name of the Project Contractors document
        include_partial_advances (bool): Whether to include items with partial advances
    
    Returns:
        dict: Status and list of eligible items with their claimed amounts
    """
    # Convert parameter to boolean if it's a string
    if isinstance(include_partial_advances, str):
        include_partial_advances = include_partial_advances.lower() == 'true'
    
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
    
    # Get all claim items from these Project Claims with their amounts
    claim_items = frappe.get_all(
        "Claim Items",
        filters={
            "parent": ["in", project_claims],
            "parenttype": "Project Claim"
        },
        fields=["item", "amount", "invoice_reference", "parent"]
    )
    
    # Create a map of items to their claimed amounts
    item_claim_map = {}
    for claim_item in claim_items:
        if claim_item.item not in item_claim_map:
            item_claim_map[claim_item.item] = {
                "claimed_amount": claim_item.amount,
                "invoice_reference": claim_item.invoice_reference
            }
        else:
            # If there are multiple claims for the same item, sum up the amounts
            item_claim_map[claim_item.item]["claimed_amount"] += claim_item.amount
    
    # Check which fees and deposits items have Project Claims but don't have Employee Advances created
    # or have partial advances if include_partial_advances is True
    eligible_items = []
    
    for item in project_contractors_doc.fees_and_deposits:
        is_eligible = False
        
        if item.item in item_claim_map:
            # Check if the item has no advances or only partial advances
            if not item.employee_advance_created:
                is_eligible = True
            elif include_partial_advances:
                # Calculate total amount of advances already created
                total_advanced = 0
                if hasattr(item, "employee_advances") and item.employee_advances:
                    advances = item.employee_advances.split(",")
                    for advance_name in advances:
                        advance_amount = frappe.get_value("Employee Advance", advance_name, "advance_amount")
                        if advance_amount:
                            total_advanced += float(advance_amount)
                
                # Get the claimed amount
                claimed_amount = item_claim_map[item.item]["claimed_amount"]
                
                # If total advanced is less than claimed amount, it's eligible for more advances
                if total_advanced < claimed_amount:
                    is_eligible = True
                    
                    # Add remaining amount info
                    item_claim_map[item.item]["remaining_amount"] = claimed_amount - total_advanced
            
            if is_eligible:
                # Add to eligible items with additional claim info
                eligible_items.append({
                    "item": item.item,
                    "rate": item.rate,  # Original rate from fees and deposits
                    "claimed_amount": item_claim_map[item.item]["claimed_amount"],  # Amount claimed in Project Claim
                    "invoice_reference": item_claim_map[item.item].get("invoice_reference"),
                    "remaining_amount": item_claim_map[item.item].get("remaining_amount")
                })
    
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
    
    # Get company currency
    company_currency = frappe.get_cached_value('Company', company, 'default_currency')
    
    # Create Employee Advances
    created_advances = []
    updated_fees_and_deposits = {}
    
    for advance_data in advances:
        try:
            # Create Employee Advance
            employee_advance = frappe.new_doc("Employee Advance")
            employee_advance.employee = advance_data.get("employee")
            employee_advance.purpose = advance_data.get("purpose")
            employee_advance.advance_amount = advance_data.get("advance_amount")
            employee_advance.posting_date = frappe.utils.today()
            employee_advance.company = company
            employee_advance.advance_account = default_advance_account
            
            # Set currency and exchange rate to prevent errors
            if frappe.get_meta("Employee Advance").has_field("currency"):
                employee_advance.currency = company_currency
            
            if frappe.get_meta("Employee Advance").has_field("exchange_rate"):
                # Check if we need to set an exchange rate
                advance_currency = getattr(employee_advance, "currency", company_currency)
                if advance_currency != company_currency:
                    # Try to get exchange rate from Currency Exchange
                    exchange_rate = get_exchange_rate(advance_currency, company_currency)
                    if not exchange_rate or exchange_rate == 0:
                        # If exchange rate is not found or is zero, set a default value
                        exchange_rate = 1.0
                        frappe.msgprint(f"Exchange rate for {advance_currency} to {company_currency} not found. Using default rate of 1.0")
                    
                    employee_advance.exchange_rate = exchange_rate
                else:
                    # Same currency, use exchange rate 1
                    employee_advance.exchange_rate = 1.0
            
            # Add custom fields if they exist
            if frappe.get_meta("Employee Advance").has_field("custom_type"):
                employee_advance.custom_type = "Advance"
                
            # Add reference to Project Contractors
            if frappe.get_meta("Employee Advance").has_field("project_contractors_reference"):
                employee_advance.project_contractors_reference = project_contractors
            
            # Add reference to the specific item
            if frappe.get_meta("Employee Advance").has_field("item_reference"):
                employee_advance.item_reference = advance_data.get("item")
            
            # Save the Employee Advance
            employee_advance.insert()
            
            # Submit the advance if possible
            try:
                employee_advance.submit()
            except Exception as e:
                frappe.log_error(f"Error submitting Employee Advance: {str(e)}")
                frappe.msgprint(f"Employee Advance {employee_advance.name} created but could not be submitted automatically.")
            
            created_advances.append(employee_advance.name)
            
            # Update the fees_and_deposits table to mark this item as having an employee advance created
            item_code = advance_data.get("item")
            if item_code not in updated_fees_and_deposits:
                updated_fees_and_deposits[item_code] = {
                    "item": item_code,
                    "employee_advances": [employee_advance.name]
                }
            else:
                updated_fees_and_deposits[item_code]["employee_advances"].append(employee_advance.name)
            
        except Exception as e:
            frappe.log_error(message=f"Error creating employee advance: {str(e)}", title="Create Employee Advance Error")
            frappe.msgprint(f"Error creating advance for {advance_data.get('employee')}: {str(e)}")
    
    # Update the Project Contractors document with employee advance references
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
    Update the fees_and_deposits table in the Project Contractors document
    to mark items as having had Employee Advances created
    
    Args:
        project_contractors (str): Name of the Project Contractors document
        updated_items (dict): Dict of items with their updates
            Keys are item codes, values are dicts with keys:
                - item: Item code
                - employee_advances: List of Employee Advance document names
    
    Returns:
        None
    """
    # Get the Project Contractors document
    doc = frappe.get_doc("Project Contractors", project_contractors)
    
    # Update each item in the fees_and_deposits table
    for fee_item in doc.fees_and_deposits:
        if fee_item.item in updated_items:
            update_item = updated_items[fee_item.item]
            
            # Store all advances as a comma-separated list in the custom field
            advances_list = update_item.get("employee_advances", [])
            
            # Get the existing advances if any
            existing_advances = []
            if hasattr(fee_item, "employee_advances") and fee_item.employee_advances:
                existing_advances = fee_item.employee_advances.split(",")
            
            # Combine existing and new advances, removing duplicates
            all_advances = list(set(existing_advances + advances_list))
            
            # Only mark as completed if the total advance amount meets or exceeds the claimed amount
            claimed_amount = 0
            total_advanced = 0
            
            # If claimed amount is still 0, fall back to the original rate
            if not claimed_amount:
                claimed_amount = fee_item.rate
            
            # Calculate total advance amount
            for advance_name in all_advances:
                advance = frappe.get_value("Employee Advance", advance_name, "advance_amount")
                if advance:
                    total_advanced += float(advance)
            
            # Store the first advance for backward compatibility
            if advances_list and len(advances_list) > 0:
                fee_item.employee_advance = advances_list[0]
            
            # Store all advances as a comma-separated list
            if hasattr(fee_item, "employee_advances"):
                fee_item.employee_advances = ",".join(all_advances)
            
            # Only mark as complete if total advanced meets or exceeds claimed amount
            if total_advanced >= claimed_amount:
                fee_item.employee_advance_created = 1
            else:
                # Ensure it's marked as not complete if partial advances exist
                fee_item.employee_advance_created = 0
    
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

def get_exchange_rate(from_currency, to_currency):
    """
    Get exchange rate between two currencies
    
    Args:
        from_currency (str): From Currency
        to_currency (str): To Currency
    
    Returns:
        float: Exchange rate or 1.0 if not found
    """
    try:
        # Try to get the exchange rate from Currency Exchange
        exchange_rate = frappe.db.get_value(
            "Currency Exchange",
            {
                "from_currency": from_currency,
                "to_currency": to_currency,
                "date": ["<=", frappe.utils.today()]
            },
            "exchange_rate",
            order_by="date desc"
        )
        
        if not exchange_rate:
            # Try the reverse rate
            reverse_rate = frappe.db.get_value(
                "Currency Exchange",
                {
                    "from_currency": to_currency,
                    "to_currency": from_currency,
                    "date": ["<=", frappe.utils.today()]
                },
                "exchange_rate",
                order_by="date desc"
            )
            
            if reverse_rate:
                exchange_rate = 1.0 / float(reverse_rate)
        
        return float(exchange_rate) if exchange_rate else 1.0
    except Exception as e:
        frappe.log_error(f"Error getting exchange rate: {str(e)}")
        return 1.0

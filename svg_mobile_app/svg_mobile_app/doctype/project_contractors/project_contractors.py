# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


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

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
    
    return frappe.db.sql("""
        SELECT 
            item.name, item.item_name, item.item_group
        FROM 
            `tabItem` item
        INNER JOIN 
            `tabItem Default` item_default ON item.name = item_default.parent
        WHERE 
            item_default.company = %s
            AND (item.name LIKE %s OR item.item_name LIKE %s)
        ORDER BY 
            item.name
        LIMIT %s, %s
    """, (
        company, 
        f"%{txt}%", 
        f"%{txt}%",
        start, 
        page_len
    ))

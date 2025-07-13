# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt, cstr, fmt_money
from frappe import _

def execute(filters=None):
    """
    Detailed Project Claim Report
    Comprehensive project breakdown with VAT calculations and bilingual support
    """
    if not filters:
        filters = {}

    try:
        columns = get_columns()
        data = get_data(filters)

        # Debug logging
        frappe.logger().debug(f"Detailed Project Claim Report - Filters: {filters}")
        frappe.logger().debug(f"Detailed Project Claim Report - Data rows: {len(data) if data else 0}")

        return columns, data
    except Exception as e:
        frappe.logger().error(f"Error in Detailed Project Claim Report: {str(e)}")
        # Return error message in report format
        columns = get_columns()
        error_data = [{
            'project_info': 'Error loading report',
            'customer_info': '',
            'item_description': f'Error: {str(e)}',
            'amount': 0,
            'tax_rate': 0,
            'tax_amount': 0,
            'total_amount': 0,
            'date': '',
            'status': ''
        }]
        return columns, error_data

def get_columns():
    """Define report columns for detailed project claim"""
    return [
        {
            "fieldname": "project_info",
            "label": _("Project Information"),
            "fieldtype": "Data",
            "width": 200
        },
        {
            "fieldname": "customer_info",
            "label": _("Customer Details"),
            "fieldtype": "Data",
            "width": 180
        },
        {
            "fieldname": "item_description",
            "label": _("Item Description"),
            "fieldtype": "Data",
            "width": 250
        },
        {
            "fieldname": "amount",
            "label": _("Amount"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "tax_rate",
            "label": _("Tax Rate %"),
            "fieldtype": "Percent",
            "width": 100
        },
        {
            "fieldname": "tax_amount",
            "label": _("Tax Amount"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "total_amount",
            "label": _("Total Amount"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "date",
            "label": _("Date"),
            "fieldtype": "Date",
            "width": 100
        },
        {
            "fieldname": "status",
            "label": _("Status"),
            "fieldtype": "Data",
            "width": 100
        }
    ]

def get_data(filters):
    """Get detailed project claim data"""
    conditions = get_conditions(filters)

    # Simplified query focusing on essential data
    query = """
        SELECT
            pc.name as claim_name,
            pc.date,
            pc.status,
            pc.customer,
            pc.customer_name,
            pc.project_name,
            pc.for_project,
            pc.claim_amount,
            pc.tax_ratio,
            pc.tax_amount,
            pc.being,
            pc.reference_invoice,

            ci.item,
            ci.amount as item_amount,
            ci.ratio as item_ratio,
            ci.tax_rate as item_tax_rate,
            ci.tax_amount as item_tax_amount,
            ci.invoice_reference,

            i.item_name,
            i.item_group

        FROM
            `tabProject Claim` pc
        LEFT JOIN
            `tabClaim Items` ci ON pc.name = ci.parent
        LEFT JOIN
            `tabItem` i ON ci.item = i.name
        WHERE
            pc.docstatus = 1
            {conditions}
        ORDER BY
            pc.date DESC, pc.name, ci.idx
    """.format(conditions=conditions)

    raw_data = frappe.db.sql(query, filters, as_dict=True)

    # Return empty list with message if no data
    if not raw_data:
        # Check if we have any Project Claims at all for debugging
        total_claims = frappe.db.count("Project Claim", {"docstatus": 1})

        return [{
            'project_info': f'No data found for the selected criteria',
            'customer_info': f'Total claims in system: {total_claims}',
            'item_description': 'Please adjust your filters and try again. Check if you have submitted Project Claims with Claim Items.',
            'amount': 0,
            'tax_rate': 0,
            'tax_amount': 0,
            'total_amount': 0,
            'date': '',
            'status': ''
        }]

    # Process data for detailed view
    try:
        processed_data = process_detailed_claim_data(raw_data)

        # If processing returns empty data, create simple fallback
        if not processed_data:
            processed_data = create_simple_fallback_data(raw_data)

        return processed_data
    except Exception as e:
        frappe.logger().error(f"Error processing detailed claim data: {str(e)}")
        # Return simple fallback data
        return create_simple_fallback_data(raw_data)

def get_conditions(filters):
    """Build WHERE conditions based on filters"""
    conditions = []
    
    if filters.get("customer"):
        conditions.append("AND pc.customer = %(customer)s")
    
    if filters.get("project"):
        conditions.append("AND pc.for_project = %(project)s")
    
    if filters.get("claim_name"):
        conditions.append("AND pc.name = %(claim_name)s")
    
    if filters.get("from_date"):
        conditions.append("AND pc.date >= %(from_date)s")
    
    if filters.get("to_date"):
        conditions.append("AND pc.date <= %(to_date)s")
    
    if filters.get("status"):
        conditions.append("AND pc.status = %(status)s")
    
    return " ".join(conditions)

def process_detailed_claim_data(raw_data):
    """Process raw data for detailed project claim view - simplified version"""
    processed_data = []

    if not raw_data:
        return processed_data

    # Group data by claim
    claim_groups = {}
    for row in raw_data:
        claim_name = row.get('claim_name')
        if claim_name not in claim_groups:
            claim_groups[claim_name] = {
                'claim_data': row,
                'items': []
            }

        if row.get('item'):
            claim_groups[claim_name]['items'].append(row)

    # Process each claim group with simplified structure
    for claim_name, claim_group in claim_groups.items():
        claim_data = claim_group['claim_data']
        items = claim_group['items']

        # Add simple header row
        processed_data.append({
            'project_info': f"Project: {claim_data.get('project_name', 'N/A')}",
            'customer_info': f"Customer: {claim_data.get('customer_name', claim_data.get('customer', 'N/A'))}",
            'item_description': f"Claim: {claim_name} | Date: {claim_data.get('date', '')}",
            'amount': '',
            'tax_rate': '',
            'tax_amount': '',
            'total_amount': flt(claim_data.get('claim_amount', 0)),
            'date': claim_data.get('date'),
            'status': claim_data.get('status', ''),
            '_is_header': True
        })

        # Add items
        for item in items:
            item_amount = flt(item.get('item_amount', 0))
            tax_rate = flt(item.get('item_tax_rate', 0))
            tax_amount = flt(item.get('item_tax_amount', 0))
            total_amount = item_amount + tax_amount

            processed_data.append({
                'project_info': '',
                'customer_info': item.get('item_group', 'Other'),
                'item_description': f"{item.get('item_name', item.get('item', 'N/A'))} ({item.get('invoice_reference', '')})",
                'amount': item_amount,
                'tax_rate': tax_rate,
                'tax_amount': tax_amount,
                'total_amount': total_amount,
                'date': '',
                'status': '',
                '_is_item': True
            })

        # Add total row
        total_amount = flt(claim_data.get('claim_amount', 0))
        total_tax = flt(claim_data.get('tax_amount', 0))

        processed_data.append({
            'project_info': '',
            'customer_info': '',
            'item_description': f"TOTAL - {claim_name}",
            'amount': total_amount,
            'tax_rate': flt(claim_data.get('tax_ratio', 0)),
            'tax_amount': total_tax,
            'total_amount': total_amount + total_tax,
            'date': '',
            'status': '',
            '_is_total': True
        })

        # Add separator
        processed_data.append({
            'project_info': '─' * 30,
            'customer_info': '',
            'item_description': '',
            'amount': '',
            'tax_rate': '',
            'tax_amount': '',
            'total_amount': '',
            'date': '',
            'status': '',
            '_is_separator': True
        })

    return processed_data

def create_simple_fallback_data(raw_data):
    """Create simple fallback data if complex processing fails"""
    simple_data = []

    for row in raw_data:
        simple_data.append({
            'project_info': row.get('project_name', 'N/A'),
            'customer_info': row.get('customer_name', row.get('customer', 'N/A')),
            'item_description': f"{row.get('item_name', row.get('item', 'N/A'))} - {row.get('claim_name', '')}",
            'amount': flt(row.get('item_amount', 0)),
            'tax_rate': flt(row.get('item_tax_rate', 0)),
            'tax_amount': flt(row.get('item_tax_amount', 0)),
            'total_amount': flt(row.get('item_amount', 0)) + flt(row.get('item_tax_amount', 0)),
            'date': row.get('date', ''),
            'status': row.get('status', '')
        })

    return simple_data

# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt, cstr
from frappe import _

def execute(filters=None):
    """
    Project Claim Statement Report
    Shows project phases with balance, paid, value, document number, date, and description
    """
    if not filters:
        filters = {}
    
    columns = get_columns()
    data = get_data(filters)
    
    return columns, data

def get_columns():
    """Define report columns in Arabic"""
    return [
        {
            "fieldname": "phase_name",
            "label": _("البيان"),  # Description
            "fieldtype": "Data",
            "width": 200
        },
        {
            "fieldname": "date",
            "label": _("التاريخ"),  # Date
            "fieldtype": "Date",
            "width": 100
        },
        {
            "fieldname": "document_number",
            "label": _("رقم السند"),  # Document Number
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "value",
            "label": _("القيمة"),  # Value
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "paid",
            "label": _("المدفوع"),  # Paid
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "balance",
            "label": _("الرصيد"),  # Balance
            "fieldtype": "Currency",
            "width": 120
        }
    ]

def get_data(filters):
    """Get report data based on filters"""
    conditions = get_conditions(filters)
    
    # Main query to get project claim data
    query = """
        SELECT 
            pc.name as claim_name,
            pc.date,
            pc.name as document_number,
            pc.claim_amount as value,
            pc.paid_amount as paid,
            pc.outstanding_amount as balance,
            pc.being as description,
            pc.customer,
            pc.project_name,
            pc.for_project,
            ci.item,
            ci.amount as item_amount,
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
    
    # Process data to group by phases
    processed_data = process_claim_data(raw_data)
    
    return processed_data

def get_conditions(filters):
    """Build WHERE conditions based on filters"""
    conditions = []
    
    if filters.get("customer"):
        conditions.append("AND pc.customer = %(customer)s")
    
    if filters.get("project"):
        conditions.append("AND pc.for_project = %(project)s")
    
    if filters.get("from_date"):
        conditions.append("AND pc.date >= %(from_date)s")
    
    if filters.get("to_date"):
        conditions.append("AND pc.date <= %(to_date)s")
    
    if filters.get("status"):
        conditions.append("AND pc.status = %(status)s")
    
    return " ".join(conditions)

def process_claim_data(raw_data):
    """Process raw data to create phase-based grouping"""
    processed_data = []
    claim_groups = {}
    
    # Group data by claim
    for row in raw_data:
        claim_name = row.get('claim_name')
        if claim_name not in claim_groups:
            claim_groups[claim_name] = {
                'claim_data': row,
                'items': []
            }
        
        if row.get('item'):
            claim_groups[claim_name]['items'].append(row)
    
    # Process each claim group
    for claim_name, claim_group in claim_groups.items():
        claim_data = claim_group['claim_data']
        items = claim_group['items']
        
        # Categorize items by type/phase
        phases = categorize_items_by_phase(items, claim_data)
        
        # Add phase rows to processed data
        for phase in phases:
            processed_data.append(phase)
    
    return processed_data

def categorize_items_by_phase(items, claim_data):
    """Categorize items into phases based on item groups and descriptions"""
    phases = []
    
    # Group items by item_group
    item_groups = {}
    for item in items:
        group = item.get('item_group', 'Other')
        if group not in item_groups:
            item_groups[group] = []
        item_groups[group].append(item)
    
    # Map item groups to phase names (Arabic)
    phase_mapping = {
        'Orbit Engineering Items': 'التصميم',  # Design
        'Project Fees item': 'رسوم المشروع',  # Project Fees
        'Supervision Items': 'الإشراف',  # Supervision
        'Modification Items': 'تعديل التصميم',  # Modify Design
        'Additional Supervision': 'إشراف إضافي'  # Additional Supervision
    }
    
    # Create phase entries
    for group, group_items in item_groups.items():
        phase_name = phase_mapping.get(group, group)
        
        # Calculate totals for this phase
        phase_value = sum(flt(item.get('item_amount', 0)) for item in group_items)
        
        # For now, use claim-level data for paid and balance
        # In a more sophisticated system, this would be calculated per phase
        phase_paid = flt(claim_data.get('paid', 0)) * (phase_value / flt(claim_data.get('value', 1)))
        phase_balance = phase_value - phase_paid
        
        phases.append({
            'phase_name': phase_name,
            'date': claim_data.get('date'),
            'document_number': claim_data.get('document_number'),
            'value': phase_value,
            'paid': phase_paid,
            'balance': phase_balance
        })
    
    # If no items, create a single entry with claim description
    if not phases:
        description = claim_data.get('description', 'مطالبة مشروع')  # Project Claim
        phases.append({
            'phase_name': description[:50] + '...' if len(description) > 50 else description,
            'date': claim_data.get('date'),
            'document_number': claim_data.get('document_number'),
            'value': flt(claim_data.get('value', 0)),
            'paid': flt(claim_data.get('paid', 0)),
            'balance': flt(claim_data.get('balance', 0))
        })
    
    return phases

def get_report_summary(data):
    """Generate report summary"""
    if not data:
        return []
    
    total_value = sum(flt(row.get('value', 0)) for row in data)
    total_paid = sum(flt(row.get('paid', 0)) for row in data)
    total_balance = sum(flt(row.get('balance', 0)) for row in data)
    
    return [
        {
            "value": total_value,
            "label": _("إجمالي القيمة"),  # Total Value
            "datatype": "Currency"
        },
        {
            "value": total_paid,
            "label": _("إجمالي المدفوع"),  # Total Paid
            "datatype": "Currency"
        },
        {
            "value": total_balance,
            "label": _("إجمالي الرصيد"),  # Total Balance
            "datatype": "Currency"
        }
    ]

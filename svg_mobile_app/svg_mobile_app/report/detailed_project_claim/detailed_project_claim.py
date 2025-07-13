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
    
    columns = get_columns()
    data = get_data(filters)
    
    return columns, data

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
    
    # Main query for detailed project claim data
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
            pc.invoice_references,
            
            ci.item,
            ci.amount as item_amount,
            ci.ratio as item_ratio,
            ci.tax_rate as item_tax_rate,
            ci.tax_amount as item_tax_amount,
            ci.invoice_reference,
            ci.project_contractor_reference,
            
            i.item_name,
            i.item_group,
            
            si.grand_total as invoice_total,
            si.net_total as invoice_net_total,
            si.total_taxes_and_charges as invoice_tax_total,
            
            proj.customer_name as project_customer,
            proj.project_amount as project_total_amount
            
        FROM 
            `tabProject Claim` pc
        LEFT JOIN 
            `tabClaim Items` ci ON pc.name = ci.parent
        LEFT JOIN 
            `tabItem` i ON ci.item = i.name
        LEFT JOIN 
            `tabSales Invoice` si ON ci.invoice_reference = si.name
        LEFT JOIN 
            `tabProject Contractors` proj ON pc.for_project = proj.name
        WHERE 
            pc.docstatus = 1
            {conditions}
        ORDER BY 
            pc.date DESC, pc.name, ci.idx
    """.format(conditions=conditions)
    
    raw_data = frappe.db.sql(query, filters, as_dict=True)
    
    # Process data for detailed view
    processed_data = process_detailed_claim_data(raw_data)
    
    return processed_data

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
    """Process raw data for detailed project claim view"""
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
        
        # Add header row for claim
        processed_data.append(create_claim_header_row(claim_data))
        
        # Add customer information row
        processed_data.append(create_customer_info_row(claim_data))
        
        # Group items by category/type
        item_categories = group_items_by_category(items)
        
        # Add category sections
        for category, category_items in item_categories.items():
            # Add category header
            processed_data.append(create_category_header_row(category))
            
            # Add items in this category
            for item in category_items:
                processed_data.append(create_item_row(item, claim_data))
            
            # Add category subtotal
            processed_data.append(create_category_subtotal_row(category, category_items))
        
        # Add claim total row
        processed_data.append(create_claim_total_row(claim_data, items))
        
        # Add separator
        processed_data.append(create_separator_row())
    
    return processed_data

def create_claim_header_row(claim_data):
    """Create header row for claim"""
    project_info = f"Project: {claim_data.get('project_name', 'N/A')} | Claim: {claim_data.get('claim_name')}"
    
    return {
        'project_info': project_info,
        'customer_info': '',
        'item_description': f"Claim Date: {claim_data.get('date', '')}",
        'amount': '',
        'tax_rate': '',
        'tax_amount': '',
        'total_amount': '',
        'date': claim_data.get('date'),
        'status': claim_data.get('status', ''),
        '_is_header': True
    }

def create_customer_info_row(claim_data):
    """Create customer information row"""
    customer_info = f"{claim_data.get('customer_name', claim_data.get('customer', 'N/A'))}"
    
    return {
        'project_info': '',
        'customer_info': customer_info,
        'item_description': claim_data.get('being', '')[:100] + '...' if len(claim_data.get('being', '')) > 100 else claim_data.get('being', ''),
        'amount': '',
        'tax_rate': '',
        'tax_amount': '',
        'total_amount': '',
        'date': '',
        'status': '',
        '_is_customer_info': True
    }

def group_items_by_category(items):
    """Group items by category/type"""
    categories = {}
    
    for item in items:
        # Determine category based on item group
        item_group = item.get('item_group', 'Other')
        
        # Map to display categories
        category_mapping = {
            'Orbit Engineering Items': 'Engineering Work / أعمال هندسية',
            'Project Fees item': 'Project Fees / رسوم المشروع',
            'Supervision Items': 'Supervision / الإشراف',
            'Modification Items': 'Design Modifications / تعديلات التصميم'
        }
        
        category = category_mapping.get(item_group, item_group)
        
        if category not in categories:
            categories[category] = []
        
        categories[category].append(item)
    
    return categories

def create_category_header_row(category):
    """Create category header row"""
    return {
        'project_info': '',
        'customer_info': '',
        'item_description': f"=== {category} ===",
        'amount': '',
        'tax_rate': '',
        'tax_amount': '',
        'total_amount': '',
        'date': '',
        'status': '',
        '_is_category_header': True
    }

def create_item_row(item, claim_data):
    """Create individual item row"""
    item_amount = flt(item.get('item_amount', 0))
    tax_rate = flt(item.get('item_tax_rate', 0))
    tax_amount = flt(item.get('item_tax_amount', 0))
    total_amount = item_amount + tax_amount
    
    return {
        'project_info': '',
        'customer_info': '',
        'item_description': f"{item.get('item_name', item.get('item', 'N/A'))} ({item.get('invoice_reference', '')})",
        'amount': item_amount,
        'tax_rate': tax_rate,
        'tax_amount': tax_amount,
        'total_amount': total_amount,
        'date': '',
        'status': '',
        '_is_item': True
    }

def create_category_subtotal_row(category, items):
    """Create subtotal row for category"""
    total_amount = sum(flt(item.get('item_amount', 0)) for item in items)
    total_tax = sum(flt(item.get('item_tax_amount', 0)) for item in items)
    grand_total = total_amount + total_tax
    
    return {
        'project_info': '',
        'customer_info': '',
        'item_description': f"Subtotal - {category}",
        'amount': total_amount,
        'tax_rate': '',
        'tax_amount': total_tax,
        'total_amount': grand_total,
        'date': '',
        'status': '',
        '_is_subtotal': True
    }

def create_claim_total_row(claim_data, items):
    """Create total row for entire claim"""
    claim_amount = flt(claim_data.get('claim_amount', 0))
    tax_amount = flt(claim_data.get('tax_amount', 0))
    total_with_tax = claim_amount + tax_amount
    
    return {
        'project_info': '',
        'customer_info': '',
        'item_description': f"TOTAL CLAIM / إجمالي المطالبة",
        'amount': claim_amount,
        'tax_rate': flt(claim_data.get('tax_ratio', 0)),
        'tax_amount': tax_amount,
        'total_amount': total_with_tax,
        'date': '',
        'status': '',
        '_is_total': True
    }

def create_separator_row():
    """Create separator row between claims"""
    return {
        'project_info': '─' * 50,
        'customer_info': '',
        'item_description': '',
        'amount': '',
        'tax_rate': '',
        'tax_amount': '',
        'total_amount': '',
        'date': '',
        'status': '',
        '_is_separator': True
    }

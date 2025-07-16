# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt, cstr, getdate, fmt_money, formatdate
from frappe import _
import json

@frappe.whitelist()
def get_customer_statement_data(customer, from_date=None, to_date=None):
    """
    Get comprehensive customer statement data showing the complete business flow:
    Project Contractors → Sales Invoice → Project Claim → Journal Entry
    """
    if not customer:
        frappe.throw(_("Customer is required"))
    
    # Get customer details
    customer_doc = frappe.get_doc("Customer", customer)
    
    # Set default date range if not provided
    if not from_date:
        from_date = frappe.utils.add_months(frappe.utils.today(), -12)
    if not to_date:
        to_date = frappe.utils.today()
    
    # Get all project contractors for this customer
    project_contractors = get_customer_project_contractors(customer, from_date, to_date)
    
    # Get sales invoices for these projects
    sales_invoices = get_project_sales_invoices(project_contractors, from_date, to_date)
    
    # Get project claims against these invoices
    project_claims = get_project_claims(sales_invoices, from_date, to_date)
    
    # Get journal entries from these claims
    journal_entries = get_claim_journal_entries(project_claims, from_date, to_date)
    
    # Process and group data by service types
    statement_data = process_statement_data(
        customer_doc, project_contractors, sales_invoices, 
        project_claims, journal_entries, from_date, to_date
    )
    
    return statement_data

def get_customer_project_contractors(customer, from_date, to_date):
    """Get all project contractors for the customer within date range"""
    return frappe.db.sql("""
        SELECT 
            name, project_name, date, customer_name, 
            total_project_amount, company
        FROM `tabProject Contractors`
        WHERE customer = %(customer)s
        AND date BETWEEN %(from_date)s AND %(to_date)s
        AND docstatus = 1
        ORDER BY date DESC
    """, {
        'customer': customer,
        'from_date': from_date,
        'to_date': to_date
    }, as_dict=True)

def get_project_sales_invoices(project_contractors, from_date, to_date):
    """Get sales invoices for project contractors"""
    if not project_contractors:
        return []
    
    project_names = [pc['name'] for pc in project_contractors]
    
    return frappe.db.sql("""
        SELECT
            si.name, si.posting_date, si.customer, si.grand_total,
            si.outstanding_amount, si.status, si.custom_for_project,
            pc.project_name, si.due_date
        FROM `tabSales Invoice` si
        LEFT JOIN `tabProject Contractors` pc ON si.custom_for_project = pc.name
        WHERE si.custom_for_project IN %(projects)s
        AND si.posting_date BETWEEN %(from_date)s AND %(to_date)s
        AND si.docstatus = 1
        ORDER BY si.posting_date DESC
    """, {
        'projects': project_names,
        'from_date': from_date,
        'to_date': to_date
    }, as_dict=True)

def get_project_claims(sales_invoices, from_date, to_date):
    """Get project claims against sales invoices"""
    if not sales_invoices:
        return []
    
    invoice_names = [si['name'] for si in sales_invoices]
    
    # Get project claims
    claims = frappe.db.sql("""
        SELECT 
            pc.name, pc.date, pc.customer, pc.claim_amount,
            pc.paid_amount, pc.outstanding_amount, pc.status,
            pc.reference_invoice, pc.for_project, pc.project_name,
            pc.being, pc.mode_of_payment, pc.reference_number
        FROM `tabProject Claim` pc
        WHERE pc.reference_invoice IN %(invoices)s
        AND pc.date BETWEEN %(from_date)s AND %(to_date)s
        AND pc.docstatus = 1
        ORDER BY pc.date DESC
    """, {
        'invoices': invoice_names,
        'from_date': from_date,
        'to_date': to_date
    }, as_dict=True)
    
    # Get claim items for each claim
    for claim in claims:
        claim['items'] = frappe.db.sql("""
            SELECT 
                ci.item, ci.amount, ci.invoice_reference,
                i.item_name, i.item_group
            FROM `tabClaim Items` ci
            LEFT JOIN `tabItem` i ON ci.item = i.name
            WHERE ci.parent = %(claim)s
            ORDER BY ci.idx
        """, {'claim': claim['name']}, as_dict=True)
    
    return claims

def get_claim_journal_entries(project_claims, from_date, to_date):
    """Get journal entries created from project claims"""
    if not project_claims:
        return []
    
    # Get journal entries that reference these claims
    journal_entries = frappe.db.sql("""
        SELECT DISTINCT
            je.name, je.posting_date, je.total_debit, je.total_credit,
            je.user_remark, je.cheque_no, je.cheque_date
        FROM `tabJournal Entry` je
        JOIN `tabJournal Entry Account` jea ON je.name = jea.parent
        WHERE je.posting_date BETWEEN %(from_date)s AND %(to_date)s
        AND je.docstatus = 1
        AND (je.user_remark LIKE '%%Project Claim%%' 
             OR jea.reference_type = 'Project Claim')
        ORDER BY je.posting_date DESC
    """, {
        'from_date': from_date,
        'to_date': to_date
    }, as_dict=True)
    
    # Get journal entry accounts for each entry
    for je in journal_entries:
        je['accounts'] = frappe.db.sql("""
            SELECT 
                jea.account, jea.debit_in_account_currency as debit,
                jea.credit_in_account_currency as credit,
                jea.party_type, jea.party, jea.reference_type,
                jea.reference_name, jea.user_remark
            FROM `tabJournal Entry Account` jea
            WHERE jea.parent = %(je_name)s
            ORDER BY jea.idx
        """, {'je_name': je['name']}, as_dict=True)
    
    return journal_entries

def process_statement_data(customer_doc, project_contractors, sales_invoices, 
                         project_claims, journal_entries, from_date, to_date):
    """Process and organize data for customer statement display"""
    
    # Group data by service types based on claim items
    service_groups = {}
    
    # Process project claims and their items
    for claim in project_claims:
        for item in claim.get('items', []):
            service_type = get_service_type_from_item(item)
            
            if service_type not in service_groups:
                service_groups[service_type] = {
                    'service_name': service_type,
                    'service_name_ar': get_arabic_service_name(service_type),
                    'transactions': [],
                    'total_value': 0,
                    'total_paid': 0,
                    'total_balance': 0
                }
            
            # Add transaction to service group
            transaction = {
                'date': claim['date'],
                'document_number': claim['name'],
                'description': item['item_name'] or claim['being'],
                'value': flt(item['amount']),
                'paid': flt(claim['paid_amount']) * (flt(item['amount']) / flt(claim['claim_amount'])) if flt(claim['claim_amount']) > 0 else 0,
                'balance': 0,  # Will be calculated later
                'invoice_reference': item['invoice_reference'],
                'claim_status': claim['status']
            }
            
            service_groups[service_type]['transactions'].append(transaction)
    
    # Calculate running balances for each service group
    for service_type, group in service_groups.items():
        running_balance = 0
        for transaction in sorted(group['transactions'], key=lambda x: x['date']):
            transaction['balance'] = running_balance + transaction['value'] - transaction['paid']
            running_balance = transaction['balance']
        
        # Calculate totals
        group['total_value'] = sum(t['value'] for t in group['transactions'])
        group['total_paid'] = sum(t['paid'] for t in group['transactions'])
        group['total_balance'] = running_balance
    
    # Prepare final statement data
    statement_data = {
        'customer': {
            'name': customer_doc.name,
            'customer_name': customer_doc.customer_name,
            'tax_id': getattr(customer_doc, 'tax_id', ''),
            'customer_group': customer_doc.customer_group,
            'territory': customer_doc.territory
        },
        'date_range': {
            'from_date': from_date,
            'to_date': to_date,
            'from_date_formatted': formatdate(from_date),
            'to_date_formatted': formatdate(to_date)
        },
        'service_groups': list(service_groups.values()),
        'summary': {
            'total_projects': len(project_contractors),
            'total_invoices': len(sales_invoices),
            'total_claims': len(project_claims),
            'total_journal_entries': len(journal_entries),
            'grand_total_value': sum(group['total_value'] for group in service_groups.values()),
            'grand_total_paid': sum(group['total_paid'] for group in service_groups.values()),
            'grand_total_balance': sum(group['total_balance'] for group in service_groups.values())
        }
    }
    
    return statement_data

def get_service_type_from_item(item):
    """Determine service type from item details"""
    item_name = (item.get('item_name') or '').lower()
    item_group = (item.get('item_group') or '').lower()
    
    if 'design' in item_name or 'تصميم' in item_name:
        if 'modify' in item_name or 'تعديل' in item_name:
            return 'Modify Design'
        return 'Design'
    elif 'supervision' in item_name or 'اشراف' in item_name:
        if 'additional' in item_name or 'اضافي' in item_name:
            return 'Additional Supervision'
        return 'Supervision'
    else:
        return 'Other Services'

def get_arabic_service_name(service_type):
    """Get Arabic name for service type"""
    arabic_names = {
        'Design': 'التصميم',
        'Supervision': 'الاشراف', 
        'Modify Design': 'تعديل التصميم',
        'Additional Supervision': 'الاشراف الاضافي',
        'Other Services': 'خدمات أخرى'
    }
    return arabic_names.get(service_type, service_type)

@frappe.whitelist()
def get_customers_list():
    """Get list of customers for selection"""
    return frappe.db.sql("""
        SELECT name, customer_name, customer_group
        FROM `tabCustomer`
        WHERE disabled = 0
        ORDER BY customer_name
    """, as_dict=True)

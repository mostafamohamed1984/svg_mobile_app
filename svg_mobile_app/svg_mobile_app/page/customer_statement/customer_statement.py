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

    # Get project claims with tax information
    claims = frappe.db.sql("""
        SELECT
            pc.name, pc.date, pc.customer, pc.claim_amount,
            pc.paid_amount, pc.outstanding_amount, pc.status,
            pc.reference_invoice, pc.for_project, pc.project_name,
            pc.being, pc.mode_of_payment, pc.reference_number,
            pc.tax_ratio, pc.tax_amount
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

    # Get claim items for each claim with tax information
    for claim in claims:
        claim['items'] = frappe.db.sql("""
            SELECT
                ci.item, ci.amount, ci.invoice_reference,
                ci.tax_rate, ci.tax_amount,
                i.item_name, i.item_group
            FROM `tabClaim Items` ci
            LEFT JOIN `tabItem` i ON ci.item = i.name
            WHERE ci.parent = %(claim)s
            ORDER BY ci.idx
        """, {'claim': claim['name']}, as_dict=True)

        # Get actual paid amounts from journal entries for this claim
        claim['actual_paid_amount'] = get_actual_paid_amount_from_journal_entries(claim['name'])

    return claims

def get_actual_paid_amount_from_journal_entries(claim_name):
    """Get actual paid amount from journal entries for a specific project claim"""
    if not claim_name:
        return 0

    # Query journal entries that reference this project claim
    journal_entries = frappe.db.sql("""
        SELECT DISTINCT
            je.name, je.total_credit
        FROM `tabJournal Entry` je
        WHERE je.user_remark LIKE %(claim_pattern)s
        AND je.docstatus = 1
    """, {
        'claim_pattern': f'%Project Claim {claim_name}%'
    }, as_dict=True)

    total_paid = 0

    # For each journal entry, get the credit amount to customer accounts
    for je in journal_entries:
        customer_credits = frappe.db.sql("""
            SELECT SUM(jea.credit_in_account_currency) as total_credit
            FROM `tabJournal Entry Account` jea
            WHERE jea.parent = %(je_name)s
            AND jea.party_type = 'Customer'
            AND jea.credit_in_account_currency > 0
        """, {'je_name': je['name']}, as_dict=True)

        if customer_credits and customer_credits[0]['total_credit']:
            total_paid += flt(customer_credits[0]['total_credit'])

    return total_paid

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

    # Group data by individual items (not categories) and collect tax separately
    service_groups = {}
    tax_transactions = []  # Collect tax amounts for separate VAT section

    # Process project claims and their items
    for claim in project_claims:
        claim_actual_paid = flt(claim.get('actual_paid_amount', 0))
        claim_total_amount = flt(claim['claim_amount'])  # This includes tax

        # Calculate total base amount and total tax amount for this claim
        claim_base_total = 0
        claim_tax_total = 0

        for item in claim.get('items', []):
            claim_base_total += flt(item['amount'])  # Base amount
            claim_tax_total += flt(item.get('tax_amount', 0))  # Tax amount

        # Process each item for base amounts (excluding tax)
        for item in claim.get('items', []):
            # Use item name as the service key (each item gets its own section)
            item_name = item.get('item_name') or item.get('item', 'Unknown Item')
            service_key = f"{item_name}_{item.get('item', '')}"  # Ensure uniqueness

            if service_key not in service_groups:
                service_groups[service_key] = {
                    'service_name': item_name,
                    'service_name_ar': item_name,  # Will be the same for now
                    'transactions': [],
                    'total_value': 0,
                    'total_paid': 0,
                    'total_balance': 0
                }

            # Calculate proportional paid amount for this item (base amount only)
            item_base_amount = flt(item['amount'])  # Base amount excluding tax
            total_claim_base_and_tax = claim_base_total + claim_tax_total

            if total_claim_base_and_tax > 0 and claim_actual_paid > 0:
                # Distribute paid amount proportionally based on base amount
                item_paid = claim_actual_paid * (item_base_amount / total_claim_base_and_tax)
            else:
                item_paid = 0

            # Add transaction to service group (base amount only)
            transaction = {
                'date': claim['date'],
                'document_number': claim['name'],
                'description': claim.get('being', '') or item_name,  # Use 'being' field as description
                'value': item_base_amount,  # Base amount only
                'paid': item_paid,
                'balance': 0,  # Will be calculated later
                'invoice_reference': item['invoice_reference'],
                'claim_status': claim['status']
            }

            service_groups[service_key]['transactions'].append(transaction)

            # Collect tax amount for separate VAT section
            item_tax_amount = flt(item.get('tax_amount', 0))
            if item_tax_amount > 0:
                # Calculate proportional tax paid amount
                if total_claim_base_and_tax > 0 and claim_actual_paid > 0:
                    tax_paid = claim_actual_paid * (item_tax_amount / total_claim_base_and_tax)
                else:
                    tax_paid = 0

                tax_transactions.append({
                    'date': claim['date'],
                    'document_number': claim['name'],
                    'description': claim.get('being', '') or item_name,
                    'value': item_tax_amount,
                    'paid': tax_paid,
                    'balance': 0,  # Will be calculated later
                    'invoice_reference': item['invoice_reference'],
                    'claim_status': claim['status'],
                    'tax_rate': flt(item.get('tax_rate', 0)) or flt(claim.get('tax_ratio', 0))
                })

    # Create VAT section if there are tax transactions
    if tax_transactions:
        # Get the tax rate from the first transaction (assuming all have same rate)
        tax_rate = tax_transactions[0].get('tax_rate', 5) if tax_transactions else 5

        vat_service_key = f"vat_{tax_rate}"
        service_groups[vat_service_key] = {
            'service_name': f'ضريبة القيمة المضافة',
            'service_name_ar': f'ضريبة القيمة المضافة',
            'tax_rate': tax_rate,
            'is_tax_section': True,
            'transactions': tax_transactions,
            'total_value': 0,
            'total_paid': 0,
            'total_balance': 0
        }

    # Calculate running balances for each service group
    for service_key, group in service_groups.items():
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

# Removed old service type functions - now grouping by individual items

@frappe.whitelist()
def get_customers_list():
    """Get list of customers for selection"""
    return frappe.db.sql("""
        SELECT name, customer_name, customer_group
        FROM `tabCustomer`
        WHERE disabled = 0
        ORDER BY customer_name
    """, as_dict=True)

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
    Start from Project Claims (which always have dates) and work backwards/forwards
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

    # Start from project claims (which always have dates) instead of project contractors
    project_claims = get_customer_project_claims(customer, from_date, to_date)

    # Get project contractors referenced by these claims
    project_contractors = get_project_contractors_from_claims(project_claims)

    # Get sales invoices referenced by these claims
    sales_invoices = get_sales_invoices_from_claims(project_claims, from_date, to_date)

    # Get journal entries from these claims
    journal_entries = get_claim_journal_entries(project_claims, from_date, to_date)

    # Process and group data by service types
    statement_data = process_statement_data(
        customer_doc, project_contractors, sales_invoices,
        project_claims, journal_entries, from_date, to_date
    )

    return statement_data

def get_customer_project_claims(customer, from_date, to_date):
    """Get all project claims for the customer within date range - including draft and submitted"""
    claims = frappe.db.sql("""
        SELECT
            pc.name, pc.date, pc.customer, pc.claim_amount,
            pc.paid_amount, pc.outstanding_amount, pc.status,
            pc.reference_invoice, pc.for_project, pc.project_name,
            pc.being, pc.mode_of_payment, pc.reference_number,
            pc.tax_ratio, pc.tax_amount, pc.docstatus
        FROM `tabProject Claim` pc
        WHERE pc.customer = %(customer)s
        AND pc.date BETWEEN %(from_date)s AND %(to_date)s
        AND pc.docstatus IN (0, 1)
        ORDER BY pc.date DESC, pc.docstatus DESC
    """, {
        'customer': customer,
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

        # Handle paid amounts based on docstatus
        if claim['docstatus'] == 0:  # Draft claim
            # Draft claims have no journal entries, so paid amount is 0
            claim['actual_paid_amount'] = 0
            claim['status'] = 'Draft'  # Override status for clarity
        else:  # Submitted claim
            # Get actual paid amounts from journal entries for submitted claims
            claim['actual_paid_amount'] = get_actual_paid_amount_from_journal_entries(claim['name'])

        # Get the current outstanding amount from the referenced sales invoice
        if claim.get('reference_invoice'):
            invoice_outstanding = frappe.db.get_value('Sales Invoice', claim['reference_invoice'], 'outstanding_amount')
            claim['invoice_outstanding_amount'] = invoice_outstanding or 0
        else:
            # For draft claims without reference invoice, balance is the claim amount
            claim['invoice_outstanding_amount'] = claim['claim_amount']

    return claims

def get_project_contractors_from_claims(project_claims):
    """Get project contractors referenced by the claims (both draft and submitted)"""
    if not project_claims:
        return []

    project_names = list(set([claim['for_project'] for claim in project_claims if claim.get('for_project')]))

    if not project_names:
        return []

    return frappe.db.sql("""
        SELECT
            name, project_name, date, customer_name,
            total_project_amount, company, docstatus
        FROM `tabProject Contractors`
        WHERE name IN %(projects)s
        AND docstatus IN (0, 1)
        ORDER BY COALESCE(date, '1900-01-01') DESC
    """, {
        'projects': project_names
    }, as_dict=True)

def get_sales_invoices_from_claims(project_claims, from_date, to_date):
    """Get sales invoices referenced by the claims (both draft and submitted claims)"""
    if not project_claims:
        return []

    # Get unique invoice names from claims (draft claims might not have reference_invoice)
    invoice_names = list(set([claim['reference_invoice'] for claim in project_claims if claim.get('reference_invoice')]))

    if not invoice_names:
        return []

    return frappe.db.sql("""
        SELECT
            si.name, si.posting_date, si.customer, si.grand_total,
            si.outstanding_amount, si.status, si.custom_for_project,
            pc.project_name, si.due_date, si.docstatus
        FROM `tabSales Invoice` si
        LEFT JOIN `tabProject Contractors` pc ON si.custom_for_project = pc.name
        WHERE si.name IN %(invoices)s
        AND si.docstatus IN (0, 1)
        ORDER BY si.posting_date DESC
    """, {
        'invoices': invoice_names
    }, as_dict=True)



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
    statement_currency = None  # Track the currency used in this statement

    # Process project claims and their items
    for claim in project_claims:
        claim_actual_paid = flt(claim.get('actual_paid_amount', 0))
        claim_total_amount = flt(claim['claim_amount'])  # This includes tax

        # Set statement currency from the first claim (assuming all claims use same currency)
        if not statement_currency and claim.get('currency'):
            statement_currency = claim['currency']

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

            # Calculate balance as proportional share of invoice outstanding amount
            invoice_outstanding = claim.get('invoice_outstanding_amount', 0)
            if total_claim_base_and_tax > 0 and invoice_outstanding > 0:
                # Distribute outstanding amount proportionally based on base amount
                item_balance = invoice_outstanding * (item_base_amount / total_claim_base_and_tax)
            else:
                # Fallback to simple calculation if no invoice outstanding data
                item_balance = item_base_amount - item_paid

            # Add transaction to service group (base amount only)
            transaction = {
                'date': claim['date'],
                'document_number': claim['name'],
                'description': claim.get('being', '') or item_name,  # Use 'being' field as description
                'value': item_base_amount,  # Base amount only
                'paid': item_paid,
                'balance': item_balance,  # Use invoice outstanding amount
                'invoice_reference': item['invoice_reference'],
                'claim_status': claim['status'],
                'invoice_outstanding': invoice_outstanding
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

                # Calculate tax balance as proportional share of invoice outstanding amount
                if total_claim_base_and_tax > 0 and invoice_outstanding > 0:
                    tax_balance = invoice_outstanding * (item_tax_amount / total_claim_base_and_tax)
                else:
                    tax_balance = item_tax_amount - tax_paid

                tax_transactions.append({
                    'date': claim['date'],
                    'document_number': claim['name'],
                    'description': claim.get('being', '') or item_name,
                    'value': item_tax_amount,
                    'paid': tax_paid,
                    'balance': tax_balance,  # Use proportional invoice outstanding amount
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

    # Calculate totals for each service group (balance is already calculated from invoice outstanding)
    for service_key, group in service_groups.items():
        # Sort transactions by date for display
        group['transactions'] = sorted(group['transactions'], key=lambda x: x['date'])

        # Calculate totals
        group['total_value'] = sum(t['value'] for t in group['transactions'])
        group['total_paid'] = sum(t['paid'] for t in group['transactions'])
        group['total_balance'] = sum(t['balance'] for t in group['transactions'])

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
        'currency': statement_currency or "AED",  # Fallback to AED if no currency found
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

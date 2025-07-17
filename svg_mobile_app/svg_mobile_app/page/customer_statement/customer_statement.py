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

    # Get ALL sales invoices for the customer (not just those referenced by claims)
    sales_invoices = get_all_customer_sales_invoices(customer, from_date, to_date)

    # Get project claims for the customer
    project_claims = get_customer_project_claims(customer, from_date, to_date)

    # Get project contractors referenced by these claims
    project_contractors = get_project_contractors_from_claims(project_claims)

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

        # No need to get available balances - we'll calculate from original invoice amounts

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

def get_all_customer_sales_invoices(customer, from_date, to_date):
    """Get ALL sales invoices for the customer within date range"""
    return frappe.db.sql("""
        SELECT
            si.name, si.posting_date, si.customer, si.grand_total,
            si.outstanding_amount, si.status, si.custom_for_project,
            pc.project_name, si.due_date, si.docstatus
        FROM `tabSales Invoice` si
        LEFT JOIN `tabProject Contractors` pc ON si.custom_for_project = pc.name
        WHERE si.customer = %(customer)s
        AND si.docstatus IN (0, 1)
        AND si.posting_date BETWEEN %(from_date)s AND %(to_date)s
        ORDER BY si.posting_date DESC
    """, {
        'customer': customer,
        'from_date': from_date,
        'to_date': to_date
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
    """Process and organize data for customer statement display - starting from ALL sales invoices"""

    # Group data by individual items (not categories) and collect tax separately
    service_groups = {}
    tax_transactions = []  # Collect tax amounts for separate VAT section
    statement_currency = None  # Track the currency used in this statement

    # Create a mapping of sales invoice -> project claims for quick lookup
    invoice_to_claims = {}
    for claim in project_claims:
        if claim.get('reference_invoice'):
            if claim['reference_invoice'] not in invoice_to_claims:
                invoice_to_claims[claim['reference_invoice']] = []
            invoice_to_claims[claim['reference_invoice']].append(claim)

    # Process ALL sales invoices (whether they have claims or not)
    for invoice in sales_invoices:
        # Set statement currency from the first invoice (assuming all invoices use same currency)
        if not statement_currency:
            invoice_currency = frappe.db.get_value('Sales Invoice', invoice['name'], 'currency')
            if invoice_currency:
                statement_currency = invoice_currency
        # Get all items from this sales invoice
        invoice_items = frappe.db.sql("""
            SELECT
                item_code, item_name, amount, qty, rate,
                COALESCE(tax_amount, 0) as tax_amount
            FROM `tabSales Invoice Item`
            WHERE parent = %(invoice)s
            ORDER BY idx
        """, {'invoice': invoice['name']}, as_dict=True)

        # Get Project Contractors details for this invoice (for description)
        project_contractor_details = ""
        if invoice.get('custom_for_project'):
            project_contractor_details = frappe.db.get_value(
                'Project Contractors',
                invoice['custom_for_project'],
                'details'
            ) or ""

        # Get claims for this invoice (if any)
        related_claims = invoice_to_claims.get(invoice['name'], [])

        # Process each item in the sales invoice
        for invoice_item in invoice_items:
            # Use item name as the service key (each item gets its own section)
            item_name = invoice_item.get('item_name') or invoice_item.get('item_code', 'Unknown Item')
            service_key = f"{item_name}_{invoice_item.get('item_code', '')}"  # Ensure uniqueness

            if service_key not in service_groups:
                service_groups[service_key] = {
                    'service_name': item_name,
                    'service_name_ar': item_name,  # Will be the same for now
                    'transactions': [],
                    'total_value': 0,
                    'total_paid': 0,
                    'total_balance': 0
                }

            # Calculate total paid amount for this item across all related claims
            total_paid_for_item = 0
            claim_transactions = []  # Store individual claim transactions

            # If there are related claims, create separate transactions for each claim
            for claim in related_claims:
                claim_actual_paid = flt(claim.get('actual_paid_amount', 0))

                # Find this item in the claim
                for claim_item in claim.get('items', []):
                    if claim_item.get('item') == invoice_item['item_code']:
                        # Calculate proportional paid amount for this item in this specific claim
                        claim_base_total = sum(flt(ci['amount']) for ci in claim.get('items', []))
                        claim_tax_total = sum(flt(ci.get('tax_amount', 0)) for ci in claim.get('items', []))
                        total_claim_amount = claim_base_total + claim_tax_total

                        if total_claim_amount > 0 and claim_actual_paid > 0:
                            item_base_amount = flt(claim_item['amount'])
                            item_paid_in_claim = claim_actual_paid * (item_base_amount / total_claim_amount)
                            total_paid_for_item += item_paid_in_claim

                            # Create Project Claim transaction (shows paid amount)
                            claim_transaction = {
                                'date': claim['date'],
                                'document_number': claim['name'],
                                'description': claim.get('being', '') or item_name,
                                'value': 0,  # Project claim shows 0 value (it's a payment)
                                'paid': item_paid_in_claim,  # Amount paid in this claim
                                'balance': 0,  # Will be calculated after all transactions
                                'invoice_reference': invoice['name'],
                                'claim_status': claim['status'],
                                'transaction_type': 'project_claim'
                            }
                            claim_transactions.append(claim_transaction)

            # Calculate balance: Original Invoice Amount - Total Paid
            original_amount = flt(invoice_item['amount'])  # Original amount from sales invoice
            item_balance = original_amount - total_paid_for_item

            # Create Sales Invoice transaction (shows original value)
            sales_invoice_transaction = {
                'date': invoice['posting_date'],
                'document_number': invoice['name'],
                'description': project_contractor_details,  # Use Project Contractors details field
                'value': original_amount,  # Original invoice amount
                'paid': 0,  # Sales invoice doesn't show paid amount
                'balance': item_balance,  # Remaining balance
                'invoice_reference': invoice['name'],
                'claim_status': 'Sales Invoice',
                'transaction_type': 'sales_invoice'
            }

            # Add Sales Invoice transaction first
            service_groups[service_key]['transactions'].append(sales_invoice_transaction)

            # Add Project Claim transactions (if any)
            service_groups[service_key]['transactions'].extend(claim_transactions)

            # If no claims exist, the Sales Invoice transaction will show the full balance

            # Collect tax amount for separate VAT section
            item_tax_amount = flt(invoice_item.get('tax_amount', 0))
            if item_tax_amount > 0:
                # Calculate total tax paid for this item across all related claims
                total_tax_paid_for_item = 0
                tax_claim_transactions = []

                for claim in related_claims:
                    claim_actual_paid = flt(claim.get('actual_paid_amount', 0))

                    # Find this item in the claim
                    for claim_item in claim.get('items', []):
                        if claim_item.get('item') == invoice_item['item_code']:
                            # Calculate proportional tax paid amount for this item in this specific claim
                            claim_base_total = sum(flt(ci['amount']) for ci in claim.get('items', []))
                            claim_tax_total = sum(flt(ci.get('tax_amount', 0)) for ci in claim.get('items', []))
                            total_claim_amount = claim_base_total + claim_tax_total

                            if total_claim_amount > 0 and claim_actual_paid > 0:
                                item_tax_paid_in_claim = claim_actual_paid * (item_tax_amount / total_claim_amount)
                                total_tax_paid_for_item += item_tax_paid_in_claim

                                # Create tax Project Claim transaction
                                tax_claim_transactions.append({
                                    'date': claim['date'],
                                    'document_number': claim['name'],
                                    'description': claim.get('being', '') or item_name,
                                    'value': 0,  # Project claim shows 0 value (it's a payment)
                                    'paid': item_tax_paid_in_claim,
                                    'balance': 0,  # Will be calculated after
                                    'invoice_reference': invoice['name'],
                                    'claim_status': claim['status'],
                                    'tax_rate': 5,  # Default tax rate
                                    'transaction_type': 'project_claim'
                                })

                # Calculate tax balance: Original Tax Amount - Total Tax Paid
                tax_balance = item_tax_amount - total_tax_paid_for_item

                # Create Sales Invoice tax transaction
                tax_transactions.append({
                    'date': invoice['posting_date'],
                    'document_number': invoice['name'],
                    'description': project_contractor_details,  # Use Project Contractors details field
                    'value': item_tax_amount,  # Original tax amount
                    'paid': 0,  # Sales invoice doesn't show paid amount
                    'balance': tax_balance,  # Remaining tax balance
                    'invoice_reference': invoice['name'],
                    'claim_status': 'Sales Invoice',
                    'tax_rate': 5,  # Default tax rate
                    'transaction_type': 'sales_invoice'
                })

                # Add Project Claim tax transactions
                tax_transactions.extend(tax_claim_transactions)

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
        # Sort transactions: Sales Invoice first, then Project Claims by date
        # This ensures Sales Invoice row appears before its related Project Claim rows
        def sort_key(transaction):
            # First sort by transaction type (sales_invoice first, then project_claim)
            type_order = 0 if transaction.get('transaction_type') == 'sales_invoice' else 1
            # Then sort by date within each type
            date_value = transaction.get('date') or ''
            return (type_order, date_value)

        group['transactions'] = sorted(group['transactions'], key=sort_key)

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

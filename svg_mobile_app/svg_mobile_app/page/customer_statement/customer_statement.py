# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt, cstr, getdate, fmt_money, formatdate
from frappe import _
import json

@frappe.whitelist()
def get_customer_statement_data(customer=None, project_contractors=None, filter_logic=None, from_date=None, to_date=None):
    """
    Get comprehensive customer statement data showing the complete business flow:
    Start from Project Claims (which always have dates) and work backwards/forwards
    Supports dynamic filtering by customer and/or project contractors
    """
    # Automatically determine filter logic if not provided
    if not filter_logic:
        if customer and project_contractors:
            # Both provided: use AND logic (show data that matches both)
            filter_logic = 'and'
        elif customer or project_contractors:
            # Only one provided: use OR logic (show data for the provided filter)
            filter_logic = 'or'
        else:
            # Neither provided: require at least one
            frappe.throw(_("Either Customer or Project Contractors is required"))

    # Validate filter parameters
    if filter_logic == 'and' and not customer:
        frappe.throw(_("Customer is required when both filters are used"))
    elif filter_logic == 'or' and not customer and not project_contractors:
        frappe.throw(_("Either Customer or Project Contractors is required"))

    # Get customer details (if customer is provided)
    customer_doc = None
    if customer:
        customer_doc = frappe.get_doc("Customer", customer)

    # Set default date range if not provided
    if not from_date:
        from_date = frappe.utils.add_months(frappe.utils.today(), -12)
    if not to_date:
        to_date = frappe.utils.today()

    # Get ALL sales invoices based on filter logic
    sales_invoices = get_filtered_sales_invoices(customer, project_contractors, filter_logic, from_date, to_date)

    # Get project claims based on filter logic
    project_claims = get_filtered_project_claims(customer, project_contractors, filter_logic, from_date, to_date)

    # Get project contractors referenced by these claims
    project_contractors_data = get_project_contractors_from_claims(project_claims)

    # Get expense claims based on filter logic
    expense_claims = get_filtered_expense_claims(customer, project_contractors, filter_logic, from_date, to_date)

    # Get journal entries from these claims
    journal_entries = get_claim_journal_entries(project_claims, from_date, to_date)

    # Process and group data by service types
    statement_data = process_statement_data(
        customer_doc, customer, project_contractors_data, sales_invoices,
        project_claims, expense_claims, journal_entries, from_date, to_date
    )

    return statement_data

def get_filtered_project_claims(customer, project_contractors, filter_logic, from_date, to_date):
    """Get project claims based on customer and/or project contractors filter"""
    conditions = []
    params = {
        'from_date': from_date,
        'to_date': to_date
    }

    if filter_logic == 'and':
        # Both customer AND project must match
        if customer:
            conditions.append("pc.customer = %(customer)s")
            params['customer'] = customer
        if project_contractors:
            conditions.append("pc.for_project = %(project_contractors)s")
            params['project_contractors'] = project_contractors
    else:  # OR logic
        # Either customer OR project can match
        or_conditions = []
        if customer:
            or_conditions.append("pc.customer = %(customer)s")
            params['customer'] = customer
        if project_contractors:
            or_conditions.append("pc.for_project = %(project_contractors)s")
            params['project_contractors'] = project_contractors

        if or_conditions:
            conditions.append(f"({' OR '.join(or_conditions)})")

    conditions_str = ' AND '.join(conditions) if conditions else '1=1'

    claims = frappe.db.sql(f"""
        SELECT
            pc.name, pc.date, pc.customer, pc.claim_amount,
            pc.paid_amount, pc.outstanding_amount, pc.status,
            pc.reference_invoice, pc.for_project, pc.project_name,
            pc.being, pc.mode_of_payment, pc.reference_number,
            pc.tax_ratio, pc.tax_amount, pc.docstatus
        FROM `tabProject Claim` pc
        WHERE {conditions_str}
        AND pc.date BETWEEN %(from_date)s AND %(to_date)s
        AND pc.docstatus IN (0, 1)
        ORDER BY pc.date DESC, pc.docstatus DESC
    """, params, as_dict=True)

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

def get_filtered_expense_claims(customer, project_contractors, filter_logic, from_date, to_date):
    """Get expense claims based on customer and/or project contractors filter"""
    conditions = []
    params = {
        'from_date': from_date,
        'to_date': to_date
    }

    if filter_logic == 'and':
        # Both customer AND project must match
        if customer:
            conditions.append("pc.customer = %(customer)s")
            params['customer'] = customer
        if project_contractors:
            conditions.append("ec.custom_project_contractors_reference = %(project_contractors)s")
            params['project_contractors'] = project_contractors
    else:  # OR logic
        # Either customer OR project can match
        or_conditions = []
        if customer:
            or_conditions.append("pc.customer = %(customer)s")
            params['customer'] = customer
        if project_contractors:
            or_conditions.append("ec.custom_project_contractors_reference = %(project_contractors)s")
            params['project_contractors'] = project_contractors

        if or_conditions:
            conditions.append(f"({' OR '.join(or_conditions)})")

    conditions_str = ' AND '.join(conditions) if conditions else '1=1'

    expense_claims = frappe.db.sql(f"""
        SELECT DISTINCT
            ec.name, ec.posting_date, ec.employee, ec.employee_name,
            ec.total_claimed_amount, ec.total_sanctioned_amount, ec.total_amount_reimbursed,
            ec.status, ec.docstatus, ec.custom_project_contractors_reference,
            pc.customer, pc.project_name, pc.customer_name
        FROM `tabExpense Claim` ec
        LEFT JOIN `tabProject Contractors` pc ON ec.custom_project_contractors_reference = pc.name
        WHERE {conditions_str}
        AND ec.posting_date BETWEEN %(from_date)s AND %(to_date)s
        AND ec.docstatus IN (0, 1)
        ORDER BY ec.posting_date DESC
    """, params, as_dict=True)

    # Get expense claim details for each claim
    for claim in expense_claims:
        claim['expenses'] = frappe.db.sql("""
            SELECT
                ecd.expense_date, ecd.expense_type, ecd.description,
                ecd.amount, ecd.sanctioned_amount, ecd.for_project
            FROM `tabExpense Claim Detail` ecd
            WHERE ecd.parent = %(claim)s
            AND ecd.for_project IS NOT NULL
            ORDER BY ecd.expense_date DESC
        """, {'claim': claim['name']}, as_dict=True)

    return expense_claims

def get_filtered_sales_invoices(customer, project_contractors, filter_logic, from_date, to_date):
    """Get sales invoices based on customer and/or project contractors filter"""
    conditions = []
    params = {
        'from_date': from_date,
        'to_date': to_date
    }

    if filter_logic == 'and':
        # Both customer AND project must match
        if customer:
            conditions.append("si.customer = %(customer)s")
            params['customer'] = customer
        if project_contractors:
            conditions.append("si.custom_for_project = %(project_contractors)s")
            params['project_contractors'] = project_contractors
    else:  # OR logic
        # Either customer OR project can match
        or_conditions = []
        if customer:
            or_conditions.append("si.customer = %(customer)s")
            params['customer'] = customer
        if project_contractors:
            or_conditions.append("si.custom_for_project = %(project_contractors)s")
            params['project_contractors'] = project_contractors

        if or_conditions:
            conditions.append(f"({' OR '.join(or_conditions)})")

    conditions_str = ' AND '.join(conditions) if conditions else '1=1'

    return frappe.db.sql(f"""
        SELECT
            si.name, si.posting_date, si.customer, si.grand_total,
            si.outstanding_amount, si.status, si.custom_for_project,
            pc.project_name, si.due_date, si.docstatus
        FROM `tabSales Invoice` si
        LEFT JOIN `tabProject Contractors` pc ON si.custom_for_project = pc.name
        WHERE {conditions_str}
        AND si.docstatus IN (0, 1)
        AND si.posting_date BETWEEN %(from_date)s AND %(to_date)s
        ORDER BY si.posting_date DESC
    """, params, as_dict=True)

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

def process_statement_data(customer_doc, customer, project_contractors, sales_invoices,
                         project_claims, expense_claims, journal_entries, from_date, to_date):
    """Process and organize data for customer statement display - starting from ALL sales invoices and expense claims"""

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
                            # Use actual claim item tax amount instead of proportional calculation
                            claim_item_tax_amount = flt(claim_item.get('tax_amount', 0))

                            # Calculate proportional tax paid amount based on claim item's actual tax amount
                            claim_base_total = sum(flt(ci['amount']) for ci in claim.get('items', []))
                            claim_tax_total = sum(flt(ci.get('tax_amount', 0)) for ci in claim.get('items', []))
                            total_claim_amount = claim_base_total + claim_tax_total

                            if total_claim_amount > 0 and claim_actual_paid > 0 and claim_item_tax_amount > 0:
                                # Calculate tax paid based on claim item's tax amount, not invoice tax amount
                                item_tax_paid_in_claim = claim_actual_paid * (claim_item_tax_amount / total_claim_amount)
                                total_tax_paid_for_item += item_tax_paid_in_claim

                                # Get tax rate from claim item (fallback to 5%)
                                tax_rate = flt(claim_item.get('tax_rate', 5))

                                # Create tax Project Claim transaction
                                tax_claim_transactions.append({
                                    'date': claim['date'],
                                    'document_number': claim['name'],
                                    'description': claim.get('being', '') or item_name,
                                    'value': 0,  # Project claim shows 0 value (it's a payment)
                                    'paid': item_tax_paid_in_claim,
                                    'balance': 0,  # Will be calculated after
                                    'invoice_reference': invoice['name'],
                                    'claim_reference': claim['name'],  # Add claim reference for clarity
                                    'claim_status': claim['status'],
                                    'tax_rate': tax_rate,  # Use actual tax rate from claim item
                                    'transaction_type': 'project_claim',
                                    'item_code': invoice_item['item_code'],  # Add item reference
                                    'claim_item_tax_amount': claim_item_tax_amount  # Add for debugging
                                })

                # Calculate tax balance: Original Tax Amount - Total Tax Paid
                tax_balance = item_tax_amount - total_tax_paid_for_item

                # Get tax rate from invoice item or use default
                invoice_tax_rate = 5  # Default, could be enhanced to get from Sales Invoice Item

                # Create Sales Invoice tax transaction
                tax_transactions.append({
                    'date': invoice['posting_date'],
                    'document_number': invoice['name'],
                    'description': project_contractor_details,  # Use Project Contractors details field
                    'value': item_tax_amount,  # Original tax amount
                    'paid': 0,  # Sales invoice doesn't show paid amount
                    'balance': tax_balance,  # Remaining tax balance
                    'invoice_reference': invoice['name'],
                    'claim_reference': '',  # No claim reference for invoice transactions
                    'claim_status': 'Sales Invoice',
                    'tax_rate': invoice_tax_rate,  # Use invoice tax rate
                    'transaction_type': 'sales_invoice',
                    'item_code': invoice_item['item_code'],  # Add item reference
                    'invoice_item_tax_amount': item_tax_amount  # Add for debugging
                })

                # Add Project Claim tax transactions
                tax_transactions.extend(tax_claim_transactions)

    # Process Expense Claims
    for expense_claim in expense_claims:
        # Process each expense in the claim
        for expense in expense_claim.get('expenses', []):
            # Use expense type as the service key
            expense_type = expense.get('expense_type', 'Other Expenses')
            service_key = f"expense_{expense_type}_{expense_claim['name']}"

            if service_key not in service_groups:
                service_groups[service_key] = {
                    'service_name': f"Expense: {expense_type}",
                    'service_name_ar': f"مصروف: {expense_type}",
                    'transactions': [],
                    'total_value': 0,
                    'total_paid': 0,
                    'total_balance': 0,
                    'is_expense_section': True
                }

            # Calculate amounts
            expense_amount = flt(expense.get('amount', 0))
            sanctioned_amount = flt(expense.get('sanctioned_amount', 0)) or expense_amount
            reimbursed_amount = flt(expense_claim.get('total_amount_reimbursed', 0))

            # Calculate proportional reimbursed amount for this expense
            total_claim_amount = flt(expense_claim.get('total_sanctioned_amount', 0)) or flt(expense_claim.get('total_claimed_amount', 0))
            if total_claim_amount > 0 and reimbursed_amount > 0:
                proportional_reimbursed = reimbursed_amount * (sanctioned_amount / total_claim_amount)
            else:
                proportional_reimbursed = 0

            # Calculate balance
            expense_balance = sanctioned_amount - proportional_reimbursed

            # Create Expense Claim transaction
            expense_transaction = {
                'date': expense['expense_date'],
                'document_number': expense_claim['name'],
                'description': expense.get('description', expense_type),
                'value': sanctioned_amount,  # Amount that should be billed to customer
                'paid': proportional_reimbursed,  # Amount reimbursed to employee
                'balance': expense_balance,  # Outstanding amount
                'expense_claim_reference': expense_claim['name'],
                'project_reference': expense.get('for_project', ''),
                'claim_status': expense_claim.get('status', 'Draft'),
                'transaction_type': 'expense_claim',
                'employee': expense_claim.get('employee_name', ''),
                'expense_type': expense_type
            }

            service_groups[service_key]['transactions'].append(expense_transaction)

    # Create VAT section if there are tax transactions
    if tax_transactions:
        # Group tax transactions by tax rate (in case there are different rates)
        tax_groups = {}
        for tax_transaction in tax_transactions:
            tax_rate = tax_transaction.get('tax_rate', 5)
            if tax_rate not in tax_groups:
                tax_groups[tax_rate] = []
            tax_groups[tax_rate].append(tax_transaction)

        # Create separate VAT sections for each tax rate
        for tax_rate, rate_transactions in tax_groups.items():
            vat_service_key = f"vat_{tax_rate}"
            service_groups[vat_service_key] = {
                'service_name': f'ضريبة القيمة المضافة {tax_rate}%',
                'service_name_ar': f'ضريبة القيمة المضافة {tax_rate}%',
                'tax_rate': tax_rate,
                'is_tax_section': True,
                'transactions': rate_transactions,
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
            # For VAT sections, also sort by item_code to group related transactions
            item_code = transaction.get('item_code', '')
            return (type_order, item_code, date_value)

        group['transactions'] = sorted(group['transactions'], key=sort_key)

        # Calculate totals
        group['total_value'] = sum(t['value'] for t in group['transactions'])
        group['total_paid'] = sum(t['paid'] for t in group['transactions'])
        group['total_balance'] = sum(t['balance'] for t in group['transactions'])

        # For VAT sections, add debugging info in development
        if group.get('is_tax_section'):
            group['debug_info'] = {
                'transaction_count': len(group['transactions']),
                'invoice_transactions': len([t for t in group['transactions'] if t.get('transaction_type') == 'sales_invoice']),
                'claim_transactions': len([t for t in group['transactions'] if t.get('transaction_type') == 'project_claim'])
            }

    # Get current user's default company information
    current_company = frappe.defaults.get_user_default("Company")
    company_info = {
        'name': current_company or 'Smart Vision Group',
        'company_name': current_company or 'Smart Vision Group',
        'company_name_ar': 'الرؤية الذكية للاستشارات الهندسية'  # Default Arabic name
    }

    # Get company details if available
    if current_company:
        company_doc = frappe.get_doc("Company", current_company)
        company_info.update({
            'name': company_doc.name,
            'company_name': company_doc.company_name,
            'company_name_ar': getattr(company_doc, 'company_name_ar', company_doc.company_name),
            'tax_id': getattr(company_doc, 'tax_id', ''),
            'address': getattr(company_doc, 'address', ''),
            'phone': getattr(company_doc, 'phone_no', ''),
            'email': getattr(company_doc, 'email', '')
        })

    # Prepare customer information
    customer_info = {}
    if customer_doc:
        customer_info = {
            'name': customer_doc.name,
            'customer_name': customer_doc.customer_name,
            'tax_id': getattr(customer_doc, 'tax_id', ''),
            'customer_group': customer_doc.customer_group,
            'territory': customer_doc.territory
        }
    elif customer:
        # If customer is provided but doc not found, use basic info
        customer_info = {
            'name': customer,
            'customer_name': customer,
            'tax_id': '',
            'customer_group': '',
            'territory': ''
        }
    else:
        # No customer filter, use project-based info
        customer_info = {
            'name': 'Multiple/Project-Based',
            'customer_name': 'Multiple Customers or Project-Based Filter',
            'tax_id': '',
            'customer_group': '',
            'territory': ''
        }

    # Prepare final statement data
    statement_data = {
        'customer': customer_info,
        'company': company_info,
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
            'total_expense_claims': len(expense_claims),
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

@frappe.whitelist()
def get_project_contractors_list():
    """Get list of project contractors for selection"""
    return frappe.db.sql("""
        SELECT name, project_name, customer_name, date
        FROM `tabProject Contractors`
        WHERE docstatus IN (0, 1)
        ORDER BY project_name, date DESC
    """, as_dict=True)

@frappe.whitelist()
def get_current_company_info():
    """Get current user's default company information"""
    current_company = frappe.defaults.get_user_default("Company")

    if not current_company:
        return {
            'name': 'Smart Vision Group',
            'company_name': 'Smart Vision Group',
            'company_name_ar': 'الرؤية الذكية للاستشارات الهندسية'
        }

    try:
        company_doc = frappe.get_doc("Company", current_company)
        return {
            'name': company_doc.name,
            'company_name': company_doc.company_name,
            'company_name_ar': getattr(company_doc, 'company_name_ar', company_doc.company_name),
            'tax_id': getattr(company_doc, 'tax_id', ''),
            'address': getattr(company_doc, 'address', ''),
            'phone': getattr(company_doc, 'phone_no', ''),
            'email': getattr(company_doc, 'email', '')
        }
    except Exception:
        # Fallback if company doesn't exist
        return {
            'name': current_company,
            'company_name': current_company,
            'company_name_ar': current_company
        }

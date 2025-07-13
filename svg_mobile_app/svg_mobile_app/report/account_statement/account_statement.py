# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt, cstr, getdate, fmt_money
from frappe import _

def execute(filters=None):
    """
    Account Statement Report
    Standard accounting ledger showing all transactions for specific accounts
    """
    if not filters:
        filters = {}
    
    columns = get_columns()
    data = get_data(filters)
    
    return columns, data

def get_columns():
    """Define report columns for account statement"""
    return [
        {
            "fieldname": "posting_date",
            "label": _("Posting Date"),
            "fieldtype": "Date",
            "width": 100
        },
        {
            "fieldname": "value_date",
            "label": _("Value Date"),
            "fieldtype": "Date",
            "width": 100
        },
        {
            "fieldname": "description",
            "label": _("Description"),
            "fieldtype": "Data",
            "width": 300
        },
        {
            "fieldname": "ref_cheque_no",
            "label": _("Ref/Cheque No"),
            "fieldtype": "Data",
            "width": 120
        },
        {
            "fieldname": "debit_amount",
            "label": _("Debit Amount"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "credit_amount",
            "label": _("Credit Amount"),
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "fieldname": "balance",
            "label": _("Balance"),
            "fieldtype": "Currency",
            "width": 120
        }
    ]

def get_data(filters):
    """Get account statement data"""
    if not filters.get("account"):
        return [{
            'posting_date': '',
            'value_date': '',
            'description': 'Please select an account to view statement',
            'ref_cheque_no': '',
            'debit_amount': 0,
            'credit_amount': 0,
            'balance': 0
        }]
    
    conditions = get_conditions(filters)
    
    # Get opening balance
    opening_balance = get_opening_balance(filters)
    
    # Main query for GL entries
    query = """
        SELECT 
            gle.posting_date,
            gle.posting_date as value_date,
            COALESCE(gle.remarks, gle.against, 'GL Entry') as description,
            COALESCE(gle.against_voucher, gle.voucher_no) as ref_cheque_no,
            CASE WHEN gle.debit > 0 THEN gle.debit ELSE 0 END as debit_amount,
            CASE WHEN gle.credit > 0 THEN gle.credit ELSE 0 END as credit_amount,
            gle.voucher_type,
            gle.voucher_no,
            gle.against,
            gle.party_type,
            gle.party,
            gle.cost_center,
            gle.project,
            gle.debit,
            gle.credit
        FROM 
            `tabGL Entry` gle
        WHERE 
            gle.account = %(account)s
            AND gle.is_cancelled = 0
            {conditions}
        ORDER BY 
            gle.posting_date, gle.creation
    """.format(conditions=conditions)
    
    gl_entries = frappe.db.sql(query, filters, as_dict=True)
    
    # Process data with running balance
    processed_data = process_gl_entries(gl_entries, opening_balance, filters)
    
    return processed_data

def get_conditions(filters):
    """Build WHERE conditions based on filters"""
    conditions = []
    
    if filters.get("from_date"):
        conditions.append("AND gle.posting_date >= %(from_date)s")
    
    if filters.get("to_date"):
        conditions.append("AND gle.posting_date <= %(to_date)s")
    
    if filters.get("voucher_type"):
        conditions.append("AND gle.voucher_type = %(voucher_type)s")
    
    if filters.get("party"):
        conditions.append("AND gle.party = %(party)s")
    
    if filters.get("cost_center"):
        conditions.append("AND gle.cost_center = %(cost_center)s")
    
    if filters.get("project"):
        conditions.append("AND gle.project = %(project)s")
    
    return " ".join(conditions)

def get_opening_balance(filters):
    """Calculate opening balance for the account"""
    if not filters.get("from_date"):
        return 0.0
    
    opening_balance_query = """
        SELECT 
            SUM(gle.debit - gle.credit) as opening_balance
        FROM 
            `tabGL Entry` gle
        WHERE 
            gle.account = %(account)s
            AND gle.posting_date < %(from_date)s
            AND gle.is_cancelled = 0
    """
    
    result = frappe.db.sql(opening_balance_query, filters, as_dict=True)
    return flt(result[0].opening_balance) if result and result[0].opening_balance else 0.0

def process_gl_entries(gl_entries, opening_balance, filters):
    """Process GL entries with running balance calculation"""
    processed_data = []
    running_balance = flt(opening_balance)
    
    # Add opening balance row if there's a from_date and opening balance
    if filters.get("from_date") and opening_balance != 0:
        processed_data.append({
            'posting_date': filters.get("from_date"),
            'value_date': filters.get("from_date"),
            'description': 'Opening Balance',
            'ref_cheque_no': '',
            'debit_amount': opening_balance if opening_balance > 0 else 0,
            'credit_amount': abs(opening_balance) if opening_balance < 0 else 0,
            'balance': opening_balance,
            '_is_opening_balance': True
        })
    
    # Process each GL entry
    for entry in gl_entries:
        debit = flt(entry.debit_amount)
        credit = flt(entry.credit_amount)
        
        # Update running balance
        running_balance += (debit - credit)
        
        # Enhanced description with more context
        description = get_enhanced_description(entry)
        
        # Enhanced reference number
        ref_cheque_no = get_enhanced_reference(entry)
        
        processed_data.append({
            'posting_date': entry.posting_date,
            'value_date': entry.value_date,
            'description': description,
            'ref_cheque_no': ref_cheque_no,
            'debit_amount': debit,
            'credit_amount': credit,
            'balance': running_balance,
            'voucher_type': entry.voucher_type,
            'voucher_no': entry.voucher_no,
            'party': entry.party,
            'against': entry.against
        })
    
    # Add closing balance row
    if processed_data:
        processed_data.append({
            'posting_date': filters.get("to_date") or frappe.utils.today(),
            'value_date': filters.get("to_date") or frappe.utils.today(),
            'description': 'Closing Balance',
            'ref_cheque_no': '',
            'debit_amount': running_balance if running_balance > 0 else 0,
            'credit_amount': abs(running_balance) if running_balance < 0 else 0,
            'balance': running_balance,
            '_is_closing_balance': True
        })
    
    return processed_data

def get_enhanced_description(entry):
    """Create enhanced description with context"""
    description_parts = []
    
    # Add voucher type and number
    if entry.voucher_type and entry.voucher_no:
        description_parts.append(f"{entry.voucher_type}-{entry.voucher_no}")
    
    # Add party information
    if entry.party:
        party_type = entry.party_type or "Party"
        description_parts.append(f"{party_type}: {entry.party}")
    
    # Add against account/party
    if entry.against:
        description_parts.append(f"Against: {entry.against}")
    
    # Add original remarks if available
    if entry.description and entry.description not in ['GL Entry', entry.voucher_no]:
        description_parts.append(entry.description)
    
    return " | ".join(description_parts) if description_parts else "GL Entry"

def get_enhanced_reference(entry):
    """Create enhanced reference number"""
    ref_parts = []
    
    # Primary reference
    if entry.ref_cheque_no and entry.ref_cheque_no != entry.voucher_no:
        ref_parts.append(entry.ref_cheque_no)
    
    # Voucher number as fallback
    if entry.voucher_no:
        ref_parts.append(entry.voucher_no)
    
    return " / ".join(ref_parts) if ref_parts else ""

def get_report_summary(data, filters):
    """Generate report summary"""
    if not data:
        return []
    
    # Calculate totals
    total_debit = sum(flt(row.get('debit_amount', 0)) for row in data if not row.get('_is_opening_balance') and not row.get('_is_closing_balance'))
    total_credit = sum(flt(row.get('credit_amount', 0)) for row in data if not row.get('_is_opening_balance') and not row.get('_is_closing_balance'))
    
    # Get closing balance
    closing_balance = 0
    for row in reversed(data):
        if row.get('_is_closing_balance'):
            closing_balance = flt(row.get('balance', 0))
            break
        elif not row.get('_is_opening_balance'):
            closing_balance = flt(row.get('balance', 0))
            break
    
    # Get account name for display
    account_name = filters.get("account", "")
    
    return [
        {
            "value": account_name,
            "label": _("Account"),
            "datatype": "Data"
        },
        {
            "value": total_debit,
            "label": _("Total Debit"),
            "datatype": "Currency"
        },
        {
            "value": total_credit,
            "label": _("Total Credit"),
            "datatype": "Currency"
        },
        {
            "value": closing_balance,
            "label": _("Closing Balance"),
            "datatype": "Currency"
        }
    ]

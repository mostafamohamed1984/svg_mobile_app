# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt, cstr
from frappe import _

def execute(filters=None):
    """
    Trial Balance Report (Arabic)
    Shows Chart of Accounts with debit/credit balances and Arabic interface
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
            "fieldname": "account_code",
            "label": _("الحساب"),  # Account
            "fieldtype": "Data",
            "width": 100
        },
        {
            "fieldname": "account_name",
            "label": _("اسم الحساب"),  # Account Name
            "fieldtype": "Data",
            "width": 250
        },
        {
            "fieldname": "debit",
            "label": _("مدين"),  # Debit
            "fieldtype": "Currency",
            "width": 150
        },
        {
            "fieldname": "credit",
            "label": _("دائن"),  # Credit
            "fieldtype": "Currency",
            "width": 150
        },
        {
            "fieldname": "balance",
            "label": _("الرصيد"),  # Balance
            "fieldtype": "Currency",
            "width": 150
        }
    ]

def get_data(filters):
    """Get trial balance data"""
    conditions = get_conditions(filters)
    
    # Main query to get account balances
    query = """
        SELECT 
            acc.account_number as account_code,
            acc.name as account_name,
            acc.account_name as account_name_ar,
            acc.account_type,
            acc.root_type,
            acc.is_group,
            acc.lft,
            acc.rgt,
            COALESCE(SUM(gle.debit), 0) as total_debit,
            COALESCE(SUM(gle.credit), 0) as total_credit,
            COALESCE(SUM(gle.debit - gle.credit), 0) as balance
        FROM 
            `tabAccount` acc
        LEFT JOIN 
            `tabGL Entry` gle ON acc.name = gle.account 
            AND gle.is_cancelled = 0
            {gl_conditions}
        WHERE 
            acc.disabled = 0
            {account_conditions}
        GROUP BY 
            acc.name, acc.account_number, acc.account_name, acc.account_type, 
            acc.root_type, acc.is_group, acc.lft, acc.rgt
        HAVING 
            (COALESCE(SUM(gle.debit), 0) != 0 OR COALESCE(SUM(gle.credit), 0) != 0)
            OR acc.is_group = 1
        ORDER BY 
            acc.lft
    """.format(
        gl_conditions=get_gl_conditions(filters),
        account_conditions=get_account_conditions(filters)
    )
    
    raw_data = frappe.db.sql(query, filters, as_dict=True)
    
    # Process data for hierarchical display
    processed_data = process_trial_balance_data(raw_data, filters)
    
    return processed_data

def get_conditions(filters):
    """Build WHERE conditions based on filters"""
    conditions = []
    
    if filters.get("company"):
        conditions.append("AND acc.company = %(company)s")
    
    return " ".join(conditions)

def get_gl_conditions(filters):
    """Build GL Entry specific conditions"""
    conditions = []
    
    if filters.get("from_date"):
        conditions.append("AND gle.posting_date >= %(from_date)s")
    
    if filters.get("to_date"):
        conditions.append("AND gle.posting_date <= %(to_date)s")
    
    if filters.get("company"):
        conditions.append("AND gle.company = %(company)s")
    
    return " ".join(conditions)

def get_account_conditions(filters):
    """Build Account specific conditions"""
    conditions = []
    
    if filters.get("company"):
        conditions.append("AND acc.company = %(company)s")
    
    if filters.get("account_type"):
        conditions.append("AND acc.account_type = %(account_type)s")
    
    if filters.get("root_type"):
        conditions.append("AND acc.root_type = %(root_type)s")
    
    # Show only leaf accounts by default, unless show_group_accounts is enabled
    if not filters.get("show_group_accounts"):
        conditions.append("AND acc.is_group = 0")
    
    return " ".join(conditions)

def process_trial_balance_data(raw_data, filters):
    """Process raw data for trial balance display"""
    processed_data = []
    
    # Group accounts by type for better organization
    account_groups = {
        'Assets': {'accounts': [], 'total_debit': 0, 'total_credit': 0},
        'Liabilities': {'accounts': [], 'total_debit': 0, 'total_credit': 0},
        'Equity': {'accounts': [], 'total_debit': 0, 'total_credit': 0},
        'Income': {'accounts': [], 'total_debit': 0, 'total_credit': 0},
        'Expense': {'accounts': [], 'total_debit': 0, 'total_credit': 0}
    }
    
    # Arabic translations for account types
    type_translations = {
        'Assets': 'الأصول',
        'Liabilities': 'الخصوم',
        'Equity': 'حقوق الملكية',
        'Income': 'الإيرادات',
        'Expense': 'المصروفات'
    }
    
    # Categorize accounts
    for account in raw_data:
        root_type = account.get('root_type', 'Other')
        
        # Map ERPNext root types to our categories
        if root_type in ['Asset']:
            category = 'Assets'
        elif root_type in ['Liability']:
            category = 'Liabilities'
        elif root_type in ['Equity']:
            category = 'Equity'
        elif root_type in ['Income']:
            category = 'Income'
        elif root_type in ['Expense']:
            category = 'Expense'
        else:
            category = 'Assets'  # Default fallback
        
        # Process account data
        total_debit = flt(account.get('total_debit', 0))
        total_credit = flt(account.get('total_credit', 0))
        balance = flt(account.get('balance', 0))
        
        # Determine display amounts based on account type
        if root_type in ['Asset', 'Expense']:
            # Assets and Expenses: show debit balance as positive
            display_debit = balance if balance > 0 else 0
            display_credit = abs(balance) if balance < 0 else 0
        else:
            # Liabilities, Equity, Income: show credit balance as positive
            display_debit = abs(balance) if balance < 0 else 0
            display_credit = balance if balance > 0 else 0
        
        account_row = {
            'account_code': account.get('account_code', ''),
            'account_name': get_arabic_account_name(account),
            'debit': display_debit,
            'credit': display_credit,
            'balance': balance,
            'account_type': account.get('account_type', ''),
            'root_type': root_type,
            'is_group': account.get('is_group', 0)
        }
        
        account_groups[category]['accounts'].append(account_row)
        account_groups[category]['total_debit'] += display_debit
        account_groups[category]['total_credit'] += display_credit
    
    # Build final data structure
    grand_total_debit = 0
    grand_total_credit = 0
    
    for category, group_data in account_groups.items():
        if group_data['accounts']:  # Only show categories that have accounts
            # Add category header
            processed_data.append({
                'account_code': '',
                'account_name': f"=== {type_translations.get(category, category)} ===",
                'debit': '',
                'credit': '',
                'balance': '',
                '_is_category_header': True
            })
            
            # Add accounts in this category
            for account in group_data['accounts']:
                processed_data.append(account)
            
            # Add category subtotal
            processed_data.append({
                'account_code': '',
                'account_name': f"إجمالي {type_translations.get(category, category)}",
                'debit': group_data['total_debit'],
                'credit': group_data['total_credit'],
                'balance': group_data['total_debit'] - group_data['total_credit'],
                '_is_category_total': True
            })
            
            # Add separator
            processed_data.append({
                'account_code': '',
                'account_name': '',
                'debit': '',
                'credit': '',
                'balance': '',
                '_is_separator': True
            })
            
            grand_total_debit += group_data['total_debit']
            grand_total_credit += group_data['total_credit']
    
    # Add grand total
    processed_data.append({
        'account_code': '',
        'account_name': 'الإجمالي العام',  # Grand Total
        'debit': grand_total_debit,
        'credit': grand_total_credit,
        'balance': grand_total_debit - grand_total_credit,
        '_is_grand_total': True
    })
    
    return processed_data

def get_arabic_account_name(account):
    """Get Arabic account name with fallback to English"""
    # Try to get Arabic name first, fallback to English name
    arabic_name = account.get('account_name_ar', '')
    english_name = account.get('account_name', '')
    account_code = account.get('account_code', '')
    
    # Build display name
    if arabic_name and arabic_name != english_name:
        display_name = arabic_name
    else:
        display_name = english_name
    
    # Add account code if available
    if account_code:
        display_name = f"{account_code} - {display_name}"
    
    return display_name

def get_report_summary(data, filters):
    """Generate report summary"""
    if not data:
        return []
    
    # Find grand total row
    grand_total_debit = 0
    grand_total_credit = 0
    
    for row in data:
        if row.get('_is_grand_total'):
            grand_total_debit = flt(row.get('debit', 0))
            grand_total_credit = flt(row.get('credit', 0))
            break
    
    return [
        {
            "value": grand_total_debit,
            "label": _("إجمالي المدين"),  # Total Debit
            "datatype": "Currency"
        },
        {
            "value": grand_total_credit,
            "label": _("إجمالي الدائن"),  # Total Credit
            "datatype": "Currency"
        },
        {
            "value": abs(grand_total_debit - grand_total_credit),
            "label": _("الفرق"),  # Difference
            "datatype": "Currency"
        }
    ]

# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt, cstr
from frappe import _
import json
import re

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
            "label": _("رقم الحساب"),  # Account Code
            "fieldtype": "Data",
            "width": 150
        },
        {
            "fieldname": "account",
            "label": _("Account"),
            "fieldtype": "Data",
            "width": 300
        },
        {
            "fieldname": "parent_account",
            "label": _("Parent Account"),
            "fieldtype": "Data",
            "hidden": 1,
            "width": 1
        },
        {
            "fieldname": "account_name",
            "label": _("اسم الحساب"),  # Account Name
            "fieldtype": "Data",
            "width": 300
        },
        {
            "fieldname": "debit",
            "label": _("مدين"),  # Debit
            "fieldtype": "Float",
            "precision": 2,
            "width": 150
        },
        {
            "fieldname": "credit",
            "label": _("دائن"),  # Credit
            "fieldtype": "Float",
            "precision": 2,
            "width": 150
        },
        {
            "fieldname": "balance",
            "label": _("الرصيد"),  # Balance
            "fieldtype": "Float",
            "precision": 2,
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
            acc.name as account,
            acc.parent_account as parent_account,
            acc.account_name as account_title,
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
            acc.name, acc.parent_account, acc.account_number, acc.account_name, acc.account_type, 
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
    
    # Process data for hierarchical or categorized display
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

    # Root type filtering handled in post-processing to avoid SQL IN binding issues from MultiSelectList

    # Show only leaf accounts by default, unless show_group_accounts or group_as_tree is enabled
    if not _is_truthy(filters.get("show_group_accounts")) and not _is_truthy(filters.get("group_as_tree")):
        conditions.append("AND acc.is_group = 0")
    
    return " ".join(conditions)

def process_trial_balance_data(raw_data, filters):
    """Process raw data for trial balance display
    - When group_as_tree is enabled, return a hierarchical tree using indent/parent_account
    - Otherwise, group by category and sort by account number within each category
    """
    # apply root type filter (works in both modes)
    root_types = set(_parse_multi_select(filters.get("root_types") or filters.get("root_type")))
    if root_types:
        raw_data = [r for r in raw_data if (r.get('root_type') in root_types)]

    group_as_tree = filters.get("group_as_tree")
    if group_as_tree is None:
        group_as_tree = True
    if _is_truthy(group_as_tree):
        return _process_tree_data(raw_data)
    else:
        return _process_categorized_data(raw_data)

def _process_tree_data(raw_data):
    """Build a hierarchical tree and sort siblings by account_code (natural order)."""
    processed_data = []

    # Build node map
    by_name = {row.get('account'): dict(row) for row in raw_data}
    children_map = {}
    roots = []

    for name, node in by_name.items():
        parent = node.get('parent_account')
        if parent and parent in by_name:
            children_map.setdefault(parent, []).append(node)
        else:
            roots.append(node)

    def sort_nodes(nodes):
        return sorted(nodes, key=_account_tree_sort_key)

    def walk(node, depth):
        root_type = node.get('root_type', 'Other')
        total_debit = flt(node.get('total_debit', 0))
        total_credit = flt(node.get('total_credit', 0))
        balance = flt(node.get('balance', 0))

        if root_type in ['Asset', 'Expense']:
            display_debit = balance if balance > 0 else 0
            display_credit = abs(balance) if balance < 0 else 0
        else:
            display_debit = abs(balance) if balance < 0 else 0
            display_credit = balance if balance > 0 else 0

        processed_data.append({
            'account': node.get('account'),
            'parent_account': node.get('parent_account'),
            'account_code': node.get('account_code', ''),
            'account_name': get_arabic_account_name(node),
            'debit': display_debit,
            'credit': display_credit,
            'balance': balance,
            'account_type': node.get('account_type', ''),
            'root_type': root_type,
            'is_group': node.get('is_group', 0),
            'indent': depth
        })

        for child in sort_nodes(children_map.get(node.get('account'), [])):
            walk(child, depth + 1)

    for root in sort_nodes(roots):
        walk(root, 0)

    summary = _compute_summary(processed_data)
    processed_data.append({
        'account_code': '',
        'account_name': 'الإجمالي العام',
        'debit': summary['total_debit'],
        'credit': summary['total_credit'],
        'balance': summary['total_debit'] - summary['total_credit'],
        '_is_grand_total': True
    })

    return processed_data

def _process_categorized_data(raw_data):
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

    for account in raw_data:
        root_type = account.get('root_type', 'Other')

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
            category = 'Assets'

        total_debit = flt(account.get('total_debit', 0))
        total_credit = flt(account.get('total_credit', 0))
        balance = flt(account.get('balance', 0))

        if root_type in ['Asset', 'Expense']:
            display_debit = balance if balance > 0 else 0
            display_credit = abs(balance) if balance < 0 else 0
        else:
            display_debit = abs(balance) if balance < 0 else 0
            display_credit = balance if balance > 0 else 0

        account_row = {
            'account': account.get('account'),
            'parent_account': account.get('parent_account'),
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

    # Sort accounts within each category by natural account code order
    for group in account_groups.values():
        group['accounts'].sort(key=_account_tree_sort_key)

    grand_total_debit = 0
    grand_total_credit = 0

    for category, group_data in account_groups.items():
        if group_data['accounts']:
            processed_data.append({
                'account_code': '',
                'account_name': f"=== {type_translations.get(category, category)} ===",
                'debit': '',
                'credit': '',
                'balance': '',
                '_is_category_header': True
            })

            for account in group_data['accounts']:
                processed_data.append(account)

            processed_data.append({
                'account_code': '',
                'account_name': f"إجمالي {type_translations.get(category, category)}",
                'debit': group_data['total_debit'],
                'credit': group_data['total_credit'],
                'balance': group_data['total_debit'] - group_data['total_credit'],
                '_is_category_total': True
            })

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

    processed_data.append({
        'account_code': '',
        'account_name': 'الإجمالي العام',
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
    english_name = account.get('account_title', '')
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
    totals = _compute_summary(data)
    
    return [
        {
            "value": totals['total_debit'],
            "label": _("إجمالي المدين"),  # Total Debit
            "datatype": "Float"
        },
        {
            "value": totals['total_credit'],
            "label": _("إجمالي الدائن"),  # Total Credit
            "datatype": "Float"
        },
        {
            "value": abs(totals['total_debit'] - totals['total_credit']),
            "label": _("الفرق"),  # Difference
            "datatype": "Float"
        }
    ]

def _compute_summary(data):
    total_debit = 0
    total_credit = 0
    for row in data:
        if row.get('_is_separator'):
            continue
        if row.get('_is_category_header'):
            continue
        if row.get('_is_category_total'):
            continue
        if row.get('_is_grand_total'):
            continue
        if row.get('is_group'):
            continue
        total_debit += flt(row.get('debit') or 0)
        total_credit += flt(row.get('credit') or 0)
    return {"total_debit": total_debit, "total_credit": total_credit}

def _parse_multi_select(value):
    """Parse MultiSelectList filter value to list of strings.
    Accepts list/tuple, JSON array string, comma/newline separated string, or single value.
    """
    if not value:
        return []
    if isinstance(value, (list, tuple, set)):
        return [cstr(v) for v in value if cstr(v)]
    s = cstr(value)
    if not s:
        return []
    try:
        obj = json.loads(s)
        if isinstance(obj, list):
            return [cstr(x) for x in obj if cstr(x)]
    except Exception:
        pass
    parts = re.split(r"[,;\n]+", s)
    return [p.strip() for p in parts if p and p.strip()]

def _natural_sort_key(code):
    """Return a natural sort key for account codes like '1-02-003' or '1001'."""
    s = cstr(code)
    if not s:
        return ((), "")
    parts = re.split(r"(\d+)", s)
    nums = []
    tail = []
    for part in parts:
        if part.isdigit():
            nums.append(int(part))
        else:
            tail.append(part.lower())
    # Return a tuple with numeric parts first then string tail joined
    return (tuple(nums), "".join(tail))

def _account_tree_sort_key(row):
    """Sort by root_type group order, then by natural account_code, then by account name."""
    root_order = {"Asset": 0, "Liability": 1, "Equity": 2, "Income": 3, "Expense": 4}
    root_idx = root_order.get(cstr(row.get('root_type')), 99)
    code_key = _natural_sort_key(row.get('account_code') or '')
    name_key = cstr(row.get('account_name') or '')
    return (root_idx, code_key, name_key)

def _is_truthy(value):
    return cstr(value).lower() in {"1", "true", "yes", "on"}

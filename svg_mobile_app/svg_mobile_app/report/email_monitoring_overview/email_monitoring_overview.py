import frappe


def execute(filters=None):
    filters = filters or {}
    columns = [
        {"label": "Communication", "fieldname": "communication", "fieldtype": "Link", "options": "Communication", "width": 200},
        {"label": "Type", "fieldname": "email_type", "fieldtype": "Data", "width": 90},
        {"label": "Status", "fieldname": "status", "fieldtype": "Data", "width": 130},
        {"label": "Priority", "fieldname": "priority", "fieldtype": "Data", "width": 90},
        {"label": "Assigned User", "fieldname": "assigned_user", "fieldtype": "Link", "options": "User", "width": 180},
        {"label": "Email Account", "fieldname": "email_account", "fieldtype": "Link", "options": "Email Account", "width": 220},
        {"label": "Modified", "fieldname": "modified", "fieldtype": "Datetime", "width": 180}
    ]

    conditions = {}
    if filters.get('status'):
        conditions['status'] = filters['status']
    if filters.get('email_type'):
        conditions['email_type'] = filters['email_type']
    if filters.get('email_account'):
        conditions['email_account'] = filters['email_account']

    data = frappe.get_list(
        'Email Monitoring',
        fields=['communication', 'email_type', 'status', 'priority', 'assigned_user', 'email_account', 'modified'],
        filters=conditions,
        order_by='modified desc',
        limit_page_length=1000
    )
    return columns, data



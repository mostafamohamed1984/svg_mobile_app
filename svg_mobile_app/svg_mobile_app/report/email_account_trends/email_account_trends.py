import frappe


def execute(filters=None):
    filters = filters or {}
    acct = filters.get('email_account')
    conditions = ""
    params = []
    if acct:
        conditions += " AND email_account=%s"
        params.append(acct)

    # daily counts by status for last 30 days
    rows = frappe.db.sql(
        f"""
        SELECT DATE(creation) d, status, COUNT(*) c
        FROM `tabEmail Monitoring`
        WHERE creation >= (NOW() - INTERVAL 30 DAY) {conditions}
        GROUP BY DATE(creation), status
        ORDER BY DATE(creation) DESC
        """,
        tuple(params),
        as_dict=True,
    )
    # columns pivot into separate fields could be handled in UI; return raw rows
    columns = [
        {"label": "Date", "fieldname": "d", "fieldtype": "Date", "width": 120},
        {"label": "Status", "fieldname": "status", "fieldtype": "Data", "width": 140},
        {"label": "Count", "fieldname": "c", "fieldtype": "Int", "width": 80},
    ]
    data = rows
    return columns, data



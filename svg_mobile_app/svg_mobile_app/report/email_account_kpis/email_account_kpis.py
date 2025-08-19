import frappe
from frappe.utils import nowdate


def execute(filters=None):
    filters = filters or {}
    email_account = filters.get('email_account')

    columns = [
        {"label": "Email Account", "fieldname": "email_account", "fieldtype": "Link", "options": "Email Account", "width": 200},
        {"label": "Open", "fieldname": "open_count", "fieldtype": "Int", "width": 80},
        {"label": "Need Reply", "fieldname": "need_reply_count", "fieldtype": "Int", "width": 100},
        {"label": "Replied", "fieldname": "replied_count", "fieldtype": "Int", "width": 90},
        {"label": "Follow Up", "fieldname": "follow_up_count", "fieldtype": "Int", "width": 90},
        {"label": "Avg Response (hrs)", "fieldname": "avg_response_hours", "fieldtype": "Float", "width": 140}
    ]

    accounts = [email_account] if email_account else [a.name for a in frappe.get_all('Email Account', fields=['name'])]
    data = []

    for acct in accounts:
        row = {"email_account": acct}
        for st, key in [("Open", "open_count"), ("Need Reply", "need_reply_count"), ("Replied", "replied_count"), ("Follow Up", "follow_up_count")]:
            row[key] = frappe.db.count('Email Monitoring', {"email_account": acct, "status": st})

        # simplistic avg response time: difference between first Open and Replied on same account (placeholder)
        avg_resp = frappe.db.sql("""
            SELECT AVG(TIMESTAMPDIFF(HOUR, em1.creation, em2.modified))
            FROM `tabEmail Monitoring` em1
            JOIN `tabEmail Monitoring` em2 ON em1.communication = em2.communication
            WHERE em1.email_account=%s AND em1.status='Open' AND em2.status='Replied'
        """, (acct,))[0][0] or 0
        row["avg_response_hours"] = float(avg_resp)
        data.append(row)

    return columns, data



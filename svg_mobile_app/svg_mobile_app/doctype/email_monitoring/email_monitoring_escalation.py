import frappe
from frappe.utils import add_days, now_datetime


def _get_overdue_monitoring(status: str, days_overdue: int):
    cutoff = add_days(now_datetime(), -days_overdue)
    return frappe.get_all(
        'Email Monitoring',
        filters={
            'status': status,
            'modified': ['<', cutoff]
        },
        fields=['name', 'communication', 'assigned_user', 'email_account', 'modified']
    )


def _notify_assigned(name: str, assigned_user: str, status: str):
    if not assigned_user:
        return
    user_email = frappe.db.get_value('User', assigned_user, 'email')
    if not user_email:
        return
    try:
        frappe.sendmail(
            recipients=[user_email],
            subject=f"Email Monitoring Escalation: {status}",
            message=f"Email Monitoring record {name} remains in status '{status}'. Please review and take action."
        )
    except Exception:
        frappe.log_error(f"Failed sending escalation email to {assigned_user}", "Email Monitoring Escalation")


def run_escalations():
    """Daily escalation checks for Email Monitoring records"""
    try:
        # Need Reply older than 2 days
        for row in _get_overdue_monitoring('Need Reply', 2):
            _notify_assigned(row['name'], row.get('assigned_user'), 'Need Reply')

        # Follow Up older than 7 days
        for row in _get_overdue_monitoring('Follow Up', 7):
            _notify_assigned(row['name'], row.get('assigned_user'), 'Follow Up')
    except Exception as e:
        frappe.log_error(f"Escalation error: {str(e)}", "Email Monitoring Escalation")


@frappe.whitelist()
def test_run_escalations():
    run_escalations()
    return {"status": "ok"}



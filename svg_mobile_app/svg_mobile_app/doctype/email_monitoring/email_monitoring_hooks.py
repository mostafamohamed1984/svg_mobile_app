import frappe

def create_email_monitoring_record(doc, method=None):
    """Create Email Monitoring record after Communication insert"""
    try:
        # Avoid duplicates
        existing = frappe.get_all(
            "Email Monitoring",
            filters={"communication": doc.name},
            limit=1
        )
        if existing:
            return

        email_type = "Issued" if getattr(doc, 'sent_or_received', '') == 'Sent' else "Incoming"

        mon = frappe.get_doc({
            'doctype': 'Email Monitoring',
            'communication': doc.name,
            'email_type': email_type,
            'status': 'Open',
            'priority': 'Medium',
            'assigned_user': None,
            'department': None,
            'email_account': getattr(doc, 'email_account', None),
            'notes': None
        })
        mon.insert(ignore_permissions=True)
    except Exception as e:
        frappe.log_error(f"Email Monitoring create error for {getattr(doc, 'name', 'unknown')}: {str(e)}", "Email Monitoring")


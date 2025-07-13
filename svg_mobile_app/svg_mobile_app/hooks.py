# Scheduled Tasks
scheduler_events = {
    "hourly": [
        "svg_mobile_app.svg_mobile_app.doctype.remote_access.remote_access.check_expired_access"
    ],
    "daily": [
        "svg_mobile_app.svg_mobile_app.doctype.remote_access.remote_access.send_expiration_reminders"
    ]
}

# Ignore links to specified DocTypes when deleting documents
# This prevents "Cannot delete because X is linked with Y" errors
ignore_links_on_delete = ["Project Claim", "Project Contractors", "Sales Invoice", "Employee Advance", "Project Advances"]
# Scheduled Tasks
scheduler_events = {
    "hourly": [
        "svg_mobile_app.svg_mobile_app.doctype.remote_access.remote_access.check_expired_access"
    ],
    "daily": [
        "svg_mobile_app.svg_mobile_app.doctype.remote_access.remote_access.send_expiration_reminders"
    ]
} 
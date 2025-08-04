# JavaScript Assets
app_include_js = [
    "svg_mobile_app/public/js/navbar_checkin.js"
]

# CSS Assets
app_include_css = [
    "svg_mobile_app/public/css/navbar_checkin.css"
]

# Extend Bootinfo for navbar functionality
extend_bootinfo = "svg_mobile_app.svg_mobile_app.navbar.get_attendance_info"

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
// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.query_reports["Detailed Project Claim"] = {
    "filters": [
        {
            "fieldname": "customer",
            "label": __("Customer"),
            "fieldtype": "Link",
            "options": "Customer"
        },
        {
            "fieldname": "project",
            "label": __("Project"),
            "fieldtype": "Link",
            "options": "Project Contractors"
        },
        {
            "fieldname": "claim_name",
            "label": __("Specific Claim"),
            "fieldtype": "Link",
            "options": "Project Claim"
        },
        {
            "fieldname": "from_date",
            "label": __("From Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.add_months(frappe.datetime.get_today(), -3)
        },
        {
            "fieldname": "to_date",
            "label": __("To Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today()
        },
        {
            "fieldname": "status",
            "label": __("Status"),
            "fieldtype": "Select",
            "options": "\nUnreconciled\nReconciled"
        }
    ]
};

// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.query_reports["Trial Balance Arabic"] = {
    "filters": [
        {
            "fieldname": "company",
            "label": __("Company"),
            "fieldtype": "Link",
            "options": "Company",
            "default": frappe.defaults.get_user_default("Company")
        },
        {
            "fieldname": "from_date",
            "label": __("From Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.year_start()
        },
        {
            "fieldname": "to_date",
            "label": __("To Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today()
        },
        {
            "fieldname": "root_type",
            "label": __("Root Type"),
            "fieldtype": "Select",
            "options": "\nAsset\nLiability\nEquity\nIncome\nExpense"
        }
    ]
};

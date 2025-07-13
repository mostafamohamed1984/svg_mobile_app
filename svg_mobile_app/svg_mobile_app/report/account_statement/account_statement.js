// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.query_reports["Account Statement"] = {
    "filters": [
        {
            "fieldname": "account",
            "label": __("Account"),
            "fieldtype": "Link",
            "options": "Account"
        },
        {
            "fieldname": "from_date",
            "label": __("From Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.add_months(frappe.datetime.get_today(), -1)
        },
        {
            "fieldname": "to_date",
            "label": __("To Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today()
        },
        {
            "fieldname": "voucher_type",
            "label": __("Voucher Type"),
            "fieldtype": "Select",
            "options": "\nJournal Entry\nSales Invoice\nPurchase Invoice\nPayment Entry"
        },
        {
            "fieldname": "party",
            "label": __("Party"),
            "fieldtype": "Data"
        }
    ]
};

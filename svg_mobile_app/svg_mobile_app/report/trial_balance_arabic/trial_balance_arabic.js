// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.query_reports["Trial Balance Arabic"] = {
    tree: true,
    name_field: "account",
    parent_field: "parent_account",
    initial_depth: 1,
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
            "fieldname": "root_types",
            "label": __("Root Types"),
            "fieldtype": "MultiSelectList",
            "default": [],
            get_data: () => {
                const values = ["Asset", "Liability", "Equity", "Income", "Expense"]; 
                return values.map(v => ({ value: v, description: "" }));
            }
        },
        {
            "fieldname": "group_as_tree",
            "label": __("Group as Tree"),
            "fieldtype": "Check",
            "default": 1
        },
        {
            "fieldname": "show_group_accounts",
            "label": __("Show Group Accounts"),
            "fieldtype": "Check",
            "default": 0
        }
    ]
};

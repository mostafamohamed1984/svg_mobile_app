// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.query_reports["Trial Balance Arabic"] = {
    tree: true,
    name_field: "account",
    parent_field: "parent_account",
    initial_depth: 1,
    formatter: function(value, row, column, data, default_formatter) {
        let formatted = default_formatter(value, row, column, data);
        if (!data) {
            return formatted;
        }

        const is_category_header = !!data._is_category_header;
        const is_category_total = !!data._is_category_total;
        const is_grand_total = !!data._is_grand_total;
        const is_top_group = !!(data.is_group && data.indent === 0);
        const is_group = !!(data.is_group && !is_top_group);

        // Styles
        const strong_bg = "background-color:#eef6ff; font-weight:700;"; // top/root headers
        const group_bg  = "background-color:#f8fafc; font-weight:600;"; // group accounts
        const total_bg  = "background-color:#fffbea; font-weight:700; border-top:1px solid #e2e8f0;";

        if (is_grand_total) {
            return `<span style="${total_bg}">${formatted}</span>`;
        }
        if (is_category_total) {
            return `<span style="${group_bg} border-top:1px solid #e2e8f0;">${formatted}</span>`;
        }
        if (is_category_header || is_top_group) {
            return `<span style="${strong_bg}">${formatted}</span>`;
        }
        if (is_group) {
            return `<span style="${group_bg}">${formatted}</span>`;
        }

        return formatted;
    },
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
        }
    ]
};

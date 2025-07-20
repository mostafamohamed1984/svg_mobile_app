// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.query_reports["Project Expenses Report"] = {
    "filters": [
        {
            "fieldname": "project_contractor",
            "label": __("Project Contractor"),
            "fieldtype": "Link",
            "options": "Project Contractors",
            "width": "200px"
        },
        {
            "fieldname": "employee",
            "label": __("Employee"),
            "fieldtype": "Link",
            "options": "Employee",
            "width": "200px"
        },
        {
            "fieldname": "expense_type",
            "label": __("Expense Type"),
            "fieldtype": "Link",
            "options": "Expense Claim Type",
            "width": "200px"
        },
        {
            "fieldname": "from_date",
            "label": __("From Date (Expense)"),
            "fieldtype": "Date",
            "default": frappe.datetime.add_months(frappe.datetime.get_today(), -1),
            "width": "200px"
        },
        {
            "fieldname": "to_date",
            "label": __("To Date (Expense)"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today(),
            "width": "200px"
        },
        {
            "fieldname": "posting_from_date",
            "label": __("From Date (Posting)"),
            "fieldtype": "Date",
            "width": "200px"
        },
        {
            "fieldname": "posting_to_date",
            "label": __("To Date (Posting)"),
            "fieldtype": "Date",
            "width": "200px"
        }
    ],
    
    "formatter": function(value, row, column, data, default_formatter) {
        value = default_formatter(value, row, column, data);
        
        if (column.fieldname == "amount" && data && data.amount) {
            value = `<div style="text-align: right; font-weight: bold; color: #2e7d32;">${value}</div>`;
        }
        
        if (column.fieldname == "project_contractor" && data && data.project_contractor) {
            value = `<a href="/app/project-contractors/${data.project_contractor}" target="_blank">${value}</a>`;
        }
        
        if (column.fieldname == "expense_claim" && data && data.expense_claim) {
            value = `<a href="/app/expense-claim/${data.expense_claim}" target="_blank">${value}</a>`;
        }
        
        return value;
    }
};

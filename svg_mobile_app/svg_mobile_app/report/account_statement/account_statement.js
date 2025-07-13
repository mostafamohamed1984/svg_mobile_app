// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.query_reports["Account Statement"] = {
    "filters": [
        {
            "fieldname": "account",
            "label": __("Account"),
            "fieldtype": "Link",
            "options": "Account",
            "reqd": 1,
            "get_query": function() {
                return {
                    "filters": {
                        "is_group": 0,
                        "disabled": 0
                    }
                };
            }
        },
        {
            "fieldname": "from_date",
            "label": __("From Date"),
            "fieldtype": "Date",
            "reqd": 1,
            "default": frappe.datetime.add_months(frappe.datetime.get_today(), -1)
        },
        {
            "fieldname": "to_date",
            "label": __("To Date"),
            "fieldtype": "Date",
            "reqd": 1,
            "default": frappe.datetime.get_today()
        },
        {
            "fieldname": "voucher_type",
            "label": __("Voucher Type"),
            "fieldtype": "Select",
            "options": "\nJournal Entry\nSales Invoice\nPurchase Invoice\nPayment Entry\nExpense Claim\nAsset\nStock Entry\nDelivery Note\nPurchase Receipt",
            "reqd": 0
        },
        {
            "fieldname": "party_type",
            "label": __("Party Type"),
            "fieldtype": "Select",
            "options": "\nCustomer\nSupplier\nEmployee",
            "reqd": 0
        },
        {
            "fieldname": "party",
            "label": __("Party"),
            "fieldtype": "Dynamic Link",
            "options": "party_type",
            "reqd": 0
        },
        {
            "fieldname": "cost_center",
            "label": __("Cost Center"),
            "fieldtype": "Link",
            "options": "Cost Center",
            "reqd": 0
        },
        {
            "fieldname": "project",
            "label": __("Project"),
            "fieldtype": "Link",
            "options": "Project",
            "reqd": 0
        }
    ],
    
    "formatter": function(value, row, column, data, default_formatter) {
        // Handle special rows
        if (data._is_opening_balance) {
            if (column.fieldname === "description") {
                return `<div style="font-weight: bold; color: #2c3e50; background-color: #ecf0f1; padding: 5px;">${value || ""}</div>`;
            }
            if (column.fieldtype === "Currency" && value) {
                return `<div style="font-weight: bold; color: #2c3e50; text-align: right; background-color: #ecf0f1; padding: 5px;">${format_currency(value)}</div>`;
            }
            return `<div style="background-color: #ecf0f1; padding: 5px;">${value || ""}</div>`;
        }
        
        if (data._is_closing_balance) {
            if (column.fieldname === "description") {
                return `<div style="font-weight: bold; color: #8e44ad; background-color: #f4ecf7; padding: 5px;">${value || ""}</div>`;
            }
            if (column.fieldtype === "Currency" && value) {
                let color = value >= 0 ? "#27ae60" : "#e74c3c";
                return `<div style="font-weight: bold; color: ${color}; text-align: right; background-color: #f4ecf7; padding: 5px;">${format_currency(value)}</div>`;
            }
            return `<div style="background-color: #f4ecf7; padding: 5px;">${value || ""}</div>`;
        }
        
        // Format currency fields
        if (column.fieldtype === "Currency") {
            if (value && value !== 0) {
                let color = "#2c3e50";
                if (column.fieldname === "balance") {
                    color = value >= 0 ? "#27ae60" : "#e74c3c";
                }
                return `<div style="text-align: right; color: ${color};">${format_currency(value)}</div>`;
            }
            return `<div style="text-align: right; color: #95a5a6;">0.00</div>`;
        }
        
        // Format date fields
        if (column.fieldtype === "Date" && value) {
            return frappe.datetime.str_to_user(value);
        }
        
        // Format description with truncation for long text
        if (column.fieldname === "description" && value && value.length > 50) {
            return `<div title="${value}">${value.substring(0, 47)}...</div>`;
        }
        
        return default_formatter(value, row, column, data);
    },
    
    "onload": function(report) {
        // Add custom CSS for better formatting
        if (!$('#account-statement-css').length) {
            $('<style id="account-statement-css">')
                .text(`
                    .report-wrapper .datatable .dt-row {
                        border-bottom: 1px solid #ecf0f1;
                    }
                    .report-wrapper .datatable .dt-cell {
                        padding: 8px 12px;
                        vertical-align: middle;
                    }
                    .report-wrapper .datatable .dt-cell--header {
                        background-color: #34495e;
                        color: white;
                        font-weight: bold;
                        text-align: center;
                    }
                    .report-wrapper .datatable .dt-scrollable {
                        border: 1px solid #bdc3c7;
                    }
                    .report-wrapper .datatable .dt-row:hover {
                        background-color: #f8f9fa;
                    }
                `)
                .appendTo('head');
        }
        
        // Add export buttons
        report.page.add_inner_button(__("Export to PDF"), function() {
            let account = frappe.query_report.get_filter_value('account');
            let from_date = frappe.query_report.get_filter_value('from_date');
            let to_date = frappe.query_report.get_filter_value('to_date');
            
            frappe.utils.print(
                "Report",
                "Account Statement",
                "Standard",
                null,
                "PDF",
                {
                    "account": account,
                    "from_date": from_date,
                    "to_date": to_date
                }
            );
        });
        
        report.page.add_inner_button(__("Export to Excel"), function() {
            let account = frappe.query_report.get_filter_value('account');
            let filename = `Account_Statement_${account}_${frappe.datetime.get_today()}`;
            frappe.utils.csv_export(report.data, report.columns, filename);
        });
        
        // Add account balance summary
        report.page.add_inner_button(__("Account Summary"), function() {
            let account = frappe.query_report.get_filter_value('account');
            if (account) {
                frappe.set_route('query-report', 'General Ledger', {
                    'account': account,
                    'from_date': frappe.query_report.get_filter_value('from_date'),
                    'to_date': frappe.query_report.get_filter_value('to_date')
                });
            }
        });
    },
    
    "get_datatable_options": function(options) {
        return Object.assign(options, {
            checkboxColumn: false,
            inlineFilters: true,
            treeView: false,
            layout: "fluid",
            noDataMessage: __("No transactions found for the selected account and date range"),
            cellHeight: 35,
            dynamicRowHeight: true,
            serialNoColumn: false
        });
    }
};

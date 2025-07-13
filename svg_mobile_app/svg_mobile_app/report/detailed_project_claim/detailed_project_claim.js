// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.query_reports["Detailed Project Claim"] = {
    "filters": [
        {
            "fieldname": "customer",
            "label": __("Customer"),
            "fieldtype": "Link",
            "options": "Customer",
            "reqd": 0
        },
        {
            "fieldname": "project",
            "label": __("Project"),
            "fieldtype": "Link",
            "options": "Project Contractors",
            "reqd": 0,
            "get_query": function() {
                var customer = frappe.query_report.get_filter_value('customer');
                if (customer) {
                    return {
                        "filters": {
                            "customer": customer
                        }
                    };
                }
            }
        },
        {
            "fieldname": "claim_name",
            "label": __("Specific Claim"),
            "fieldtype": "Link",
            "options": "Project Claim",
            "reqd": 0,
            "get_query": function() {
                var customer = frappe.query_report.get_filter_value('customer');
                var project = frappe.query_report.get_filter_value('project');
                var filters = {};
                
                if (customer) {
                    filters["customer"] = customer;
                }
                if (project) {
                    filters["for_project"] = project;
                }
                
                return {
                    "filters": filters
                };
            }
        },
        {
            "fieldname": "from_date",
            "label": __("From Date"),
            "fieldtype": "Date",
            "reqd": 0,
            "default": frappe.datetime.add_months(frappe.datetime.get_today(), -3)
        },
        {
            "fieldname": "to_date",
            "label": __("To Date"),
            "fieldtype": "Date",
            "reqd": 0,
            "default": frappe.datetime.get_today()
        },
        {
            "fieldname": "status",
            "label": __("Status"),
            "fieldtype": "Select",
            "options": "\nUnreconciled\nReconciled",
            "reqd": 0
        }
    ],
    
    "formatter": function(value, row, column, data, default_formatter) {
        // Handle different row types with special formatting
        
        // Header rows (claim headers)
        if (data._is_header) {
            if (column.fieldname === "project_info") {
                return `<div style="font-weight: bold; color: #2c3e50; font-size: 14px; background-color: #ecf0f1; padding: 5px;">${value || ""}</div>`;
            }
            if (column.fieldname === "item_description") {
                return `<div style="font-weight: bold; color: #2c3e50; background-color: #ecf0f1; padding: 5px;">${value || ""}</div>`;
            }
            if (column.fieldname === "status") {
                let color = value === "Reconciled" ? "#27ae60" : "#e74c3c";
                return `<div style="font-weight: bold; color: ${color}; background-color: #ecf0f1; padding: 5px;">${value || ""}</div>`;
            }
            return `<div style="background-color: #ecf0f1; padding: 5px;">${value || ""}</div>`;
        }
        
        // Customer info rows
        if (data._is_customer_info) {
            if (column.fieldname === "customer_info") {
                return `<div style="font-weight: bold; color: #34495e; font-size: 13px;">${value || ""}</div>`;
            }
            if (column.fieldname === "item_description") {
                return `<div style="color: #7f8c8d; font-style: italic; font-size: 12px;">${value || ""}</div>`;
            }
            return `<div>${value || ""}</div>`;
        }
        
        // Category headers
        if (data._is_category_header) {
            if (column.fieldname === "item_description") {
                return `<div style="font-weight: bold; color: #8e44ad; font-size: 13px; margin: 10px 0 5px 0; border-bottom: 2px solid #8e44ad;">${value || ""}</div>`;
            }
            return `<div style="background-color: #f8f9fa; padding: 3px;"></div>`;
        }
        
        // Item rows
        if (data._is_item) {
            if (column.fieldname === "item_description") {
                return `<div style="padding-left: 20px; color: #2c3e50;">${value || ""}</div>`;
            }
        }
        
        // Subtotal rows
        if (data._is_subtotal) {
            if (column.fieldname === "item_description") {
                return `<div style="font-weight: bold; color: #16a085; font-style: italic;">${value || ""}</div>`;
            }
            if (column.fieldtype === "Currency" && value) {
                return `<div style="font-weight: bold; color: #16a085; text-align: right;">${format_currency(value)}</div>`;
            }
        }
        
        // Total rows
        if (data._is_total) {
            if (column.fieldname === "item_description") {
                return `<div style="font-weight: bold; color: #c0392b; font-size: 14px; background-color: #fadbd8; padding: 5px;">${value || ""}</div>`;
            }
            if (column.fieldtype === "Currency" && value) {
                return `<div style="font-weight: bold; color: #c0392b; font-size: 14px; text-align: right; background-color: #fadbd8; padding: 5px;">${format_currency(value)}</div>`;
            }
            if (column.fieldtype === "Percent" && value) {
                return `<div style="font-weight: bold; color: #c0392b; text-align: right; background-color: #fadbd8; padding: 5px;">${value}%</div>`;
            }
            return `<div style="background-color: #fadbd8; padding: 5px;">${value || ""}</div>`;
        }
        
        // Separator rows
        if (data._is_separator) {
            if (column.fieldname === "project_info") {
                return `<div style="color: #bdc3c7; font-family: monospace;">${value || ""}</div>`;
            }
            return `<div></div>`;
        }
        
        // Default formatting for regular data
        if (column.fieldtype === "Currency" && value) {
            return `<div style="text-align: right;">${format_currency(value)}</div>`;
        }
        
        if (column.fieldtype === "Percent" && value) {
            return `<div style="text-align: right;">${value}%</div>`;
        }
        
        if (column.fieldtype === "Date" && value) {
            return frappe.datetime.str_to_user(value);
        }
        
        return default_formatter(value, row, column, data);
    },
    
    "onload": function(report) {
        // Add custom CSS for better formatting
        if (!$('#detailed-project-claim-css').length) {
            $('<style id="detailed-project-claim-css">')
                .text(`
                    .report-wrapper .datatable .dt-row {
                        border-bottom: 1px solid #ecf0f1;
                    }
                    .report-wrapper .datatable .dt-cell {
                        padding: 8px 12px;
                        vertical-align: top;
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
                `)
                .appendTo('head');
        }
        
        // Add export buttons
        report.page.add_inner_button(__("Export to PDF"), function() {
            frappe.utils.print(
                "Report",
                "Detailed Project Claim",
                "Standard",
                null,
                "PDF"
            );
        });
        
        report.page.add_inner_button(__("Export to Excel"), function() {
            frappe.utils.csv_export(report.data, report.columns, "Detailed Project Claim");
        });
    },
    
    "get_datatable_options": function(options) {
        return Object.assign(options, {
            checkboxColumn: false,
            inlineFilters: true,
            treeView: false,
            layout: "fluid",
            noDataMessage: __("No project claims found for the selected criteria"),
            cellHeight: 35,
            dynamicRowHeight: true
        });
    }
};

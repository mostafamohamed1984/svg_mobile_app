// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.query_reports["Trial Balance Arabic"] = {
    "filters": [
        {
            "fieldname": "company",
            "label": __("Company"),
            "fieldtype": "Link",
            "options": "Company",
            "reqd": 1,
            "default": frappe.defaults.get_user_default("Company")
        },
        {
            "fieldname": "from_date",
            "label": __("From Date"),
            "fieldtype": "Date",
            "reqd": 0,
            "default": frappe.datetime.year_start()
        },
        {
            "fieldname": "to_date",
            "label": __("To Date"),
            "fieldtype": "Date",
            "reqd": 0,
            "default": frappe.datetime.get_today()
        },
        {
            "fieldname": "root_type",
            "label": __("Root Type"),
            "fieldtype": "Select",
            "options": "\nAsset\nLiability\nEquity\nIncome\nExpense",
            "reqd": 0
        },
        {
            "fieldname": "account_type",
            "label": __("Account Type"),
            "fieldtype": "Select",
            "options": "\nBank\nCash\nReceivable\nPayable\nStock\nTax\nChargeable\nIncome Account\nExpense Account\nFixed Asset\nAccumulated Depreciation\nDepreciation\nRound Off\nCapital Work in Progress\nAsset Received But Not Billed\nExpenses Included In Valuation\nExpenses Included In Asset Valuation\nStock Adjustment\nStock Received But Not Billed\nService Received But Not Billed\nTemporary",
            "reqd": 0
        },
        {
            "fieldname": "show_group_accounts",
            "label": __("Show Group Accounts"),
            "fieldtype": "Check",
            "default": 0
        }
    ],
    
    "formatter": function(value, row, column, data, default_formatter) {
        // Category headers
        if (data._is_category_header) {
            if (column.fieldname === "account_name") {
                return `<div style="font-weight: bold; color: #8e44ad; font-size: 14px; text-align: center; background-color: #f8f9fa; padding: 8px; border: 2px solid #8e44ad; direction: rtl;">${value || ""}</div>`;
            }
            return `<div style="background-color: #f8f9fa; padding: 8px; border: 2px solid #8e44ad;"></div>`;
        }
        
        // Category totals
        if (data._is_category_total) {
            if (column.fieldname === "account_name") {
                return `<div style="font-weight: bold; color: #16a085; font-size: 13px; text-align: right; background-color: #e8f6f3; padding: 5px; direction: rtl;">${value || ""}</div>`;
            }
            if (column.fieldtype === "Currency" && value) {
                return `<div style="font-weight: bold; color: #16a085; text-align: right; background-color: #e8f6f3; padding: 5px;">${format_currency(value)}</div>`;
            }
            return `<div style="background-color: #e8f6f3; padding: 5px;">${value || ""}</div>`;
        }
        
        // Grand total
        if (data._is_grand_total) {
            if (column.fieldname === "account_name") {
                return `<div style="font-weight: bold; color: #c0392b; font-size: 15px; text-align: right; background-color: #fadbd8; padding: 8px; border: 2px solid #c0392b; direction: rtl;">${value || ""}</div>`;
            }
            if (column.fieldtype === "Currency" && value) {
                return `<div style="font-weight: bold; color: #c0392b; font-size: 15px; text-align: right; background-color: #fadbd8; padding: 8px; border: 2px solid #c0392b;">${format_currency(value)}</div>`;
            }
            return `<div style="background-color: #fadbd8; padding: 8px; border: 2px solid #c0392b;">${value || ""}</div>`;
        }
        
        // Separator rows
        if (data._is_separator) {
            return `<div style="height: 10px; border-bottom: 1px solid #ecf0f1;"></div>`;
        }
        
        // Regular account rows
        if (column.fieldname === "account_name") {
            return `<div style="direction: rtl; text-align: right; padding: 3px;">${value || ""}</div>`;
        }
        
        if (column.fieldname === "account_code") {
            return `<div style="text-align: center; font-family: monospace; font-weight: bold; color: #34495e;">${value || ""}</div>`;
        }
        
        // Format currency fields
        if (column.fieldtype === "Currency") {
            if (value && value !== 0) {
                let color = "#2c3e50";
                if (column.fieldname === "balance") {
                    color = value >= 0 ? "#27ae60" : "#e74c3c";
                }
                return `<div style="text-align: right; color: ${color}; font-weight: 500;">${format_currency(value)}</div>`;
            }
            return `<div style="text-align: right; color: #95a5a6;">-</div>`;
        }
        
        return default_formatter(value, row, column, data);
    },
    
    "onload": function(report) {
        // Add custom CSS for RTL and Arabic support
        if (!$('#trial-balance-arabic-css').length) {
            $('<style id="trial-balance-arabic-css">')
                .text(`
                    .report-wrapper .datatable .dt-cell--col-1 {
                        direction: rtl;
                        text-align: right;
                    }
                    .report-wrapper .datatable .dt-cell--header-1 {
                        direction: rtl;
                        text-align: right;
                    }
                    .report-wrapper .datatable .dt-cell--col-0 {
                        text-align: center;
                    }
                    .report-wrapper .datatable .dt-cell--col-2,
                    .report-wrapper .datatable .dt-cell--col-3,
                    .report-wrapper .datatable .dt-cell--col-4 {
                        text-align: right;
                    }
                    .report-wrapper .datatable .dt-row {
                        border-bottom: 1px solid #ecf0f1;
                    }
                    .report-wrapper .datatable .dt-cell {
                        padding: 8px 12px;
                        vertical-align: middle;
                    }
                    .report-wrapper .datatable .dt-cell--header {
                        background-color: #2c3e50;
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
            let company = frappe.query_report.get_filter_value('company');
            let from_date = frappe.query_report.get_filter_value('from_date');
            let to_date = frappe.query_report.get_filter_value('to_date');
            
            frappe.utils.print(
                "Report",
                "Trial Balance Arabic",
                "Standard",
                null,
                "PDF",
                {
                    "company": company,
                    "from_date": from_date,
                    "to_date": to_date
                }
            );
        });
        
        report.page.add_inner_button(__("Export to Excel"), function() {
            let company = frappe.query_report.get_filter_value('company');
            let filename = `Trial_Balance_${company}_${frappe.datetime.get_today()}`;
            frappe.utils.csv_export(report.data, report.columns, filename);
        });
        
        // Add balance verification button
        report.page.add_inner_button(__("Verify Balance"), function() {
            let total_debit = 0;
            let total_credit = 0;
            
            report.data.forEach(function(row) {
                if (!row._is_category_header && !row._is_category_total && 
                    !row._is_grand_total && !row._is_separator) {
                    total_debit += flt(row.debit || 0);
                    total_credit += flt(row.credit || 0);
                }
            });
            
            let difference = Math.abs(total_debit - total_credit);
            let message = "";
            
            if (difference < 0.01) {
                message = `<div style="color: green;">✓ Trial Balance is balanced!<br>
                          Total Debit: ${format_currency(total_debit)}<br>
                          Total Credit: ${format_currency(total_credit)}</div>`;
            } else {
                message = `<div style="color: red;">⚠ Trial Balance is NOT balanced!<br>
                          Total Debit: ${format_currency(total_debit)}<br>
                          Total Credit: ${format_currency(total_credit)}<br>
                          Difference: ${format_currency(difference)}</div>`;
            }
            
            frappe.msgprint({
                title: __("Balance Verification"),
                message: message,
                indicator: difference < 0.01 ? "green" : "red"
            });
        });
    },
    
    "get_datatable_options": function(options) {
        return Object.assign(options, {
            checkboxColumn: false,
            inlineFilters: true,
            treeView: false,
            layout: "fluid",
            noDataMessage: __("No accounts found for the selected criteria"),
            cellHeight: 35,
            dynamicRowHeight: true,
            serialNoColumn: false,
            direction: 'rtl'
        });
    }
};

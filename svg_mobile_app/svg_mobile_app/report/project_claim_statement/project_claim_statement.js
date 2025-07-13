// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.query_reports["Project Claim Statement"] = {
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
            "fieldname": "from_date",
            "label": __("From Date"),
            "fieldtype": "Date",
            "reqd": 0,
            "default": frappe.datetime.add_months(frappe.datetime.get_today(), -1)
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
        // Apply RTL formatting for Arabic text
        if (column.fieldname === "phase_name") {
            return `<div style="direction: rtl; text-align: right;">${value || ""}</div>`;
        }
        
        // Format currency fields
        if (column.fieldtype === "Currency") {
            if (value) {
                return `<div style="text-align: right;">${format_currency(value)}</div>`;
            }
            return `<div style="text-align: right;">0.00</div>`;
        }
        
        // Format date fields
        if (column.fieldtype === "Date" && value) {
            return frappe.datetime.str_to_user(value);
        }
        
        return default_formatter(value, row, column, data);
    },
    
    "onload": function(report) {
        // Add custom CSS for RTL support
        if (!$('#project-claim-statement-rtl-css').length) {
            $('<style id="project-claim-statement-rtl-css">')
                .text(`
                    .report-wrapper .datatable .dt-cell--col-0 {
                        direction: rtl;
                        text-align: right;
                    }
                    .report-wrapper .datatable .dt-cell--header-0 {
                        direction: rtl;
                        text-align: right;
                    }
                    .report-wrapper .datatable .dt-cell--col-1,
                    .report-wrapper .datatable .dt-cell--col-2,
                    .report-wrapper .datatable .dt-cell--col-3,
                    .report-wrapper .datatable .dt-cell--col-4,
                    .report-wrapper .datatable .dt-cell--col-5 {
                        text-align: right;
                    }
                `)
                .appendTo('head');
        }
    },
    
    "get_datatable_options": function(options) {
        return Object.assign(options, {
            direction: 'rtl',
            language: {
                "emptyTable": "لا توجد بيانات متاحة",
                "info": "عرض _START_ إلى _END_ من أصل _TOTAL_ مدخل",
                "infoEmpty": "عرض 0 إلى 0 من أصل 0 مدخل",
                "infoFiltered": "(مرشح من _MAX_ إجمالي المدخلات)",
                "lengthMenu": "عرض _MENU_ مدخلات",
                "loadingRecords": "جاري التحميل...",
                "processing": "جاري المعالجة...",
                "search": "بحث:",
                "zeroRecords": "لم يتم العثور على سجلات مطابقة"
            }
        });
    }
};

// Copyright (c) 2025, Smart Vision Group and contributors
// For license information, please see license.txt

frappe.query_reports["Daily Employee Attendance Report"] = {
    "filters": [
        {
            "fieldname": "date",
            "label": __("Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today(),
            "reqd": 1
        },
        {
            "fieldname": "company",
            "label": __("Company"),
            "fieldtype": "Link",
            "options": "Company",
            "default": frappe.defaults.get_user_default("Company")
        },
        {
            "fieldname": "department",
            "label": __("Department"),
            "fieldtype": "Link",
            "options": "Department"
        }
    ],
    
    "formatter": function(value, row, column, data, default_formatter) {
        value = default_formatter(value, row, column, data);
        
        // Color coding for attendance status
        if (column.fieldname == "on_leave") {
            if (value == "Yes") {
                value = `<span style="color: orange; font-weight: bold;">${value}</span>`;
            } else {
                value = `<span style="color: green;">${value}</span>`;
            }
        }
        
        // Color coding for first check-in time
        if (column.fieldname == "first_checkin" && value) {
            const time = value.split(":");
            const hour = parseInt(time[0]);
            const minute = parseInt(time[1]);
            const totalMinutes = hour * 60 + minute;
            
            // Assuming work starts at 9:00 AM (540 minutes from midnight)
            const workStartTime = 9 * 60; // 9:00 AM in minutes
            const lateThreshold = workStartTime + 15; // 9:15 AM
            
            if (totalMinutes > lateThreshold) {
                value = `<span style="color: red; font-weight: bold;">${value}</span>`;
            } else if (totalMinutes > workStartTime) {
                value = `<span style="color: orange;">${value}</span>`;
            } else {
                value = `<span style="color: green;">${value}</span>`;
            }
        }
        
        return value;
    },
    
    "onload": function(report) {
        // Add custom buttons
        report.page.add_inner_button(__("Export to Excel"), function() {
            frappe.query_report.export_report('Excel');
        });
        
        report.page.add_inner_button(__("Print Report"), function() {
            frappe.query_report.print_report();
        });
        
        // Add summary cards
        if (report.data && report.data.length > 0) {
            this.add_summary_cards(report);
        }
    },
    
    "add_summary_cards": function(report) {
        // Get summary data
        frappe.call({
            method: "svg_mobile_app.svg_mobile_app.report.daily_employee_attendance_report.daily_employee_attendance_report.get_report_summary",
            args: {
                filters: report.get_values()
            },
            callback: function(r) {
                if (r.message) {
                    report.page.add_inner_message(
                        frappe.render_template("attendance_summary", {
                            summary: r.message
                        })
                    );
                }
            }
        });
    }
};

// Custom template for summary cards
frappe.templates["attendance_summary"] = `
<div class="row attendance-summary" style="margin: 15px 0;">
    {% for item in summary %}
    <div class="col-sm-3">
        <div class="card text-center" style="padding: 10px; border-left: 4px solid 
            {% if item.indicator == 'Green' %}#28a745
            {% elif item.indicator == 'Orange' %}#ffc107
            {% elif item.indicator == 'Red' %}#dc3545
            {% else %}#007bff{% endif %};">
            <div class="card-body">
                <h4 class="card-title" style="margin: 0; color: 
                    {% if item.indicator == 'Green' %}#28a745
                    {% elif item.indicator == 'Orange' %}#ffc107
                    {% elif item.indicator == 'Red' %}#dc3545
                    {% else %}#007bff{% endif %};">
                    {{ item.value }}
                </h4>
                <p class="card-text" style="margin: 5px 0 0 0; font-size: 12px; color: #666;">
                    {{ item.label }}
                </p>
            </div>
        </div>
    </div>
    {% endfor %}
</div>
`; 
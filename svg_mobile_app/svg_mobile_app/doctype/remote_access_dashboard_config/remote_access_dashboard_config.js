// Copyright (c) 2023, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on('Remote Access Dashboard Config', {
    refresh: function(frm) {
        // Add button to view dashboard
        frm.add_custom_button(__('View Dashboard'), function() {
            frappe.set_route('remote-access-dashboard');
        });
        
        // Add button to set as default
        if (!frm.doc.is_default) {
            frm.add_custom_button(__('Set as Default'), function() {
                frm.set_value('is_default', 1);
                frm.save();
            });
        }
    },
    
    date_range: function(frm) {
        // Show/hide custom date fields based on selection
        frm.toggle_display(['from_date', 'to_date'], frm.doc.date_range === 'Custom Range');
        
        // Set default dates based on selection
        if (frm.doc.date_range && frm.doc.date_range !== 'Custom Range') {
            let today = frappe.datetime.get_today();
            let from_date;
            
            if (frm.doc.date_range === 'Last 7 Days') {
                from_date = frappe.datetime.add_days(today, -7);
            } else if (frm.doc.date_range === 'Last 30 Days') {
                from_date = frappe.datetime.add_days(today, -30);
            } else if (frm.doc.date_range === 'Last 90 Days') {
                from_date = frappe.datetime.add_days(today, -90);
            } else if (frm.doc.date_range === 'Last 365 Days') {
                from_date = frappe.datetime.add_days(today, -365);
            }
            
            frm.set_value('from_date', from_date);
            frm.set_value('to_date', today);
        }
    }
});
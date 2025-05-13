// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on('Engineering Task', {
    refresh: function(frm) {
        // If the document is saved and not in completed status, show button to mark as completed
        if (!frm.is_new() && frm.doc.status !== 'Completed') {
            frm.add_custom_button(__('Mark as Completed'), function() {
                frm.set_value('status', 'Completed');
                if (!frm.doc.end_date) {
                    frm.set_value('end_date', frappe.datetime.nowdate());
                }
                frm.save();
            });
        }
    },
    
    // Handle status changes
    status: function(frm) {
        // When status changes to completed, update the end date if not already set
        if (frm.doc.status === 'Completed' && !frm.doc.end_date) {
            frm.set_value('end_date', frappe.datetime.nowdate());
            
            if (!frm.is_new()) {
                console.log('Updating parent Engineering Assignment...');
            }
        }
        
        // Set start date when status changes to In Progress if not already set
        if (frm.doc.status === 'In Progress' && !frm.doc.start_date) {
            frm.set_value('start_date', frappe.datetime.nowdate());
        }
    }
}); 
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
        
        // Add button to view parent Engineering Assignment
        if (!frm.is_new() && frm.doc.engineering_assignment) {
            frm.add_custom_button(__('View Engineering Assignment'), function() {
                frappe.set_route('Form', 'Engineering Assignment', frm.doc.engineering_assignment);
            });
        }
        
        // Add button to view Sketch
        if (!frm.is_new() && frm.doc.sketch) {
            frm.add_custom_button(__('View Sketch'), function() {
                frappe.set_route('Form', 'Sketch', frm.doc.sketch);
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
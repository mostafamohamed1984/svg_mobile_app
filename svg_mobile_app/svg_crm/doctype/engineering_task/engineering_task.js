// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on('Engineering Task', {
    refresh: function(frm) {
        // Only show action buttons if the document is saved
        if (frm.is_new()) return;
        
        // Create action buttons based on current status
        if (frm.doc.status === 'Required') {
            // When task is Required, show button to mark as In Progress
            frm.add_custom_button(__('Mark as In Progress'), function() {
                frm.set_value('status', 'In Progress');
                if (!frm.doc.start_date) {
                    frm.set_value('start_date', frappe.datetime.nowdate());
                }
                frm.save();
            }, __('Actions'));
        } 
        else if (frm.doc.status === 'In Progress') {
            // When task is In Progress, show button to mark as Ready
            frm.add_custom_button(__('Mark as Ready'), function() {
                frm.set_value('status', 'Ready');
                frm.save();
            }, __('Actions'));
        }
        else if (frm.doc.status === 'Ready') {
            // Senior engineer buttons for approval/rejection
            // Fetch senior engineer from Engineering Assignment
            frappe.db.get_value('Engineering Assignment', frm.doc.engineering_assignment, 'senior_engineer', function(r) {
                if (r && r.senior_engineer) {
                    // Get current user's employee link
                    frappe.db.get_value('Employee', {'user_id': frappe.session.user}, 'name', function(emp) {
                        // If current user is the senior engineer, show complete/reject buttons
                        if (emp && emp.name === r.senior_engineer) {
                            // Add Complete button
                            frm.add_custom_button(__('Complete Task'), function() {
                                frm.set_value('status', 'Completed');
                                if (!frm.doc.end_date) {
                                    frm.set_value('end_date', frappe.datetime.nowdate());
                                }
                                frm.save();
                            }, __('Actions'));
                            
                            // Add Reject button
                            frm.add_custom_button(__('Reject'), function() {
                                // Show dialog to collect rejection reason
                                frappe.prompt({
                                    fieldtype: 'Small Text',
                                    label: __('Rejection Reason'),
                                    fieldname: 'rejection_reason',
                                    reqd: 1
                                }, function(values) {
                                    frm.set_value('status', 'Modification');
                                    frm.set_value('rejection_reason', values.rejection_reason);
                                    frm.save();
                                    
                                    // Notify the junior engineer
                                    frappe.show_alert({
                                        message: __('Task sent back for modification'),
                                        indicator: 'orange'
                                    }, 5);
                                }, __('Provide Rejection Reason'), __('Submit'));
                            }, __('Actions'));
                        }
                    });
                }
            });
        }
        else if (frm.doc.status === 'Modification') {
            // When task needs modification, junior engineer can mark it as In Progress again
            frm.add_custom_button(__('Resume Work'), function() {
                frm.set_value('status', 'In Progress');
                frm.save();
            }, __('Actions'));
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
        
        if (frm.doc.status === 'Ready') {
            // Notify the senior engineer
            frappe.show_alert({
                message: __('Task marked as Ready for review'),
                indicator: 'blue'
            }, 5);
        }
    }
}); 
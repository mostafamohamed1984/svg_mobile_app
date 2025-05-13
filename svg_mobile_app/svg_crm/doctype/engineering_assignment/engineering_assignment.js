// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on('Engineering Assignment', {
    refresh: function(frm) {
        // Only show action buttons if the document is saved
        if (frm.is_new()) return;
        
        // Add button to view parent Sketch
        if (frm.doc.sketch) {
            frm.add_custom_button(__('View Sketch'), function() {
                frappe.set_route('Form', 'Sketch', frm.doc.sketch);
            }, __('Navigate'));
        }
        
        // Add buttons based on assignment status
        if (frm.doc.status === 'Required') {
            // If assignment is required, allow starting work
            frm.add_custom_button(__('Start Assignment'), function() {
                frm.set_value('status', 'In Progress');
                if (!frm.doc.start_date) {
                    frm.set_value('start_date', frappe.datetime.nowdate());
                }
                frm.save();
            }, __('Actions'));
        }
        
        // Show related engineering tasks
        if (frm.doc.status !== 'Required') {
            frm.add_custom_button(__('View Related Tasks'), function() {
                frappe.route_options = {
                    "engineering_assignment": frm.doc.name
                };
                frappe.set_route("List", "Engineering Task");
            }, __('Navigate'));
        }
        
        // Note: Assignment status is automatically changed to "Completed" when all child tasks are completed.
        // This happens through the EngineeringTask.update_parent_status() method in the backend
        // No manual button is needed to complete the assignment
        
        // Add button to update subtask statuses
        if (frm.doc.engineering_subtasks && frm.doc.engineering_subtasks.length > 0) {
            frm.add_custom_button(__('Refresh Task Statuses'), function() {
                refresh_subtask_statuses(frm);
            }, __('Actions'));
        }
    },
    
    // When status changes to completed, update the parent Sketch requirement
    status: function(frm) {
        if (frm.doc.status === 'Completed' && !frm.doc.end_date) {
            frm.set_value('end_date', frappe.datetime.nowdate());
        }
        
        if (frm.doc.status === 'Completed' && !frm.is_new()) {
            frappe.show_alert({
                message: __('Assignment completed. Updating requirement status...'),
                indicator: 'green'
            }, 5);
        }
    }
});

// Function to refresh the status of subtasks from Engineering Tasks
function refresh_subtask_statuses(frm) {
    frappe.call({
        method: 'frappe.client.get_list',
        args: {
            doctype: 'Engineering Task',
            filters: {
                'engineering_assignment': frm.doc.name
            },
            fields: ['name', 'status', 'junior_engineer']
        },
        callback: function(r) {
            if (r.message && r.message.length > 0) {
                const tasks = r.message;
                
                // Update status in the subtasks table
                frm.doc.engineering_subtasks.forEach(subtask => {
                    // Find matching task
                    const matching_task = tasks.find(task => 
                        task.junior_engineer === subtask.engineer
                    );
                    
                    if (matching_task) {
                        subtask.status = matching_task.status;
                    }
                });
                
                // Refresh the form to show updated statuses
                frm.refresh_field('engineering_subtasks');
                
                frappe.show_alert({
                    message: __('Task statuses refreshed'),
                    indicator: 'green'
                }, 3);
            } else {
                frappe.show_alert({
                    message: __('No related tasks found'),
                    indicator: 'orange'
                }, 3);
            }
        }
    });
} 
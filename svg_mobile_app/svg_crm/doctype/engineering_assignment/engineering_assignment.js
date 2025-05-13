// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on('Engineering Assignment', {
    refresh: function(frm) {
        // Add button to view parent Sketch
        if (!frm.is_new() && frm.doc.sketch) {
            frm.add_custom_button(__('View Sketch'), function() {
                frappe.set_route('Form', 'Sketch', frm.doc.sketch);
            });
        }
        
        // Add button to mark assignment as completed
        if (!frm.is_new() && frm.doc.status !== 'Completed' && frm.doc.engineering_subtasks && frm.doc.engineering_subtasks.length) {
            let all_completed = true;
            frm.doc.engineering_subtasks.forEach(subtask => {
                if (subtask.status !== 'Completed') {
                    all_completed = false;
                }
            });
            
            if (all_completed) {
                frm.add_custom_button(__('Mark Assignment Completed'), function() {
                    frm.set_value('status', 'Completed');
                    frm.save();
                }, __('Actions'));
            }
        }
    },
    
    // When status changes to completed, update the parent Sketch requirement
    status: function(frm) {
        if (frm.doc.status === 'Completed' && !frm.is_new()) {
            console.log('Updating requirement status in the Sketch document');
        }
    }
}); 
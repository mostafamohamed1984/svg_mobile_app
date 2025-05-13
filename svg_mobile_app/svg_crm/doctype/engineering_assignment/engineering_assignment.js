// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on('Engineering Assignment', {
    refresh: function(frm) {
        // If the document is saved and not in completed state, show button to create engineering tasks
        if (!frm.is_new() && frm.doc.status !== 'Completed') {
            frm.add_custom_button(__('Create Engineering Task'), function() {
                frappe.model.with_doctype('Engineering Task', function() {
                    var doc = frappe.model.get_new_doc('Engineering Task');
                    doc.engineering_assignment = frm.doc.name;
                    doc.sketch = frm.doc.sketch;
                    doc.requirement_item = frm.doc.requirement_item;
                    
                    // If there's a selected subtask, pre-fill with that data
                    const grid = frm.fields_dict.engineering_subtasks.grid;
                    if (grid.get_selected_children().length) {
                        const selected_subtask = grid.get_selected_children()[0];
                        doc.junior_engineer = selected_subtask.engineer;
                        doc.task_description = selected_subtask.task_description;
                        doc.start_date = selected_subtask.start_date;
                        doc.end_date = selected_subtask.end_date;
                    }
                    
                    frappe.set_route('Form', 'Engineering Task', doc.name);
                });
            }, __('Create'));
            
            // Add button to add subtasks for quick assignment
            frm.add_custom_button(__('Add Subtasks'), function() {
                const dialog = new frappe.ui.Dialog({
                    title: __('Add Engineering Subtasks'),
                    fields: [
                        {
                            fieldname: 'engineers_section',
                            fieldtype: 'Section Break',
                            label: __('Select Engineers')
                        },
                        {
                            fieldname: 'engineers',
                            fieldtype: 'Table',
                            label: __('Engineers'),
                            cannot_add_rows: false,
                            in_place_edit: true,
                            fields: [
                                {
                                    fieldname: 'engineer',
                                    fieldtype: 'Link',
                                    options: 'Employee',
                                    label: __('Junior Engineer'),
                                    in_list_view: 1,
                                    reqd: 1
                                },
                                {
                                    fieldname: 'task_description',
                                    fieldtype: 'Small Text',
                                    label: __('Task Description'),
                                    in_list_view: 1,
                                    reqd: 1
                                }
                            ]
                        },
                        {
                            fieldname: 'common_section',
                            fieldtype: 'Section Break',
                            label: __('Common Details')
                        },
                        {
                            fieldname: 'start_date',
                            fieldtype: 'Date',
                            label: __('Start Date'),
                            default: frappe.datetime.nowdate()
                        },
                        {
                            fieldname: 'end_date',
                            fieldtype: 'Date',
                            label: __('End Date')
                        }
                    ],
                    primary_action_label: __('Add Subtasks'),
                    primary_action: function() {
                        const values = dialog.get_values();
                        if (!values.engineers || !values.engineers.length) {
                            frappe.msgprint(__('Please add at least one engineer'));
                            return;
                        }
                        
                        // Add the subtasks to the current form
                        values.engineers.forEach(row => {
                            const child = frm.add_child('engineering_subtasks');
                            child.engineer = row.engineer;
                            child.task_description = row.task_description;
                            child.start_date = values.start_date;
                            child.end_date = values.end_date;
                            child.status = 'Pending';
                        });
                        
                        frm.refresh_field('engineering_subtasks');
                        
                        // If the status is Pending, update it to In Progress
                        if (frm.doc.status === 'Pending') {
                            frm.set_value('status', 'In Progress');
                        }
                        
                        // Save the document
                        frm.save();
                        dialog.hide();
                    }
                });
                
                dialog.show();
            }, __('Create'));
            
            // Add button to notify engineers
            frm.add_custom_button(__('Notify Engineers'), function() {
                if (!frm.doc.engineering_subtasks || !frm.doc.engineering_subtasks.length) {
                    frappe.msgprint(__('No subtasks found. Please add subtasks first.'));
                    return;
                }
                
                frappe.call({
                    method: 'svg_mobile_app.svg_crm.doctype.engineering_assignment.engineering_assignment.notify_all_engineers',
                    args: {
                        assignment_name: frm.docname
                    },
                    callback: function(r) {
                        if(!r.exc) {
                            frappe.msgprint(__('Notifications sent successfully'));
                        }
                    }
                });
            }, __('Actions'));
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
            frappe.show_alert(__('Updating requirement status in the Sketch document'));
        }
    }
}); 
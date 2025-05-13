// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Sketch", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on("Sketch", {
	refresh(frm) {
        // Initialize the requirement items cache
        frm.requirement_items = [];
        
        // Populate the requirement items from the current form data
        if (frm.doc.sketch_requirements && frm.doc.sketch_requirements.length) {
            frm.doc.sketch_requirements.forEach(req => {
                if (req.item) {
                    frm.requirement_items.push(req.item);
                }
            });
        }
        
        // Add custom button to create Engineering Assignment for a requirement
        if (!frm.is_new() && frm.doc.sketch_requirements && frm.doc.sketch_requirements.length) {
            frm.add_custom_button(__('Create Engineering Assignment'), function() {
                // Create a dialog to select which requirement to create an assignment for
                const requirements = frm.doc.sketch_requirements.filter(req => 
                    req.status === 'Required' && req.item && req.engineer
                );
                
                if (!requirements.length) {
                    frappe.msgprint(__('No eligible requirements found. Requirements must have item, engineer assigned and be in Required status.'));
                    return;
                }
                
                const dialog = new frappe.ui.Dialog({
                    title: __('Select Requirement to Assign'),
                    fields: [
                        {
                            fieldname: 'requirement',
                            fieldtype: 'Table',
                            label: __('Requirements'),
                            cannot_add_rows: true,
                            cannot_delete_rows: true,
                            in_place_edit: true,
                            data: requirements.map((req, idx) => {
                                return {
                                    idx: idx + 1,
                                    item: req.item,
                                    description: req.description,
                                    engineer: req.engineer,
                                    create_assignment: 0
                                };
                            }),
                            fields: [
                                {
                                    fieldname: 'idx',
                                    fieldtype: 'Int',
                                    label: __('#'),
                                    in_list_view: 1,
                                    read_only: 1
                                },
                                {
                                    fieldname: 'item',
                                    fieldtype: 'Link',
                                    options: 'Item',
                                    label: __('Item'),
                                    in_list_view: 1,
                                    read_only: 1
                                },
                                {
                                    fieldname: 'description',
                                    fieldtype: 'Small Text',
                                    label: __('Description'),
                                    in_list_view: 1,
                                    read_only: 1
                                },
                                {
                                    fieldname: 'engineer',
                                    fieldtype: 'Link',
                                    options: 'Employee',
                                    label: __('Engineer'),
                                    in_list_view: 1,
                                    read_only: 1
                                },
                                {
                                    fieldname: 'create_assignment',
                                    fieldtype: 'Check',
                                    label: __('Create Assignment'),
                                    in_list_view: 1
                                }
                            ]
                        }
                    ],
                    primary_action_label: __('Create'),
                    primary_action: (values) => {
                        const selected_requirements = values.requirement.filter(row => row.create_assignment);
                        
                        if (!selected_requirements.length) {
                            frappe.msgprint(__('Please select at least one requirement'));
                            return;
                        }
                        
                        selected_requirements.forEach(row => {
                            const requirement = requirements[row.idx - 1];
                            create_engineering_assignment(frm, requirement);
                        });
                        
                        dialog.hide();
                    }
                });
                
                dialog.show();
            });
        }
	},
    
    // Update requirement items when the requirements table changes
    sketch_requirements_add: function(frm, cdt, cdn) {
        setTimeout(() => refresh_requirement_items(frm), 500);
    },
    
    sketch_requirements_remove: function(frm, cdt, cdn) {
        refresh_requirement_items(frm);
    }
});

// Helper function to create an Engineering Assignment from a requirement
function create_engineering_assignment(frm, requirement) {
    frappe.model.with_doctype('Engineering Assignment', function() {
        var doc = frappe.model.get_new_doc('Engineering Assignment');
        doc.sketch = frm.doc.name;
        doc.sketch_number = frm.doc.sketch_number;
        doc.requirement_item = requirement.item;
        doc.senior_engineer = requirement.engineer;
        doc.description = requirement.description || "No description provided";
        doc.start_date = frappe.datetime.nowdate();
        doc.project_type = frm.doc.project_type;
        
        frappe.set_route('Form', 'Engineering Assignment', doc.name);
    });
}

// Helper function to refresh the requirement items list and update select options
function refresh_requirement_items(frm) {
    frm.requirement_items = [];
    
    if (frm.doc.sketch_requirements && frm.doc.sketch_requirements.length) {
        frm.doc.sketch_requirements.forEach(req => {
            if (req.item) {
                frm.requirement_items.push(req.item);
            }
        });
    }
    
    // Update the options for the requirement_item select field in engineering tasks
    frm.fields_dict.sketch_engineering_tasks.grid.update_docfield_property(
        'requirement_item', 
        'options', 
        ["\n"].concat(frm.requirement_items)
    );
    
    // Force grid to refresh to show updated options
    frm.fields_dict.sketch_engineering_tasks.grid.refresh();
}

frappe.ui.form.on("Sketch Engineering Tasks", {
    form_render(frm, cdt, cdn) {
        // Make sure the requirement_item field has the latest options when rendering a row
        var row = locals[cdt][cdn];
        var grid = frm.fields_dict.sketch_engineering_tasks.grid;
        
        if (frm.requirement_items && frm.requirement_items.length) {
            grid.update_docfield_property(
                'requirement_item',
                'options',
                ["\n"].concat(frm.requirement_items)
            );
        }
    }
});

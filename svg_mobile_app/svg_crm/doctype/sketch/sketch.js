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

        // Initialize the elec and mech options cache
        frm.elec_mech_options = {};
        
        // Preload all elec_and_mech options for existing rows
        if (frm.doc.elec_and_mech_requirements && frm.doc.elec_and_mech_requirements.length) {
            // Get unique elec_and_mech values
            const elec_mech_values = [...new Set(
                frm.doc.elec_and_mech_requirements
                .filter(row => row.elec_and_mech)
                .map(row => row.elec_and_mech)
            )];
            
            // Preload options for all unique elec_and_mech values
            Promise.all(
                elec_mech_values.map(name => fetch_elec_mech_options(frm, name))
            );
        }
        
        // Only add buttons if the document is saved
        if (!frm.is_new()) {
            // Add button to view all engineering assignments
            frm.add_custom_button(__('View Assignments'), function() {
                frappe.route_options = {
                    "sketch": frm.doc.name
                };
                frappe.set_route("List", "Engineering Assignment");
            }, __('Engineering'));
            
            // Add button to view all engineering tasks
            frm.add_custom_button(__('View Tasks'), function() {
                frappe.route_options = {
                    "sketch": frm.doc.name
                };
                frappe.set_route("List", "Engineering Task");
            }, __('Engineering'));
            
            // Add button to refresh status of all requirements
            frm.add_custom_button(__('Refresh Statuses'), function() {
                refresh_requirement_statuses(frm);
            }, __('Engineering'));
            
            // Add button to create engineering assignments for requirements
            if (frm.doc.sketch_requirements && frm.doc.sketch_requirements.length) {
                // Check for requirements that need engineering assignments
                const needs_assignments = frm.doc.sketch_requirements.some(req => 
                    req.status === 'Required' && req.item && req.engineer
                );
                
                if (needs_assignments) {
                    frm.add_custom_button(__('Create Assignments'), function() {
                        create_engineering_assignments(frm);
                    }, __('Engineering'));
                }
            }
        }
	},
    
    // After save, check for any new requirements that need engineering assignments
    after_save: function(frm) {
        if (frm.doc.sketch_requirements && frm.doc.sketch_requirements.length) {
            // Check for requirements that need engineering assignments
            const requirements = frm.doc.sketch_requirements.filter(req => 
                req.status === 'Required' && req.item && req.engineer
            );
            
            if (requirements.length) {
                frappe.call({
                    method: 'svg_mobile_app.svg_crm.doctype.sketch.sketch.create_engineering_assignments',
                    args: {
                        sketch_name: frm.doc.name
                    },
                    callback: function(r) {
                        if(!r.exc && r.message && r.message.created > 0) {
                            frappe.show_alert({
                                message: __(`Created ${r.message.created} engineering assignments`),
                                indicator: 'green'
                            }, 5);
                        }
                    }
                });
            }
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

// Function to fetch elec_and_mech_info options for a given elec_and_mech docname
function fetch_elec_mech_options(frm, elec_mech_name) {
    if (!elec_mech_name) return Promise.resolve([]);
    
    // If options are already cached, return them
    if (frm.elec_mech_options[elec_mech_name]) {
        return Promise.resolve(frm.elec_mech_options[elec_mech_name]);
    }
    
    // Otherwise, fetch options from the server
    return new Promise((resolve) => {
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Elec and mech',
                name: elec_mech_name
            },
            callback: function(r) {
                if (r.message && r.message.elec_and_mech_info) {
                    // Extract names from elec_and_mech_info child table
                    const options = r.message.elec_and_mech_info.map(info => info.name1);
                    
                    // Cache the options for future use
                    frm.elec_mech_options[elec_mech_name] = options;
                    
                    resolve(options);
                } else {
                    resolve([]);
                }
            }
        });
    });
}

// Function to refresh the status of all requirements based on tasks
function refresh_requirement_statuses(frm) {
    frappe.call({
        method: 'svg_mobile_app.svg_crm.doctype.sketch.sketch.refresh_requirement_statuses',
        args: {
            sketch_name: frm.doc.name
        },
        freeze: true,
        freeze_message: __('Refreshing requirement statuses...'),
        callback: function(r) {
            if(!r.exc && r.message) {
                frm.reload_doc();
                frappe.show_alert({
                    message: __(`Updated ${r.message.updated} requirements`),
                    indicator: 'green'
                }, 5);
            }
        }
    });
}

// Function to create engineering assignments for requirements
function create_engineering_assignments(frm) {
    frappe.call({
        method: 'svg_mobile_app.svg_crm.doctype.sketch.sketch.create_engineering_assignments',
        args: {
            sketch_name: frm.doc.name
        },
        freeze: true,
        freeze_message: __('Creating engineering assignments...'),
        callback: function(r) {
            if(!r.exc && r.message) {
                frappe.show_alert({
                    message: __(`Created ${r.message.created} engineering assignments`),
                    indicator: 'green'
                }, 5);
            }
        }
    });
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
    },
    
    // Open the engineering task when viewing a task row
    view: function(frm, cdt, cdn) {
        var row = locals[cdt][cdn];
        if (row.engineering_task) {
            frappe.set_route("Form", "Engineering Task", row.engineering_task);
        }
    }
});

// Add event handlers for the elec_and_mech_requirements child table
frappe.ui.form.on("Elec and Mech Requirements", {
    elec_and_mech: function(frm, cdt, cdn) {
        var row = locals[cdt][cdn];
        
        if (row.elec_and_mech) {
            // Clear the options field while loading
            frappe.model.set_value(cdt, cdn, 'options', '');
            
            // Fetch options from the selected elec_and_mech record
            fetch_elec_mech_options(frm, row.elec_and_mech);
        }
    },
    
    form_render: function(frm, cdt, cdn) {
        var row = locals[cdt][cdn];
        var grid_row = frm.fields_dict.elec_and_mech_requirements.grid.grid_rows_by_docname[cdn];
        
        if (!grid_row) return;
        
        // Find the options field in the grid row
        let options_field = null;
        grid_row.columns.forEach(column => {
            if (column.df && column.df.fieldname === 'options') {
                options_field = column;
            }
        });
        
        if (!options_field || !options_field.$input) return;
        
        // Add autocomplete functionality to the options field
        if (row.elec_and_mech) {
            fetch_elec_mech_options(frm, row.elec_and_mech).then(options => {
                if (options && options.length) {
                    // Setup autocomplete for the input
                    if (!options_field.$input.data('awesomplete')) {
                        options_field.$input.data('awesomplete', new Awesomplete(options_field.$input.get(0), {
                            minChars: 0,
                            list: options,
                            filter: function(text, input) {
                                return Awesomplete.FILTER_CONTAINS(text, input.match(/[^,]*$/)[0]);
                            },
                            replace: function(text) {
                                options_field.$input.val(text);
                                frappe.model.set_value(cdt, cdn, 'options', text);
                            }
                        }));
                        
                        // Show options on focus
                        options_field.$input.on('focus', function() {
                            if (options_field.$input.data('awesomplete')) {
                                options_field.$input.data('awesomplete').evaluate();
                            }
                        });
                    } else {
                        // Update the list with new options
                        options_field.$input.data('awesomplete').list = options;
                    }
                }
            });
        }
    },
    
    // When editing directly in the grid
    options: function(frm, cdt, cdn) {
        var row = locals[cdt][cdn];
        
        if (row.elec_and_mech && !row.options) {
            // Show suggestions when user starts typing in the options field
            fetch_elec_mech_options(frm, row.elec_and_mech).then(options => {
                if (options && options.length) {
                    // Show a dialog with options to select from
                    let d = new frappe.ui.Dialog({
                        title: __('Select Option'),
                        fields: [{
                            label: __('Options'),
                            fieldname: 'option',
                            fieldtype: 'Select',
                            options: ['\n'].concat(options)
                        }],
                        primary_action_label: __('Select'),
                        primary_action: function() {
                            let selected_option = d.get_value('option');
                            if (selected_option) {
                                frappe.model.set_value(cdt, cdn, 'options', selected_option);
                            }
                            d.hide();
                        }
                    });
                    d.show();
                }
            });
        }
    }
});

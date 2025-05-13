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
                            frappe.show_alert(__(`Created ${r.message.created} engineering assignments and sent notifications.`));
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

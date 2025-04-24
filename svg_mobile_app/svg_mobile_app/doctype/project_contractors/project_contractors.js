// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project Contractors", {
    refresh: function(frm) {
        console.log("Current company:", frappe.defaults.get_user_default('company'));
    },
    
    setup: function(frm) {
        // Filter items in the child table based on the company
        frm.fields_dict.items.grid.get_field('item').get_query = function() {
            return {
                query: "svg_mobile_app.doctype.project_contractors.project_contractors.get_items_by_company",
                filters: {
                    "company": frappe.defaults.get_user_default('company')
                }
            };
        };
    }
});

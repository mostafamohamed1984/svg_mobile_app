// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Project Contractors", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on("Project Contractors", {
    refresh: function(frm) {
        
    },
    
    setup: function(frm) {
        // Filter items in the child table based on the company in item_defaults
        frm.set_query("item", "items", function() {
            return {
                query: "svg_mobile_app.svg_mobile_app.doctype.project_contractors.project_contractors.get_items_by_company",
                filters: {
                    "company": frappe.defaults.get_user_default('company')
                }
            };
        });
    }
});

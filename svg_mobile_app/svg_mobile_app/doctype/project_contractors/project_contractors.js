// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project Contractors", {
    refresh: function(frm) {
        
    },
    
    setup: function(frm) {
        // Filter items in the child table based on the company
        frm.fields_dict.items.grid.get_field('item').get_query = function() {
            return {
                filters: [
                    ["Item", "name", "in", 
                        // Subquery to get items with matching company
                        `(SELECT parent FROM \`tabItem Default\` 
                          WHERE company = '${frappe.defaults.get_user_default('company')}')`
                    ]
                ]
            };
        };
    }
});

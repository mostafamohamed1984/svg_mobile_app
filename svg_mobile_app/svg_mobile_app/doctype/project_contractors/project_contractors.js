// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project Contractors", {
    refresh: function(frm) {
        console.log("Current company:", frappe.defaults.get_user_default('company'));
        setup_item_filter(frm);
    },
    
    setup: function(frm) {
        setup_item_filter(frm);
    }
});

// Function to set up the item filter
function setup_item_filter(frm) {
    frm.fields_dict.items.grid.get_field('item').get_query = function() {
        // Use the standard ERPNext link filter format
        return {
            filters: [
                ['Item Default', 'company', '=', frappe.defaults.get_user_default('company')]
            ]
        };
    };
}

// Format link titles for Project Contractors fields
frappe.form.link_formatters['Project Contractors'] = function(value, doc) {
    if(doc && doc.project_name && doc.customer_name) {
        return value + '<br><span class="text-muted small">' + doc.project_name + ' - ' + doc.customer_name + '</span>';
    } else if(doc && doc.project_name) {
        return value + '<br><span class="text-muted small">' + doc.project_name + '</span>';
    }
    return value;
};

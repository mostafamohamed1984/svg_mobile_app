// Client Script for Project Contractors
// Create this as a Client Script in ERPNext UI
// Go to: Setup > Customization > Client Script > New
// DocType: Project Contractors
// Script Type: Client

frappe.ui.form.on("Project Contractors", {
    refresh: function(frm) {
        // Log company to verify
        console.log("Current user company:", frappe.defaults.get_user_default('company'));
        
        // Show alert about filtering
        frappe.show_alert({
            message: `Setting up item filters for company: ${frappe.defaults.get_user_default('company')}`,
            indicator: 'blue'
        }, 5);
        
        // Set up the filter right away on refresh
        setup_item_filter(frm);
    },
    
    setup: function(frm) {
        setup_item_filter(frm);
    }
});

// Direct filtering on Project Items child table
frappe.ui.form.on("Project Items", {
    items_add: function(frm, cdt, cdn) {
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
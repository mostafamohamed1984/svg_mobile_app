// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.listview_settings['Project Claim'] = {
    onload: function(listview) {
        listview.page.add_inner_button(__('Create Bulk Claim'), function() {
            // Create a new Project Claim doc
            frappe.new_doc('Project Claim', {})
                .then(function() {
                    // Trigger the "Create from Multiple Invoices" button
                    setTimeout(function() {
                        $('.btn-primary:contains("Create from Multiple Invoices")').click();
                    }, 300);
                });
        }, __('Actions'));
    }
}; 
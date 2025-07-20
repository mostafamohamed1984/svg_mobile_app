// Copyright (c) 2025, Smart Vision and contributors
// For license information, please see license.txt

frappe.ui.form.on('Community', {
    refresh: function(frm) {
        // Add custom button to view related offers
        if (!frm.is_new()) {
            frm.add_custom_button(__('View Offers'), function() {
                frappe.set_route('List', 'Offers Collection', {
                    'community': frm.doc.name
                });
            });
        }
        
        // Set indicator based on active status
        if (frm.doc.is_active) {
            frm.dashboard.set_headline_alert(
                '<div class="row"><div class="col-xs-12">' +
                '<span class="indicator green">Active Community</span>' +
                '</div></div>'
            );
        } else {
            frm.dashboard.set_headline_alert(
                '<div class="row"><div class="col-xs-12">' +
                '<span class="indicator red">Inactive Community</span>' +
                '</div></div>'
            );
        }
    },
    
    community_name: function(frm) {
        // Auto-format community name (capitalize first letter of each word)
        if (frm.doc.community_name) {
            let formatted_name = frm.doc.community_name
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            
            if (formatted_name !== frm.doc.community_name) {
                frm.set_value('community_name', formatted_name);
            }
        }
    },
    
    is_active: function(frm) {
        // Warn user when deactivating a community
        if (!frm.doc.is_active && !frm.is_new()) {
            frappe.msgprint({
                title: __('Warning'),
                message: __('Deactivating this community will hide it from new Offers Collection entries.'),
                indicator: 'orange'
            });
        }
    }
});

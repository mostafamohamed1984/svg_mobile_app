// Copyright (c) 2025, Smart Vision and contributors
// For license information, please see license.txt

frappe.ui.form.on('Offer Material Status', {
    refresh: function(frm) {
        // Add custom button to view related offers
        if (!frm.is_new()) {
            frm.add_custom_button(__('View Offers'), function() {
                frappe.set_route('List', 'Offers Collection', {
                    'offer_material_status': frm.doc.name
                });
            });
        }
        
        // Set indicator based on active status and color
        set_status_indicator(frm);
        
        // Apply color preview if color code is set
        apply_color_preview(frm);
    },
    
    status_name: function(frm) {
        // Auto-format status name (capitalize first letter of each word)
        if (frm.doc.status_name) {
            let formatted_name = frm.doc.status_name
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
            
            if (formatted_name !== frm.doc.status_name) {
                frm.set_value('status_name', formatted_name);
            }
        }
    },
    
    color_code: function(frm) {
        // Apply color preview when color changes
        apply_color_preview(frm);
    },
    
    is_active: function(frm) {
        // Update indicator when active status changes
        set_status_indicator(frm);
        
        // Warn user when deactivating a status
        if (!frm.doc.is_active && !frm.is_new()) {
            frappe.msgprint({
                title: __('Warning'),
                message: __('Deactivating this status will hide it from new Offers Collection entries.'),
                indicator: 'orange'
            });
        }
    }
});

function set_status_indicator(frm) {
    if (frm.doc.is_active) {
        let color = frm.doc.color_code || 'green';
        frm.dashboard.set_headline_alert(
            '<div class="row"><div class="col-xs-12">' +
            `<span class="indicator" style="background-color: ${color}">Active Status</span>` +
            '</div></div>'
        );
    } else {
        frm.dashboard.set_headline_alert(
            '<div class="row"><div class="col-xs-12">' +
            '<span class="indicator red">Inactive Status</span>' +
            '</div></div>'
        );
    }
}

function apply_color_preview(frm) {
    if (frm.doc.color_code) {
        // Add color preview to the status name field
        let color_preview = `
            <div style="
                display: inline-block;
                width: 20px;
                height: 20px;
                background-color: ${frm.doc.color_code};
                border: 1px solid #ccc;
                border-radius: 3px;
                margin-left: 10px;
                vertical-align: middle;
            "></div>
        `;
        
        // Apply to the status name field label
        setTimeout(() => {
            let label = frm.fields_dict.status_name.$wrapper.find('.control-label');
            if (label.length && !label.find('.color-preview').length) {
                label.append(`<span class="color-preview">${color_preview}</span>`);
            }
        }, 100);
    }
}

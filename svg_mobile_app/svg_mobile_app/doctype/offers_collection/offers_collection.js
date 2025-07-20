// Copyright (c) 2025, Smart Vision and contributors
// For license information, please see license.txt

frappe.ui.form.on('Offers Collection', {
    refresh: function(frm) {
        // Add custom buttons or actions here if needed
        frm.add_custom_button(__('Duplicate Offer'), function() {
            frappe.new_doc('Offers Collection', {
                model: frm.doc.model,
                year: frm.doc.year,
                community: frm.doc.community,
                area_ft: frm.doc.area_ft,
                dimensions: frm.doc.dimensions,
                bedroom: frm.doc.bedroom,
                no_of_floors: frm.doc.no_of_floors,
                majlis: frm.doc.majlis,
                family_living: frm.doc.family_living,
                kitchen: frm.doc.kitchen,
                bathrooms: frm.doc.bathrooms,
                maidroom: frm.doc.maidroom,
                laundry: frm.doc.laundry,
                dining_room: frm.doc.dining_room,
                store: frm.doc.store
            });
        });
        
        // Set field colors based on status
        set_field_colors(frm);
    },
    
    area_ft: function(frm) {
        // Auto-calculate area in square meters when area in feet changes
        if (frm.doc.area_ft) {
            frm.set_value('area_sm', frm.doc.area_ft * 0.092903);
        } else {
            frm.set_value('area_sm', 0);
        }
    },
    
    offer_code: function(frm) {
        // Auto-set numeric sort field when offer code changes
        if (frm.doc.offer_code) {
            let numbers = frm.doc.offer_code.match(/\d+/g);
            if (numbers) {
                frm.set_value('numeric_sort_field', parseInt(numbers[0]));
            }
        }
    },
    
    community: function(frm) {
        // You can add community-specific logic here
        // For example, set default pricing based on community
    }
});

function set_field_colors(frm) {
    // Set colors for social media status fields
    const social_fields = [
        'social_2d', 'social_3d_plan', 'social_3d_elevation', 
        'social_interior', 'social_offers', 'social_post', 
        'social_story', 'social_video'
    ];
    
    social_fields.forEach(function(field) {
        let value = frm.doc[field];
        let color = '';
        
        switch(value) {
            case 'Done':
                color = '#28a745'; // Green
                break;
            case 'In Progress':
                color = '#ffc107'; // Yellow
                break;
            case 'Pending':
                color = '#dc3545'; // Red
                break;
            case 'Not Required':
                color = '#6c757d'; // Gray
                break;
        }
        
        if (color) {
            frm.fields_dict[field].$wrapper.find('.control-input').css('background-color', color + '20');
            frm.fields_dict[field].$wrapper.find('.control-input').css('border-color', color);
        }
    });
}

// Refresh field colors when social media fields change
frappe.ui.form.on('Offers Collection', {
    social_2d: function(frm) { set_field_colors(frm); },
    social_3d_plan: function(frm) { set_field_colors(frm); },
    social_3d_elevation: function(frm) { set_field_colors(frm); },
    social_interior: function(frm) { set_field_colors(frm); },
    social_offers: function(frm) { set_field_colors(frm); },
    social_post: function(frm) { set_field_colors(frm); },
    social_story: function(frm) { set_field_colors(frm); },
    social_video: function(frm) { set_field_colors(frm); }
});

# Copyright (c) 2025, Smart Vision and contributors
# For license information, please see license.txt

import frappe

def get_context(context):
    """Get context for the Offers Image Gallery page"""
    context.no_cache = 1
    return context

@frappe.whitelist()
def get_offers_data(filters=None, fields=None, limit_start=0, limit_page_length=20, order_by=None):
    """Get offers data for the gallery with optional filters"""
    try:
        # Default fields if not provided
        if not fields:
            fields = ['name', 'offer_code', 'community', 'model', 'year', 
                     'area_ft', 'area_sm', 'dimensions', 'price_shj', 'price_auh', 'price_dxb',
                     'bedroom', 'majlis', 'family_living', 'kitchen', 'bathrooms', 
                     'maidroom', 'laundry', 'dining_room', 'store', 'no_of_floors',
                     'offer_image', 'status', 'offers_date', 'offer_material_status']
        
        # Default order by numeric sort field
        if not order_by:
            order_by = 'numeric_sort_field desc'
        
        # Get offers data
        offers = frappe.get_list(
            'Offers Collection',
            fields=fields,
            filters=filters,
            limit_start=limit_start,
            limit_page_length=limit_page_length,
            order_by=order_by
        )
        
        return {
            'status': 'success',
            'data': offers
        }
        
    except Exception as e:
        frappe.log_error(f"Error in get_offers_data: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }

@frappe.whitelist()
def get_offers_count(filters=None):
    """Get total count of offers with optional filters"""
    try:
        count = frappe.db.count('Offers Collection', filters=filters)
        return {
            'status': 'success',
            'count': count
        }
    except Exception as e:
        frappe.log_error(f"Error in get_offers_count: {str(e)}")
        return {
            'status': 'error',
            'message': str(e)
        }

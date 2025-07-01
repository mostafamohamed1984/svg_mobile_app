# Copyright (c) 2023, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe import _

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    chart = get_chart(data)
    
    return columns, data, None, chart

def get_columns():
    return [
        {
            "label": _("App Type"),
            "fieldname": "app_type",
            "fieldtype": "Link",
            "options": "App Type",
            "width": 150
        },
        {
            "label": _("Total Remote Access"),
            "fieldname": "total_count",
            "fieldtype": "Int",
            "width": 150
        },
        {
            "label": _("Available"),
            "fieldname": "available_count",
            "fieldtype": "Int",
            "width": 120
        },
        {
            "label": _("Temporarily Assigned"),
            "fieldname": "temporary_count",
            "fieldtype": "Int",
            "width": 180
        },
        {
            "label": _("Reserved"),
            "fieldname": "reserved_count",
            "fieldtype": "Int",
            "width": 120
        },
        {
            "label": _("Expired"),
            "fieldname": "expired_count",
            "fieldtype": "Int",
            "width": 120
        },
        {
            "label": _("Usage Count"),
            "fieldname": "usage_count",
            "fieldtype": "Int",
            "width": 120
        },
        {
            "label": _("Average Duration (Minutes)"),
            "fieldname": "avg_duration",
            "fieldtype": "Float",
            "precision": 2,
            "width": 180
        },
        {
            "label": _("Average Rating"),
            "fieldname": "avg_rating",
            "fieldtype": "Float",
            "precision": 1,
            "width": 120
        }
    ]

def get_data(filters):
    # Get all app types
    app_types = frappe.get_all("App Type", fields=["name1 as app_type"])
    
    # Initialize data dictionary
    data_dict = {}
    for app in app_types:
        app_type = app.app_type
        data_dict[app_type] = {
            "app_type": app_type,
            "total_count": 0,
            "available_count": 0,
            "temporary_count": 0,
            "reserved_count": 0,
            "expired_count": 0,
            "usage_count": 0,
            "total_duration": 0,
            "total_ratings": 0,
            "rating_count": 0
        }
    
    # Get Remote Access counts by app_type and status
    conditions = get_conditions(filters, "Remote Access")
    remote_access_data = frappe.db.sql("""
        SELECT 
            app_type, status, COUNT(*) as count
        FROM 
            `tabRemote Access`
        WHERE 
            {conditions}
        GROUP BY 
            app_type, status
    """.format(conditions=conditions or "1=1"), as_dict=1)
    
    # Process Remote Access data
    for row in remote_access_data:
        app_type = row.app_type
        status = row.status
        count = row.count
        
        if app_type not in data_dict:
            # Handle app types that might be in Remote Access but not in App Type
            data_dict[app_type] = {
                "app_type": app_type,
                "total_count": 0,
                "available_count": 0,
                "temporary_count": 0,
                "reserved_count": 0,
                "expired_count": 0,
                "usage_count": 0,
                "total_duration": 0,
                "total_ratings": 0,
                "rating_count": 0
            }
        
        data_dict[app_type]["total_count"] += count
        
        if status == "Available":
            data_dict[app_type]["available_count"] += count
        elif status == "Temporarily Assigned":
            data_dict[app_type]["temporary_count"] += count
        elif status == "Reserved":
            data_dict[app_type]["reserved_count"] += count
        elif status == "Expired":
            data_dict[app_type]["expired_count"] += count
    
    # Get usage data from Remote Access Log
    log_conditions = get_conditions(filters, "Remote Access Log")
    usage_data = frappe.db.sql("""
        SELECT 
            ra.app_type, 
            COUNT(ral.name) as usage_count,
            SUM(ral.connection_duration) as total_duration,
            SUM(ral.session_rating) as total_rating,
            COUNT(CASE WHEN ral.session_rating > 0 THEN 1 END) as rating_count
        FROM 
            `tabRemote Access Log` ral
        JOIN
            `tabRemote Access` ra ON ral.reference = ra.name
        WHERE 
            {conditions}
        GROUP BY 
            ra.app_type
    """.format(conditions=log_conditions or "1=1"), as_dict=1)
    
    # Process usage data
    for row in usage_data:
        app_type = row.app_type
        if app_type in data_dict:
            data_dict[app_type]["usage_count"] = row.usage_count
            data_dict[app_type]["total_duration"] = row.total_duration or 0
            data_dict[app_type]["total_ratings"] = row.total_rating or 0
            data_dict[app_type]["rating_count"] = row.rating_count or 0
    
    # Calculate averages and prepare final data
    result = []
    for app_type, data in data_dict.items():
        # Calculate average duration
        if data["usage_count"] > 0:
            data["avg_duration"] = round(data["total_duration"] / data["usage_count"], 2)
        else:
            data["avg_duration"] = 0
        
        # Calculate average rating
        if data["rating_count"] > 0:
            data["avg_rating"] = round(data["total_ratings"] / data["rating_count"], 1)
        else:
            data["avg_rating"] = 0
        
        # Remove temporary fields
        del data["total_duration"]
        del data["total_ratings"]
        del data["rating_count"]
        
        result.append(data)
    
    # Sort by total count descending
    result.sort(key=lambda x: x["total_count"], reverse=True)
    
    return result

def get_conditions(filters, doctype):
    conditions = []
    
    if not filters:
        return ""
    
    if filters.get("company"):
        conditions.append("company = %(company)s")
    
    if doctype == "Remote Access" and filters.get("status"):
        conditions.append("status = %(status)s")
    
    if filters.get("from_date") and filters.get("to_date"):
        date_field = "creation" if doctype == "Remote Access" else "connection_start_time"
        conditions.append("{0} BETWEEN %(from_date)s AND %(to_date)s".format(date_field))
    
    return " AND ".join(conditions) if conditions else ""

def get_chart(data):
    if not data:
        return None
    
    labels = [row.get('app_type') for row in data]
    datasets = [
        {
            'name': 'Total Remote Access',
            'values': [row.get('total_count') for row in data]
        },
        {
            'name': 'Usage Count',
            'values': [row.get('usage_count') for row in data]
        }
    ]
    
    chart = {
        "type": "bar",
        "data": {
            "labels": labels,
            "datasets": datasets
        },
        "colors": ["#5e64ff", "#28a745"]
    }
    
    return chart
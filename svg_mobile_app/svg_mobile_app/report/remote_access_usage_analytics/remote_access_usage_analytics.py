# Copyright (c) 2023, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import getdate, add_to_date, nowdate, flt

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    chart = get_chart(data)
    summary = get_summary(data)
    
    return columns, data, None, chart, summary

def get_columns():
    return [
        {
            "label": _("Remote Access"),
            "fieldname": "remote_access",
            "fieldtype": "Link",
            "options": "Remote Access",
            "width": 120
        },
        {
            "label": _("App Type"),
            "fieldname": "app_type",
            "fieldtype": "Link",
            "options": "App Type",
            "width": 120
        },
        {
            "label": _("Log ID"),
            "fieldname": "name",
            "fieldtype": "Link",
            "options": "Remote Access Log",
            "width": 120
        },
        {
            "label": _("User"),
            "fieldname": "user",
            "fieldtype": "Link",
            "options": "User",
            "width": 120
        },
        {
            "label": _("Company"),
            "fieldname": "company",
            "fieldtype": "Link",
            "options": "Company",
            "width": 120
        },
        {
            "label": _("Connection Purpose"),
            "fieldname": "connection_purpose",
            "fieldtype": "Data",
            "width": 150
        },
        {
            "label": _("Start Time"),
            "fieldname": "connection_start_time",
            "fieldtype": "Datetime",
            "width": 150
        },
        {
            "label": _("End Time"),
            "fieldname": "connection_end_time",
            "fieldtype": "Datetime",
            "width": 150
        },
        {
            "label": _("Duration (Minutes)"),
            "fieldname": "connection_duration",
            "fieldtype": "Float",
            "width": 120
        },
        {
            "label": _("Verified"),
            "fieldname": "connection_verified",
            "fieldtype": "Check",
            "width": 80
        },
        {
            "label": _("Rating"),
            "fieldname": "session_rating",
            "fieldtype": "Int",
            "width": 80
        },
        {
            "label": _("Issues"),
            "fieldname": "issues_encountered",
            "fieldtype": "Check",
            "width": 80
        },
        {
            "label": _("Reported By"),
            "fieldname": "usage_reported_by",
            "fieldtype": "Link",
            "options": "User",
            "width": 120
        },
        {
            "label": _("Report Date"),
            "fieldname": "usage_report_date",
            "fieldtype": "Date",
            "width": 100
        }
    ]

def get_data(filters):
    conditions = get_conditions(filters)
    
    # Get Remote Access Log data
    data = frappe.db.sql("""
        SELECT 
            ral.name, ral.reference as remote_access, ral.user, ral.company,
            ral.connection_purpose, ral.connection_start_time, ral.connection_end_time,
            ral.connection_duration, ral.connection_verified, ral.session_rating,
            ral.issues_encountered, ral.usage_reported_by, ral.usage_report_date,
            ra.app_type
        FROM 
            `tabRemote Access Log` ral
        LEFT JOIN
            `tabRemote Access` ra ON ral.reference = ra.name
        WHERE 
            {conditions}
        ORDER BY 
            ral.connection_start_time DESC
    """.format(conditions=conditions or "1=1"), as_dict=1)
    
    return data

def get_conditions(filters):
    conditions = []
    
    if not filters:
        return ""
    
    if filters.get("app_type"):
        conditions.append("ra.app_type = %(app_type)s")
    
    if filters.get("remote_access"):
        conditions.append("ral.reference = %(remote_access)s")
    
    if filters.get("user"):
        conditions.append("ral.user = %(user)s")
    
    if filters.get("company"):
        conditions.append("ral.company = %(company)s")
    
    if filters.get("connection_purpose"):
        conditions.append("ral.connection_purpose = %(connection_purpose)s")
    
    if filters.get("connection_verified"):
        conditions.append("ral.connection_verified = %(connection_verified)s")
    
    if filters.get("issues_encountered"):
        conditions.append("ral.issues_encountered = %(issues_encountered)s")
    
    if filters.get("from_date") and filters.get("to_date"):
        conditions.append("ral.connection_start_time BETWEEN %(from_date)s AND %(to_date)s")
    
    return " AND ".join(conditions) if conditions else ""

def get_chart(data):
    if not data:
        return None
    
    # Group data by app_type
    app_types = {}
    for row in data:
        app_type = row.get('app_type') or 'Not Specified'
        if app_type not in app_types:
            app_types[app_type] = 0
        app_types[app_type] += 1
    
    labels = list(app_types.keys())
    values = list(app_types.values())
    
    chart = {
        "type": "pie",
        "data": {
            "labels": labels,
            "datasets": [
                {
                    "values": values
                }
            ]
        }
    }
    
    return chart

def get_summary(data):
    if not data:
        return None
    
    total_sessions = len(data)
    total_duration = sum(flt(row.get('connection_duration')) for row in data if row.get('connection_duration'))
    avg_duration = total_duration / total_sessions if total_sessions else 0
    verified_sessions = sum(1 for row in data if row.get('connection_verified'))
    issues_count = sum(1 for row in data if row.get('issues_encountered'))
    
    # Calculate average rating
    ratings = [row.get('session_rating') for row in data if row.get('session_rating')]
    avg_rating = sum(ratings) / len(ratings) if ratings else 0
    
    return [
        {
            "label": "Total Sessions",
            "value": total_sessions
        },
        {
            "label": "Total Duration (Minutes)",
            "value": total_duration,
            "indicator": "Blue"
        },
        {
            "label": "Average Duration (Minutes)",
            "value": round(avg_duration, 2),
            "indicator": "Green"
        },
        {
            "label": "Verified Sessions",
            "value": "{0} ({1}%)".format(
                verified_sessions, 
                round(verified_sessions * 100 / total_sessions, 2) if total_sessions else 0
            ),
            "indicator": "Green"
        },
        {
            "label": "Sessions with Issues",
            "value": "{0} ({1}%)".format(
                issues_count, 
                round(issues_count * 100 / total_sessions, 2) if total_sessions else 0
            ),
            "indicator": "Red" if issues_count > 0 else "Green"
        },
        {
            "label": "Average Rating",
            "value": round(avg_rating, 1),
            "indicator": "Blue"
        }
    ]
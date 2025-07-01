# Copyright (c) 2023, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe import _

def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    return columns, data

def get_columns():
    return [
        {
            "label": _("ID"),
            "fieldname": "name",
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
            "label": _("Status"),
            "fieldname": "status",
            "fieldtype": "Data",
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
            "label": _("Assigned To"),
            "fieldname": "assign_to",
            "fieldtype": "Link",
            "options": "User",
            "width": 120
        },
        {
            "label": _("Expiration"),
            "fieldname": "expiration_datetime",
            "fieldtype": "Datetime",
            "width": 150
        },
        {
            "label": _("Auto Expire"),
            "fieldname": "auto_expire",
            "fieldtype": "Check",
            "width": 100
        },
        {
            "label": _("Password Complexity"),
            "fieldname": "password_complexity_level",
            "fieldtype": "Data",
            "width": 150
        },
        {
            "label": _("Created By"),
            "fieldname": "owner",
            "fieldtype": "Link",
            "options": "User",
            "width": 120
        },
        {
            "label": _("Creation Date"),
            "fieldname": "creation",
            "fieldtype": "Datetime",
            "width": 150
        },
        {
            "label": _("Last Modified"),
            "fieldname": "modified",
            "fieldtype": "Datetime",
            "width": 150
        },
        {
            "label": _("Last Modified By"),
            "fieldname": "modified_by",
            "fieldtype": "Link",
            "options": "User",
            "width": 120
        },
        {
            "label": _("Usage Count"),
            "fieldname": "usage_count",
            "fieldtype": "Int",
            "width": 100
        }
    ]

def get_data(filters):
    conditions = get_conditions(filters)
    
    # Get Remote Access data
    remote_access_data = frappe.db.sql("""
        SELECT 
            ra.name, ra.app_type, ra.status, ra.company, ra.assign_to, 
            ra.expiration_datetime, ra.auto_expire, ra.password_complexity_level,
            ra.owner, ra.creation, ra.modified, ra.modified_by
        FROM 
            `tabRemote Access` ra
        WHERE 
            {conditions}
        ORDER BY 
            ra.creation DESC
    """.format(conditions=conditions or "1=1"), as_dict=1)
    
    # Get usage count for each Remote Access
    for row in remote_access_data:
        row['usage_count'] = frappe.db.count('Remote Access Log', {'reference': row.name})
    
    return remote_access_data

def get_conditions(filters):
    conditions = []
    
    if not filters:
        return ""
    
    if filters.get("app_type"):
        conditions.append("ra.app_type = %(app_type)s")
    
    if filters.get("status"):
        conditions.append("ra.status = %(status)s")
    
    if filters.get("company"):
        conditions.append("ra.company = %(company)s")
    
    if filters.get("assign_to"):
        conditions.append("ra.assign_to = %(assign_to)s")
    
    if filters.get("from_date") and filters.get("to_date"):
        conditions.append("ra.creation BETWEEN %(from_date)s AND %(to_date)s")
    
    return " AND ".join(conditions) if conditions else ""
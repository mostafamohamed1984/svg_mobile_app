# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe import _

def execute(filters=None):
    if not filters:
        filters = {}
        
    columns = get_columns()
    data = get_data(filters)
    
    return columns, data

def get_columns():
    return [
        {
            "fieldname": "name",
            "label": _("Task ID"),
            "fieldtype": "Link",
            "options": "Team Tasks",
            "width": 120
        },
        {
            "fieldname": "subject",
            "label": _("Subject"),
            "fieldtype": "Data",
            "width": 200
        },
        {
            "fieldname": "task_type",
            "label": _("Task Type"),
            "fieldtype": "Data",
            "width": 100
        },
        {
            "fieldname": "employee_name",
            "label": _("Assigned To"),
            "fieldtype": "Data",
            "width": 150
        },
        {
            "fieldname": "due_date",
            "label": _("Due Date"),
            "fieldtype": "Date",
            "width": 100
        },
        {
            "fieldname": "status",
            "label": _("Status"),
            "fieldtype": "Data",
            "width": 100
        },
        {
            "fieldname": "paused_since",
            "label": _("Paused Since"),
            "fieldtype": "Date",
            "width": 100
        }
    ]

def get_data(filters):
    conditions = " where is_paused = 1"
    
    if filters.get("task_type"):
        conditions += f" and task_type = '{filters.get('task_type')}'"
    
    if filters.get("employee"):
        conditions += f" and employee = '{filters.get('employee')}'"
    
    if filters.get("status"):
        conditions += f" and status = '{filters.get('status')}'"
    
    # Get paused tasks
    tasks = frappe.db.sql(f"""
        SELECT 
            name, 
            subject, 
            task_type, 
            employee,
            employee_name,
            due_date, 
            status,
            modified as paused_since
        FROM `tabTeam Tasks`
        {conditions}
        ORDER BY modified DESC
    """, as_dict=1)
    
    return tasks 
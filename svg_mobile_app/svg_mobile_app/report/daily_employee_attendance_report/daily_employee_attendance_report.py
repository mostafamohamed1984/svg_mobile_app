# -*- coding: utf-8 -*-
# Copyright (c) 2025, Smart Vision Group and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.utils import getdate, today, formatdate


def execute(filters=None):
    """
    Main function that executes the report
    Returns columns and data for the Daily Employee Attendance Report
    """
    if not filters:
        filters = {}
    
    columns = get_columns()
    data = get_data(filters)
    
    return columns, data


def get_columns():
    """
    Define the columns for the report
    """
    return [
        {
            "label": _("Employee ID"),
            "fieldname": "employee",
            "fieldtype": "Link",
            "options": "Employee",
            "width": 120
        },
        {
            "label": _("Employee Name"),
            "fieldname": "employee_name",
            "fieldtype": "Data",
            "width": 180
        },
        {
            "label": _("Department"),
            "fieldname": "department",
            "fieldtype": "Link",
            "options": "Department",
            "width": 150
        },
        {
            "label": _("Company"),
            "fieldname": "company",
            "fieldtype": "Link",
            "options": "Company",
            "width": 120
        },
        {
            "label": _("First Check-in"),
            "fieldname": "first_checkin",
            "fieldtype": "Time",
            "width": 120
        },
        {
            "label": _("On Leave"),
            "fieldname": "on_leave",
            "fieldtype": "Data",
            "width": 100
        },
        {
            "label": _("Leave Type"),
            "fieldname": "leave_type",
            "fieldtype": "Link",
            "options": "Leave Type",
            "width": 120
        }
    ]


def get_filters():
    """
    Define the filters for the report
    """
    return [
        {
            "fieldname": "date",
            "label": _("Date"),
            "fieldtype": "Date",
            "default": today(),
            "reqd": 1
        },
        {
            "fieldname": "company",
            "label": _("Company"),
            "fieldtype": "Link",
            "options": "Company",
            "default": frappe.defaults.get_user_default("Company")
        },
        {
            "fieldname": "department",
            "label": _("Department"),
            "fieldtype": "Link",
            "options": "Department"
        }
    ]


def get_data(filters):
    """
    Execute the SQL query and return the data
    """
    # Get the date filter, default to today if not provided
    date = filters.get("date") or today()
    
    # Build the WHERE clause based on filters
    conditions = get_conditions(filters)
    
    # Execute the main SQL query (based on your provided query)
    query = """
        SELECT 
            e.name AS employee, 
            e.employee_name, 
            e.department, 
            e.company, 
            IFNULL(TIME(MIN(CASE WHEN c.log_type = 'IN' THEN c.time END)), '') AS first_checkin, 
            CASE WHEN l.name IS NOT NULL THEN 'Yes' ELSE 'No' END AS on_leave, 
            IFNULL(l.leave_type, '') AS leave_type 
        FROM `tabEmployee` e 
        LEFT JOIN `tabEmployee Checkin` c ON e.name = c.employee AND DATE(c.time) = %(date)s
        LEFT JOIN `tabLeave Application` l ON e.name = l.employee 
            AND l.status = 'Approved' 
            AND %(date)s BETWEEN l.from_date AND l.to_date 
        WHERE e.status = 'Active' {conditions}
        GROUP BY e.name, e.employee_name, e.department, e.company, l.name, l.leave_type 
        ORDER BY e.name
    """.format(conditions=conditions)
    
    # Execute the query with parameters
    data = frappe.db.sql(query, {
        "date": date,
        "company": filters.get("company"),
        "department": filters.get("department")
    }, as_dict=1)
    
    return data


def get_conditions(filters):
    """
    Build WHERE clause conditions based on filters
    """
    conditions = []
    
    if filters.get("company"):
        conditions.append("AND e.company = %(company)s")
    
    if filters.get("department"):
        conditions.append("AND e.department = %(department)s")
    
    return " ".join(conditions)


@frappe.whitelist()
def get_report_summary(filters):
    """
    Generate a summary for the report
    """
    if not filters:
        return []
    
    date = filters.get("date") or today()
    company_filter = ""
    if filters.get("company"):
        company_filter = f"AND e.company = '{filters.get('company')}'"
    
    # Get summary statistics
    summary_query = """
        SELECT 
            COUNT(DISTINCT e.name) as total_employees,
            COUNT(DISTINCT CASE WHEN c.employee IS NOT NULL THEN e.name END) as employees_present,
            COUNT(DISTINCT CASE WHEN l.employee IS NOT NULL THEN e.name END) as employees_on_leave,
            COUNT(DISTINCT CASE WHEN c.employee IS NULL AND l.employee IS NULL THEN e.name END) as employees_absent
        FROM `tabEmployee` e 
        LEFT JOIN `tabEmployee Checkin` c ON e.name = c.employee AND DATE(c.time) = %s
        LEFT JOIN `tabLeave Application` l ON e.name = l.employee 
            AND l.status = 'Approved' 
            AND %s BETWEEN l.from_date AND l.to_date 
        WHERE e.status = 'Active' {company_filter}
    """.format(company_filter=company_filter)
    
    summary = frappe.db.sql(summary_query, (date, date), as_dict=1)[0]
    
    return [
        {
            "value": summary.total_employees,
            "label": _("Total Employees"),
            "indicator": "Blue",
            "datatype": "Int"
        },
        {
            "value": summary.employees_present,
            "label": _("Present"),
            "indicator": "Green",
            "datatype": "Int"
        },
        {
            "value": summary.employees_on_leave,
            "label": _("On Leave"),
            "indicator": "Orange",
            "datatype": "Int"
        },
        {
            "value": summary.employees_absent,
            "label": _("Absent"),
            "indicator": "Red",
            "datatype": "Int"
        }
    ] 
# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe import _

def execute(filters=None):
    """
    Main execution function for the Project Expenses Report
    Returns columns and data for the report
    """
    if not filters:
        filters = {}
    
    # Define columns
    columns = [
        {"label": _("Expense Date"), "fieldname": "expense_date", "fieldtype": "Date", "width": 100},
        {"label": _("Expense Type"), "fieldname": "expense_type", "fieldtype": "Link", "options": "Expense Claim Type", "width": 120},
        {"label": _("Description"), "fieldname": "description", "fieldtype": "Data", "width": 200},
        {"label": _("Amount"), "fieldname": "amount", "fieldtype": "Currency", "width": 100},
        {"label": _("Employee"), "fieldname": "employee_name", "fieldtype": "Data", "width": 150},
        {"label": _("Employee ID"), "fieldname": "employee", "fieldtype": "Link", "options": "Employee", "width": 100},
        {"label": _("Expense Claim"), "fieldname": "expense_claim", "fieldtype": "Link", "options": "Expense Claim", "width": 120},
        {"label": _("Project Contractor"), "fieldname": "project_contractor", "fieldtype": "Link", "options": "Project Contractors", "width": 150},
        {"label": _("Posting Date"), "fieldname": "posting_date", "fieldtype": "Date", "width": 100}
    ]
    
    # Get values from filters
    project_contractor = filters.get("project_contractor")
    employee = filters.get("employee")
    expense_type = filters.get("expense_type")
    from_date = filters.get("from_date")
    to_date = filters.get("to_date")
    posting_from_date = filters.get("posting_from_date")
    posting_to_date = filters.get("posting_to_date")
    
    # Build conditions
    conditions = []
    params = {}
    
    # Base conditions
    conditions.append("`tabExpense Claim`.`docstatus` = 1")
    conditions.append("`tabExpense Claim`.`approval_status` = 'Approved'")
    
    # Filter conditions
    if project_contractor:
        conditions.append("`tabExpense Claim Detail`.`for_project` = %(project_contractor)s")
        params["project_contractor"] = project_contractor
    if employee:
        conditions.append("`tabExpense Claim`.`employee` = %(employee)s")
        params["employee"] = employee
    if expense_type:
        conditions.append("`tabExpense Claim Detail`.`expense_type` = %(expense_type)s")
        params["expense_type"] = expense_type
    if from_date:
        conditions.append("`tabExpense Claim Detail`.`expense_date` >= %(from_date)s")
        params["from_date"] = from_date
    if to_date:
        conditions.append("`tabExpense Claim Detail`.`expense_date` <= %(to_date)s")
        params["to_date"] = to_date
    if posting_from_date:
        conditions.append("`tabExpense Claim`.`posting_date` >= %(posting_from_date)s")
        params["posting_from_date"] = posting_from_date
    if posting_to_date:
        conditions.append("`tabExpense Claim`.`posting_date` <= %(posting_to_date)s")
        params["posting_to_date"] = posting_to_date
    
    # Combine conditions
    conditions_str = " AND ".join(conditions) if conditions else "1=1"
    
    # SQL query - Using for_project field from Expense Claim Detail
    sql = f"""
        SELECT
            `tabExpense Claim Detail`.`expense_date`,
            `tabExpense Claim Detail`.`expense_type`,
            `tabExpense Claim Detail`.`description`,
            `tabExpense Claim Detail`.`amount`,
            `tabExpense Claim`.`employee_name`,
            `tabExpense Claim`.`employee`,
            `tabExpense Claim`.`name` AS `expense_claim`,
            `tabExpense Claim Detail`.`for_project` AS `project_contractor`,
            `tabExpense Claim`.`posting_date`
        FROM
            `tabExpense Claim Detail`
        INNER JOIN
            `tabExpense Claim` ON `tabExpense Claim Detail`.`parent` = `tabExpense Claim`.`name`
        WHERE
            {conditions_str}
        ORDER BY
            `tabExpense Claim Detail`.`expense_date` DESC
    """
    
    # Execute query
    data = frappe.db.sql(sql, params, as_dict=True)
    
    return columns, data

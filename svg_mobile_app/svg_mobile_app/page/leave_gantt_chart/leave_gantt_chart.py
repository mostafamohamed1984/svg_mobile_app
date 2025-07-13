import frappe
from frappe import _
from frappe.utils import getdate, add_to_date, now, get_datetime, formatdate
import json

@frappe.whitelist()
def get_leave_gantt_data(filters=None):
    """Get leave application data formatted for Gantt chart display"""
    if filters:
        filters = frappe.parse_json(filters)
    else:
        filters = {}

    # Get date range - default to current year
    from_date = filters.get('from_date')
    to_date = filters.get('to_date')

    if not from_date or not to_date:
        current_year = getdate().year
        from_date = f"{current_year}-01-01"
        to_date = f"{current_year}-12-31"

    # Validate date range
    if getdate(from_date) > getdate(to_date):
        frappe.throw(_("From Date cannot be greater than To Date"))

    # Check for reasonable date range (max 2 years)
    date_diff = (getdate(to_date) - getdate(from_date)).days
    if date_diff > 730:  # 2 years
        frappe.throw(_("Date range cannot exceed 2 years for performance reasons"))

    # Get filters
    company = filters.get('company')
    department = filters.get('department')
    leave_type = filters.get('leave_type')
    status = filters.get('status')
    employee = filters.get('employee')

    # Build conditions for employees
    employee_conditions = []
    employee_params = []

    if company:
        employee_conditions.append("e.company = %s")
        employee_params.append(company)

    if department:
        employee_conditions.append("e.department = %s")
        employee_params.append(department)

    if employee:
        employee_conditions.append("e.name = %s")
        employee_params.append(employee)

    # Build conditions for leave applications
    leave_conditions = []
    leave_params = []

    if company:
        leave_conditions.append("e.company = %s")
        leave_params.append(company)

    if department:
        leave_conditions.append("e.department = %s")
        leave_params.append(department)

    if leave_type:
        leave_conditions.append("la.leave_type = %s")
        leave_params.append(leave_type)

    if status:
        leave_conditions.append("la.status = %s")
        leave_params.append(status)

    if employee:
        leave_conditions.append("la.employee = %s")
        leave_params.append(employee)

    # Format conditions
    employee_where = " AND ".join(employee_conditions) if employee_conditions else ""
    if employee_where:
        employee_where = " AND " + employee_where

    leave_where = " AND ".join(leave_conditions) if leave_conditions else ""
    if leave_where:
        leave_where = " AND " + leave_where

    # Get companies and their employees
    companies_query = """
        SELECT DISTINCT e.company
        FROM `tabEmployee` e
        WHERE e.status = 'Active'
        {}
        ORDER BY e.company
    """.format(employee_where)

    companies = frappe.db.sql(companies_query, tuple(employee_params), as_dict=True)

    # Get employees grouped by company
    employees_query = """
        SELECT
            e.name as employee_id,
            e.employee_name,
            e.department,
            e.company,
            e.designation
        FROM `tabEmployee` e
        WHERE e.status = 'Active'
        {}
        ORDER BY e.company, e.employee_name
    """.format(employee_where)

    employees = frappe.db.sql(employees_query, tuple(employee_params), as_dict=True)
    
    # Get leave applications for the date range
    leave_query = """
        SELECT
            la.name as leave_id,
            la.employee,
            la.employee_name,
            la.from_date,
            la.to_date,
            la.leave_type,
            la.status,
            la.description,
            la.total_leave_days,
            e.company,
            e.department
        FROM `tabLeave Application` la
        LEFT JOIN `tabEmployee` e ON la.employee = e.name
        WHERE la.docstatus != 2
        AND (
            (la.from_date BETWEEN %s AND %s) OR
            (la.to_date BETWEEN %s AND %s) OR
            (la.from_date <= %s AND la.to_date >= %s)
        )
        {}
        ORDER BY la.from_date, la.employee
    """.format(leave_where)

    leave_query_params = [from_date, to_date, from_date, to_date, from_date, to_date] + leave_params
    leaves = frappe.db.sql(leave_query, tuple(leave_query_params), as_dict=True)
    
    # Group employees by company
    companies_data = []
    for company_row in companies:
        company_name = company_row.company
        company_employees = [emp for emp in employees if emp.company == company_name]
        
        companies_data.append({
            'id': f"company_{company_name}",
            'name': company_name,
            'type': 'company',
            'employees': company_employees
        })
    
    # Format leave periods with status colors
    leave_periods = []
    status_colors = {
        'Requested': '#ffc107',      # Yellow
        'Manager Approved': '#17a2b8', # Blue  
        'HR Approved': '#28a745',    # Green
        'Approved': '#28a745',       # Green (legacy status)
        'Rejected': '#dc3545',       # Red
        'Cancelled': '#6c757d'       # Gray
    }
    
    for leave in leaves:
        try:
            # Validate dates
            if not leave.from_date or not leave.to_date:
                continue

            # Ensure from_date is not after to_date
            start_date = leave.from_date
            end_date = leave.to_date

            if start_date > end_date:
                # Swap dates if they're reversed
                start_date, end_date = end_date, start_date

            # Calculate total days if not provided
            total_days = leave.total_leave_days
            if not total_days or total_days <= 0:
                total_days = (end_date - start_date).days + 1

            # Ensure minimum 1 day
            total_days = max(1, total_days)

            leave_periods.append({
                'id': leave.leave_id,
                'employee_id': leave.employee,
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'leave_type': leave.leave_type or 'Unknown',
                'status': leave.status or 'Unknown',
                'description': leave.description or '',
                'total_days': total_days,
                'color': status_colors.get(leave.status, '#6c757d'),
                'employee_name': leave.employee_name or 'Unknown Employee'
            })
        except Exception as e:
            frappe.log_error(f"Error processing leave record {leave.leave_id}: {str(e)}", "Leave Gantt Data Processing")
            continue
    
        return {
            'companies': companies_data,
            'leave_periods': leave_periods,
            'timeline': {
                'start_date': from_date,
                'end_date': to_date,
                'scale_unit': 'month'
            },
            'status_legend': [
                {'status': 'Requested', 'color': '#ffc107', 'label': _('Requested')},
                {'status': 'Manager Approved', 'color': '#17a2b8', 'label': _('Manager Approved')},
                {'status': 'HR Approved', 'color': '#28a745', 'label': _('HR Approved')},
                {'status': 'Approved', 'color': '#28a745', 'label': _('Approved')},
                {'status': 'Rejected', 'color': '#dc3545', 'label': _('Rejected')},
                {'status': 'Cancelled', 'color': '#6c757d', 'label': _('Cancelled')}
            ],
            'summary': {
                'total_companies': len(companies_data),
                'total_employees': len(employees),
                'total_leaves': len(leave_periods),
                'date_range': f"{from_date} to {to_date}"
            }
        }

@frappe.whitelist()
def get_companies():
    """Get list of companies for filter dropdown"""
    companies = frappe.get_all("Company", fields=["name"], order_by="name")
    return [{"value": comp.name, "label": comp.name} for comp in companies]

@frappe.whitelist()
def get_leave_types():
    """Get list of leave types for filter dropdown"""
    leave_types = frappe.get_all("Leave Type", fields=["name"], order_by="name")
    return [{"value": lt.name, "label": lt.name} for lt in leave_types]

@frappe.whitelist()
def get_leave_summary(filters=None):
    """Get leave summary statistics for the dashboard"""
    if filters:
        filters = frappe.parse_json(filters)
    else:
        filters = {}

    # Get date range
    from_date = filters.get('from_date')
    to_date = filters.get('to_date')
    company = filters.get('company')

    if not from_date or not to_date:
        current_year = getdate().year
        from_date = f"{current_year}-01-01"
        to_date = f"{current_year}-12-31"

    # Build conditions
    conditions = []
    params = []

    if company:
        conditions.append("e.company = %s")
        params.append(company)

    leave_conditions = " AND ".join(conditions) if conditions else ""
    if leave_conditions:
        leave_conditions = " AND " + leave_conditions

    # Get summary statistics
    summary_query = """
        SELECT
            COUNT(*) as total_applications,
            SUM(CASE WHEN la.status = 'Requested' THEN 1 ELSE 0 END) as pending_requests,
            SUM(CASE WHEN la.status IN ('HR Approved', 'Approved') THEN 1 ELSE 0 END) as approved_requests,
            SUM(CASE WHEN la.status = 'Rejected' THEN 1 ELSE 0 END) as rejected_requests,
            SUM(CASE WHEN la.status IN ('HR Approved', 'Approved') THEN la.total_leave_days ELSE 0 END) as total_approved_days
        FROM `tabLeave Application` la
        LEFT JOIN `tabEmployee` e ON la.employee = e.name
        WHERE la.docstatus != 2
        AND (
            (la.from_date BETWEEN %s AND %s) OR
            (la.to_date BETWEEN %s AND %s) OR
            (la.from_date <= %s AND la.to_date >= %s)
        )
        {}
    """.format(leave_conditions)

    summary_params = [from_date, to_date, from_date, to_date, from_date, to_date] + params
    summary = frappe.db.sql(summary_query, tuple(summary_params), as_dict=True)[0]

    return summary

@frappe.whitelist()
def export_gantt_data(filters=None):
    """Export Gantt chart data for external use"""
    try:
        data = get_leave_gantt_data(filters)

        # Format for export
        export_data = []
        for company in data['companies']:
            for employee in company['employees']:
                employee_leaves = [leave for leave in data['leave_periods']
                                 if leave['employee_id'] == employee['employee_id']]

                for leave in employee_leaves:
                    export_data.append({
                        'Company': company['name'],
                        'Employee ID': employee['employee_id'],
                        'Employee Name': employee['employee_name'],
                        'Department': employee['department'],
                        'Leave Type': leave['leave_type'],
                        'Start Date': leave['start_date'],
                        'End Date': leave['end_date'],
                        'Total Days': leave['total_days'],
                        'Status': leave['status'],
                        'Description': leave['description']
                    })

        return export_data

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Leave Gantt Export Error")
        frappe.throw(_("Error exporting data: {0}").format(str(e)))

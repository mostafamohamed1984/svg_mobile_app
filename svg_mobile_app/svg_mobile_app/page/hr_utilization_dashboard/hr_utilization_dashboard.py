import frappe
from frappe import _
from frappe.utils import getdate, add_to_date, now, get_datetime, formatdate, today
import json
from datetime import datetime, timedelta
import calendar

@frappe.whitelist()
def get_utilization_data(filters=None):
    """Get HR utilization data formatted for dashboard display"""
    if filters:
        filters = frappe.parse_json(filters)
    else:
        filters = {}

    # Get date range from filters
    from_date = filters.get('from_date')
    to_date = filters.get('to_date')
    year = filters.get('year')
    month = filters.get('month')

    # If year and month are provided, calculate date range
    if year and month and not (from_date and to_date):
        year_int = int(year)
        month_int = int(month)
        from_date = f"{year_int}-{month_int:02d}-01"
        # Get last day of month
        last_day = calendar.monthrange(year_int, month_int)[1]
        to_date = f"{year_int}-{month_int:02d}-{last_day}"

    # If no dates provided, default to current month
    if not from_date or not to_date:
        current_date = datetime.now()
        from_date = current_date.replace(day=1).strftime('%Y-%m-%d')
        last_day = calendar.monthrange(current_date.year, current_date.month)[1]
        to_date = current_date.replace(day=last_day).strftime('%Y-%m-%d')

    # Validate date range
    if getdate(from_date) > getdate(to_date):
        frappe.throw(_("From Date cannot be greater than To Date"))

    # Check for reasonable date range (max 3 months)
    date_diff = (getdate(to_date) - getdate(from_date)).days
    if date_diff > 90:  # 3 months
        frappe.throw(_("Date range cannot exceed 3 months for performance reasons"))

    # Get filters
    company = filters.get('company')
    department = filters.get('department')
    leave_type = filters.get('leave_type')
    status = filters.get('status')
    overtime_status = filters.get('overtime_status')
    shift_status = filters.get('shift_status')
    conflicts_only = filters.get('conflicts_only')
    employee = filters.get('employee')

    try:
        # Get companies and employees
        companies_data = get_companies_and_employees(filters, company, department, employee)
        
        # Get all HR data for the date range
        attendance_data = get_attendance_data(from_date, to_date, company, department, employee)
        leave_data = get_leave_data(from_date, to_date, company, department, leave_type, status, employee)
        shift_data = get_shift_request_data(from_date, to_date, company, department, shift_status, employee)
        overtime_data = get_overtime_request_data(from_date, to_date, company, department, overtime_status, employee)
        
        # Process data and detect conflicts
        processed_data = process_utilization_data(
            companies_data, attendance_data, leave_data, shift_data, overtime_data, from_date, to_date
        )
        
        return {
            'success': True,
            'data': processed_data,
            'date_range': {
                'from_date': from_date,
                'to_date': to_date
            }
        }
        
    except Exception as e:
        frappe.log_error(f"Error in get_utilization_data: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def get_companies_and_employees(filters, company=None, department=None, employee=None):
    """Get companies and their active employees"""
    
    # Build conditions for employees
    conditions = ["e.status = 'Active'"]
    params = []

    if company:
        conditions.append("e.company = %s")
        params.append(company)

    if department:
        conditions.append("e.department = %s")
        params.append(department)

    if employee:
        conditions.append("e.name = %s")
        params.append(employee)

    where_clause = " AND ".join(conditions)

    # Get companies
    companies_query = f"""
        SELECT DISTINCT e.company
        FROM `tabEmployee` e
        WHERE {where_clause}
        ORDER BY e.company
    """
    
    companies = frappe.db.sql(companies_query, tuple(params), as_dict=True)

    # Get employees grouped by company
    employees_query = f"""
        SELECT
            e.name as employee_id,
            e.employee_name,
            e.department,
            e.company,
            e.designation,
            e.default_shift
        FROM `tabEmployee` e
        WHERE {where_clause}
        ORDER BY e.company, e.employee_name
    """

    employees = frappe.db.sql(employees_query, tuple(params), as_dict=True)
    
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
    
    return companies_data

def get_attendance_data(from_date, to_date, company=None, department=None, employee=None):
    """Get employee checkin data for attendance tracking"""
    
    conditions = []
    params = [from_date, to_date]

    if company:
        conditions.append("e.company = %s")
        params.append(company)

    if department:
        conditions.append("e.department = %s")
        params.append(department)

    if employee:
        conditions.append("ec.employee = %s")
        params.append(employee)

    where_clause = " AND ".join(conditions) if conditions else ""
    if where_clause:
        where_clause = " AND " + where_clause

    query = f"""
        SELECT
            ec.employee,
            DATE(ec.time) as attendance_date,
            MIN(CASE WHEN ec.log_type = 'IN' THEN TIME(ec.time) END) as first_checkin,
            MAX(CASE WHEN ec.log_type = 'OUT' THEN TIME(ec.time) END) as last_checkout,
            COUNT(CASE WHEN ec.log_type = 'IN' THEN 1 END) as checkin_count,
            e.company,
            e.department
        FROM `tabEmployee Checkin` ec
        LEFT JOIN `tabEmployee` e ON ec.employee = e.name
        WHERE DATE(ec.time) BETWEEN %s AND %s
        AND e.status = 'Active'
        {where_clause}
        GROUP BY ec.employee, DATE(ec.time), e.company, e.department
        ORDER BY ec.employee, DATE(ec.time)
    """

    return frappe.db.sql(query, tuple(params), as_dict=True)

def get_leave_data(from_date, to_date, company=None, department=None, leave_type=None, status=None, employee=None):
    """Get leave application data"""
    
    conditions = []
    params = [from_date, to_date, from_date, to_date, from_date, to_date]

    if company:
        conditions.append("e.company = %s")
        params.append(company)

    if department:
        conditions.append("e.department = %s")
        params.append(department)

    if leave_type:
        conditions.append("la.leave_type = %s")
        params.append(leave_type)

    if status:
        conditions.append("la.status = %s")
        params.append(status)

    if employee:
        conditions.append("la.employee = %s")
        params.append(employee)

    where_clause = " AND ".join(conditions) if conditions else ""
    if where_clause:
        where_clause = " AND " + where_clause

    query = f"""
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
        AND e.status = 'Active'
        {where_clause}
        ORDER BY la.from_date, la.employee
    """

    return frappe.db.sql(query, tuple(params), as_dict=True)

def get_shift_request_data(from_date, to_date, company=None, department=None, status=None, employee=None):
    """Get shift request data"""
    
    conditions = []
    params = [from_date, to_date, from_date, to_date, from_date, to_date]

    if company:
        conditions.append("e.company = %s")
        params.append(company)

    if department:
        conditions.append("e.department = %s")
        params.append(department)

    if status:
        conditions.append("sr.status = %s")
        params.append(status)

    if employee:
        conditions.append("sr.employee = %s")
        params.append(employee)

    where_clause = " AND ".join(conditions) if conditions else ""
    if where_clause:
        where_clause = " AND " + where_clause

    query = f"""
        SELECT
            sr.name as shift_request_id,
            sr.employee,
            sr.employee_name,
            sr.from_date,
            sr.to_date,
            sr.shift_type,
            sr.status,
            sr.custom_manager_approved_by,
            sr.custom_manager_approved_on,
            e.company,
            e.department
        FROM `tabShift Request` sr
        LEFT JOIN `tabEmployee` e ON sr.employee = e.name
        WHERE sr.docstatus != 2
        AND (
            (sr.from_date BETWEEN %s AND %s) OR
            (sr.to_date BETWEEN %s AND %s) OR
            (sr.from_date <= %s AND sr.to_date >= %s)
        )
        AND e.status = 'Active'
        {where_clause}
        ORDER BY sr.from_date, sr.employee
    """

    return frappe.db.sql(query, tuple(params), as_dict=True)

def get_overtime_request_data(from_date, to_date, company=None, department=None, status=None, employee=None):
    """Get overtime request data"""
    
    conditions = []
    params = [from_date, to_date]

    if company:
        conditions.append("e.company = %s")
        params.append(company)

    if department:
        conditions.append("e.department = %s")
        params.append(department)

    if status:
        conditions.append("ot.status = %s")
        params.append(status)

    if employee:
        conditions.append("ot.employee = %s")
        params.append(employee)

    where_clause = " AND ".join(conditions) if conditions else ""
    if where_clause:
        where_clause = " AND " + where_clause

    query = f"""
        SELECT
            ot.name as overtime_request_id,
            ot.employee,
            ot.employee_name,
            ot.day_of_overtime,
            ot.time_from,
            ot.time_to,
            ot.duration,
            ot.status,
            ot.reason,
            e.company,
            e.department
        FROM `tabOvertime Request` ot
        LEFT JOIN `tabEmployee` e ON ot.employee = e.name
        WHERE ot.docstatus != 2
        AND ot.day_of_overtime BETWEEN %s AND %s
        AND e.status = 'Active'
        {where_clause}
        ORDER BY ot.day_of_overtime, ot.employee
    """

    return frappe.db.sql(query, tuple(params), as_dict=True)

def process_utilization_data(companies_data, attendance_data, leave_data, shift_data, overtime_data, from_date, to_date):
    """Process and format data for frontend consumption"""
    
    # Convert data to dictionaries for faster lookup
    attendance_dict = {}
    for att in attendance_data:
        key = f"{att.employee}_{att.attendance_date}"
        attendance_dict[key] = att

    leave_dict = {}
    for leave in leave_data:
        emp_id = leave.employee
        if emp_id not in leave_dict:
            leave_dict[emp_id] = []
        leave_dict[emp_id].append(leave)

    shift_dict = {}
    for shift in shift_data:
        emp_id = shift.employee
        if emp_id not in shift_dict:
            shift_dict[emp_id] = []
        shift_dict[emp_id].append(shift)

    overtime_dict = {}
    for overtime in overtime_data:
        key = f"{overtime.employee}_{overtime.day_of_overtime}"
        overtime_dict[key] = overtime

    # Generate date range
    start_date = getdate(from_date)
    end_date = getdate(to_date)
    date_list = []
    current_date = start_date
    while current_date <= end_date:
        date_list.append(current_date)
        current_date += timedelta(days=1)

    # Process each company
    processed_companies = []
    for company in companies_data:
        company_conflicts = 0
        processed_employees = []
        
        for employee in company['employees']:
            emp_id = employee.employee_id
            employee_data = {
                'employee_id': emp_id,
                'employee_name': employee.employee_name,
                'department': employee.department,
                'designation': employee.designation,
                'daily_records': [],
                'conflicts': []
            }
            
            # Process each date for this employee
            for date in date_list:
                date_str = date.strftime('%Y-%m-%d')
                daily_record = process_daily_record(
                    emp_id, date, date_str, attendance_dict, leave_dict, shift_dict, overtime_dict
                )
                employee_data['daily_records'].append(daily_record)
                
                # Count conflicts
                if daily_record['conflicts']:
                    employee_data['conflicts'].extend(daily_record['conflicts'])
                    company_conflicts += len(daily_record['conflicts'])
            
            processed_employees.append(employee_data)
        
        processed_companies.append({
            'company_name': company['name'],
            'employee_count': len(processed_employees),
            'conflict_count': company_conflicts,
            'employees': processed_employees
        })
    
    return {
        'companies': processed_companies,
        'date_range': date_list,
        'summary': calculate_summary(processed_companies)
    }

def process_daily_record(emp_id, date, date_str, attendance_dict, leave_dict, shift_dict, overtime_dict):
    """Process a single day record for an employee"""
    
    # Get attendance for this date
    att_key = f"{emp_id}_{date_str}"
    attendance = attendance_dict.get(att_key)
    
    # Check for leave on this date
    leave_on_date = None
    if emp_id in leave_dict:
        for leave in leave_dict[emp_id]:
            if leave.from_date <= date <= leave.to_date:
                leave_on_date = leave
                break
    
    # Check for shift request on this date
    shift_on_date = None
    if emp_id in shift_dict:
        for shift in shift_dict[emp_id]:
            if shift.from_date <= date <= shift.to_date:
                shift_on_date = shift
                break
    
    # Check for overtime request on this date
    ot_key = f"{emp_id}_{date_str}"
    overtime_on_date = overtime_dict.get(ot_key)
    
    # Detect conflicts
    conflicts = detect_daily_conflicts(attendance, leave_on_date, shift_on_date, overtime_on_date, date_str)
    
    return {
        'date': date_str,
        'attendance': attendance,
        'leave': leave_on_date,
        'shift_request': shift_on_date,
        'overtime_request': overtime_on_date,
        'conflicts': conflicts,
        'status_indicators': get_status_indicators(attendance, leave_on_date, shift_on_date, overtime_on_date)
    }

def detect_daily_conflicts(attendance, leave, shift_request, overtime, date_str):
    """Detect conflicts for a single day"""
    conflicts = []
    
    # High Priority Conflicts
    if attendance and leave and leave.status in ['HR Approved', 'Approved']:
        conflicts.append({
            'type': 'attendance_vs_approved_leave',
            'priority': 'high',
            'description': f'Employee attended but has approved leave ({leave.leave_type})',
            'date': date_str
        })
    
    if leave and overtime and leave.status in ['HR Approved', 'Approved'] and overtime.status in ['Approved']:
        conflicts.append({
            'type': 'leave_vs_overtime',
            'priority': 'high',
            'description': f'Employee has approved leave and approved overtime on same date',
            'date': date_str
        })
    
    # Medium Priority Conflicts
    if not attendance and not leave and not shift_request:
        conflicts.append({
            'type': 'unexplained_absence',
            'priority': 'medium',
            'description': 'Employee absent with no leave or shift request',
            'date': date_str
        })
    
    if leave and leave.status == 'Rejected' and not attendance:
        conflicts.append({
            'type': 'rejected_leave_but_absent',
            'priority': 'medium',
            'description': 'Employee absent despite rejected leave request',
            'date': date_str
        })
    
    # Low Priority Conflicts
    if shift_request and shift_request.status == 'Requested' and attendance:
        conflicts.append({
            'type': 'pending_shift_uncertainty',
            'priority': 'low',
            'description': 'Employee attended with pending shift request',
            'date': date_str
        })
    
    return conflicts

def get_status_indicators(attendance, leave, shift_request, overtime):
    """Get visual status indicators for the day"""
    indicators = []
    
    if attendance:
        indicators.append('A')  # Attended
    
    if leave and leave.status in ['HR Approved', 'Approved']:
        indicators.append('L')  # On Leave
    
    if shift_request and shift_request.status in ['Approved']:
        indicators.append('S')  # Shift Request
    
    if overtime and overtime.status in ['Approved']:
        indicators.append('O')  # Overtime
    
    return indicators

def calculate_summary(companies_data):
    """Calculate summary statistics"""
    total_employees = sum(company['employee_count'] for company in companies_data)
    total_conflicts = sum(company['conflict_count'] for company in companies_data)
    
    return {
        'total_employees': total_employees,
        'total_conflicts': total_conflicts,
        'companies_count': len(companies_data),
        'conflict_rate': round((total_conflicts / max(total_employees, 1)) * 100, 2) if total_employees > 0 else 0
    }

@frappe.whitelist()
def get_filter_options():
    """Get available filter options"""
    
    companies = frappe.db.sql("""
        SELECT DISTINCT company FROM `tabEmployee` 
        WHERE status = 'Active' 
        ORDER BY company
    """, as_dict=True)
    
    departments = frappe.db.sql("""
        SELECT DISTINCT department FROM `tabEmployee` 
        WHERE status = 'Active' AND department IS NOT NULL
        ORDER BY department
    """, as_dict=True)
    
    leave_types = frappe.db.sql("""
        SELECT DISTINCT leave_type FROM `tabLeave Application`
        WHERE docstatus != 2
        ORDER BY leave_type
    """, as_dict=True)
    
    return {
        'companies': [c.company for c in companies],
        'departments': [d.department for d in departments],
        'leave_types': [lt.leave_type for lt in leave_types],
        'status_options': ['Requested', 'Manager Approved', 'HR Approved', 'Approved', 'Rejected', 'Cancelled']
    }

@frappe.whitelist()
def get_conflict_details(employee, date):
    """Get detailed conflict information for a specific employee and date"""
    
    try:
        # Get all data for this employee on this date
        filters = {
            'employee': employee,
            'from_date': date,
            'to_date': date
        }
        
        attendance_data = get_attendance_data(date, date, employee=employee)
        leave_data = get_leave_data(date, date, employee=employee)
        shift_data = get_shift_request_data(date, date, employee=employee)
        overtime_data = get_overtime_request_data(date, date, employee=employee)
        
        return {
            'success': True,
            'employee': employee,
            'date': date,
            'attendance': attendance_data,
            'leave': leave_data,
            'shift_requests': shift_data,
            'overtime_requests': overtime_data
        }
        
    except Exception as e:
        frappe.log_error(f"Error in get_conflict_details: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }

def create_daily_record(employee, date_str):
    """Create a daily record with status indicators and conflict detection"""
    try:
        daily_record = {
            'date': date_str,
            'employee_id': employee.get('employee_id'),
            'status_indicators': [],
            'conflicts': [],
            'attendance': None,
            'leave': None,
            'shift_request': None,
            'overtime_request': None
        }
        
        # Check attendance
        attendance = get_attendance_for_date(employee.get('employee_id'), date_str)
        if attendance:
            daily_record['attendance'] = attendance
            daily_record['status_indicators'].append('A')
        
        # Check leave applications
        leave = get_leave_for_date(employee.get('employee_id'), date_str)
        if leave:
            daily_record['leave'] = leave
            daily_record['status_indicators'].append('L')
        
        # Check shift requests
        shift_request = get_shift_request_for_date(employee.get('employee_id'), date_str)
        if shift_request:
            daily_record['shift_request'] = shift_request
            daily_record['status_indicators'].append('S')
        
        # Check overtime requests
        overtime_request = get_overtime_request_for_date(employee.get('employee_id'), date_str)
        if overtime_request:
            daily_record['overtime_request'] = overtime_request
            daily_record['status_indicators'].append('O')
        
        # Detect conflicts
        conflicts = detect_record_conflicts(daily_record)
        daily_record['conflicts'] = conflicts
        
        return daily_record
        
    except Exception as e:
        frappe.log_error(f"Error creating daily record: {str(e)}", "HR Utilization Dashboard")
        return {
            'date': date_str,
            'employee_id': employee.get('employee_id'),
            'status_indicators': [],
            'conflicts': [],
            'attendance': None,
            'leave': None,
            'shift_request': None,
            'overtime_request': None
        }

def get_attendance_for_date(employee_id, date_str):
    """Get attendance data for a specific employee and date"""
    try:
        attendance_data = frappe.db.sql("""
            SELECT 
                MIN(time) as first_checkin,
                MAX(time) as last_checkout,
                COUNT(*) as checkin_count
            FROM `tabEmployee Checkin`
            WHERE employee = %s 
            AND DATE(time) = %s
            AND log_type = 'IN'
            GROUP BY employee, DATE(time)
        """, (employee_id, date_str), as_dict=True)
        
        if attendance_data:
            return attendance_data[0]
        return None
        
    except Exception as e:
        frappe.log_error(f"Error getting attendance: {str(e)}", "HR Utilization Dashboard")
        return None

def get_leave_for_date(employee_id, date_str):
    """Get leave application data for a specific employee and date"""
    try:
        leave_data = frappe.db.sql("""
            SELECT 
                name,
                leave_type,
                from_date,
                to_date,
                status,
                description
            FROM `tabLeave Application`
            WHERE employee = %s 
            AND %s BETWEEN from_date AND to_date
            AND status IN ('Approved', 'Open')
            ORDER BY creation DESC
            LIMIT 1
        """, (employee_id, date_str), as_dict=True)
        
        if leave_data:
            return leave_data[0]
        return None
        
    except Exception as e:
        frappe.log_error(f"Error getting leave data: {str(e)}", "HR Utilization Dashboard")
        return None

def get_shift_request_for_date(employee_id, date_str):
    """Get shift request data for a specific employee and date"""
    try:
        shift_data = frappe.db.sql("""
            SELECT 
                name,
                shift_type,
                from_date,
                to_date,
                status
            FROM `tabShift Request`
            WHERE employee = %s 
            AND %s BETWEEN from_date AND to_date
            AND status IN ('Approved', 'Open')
            ORDER BY creation DESC
            LIMIT 1
        """, (employee_id, date_str), as_dict=True)
        
        if shift_data:
            return shift_data[0]
        return None
        
    except Exception as e:
        frappe.log_error(f"Error getting shift request: {str(e)}", "HR Utilization Dashboard")
        return None

def get_overtime_request_for_date(employee_id, date_str):
    """Get overtime request data for a specific employee and date"""
    try:
        overtime_data = frappe.db.sql("""
            SELECT 
                name,
                duration,
                time_from,
                time_to,
                status,
                reason
            FROM `tabOvertime Request`
            WHERE employee = %s 
            AND DATE(date) = %s
            AND status IN ('Approved', 'Open')
            ORDER BY creation DESC
            LIMIT 1
        """, (employee_id, date_str), as_dict=True)
        
        if overtime_data:
            return overtime_data[0]
        return None
        
    except Exception as e:
        frappe.log_error(f"Error getting overtime request: {str(e)}", "HR Utilization Dashboard")
        return None

def detect_record_conflicts(daily_record):
    """Detect conflicts in a daily record"""
    try:
        conflicts = []
        
        # Conflict 1: Attendance + Leave (High Priority)
        if daily_record['attendance'] and daily_record['leave']:
            if daily_record['leave']['status'] == 'Approved':
                conflicts.append({
                    'type': 'attendance_leave_conflict',
                    'priority': 'high',
                    'description': f"Employee attended work but has approved {daily_record['leave']['leave_type']} leave"
                })
            else:
                conflicts.append({
                    'type': 'attendance_leave_pending',
                    'priority': 'medium',
                    'description': f"Employee attended work with pending {daily_record['leave']['leave_type']} leave request"
                })
        
        # Conflict 2: Leave + Overtime (Medium Priority)
        if daily_record['leave'] and daily_record['overtime_request']:
            conflicts.append({
                'type': 'leave_overtime_conflict',
                'priority': 'medium',
                'description': f"Overtime request during {daily_record['leave']['leave_type']} leave period"
            })
        
        # Conflict 3: Multiple Shift Requests (Low Priority)
        if daily_record['shift_request'] and daily_record['overtime_request']:
            conflicts.append({
                'type': 'shift_overtime_conflict',
                'priority': 'low',
                'description': f"Overtime request with active shift request ({daily_record['shift_request']['shift_type']})"
            })
        
        # Conflict 4: No Attendance but Overtime (Medium Priority)
        if daily_record['overtime_request'] and not daily_record['attendance'] and not daily_record['leave']:
            conflicts.append({
                'type': 'overtime_no_attendance',
                'priority': 'medium',
                'description': f"Overtime request ({daily_record['overtime_request']['duration']} hours) without attendance record"
            })
        
        return conflicts
        
    except Exception as e:
        frappe.log_error(f"Error detecting conflicts: {str(e)}", "HR Utilization Dashboard")
        return []

# Export Functionality
@frappe.whitelist()
def export_utilization_excel(data, options):
    """Export HR Utilization data to Excel format"""
    try:
        import io
        import csv
        from frappe.utils.file_manager import save_file
        
        # Parse data if it's a string
        if isinstance(data, str):
            data = frappe.parse_json(data)
        if isinstance(options, str):
            options = frappe.parse_json(options)
        
        # Create CSV content in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header information
        writer.writerow([data.get('title', 'HR Utilization Dashboard')])
        writer.writerow([f"Period: {data.get('period', 'N/A')}"])
        writer.writerow([f"Generated: {data.get('generated_on', 'N/A')}"])
        writer.writerow([f"Filters: {data.get('filters', 'N/A')}"])
        writer.writerow([])  # Empty row
        
        # Write summary if included
        if options.get('include_summary') and data.get('summary'):
            writer.writerow(['SUMMARY'])
            writer.writerow(['Metric', 'Value'])
            
            for key, value in data.get('summary', {}).items():
                writer.writerow([key.replace('_', ' ').title(), value])
            writer.writerow([])  # Empty row
        
        # Write legend if included
        if options.get('include_legend') and data.get('legend'):
            writer.writerow(['LEGEND'])
            writer.writerow(['Indicator', 'Description'])
            
            for item in data.get('legend', []):
                writer.writerow([item.get('indicator', ''), item.get('description', '')])
            writer.writerow([])  # Empty row
        
        # Write company data
        for company in data.get('companies', []):
            writer.writerow([f"COMPANY: {company.get('name', 'N/A')}"])
            
            # Create headers for employee calendar
            headers = ['Employee ID', 'Employee Name', 'Department']
            
            # Add date headers (assuming first employee has daily records to get dates)
            if company.get('employees') and company['employees'][0].get('daily_records'):
                dates = [record['date'] for record in company['employees'][0]['daily_records']]
                headers.extend(dates)
            
            # Write headers
            writer.writerow(headers)
            
            # Write employee data
            for employee in company.get('employees', []):
                row_data = [
                    employee.get('id', ''),
                    employee.get('name', ''),
                    employee.get('department', '')
                ]
                
                # Write daily status
                for record in employee.get('daily_records', []):
                    status_text = ', '.join(record.get('status_indicators', []))
                    
                    if record.get('has_conflict'):
                        conflict_details = []
                        for conflict in record.get('conflicts', []):
                            conflict_details.append(f"{conflict.get('priority', '')}: {conflict.get('description', '')}")
                        if conflict_details:
                            status_text += f" | Conflicts: {'; '.join(conflict_details)}"
                    
                    row_data.append(status_text)
                
                writer.writerow(row_data)
            
            writer.writerow([])  # Empty row between companies
        
        # Get CSV content
        csv_content = output.getvalue()
        output.close()
        
        # Save file
        filename = f"{options.get('filename', 'HR_Utilization')}.csv"
        file_doc = save_file(filename, csv_content.encode('utf-8'), "File", None, is_private=0)
        
        return {
            'success': True,
            'file_url': file_doc.file_url,
            'filename': filename
        }
        
    except Exception as e:
        frappe.log_error(f"Excel export error: {str(e)}", "HR Utilization Dashboard Export")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def export_utilization_pdf(data, options):
    """Export HR Utilization data to PDF format"""
    try:
        import io
        from frappe.utils.pdf import get_pdf
        from frappe.utils.file_manager import save_file
        
        # Parse data if it's a string
        if isinstance(data, str):
            data = frappe.parse_json(data)
        if isinstance(options, str):
            options = frappe.parse_json(options)
        
        # Generate HTML content for PDF
        html_content = generate_pdf_html(data, options)
        
        # Convert to PDF
        pdf_content = get_pdf(html_content)
        
        # Save file
        filename = f"{options.get('filename', 'HR_Utilization')}.pdf"
        file_doc = save_file(filename, pdf_content, "File", None, is_private=0)
        
        return {
            'success': True,
            'file_url': file_doc.file_url,
            'filename': filename
        }
        
    except Exception as e:
        frappe.log_error(f"PDF export error: {str(e)}", "HR Utilization Dashboard Export")
        return {
            'success': False,
            'error': str(e)
        }

def generate_pdf_html(data, options):
    """Generate HTML content for PDF export"""
    try:
        # Ensure data is a dictionary
        if not isinstance(data, dict):
            data = {}
        if not isinstance(options, dict):
            options = {}
            
        html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>{data.get('title', 'HR Utilization Dashboard')} - {data.get('period', 'N/A')}</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    font-size: 12px;
                }}
                .header {{
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #4472C4;
                    padding-bottom: 20px;
                }}
                .title {{
                    font-size: 24px;
                    font-weight: bold;
                    color: #4472C4;
                    margin-bottom: 10px;
                }}
                .subtitle {{
                    font-size: 16px;
                    color: #666;
                    margin-bottom: 5px;
                }}
                .info {{
                    font-size: 12px;
                    color: #888;
                }}
                .section {{
                    margin-bottom: 30px;
                    page-break-inside: avoid;
                }}
                .section-title {{
                    font-size: 18px;
                    font-weight: bold;
                    color: #4472C4;
                    border-bottom: 1px solid #ccc;
                    padding-bottom: 5px;
                    margin-bottom: 15px;
                }}
                .company-title {{
                    font-size: 16px;
                    font-weight: bold;
                    color: #333;
                    margin-bottom: 10px;
                    background-color: #f8f9fa;
                    padding: 8px;
                    border-left: 4px solid #4472C4;
                }}
                .calendar-table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                    font-size: 10px;
                }}
                .calendar-table th {{
                    background-color: #4472C4;
                    color: white;
                    padding: 8px 4px;
                    text-align: center;
                    border: 1px solid #ddd;
                    font-weight: bold;
                }}
                .calendar-table td {{
                    padding: 6px 4px;
                    text-align: center;
                    border: 1px solid #ddd;
                    vertical-align: middle;
                }}
                .employee-info {{
                    background-color: #f8f9fa;
                    font-weight: bold;
                }}
                .conflict-cell {{
                    background-color: #ffebee;
                    color: #c62828;
                }}
                .status-indicators {{
                    font-weight: bold;
                }}
                .summary-grid {{
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-bottom: 20px;
                }}
                .summary-card {{
                    border: 1px solid #ddd;
                    padding: 15px;
                    border-radius: 5px;
                    background-color: #f8f9fa;
                }}
                .summary-card h4 {{
                    margin: 0 0 10px 0;
                    color: #4472C4;
                }}
                .legend-items {{
                    display: flex;
                    flex-wrap: wrap;
                    gap: 20px;
                }}
                .legend-item {{
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }}
                .legend-indicator {{
                    font-weight: bold;
                    padding: 4px 8px;
                    border-radius: 3px;
                    background-color: #e3f2fd;
                }}
                @media print {{
                    body {{ margin: 0; font-size: 10px; }}
                    .section {{ page-break-inside: avoid; }}
                    .calendar-table {{ font-size: 8px; }}
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">{data.get('title', 'HR Utilization Dashboard')}</div>
                <div class="subtitle">Period: {data.get('period', 'N/A')}</div>
                <div class="info">Generated on: {data.get('generated_on', 'N/A')}</div>
                <div class="info">Filters: {data.get('filters', 'N/A')}</div>
            </div>
        """
        
        # Add summary section
        if options.get('include_summary') and data.get('summary'):
            html += '<div class="section"><div class="section-title">Summary</div><div class="summary-grid">'
            for key, value in data.get('summary', {}).items():
                html += f'<div class="summary-card"><h4>{key.replace("_", " ").title()}</h4><div>{value}</div></div>'
            html += '</div></div>'
        
        # Add legend section
        if options.get('include_legend') and data.get('legend'):
            html += '<div class="section"><div class="section-title">Legend</div><div class="legend-items">'
            for item in data.get('legend', []):
                html += f'<div class="legend-item"><span class="legend-indicator">{item.get("indicator", "")}</span><span>{item.get("description", "")}</span></div>'
            html += '</div></div>'
        
        # Add company data
        for company in data.get('companies', []):
            html += f'<div class="section"><div class="company-title">Company: {company.get("name", "N/A")}</div>'
            
            if company.get('employees'):
                # Create calendar table
                html += '<table class="calendar-table">'
                
                # Table headers
                html += '<thead><tr><th>Employee ID</th><th>Employee Name</th><th>Department</th>'
                
                # Add date headers
                if company.get('employees') and company['employees'][0].get('daily_records'):
                    for record in company['employees'][0]['daily_records']:
                        html += f'<th>{record.get("date", "")}</th>'
                
                html += '</tr></thead><tbody>'
                
                # Employee rows
                for employee in company.get('employees', []):
                    html += f'<tr><td class="employee-info">{employee.get("id", "")}</td>'
                    html += f'<td class="employee-info">{employee.get("name", "")}</td>'
                    html += f'<td class="employee-info">{employee.get("department", "")}</td>'
                    
                    # Daily status cells
                    for record in employee.get('daily_records', []):
                        cell_class = 'conflict-cell' if record.get('has_conflict') else ''
                        status_text = ', '.join(record.get('status_indicators', []))
                        
                        if record.get('has_conflict') and options.get('include_conflicts'):
                            conflict_details = []
                            for conflict in record.get('conflicts', []):
                                conflict_details.append(f"{conflict.get('priority', '')}: {conflict.get('description', '')}")
                            if conflict_details:
                                status_text += f"<br><small>{'; '.join(conflict_details)}</small>"
                        
                        html += f'<td class="{cell_class}"><div class="status-indicators">{status_text}</div></td>'
                    
                    html += '</tr>'
                
                html += '</tbody></table>'
            
            html += '</div>'
        
        html += '</body></html>'
        
        return html
        
    except Exception as e:
        frappe.log_error(f"Error generating PDF HTML: {str(e)}", "HR Utilization Dashboard Export")
        return f"<html><body><h1>Error generating PDF content: {str(e)}</h1></body></html>"

# Conflict Resolution Backend Methods
@frappe.whitelist()
def save_conflict_resolutions(resolved, ignored):
    """Save conflict resolution data"""
    try:
        import json
        
        # Parse JSON strings if needed
        if isinstance(resolved, str):
            resolved = json.loads(resolved)
        if isinstance(ignored, str):
            ignored = json.loads(ignored)
        
        # Create a conflict resolution log entry
        resolution_doc = frappe.get_doc({
            'doctype': 'HR Conflict Resolution Log',
            'resolution_date': frappe.utils.today(),
            'resolved_by': frappe.session.user,
            'resolved_conflicts': len(resolved),
            'ignored_conflicts': len(ignored),
            'total_conflicts': len(resolved) + len(ignored),
            'resolution_data': json.dumps({
                'resolved': resolved,
                'ignored': ignored
            })
        })
        
        # Try to insert, or create a simple log if doctype doesn't exist
        try:
            resolution_doc.insert()
        except frappe.DoesNotExistError:
            # Create a simple log entry if the doctype doesn't exist
            frappe.log_error(
                f"Conflict resolution saved: {len(resolved)} resolved, {len(ignored)} ignored by {frappe.session.user}",
                "HR Conflict Resolution"
            )
        
        return {
            'success': True,
            'message': f'Successfully saved {len(resolved)} resolved and {len(ignored)} ignored conflicts'
        }
        
    except Exception as e:
        frappe.log_error(f"Error saving conflict resolutions: {str(e)}", "HR Utilization Dashboard")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def create_escalation_report(data):
    """Create escalation report for conflicts"""
    try:
        import json
        import io
        from frappe.utils.file_manager import save_file
        from frappe.utils.pdf import get_pdf
        
        # Parse data if needed
        if isinstance(data, str):
            data = json.loads(data)
        
        # Generate HTML content for escalation report
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>HR Conflict Escalation Report</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    margin: 20px;
                    font-size: 12px;
                }}
                .header {{
                    text-align: center;
                    margin-bottom: 30px;
                    border-bottom: 2px solid #dc3545;
                    padding-bottom: 20px;
                }}
                .title {{
                    font-size: 24px;
                    font-weight: bold;
                    color: #dc3545;
                    margin-bottom: 10px;
                }}
                .info {{
                    font-size: 12px;
                    color: #666;
                    margin-bottom: 5px;
                }}
                .summary {{
                    background-color: #fff3cd;
                    border: 1px solid #ffeaa7;
                    padding: 15px;
                    margin-bottom: 20px;
                    border-radius: 5px;
                }}
                .conflict-item {{
                    border: 1px solid #ddd;
                    margin-bottom: 15px;
                    padding: 15px;
                    border-radius: 5px;
                }}
                .conflict-header {{
                    font-weight: bold;
                    color: #333;
                    margin-bottom: 10px;
                    font-size: 14px;
                }}
                .priority-high {{
                    border-left: 4px solid #dc3545;
                    background-color: #f8d7da;
                }}
                .priority-medium {{
                    border-left: 4px solid #ffc107;
                    background-color: #fff3cd;
                }}
                .priority-low {{
                    border-left: 4px solid #28a745;
                    background-color: #d4edda;
                }}
                .conflict-details {{
                    margin-top: 10px;
                }}
                .conflict-details p {{
                    margin: 5px 0;
                }}
                .urgent-notice {{
                    background-color: #f8d7da;
                    border: 2px solid #dc3545;
                    padding: 15px;
                    margin-bottom: 20px;
                    border-radius: 5px;
                    text-align: center;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <div class="title">🚨 HR CONFLICT ESCALATION REPORT</div>
                <div class="info">Generated on: {data['generated_on']}</div>
                <div class="info">Generated by: {data['generated_by']}</div>
                <div class="info">Total Conflicts: {data['total_conflicts']}</div>
            </div>
            
            <div class="urgent-notice">
                <h3>⚠️ URGENT ATTENTION REQUIRED</h3>
                <p>The following conflicts require immediate management attention and resolution.</p>
            </div>
            
            <div class="summary">
                <h3>Executive Summary</h3>
                <p>This report contains {data['total_conflicts']} escalated HR utilization conflicts that require management intervention.</p>
                <p>These conflicts indicate potential issues with:</p>
                <ul>
                    <li>Employee attendance and leave management</li>
                    <li>Shift scheduling and overtime allocation</li>
                    <li>Resource utilization and planning</li>
                    <li>Policy compliance and enforcement</li>
                </ul>
            </div>
        """
        
        # Add conflict details
        for i, conflict in enumerate(data['conflicts'], 1):
            priority_class = f"priority-{conflict['priority']}"
            priority_icon = "🔴" if conflict['priority'] == 'high' else "🟡" if conflict['priority'] == 'medium' else "🟢"
            
            html_content += f"""
            <div class="conflict-item {priority_class}">
                <div class="conflict-header">
                    Conflict #{i}: {conflict['employee_name']} ({conflict['employee_id']})
                </div>
                <div class="conflict-details">
                    <p><strong>Priority:</strong> {priority_icon} {conflict['priority'].upper()}</p>
                    <p><strong>Date:</strong> {conflict['date']}</p>
                    <p><strong>Company:</strong> {conflict['company']}</p>
                    <p><strong>Department:</strong> {conflict['department']}</p>
                    <p><strong>Conflict Type:</strong> {conflict['conflict_type'].replace('_', ' ').title()}</p>
                    <p><strong>Description:</strong> {conflict['description']}</p>
                </div>
            </div>
            """
        
        html_content += """
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ccc;">
                <p><strong>Recommended Actions:</strong></p>
                <ul>
                    <li>Review and resolve high-priority conflicts immediately</li>
                    <li>Investigate patterns in conflict types and departments</li>
                    <li>Update policies and procedures as needed</li>
                    <li>Provide additional training to affected employees and managers</li>
                    <li>Implement preventive measures to avoid future conflicts</li>
                </ul>
            </div>
        </body>
        </html>
        """
        
        # Convert to PDF
        pdf_content = get_pdf(html_content)
        
        # Save file
        filename = f"HR_Conflict_Escalation_{frappe.utils.today()}.pdf"
        file_doc = save_file(filename, pdf_content, "File", None, is_private=0)
        
        return {
            'success': True,
            'file_url': file_doc.file_url,
            'filename': filename
        }
        
    except Exception as e:
        frappe.log_error(f"Error creating escalation report: {str(e)}", "HR Utilization Dashboard")
        return {
            'success': False,
            'error': str(e)
        }

@frappe.whitelist()
def export_conflicts_excel(data):
    """Export conflicts to Excel format"""
    try:
        import json
        import io
        import csv
        from frappe.utils.file_manager import save_file
        
        # Parse data if needed
        if isinstance(data, str):
            data = json.loads(data)
        
        # Create CSV file in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write CSV headers
        writer.writerow(['HR Conflicts Export'])
        writer.writerow([f'Generated on: {frappe.utils.today()}'])
        writer.writerow([f'Total Conflicts: {len(data.get("conflicts", []))}'])
        writer.writerow([])  # Empty row
        
        # Write column headers
        headers = [
            'Company', 'Employee ID', 'Employee Name', 'Department', 
            'Date', 'Priority', 'Conflict Type', 'Description', 'Status'
        ]
        writer.writerow(headers)
        
        # Write conflict data
        for conflict in data.get('conflicts', []):
            row_data = [
                conflict.get('company', ''),
                conflict.get('employee_id', ''),
                conflict.get('employee_name', ''),
                conflict.get('department', ''),
                conflict.get('date', ''),
                conflict.get('priority', '').upper(),
                conflict.get('conflict_type', '').replace('_', ' ').title(),
                conflict.get('description', ''),
                conflict.get('status', 'pending').upper()
            ]
            writer.writerow(row_data)
        
        # Get CSV content
        csv_content = output.getvalue()
        output.close()
        
        # Save file
        filename = f"HR_Conflicts_Export_{frappe.utils.today()}.csv"
        file_doc = save_file(filename, csv_content.encode('utf-8'), "File", None, is_private=0)
        
        return {
            'success': True,
            'file_url': file_doc.file_url,
            'filename': filename
        }
        
    except Exception as e:
        frappe.log_error(f"Error exporting conflicts to Excel: {str(e)}", "HR Utilization Dashboard")
        return {
            'success': False,
            'error': str(e)
        } 
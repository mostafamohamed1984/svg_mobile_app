import frappe
from frappe import _
from frappe.utils import getdate, add_to_date, now, get_datetime

def get_filter_conditions(filters):
    """Generate SQL filter conditions based on provided filters"""
    conditions = ""
    params = []
    
    # Get date range
    from_date = filters.get('from_date')
    to_date = filters.get('to_date')
    
    # Get company filter
    company = filters.get('company')
    if company:
        conditions += " AND company = %s"
        params.append(company)
    
    # Get app type filter
    app_type = filters.get('app_type')
    if app_type:
        conditions += " AND app_type = %s"
        params.append(app_type)
    
    return conditions, params, from_date, to_date

@frappe.whitelist()
def get_summary_data(filters=None):
    filters = frappe.parse_json(filters)
    
    conditions, params, from_date, to_date = get_filter_conditions(filters)
    
    # Get total remote access count
    total_count_query = f"""
        SELECT COUNT(*) as count
        FROM `tabRemote Access`
        WHERE creation BETWEEN %s AND %s
        {conditions}
    """
    total_count_params = [from_date, to_date] + params
    total_count = frappe.db.sql(total_count_query, tuple(total_count_params))[0][0] or 0
    
    # Get active remote access count
    active_count_query = f"""
        SELECT COUNT(*) as count
        FROM `tabRemote Access`
        WHERE status IN ('Available', 'Temporarily Assigned', 'Reserved')
        AND creation BETWEEN %s AND %s
        {conditions}
    """
    active_count_params = [from_date, to_date] + params
    active_count = frappe.db.sql(active_count_query, tuple(active_count_params))[0][0] or 0
    
    # Get expired remote access count
    expired_count_query = f"""
        SELECT COUNT(*) as count
        FROM `tabRemote Access`
        WHERE status = 'Expired'
        AND creation BETWEEN %s AND %s
        {conditions}
    """
    expired_count_params = [from_date, to_date] + params
    expired_count = frappe.db.sql(expired_count_query, tuple(expired_count_params))[0][0] or 0
    
    # Get total usage count
    usage_count_query = f"""
        SELECT COUNT(*) as count
        FROM `tabRemote Access Log` log
        LEFT JOIN `tabRemote Access` ra ON log.reference = ra.name
        WHERE log.creation BETWEEN %s AND %s
        {conditions}
    """
    usage_count_params = [from_date, to_date] + params
    usage_count = frappe.db.sql(usage_count_query, tuple(usage_count_params))[0][0] or 0
    
    # Get average usage duration
    avg_duration_query = f"""
        SELECT AVG(log.connection_duration) as avg_duration
        FROM `tabRemote Access Log` log
        LEFT JOIN `tabRemote Access` ra ON log.reference = ra.name
        WHERE log.connection_duration > 0
        AND log.creation BETWEEN %s AND %s
        {conditions}
    """
    avg_duration_params = [from_date, to_date] + params
    avg_duration = frappe.db.sql(avg_duration_query, tuple(avg_duration_params))[0][0] or 0
    
    return {
        'total_count': total_count,
        'active_count': active_count,
        'expired_count': expired_count,
        'usage_count': usage_count,
        'avg_duration': round(avg_duration, 2) if avg_duration else 0
    }

@frappe.whitelist()
def get_status_distribution(filters=None):
    """Get status distribution data for Remote Access dashboard"""
    filters = frappe.parse_json(filters)
    
    conditions, params, from_date, to_date = get_filter_conditions(filters)
    
    # Get status distribution
    status_query = f"""
        SELECT status, COUNT(*) as count
        FROM `tabRemote Access`
        WHERE creation BETWEEN %s AND %s
        {conditions}
        GROUP BY status
    """
    status_params = [from_date, to_date] + params
    status_data = frappe.db.sql(status_query, tuple(status_params), as_dict=True)
    
    # Format data for chart
    labels = []
    values = []
    colors = []
    
    status_colors = {
        'Available': '#28a745',       # Green
        'Temporarily Assigned': '#17a2b8',  # Blue
        'Reserved': '#ffc107',       # Yellow
        'Expired': '#dc3545'         # Red
    }
    
    for entry in status_data:
        labels.append(entry.status)
        values.append(entry.count)
        colors.append(status_colors.get(entry.status, '#6c757d'))  # Default gray
    
    return {
        'labels': labels,
        'datasets': [{
            'values': values
        }],
        'colors': colors
    }

@frappe.whitelist()
def get_app_distribution(filters=None):
    """Get application type distribution data for Remote Access dashboard"""
    filters = frappe.parse_json(filters)
    
    conditions, params, from_date, to_date = get_filter_conditions(filters)
    
    # Get app type distribution
    app_query = f"""
        SELECT app_type, COUNT(*) as count
        FROM `tabRemote Access`
        WHERE creation BETWEEN %s AND %s
        {conditions}
        GROUP BY app_type
    """
    app_params = [from_date, to_date] + params
    app_data = frappe.db.sql(app_query, tuple(app_params), as_dict=True)
    
    # Format data for chart
    labels = []
    values = []
    
    for entry in app_data:
        labels.append(entry.app_type)
        values.append(entry.count)
    
    return {
        'labels': labels,
        'datasets': [{
            'values': values
        }]
    }

@frappe.whitelist()
def get_usage_analytics(filters=None):
    """Get usage analytics data for Remote Access dashboard"""
    filters = frappe.parse_json(filters)
    
    conditions, params, from_date, to_date = get_filter_conditions(filters)
    
    # Create date range
    date_range = []
    current_date = getdate(from_date)
    end_date = getdate(to_date)
    
    while current_date <= end_date:
        date_range.append(current_date.strftime('%Y-%m-%d'))
        current_date = add_to_date(current_date, days=1)
    
    # Get usage data by day
    usage_query = f"""
        SELECT DATE(log.connection_start_time) as usage_date, COUNT(*) as count
        FROM `tabRemote Access Log` log
        LEFT JOIN `tabRemote Access` ra ON log.reference = ra.name
        WHERE log.connection_start_time >= %s AND log.connection_start_time <= %s
        AND log.connection_start_time IS NOT NULL
        {conditions}
        GROUP BY DATE(log.connection_start_time)
        ORDER BY usage_date
    """
    usage_params = [from_date, to_date] + params
    usage_data = frappe.db.sql(usage_query, tuple(usage_params), as_dict=True)
    
    # Create a dictionary for quick lookup
    usage_dict = {d.usage_date.strftime('%Y-%m-%d'): d.count for d in usage_data}
    
    # Fill in the values for each date
    values = [usage_dict.get(date, 0) for date in date_range]
    
    return {
        'labels': date_range,
        'datasets': [{
            'name': 'Usage Count',
            'values': values
        }]
    }

@frappe.whitelist()
def get_security_metrics(filters=None):
    """Get security metrics data for Remote Access dashboard"""
    filters = frappe.parse_json(filters)
    
    conditions, params, from_date, to_date = get_filter_conditions(filters)
    
    # Get password complexity distribution
    complexity_query = f"""
        SELECT password_complexity_level, COUNT(*) as count
        FROM `tabRemote Access`
        WHERE creation BETWEEN %s AND %s
        AND password_complexity_level IS NOT NULL
        {conditions}
        GROUP BY password_complexity_level
        ORDER BY password_complexity_level
    """
    complexity_params = [from_date, to_date] + params
    complexity_data = frappe.db.sql(complexity_query, tuple(complexity_params), as_dict=True)
    
    # Format data for chart
    labels = []
    values = []
    colors = []
    
    complexity_colors = {
        'Low': '#dc3545',     # Red
        'Medium': '#ffc107',  # Yellow
        'High': '#28a745'     # Green
    }
    
    for entry in complexity_data:
        level = entry.password_complexity_level or 'Not Set'
        labels.append(level)
        values.append(entry.count)
        colors.append(complexity_colors.get(level, '#6c757d'))  # Default gray
    
    return {
        'labels': labels,
        'datasets': [{
            'values': values
        }],
        'colors': colors
    }

# This function is replaced by get_filter_conditions
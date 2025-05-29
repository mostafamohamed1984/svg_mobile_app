import frappe
from frappe.utils import nowdate, today, add_days, add_months, add_to_date

def update_hourly_tasks():
    """Update tasks with task_type = 'Hourly'"""
    current_time = nowdate()
    one_hour_ago = add_to_date(current_time, hours=-1)

    tasks = frappe.get_all(
        'Team Tasks',
        filters={'task_type': 'Hourly', 'due_date': ['<=', one_hour_ago]},
        fields=['name', 'due_date']
    )

    for task in tasks:
        task_doc = frappe.get_doc('Team Tasks', task['name'])
        task_doc.status = 'Open'
        task_doc.due_date = current_time
        task_doc.save()
    
    return len(tasks)

def update_daily_tasks():
    """Update tasks with task_type = 'Daily'"""
    today_date = today()
    
    tasks = frappe.get_all(
        'Team Tasks',
        filters={'task_type': 'Daily'},
        fields=['name']
    )

    for task in tasks:
        task_doc = frappe.get_doc('Team Tasks', task['name'])
        task_doc.status = 'Open'
        task_doc.due_date = today_date
        task_doc.save()
    
    return len(tasks)

def update_weekly_tasks():
    """Update tasks with task_type = 'Weekly' that are due"""
    today_date = today()
    one_week_ago = add_days(today_date, -7)

    tasks = frappe.get_all(
        'Team Tasks',
        filters={'task_type': 'Weekly', 'due_date': ['<=', one_week_ago]},
        fields=['name', 'due_date']
    )

    for task in tasks:
        task_doc = frappe.get_doc('Team Tasks', task['name'])
        task_doc.status = 'Open'
        task_doc.due_date = today_date
        task_doc.save()
    
    return len(tasks)

def update_monthly_tasks():
    """Update tasks with task_type = 'Monthly' that are due"""
    today_date = today()
    one_month_ago = add_months(today_date, -1)

    tasks = frappe.get_all(
        'Team Tasks',
        filters={'task_type': 'Monthly', 'due_date': ['<=', one_month_ago]},
        fields=['name', 'due_date']
    )

    for task in tasks:
        task_doc = frappe.get_doc('Team Tasks', task['name'])
        task_doc.status = 'Open'
        task_doc.due_date = today_date
        task_doc.save()
    
    return len(tasks) 
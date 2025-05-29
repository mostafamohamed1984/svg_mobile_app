import frappe
from frappe.utils import nowdate, today, add_days, add_months, add_to_date

def update_hourly_tasks():
    """Update tasks with task_type = 'Hourly'"""
    current_time = nowdate()
    one_hour_ago = add_to_date(current_time, hours=-1)

    tasks = frappe.get_all(
        'Team Tasks',
        filters={
            'task_type': 'Hourly', 
            'due_date': ['<=', one_hour_ago],
            'is_paused': 0  # Only include tasks that are not paused
        },
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
        filters={
            'task_type': 'Daily', 
            'due_date': ['<', today_date],
            'is_paused': 0  # Only include tasks that are not paused
        },
        fields=['name', 'due_date']
    )
    
    for task in tasks:
        task_doc = frappe.get_doc('Team Tasks', task['name'])
        task_doc.status = 'Open'
        task_doc.due_date = today_date
        task_doc.save()
    
    return len(tasks)

def update_weekly_tasks():
    """Update tasks with task_type = 'weekly'"""
    today_date = today()
    
    tasks = frappe.get_all(
        'Team Tasks',
        filters={
            'task_type': 'weekly', 
            'due_date': ['<', today_date],
            'is_paused': 0  # Only include tasks that are not paused
        },
        fields=['name', 'due_date']
    )
    
    for task in tasks:
        task_doc = frappe.get_doc('Team Tasks', task['name'])
        next_week = add_days(task_doc.due_date, 7)
        
        # If next_week is still in the past, use today
        if next_week < today_date:
            next_week = today_date
            
        task_doc.status = 'Open'
        task_doc.due_date = next_week
        task_doc.save()
    
    return len(tasks)

def update_monthly_tasks():
    """Update tasks with task_type = 'Monthly'"""
    today_date = today()
    
    tasks = frappe.get_all(
        'Team Tasks',
        filters={
            'task_type': 'Monthly', 
            'due_date': ['<', today_date],
            'is_paused': 0  # Only include tasks that are not paused
        },
        fields=['name', 'due_date']
    )
    
    for task in tasks:
        task_doc = frappe.get_doc('Team Tasks', task['name'])
        next_month = add_months(task_doc.due_date, 1)
        
        # If next_month is still in the past, use today
        if next_month < today_date:
            next_month = today_date
            
        task_doc.status = 'Open'
        task_doc.due_date = next_month
        task_doc.save()
    
    return len(tasks) 
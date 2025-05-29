def update_daily_tasks():
    # Fetch all tasks with task_type = 'Daily'
    tasks = frappe.get_all('Team Tasks', filters={'task_type': 'Daily'}, fields=['name'])

    # Update each task's status and due_date
    for task in tasks:
        task_doc = frappe.get_doc('Team Tasks', task['name'])
        task_doc.status = 'Open'
        task_doc.due_date = frappe.utils.today()  # Use frappe.utils.today() directly
        task_doc.save()

# Execute the function
update_daily_tasks()

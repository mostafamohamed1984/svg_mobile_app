def update_hourly_tasks():
    today = frappe.utils.today()
    current_hour = frappe.utils.nowdate()
    one_hour_ago = frappe.utils.add_to_date(current_hour, hours=-1)

    tasks = frappe.get_all(
        'Team Tasks',
        filters={'task_type': 'Hourly', 'due_date': ['<=', one_hour_ago]},
        fields=['name', 'due_date']
    )

    for task in tasks:
        task_doc = frappe.get_doc('Team Tasks', task['name'])
        task_doc.status = 'Open'
        task_doc.due_date = current_hour
        task_doc.save()

update_hourly_tasks() 
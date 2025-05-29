def update_weekly_tasks():
    today = frappe.utils.today()  
    one_week_ago = frappe.utils.add_days(today, -7)  

    tasks = frappe.get_all(
        'Team Tasks', 
        filters={'task_type': 'Weekly', 'due_date': ['<=', one_week_ago]}, 
        fields=['name', 'due_date']
    )

    for task in tasks:
        task_doc = frappe.get_doc('Team Tasks', task['name'])
        task_doc.status = 'Open'  
        task_doc.due_date = today  
        task_doc.save()

update_weekly_tasks()

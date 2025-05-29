frappe.ui.form.on('Project Tasks', {
    after_save: function(frm) {
        // Get all rows in the assigned_tasks child table
        let assigned_tasks = frm.doc.assigned_tasks || [];

        // Filter rows where task_created is 0
        let rows_to_process = assigned_tasks.filter(row => row.task_created === 0);

        if (!rows_to_process.length) {
            frappe.msgprint(__("No tasks to process. All tasks have already been created."));
            return;
        }

        // Counter to track completed tasks
        let completed_tasks = 0;

        // Process each row
        rows_to_process.forEach(row => {
            frappe.call({
                method: 'frappe.client.insert',
                args: {
                    doc: {
                        doctype: "Team Tasks",
                        employee: row.employee,
                        subject: row.subject,
                        task_type: row.task_type,
                        due_date: row.due_date,
                        description: row.description,
                        from_project_task: frm.doc.name
                    },
                    // ignore_permissions: 1 // Ensure permissions are ignored
                },
                freeze: true,
                callback: function(response) {
                    if (response.message) {
                        frappe.msgprint(__("Team Task created successfully for {0}", [row.subject]));
                        // Update task_created to 1
                        frappe.model.set_value(row.doctype, row.name, "task_created", 1);
                        completed_tasks++;

                        // If all tasks are processed, save the form
                        if (completed_tasks === rows_to_process.length) {
                            frm.save(); // Save the form to persist changes
                        }
                    }
                },
                error: function(err) {
                    frappe.msgprint(__("Error creating Team Task for {0}: {1}", [row.subject, err.responseJSON.exc]));
                }
            });
        });
    }
});

// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Project Tasks", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on('Project Tasks', {
    refresh: function(frm) {
        // Show tree view status in the form
        if (frm.doc.is_group) {
            frm.add_custom_button(__('Show Child Tasks'), function() {
                frappe.set_route('List', 'Project Tasks', {parent_project_tasks: frm.doc.name});
            });
        }
        
        if (frm.doc.parent_project_tasks) {
            frm.add_custom_button(__('Go to Parent Task'), function() {
                frappe.set_route('Form', 'Project Tasks', frm.doc.parent_project_tasks);
            });
        }
        
        // Team Tasks management
        frm.add_custom_button(__('Create Team Tasks'), function() {
            create_team_tasks(frm);
        }, __("Team Tasks"));
        
        frm.add_custom_button(__('View Team Tasks'), function() {
            frappe.set_route('List', 'Team Tasks', {from_project_task: frm.doc.name});
        }, __("Team Tasks"));
        
        // Visual indicator of task hierarchy
        if (frm.doc.docstatus !== 2) {
            show_task_hierarchy(frm);
        }
    },
    
    after_save: function(frm) {
        // Refresh the hierarchy display
        show_task_hierarchy(frm);
    }
});

// Function to create team tasks from assigned_tasks child table
function create_team_tasks(frm) {
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
                }
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

// Function to show the task hierarchy visually
function show_task_hierarchy(frm) {
    // Clear any existing hierarchy display
    frm.dashboard.clear_headline();
    
    // Build the hierarchy path
    let hierarchy_path = [];
    let current_task = frm.doc;
    
    // First check if this is a parent with children
    if (current_task.is_group) {
        frm.dashboard.set_headline_alert(
            `<div class="alert alert-info">
                <strong>Group Task:</strong> This is a parent task that can contain child tasks.
                ${current_task.parent_project_tasks ? 
                  `<br><strong>Parent:</strong> ${current_task.parent_project_tasks}` : ''}
            </div>`
        );
    }
    // Check if it has a parent
    else if (current_task.parent_project_tasks) {
        frappe.db.get_value('Project Tasks', current_task.parent_project_tasks, 'subject')
            .then(r => {
                let parent_name = r.message.subject;
                frm.dashboard.set_headline_alert(
                    `<div class="alert alert-info">
                        <strong>Child Task:</strong> This task belongs to 
                        <a href="/app/project-tasks/${current_task.parent_project_tasks}">${parent_name}</a>
                    </div>`
                );
            });
    }
    
    // Check for team tasks
    frappe.db.count('Team Tasks', {
        filters: {
            'from_project_task': frm.doc.name
        }
    }).then(count => {
        if (count > 0) {
            let team_tasks_alert = $(`
                <div class="alert alert-success">
                    <strong>Team Tasks:</strong> This project task has ${count} assigned team tasks.
                    <a href="/app/team-tasks?from_project_task=${frm.doc.name}">View Team Tasks</a>
                </div>
            `);
            frm.dashboard.add_section(team_tasks_alert);
        }
    });
}

// Team Tasks Kanban Configuration
// This will be loaded when the kanban view is opened

frappe.provide("frappe.views");

// Custom handler for Team Tasks Kanban view
frappe.views.TeamTasksKanbanView = class TeamTasksKanbanView extends frappe.views.KanbanView {
    setup() {
        // Call parent setup
        super.setup();
        
        // Ensure we're using status for grouping
        this.board_field = "status";
        
        // Define colors for each status
        this.status_colors = {
            "Open": "blue",
            "Working": "orange", 
            "Pending Review": "purple",
            "Overdue": "red",
            "Completed": "green",
            "Cancelled": "gray"
        };
    }
    
    get_board_field_options() {
        // These are the column options for the Kanban board
        return [
            "Open", 
            "Working", 
            "Pending Review", 
            "Overdue", 
            "Completed", 
            "Cancelled"
        ];
    }
    
    setup_view() {
        // Call parent setup_view
        super.setup_view();
        
        // Add task type filter
        this.page.add_field({
            fieldtype: 'Select',
            fieldname: 'task_type_filter',
            label: 'Task Type',
            options: '\nHourly\nDaily\nweekly\nMonthly\nAssigned',
            change: () => {
                const task_type = this.page.fields_dict.task_type_filter.get_value();
                if (task_type) {
                    this.filter_area.add([[this.doctype, 'task_type', '=', task_type]]);
                } else {
                    this.filter_area.clear();
                }
                this.refresh();
            }
        });
    }
}

// Register our custom Kanban view for Team Tasks
frappe.views.view_registry.add('team_tasks_kanban', 'TeamTasksKanbanView');

// Set default view to our custom Kanban
frappe.router.on('list/Team Tasks', () => {
    if (frappe.views.Team_TasksListView.prototype.view_name === 'List') {
        frappe.set_route('list/Team Tasks/team_tasks_kanban');
    }
}); 
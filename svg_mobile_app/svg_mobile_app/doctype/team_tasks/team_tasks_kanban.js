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
        
        // Add priority filter
        this.page.add_field({
            fieldtype: 'Select',
            fieldname: 'priority_filter',
            label: 'Priority',
            options: '\nLow\nMedium\nHigh\nUrgent',
            change: () => {
                const priority = this.page.fields_dict.priority_filter.get_value();
                if (priority) {
                    this.filter_area.add([[this.doctype, 'priority', '=', priority]]);
                } else {
                    this.filter_area.remove(this.doctype, 'priority');
                }
                this.refresh();
            }
        });
    }
    
    // Override the render_card method to customize card appearance
    get_card_html(card) {
        let html = super.get_card_html(card);
        let $card = $(html);
        
        // Add a container for the additional info
        let $info = $(`<div class="kanban-card-custom-info" style="margin-top: 10px; font-size: 12px;"></div>`);
        
        // Add employee name if available
        if (card.employee_name) {
            $info.append(`
                <div style="margin-bottom: 5px;">
                    <i class="fa fa-user" style="margin-right: 5px; color: #6c757d;"></i>
                    <span style="font-weight: 500;">${card.employee_name}</span>
                </div>
            `);
        }
        
        // Add due date with color coding if available
        if (card.due_date) {
            const due = new Date(card.due_date);
            const today = new Date();
            const diffTime = due - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            let dueDateClass = '';
            let dueDateText = '';
            
            if (diffDays < 0) {
                dueDateClass = 'text-danger';
                dueDateText = `Overdue (${Math.abs(diffDays)} days)`;
            } else if (diffDays === 0) {
                dueDateClass = 'text-warning';
                dueDateText = 'Due Today';
            } else if (diffDays <= 3) {
                dueDateClass = 'text-warning';
                dueDateText = `Due in ${diffDays} days`;
            } else {
                dueDateText = `Due: ${frappe.datetime.str_to_user(card.due_date)}`;
            }
            
            $info.append(`
                <div style="margin-bottom: 5px;">
                    <i class="fa fa-calendar" style="margin-right: 5px; color: #6c757d;"></i>
                    <span class="${dueDateClass}">${dueDateText}</span>
                </div>
            `);
        }
        
        // Add priority badge if available
        if (card.priority) {
            let priorityColor = '';
            switch(card.priority) {
                case 'Urgent': priorityColor = '#dc3545'; break;
                case 'High': priorityColor = '#fd7e14'; break;
                case 'Medium': priorityColor = '#0d6efd'; break;
                case 'Low': priorityColor = '#198754'; break;
                default: priorityColor = '#6c757d';
            }
            
            $info.append(`
                <div style="margin-bottom: 5px;">
                    <i class="fa fa-flag" style="margin-right: 5px; color: #6c757d;"></i>
                    <span class="badge" style="background-color: ${priorityColor}; color: white; font-size: 10px; padding: 3px 6px;">
                        ${card.priority}
                    </span>
                </div>
            `);
        }
        
        // Append the info container to the card
        $card.find('.kanban-card-body').append($info);
        
        return $card.prop('outerHTML');
    }
}

// Register our custom Kanban view for Team Tasks
frappe.views.view_registry.add('team_tasks_kanban', 'TeamTasksKanbanView');

// Set default view to our custom Kanban
frappe.router.on('list/Team Tasks', () => {
    if (frappe.views.Team_TasksListView && frappe.views.Team_TasksListView.prototype.view_name === 'List') {
        frappe.set_route('list/Team Tasks/team_tasks_kanban');
    }
});

// Override the standard Kanban view for Team Tasks
frappe.provide("frappe.views.KanbanViewFactory");
const originalViewClass = frappe.views.KanbanViewFactory;

frappe.views.KanbanViewFactory = function(doctype) {
    if (doctype === "Team Tasks") {
        return frappe.views.TeamTasksKanbanView;
    }
    return originalViewClass(doctype);
}; 
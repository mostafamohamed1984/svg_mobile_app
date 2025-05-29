frappe.pages['task-assignment-view'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Task Assignment View',
        single_column: true
    });

    // Add filters
    page.add_field({
        fieldtype: 'Link',
        fieldname: 'project_task',
        label: __('Project Task'),
        options: 'Project Tasks',
        change: function() {
            task_assignment_view.load_data();
        }
    });
    
    page.add_field({
        fieldtype: 'Select',
        fieldname: 'task_status',
        label: __('Status'),
        options: '\nOpen\nWorking\nPending Review\nOverdue\nCompleted\nCancelled',
        change: function() {
            task_assignment_view.load_data();
        }
    });

    // Initialize the task assignment view
    frappe.task_assignment_view = new TaskAssignmentView(page);
};

// Task Assignment View Class
class TaskAssignmentView {
    constructor(page) {
        this.page = page;
        this.make();
        this.load_data();
    }

    make() {
        // Create sections for hierarchy display
        this.$hierarchy_container = $('<div class="task-hierarchy-container">').appendTo(this.page.main);
        
        // Create the layout structure
        this.$hierarchy_container.html(`
            <div class="task-view-container">
                <div class="project-tasks-tree"></div>
                <div class="team-tasks-container"></div>
            </div>
        `);
        
        // Style the container
        this.$hierarchy_container.css({
            'padding': '15px',
            'background-color': '#f5f7fa',
            'border-radius': '8px',
            'margin-top': '20px'
        });
        
        $('.task-view-container').css({
            'display': 'flex',
            'flex-direction': 'row',
            'gap': '20px'
        });
        
        $('.project-tasks-tree, .team-tasks-container').css({
            'flex': '1',
            'background': 'white',
            'padding': '15px',
            'border-radius': '8px',
            'box-shadow': '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)'
        });
    }

    load_data() {
        let me = this;
        let project_task = me.page.fields_dict.project_task.get_value();
        let task_status = me.page.fields_dict.task_status.get_value();
        
        // Show loading state
        me.$hierarchy_container.find('.project-tasks-tree').html('<div class="text-muted">Loading project tasks...</div>');
        me.$hierarchy_container.find('.team-tasks-container').html('<div class="text-muted">Loading team tasks...</div>');
        
        // Load project tasks in tree view
        this.load_project_tasks(project_task)
            .then(() => {
                // After project tasks are loaded, load team tasks
                return this.load_team_tasks(project_task, task_status);
            })
            .catch(err => {
                console.error("Error loading task data:", err);
                frappe.msgprint(__("Error loading task data. Please try again."));
            });
    }
    
    load_project_tasks(parent_task) {
        let me = this;
        let $tree_container = me.$hierarchy_container.find('.project-tasks-tree');
        
        return new Promise((resolve, reject) => {
            // Fetch project tasks
            let filters = {};
            if (parent_task) {
                filters.name = parent_task;
            } else {
                filters.is_group = 1;
            }
            
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Project Tasks',
                    fields: ['name', 'subject', 'status', 'priority', 'is_group', 'parent_project_tasks'],
                    filters: filters,
                    limit: 100
                },
                callback: function(r) {
                    if (r.message) {
                        $tree_container.empty();
                        $tree_container.append('<h5 class="text-muted">Project Tasks</h5>');
                        
                        // Create a tree structure
                        let $tree = $('<div class="project-task-tree"></div>').appendTo($tree_container);
                        
                        // Build the tree
                        me.build_task_tree($tree, r.message, parent_task);
                        resolve();
                    } else {
                        $tree_container.html('<div class="text-muted">No project tasks found</div>');
                        resolve();
                    }
                },
                error: function(err) {
                    reject(err);
                }
            });
        });
    }
    
    build_task_tree($container, tasks, parent_task) {
        let me = this;
        
        // If a specific parent task is selected, we need to fetch its ancestors
        if (parent_task) {
            this.build_task_hierarchy($container, parent_task);
        }
        
        // Create a task list
        let $task_list = $('<ul class="task-list">').appendTo($container);
        
        // Add each task as a node
        tasks.forEach(task => {
            let $task_node = $(`
                <li class="task-node" data-task="${task.name}">
                    <div class="task-header">
                        <span class="task-indicator ${this.get_status_class(task.status)}"></span>
                        <span class="task-title">${task.subject || task.name}</span>
                        <span class="task-priority ${this.get_priority_class(task.priority)}">${task.priority || 'None'}</span>
                    </div>
                    <div class="task-controls">
                        ${task.is_group ? '<button class="btn btn-xs btn-default view-children">View Children</button>' : ''}
                        <button class="btn btn-xs btn-info view-team-tasks">View Team Tasks</button>
                    </div>
                </li>
            `).appendTo($task_list);
            
            // Add event handlers
            $task_node.find('.view-children').on('click', function() {
                me.load_child_tasks(task.name, $task_node);
            });
            
            $task_node.find('.view-team-tasks').on('click', function() {
                me.load_team_tasks(task.name);
            });
        });
        
        // Add styles
        $container.find('.task-list').css({
            'list-style': 'none',
            'padding-left': '20px'
        });
        
        $container.find('.task-node').css({
            'margin': '10px 0',
            'padding': '10px',
            'border-radius': '4px',
            'background': '#f9f9f9',
            'border-left': '3px solid #ccc'
        });
        
        $container.find('.task-header').css({
            'display': 'flex',
            'align-items': 'center',
            'margin-bottom': '5px'
        });
        
        $container.find('.task-indicator').css({
            'display': 'inline-block',
            'width': '10px',
            'height': '10px',
            'border-radius': '50%',
            'margin-right': '10px'
        });
        
        $container.find('.task-title').css({
            'flex-grow': '1',
            'font-weight': 'bold'
        });
        
        $container.find('.task-priority').css({
            'padding': '2px 6px',
            'border-radius': '10px',
            'font-size': '0.8em',
            'margin-left': '10px'
        });
        
        $container.find('.task-controls').css({
            'display': 'flex',
            'gap': '5px'
        });
    }
    
    load_child_tasks(parent_task, $parent_node) {
        let me = this;
        
        // Check if children are already loaded
        if ($parent_node.find('.child-tasks').length) {
            $parent_node.find('.child-tasks').toggle();
            return;
        }
        
        // Add a loading indicator
        let $loading = $('<div class="text-muted">Loading child tasks...</div>').appendTo($parent_node);
        
        // Fetch child tasks
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Project Tasks',
                fields: ['name', 'subject', 'status', 'priority', 'is_group'],
                filters: {
                    parent_project_tasks: parent_task
                },
                limit: 100
            },
            callback: function(r) {
                $loading.remove();
                
                if (r.message && r.message.length) {
                    // Create a container for child tasks
                    let $child_container = $('<div class="child-tasks">').appendTo($parent_node);
                    
                    // Build tree for child tasks
                    me.build_task_tree($child_container, r.message);
                } else {
                    $parent_node.append('<div class="text-muted child-tasks">No child tasks found</div>');
                }
            }
        });
    }
    
    build_task_hierarchy($container, task_id) {
        // This function would build the hierarchy path for a specific task
        // (implementation would be similar to showing parents of parents)
        let $hierarchy = $('<div class="task-hierarchy">').appendTo($container);
        
        // Load the task hierarchy recursively
        this.load_task_hierarchy(task_id, $hierarchy);
    }
    
    load_task_hierarchy(task_id, $container) {
        let me = this;
        
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Project Tasks',
                name: task_id
            },
            callback: function(r) {
                if (r.message) {
                    let task = r.message;
                    
                    // Add this task to the hierarchy
                    let $task_path = $(`
                        <div class="hierarchy-item">
                            <span class="task-indicator ${me.get_status_class(task.status)}"></span>
                            <span class="task-title">${task.subject || task.name}</span>
                        </div>
                    `).prependTo($container);
                    
                    // If it has a parent, load that too
                    if (task.parent_project_tasks) {
                        me.load_task_hierarchy(task.parent_project_tasks, $container);
                    }
                }
            }
        });
    }
    
    load_team_tasks(project_task, status) {
        let me = this;
        let $team_container = me.$hierarchy_container.find('.team-tasks-container');
        
        return new Promise((resolve, reject) => {
            // Build filters
            let filters = {};
            if (project_task) {
                filters.from_project_task = project_task;
            }
            if (status) {
                filters.status = status;
            }
            
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Team Tasks',
                    fields: ['name', 'subject', 'employee', 'employee_name', 'status', 'priority', 'task_type', 'due_date'],
                    filters: filters,
                    limit: 100
                },
                callback: function(r) {
                    $team_container.empty();
                    $team_container.append('<h5 class="text-muted">Team Tasks</h5>');
                    
                    if (r.message && r.message.length) {
                        // Group tasks by type
                        let task_groups = {};
                        
                        r.message.forEach(task => {
                            let type = task.task_type || 'Unassigned';
                            if (!task_groups[type]) {
                                task_groups[type] = [];
                            }
                            task_groups[type].push(task);
                        });
                        
                        // Create task cards by type
                        Object.keys(task_groups).forEach(type => {
                            let $type_container = $(`
                                <div class="task-type-container">
                                    <h6>${type}</h6>
                                    <div class="task-cards"></div>
                                </div>
                            `).appendTo($team_container);
                            
                            let $cards_container = $type_container.find('.task-cards');
                            
                            task_groups[type].forEach(task => {
                                let $task_card = $(`
                                    <div class="task-card ${me.get_status_class(task.status)}">
                                        <div class="task-card-header">
                                            <span class="task-title">${task.subject || task.name}</span>
                                            <span class="task-priority ${me.get_priority_class(task.priority)}">${task.priority || 'None'}</span>
                                        </div>
                                        <div class="task-card-body">
                                            <div><strong>Assigned to:</strong> ${task.employee_name || task.employee || 'Unassigned'}</div>
                                            <div><strong>Due date:</strong> ${task.due_date || 'Not set'}</div>
                                            <div><strong>Status:</strong> ${task.status || 'Unknown'}</div>
                                        </div>
                                        <div class="task-card-footer">
                                            <a href="/app/team-tasks/${task.name}" class="btn btn-xs btn-default">View Task</a>
                                        </div>
                                    </div>
                                `).appendTo($cards_container);
                            });
                        });
                        
                        // Add styles
                        $team_container.find('.task-type-container').css({
                            'margin-bottom': '20px'
                        });
                        
                        $team_container.find('.task-cards').css({
                            'display': 'grid',
                            'grid-template-columns': 'repeat(auto-fill, minmax(250px, 1fr))',
                            'gap': '15px'
                        });
                        
                        $team_container.find('.task-card').css({
                            'background': 'white',
                            'border-radius': '4px',
                            'box-shadow': '0 1px 3px rgba(0,0,0,0.12)',
                            'padding': '10px',
                            'border-top': '3px solid #ccc'
                        });
                        
                        $team_container.find('.task-card-header').css({
                            'display': 'flex',
                            'justify-content': 'space-between',
                            'margin-bottom': '10px',
                            'padding-bottom': '5px',
                            'border-bottom': '1px solid #eee'
                        });
                        
                        $team_container.find('.task-card-body').css({
                            'font-size': '0.9em',
                            'margin-bottom': '10px'
                        });
                        
                        $team_container.find('.task-card-footer').css({
                            'text-align': 'right'
                        });
                        
                        // Color task cards by status
                        $team_container.find('.task-card.status-open').css('border-top-color', '#5e64ff');
                        $team_container.find('.task-card.status-working').css('border-top-color', '#ff8300');
                        $team_container.find('.task-card.status-pending').css('border-top-color', '#9c59b8');
                        $team_container.find('.task-card.status-overdue').css('border-top-color', '#ff5858');
                        $team_container.find('.task-card.status-completed').css('border-top-color', '#28a745');
                        $team_container.find('.task-card.status-cancelled').css('border-top-color', '#aaa');
                    } else {
                        $team_container.append('<div class="text-muted">No team tasks found</div>');
                    }
                    
                    resolve();
                },
                error: function(err) {
                    reject(err);
                }
            });
        });
    }
    
    get_status_class(status) {
        if (!status) return '';
        
        status = status.toLowerCase();
        if (status === 'open') return 'status-open';
        if (status === 'working') return 'status-working';
        if (status === 'pending review') return 'status-pending';
        if (status === 'overdue') return 'status-overdue';
        if (status === 'completed') return 'status-completed';
        if (status === 'cancelled') return 'status-cancelled';
        
        return '';
    }
    
    get_priority_class(priority) {
        if (!priority) return '';
        
        priority = priority.toLowerCase();
        if (priority === 'low') return 'priority-low';
        if (priority === 'medium') return 'priority-medium';
        if (priority === 'high') return 'priority-high';
        if (priority === 'urgent') return 'priority-urgent';
        
        return '';
    }
} 
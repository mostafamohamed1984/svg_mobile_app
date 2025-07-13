frappe.pages['leave-gantt-chart'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Leave Gantt Chart',
        single_column: true
    });

    // Add CSS class for styling
    $(wrapper).addClass('leave-gantt-chart-wrapper');

    // Initialize the Gantt chart
    frappe.leave_gantt_chart = new LeaveGanttChart(page);
};

frappe.pages['leave-gantt-chart'].on_page_show = function() {
    // Refresh chart when page is shown
    if(frappe.leave_gantt_chart) {
        frappe.leave_gantt_chart.refresh();
    }
};

class LeaveGanttChart {
    constructor(page) {
        this.page = page;
        this.gantt = null;
        this.current_filters = {};
        this.make();
        this.setup_filters();
        this.load_dhtmlx_gantt();
    }

    make() {
        // Create main container
        this.body = $('<div class="leave-gantt-container"></div>').appendTo(this.page.main);
        
        // Create filter section
        this.filter_section = $('<div class="gantt-filters-section"></div>').appendTo(this.body);
        
        // Create legend section
        this.legend_section = $('<div class="gantt-legend-section"></div>').appendTo(this.body);
        
        // Create Gantt chart container
        this.gantt_container = $('<div id="gantt_here" class="gantt-chart-container"></div>').appendTo(this.body);
        
        // Set initial height
        this.gantt_container.css('height', '600px');
    }

    setup_filters() {
        // Add refresh button
        this.page.set_primary_action('Refresh', () => this.refresh(), 'refresh');
        
        // Add print button
        this.page.add_action_item('Print', () => this.print_chart(), 'print');
        
        // Add export buttons
        this.page.add_action_item('Export PDF', () => this.export_pdf(), 'download');
        this.page.add_action_item('Export Excel', () => this.export_excel(), 'download');

        // Create filter fields
        const current_year = new Date().getFullYear();
        
        // Year filter
        this.page.add_field({
            label: 'Year',
            fieldtype: 'Select',
            fieldname: 'year',
            options: this.get_year_options(),
            default: current_year.toString(),
            change: () => this.on_filter_change()
        });

        // Company filter
        this.page.add_field({
            label: 'Company',
            fieldtype: 'Link',
            fieldname: 'company',
            options: 'Company',
            change: () => this.on_filter_change()
        });

        // Date range fields
        this.page.add_field({
            label: 'From Date',
            fieldtype: 'Date',
            fieldname: 'from_date',
            default: `${current_year}-01-01`,
            change: () => this.on_filter_change()
        });

        this.page.add_field({
            label: 'To Date',
            fieldtype: 'Date',
            fieldname: 'to_date',
            default: `${current_year}-12-31`,
            change: () => this.on_filter_change()
        });

        // Department filter
        this.page.add_field({
            label: 'Department',
            fieldtype: 'Link',
            fieldname: 'department',
            options: 'Department',
            change: () => this.on_filter_change()
        });

        // Leave Type filter
        this.page.add_field({
            label: 'Leave Type',
            fieldtype: 'Link',
            fieldname: 'leave_type',
            options: 'Leave Type',
            change: () => this.on_filter_change()
        });

        // Status filter
        this.page.add_field({
            label: 'Status',
            fieldtype: 'Select',
            fieldname: 'status',
            options: '\nRequested\nManager Approved\nHR Approved\nApproved\nRejected\nCancelled',
            change: () => this.on_filter_change()
        });

        // Employee filter
        this.page.add_field({
            label: 'Employee',
            fieldtype: 'Link',
            fieldname: 'employee',
            options: 'Employee',
            change: () => this.on_filter_change()
        });

        // Add clear filters button
        this.page.add_action_item('Clear Filters', () => this.clear_filters(), 'refresh');

        // Add search functionality
        this.setup_search();
    }

    get_year_options() {
        const current_year = new Date().getFullYear();
        const years = [];
        for (let i = current_year - 2; i <= current_year + 2; i++) {
            years.push(i.toString());
        }
        return years.join('\n');
    }

    on_filter_change() {
        // Update date range when year changes
        const year_field = this.page.fields_dict.year;
        const from_date_field = this.page.fields_dict.from_date;
        const to_date_field = this.page.fields_dict.to_date;

        if (year_field && year_field.get_value()) {
            const year = year_field.get_value();
            from_date_field.set_value(`${year}-01-01`);
            to_date_field.set_value(`${year}-12-31`);
        }

        // Refresh chart with new filters
        this.refresh();
    }

    setup_search() {
        // Add search input to filter section
        const search_html = `
            <div class="search-container" style="margin-top: 10px;">
                <input type="text" class="form-control" placeholder="Search employees..."
                       id="employee-search" style="width: 250px; display: inline-block;">
                <button class="btn btn-default" id="search-btn" style="margin-left: 5px;">
                    <i class="fa fa-search"></i>
                </button>
            </div>
        `;

        this.filter_section.append(search_html);

        // Add search functionality
        $('#employee-search').on('input', (e) => {
            this.search_employees(e.target.value);
        });

        $('#search-btn').on('click', () => {
            const search_term = $('#employee-search').val();
            this.search_employees(search_term);
        });
    }

    search_employees(search_term) {
        if (!gantt || !gantt.eachTask) return;

        // Clear previous search highlights
        $('.gantt_row').removeClass('search-highlight');

        if (!search_term) return;

        // Search and highlight matching employees
        gantt.eachTask(function(task) {
            if (task.type === 'employee' &&
                task.text.toLowerCase().includes(search_term.toLowerCase())) {
                // Highlight the row
                const row = $(`.gantt_row[task_id="${task.id}"]`);
                row.addClass('search-highlight');

                // Expand parent company
                if (task.parent) {
                    gantt.open(task.parent);
                }
            }
        });
    }

    clear_filters() {
        // Reset all filter fields
        const current_year = new Date().getFullYear();

        this.page.fields_dict.year?.set_value(current_year.toString());
        this.page.fields_dict.company?.set_value('');
        this.page.fields_dict.department?.set_value('');
        this.page.fields_dict.leave_type?.set_value('');
        this.page.fields_dict.status?.set_value('');
        this.page.fields_dict.employee?.set_value('');
        this.page.fields_dict.from_date?.set_value(`${current_year}-01-01`);
        this.page.fields_dict.to_date?.set_value(`${current_year}-12-31`);

        // Clear search
        $('#employee-search').val('');
        $('.gantt_row').removeClass('search-highlight');

        // Refresh chart
        this.refresh();
    }

    load_dhtmlx_gantt() {
        // Load DHTMLX Gantt CSS and JS
        if (!window.gantt) {
            // Load CSS
            const css_link = document.createElement('link');
            css_link.rel = 'stylesheet';
            css_link.href = 'https://cdn.dhtmlx.com/gantt/edge/dhtmlxgantt.css';
            document.head.appendChild(css_link);
            
            // Load JS
            const script = document.createElement('script');
            script.src = 'https://cdn.dhtmlx.com/gantt/edge/dhtmlxgantt.js';
            script.onload = () => {
                this.init_gantt();
                this.load_data();
            };
            document.head.appendChild(script);
        } else {
            this.init_gantt();
            this.load_data();
        }
    }

    init_gantt() {
        // Configure Gantt
        gantt.config.date_format = "%Y-%m-%d";
        gantt.config.scale_unit = "month";
        gantt.config.date_scale = "%M %Y";
        gantt.config.subscales = [
            {unit: "day", step: 1, date: "%d"}
        ];

        // Responsive column configuration
        const screen_width = window.innerWidth;
        let columns;

        if (screen_width < 768) {
            // Mobile layout
            columns = [
                {name: "text", label: "Employee", width: 150, tree: true},
                {name: "duration", label: "Days", width: 50, align: "center"}
            ];
            gantt.config.grid_width = 200;
        } else if (screen_width < 1024) {
            // Tablet layout
            columns = [
                {name: "text", label: "Employee", width: 180, tree: true},
                {name: "department", label: "Dept", width: 100, align: "center"},
                {name: "duration", label: "Days", width: 60, align: "center"}
            ];
            gantt.config.grid_width = 340;
        } else {
            // Desktop layout
            columns = [
                {name: "text", label: "Employee", width: 200, tree: true},
                {name: "department", label: "Department", width: 120, align: "center"},
                {name: "start_date", label: "Start", width: 80, align: "center"},
                {name: "duration", label: "Days", width: 60, align: "center"}
            ];
            gantt.config.grid_width = 460;
        }

        gantt.config.columns = columns;

        // Configure layout for company grouping
        gantt.config.open_tree_initially = true;
        gantt.config.auto_scheduling = false;
        gantt.config.auto_scheduling_strict = false;
        gantt.config.readonly = true;
        gantt.config.drag_move = false;
        gantt.config.drag_resize = false;
        gantt.config.drag_progress = false;

        // Configure grid and timeline
        gantt.config.row_height = screen_width < 768 ? 25 : 30;
        gantt.config.scale_height = screen_width < 768 ? 50 : 60;

        // Performance optimizations
        gantt.config.smart_rendering = true;
        gantt.config.static_background = true;

        // Configure task types
        gantt.config.types = {
            task: "task",
            project: "project",
            milestone: "milestone",
            company: "company",
            employee: "employee",
            leave: "leave"
        };

        // Initialize Gantt
        gantt.init("gantt_here");

        // Set up templates
        this.setup_gantt_templates();
    }

    setup_gantt_templates() {
        // Custom task template for leave periods
        gantt.templates.task_class = function(start, end, task) {
            if (task.type === 'leave') {
                return `leave-task status-${task.status.toLowerCase().replace(/\s+/g, '-')}`;
            }
            return '';
        };

        // Custom tooltip
        gantt.templates.tooltip_text = function(start, end, task) {
            if (task.type === 'leave') {
                return `<b>${task.employee_name}</b><br/>
                        Leave Type: ${task.leave_type}<br/>
                        Status: ${task.status}<br/>
                        Duration: ${task.duration} days<br/>
                        ${task.description ? 'Reason: ' + task.description : ''}`;
            }
            return task.text;
        };

        // Custom grid row template
        gantt.templates.grid_row_class = function(start, end, task) {
            if (task.type === 'company') {
                return 'gantt-company-row';
            } else if (task.type === 'employee') {
                return 'gantt-employee-row';
            } else if (task.type === 'leave') {
                return 'gantt-leave-row';
            }
            return '';
        };

        // Custom task bar template
        gantt.templates.task_text = function(start, end, task) {
            if (task.type === 'leave') {
                return `${task.leave_type} (${task.duration}d)`;
            }
            return '';
        };

        // Hide task bars for company and employee rows
        gantt.templates.task_class = function(start, end, task) {
            let classes = [];

            if (task.type === 'leave') {
                classes.push('leave-task');
                classes.push(`status-${task.status.toLowerCase().replace(/\s+/g, '-')}`);
            } else if (task.type === 'company' || task.type === 'employee') {
                classes.push('gantt-hidden-task');
            }

            return classes.join(' ');
        };

        // Custom date format for display
        gantt.templates.date_scale = function(date) {
            return gantt.date.date_to_str("%M %Y")(date);
        };
    }

    refresh() {
        this.current_filters = this.get_current_filters();
        this.load_data();
    }

    get_current_filters() {
        return {
            from_date: this.page.fields_dict.from_date?.get_value(),
            to_date: this.page.fields_dict.to_date?.get_value(),
            company: this.page.fields_dict.company?.get_value(),
            department: this.page.fields_dict.department?.get_value(),
            leave_type: this.page.fields_dict.leave_type?.get_value(),
            status: this.page.fields_dict.status?.get_value(),
            employee: this.page.fields_dict.employee?.get_value()
        };
    }

    load_data() {
        // Show loading indicator
        this.show_loading();

        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.leave_gantt_chart.leave_gantt_chart.get_leave_gantt_data',
            args: {
                filters: this.current_filters
            },
            callback: (r) => {
                this.hide_loading();
                if (r.message) {
                    this.render_gantt(r.message);
                    this.render_legend(r.message.status_legend);
                    this.show_summary(r.message.summary);
                } else {
                    this.show_error('No data received from server');
                }
            },
            error: (r) => {
                this.hide_loading();
                this.show_error('Error loading data: ' + (r.message || 'Unknown error'));
            }
        });
    }

    show_loading() {
        this.gantt_container.html('<div class="gantt-loading">Loading Gantt chart data...</div>');
    }

    hide_loading() {
        // Loading will be hidden when Gantt is rendered
    }

    show_error(message) {
        this.gantt_container.html(`
            <div class="gantt-error" style="text-align: center; padding: 50px; color: #dc3545;">
                <i class="fa fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>
                <h4>Error Loading Gantt Chart</h4>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="frappe.leave_gantt_chart.refresh()">
                    <i class="fa fa-refresh"></i> Retry
                </button>
            </div>
        `);
    }

    show_summary(summary) {
        if (!summary) return;

        const summary_html = `
            <div class="gantt-summary" style="margin-bottom: 15px; padding: 10px; background: #e3f2fd; border-radius: 4px;">
                <strong>Summary:</strong>
                ${summary.total_companies} Companies,
                ${summary.total_employees} Employees,
                ${summary.total_leaves} Leave Applications
                <span style="float: right;">${summary.date_range}</span>
            </div>
        `;

        this.legend_section.before(summary_html);
    }

    render_gantt(data) {
        // Store data for resize handling
        this.store_data(data);

        // Clear existing data
        gantt.clearAll();

        // Show loading state
        this.gantt_container.html('<div class="gantt-loading">Loading Gantt chart...</div>');

        // Prepare data for Gantt
        const gantt_data = {
            data: [],
            links: []
        };

        let task_counter = 1;

        // Add companies and employees as tree structure
        data.companies.forEach((company, company_index) => {
            // Add company as parent task
            const company_id = task_counter++;
            gantt_data.data.push({
                id: company_id,
                text: company.name,
                type: 'company',
                open: true,
                start_date: data.timeline.start_date,
                duration: 1,
                readonly: true,
                unscheduled: true
            });

            // Add employees under company
            company.employees.forEach((employee, emp_index) => {
                const employee_id = task_counter++;
                gantt_data.data.push({
                    id: employee_id,
                    text: employee.employee_name,
                    department: employee.department,
                    designation: employee.designation,
                    type: 'employee',
                    parent: company_id,
                    start_date: data.timeline.start_date,
                    duration: 1,
                    readonly: true,
                    unscheduled: true
                });

                // Add leave periods for this employee
                const employee_leaves = data.leave_periods.filter(
                    leave => leave.employee_id === employee.employee_id
                );

                employee_leaves.forEach((leave, leave_index) => {
                    const leave_id = task_counter++;

                    // Calculate duration in days
                    const start = new Date(leave.start_date);
                    const end = new Date(leave.end_date);
                    const duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

                    gantt_data.data.push({
                        id: leave_id,
                        text: `${leave.leave_type}`,
                        type: 'leave',
                        parent: employee_id,
                        start_date: leave.start_date,
                        end_date: leave.end_date,
                        duration: duration,
                        leave_type: leave.leave_type,
                        status: leave.status,
                        description: leave.description,
                        employee_name: leave.employee_name,
                        color: leave.color,
                        readonly: true
                    });
                });
            });
        });

        // Remove loading state and restore Gantt container
        this.gantt_container.html('<div id="gantt_here" style="width:100%; height:100%;"></div>');

        // Re-initialize Gantt if needed
        if (!gantt.getTaskByTime) {
            gantt.init("gantt_here");
        }

        // Load data into Gantt
        gantt.parse(gantt_data);

        // Expand all companies by default
        gantt.eachTask(function(task) {
            if (task.type === 'company') {
                gantt.open(task.id);
            }
        });
    }

    render_legend(legend_data) {
        let legend_html = '<div class="gantt-legend"><h5>Status Legend:</h5><div class="legend-items">';
        
        legend_data.forEach(item => {
            legend_html += `
                <div class="legend-item">
                    <span class="legend-color" style="background-color: ${item.color}"></span>
                    <span class="legend-label">${item.label}</span>
                </div>
            `;
        });
        
        legend_html += '</div></div>';
        this.legend_section.html(legend_html);
    }

    print_chart() {
        // Prepare for printing
        this.prepare_for_print();

        // Print the page
        setTimeout(() => {
            window.print();
            this.restore_after_print();
        }, 500);
    }

    prepare_for_print() {
        // Hide filters and other non-essential elements
        $('.gantt-filters-section').hide();
        $('.page-actions').hide();
        $('.page-head').hide();

        // Expand all companies for complete view
        if (gantt && gantt.eachTask) {
            gantt.eachTask(function(task) {
                if (task.type === 'company') {
                    gantt.open(task.id);
                }
            });
        }

        // Add print title
        const print_title = `
            <div class="print-header" style="text-align: center; margin-bottom: 20px; page-break-inside: avoid;">
                <h2>Leave Applications Gantt Chart</h2>
                <p>Period: ${this.current_filters.from_date} to ${this.current_filters.to_date}</p>
                ${this.current_filters.company ? `<p>Company: ${this.current_filters.company}</p>` : ''}
                <p>Generated on: ${new Date().toLocaleDateString()}</p>
            </div>
        `;

        this.body.prepend(print_title);
    }

    restore_after_print() {
        // Show hidden elements
        $('.gantt-filters-section').show();
        $('.page-actions').show();
        $('.page-head').show();

        // Remove print header
        $('.print-header').remove();
    }

    export_pdf() {
        // Check if DHTMLX Gantt Pro is available
        if (gantt.exportToPDF) {
            const filters_text = this.get_filters_text();

            gantt.exportToPDF({
                name: "leave_gantt_chart.pdf",
                header: `<h2>Leave Applications Gantt Chart</h2><p>${filters_text}</p>`,
                footer: `<p>Generated on: ${new Date().toLocaleDateString()}</p>`,
                locale: "en",
                start: this.current_filters.from_date,
                end: this.current_filters.to_date
            });
        } else {
            // Fallback: Use browser print to PDF
            frappe.msgprint({
                title: __('PDF Export'),
                message: __('DHTMLX Gantt Pro is not available. Please use browser Print > Save as PDF for export.'),
                primary_action: {
                    label: __('Print'),
                    action: () => this.print_chart()
                }
            });
        }
    }

    get_filters_text() {
        const filters = [];
        if (this.current_filters.company) filters.push(`Company: ${this.current_filters.company}`);
        if (this.current_filters.department) filters.push(`Department: ${this.current_filters.department}`);
        if (this.current_filters.leave_type) filters.push(`Leave Type: ${this.current_filters.leave_type}`);
        if (this.current_filters.status) filters.push(`Status: ${this.current_filters.status}`);
        if (this.current_filters.employee) filters.push(`Employee: ${this.current_filters.employee}`);

        const period = `Period: ${this.current_filters.from_date} to ${this.current_filters.to_date}`;
        return filters.length > 0 ? `${period} | ${filters.join(' | ')}` : period;
    }

    // Export to Excel functionality
    export_excel() {
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.leave_gantt_chart.leave_gantt_chart.export_gantt_data',
            args: {
                filters: this.current_filters
            },
            callback: (r) => {
                if (r.message) {
                    this.download_excel(r.message);
                }
            }
        });
    }

    download_excel(data) {
        // Convert data to CSV format
        if (data.length === 0) {
            frappe.msgprint(__('No data to export'));
            return;
        }

        const headers = Object.keys(data[0]);
        const csv_content = [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
        ].join('\n');

        // Create and download file
        const blob = new Blob([csv_content], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leave_gantt_chart_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }

    // Additional utility methods
    resize_gantt() {
        if (gantt && gantt.render) {
            gantt.render();
        }
    }

    get_gantt_data_for_export() {
        // Get current Gantt data for export purposes
        return gantt.serialize();
    }

    // Handle window resize
    handle_resize() {
        // Debounce resize events
        clearTimeout(this.resize_timeout);
        this.resize_timeout = setTimeout(() => {
            if (gantt && gantt.render) {
                // Reconfigure columns for new screen size
                const screen_width = window.innerWidth;
                let new_grid_width;

                if (screen_width < 768) {
                    new_grid_width = 200;
                } else if (screen_width < 1024) {
                    new_grid_width = 340;
                } else {
                    new_grid_width = 460;
                }

                if (gantt.config.grid_width !== new_grid_width) {
                    // Re-initialize with new configuration
                    this.init_gantt();
                    if (this.last_data) {
                        this.render_gantt(this.last_data);
                    }
                } else {
                    // Just resize
                    gantt.render();
                }
            }
        }, 250);
    }

    // Store last data for re-rendering
    store_data(data) {
        this.last_data = data;
    }

    // Cleanup method
    destroy() {
        if (this.resize_timeout) {
            clearTimeout(this.resize_timeout);
        }
        if (gantt && gantt.destructor) {
            gantt.destructor();
        }
    }
}

// Handle window resize for responsive design
$(window).on('resize', function() {
    if (frappe.leave_gantt_chart) {
        frappe.leave_gantt_chart.handle_resize();
    }
});

// Cleanup on page unload
$(window).on('beforeunload', function() {
    if (frappe.leave_gantt_chart) {
        frappe.leave_gantt_chart.destroy();
    }
});

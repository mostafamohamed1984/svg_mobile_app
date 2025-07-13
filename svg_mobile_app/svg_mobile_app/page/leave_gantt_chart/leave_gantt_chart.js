frappe.pages['leave-gantt-chart'].on_page_load = function(wrapper) {
    try {
        var page = frappe.ui.make_app_page({
            parent: wrapper,
            title: 'Leave Gantt Chart',
            single_column: true
        });

        // Add CSS class for styling
        $(wrapper).addClass('leave-gantt-chart-wrapper');

        // Show loading message initially
        page.main.html('<div style="text-align: center; padding: 50px;">' +
            '<h4>Loading Leave Gantt Chart...</h4>' +
            '<p>Please wait while we initialize the chart.</p>' +
            '</div>');

        // Initialize the Gantt chart with error handling
        setTimeout(function() {
            try {
                frappe.leave_gantt_chart = new LeaveGanttChart(page);
            } catch (e) {
                console.error('Error initializing Leave Gantt Chart:', e);
                var errorHtml = '<div style="text-align: center; padding: 50px; color: #dc3545;">' +
                    '<h4>Error Loading Gantt Chart</h4>' +
                    '<p>There was an error initializing the chart: ' + (e.message || 'Unknown error').replace(/'/g, '&#39;').replace(/"/g, '&quot;') + '</p>' +
                    '<button class="btn btn-primary page-reload-btn">Reload Page</button>' +
                    '</div>';
                page.main.html(errorHtml);

                // Add event handler for reload button
                page.main.find('.page-reload-btn').on('click', function() {
                    location.reload();
                });
            }
        }, 100);

    } catch (e) {
        console.error('Error in page load:', e);
        var pageErrorHtml = '<div style="text-align: center; padding: 50px; color: #dc3545;">' +
            '<h4>Page Load Error</h4>' +
            '<p>Failed to load the page: ' + (e.message || 'Unknown error').replace(/'/g, '&#39;').replace(/"/g, '&quot;') + '</p>' +
            '<button class="btn btn-primary page-error-reload-btn">Reload Page</button>' +
            '</div>';
        $(wrapper).html(pageErrorHtml);

        // Add event handler for reload button
        $(wrapper).find('.page-error-reload-btn').on('click', function() {
            location.reload();
        });
    }
};

frappe.pages['leave-gantt-chart'].on_page_show = function() {
    try {
        // Only refresh if chart is already initialized and not currently loading
        if(frappe.leave_gantt_chart &&
           frappe.leave_gantt_chart.refresh &&
           !frappe.leave_gantt_chart.loading &&
           !frappe.leave_gantt_chart.initializing) {
            frappe.leave_gantt_chart.refresh();
        }
    } catch (e) {
        console.error('Error on page show:', e);
    }
};

class LeaveGanttChart {
    constructor(page) {
        try {
            this.page = page;
            this.gantt = null;
            this.current_filters = {};
            this.loading = false;
            this.updating_filters = false;
            this.initializing = true;

            console.log('Initializing Leave Gantt Chart...');

            // Initialize step by step with error handling
            this.make();
            this.setup_filters();

            // Load Gantt library after a short delay
            var self = this;
            setTimeout(function() {
                self.load_dhtmlx_gantt();
            }, 500);

        } catch (e) {
            console.error('Error in LeaveGanttChart constructor:', e);
            this.show_error('Failed to initialize Gantt chart: ' + (e.message || 'Unknown error'));
        }
    }

    make() {
        try {
            console.log('Creating Gantt chart containers...');

            // Clear any existing content
            this.page.main.empty();

            // Create main container
            this.body = $('<div class="leave-gantt-container"></div>').appendTo(this.page.main);

            // Create filter section
            this.filter_section = $('<div class="gantt-filters-section"></div>').appendTo(this.body);

            // Create legend section
            this.legend_section = $('<div class="gantt-legend-section"></div>').appendTo(this.body);

            // Create Gantt chart container
            this.gantt_container = $('<div id="gantt_here" class="gantt-chart-container"></div>').appendTo(this.body);

            // Set initial height and show loading
            this.gantt_container.css('height', '600px');
            this.gantt_container.html('<div style="text-align: center; padding: 100px;">' +
                '<h4>Initializing Gantt Chart...</h4>' +
                '</div>');

            console.log('Containers created successfully');

        } catch (e) {
            console.error('Error in make():', e);
            throw e;
        }
    }

    setup_filters() {
        var self = this;

        // Add refresh button
        this.page.set_primary_action('Refresh', function() { self.refresh(); }, 'refresh');

        // Add print button
        this.page.add_action_item('Print', function() { self.print_chart(); }, 'print');

        // Add export buttons
        this.page.add_action_item('Export PDF', function() { self.export_pdf(); }, 'download');
        this.page.add_action_item('Export Excel', function() { self.export_excel(); }, 'download');

        // Create filter fields
        var current_year = new Date().getFullYear();

        // Year filter
        this.page.add_field({
            label: 'Year',
            fieldtype: 'Select',
            fieldname: 'year',
            options: this.get_year_options(),
            default: current_year.toString(),
            change: function() { self.on_year_change(); }
        });

        // Company filter
        this.page.add_field({
            label: 'Company',
            fieldtype: 'Link',
            fieldname: 'company',
            options: 'Company',
            change: function() { self.on_filter_change(); }
        });

        // Date range fields
        this.page.add_field({
            label: 'From Date',
            fieldtype: 'Date',
            fieldname: 'from_date',
            default: current_year + '-01-01',
            change: function() { self.on_filter_change(); }
        });

        this.page.add_field({
            label: 'To Date',
            fieldtype: 'Date',
            fieldname: 'to_date',
            default: current_year + '-12-31',
            change: function() { self.on_filter_change(); }
        });

        // Department filter
        this.page.add_field({
            label: 'Department',
            fieldtype: 'Link',
            fieldname: 'department',
            options: 'Department',
            change: function() { self.on_filter_change(); }
        });

        // Leave Type filter
        this.page.add_field({
            label: 'Leave Type',
            fieldtype: 'Link',
            fieldname: 'leave_type',
            options: 'Leave Type',
            change: function() { self.on_filter_change(); }
        });

        // Status filter
        this.page.add_field({
            label: 'Status',
            fieldtype: 'Select',
            fieldname: 'status',
            options: '\nRequested\nManager Approved\nHR Approved\nApproved\nRejected\nCancelled',
            change: function() { self.on_filter_change(); }
        });

        // Employee filter
        this.page.add_field({
            label: 'Employee',
            fieldtype: 'Link',
            fieldname: 'employee',
            options: 'Employee',
            change: function() { self.on_filter_change(); }
        });

        // Add clear filters button
        this.page.add_action_item('Clear Filters', function() { self.clear_filters(); }, 'refresh');

        // Add search functionality
        this.setup_search();
    }

    get_year_options() {
        var current_year = new Date().getFullYear();
        var years = [];
        for (var i = current_year - 2; i <= current_year + 2; i++) {
            years.push(i.toString());
        }
        return years.join('\n');
    }

    on_filter_change() {
        // Simple approach: just refresh without automatic date updates
        // The automatic date range update was causing the infinite loop
        this.refresh();
    }

    on_year_change() {
        // Handle year changes separately to update date range
        var year_field = this.page.fields_dict.year;
        var from_date_field = this.page.fields_dict.from_date;
        var to_date_field = this.page.fields_dict.to_date;

        if (year_field && year_field.get_value()) {
            var year = year_field.get_value();

            // Update date fields without triggering their change events
            from_date_field.set_value(year + '-01-01');
            to_date_field.set_value(year + '-12-31');
        }

        // Refresh after year change
        this.refresh();
    }

    setup_search() {
        // Add search input to filter section
        var search_html = '<div class="search-container" style="margin-top: 10px;">' +
            '<input type="text" class="form-control" placeholder="Search employees..." ' +
            'id="employee-search" style="width: 250px; display: inline-block;">' +
            '<button class="btn btn-default" id="search-btn" style="margin-left: 5px;">' +
            '<i class="fa fa-search"></i>' +
            '</button>' +
            '</div>';

        this.filter_section.append(search_html);

        // Add search functionality
        var self = this;
        $('#employee-search').on('input', function(e) {
            self.search_employees(e.target.value);
        });

        $('#search-btn').on('click', function() {
            var search_term = $('#employee-search').val();
            self.search_employees(search_term);
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
                var row = $('.gantt_row[task_id="' + task.id + '"]');
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
        var current_year = new Date().getFullYear();

        if (this.page.fields_dict.year) this.page.fields_dict.year.set_value(current_year.toString());
        if (this.page.fields_dict.company) this.page.fields_dict.company.set_value('');
        if (this.page.fields_dict.department) this.page.fields_dict.department.set_value('');
        if (this.page.fields_dict.leave_type) this.page.fields_dict.leave_type.set_value('');
        if (this.page.fields_dict.status) this.page.fields_dict.status.set_value('');
        if (this.page.fields_dict.employee) this.page.fields_dict.employee.set_value('');
        if (this.page.fields_dict.from_date) this.page.fields_dict.from_date.set_value(current_year + '-01-01');
        if (this.page.fields_dict.to_date) this.page.fields_dict.to_date.set_value(current_year + '-12-31');

        // Clear search
        $('#employee-search').val('');
        $('.gantt_row').removeClass('search-highlight');

        // Refresh chart
        this.refresh();
    }

    load_dhtmlx_gantt() {
        try {
            console.log('Loading DHTMLX Gantt library...');

            // Check if already loading
            if (this.loading) {
                console.log('Already loading, skipping...');
                return;
            }
            this.loading = true;

            // Load DHTMLX Gantt CSS and JS
            if (!window.gantt) {
                console.log('Gantt library not found, loading from CDN...');

                // Load CSS first
                var css_link = document.createElement('link');
                css_link.rel = 'stylesheet';
                css_link.href = 'https://cdn.dhtmlx.com/gantt/edge/dhtmlxgantt.css';
                document.head.appendChild(css_link);

                // Load JS with timeout
                var script = document.createElement('script');
                script.src = 'https://cdn.dhtmlx.com/gantt/edge/dhtmlxgantt.js';

                // Set timeout for loading
                var self = this;
                var timeout = setTimeout(function() {
                    self.loading = false;
                    self.show_error('Timeout loading DHTMLX Gantt library. Please check your internet connection and try again.');
                }, 10000); // 10 second timeout

                script.onload = function() {
                    clearTimeout(timeout);
                    self.loading = false;
                    console.log('Gantt library loaded successfully');

                    setTimeout(function() {
                        try {
                            self.setup_error_handling();
                            self.init_gantt();

                            // Check if there's pending data to render
                            if (self.pending_data) {
                                console.log('Rendering pending data...');
                                self.render_gantt(self.pending_data);
                                self.render_legend(self.pending_data.status_legend);
                                self.show_summary(self.pending_data.summary);
                                self.pending_data = null;
                            } else {
                                self.load_data();
                            }
                        } catch (e) {
                            console.error('Error after library load:', e);
                            self.show_error('Error initializing Gantt chart: ' + (e.message || 'Unknown error'));
                        }
                    }, 100);
                };

                script.onerror = function() {
                    clearTimeout(timeout);
                    self.loading = false;
                    self.show_error('Failed to load DHTMLX Gantt library. Please check your internet connection.');
                };

                document.head.appendChild(script);
            } else {
                console.log('Gantt library already available');
                this.loading = false;
                this.setup_error_handling();
                this.init_gantt();

                // Check if there's pending data to render
                if (this.pending_data) {
                    console.log('Rendering pending data...');
                    this.render_gantt(this.pending_data);
                    this.render_legend(this.pending_data.status_legend);
                    this.show_summary(this.pending_data.summary);
                    this.pending_data = null;
                } else {
                    this.load_data();
                }
            }
        } catch (e) {
            this.loading = false;
            console.error('Error in load_dhtmlx_gantt:', e);
            this.show_error('Error loading Gantt library: ' + (e.message || 'Unknown error'));
        }
    }

    setup_error_handling() {
        // Capture and handle Gantt errors
        var original_console_error = console.error;
        console.error = function() {
            // Check if it's a Gantt-related SVG error
            var args = Array.prototype.slice.call(arguments);
            var error_message = args.join(' ');
            if (error_message.includes('path') && error_message.includes('Expected number')) {
                console.warn('Gantt SVG path error caught and handled:', args);
                // Don't propagate SVG path errors to avoid console spam
                return;
            }
            // Call original console.error for other errors
            original_console_error.apply(console, args);
        };

        // Add global error event listener
        window.addEventListener('error', function(event) {
            if (event.message && event.message.includes('gantt')) {
                console.warn('Gantt error caught:', event.message);
                event.preventDefault(); // Prevent error from propagating
            }
        });
    }

    init_gantt() {
        try {
            console.log('Initializing Gantt configuration...');

            if (!window.gantt) {
                throw new Error('DHTMLX Gantt library not available');
            }

            // Basic Gantt configuration
            gantt.config.date_format = "%Y-%m-%d";
            gantt.config.scale_unit = "month";
            gantt.config.date_scale = "%M %Y";
            gantt.config.subscales = [
                {unit: "day", step: 1, date: "%d"}
            ];

        // Responsive column configuration
        var screen_width = window.innerWidth;
        var columns;

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

        // Prevent SVG path errors
        gantt.config.min_column_width = 50;
        gantt.config.min_grid_column_width = 70;
        gantt.config.task_height = 20;
        gantt.config.bar_height = 16;

        // Date validation
        gantt.config.correct_work_time = true;
        gantt.config.work_time = true;

        // Configure task types
        gantt.config.types = {
            task: "task",
            project: "project",
            milestone: "milestone",
            company: "company",
            employee: "employee",
            leave: "leave"
        };

        // Add data validation
        gantt.attachEvent("onBeforeTaskDisplay", function(id, task) {
            // Validate task data before rendering
            if (task.type === 'leave') {
                // Ensure valid dates
                if (!task.start_date || !task.end_date) {
                    return false; // Don't display invalid tasks
                }

                // Ensure positive duration
                if (task.duration <= 0) {
                    task.duration = 1;
                }

                // Ensure dates are Date objects or valid strings
                if (typeof task.start_date === 'string') {
                    task.start_date = gantt.date.parseDate(task.start_date, "xml_date");
                }
                if (typeof task.end_date === 'string') {
                    task.end_date = gantt.date.parseDate(task.end_date, "xml_date");
                }
            }
            return true;
        });

            // Initialize Gantt
            console.log('Initializing Gantt instance...');
            gantt.init("gantt_here");

            // Set up templates
            this.setup_gantt_templates();

            console.log('Gantt initialization completed successfully');

        } catch (e) {
            console.error('Error in init_gantt:', e);
            this.show_error('Error initializing Gantt chart: ' + (e.message || 'Unknown error'));
            throw e;
        }
    }

    setup_gantt_templates() {
        // Custom task template for leave periods with error handling
        gantt.templates.task_class = function(start, end, task) {
            try {
                if (task.type === 'leave' && task.status) {
                    return 'leave-task status-' + task.status.toLowerCase().replace(/\s+/g, '-');
                }
                return '';
            } catch (e) {
                console.warn('Error in task_class template:', e, task);
                return 'leave-task';
            }
        };

        // Custom tooltip with error handling
        gantt.templates.tooltip_text = function(start, end, task) {
            try {
                if (task.type === 'leave') {
                    return '<b>' + (task.employee_name || 'Unknown Employee') + '</b><br/>' +
                           'Leave Type: ' + (task.leave_type || 'Unknown') + '<br/>' +
                           'Status: ' + (task.status || 'Unknown') + '<br/>' +
                           'Duration: ' + (task.duration || 0) + ' days<br/>' +
                           (task.description ? 'Reason: ' + task.description : '');
                }
                return task.text || 'No information available';
            } catch (e) {
                console.warn('Error in tooltip template:', e, task);
                return 'Error displaying tooltip';
            }
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
                return task.leave_type + ' (' + task.duration + 'd)';
            }
            return '';
        };

        // Hide task bars for company and employee rows
        gantt.templates.task_class = function(start, end, task) {
            var classes = [];

            if (task.type === 'leave') {
                classes.push('leave-task');
                classes.push('status-' + task.status.toLowerCase().replace(/\s+/g, '-'));
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
        try {
            // Prevent multiple simultaneous refreshes
            if (this.loading) {
                console.log('Already loading, skipping refresh...');
                return;
            }

            console.log('Refreshing Gantt chart...');
            this.current_filters = this.get_current_filters();

            // Clear any existing summary
            $('.gantt-summary').remove();

            this.load_data();
        } catch (e) {
            console.error('Error in refresh:', e);
            this.show_error('Error refreshing chart: ' + (e.message || 'Unknown error'));
        }
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
        try {
            console.log('Loading Gantt data...');

            // Show loading indicator
            this.show_loading();

            var self = this;
            frappe.call({
                method: 'svg_mobile_app.svg_mobile_app.page.leave_gantt_chart.leave_gantt_chart.get_leave_gantt_data',
                args: {
                    filters: this.current_filters
                },
                callback: function(r) {
                    try {
                        self.hide_loading();
                        if (r.message) {
                            console.log('Data received, rendering Gantt...');
                            console.log('API Response:', r.message);
                            console.log('Companies:', r.message.companies);
                            console.log('Leave periods:', r.message.leave_periods);
                            self.render_gantt(r.message);
                            self.render_legend(r.message.status_legend);
                            self.show_summary(r.message.summary);

                            // Mark initialization as complete
                            self.initializing = false;
                        } else {
                            self.show_error('No data received from server');
                            self.initializing = false;
                        }
                    } catch (e) {
                        console.error('Error in callback:', e);
                        self.show_error('Error processing data: ' + (e.message || 'Unknown error'));
                        self.initializing = false;
                    }
                },
                error: function(r) {
                    self.hide_loading();
                    console.error('API Error:', r);
                    self.show_error('Error loading data: ' + (r.message || 'Unknown server error'));
                    self.initializing = false;
                }
            });
        } catch (e) {
            console.error('Error in load_data:', e);
            this.show_error('Error initiating data load: ' + (e.message || 'Unknown error'));
        }
    }

    show_loading() {
        this.gantt_container.html('<div class="gantt-loading">Loading Gantt chart data...</div>');
    }

    hide_loading() {
        // Loading will be hidden when Gantt is rendered
    }

    show_error(message) {
        var errorHtml = '<div class="gantt-error" style="text-align: center; padding: 50px; color: #dc3545;">' +
            '<i class="fa fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>' +
            '<h4>Error Loading Gantt Chart</h4>' +
            '<p>' + message + '</p>' +
            '<div style="margin-top: 20px;">' +
            '<button class="btn btn-primary gantt-retry-btn" style="margin-right: 10px;">' +
            '<i class="fa fa-refresh"></i> Retry' +
            '</button>' +
            '<button class="btn btn-secondary gantt-simple-view-btn">' +
            '<i class="fa fa-table"></i> Show Simple View' +
            '</button>' +
            '</div>' +
            '</div>';
        this.gantt_container.html(errorHtml);

        // Add event handlers
        var self = this;
        this.gantt_container.find('.gantt-retry-btn').on('click', function() {
            self.refresh();
        });
        this.gantt_container.find('.gantt-simple-view-btn').on('click', function() {
            self.show_simple_view();
        });
    }

    show_simple_view() {
        // Fallback simple table view if Gantt fails
        console.log('Showing simple table view as fallback...');

        var self = this;
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.leave_gantt_chart.leave_gantt_chart.get_leave_gantt_data',
            args: {
                filters: this.current_filters
            },
            callback: function(r) {
                if (r.message) {
                    self.render_simple_table(r.message);
                } else {
                    self.gantt_container.html('<div style="text-align: center; padding: 50px;">No data available</div>');
                }
            },
            error: function(r) {
                self.gantt_container.html('<div style="text-align: center; padding: 50px; color: #dc3545;">Error loading data</div>');
            }
        });
    }

    render_simple_table(data) {
        var html = '<div style="padding: 20px;">' +
            '<h4>Leave Applications - Simple View</h4>' +
            '<p>Gantt chart failed to load. Showing data in table format.</p>' +
            '<div style="overflow-x: auto;">' +
            '<table class="table table-bordered">' +
            '<thead>' +
            '<tr>' +
            '<th>Company</th>' +
            '<th>Employee</th>' +
            '<th>Leave Type</th>' +
            '<th>Start Date</th>' +
            '<th>End Date</th>' +
            '<th>Days</th>' +
            '<th>Status</th>' +
            '</tr>' +
            '</thead>' +
            '<tbody>';

        data.companies.forEach(function(company) {
            company.employees.forEach(function(employee) {
                var employee_leaves = data.leave_periods.filter(function(leave) {
                    return leave.employee_id === employee.employee_id;
                });

                if (employee_leaves.length === 0) {
                    html += '<tr>' +
                        '<td>' + company.name + '</td>' +
                        '<td>' + employee.employee_name + '</td>' +
                        '<td colspan="5" style="text-align: center; color: #6c757d;">No leave applications</td>' +
                        '</tr>';
                } else {
                    employee_leaves.forEach(function(leave) {
                        html += '<tr>' +
                            '<td>' + company.name + '</td>' +
                            '<td>' + employee.employee_name + '</td>' +
                            '<td>' + leave.leave_type + '</td>' +
                            '<td>' + leave.start_date + '</td>' +
                            '<td>' + leave.end_date + '</td>' +
                            '<td>' + leave.total_days + '</td>' +
                            '<td><span style="color: ' + leave.color + '; font-weight: bold;">' + leave.status + '</span></td>' +
                            '</tr>';
                    });
                }
            });
        });

        html += '</tbody>' +
            '</table>' +
            '</div>' +
            '<div style="margin-top: 20px;">' +
            '<button class="btn btn-primary gantt-try-again-btn">' +
            '<i class="fa fa-refresh"></i> Try Gantt Chart Again' +
            '</button>' +
            '</div>' +
            '</div>';

        this.gantt_container.html(html);

        // Add event handler
        var self = this;
        this.gantt_container.find('.gantt-try-again-btn').on('click', function() {
            self.refresh();
        });
    }

    show_summary(summary) {
        if (!summary) return;

        var summary_html = '<div class="gantt-summary" style="margin-bottom: 15px; padding: 10px; background: #e3f2fd; border-radius: 4px;">' +
            '<strong>Summary:</strong> ' +
            summary.total_companies + ' Companies, ' +
            summary.total_employees + ' Employees, ' +
            summary.total_leaves + ' Leave Applications' +
            '<span style="float: right;">' + summary.date_range + '</span>' +
            '</div>';

        this.legend_section.before(summary_html);
    }

    render_gantt(data) {
        // Check if Gantt library is loaded
        if (!window.gantt) {
            console.log('Gantt library not yet loaded, storing data for later rendering...');
            this.pending_data = data;
            return;
        }

        // Store data for resize handling
        this.store_data(data);

        // Clear existing data
        gantt.clearAll();

        // Show loading state
        this.gantt_container.html('<div class="gantt-loading">Loading Gantt chart...</div>');

        // Prepare data for Gantt
        var gantt_data = {
            data: [],
            links: []
        };

        var task_counter = 1;

        // Add companies and employees as tree structure
        console.log('Processing companies:', data.companies.length);
        data.companies.forEach(function(company, company_index) {
            console.log('Processing company:', company.name, 'with', company.employees.length, 'employees');
            // Add company as parent task
            var company_id = task_counter++;
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
            company.employees.forEach(function(employee, emp_index) {
                var employee_id = task_counter++;
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
                var employee_leaves = data.leave_periods.filter(function(leave) {
                    return leave.employee_id === employee.employee_id;
                });

                console.log('Employee', employee.employee_name, 'has', employee_leaves.length, 'leave periods');

                employee_leaves.forEach(function(leave, leave_index) {
                    console.log('Processing leave:', leave);
                    var leave_id = task_counter++;

                    // Validate and parse dates
                    var start_date = leave.start_date;
                    var end_date = leave.end_date;

                    // Ensure dates are valid
                    if (!start_date || !end_date) {
                        console.warn(`Invalid dates for leave ${leave.leave_id}:`, leave);
                        return; // Skip this leave record
                    }

                    // Parse dates and validate
                    var start = new Date(start_date);
                    var end = new Date(end_date);

                    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                        console.warn(`Invalid date format for leave ${leave.leave_id}:`, leave);
                        return; // Skip this leave record
                    }

                    // Ensure end date is not before start date
                    if (end < start) {
                        console.warn('End date before start date for leave ' + leave.leave_id + ':', leave);
                        // Swap dates if needed
                        var temp = start_date;
                        start_date = end_date;
                        end_date = temp;
                    }

                    // Calculate duration in days (minimum 1 day)
                    var duration = Math.max(1, Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24)) + 1);

                    // Ensure dates are within the timeline range
                    var timeline_start = new Date(data.timeline.start_date);
                    var timeline_end = new Date(data.timeline.end_date);

                    // Adjust dates if they're outside the timeline
                    if (new Date(start_date) < timeline_start) {
                        start_date = data.timeline.start_date;
                    }
                    if (new Date(end_date) > timeline_end) {
                        end_date = data.timeline.end_date;
                    }

                    gantt_data.data.push({
                        id: leave_id,
                        text: `${leave.leave_type}`,
                        type: 'leave',
                        parent: employee_id,
                        start_date: start_date,
                        end_date: end_date,
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

        // Validate data before loading
        var validated_data = this.validate_gantt_data(gantt_data);

        // Load data into Gantt
        gantt.parse(validated_data);

        // Expand all companies by default
        gantt.eachTask(function(task) {
            if (task.type === 'company') {
                gantt.open(task.id);
            }
        });
    }

    validate_gantt_data(gantt_data) {
        // Validate and clean Gantt data to prevent SVG errors
        var validated_data = {
            data: [],
            links: gantt_data.links || []
        };

        gantt_data.data.forEach(function(task) {
            try {
                // Basic validation
                if (!task.id || !task.text) {
                    console.warn('Skipping task with missing id or text:', task);
                    return;
                }

                // Validate dates for leave tasks
                if (task.type === 'leave') {
                    if (!task.start_date || !task.end_date) {
                        console.warn('Skipping leave task with missing dates:', task);
                        return;
                    }

                    // Ensure duration is positive
                    if (!task.duration || task.duration <= 0) {
                        task.duration = 1;
                    }

                    // Ensure dates are properly formatted
                    if (typeof task.start_date === 'string') {
                        var parsed_start = new Date(task.start_date);
                        if (isNaN(parsed_start.getTime())) {
                            console.warn('Invalid start date for task:', task);
                            return;
                        }
                    }

                    if (typeof task.end_date === 'string') {
                        var parsed_end = new Date(task.end_date);
                        if (isNaN(parsed_end.getTime())) {
                            console.warn('Invalid end date for task:', task);
                            return;
                        }
                    }
                }

                // Add validated task
                validated_data.data.push(task);

            } catch (e) {
                console.warn('Error validating task:', e, task);
            }
        });

        return validated_data;
    }

    render_legend(legend_data) {
        var legend_html = '<div class="gantt-legend"><h5>Status Legend:</h5><div class="legend-items">';

        legend_data.forEach(function(item) {
            legend_html += '<div class="legend-item">' +
                '<span class="legend-color" style="background-color: ' + item.color + '"></span>' +
                '<span class="legend-label">' + item.label + '</span>' +
                '</div>';
        });

        legend_html += '</div></div>';
        this.legend_section.html(legend_html);
    }

    print_chart() {
        // Prepare for printing
        this.prepare_for_print();

        // Print the page
        var self = this;
        setTimeout(function() {
            window.print();
            self.restore_after_print();
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
        var print_title = '<div class="print-header" style="text-align: center; margin-bottom: 20px; page-break-inside: avoid;">' +
            '<h2>Leave Applications Gantt Chart</h2>' +
            '<p>Period: ' + this.current_filters.from_date + ' to ' + this.current_filters.to_date + '</p>' +
            (this.current_filters.company ? '<p>Company: ' + this.current_filters.company + '</p>' : '') +
            '<p>Generated on: ' + new Date().toLocaleDateString() + '</p>' +
            '</div>';

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
            var filters_text = this.get_filters_text();

            gantt.exportToPDF({
                name: "leave_gantt_chart.pdf",
                header: '<h2>Leave Applications Gantt Chart</h2><p>' + filters_text + '</p>',
                footer: '<p>Generated on: ' + new Date().toLocaleDateString() + '</p>',
                locale: "en",
                start: this.current_filters.from_date,
                end: this.current_filters.to_date
            });
        } else {
            // Fallback: Use browser print to PDF
            var self = this;
            frappe.msgprint({
                title: __('PDF Export'),
                message: __('DHTMLX Gantt Pro is not available. Please use browser Print > Save as PDF for export.'),
                primary_action: {
                    label: __('Print'),
                    action: function() { self.print_chart(); }
                }
            });
        }
    }

    get_filters_text() {
        var filters = [];
        if (this.current_filters.company) filters.push('Company: ' + this.current_filters.company);
        if (this.current_filters.department) filters.push('Department: ' + this.current_filters.department);
        if (this.current_filters.leave_type) filters.push('Leave Type: ' + this.current_filters.leave_type);
        if (this.current_filters.status) filters.push('Status: ' + this.current_filters.status);
        if (this.current_filters.employee) filters.push('Employee: ' + this.current_filters.employee);

        var period = 'Period: ' + this.current_filters.from_date + ' to ' + this.current_filters.to_date;
        return filters.length > 0 ? period + ' | ' + filters.join(' | ') : period;
    }

    // Export to Excel functionality
    export_excel() {
        var self = this;
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.leave_gantt_chart.leave_gantt_chart.export_gantt_data',
            args: {
                filters: this.current_filters
            },
            callback: function(r) {
                if (r.message) {
                    self.download_excel(r.message);
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

        var headers = Object.keys(data[0]);
        var csv_rows = [headers.join(',')];

        data.forEach(function(row) {
            var csv_row = headers.map(function(header) {
                return '"' + (row[header] || '') + '"';
            }).join(',');
            csv_rows.push(csv_row);
        });

        var csv_content = csv_rows.join('\n');

        // Create and download file
        var blob = new Blob([csv_content], { type: 'text/csv' });
        var url = window.URL.createObjectURL(blob);
        var a = document.createElement('a');
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
        var self = this;
        this.resize_timeout = setTimeout(function() {
            if (gantt && gantt.render) {
                // Reconfigure columns for new screen size
                var screen_width = window.innerWidth;
                var new_grid_width;

                if (screen_width < 768) {
                    new_grid_width = 200;
                } else if (screen_width < 1024) {
                    new_grid_width = 340;
                } else {
                    new_grid_width = 460;
                }

                if (gantt.config.grid_width !== new_grid_width) {
                    // Re-initialize with new configuration
                    self.init_gantt();
                    if (self.last_data) {
                        self.render_gantt(self.last_data);
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

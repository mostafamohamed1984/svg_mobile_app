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
            '<p>Please wait while we load the chart.</p>' +
            '</div>');

        // Initialize the Gantt chart with error handling
        setTimeout(function() {
            try {
                frappe.leave_gantt_chart = new LeaveGanttChart(page);
            } catch (e) {
                console.error('Error loading Leave Gantt Chart:', e);
                var errorHtml = '<div style="text-align: center; padding: 50px; color: #dc3545;">' +
                    '<h4>Error Loading Gantt Chart</h4>' +
                    '<p>There was an error loading the chart: ' + e.message + '</p>' +
                    '<button class="btn btn-primary" onclick="location.reload()">Reload Page</button>' +
                    '</div>';
                page.main.html(errorHtml);
            }
        }, 100);

    } catch (e) {
        console.error('Error in page load:', e);
        var pageErrorHtml = '<div style="text-align: center; padding: 50px; color: #dc3545;">' +
            '<h4>Page Load Error</h4>' +
            '<p>Failed to load the page: ' + e.message + '</p>' +
            '<button class="btn btn-primary" onclick="location.reload()">Reload Page</button>' +
            '</div>';
        $(wrapper).html(pageErrorHtml);
    }
};

frappe.pages['leave-gantt-chart'].on_page_show = function() {
    try {
        // Refresh chart when page is shown
        if(frappe.leave_gantt_chart && frappe.leave_gantt_chart.refresh) {
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

            console.log('Starting Leave Gantt Chart...');

            // Create the basic structure
            this.make();
            this.setup_filters();

            // Load Gantt library after a short delay
            var self = this;
            setTimeout(function() {
                self.load_dhtmlx_gantt();
            }, 500);

        } catch (e) {
            console.error('Error in LeaveGanttChart constructor:', e);
            this.show_error('Failed to start Gantt chart: ' + e.message);
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
                '<h4>Loading Gantt Chart...</h4>' +
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

        // Create filter fields
        var current_year = new Date().getFullYear();

        // Year filter
        this.page.add_field({
            label: 'Year',
            fieldtype: 'Select',
            fieldname: 'year',
            options: this.get_year_options(),
            default: current_year.toString(),
            change: function() { self.on_filter_change(); }
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
        // Update date range when year changes
        var year_field = this.page.fields_dict.year;
        var from_date_field = this.page.fields_dict.from_date;
        var to_date_field = this.page.fields_dict.to_date;

        if (year_field && year_field.get_value()) {
            var year = year_field.get_value();
            from_date_field.set_value(year + '-01-01');
            to_date_field.set_value(year + '-12-31');
        }

        // Refresh chart with new filters
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
                    self.show_error('Timeout loading DHTMLX Gantt library. Please check your connection and try again.');
                }, 10000); // 10 second timeout

                script.onload = function() {
                    clearTimeout(timeout);
                    self.loading = false;
                    console.log('Gantt library loaded successfully');

                    setTimeout(function() {
                        try {
                            self.init_gantt();
                            self.load_data();
                        } catch (e) {
                            console.error('Error after library load:', e);
                            self.show_error('Error starting Gantt chart: ' + e.message);
                        }
                    }, 100);
                };

                script.onerror = function() {
                    clearTimeout(timeout);
                    self.loading = false;
                    self.show_error('Failed to load DHTMLX Gantt library. Please check your connection.');
                };

                document.head.appendChild(script);
            } else {
                console.log('Gantt library already available');
                this.loading = false;
                this.init_gantt();
                this.load_data();
            }
        } catch (e) {
            this.loading = false;
            console.error('Error in load_dhtmlx_gantt:', e);
            this.show_error('Error loading Gantt library: ' + e.message);
        }
    }

    show_error(message) {
        var errorHtml = '<div class="gantt-error" style="text-align: center; padding: 50px; color: #dc3545;">' +
            '<i class="fa fa-exclamation-triangle" style="font-size: 48px; margin-bottom: 20px;"></i>' +
            '<h4>Error Loading Gantt Chart</h4>' +
            '<p>' + message + '</p>' +
            '<div style="margin-top: 20px;">' +
            '<button class="btn btn-primary" onclick="frappe.leave_gantt_chart.refresh()" style="margin-right: 10px;">' +
            '<i class="fa fa-refresh"></i> Retry' +
            '</button>' +
            '</div>' +
            '</div>';
        this.gantt_container.html(errorHtml);
    }

    refresh() {
        console.log('Refreshing chart...');
        // Basic refresh functionality
        this.load_data();
    }

    print_chart() {
        console.log('Print functionality - to be implemented');
        frappe.msgprint('Print functionality will be implemented once the chart is working.');
    }

    init_gantt() {
        console.log('Basic Gantt setup - to be implemented');
        // Basic Gantt setup will be added here
    }

    load_data() {
        console.log('Loading data - to be implemented');
        // Data loading will be implemented here
    }
}

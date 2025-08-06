frappe.pages['hr-utilization-dashboard'].on_page_load = function(wrapper) {
    try {
        var page = frappe.ui.make_app_page({
            parent: wrapper,
            title: 'HR Utilization Dashboard',
            single_column: true
        });

        // Add CSS class for styling
        $(wrapper).addClass('hr-utilization-dashboard-wrapper');

        // Show loading message initially
        page.main.html('<div style="text-align: center; padding: 50px;">' +
            '<h4>Loading HR Utilization Dashboard...</h4>' +
            '<p>Please wait while we initialize the dashboard.</p>' +
            '</div>');

        // Initialize the dashboard with error handling
        setTimeout(function() {
            try {
                frappe.hr_utilization_dashboard = new HRUtilizationDashboard(page);
            } catch (e) {
                console.error('Error initializing HR Utilization Dashboard:', e);
                var errorHtml = '<div style="text-align: center; padding: 50px; color: #dc3545;">' +
                    '<h4>Error Loading Dashboard</h4>' +
                    '<p>There was an error initializing the dashboard: ' + (e.message || 'Unknown error').replace(/'/g, '&#39;').replace(/"/g, '&quot;') + '</p>' +
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

frappe.pages['hr-utilization-dashboard'].on_page_show = function() {
    try {
        // Only refresh if dashboard is already initialized and not currently loading
        if(frappe.hr_utilization_dashboard &&
           frappe.hr_utilization_dashboard.refresh &&
           !frappe.hr_utilization_dashboard.loading &&
           !frappe.hr_utilization_dashboard.initializing) {
            frappe.hr_utilization_dashboard.refresh();
        }
    } catch (e) {
        console.error('Error on page show:', e);
    }
};

class HRUtilizationDashboard {
    constructor(page) {
        try {
            this.page = page;
            this.current_filters = {};
            this.loading = false;
            this.updating_filters = false;
            this.initializing = true;
            this.dashboard_data = null;

            console.log('Initializing HR Utilization Dashboard...');

            // Initialize step by step with error handling
            this.make();

            // Setup filters after a short delay to ensure page is ready
            var self = this;
            setTimeout(function() {
                self.setup_filters();
            }, 100);

            // Load initial data after filters are setup
            setTimeout(function() {
                self.load_data();
            }, 500);

        } catch (e) {
            console.error('Error in HRUtilizationDashboard constructor:', e);
            this.show_error('Failed to initialize dashboard: ' + (e.message || 'Unknown error'));
        }
    }

    make() {
        try {
            console.log('Creating dashboard structure...');
            
            // Create main container
            this.page.main.html(`
                <div class="hr-utilization-container">
                    <div class="filters-section">
                        <div class="row">
                            <div class="col-md-12">
                                <h5>Filters</h5>
                                <div class="filter-controls"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="summary-section" style="display: none;">
                        <div class="row">
                            <div class="col-md-12">
                                <h5>Summary</h5>
                                <div class="summary-cards"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="legend-section" style="display: none;">
                        <div class="row">
                            <div class="col-md-12">
                                <h5>Legend</h5>
                                <div class="legend-items">
                                    <span class="legend-item"><span class="legend-indicator attended">A</span> Attended</span>
                                    <span class="legend-item"><span class="legend-indicator leave">L</span> On Leave</span>
                                    <span class="legend-item"><span class="legend-indicator conflict">🔴</span> Conflict</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="dashboard-content">
                        <div class="loading-message" style="text-align: center; padding: 50px;">
                            <h5>Ready to load data</h5>
                            <p>Please select filters and click "Load Data" to view the utilization dashboard.</p>
                        </div>
                        <div class="companies-container" style="display: none;"></div>
                    </div>
                </div>
            `);

            // Add action buttons
            this.add_action_buttons();

            console.log('Dashboard structure created successfully');
            
        } catch (e) {
            console.error('Error in make():', e);
            this.show_error('Failed to create dashboard structure: ' + (e.message || 'Unknown error'));
        }
    }

    add_action_buttons() {
        try {
            // Add Load Data button
            this.page.add_inner_button('Load Data', () => {
                this.load_data();
            });

            // Add Refresh button
            this.page.add_inner_button('Refresh', () => {
                this.refresh();
            });

            // Add Export Excel button
            this.page.add_inner_button('Export Excel', () => {
                this.export_data('excel');
            });

            // Add Export PDF button
            this.page.add_inner_button('Export PDF', () => {
                this.export_data('pdf');
            });

            // Add Print button
            this.page.add_inner_button('Print', () => {
                this.print_dashboard();
            });

            // Add Conflict Resolution button
            this.page.add_inner_button('Resolve Conflicts', () => {
                this.show_conflict_resolution_panel();
            });

        } catch (e) {
            console.error('Error adding action buttons:', e);
        }
    }

    setup_filters() {
        try {
            console.log('Setting up filters...');
            
            var self = this;
            var filter_container = this.page.main.find('.filter-controls');

            // Create filter fields
            this.create_filter_fields(filter_container);

            // Load filter options
            this.load_filter_options();

            console.log('Filters setup completed');
            
        } catch (e) {
            console.error('Error in setup_filters():', e);
            this.show_error('Failed to setup filters: ' + (e.message || 'Unknown error'));
        }
    }

    create_filter_fields(container) {
        try {
            // Create filter HTML with calendar navigation
            var filter_html = `
                <div class="row filter-row">
                    <div class="col-md-2">
                        <div class="form-group">
                            <label>Calendar Navigation</label>
                            <div class="calendar-navigation">
                                <button class="btn btn-sm btn-outline-primary nav-button nav-prev" title="Previous Month">
                                    <i class="fa fa-chevron-left"></i>
                                </button>
                                <span class="current-period">
                                    <span class="current-month-year"></span>
                                </span>
                                <button class="btn btn-sm btn-outline-primary nav-button nav-next" title="Next Month">
                                    <i class="fa fa-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group">
                            <label>Year</label>
                            <select class="form-control filter-year">
                                <option value="">Select Year</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group">
                            <label>Month</label>
                            <select class="form-control filter-month">
                                <option value="">Select Month</option>
                                <option value="1">January</option>
                                <option value="2">February</option>
                                <option value="3">March</option>
                                <option value="4">April</option>
                                <option value="5">May</option>
                                <option value="6">June</option>
                                <option value="7">July</option>
                                <option value="8">August</option>
                                <option value="9">September</option>
                                <option value="10">October</option>
                                <option value="11">November</option>
                                <option value="12">December</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group">
                            <label>Company</label>
                            <select class="form-control filter-company">
                                <option value="">All Companies</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group">
                            <label>Department</label>
                            <select class="form-control filter-department">
                                <option value="">All Departments</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group">
                            <label>Leave Type</label>
                            <select class="form-control filter-leave-type">
                                <option value="">All Leave Types</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <div class="form-group">
                            <label>Status</label>
                            <select class="form-control filter-status">
                                <option value="">All Statuses</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="row">

                    <div class="col-md-3">
                        <div class="form-group">
                            <label>Show Conflicts Only</label>
                            <select class="form-control filter-conflicts-only">
                                <option value="">All Records</option>
                                <option value="true">Conflicts Only</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group">
                            <label>&nbsp;</label>
                            <button class="btn btn-primary btn-block load-data-btn">Load Data</button>
                        </div>
                    </div>
                </div>
                <div class="row filter-actions">
                    <div class="col-md-12">
                        <button class="btn btn-secondary btn-sm clear-filters">Clear Filters</button>
                    </div>
                </div>
            `;

            container.html(filter_html);

            // Initialize current period for navigation
            this.current_period = new Date();
            
            // Set default values
            var currentDate = new Date();
            container.find('.filter-year').val(currentDate.getFullYear());
            container.find('.filter-month').val(currentDate.getMonth() + 1);
            
            // Update navigation display
            this.update_navigation_display(container);

            // Add event handlers
            this.setup_filter_events(container);

        } catch (e) {
            console.error('Error creating filter fields:', e);
        }
    }

    setup_filter_events(container) {
        try {
            var self = this;

            // Filter change events
            container.find('select').on('change', function() {
                if (!self.updating_filters) {
                    self.update_current_filters();
                }
            });

            // Clear filters button
            container.find('.clear-filters').on('click', function() {
                self.clear_filters();
            });

            // Load Data button
            container.find('.load-data-btn').on('click', function() {
                self.load_data();
            });

            // Calendar navigation events
            container.find('.nav-prev').on('click', function() {
                if (!self.is_navigating) {
                    self.navigate_to_previous_month();
                }
            });

            container.find('.nav-next').on('click', function() {
                if (!self.is_navigating) {
                    self.navigate_to_next_month();
                }
            });

        } catch (e) {
            console.error('Error setting up filter events:', e);
        }
    }

    load_filter_options() {
        try {
            var self = this;
            
            frappe.call({
                method: 'svg_mobile_app.svg_mobile_app.page.hr_utilization_dashboard.hr_utilization_dashboard.get_filter_options',
                callback: function(r) {
                    if (r.message) {
                        self.populate_filter_options(r.message);
                    }
                },
                error: function(r) {
                    console.error('Error loading filter options:', r);
                    self.show_error('Failed to load filter options');
                }
            });

        } catch (e) {
            console.error('Error in load_filter_options():', e);
        }
    }

    populate_filter_options(options) {
        try {
            var container = this.page.main.find('.filter-controls');

            // Populate years (current year and previous 2 years)
            var yearSelect = container.find('.filter-year');
            var currentYear = new Date().getFullYear();
            for (var i = 0; i < 3; i++) {
                var year = currentYear - i;
                yearSelect.append(`<option value="${year}">${year}</option>`);
            }

            // Populate companies
            var companySelect = container.find('.filter-company');
            if (options.companies) {
                options.companies.forEach(function(company) {
                    companySelect.append(`<option value="${company}">${company}</option>`);
                });
            }

            // Populate departments
            var deptSelect = container.find('.filter-department');
            if (options.departments) {
                options.departments.forEach(function(dept) {
                    deptSelect.append(`<option value="${dept}">${dept}</option>`);
                });
            }

            // Populate leave types
            var leaveTypeSelect = container.find('.filter-leave-type');
            if (options.leave_types) {
                options.leave_types.forEach(function(type) {
                    leaveTypeSelect.append(`<option value="${type}">${type}</option>`);
                });
            }

            // Populate status options
            var statusSelect = container.find('.filter-status');
            if (options.status_options) {
                options.status_options.forEach(function(status) {
                    statusSelect.append(`<option value="${status}">${status}</option>`);
                });
            }

            console.log('Filter options populated successfully');

        } catch (e) {
            console.error('Error populating filter options:', e);
        }
    }

    update_current_filters() {
        try {
            var container = this.page.main.find('.filter-controls');
            
            this.current_filters = {
                year: container.find('.filter-year').val(),
                month: container.find('.filter-month').val(),
                company: container.find('.filter-company').val(),
                department: container.find('.filter-department').val(),
                leave_type: container.find('.filter-leave-type').val(),
                status: container.find('.filter-status').val(),
                conflicts_only: container.find('.filter-conflicts-only').val()
            };

            console.log('Current filters updated:', this.current_filters);

        } catch (e) {
            console.error('Error updating current filters:', e);
        }
    }

    clear_filters() {
        try {
            this.updating_filters = true;
            
            var container = this.page.main.find('.filter-controls');
            container.find('select').val('');
            
            // Set default year and month
            var currentDate = new Date();
            container.find('.filter-year').val(currentDate.getFullYear());
            container.find('.filter-month').val(currentDate.getMonth() + 1);
            
            this.updating_filters = false;
            this.update_current_filters();
            
            console.log('Filters cleared');

        } catch (e) {
            console.error('Error clearing filters:', e);
        }
    }

    load_data() {
        try {
            if (this.loading) {
                console.log('Already loading data, skipping...');
                return;
            }

            this.loading = true;
            this.update_current_filters();

            // Validate required filters
            if (!this.current_filters.year || !this.current_filters.month) {
                frappe.msgprint('Please select Year and Month');
                this.loading = false;
                return;
            }

            console.log('Loading utilization data with filters:', this.current_filters);

            // Show loading state
            this.show_loading();

            var self = this;
            frappe.call({
                method: 'svg_mobile_app.svg_mobile_app.page.hr_utilization_dashboard.hr_utilization_dashboard.get_utilization_data',
                args: {
                    filters: JSON.stringify(this.current_filters)
                },
                callback: function(r) {
                    self.loading = false;
                    if (r.message && r.message.success) {
                        self.dashboard_data = r.message.data;
                        self.render_dashboard(r.message.data);
                        self.show_summary_and_legend();
                    } else {
                        self.show_error(r.message ? r.message.error : 'Failed to load data');
                    }
                },
                error: function(r) {
                    self.loading = false;
                    console.error('Error loading data:', r);
                    self.show_error('Network error while loading data');
                }
            });

        } catch (e) {
            this.loading = false;
            console.error('Error in load_data():', e);
            this.show_error('Failed to load data: ' + (e.message || 'Unknown error'));
        }
    }

    show_loading() {
        try {
            this.page.main.find('.loading-message').html(`
                <div style="text-align: center; padding: 50px;">
                    <h5>Loading Data...</h5>
                    <p>Please wait while we fetch the utilization data.</p>
                    <div class="spinner-border" role="status">
                        <span class="sr-only">Loading...</span>
                    </div>
                </div>
            `).show();

            this.page.main.find('.companies-container').hide();
            this.page.main.find('.summary-section').hide();
            this.page.main.find('.legend-section').hide();

        } catch (e) {
            console.error('Error showing loading state:', e);
        }
    }

    show_summary_and_legend() {
        try {
            this.page.main.find('.summary-section').show();
            this.page.main.find('.legend-section').show();
        } catch (e) {
            console.error('Error showing summary and legend:', e);
        }
    }

    render_dashboard(data) {
        try {
            console.log('Rendering dashboard with data:', data);

            if (!data || !data.companies || data.companies.length === 0) {
                this.show_no_data();
                return;
            }

            // Hide loading and show content
            this.page.main.find('.loading-message').hide();
            this.page.main.find('.companies-container').show();

            // Render summary cards
            this.render_summary_cards(data.summary);

            // Render companies and employees
            this.render_companies(data.companies, data.date_range);

            console.log('Dashboard rendered successfully');

        } catch (e) {
            console.error('Error rendering dashboard:', e);
            this.show_error('Failed to render dashboard: ' + (e.message || 'Unknown error'));
        }
    }

    render_summary_cards(summary) {
        try {
            if (!summary) return;

            var cards_html = `
                <div class="row summary-cards-row">
                    <div class="col-md-3">
                        <div class="card summary-card">
                            <div class="card-body text-center">
                                <h4 class="text-primary">${summary.total_employees}</h4>
                                <p class="mb-0">Total Employees</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card summary-card">
                            <div class="card-body text-center">
                                <h4 class="text-danger">${summary.total_conflicts}</h4>
                                <p class="mb-0">Conflicts Found</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card summary-card">
                            <div class="card-body text-center">
                                <h4 class="text-info">${summary.companies_count}</h4>
                                <p class="mb-0">Companies</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card summary-card">
                            <div class="card-body text-center">
                                <h4 class="text-warning">${summary.conflict_rate}%</h4>
                                <p class="mb-0">Conflict Rate</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            this.page.main.find('.summary-cards').html(cards_html);

        } catch (e) {
            console.error('Error rendering summary cards:', e);
        }
    }

    render_companies(companies, date_range) {
        try {
            var container = this.page.main.find('.companies-container');
            
            // Calculate unified statistics
            var total_employees = companies.reduce((sum, company) => sum + company.employee_count, 0);
            var total_conflicts = companies.reduce((sum, company) => sum + company.conflict_count, 0);
            
            // Create unified header
            var unified_html = `
                <div class="unified-section">
                    <div class="unified-header">
                        <h5>
                            📊 All Companies - Department Leave Conflicts Overview
                            <span class="badge badge-secondary">${total_employees} total employees</span>
                            <span class="badge badge-danger">${total_conflicts} total conflicts</span>
                        </h5>
                    </div>
                    <div class="unified-content">
                        <div class="calendar-grid unified-calendar">
                            <!-- Unified calendar grid will be populated here -->
                        </div>
                    </div>
                </div>
            `;

            container.html(unified_html);

            // Render unified calendar grid with all employees
            this.render_unified_calendar(companies, date_range);

        } catch (e) {
            console.error('Error rendering unified companies:', e);
        }
    }

    render_unified_calendar(companies, date_range) {
        try {
            console.log('Rendering unified calendar for all companies');
            
            var unified_section = this.page.main.find('.unified-section');
            var calendar_grid = unified_section.find('.calendar-grid');
            
            // Combine all employees from all companies
            var all_employees = [];
            companies.forEach(company => {
                company.employees.forEach(employee => {
                    // Add company information to each employee
                    employee.company_name = company.company_name;
                    all_employees.push(employee);
                });
            });
            
            // Create unified calendar grid with all employees
            var calendar_html = this.create_unified_calendar_grid(all_employees, date_range);
            calendar_grid.html(calendar_html);
            
            // Add event handlers for interactive features
            this.setup_unified_calendar_interactions(unified_section, all_employees);

        } catch (e) {
            console.error('Error rendering unified calendar:', e);
        }
    }

    render_company_calendar(company, date_range) {
        // This function is now deprecated in favor of render_unified_calendar
        // Keeping for backward compatibility if needed
        try {
            console.log('render_company_calendar is deprecated, using unified calendar instead');
        } catch (e) {
            console.error('Error in deprecated render_company_calendar:', e);
        }
    }

    create_4_week_calendar_grid(company, date_range) {
        try {
            // Create 4-week calendar structure
            var calendar_html = '<div class="week-calendar-container">';
            
            // Create header with week dates
            calendar_html += this.create_calendar_header(date_range);
            
            // Create employee rows
            company.employees.forEach((employee) => {
                calendar_html += this.create_employee_calendar_row(employee, date_range);
            });
            
            calendar_html += '</div>';
            
            return calendar_html;
            
        } catch (e) {
            console.error('Error creating 4-week calendar grid:', e);
            return '<div class="error-message">Error creating calendar grid</div>';
        }
    }

    create_unified_calendar_grid(all_employees, date_range) {
        try {
            // Create unified calendar structure for all employees across companies
            var calendar_html = '<div class="unified-calendar-container">';
            
            // Create header with week dates
            calendar_html += this.create_calendar_header(date_range);
            
            // Create employee rows for all employees (sorted by company then name)
            all_employees.sort((a, b) => {
                if (a.company_name !== b.company_name) {
                    return a.company_name.localeCompare(b.company_name);
                }
                return a.employee_name.localeCompare(b.employee_name);
            });
            
            all_employees.forEach((employee) => {
                calendar_html += this.create_unified_employee_row(employee, date_range);
            });
            
            calendar_html += '</div>';
            
            return calendar_html;
            
        } catch (e) {
            console.error('Error creating unified calendar grid:', e);
            return '<div class="error-message">Error creating unified calendar grid</div>';
        }
    }

    create_unified_employee_row(employee, date_range) {
        try {
            var conflict_class = employee.conflicts.length > 0 ? 'employee-with-conflicts' : '';
            var row_html = `<div class="employee-calendar-row unified-employee-row ${conflict_class}" data-employee="${employee.employee_id}">`;
            
            // Employee info column with company information
            row_html += `<div class="employee-info-cell unified-employee-info">
                <div class="employee-name">${employee.employee_name}</div>
                <div class="employee-company">${employee.company_name}</div>
                <div class="employee-dept">${employee.department || ''}</div>
                ${employee.conflicts.length > 0 ? 
                    `<div class="conflict-badge">${employee.conflicts.length} conflicts</div>` : ''}
            </div>`;
            
            // Week columns
            var weeks = this.group_dates_by_week(date_range);
            
            weeks.forEach((week) => {
                row_html += '<div class="week-group">';
                row_html += '<div class="days-row">';
                
                week.forEach((date) => {
                    // Convert string date to Date object if needed, but keep original for date_str
                    var date_str = typeof date === 'string' ? date : date.toISOString().split('T')[0];
                    var daily_record = this.find_daily_record(employee, date_str);
                    var cell_html = this.create_daily_status_cell(daily_record, date, employee);
                    
                    row_html += cell_html;
                });
                
                row_html += '</div></div>';
            });
            
            row_html += '</div>';
            return row_html;
            
        } catch (e) {
            console.error('Error creating unified employee row:', e);
            return '<div class="error-message">Error creating unified employee row</div>';
        }
    }

    create_calendar_header(date_range) {
        try {
            var header_html = '<div class="calendar-header-row">';
            
            // Employee name column
            header_html += '<div class="header-cell employee-name-header">Employee</div>';
            
            // Week headers and day headers
            var weeks = this.group_dates_by_week(date_range);
            
            weeks.forEach((week, week_index) => {
                header_html += `<div class="week-group">`;
                header_html += `<div class="week-header">Week ${week_index + 1}</div>`;
                header_html += '<div class="days-header">';
                
                week.forEach((date) => {
                    // Convert string date to Date object if needed
                    var date_obj = typeof date === 'string' ? new Date(date) : date;
                    var day_name = date_obj.toLocaleDateString('en', { weekday: 'short' });
                    var day_num = date_obj.getDate();
                    var is_weekend = date_obj.getDay() === 0 || date_obj.getDay() === 6;
                    var is_today = this.is_today(date_obj);
                    
                    var day_class = 'day-header';
                    if (is_weekend) day_class += ' weekend';
                    if (is_today) day_class += ' today';
                    
                    var date_str_for_attr = typeof date === 'string' ? date : date_obj.toISOString().split('T')[0];
                    header_html += `<div class="${day_class}" data-date="${date_str_for_attr}">
                        <div class="day-name">${day_name}</div>
                        <div class="day-number">${day_num}</div>
                    </div>`;
                });
                
                header_html += '</div></div>';
            });
            
            header_html += '</div>';
            return header_html;
            
        } catch (e) {
            console.error('Error creating calendar header:', e);
            return '<div class="error-message">Error creating header</div>';
        }
    }

    create_employee_calendar_row(employee, date_range) {
        try {
            var conflict_class = employee.conflicts.length > 0 ? 'employee-with-conflicts' : '';
            var row_html = `<div class="employee-calendar-row ${conflict_class}" data-employee="${employee.employee_id}">`;
            
            // Employee info column
            row_html += `<div class="employee-info-cell">
                <div class="employee-name">${employee.employee_name}</div>
                <div class="employee-dept">${employee.department || ''}</div>
                ${employee.conflicts.length > 0 ? 
                    `<div class="conflict-badge">${employee.conflicts.length} conflicts</div>` : ''}
            </div>`;
            
            // Week columns
            var weeks = this.group_dates_by_week(date_range);
            
            weeks.forEach((week) => {
                row_html += '<div class="week-group">';
                row_html += '<div class="days-row">';
                
                week.forEach((date) => {
                    // Convert string date to Date object if needed, but keep original for date_str
                    var date_str = typeof date === 'string' ? date : date.toISOString().split('T')[0];
                    var daily_record = this.find_daily_record(employee, date_str);
                    var cell_html = this.create_daily_status_cell(daily_record, date, employee);
                    
                    row_html += cell_html;
                });
                
                row_html += '</div></div>';
            });
            
            row_html += '</div>';
            return row_html;
            
        } catch (e) {
            console.error('Error creating employee calendar row:', e);
            return '<div class="error-message">Error creating employee row</div>';
        }
    }

    create_daily_status_cell(daily_record, date, employee) {
        try {
            // Convert string date to Date object if needed
            var date_obj = typeof date === 'string' ? new Date(date) : date;
            var date_str = typeof date === 'string' ? date : date.toISOString().split('T')[0];
            var is_weekend = date_obj.getDay() === 0 || date_obj.getDay() === 6;
            var is_today = this.is_today(date_obj);
            
            var cell_class = 'daily-status-cell';
            if (is_weekend) cell_class += ' weekend';
            if (is_today) cell_class += ' today';
            if (daily_record && daily_record.conflicts && daily_record.conflicts.length > 0) {
                cell_class += ' has-conflict';
            }
            
            var cell_html = `<div class="${cell_class}" 
                data-employee="${employee.employee_id}" 
                data-date="${date_str}"
                title="Click for details">`;
            
            // Add status indicators
            if (daily_record && daily_record.status_indicators) {
                daily_record.status_indicators.forEach((indicator) => {
                    cell_html += `<span class="status-indicator ${indicator}">${indicator}</span>`;
                });
            }
            
            // Add conflict indicator
            if (daily_record && daily_record.conflicts && daily_record.conflicts.length > 0) {
                cell_html += '<span class="conflict-indicator">🔴</span>';
            }
            
            // If no indicators, show empty state
            if (!daily_record || !daily_record.status_indicators || daily_record.status_indicators.length === 0) {
                cell_html += '<span class="no-status">-</span>';
            }
            
            cell_html += '</div>';
            return cell_html;
            
        } catch (e) {
            console.error('Error creating daily status cell:', e);
            return '<div class="daily-status-cell error">?</div>';
        }
    }

    group_dates_by_week(date_range) {
        try {
            var weeks = [];
            var current_week = [];
            
            date_range.forEach((date, index) => {
                // Convert string date to Date object if needed
                var date_obj = typeof date === 'string' ? new Date(date) : date;
                current_week.push(date);
                
                // If it's Sunday (end of week) or last date, start new week
                if (date_obj.getDay() === 0 || index === date_range.length - 1) {
                    weeks.push([...current_week]);
                    current_week = [];
                }
                
                // If we have 4 weeks, break (4-week limit)
                if (weeks.length >= 4) {
                    return weeks;
                }
            });
            
            // Ensure we have exactly 4 weeks (pad if necessary)
            while (weeks.length < 4) {
                weeks.push([]);
            }
            
            return weeks.slice(0, 4); // Limit to 4 weeks
            
        } catch (e) {
            console.error('Error grouping dates by week:', e);
            return [[], [], [], []]; // Return 4 empty weeks
        }
    }

    find_daily_record(employee, date_str) {
        try {
            if (!employee.daily_records) return null;
            
            return employee.daily_records.find(record => record.date === date_str);
            
        } catch (e) {
            console.error('Error finding daily record:', e);
            return null;
        }
    }

    is_today(date) {
        try {
            var today = new Date();
            var date_obj = typeof date === 'string' ? new Date(date) : date;
            return date_obj.toDateString() === today.toDateString();
        } catch (e) {
            return false;
        }
    }

    setup_unified_calendar_interactions(unified_section, all_employees) {
        try {
            var self = this;
            
            // Click handler for daily status cells in unified view
            unified_section.find('.daily-status-cell').on('click', function() {
                var employee_id = $(this).data('employee');
                var date = $(this).data('date');
                
                // Find the employee in the unified list
                var employee = all_employees.find(emp => emp.employee_id === employee_id);
                if (!employee) return;
                
                if ($(this).hasClass('has-conflict')) {
                    self.show_unified_conflict_details(employee_id, date, employee);
                } else {
                    self.show_unified_day_details(employee_id, date, employee);
                }
            });
            
            // Hover handler for conflict tooltips in unified view
            unified_section.find('.daily-status-cell.has-conflict').on('mouseenter', function(e) {
                self.show_conflict_tooltip($(this), e);
            }).on('mouseleave', function() {
                self.hide_conflict_tooltip();
            });
            
        } catch (e) {
            console.error('Error setting up unified calendar interactions:', e);
        }
    }

    setup_calendar_interactions(company_section, company) {
        try {
            var self = this;
            
            // Click handler for daily status cells
            company_section.find('.daily-status-cell').on('click', function() {
                var employee_id = $(this).data('employee');
                var date = $(this).data('date');
                
                if ($(this).hasClass('has-conflict')) {
                    self.show_conflict_details(employee_id, date, company);
                } else {
                    self.show_day_details(employee_id, date, company);
                }
            });
            
            // Hover handler for conflict tooltips
            company_section.find('.daily-status-cell.has-conflict').on('mouseenter', function(e) {
                self.show_conflict_tooltip($(this), e);
            }).on('mouseleave', function() {
                self.hide_conflict_tooltip();
            });
            
        } catch (e) {
            console.error('Error setting up calendar interactions:', e);
        }
    }

    show_no_data() {
        try {
            this.page.main.find('.loading-message').html(`
                <div style="text-align: center; padding: 50px;">
                    <h5>No Data Found</h5>
                    <p>No employees or data found for the selected filters.</p>
                    <p>Please try adjusting your filter criteria.</p>
                </div>
            `).show();

            this.page.main.find('.companies-container').hide();

        } catch (e) {
            console.error('Error showing no data message:', e);
        }
    }

    show_error(message) {
        try {
            var error_html = `
                <div style="text-align: center; padding: 50px; color: #dc3545;">
                    <h5>Error</h5>
                    <p>${message}</p>
                    <button class="btn btn-primary retry-btn">Retry</button>
                </div>
            `;

            this.page.main.find('.loading-message').html(error_html).show();
            this.page.main.find('.companies-container').hide();

            // Add retry handler
            var self = this;
            this.page.main.find('.retry-btn').on('click', function() {
                self.load_data();
            });

        } catch (e) {
            console.error('Error showing error message:', e);
        }
    }

    refresh() {
        try {
            if (!this.loading && !this.initializing) {
                console.log('Refreshing dashboard...');
                this.load_data();
            }
        } catch (e) {
            console.error('Error in refresh():', e);
        }
    }

    export_data(format) {
        try {
            if (!this.dashboard_data) {
                frappe.msgprint('No data to export. Please load data first.');
                return;
            }

            console.log('Exporting data in format:', format);
            // TODO: Implement export functionality
            frappe.msgprint('Export functionality coming soon...');

        } catch (e) {
            console.error('Error exporting data:', e);
        }
    }

    print_dashboard() {
        try {
            if (!this.dashboard_data) {
                frappe.msgprint('No data to print. Please load data first.');
                return;
            }

            console.log('Printing dashboard...');
            // TODO: Implement print functionality
            frappe.msgprint('Print functionality coming soon...');

        } catch (e) {
            console.error('Error printing dashboard:', e);
        }
    }

    show_conflict_tooltip(cell_element, event) {
        try {
            var employee_id = cell_element.data('employee');
            var date = cell_element.data('date');
            
            // Find the employee and daily record
            var employee = this.find_employee_by_id(employee_id);
            var daily_record = this.find_daily_record(employee, date);
            
            if (!daily_record || !daily_record.conflicts || daily_record.conflicts.length === 0) {
                return;
            }
            
            // Create tooltip content
            var tooltip_content = '<div class="conflict-tooltip-content">';
            tooltip_content += `<div class="tooltip-header">${employee.employee_name} - ${date}</div>`;
            tooltip_content += '<div class="conflicts-list">';
            
            daily_record.conflicts.forEach((conflict) => {
                var priority_class = `priority-${conflict.priority}`;
                tooltip_content += `<div class="conflict-item ${priority_class}">
                    <span class="priority-badge">${conflict.priority.toUpperCase()}</span>
                    <span class="conflict-desc">${conflict.description}</span>
                </div>`;
            });
            
            tooltip_content += '</div>';
            tooltip_content += '<div class="tooltip-footer">Click for details</div>';
            tooltip_content += '</div>';
            
            // Remove existing tooltip
            this.hide_conflict_tooltip();
            
            // Create and position tooltip
            var tooltip = $(`<div class="conflict-tooltip">${tooltip_content}</div>`);
            $('body').append(tooltip);
            
            // Position tooltip
            var cell_offset = cell_element.offset();
            var cell_height = cell_element.outerHeight();
            
            tooltip.css({
                top: cell_offset.top + cell_height + 5,
                left: cell_offset.left,
                display: 'block'
            });
            
            // Adjust if tooltip goes off screen
            var tooltip_width = tooltip.outerWidth();
            var window_width = $(window).width();
            
            if (cell_offset.left + tooltip_width > window_width) {
                tooltip.css('left', window_width - tooltip_width - 10);
            }
            
        } catch (e) {
            console.error('Error showing conflict tooltip:', e);
        }
    }

    hide_conflict_tooltip() {
        try {
            $('.conflict-tooltip').remove();
        } catch (e) {
            console.error('Error hiding conflict tooltip:', e);
        }
    }

    show_unified_conflict_details(employee_id, date, employee) {
        try {
            var daily_record = this.find_daily_record(employee, date);
            
            if (!employee || !daily_record) {
                frappe.msgprint('No data found for selected date');
                return;
            }
            
            // Create detailed modal with company info
            var modal_content = this.create_unified_conflict_details_modal(employee, daily_record, date);
            
            // Show modal
            var modal = new frappe.ui.Dialog({
                title: `Conflict Details - ${employee.employee_name} (${employee.company_name})`,
                fields: [
                    {
                        fieldtype: 'HTML',
                        fieldname: 'conflict_details',
                        options: modal_content
                    }
                ],
                primary_action_label: 'Close',
                primary_action: function() {
                    modal.hide();
                }
            });
            
            modal.show();
            
        } catch (e) {
            console.error('Error showing unified conflict details:', e);
            frappe.msgprint('Error loading conflict details');
        }
    }

    show_unified_day_details(employee_id, date, employee) {
        try {
            var daily_record = this.find_daily_record(employee, date);
            
            if (!employee) {
                frappe.msgprint('Employee not found');
                return;
            }
            
            // Create detailed modal with company info
            var modal_content = this.create_unified_day_details_modal(employee, daily_record, date);
            
            // Show modal
            var modal = new frappe.ui.Dialog({
                title: `Day Details - ${employee.employee_name} (${employee.company_name})`,
                fields: [
                    {
                        fieldtype: 'HTML',
                        fieldname: 'day_details',
                        options: modal_content
                    }
                ],
                primary_action_label: 'Close',
                primary_action: function() {
                    modal.hide();
                }
            });
            
            modal.show();
            
        } catch (e) {
            console.error('Error showing unified day details:', e);
            frappe.msgprint('Error loading day details');
        }
    }

    show_conflict_details(employee_id, date, company) {
        try {
            var employee = this.find_employee_by_id(employee_id);
            var daily_record = this.find_daily_record(employee, date);
            
            if (!employee || !daily_record) {
                frappe.msgprint('No data found for selected date');
                return;
            }
            
            // Create detailed modal
            var modal_content = this.create_conflict_details_modal(employee, daily_record, date);
            
            // Show modal
            var modal = new frappe.ui.Dialog({
                title: `Conflict Details - ${employee.employee_name}`,
                fields: [
                    {
                        fieldtype: 'HTML',
                        fieldname: 'conflict_details',
                        options: modal_content
                    }
                ],
                primary_action_label: 'Close',
                primary_action: function() {
                    modal.hide();
                }
            });
            
            modal.show();
            
        } catch (e) {
            console.error('Error showing conflict details:', e);
            frappe.msgprint('Error loading conflict details');
        }
    }

    show_day_details(employee_id, date, company) {
        try {
            var employee = this.find_employee_by_id(employee_id);
            var daily_record = this.find_daily_record(employee, date);
            
            if (!employee) {
                frappe.msgprint('Employee not found');
                return;
            }
            
            // Create day details modal
            var modal_content = this.create_day_details_modal(employee, daily_record, date);
            
            // Show modal
            var modal = new frappe.ui.Dialog({
                title: `Day Details - ${employee.employee_name}`,
                fields: [
                    {
                        fieldtype: 'HTML',
                        fieldname: 'day_details',
                        options: modal_content
                    }
                ],
                primary_action_label: 'Close',
                primary_action: function() {
                    modal.hide();
                }
            });
            
            modal.show();
            
        } catch (e) {
            console.error('Error showing day details:', e);
            frappe.msgprint('Error loading day details');
        }
    }

    create_unified_conflict_details_modal(employee, daily_record, date) {
        try {
            var content = `
                <div class="conflict-details-modal unified-modal">
                    <div class="employee-info-section">
                        <h5>${employee.employee_name}</h5>
                        <p><strong>Company:</strong> ${employee.company_name}</p>
                        <p><strong>Department:</strong> ${employee.department}</p>
                        <p><strong>Date:</strong> ${date}</p>
                    </div>
                    
                    <div class="conflicts-section">
                        <h6>Department Leave Conflicts Found (${daily_record.conflicts.length})</h6>
            `;
            
            daily_record.conflicts.forEach((conflict, index) => {
                var priority_color = {
                    'high': '#dc3545',
                    'medium': '#ffc107',
                    'low': '#28a745'
                };
                
                content += `
                    <div class="conflict-item" style="border-left: 4px solid ${priority_color[conflict.priority] || '#6c757d'};">
                        <div class="conflict-header">
                            <strong>Conflict ${index + 1}</strong>
                            <span class="badge badge-${conflict.priority === 'high' ? 'danger' : conflict.priority === 'medium' ? 'warning' : 'success'}">${conflict.priority}</span>
                        </div>
                        <div class="conflict-description">${conflict.description}</div>
                    </div>
                `;
            });
            
            // Show leave information if available
            if (daily_record.leave) {
                content += `
                    <div class="status-section">
                        <h6>Leave Application</h6>
                        <p><strong>Type:</strong> ${daily_record.leave.leave_type}</p>
                        <p><strong>Status:</strong> ${daily_record.leave.status}</p>
                        <p><strong>Period:</strong> ${daily_record.leave.from_date} to ${daily_record.leave.to_date}</p>
                    </div>
                `;
            }
            
            content += '</div></div>';
            
            return content;
            
        } catch (e) {
            console.error('Error creating unified conflict details modal:', e);
            return '<div class="error-message">Error creating conflict details</div>';
        }
    }

    create_unified_day_details_modal(employee, daily_record, date) {
        try {
            var content = `
                <div class="day-details-modal unified-modal">
                    <div class="employee-info-section">
                        <h5>${employee.employee_name}</h5>
                        <p><strong>Company:</strong> ${employee.company_name}</p>
                        <p><strong>Department:</strong> ${employee.department}</p>
                        <p><strong>Date:</strong> ${date}</p>
                    </div>
            `;
            
            // Show status indicators
            if (daily_record && daily_record.status_indicators && daily_record.status_indicators.length > 0) {
                content += '<div class="status-section">';
                content += '<h6>Status</h6>';
                
                if (daily_record.attendance) {
                    content += `
                        <div class="status-item attendance">
                            <h6>✅ Attendance</h6>
                            <p><strong>First Check-in:</strong> ${daily_record.attendance.first_checkin || 'N/A'}</p>
                            <p><strong>Last Checkout:</strong> ${daily_record.attendance.last_checkout || 'N/A'}</p>
                        </div>
                    `;
                }
                
                if (daily_record.leave) {
                    content += `
                        <div class="status-item leave">
                            <h6>🏖️ Leave Application</h6>
                            <p><strong>Type:</strong> ${daily_record.leave.leave_type}</p>
                            <p><strong>Status:</strong> ${daily_record.leave.status}</p>
                            <p><strong>Period:</strong> ${daily_record.leave.from_date} to ${daily_record.leave.to_date}</p>
                        </div>
                    `;
                }
                
                content += '</div>';
            }
            
            content += '</div>';
            
            return content;
            
        } catch (e) {
            console.error('Error creating unified day details modal:', e);
            return '<div class="error-message">Error creating day details</div>';
        }
    }

    create_conflict_details_modal(employee, daily_record, date) {
        try {
            var content = `
                <div class="conflict-details-modal">
                    <div class="employee-info-section">
                        <h5>${employee.employee_name}</h5>
                        <p><strong>Department:</strong> ${employee.department}</p>
                        <p><strong>Date:</strong> ${date}</p>
                    </div>
                    
                    <div class="conflicts-section">
                        <h6>Conflicts Found (${daily_record.conflicts.length})</h6>
            `;
            
            daily_record.conflicts.forEach((conflict, index) => {
                var priority_color = {
                    'high': '#dc3545',
                    'medium': '#ffc107', 
                    'low': '#6c757d'
                }[conflict.priority] || '#6c757d';
                
                content += `
                    <div class="conflict-detail-item" style="border-left: 4px solid ${priority_color};">
                        <div class="conflict-header">
                            <span class="conflict-priority" style="background: ${priority_color};">
                                ${conflict.priority.toUpperCase()}
                            </span>
                            <span class="conflict-type">${conflict.type.replace(/_/g, ' ')}</span>
                        </div>
                        <div class="conflict-description">${conflict.description}</div>
                    </div>
                `;
            });
            
            content += '</div>';
            
            // Add status information
            content += '<div class="status-section"><h6>Day Status</h6>';
            
            if (daily_record.attendance) {
                content += '<p><strong>✓ Attended:</strong> ' + 
                    (daily_record.attendance.first_checkin || 'Yes') + '</p>';
            }
            
            if (daily_record.leave) {
                content += '<p><strong>🏖️ Leave:</strong> ' + 
                    daily_record.leave.leave_type + ' (' + daily_record.leave.status + ')</p>';
            }
            

            
            content += '</div></div>';
            
            return content;
            
        } catch (e) {
            console.error('Error creating conflict details modal:', e);
            return '<div class="error-message">Error creating conflict details</div>';
        }
    }

    create_day_details_modal(employee, daily_record, date) {
        try {
            var content = `
                <div class="day-details-modal">
                    <div class="employee-info-section">
                        <h5>${employee.employee_name}</h5>
                        <p><strong>Department:</strong> ${employee.department}</p>
                        <p><strong>Date:</strong> ${date}</p>
                    </div>
            `;
            
            if (!daily_record) {
                content += '<div class="no-data-section"><p>No attendance or requests recorded for this date.</p></div>';
            } else {
                content += '<div class="status-details-section">';
                
                if (daily_record.attendance) {
                    content += `
                        <div class="status-item attendance">
                            <h6>✓ Attendance</h6>
                            <p><strong>First Check-in:</strong> ${daily_record.attendance.first_checkin || 'N/A'}</p>
                            <p><strong>Last Check-out:</strong> ${daily_record.attendance.last_checkout || 'N/A'}</p>
                            <p><strong>Check-ins:</strong> ${daily_record.attendance.checkin_count || 0}</p>
                        </div>
                    `;
                }
                
                if (daily_record.leave) {
                    content += `
                        <div class="status-item leave">
                            <h6>🏖️ Leave Application</h6>
                            <p><strong>Type:</strong> ${daily_record.leave.leave_type}</p>
                            <p><strong>Status:</strong> ${daily_record.leave.status}</p>
                            <p><strong>Duration:</strong> ${daily_record.leave.from_date} to ${daily_record.leave.to_date}</p>
                            ${daily_record.leave.description ? `<p><strong>Reason:</strong> ${daily_record.leave.description}</p>` : ''}
                        </div>
                    `;
                }
                

                
                content += '</div>';
            }
            
            content += '</div>';
            
            return content;
            
        } catch (e) {
            console.error('Error creating day details modal:', e);
            return '<div class="error-message">Error creating day details</div>';
        }
    }

    find_employee_by_id(employee_id) {
        try {
            if (!this.dashboard_data || !this.dashboard_data.companies) return null;
            
            for (let company of this.dashboard_data.companies) {
                for (let employee of company.employees) {
                    if (employee.employee_id === employee_id) {
                        return employee;
                    }
                }
            }
            
            return null;
            
        } catch (e) {
            console.error('Error finding employee by ID:', e);
            return null;
        }
    }

    // Advanced Conflict Resolution Tools
    show_conflict_resolution_panel() {
        try {
            if (!this.dashboard_data || !this.dashboard_data.companies || this.dashboard_data.companies.length === 0) {
                frappe.msgprint(__('No data available. Please load data first.'));
                return;
            }

            // Collect all conflicts
            const conflicts = this.collect_all_conflicts();
            
            if (conflicts.length === 0) {
                frappe.msgprint(__('No conflicts found in the current data.'));
                return;
            }

            // Show conflict resolution dialog
            this.create_conflict_resolution_dialog(conflicts);

        } catch (e) {
            console.error('Error showing conflict resolution panel:', e);
            frappe.msgprint(__('Error opening conflict resolution panel: ') + (e.message || 'Unknown error'));
        }
    }

    collect_all_conflicts() {
        try {
            const conflicts = [];
            
            this.dashboard_data.companies.forEach(company => {
                company.employees.forEach(employee => {
                    if (employee.daily_records) {
                        employee.daily_records.forEach(record => {
                            if (record.has_conflict && record.conflicts) {
                                record.conflicts.forEach(conflict => {
                                    conflicts.push({
                                        id: `${employee.employee_id}_${record.date}_${conflict.type}`,
                                        company: company.name,
                                        employee_id: employee.employee_id,
                                        employee_name: employee.employee_name,
                                        department: employee.department,
                                        date: record.date,
                                        conflict_type: conflict.type,
                                        priority: conflict.priority,
                                        description: conflict.description,
                                        status: 'pending',
                                        daily_record: record
                                    });
                                });
                            }
                        });
                    }
                });
            });
            
            return conflicts.sort((a, b) => {
                // Sort by priority (high first), then by date
                const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
                const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                if (priorityDiff !== 0) return priorityDiff;
                
                return new Date(a.date) - new Date(b.date);
            });
            
        } catch (e) {
            console.error('Error collecting conflicts:', e);
            return [];
        }
    }

    create_conflict_resolution_dialog(conflicts) {
        try {
            const dialog = new frappe.ui.Dialog({
                title: `Conflict Resolution Center (${conflicts.length} conflicts)`,
                size: 'extra-large',
                fields: [
                    {
                        fieldtype: 'HTML',
                        fieldname: 'conflict_tools',
                        options: this.generate_conflict_tools_html()
                    },
                    {
                        fieldtype: 'HTML',
                        fieldname: 'conflicts_list',
                        options: this.generate_conflicts_list_html(conflicts)
                    }
                ],
                primary_action_label: 'Apply Resolutions',
                primary_action: () => {
                    this.apply_conflict_resolutions(dialog, conflicts);
                },
                secondary_action_label: 'Export Conflicts',
                secondary_action: () => {
                    this.export_conflicts(conflicts);
                }
            });

            // Store conflicts in dialog for reference
            dialog.conflicts = conflicts;
            
            // Setup event handlers
            this.setup_conflict_dialog_events(dialog);
            
            dialog.show();

        } catch (e) {
            console.error('Error creating conflict resolution dialog:', e);
            frappe.msgprint(__('Error creating conflict resolution dialog: ') + (e.message || 'Unknown error'));
        }
    }

    generate_conflict_tools_html() {
        return `
            <div class="conflict-tools-panel">
                <div class="row">
                    <div class="col-md-3">
                        <div class="form-group">
                            <label>Filter by Priority</label>
                            <select class="form-control conflict-filter-priority">
                                <option value="">All Priorities</option>
                                <option value="high">High Priority</option>
                                <option value="medium">Medium Priority</option>
                                <option value="low">Low Priority</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group">
                            <label>Filter by Type</label>
                            <select class="form-control conflict-filter-type">
                                <option value="">All Types</option>
                                <option value="attendance_leave_conflict">Attendance vs Leave</option>
                                <option value="department_leave_conflict">Department Leave Conflicts</option>
                            </select>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group">
                            <label>Filter by Company</label>
                            <select class="form-control conflict-filter-company">
                                <option value="">All Companies</option>
                                ${this.dashboard_data.companies.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="form-group">
                            <label>Bulk Actions</label>
                            <div class="btn-group" style="width: 100%;">
                                <button class="btn btn-sm btn-success bulk-resolve" title="Mark selected as resolved">
                                    <i class="fa fa-check"></i> Resolve
                                </button>
                                <button class="btn btn-sm btn-warning bulk-ignore" title="Mark selected as ignored">
                                    <i class="fa fa-eye-slash"></i> Ignore
                                </button>
                                <button class="btn btn-sm btn-primary bulk-escalate" title="Escalate selected conflicts">
                                    <i class="fa fa-arrow-up"></i> Escalate
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-12">
                        <div class="conflict-stats">
                            <span class="stat-item">
                                <strong>Total:</strong> <span class="total-conflicts">0</span>
                            </span>
                            <span class="stat-item">
                                <strong>High Priority:</strong> <span class="high-priority-count">0</span>
                            </span>
                            <span class="stat-item">
                                <strong>Selected:</strong> <span class="selected-count">0</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    generate_conflicts_list_html(conflicts) {
        let html = `
            <div class="conflicts-container">
                <div class="conflicts-header">
                    <div class="row">
                        <div class="col-md-1">
                            <input type="checkbox" class="select-all-conflicts" title="Select All">
                        </div>
                        <div class="col-md-2"><strong>Employee</strong></div>
                        <div class="col-md-2"><strong>Date</strong></div>
                        <div class="col-md-2"><strong>Priority</strong></div>
                        <div class="col-md-3"><strong>Description</strong></div>
                        <div class="col-md-2"><strong>Actions</strong></div>
                    </div>
                </div>
                <div class="conflicts-list">
        `;

        conflicts.forEach((conflict, index) => {
            const priorityClass = `priority-${conflict.priority}`;
            const priorityIcon = conflict.priority === 'high' ? '🔴' : conflict.priority === 'medium' ? '🟡' : '🟢';
            
            html += `
                <div class="conflict-item ${priorityClass}" data-conflict-id="${conflict.id}" data-index="${index}">
                    <div class="row">
                        <div class="col-md-1">
                            <input type="checkbox" class="conflict-checkbox" data-conflict-id="${conflict.id}">
                        </div>
                        <div class="col-md-2">
                            <strong>${conflict.employee_name}</strong>
                            <br><small>${conflict.employee_id} | ${conflict.department}</small>
                        </div>
                        <div class="col-md-2">
                            <strong>${moment(conflict.date).format('DD-MM-YYYY')}</strong>
                            <br><small>${moment(conflict.date).format('dddd')}</small>
                        </div>
                        <div class="col-md-2">
                            <span class="priority-badge ${priorityClass}">
                                ${priorityIcon} ${conflict.priority.toUpperCase()}
                            </span>
                        </div>
                        <div class="col-md-3">
                            <div class="conflict-description">${conflict.description}</div>
                            <small class="conflict-type">${conflict.conflict_type.replace(/_/g, ' ').toUpperCase()}</small>
                        </div>
                        <div class="col-md-2">
                            <div class="btn-group btn-group-sm">
                                <button class="btn btn-success btn-sm resolve-conflict" 
                                        data-conflict-id="${conflict.id}" title="Resolve">
                                    <i class="fa fa-check"></i>
                                </button>
                                <button class="btn btn-warning btn-sm ignore-conflict" 
                                        data-conflict-id="${conflict.id}" title="Ignore">
                                    <i class="fa fa-eye-slash"></i>
                                </button>
                                <button class="btn btn-info btn-sm view-details" 
                                        data-conflict-id="${conflict.id}" title="View Details">
                                    <i class="fa fa-info"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;

        return html;
    }

    setup_conflict_dialog_events(dialog) {
        try {
            const wrapper = dialog.$wrapper;
            
            // Filter events
            wrapper.find('.conflict-filter-priority, .conflict-filter-type, .conflict-filter-company').on('change', () => {
                this.filter_conflicts(dialog);
            });
            
            // Select all checkbox
            wrapper.find('.select-all-conflicts').on('change', function() {
                const isChecked = $(this).is(':checked');
                wrapper.find('.conflict-checkbox:visible').prop('checked', isChecked);
                dialog.update_selection_count();
            });
            
            // Individual conflict checkboxes
            wrapper.find('.conflict-checkbox').on('change', () => {
                this.update_selection_count(dialog);
            });
            
            // Individual conflict actions
            wrapper.find('.resolve-conflict').on('click', (e) => {
                const conflictId = $(e.currentTarget).data('conflict-id');
                this.resolve_single_conflict(dialog, conflictId);
            });
            
            wrapper.find('.ignore-conflict').on('click', (e) => {
                const conflictId = $(e.currentTarget).data('conflict-id');
                this.ignore_single_conflict(dialog, conflictId);
            });
            
            wrapper.find('.view-details').on('click', (e) => {
                const conflictId = $(e.currentTarget).data('conflict-id');
                this.view_conflict_details(dialog, conflictId);
            });
            
            // Bulk actions
            wrapper.find('.bulk-resolve').on('click', () => {
                this.bulk_resolve_conflicts(dialog);
            });
            
            wrapper.find('.bulk-ignore').on('click', () => {
                this.bulk_ignore_conflicts(dialog);
            });
            
            wrapper.find('.bulk-escalate').on('click', () => {
                this.bulk_escalate_conflicts(dialog);
            });
            
            // Initialize stats
            this.update_conflict_stats(dialog);
            
        } catch (e) {
            console.error('Error setting up conflict dialog events:', e);
        }
    }

    filter_conflicts(dialog) {
        try {
            const wrapper = dialog.$wrapper;
            const priorityFilter = wrapper.find('.conflict-filter-priority').val();
            const typeFilter = wrapper.find('.conflict-filter-type').val();
            const companyFilter = wrapper.find('.conflict-filter-company').val();
            
            wrapper.find('.conflict-item').each(function() {
                const item = $(this);
                const conflict = dialog.conflicts.find(c => c.id === item.data('conflict-id'));
                
                let show = true;
                
                if (priorityFilter && conflict.priority !== priorityFilter) {
                    show = false;
                }
                
                if (typeFilter && conflict.conflict_type !== typeFilter) {
                    show = false;
                }
                
                if (companyFilter && conflict.company !== companyFilter) {
                    show = false;
                }
                
                item.toggle(show);
            });
            
            this.update_conflict_stats(dialog);
            
        } catch (e) {
            console.error('Error filtering conflicts:', e);
        }
    }

    update_selection_count(dialog) {
        try {
            const wrapper = dialog.$wrapper;
            const selectedCount = wrapper.find('.conflict-checkbox:checked').length;
            wrapper.find('.selected-count').text(selectedCount);
            
        } catch (e) {
            console.error('Error updating selection count:', e);
        }
    }

    update_conflict_stats(dialog) {
        try {
            const wrapper = dialog.$wrapper;
            const visibleConflicts = wrapper.find('.conflict-item:visible');
            const totalCount = visibleConflicts.length;
            const highPriorityCount = visibleConflicts.filter('.priority-high').length;
            
            wrapper.find('.total-conflicts').text(totalCount);
            wrapper.find('.high-priority-count').text(highPriorityCount);
            
        } catch (e) {
            console.error('Error updating conflict stats:', e);
        }
    }

    resolve_single_conflict(dialog, conflictId) {
        try {
            const conflict = dialog.conflicts.find(c => c.id === conflictId);
            if (!conflict) return;
            
            // Mark as resolved
            conflict.status = 'resolved';
            conflict.resolved_at = new Date().toISOString();
            conflict.resolved_by = frappe.session.user;
            
            // Update UI
            const wrapper = dialog.$wrapper;
            const item = wrapper.find(`.conflict-item[data-conflict-id="${conflictId}"]`);
            item.addClass('resolved').find('.resolve-conflict').prop('disabled', true);
            
            frappe.show_alert({
                message: 'Conflict marked as resolved',
                indicator: 'green'
            });
            
        } catch (e) {
            console.error('Error resolving single conflict:', e);
        }
    }

    ignore_single_conflict(dialog, conflictId) {
        try {
            const conflict = dialog.conflicts.find(c => c.id === conflictId);
            if (!conflict) return;
            
            // Mark as ignored
            conflict.status = 'ignored';
            conflict.ignored_at = new Date().toISOString();
            conflict.ignored_by = frappe.session.user;
            
            // Update UI
            const wrapper = dialog.$wrapper;
            const item = wrapper.find(`.conflict-item[data-conflict-id="${conflictId}"]`);
            item.addClass('ignored').find('.ignore-conflict').prop('disabled', true);
            
            frappe.show_alert({
                message: 'Conflict marked as ignored',
                indicator: 'orange'
            });
            
        } catch (e) {
            console.error('Error ignoring single conflict:', e);
        }
    }

    view_conflict_details(dialog, conflictId) {
        try {
            const conflict = dialog.conflicts.find(c => c.id === conflictId);
            if (!conflict) return;
            
            // Show detailed conflict information
            const detailsDialog = new frappe.ui.Dialog({
                title: `Conflict Details - ${conflict.employee_name}`,
                fields: [
                    {
                        fieldtype: 'HTML',
                        options: `
                            <div class="conflict-details-view">
                                <h5>Employee Information</h5>
                                <p><strong>Name:</strong> ${conflict.employee_name}</p>
                                <p><strong>ID:</strong> ${conflict.employee_id}</p>
                                <p><strong>Department:</strong> ${conflict.department}</p>
                                <p><strong>Company:</strong> ${conflict.company}</p>
                                
                                <h5>Conflict Information</h5>
                                <p><strong>Date:</strong> ${moment(conflict.date).format('DD-MM-YYYY (dddd)')}</p>
                                <p><strong>Type:</strong> ${conflict.conflict_type.replace(/_/g, ' ').toUpperCase()}</p>
                                <p><strong>Priority:</strong> <span class="priority-badge priority-${conflict.priority}">${conflict.priority.toUpperCase()}</span></p>
                                <p><strong>Description:</strong> ${conflict.description}</p>
                                
                                <h5>Daily Record Details</h5>
                                <p><strong>Status Indicators:</strong> ${conflict.daily_record.status_indicators ? conflict.daily_record.status_indicators.join(', ') : 'None'}</p>
                                
                                ${conflict.daily_record.attendance ? `
                                    <h6>Attendance</h6>
                                    <p>Check-in: ${conflict.daily_record.attendance.time || 'N/A'}</p>
                                ` : ''}
                                
                                ${conflict.daily_record.leave ? `
                                    <h6>Leave Application</h6>
                                    <p>Type: ${conflict.daily_record.leave.leave_type || 'N/A'}</p>
                                    <p>Status: ${conflict.daily_record.leave.status || 'N/A'}</p>
                                    <p>Duration: ${conflict.daily_record.leave.from_date} to ${conflict.daily_record.leave.to_date}</p>
                                ` : ''}
                                

                            </div>
                        `
                    }
                ]
            });
            
            detailsDialog.show();
            
        } catch (e) {
            console.error('Error viewing conflict details:', e);
        }
    }

    bulk_resolve_conflicts(dialog) {
        try {
            const wrapper = dialog.$wrapper;
            const selectedConflicts = wrapper.find('.conflict-checkbox:checked');
            
            if (selectedConflicts.length === 0) {
                frappe.msgprint(__('Please select conflicts to resolve.'));
                return;
            }
            
            selectedConflicts.each((index, checkbox) => {
                const conflictId = $(checkbox).data('conflict-id');
                this.resolve_single_conflict(dialog, conflictId);
            });
            
            frappe.show_alert({
                message: `${selectedConflicts.length} conflicts marked as resolved`,
                indicator: 'green'
            });
            
        } catch (e) {
            console.error('Error bulk resolving conflicts:', e);
        }
    }

    bulk_ignore_conflicts(dialog) {
        try {
            const wrapper = dialog.$wrapper;
            const selectedConflicts = wrapper.find('.conflict-checkbox:checked');
            
            if (selectedConflicts.length === 0) {
                frappe.msgprint(__('Please select conflicts to ignore.'));
                return;
            }
            
            selectedConflicts.each((index, checkbox) => {
                const conflictId = $(checkbox).data('conflict-id');
                this.ignore_single_conflict(dialog, conflictId);
            });
            
            frappe.show_alert({
                message: `${selectedConflicts.length} conflicts marked as ignored`,
                indicator: 'orange'
            });
            
        } catch (e) {
            console.error('Error bulk ignoring conflicts:', e);
        }
    }

    bulk_escalate_conflicts(dialog) {
        try {
            const wrapper = dialog.$wrapper;
            const selectedConflicts = wrapper.find('.conflict-checkbox:checked');
            
            if (selectedConflicts.length === 0) {
                frappe.msgprint(__('Please select conflicts to escalate.'));
                return;
            }
            
            // Create escalation report
            const escalationData = [];
            selectedConflicts.each((index, checkbox) => {
                const conflictId = $(checkbox).data('conflict-id');
                const conflict = dialog.conflicts.find(c => c.id === conflictId);
                if (conflict) {
                    escalationData.push(conflict);
                }
            });
            
            this.create_escalation_report(escalationData);
            
        } catch (e) {
            console.error('Error bulk escalating conflicts:', e);
        }
    }

    create_escalation_report(conflicts) {
        try {
            // Generate escalation report
            const reportData = {
                title: 'HR Utilization Conflicts - Escalation Report',
                generated_on: moment().format('DD-MM-YYYY HH:mm:ss'),
                generated_by: frappe.session.user_fullname,
                total_conflicts: conflicts.length,
                conflicts: conflicts
            };
            
            // Call backend to create escalation report
            frappe.call({
                method: 'svg_mobile_app.svg_mobile_app.page.hr_utilization_dashboard.hr_utilization_dashboard.create_escalation_report',
                args: {
                    data: reportData
                },
                callback: (response) => {
                    if (response.message && response.message.success) {
                        frappe.show_alert({
                            message: 'Escalation report created successfully',
                            indicator: 'blue'
                        });
                        
                        // Optionally open the report
                        if (response.message.file_url) {
                            window.open(response.message.file_url, '_blank');
                        }
                    }
                },
                error: (error) => {
                    console.error('Escalation report error:', error);
                    frappe.msgprint(__('Failed to create escalation report'));
                }
            });
            
        } catch (e) {
            console.error('Error creating escalation report:', e);
        }
    }

    apply_conflict_resolutions(dialog, conflicts) {
        try {
            const resolvedConflicts = conflicts.filter(c => c.status === 'resolved');
            const ignoredConflicts = conflicts.filter(c => c.status === 'ignored');
            
            if (resolvedConflicts.length === 0 && ignoredConflicts.length === 0) {
                frappe.msgprint(__('No conflicts have been processed.'));
                return;
            }
            
            // Save resolution data to backend
            frappe.call({
                method: 'svg_mobile_app.svg_mobile_app.page.hr_utilization_dashboard.hr_utilization_dashboard.save_conflict_resolutions',
                args: {
                    resolved: resolvedConflicts,
                    ignored: ignoredConflicts
                },
                callback: (response) => {
                    if (response.message && response.message.success) {
                        frappe.show_alert({
                            message: `Saved ${resolvedConflicts.length} resolved and ${ignoredConflicts.length} ignored conflicts`,
                            indicator: 'green'
                        });
                        
                        dialog.hide();
                        
                        // Refresh dashboard to show updated conflict status
                        this.load_data();
                    }
                },
                error: (error) => {
                    console.error('Save resolutions error:', error);
                    frappe.msgprint(__('Failed to save conflict resolutions'));
                }
            });
            
        } catch (e) {
            console.error('Error applying conflict resolutions:', e);
        }
    }

    export_conflicts(conflicts) {
        try {
            const exportData = {
                title: 'HR Utilization Conflicts Export',
                generated_on: moment().format('DD-MM-YYYY HH:mm:ss'),
                total_conflicts: conflicts.length,
                conflicts: conflicts.map(c => ({
                    company: c.company,
                    employee_id: c.employee_id,
                    employee_name: c.employee_name,
                    department: c.department,
                    date: c.date,
                    conflict_type: c.conflict_type,
                    priority: c.priority,
                    description: c.description,
                    status: c.status || 'pending'
                }))
            };
            
            // Call backend export
            frappe.call({
                method: 'svg_mobile_app.svg_mobile_app.page.hr_utilization_dashboard.hr_utilization_dashboard.export_conflicts_excel',
                args: {
                    data: exportData
                },
                callback: (response) => {
                    if (response.message && response.message.success) {
                        // Download the file
                        const link = document.createElement('a');
                        link.href = response.message.file_url;
                        link.download = 'HR_Conflicts_Export.xlsx';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        
                        frappe.show_alert({
                            message: 'Conflicts exported successfully',
                            indicator: 'green'
                        });
                    }
                },
                error: (error) => {
                    console.error('Export conflicts error:', error);
                    frappe.msgprint(__('Failed to export conflicts'));
                }
            });
            
        } catch (e) {
            console.error('Error exporting conflicts:', e);
        }
    }

    // Export Functionality
    export_data(format) {
        try {
            if (!this.dashboard_data || !this.dashboard_data.companies || this.dashboard_data.companies.length === 0) {
                frappe.msgprint(__('No data available to export. Please load data first.'));
                return;
            }

            // Show export options dialog
            this.show_export_dialog(format);

        } catch (e) {
            console.error('Error in export_data:', e);
            frappe.msgprint(__('Error preparing export: ') + (e.message || 'Unknown error'));
        }
    }

    show_export_dialog(format) {
        try {
            const formatName = format.toUpperCase();
            const dialog = new frappe.ui.Dialog({
                title: `Export to ${formatName}`,
                fields: [
                    {
                        fieldtype: 'Section Break',
                        label: 'Export Options'
                    },
                    {
                        fieldtype: 'Check',
                        fieldname: 'include_summary',
                        label: 'Include Summary Cards',
                        default: 1
                    },
                    {
                        fieldtype: 'Check',
                        fieldname: 'include_conflicts',
                        label: 'Include Conflict Details',
                        default: 1
                    },
                    {
                        fieldtype: 'Check',
                        fieldname: 'include_legend',
                        label: 'Include Legend',
                        default: 1
                    },
                    {
                        fieldtype: 'Column Break'
                    },
                    {
                        fieldtype: 'Select',
                        fieldname: 'date_format',
                        label: 'Date Format',
                        options: 'DD-MM-YYYY\nMM-DD-YYYY\nYYYY-MM-DD',
                        default: 'DD-MM-YYYY'
                    },
                    {
                        fieldtype: 'Select',
                        fieldname: 'export_scope',
                        label: 'Export Scope',
                        options: 'Current View\nAll Companies\nSelected Companies',
                        default: 'Current View'
                    },
                    {
                        fieldtype: 'Section Break',
                        label: 'File Options'
                    },
                    {
                        fieldtype: 'Data',
                        fieldname: 'filename',
                        label: 'Filename',
                        default: `HR_Utilization_${moment().format('YYYY-MM-DD')}`
                    }
                ],
                primary_action_label: `Export ${formatName}`,
                primary_action: (values) => {
                    dialog.hide();
                    this.process_export(format, values);
                }
            });

            dialog.show();

        } catch (e) {
            console.error('Error showing export dialog:', e);
            frappe.msgprint(__('Error showing export options: ') + (e.message || 'Unknown error'));
        }
    }

    process_export(format, options) {
        try {
            // Show loading message
            frappe.show_alert({
                message: `Preparing ${format.toUpperCase()} export...`,
                indicator: 'blue'
            });

            // Prepare export data
            const exportData = this.prepare_export_data(options);

            if (format === 'excel') {
                this.export_to_excel(exportData, options);
            } else if (format === 'pdf') {
                this.export_to_pdf(exportData, options);
            }

        } catch (e) {
            console.error('Error processing export:', e);
            frappe.msgprint(__('Error processing export: ') + (e.message || 'Unknown error'));
        }
    }

    prepare_export_data(options) {
        try {
            const data = {
                title: 'HR Utilization Dashboard',
                period: this.get_current_period_text(),
                generated_on: moment().format('DD-MM-YYYY HH:mm:ss'),
                filters: this.get_active_filters_text(),
                companies: [],
                summary: null,
                legend: null
            };

            // Add summary if requested
            if (options.include_summary && this.dashboard_data.summary) {
                data.summary = this.dashboard_data.summary;
            }

            // Add legend if requested
            if (options.include_legend) {
                data.legend = [
                    { indicator: 'A', description: 'Attended' },
                    { indicator: 'L', description: 'On Leave' },
                    { indicator: '🔴', description: 'Conflict' }
                ];
            }

            // Process companies data
            this.dashboard_data.companies.forEach(company => {
                const companyData = {
                    name: company.name,
                    employees: []
                };

                company.employees.forEach(employee => {
                    const employeeData = {
                        id: employee.employee_id,
                        name: employee.employee_name,
                        department: employee.department,
                        daily_records: []
                    };

                    // Process daily records
                    if (employee.daily_records) {
                        employee.daily_records.forEach(record => {
                            const dailyData = {
                                date: moment(record.date).format(options.date_format),
                                status_indicators: record.status_indicators || [],
                                has_conflict: record.has_conflict || false,
                                conflicts: []
                            };

                            // Add conflict details if requested
                            if (options.include_conflicts && record.conflicts) {
                                dailyData.conflicts = record.conflicts.map(conflict => ({
                                    type: conflict.type,
                                    priority: conflict.priority,
                                    description: conflict.description
                                }));
                            }

                            employeeData.daily_records.push(dailyData);
                        });
                    }

                    companyData.employees.push(employeeData);
                });

                data.companies.push(companyData);
            });

            return data;

        } catch (e) {
            console.error('Error preparing export data:', e);
            throw e;
        }
    }

    export_to_excel(data, options) {
        try {
            // Call backend API for Excel export
            frappe.call({
                method: 'svg_mobile_app.svg_mobile_app.page.hr_utilization_dashboard.hr_utilization_dashboard.export_utilization_excel',
                args: {
                    data: data,
                    options: options
                },
                callback: (response) => {
                    if (response.message && response.message.success) {
                        // Download the file
                        const link = document.createElement('a');
                        link.href = response.message.file_url;
                        link.download = `${options.filename}.xlsx`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);

                        frappe.show_alert({
                            message: 'Excel export completed successfully!',
                            indicator: 'green'
                        });
                    } else {
                        frappe.msgprint(__('Excel export failed. Please try again.'));
                    }
                },
                error: (error) => {
                    console.error('Excel export error:', error);
                    frappe.msgprint(__('Excel export failed: ') + (error.message || 'Unknown error'));
                }
            });

        } catch (e) {
            console.error('Error in export_to_excel:', e);
            frappe.msgprint(__('Error exporting to Excel: ') + (e.message || 'Unknown error'));
        }
    }

    export_to_pdf(data, options) {
        try {
            // Call backend API for PDF export
            frappe.call({
                method: 'svg_mobile_app.svg_mobile_app.page.hr_utilization_dashboard.hr_utilization_dashboard.export_utilization_pdf',
                args: {
                    data: data,
                    options: options
                },
                callback: (response) => {
                    if (response.message && response.message.success) {
                        // Download the file
                        const link = document.createElement('a');
                        link.href = response.message.file_url;
                        link.download = `${options.filename}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);

                        frappe.show_alert({
                            message: 'PDF export completed successfully!',
                            indicator: 'green'
                        });
                    } else {
                        frappe.msgprint(__('PDF export failed. Please try again.'));
                    }
                },
                error: (error) => {
                    console.error('PDF export error:', error);
                    frappe.msgprint(__('PDF export failed: ') + (error.message || 'Unknown error'));
                }
            });

        } catch (e) {
            console.error('Error in export_to_pdf:', e);
            frappe.msgprint(__('Error exporting to PDF: ') + (e.message || 'Unknown error'));
        }
    }

    print_dashboard() {
        try {
            if (!this.dashboard_data || !this.dashboard_data.companies || this.dashboard_data.companies.length === 0) {
                frappe.msgprint(__('No data available to print. Please load data first.'));
                return;
            }

            // Create print window with optimized layout
            const printWindow = window.open('', '_blank');
            const printContent = this.generate_print_content();

            printWindow.document.write(printContent);
            printWindow.document.close();
            
            // Wait for content to load then print
            setTimeout(() => {
                printWindow.print();
            }, 500);

        } catch (e) {
            console.error('Error in print_dashboard:', e);
            frappe.msgprint(__('Error preparing print: ') + (e.message || 'Unknown error'));
        }
    }

    generate_print_content() {
        try {
            const companies = this.page.main.find('.companies-container').html();
            const summary = this.page.main.find('.summary-cards').html();
            const legend = this.page.main.find('.legend-items').html();

            return `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>HR Utilization Dashboard - ${this.get_current_period_text()}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 20px; }
                        .print-header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
                        .print-title { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
                        .print-period { font-size: 16px; color: #666; }
                        .print-generated { font-size: 12px; color: #888; margin-top: 10px; }
                        .print-section { margin-bottom: 30px; page-break-inside: avoid; }
                        .print-section h3 { border-bottom: 1px solid #ccc; padding-bottom: 5px; }
                        .calendar-grid { width: 100%; }
                        .employee-calendar-row { page-break-inside: avoid; }
                        .daily-status-cell { border: 1px solid #ddd; padding: 4px; text-align: center; }
                        .has-conflict { background-color: #ffebee !important; }
                        .status-indicator { font-weight: bold; margin: 1px; }
                        .status-indicator.A { color: #4caf50; }
                        .status-indicator.L { color: #ff9800; }
                        .status-indicator.O { color: #2196f3; }
                        .status-indicator.S { color: #9c27b0; }
                        .legend-item { margin-right: 20px; }
                        .summary-cards { display: flex; flex-wrap: wrap; gap: 15px; }
                        .summary-card { border: 1px solid #ddd; padding: 15px; border-radius: 5px; min-width: 150px; }
                        @media print {
                            body { margin: 0; }
                            .print-section { page-break-inside: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-header">
                        <div class="print-title">HR Utilization Dashboard</div>
                        <div class="print-period">${this.get_current_period_text()}</div>
                        <div class="print-generated">Generated on: ${moment().format('DD-MM-YYYY HH:mm:ss')}</div>
                    </div>
                    
                    ${summary ? `
                        <div class="print-section">
                            <h3>Summary</h3>
                            <div class="summary-cards">${summary}</div>
                        </div>
                    ` : ''}
                    
                    ${legend ? `
                        <div class="print-section">
                            <h3>Legend</h3>
                            <div class="legend-items">${legend}</div>
                        </div>
                    ` : ''}
                    
                    <div class="print-section">
                        <h3>Utilization Calendar</h3>
                        <div class="companies-container">${companies}</div>
                    </div>
                </body>
                </html>
            `;

        } catch (e) {
            console.error('Error generating print content:', e);
            return '<html><body><h1>Error generating print content</h1></body></html>';
        }
    }

    get_current_period_text() {
        try {
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            
            if (this.current_period) {
                const month = monthNames[this.current_period.getMonth()];
                const year = this.current_period.getFullYear();
                return `${month} ${year}`;
            }
            
            return 'Current Period';
            
        } catch (e) {
            console.error('Error getting current period text:', e);
            return 'Unknown Period';
        }
    }

    get_active_filters_text() {
        try {
            const filters = [];
            
            if (this.current_filters) {
                if (this.current_filters.company && this.current_filters.company.length > 0) {
                    filters.push(`Companies: ${this.current_filters.company.join(', ')}`);
                }
                if (this.current_filters.department && this.current_filters.department.length > 0) {
                    filters.push(`Departments: ${this.current_filters.department.join(', ')}`);
                }
                if (this.current_filters.leave_type && this.current_filters.leave_type.length > 0) {
                    filters.push(`Leave Types: ${this.current_filters.leave_type.join(', ')}`);
                }
                if (this.current_filters.status && this.current_filters.status.length > 0) {
                    filters.push(`Status: ${this.current_filters.status.join(', ')}`);
                }
            }
            
            return filters.length > 0 ? filters.join(' | ') : 'No filters applied';
            
        } catch (e) {
            console.error('Error getting active filters text:', e);
            return 'Unknown filters';
        }
    }

    // Calendar Navigation Methods
    update_navigation_display(container) {
        try {
            const monthNames = [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'
            ];
            
            const month = monthNames[this.current_period.getMonth()];
            const year = this.current_period.getFullYear();
            
            if (!container) {
                container = this.page.main.find('.filter-controls');
            }
            
            container.find('.current-month-year').text(`${month} ${year}`);
            
        } catch (e) {
            console.error('Error updating navigation display:', e);
        }
    }

    navigate_to_previous_month() {
        try {
            this.is_navigating = true;
            
            // Move to previous month
            this.current_period.setMonth(this.current_period.getMonth() - 1);
            
            // Update filters
            this.update_filters_from_navigation();
            
            // Update display
            this.update_navigation_display();
            
            // Auto-load data with smooth transition
            this.navigate_and_load_data('previous');
            
        } catch (e) {
            console.error('Error navigating to previous month:', e);
            this.is_navigating = false;
        }
    }

    navigate_to_next_month() {
        try {
            this.is_navigating = true;
            
            // Move to next month
            this.current_period.setMonth(this.current_period.getMonth() + 1);
            
            // Update filters
            this.update_filters_from_navigation();
            
            // Update display
            this.update_navigation_display();
            
            // Auto-load data with smooth transition
            this.navigate_and_load_data('next');
            
        } catch (e) {
            console.error('Error navigating to next month:', e);
            this.is_navigating = false;
        }
    }

    update_filters_from_navigation() {
        try {
            const container = this.page.main.find('.filter-controls');
            
            // Update year and month selectors
            container.find('.filter-year').val(this.current_period.getFullYear());
            container.find('.filter-month').val(this.current_period.getMonth() + 1);
            
            // Update current filters object
            this.update_current_filters();
            
        } catch (e) {
            console.error('Error updating filters from navigation:', e);
        }
    }

    navigate_and_load_data(direction) {
        try {
            const companiesContainer = this.page.main.find('.companies-container');
            
            // Add transition effect
            companiesContainer.addClass('calendar-transition-' + direction);
            
            // Load new data
            setTimeout(() => {
                this.load_data();
                
                // Remove transition class after loading
                setTimeout(() => {
                    companiesContainer.removeClass('calendar-transition-' + direction);
                    this.is_navigating = false;
                }, 300);
            }, 150);
            
        } catch (e) {
            console.error('Error in navigate and load data:', e);
            this.is_navigating = false;
        }
    }
} 
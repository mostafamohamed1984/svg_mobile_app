frappe.pages['remote-access-dashboard'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Remote Access Dashboard',
        single_column: true
    });

    // Add CSS class for styling
    $(wrapper).addClass('remote-access-dashboard-wrapper');

    // Initialize the dashboard
    frappe.remote_access_dashboard = new RemoteAccessDashboard(page);
};

frappe.pages['remote-access-dashboard'].on_page_show = function() {
    // Refresh dashboard when page is shown
    if(frappe.remote_access_dashboard) {
        frappe.remote_access_dashboard.refresh();
    }
};

class RemoteAccessDashboard {
    constructor(page) {
        this.page = page;
        this.make();
        this.setup_filters();
        this.load_dashboard_config();
    }

    make() {
        // Create dashboard sections
        this.body = $('<div class="remote-access-dashboard"></div>').appendTo(this.page.main);
        
        // Create sections for different parts of the dashboard
        this.create_summary_section();
        this.create_status_distribution_section();
        this.create_app_distribution_section();
        this.create_usage_section();
        this.create_security_section();
    }

    setup_filters() {
        // Add refresh button
        this.page.set_primary_action('Refresh', () => this.refresh(), 'refresh');

        // Add dashboard config selector
        this.page.add_field({
            label: 'Dashboard',
            fieldtype: 'Link',
            fieldname: 'dashboard_config',
            options: 'Remote Access Dashboard Config',
            change: () => this.load_dashboard_config(this.page.fields_dict.dashboard_config.get_value())
        });

        // Add date range filter
        this.page.add_field({
            label: 'Date Range',
            fieldtype: 'DateRange',
            fieldname: 'date_range',
            default: [frappe.datetime.add_days(frappe.datetime.get_today(), -30), frappe.datetime.get_today()],
            change: () => this.refresh()
        });

        // Add company filter
        this.page.add_field({
            label: 'Company',
            fieldtype: 'Link',
            fieldname: 'company',
            options: 'Company',
            change: () => this.refresh()
        });

        // Add app type filter
        this.page.add_field({
            label: 'App Type',
            fieldtype: 'Link',
            fieldname: 'app_type',
            options: 'App Type',
            change: () => this.refresh()
        });

        // Add button to save current configuration
        this.page.add_menu_item('Save as New Dashboard', () => this.save_as_new_dashboard());
        this.page.add_menu_item('Update Current Dashboard', () => this.update_current_dashboard());
    }

    load_dashboard_config(dashboard_name) {
        if (dashboard_name) {
            // Load specific dashboard config
            frappe.db.get_doc('Remote Access Dashboard Config', dashboard_name)
                .then(doc => {
                    this.apply_dashboard_config(doc);
                });
        } else {
            // Load default dashboard config
            frappe.call({
                method: 'svg_mobile_app.svg_mobile_app.doctype.remote_access_dashboard_config.remote_access_dashboard_config.get_default_dashboard',
                callback: (r) => {
                    if (r.message) {
                        this.apply_dashboard_config(r.message);
                        // Set the dashboard selector to the loaded dashboard
                        this.page.fields_dict.dashboard_config.set_value(r.message.name);
                    } else {
                        this.refresh();
                    }
                }
            });
        }
    }

    apply_dashboard_config(config) {
        // Apply filters from config
        if (config.company) {
            this.page.fields_dict.company.set_value(config.company);
        }

        if (config.app_type) {
            this.page.fields_dict.app_type.set_value(config.app_type);
        }

        // Set date range
        if (config.from_date && config.to_date) {
            this.page.fields_dict.date_range.set_value([config.from_date, config.to_date]);
        }

        // Store visibility settings
        this.show_summary_cards = config.show_summary_cards;
        this.show_status_distribution = config.show_status_distribution;
        this.show_app_distribution = config.show_app_distribution;
        this.show_usage_analytics = config.show_usage_analytics;
        this.show_security_metrics = config.show_security_metrics;

        // Set up auto-refresh if configured
        this.setup_auto_refresh(config.refresh_interval);

        // Refresh the dashboard with the new configuration
        this.refresh();
    }

    setup_auto_refresh(interval) {
        // Clear any existing auto-refresh
        if (this.auto_refresh) {
            clearInterval(this.auto_refresh);
            this.auto_refresh = null;
        }

        // Set up new auto-refresh if interval > 0
        if (interval && interval > 0) {
            this.auto_refresh = setInterval(() => {
                this.refresh();
            }, interval * 60 * 1000); // Convert minutes to milliseconds
        }
    }

    save_as_new_dashboard() {
        const filters = this.get_filters();
        
        const d = new frappe.ui.Dialog({
            title: __('Save Dashboard Configuration'),
            fields: [
                {
                    label: __('Dashboard Name'),
                    fieldname: 'dashboard_name',
                    fieldtype: 'Data',
                    reqd: 1
                },
                {
                    label: __('Set as Default'),
                    fieldname: 'is_default',
                    fieldtype: 'Check'
                },
                {
                    fieldname: 'section_visibility',
                    fieldtype: 'Section Break',
                    label: __('Section Visibility')
                },
                {
                    label: __('Show Summary Cards'),
                    fieldname: 'show_summary_cards',
                    fieldtype: 'Check',
                    default: 1
                },
                {
                    label: __('Show Status Distribution'),
                    fieldname: 'show_status_distribution',
                    fieldtype: 'Check',
                    default: 1
                },
                {
                    label: __('Show App Distribution'),
                    fieldname: 'show_app_distribution',
                    fieldtype: 'Check',
                    default: 1
                },
                {
                    label: __('Show Usage Analytics'),
                    fieldname: 'show_usage_analytics',
                    fieldtype: 'Check',
                    default: 1
                },
                {
                    label: __('Show Security Metrics'),
                    fieldname: 'show_security_metrics',
                    fieldtype: 'Check',
                    default: 1
                },
                {
                    label: __('Auto-Refresh Interval (minutes)'),
                    fieldname: 'refresh_interval',
                    fieldtype: 'Int',
                    description: __('Set to 0 for no auto-refresh'),
                    default: 0
                }
            ],
            primary_action_label: __('Save'),
            primary_action: (values) => {
                // Create new dashboard config
                frappe.db.insert({
                    doctype: 'Remote Access Dashboard Config',
                    dashboard_name: values.dashboard_name,
                    is_default: values.is_default,
                    company: filters.company,
                    app_type: filters.app_type,
                    date_range: 'Custom Range',
                    from_date: filters.from_date,
                    to_date: filters.to_date,
                    show_summary_cards: values.show_summary_cards,
                    show_status_distribution: values.show_status_distribution,
                    show_app_distribution: values.show_app_distribution,
                    show_usage_analytics: values.show_usage_analytics,
                    show_security_metrics: values.show_security_metrics,
                    refresh_interval: values.refresh_interval
                }).then(doc => {
                    frappe.show_alert({
                        message: __('Dashboard configuration saved'),
                        indicator: 'green'
                    });
                    d.hide();
                    
                    // Update dashboard selector and load the new config
                    this.page.fields_dict.dashboard_config.set_value(doc.name);
                });
            }
        });
        
        d.show();
    }

    update_current_dashboard() {
        const dashboard_name = this.page.fields_dict.dashboard_config.get_value();
        
        if (!dashboard_name) {
            frappe.throw(__('Please select a dashboard configuration first'));
            return;
        }
        
        const filters = this.get_filters();
        
        frappe.db.get_doc('Remote Access Dashboard Config', dashboard_name).then(doc => {
            const d = new frappe.ui.Dialog({
                title: __('Update Dashboard Configuration'),
                fields: [
                    {
                        label: __('Dashboard Name'),
                        fieldname: 'dashboard_name',
                        fieldtype: 'Data',
                        reqd: 1,
                        default: doc.dashboard_name,
                        read_only: 1
                    },
                    {
                        label: __('Set as Default'),
                        fieldname: 'is_default',
                        fieldtype: 'Check',
                        default: doc.is_default
                    },
                    {
                        fieldname: 'section_visibility',
                        fieldtype: 'Section Break',
                        label: __('Section Visibility')
                    },
                    {
                        label: __('Show Summary Cards'),
                        fieldname: 'show_summary_cards',
                        fieldtype: 'Check',
                        default: doc.show_summary_cards
                    },
                    {
                        label: __('Show Status Distribution'),
                        fieldname: 'show_status_distribution',
                        fieldtype: 'Check',
                        default: doc.show_status_distribution
                    },
                    {
                        label: __('Show App Distribution'),
                        fieldname: 'show_app_distribution',
                        fieldtype: 'Check',
                        default: doc.show_app_distribution
                    },
                    {
                        label: __('Show Usage Analytics'),
                        fieldname: 'show_usage_analytics',
                        fieldtype: 'Check',
                        default: doc.show_usage_analytics
                    },
                    {
                        label: __('Show Security Metrics'),
                        fieldname: 'show_security_metrics',
                        fieldtype: 'Check',
                        default: doc.show_security_metrics
                    },
                    {
                        label: __('Auto-Refresh Interval (minutes)'),
                        fieldname: 'refresh_interval',
                        fieldtype: 'Int',
                        description: __('Set to 0 for no auto-refresh'),
                        default: doc.refresh_interval
                    }
                ],
                primary_action_label: __('Update'),
                primary_action: (values) => {
                    // Update dashboard config
                    frappe.db.set_doc('Remote Access Dashboard Config', dashboard_name, {
                        is_default: values.is_default,
                        company: filters.company,
                        app_type: filters.app_type,
                        date_range: 'Custom Range',
                        from_date: filters.from_date,
                        to_date: filters.to_date,
                        show_summary_cards: values.show_summary_cards,
                        show_status_distribution: values.show_status_distribution,
                        show_app_distribution: values.show_app_distribution,
                        show_usage_analytics: values.show_usage_analytics,
                        show_security_metrics: values.show_security_metrics,
                        refresh_interval: values.refresh_interval
                    }).then(() => {
                        frappe.show_alert({
                            message: __('Dashboard configuration updated'),
                            indicator: 'green'
                        });
                        d.hide();
                        
                        // Reload the updated config
                        this.load_dashboard_config(dashboard_name);
                    });
                }
            });
            
            d.show();
        });
    }

    refresh() {
        // Get filter values
        const filters = this.get_filters();

        // Refresh all sections based on visibility settings
        if (this.show_summary_cards !== false) {
            this.refresh_summary_section(filters);
            this.summary_section.show();
        } else {
            this.summary_section.hide();
        }

        if (this.show_status_distribution !== false) {
            this.refresh_status_distribution_section(filters);
            this.status_section.show();
        } else {
            this.status_section.hide();
        }

        if (this.show_app_distribution !== false) {
            this.refresh_app_distribution_section(filters);
            this.app_section.show();
        } else {
            this.app_section.hide();
        }

        if (this.show_usage_analytics !== false) {
            this.refresh_usage_section(filters);
            this.usage_section.show();
        } else {
            this.usage_section.hide();
        }

        if (this.show_security_metrics !== false) {
            this.refresh_security_section(filters);
            this.security_section.show();
        } else {
            this.security_section.hide();
        }
    }

    get_filters() {
        return {
            from_date: this.page.fields_dict.date_range.get_value()[0],
            to_date: this.page.fields_dict.date_range.get_value()[1],
            company: this.page.fields_dict.company.get_value(),
            app_type: this.page.fields_dict.app_type.get_value()
        };
    }

    create_summary_section() {
        this.summary_section = $(`
            <div class="dashboard-section summary-section">
                <h3>Remote Access Summary</h3>
                <div class="summary-cards"></div>
            </div>
        `).appendTo(this.body);
    }

    refresh_summary_section(filters) {
        const summary_cards = this.summary_section.find('.summary-cards');
        summary_cards.empty();
        
        // Show loading state
        summary_cards.html('<div class="text-muted">Loading summary data...</div>');

        // Fetch summary data
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.remote_access_dashboard.remote_access_dashboard.get_summary_data',
            args: { filters: filters },
            callback: (r) => {
                if (r.message) {
                    summary_cards.empty();
                    const data = r.message;

                    // Create summary cards
                    this.create_summary_card(summary_cards, 'Total Remote Access', data.total_remote_access, 'blue');
                    this.create_summary_card(summary_cards, 'Available', data.available_count, 'green');
                    this.create_summary_card(summary_cards, 'Temporarily Assigned', data.temporary_count, 'orange');
                    this.create_summary_card(summary_cards, 'Reserved', data.reserved_count, 'purple');
                    this.create_summary_card(summary_cards, 'Expired', data.expired_count, 'red');
                }
            }
        });
    }

    create_summary_card(parent, title, value, color) {
        return $(`
            <div class="summary-card ${color}-card">
                <div class="card-value">${value}</div>
                <div class="card-title">${title}</div>
            </div>
        `).appendTo(parent);
    }

    create_status_distribution_section() {
        this.status_section = $(`
            <div class="dashboard-section status-section">
                <h3>Status Distribution</h3>
                <div class="status-chart-area"></div>
            </div>
        `).appendTo(this.body);
    }

    refresh_status_distribution_section(filters) {
        const chart_area = this.status_section.find('.status-chart-area');
        chart_area.empty();
        
        // Show loading state
        chart_area.html('<div class="text-muted">Loading status distribution data...</div>');

        // Fetch status distribution data
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.remote_access_dashboard.remote_access_dashboard.get_status_distribution',
            args: { filters: filters },
            callback: (r) => {
                if (r.message) {
                    chart_area.empty();
                    const data = r.message;

                    // Create chart
                    new frappe.Chart(chart_area[0], {
                        title: 'Remote Access Status Distribution',
                        data: {
                            labels: data.labels,
                            datasets: data.datasets
                        },
                        type: 'pie',
                        colors: data.colors || ['#28a745', '#fd7e14', '#6f42c1', '#dc3545'],
                        height: 300
                    });
                }
            }
        });
    }

    create_app_distribution_section() {
        this.app_section = $(`
            <div class="dashboard-section app-section">
                <h3>Application Distribution</h3>
                <div class="app-chart-area"></div>
            </div>
        `).appendTo(this.body);
    }

    refresh_app_distribution_section(filters) {
        const chart_area = this.app_section.find('.app-chart-area');
        chart_area.empty();
        
        // Show loading state
        chart_area.html('<div class="text-muted">Loading application distribution data...</div>');

        // Fetch app distribution data
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.remote_access_dashboard.remote_access_dashboard.get_app_distribution',
            args: { filters: filters },
            callback: (r) => {
                if (r.message) {
                    chart_area.empty();
                    const data = r.message;

                    // Create chart
                    new frappe.Chart(chart_area[0], {
                        title: 'Application Type Distribution',
                        data: {
                            labels: data.labels,
                            datasets: data.datasets
                        },
                        type: 'bar',
                        height: 300
                    });
                }
            }
        });
    }

    create_usage_section() {
        this.usage_section = $(`
            <div class="dashboard-section usage-section">
                <h3>Usage Analytics</h3>
                <div class="usage-chart-area"></div>
            </div>
        `).appendTo(this.body);
    }

    refresh_usage_section(filters) {
        const chart_area = this.usage_section.find('.usage-chart-area');
        chart_area.empty();
        
        // Show loading state
        chart_area.html('<div class="text-muted">Loading usage analytics data...</div>');

        // Fetch usage data
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.remote_access_dashboard.remote_access_dashboard.get_usage_analytics',
            args: { filters: filters },
            callback: (r) => {
                if (r.message) {
                    chart_area.empty();
                    const data = r.message;

                    // Create chart
                    new frappe.Chart(chart_area[0], {
                        title: 'Remote Access Usage Over Time',
                        data: {
                            labels: data.labels,
                            datasets: data.datasets
                        },
                        type: 'axis-mixed',
                        height: 300,
                        axisOptions: {
                            xAxisMode: 'tick',
                            yAxisMode: 'span',
                            xIsSeries: true
                        }
                    });
                }
            }
        });
    }

    create_security_section() {
        this.security_section = $(`
            <div class="dashboard-section security-section">
                <h3>Security Metrics</h3>
                <div class="security-chart-area"></div>
            </div>
        `).appendTo(this.body);
    }

    refresh_security_section(filters) {
        const chart_area = this.security_section.find('.security-chart-area');
        chart_area.empty();
        
        // Show loading state
        chart_area.html('<div class="text-muted">Loading security metrics data...</div>');

        // Fetch security data
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.remote_access_dashboard.remote_access_dashboard.get_security_metrics',
            args: { filters: filters },
            callback: (r) => {
                if (r.message) {
                    chart_area.empty();
                    const data = r.message;

                    // Create chart
                    new frappe.Chart(chart_area[0], {
                        title: 'Password Complexity Distribution',
                        data: {
                            labels: data.labels,
                            datasets: data.datasets
                        },
                        type: 'percentage',
                        colors: data.colors || ['#dc3545', '#ffc107', '#28a745'],
                        height: 300
                    });
                }
            }
        });
    }
}
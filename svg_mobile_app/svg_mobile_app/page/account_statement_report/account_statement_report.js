frappe.pages['account-statement-report'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Account Statement Report') + ' - ' + __('تقرير كشف الحساب'),
        single_column: true
    });

    // Add CSS class for styling
    $(wrapper).addClass('account-statement-report-wrapper');

    // Initialize the account statement report page
    frappe.account_statement_report = new AccountStatementReport(page);
};

frappe.pages['account-statement-report'].on_page_show = function() {
    // Refresh page when shown
    if(frappe.account_statement_report) {
        frappe.account_statement_report.refresh();
    }
};

class AccountStatementReport {
    constructor(page) {
        this.page = page;
        this.wrapper = page.main;
        this.data = {
            reportType: '',
            currentData: null
        };

        this.filters = {
            reportType: '',
            customer: '',
            contractor: '',
            engineer: '',
            projectAgreement: '',
            item: '',
            fromDate: '',
            toDate: ''
        };

        this.controls = {};
        this.init();
    }

    init() {
        this.setup_page();
        this.setup_filters();
        this.setup_actions();
        this.set_default_dates();
    }

    setup_page() {
        // Add custom CSS
        this.add_custom_css();

        // Create main layout with comprehensive HTML structure
        this.wrapper.html(`
            <div class="account-statement-report">
                <!-- Header Section -->
                <div class="report-header" style="text-align: center; margin-bottom: 30px; padding: 20px; background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; border-radius: 10px; position: relative;">
                    <div class="orbit-logo" style="position: absolute; top: 15px; left: 20px;">
                        <img src="/files/logo orbit (1).png" alt="Orbit Logo" style="height: 40px; width: auto;" onerror="this.style.display='none'">
                    </div>
                    <h2 id="reportTitle">Account Statement Report</h2>
                    <p style="margin: 0;">Dynamic reporting for Customers, Contractors, and Engineers</p>
                </div>

                <!-- Filter Section -->
                <div class="filter-section" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); padding: 25px; border-radius: 12px; margin-bottom: 25px; border: 1px solid #dee2e6; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                    <h5 style="color: #495057; font-weight: 600; margin-bottom: 20px;">🔍 Report Filters</h5>

                    <!-- Report Type Selection -->
                    <div class="row">
                        <div class="col-md-4">
                            <div class="filter-group" style="margin-bottom: 20px;">
                                <label style="font-weight: 600; color: #495057; margin-bottom: 8px; display: block; font-size: 0.9em;">REPORT TYPE</label>
                                <select id="reportType" class="form-control" style="border: 2px solid #e9ecef; border-radius: 8px; padding: 12px 16px; font-size: 14px; background-color: #fff; font-weight: 600;">
                                    <option value="">Select Report Type</option>
                                    <option value="customer">Customer (عميل)</option>
                                    <option value="contractor">Contractor (مقاول)</option>
                                    <option value="engineer">Outsource Engineer (مهندس)</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-8">
                            <div id="selectedReportTypeDisplay" style="display: none; margin-bottom: 20px;">
                                <div class="alert alert-info" style="margin-bottom: 0; padding: 12px 16px;">
                                    <strong>Selected Report Type:</strong> <span id="reportTypeText"></span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Dynamic Filter Fields -->
                    <div id="dynamicFilters" style="display: none;">
                        <div class="row">
                            <!-- Customer Filter Field -->
                            <div class="col-md-4" id="customerFilterGroup" style="display: none;">
                                <div class="filter-group" style="margin-bottom: 20px;">
                                    <label style="font-weight: 600; color: #495057; margin-bottom: 8px; display: block; font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.5px;">CUSTOMER</label>
                                    <div id="customer-field"></div>
                                </div>
                            </div>

                            <!-- Contractor Filter Field -->
                            <div class="col-md-4" id="contractorFilterGroup" style="display: none;">
                                <div class="filter-group" style="margin-bottom: 20px;">
                                    <label style="font-weight: 600; color: #495057; margin-bottom: 8px; display: block; font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.5px;">CONTRACTOR</label>
                                    <div id="contractor-field"></div>
                                </div>
                            </div>

                            <!-- Engineer Filter Field -->
                            <div class="col-md-4" id="engineerFilterGroup" style="display: none;">
                                <div class="filter-group" style="margin-bottom: 20px;">
                                    <label style="font-weight: 600; color: #495057; margin-bottom: 8px; display: block; font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.5px;">ENGINEER</label>
                                    <div id="engineer-field"></div>
                                </div>
                            </div>

                            <!-- Project Agreement Field -->
                            <div class="col-md-4" id="projectAgreementFilterGroup" style="display: none;">
                                <div class="filter-group" style="margin-bottom: 20px;">
                                    <label style="font-weight: 600; color: #495057; margin-bottom: 8px; display: block; font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.5px;">PROJECT AGREEMENT</label>
                                    <div id="project-agreement-field"></div>
                                </div>
                            </div>

                            <!-- Item/Service Filter Field -->
                            <div class="col-md-4" id="itemFilterGroup" style="display: none;">
                                <div class="filter-group" style="margin-bottom: 20px;">
                                    <label style="font-weight: 600; color: #495057; margin-bottom: 8px; display: block; font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.5px;">ITEM/SERVICE</label>
                                    <div id="item-field"></div>
                                </div>
                            </div>

                            <!-- Date Range -->
                            <div class="col-md-4" id="dateRangeGroup" style="display: none;">
                                <div class="filter-group" style="margin-bottom: 20px;">
                                    <label style="font-weight: 600; color: #495057; margin-bottom: 8px; display: block; font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.5px;">FROM DATE</label>
                                    <input type="date" id="fromDate" class="form-control" style="border: 2px solid #e9ecef; border-radius: 8px; padding: 12px 16px; font-size: 14px; background-color: #fff; font-weight: 500;">
                                </div>
                            </div>

                            <div class="col-md-4" id="toDateGroup" style="display: none;">
                                <div class="filter-group" style="margin-bottom: 20px;">
                                    <label style="font-weight: 600; color: #495057; margin-bottom: 8px; display: block; font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.5px;">TO DATE</label>
                                    <input type="date" id="toDate" class="form-control" style="border: 2px solid #e9ecef; border-radius: 8px; padding: 12px 16px; font-size: 14px; background-color: #fff; font-weight: 500;">
                                </div>
                                </div>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div class="row" id="actionButtons" style="display: none;">
                            <div class="col-md-12">
                            <button id="generateReport" class="btn btn-primary" style="padding: 12px 24px; border-radius: 8px; font-weight: 600; border: none; background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; margin-right: 10px;">
                                    Load Report Data
                                </button>
                            <button id="clearFilters" class="btn btn-secondary" style="padding: 12px 24px; border-radius: 8px; font-weight: 600; border: none; background: linear-gradient(135deg, #636e72 0%, #2d3436 100%); color: white; margin-right: 10px;">
                                    Clear Filters
                                </button>
                            <select id="printLanguage" class="form-control" style="display: none; width: 150px; margin-right: 10px; border: 2px solid #e9ecef; border-radius: 8px; padding: 8px 12px; font-size: 14px; background-color: #fff; float: left;">
                                <option value="en">English</option>
                                <option value="ar">العربية</option>
                            </select>
                            <button id="printReport" class="btn btn-info" style="padding: 12px 24px; border-radius: 8px; font-weight: 600; border: none; background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; display: none;">
                                Print
                            </button>
                            </div>
                        </div>
                    </div>

                <!-- Loading Spinner -->
                <div id="loadingSpinner" style="display: none; text-align: center; padding: 60px 40px; background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; margin: 20px 0;">
                    <div style="display: inline-block; width: 50px; height: 50px; border: 4px solid rgba(231, 76, 60, 0.2); border-radius: 50%; border-top-color: #e74c3c; animation: spin 1s ease-in-out infinite; margin-bottom: 15px;"></div>
                    <p style="color: #495057; font-weight: 500; margin: 0;">Loading account statement data...</p>
                </div>

                <!-- Report Tabs -->
                <div id="reportTabs" style="display: none; margin-bottom: 20px;">
                    <!-- Report Information Header -->
                    <div id="reportInfo" style="margin-bottom: 20px;"></div>

                    <!-- Tab Navigation -->
                    <div class="report-nav" style="border-bottom: 2px solid #dee2e6; margin-bottom: 20px;">
                        <!-- Customer Report Tabs -->
                        <div id="customerTabs" style="display: none;">
                            <button class="tab-button active" data-tab="servicesPayments" style="padding: 12px 20px; margin-right: 5px; border: none; background: #e74c3c; color: white; border-radius: 8px 8px 0 0; cursor: pointer;">Services & Payments</button>
                            <button class="tab-button" data-tab="governmentFeesExpenses" style="padding: 12px 20px; margin-right: 5px; border: none; background: #e9ecef; color: #495057; border-radius: 8px 8px 0 0; cursor: pointer;">Government Fees & Expenses</button>
                            <button class="tab-button" data-tab="trustFees" style="padding: 12px 20px; margin-right: 5px; border: none; background: #e9ecef; color: #495057; border-radius: 8px 8px 0 0; cursor: pointer;">Trust Fees</button>
                    </div>

                        <!-- Contractor Report Tabs -->
                        <div id="contractorTabs" style="display: none;">
                            <button class="tab-button active" data-tab="contractorServicesPayments" style="padding: 12px 20px; margin-right: 5px; border: none; background: #e74c3c; color: white; border-radius: 8px 8px 0 0; cursor: pointer;">Services & Payments</button>
                    </div>

                        <!-- Engineer Report Tabs -->
                        <div id="engineerTabs" style="display: none;">
                            <button class="tab-button active" data-tab="engineerServicesPayments" style="padding: 12px 20px; margin-right: 5px; border: none; background: #e74c3c; color: white; border-radius: 8px 8px 0 0; cursor: pointer;">Services & Payments</button>
                        </div>
                    </div>

                    <!-- Tab Content -->
                    <div class="tab-content">
                        <!-- Customer Report Content -->
                        <div id="servicesPayments" class="tab-pane active" style="display: block;">
                            <div id="servicesPaymentsContent"></div>
                        </div>
                        <div id="governmentFeesExpenses" class="tab-pane" style="display: none;">
                            <div id="governmentFeesExpensesContent"></div>
                        </div>
                        <div id="trustFees" class="tab-pane" style="display: none;">
                            <div id="trustFeesContent"></div>
                        </div>

                        <!-- Contractor Report Content -->
                        <div id="contractorServicesPayments" class="tab-pane" style="display: none;">
                            <div id="contractorServicesPaymentsContent"></div>
                        </div>

                        <!-- Engineer Report Content -->
                        <div id="engineerServicesPayments" class="tab-pane" style="display: none;">
                            <div id="engineerServicesPaymentsContent"></div>
                        </div>
                    </div>
                </div>

                <!-- Error Message -->
                <div id="errorMessage" style="display: none; padding: 20px; background-color: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 8px; margin: 20px 0;">
                    <strong>Error:</strong> <span id="errorText"></span>
                </div>
            </div>
        `);
    }

    setup_filters() {
        // Initialize report type field using the HTML select element
        this.initialize_report_type_field();

        // Generate report button
        this.wrapper.on('click', '#generateReport', () => {
            this.generate_report();
        });

        // Clear filters button
        this.wrapper.on('click', '#clearFilters', () => {
            this.clear_filters();
        });

        // Print button (will be added after data is loaded)
        this.page.set_secondary_action(__('Print Statement'), () => {
            this.print_statement();
        });

        // Add event handler for print button in the HTML
        this.wrapper.on('click', '#printReport', () => {
            this.print_statement();
        });
    }

    initialize_report_type_field() {
        try {
            // Use the HTML select element directly
            this.wrapper.on('change', '#reportType', (e) => {
                const value = $(e.target).val();
                this.filters.reportType = this.map_report_type_value(value);
                        this.handle_report_type_change();
            });
        } catch (error) {
            console.error('Error initializing report type field:', error);
        }
    }

    map_report_type_value(display_value) {
        // Map display values to internal values
        const value_map = {
            'customer': 'customer',
            'contractor': 'contractor', 
            'engineer': 'engineer'
        };
        
        return value_map[display_value] || display_value;
    }

    setup_actions() {
        // Actions are set up in setup_filters
    }

    set_default_dates() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        // Set default values for date filters when they are created
        this.default_from_date = frappe.datetime.obj_to_str(firstDay);
        this.default_to_date = frappe.datetime.obj_to_str(lastDay);
    }

    handle_report_type_change() {
        const report_type = this.filters.reportType;

        // Clean up existing controls first
        this.cleanup_dynamic_controls();

        // Hide all filter groups
        this.hide_all_filter_groups();

        // Update report title
        this.update_report_title(report_type);

        // Update report type display
        this.update_report_type_display(report_type);

        if (!report_type) {
            this.wrapper.find('#dynamicFilters').hide();
            this.wrapper.find('#actionButtons').hide();
            this.wrapper.find('#selectedReportTypeDisplay').hide();
            return;
        }

        // Show common elements
        this.wrapper.find('#dynamicFilters').show();
        this.wrapper.find('#actionButtons').show();
        this.wrapper.find('#projectAgreementFilterGroup').show();
        this.wrapper.find('#itemFilterGroup').show();
        this.wrapper.find('#dateRangeGroup').show();
        this.wrapper.find('#toDateGroup').show();

        // Show specific filter based on type
        switch(report_type) {
            case 'customer':
                this.wrapper.find('#customerFilterGroup').show();
                this.initialize_customer_field();
                break;
            case 'contractor':
                this.wrapper.find('#contractorFilterGroup').show();
                this.initialize_contractor_field();
                break;
            case 'engineer':
                this.wrapper.find('#engineerFilterGroup').show();
                this.initialize_engineer_field();
                break;
        }

        this.initialize_project_agreement_field();
        this.initialize_item_field();
        this.initialize_date_fields();

        // Setup tab functionality
        this.setup_tab_functionality();
    }

    cleanup_dynamic_controls() {
        // List of dynamic controls that need cleanup
        const dynamic_controls = ['customer', 'contractor', 'engineer', 'project_agreement', 'item'];
        
        dynamic_controls.forEach(control_name => {
            if (this.controls[control_name]) {
                // Clear the container
                const container_map = {
                    'customer': '#customer-field',
                    'contractor': '#contractor-field', 
                    'engineer': '#engineer-field',
                    'project_agreement': '#project-agreement-field',
                    'item': '#item-field'
                };
                
                const container = this.wrapper.find(container_map[control_name]);
                if (container.length) {
                    container.empty();
                }
                
                // Remove reference to the control
                delete this.controls[control_name];
            }
        });
        
        // Reset filter values for dynamic fields
        this.filters.customer = '';
        this.filters.contractor = '';
        this.filters.engineer = '';
        this.filters.project_agreement = '';
        this.filters.item = '';
    }

    hide_all_filter_groups() {
        const groups = ['customerFilterGroup', 'contractorFilterGroup', 'engineerFilterGroup'];
        groups.forEach(group => {
            this.wrapper.find(`#${group}`).hide();
        });
    }

    update_report_title(report_type) {
        const titles = {
            customer: 'Customer Account Statement / كشف حساب عميل',
            contractor: 'Contractor Account Statement / كشف حساب مقاول',
            engineer: 'Engineer Account Statement / كشف حساب مهندس'
        };

        const title_element = this.wrapper.find('#reportTitle');
        if (title_element.length) {
            title_element.text(titles[report_type] || 'Account Statement Report');
        }
    }

    update_report_type_display(report_type) {
        const display_element = this.wrapper.find('#selectedReportTypeDisplay');
        const text_element = this.wrapper.find('#reportTypeText');

        if (!report_type) {
            display_element.hide();
            return;
        }

        const type_labels = {
            customer: 'Customer (عميل)',
            contractor: 'Contractor (مقاول)',
            engineer: 'Engineer (مهندس)'
        };

        text_element.text(type_labels[report_type] || report_type);
        display_element.show();
    }

    initialize_customer_field() {
        if (this.controls.customer) return; // Prevent duplicate initialization
        
        try {
            const $parent = this.wrapper.find('#customer-field');
            if ($parent.length === 0) {
                console.error('Customer field container not found');
                return;
            }

            this.controls.customer = frappe.ui.form.make_control({
                parent: $parent,
                df: {
                    fieldtype: 'Link',
                    options: 'Customer',
                    fieldname: 'customer',
                    placeholder: __('Select Customer'),
                    onchange: () => {
                        this.filters.customer = this.controls.customer.get_value();
                        // Update project agreement filter but don't clear it immediately
                        setTimeout(() => {
                        this.update_project_agreement_filter();
                        }, 100);
                    }
                },
                render_input: true
            });
            this.controls.customer.refresh();
        } catch (error) {
            console.error('Error initializing customer field:', error);
        }
    }

    initialize_contractor_field() {
        if (this.controls.contractor) return; // Prevent duplicate initialization
        
        try {
            const $parent = this.wrapper.find('#contractor-field');
            if ($parent.length === 0) {
                console.error('Contractor field container not found');
                return;
            }

            this.controls.contractor = frappe.ui.form.make_control({
                parent: $parent,
                df: {
                    fieldtype: 'Link',
                    options: 'Customer',  // Contractors stored as Customer doctype
                    fieldname: 'contractor',
                    placeholder: __('Select Contractor'),
                    onchange: () => {
                        this.filters.contractor = this.controls.contractor.get_value();
                        this.update_project_agreement_filter();
                    }
                },
                render_input: true
            });
            this.controls.contractor.refresh();
        } catch (error) {
            console.error('Error initializing contractor field:', error);
        }
    }

    initialize_engineer_field() {
        if (this.controls.engineer) return; // Prevent duplicate initialization
        
        try {
            const $parent = this.wrapper.find('#engineer-field');
            if ($parent.length === 0) {
                console.error('Engineer field container not found');
                return;
            }

            this.controls.engineer = frappe.ui.form.make_control({
                parent: $parent,
                df: {
                    fieldtype: 'Link',
                    options: 'Supplier',  // Engineers stored as Supplier doctype
                    fieldname: 'engineer',
                    placeholder: __('Select Engineer'),
                    onchange: () => {
                        this.filters.engineer = this.controls.engineer.get_value();
                        this.update_project_agreement_filter();
                    }
                },
                render_input: true
            });
            this.controls.engineer.refresh();
        } catch (error) {
            console.error('Error initializing engineer field:', error);
        }
    }

    initialize_project_agreement_field() {
        if (this.controls.project_agreement) return; // Prevent duplicate initialization
        
        try {
            const $parent = this.wrapper.find('#project-agreement-field');
            if ($parent.length === 0) {
                console.error('Project agreement field container not found');
                return;
            }

            this.controls.project_agreement = frappe.ui.form.make_control({
                parent: $parent,
                df: {
                    fieldtype: 'Link',
                    options: 'Project Agreement',
                    fieldname: 'project_agreement',
                    placeholder: __('Select Project Agreement (Optional)'),
                    get_query: () => {
                        return this.get_project_agreement_query();
                    },
                    onchange: () => {
                        const new_value = this.controls.project_agreement.get_value();
                        console.log('Project Agreement changed to:', new_value);
                        this.filters.project_agreement = new_value;
                        this.handle_project_agreement_change();
                    }
                },
                render_input: true
            });
            this.controls.project_agreement.refresh();
        } catch (error) {
            console.error('Error initializing project agreement field:', error);
        }
    }

    initialize_item_field() {
        if (this.controls.item) return; // Prevent duplicate initialization
        
        try {
            const $parent = this.wrapper.find('#item-field');
            if ($parent.length === 0) {
                console.error('Item field container not found');
                return;
            }

            this.controls.item = frappe.ui.form.make_control({
                parent: $parent,
                df: {
                    fieldtype: 'Link',
                    options: 'Item',
                    fieldname: 'item',
                    placeholder: __('Select Item/Service (Optional)'),
                    onchange: () => {
                        this.filters.item = this.controls.item.get_value();
                    }
                },
                render_input: true
            });
            this.controls.item.refresh();
        } catch (error) {
            console.error('Error initializing item field:', error);
        }
    }

    initialize_date_fields() {
        try {
            // Use the HTML date input elements directly
            this.wrapper.find('#fromDate').val(this.default_from_date);
            this.wrapper.find('#toDate').val(this.default_to_date);

            // Set initial filter values
            this.filters.from_date = this.default_from_date;
            this.filters.to_date = this.default_to_date;

            // Add event handlers
            this.wrapper.on('change', '#fromDate', (e) => {
                this.filters.from_date = $(e.target).val();
            });

            this.wrapper.on('change', '#toDate', (e) => {
                this.filters.to_date = $(e.target).val();
            });

        } catch (error) {
            console.error('Error initializing date fields:', error);
        }
    }

    get_project_agreement_query() {
        const filters = { docstatus: ['in', [0, 1]] };

        if (this.filters.reportType === 'customer' && this.filters.customer) {
            filters.customer = this.filters.customer;
        } else if (this.filters.reportType === 'contractor' && this.filters.contractor) {
            // For contractors, we might need to filter by contractor field if it exists
            // For now, we'll show all project agreements
        } else if (this.filters.reportType === 'engineer' && this.filters.engineer) {
            // For engineers, we might need to filter by engineer field if it exists
            // For now, we'll show all project agreements
        }

        return { filters: filters };
    }

    update_project_agreement_filter() {
        if (this.controls.project_agreement) {
            console.log('Updating project agreement filter, current value:', this.filters.project_agreement);
            console.log('Current customer:', this.filters.customer);
            
            // Refresh the project agreement field to update available options
            // but don't clear the current value unless it's no longer valid
            this.controls.project_agreement.refresh();
            
            // Only clear if the current value is not compatible with the new customer
            this.validate_current_project_agreement();
        }
    }

    async validate_current_project_agreement() {
        if (!this.filters.project_agreement || !this.filters.customer) {
            return;
        }

        try {
            const project_data = await frappe.db.get_doc('Project Agreement', this.filters.project_agreement);
            
            // If the selected project agreement doesn't belong to the current customer, clear it
            if (project_data && project_data.customer !== this.filters.customer) {
            this.controls.project_agreement.set_value('');
            this.filters.project_agreement = '';
                frappe.show_alert({
                    message: __('Project Agreement cleared as it does not belong to the selected customer'),
                    indicator: 'orange'
                });
            }
        } catch (error) {
            // If project agreement doesn't exist or error, clear it
            this.controls.project_agreement.set_value('');
            this.filters.project_agreement = '';
        }
    }

    handle_project_agreement_change() {
        // Auto-populate customer from project agreement if selected
        if (this.filters.project_agreement && this.filters.reportType === 'customer') {
            this.load_project_agreement_details();
        }
    }

    async load_project_agreement_details() {
        try {
            const project_agreement_data = await frappe.db.get_doc('Project Agreement', this.filters.project_agreement);
            if (project_agreement_data && project_agreement_data.customer && this.controls.customer) {
                this.controls.customer.set_value(project_agreement_data.customer);
                this.filters.customer = project_agreement_data.customer;
            }
        } catch (error) {
            console.error('Error loading project agreement details:', error);
        }
    }

    setup_tab_functionality() {
        // Handle tab button clicks
        this.wrapper.on('click', '.tab-button', (e) => {
            const tab_button = $(e.currentTarget);
            const tab_name = tab_button.data('tab');

            this.switch_to_tab(tab_name);
        });
    }

    switch_to_tab(tab_name) {
        // Remove active class from all tabs
        this.wrapper.find('.tab-button').removeClass('active').css({
            'background': '#e9ecef',
            'color': '#495057'
        });

        // Add active class to clicked tab
        this.wrapper.find(`[data-tab="${tab_name}"]`).addClass('active').css({
            'background': '#e74c3c',
            'color': 'white'
        });

        // Hide all tab panes
        this.wrapper.find('.tab-pane').hide();

        // Show the selected tab pane
        this.wrapper.find(`#${tab_name}`).show();
    }

    show_report_tabs(report_type) {
        // Hide all tab containers first
        this.wrapper.find('#customerTabs, #contractorTabs, #engineerTabs').hide();

        // Show appropriate tabs based on report type
        if (report_type === 'customer') {
            this.wrapper.find('#customerTabs').show();
            this.wrapper.find('#servicesPayments').show();
            this.switch_to_tab('servicesPayments');
        } else if (report_type === 'contractor') {
            this.wrapper.find('#contractorTabs').show();
            this.wrapper.find('#contractorServicesPayments').show();
            this.switch_to_tab('contractorServicesPayments');
        } else if (report_type === 'engineer') {
            this.wrapper.find('#engineerTabs').show();
            this.wrapper.find('#engineerServicesPayments').show();
            this.switch_to_tab('engineerServicesPayments');
        }

        // Show the report tabs container
        this.wrapper.find('#reportTabs').show();
    }

    generate_report() {
        if (!this.validate_filters()) {
            return;
        }

        this.show_loading();

        // Fetch data based on report type
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.account_statement_report.account_statement_report.get_account_statement_data',
            args: {
                report_type: this.filters.reportType,
                customer: this.filters.customer,
                contractor: this.filters.contractor,
                engineer: this.filters.engineer,
                project_agreement: this.filters.project_agreement,
                item: this.filters.item,
                from_date: this.filters.from_date,
                to_date: this.filters.to_date
            },
            callback: (response) => {
                this.hide_loading();

                if (response.message && response.message.service_groups && response.message.service_groups.length > 0) {
                    this.render_statement(response.message);
                    this.show_report_tabs(this.filters.reportType);
                    this.show_print_controls();
                    this.wrapper.find('.statement-data').show();
                } else {
                    this.wrapper.find('.no-data-message').show();
                }
            },
            error: (error) => {
                console.error('Report generation error:', error);
                const error_message = __('Failed to load account statement data. Please check your filters and try again.');
                const error_details = error.message || __('Unknown error occurred');
                this.show_error(error_message, error_details);
            }
        });
    }

    validate_filters() {
        if (!this.filters.reportType) {
            frappe.msgprint(__('Please select a report type'));
            return false;
        }

        if (!this.filters.from_date || !this.filters.to_date) {
            frappe.msgprint(__('Please select both From Date and To Date'));
            return false;
        }

        return true;
    }

    render_statement(data) {
        // Build report information header
        const report_info_html = this.build_report_info(data);
        this.wrapper.find('#reportInfo').html(report_info_html);

        // Render content based on report type
        if (this.filters.reportType === 'customer') {
            this.render_customer_tabs(data);
        } else if (this.filters.reportType === 'contractor') {
            this.render_contractor_tabs(data);
        } else if (this.filters.reportType === 'engineer') {
            this.render_engineer_tabs(data);
        }

        this.current_statement_data = data;
    }

    build_report_info(data) {
        const entity_info = this.get_entity_info(data);
        const date_range = data.date_range;

        return `
            <div class="alert alert-info" style="margin-bottom: 0;">
                <h5 style="margin-bottom: 10px;"><strong>${__('Report Information')} - ${__('معلومات التقرير')}</strong></h5>
                <div class="row">
                    <div class="col-md-6">
                        <strong>${__('Entity')}:</strong> ${entity_info.name}
                    </div>
                    <div class="col-md-6">
                        <strong>${__('Report Type')}:</strong> ${this.get_report_type_label(data)}
                    </div>
                </div>
                <div class="row" style="margin-top: 5px;">
                    <div class="col-md-6">
                        <strong>${__('Date Range')}:</strong> ${date_range.from_date_formatted} - ${date_range.to_date_formatted}
                    </div>
                    <div class="col-md-6">
                        <strong>${__('Currency')}:</strong> ${data.currency || 'AED'}
                    </div>
                </div>
            </div>
        `;
    }

    render_customer_tabs(data) {
        // Services & Payments Tab
        const services_html = this.build_customer_services_content(data);
        this.wrapper.find('#servicesPaymentsContent').html(services_html);

        // Government Fees & Expenses Tab
        const government_html = this.build_customer_government_fees_content(data);
        this.wrapper.find('#governmentFeesExpensesContent').html(government_html);

        // Trust Fees Tab
        const trust_html = this.build_customer_trust_fees_content(data);
        this.wrapper.find('#trustFeesContent').html(trust_html);
    }

    render_contractor_tabs(data) {
        const contractor_html = this.build_contractor_services_content(data);
        this.wrapper.find('#contractorServicesPaymentsContent').html(contractor_html);
    }

    render_engineer_tabs(data) {
        const engineer_html = this.build_engineer_services_content(data);
        this.wrapper.find('#engineerServicesPaymentsContent').html(engineer_html);
    }

    build_statement_header(data) {
        const entity_info = this.get_entity_info(data);
        const date_range = data.date_range;

        return `
            <div class="statement-header" style="background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 30px; text-align: center;">
                <h2>${__('Account Statement Report')} - ${__('تقرير كشف الحساب')}</h2>
                <div class="entity-info" style="margin: 20px 0;">
                    <h4>${entity_info.name} - ${entity_info.name_ar}</h4>
                    <p>${__('Report Type')}: ${this.get_report_type_label(data)} | ${__('Date Range')}: ${date_range.from_date_formatted} - ${date_range.to_date_formatted}</p>
                </div>
            </div>
        `;
    }

    build_customer_services_content(data) {
        let html = '<div class="statement-content-section">';

        // Filter service groups to show only customer services
        const customer_services = data.service_groups.filter(group =>
            group.service_type === 'customer_service' || !group.service_type
        );

        if (customer_services.length === 0) {
            html += `<div class="alert alert-info" style="text-align: center; padding: 40px;">
                <h5>${__('No Services & Payments Data')}</h5>
                <p>${__('No customer services and payments data found for the selected criteria.')}</p>
            </div>`;
        } else {
            customer_services.forEach(group => {
            html += this.build_service_group_html(group);
        });
        }

        html += '</div>';
        return html;
    }

    build_customer_government_fees_content(data) {
        let html = '<div class="statement-content-section">';

        // Filter service groups to show only government fees
        const government_fees = data.service_groups.filter(group =>
            group.is_government_fees_section === true
        );

        if (government_fees.length === 0) {
            html += `<div class="alert alert-info" style="text-align: center; padding: 40px;">
                <h5>${__('No Government Fees & Expenses Data')}</h5>
                <p>${__('No government fees and expenses data found for the selected criteria.')}</p>
            </div>`;
        } else {
            government_fees.forEach(group => {
                html += this.build_government_fees_group_html(group);
            });
        }

        html += '</div>';
        return html;
    }

    build_customer_trust_fees_content(data) {
        let html = '<div class="statement-content-section">';

        // Filter service groups to show only trust fees
        const trust_fees = data.service_groups.filter(group =>
            group.is_trust_fees_section === true
        );

        if (trust_fees.length === 0) {
            html += `<div class="alert alert-info" style="text-align: center; padding: 40px;">
                <h5>${__('No Trust Fees Data')}</h5>
                <p>${__('No trust fees data found for the selected criteria.')}</p>
            </div>`;
        } else {
            trust_fees.forEach(group => {
                html += this.build_trust_fees_group_html(group);
            });
        }

        html += '</div>';
        return html;
    }

    build_contractor_services_content(data) {
        let html = '<div class="statement-content-section">';

        // Filter service groups to show only contractor services
        const contractor_services = data.service_groups.filter(group =>
            group.service_type === 'contractor_service' || !group.service_type
        );

        if (contractor_services.length === 0) {
            html += `<div class="alert alert-info" style="text-align: center; padding: 40px;">
                <h5>${__('No Contractor Services & Payments Data')}</h5>
                <p>${__('No contractor services and payments data found for the selected criteria.')}</p>
            </div>`;
        } else {
            contractor_services.forEach(group => {
                html += this.build_service_group_html(group);
            });
        }

        html += '</div>';
        return html;
    }

    build_engineer_services_content(data) {
        let html = '<div class="statement-content-section">';

        // Filter service groups to show only engineer services
        const engineer_services = data.service_groups.filter(group =>
            group.service_type === 'engineer_service' || !group.service_type
        );

        if (engineer_services.length === 0) {
            html += `<div class="alert alert-info" style="text-align: center; padding: 40px;">
                <h5>${__('No Engineer Services & Payments Data')}</h5>
                <p>${__('No engineer services and payments data found for the selected criteria.')}</p>
            </div>`;
        } else {
            engineer_services.forEach(group => {
                html += this.build_service_group_html(group);
            });
        }

        html += '</div>';
        return html;
    }

    build_service_group_html(group) {
        const is_tax_section = group.is_tax_section || false;
        const service_title = is_tax_section ? `${group.service_name}` : group.service_name;
        
        // Add project context if available
        const project_context = group.project_name ? ` - ${group.project_name}` : '';
        const full_title = service_title + project_context;

        return `
            <div class="service-group" style="margin-bottom: 30px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
                <div class="service-header" style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 15px; font-weight: 600;">
                    <h4 style="margin: 0;">${full_title}</h4>
                </div>
                <div class="service-table-container" style="padding: 20px;">
                    <table class="table table-bordered service-table">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="text-align: center;">${__('Date')} - ${__('التاريخ')}</th>
                                <th style="text-align: center;">${__('Type')} - ${__('النوع')}</th>
                                <th style="text-align: center;">${__('Due')} - ${__('المستحق')}</th>
                                <th style="text-align: center;">${__('Paid')} - ${__('المدفوع')}</th>
                                <th style="text-align: center;">${__('Balance')} - ${__('الرصيد')}</th>
                                <th style="text-align: center;">${__('Description')} - ${__('البيان')}</th>
                                ${is_tax_section || group.project_name ? `<th style="text-align: center;">${__('Project')} - ${__('المشروع')}</th>` : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${group.transactions.map(transaction => `
                                <tr>
                                    <td style="text-align: center;">${frappe.datetime.str_to_user(transaction.date)}</td>
                                    <td style="text-align: center;">${transaction.type}</td>
                                    <td style="text-align: right; font-weight: bold;">${(transaction.debit || 0) > 0 ? this.format_currency(transaction.debit || 0) : '—'}</td>
                                    <td style="text-align: right; font-weight: bold; color: #28a745;">${(transaction.credit || 0) > 0 ? this.format_currency(transaction.credit || 0) : '—'}</td>
                                    <td style="text-align: right; font-weight: bold; ${(transaction.balance || 0) > 0 ? 'color: #dc3545;' : 'color: #28a745;'}">${this.format_currency(transaction.balance || 0)}</td>
                                    <td>${transaction.remark || transaction.description || ''}</td>
                                    ${is_tax_section ? `<td style="text-align: center; font-size: 12px;">${transaction.project_name || 'N/A'}</td>` : (group.project_name ? `<td style="text-align: center; font-size: 12px;">${group.project_name}</td>` : '')}
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot style="background: #e9ecef;">
                            <tr>
                                <td colspan="2" style="text-align: center; font-weight: bold;">${__('Total')} - ${__('المجموع')}</td>
                                <td style="text-align: right; font-weight: bold; color: #dc3545;">${this.format_currency(group.total_value || 0)}</td>
                                <td style="text-align: right; font-weight: bold; color: #28a745;">${this.format_currency(group.total_paid || 0)}</td>
                                <td style="text-align: right; font-weight: bold; ${(group.total_balance || 0) > 0 ? 'color: #dc3545;' : 'color: #28a745;'}">${this.format_currency(group.total_balance || 0)}</td>
                                <td style="text-align: center; font-weight: bold; color: #666; font-size: 11px;">${__('Description')}</td>
                                ${is_tax_section || group.project_name ? `<td style="text-align: center; font-weight: bold; color: #666; font-size: 11px;">${__('Project')}</td>` : ''}
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }

    build_government_fees_group_html(group) {
        return `
            <div class="service-group" style="margin-bottom: 30px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
                <div class="service-header" style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; padding: 15px; font-weight: 600;">
                    <h4 style="margin: 0;">${group.service_name}</h4>
                </div>
                <div class="service-table-container" style="padding: 20px;">
                    <table class="table table-bordered service-table">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="text-align: center;">${__('Date')} - ${__('التاريخ')}</th>
                                <th style="text-align: center;">${__('Type')} - ${__('النوع')}</th>
                                <th style="text-align: center;">${__('Due')} - ${__('المستحق')}</th>
                                <th style="text-align: center;">${__('Paid')} - ${__('المدفوع')}</th>
                                <th style="text-align: center;">${__('Balance')} - ${__('الرصيد')}</th>
                                <th style="text-align: center;">${__('Description')} - ${__('البيان')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${group.transactions.map(transaction => `
                                <tr>
                                    <td style="text-align: center;">${frappe.datetime.str_to_user(transaction.date)}</td>
                                    <td style="text-align: center;">${transaction.type}</td>
                                    <td style="text-align: right; font-weight: bold;">${transaction.due > 0 ? this.format_currency(transaction.due) : '—'}</td>
                                    <td style="text-align: right; font-weight: bold; color: #28a745;">${transaction.paid > 0 ? this.format_currency(transaction.paid) : '—'}</td>
                                    <td style="text-align: right; font-weight: bold; ${transaction.balance > 0 ? 'color: #dc3545;' : 'color: #28a745;'}">${this.format_currency(transaction.balance || 0)}</td>
                                    <td>${transaction.remark || ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot style="background: #e9ecef;">
                            <tr>
                                <td colspan="2" style="text-align: center; font-weight: bold;">${__('Total')} - ${__('المجموع')}</td>
                                <td style="text-align: right; font-weight: bold; color: #dc3545;">${this.format_currency(group.total_value || 0)}</td>
                                <td style="text-align: right; font-weight: bold; color: #28a745;">${this.format_currency(group.total_paid || 0)}</td>
                                <td style="text-align: right; font-weight: bold; ${group.total_balance > 0 ? 'color: #dc3545;' : 'color: #28a745;'}">${this.format_currency(group.total_balance || 0)}</td>
                                <td style="text-align: center; font-weight: bold; color: #666; font-size: 11px;">${__('Description')}</td>
                            </tr>
                        </tfoot>
                    </table>
                    ${group.pending_expenses && group.pending_expenses.length > 0 ? this.build_pending_expenses_html(group.pending_expenses) : ''}
                </div>
            </div>
        `;
    }

    build_trust_fees_group_html(group) {
        return `
            <div class="service-group" style="margin-bottom: 30px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
                <div class="service-header" style="background: linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%); color: white; padding: 15px; font-weight: 600;">
                    <h4 style="margin: 0;">${group.service_name}</h4>
                </div>
                <div class="service-table-container" style="padding: 20px;">
                    <table class="table table-bordered service-table">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="text-align: center;">${__('Date')} - ${__('التاريخ')}</th>
                                <th style="text-align: center;">${__('Type')} - ${__('النوع')}</th>
                                <th style="text-align: center;">${__('Due')} - ${__('المستحق')}</th>
                                <th style="text-align: center;">${__('Paid')} - ${__('المدفوع')}</th>
                                <th style="text-align: center;">${__('Balance')} - ${__('الرصيد')}</th>
                                <th style="text-align: center;">${__('Description')} - ${__('البيان')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${group.transactions.map(transaction => `
                                <tr>
                                    <td style="text-align: center;">${frappe.datetime.str_to_user(transaction.date)}</td>
                                    <td style="text-align: center;">${transaction.type}</td>
                                    <td style="text-align: right; font-weight: bold;">${transaction.due > 0 ? this.format_currency(transaction.due) : '—'}</td>
                                    <td style="text-align: right; font-weight: bold; color: #28a745;">${transaction.paid > 0 ? this.format_currency(transaction.paid) : '—'}</td>
                                    <td style="text-align: right; font-weight: bold; ${transaction.balance > 0 ? 'color: #dc3545;' : 'color: #28a745;'}">${this.format_currency(transaction.balance || 0)}</td>
                                    <td>${transaction.remark || ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot style="background: #e9ecef;">
                            <tr>
                                <td colspan="2" style="text-align: center; font-weight: bold;">${__('Total')} - ${__('المجموع')}</td>
                                <td style="text-align: right; font-weight: bold; color: #dc3545;">${this.format_currency(group.total_value || 0)}</td>
                                <td style="text-align: right; font-weight: bold; color: #28a745;">${this.format_currency(group.total_paid || 0)}</td>
                                <td style="text-align: right; font-weight: bold; ${group.total_balance > 0 ? 'color: #dc3545;' : 'color: #28a745;'}">${this.format_currency(group.total_balance || 0)}</td>
                                <td style="text-align: center; font-weight: bold; color: #666; font-size: 11px;">${__('Description')}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }

    build_pending_expenses_html(pending_expenses) {
        return `
            <div style="margin-top: 20px; padding: 15px; background: #fff3cd; border-radius: 8px; border: 1px solid #ffeaa7;">
                <h5 style="color: #856404; margin-bottom: 15px;">${__('Pending Expenses')} - ${__('المصروفات المعلقة')}</h5>
                <table class="table table-bordered" style="margin-bottom: 0;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="text-align: center;">${__('Amount')} - ${__('المبلغ')}</th>
                            <th style="text-align: center;">${__('Paid')} - ${__('مدفوع')}</th>
                            <th style="text-align: center;">${__('Collected Amount')} - ${__('المبلغ المحصل')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pending_expenses.map(expense => `
                            <tr>
                                <td style="text-align: right; font-weight: bold;">${this.format_currency(expense.amount || 0)}</td>
                                <td style="text-align: center;">${expense.paid ? '✓' : '✗'}</td>
                                <td style="text-align: right; font-weight: bold;">${this.format_currency(expense.collected_amount || 0)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    build_statement_summary(data) {
        const summary = data.summary;

        return `
            <div class="statement-summary" style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 20px; border-radius: 8px; margin-top: 30px;">
                <h3 style="text-align: center; margin-bottom: 20px;">${__('Summary')} - ${__('الملخص')}</h3>
                <div class="row">
                    <div class="col-md-3">
                        <div style="text-align: center; padding: 10px; background: rgba(255,255,255,0.2); border-radius: 8px;">
                            <h5>${__('Total Projects')}</h5>
                            <h3>${summary.total_projects || 0}</h3>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div style="text-align: center; padding: 10px; background: rgba(255,255,255,0.2); border-radius: 8px;">
                            <h5>${__('Total Services')}</h5>
                            <h3>${summary.total_services || 0}</h3>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div style="text-align: center; padding: 10px; background: rgba(255,255,255,0.2); border-radius: 8px;">
                            <h5>${__('Grand Total Value')}</h5>
                            <h4>${this.format_currency(summary.grand_total_value || 0)}</h4>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div style="text-align: center; padding: 10px; background: rgba(255,255,255,0.2); border-radius: 8px;">
                            <h5>${__('Grand Total Balance')}</h5>
                            <h4 style="${summary.grand_total_balance < 0 ? 'color: #ffc107;' : 'color: white;'}">${this.format_currency(summary.grand_total_balance || 0)}</h4>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    get_entity_info(data) {
        if (data.customer) {
            return {
                name: data.customer.customer_name,
                name_ar: data.customer.customer_name
            };
        } else if (data.contractor) {
            return {
                name: data.contractor.contractor_name,
                name_ar: data.contractor.contractor_name
            };
        } else if (data.engineer) {
            return {
                name: data.engineer.engineer_name,
                name_ar: data.engineer.engineer_name
            };
        }
        return { name: 'Unknown', name_ar: 'غير معروف' };
    }

    get_report_type_label(data) {
        if (data.customer) return __('Customer');
        if (data.contractor) return __('Contractor');
        if (data.engineer) return __('Engineer');
        return __('Unknown');
    }

    print_statement() {
        if (!this.current_statement_data) {
            frappe.msgprint(__('No data to print. Please generate a statement first.'));
            return;
        }

        // Create print window
        const print_content = this.build_print_html(this.current_statement_data);
        const print_window = window.open('', '_blank');
        print_window.document.write(print_content);
        print_window.document.close();
        print_window.print();
    }

    build_print_html(data, language = 'en') {
        const entity_info = this.get_entity_info(data);
        const report_type_label = this.get_report_type_label(data);

        return `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${__('Account Statement Report')} - ${entity_info.name}</title>
                <style>
                    @page {
                        margin: 1.5cm 1.5cm 2cm 1.5cm;
                        size: A4;
                    }

                    @page :first {
                        margin-top: 2.5cm;
                    }

                    body {
                        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
                        margin: 0;
                        padding: 0;
                        background-color: #ffffff;
                        direction: rtl;
                        text-align: right;
                        line-height: 1.4;
                    }

                    .print-container {
                        width: 100%;
                        max-width: none;
                        margin: 0;
                        padding: 20px;
                        box-sizing: border-box;
                    }

                    .print-header {
                        text-align: center;
                        margin-bottom: 30px;
                        border-bottom: 3px solid #007bff;
                        padding-bottom: 20px;
                        page-break-after: avoid;
                        page-break-inside: avoid;
                        position: relative;
                        z-index: 1;
                    }

                    .print-header::after {
                        content: "";
                        display: block;
                        height: 0;
                        page-break-after: avoid;
                    }

                    .company-info h1 {
                        color: #007bff;
                        margin: 10px 0;
                        font-size: 24px;
                        font-weight: bold;
                    }

                    .statement-title {
                        background: #e74c3c;
                        color: white;
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 8px;
                        font-size: 20px;
                        font-weight: bold;
                    }

                    .entity-details {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 8px;
                        margin-bottom: 30px;
                        border: 1px solid #dee2e6;
                        clear: both;
                        position: relative;
                        z-index: 0;
                    }

                    .service-group {
                        margin-bottom: 40px;
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    .service-group:not(:first-child) {
                        page-break-before: auto;
                        margin-top: 20px;
                    }

                    .service-title {
                        background: #ffc107;
                        color: #000;
                        padding: 12px;
                        text-align: center;
                        font-weight: bold;
                        font-size: 16px;
                        border-radius: 5px 5px 0 0;
                        margin: 0;
                    }

                    .service-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 0;
                        font-size: 12px;
                        page-break-inside: auto;
                    }

                    .service-table thead {
                        display: table-header-group;
                    }

                    .service-table tbody {
                        display: table-row-group;
                    }

                    .service-table tr {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }

                    .service-table th {
                        background: #e74c3c;
                        color: white;
                        padding: 10px 6px;
                        text-align: center;
                        font-weight: bold;
                        border: 1px solid #c0392b;
                    }

                    .service-table td {
                        padding: 8px 6px;
                        text-align: center;
                        border: 1px solid #dee2e6;
                        vertical-align: middle;
                    }

                    .statement-summary {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 8px;
                        border: 2px solid #28a745;
                        margin-top: 30px;
                        page-break-inside: avoid;
                    }

                    .statement-summary h3 {
                        color: #28a745;
                        text-align: center;
                        margin-bottom: 20px;
                        font-weight: bold;
                    }

                    .print-footer {
                        margin-top: 50px;
                        text-align: center;
                        font-size: 12px;
                        color: #6c757d;
                        border-top: 1px solid #dee2e6;
                        padding-top: 20px;
                    }

                    @media print {
                        body {
                            margin: 0;
                            padding: 0;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        
                        .print-container {
                            padding: 10px;
                        }
                        
                        .print-header {
                            position: static;
                            margin-bottom: 20px;
                            page-break-after: auto;
                            break-after: auto;
                        }
                        
                        .entity-details {
                            page-break-after: avoid;
                            break-after: avoid;
                            margin-bottom: 20px;
                        }
                        
                        .service-group {
                            page-break-inside: avoid;
                            break-inside: avoid;
                            margin-top: 0;
                            margin-bottom: 20px;
                        }
                        
                        .service-group:first-of-type {
                            margin-top: 0;
                        }
                        
                        .service-table {
                            page-break-inside: auto;
                            break-inside: auto;
                        }
                        
                        .service-table thead {
                            display: table-header-group;
                        }
                        
                        .service-table tbody {
                            display: table-row-group;
                        }
                        
                        .service-table tfoot {
                            display: table-footer-group;
                        }
                        
                        .service-table tr {
                            page-break-inside: avoid;
                            break-inside: avoid;
                        }
                        
                        /* Ensure no floating or absolute positioning interferes */
                        * {
                            position: static !important;
                            float: none !important;
                        }
                        
                        .print-header {
                            position: static !important;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="print-container">
                    <div class="print-header">
                    <div class="company-info">
                        <h1>${data.company.company_name_ar || data.company.company_name}</h1>
                        <h1>${data.company.company_name}</h1>
                    </div>
                    <div class="statement-title">
                        ${__('Account Statement Report')} - ${__('تقرير كشف الحساب')}
                    </div>
                </div>

                <div class="content-separator" style="clear: both; height: 20px; page-break-after: avoid;"></div>
                
                <div class="entity-details">
                    <h4 style="text-align: center; margin-bottom: 15px;">${report_type_label} - ${entity_info.name}</h4>
                    <table style="width: 100%; border: none;">
                        <tr>
                            <td><strong>${__('Name')}:</strong></td>
                            <td>${entity_info.name}</td>
                            <td><strong>${__('Date Range')}:</strong></td>
                            <td>${data.date_range.from_date_formatted} - ${data.date_range.to_date_formatted}</td>
                        </tr>
                        <tr>
                            <td><strong>${__('Print Date')}:</strong></td>
                            <td>${frappe.datetime.now_datetime().split(' ')[0]}</td>
                            <td><strong>${__('Report Type')}:</strong></td>
                            <td>${report_type_label}</td>
                        </tr>
                    </table>
                </div>

                ${data.service_groups.map(group => {
                    const service_title = group.is_tax_section ? `${group.service_name} - ${__('VAT')} ${group.tax_rate}%` : group.service_name;

                    return `
                    <div class="service-group">
                        <h3 class="service-title">${service_title}</h3>
                        <table class="service-table">
                            <thead>
                                <tr>
                                    <th>${__('Date')}</th>
                                    <th>${__('Type')}</th>
                                    <th>${__('Debit')}</th>
                                    <th>${__('Credit')}</th>
                                    <th>${__('Balance')}</th>
                                    <th>${__('Description')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${group.transactions.map(transaction => `
                                    <tr>
                                        <td>${frappe.datetime.str_to_user(transaction.date)}</td>
                                        <td>${transaction.type}</td>
                                        <td style="text-align: right;">${this.format_currency_for_print(transaction.debit || 0)}</td>
                                        <td style="text-align: right;">${this.format_currency_for_print(transaction.credit || 0)}</td>
                                        <td style="text-align: right;">${this.format_currency_for_print(transaction.balance || 0)}</td>
                                        <td>${transaction.description || ''}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot style="background: #f8f9fa; font-weight: bold;">
                                <tr>
                                    <td colspan="2" style="text-align: center;">${__('Total')}</td>
                                    <td style="text-align: right;">${this.format_currency_for_print(group.total_value || 0)}</td>
                                    <td style="text-align: right;">${this.format_currency_for_print(group.total_paid || 0)}</td>
                                    <td style="text-align: right;">${this.format_currency_for_print(group.total_balance || 0)}</td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    `;
                }).join('')}

                <div class="statement-summary">
                    <h3>${__('Summary')}</h3>
                    <table style="width: 100%; border-collapse: collapse; background: white;">
                        <tr>
                            <td style="padding: 12px; border: 1px solid #dee2e6;"><strong>${__('Total Projects')}</strong></td>
                            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center;">${data.summary.total_projects || 0}</td>
                            <td style="padding: 12px; border: 1px solid #dee2e6;"><strong>${__('Total Services')}</strong></td>
                            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: center;">${data.summary.total_services || 0}</td>
                        </tr>
                        <tr>
                            <td style="padding: 12px; border: 1px solid #dee2e6;"><strong>${__('Grand Total Value')}</strong></td>
                            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: right;">${this.format_currency_for_print(data.summary.grand_total_value || 0)}</td>
                            <td style="padding: 12px; border: 1px solid #dee2e6;"><strong>${__('Grand Total Balance')}</strong></td>
                            <td style="padding: 12px; border: 1px solid #dee2e6; text-align: right;">${this.format_currency_for_print(data.summary.grand_total_balance || 0)}</td>
                        </tr>
                    </table>
                </div>

                <div class="print-footer">
                    <p>${__('Generated by')} ${data.company.company_name_ar || data.company.company_name} ${__('System')} - ${frappe.datetime.now_datetime()}</p>
                </div>
                </div> <!-- Close print-container -->
            </body>
            </html>
        `;
    }

    clear_filters() {
        // Clean up dynamic controls
        this.cleanup_dynamic_controls();

        // Reset all filters
        this.filters = {
            reportType: '',
            customer: '',
            contractor: '',
            engineer: '',
            projectAgreement: '',
            item: '',
            fromDate: '',
            toDate: ''
        };

        // Clear report type control
        this.wrapper.find('#reportType').val('');

        // Hide dynamic elements
        this.wrapper.find('#dynamicFilters').hide();
        this.wrapper.find('#actionButtons').hide();
        this.wrapper.find('.statement-data').hide();
        this.wrapper.find('.no-data-message').show();
        this.hide_print_controls();
        this.hide_report_tabs();

        frappe.show_alert(__('Filters cleared successfully'));
    }

    show_loading() {
        // Hide content areas
        this.wrapper.find('.statement-data, .no-data-message, #reportTabs').hide();

        // Show loading spinner
        this.wrapper.find('#loadingSpinner').show();

        // Disable action buttons during loading
        this.wrapper.find('#generateReport, #clearFilters').prop('disabled', true);

        // Add loading class to wrapper for visual feedback
        this.wrapper.addClass('loading-state');
    }

    hide_loading() {
        // Hide loading spinner
        this.wrapper.find('#loadingSpinner').hide();

        // Re-enable action buttons
        this.wrapper.find('#generateReport, #clearFilters').prop('disabled', false);

        // Remove loading class
        this.wrapper.removeClass('loading-state');
    }

    show_error(error_message, error_details = '') {
        // Hide loading and content areas
        this.hide_loading();
        this.wrapper.find('.statement-data, .no-data-message, #reportTabs').hide();

        // Show error message
        const error_html = `
            <div class="alert alert-danger" style="margin-top: 20px;">
                <h5><i class="fa fa-exclamation-triangle"></i> ${__('Error Loading Report')}</h5>
                <p>${error_message}</p>
                ${error_details ? `<small class="text-muted">${error_details}</small>` : ''}
                <hr>
                <button class="btn btn-sm btn-outline-danger" onclick="location.reload()">
                    <i class="fa fa-refresh"></i> ${__('Reload Page')}
                </button>
            </div>
        `;

        this.wrapper.find('#errorMessage').html(error_html).show();
    }

    clear_error() {
        this.wrapper.find('#errorMessage').hide().html('');
    }

    refresh() {
        // Clear any existing errors
        this.clear_error();

        // Reset loading state
        this.hide_loading();

        // Hide print controls and tabs
        this.hide_print_controls();
        this.hide_report_tabs();

        // Show initial state
        this.wrapper.find('.no-data-message').show();
    }

    show_print_controls() {
        // Show print language selector and print button
        this.wrapper.find('#printLanguage, #printReport').show();
    }

    hide_print_controls() {
        // Hide print language selector and print button
        this.wrapper.find('#printLanguage, #printReport').hide();
    }

    hide_report_tabs() {
        // Hide report tabs container
        this.wrapper.find('#reportTabs').hide();
    }

    print_statement() {
        if (!this.current_statement_data) {
            frappe.msgprint(__('No data to print. Please generate a statement first.'));
            return;
        }

        const language = this.wrapper.find('#printLanguage').val() || 'en';
        const print_content = this.build_print_html(this.current_statement_data, language);
        const print_window = window.open('', '_blank');

        if (!print_window) {
            frappe.msgprint(__('Please allow popups for this site to print the statement.'));
            return;
        }

        print_window.document.write(print_content);
        print_window.document.close();

        // Set direction for Arabic
        if (language === 'ar') {
            print_window.document.documentElement.setAttribute('dir', 'rtl');
            print_window.document.body.style.direction = 'rtl';
        }

        // Wait for content to load then print
        print_window.onload = function() {
            setTimeout(function() {
                print_window.print();
            }, 100);
        };
    }

    format_currency(amount) {
        if (amount === null || amount === undefined) {
            return '0.00';
        }

        const currency = this.current_statement_data?.currency || 'AED';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(amount);
    }

    format_currency_for_print(amount) {
        if (amount === null || amount === undefined) {
            return '0.00';
        }

        const formattedAmount = new Intl.NumberFormat('en-AE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
        return `${formattedAmount} د.إ`;
    }

    build_print_html(data, language = 'en') {
        const isArabic = language === 'ar';
        const labels = this.get_print_labels(isArabic);
        
        let printContent = `
            <!DOCTYPE html>
            <html dir="${isArabic ? 'rtl' : 'ltr'}">
            <head>
                <meta charset="utf-8">
                <title>Account Statement Report</title>
                ${this.get_print_styles()}
            </head>
            <body>
                <div class="print-header-image"></div>
                <div class="print-footer-image"></div>
                
                <div class="print-container">
                    ${this.generate_print_header(data, labels)}
                    ${this.generate_print_services_payments(data, labels)}
                </div>
            </body>
            </html>
        `;
        
        return printContent;
    }

    get_print_labels(isArabic) {
        if (isArabic) {
            return {
                date: 'التاريخ',
                type: 'النوع',
                debit: 'المدين',
                credit: 'الدائن',
                balance: 'الرصيد',
                description: 'البيان',
                totals: 'المجموع',
                reportTitle: 'كشف حساب',
                customer: 'العميل',
                contractor: 'المقاول',
                engineer: 'المهندس',
                period: 'الفترة',
                to: 'إلى'
            };
        } else {
            return {
                date: 'DATE',
                type: 'TYPE',
                debit: 'DEBIT',
                credit: 'CREDIT', 
                balance: 'BALANCE',
                description: 'DESCRIPTION',
                totals: 'Total',
                reportTitle: 'Account Statement',
                customer: 'Customer',
                contractor: 'Contractor',
                engineer: 'Engineer',
                period: 'Period',
                to: 'to'
            };
        }
    }

    generate_print_header(data, labels) {
        const entityName = data.customer?.customer_name || data.contractor?.contractor_name || data.engineer?.engineer_name || 'Unknown';
        const entityType = data.customer ? labels.customer : data.contractor ? labels.contractor : labels.engineer;
        
        return `
            <div class="print-header">
                <h2>${labels.reportTitle}</h2>
                <div class="print-info">
                    <div><strong>${entityType}:</strong> ${entityName}</div>
                    <div><strong>${labels.period}:</strong> ${data.date_range.from_date_formatted} ${labels.to} ${data.date_range.to_date_formatted}</div>
                </div>
            </div>
        `;
    }

    generate_print_services_payments(data, labels) {
        if (!data.service_groups || data.service_groups.length === 0) {
            return '<p>No data available</p>';
        }

        let content = '';
        
        data.service_groups.forEach(group => {
            content += `
                <div class="print-project-section">
                    <div class="item-section">
                        <div class="item-title">${group.service_name}</div>
                        <table class="print-table">
                            <thead>
                                <tr>
                                    <th>${labels.date}</th>
                                    <th>${labels.type}</th>
                                    <th>${labels.debit}</th>
                                    <th>${labels.credit}</th>
                                    <th>${labels.balance}</th>
                                    <th>${labels.description}</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${group.transactions.map(transaction => `
                                    <tr>
                                        <td>${transaction.date || ''}</td>
                                        <td>${transaction.type || ''}</td>
                                        <td class="amount">${transaction.debit > 0 ? this.format_currency_for_print(transaction.debit) : '—'}</td>
                                        <td class="amount">${transaction.credit > 0 ? this.format_currency_for_print(transaction.credit) : '—'}</td>
                                        <td class="amount">${this.format_currency_for_print(transaction.balance)}</td>
                                        <td>${transaction.remark || transaction.description || ''}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="2"><strong>${labels.totals}</strong></td>
                                    <td class="amount"><strong>${this.format_currency_for_print(group.total_value)}</strong></td>
                                    <td class="amount"><strong>${this.format_currency_for_print(group.total_paid)}</strong></td>
                                    <td class="amount"><strong>${this.format_currency_for_print(group.total_balance)}</strong></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            `;
        });

        return content;
    }

    get_print_styles() {
        return `
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                @page {
                    margin: 0;
                    size: A4;
                }

                html, body {
                    font-family: Arial, sans-serif;
                    font-size: 11px;
                    line-height: 1.3;
                    color: #333;
                    background: white;
                    margin: 0;
                    padding: 0;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                    width: 100%;
                    height: 100%;
                }

                .print-header-image {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    width: 100vw;
                    height: 90px;
                    background: url('/files/Asset 8.png') no-repeat center top;
                    background-size: cover;
                    margin: 0;
                    padding: 0;
                    z-index: 9999;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                .print-footer-image {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    width: 100vw;
                    height: 70px;
                    background: url('/files/Asset 9.png') no-repeat center bottom;
                    background-size: cover;
                    margin: 0;
                    padding: 0;
                    z-index: 9999;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                }

                .print-container {
                    margin: 0;
                    padding: 110px 15mm 90px 15mm;
                    background: white;
                    z-index: 1;
                    position: relative;
                    min-height: 100vh;
                    box-sizing: border-box;
                }

                .print-header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding: 20px;
                    background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                    color: white;
                    border-radius: 10px;
                }

                .print-header h2 {
                    font-size: 24px;
                    margin-bottom: 15px;
                    font-weight: 700;
                }

                .print-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 14px;
                }

                .print-info div {
                    flex: 1;
                }

                .print-project-section {
                    margin-bottom: 20px;
                    margin-top: 30px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                    page-break-before: auto;
                    padding-top: 20px;
                }

                .item-section {
                    margin-bottom: 15px;
                    margin-top: 10px;
                    margin-left: 10px;
                    margin-right: 10px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                    page-break-before: auto;
                }

                .item-title {
                    background-color: #e74c3c;
                    color: white;
                    border: 1px solid #000000;
                    padding: 8px;
                    text-align: center;
                    font-size: 12px;
                    font-weight: bold;
                    margin-bottom: 0;
                    border-radius: 3px 3px 0 0;
                    page-break-after: avoid;
                }

                .print-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 15px;
                    margin-top: 10px;
                    font-size: 9px;
                    page-break-inside: avoid;
                    break-inside: avoid;
                }

                .print-table th {
                    background-color: #34495e;
                    color: white;
                    padding: 3px 4px;
                    text-align: center;
                    border: 1px solid #333;
                    font-weight: bold;
                    page-break-after: avoid;
                }

                .print-table td {
                    padding: 2px 3px;
                    border: 1px solid #ddd;
                    text-align: center;
                    color: #000;
                    line-height: 1.2;
                }

                .print-table tbody tr {
                    page-break-inside: avoid;
                }

                .print-table .amount {
                    text-align: right;
                    font-family: 'Courier New', monospace;
                    color: #000000;
                    font-weight: 600;
                }

                .print-table tfoot {
                    page-break-inside: avoid;
                }

                .print-table tfoot td {
                    background-color: #ecf0f1;
                    font-weight: bold;
                    border-top: 2px solid #333;
                }
            </style>
        `;
    }

    add_custom_css() {
        if (!$('#account-statement-report-css').length) {
            $('head').append(`
                <style id="account-statement-report-css">
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }

                    .account-statement-report-wrapper {
                        background: #f8f9fa;
                        min-height: 100vh;
                    }

                    .account-statement-container {
                        padding: 20px;
                    }

                    .filters-section {
                        background: white;
                        padding: 20px;
                        border-radius: 8px;
                        margin-bottom: 20px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }

                    .statement-content {
                        background: white;
                        border-radius: 8px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                        min-height: 400px;
                    }

                    .service-group {
                        margin-bottom: 30px;
                    }

                    .service-header {
                        background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
                        color: white;
                        padding: 15px;
                        border-radius: 8px 8px 0 0;
                    }

                    .service-table th {
                        background: #007bff;
                        color: white;
                        text-align: center;
                        border: 1px solid #0056b3;
                    }

                    .service-table td {
                        padding: 8px;
                        border: 1px solid #dee2e6;
                    }

                    .statement-summary {
                        background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 8px;
                        margin-top: 30px;
                    }

                    .text-right {
                        text-align: right !important;
                    }
                </style>
            `);
        }
    }

    refresh() {
        // Refresh the page if needed
        if (this.current_statement_data) {
            this.render_statement(this.current_statement_data);
        }
    }
}

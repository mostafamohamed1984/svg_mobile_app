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
            project_agreement: '',
            item: '',
            from_date: '',
            to_date: ''
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

        // Create main layout using EXACT original HTML structure
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
                                <div id="report-type-field"></div>
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
                                    <div id="from-date-field"></div>
                                </div>
                            </div>

                            <div class="col-md-4" id="toDateGroup" style="display: none;">
                                <div class="filter-group" style="margin-bottom: 20px;">
                                    <label style="font-weight: 600; color: #495057; margin-bottom: 8px; display: block; font-size: 0.9em; text-transform: uppercase; letter-spacing: 0.5px;">TO DATE</label>
                                    <div id="to-date-field"></div>
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
        // Initialize report type field
        this.initialize_report_type_field();

        // Generate report button - use event delegation for initially hidden elements
        this.wrapper.on('click', '#generateReport', () => {
            console.log('Generate report button clicked'); // Debug log
            this.generate_report();
        });

        // Clear filters button - use event delegation for initially hidden elements
        this.wrapper.on('click', '#clearFilters', () => {
            this.clear_filters();
        });

        // Print button (will be added after data is loaded)
        this.page.set_secondary_action(__('Print Statement'), () => {
            this.print_statement();
        });
    }

    initialize_report_type_field() {
        try {
            this.controls.report_type = frappe.ui.form.make_control({
                parent: this.wrapper.find('#report-type-field'),
                df: {
                    fieldtype: 'Select',
                    fieldname: 'report_type',
                    options: '\nCustomer (عميل)\nContractor (مقاول)\nEngineer (مهندس)',
                    placeholder: __('Select Report Type'),
                    onchange: () => {
                        this.filters.reportType = this.controls.report_type.get_value();
                        this.handle_report_type_change();
                    }
                },
                render_input: true
            });
            this.controls.report_type.refresh();
        } catch (error) {
            console.error('Error initializing report type field:', error);
        }
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
        const display_value = this.filters.reportType;
        
        // Map display values to internal values
        const value_map = {
            'Customer (عميل)': 'customer',
            'Contractor (مقاول)': 'contractor', 
            'Engineer (مهندس)': 'engineer'
        };
        
        const report_type = value_map[display_value] || display_value;
        this.filters.reportType = report_type; // Update with internal value

        // Clean up existing controls first
        this.cleanup_dynamic_controls();

        // Hide all filter groups
        this.hide_all_filter_groups();

        // Update report title
        this.update_report_title(report_type);

        if (!report_type) {
            this.wrapper.find('#dynamicFilters').hide();
            this.wrapper.find('#actionButtons').hide();
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
    }

    cleanup_dynamic_controls() {
        // List of dynamic controls that need cleanup
        const dynamic_controls = ['customer', 'contractor', 'engineer', 'project_agreement', 'item', 'from_date', 'to_date'];
        
        dynamic_controls.forEach(control_name => {
            if (this.controls[control_name]) {
                // Clear the container
                const container_map = {
                    'customer': '#customer-field',
                    'contractor': '#contractor-field', 
                    'engineer': '#engineer-field',
                    'project_agreement': '#project-agreement-field',
                    'item': '#item-field',
                    'from_date': '#from-date-field',
                    'to_date': '#to-date-field'
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

    initialize_customer_field() {
        if (this.controls.customer) return; // Prevent duplicate initialization
        
        try {
            this.controls.customer = frappe.ui.form.make_control({
                parent: this.wrapper.find('#customer-field'),
                df: {
                    fieldtype: 'Link',
                    options: 'Customer',
                    fieldname: 'customer',
                    placeholder: __('Select Customer'),
                    onchange: () => {
                        this.filters.customer = this.controls.customer.get_value();
                        this.update_project_agreement_filter();
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
            this.controls.contractor = frappe.ui.form.make_control({
                parent: this.wrapper.find('#contractor-field'),
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
            this.controls.engineer = frappe.ui.form.make_control({
                parent: this.wrapper.find('#engineer-field'),
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
            this.controls.project_agreement = frappe.ui.form.make_control({
                parent: this.wrapper.find('#project-agreement-field'),
                df: {
                    fieldtype: 'Link',
                    options: 'Project Agreement',
                    fieldname: 'project_agreement',
                    placeholder: __('Select Project Agreement (Optional)'),
                    get_query: () => {
                        return this.get_project_agreement_query();
                    },
                    onchange: () => {
                        this.filters.project_agreement = this.controls.project_agreement.get_value();
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
            this.controls.item = frappe.ui.form.make_control({
                parent: this.wrapper.find('#item-field'),
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
        if (this.controls.from_date && this.controls.to_date) return; // Prevent duplicate initialization
        
        try {
            if (!this.controls.from_date) {
                this.controls.from_date = frappe.ui.form.make_control({
                    parent: this.wrapper.find('#from-date-field'),
                    df: {
                        fieldtype: 'Date',
                        fieldname: 'from_date',
                        default: this.default_from_date,
                        onchange: () => {
                            this.filters.from_date = this.controls.from_date.get_value();
                        }
                    },
                    render_input: true
                });
            }

            if (!this.controls.to_date) {
                this.controls.to_date = frappe.ui.form.make_control({
                    parent: this.wrapper.find('#to-date-field'),
                    df: {
                        fieldtype: 'Date',
                        fieldname: 'to_date',
                        default: this.default_to_date,
                        onchange: () => {
                            this.filters.to_date = this.controls.to_date.get_value();
                        }
                    },
                    render_input: true
                });
            }

            // Set initial values if not already set
            if (!this.filters.from_date) this.filters.from_date = this.default_from_date;
            if (!this.filters.to_date) this.filters.to_date = this.default_to_date;

        } catch (error) {
            console.error('Error initializing date fields:', error);
        }
    }

    get_project_agreement_query() {
        const filters = { docstatus: ['in', [0, 1]] };

        if (this.filters.reportType === 'customer' && this.filters.customer) {
            filters.customer = this.filters.customer;
        }

        return { filters: filters };
    }

    update_project_agreement_filter() {
        if (this.controls.project_agreement) {
            this.controls.project_agreement.set_value('');
            this.filters.project_agreement = '';
        }
    }

    generate_report() {
        console.log('generate_report() called'); // Debug log
        console.log('Current filters:', this.filters); // Debug log
        
        if (!this.validate_filters()) {
            console.log('Filter validation failed'); // Debug log
            return;
        }

        console.log('Filter validation passed, showing loading...'); // Debug log
        this.show_loading();

        // Fetch data based on report type
        console.log('Making API call with args:', {
            report_type: this.filters.reportType,
            customer: this.filters.customer,
            contractor: this.filters.contractor,
            engineer: this.filters.engineer,
            project_agreement: this.filters.project_agreement,
            item: this.filters.item,
            from_date: this.filters.from_date,
            to_date: this.filters.to_date
        }); // Debug log
        
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
                console.log('API response received:', response); // Debug log
                console.log('Response message:', response.message); // Debug log
                this.hide_loading();

                if (response.message && response.message.service_groups && response.message.service_groups.length > 0) {
                    console.log('Found service groups, rendering statement'); // Debug log
                    this.render_statement(response.message);
                    this.wrapper.find('.statement-data').show();
                } else {
                    console.log('No service groups found, showing no-data message'); // Debug log
                    console.log('response.message:', response.message); // Debug log
                    console.log('service_groups:', response.message?.service_groups); // Debug log
                    this.wrapper.find('.no-data-message').show();
                }
            },
            error: (error) => {
                console.log('API error occurred:', error); // Debug log
                this.hide_loading();
                this.wrapper.find('.no-data-message').show();
                frappe.msgprint(__('Error loading report: {0}', [error.message]));
            }
        });
    }

    validate_filters() {
        console.log('Validating filters...'); // Debug log
        console.log('reportType:', this.filters.reportType); // Debug log
        console.log('from_date:', this.filters.from_date); // Debug log
        console.log('to_date:', this.filters.to_date); // Debug log
        
        if (!this.filters.reportType) {
            console.log('Report type validation failed'); // Debug log
            frappe.msgprint(__('Please select a report type'));
            return false;
        }

        if (!this.filters.from_date || !this.filters.to_date) {
            console.log('Date validation failed'); // Debug log
            frappe.msgprint(__('Please select both From Date and To Date'));
            return false;
        }

        console.log('All validations passed'); // Debug log
        return true;
    }

    render_statement(data) {
        let html = this.build_statement_header(data);
        html += this.build_statement_content(data);
        html += this.build_statement_summary(data);

        this.wrapper.find('.statement-data').html(html);
        this.current_statement_data = data;
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

    build_statement_content(data) {
        let html = '<div class="statement-content-section">';

        data.service_groups.forEach(group => {
            html += this.build_service_group_html(group);
        });

        html += '</div>';
        return html;
    }

    build_service_group_html(group) {
        const is_tax_section = group.is_tax_section || false;
        const service_title = is_tax_section ? `${group.service_name} - ${__('VAT')} ${group.tax_rate}%` : group.service_name;

        return `
            <div class="service-group" style="margin-bottom: 30px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
                <div class="service-header" style="background: linear-gradient(135deg, #007bff 0%, #0056b3 100%); color: white; padding: 15px; font-weight: 600;">
                    <h4 style="margin: 0;">${service_title}</h4>
                </div>
                <div class="service-table-container" style="padding: 20px;">
                    <table class="table table-bordered service-table">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="text-align: center;">${__('Date')} - ${__('التاريخ')}</th>
                                <th style="text-align: center;">${__('Type')} - ${__('النوع')}</th>
                                <th style="text-align: center;">${__('Debit')} - ${__('المدين')}</th>
                                <th style="text-align: center;">${__('Credit')} - ${__('الدائن')}</th>
                                <th style="text-align: center;">${__('Balance')} - ${__('الرصيد')}</th>
                                <th style="text-align: center;">${__('Description')} - ${__('البيان')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${group.transactions.map(transaction => `
                                <tr>
                                    <td style="text-align: center;">${frappe.datetime.str_to_user(transaction.date)}</td>
                                    <td style="text-align: center;">${transaction.type}</td>
                                    <td style="text-align: right; font-weight: bold;">${this.format_currency(transaction.debit || 0)}</td>
                                    <td style="text-align: right; font-weight: bold;">${this.format_currency(transaction.credit || 0)}</td>
                                    <td style="text-align: right; font-weight: bold; ${transaction.balance < 0 ? 'color: #dc3545;' : 'color: #28a745;'}">${this.format_currency(transaction.balance || 0)}</td>
                                    <td>${transaction.description || ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot style="background: #e9ecef;">
                            <tr>
                                <td colspan="2" style="text-align: center; font-weight: bold;">${__('Total')} - ${__('المجموع')}</td>
                                <td style="text-align: right; font-weight: bold;">${this.format_currency(group.total_value || 0)}</td>
                                <td style="text-align: right; font-weight: bold;">${this.format_currency(group.total_paid || 0)}</td>
                                <td style="text-align: right; font-weight: bold; ${group.total_balance < 0 ? 'color: #dc3545;' : 'color: #28a745;'}">${this.format_currency(group.total_balance || 0)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
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

    build_print_html(data) {
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
                    body {
                        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
                        margin: 0;
                        padding: 20px;
                        background-color: #ffffff;
                        direction: rtl;
                        text-align: right;
                    }

                    .print-header {
                        text-align: center;
                        margin-bottom: 30px;
                        border-bottom: 3px solid #007bff;
                        padding-bottom: 20px;
                    }

                    .company-info h1 {
                        color: #007bff;
                        margin: 10px 0;
                        font-size: 24px;
                        font-weight: bold;
                    }

                    .statement-title {
                        background: #007bff;
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
                    }

                    .service-group {
                        margin-bottom: 40px;
                        page-break-inside: avoid;
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
                    }

                    .service-table th {
                        background: #007bff;
                        color: white;
                        padding: 10px 6px;
                        text-align: center;
                        font-weight: bold;
                        border: 1px solid #0056b3;
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
                            padding: 15px;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <div class="company-info">
                        <h1>${data.company.company_name_ar || data.company.company_name}</h1>
                        <h1>${data.company.company_name}</h1>
                    </div>
                    <div class="statement-title">
                        ${__('Account Statement Report')} - ${__('تقرير كشف الحساب')}
                    </div>
                </div>

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
            project_agreement: '',
            item: '',
            from_date: '',
            to_date: ''
        };

        // Clear report type control
        if (this.controls.report_type) {
            this.controls.report_type.set_value('');
        }

        // Hide dynamic elements
        this.wrapper.find('#dynamicFilters').hide();
        this.wrapper.find('#actionButtons').hide();
        this.wrapper.find('.statement-data').hide();
        this.wrapper.find('.no-data-message').show();

        frappe.show_alert(__('Filters cleared successfully'));
    }

    show_loading() {
        this.wrapper.find('.statement-data, .no-data-message').hide();
        this.wrapper.find('.loading-message').show();
    }

    hide_loading() {
        this.wrapper.find('.loading-message').hide();
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

        const currency = this.current_statement_data?.currency || 'AED';
        return new Intl.NumberFormat('ar-EG', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(amount);
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

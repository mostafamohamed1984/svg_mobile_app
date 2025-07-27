frappe.pages['project-contractors-report'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Project Contractors Report') + ' - ' + __('تقرير مقاولي المشروع'),
        single_column: true
    });

    // Add CSS class for styling
    $(wrapper).addClass('project-contractors-report-wrapper');

    // Initialize the project contractors report page
    frappe.project_contractors_report = new ProjectContractorsReport(page);
};

frappe.pages['project-contractors-report'].on_page_show = function() {
    // Refresh page when shown
    if(frappe.project_contractors_report) {
        frappe.project_contractors_report.refresh();
    }
};

class ProjectContractorsReport {
    constructor(page) {
        this.page = page;
        this.wrapper = page.main;
        this.data = {
            customers: [],
            contractors: [],
            projects: [],
            employees: [],
            expenseTypes: [],
            customerStatements: [],
            customerStatementData: null,
            projectExpenses: [],
            combinedData: []
        };
        
        this.filters = {
            customer: '',
            contractor: '',
            employee: '',
            fromDate: '',
            toDate: '',
            expenseType: ''
        };
        
        this.setup_page();
        this.setup_filters();
        this.setup_actions();
        this.load_filter_options();
    }

    setup_page() {
        // Add custom CSS
        this.add_custom_css();
        
        // Generate the complete HTML structure
        this.create_page_content();
        
        this.setup_tab_functionality();
    }

    create_page_content() {
        // Create the complete HTML structure dynamically
        const html = `
            <div class="unified-report">
                <div class="report-header">
                    <div class="orbit-logo">
                        <img src="/files/orbit_logo.png" alt="Orbit Logo" onerror="this.parentElement.style.display='none'">
                    </div>
                    <h2>Customer Balance & Project Expense Report</h2>
                    <p>Comprehensive financial analysis and project cost tracking</p>
                </div>

                <div class="filter-section">
                    <h5>🔍 Report Filters</h5>
                    
                    <div class="row">
                        <div class="col-md-3">
                            <div class="filter-group">
                                <label>Customer</label>
                                <div class="customer-field"></div>
                            </div>
                        </div>
                        
                        <div class="col-md-3">
                            <div class="filter-group">
                                <label>Project Contractor</label>
                                <div class="contractor-field"></div>
                            </div>
                        </div>
                        
                        <div class="col-md-3">
                            <div class="filter-group">
                                <label>Employee</label>
                                <div class="employee-field"></div>
                            </div>
                        </div>
                        
                        <div class="col-md-3">
                            <div class="filter-group">
                                <label>Expense Type</label>
                                <div class="expense-type-field"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-4">
                            <div class="filter-group">
                                <label>From Date</label>
                                <div class="from-date-field"></div>
                            </div>
                        </div>
                        
                        <div class="col-md-4">
                            <div class="filter-group">
                                <label>To Date</label>
                                <div class="to-date-field"></div>
                            </div>
                        </div>
                        
                        <div class="col-md-4">
                            <div class="filter-group">
                                <label>&nbsp;</label>
                                <button class="btn btn-primary generate-report">
                                    Generate Report
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="row">
                        <div class="col-md-12">
                            <button class="btn btn-secondary clear-filters">
                                Clear Filters
                            </button>
                            <button class="btn btn-success export-excel" style="display:none;">
                                Export Excel
                            </button>
                            <button class="btn btn-info print-report" style="display:none;">
                                Print
                            </button>
                        </div>
                    </div>
                </div>

                <div class="loading-spinner" style="display:none;">
                    <div class="spinner"></div>
                    <p>Loading report data...</p>
                </div>

                <div class="report-tabs" style="display:none;">
                    <div class="report-nav">
                        <button class="tab-button active" data-tab="summary">Summary</button>
                        <button class="tab-button" data-tab="customerData">Customer Statement</button>
                        <button class="tab-button" data-tab="expensesData">Project Expenses</button>
                        <button class="tab-button" data-tab="combinedData">Combined View</button>
                    </div>

                    <div class="tab-content">
                        <div class="summary tab-pane active">
                            <div class="summary-content"></div>
                        </div>
                        <div class="customerData tab-pane">
                            <div class="customer-content"></div>
                        </div>
                        <div class="expensesData tab-pane">
                            <div class="expenses-content"></div>
                        </div>
                        <div class="combinedData tab-pane">
                            <div class="combined-content"></div>
                        </div>
                    </div>
                </div>

                <div class="error-message" style="display:none;">
                    <h5>Error</h5>
                    <p class="error-text"></p>
                </div>
            </div>
        `;
        
        // Insert the HTML into the page
        this.wrapper.html(html);
    }

    add_custom_css() {
        // Add any additional CSS specific to the page
        $(`<style>
            .project-contractors-report-wrapper {
                background: #f8f9fa;
            }
            
            .project-contractors-report-wrapper .page-content {
                background: #f8f9fa;
            }
            
            .project-contractors-report-wrapper .unified-report {
                direction: ltr;
            }
            
            .project-contractors-report-wrapper .unified-report table {
                direction: rtl;
            }
        </style>`).appendTo('head');
    }

    setup_filters() {
        // Customer selection
        this.customer_field = frappe.ui.form.make_control({
            parent: this.wrapper.find('.customer-field'),
            df: {
                fieldtype: 'Link',
                options: 'Customer',
                placeholder: __('Select Customer'),
                change: () => this.on_customer_change()
            },
            render_input: true
        });

        // Project Contractor selection
        this.contractor_field = frappe.ui.form.make_control({
            parent: this.wrapper.find('.contractor-field'),
            df: {
                fieldtype: 'Link',
                options: 'Project Contractors',
                placeholder: __('Select Project Contractor'),
                change: () => this.on_contractor_change()
            },
            render_input: true
        });

        // Employee selection
        this.employee_field = frappe.ui.form.make_control({
            parent: this.wrapper.find('.employee-field'),
            df: {
                fieldtype: 'Link',
                options: 'Employee',
                placeholder: __('Select Employee'),
                change: () => this.on_employee_change()
            },
            render_input: true
        });

        // Expense Type selection
        this.expense_type_field = frappe.ui.form.make_control({
            parent: this.wrapper.find('.expense-type-field'),
            df: {
                fieldtype: 'Select',
                placeholder: __('Select Expense Type'),
                change: () => this.on_expense_type_change()
            },
            render_input: true
        });

        // From Date
        this.from_date_field = frappe.ui.form.make_control({
            parent: this.wrapper.find('.from-date-field'),
            df: {
                fieldtype: 'Date',
                placeholder: __('From Date'),
                default: frappe.datetime.add_months(frappe.datetime.get_today(), -1),
                change: () => this.on_from_date_change()
            },
            render_input: true
        });

        // To Date
        this.to_date_field = frappe.ui.form.make_control({
            parent: this.wrapper.find('.to-date-field'),
            df: {
                fieldtype: 'Date',
                placeholder: __('To Date'),
                default: frappe.datetime.get_today(),
                change: () => this.on_to_date_change()
            },
            render_input: true
        });

        // Set default values
        this.filters.fromDate = this.from_date_field.get_value();
        this.filters.toDate = this.to_date_field.get_value();
    }

    setup_actions() {
        // Generate Report button
        this.wrapper.find('.generate-report').click(() => {
            this.generate_report();
        });

        // Clear Filters button
        this.wrapper.find('.clear-filters').click(() => {
            this.clear_filters();
        });

        // Export Excel button
        this.wrapper.find('.export-excel').click(() => {
            this.export_to_excel();
        });

        // Print Report button
        this.wrapper.find('.print-report').click(() => {
            this.print_report();
        });
    }

    setup_tab_functionality() {
        // Tab switching functionality
        this.wrapper.find('.tab-button').click((e) => {
            const targetTab = $(e.target).data('tab');
            
            // Update active tab button
            this.wrapper.find('.tab-button').removeClass('active').css({
                'background': '#e9ecef',
                'color': '#495057'
            });
            
            $(e.target).addClass('active').css({
                'background': '#e74c3c',
                'color': 'white'
            });
            
            // Show target tab content
            this.wrapper.find('.tab-pane').removeClass('active').hide();
            this.wrapper.find(`.${targetTab}`).addClass('active').show();
        });
    }

    on_customer_change() {
        this.filters.customer = this.customer_field.get_value();
        this.update_contractor_field();
    }

    on_contractor_change() {
        this.filters.contractor = this.contractor_field.get_value();
    }

    on_employee_change() {
        this.filters.employee = this.employee_field.get_value();
    }

    on_expense_type_change() {
        this.filters.expenseType = this.expense_type_field.get_value();
    }

    on_from_date_change() {
        this.filters.fromDate = this.from_date_field.get_value();
    }

    on_to_date_change() {
        this.filters.toDate = this.to_date_field.get_value();
    }

    update_contractor_field() {
        if (this.filters.customer) {
            // Filter contractors by customer
            this.contractor_field.df.get_query = () => {
                return {
                    filters: {
                        customer: this.filters.customer
                    }
                };
            };
        } else {
            // Remove filter
            this.contractor_field.df.get_query = null;
        }
        this.contractor_field.refresh();
    }

    load_filter_options() {
        // Load filter options from backend
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.project_contractors_report.project_contractors_report.get_filter_options',
            callback: (r) => {
                if (r.message) {
                    this.data.customers = r.message.customers || [];
                    this.data.contractors = r.message.contractors || [];
                    this.data.employees = r.message.employees || [];
                    
                    // Update expense type options
                    if (r.message.expense_types && r.message.expense_types.length > 0) {
                        this.expense_type_field.df.options = [''].concat(r.message.expense_types);
                        this.expense_type_field.refresh();
                    }
                }
            }
        });
    }

    generate_report() {
        this.show_loading();
        
        // Collect filter values
        this.filters.customer = this.customer_field.get_value();
        this.filters.contractor = this.contractor_field.get_value();
        this.filters.employee = this.employee_field.get_value();
        this.filters.expenseType = this.expense_type_field.get_value();
        this.filters.fromDate = this.from_date_field.get_value();
        this.filters.toDate = this.to_date_field.get_value();
        
        // Validate required fields
        if (!this.filters.fromDate || !this.filters.toDate) {
            this.hide_loading();
            this.show_error(__('Please select both From Date and To Date'));
            return;
        }

        // Call backend method to get report data
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.project_contractors_report.project_contractors_report.get_project_contractors_report_data',
            args: {
                customer: this.filters.customer,
                contractor: this.filters.contractor,
                employee: this.filters.employee,
                expense_type: this.filters.expenseType,
                from_date: this.filters.fromDate,
                to_date: this.filters.toDate
            },
            callback: (r) => {
                this.hide_loading();
                if (r.message) {
                    this.process_report_data(r.message);
                    this.display_report();
                    this.show_export_buttons();
                } else {
                    this.show_error(__('No data found for the selected criteria'));
                }
            },
            error: (r) => {
                this.hide_loading();
                this.show_error(__('Error generating report: ') + (r.message || 'Unknown error'));
            }
        });
    }

    process_report_data(data) {
        // Store the processed data
        this.data.customerStatementData = data.customer_statement;
        this.data.projectExpenses = data.project_expenses || [];
        this.data.summaryData = data.summary || {};
        this.data.combinedData = data.combined || [];

        // Convert customer statement data to flat format for compatibility
        this.data.customerStatements = [];
        if (data.customer_statement && data.customer_statement.service_groups) {
            data.customer_statement.service_groups.forEach(group => {
                group.transactions.forEach(transaction => {
                    this.data.customerStatements.push({
                        date: transaction.date,
                        customer_id: data.customer_statement.customer.name,
                        customer_name: data.customer_statement.customer.customer_name,
                        project_id: transaction.invoice_reference,
                        project_name: group.service_name,
                        account: group.service_name,
                        voucher_type: transaction.transaction_type === 'sales_invoice' ? 'Sales Invoice' : 'Project Claim',
                        voucher_no: transaction.document_number,
                        debit: parseFloat(transaction.value || 0).toFixed(2),
                        credit: parseFloat(transaction.paid || 0).toFixed(2),
                        balance: parseFloat(transaction.balance || 0).toFixed(2),
                        remarks: transaction.description || '',
                        service_group: group.service_name,
                        is_tax_section: group.is_tax_section || false,
                        tax_rate: group.tax_rate || 0
                    });
                });
            });
        }
    }

    display_report() {
        // Display all report sections
        this.display_summary();
        this.display_customer_statement();
        this.display_project_expenses();
        this.display_combined_view();
        
        // Show the report tabs
        this.wrapper.find('.report-tabs').show();
    }

    display_summary() {
        const summaryData = this.data.summaryData;
        const summaryHtml = `
            <div class="row">
                <div class="col-md-3">
                    <div class="card text-center summary-card">
                        <h3>${this.format_currency(summaryData.total_invoiced || 0)}</h3>
                        <p>${__('Total Invoiced')}</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center summary-card success">
                        <h3>${this.format_currency(summaryData.total_paid || 0)}</h3>
                        <p>${__('Total Paid')}</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center summary-card warning">
                        <h3>${this.format_currency(summaryData.total_outstanding || 0)}</h3>
                        <p>${__('Outstanding')}</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center summary-card info">
                        <h3>${this.format_currency(summaryData.total_expenses || 0)}</h3>
                        <p>${__('Total Expenses')}</p>
                    </div>
                </div>
            </div>
            <div class="row mt-4">
                <div class="col-md-12">
                    <div class="card">
                        <div class="card-body">
                            <h5 class="card-title">${__('Report Statistics')}</h5>
                            <div class="row">
                                <div class="col-md-4">
                                    <p><strong>${__('Invoices')}:</strong> ${summaryData.invoice_count || 0}</p>
                                    <p><strong>${__('Claims')}:</strong> ${summaryData.claim_count || 0}</p>
                                </div>
                                <div class="col-md-4">
                                    <p><strong>${__('Expenses')}:</strong> ${summaryData.expense_count || 0}</p>
                                    <p><strong>${__('Date Range')}:</strong> ${frappe.datetime.str_to_user(this.filters.fromDate)} - ${frappe.datetime.str_to_user(this.filters.toDate)}</p>
                                </div>
                                <div class="col-md-4">
                                    <p><strong>${__('Customer')}:</strong> ${this.filters.customer || __('All')}</p>
                                    <p><strong>${__('Contractor')}:</strong> ${this.filters.contractor || __('All')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.wrapper.find('.summary-content').html(summaryHtml);
    }

    display_customer_statement() {
        if (!this.data.customerStatementData || !this.data.customerStatementData.service_groups) {
            this.wrapper.find('.customer-content').html(`
                <div class="alert alert-info">
                    <h5>${__('No Customer Statement Data')}</h5>
                    <p>${__('Please select a customer to view statement data.')}</p>
                </div>
            `);
            return;
        }

        let tableHtml = `
            <div class="table-responsive">
                <table class="table table-striped table-bordered">
                    <thead class="thead-dark">
                        <tr>
                            <th>${__('Date')}</th>
                            <th>${__('Document')}</th>
                            <th>${__('Description')}</th>
                            <th>${__('Debit')}</th>
                            <th>${__('Credit')}</th>
                            <th>${__('Balance')}</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.data.customerStatementData.service_groups.forEach(group => {
            // Add service group header
            tableHtml += `
                <tr style="background-color: #f8f9fa; font-weight: bold;">
                    <td colspan="6">${group.service_name}</td>
                </tr>
            `;

            // Add transactions
            group.transactions.forEach(transaction => {
                tableHtml += `
                    <tr>
                        <td>${frappe.datetime.str_to_user(transaction.date)}</td>
                        <td>${transaction.document_number}</td>
                        <td>${transaction.description}</td>
                        <td class="text-right">${transaction.value ? this.format_currency(transaction.value) : ''}</td>
                        <td class="text-right">${transaction.paid ? this.format_currency(transaction.paid) : ''}</td>
                        <td class="text-right">${this.format_currency(transaction.balance)}</td>
                    </tr>
                `;
            });

            // Add group totals
            tableHtml += `
                <tr style="background-color: #e9ecef; font-weight: bold;">
                    <td colspan="3">${__('Total for')} ${group.service_name}</td>
                    <td class="text-right">${this.format_currency(group.total_value)}</td>
                    <td class="text-right">${this.format_currency(group.total_paid)}</td>
                    <td class="text-right">${this.format_currency(group.total_balance)}</td>
                </tr>
            `;
        });

        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;

        this.wrapper.find('.customer-content').html(tableHtml);
    }

    display_project_expenses() {
        if (!this.data.projectExpenses || this.data.projectExpenses.length === 0) {
            this.wrapper.find('.expenses-content').html(`
                <div class="alert alert-info">
                    <h5>${__('No Project Expenses Data')}</h5>
                    <p>${__('No expenses found for the selected criteria.')}</p>
                </div>
            `);
            return;
        }

        let tableHtml = `
            <div class="table-responsive">
                <table class="table table-striped table-bordered">
                    <thead class="thead-dark">
                        <tr>
                            <th>${__('Date')}</th>
                            <th>${__('Employee')}</th>
                            <th>${__('Expense Type')}</th>
                            <th>${__('Description')}</th>
                            <th>${__('Amount')}</th>
                            <th>${__('Project')}</th>
                            <th>${__('Customer')}</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.data.projectExpenses.forEach(expense => {
            tableHtml += `
                <tr>
                    <td>${frappe.datetime.str_to_user(expense.expense_date)}</td>
                    <td>${expense.employee_name || ''}</td>
                    <td>${expense.expense_type || ''}</td>
                    <td>${expense.description || ''}</td>
                    <td class="text-right">${this.format_currency(expense.amount)}</td>
                    <td>${expense.project_name || ''}</td>
                    <td>${expense.customer_name || ''}</td>
                </tr>
            `;
        });

        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;

        this.wrapper.find('.expenses-content').html(tableHtml);
    }

    display_combined_view() {
        if (!this.data.combinedData || this.data.combinedData.length === 0) {
            this.wrapper.find('.combined-content').html(`
                <div class="alert alert-info">
                    <h5>${__('No Combined Data')}</h5>
                    <p>${__('No data available for combined view.')}</p>
                </div>
            `);
            return;
        }

        let tableHtml = `
            <div class="table-responsive">
                <table class="table table-striped table-bordered">
                    <thead class="thead-dark">
                        <tr>
                            <th>${__('Date')}</th>
                            <th>${__('Type')}</th>
                            <th>${__('Description')}</th>
                            <th>${__('Document')}</th>
                            <th>${__('Amount')}</th>
                            <th>${__('Category')}</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        this.data.combinedData.forEach(item => {
            const amountClass = item.amount >= 0 ? 'text-success' : 'text-danger';
            tableHtml += `
                <tr>
                    <td>${frappe.datetime.str_to_user(item.date)}</td>
                    <td>${item.type}</td>
                    <td>${item.description}</td>
                    <td>${item.document_number}</td>
                    <td class="text-right ${amountClass}">${this.format_currency(Math.abs(item.amount))}</td>
                    <td>${item.category || ''}</td>
                </tr>
            `;
        });

        tableHtml += `
                    </tbody>
                </table>
            </div>
        `;

        this.wrapper.find('.combined-content').html(tableHtml);
    }

    clear_filters() {
        // Clear all filters
        this.customer_field.set_value('');
        this.contractor_field.set_value('');
        this.employee_field.set_value('');
        this.expense_type_field.set_value('');
        this.from_date_field.set_value(frappe.datetime.add_months(frappe.datetime.get_today(), -1));
        this.to_date_field.set_value(frappe.datetime.get_today());
        
        // Reset filters object
        this.filters = {
            customer: '',
            contractor: '',
            employee: '',
            fromDate: this.from_date_field.get_value(),
            toDate: this.to_date_field.get_value(),
            expenseType: ''
        };
        
        // Hide report and export buttons
        this.wrapper.find('.report-tabs').hide();
        this.hide_export_buttons();
        this.hide_error();
    }

    export_to_excel() {
        // Call backend method for Excel export
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.project_contractors_report.project_contractors_report.export_to_excel',
            args: {
                data: {
                    customer_statement: this.data.customerStatementData,
                    project_expenses: this.data.projectExpenses,
                    summary: this.data.summaryData,
                    combined: this.data.combinedData,
                    filters: this.filters
                }
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.msgprint(__('Export functionality will be implemented soon'));
                } else {
                    frappe.msgprint(__('Error exporting to Excel: ') + (r.message?.message || 'Unknown error'));
                }
            }
        });
    }

    print_report() {
        // Print functionality
        const printContent = this.wrapper.find('.unified-report').html();
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Project Contractors Report</title>
                    <link rel="stylesheet" href="/assets/frappe/css/frappe-web.css">
                    <style>
                        body { font-family: Arial, sans-serif; }
                        .tab-content .tab-pane { display: block !important; }
                        .report-nav { display: none; }
                        @media print {
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    ${printContent}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    }

    show_loading() {
        this.wrapper.find('.loading-spinner').show();
        this.wrapper.find('.report-tabs').hide();
        this.hide_error();
    }

    hide_loading() {
        this.wrapper.find('.loading-spinner').hide();
    }

    show_error(message) {
        this.wrapper.find('.error-text').text(message);
        this.wrapper.find('.error-message').show();
    }

    hide_error() {
        this.wrapper.find('.error-message').hide();
    }

    show_export_buttons() {
        this.wrapper.find('.export-excel').show();
        this.wrapper.find('.print-report').show();
    }

    hide_export_buttons() {
        this.wrapper.find('.export-excel').hide();
        this.wrapper.find('.print-report').hide();
    }

    format_currency(amount) {
        return frappe.format(amount, {fieldtype: 'Currency'});
    }

    refresh() {
        // Refresh the page data if needed
        this.load_filter_options();
    }
} 
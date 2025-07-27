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

        // Generate data using the advanced methods from original
        Promise.all([
            this.generateCustomerStatementData(),
            this.generateProjectExpensesData()
        ]).then(() => {
            this.generateCombinedData();
            this.displayReport();
            this.hide_loading();
            this.show_export_buttons();
        }).catch((error) => {
            this.hide_loading();
            this.show_error(__('Error generating report: ') + error.message);
        });
    }

    generateCustomerStatementData() {
        if (!this.filters.customer) {
            this.data.customerStatements = [];
            this.data.customerStatementData = null;
            return Promise.resolve();
        }

        // Get customer statement data using direct database queries
        return this.getCustomerStatementFromDB().then((statementData) => {
            this.data.customerStatementData = statementData;

            // Convert to flat transaction list for compatibility
            this.data.customerStatements = [];

            if (statementData && statementData.service_groups) {
                statementData.service_groups.forEach(group => {
                    group.transactions.forEach(transaction => {
                        this.data.customerStatements.push({
                            date: transaction.date,
                            customer_id: statementData.customer.name,
                            customer_name: statementData.customer.customer_name,
                            project_id: transaction.invoice_reference,
                            project_name: group.service_name,
                            account: group.service_name,
                            voucher_type: transaction.transaction_type === 'sales_invoice' ? 'Sales Invoice' : 'Project Claim',
                            voucher_no: transaction.document_number,
                            debit: transaction.value.toFixed(2),
                            credit: transaction.paid.toFixed(2),
                            balance: transaction.balance.toFixed(2),
                            remarks: transaction.description || '',
                            service_group: group.service_name,
                            is_tax_section: group.is_tax_section || false,
                            tax_rate: group.tax_rate || 0
                        });
                    });
                });
            }
        }).catch((error) => {
            console.error('Error loading customer statement data:', error);
            this.data.customerStatements = [];
            this.data.customerStatementData = null;
        });
    }

    generateProjectExpensesData() {
        // Get project expenses using direct database queries
        return this.getProjectExpensesFromDB().then((expenseData) => {
            this.data.projectExpenses = expenseData.map(expense => ({
                expense_date: expense.expense_date,
                expense_type: expense.expense_type,
                description: expense.description,
                amount: parseFloat(expense.amount || 0).toFixed(2),
                employee_name: expense.employee_name,
                employee_id: expense.employee,
                expense_claim: expense.expense_claim,
                project_contractor: expense.project_contractor,
                contractor_id: expense.project_contractor,
                project_name: expense.project_name,
                customer: expense.customer,
                customer_name: expense.customer_name,
                posting_date: expense.posting_date,
                status: 'Approved'
            }));
        }).catch((error) => {
            console.error('Error loading project expenses data:', error);
            this.data.projectExpenses = [];
        });
    }

    async getCustomerStatementFromDB() {
        if (!this.filters.customer) return null;

        try {
            console.log('Customer Statement Filters:', {
                customer: this.filters.customer,
                fromDate: this.filters.fromDate,
                toDate: this.filters.toDate
            });
            
            // Get customer details
            const customer = await frappe.db.get_doc('Customer', this.filters.customer);

            // Get sales invoices for the customer
            const salesInvoices = await frappe.db.get_list('Sales Invoice', {
                fields: ['name', 'posting_date', 'customer', 'grand_total', 'outstanding_amount', 'custom_for_project'],
                filters: {
                    customer: this.filters.customer,
                    posting_date: ['between', [this.filters.fromDate, this.filters.toDate]],
                    docstatus: 1
                },
                order_by: 'posting_date desc'
            });
            
            console.log(`Found ${salesInvoices.length} sales invoices for customer ${this.filters.customer}:`, salesInvoices);

            // Get project claims for the customer
            const projectClaims = await frappe.db.get_list('Project Claim', {
                fields: ['name', 'date', 'customer', 'claim_amount', 'paid_amount', 'reference_invoice', 'being'],
                filters: {
                    customer: this.filters.customer,
                    date: ['between', [this.filters.fromDate, this.filters.toDate]],
                    docstatus: 1
                },
                order_by: 'date desc'
            });

            // Process the data to create service groups
            const serviceGroups = await this.processStatementDataFromDB(salesInvoices, projectClaims);

            return {
                customer: {
                    name: customer.name,
                    customer_name: customer.customer_name,
                    tax_id: customer.tax_id || '',
                    customer_group: customer.customer_group
                },
                date_range: {
                    from_date: this.filters.fromDate,
                    to_date: this.filters.toDate,
                    from_date_formatted: frappe.datetime.str_to_user(this.filters.fromDate),
                    to_date_formatted: frappe.datetime.str_to_user(this.filters.toDate)
                },
                currency: 'AED',
                service_groups: serviceGroups
            };
        } catch (error) {
            console.error('Error getting customer statement from DB:', error);
            return null;
        }
    }

    async getProjectExpensesFromDB() {
        try {
            // Build filters for expense claim details
            let filters = {
                expense_date: ['between', [this.filters.fromDate, this.filters.toDate]]
            };

            // Enhanced filtering logic based on customer or contractor selection
            let projectContractorNames = [];

            if (this.filters.customer && !this.filters.contractor) {
                // Filter by Customer: Get all Project Contractors for that customer
                try {
                    const customerProjectContractors = await frappe.db.get_list('Project Contractors', {
                        fields: ['name'],
                        filters: {
                            customer: this.filters.customer
                        }
                    });
                    projectContractorNames = customerProjectContractors.map(pc => pc.name);
                    console.log(`Found ${projectContractorNames.length} project contractors for customer ${this.filters.customer}:`, projectContractorNames);

                    if (projectContractorNames.length > 0) {
                        filters.for_project = ['in', projectContractorNames];
                    } else {
                        // No project contractors found for this customer, return empty result
                        console.log('No project contractors found for customer, returning empty result');
                        return [];
                    }
                } catch (error) {
                    console.log('Error fetching project contractors for customer:', error);
                    return [];
                }
            } else if (this.filters.contractor) {
                // Filter by Project Contractors: Get records directly linked to that project
                filters.for_project = this.filters.contractor;
                projectContractorNames = [this.filters.contractor];
            }

            // Get expense claims first, then extract details
            let expenseDetails = [];
            try {
                // First, get all expense claims in the date range
                let expenseClaimsQuery = {
                    fields: ['name', 'employee', 'employee_name', 'posting_date', 'approval_status'],
                    filters: {
                        docstatus: 1,
                        posting_date: ['between', [this.filters.fromDate, this.filters.toDate]]
                    }
                };

                // Add approval status filter if available
                try {
                    expenseClaimsQuery.filters.approval_status = 'Approved';
                } catch (e) {
                    // approval_status field might not exist
                }

                const expenseClaims = await frappe.db.get_list('Expense Claim', expenseClaimsQuery);
                console.log(`Found ${expenseClaims.length} expense claims in date range`);

                if (expenseClaims.length === 0) {
                    return [];
                }

                // Now get the expense claim details for these claims
                const expenseClaimNames = expenseClaims.map(claim => claim.name);

                let detailFilters = {
                    parent: ['in', expenseClaimNames],
                    expense_date: ['between', [this.filters.fromDate, this.filters.toDate]]
                };

                // Add project filtering if specified
                if (this.filters.customer && !this.filters.contractor && projectContractorNames.length > 0) {
                    detailFilters.for_project = ['in', projectContractorNames];
                } else if (this.filters.contractor) {
                    detailFilters.for_project = this.filters.contractor;
                }

                // Try using frappe.db.get_doc to get full expense claims with child tables
                const allExpenseDetails = [];
                for (const claim of expenseClaims) {
                    try {
                        const fullClaim = await frappe.db.get_doc('Expense Claim', claim.name);
                        if (fullClaim.expenses && fullClaim.expenses.length > 0) {
                            fullClaim.expenses.forEach(expense => {
                                // Check if this expense matches our filters
                                const expenseDate = new Date(expense.expense_date);
                                const fromDate = new Date(this.filters.fromDate);
                                const toDate = new Date(this.filters.toDate);

                                if (expenseDate >= fromDate && expenseDate <= toDate) {
                                    // Check project filtering
                                    let includeExpense = true;
                                    if (this.filters.customer && !this.filters.contractor && projectContractorNames.length > 0) {
                                        includeExpense = projectContractorNames.includes(expense.for_project);
                                    } else if (this.filters.contractor) {
                                        includeExpense = expense.for_project === this.filters.contractor;
                                    }

                                    if (includeExpense) {
                                        allExpenseDetails.push({
                                            ...expense,
                                            parent: claim.name,
                                            employee_name: claim.employee_name,
                                            employee: claim.employee,
                                            posting_date: claim.posting_date
                                        });
                                    }
                                }
                            });
                        }
                    } catch (docError) {
                        console.log(`Error getting full document for ${claim.name}:`, docError);
                    }
                }

                expenseDetails = allExpenseDetails;

                console.log(`Found ${expenseDetails.length} expense claim details with filters:`, detailFilters);

                // Get project contractors for the found expense details
                const projectNames = [...new Set(expenseDetails.map(detail => detail.for_project).filter(Boolean))];
                let projectContractors = [];
                if (projectNames.length > 0) {
                    try {
                        projectContractors = await frappe.db.get_list('Project Contractors', {
                            fields: ['name', 'project_name', 'customer', 'customer_name'],
                            filters: {
                                name: ['in', projectNames]
                            }
                        });
                    } catch (error) {
                        console.log('Error fetching project contractors:', error);
                        projectContractors = [];
                    }
                }

                // Create a map of expense claims for easy lookup
                const expenseClaimMap = {};
                expenseClaims.forEach(claim => {
                    expenseClaimMap[claim.name] = claim;
                });

                // Process the results
                const result = [];
                expenseDetails.forEach(detail => {
                    const expenseClaim = expenseClaimMap[detail.parent];
                    if (expenseClaim) {
                        // Get project contractor info if available
                        const projectContractor = projectContractors.find(pc => pc.name === detail.for_project);

                        result.push({
                            expense_date: detail.expense_date,
                            expense_type: detail.expense_type,
                            description: detail.description,
                            amount: detail.amount,
                            employee_name: expenseClaim.employee_name,
                            employee: expenseClaim.employee,
                            expense_claim: detail.parent,
                            project_contractor: detail.for_project,
                            project_name: projectContractor ? projectContractor.project_name : detail.for_project,
                            customer: projectContractor ? projectContractor.customer : '',
                            customer_name: projectContractor ? projectContractor.customer_name : '',
                            posting_date: expenseClaim.posting_date
                        });
                    }
                });

                console.log(`Final project expenses result: ${result.length} items`, result);
                return result;

            } catch (error) {
                console.log('Error in expense processing:', error);
                return [];
            }
        } catch (error) {
            console.error('Error getting project expenses from DB:', error);
            return [];
        }
    }

    async processStatementDataFromDB(salesInvoices, projectClaims) {
        const serviceGroups = [];

        // Group by sales invoice items with enhanced item-level tracking
        for (const invoice of salesInvoices) {
            try {
                // Get invoice items with tax details
                let invoiceItems = [];
                try {
                    invoiceItems = await frappe.db.get_list('Sales Invoice Item', {
                        fields: ['item_code', 'item_name', 'amount', 'base_amount', 'qty', 'rate', 'base_rate'],
                        filters: { parent: invoice.name }
                    });
                    console.log(`Found ${invoiceItems.length} items for invoice ${invoice.name}`);
                } catch (itemError) {
                    console.error('Error fetching Sales Invoice Items:', itemError);
                    // Fallback: create a single item using invoice-level data
                    invoiceItems = [{
                        item_code: 'INVOICE_TOTAL',
                        item_name: `Invoice ${invoice.name}`,
                        amount: invoice.grand_total,
                        base_amount: invoice.grand_total,
                        qty: 1,
                        rate: invoice.grand_total,
                        base_rate: invoice.grand_total
                    }];
                    console.log(`Using fallback invoice-level data for ${invoice.name}: ${invoice.grand_total}`);
                }

                // Get all claim items for this invoice to track partial payments
                let claimItems = [];
                try {
                    claimItems = await frappe.db.get_list('Claim Items', {
                        fields: ['item', 'amount', 'tax_amount', 'invoice_reference', 'project_contractor_reference', 'parent'],
                        filters: {
                            invoice_reference: invoice.name,
                            project_contractor_reference: ['!=', '']
                        }
                    });
                    console.log(`Found ${claimItems.length} claim items for invoice ${invoice.name}:`, claimItems);

                    // If tax_amount is undefined, get it from the Project Claim document
                    if (claimItems.length > 0 && claimItems[0].tax_amount === undefined && claimItems[0].parent) {
                        console.log(`Getting tax info from Project Claim: ${claimItems[0].parent}`);
                        try {
                            const projectClaim = await frappe.db.get_doc('Project Claim', claimItems[0].parent);
                            console.log('Project Claim document:', projectClaim);

                            if (projectClaim.claim_items && projectClaim.claim_items.length > 0) {
                                // Match claim items with their tax amounts from the full document
                                claimItems.forEach(claimItem => {
                                    const fullClaimItem = projectClaim.claim_items.find(pci =>
                                        pci.invoice_reference === claimItem.invoice_reference &&
                                        parseFloat(pci.amount) === parseFloat(claimItem.amount)
                                    );

                                    if (fullClaimItem) {
                                        claimItem.tax_amount = parseFloat(fullClaimItem.tax_amount || 0);
                                        claimItem.item = fullClaimItem.item;
                                        claimItem.project_contractor_reference = fullClaimItem.project_contractor_reference;
                                        console.log(`Updated claim item with tax_amount: ${claimItem.tax_amount}`);
                                    }
                                });
                            }
                        } catch (docError) {
                            console.log('Error getting Project Claim document:', docError);
                        }
                    }
                } catch (error) {
                    console.log('Error fetching claim items:', error);
                    claimItems = [];
                }

                // Process each invoice item separately for detailed tracking
                for (const item of invoiceItems) {
                    let serviceGroup = serviceGroups.find(sg => sg.service_name === item.item_name);

                    if (!serviceGroup) {
                        serviceGroup = {
                            service_name: item.item_name,
                            item_code: item.item_code,
                            transactions: [],
                            total_value: 0,
                            total_paid: 0,
                            total_balance: 0,
                            total_claimed_tax: 0,
                            is_tax_section: false
                        };
                        serviceGroups.push(serviceGroup);
                    }

                    // Add sales invoice transaction (debit) - full item amount
                    const itemTotalAmount = parseFloat(item.amount || item.base_amount || 0);
                    const itemRate = parseFloat(item.rate || item.base_rate || 0);
                    serviceGroup.transactions.push({
                        date: invoice.posting_date,
                        document_number: invoice.name,
                        description: `Invoice for ${item.item_name} (Qty: ${item.qty}, Rate: ${this.formatCurrency(itemRate)})`,
                        value: itemTotalAmount,
                        paid: 0,
                        tax_amount: 0, // Tax will be tracked separately
                        balance: 0, // Will be calculated later
                        transaction_type: 'sales_invoice',
                        invoice_reference: invoice.name
                    });

                    // Add related claim transactions for this specific item (credits)
                    const itemClaims = claimItems.filter(claim => claim.item === item.item_name);
                    
                    console.log(`Processing ${itemClaims.length} claim items for invoice item ${item.item_name}`);
                    for (const claimItem of itemClaims) {
                        console.log('Processing claim item:', claimItem);
                        // Get the parent project claim details
                        const projectClaimDetails = projectClaims.find(pc => pc.name === claimItem.parent);
                        console.log('Found project claim details:', projectClaimDetails ? 'YES' : 'NO');

                        if (projectClaimDetails && parseFloat(claimItem.amount || 0) > 0) {
                            console.log(`Adding regular payment transaction for item ${item.item_name}: ${claimItem.amount}`);
                            serviceGroup.transactions.push({
                                date: projectClaimDetails.date,
                                document_number: claimItem.parent,
                                description: `${projectClaimDetails.being || 'Payment received'} - Item: ${item.item_name}`,
                                value: 0,
                                paid: parseFloat(claimItem.amount || 0),
                                tax_amount: parseFloat(claimItem.tax_amount || 0),
                                balance: 0, // Will be calculated later
                                transaction_type: 'project_claim',
                                invoice_reference: invoice.name,
                                claim_reference: claimItem.parent
                            });
                            console.log('Regular payment transaction added successfully');
                        }
                    }
                }

                // Add tax section if there are taxes from Sales Taxes and Charges
                let taxDetails = [];
                try {
                    taxDetails = await frappe.db.get_list('Sales Taxes and Charges', {
                        fields: ['rate', 'tax_amount', 'account_head'],
                        filters: { parent: invoice.name }
                    });
                } catch (error) {
                    console.log('Error fetching tax details:', error);
                    taxDetails = [];
                }

                if (taxDetails.length > 0) {
                    const mainTaxRate = taxDetails[0].rate || 5;
                    const taxAccountHead = taxDetails[0].account_head || 'VAT';
                    const totalInvoiceTax = taxDetails.reduce((sum, tax) => sum + parseFloat(tax.tax_amount || 0), 0);

                    let taxServiceGroup = serviceGroups.find(sg => sg.is_tax_section && sg.tax_rate === mainTaxRate);
                    
                    if (!taxServiceGroup) {
                        taxServiceGroup = {
                            service_name: taxAccountHead,
                            transactions: [],
                            total_value: 0,
                            total_paid: 0,
                            total_balance: 0,
                            total_claimed_tax: 0,
                            is_tax_section: true,
                            tax_rate: mainTaxRate
                        };
                        serviceGroups.push(taxServiceGroup);
                    }

                    // Add tax invoice transaction
                    taxServiceGroup.transactions.push({
                        date: invoice.posting_date,
                        document_number: invoice.name,
                        description: `Tax on invoice ${invoice.name} (${mainTaxRate}%)`,
                        value: totalInvoiceTax,
                        paid: 0,
                        tax_amount: 0,
                        balance: 0,
                        transaction_type: 'sales_invoice',
                        invoice_reference: invoice.name
                    });

                    // Add tax payments from claims
                    const totalTaxPaidForInvoice = claimItems.reduce((sum, claim) => sum + parseFloat(claim.tax_amount || 0), 0);
                    if (totalTaxPaidForInvoice > 0) {
                        const relatedClaims = [...new Set(claimItems.map(ci => ci.parent))];
                        
                        for (const claimName of relatedClaims) {
                            const claimDetails = projectClaims.find(pc => pc.name === claimName);
                            const claimTaxAmount = claimItems
                                .filter(ci => ci.parent === claimName)
                                .reduce((sum, ci) => sum + parseFloat(ci.tax_amount || 0), 0);
                            
                            if (claimDetails && claimTaxAmount > 0) {
                                taxServiceGroup.transactions.push({
                                    date: claimDetails.date,
                                    document_number: claimName,
                                    description: `Tax payment for ${claimDetails.being || 'claim'} (${mainTaxRate}%)`,
                                    value: 0,
                                    paid: claimTaxAmount,
                                    tax_amount: 0,
                                    balance: 0,
                                    transaction_type: 'project_claim',
                                    invoice_reference: invoice.name,
                                    claim_reference: claimName
                                });
                            }
                        }
                    }
                }

            } catch (error) {
                console.error('Error processing invoice:', invoice.name, error);
            }
        }

        // Calculate running balances for each service group
        serviceGroups.forEach(group => {
            // Sort transactions by date and type (invoices first, then claims)
            group.transactions.sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                if (dateA.getTime() === dateB.getTime()) {
                    return a.transaction_type === 'sales_invoice' ? -1 : 1;
                }
                return dateA - dateB;
            });

            // Calculate running balance and totals
            let runningBalance = 0;
            group.transactions.forEach(transaction => {
                runningBalance += parseFloat(transaction.value || 0) - parseFloat(transaction.paid || 0);
                transaction.balance = runningBalance;
            });

            // Calculate group totals
            group.total_value = group.transactions.reduce((sum, t) => sum + parseFloat(t.value || 0), 0);
            group.total_paid = group.transactions.reduce((sum, t) => sum + parseFloat(t.paid || 0), 0);
            group.total_balance = runningBalance;
            group.total_claimed_tax = group.transactions.reduce((sum, t) => sum + parseFloat(t.tax_amount || 0), 0);
        });

        return serviceGroups;
    }

    generateCombinedData() {
        // Combine customer statements and project expenses
        this.data.combinedData = [];

        // Add customer statements
        this.data.customerStatements.forEach(item => {
            this.data.combinedData.push({
                ...item,
                type: 'Customer Statement',
                amount: parseFloat(item.debit) - parseFloat(item.credit)
            });
        });

        // Add project expenses
        this.data.projectExpenses.forEach(item => {
            this.data.combinedData.push({
                ...item,
                type: 'Project Expense',
                date: item.expense_date,
                amount: -parseFloat(item.amount) // Expenses are negative
            });
        });

        // Sort by date
        this.data.combinedData.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    displayReport() {
        this.display_summary();
        this.display_customer_statement();  
        this.display_project_expenses();
        this.display_combined_view();
        
        // Show the report tabs
        this.wrapper.find('.report-tabs').show();
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
        const summaryContent = this.wrapper.find('.summary-content');

        // Calculate totals from rich data
        let totalInvoiced = 0;
        let totalPaid = 0;
        let totalBalance = 0;
        let serviceCount = 0;

        if (this.data.customerStatementData && this.data.customerStatementData.service_groups) {
            this.data.customerStatementData.service_groups.forEach(group => {
                totalInvoiced += group.total_value || 0;
                totalPaid += group.total_paid || 0;
                totalBalance += group.total_balance || 0;
                serviceCount++;
            });
        }

        const totalExpenses = this.data.projectExpenses.reduce((sum, item) =>
            sum + parseFloat(item.amount || 0), 0);

        const netPosition = totalPaid - totalExpenses;

        // Count records
        const expenseRecords = this.data.projectExpenses.length;

        // Get filter info
        const selectedCustomer = this.filters.customer || 'All Customers';
        let selectedContractor = this.filters.contractor || 'All Contractors';

        // Get customer name if available
        let customerName = selectedCustomer;
        if (this.data.customerStatementData && this.data.customerStatementData.customer) {
            customerName = this.data.customerStatementData.customer.customer_name;
        }

        // Get project name from Project Contractors if contractor is selected
        if (this.filters.contractor && selectedContractor !== 'All Contractors') {
            frappe.db.get_doc('Project Contractors', this.filters.contractor).then(contractorData => {
                if (contractorData && contractorData.project_name) {
                    selectedContractor = contractorData.project_name;
                }
            }).catch(error => {
                console.log('Could not fetch project name from contractor:', error);
            });
        }

        const summaryHtml = `
            <div class="row">
                <div class="col-md-12">
                    <div class="summary-card p-4 rounded">
                        <div class="row align-items-center">
                            <div class="col-md-2 text-center">
                                <img src="/files/orbit_logo.png" alt="Orbit Logo" style="height: 60px; width: auto;" onerror="this.style.display='none'">
                            </div>
                            <div class="col-md-10">
                                <h4 class="text-white mb-0">Integrated Business Report Summary</h4>
                                <p class="text-light mb-0">Comprehensive financial analysis and project cost tracking</p>
                            </div>
                        </div>
                        <hr style="border-color: rgba(255,255,255,0.3);">
                        <div class="row mt-3">
                            <div class="col-md-6">
                                <h6 class="text-light">📊 Filter Information:</h6>
                                <p class="text-white"><strong>Customer:</strong> ${customerName}</p>
                                <p class="text-white"><strong>Project:</strong> ${selectedContractor}</p>
                                <p class="text-white"><strong>Date Range:</strong> ${this.filters.fromDate} to ${this.filters.toDate}</p>
                            </div>
                            <div class="col-md-6">
                                <h6 class="text-light">📈 Data Overview:</h6>
                                <p class="text-white"><strong>Service Groups:</strong> ${serviceCount}</p>
                                <p class="text-white"><strong>Project Expense Records:</strong> ${expenseRecords}</p>
                                <p class="text-white"><strong>Analysis Period:</strong> ${this.filters.fromDate} to ${this.filters.toDate}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row mt-4">
                <div class="col-md-3">
                    <div class="card text-center border-primary shadow-sm">
                        <div class="card-body">
                            <div class="mb-2">💰</div>
                            <h5 class="card-title text-primary">Total Invoiced</h5>
                            <h3 class="text-primary font-weight-bold">${this.formatCurrency(totalInvoiced)}</h3>
                            <p class="card-text text-muted">Total billed to customers</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center border-success shadow-sm">
                        <div class="card-body">
                            <div class="mb-2">💵</div>
                            <h5 class="card-title text-success">Total Collected</h5>
                            <h3 class="text-success font-weight-bold">${this.formatCurrency(totalPaid)}</h3>
                            <p class="card-text text-muted">Actual payments received</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center border-warning shadow-sm">
                        <div class="card-body">
                            <div class="mb-2">💸</div>
                            <h5 class="card-title text-warning">Project Expenses</h5>
                            <h3 class="text-warning font-weight-bold">${this.formatCurrency(totalExpenses)}</h3>
                            <p class="card-text text-muted">Total project costs</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card text-center ${netPosition >= 0 ? 'border-success' : 'border-danger'} shadow-sm">
                        <div class="card-body">
                            <div class="mb-2">${netPosition >= 0 ? '📈' : '📉'}</div>
                            <h5 class="card-title ${netPosition >= 0 ? 'text-success' : 'text-danger'}">Net Profit/Loss</h5>
                            <h3 class="${netPosition >= 0 ? 'text-success' : 'text-danger'} font-weight-bold">${this.formatCurrency(netPosition)}</h3>
                            <p class="card-text text-muted">Collections minus expenses</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row mt-3">
                <div class="col-md-12">
                    <div class="card bg-secondary text-white shadow">
                        <div class="card-body text-center">
                            <div class="row">
                                <div class="col-md-3">
                                    <strong>Outstanding Balance:</strong><br>
                                    <span class="h5">${this.formatCurrency(totalBalance)}</span>
                                </div>
                                <div class="col-md-3">
                                    <strong>Collection Rate:</strong><br>
                                    <span class="h5">${totalInvoiced > 0 ? ((totalPaid / totalInvoiced) * 100).toFixed(1) + '%' : 'N/A'}</span>
                                </div>
                                <div class="col-md-3">
                                    <strong>Profit Margin:</strong><br>
                                    <span class="h5 ${netPosition >= 0 ? 'text-success' : 'text-danger'}">${totalPaid > 0 ? ((netPosition / totalPaid) * 100).toFixed(1) + '%' : 'N/A'}</span>
                                </div>
                                <div class="col-md-3">
                                    <strong>Analysis Status:</strong><br>
                                    <span class="h5 text-info">✅ Complete</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        summaryContent.html(summaryHtml);
    }

    display_customer_statement() {
        const customerContent = this.wrapper.find('.customer-content');

        if (!this.data.customerStatementData || !this.data.customerStatementData.service_groups) {
            customerContent.html(`
                <div class="alert alert-info">
                    <h5>No Customer Statement Data</h5>
                    <p>Please select a customer and generate the report to view detailed statement.</p>
                </div>
            `);
            return;
        }

        const statementData = this.data.customerStatementData;

        let html = `
            <div class="statement-header">
                <div class="row">
                    <div class="col-md-6">
                        <h4>📋 Detailed Customer Statement</h4>
                        <p><strong>Customer:</strong> ${statementData.customer.customer_name}</p>
                        <p><strong>Period:</strong> ${statementData.date_range.from_date_formatted} to ${statementData.date_range.to_date_formatted}</p>
                    </div>
                    <div class="col-md-6">
                        <p><strong>Customer ID:</strong> ${statementData.customer.name}</p>
                        <p><strong>Tax ID:</strong> ${statementData.customer.tax_id || 'N/A'}</p>
                        <p><strong>Currency:</strong> ${statementData.currency}</p>
                    </div>
                </div>
            </div>

            <div class="business-summary mb-4">
                <div class="card bg-light">
                    <div class="card-body">
                        <h6 class="card-title text-primary">📊 Business Process Summary</h6>
                        <p class="text-muted">This statement shows item-level tracking where customers can make partial payments for specific items from their invoices. Each payment (Project Claim) can cover different items with calculated taxes based on claimed amounts.</p>
                    </div>
                </div>
            </div>
        `;

        // Separate regular services from tax sections
        const regularServices = statementData.service_groups.filter(group => !group.is_tax_section);
        const taxSections = statementData.service_groups.filter(group => group.is_tax_section);

        // Display regular service groups first
        regularServices.forEach(group => {
            html += `
                <div class="service-group mb-4">
                    <div class="service-header">
                        <h5 class="service-title bg-primary text-white p-3 text-center">
                            🛍️ ${group.service_name}
                            <small class="float-right">
                                Item Code: ${group.item_code || 'N/A'}
                            </small>
                        </h5>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-striped table-bordered">
                            <thead class="table-primary">
                                <tr>
                                    <th width="10%">Date</th>
                                    <th width="12%">Document No.</th>
                                    <th width="35%">Description</th>
                                    <th width="12%">Debit</th>
                                    <th width="12%">Credit</th>
                                    <th width="12%">Balance</th>
                                    <th width="7%">Type</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            group.transactions.forEach(transaction => {
                const typeClass = transaction.transaction_type === 'sales_invoice' ? 'badge-primary' : 'badge-success';
                const typeName = transaction.transaction_type === 'sales_invoice' ? 'Invoice' : 'Payment';
                const typeIcon = transaction.transaction_type === 'sales_invoice' ? '📄' : '💰';

                // Enhanced description with more business context
                let enhancedDescription = transaction.description;
                if (transaction.transaction_type === 'project_claim' && transaction.claim_reference) {
                    enhancedDescription += ` (Claim: ${transaction.claim_reference})`;
                }

                html += `
                    <tr>
                        <td>${this.formatDisplayDate(transaction.date)}</td>
                        <td class="link-cell">
                            <a href="#" onclick="event.preventDefault()" title="View Document">
                                ${transaction.document_number}
                            </a>
                        </td>
                        <td>
                            <div>${enhancedDescription}</div>
                            ${transaction.tax_amount > 0 ? 
                                `<small class="text-muted">Tax Amount: ${this.formatCurrency(transaction.tax_amount)}</small>` 
                                : ''
                            }
                        </td>
                        <td class="amount-cell text-right">
                            ${transaction.value > 0 ? this.formatCurrency(transaction.value) : ''}
                        </td>
                        <td class="amount-cell text-right">
                            ${transaction.paid > 0 ? this.formatCurrency(transaction.paid) : ''}
                        </td>
                        <td class="amount-cell text-right ${transaction.balance >= 0 ? 'text-success' : 'text-danger'}">
                            ${this.formatCurrency(transaction.balance)}
                        </td>
                        <td>
                            <span class="badge ${typeClass}" title="${typeName}">
                                ${typeIcon} ${typeName}
                            </span>
                        </td>
                    </tr>
                `;
            });

            html += `
                            </tbody>
                            <tfoot class="table-secondary">
                                <tr>
                                    <td colspan="3"><strong>📈 ${group.service_name} Totals</strong></td>
                                    <td class="text-right"><strong>${this.formatCurrency(group.total_value)}</strong></td>
                                    <td class="text-right"><strong>${this.formatCurrency(group.total_paid)}</strong></td>
                                    <td class="text-right"><strong>${this.formatCurrency(group.total_balance)}</strong></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    
                    <div class="item-summary mt-2">
                        <div class="row">
                            <div class="col-md-3">
                                <div class="card text-center border-primary">
                                    <div class="card-body p-2">
                                        <small class="text-muted">Total Invoiced</small>
                                        <div class="h6 text-primary">${this.formatCurrency(group.total_value)}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card text-center border-success">
                                    <div class="card-body p-2">
                                        <small class="text-muted">Total Paid</small>
                                        <div class="h6 text-success">${this.formatCurrency(group.total_paid)}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card text-center border-warning">
                                    <div class="card-body p-2">
                                        <small class="text-muted">Outstanding</small>
                                        <div class="h6 text-warning">${this.formatCurrency(group.total_balance)}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="card text-center border-info">
                                    <div class="card-body p-2">
                                        <small class="text-muted">Payment %</small>
                                        <div class="h6 text-info">
                                            ${group.total_value > 0 ? ((group.total_paid / group.total_value) * 100).toFixed(1) + '%' : '0%'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        // Display tax sections
        taxSections.forEach(group => {
            html += `
                <div class="service-group mb-4">
                    <div class="service-header">
                        <h5 class="service-title bg-warning text-dark p-3 text-center">
                            🧾 ${group.service_name} - VAT ${group.tax_rate}%
                            <small class="float-right">
                                Tax Section
                            </small>
                        </h5>
                    </div>
                    <div class="table-responsive">
                        <table class="table table-striped table-bordered">
                            <thead class="table-warning">
                                <tr>
                                    <th width="10%">Date</th>
                                    <th width="12%">Document No.</th>
                                    <th width="35%">Description</th>
                                    <th width="12%">Tax Due</th>
                                    <th width="12%">Tax Paid</th>
                                    <th width="12%">Tax Balance</th>
                                    <th width="7%">Type</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            group.transactions.forEach(transaction => {
                const typeClass = transaction.transaction_type === 'sales_invoice' ? 'badge-warning' : 'badge-success';
                const typeName = transaction.transaction_type === 'sales_invoice' ? 'Tax Due' : 'Tax Paid';
                const typeIcon = transaction.transaction_type === 'sales_invoice' ? '📋' : '💳';

                html += `
                    <tr>
                        <td>${this.formatDisplayDate(transaction.date)}</td>
                        <td class="link-cell">
                            <a href="#" onclick="event.preventDefault()">${transaction.document_number}</a>
                        </td>
                        <td>${transaction.description}</td>
                        <td class="amount-cell text-right">
                            ${transaction.value > 0 ? this.formatCurrency(transaction.value) : ''}
                        </td>
                        <td class="amount-cell text-right">
                            ${transaction.paid > 0 ? this.formatCurrency(transaction.paid) : ''}
                        </td>
                        <td class="amount-cell text-right ${transaction.balance >= 0 ? 'text-warning' : 'text-success'}">
                            ${this.formatCurrency(transaction.balance)}
                        </td>
                        <td>
                            <span class="badge ${typeClass}">
                                ${typeIcon} ${typeName}
                            </span>
                        </td>
                    </tr>
                `;
            });

            html += `
                            </tbody>
                            <tfoot class="table-warning">
                                <tr>
                                    <td colspan="3"><strong>🧾 Tax Summary (${group.tax_rate}%)</strong></td>
                                    <td class="text-right"><strong>${this.formatCurrency(group.total_value)}</strong></td>
                                    <td class="text-right"><strong>${this.formatCurrency(group.total_paid)}</strong></td>
                                    <td class="text-right"><strong>${this.formatCurrency(group.total_balance)}</strong></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            `;
        });

        // Add overall statement summary
        const totalInvoiced = regularServices.reduce((sum, g) => sum + g.total_value, 0);
        const totalPaid = regularServices.reduce((sum, g) => sum + g.total_paid, 0);
        const totalOutstanding = regularServices.reduce((sum, g) => sum + g.total_balance, 0);
        const totalTaxDue = taxSections.reduce((sum, g) => sum + g.total_value, 0);
        const totalTaxPaid = taxSections.reduce((sum, g) => sum + g.total_paid, 0);

        html += `
            <div class="statement-summary mt-4">
                <div class="card border-primary">
                    <div class="card-header bg-primary text-white">
                        <h5 class="mb-0">📊 Complete Statement Summary</h5>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6 class="text-primary">💼 Services & Items</h6>
                                <table class="table table-sm">
                                    <tr>
                                        <td>Total Invoiced:</td>
                                        <td class="text-right"><strong>${this.formatCurrency(totalInvoiced)}</strong></td>
                                    </tr>
                                    <tr>
                                        <td>Total Paid:</td>
                                        <td class="text-right text-success"><strong>${this.formatCurrency(totalPaid)}</strong></td>
                                    </tr>
                                    <tr>
                                        <td>Outstanding Balance:</td>
                                        <td class="text-right text-warning"><strong>${this.formatCurrency(totalOutstanding)}</strong></td>
                                    </tr>
                                </table>
                            </div>
                            <div class="col-md-6">
                                <h6 class="text-warning">🧾 Tax Summary</h6>
                                <table class="table table-sm">
                                    <tr>
                                        <td>Total Tax Due:</td>
                                        <td class="text-right"><strong>${this.formatCurrency(totalTaxDue)}</strong></td>
                                    </tr>
                                    <tr>
                                        <td>Total Tax Paid:</td>
                                        <td class="text-right text-success"><strong>${this.formatCurrency(totalTaxPaid)}</strong></td>
                                    </tr>
                                    <tr>
                                        <td>Tax Outstanding:</td>
                                        <td class="text-right text-warning"><strong>${this.formatCurrency(totalTaxDue - totalTaxPaid)}</strong></td>
                                    </tr>
                                </table>
                            </div>
                        </div>
                        <hr>
                        <div class="row">
                            <div class="col-md-12 text-center">
                                <h5 class="text-primary">
                                    💰 Grand Total Outstanding: ${this.formatCurrency(totalOutstanding + (totalTaxDue - totalTaxPaid))}
                                </h5>
                                <p class="text-muted">
                                    Collection Rate: ${totalInvoiced > 0 ? ((totalPaid / totalInvoiced) * 100).toFixed(1) + '%' : '0%'} |
                                    Service Groups: ${regularServices.length} |
                                    Tax Sections: ${taxSections.length}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        customerContent.html(html);
    }

    display_project_expenses() {
        const expensesContent = this.wrapper.find('.expenses-content');

        if (!this.data.projectExpenses || this.data.projectExpenses.length === 0) {
            expensesContent.html(`
                <div class="alert alert-info">
                    <h5>No Project Expenses Data</h5>
                    <p>No expenses found for the selected criteria. Expenses are linked to Project Contractors via the custom field.</p>
                </div>
            `);
            return;
        }

        // Group expenses by project contractor with enhanced organization
        const expensesByProject = {};
        const expensesByEmployee = {};
        let totalExpenses = 0;

        this.data.projectExpenses.forEach(expense => {
            const projectKey = expense.project_contractor || 'Unknown Project';
            const employeeKey = expense.employee_name || 'Unknown Employee';
            const expenseAmount = parseFloat(expense.amount || 0);
            totalExpenses += expenseAmount;

            // Group by project contractor
            if (!expensesByProject[projectKey]) {
                expensesByProject[projectKey] = {
                    project_name: expense.project_name || projectKey,
                    customer_name: expense.customer_name || 'Unknown Customer',
                    customer_id: expense.customer || '',
                    project_contractor_id: expense.project_contractor || '',
                    expenses: [],
                    total_amount: 0,
                    employee_count: new Set(),
                    expense_types: new Set()
                };
            }
            expensesByProject[projectKey].expenses.push(expense);
            expensesByProject[projectKey].total_amount += expenseAmount;
            expensesByProject[projectKey].employee_count.add(employeeKey);
            expensesByProject[projectKey].expense_types.add(expense.expense_type);

            // Group by employee for analysis
            if (!expensesByEmployee[employeeKey]) {
                expensesByEmployee[employeeKey] = {
                    employee_name: employeeKey,
                    employee_id: expense.employee || '',
                    total_amount: 0,
                    project_count: new Set(),
                    expenses: []
                };
            }
            expensesByEmployee[employeeKey].total_amount += expenseAmount;
            expensesByEmployee[employeeKey].project_count.add(projectKey);
            expensesByEmployee[employeeKey].expenses.push(expense);
        });

        let html = `
            <div class="expenses-header mb-4">
                <div class="row">
                    <div class="col-md-8">
                        <h4>💼 Project Expenses & Cost Analysis</h4>
                        <p class="text-muted">Detailed breakdown of project-related expenses linked to Project Contractors</p>
                    </div>
                    <div class="col-md-4">
                        <div class="card bg-light">
                            <div class="card-body text-center">
                                <h6 class="card-title">💰 Total Project Costs</h6>
                                <h4 class="text-danger">${this.formatCurrency(totalExpenses)}</h4>
                                <small class="text-muted">Across ${Object.keys(expensesByProject).length} projects</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="expense-summary mb-4">
                <div class="row">
                    <div class="col-md-3">
                        <div class="card text-center border-primary">
                            <div class="card-body">
                                <h6 class="text-primary">📊 Projects</h6>
                                <h4 class="text-primary">${Object.keys(expensesByProject).length}</h4>
                                <small class="text-muted">Active projects with expenses</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-center border-success">
                            <div class="card-body">
                                <h6 class="text-success">👥 Employees</h6>
                                <h4 class="text-success">${Object.keys(expensesByEmployee).length}</h4>
                                <small class="text-muted">Employees with expenses</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-center border-warning">
                            <div class="card-body">
                                <h6 class="text-warning">📋 Claims</h6>
                                <h4 class="text-warning">${this.data.projectExpenses.length}</h4>
                                <small class="text-muted">Total expense entries</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="card text-center border-info">
                            <div class="card-body">
                                <h6 class="text-info">📅 Period</h6>
                                <h6 class="text-info">${this.filters.fromDate}</h6>
                                <small class="text-muted">to ${this.filters.toDate}</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Display each project group with enhanced details
        Object.keys(expensesByProject).forEach(projectKey => {
            const projectGroup = expensesByProject[projectKey];
            const avgExpensePerEmployee = projectGroup.total_amount / projectGroup.employee_count.size;

            html += `
                <div class="expense-group mb-4">
                    <div class="expense-header">
                        <div class="card">
                            <div class="card-header bg-info text-white">
                                <div class="row">
                                    <div class="col-md-8">
                                        <h5 class="mb-0">
                                            🏗️ ${projectGroup.project_name}
                                            <small class="text-light d-block">Customer: ${projectGroup.customer_name}</small>
                                        </h5>
                                    </div>
                                    <div class="col-md-4 text-right">
                                        <h5 class="mb-0">Total: ${this.formatCurrency(projectGroup.total_amount)}</h5>
                                        <small class="text-light">
                                            ${projectGroup.employee_count.size} employees | 
                                            ${projectGroup.expense_types.size} expense types
                                        </small>
                                    </div>
                                </div>
                            </div>
                            <div class="card-body">
                                <div class="row mb-3">
                                    <div class="col-md-3">
                                        <small class="text-muted">Project Contractor ID:</small>
                                        <div class="font-weight-bold">${projectGroup.project_contractor_id || 'N/A'}</div>
                                    </div>
                                    <div class="col-md-3">
                                        <small class="text-muted">Customer ID:</small>
                                        <div class="font-weight-bold">${projectGroup.customer_id || 'N/A'}</div>
                                    </div>
                                    <div class="col-md-3">
                                        <small class="text-muted">Avg per Employee:</small>
                                        <div class="font-weight-bold text-warning">${this.formatCurrency(avgExpensePerEmployee)}</div>
                                    </div>
                                    <div class="col-md-3">
                                        <small class="text-muted">Expense Types:</small>
                                        <div class="font-weight-bold text-info">${Array.from(projectGroup.expense_types).join(', ')}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="table-responsive mt-3">
                        <table class="table table-striped table-bordered">
                            <thead class="table-secondary">
                                <tr>
                                    <th width="10%">📅 Date</th>
                                    <th width="15%">🏷️ Expense Type</th>
                                    <th width="30%">📝 Description</th>
                                    <th width="12%">💰 Amount</th>
                                    <th width="15%">👤 Employee</th>
                                    <th width="12%">📄 Claim No.</th>
                                    <th width="6%">📊 Status</th>
                                </tr>
                            </thead>
                            <tbody>
            `;

            // Sort expenses by date (newest first)
            projectGroup.expenses.sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));

            projectGroup.expenses.forEach(expense => {
                html += `
                    <tr>
                        <td>${this.formatDisplayDate(expense.expense_date)}</td>
                        <td>
                            <span class="badge badge-secondary">${expense.expense_type}</span>
                        </td>
                        <td>
                            <div>${expense.description}</div>
                            <small class="text-muted">Posted: ${this.formatDisplayDate(expense.posting_date)}</small>
                        </td>
                        <td class="amount-cell text-right text-danger">
                            <strong>${this.formatCurrency(expense.amount)}</strong>
                        </td>
                        <td>
                            <div class="font-weight-bold">${expense.employee_name}</div>
                            <small class="text-muted">${expense.employee_id || ''}</small>
                        </td>
                        <td class="link-cell">
                            <a href="#" onclick="event.preventDefault()" title="View Expense Claim">
                                ${expense.expense_claim}
                            </a>
                        </td>
                        <td>
                            <span class="badge badge-success" title="Approved">✅</span>
                        </td>
                    </tr>
                `;
            });

            html += `
                            </tbody>
                            <tfoot class="table-warning">
                                <tr>
                                    <td colspan="3"><strong>🏗️ ${projectGroup.project_name} Total</strong></td>
                                    <td class="text-right"><strong>${this.formatCurrency(projectGroup.total_amount)}</strong></td>
                                    <td colspan="3">
                                        <small class="text-muted">
                                            ${projectGroup.expenses.length} expense entries | 
                                            ${projectGroup.employee_count.size} employees involved
                                        </small>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            `;
        });

        expensesContent.html(html);
    }

    display_combined_view() {
        const combinedContent = this.wrapper.find('.combined-content');

        if ((!this.data.customerStatementData || !this.data.customerStatementData.service_groups) &&
            (!this.data.projectExpenses || this.data.projectExpenses.length === 0)) {
            combinedContent.html(`
                <div class="alert alert-info">
                    <h5>No Combined Data</h5>
                    <p>Please generate both customer statement and project expenses data to view the combined analysis.</p>
                </div>
            `);
            return;
        }

        // Prepare combined transaction data
        const combinedTransactions = [];
        let totalRevenue = 0;
        let totalExpenses = 0;

        // Add revenue transactions from customer statement
        if (this.data.customerStatementData && this.data.customerStatementData.service_groups) {
            this.data.customerStatementData.service_groups.forEach(group => {
                if (!group.is_tax_section) { // Skip VAT sections
                    group.transactions.forEach(transaction => {
                        if (transaction.value > 0) { // Invoice transactions
                            combinedTransactions.push({
                                date: transaction.date,
                                type: 'Revenue',
                                description: `Invoice: ${transaction.description}`,
                                reference: transaction.document_number,
                                project_service: group.service_name,
                                amount: transaction.value,
                                customer_contractor: this.data.customerStatementData.customer.customer_name,
                                category: 'Sales Invoice',
                                balance_impact: transaction.value
                            });
                            totalRevenue += transaction.value;
                        }
                        if (transaction.paid > 0) { // Payment transactions
                            combinedTransactions.push({
                                date: transaction.date,
                                type: 'Collection',
                                description: `Payment: ${transaction.description}`,
                                reference: transaction.document_number,
                                project_service: group.service_name,
                                amount: transaction.paid,
                                customer_contractor: this.data.customerStatementData.customer.customer_name,
                                category: 'Project Claim',
                                balance_impact: -transaction.paid
                            });
                        }
                    });
                }
            });
        }

        // Add expense transactions
        if (this.data.projectExpenses && this.data.projectExpenses.length > 0) {
            this.data.projectExpenses.forEach(expense => {
                const expenseAmount = parseFloat(expense.amount || 0);
                combinedTransactions.push({
                    date: expense.expense_date,
                    type: 'Expense',
                    description: `${expense.expense_type}: ${expense.description}`,
                    reference: expense.expense_claim,
                    project_service: expense.project_name || expense.project_contractor,
                    amount: expenseAmount,
                    customer_contractor: expense.employee_name,
                    category: expense.expense_type,
                    balance_impact: expenseAmount
                });
                totalExpenses += expenseAmount;
            });
        }

        // Sort transactions by date
        combinedTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Calculate net position
        const netPosition = totalRevenue - totalExpenses;

        let html = `
            <div class="combined-header mb-4">
                <div class="row">
                    <div class="col-md-8">
                        <h4>📊 Combined Financial Analysis - All Transactions</h4>
                        <p class="text-muted">Comprehensive view of all revenue and expense transactions</p>
                    </div>
                    <div class="col-md-4">
                        <div class="summary-stats">
                            <div class="row">
                                <div class="col-6 text-center">
                                    <div class="stat-box bg-success text-white p-2 rounded">
                                        <small>Total Revenue</small><br>
                                        <strong>${this.formatCurrency(totalRevenue)}</strong>
                                    </div>
                                </div>
                                <div class="col-6 text-center">
                                    <div class="stat-box bg-warning text-white p-2 rounded">
                                        <small>Total Expenses</small><br>
                                        <strong>${this.formatCurrency(totalExpenses)}</strong>
                                    </div>
                                </div>
                            </div>
                            <div class="row mt-2">
                                <div class="col-12 text-center">
                                    <div class="stat-box ${netPosition >= 0 ? 'bg-success' : 'bg-danger'} text-white p-2 rounded">
                                        <small>Net Position</small><br>
                                        <strong>${this.formatCurrency(netPosition)}</strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="table-responsive">
                <table class="combined-table table table-striped">
                    <thead>
                        <tr>
                            <th width="10%">📅 Date</th>
                            <th width="12%">🏷️ Type</th>
                            <th width="25%">📝 Description</th>
                            <th width="12%">📄 Reference</th>
                            <th width="18%">🏗️ Project/Service</th>
                            <th width="13%">💰 Amount</th>
                            <th width="10%">📊 Category</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        combinedTransactions.forEach(transaction => {
            const typeClass = transaction.type === 'Expense' ? 'expense-row' : 'revenue-row';
            const typeIcon = transaction.type === 'Expense' ? '💸' : 
                           transaction.type === 'Collection' ? '💵' : '💰';
            const amountClass = transaction.type === 'Expense' ? 'text-danger' : 'text-success';

            html += `
                <tr class="${typeClass}">
                    <td>${this.formatDisplayDate(transaction.date)}</td>
                    <td>
                        <span class="badge ${transaction.type === 'Expense' ? 'bg-warning' : 'bg-success'} text-white">
                            ${typeIcon} ${transaction.type}
                        </span>
                    </td>
                    <td>
                        <div class="transaction-desc">
                            ${transaction.description}
                        </div>
                    </td>
                    <td class="link-cell">
                        <a href="#" onclick="event.preventDefault()" title="View Document">
                            ${transaction.reference}
                        </a>
                    </td>
                    <td>
                        <div class="project-info">
                            <strong>${transaction.project_service}</strong><br>
                            <small class="text-muted">${transaction.customer_contractor}</small>
                        </div>
                    </td>
                    <td class="amount-cell text-right">
                        <strong class="${amountClass}">${this.formatCurrency(transaction.amount)}</strong>
                    </td>
                    <td>
                        <span class="badge bg-secondary text-white" style="font-size: 0.75em;">
                            ${transaction.category}
                        </span>
                    </td>
                </tr>
            `;
        });

        html += `
                    </tbody>
                    <tfoot class="table-secondary">
                        <tr>
                            <td colspan="5"><strong>📈 Combined Totals Summary</strong></td>
                            <td class="text-right">
                                <div><strong class="text-success">Revenue: ${this.formatCurrency(totalRevenue)}</strong></div>
                                <div><strong class="text-warning">Expenses: ${this.formatCurrency(totalExpenses)}</strong></div>
                                <div><strong class="${netPosition >= 0 ? 'text-success' : 'text-danger'}">Net: ${this.formatCurrency(netPosition)}</strong></div>
                            </td>
                            <td class="text-center">
                                <strong>${combinedTransactions.length} Transactions</strong>
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div class="combined-insights mt-4">
                <div class="card border-secondary">
                    <div class="card-header bg-secondary text-white">
                        <h6 class="mb-0">💡 Financial Analysis Insights</h6>
                    </div>
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-3 text-center">
                                <div class="insight-metric">
                                    <h5 class="text-primary">${combinedTransactions.filter(t => t.type !== 'Expense').length}</h5>
                                    <small class="text-muted">Revenue Transactions</small>
                                </div>
                            </div>
                            <div class="col-md-3 text-center">
                                <div class="insight-metric">
                                    <h5 class="text-warning">${combinedTransactions.filter(t => t.type === 'Expense').length}</h5>
                                    <small class="text-muted">Expense Transactions</small>
                                </div>
                            </div>
                            <div class="col-md-3 text-center">
                                <div class="insight-metric">
                                    <h5 class="${netPosition >= 0 ? 'text-success' : 'text-danger'}">
                                        ${totalRevenue > 0 ? ((netPosition / totalRevenue) * 100).toFixed(1) + '%' : 'N/A'}
                                    </h5>
                                    <small class="text-muted">Profit Margin</small>
                                </div>
                            </div>
                            <div class="col-md-3 text-center">
                                <div class="insight-metric">
                                    <h5 class="text-info">
                                        ${totalRevenue > 0 ? ((totalExpenses / totalRevenue) * 100).toFixed(1) + '%' : 'N/A'}
                                    </h5>
                                    <small class="text-muted">Expense Ratio</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        combinedContent.html(html);
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
        // Get the currently active tab
        const activeTab = this.wrapper.find('.tab-button.active').attr('data-tab');
        
        // Get the content of the active tab only
        let printContent = '';
        let printTitle = 'Project Contractors Report';
        
        // Get report header
        const reportHeader = this.wrapper.find('.report-header').html();
        
        switch(activeTab) {
            case 'summary':
                printContent = this.wrapper.find('.summary-content').html();
                printTitle = 'Project Contractors Report - Summary';
                break;
            case 'customerData':
                printContent = this.wrapper.find('.customer-content').html();
                printTitle = 'Project Contractors Report - Customer Statement';
                break;
            case 'expensesData':
                printContent = this.wrapper.find('.expenses-content').html();
                printTitle = 'Project Contractors Report - Project Expenses';
                break;
            case 'combinedData':
                printContent = this.wrapper.find('.combined-content').html();
                printTitle = 'Project Contractors Report - Combined View';
                break;
            default:
                // Fallback to full report
                printContent = this.wrapper.find('.unified-report').html();
                printTitle = 'Project Contractors Report - Complete';
        }
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>${printTitle}</title>
                    <link rel="stylesheet" href="/assets/frappe/css/frappe-web.css">
                    <style>
                        body { 
                            font-family: Arial, sans-serif; 
                            margin: 20px;
                            background: white;
                        }
                        .report-header {
                            text-align: center; 
                            margin-bottom: 30px; 
                            padding: 20px; 
                            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); 
                            color: white; 
                            border-radius: 10px; 
                            position: relative;
                        }
                        .orbit-logo img {
                            height: 40px; 
                            width: auto;
                        }
                        .tab-content .tab-pane { display: block !important; }
                        .report-nav { display: none; }
                        .filter-section { display: none; }
                        .no-print { display: none; }
                        
                        /* Print-specific styles */
                        @media print {
                            body { margin: 0; }
                            .report-header { 
                                background: #2c3e50 !important; 
                                -webkit-print-color-adjust: exact;
                                color-adjust: exact;
                            }
                            .card { break-inside: avoid; }
                            .table { font-size: 12px; }
                            .summary-card {
                                background: #34495e !important;
                                -webkit-print-color-adjust: exact;
                                color-adjust: exact;
                            }
                        }
                        
                        /* Table styles for better printing */
                        .table {
                            width: 100%;
                            border-collapse: collapse;
                        }
                        .table th, .table td {
                            border: 1px solid #dee2e6;
                            padding: 8px;
                            text-align: left;
                        }
                        .table th {
                            background-color: #f8f9fa;
                            font-weight: bold;
                        }
                        .amount-cell {
                            text-align: right;
                        }
                        .text-right {
                            text-align: right;
                        }
                        .text-center {
                            text-align: center;
                        }
                        
                        /* Card styles */
                        .card {
                            border: 1px solid #dee2e6;
                            border-radius: 8px;
                            margin-bottom: 20px;
                        }
                        .card-header {
                            background-color: #f8f9fa;
                            padding: 15px;
                            border-bottom: 1px solid #dee2e6;
                            font-weight: bold;
                        }
                        .card-body {
                            padding: 15px;
                        }
                        
                        /* Badge styles */
                        .badge {
                            display: inline-block;
                            padding: 4px 8px;
                            font-size: 12px;
                            border-radius: 4px;
                            color: white;
                        }
                        .badge-primary { background-color: #007bff; }
                        .badge-success { background-color: #28a745; }
                        .badge-warning { background-color: #ffc107; color: #212529; }
                        .badge-secondary { background-color: #6c757d; }
                        
                        /* Color classes */
                        .text-primary { color: #007bff; }
                        .text-success { color: #28a745; }
                        .text-warning { color: #ffc107; }
                        .text-danger { color: #dc3545; }
                        .text-info { color: #17a2b8; }
                        .text-muted { color: #6c757d; }
                        
                        .bg-primary { background-color: #007bff; color: white; }
                        .bg-success { background-color: #28a745; color: white; }
                        .bg-warning { background-color: #ffc107; color: #212529; }
                        .bg-secondary { background-color: #6c757d; color: white; }
                        .bg-info { background-color: #17a2b8; color: white; }
                        .bg-light { background-color: #f8f9fa; }
                    </style>
                </head>
                <body>
                    <div class="report-header">
                        <div class="orbit-logo">
                            <img src="/files/orbit_logo.png" alt="Orbit Logo" onerror="this.style.display='none'">
                        </div>
                        <h2>Customer Balance & Project Expense Report</h2>
                        <p>Comprehensive financial analysis and project cost tracking</p>
                        <p><strong>Report Section:</strong> ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1).replace('Data', ' Data')}</p>
                        <p><strong>Generated on:</strong> ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                    </div>
                    <div class="print-content">
                        ${printContent}
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        
        // Give the window time to load before printing
        setTimeout(() => {
            printWindow.print();
            // Close the print window after printing (optional)
            printWindow.onafterprint = () => {
                printWindow.close();
            };
        }, 500);
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

    formatCurrency(amount) {
        if (amount === null || amount === undefined) {
            return 'AED 0.00';
        }

        // Get currency from customer statement data, fallback to AED
        const currency = (this.data.customerStatementData && this.data.customerStatementData.currency) || 'AED';

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(parseFloat(amount) || 0);
    }

    formatDisplayDate(dateString) {
        const date = new Date(dateString);
        const day = date.getDate();
        const month = date.getMonth() + 1; // getMonth() is 0-indexed
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    }

    refresh() {
        // Refresh the page data if needed
        this.load_filter_options();
    }
} 
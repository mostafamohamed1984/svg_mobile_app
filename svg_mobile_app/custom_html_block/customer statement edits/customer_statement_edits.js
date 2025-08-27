class AccountStatementReport {
    constructor() {
        this.data = {
            reportType: '',
            projectAgreements: [],
            currentData: null,
            customerData: null,
            contractorData: null,
            engineerData: null
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
        this.setupEventListeners();
        this.setDefaultDates();
        this.setupTabFunctionality();
    }
    
    setupEventListeners() {
        // Report type change
        root_element.querySelector('#reportType').addEventListener('change', (e) => {
            this.filters.reportType = e.target.value;
            this.handleReportTypeChange();
        });

        // Date change events
        root_element.querySelector('#fromDate').addEventListener('change', (e) => {
            this.filters.fromDate = e.target.value;
        });
        
        root_element.querySelector('#toDate').addEventListener('change', (e) => {
            this.filters.toDate = e.target.value;
        });
        
        // Button events
        root_element.querySelector('#generateReport').addEventListener('click', () => {
            this.generateReport();
        });
        
        root_element.querySelector('#clearFilters').addEventListener('click', () => {
            this.clearFilters();
        });
        
        root_element.querySelector('#printReport').addEventListener('click', () => {
            this.printReport();
        });
    }
    
    setDefaultDates() {
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        root_element.querySelector('#fromDate').value = this.formatDate(firstDay);
        root_element.querySelector('#toDate').value = this.formatDate(lastDay);
        
        this.filters.fromDate = this.formatDate(firstDay);
        this.filters.toDate = this.formatDate(lastDay);
    }
    
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }
    
    handleReportTypeChange() {
        const reportType = this.filters.reportType;
        
        // Hide all filter groups
        this.hideAllFilterGroups();
        
        // Update report title
        this.updateReportTitle(reportType);
        
        // Update report type display
        this.updateReportTypeDisplay(reportType);
        
        if (!reportType) {
            root_element.querySelector('#dynamicFilters').style.display = 'none';
            root_element.querySelector('#actionButtons').style.display = 'none';
            root_element.querySelector('#selectedReportTypeDisplay').style.display = 'none';
            return;
        }
        
        // Show common elements
        root_element.querySelector('#dynamicFilters').style.display = 'block';
        root_element.querySelector('#actionButtons').style.display = 'block';
        root_element.querySelector('#projectAgreementFilterGroup').style.display = 'block';
        root_element.querySelector('#itemFilterGroup').style.display = 'block';
        root_element.querySelector('#dateRangeGroup').style.display = 'block';
        root_element.querySelector('#toDateGroup').style.display = 'block';
        
        // Show specific filter based on type
        switch(reportType) {
            case 'customer':
                root_element.querySelector('#customerFilterGroup').style.display = 'block';
                this.initializeCustomerField();
                break;
            case 'contractor':
                root_element.querySelector('#contractorFilterGroup').style.display = 'block';
                this.initializeContractorField();
                break;
            case 'engineer':
                root_element.querySelector('#engineerFilterGroup').style.display = 'block';
                this.initializeEngineerField();
                break;
        }
        
        this.initializeProjectAgreementField();
        this.initializeItemField();
    }
    
    hideAllFilterGroups() {
        const groups = ['customerFilterGroup', 'contractorFilterGroup', 'engineerFilterGroup'];
        groups.forEach(group => {
            root_element.querySelector(`#${group}`).style.display = 'none';
        });
    }
    
    updateReportTitle(reportType) {
        const titles = {
            customer: 'Customer Account Statement / كشف حساب عميل',
            contractor: 'Contractor Account Statement / كشف حساب مقاول',
            engineer: 'Engineer Account Statement / كشف حساب مهندس'
        };
        
        const titleElement = root_element.querySelector('#reportTitle');
        titleElement.textContent = titles[reportType] || 'Account Statement Report';
    }
    
    updateReportTypeDisplay(reportType) {
        const displayElement = root_element.querySelector('#selectedReportTypeDisplay');
        const textElement = root_element.querySelector('#reportTypeText');
        
        if (!reportType) {
            displayElement.style.display = 'none';
            return;
        }
        
        const typeLabels = {
            customer: 'Customer (عميل)',
            contractor: 'Contractor (مقاول)',
            engineer: 'Outsource Engineer (مهندس)'
        };
        
        textElement.textContent = typeLabels[reportType] || reportType;
        displayElement.style.display = 'block';
    }
    
    initializeCustomerField() {
        try {
            this.controls.customer = frappe.ui.form.make_control({
                parent: root_element.querySelector('#customer-field'),
                df: {
                    fieldtype: 'Link',
                    options: 'Customer',
                    fieldname: 'customer',
                    placeholder: 'Select Customer',
                    onchange: () => {
                        this.filters.customer = this.controls.customer.get_value();
                        this.updateProjectAgreementFilter();
                    }
                },
                render_input: true
            });
            this.controls.customer.refresh();
        } catch (error) {
            console.error('Error initializing customer field:', error);
        }
    }
    
    initializeContractorField() {
        try {
            this.controls.contractor = frappe.ui.form.make_control({
                parent: root_element.querySelector('#contractor-field'),
                df: {
                    fieldtype: 'Link',
                    options: 'Customer',
                    fieldname: 'contractor',
                    placeholder: 'Select Contractor',
                    onchange: () => {
                        this.filters.contractor = this.controls.contractor.get_value();
                        this.updateProjectAgreementFilter();
                    }
                },
                render_input: true
            });
            this.controls.contractor.refresh();
        } catch (error) {
            console.error('Error initializing contractor field:', error);
        }
    }
    
    initializeEngineerField() {
        try {
            this.controls.engineer = frappe.ui.form.make_control({
                parent: root_element.querySelector('#engineer-field'),
                df: {
                    fieldtype: 'Link',
                    options: 'Supplier',
                    fieldname: 'engineer',
                    placeholder: 'Select Engineer',
                    onchange: () => {
                        this.filters.engineer = this.controls.engineer.get_value();
                        this.updateProjectAgreementFilter();
                    }
                },
                render_input: true
            });
            this.controls.engineer.refresh();
        } catch (error) {
            console.error('Error initializing engineer field:', error);
        }
    }
    
    initializeProjectAgreementField() {
        try {
            this.controls.projectAgreement = frappe.ui.form.make_control({
                parent: root_element.querySelector('#project-agreement-field'),
                df: {
                    fieldtype: 'Link',
                    options: 'Project Agreement',
                    fieldname: 'project_agreement',
                    placeholder: 'Select Project Agreement',
                    get_query: () => {
                        return this.getProjectAgreementQuery();
                    },
                    onchange: () => {
                        this.filters.projectAgreement = this.controls.projectAgreement.get_value();
                        this.handleProjectAgreementChange();
                    }
                },
                render_input: true
            });
            this.controls.projectAgreement.refresh();
        } catch (error) {
            console.error('Error initializing project agreement field:', error);
        }
    }
    
    initializeItemField() {
        try {
            this.controls.item = frappe.ui.form.make_control({
                parent: root_element.querySelector('#item-field'),
                df: {
                    fieldtype: 'Link',
                    options: 'Item',
                    fieldname: 'item',
                    placeholder: 'Select Item/Service (Optional)',
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
    
    getProjectAgreementQuery() {
        const filters = { docstatus: 1 };
        
        if (this.filters.reportType === 'customer' && this.filters.customer) {
            filters.customer = this.filters.customer;
        }
        
        return { filters: filters };
    }
    
    updateProjectAgreementFilter() {
        if (this.controls.projectAgreement) {
            this.controls.projectAgreement.set_value('');
            this.filters.projectAgreement = '';
        }
    }
    
    handleProjectAgreementChange() {
        // Auto-populate customer from project agreement if selected
        if (this.filters.projectAgreement && this.filters.reportType === 'customer') {
            this.loadProjectAgreementDetails();
        }
    }
    
    async loadProjectAgreementDetails() {
        try {
            const doc = await frappe.db.get_doc('Project Agreement', this.filters.projectAgreement);
            if (doc && doc.customer && this.controls.customer) {
                this.controls.customer.set_value(doc.customer);
                this.filters.customer = doc.customer;
            }
        } catch (error) {
            console.error('Error loading project agreement details:', error);
        }
    }
    
    setupTabFunctionality() {
        // Add click event listeners to tab buttons
        const tabButtons = root_element.querySelectorAll('.tab-button');
        const tabPanes = root_element.querySelectorAll('.tab-pane');
        
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const targetTab = e.target.getAttribute('data-tab');
                
                // Remove active class from all buttons and panes
                tabButtons.forEach(btn => {
                    btn.classList.remove('active');
                    btn.style.background = '#e9ecef';
                    btn.style.color = '#495057';
                });
                tabPanes.forEach(pane => {
                    pane.classList.remove('active');
                    pane.style.display = 'none';
                });
                
                // Add active class to clicked button and corresponding pane
                e.target.classList.add('active');
                e.target.style.background = '#e74c3c';
                e.target.style.color = 'white';
                
                const targetPane = root_element.querySelector(`#${targetTab}`);
                if (targetPane) {
                    targetPane.classList.add('active');
                    targetPane.style.display = 'block';
                }
            });
        });
    }
    
    generateReport() {
        if (!this.validateFilters()) {
            return;
        }
        
        this.showLoading();
        
        // Load data based on report type
        switch(this.filters.reportType) {
            case 'customer':
                this.loadCustomerReport();
                break;
            case 'contractor':
                this.loadContractorReport();
                break;
            case 'engineer':
                this.loadEngineerReport();
                break;
        }
    }
    
    validateFilters() {
        if (!this.filters.reportType) {
            this.showError('Please select a report type');
            return false;
        }
        
        if (!this.filters.fromDate || !this.filters.toDate) {
            this.showError('Please select both From Date and To Date');
            return false;
        }
        
        return true;
    }
    
    async loadCustomerReport() {
        try {
            // Load project agreements for customer
            const filters = this.buildCustomerFilters();
            
            const projectAgreements = await frappe.db.get_list('Project Agreement', {
                fields: ['name', 'project_name', 'customer', 'customer_name', 'project_date',
                        'total_services_amount', 'total_government_fees', 'total_project_amount',
                        'total_received', 'received_tax', 'unclaimed_amount'],
                filters: filters,
                order_by: 'project_date desc'
            });
            
            if (projectAgreements.length === 0) {
                this.hideLoading();
                this.showError('No project agreements found for the selected criteria');
                return;
            }
            
            // Process customer data
            this.data.customerData = await this.processCustomerData(projectAgreements);
            
            this.displayCustomerReport();
            this.hideLoading();
            this.showPrintOptions();
            
        } catch (error) {
            this.hideLoading();
            this.showError('Error loading customer report: ' + error.message);
        }
    }
    
    buildCustomerFilters() {
        const filters = { docstatus: 1 };
        
        if (this.filters.customer) {
            filters.customer = this.filters.customer;
        }
        
        if (this.filters.projectAgreement) {
            filters.name = this.filters.projectAgreement;
        }
        
        if (this.filters.fromDate && this.filters.toDate) {
            filters.project_date = ['between', [this.filters.fromDate, this.filters.toDate]];
        }
        
        return filters;
    }
    
    async processCustomerData(projectAgreements) {
        const customerData = {
            projectAgreements: projectAgreements,
            projectsData: [],
            combinedTaxDetails: [],
            combinedGovernmentFees: [],
            combinedExpenses: [],
            combinedTrustFees: [],
            combinedTrustFeesLog: [],
            combinedPendingExpenses: []
        };
        
        // Process each project agreement
        for (const project of projectAgreements) {
            const fullProject = await frappe.db.get_doc('Project Agreement', project.name);
            
            // Process services and payments for this project
            const projectServicesPayments = await this.processProjectServices(fullProject);
            
            // Filter by item if specified
            let filteredServicesPayments = projectServicesPayments;
            if (this.filters.item) {
                filteredServicesPayments = projectServicesPayments.filter(item => 
                    item.item === this.filters.item
                );
            }
            
            // Process tax details for this project
            const projectTaxData = this.processProjectTaxes(fullProject);
            
            // Create project data structure
            const projectData = {
                projectInfo: project,
                servicesPayments: filteredServicesPayments,
                taxDetails: projectTaxData,
                governmentFees: fullProject.government_fees || [],
                expenses: fullProject.expenses_log || [],
                trustFees: fullProject.trust_fees || [],
                trustFeesLog: fullProject.trust_fees_log || [],
                pendingExpenses: fullProject.pending_expenses || []
            };
            
            customerData.projectsData.push(projectData);
            
            // Combine all data for summary calculations
            customerData.combinedTaxDetails.push(...projectTaxData);
            customerData.combinedGovernmentFees.push(...(fullProject.government_fees || []));
            customerData.combinedExpenses.push(...(fullProject.expenses_log || []));
            customerData.combinedTrustFees.push(...(fullProject.trust_fees || []));
            customerData.combinedTrustFeesLog.push(...(fullProject.trust_fees_log || []));
            customerData.combinedPendingExpenses.push(...(fullProject.pending_expenses || []));
        }
        
        return customerData;
    }
    
    async processProjectServices(project) {
        const services = project.project_services || [];
        const payments = project.payment_log || [];
        
        const groupedServices = {};
        
        // Group services by item
        services.forEach(service => {
            if (!groupedServices[service.item]) {
                groupedServices[service.item] = {
                    item: service.item,
                    transactions: [],
                    totalDebit: 0,
                    totalCredit: 0
                };
            }
            
            // Add service transaction
            groupedServices[service.item].transactions.push({
                date: service.invoice_date,
                type: 'Service',
                debit: service.amount || 0,
                credit: 0,
                balance: 0,
                remark: service.remark || ''
            });
            
            groupedServices[service.item].totalDebit += service.amount || 0;
        });
        
        // Add payment transactions - match payments to specific items
        payments.forEach(payment => {
            const paymentItem = payment.item;
            
            // Ensure the item exists in groupedServices (create if payment exists without service)
            if (paymentItem && !groupedServices[paymentItem]) {
                groupedServices[paymentItem] = {
                    item: paymentItem,
                    transactions: [],
                    totalDebit: 0,
                    totalCredit: 0
                };
            }
            
            if (paymentItem && groupedServices[paymentItem]) {
                // Determine if this is a credit or debit based on transaction type
                let debitAmount = 0;
                let creditAmount = 0;
                
                switch (payment.transaction_type) {
                    case 'Payment':
                        creditAmount = payment.payment_amount || 0;
                        break;
                    case 'Discount':
                        creditAmount = payment.payment_amount || 0;
                        break;
                    case 'Cancel Due':
                        creditAmount = payment.payment_amount || 0;
                        break;
                    case 'Return':
                        creditAmount = payment.payment_amount || 0;
                        break;
                    default:
                        creditAmount = payment.payment_amount || 0;
                        break;
                }
                
                groupedServices[paymentItem].transactions.push({
                    date: payment.date,
                    type: payment.transaction_type || 'Payment',
                    debit: debitAmount,
                    credit: creditAmount,
                    balance: 0,
                    remark: payment.remark || ''
                });
                
                groupedServices[paymentItem].totalDebit += debitAmount;
                groupedServices[paymentItem].totalCredit += creditAmount;
            }
        });
        
        // Calculate running balances
        Object.values(groupedServices).forEach(itemGroup => {
            itemGroup.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            let balance = 0;
            itemGroup.transactions.forEach(transaction => {
                balance += (transaction.debit || 0) - (transaction.credit || 0);
                transaction.balance = balance;
            });
            
            itemGroup.finalBalance = balance;
        });
        
        return Object.values(groupedServices);
    }
    
    processProjectTaxes(project) {
        const services = project.project_services || [];
        const payments = project.payment_log || [];
        const taxTransactions = [];
        
        // Add tax from services
        services.forEach(service => {
            if (service.tax_amount && service.tax_amount > 0) {
                taxTransactions.push({
                    date: service.invoice_date,
                    type: 'Service Tax',
                    debit: service.tax_amount,
                    credit: 0,
                    balance: 0,
                    remark: service.remark || ''
                });
            }
        });
        
        // Add tax payments - handle different transaction types
        payments.forEach(payment => {
            if (payment.payment_tax && payment.payment_tax > 0) {
                let debitAmount = 0;
                let creditAmount = 0;
                let transactionTypeLabel = 'Tax Payment';
                
                switch (payment.transaction_type) {
                    case 'Payment':
                        creditAmount = payment.payment_tax;
                        transactionTypeLabel = 'Tax Payment';
                        break;
                    case 'Discount':
                        creditAmount = payment.payment_tax;
                        transactionTypeLabel = 'Tax Discount';
                        break;
                    case 'Cancel Due':
                        creditAmount = payment.payment_tax;
                        transactionTypeLabel = 'Tax Cancel Due';
                        break;
                    case 'Return':
                        creditAmount = payment.payment_tax;
                        transactionTypeLabel = 'Tax Return';
                        break;
                    default:
                        creditAmount = payment.payment_tax;
                        transactionTypeLabel = 'Tax Payment';
                        break;
                }
                
                taxTransactions.push({
                    date: payment.date,
                    type: transactionTypeLabel,
                    debit: debitAmount,
                    credit: creditAmount,
                    balance: 0,
                    remark: payment.remark || ''
                });
            }
        });
        
        // Calculate running balance
        taxTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let balance = 0;
        taxTransactions.forEach(transaction => {
            balance += (transaction.debit || 0) - (transaction.credit || 0);
            transaction.balance = balance;
        });
        
        return taxTransactions;
    }
    
    groupServicesByItem(allServices) {
        const grouped = {};
        
        allServices.forEach(service => {
            if (!grouped[service.item]) {
                grouped[service.item] = {
                    item: service.item,
                    transactions: [],
                    totalDebit: 0,
                    totalCredit: 0,
                    finalBalance: 0
                };
            }
            
            grouped[service.item].transactions.push(...service.transactions);
            grouped[service.item].totalDebit += service.totalDebit;
            grouped[service.item].totalCredit += service.totalCredit;
        });
        
        // Recalculate balances for grouped data
        Object.values(grouped).forEach(group => {
            group.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            let balance = 0;
            group.transactions.forEach(transaction => {
                balance += (transaction.debit || 0) - (transaction.credit || 0);
                transaction.balance = balance;
            });
            
            group.finalBalance = balance;
        });
        
        return Object.values(grouped);
    }
    
    displayCustomerReport() {
        this.displayReportInfo();
        this.showCustomerTabs();
        this.displayServicesPayments();
        this.displayGovernmentFeesExpenses();
        this.displayTrustFees();
        
        root_element.querySelector('#reportTabs').style.display = 'block';
    }
    
    displayReportInfo() {
        const customerName = this.getCustomerName();
        const projectNames = this.getProjectNames();
        
        const infoContent = `
            <div class="report-info-section">
                <h4>Report Information</h4>
                <div class="info-row">
                    <span><strong>Customer:</strong> ${customerName}</span>
                    <span><strong>Report Period:</strong> ${this.filters.fromDate} to ${this.filters.toDate}</span>
                </div>
                <div class="info-row">
                    <span><strong>Projects:</strong> ${projectNames}</span>
                    <span><strong>Report Type:</strong> ${this.getReportTypeLabel()}</span>
                </div>
            </div>
        `;
        
        root_element.querySelector('#reportInfo').innerHTML = infoContent;
    }
    
    getCustomerName() {
        if (this.data.customerData && this.data.customerData.projectAgreements.length > 0) {
            return this.data.customerData.projectAgreements[0].customer_name || this.data.customerData.projectAgreements[0].customer;
        }
        return this.filters.customer || 'Multiple Customers';
    }
    
    getProjectNames() {
        if (this.data.customerData && this.data.customerData.projectAgreements.length > 0) {
            return this.data.customerData.projectAgreements.map(p => p.project_name || p.name).join(', ');
        }
        return 'No Projects';
    }
    
    getReportTypeLabel() {
        const labels = {
            customer: 'Customer Account Statement',
            contractor: 'Contractor Account Statement',
            engineer: 'Engineer Account Statement'
        };
        return labels[this.filters.reportType] || 'Account Statement';
    }
    
    showCustomerTabs() {
        // Hide all tab groups
        root_element.querySelector('#contractorTabs').style.display = 'none';
        root_element.querySelector('#engineerTabs').style.display = 'none';
        
        // Show customer tabs
        root_element.querySelector('#customerTabs').style.display = 'block';
        
        // Reset tab states
        this.resetTabStates();
        
        // Show first tab by default
        root_element.querySelector('[data-tab="servicesPayments"]').click();
    }
    
    resetTabStates() {
        const allTabs = root_element.querySelectorAll('.tab-pane');
        allTabs.forEach(tab => {
            tab.style.display = 'none';
            tab.classList.remove('active');
        });
        
        const allButtons = root_element.querySelectorAll('.tab-button');
        allButtons.forEach(btn => {
            btn.classList.remove('active');
            btn.style.background = '#e9ecef';
            btn.style.color = '#495057';
        });
    }
    
    displayServicesPayments() {
        const content = root_element.querySelector('#servicesPaymentsContent');
        
        if (!this.data.customerData || !this.data.customerData.projectsData.length) {
            content.innerHTML = '<div class="alert alert-info">No services and payments data found.</div>';
            return;
        }
        
        let html = '<h4 style="color: #2c3e50; margin-bottom: 20px;">📋 Services & Payments</h4>';
        
        // Display each project
        this.data.customerData.projectsData.forEach(projectData => {
            if (projectData.servicesPayments.length > 0) {
                html += this.generateProjectSection(projectData);
            }
        });
        
        // Display combined tax details if available
        if (this.data.customerData.combinedTaxDetails.length > 0) {
            html += this.generateTaxSection(this.data.customerData.combinedTaxDetails);
        }
        
        // Add summary cards
        html += this.generateServicesSummaryCards();
        
        content.innerHTML = html;
    }
    
    generateProjectSection(projectData) {
        const projectInfo = projectData.projectInfo;
        
        let html = `
            <div class="project-section">
                <h3>Project: ${projectInfo.project_name || projectInfo.name}</h3>
                <div style="padding: 20px;">
        `;
        
        // Display each item within this project
        projectData.servicesPayments.forEach(item => {
            html += this.generateItemSection(item);
        });
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }
    
    generateItemSection(item) {
        return `
            <div class="item-section">
                <h4>Item: ${item.item}</h4>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Due</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Remark</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${item.transactions.map(transaction => `
                                <tr class="transaction-row">
                                    <td>${transaction.date}</td>
                                    <td>${transaction.type}</td>
                                    <td class="amount-cell">${transaction.debit > 0 ? this.formatCurrency(transaction.debit) : '—'}</td>
                                    <td class="amount-cell positive-amount">${transaction.credit > 0 ? this.formatCurrency(transaction.credit) : '—'}</td>
                                    <td class="amount-cell ${transaction.balance > 0 ? 'negative-amount' : 'positive-amount'}">${this.formatCurrency(transaction.balance)}</td>
                                    <td>${transaction.remark}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2"><strong>Total</strong></td>
                                <td class="amount-cell"><strong>${this.formatCurrency(item.totalDebit)}</strong></td>
                                <td class="amount-cell"><strong>${this.formatCurrency(item.totalCredit)}</strong></td>
                                <td class="amount-cell ${item.finalBalance > 0 ? 'negative-amount' : 'positive-amount'}"><strong>${this.formatCurrency(item.finalBalance)}</strong></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }
    
    generateTaxSection(taxDetails) {
        return `
            <div class="tax-section">
                <div class="tax-header">Taxes Table for all items</div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Due</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Remark</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${taxDetails.map(tax => `
                                <tr class="transaction-row">
                                    <td>${tax.date}</td>
                                    <td>${tax.type}</td>
                                    <td class="amount-cell">${tax.debit > 0 ? this.formatCurrency(tax.debit) : '—'}</td>
                                    <td class="amount-cell positive-amount">${tax.credit > 0 ? this.formatCurrency(tax.credit) : '—'}</td>
                                    <td class="amount-cell ${tax.balance > 0 ? 'negative-amount' : 'positive-amount'}">${this.formatCurrency(tax.balance)}</td>
                                    <td>${tax.remark}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2"><strong>Total</strong></td>
                                <td class="amount-cell"><strong>${this.formatCurrency(this.calculateTaxTotals().totalDebit)}</strong></td>
                                <td class="amount-cell"><strong>${this.formatCurrency(this.calculateTaxTotals().totalCredit)}</strong></td>
                                <td class="amount-cell ${this.calculateTaxTotals().balance > 0 ? 'negative-amount' : 'positive-amount'}"><strong>${this.formatCurrency(this.calculateTaxTotals().balance)}</strong></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }
    
    calculateTaxTotals() {
        const taxDetails = this.data.customerData.combinedTaxDetails;
        const totalDebit = taxDetails.reduce((sum, tax) => sum + (tax.debit || 0), 0);
        const totalCredit = taxDetails.reduce((sum, tax) => sum + (tax.credit || 0), 0);
        const balance = totalDebit - totalCredit;
        
        return { totalDebit, totalCredit, balance };
    }
    
    generateServicesSummaryCards() {
        const totals = this.calculateServicesTotals();
        
        return `
            <div class="total-cards">
                <div class="row">
                    <div class="col-md-3">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white;">
                            <h6 style="color: white;">Total Services Amount</h6>
                            <h4 style="color: white;">${this.formatCurrency(totals.totalServices)}</h4>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #27ae60 0%, #229954 100%); color: white;">
                            <h6 style="color: white;">Total Received</h6>
                            <h4 style="color: white;">${this.formatCurrency(totals.totalReceived)}</h4>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white;">
                            <h6 style="color: white;">Received Tax</h6>
                            <h4 style="color: white;">${this.formatCurrency(totals.receivedTax)}</h4>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white;">
                            <h6 style="color: white;">Unclaimed Amount</h6>
                            <h4 style="color: white;">${this.formatCurrency(totals.unclaimedAmount)}</h4>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    calculateServicesTotals() {
        let totalServices = 0;
        let totalReceived = 0;
        
        // Sum up services from all projects
        this.data.customerData.projectsData.forEach(projectData => {
            projectData.servicesPayments.forEach(item => {
                totalServices += item.totalDebit;
                totalReceived += item.totalCredit;
            });
        });
        
        const unclaimedAmount = totalServices - totalReceived;
        const receivedTax = this.calculateTaxTotals().totalCredit;
        
        return { totalServices, totalReceived, receivedTax, unclaimedAmount };
    }
    
    displayGovernmentFeesExpenses() {
        const content = root_element.querySelector('#governmentFeesExpensesContent');
        
        const governmentFees = this.data.customerData.combinedGovernmentFees || [];
        const expenses = this.data.customerData.combinedExpenses || [];
        const pendingExpenses = this.data.customerData.combinedPendingExpenses || [];
        
        if (governmentFees.length === 0 && expenses.length === 0 && pendingExpenses.length === 0) {
            content.innerHTML = '<div class="alert alert-info">No government fees and expenses data found.</div>';
            return;
        }
        
        let html = '<h4 style="color: #2c3e50; margin-bottom: 20px;">💼 Government Fees & Expenses</h4>';
        
        // Combined government fees and expenses table
        const combinedTransactions = this.combineGovernmentFeesAndExpenses(governmentFees, expenses);
        
        if (combinedTransactions.length > 0) {
            html += this.generateGovernmentFeesExpensesTable(combinedTransactions);
        }
        
        // Pending expenses table
        if (pendingExpenses.length > 0) {
            html += this.generatePendingExpensesTable(pendingExpenses);
        }
        
        // Summary cards
        html += this.generateGovernmentFeesSummaryCards(governmentFees, expenses, pendingExpenses);
        
        content.innerHTML = html;
    }
    
    combineGovernmentFeesAndExpenses(governmentFees, expenses) {
        const transactions = [];
        
        // Add government fees as paid transactions
        governmentFees.forEach(fee => {
            transactions.push({
                date: fee.date,
                type: 'Gov. Fees',
                due: 0,
                paid: fee.amount || 0,
                balance: 0,
                remark: fee.remark || ''
            });
        });
        
        // Add expenses as due transactions
        expenses.forEach(expense => {
            transactions.push({
                date: expense.date,
                type: expense.transaction_type || 'Expense',
                due: expense.amount || 0,
                paid: 0,
                balance: 0,
                remark: expense.description || ''
            });
        });
        
        // Sort by date and calculate running balance
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let balance = 0;
        transactions.forEach(transaction => {
            balance += (transaction.due || 0) - (transaction.paid || 0);
            transaction.balance = balance;
        });
        
        return transactions;
    }
    
    generateGovernmentFeesExpensesTable(transactions) {
        const totalDue = transactions.reduce((sum, t) => sum + (t.due || 0), 0);
        const totalPaid = transactions.reduce((sum, t) => sum + (t.paid || 0), 0);
        const finalBalance = totalDue - totalPaid;
        
        return `
            <div class="government-fees-section">
                <div class="fees-header">Gov. Fees Transactions</div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Due</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Remark</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transactions.map(transaction => `
                                <tr class="transaction-row">
                                    <td>${transaction.date}</td>
                                    <td>${transaction.type}</td>
                                    <td class="amount-cell">${transaction.due > 0 ? this.formatCurrency(transaction.due) : '—'}</td>
                                    <td class="amount-cell positive-amount">${transaction.paid > 0 ? this.formatCurrency(transaction.paid) : '—'}</td>
                                    <td class="amount-cell ${transaction.balance > 0 ? 'negative-amount' : 'positive-amount'}">${this.formatCurrency(transaction.balance)}</td>
                                    <td>${transaction.remark}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2"><strong>Total</strong></td>
                                <td class="amount-cell"><strong>${this.formatCurrency(totalDue)}</strong></td>
                                <td class="amount-cell"><strong>${this.formatCurrency(totalPaid)}</strong></td>
                                <td class="amount-cell ${finalBalance > 0 ? 'negative-amount' : 'positive-amount'}"><strong>${this.formatCurrency(finalBalance)}</strong></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }
    
    generatePendingExpensesTable(pendingExpenses) {
        return `
            <div class="pending-expenses-section">
                <div class="pending-expenses-header">Pending Expenses</div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Amount</th>
                                <th>Paid</th>
                                <th>Collected Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pendingExpenses.map(expense => `
                                <tr class="transaction-row">
                                    <td class="amount-cell">${this.formatCurrency(expense.amount || 0)}</td>
                                    <td class="text-center">${expense.paid ? '✓' : '✗'}</td>
                                    <td class="amount-cell">${this.formatCurrency(expense.collected_amount || 0)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    generateGovernmentFeesSummaryCards(governmentFees, expenses, pendingExpenses) {
        const totalGovernmentFees = governmentFees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
        const expenseAmount = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
        const pendingAmount = pendingExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
        
        return `
            <div class="total-cards">
                <div class="row">
                    <div class="col-md-4">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white;">
                            <h6 style="color: white;">Total Government Fees</h6>
                            <h4 style="color: white;">${this.formatCurrency(totalGovernmentFees)}</h4>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white;">
                            <h6 style="color: white;">Expense Amount</h6>
                            <h4 style="color: white;">${this.formatCurrency(expenseAmount)}</h4>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%); color: white;">
                            <h6 style="color: white;">Pending Amount</h6>
                            <h4 style="color: white;">${this.formatCurrency(pendingAmount)}</h4>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    displayTrustFees() {
        const content = root_element.querySelector('#trustFeesContent');
        
        const trustFees = this.data.customerData.combinedTrustFees || [];
        const trustFeesLog = this.data.customerData.combinedTrustFeesLog || [];
        
        if (trustFees.length === 0 && trustFeesLog.length === 0) {
            content.innerHTML = '<div class="alert alert-info">No trust fees data found.</div>';
            return;
        }
        
        let html = '<h4 style="color: #2c3e50; margin-bottom: 20px;">💎 Trust Fees</h4>';
        
        // Combined trust fees table
        const combinedTransactions = this.combineTrustFeesTransactions(trustFees, trustFeesLog);
        
        if (combinedTransactions.length > 0) {
            html += this.generateTrustFeesTable(combinedTransactions);
        }
        
        // Summary cards
        html += this.generateTrustFeesSummaryCards(trustFees, trustFeesLog);
        
        content.innerHTML = html;
    }
    
    combineTrustFeesTransactions(trustFees, trustFeesLog) {
        const transactions = [];
        
        // Add trust fees as paid transactions
        trustFees.forEach(fee => {
            transactions.push({
                date: fee.date,
                type: 'Trust Fees',
                due: 0,
                paid: fee.amount || 0,
                balance: 0,
                remark: fee.remark || ''
            });
        });
        
        // Add trust fees log as due transactions
        trustFeesLog.forEach(log => {
            transactions.push({
                date: log.date,
                type: log.transaction_type || 'Trust Fee Transaction',
                due: log.amount || 0,
                paid: 0,
                balance: 0,
                remark: log.description || ''
            });
        });
        
        // Sort by date and calculate running balance
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let balance = 0;
        transactions.forEach(transaction => {
            balance += (transaction.paid || 0) - (transaction.due || 0);
            transaction.balance = balance;
        });
        
        return transactions;
    }
    
    generateTrustFeesTable(transactions) {
        const totalDue = transactions.reduce((sum, t) => sum + (t.due || 0), 0);
        const totalPaid = transactions.reduce((sum, t) => sum + (t.paid || 0), 0);
        const finalBalance = totalPaid - totalDue;
        
        return `
            <div class="trust-fees-section">
                <div class="trust-header">Trust Fees Transactions</div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Due</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Remark</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transactions.map(transaction => `
                                <tr class="transaction-row">
                                    <td>${transaction.date}</td>
                                    <td>${transaction.type}</td>
                                    <td class="amount-cell">${transaction.due > 0 ? this.formatCurrency(transaction.due) : '—'}</td>
                                    <td class="amount-cell positive-amount">${transaction.paid > 0 ? this.formatCurrency(transaction.paid) : '—'}</td>
                                    <td class="amount-cell ${transaction.balance > 0 ? 'positive-amount' : 'negative-amount'}">${this.formatCurrency(transaction.balance)}</td>
                                    <td>${transaction.remark}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2"><strong>Total</strong></td>
                                <td class="amount-cell"><strong>${this.formatCurrency(totalDue)}</strong></td>
                                <td class="amount-cell"><strong>${this.formatCurrency(totalPaid)}</strong></td>
                                <td class="amount-cell ${finalBalance > 0 ? 'positive-amount' : 'negative-amount'}"><strong>${this.formatCurrency(finalBalance)}</strong></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }
    
    generateTrustFeesSummaryCards(trustFees, trustFeesLog) {
        const totalTrustFees = trustFees.reduce((sum, fee) => sum + (fee.amount || 0), 0);
        const totalClaimedTrustFees = trustFeesLog.reduce((sum, log) => sum + (log.amount || 0), 0);
        const trustFeesBalance = totalTrustFees - totalClaimedTrustFees;
        
        return `
            <div class="total-cards">
                <div class="row">
                    <div class="col-md-4">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #9b59b6 0%, #8e44ad 100%); color: white;">
                            <h6 style="color: white;">Total Trust Fees</h6>
                            <h4 style="color: white;">${this.formatCurrency(totalTrustFees)}</h4>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white;">
                            <h6 style="color: white;">Total Claimed Trust Fees</h6>
                            <h4 style="color: white;">${this.formatCurrency(totalClaimedTrustFees)}</h4>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #27ae60 0%, #229954 100%); color: white;">
                            <h6 style="color: white;">Trust Fees Balance</h6>
                            <h4 style="color: white;">${this.formatCurrency(trustFeesBalance)}</h4>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Contractor Report Methods
    async loadContractorReport() {
        try {
            const filters = this.buildContractorFilters();
            
            // Get contractor services data
            const contractorServices = await frappe.db.get_list('Project Agreement', {
                fields: ['name', 'project_name', 'customer', 'customer_name', 'project_date'],
                filters: filters,
                order_by: 'project_date desc'
            });
            
            if (contractorServices.length === 0) {
                this.hideLoading();
                this.showError('No contractor data found for the selected criteria');
                return;
            }
            
            this.data.contractorData = await this.processContractorData(contractorServices);
            
            this.displayContractorReport();
            this.hideLoading();
            this.showPrintOptions();
            
        } catch (error) {
            this.hideLoading();
            this.showError('Error loading contractor report: ' + error.message);
        }
    }
    
    buildContractorFilters() {
        const filters = { docstatus: 1 };
        
        if (this.filters.projectAgreement) {
            filters.name = this.filters.projectAgreement;
        }
        
        if (this.filters.fromDate && this.filters.toDate) {
            filters.project_date = ['between', [this.filters.fromDate, this.filters.toDate]];
        }
        
        return filters;
    }
    
    async processContractorData(projectAgreements) {
        const contractorData = {
            projectAgreements: projectAgreements,
            projectsData: [],
            combinedTaxDetails: []
        };
        
        // Process each project agreement for contractor data
        for (const project of projectAgreements) {
            const fullProject = await frappe.db.get_doc('Project Agreement', project.name);
            
            // Filter contractor services by selected contractor
            const contractorServices = (fullProject.contractors_services || []).filter(service => 
                !this.filters.contractor || service.contractor === this.filters.contractor
            );
            
            // Filter contractor payments by selected contractor
            const contractorPayments = (fullProject.contractors_payment_log || []).filter(payment => 
                !this.filters.contractor || payment.contractor === this.filters.contractor
            );
            
            // Process contractor services and payments
            let projectServicesPayments = await this.processContractorServices(contractorServices, contractorPayments);
            
            // Filter by item if specified
            if (this.filters.item) {
                projectServicesPayments = projectServicesPayments.filter(item => 
                    item.item === this.filters.item
                );
            }
            
            // Process contractor tax details
            const projectTaxData = this.processContractorTaxes(contractorServices, contractorPayments);
            
            // Create project data structure
            const projectData = {
                projectInfo: project,
                servicesPayments: projectServicesPayments,
                taxDetails: projectTaxData
            };
            
            contractorData.projectsData.push(projectData);
            contractorData.combinedTaxDetails.push(...projectTaxData);
        }
        
        return contractorData;
    }
    
    async processContractorServices(contractorServices, contractorPayments) {
        const groupedServices = {};
        
        // Group contractor services by item
        contractorServices.forEach(service => {
            if (!groupedServices[service.item]) {
                groupedServices[service.item] = {
                    item: service.item,
                    transactions: [],
                    totalDebit: 0,
                    totalCredit: 0
                };
            }
            
            // Add service transaction
            groupedServices[service.item].transactions.push({
                date: service.invoice_date,
                type: 'Service',
                debit: service.amount || 0,
                credit: 0,
                balance: 0,
                remark: service.remark || ''
            });
            
            groupedServices[service.item].totalDebit += service.amount || 0;
        });
        
        // Add contractor payment transactions
        contractorPayments.forEach(payment => {
            if (payment.item && groupedServices[payment.item]) {
                groupedServices[payment.item].transactions.push({
                    date: payment.date,
                    type: 'Payment',
                    debit: 0,
                    credit: payment.payment_amount || 0,
                    balance: 0,
                    remark: payment.remark || ''
                });
                
                groupedServices[payment.item].totalCredit += payment.payment_amount || 0;
            }
        });
        
        // Calculate running balances
        Object.values(groupedServices).forEach(itemGroup => {
            itemGroup.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            let balance = 0;
            itemGroup.transactions.forEach(transaction => {
                balance += (transaction.debit || 0) - (transaction.credit || 0);
                transaction.balance = balance;
            });
            
            itemGroup.finalBalance = balance;
        });
        
        return Object.values(groupedServices);
    }
    
    processContractorTaxes(contractorServices, contractorPayments) {
        const taxTransactions = [];
        
        // Add tax from contractor services
        contractorServices.forEach(service => {
            if (service.tax_amount && service.tax_amount > 0) {
                taxTransactions.push({
                    date: service.invoice_date,
                    type: 'Service Tax',
                    debit: service.tax_amount,
                    credit: 0,
                    balance: 0,
                    remark: service.remark || ''
                });
            }
        });
        
        // Add contractor tax payments
        contractorPayments.forEach(payment => {
            if (payment.payment_tax && payment.payment_tax > 0) {
                taxTransactions.push({
                    date: payment.date,
                    type: 'Tax Payment',
                    debit: 0,
                    credit: payment.payment_tax,
                    balance: 0,
                    remark: payment.remark || ''
                });
            }
        });
        
        // Calculate running balance
        taxTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let balance = 0;
        taxTransactions.forEach(transaction => {
            balance += (transaction.debit || 0) - (transaction.credit || 0);
            transaction.balance = balance;
        });
        
        return taxTransactions;
    }
    
    displayContractorReport() {
        this.displayReportInfo();
        this.showContractorTabs();
        this.displayContractorServicesPayments();
        
        root_element.querySelector('#reportTabs').style.display = 'block';
    }
    
    showContractorTabs() {
        // Hide all tab groups
        root_element.querySelector('#customerTabs').style.display = 'none';
        root_element.querySelector('#engineerTabs').style.display = 'none';
        
        // Show contractor tabs
        root_element.querySelector('#contractorTabs').style.display = 'block';
        
        // Reset tab states
        this.resetTabStates();
        
        // Show contractor tab by default
        root_element.querySelector('[data-tab="contractorServicesPayments"]').click();
    }
    
    displayContractorServicesPayments() {
        const content = root_element.querySelector('#contractorServicesPaymentsContent');
        
        if (!this.data.contractorData || !this.data.contractorData.projectsData.length) {
            content.innerHTML = '<div class="alert alert-info">No contractor services and payments data found.</div>';
            return;
        }
        
        let html = '<h4 style="color: #2c3e50; margin-bottom: 20px;">📋 Contractor Services & Payments</h4>';
        
        // Display each project
        this.data.contractorData.projectsData.forEach(projectData => {
            if (projectData.servicesPayments.length > 0) {
                html += this.generateContractorProjectSection(projectData);
            }
        });
        
        // Display combined tax details if available
        if (this.data.contractorData.combinedTaxDetails.length > 0) {
            html += this.generateContractorTaxSection(this.data.contractorData.combinedTaxDetails);
        }
        
        // Add summary cards
        html += this.generateContractorSummaryCards();
        
        content.innerHTML = html;
    }
    
    generateContractorProjectSection(projectData) {
        const projectInfo = projectData.projectInfo;
        
        let html = `
            <div class="project-section">
                <h3>Project: ${projectInfo.project_name || projectInfo.name}</h3>
                <div style="padding: 20px;">
        `;
        
        // Display each item within this project
        projectData.servicesPayments.forEach(item => {
            html += this.generateContractorItemSection(item);
        });
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }
    
    generateContractorItemSection(item) {
        return `
            <div class="contractor-section">
                <div class="contractor-header">Item: ${item.item}</div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Due</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Remark</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${item.transactions.map(transaction => `
                                <tr class="transaction-row">
                                    <td>${transaction.date}</td>
                                    <td>${transaction.type}</td>
                                    <td class="amount-cell">${transaction.debit > 0 ? this.formatCurrency(transaction.debit) : '—'}</td>
                                    <td class="amount-cell positive-amount">${transaction.credit > 0 ? this.formatCurrency(transaction.credit) : '—'}</td>
                                    <td class="amount-cell ${transaction.balance > 0 ? 'negative-amount' : 'positive-amount'}">${this.formatCurrency(transaction.balance)}</td>
                                    <td>${transaction.remark}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2"><strong>Total</strong></td>
                                <td class="amount-cell"><strong>${this.formatCurrency(item.totalDebit)}</strong></td>
                                <td class="amount-cell"><strong>${this.formatCurrency(item.totalCredit)}</strong></td>
                                <td class="amount-cell ${item.finalBalance > 0 ? 'negative-amount' : 'positive-amount'}"><strong>${this.formatCurrency(item.finalBalance)}</strong></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }
    
    generateContractorTaxSection(taxDetails) {
        const totalTaxDebit = taxDetails.reduce((sum, tax) => sum + (tax.debit || 0), 0);
        const totalTaxCredit = taxDetails.reduce((sum, tax) => sum + (tax.credit || 0), 0);
        const finalTaxBalance = totalTaxDebit - totalTaxCredit;
        
        return `
            <div class="tax-section">
                <div class="tax-header">Contractor Taxes Table</div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Due</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Remark</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${taxDetails.map(tax => `
                                <tr class="transaction-row">
                                    <td>${tax.date}</td>
                                    <td>${tax.type}</td>
                                    <td class="amount-cell">${tax.debit > 0 ? this.formatCurrency(tax.debit) : '—'}</td>
                                    <td class="amount-cell positive-amount">${tax.credit > 0 ? this.formatCurrency(tax.credit) : '—'}</td>
                                    <td class="amount-cell ${tax.balance > 0 ? 'negative-amount' : 'positive-amount'}">${this.formatCurrency(tax.balance)}</td>
                                    <td>${tax.remark}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2"><strong>Total</strong></td>
                                <td class="amount-cell"><strong>${this.formatCurrency(totalTaxDebit)}</strong></td>
                                <td class="amount-cell"><strong>${this.formatCurrency(totalTaxCredit)}</strong></td>
                                <td class="amount-cell ${finalTaxBalance > 0 ? 'negative-amount' : 'positive-amount'}"><strong>${this.formatCurrency(finalTaxBalance)}</strong></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }
    
    generateContractorSummaryCards() {
        let totalContractorsServices = 0;
        let totalReceivedFromContractors = 0;
        
        // Sum up services from all projects
        this.data.contractorData.projectsData.forEach(projectData => {
            projectData.servicesPayments.forEach(item => {
                totalContractorsServices += item.totalDebit;
                totalReceivedFromContractors += item.totalCredit;
            });
        });
        
        const totalUnclaimedFromContractors = totalContractorsServices - totalReceivedFromContractors;
        
        // Calculate tax totals
        const taxDetails = this.data.contractorData.combinedTaxDetails || [];
        const totalReceivedTaxesFromContractors = taxDetails.reduce((sum, tax) => sum + (tax.credit || 0), 0);
        
        return `
            <div class="total-cards">
                <div class="row">
                    <div class="col-md-3">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #16a085 0%, #1abc9c 100%); color: white;">
                            <h6 style="color: white;">Total Contractors Services</h6>
                            <h4 style="color: white;">${this.formatCurrency(totalContractorsServices)}</h4>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #27ae60 0%, #229954 100%); color: white;">
                            <h6 style="color: white;">Total Received From Contractors</h6>
                            <h4 style="color: white;">${this.formatCurrency(totalReceivedFromContractors)}</h4>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white;">
                            <h6 style="color: white;">Total Received Taxes From Contractors</h6>
                            <h4 style="color: white;">${this.formatCurrency(totalReceivedTaxesFromContractors)}</h4>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white;">
                            <h6 style="color: white;">Total Unclaimed From Contractors</h6>
                            <h4 style="color: white;">${this.formatCurrency(totalUnclaimedFromContractors)}</h4>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Engineer Report Methods
    async loadEngineerReport() {
        try {
            const filters = this.buildEngineerFilters();
            
            // Get outsource services data
            const engineerServices = await frappe.db.get_list('Project Agreement', {
                fields: ['name', 'project_name', 'customer', 'customer_name', 'project_date'],
                filters: filters,
                order_by: 'project_date desc'
            });
            
            if (engineerServices.length === 0) {
                this.hideLoading();
                this.showError('No engineer data found for the selected criteria');
                return;
            }
            
            this.data.engineerData = await this.processEngineerData(engineerServices);
            
            this.displayEngineerReport();
            this.hideLoading();
            this.showPrintOptions();
            
        } catch (error) {
            this.hideLoading();
            this.showError('Error loading engineer report: ' + error.message);
        }
    }
    
    buildEngineerFilters() {
        const filters = { docstatus: 1 };
        
        if (this.filters.projectAgreement) {
            filters.name = this.filters.projectAgreement;
        }
        
        if (this.filters.fromDate && this.filters.toDate) {
            filters.project_date = ['between', [this.filters.fromDate, this.filters.toDate]];
        }
        
        return filters;
    }
    
    async processEngineerData(projectAgreements) {
        const engineerData = {
            projectAgreements: projectAgreements,
            projectsData: [],
            combinedTaxDetails: []
        };
        
        // Process each project agreement for engineer data
        for (const project of projectAgreements) {
            const fullProject = await frappe.db.get_doc('Project Agreement', project.name);
            
            // Filter outsource services by selected engineer
            const outsourceServices = (fullProject.outsource_services || []).filter(service => 
                !this.filters.engineer || service.service_provider === this.filters.engineer
            );
            
            // Filter outsource payments by selected engineer
            const outsourcePayments = (fullProject.outsource_payment_log || []).filter(payment => 
                !this.filters.engineer || payment.engineer === this.filters.engineer
            );
            
            // Process outsource services and payments
            let projectServicesPayments = await this.processOutsourceServices(outsourceServices, outsourcePayments);
            
            // Filter by item if specified
            if (this.filters.item) {
                projectServicesPayments = projectServicesPayments.filter(item => 
                    item.item === this.filters.item
                );
            }
            
            // Process engineer tax details
            const projectTaxData = this.processEngineerTaxes(outsourceServices, outsourcePayments);
            
            // Create project data structure
            const projectData = {
                projectInfo: project,
                servicesPayments: projectServicesPayments,
                taxDetails: projectTaxData
            };
            
            engineerData.projectsData.push(projectData);
            engineerData.combinedTaxDetails.push(...projectTaxData);
        }
        
        return engineerData;
    }
    
    async processOutsourceServices(outsourceServices, outsourcePayments) {
        const groupedServices = {};
        
        // Group outsource services by service name
        outsourceServices.forEach(service => {
            const key = service.service || service.item || 'General Service';
            
            if (!groupedServices[key]) {
                groupedServices[key] = {
                    item: key,
                    transactions: [],
                    totalDebit: 0,
                    totalCredit: 0
                };
            }
            
            // Add service transaction
            groupedServices[key].transactions.push({
                date: service.date,
                type: 'Service',
                debit: service.amount || 0,
                credit: 0,
                balance: 0,
                remark: service.remark || ''
            });
            
            groupedServices[key].totalDebit += service.amount || 0;
        });
        
        // Add outsource payment transactions
        outsourcePayments.forEach(payment => {
            const key = payment.item || 'General Service';
            
            if (groupedServices[key]) {
                groupedServices[key].transactions.push({
                    date: payment.date,
                    type: 'Payment',
                    debit: 0,
                    credit: payment.payment_amount || 0,
                    balance: 0,
                    remark: payment.remark || ''
                });
                
                groupedServices[key].totalCredit += payment.payment_amount || 0;
            }
        });
        
        // Calculate running balances
        Object.values(groupedServices).forEach(itemGroup => {
            itemGroup.transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            let balance = 0;
            itemGroup.transactions.forEach(transaction => {
                balance += (transaction.debit || 0) - (transaction.credit || 0);
                transaction.balance = balance;
            });
            
            itemGroup.finalBalance = balance;
        });
        
        return Object.values(groupedServices);
    }
    
    processEngineerTaxes(outsourceServices, outsourcePayments) {
        const taxTransactions = [];
        
        // Add tax from outsource services
        outsourceServices.forEach(service => {
            if (service.tax_amount && service.tax_amount > 0) {
                taxTransactions.push({
                    date: service.date,
                    type: 'Service Tax',
                    debit: service.tax_amount,
                    credit: 0,
                    balance: 0,
                    remark: service.remark || ''
                });
            }
        });
        
        // Add engineer tax payments
        outsourcePayments.forEach(payment => {
            if (payment.payment_tax && payment.payment_tax > 0) {
                taxTransactions.push({
                    date: payment.date,
                    type: 'Tax Payment',
                    debit: 0,
                    credit: payment.payment_tax,
                    balance: 0,
                    remark: payment.remark || ''
                });
            }
        });
        
        // Calculate running balance
        taxTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        let balance = 0;
        taxTransactions.forEach(transaction => {
            balance += (transaction.debit || 0) - (transaction.credit || 0);
            transaction.balance = balance;
        });
        
        return taxTransactions;
    }
    
    displayEngineerReport() {
        this.displayReportInfo();
        this.showEngineerTabs();
        this.displayEngineerServicesPayments();
        
        root_element.querySelector('#reportTabs').style.display = 'block';
    }
    
    showEngineerTabs() {
        // Hide all tab groups
        root_element.querySelector('#customerTabs').style.display = 'none';
        root_element.querySelector('#contractorTabs').style.display = 'none';
        
        // Show engineer tabs
        root_element.querySelector('#engineerTabs').style.display = 'block';
        
        // Reset tab states
        this.resetTabStates();
        
        // Show engineer tab by default
        root_element.querySelector('[data-tab="engineerServicesPayments"]').click();
    }
    
    displayEngineerServicesPayments() {
        const content = root_element.querySelector('#engineerServicesPaymentsContent');
        
        if (!this.data.engineerData || !this.data.engineerData.projectsData.length) {
            content.innerHTML = '<div class="alert alert-info">No engineer services and payments data found.</div>';
            return;
        }
        
        let html = '<h4 style="color: #2c3e50; margin-bottom: 20px;">📋 Engineer Services & Payments</h4>';
        
        // Display each project
        this.data.engineerData.projectsData.forEach(projectData => {
            if (projectData.servicesPayments.length > 0) {
                html += this.generateEngineerProjectSection(projectData);
            }
        });
        
        // Display combined tax details if available
        if (this.data.engineerData.combinedTaxDetails.length > 0) {
            html += this.generateEngineerTaxSection(this.data.engineerData.combinedTaxDetails);
        }
        
        // Add summary cards
        html += this.generateEngineerSummaryCards();
        
        content.innerHTML = html;
    }
    
    generateEngineerProjectSection(projectData) {
        const projectInfo = projectData.projectInfo;
        
        let html = `
            <div class="project-section">
                <h3>Project: ${projectInfo.project_name || projectInfo.name}</h3>
                <div style="padding: 20px;">
        `;
        
        // Display each item within this project
        projectData.servicesPayments.forEach(item => {
            html += this.generateEngineerItemSection(item);
        });
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    }
    
    generateEngineerItemSection(item) {
        return `
            <div class="engineer-section">
                <div class="engineer-header">Service: ${item.item}</div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Due</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Remark</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${item.transactions.map(transaction => `
                                <tr class="transaction-row">
                                    <td>${transaction.date}</td>
                                    <td>${transaction.type}</td>
                                    <td class="amount-cell">${transaction.debit > 0 ? this.formatCurrency(transaction.debit) : '—'}</td>
                                    <td class="amount-cell positive-amount">${transaction.credit > 0 ? this.formatCurrency(transaction.credit) : '—'}</td>
                                    <td class="amount-cell ${transaction.balance > 0 ? 'negative-amount' : 'positive-amount'}">${this.formatCurrency(transaction.balance)}</td>
                                    <td>${transaction.remark}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2"><strong>Total</strong></td>
                                <td class="amount-cell"><strong>${this.formatCurrency(item.totalDebit)}</strong></td>
                                <td class="amount-cell"><strong>${this.formatCurrency(item.totalCredit)}</strong></td>
                                <td class="amount-cell ${item.finalBalance > 0 ? 'negative-amount' : 'positive-amount'}"><strong>${this.formatCurrency(item.finalBalance)}</strong></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }
    
    generateEngineerTaxSection(taxDetails) {
        const totalTaxDebit = taxDetails.reduce((sum, tax) => sum + (tax.debit || 0), 0);
        const totalTaxCredit = taxDetails.reduce((sum, tax) => sum + (tax.credit || 0), 0);
        const finalTaxBalance = totalTaxDebit - totalTaxCredit;
        
        return `
            <div class="tax-section">
                <div class="tax-header">Engineer Taxes Table</div>
                <div class="table-responsive">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Due</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Remark</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${taxDetails.map(tax => `
                                <tr class="transaction-row">
                                    <td>${tax.date}</td>
                                    <td>${tax.type}</td>
                                    <td class="amount-cell">${tax.debit > 0 ? this.formatCurrency(tax.debit) : '—'}</td>
                                    <td class="amount-cell positive-amount">${tax.credit > 0 ? this.formatCurrency(tax.credit) : '—'}</td>
                                    <td class="amount-cell ${tax.balance > 0 ? 'negative-amount' : 'positive-amount'}">${this.formatCurrency(tax.balance)}</td>
                                    <td>${tax.remark}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2"><strong>Total</strong></td>
                                <td class="amount-cell"><strong>${this.formatCurrency(totalTaxDebit)}</strong></td>
                                <td class="amount-cell"><strong>${this.formatCurrency(totalTaxCredit)}</strong></td>
                                <td class="amount-cell ${finalTaxBalance > 0 ? 'negative-amount' : 'positive-amount'}"><strong>${this.formatCurrency(finalTaxBalance)}</strong></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }
    
    generateEngineerSummaryCards() {
        let totalRequestedServices = 0;
        let totalPaid = 0;
        
        // Sum up services from all projects
        this.data.engineerData.projectsData.forEach(projectData => {
            projectData.servicesPayments.forEach(item => {
                totalRequestedServices += item.totalDebit;
                totalPaid += item.totalCredit;
            });
        });
        
        const pendingToPay = totalRequestedServices - totalPaid;
        
        // Calculate tax totals
        const taxDetails = this.data.engineerData.combinedTaxDetails || [];
        const totalPaidTaxes = taxDetails.reduce((sum, tax) => sum + (tax.credit || 0), 0);
        
        return `
            <div class="total-cards">
                <div class="row">
                    <div class="col-md-3">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #8e44ad 0%, #9b59b6 100%); color: white;">
                            <h6 style="color: white;">Total Requested Services</h6>
                            <h4 style="color: white;">${this.formatCurrency(totalRequestedServices)}</h4>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #27ae60 0%, #229954 100%); color: white;">
                            <h6 style="color: white;">Total Paid</h6>
                            <h4 style="color: white;">${this.formatCurrency(totalPaid)}</h4>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); color: white;">
                            <h6 style="color: white;">Total Paid Taxes</h6>
                            <h4 style="color: white;">${this.formatCurrency(totalPaidTaxes)}</h4>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="total-card p-3" style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white;">
                            <h6 style="color: white;">Pending To Pay</h6>
                            <h4 style="color: white;">${this.formatCurrency(pendingToPay)}</h4>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Utility Methods
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-AE', {
            style: 'currency',
            currency: 'AED',
            minimumFractionDigits: 2
        }).format(amount || 0);
    }
    
    showLoading() {
        root_element.querySelector('#loadingSpinner').style.display = 'block';
        root_element.querySelector('#reportTabs').style.display = 'none';
    }
    
    hideLoading() {
        root_element.querySelector('#loadingSpinner').style.display = 'none';
    }
    
    showError(message) {
        const errorElement = root_element.querySelector('#errorMessage');
        const errorText = root_element.querySelector('#errorText');
        errorText.textContent = message;
        errorElement.style.display = 'block';
        
        // Hide error after 5 seconds
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
    
    showPrintOptions() {
        root_element.querySelector('#printLanguage').style.display = 'inline-block';
        root_element.querySelector('#printReport').style.display = 'inline-block';
    }
    
    clearFilters() {
        // Clear all filter controls
        Object.keys(this.controls).forEach(key => {
            if (this.controls[key]) {
                this.controls[key].set_value('');
            }
        });
        
        root_element.querySelector('#reportType').value = '';
        
        // Reset date filters to default
        this.setDefaultDates();
        
        // Clear filter values
        this.filters = {
            reportType: '',
            customer: '',
            contractor: '',
            engineer: '',
            projectAgreement: '',
            item: '',
            fromDate: this.filters.fromDate,
            toDate: this.filters.toDate
        };
        
        // Hide dynamic elements
        root_element.querySelector('#dynamicFilters').style.display = 'none';
        root_element.querySelector('#actionButtons').style.display = 'none';
        root_element.querySelector('#reportTabs').style.display = 'none';
        root_element.querySelector('#printLanguage').style.display = 'none';
        root_element.querySelector('#printReport').style.display = 'none';
        
        // Update title and hide report type display
        this.updateReportTitle('');
        this.updateReportTypeDisplay('');
    }
    
    printReport() {
        const selectedLanguage = root_element.querySelector('#printLanguage').value;
        const printWindow = window.open('', '_blank');
        const printContent = this.generatePrintContent(selectedLanguage);
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        printWindow.onload = function() {
            printWindow.print();
            printWindow.close();
        };
    }
    
    generatePrintContent(language = 'en') {
        const labels = this.getPrintLabels(language);
        const reportTitle = this.getReportTitle(language);
        
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${reportTitle}</title>
                <style>${this.getPrintStyles()}</style>
            </head>
            <body>
                <!-- Fixed header and footer for all pages -->
                <div class="print-header-image"></div>
                <div class="print-footer-image"></div>
                
                <!-- Main content -->
                <div class="print-container">
                    ${this.generatePrintHeader(reportTitle, labels)}
                    ${this.generatePrintReportContent(labels)}
                </div>
            </body>
            </html>
        `;
    }
    
    getPrintLabels(language) {
        const labels = {
            en: {
                customer: 'Customer',
                contractor: 'Contractor', 
                engineer: 'Engineer',
                project: 'Project',
                reportPeriod: 'Report Period',
                date: 'Date',
                type: 'Type',
                due: 'Due',
                paid: 'Paid',
                balance: 'Balance',
                remark: 'Remark',
                totals: 'Totals',
                services: 'Services',
                payments: 'Payments',
                taxes: 'Taxes',
                governmentFees: 'Government Fees',
                expenses: 'Expenses',
                trustFees: 'Trust Fees'
            },
            ar: {
                customer: 'العميل',
                contractor: 'المقاول',
                engineer: 'المهندس',
                project: 'المشروع',
                reportPeriod: 'فترة التقرير',
                date: 'التاريخ',
                type: 'النوع',
                due: 'مستحق',
                paid: 'مدفوع',
                balance: 'الرصيد',
                remark: 'ملاحظات',
                totals: 'المجموع',
                services: 'الخدمات',
                payments: 'المدفوعات',
                taxes: 'الضرائب',
                governmentFees: 'الرسوم الحكومية',
                expenses: 'المصاريف',
                trustFees: 'رسوم الثقة'
            }
        };
        
        return labels[language] || labels.en;
    }
    
    getReportTitle(language) {
        const titles = {
            customer: {
                en: 'Customer Account Statement',
                ar: 'كشف حساب عميل'
            },
            contractor: {
                en: 'Contractor Account Statement',
                ar: 'كشف حساب مقاول'
            },
            engineer: {
                en: 'Engineer Account Statement',
                ar: 'كشف حساب مهندس'
            }
        };
        
        return titles[this.filters.reportType]?.[language] || 'Account Statement';
    }
    
    generatePrintHeader(title, labels) {
        const customerName = this.getCustomerName();
        const projectNames = this.getProjectNames();
        
        return `
            <div class="print-header">
                <h1>${title}</h1>
                <div class="print-info">
                    <div>
                        <strong>${labels.customer}:</strong> ${customerName}<br>
                        <strong>${labels.project}:</strong> ${projectNames}
                    </div>
                    <div style="text-align: right;">
                        <strong>${labels.reportPeriod}:</strong><br>
                        ${this.filters.fromDate} - ${this.filters.toDate}
                    </div>
                </div>
            </div>
        `;
    }
    
    generatePrintReportContent(labels) {
        let content = '';
        
        switch(this.filters.reportType) {
            case 'customer':
                content += this.generateCustomerPrintContent(labels);
                break;
            case 'contractor':
                content += this.generateContractorPrintContent(labels);
                break;
            case 'engineer':
                content += this.generateEngineerPrintContent(labels);
                break;
        }
        
        return content;
    }
    
    generateCustomerPrintContent(labels) {
        let content = '';
        
        // Services & Payments Section
        content += '<div class="print-section-header">Services & Payments</div>';
        if (this.data.customerData?.projectsData?.length > 0) {
            // Display each project
            this.data.customerData.projectsData.forEach(projectData => {
                if (projectData.servicesPayments.length > 0) {
                    content += this.generatePrintProjectSection(projectData, labels);
                }
            });
        }
        
        // Tax Details Section
        if (this.data.customerData?.combinedTaxDetails?.length > 0) {
            content += this.generatePrintTaxSection(this.data.customerData.combinedTaxDetails, labels);
        }
        
        // Government Fees & Expenses Section
        content += '<div class="print-section-header">Government Fees & Expenses</div>';
        if (this.data.customerData?.combinedGovernmentFees?.length > 0 || this.data.customerData?.combinedExpenses?.length > 0) {
            content += this.generatePrintGovernmentFeesExpenses(labels);
        }
        
        // Trust Fees Section
        content += '<div class="print-section-header">Trust Fees</div>';
        if (this.data.customerData?.combinedTrustFees?.length > 0 || this.data.customerData?.combinedTrustFeesLog?.length > 0) {
            content += this.generatePrintTrustFees(labels);
        }
        
        return content;
    }
    
    generatePrintProjectSection(projectData, labels) {
        const projectInfo = projectData.projectInfo;
        
        let content = `
            <div class="print-project-section">
                <div class="print-project-header">Project: ${projectInfo.project_name || projectInfo.name}</div>
        `;
        
        // Display each item within this project
        projectData.servicesPayments.forEach(item => {
            content += this.generatePrintItemSection(item, labels);
        });
        
        content += `
            </div>
        `;
        
        return content;
    }
    
    generatePrintItemSection(item, labels) {
        return `
            <div class="item-section">
                <div class="item-title">${item.item}</div>
                <table class="print-table">
                    <thead>
                        <tr>
                            <th>${labels.date}</th>
                            <th>${labels.type}</th>
                            <th>${labels.due}</th>
                            <th>${labels.paid}</th>
                            <th>${labels.balance}</th>
                            <th>${labels.remark}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${item.transactions.map(transaction => `
                            <tr>
                                <td>${transaction.date}</td>
                                <td>${transaction.type}</td>
                                <td class="amount">${transaction.debit > 0 ? this.formatPrintCurrency(transaction.debit) : '—'}</td>
                                <td class="amount">${transaction.credit > 0 ? this.formatPrintCurrency(transaction.credit) : '—'}</td>
                                <td class="amount">${this.formatPrintCurrency(transaction.balance)}</td>
                                <td>${transaction.remark}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2"><strong>${labels.totals}</strong></td>
                            <td class="amount"><strong>${this.formatPrintCurrency(item.totalDebit)}</strong></td>
                            <td class="amount"><strong>${this.formatPrintCurrency(item.totalCredit)}</strong></td>
                            <td class="amount"><strong>${this.formatPrintCurrency(item.finalBalance)}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }
    
    generateContractorPrintContent(labels) {
        let content = '';
        
        // Services & Payments Section
        content += '<div class="print-section-header">Contractor Services & Payments</div>';
        if (this.data.contractorData?.projectsData?.length > 0) {
            // Display each project
            this.data.contractorData.projectsData.forEach(projectData => {
                if (projectData.servicesPayments.length > 0) {
                    content += this.generatePrintProjectSection(projectData, labels);
                }
            });
        }
        
        // Contractor Tax Details
        if (this.data.contractorData?.combinedTaxDetails?.length > 0) {
            content += this.generatePrintTaxSection(this.data.contractorData.combinedTaxDetails, labels);
        }
        
        return content;
    }
    
    generateEngineerPrintContent(labels) {
        let content = '';
        
        // Services & Payments Section
        content += '<div class="print-section-header">Engineer Services & Payments</div>';
        if (this.data.engineerData?.projectsData?.length > 0) {
            // Display each project
            this.data.engineerData.projectsData.forEach(projectData => {
                if (projectData.servicesPayments.length > 0) {
                    content += this.generatePrintProjectSection(projectData, labels);
                }
            });
        }
        
        // Engineer Tax Details
        if (this.data.engineerData?.combinedTaxDetails?.length > 0) {
            content += this.generatePrintTaxSection(this.data.engineerData.combinedTaxDetails, labels);
        }
        
        return content;
    }
    
    generatePrintItemSections(items, labels) {
        return items.map(item => `
            <div class="item-section">
                <div class="item-title">${item.item}</div>
                <table class="print-table">
                    <thead>
                        <tr>
                            <th>${labels.date}</th>
                            <th>${labels.type}</th>
                            <th>${labels.due}</th>
                            <th>${labels.paid}</th>
                            <th>${labels.balance}</th>
                            <th>${labels.remark}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${item.transactions.map(transaction => `
                            <tr>
                                <td>${transaction.date}</td>
                                <td>${transaction.type}</td>
                                <td class="amount">${transaction.debit > 0 ? this.formatPrintCurrency(transaction.debit) : '—'}</td>
                                <td class="amount">${transaction.credit > 0 ? this.formatPrintCurrency(transaction.credit) : '—'}</td>
                                <td class="amount">${this.formatPrintCurrency(transaction.balance)}</td>
                                <td>${transaction.remark}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2"><strong>${labels.totals}</strong></td>
                            <td class="amount"><strong>${this.formatPrintCurrency(item.totalDebit)}</strong></td>
                            <td class="amount"><strong>${this.formatPrintCurrency(item.totalCredit)}</strong></td>
                            <td class="amount"><strong>${this.formatPrintCurrency(item.finalBalance)}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `).join('');
    }
    
    generatePrintTaxSection(taxDetails, labels) {
        const totals = this.calculateTaxTotals();
        
        return `
            <div class="item-section">
                <div class="item-title">${labels.taxes}</div>
                <table class="print-table">
                    <thead>
                        <tr>
                            <th>${labels.date}</th>
                            <th>${labels.type}</th>
                            <th>${labels.due}</th>
                            <th>${labels.paid}</th>
                            <th>${labels.balance}</th>
                            <th>${labels.remark}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${taxDetails.map(tax => `
                            <tr>
                                <td>${tax.date}</td>
                                <td>${tax.type}</td>
                                <td class="amount">${tax.debit > 0 ? this.formatPrintCurrency(tax.debit) : '—'}</td>
                                <td class="amount">${tax.credit > 0 ? this.formatPrintCurrency(tax.credit) : '—'}</td>
                                <td class="amount">${this.formatPrintCurrency(tax.balance)}</td>
                                <td>${tax.remark}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2"><strong>${labels.totals}</strong></td>
                            <td class="amount"><strong>${this.formatPrintCurrency(totals.totalDebit)}</strong></td>
                            <td class="amount"><strong>${this.formatPrintCurrency(totals.totalCredit)}</strong></td>
                            <td class="amount"><strong>${this.formatPrintCurrency(totals.balance)}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }
    
    generatePrintGovernmentFeesExpenses(labels) {
        const governmentFees = this.data.customerData.combinedGovernmentFees || [];
        const expenses = this.data.customerData.combinedExpenses || [];
        const pendingExpenses = this.data.customerData.combinedPendingExpenses || [];
        
        let content = '';
        
        // Combined Government Fees and Expenses
        if (governmentFees.length > 0 || expenses.length > 0) {
            const combinedTransactions = this.combineGovernmentFeesAndExpenses(governmentFees, expenses);
            
            content += `
                <div class="item-section">
                    <div class="item-title">Government Fees & Expenses Transactions</div>
                    <table class="print-table">
                        <thead>
                            <tr>
                                <th>${labels.date}</th>
                                <th>${labels.type}</th>
                                <th>${labels.due}</th>
                                <th>${labels.paid}</th>
                                <th>${labels.balance}</th>
                                <th>${labels.remark}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${combinedTransactions.map(transaction => `
                                <tr>
                                    <td>${transaction.date}</td>
                                    <td>${transaction.type}</td>
                                    <td class="amount">${transaction.due > 0 ? this.formatPrintCurrency(transaction.due) : '—'}</td>
                                    <td class="amount">${transaction.paid > 0 ? this.formatPrintCurrency(transaction.paid) : '—'}</td>
                                    <td class="amount">${this.formatPrintCurrency(transaction.balance)}</td>
                                    <td>${transaction.remark}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="2"><strong>${labels.totals}</strong></td>
                                <td class="amount"><strong>${this.formatPrintCurrency(combinedTransactions.reduce((sum, t) => sum + (t.due || 0), 0))}</strong></td>
                                <td class="amount"><strong>${this.formatPrintCurrency(combinedTransactions.reduce((sum, t) => sum + (t.paid || 0), 0))}</strong></td>
                                <td class="amount"><strong>${this.formatPrintCurrency(combinedTransactions.reduce((sum, t) => sum + (t.due || 0) - (t.paid || 0), 0))}</strong></td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
        }
        
        // Pending Expenses
        if (pendingExpenses.length > 0) {
            content += `
                <div class="item-section">
                    <div class="item-title">Pending Expenses</div>
                    <table class="print-table">
                        <thead>
                            <tr>
                                <th>Amount</th>
                                <th>Paid</th>
                                <th>Collected Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${pendingExpenses.map(expense => `
                                <tr>
                                    <td class="amount">${this.formatPrintCurrency(expense.amount || 0)}</td>
                                    <td>${expense.paid ? '✓' : '✗'}</td>
                                    <td class="amount">${this.formatPrintCurrency(expense.collected_amount || 0)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        return content;
    }
    
    generatePrintTrustFees(labels) {
        const trustFees = this.data.customerData.combinedTrustFees || [];
        const trustFeesLog = this.data.customerData.combinedTrustFeesLog || [];
        
        if (trustFees.length === 0 && trustFeesLog.length === 0) {
            return '';
        }
        
        const combinedTransactions = this.combineTrustFeesTransactions(trustFees, trustFeesLog);
        const totalDue = combinedTransactions.reduce((sum, t) => sum + (t.due || 0), 0);
        const totalPaid = combinedTransactions.reduce((sum, t) => sum + (t.paid || 0), 0);
        const finalBalance = totalPaid - totalDue;
        
        return `
            <div class="item-section">
                <div class="item-title">Trust Fees Transactions</div>
                <table class="print-table">
                    <thead>
                        <tr>
                            <th>${labels.date}</th>
                            <th>${labels.type}</th>
                            <th>${labels.due}</th>
                            <th>${labels.paid}</th>
                            <th>${labels.balance}</th>
                            <th>${labels.remark}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${combinedTransactions.map(transaction => `
                            <tr>
                                <td>${transaction.date}</td>
                                <td>${transaction.type}</td>
                                <td class="amount">${transaction.due > 0 ? this.formatPrintCurrency(transaction.due) : '—'}</td>
                                <td class="amount">${transaction.paid > 0 ? this.formatPrintCurrency(transaction.paid) : '—'}</td>
                                <td class="amount">${this.formatPrintCurrency(transaction.balance)}</td>
                                <td>${transaction.remark}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2"><strong>${labels.totals}</strong></td>
                            <td class="amount"><strong>${this.formatPrintCurrency(totalDue)}</strong></td>
                            <td class="amount"><strong>${this.formatPrintCurrency(totalPaid)}</strong></td>
                            <td class="amount"><strong>${this.formatPrintCurrency(finalBalance)}</strong></td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
    }
    
    formatPrintCurrency(amount) {
        const formattedAmount = new Intl.NumberFormat('en-AE', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount || 0);
        return `${formattedAmount} د.إ`;
    }
    
    getPrintStyles() {
        return `
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            @page {
                margin: 0;
                size: A4;
            }
            
            @page :first {
                margin: 0;
            }
            
            @page :left {
                margin: 0;
            }
            
            @page :right {
                margin: 0;
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
                orphans: 3;
                widows: 3;
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
                max-width: 100%;
                margin: 0;
                padding: 110px 15mm 90px 15mm;
                position: relative;
                z-index: 1;
                background: white;
                min-height: 100vh;
                box-sizing: border-box;
            }


            .print-header {
                text-align: center;
                margin-bottom: 8px;
                margin-top: 20px;
                border-bottom: 1px solid #333;
                padding-bottom: 5px;
            }

            .print-header h1 {
                font-size: 16px;
                font-weight: bold;
                margin-bottom: 5px;
                color: #333;
            }

            .print-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                font-size: 10px;
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

            .print-project-header {
                background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                color: white;
                padding: 10px 15px;
                text-align: center;
                font-size: 14px;
                font-weight: bold;
                margin-bottom: 10px;
                border-radius: 5px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                page-break-after: avoid;
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
            
            .print-section-header {
                background: none;
                color: #2c3e50;
                padding: 25px 0 8px 0;
                text-align: left;
                font-size: 16px;
                font-weight: bold;
                margin: 30px 0 15px 0;
                border-bottom: 2px solid #e74c3c;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                page-break-after: avoid;
                page-break-before: auto;
                width: auto;
                display: block;
            }
            
            /* Ensure content stays within printable area */
            body {
                margin: 0 !important;
                padding: 0 !important;
            }
            
            @media print {
                @page {
                    margin: 0 !important;
                    size: A4 !important;
                }
                
                @page :first {
                    margin: 0 !important;
                }
                
                @page :left {
                    margin: 0 !important;
                }
                
                @page :right {
                    margin: 0 !important;
                }
                
                body {
                    margin: 0 !important;
                    padding: 0 !important;
                }
                
                .print-header-image {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    width: 100vw !important;
                    height: 90px !important;
                    z-index: 9999 !important;
                    background-size: cover !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                .print-footer-image {
                    position: fixed !important;
                    bottom: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    width: 100vw !important;
                    height: 70px !important;
                    z-index: 9999 !important;
                    background-size: cover !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                .print-container {
                    margin: 0 !important;
                    padding: 110px 15mm 90px 15mm !important;
                    background: white !important;
                    z-index: 1 !important;
                    position: relative !important;
                    min-height: 100vh !important;
                    box-sizing: border-box !important;
                }
                
                .print-header,
                .print-section-header,
                .print-project-section,
                .item-section,
                .print-table {
                    position: relative !important;
                    z-index: 2 !important;
                }
                
                .print-project-header {
                    background: linear-gradient(135deg, #3498db 0%, #2980b9 100%) !important;
                    color: white !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                
                .item-title {
                    background-color: #e74c3c !important;
                    color: white !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            }
        `;
    }
}

// Initialize the Account Statement Report when the page loads
document.addEventListener('DOMContentLoaded', function() {
    if (typeof root_element !== 'undefined') {
        new AccountStatementReport();
    }
});

// Also initialize if root_element is already available
if (typeof root_element !== 'undefined') {
    new AccountStatementReport();
}

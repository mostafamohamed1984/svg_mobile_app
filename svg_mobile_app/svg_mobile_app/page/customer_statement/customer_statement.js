frappe.pages['customer-statement'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: __('Customer Statement') + ' - ' + __('كشف حساب عميل'),
        single_column: true
    });

    // Add CSS class for styling
    $(wrapper).addClass('customer-statement-wrapper');

    // Initialize the customer statement page
    frappe.customer_statement = new CustomerStatement(page);
};

frappe.pages['customer-statement'].on_page_show = function() {
    // Refresh page when shown
    if(frappe.customer_statement) {
        frappe.customer_statement.refresh();
    }
};

class CustomerStatement {
    constructor(page) {
        this.page = page;
        this.wrapper = page.main;
        this.setup_page();
        this.setup_filters();
        this.setup_actions();
    }

    setup_page() {
        // Add custom CSS
        this.add_custom_css();
        
        // Create main layout
        this.wrapper.html(`
            <div class="customer-statement-container">
                <div class="filters-section">
                    <div class="row">
                        <div class="col-md-3">
                            <div class="form-group">
                                <label>${__('Customer')} - ${__('العميل')}</label>
                                <div class="customer-select"></div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group">
                                <label>${__('From Date')} - ${__('من تاريخ')}</label>
                                <div class="from-date"></div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group">
                                <label>${__('To Date')} - ${__('إلى تاريخ')}</label>
                                <div class="to-date"></div>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group">
                                <label>&nbsp;</label>
                                <div class="filter-actions">
                                    <button class="btn btn-primary btn-sm get-statement">${__('Get Statement')} - ${__('عرض الكشف')}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="statement-content">
                    <div class="loading-message" style="text-align: center; padding: 50px; display: none;">
                        <h4>${__('Loading Customer Statement...')}</h4>
                        <p>${__('Please wait while we fetch the data.')}</p>
                    </div>
                    <div class="no-data-message" style="text-align: center; padding: 50px; display: none;">
                        <h4>${__('No Data Found')}</h4>
                        <p>${__('Please select a customer and date range to view the statement.')}</p>
                    </div>
                    <div class="statement-data" style="display: none;"></div>
                </div>
            </div>
        `);
    }

    setup_filters() {
        // Customer selection
        this.customer_field = frappe.ui.form.make_control({
            parent: this.wrapper.find('.customer-select'),
            df: {
                fieldtype: 'Link',
                options: 'Customer',
                placeholder: __('Select Customer'),
                change: () => this.on_customer_change()
            },
            render_input: true
        });

        // From date
        this.from_date_field = frappe.ui.form.make_control({
            parent: this.wrapper.find('.from-date'),
            df: {
                fieldtype: 'Date',
                default: frappe.datetime.add_months(frappe.datetime.get_today(), -6)
            },
            render_input: true
        });

        // To date
        this.to_date_field = frappe.ui.form.make_control({
            parent: this.wrapper.find('.to-date'),
            df: {
                fieldtype: 'Date',
                default: frappe.datetime.get_today()
            },
            render_input: true
        });
    }

    setup_actions() {
        // Get statement button
        this.wrapper.find('.get-statement').on('click', () => {
            this.get_customer_statement();
        });

        // Print button (will be added after data is loaded)
        this.page.set_secondary_action(__('Print Statement'), () => {
            this.print_statement();
        });
    }

    on_customer_change() {
        // Clear previous data when customer changes
        this.wrapper.find('.statement-data').hide();
        this.wrapper.find('.no-data-message').show();
    }

    get_customer_statement() {
        const customer = this.customer_field.get_value();
        const from_date = this.from_date_field.get_value();
        const to_date = this.to_date_field.get_value();

        if (!customer) {
            frappe.msgprint(__('Please select a customer'));
            return;
        }

        // Show loading
        this.wrapper.find('.statement-data, .no-data-message').hide();
        this.wrapper.find('.loading-message').show();

        // Fetch data
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.customer_statement.customer_statement.get_customer_statement_data',
            args: {
                customer: customer,
                from_date: from_date,
                to_date: to_date
            },
            callback: (response) => {
                this.wrapper.find('.loading-message').hide();
                
                if (response.message && response.message.service_groups.length > 0) {
                    this.render_statement(response.message);
                    this.wrapper.find('.statement-data').show();
                } else {
                    this.wrapper.find('.no-data-message').show();
                }
            },
            error: (error) => {
                this.wrapper.find('.loading-message').hide();
                this.wrapper.find('.no-data-message').show();
                console.error('Error fetching customer statement:', error);
            }
        });
    }

    render_statement(data) {
        const statement_html = this.build_statement_html(data);
        this.wrapper.find('.statement-data').html(statement_html);
        this.current_statement_data = data; // Store for printing
    }

    build_statement_html(data) {
        let html = `
            <div class="statement-header">
                <div class="company-info">
                    <h3>${__('Smart Vision Group')} - ${__('الرؤية الذكية للاستشارات الهندسية')}</h3>
                </div>
                <div class="statement-title">
                    <h2>${__('Customer Account Statement')} - ${__('كشف حساب عميل')}</h2>
                </div>
                <div class="customer-details">
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>${__('Customer Name')} - ${__('اسم العميل')}:</strong> ${data.customer.customer_name}</p>
                            <p><strong>${__('Customer ID')} - ${__('رقم العميل')}:</strong> ${data.customer.name}</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>${__('Date Range')} - ${__('الفترة')}:</strong> ${data.date_range.from_date_formatted} ${__('to')} ${data.date_range.to_date_formatted}</p>
                            <p><strong>${__('Tax ID')} - ${__('الرقم الضريبي')}:</strong> ${data.customer.tax_id || 'N/A'}</p>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add service groups
        data.service_groups.forEach(group => {
            html += this.build_service_group_html(group);
        });

        // Add summary
        html += this.build_summary_html(data.summary);

        return html;
    }

    build_service_group_html(group) {
        // Format service title - special handling for VAT section
        let service_title = '';
        if (group.is_tax_section) {
            service_title = `${group.service_name} - vat ${group.tax_rate}%`;
        } else {
            service_title = group.service_name;
        }

        return `
            <div class="service-group">
                <div class="service-header">
                    <h4 class="service-title">${service_title}</h4>
                </div>
                <div class="service-table-container">
                    <table class="table table-bordered service-table">
                        <thead>
                            <tr>
                                <th>${__('Balance')} - ${__('الرصيد')}</th>
                                <th>${__('Paid')} - ${__('المدفوع')}</th>
                                <th>${__('Value')} - ${__('القيمة')}</th>
                                <th>${__('Document No.')} - ${__('رقم السند')}</th>
                                <th>${__('Date')} - ${__('التاريخ')}</th>
                                <th>${__('Description')} - ${__('البيان')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${group.transactions.map(transaction => `
                                <tr>
                                    <td class="text-right">${this.format_currency(transaction.balance)}</td>
                                    <td class="text-right">${this.format_currency(transaction.paid)}</td>
                                    <td class="text-right">${this.format_currency(transaction.value)}</td>
                                    <td>${transaction.document_number}</td>
                                    <td>${frappe.datetime.str_to_user(transaction.date)}</td>
                                    <td>${transaction.description}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td class="text-right"><strong>${this.format_currency(group.total_balance)}</strong></td>
                                <td class="text-right"><strong>${this.format_currency(group.total_paid)}</strong></td>
                                <td class="text-right"><strong>${this.format_currency(group.total_value)}</strong></td>
                                <td colspan="3"><strong>${__('Total')} - ${__('المجموع')}</strong></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
    }

    build_summary_html(summary) {
        return `
            <div class="statement-summary">
                <h4>${__('Summary')} - ${__('الملخص')}</h4>
                <div class="row">
                    <div class="col-md-6">
                        <table class="table table-bordered summary-table">
                            <tr>
                                <td><strong>${__('Total Projects')} - ${__('إجمالي المشاريع')}</strong></td>
                                <td class="text-right">${summary.total_projects}</td>
                            </tr>
                            <tr>
                                <td><strong>${__('Total Invoices')} - ${__('إجمالي الفواتير')}</strong></td>
                                <td class="text-right">${summary.total_invoices}</td>
                            </tr>
                            <tr>
                                <td><strong>${__('Total Claims')} - ${__('إجمالي المطالبات')}</strong></td>
                                <td class="text-right">${summary.total_claims}</td>
                            </tr>
                        </table>
                    </div>
                    <div class="col-md-6">
                        <table class="table table-bordered summary-table">
                            <tr>
                                <td><strong>${__('Grand Total Value')} - ${__('إجمالي القيمة')}</strong></td>
                                <td class="text-right">${this.format_currency(summary.grand_total_value)}</td>
                            </tr>
                            <tr>
                                <td><strong>${__('Grand Total Paid')} - ${__('إجمالي المدفوع')}</strong></td>
                                <td class="text-right">${this.format_currency(summary.grand_total_paid)}</td>
                            </tr>
                            <tr class="highlight-row">
                                <td><strong>${__('Grand Total Balance')} - ${__('إجمالي الرصيد')}</strong></td>
                                <td class="text-right"><strong>${this.format_currency(summary.grand_total_balance)}</strong></td>
                            </tr>
                        </table>
                    </div>
                </div>
            </div>
        `;
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
        return `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${__('Customer Statement')} - ${data.customer.customer_name}</title>
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

                    .company-logo {
                        margin-bottom: 15px;
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

                    .customer-details {
                        background: #f8f9fa;
                        padding: 20px;
                        border-radius: 8px;
                        margin-bottom: 30px;
                        border: 1px solid #dee2e6;
                    }

                    .customer-details table {
                        width: 100%;
                        border: none;
                    }

                    .customer-details td {
                        padding: 8px;
                        border: none;
                        font-size: 14px;
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

                    .service-table .total-row {
                        background: #f8f9fa;
                        font-weight: bold;
                        border-top: 2px solid #007bff;
                    }

                    .text-right {
                        text-align: right !important;
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

                    .summary-table {
                        width: 100%;
                        border-collapse: collapse;
                        background: white;
                    }

                    .summary-table td {
                        padding: 12px;
                        border: 1px solid #dee2e6;
                        font-size: 14px;
                    }

                    .highlight-row {
                        background: #fff3cd !important;
                        font-weight: bold;
                        color: #856404;
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

                        .service-group {
                            page-break-inside: avoid;
                        }

                        .statement-summary {
                            page-break-inside: avoid;
                        }
                    }
                </style>
            </head>
            <body>
                <div class="print-header">
                    <div class="company-info">
                        <h1>الرؤية الذكية للاستشارات الهندسية</h1>
                        <h1>Smart Vision Group</h1>
                    </div>
                    <div class="statement-title">
                        كشف حساب عميل - Customer Account Statement
                    </div>
                </div>

                <div class="customer-details">
                    <table>
                        <tr>
                            <td><strong>اسم العميل - Customer Name:</strong></td>
                            <td>${data.customer.customer_name}</td>
                            <td><strong>رقم العميل - Customer ID:</strong></td>
                            <td>${data.customer.name}</td>
                        </tr>
                        <tr>
                            <td><strong>الفترة - Date Range:</strong></td>
                            <td>${data.date_range.from_date_formatted} إلى ${data.date_range.to_date_formatted}</td>
                            <td><strong>الرقم الضريبي - Tax ID:</strong></td>
                            <td>${data.customer.tax_id || 'غير محدد'}</td>
                        </tr>
                        <tr>
                            <td><strong>تاريخ الطباعة - Print Date:</strong></td>
                            <td>${frappe.datetime.now_datetime().split(' ')[0]}</td>
                            <td><strong>المجموعة - Group:</strong></td>
                            <td>${data.customer.customer_group || 'غير محدد'}</td>
                        </tr>
                    </table>
                </div>

                ${data.service_groups.map(group => {
                    // Format service title for print - special handling for VAT section
                    let service_title = '';
                    if (group.is_tax_section) {
                        service_title = `${group.service_name} - vat ${group.tax_rate}%`;
                    } else {
                        service_title = group.service_name;
                    }

                    return `
                    <div class="service-group">
                        <h3 class="service-title">${service_title}</h3>
                        <table class="service-table">
                            <thead>
                                <tr>
                                    <th>الرصيد<br>Balance</th>
                                    <th>المدفوع<br>Paid</th>
                                    <th>القيمة<br>Value</th>
                                    <th>رقم السند<br>Document No.</th>
                                    <th>التاريخ<br>Date</th>
                                    <th>البيان<br>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${group.transactions.map(transaction => `
                                    <tr>
                                        <td class="text-right">${this.format_currency_for_print(transaction.balance)}</td>
                                        <td class="text-right">${this.format_currency_for_print(transaction.paid)}</td>
                                        <td class="text-right">${this.format_currency_for_print(transaction.value)}</td>
                                        <td>${transaction.document_number}</td>
                                        <td>${frappe.datetime.str_to_user(transaction.date)}</td>
                                        <td>${transaction.description}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr class="total-row">
                                    <td class="text-right">${this.format_currency_for_print(group.total_balance)}</td>
                                    <td class="text-right">${this.format_currency_for_print(group.total_paid)}</td>
                                    <td class="text-right">${this.format_currency_for_print(group.total_value)}</td>
                                    <td colspan="3"><strong>المجموع - Total</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    `;
                }).join('')}

                <div class="statement-summary">
                    <h3>الملخص - Summary</h3>
                    <table class="summary-table">
                        <tr>
                            <td><strong>إجمالي المشاريع - Total Projects</strong></td>
                            <td class="text-right">${data.summary.total_projects}</td>
                            <td><strong>إجمالي الفواتير - Total Invoices</strong></td>
                            <td class="text-right">${data.summary.total_invoices}</td>
                        </tr>
                        <tr>
                            <td><strong>إجمالي المطالبات - Total Claims</strong></td>
                            <td class="text-right">${data.summary.total_claims}</td>
                            <td><strong>إجمالي القيود - Total Journal Entries</strong></td>
                            <td class="text-right">${data.summary.total_journal_entries}</td>
                        </tr>
                        <tr>
                            <td><strong>إجمالي القيمة - Grand Total Value</strong></td>
                            <td class="text-right">${this.format_currency_for_print(data.summary.grand_total_value)}</td>
                            <td><strong>إجمالي المدفوع - Grand Total Paid</strong></td>
                            <td class="text-right">${this.format_currency_for_print(data.summary.grand_total_paid)}</td>
                        </tr>
                        <tr class="highlight-row">
                            <td colspan="2"><strong>إجمالي الرصيد - Grand Total Balance</strong></td>
                            <td colspan="2" class="text-right"><strong>${this.format_currency_for_print(data.summary.grand_total_balance)}</strong></td>
                        </tr>
                    </table>
                </div>

                <div class="print-footer">
                    <p>تم إنشاء هذا التقرير بواسطة نظام الرؤية الذكية للاستشارات الهندسية</p>
                    <p>Generated by Smart Vision Group System - ${frappe.datetime.now_datetime()}</p>
                </div>
            </body>
            </html>
        `;
    }

    format_currency_for_print(amount) {
        // Use the currency from the statement data, fallback to EGP
        const currency = this.current_statement_data?.currency || 'EGP';
        return new Intl.NumberFormat('ar-EG', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(amount || 0);
    }

    add_custom_css() {
        if (!$('#customer-statement-css').length) {
            $('head').append(`
                <style id="customer-statement-css">
                    .customer-statement-wrapper {
                        background: #f8f9fa;
                        min-height: 100vh;
                    }
                    .customer-statement-container {
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
                    }
                    .statement-header {
                        padding: 20px;
                        border-bottom: 2px solid #007bff;
                        margin-bottom: 20px;
                    }
                    .service-group {
                        margin-bottom: 30px;
                        padding: 0 20px;
                    }
                    .service-title {
                        background: #ffc107;
                        color: #000;
                        padding: 10px;
                        margin: 0 0 10px 0;
                        text-align: center;
                        border-radius: 4px;
                    }
                    .service-table th {
                        background: #007bff;
                        color: white;
                        text-align: center;
                    }
                    .total-row {
                        background: #f8f9fa;
                        font-weight: bold;
                    }
                    .statement-summary {
                        padding: 20px;
                        background: #f8f9fa;
                        margin: 20px;
                        border-radius: 8px;
                    }
                    .highlight-row {
                        background: #fff3cd;
                        font-weight: bold;
                    }
                    .text-right {
                        text-align: right;
                    }
                </style>
            `);
        }
    }

    format_currency(amount) {
        if (amount === null || amount === undefined) {
            return '0.00';
        }
        // Use the currency from the statement data, fallback to EGP
        const currency = this.current_statement_data?.currency || 'EGP';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(amount);
    }

    refresh() {
        // Refresh the page if needed
    }
}

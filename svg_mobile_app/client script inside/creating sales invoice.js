frappe.ui.form.on('Project Contractors', {
    refresh: function(frm) {
        // Add custom button for creating sales invoices with tax support
        if (frm.doc.docstatus === 1 && !frm.doc.sales_invoice_created) {
            frm.add_custom_button(__('Create Sales Invoices'), function() {
                create_sales_invoices_with_taxes(frm);
            }, __('Create'));
        }
        
        // Show the "Create Additional Fees" button if sales_invoice_created is 1 and there are uninvoiced items
        if (frm.doc.docstatus === 1 && frm.doc.sales_invoice_created) {
            let hasUninvoicedItems = false;
            if (frm.doc.items && frm.doc.items.length > 0) {
                hasUninvoicedItems = frm.doc.items.some(item => !item.invoiced);
            }
            
            if (hasUninvoicedItems) {
                frm.add_custom_button(__('Create Additional Fees'), function() {
                    createAdditionalFees(frm);
                }).addClass('btn-primary');
            }
        }
    }
});

function create_sales_invoices_with_taxes(frm) {
    frappe.confirm(
        __('This will create two separate sales invoices:<br>1. Project Items (with taxes)<br>2. Fees and Deposits (without taxes)<br><br>Do you want to continue?'),
        function() {
            // Create invoice for project items (taxable)
            if (frm.doc.items && frm.doc.items.length > 0) {
                create_taxable_invoice(frm);
            }
            
            // Create invoice for fees and deposits (non-taxable)
            if (frm.doc.fees_and_deposits && frm.doc.fees_and_deposits.length > 0) {
                create_non_taxable_invoice(frm);
            }
        }
    );
}

function create_taxable_invoice(frm) {
    let items_with_rates = frm.doc.items.filter(item => item.custom_rate > 0);
    
    if (items_with_rates.length === 0) {
        frappe.msgprint(__('No project items with rates found'));
        return;
    }

    let sales_invoice = frappe.model.get_new_doc('Sales Invoice');
    
    // Set basic details
    sales_invoice.customer = frm.doc.customer;
    sales_invoice.company = frm.doc.company;
    sales_invoice.project_name = frm.doc.project_name;
    sales_invoice.posting_date = frappe.datetime.get_today();
    
    // Add items
    items_with_rates.forEach(function(item) {
        let invoice_item = frappe.model.add_child(sales_invoice, 'items');
        invoice_item.item_code = item.item;
        invoice_item.qty = 1;
        invoice_item.rate = item.custom_rate;
        invoice_item.amount = item.custom_rate;
    });
    
    // Apply tax template if selected
    if (frm.doc.tax_template) {
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Sales Taxes and Charges Template',
                name: frm.doc.tax_template
            },
            callback: function(r) {
                if (r.message && r.message.taxes) {
                    r.message.taxes.forEach(function(tax) {
                        let invoice_tax = frappe.model.add_child(sales_invoice, 'taxes');
                        invoice_tax.charge_type = tax.charge_type;
                        invoice_tax.account_head = tax.account_head;
                        invoice_tax.description = tax.description;
                        invoice_tax.rate = tax.rate;
                        if (tax.charge_type === 'Actual') {
                            invoice_tax.tax_amount = tax.tax_amount;
                        }
                    });
                }
                
                // Open the invoice for review and submission
                frappe.set_route('Form', 'Sales Invoice', sales_invoice.name);
                
                // Auto-save and submit
                setTimeout(function() {
                    cur_frm.save().then(function() {
                        cur_frm.submit();
                        frappe.msgprint(__('Taxable Sales Invoice created and submitted'));
                    });
                }, 1000);
            }
        });
    } else {
        // No tax template, create invoice without taxes
        frappe.set_route('Form', 'Sales Invoice', sales_invoice.name);
        setTimeout(function() {
            cur_frm.save().then(function() {
                cur_frm.submit();
                frappe.msgprint(__('Sales Invoice created and submitted (no taxes)'));
            });
        }, 1000);
    }
}

function create_non_taxable_invoice(frm) {
    let fees_with_rates = frm.doc.fees_and_deposits.filter(fee => fee.custom_rate > 0);
    
    if (fees_with_rates.length === 0) {
        frappe.msgprint(__('No fees and deposits with rates found'));
        return;
    }

    let sales_invoice = frappe.model.get_new_doc('Sales Invoice');
    
    // Set basic details
    sales_invoice.customer = frm.doc.customer;
    sales_invoice.company = frm.doc.company;
    sales_invoice.project_name = frm.doc.project_name + ' - Fees';
    sales_invoice.posting_date = frappe.datetime.get_today();
    
    // Add fees and deposits (no taxes)
    fees_with_rates.forEach(function(fee) {
        let invoice_item = frappe.model.add_child(sales_invoice, 'items');
        invoice_item.item_code = fee.item;
        invoice_item.qty = 1;
        invoice_item.rate = fee.custom_rate;
        invoice_item.amount = fee.custom_rate;
    });
    
    // Open the invoice for review and submission
    frappe.set_route('Form', 'Sales Invoice', sales_invoice.name);
    
    // Auto-save and submit
    setTimeout(function() {
        cur_frm.save().then(function() {
            cur_frm.submit();
            frappe.msgprint(__('Non-taxable Sales Invoice created and submitted'));
        });
    }, 2000);
}

function createAdditionalFees(frm) {
    // Show a confirmation dialog before creating additional fees
    frappe.confirm(
        'Are you sure you want to create additional fees for this customer?',
        function() {
            // User confirmed, proceed with creation
            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: 'Customer',
                    filters: { name: frm.doc.customer },
                    fieldname: ['default_currency', 'default_price_list']
                },
                callback: function(response) {
                    if (response.message) {
                        let customerCurrency = response.message.default_currency;
                        let priceList = response.message.default_price_list;

                        // Initialize items array with only uninvoiced items
                        let items = [];
                        let itemsToMarkAsInvoiced = [];
                        
                        // Add items from the items table if they exist and are not invoiced
                        if (frm.doc.items && frm.doc.items.length > 0) {
                            frm.doc.items.forEach(function(item, index) {
                                if (!item.invoiced) {
                                    items.push({
                                        item_code: item.item,
                                        qty: item.qty || 1,
                                        rate: item.rate
                                    });
                                    itemsToMarkAsInvoiced.push(index);
                                }
                            });
                        }

                        // Proceed only if we have items to invoice
                        if (items.length === 0) {
                            frappe.msgprint(__('No uninvoiced items found to create additional fees'));
                            return;
                        }

                        // Create the Sales Invoice document
                        let salesInvoice = {
                            doctype: 'Sales Invoice',
                            custom_for_project: frm.doc.name,
                            customer: frm.doc.customer,
                            currency: customerCurrency || frappe.defaults.get_default("currency"),
                            items: items,
                            price_list_currency: customerCurrency || frappe.defaults.get_default("currency"),
                            selling_price_list: priceList || frappe.defaults.get_default("selling_price_list"),
                            ignore_pricing_rule: 1
                        };

                        // Create the Sales Invoice
                        frappe.call({
                            method: 'frappe.client.insert',
                            args: {
                                doc: salesInvoice
                            },
                            callback: function(response) {
                                if (response.message) {
                                    // Mark items as invoiced
                                    let itemsUpdate = frm.doc.items.map((item, idx) => {
                                        if (itemsToMarkAsInvoiced.includes(idx)) {
                                            return Object.assign({}, item, { 
                                                invoiced: 1,
                                                sales_invoice: response.message.name
                                            });
                                        }
                                        return item;
                                    });
                                    
                                    frappe.call({
                                        method: 'frappe.client.set_value',
                                        args: {
                                            doctype: 'Project Contractors',
                                            name: frm.doc.name,
                                            fieldname: {
                                                items: itemsUpdate
                                            }
                                        },
                                        callback: function() {
                                            frm.refresh();
                                            frappe.msgprint(__('Additional Fees Invoice created successfully'));
                                            frappe.set_route('Form', 'Sales Invoice', response.message.name);
                                        },
                                        error: function(err) {
                                            frappe.msgprint(__('Error updating Project Contractors'));
                                            console.error(err);
                                        }
                                    });
                                }
                            },
                            error: function(err) {
                                frappe.msgprint(__('Error creating Additional Fees Invoice'));
                                console.error(err);
                            },
                            freeze: true,
                            freeze_message: __('Creating Additional Fees Invoice...')
                        });
                    }
                },
                error: function(err) {
                    frappe.msgprint(__('Error fetching customer details'));
                    console.error(err);
                }
            });
        },
        function() {
            // Cancel action
            frappe.msgprint(__('Additional Fees creation cancelled'));
        }
    );
}

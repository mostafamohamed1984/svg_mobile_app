frappe.ui.form.on('Project Contractors', {
    refresh: function(frm) {
        // Show the "Create Sales Invoice" button only if document is submitted and sales_invoice_created is 0
        if (frm.doc.docstatus === 1 && !frm.doc.sales_invoice_created) {
            frm.add_custom_button(__('Create Sales Invoice'), function() {
                createSalesInvoice(frm);
            }).addClass('btn-primary');
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

function createSalesInvoice(frm) {
    // Show a confirmation dialog before creating the invoice
    frappe.confirm(
        'Are you sure you want to create a Sales Invoice for this customer?',
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
                            frappe.msgprint(__('No uninvoiced items found to create invoice'));
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
                                    // Update the sales_invoice_created field and mark items as invoiced
                                    let updates = {
                                        'sales_invoice_created': 1,
                                        'sales_invoice': response.message.name
                                    };
                                    
                                    // Prepare items update
                                    if (itemsToMarkAsInvoiced.length > 0) {
                                        let itemsUpdate = frm.doc.items.map((item, idx) => {
                                            if (itemsToMarkAsInvoiced.includes(idx)) {
                                                return Object.assign({}, item, { invoiced: 1 });
                                            }
                                            return item;
                                        });
                                        updates.items = itemsUpdate;
                                    }
                                    
                                    frappe.call({
                                        method: 'frappe.client.set_value',
                                        args: {
                                            doctype: 'Project Contractors',
                                            name: frm.doc.name,
                                            fieldname: updates
                                        },
                                        callback: function() {
                                            frm.refresh();
                                            frappe.msgprint(__('Sales Invoice created successfully'));
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
                                frappe.msgprint(__('Error creating Sales Invoice'));
                                console.error(err);
                            },
                            freeze: true,
                            freeze_message: __('Creating Sales Invoice...')
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
            frappe.msgprint(__('Sales Invoice creation cancelled'));
        }
    );
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
                                            return Object.assign({}, item, { invoiced: 1 });
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

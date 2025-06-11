// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project Contractors", {
    refresh: function(frm) {
        console.log("Current company:", frappe.defaults.get_user_default('company'));
        setup_item_filter(frm);
        
        // Add button to create Employee Advances from fees and deposits
        if (frm.doc.docstatus === 1 && frm.doc.fees_and_deposits && frm.doc.fees_and_deposits.length > 0) {
            // Check if there are any fees and deposits items that have Project Claims but don't have Employee Advances created
            check_project_claims_for_advances(frm);
        }

        // Add custom buttons for creating invoices
        if (frm.doc.docstatus === 1) {
            frm.add_custom_button(__('Create Sales Invoice (Items)'), function() {
                frm.call({
                    method: 'create_sales_invoice_for_items',
                    doc: frm.doc,
                    callback: function(r) {
                        if (r.message) {
                            frappe.msgprint(__('Sales Invoice created: {0}', [r.message]));
                            frm.reload_doc();
                        }
                    }
                });
            }, __('Create'));

            frm.add_custom_button(__('Create Sales Invoice (Fees)'), function() {
                frm.call({
                    method: 'create_sales_invoice_for_fees',
                    doc: frm.doc,
                    callback: function(r) {
                        if (r.message) {
                            frappe.msgprint(__('Sales Invoice created: {0}', [r.message]));
                            frm.reload_doc();
                        }
                    }
                });
            }, __('Create'));
        }
    },
    
    setup: function(frm) {
        setup_item_filter(frm);
        frm.set_query('tax_template', function() {
            return {
                filters: {
                    'company': frm.doc.company
                }
            };
        });
    },

    tax_template: function(frm) {
        console.log('Tax template changed:', frm.doc.tax_template);
        console.log('Total items:', frm.doc.total_items);
        
        if (frm.doc.tax_template && frm.doc.total_items) {
            console.log('Calling get_tax_preview with amount:', frm.doc.total_items);
            frm.call({
                method: 'get_tax_preview',
                doc: frm.doc,
                args: {
                    amount: frm.doc.total_items
                },
                callback: function(r) {
                    console.log('Tax preview response:', r);
                    if (r.message) {
                        frappe.msgprint({
                            title: __('Tax Preview'),
                            message: __('Tax Amount: {0}', [format_currency(r.message.tax_amount, frm.doc.currency)]),
                            indicator: 'blue'
                        });
                    } else {
                        console.log('No tax preview data returned');
                    }
                }
            });
        } else {
            if (!frm.doc.tax_template) {
                console.log('No tax template selected');
            }
            if (!frm.doc.total_items) {
                console.log('No total_items value found');
            }
        }
    },

    customer: function(frm) {
        if (frm.doc.customer) {
            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "Customer",
                    name: frm.doc.customer
                },
                callback: function(r) {
                    if (r.message && r.message.custom_company) {
                        frm.set_value("company", r.message.custom_company);
                    }
                }
            });
        }
    },

    company: function(frm) {
        if (frm.doc.company) {
            frm.set_query('tax_template', function() {
                return {
                    filters: {
                        'company': frm.doc.company
                    }
                };
            });
            // Clear tax template if company changes
            if (frm.doc.tax_template) {
                frm.set_value('tax_template', '');
            }
        }
    }
});

// Function to check if there are Project Claims for the fees and deposits items
function check_project_claims_for_advances(frm) {
    // Get all sales invoices created for this Project Contractors
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.doctype.project_contractors.project_contractors.check_project_claims_for_advances',
        args: {
            project_contractors: frm.doc.name,
            include_partial_advances: true  // Include items with partial advances
        },
        callback: function(r) {
            if (r.message && r.message.has_eligible_items) {
                frm.add_custom_button(__('Create Employee Advances'), function() {
                    create_employee_advances(frm, r.message.eligible_items);
                }).addClass('btn-primary');
            }
        }
    });
}

// Filter for setting up item filter
function setup_item_filter(frm) {
    frm.set_query("item", "fees_and_deposits", function(doc, cdt, cdn) {
        return {
            filters: [
                ["Item", "disabled", "=", 0]
            ]
        };
    });
}

function create_employee_advances(frm, eligible_items) {
    // Filter out items that already have Employee Advances created
    let pending_items = eligible_items.filter(item => {
        // Check if the item is fully processed
        return !item.employee_advance_created;
    });
    
    if (pending_items.length === 0) {
        frappe.msgprint(__('No eligible items found for creating Employee Advances.'));
        return;
    }
    
    console.log("Pending items:", pending_items);
    
    // Show a dialog to select employees for the advances
    let dialog = new frappe.ui.Dialog({
        title: __('Create Employee Advances'),
        fields: [
            {
                fieldname: 'fees_and_deposits_html',
                fieldtype: 'HTML',
                label: __('Fees and Deposits')
            }
        ],
        primary_action_label: __('Create Advances'),
        primary_action(values) {
            create_advances_from_dialog(frm, dialog, values, pending_items);
            dialog.hide();
        }
    });

    // Render the fees and deposits table
    let fees_html = `
        <div class="table-responsive">
            <table class="table table-bordered">
                <thead>
                    <tr>
                        <th>${__('Item')}</th>
                        <th>${__('Original Rate')}</th>
                        <th>${__('Claimed Amount')}</th>
                        <th>${__('Remaining Amount')}</th>
                        <th>${__('Actions')}</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    pending_items.forEach((item, idx) => {
        const remainingAmount = item.remaining_amount || item.claimed_amount || item.rate;
        
        fees_html += `
            <tr>
                <td>
                    <strong>${item.item}</strong>
                </td>
                <td>${format_currency(item.rate)}</td>
                <td>${format_currency(item.claimed_amount)}</td>
                <td>${format_currency(remainingAmount)}</td>
                <td>
                    <button class="btn btn-sm btn-primary add-employee" data-idx="${idx}">
                        <i class="fa fa-plus"></i> ${__('Add Employee')}
                    </button>
                </td>
            </tr>
            <tr>
                <td colspan="5" style="padding: 0;">
                    <div class="ml-4 mr-4 mb-2">
                        <table class="table table-borderless">
                            <thead>
                                <tr>
                                    <th>${__('Employee')}</th>
                                    <th>${__('Amount')}</th>
                                    <th>${__('Purpose')}</th>
                                    <th>${__('Action')}</th>
                                </tr>
                            </thead>
                            <tbody class="employee-entries-body" data-idx="${idx}">
                                <!-- Employee entries will be added here -->
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td>${__('Total Allocated:')}</td>
                                    <td class="total-allocated" data-idx="${idx}">0.00</td>
                                    <td colspan="2">
                                        <div class="progress">
                                            <div class="progress-bar" role="progressbar" data-idx="${idx}" 
                                                 style="width: 0%;" aria-valuenow="0" aria-valuemin="0" 
                                                 aria-valuemax="100">0%</div>
                                        </div>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </td>
            </tr>
        `;
    });

    fees_html += `
                </tbody>
            </table>
        </div>
    `;

    dialog.fields_dict.fees_and_deposits_html.$wrapper.html(fees_html);
    
    // Initialize employee entries tracking
    const employeeEntries = {};
    pending_items.forEach((item, idx) => {
        employeeEntries[idx] = [];
    });
    
    // Helper function to add employee entry row
    function addEmployeeRow(idx) {
        const item = pending_items[idx];
        const entryId = `${idx}-${employeeEntries[idx].length}`;
        
        const tbody = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.employee-entries-body[data-idx="${idx}"]`);
        const row = $(`
            <tr data-entry-id="${entryId}">
                <td class="employee-field-container-${entryId}"></td>
                <td class="amount-field-container-${entryId}"></td>
                <td>
                    <input type="text" class="form-control purpose-input" 
                           data-entry-id="${entryId}" 
                           value="Advance for ${item.item}">
                </td>
                <td>
                    <button class="btn btn-sm btn-danger remove-employee" data-entry-id="${entryId}">
                        <i class="fa fa-trash"></i>
                    </button>
                </td>
            </tr>
        `);
        
        tbody.append(row);
        
        // Create employee field
        frappe.ui.form.make_control({
            parent: dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.employee-field-container-${entryId}`),
            df: {
                fieldtype: 'Link',
                options: 'Employee',
                fieldname: `employee_${entryId}`,
                placeholder: 'Select Employee',
                reqd: true,
                get_query: function() {
                    return {
                        filters: {
                            'status': 'Active'
                        }
                    };
                }
            },
            render_input: true
        });
        
        // Create amount field
        const maxAmount = flt(item.remaining_amount || item.claimed_amount || item.rate);
        frappe.ui.form.make_control({
            parent: dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.amount-field-container-${entryId}`),
            df: {
                fieldtype: 'Currency',
                fieldname: `amount_${entryId}`,
                placeholder: 'Enter Amount',
                default: maxAmount,  // Default to the max amount
                precision: 2,
                reqd: true
            },
            render_input: true
        });
        
        // Add to tracking
        employeeEntries[idx].push({
            id: entryId,
            row: row
        });
        
        // Add onchange handler for amount field
        dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.amount-field-container-${entryId} input`).on('change', function() {
            updateTotalAllocated(idx);
        });
        
        // Update the UI
        updateTotalAllocated(idx);
    }
    
    // Function to update the total allocated amount
    function updateTotalAllocated(idx) {
        const item = pending_items[idx];
        let totalAllocated = 0;
        
        employeeEntries[idx].forEach(entry => {
            const amountFieldContainer = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.amount-field-container-${entry.id}`);
            
            // First try to get the frappe control instance
            const controlInstance = amountFieldContainer.find('input').data('fieldobj');
            if (controlInstance && typeof controlInstance.get_value === 'function') {
                // If we have the control instance, get its value directly
                totalAllocated += flt(controlInstance.get_value());
            } else {
                // Fallback to parsing the input value
                const amountField = amountFieldContainer.find('input');
                totalAllocated += flt(amountField.val());
            }
        });
        
        // Update the total allocated display
        dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.total-allocated[data-idx="${idx}"]`)
            .text(format_currency(totalAllocated));
        
        // Use the remaining amount for the percentage calculation if available
        const maxAmount = flt(item.remaining_amount || item.claimed_amount || item.rate);
        const percentage = maxAmount > 0 ? Math.min(100, (totalAllocated / maxAmount) * 100) : 0;
        const progressBar = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.progress-bar[data-idx="${idx}"]`);
        progressBar.css('width', `${percentage}%`);
        progressBar.attr('aria-valuenow', percentage);
        progressBar.text(`${Math.round(percentage)}%`);
        
        // Change color based on allocation
        if (percentage < 100) {
            progressBar.removeClass('bg-success bg-danger').addClass('bg-warning');
        } else if (percentage === 100) {
            progressBar.removeClass('bg-warning bg-danger').addClass('bg-success');
        } else {
            progressBar.removeClass('bg-warning bg-success').addClass('bg-danger');
        }
    }
    
    // Add event handlers
    dialog.fields_dict.fees_and_deposits_html.$wrapper.on('click', '.add-employee', function() {
        const idx = $(this).data('idx');
        addEmployeeRow(idx);
    });
    
    dialog.fields_dict.fees_and_deposits_html.$wrapper.on('click', '.remove-employee', function() {
        const entryId = $(this).data('entry-id');
        const [idx, entryIndex] = entryId.split('-').map(Number);
        
        // Remove from DOM
        dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`tr[data-entry-id="${entryId}"]`).remove();
        
        // Remove from tracking
        employeeEntries[idx].splice(entryIndex, 1);
        
        // Update the UI
        updateTotalAllocated(idx);
    });
    
    dialog.fields_dict.fees_and_deposits_html.$wrapper.on('change', '.purpose-input', function() {
        const entryId = $(this).data('entry-id');
        const [idx, entryIndex] = entryId.split('-').map(Number);
        const purpose = $(this).val();
        
        if (employeeEntries[idx][entryIndex]) {
            employeeEntries[idx][entryIndex].purpose = purpose;
        }
    });
    
    // Automatically add one employee row for each item
    pending_items.forEach((_, idx) => {
        addEmployeeRow(idx);
    });
    
    dialog.show();
    
    // Function to create the advances from dialog values
    function create_advances_from_dialog(frm, dialog, values, pending_items) {
        // Collect data from the dialog
        let advances_to_create = [];
        let validation_errors = [];
        
        // Group by item to check total amounts
        const totals_by_item = {};
        
        pending_items.forEach((item, idx) => {
            // Get the max amount from the remaining amount, claimed amount, or rate (in that order of preference)
            const maxAmount = flt(item.remaining_amount || item.claimed_amount || item.rate);
            let totalForItem = 0;
            
            employeeEntries[idx].forEach(entry => {
                // Get the employee value
                const employeeField = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.employee-field-container-${entry.id} input`);
                const employee = employeeField.val();
                
                // Get the amount using the same approach as in updateTotalAllocated
                let amount = 0;
                const amountFieldContainer = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.amount-field-container-${entry.id}`);
                
                // First try to get the frappe control instance
                const controlInstance = amountFieldContainer.find('input').data('fieldobj');
                if (controlInstance && typeof controlInstance.get_value === 'function') {
                    // If we have the control instance, get its value directly
                    amount = flt(controlInstance.get_value());
                } else {
                    // Fallback to parsing the input value
                    const amountField = amountFieldContainer.find('input');
                    amount = flt(amountField.val());
                }
                
                // Get the purpose
                const purposeField = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.purpose-input[data-entry-id="${entry.id}"]`);
                const purpose = purposeField.val() || `Advance for ${item.item}`;
                
                // Add to the total for this item
                totalForItem += amount;
                
                if (employee && amount > 0) {
                    console.log(`Creating advance for employee ${employee} with amount ${amount}`);
                    advances_to_create.push({
                        employee: employee,
                        purpose: purpose,
                        advance_amount: amount,
                        item: item.item,
                        project_contractors: frm.doc.name,
                        invoice_reference: item.invoice_reference || null
                    });
                }
            });
            
            // Validate total amount for this item
            if (totalForItem > maxAmount) {
                validation_errors.push(`Total amount for ${item.item} (${format_currency(totalForItem)}) exceeds the available amount (${format_currency(maxAmount)}).`);
            }
        });
        
        // Check for validation errors
        if (validation_errors.length > 0) {
            frappe.msgprint({
                title: __('Validation Error'),
                indicator: 'red',
                message: validation_errors.join('<br>')
            });
            return;
        }
        
        if (advances_to_create.length === 0) {
            frappe.msgprint(__('No valid advances to create. Please add employees and specify amounts.'));
            return;
        }
        
        console.log("Advances to create:", advances_to_create);
        
        // Create the employee advances
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.doctype.project_contractors.project_contractors.create_employee_advances',
            args: {
                project_contractors: frm.doc.name,
                advances: advances_to_create
            },
            freeze: true,
            freeze_message: __('Creating Employee Advances...'),
            callback: function(r) {
                if (r.message && r.message.advances) {
                    // Show success message with links to created advances
                    let message = __('Created the following Employee Advances:<br>');
                    r.message.advances.forEach(adv => {
                        message += `<a href="/app/employee-advance/${adv}" target="_blank">${adv}</a><br>`;
                    });
                    frappe.msgprint({
                        title: __('Success'),
                        indicator: 'green',
                        message: message
                    });
                    
                    frm.reload_doc();
                }
            }
        });
    }
}

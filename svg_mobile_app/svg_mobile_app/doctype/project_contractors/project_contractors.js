// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project Contractors", {
    refresh: function(frm) {
        console.log("Current company:", frappe.defaults.get_user_default('company'));
        setup_item_filter(frm);

        // Initialize previous company value to prevent unnecessary tax template clearing
        frm._previous_company = frm.doc.company;

        // Add button to create Employee Advances from fees and deposits
        if (frm.doc.docstatus === 1 && frm.doc.fees_and_deposits && frm.doc.fees_and_deposits.length > 0) {
            // Check if there are any fees and deposits items that have Project Claims but don't have Employee Advances created
            check_project_claims_for_advances(frm);
        }

        // Sales invoices are now created automatically on document submission
        // No manual buttons needed
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
            // Store the previous company value to detect actual changes
            const previous_company = frm._previous_company || null;
            const current_company = frm.doc.company;

            frm.set_query('tax_template', function() {
                return {
                    filters: {
                        'company': frm.doc.company
                    }
                };
            });

            // Only clear tax template if company actually changed to a different value
            if (frm.doc.tax_template && previous_company && previous_company !== current_company) {
                frm.set_value('tax_template', '');
            }

            // Store current company as previous for next change
            frm._previous_company = current_company;
        }
    }
});

// Function to check if there are Project Claims for the fees and deposits items
function check_project_claims_for_advances(frm) {
    // First check if there are paid Employee Advances available for this contractor
    frm.call({
        method: 'check_paid_employee_advance_availability',
        doc: frm.doc,
        callback: function(r) {
            // Remove existing button first
            frm.remove_custom_button(__('Employee Advance References'));
            
            if (r.message && r.message.available_amount > 0) {
                // Show button for Employee Advance references
                frm.add_custom_button(__('Employee Advance References'), function() {
                    show_employee_advance_dialog(frm, r.message);
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

// Function to show Employee Advance reference dialog
function show_employee_advance_dialog(frm, advance_data) {
    let dialog = new frappe.ui.Dialog({
        title: __('Employee Advance References'),
        size: 'large',
        fields: [
            {
                fieldname: 'available_amount_info',
                fieldtype: 'HTML',
                label: __('Available Amount Information')
            },
            {
                fieldname: 'advance_details_html',
                fieldtype: 'HTML',
                label: __('Employee Advance Details')
            }
        ]
        // Removed primary_action - this is now reference-only
    });

    // Show available amount information
    let info_html = `
        <div class="alert alert-info">
            <strong>Total Available Amount:</strong> ${frappe.format(advance_data.available_amount, {'fieldtype': 'Currency'})}
            <br>
            <small>This shows Employee Advances created from Project Advances for reference purposes.</small>
        </div>
    `;
    
    dialog.fields_dict.available_amount_info.$wrapper.html(info_html);

    // Show advance details
    let details_html = `
        <div class="table-responsive">
            <table class="table table-bordered">
                <thead>
                    <tr>
                        <th>Employee Advance</th>
                        <th>Advance Amount</th>
                        <th>Paid Amount</th>
                        <th>Claimed Amount</th>
                        <th>Return Amount</th>
                        <th>Outstanding</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    advance_data.advance_details.forEach(advance => {
        details_html += `
            <tr>
                <td><a href="/app/employee-advance/${advance.name}" target="_blank">${advance.name}</a></td>
                <td>${frappe.format(advance.advance_amount, {'fieldtype': 'Currency'})}</td>
                <td>${frappe.format(advance.paid_amount, {'fieldtype': 'Currency'})}</td>
                <td>${frappe.format(advance.claimed_amount, {'fieldtype': 'Currency'})}</td>
                                            <td>${frappe.format(advance.return_amount, {'fieldtype': 'Currency'})}</td>
                <td><strong>${frappe.format(advance.outstanding, {'fieldtype': 'Currency'})}</strong></td>
            </tr>
        `;
    });
    
    details_html += `
                </tbody>
            </table>
        </div>
    `;
    
    dialog.fields_dict.advance_details_html.$wrapper.html(details_html);
    dialog.show();
}

// Distribution functions removed - functionality simplified to reference-only





function create_employee_advances(frm, eligible_items) {
    // Filter out items that have zero or negative remaining amounts
    let pending_items = eligible_items.filter(item => {
        const remainingAmount = flt(item.remaining_amount || 0);
        return remainingAmount > 0;
    });
    
    if (pending_items.length === 0) {
        frappe.msgprint(__('No eligible items found for creating Employee Advances. All items have been fully allocated.'));
        return;
    }
    
    console.log("Pending items:", pending_items);
    
    // Show a dialog to select employees for the advances
    let dialog = new frappe.ui.Dialog({
        title: __('Create Employee Advances'),
        size: 'large', // Make dialog larger
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
        <style>
            .employee-advances-dialog .table-responsive {
                max-height: 60vh;
                overflow-y: auto;
            }
            .employee-advances-dialog .form-control {
                min-height: 32px;
            }
            .employee-advances-dialog .awesomplete {
                z-index: 9999 !important;
            }
            .employee-advances-dialog .frappe-control {
                margin-bottom: 8px;
            }
        </style>
        <div class="employee-advances-dialog">
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
        const entryId = `entry_${idx}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        
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
        
        // Create employee field with error handling
        try {
            const employeeField = frappe.ui.form.make_control({
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
                            },
                            query: "svg_mobile_app.svg_mobile_app.doctype.project_contractors.project_contractors.get_employees_for_advance"
                        };
                    }
                },
                render_input: true
            });
            
            // Ensure dropdown has proper z-index
            setTimeout(() => {
                const employeeField = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.employee-field-container-${entryId} .awesomplete`);
                if (employeeField.length) {
                    employeeField.css('z-index', '9999');
                }
            }, 100);
        } catch (error) {
            console.error('Failed to create employee field:', error);
            dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.employee-field-container-${entryId}`)
                .html(`<input type="text" class="form-control" placeholder="Select Employee" data-fieldtype="Link">`);
        }
        
        // Create amount field with error handling
        const maxAmount = flt(item.remaining_amount || item.claimed_amount || item.rate);
        try {
            frappe.ui.form.make_control({
                parent: dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.amount-field-container-${entryId}`),
                df: {
                    fieldtype: 'Currency',
                    fieldname: `amount_${entryId}`,
                    placeholder: 'Enter Amount',
                    default: maxAmount,
                    precision: 2,
                    reqd: true
                },
                render_input: true
            });
        } catch (error) {
            console.error('Failed to create amount field:', error);
            dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.amount-field-container-${entryId}`)
                .html(`<input type="number" class="form-control" placeholder="Enter Amount" value="${maxAmount}" step="0.01">`);
        }
        
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
    
    // Helper function to get field value consistently
    function getFieldValue(container, fieldType = 'text') {
        const input = container.find('input');
        if (!input.length) return fieldType === 'Currency' ? 0 : '';
        
        let value = input.val() || '';
        
        // For Link fields, try to get the actual selected value
        if (container.find('.link-field').length || input.attr('data-fieldtype') === 'Link') {
            // Check if there's a Frappe control attached
            const control = container.find('input').data('control');
            if (control && control.get_value) {
                value = control.get_value() || '';
            }
        }
        
        // Clean up the value - remove extra whitespace
        if (typeof value === 'string') {
            value = value.trim();
        }
        
        console.log(`getFieldValue: container=`, container, `fieldType=${fieldType}`, `rawValue="${input.val()}"`, `cleanedValue="${value}"`);
        
        return fieldType === 'Currency' ? flt(value) : value;
    }

    // Function to update the total allocated amount
    function updateTotalAllocated(idx) {
        const item = pending_items[idx];
        let totalAllocated = 0;
        
        employeeEntries[idx].forEach(entry => {
            const amountFieldContainer = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.amount-field-container-${entry.id}`);
            totalAllocated += getFieldValue(amountFieldContainer, 'Currency');
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
        const idx = parseInt(entryId.split('_')[1]);
        
        // Remove from DOM
        dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`tr[data-entry-id="${entryId}"]`).remove();
        
        // Remove from tracking by finding the entry with matching ID
        const entryIndex = employeeEntries[idx].findIndex(entry => entry.id === entryId);
        if (entryIndex !== -1) {
            employeeEntries[idx].splice(entryIndex, 1);
        }
        
        // Update the UI
        updateTotalAllocated(idx);
    });
    
    dialog.fields_dict.fees_and_deposits_html.$wrapper.on('change', '.purpose-input', function() {
        const entryId = $(this).data('entry-id');
        const idx = parseInt(entryId.split('_')[1]);
        const purpose = $(this).val();
        
        const entryIndex = employeeEntries[idx].findIndex(entry => entry.id === entryId);
        if (entryIndex !== -1) {
            employeeEntries[idx][entryIndex].purpose = purpose;
        }
    });
    
    // Automatically add one employee row for each item
    pending_items.forEach((_, idx) => {
        addEmployeeRow(idx);
    });
    
    dialog.show();
    
    // Ensure dialog is properly sized and positioned
    setTimeout(() => {
        // Set minimum height for dialog
        dialog.$wrapper.find('.modal-dialog').css({
            'max-width': '90vw',
            'width': '1000px'
        });
        
        dialog.$wrapper.find('.modal-content').css({
            'min-height': '500px',
            'max-height': '90vh'
        });
        
        dialog.$wrapper.find('.modal-body').css({
            'max-height': '70vh',
            'overflow-y': 'auto'
        });
        
        // Ensure dropdowns appear above dialog content
        dialog.$wrapper.find('.awesomplete').css('z-index', '9999');
    }, 200);
    
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
                const employeeFieldContainer = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.employee-field-container-${entry.id}`);
                const employee = getFieldValue(employeeFieldContainer);
                
                // Debug: Log the employee value being extracted
                console.log(`Entry ${entry.id}: Employee field container:`, employeeFieldContainer);
                console.log(`Entry ${entry.id}: Employee value extracted:`, employee);
                console.log(`Entry ${entry.id}: Employee value type:`, typeof employee);
                console.log(`Entry ${entry.id}: Employee value length:`, employee ? employee.length : 'null');
                
                // Get the amount using consistent helper
                const amountFieldContainer = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.amount-field-container-${entry.id}`);
                const amount = getFieldValue(amountFieldContainer, 'Currency');
                
                // Get the purpose
                const purposeField = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.purpose-input[data-entry-id="${entry.id}"]`);
                const purpose = purposeField.val() || `Advance for ${item.item}`;
                
                // Add to the total for this item
                totalForItem += amount;
                
                if (employee && amount > 0) {
                    const advanceData = {
                        employee: employee,
                        purpose: purpose,
                        advance_amount: amount,
                        item: item.item,
                        project_contractors: frm.doc.name,
                        invoice_reference: item.invoice_reference || null
                    };
                    
                    console.log(`Adding advance data:`, advanceData);
                    advances_to_create.push(advanceData);
                }
            });
            
            // Validate total amount for this item
            if (totalForItem > maxAmount) {
                validation_errors.push(`Total amount for ${item.item} (${format_currency(totalForItem)}) exceeds the available amount (${format_currency(maxAmount)}).`);
            }
        });
        
        // Additional validation
        advances_to_create.forEach(advance => {
            if (!advance.employee) {
                validation_errors.push(`Employee is required for advance of ${format_currency(advance.advance_amount)}`);
            }
            if (advance.advance_amount <= 0) {
                validation_errors.push(`Amount must be greater than 0 for employee ${advance.employee}`);
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
                console.log('Employee Advance Creation Response:', r);
                
                if (r.message && r.message.status === 'success' && r.message.advances) {
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
                    
                    dialog.hide();
                    frm.reload_doc();
                    
                    // Refresh the Employee Advances button to show updated remaining amounts
                    setTimeout(() => {
                        check_project_claims_for_advances(frm);
                    }, 1000);
                } else if (r.message && r.message.status === 'error') {
                    // Show the specific error message from the server
                    frappe.msgprint({
                        title: __('Error Creating Employee Advances'),
                        indicator: 'red',
                        message: r.message.message || __('Unknown error occurred.')
                    });
                    console.error('Employee Advance Creation Error:', r.message.message);
                } else {
                    // Fallback for unexpected response format
                    frappe.msgprint({
                        title: __('Error'),
                        indicator: 'red',
                        message: __('Unexpected response format. Check console for details.')
                    });
                    console.error('Unexpected response:', r);
                }
            },
            error: function(r) {
                console.error('Employee Advance Creation Network Error:', r);
                let errorMessage = __('Network error occurred while creating employee advances.');
                
                // Try to extract error message from response
                if (r.responseJSON && r.responseJSON.message) {
                    errorMessage = r.responseJSON.message;
                } else if (r.responseText) {
                    try {
                        const parsed = JSON.parse(r.responseText);
                        if (parsed.message) {
                            errorMessage = parsed.message;
                        }
                    } catch (e) {
                        // If parsing fails, use the raw response text (truncated)
                        errorMessage = r.responseText.substring(0, 500) + (r.responseText.length > 500 ? '...' : '');
                    }
                }
                
                frappe.msgprint({
                    title: __('Network Error'),
                    indicator: 'red',
                    message: errorMessage
                });
            }
        });
    }
}

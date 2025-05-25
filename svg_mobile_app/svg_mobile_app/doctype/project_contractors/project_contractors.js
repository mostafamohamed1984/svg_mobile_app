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
    },
    
    setup: function(frm) {
        setup_item_filter(frm);
    }
});

// Function to check if there are Project Claims for the fees and deposits items
function check_project_claims_for_advances(frm) {
    // Get all sales invoices created for this Project Contractors
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.doctype.project_contractors.project_contractors.check_project_claims_for_advances',
        args: {
            project_contractors: frm.doc.name
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

// Function to set up the item filter
function setup_item_filter(frm) {
    frm.fields_dict.items.grid.get_field('item').get_query = function() {
        // Use the standard ERPNext link filter format
        return {
            filters: [
                ['Item Default', 'company', '=', frappe.defaults.get_user_default('company')]
            ]
        };
    };
}

// Format link titles for Project Contractors fields
frappe.form.link_formatters['Project Contractors'] = function(value, doc) {
    if(doc && doc.project_name && doc.customer_name) {
        return value + '<br><span class="text-muted small">' + doc.project_name + ' - ' + doc.customer_name + '</span>';
    } else if(doc && doc.project_name) {
        return value + '<br><span class="text-muted small">' + doc.project_name + '</span>';
    }
    return value;
};

// Function to create Employee Advances from fees and deposits
function create_employee_advances(frm, eligible_items) {
    // Filter out items that already have Employee Advances created
    const pending_items = frm.doc.fees_and_deposits.filter(item => {
        // Check if this item is in the eligible_items list
        return !item.employee_advance_created && 
               eligible_items.includes(item.item);
    });
    
    if (pending_items.length === 0) {
        frappe.msgprint(__('No eligible fees and deposits items found for creating Employee Advances.'));
        return;
    }
    
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
                        <th>${__('Total Rate')}</th>
                        <th>${__('Project Claim')}</th>
                        <th>${__('Actions')}</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Add rows for each pending fee/deposit item
    pending_items.forEach((item, idx) => {
        fees_html += `
            <tr data-idx="${idx}">
                <td>${item.item}</td>
                <td>${frappe.format(item.rate, {fieldtype: 'Currency'})}</td>
                <td>${item.project_claim || ''}</td>
                <td>
                    <button class="btn btn-sm btn-primary add-employee" data-idx="${idx}">
                        ${__('Add Employee')}
                    </button>
                </td>
            </tr>
            <tr class="employee-entries-row" data-idx="${idx}">
                <td colspan="4" class="p-0">
                    <div class="employee-entries" data-idx="${idx}">
                        <table class="table table-bordered mb-0">
                            <thead>
                                <tr>
                                    <th>${__('Employee')}</th>
                                    <th>${__('Amount')}</th>
                                    <th>${__('Purpose')}</th>
                                    <th>${__('Actions')}</th>
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
        frappe.ui.form.make_control({
            parent: dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.amount-field-container-${entryId}`),
            df: {
                fieldtype: 'Currency',
                options: 'currency',
                fieldname: `amount_${entryId}`,
                placeholder: 'Amount',
                reqd: true,
                default: 0,
                change: function() {
                    updateTotalAllocated(idx);
                }
            },
            render_input: true
        });
        
        // Add to tracking
        employeeEntries[idx].push({
            id: entryId,
            employee: null,
            amount: 0,
            purpose: `Advance for ${item.item}`
        });
        
        // Update the UI
        updateTotalAllocated(idx);
    }
    
    // Helper function to update total allocated amount
    function updateTotalAllocated(idx) {
        const item = pending_items[idx];
        let totalAllocated = 0;
        
        // Sum up all amounts for this item
        employeeEntries[idx].forEach(entry => {
            const amountField = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.amount-field-container-${entry.id} input`);
            const amount = parseFloat(amountField.val()) || 0;
            entry.amount = amount;
            totalAllocated += amount;
        });
        
        // Update the total display
        const totalElement = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.total-allocated[data-idx="${idx}"]`);
        totalElement.text(frappe.format(totalAllocated, {fieldtype: 'Currency'}));
        
        // Update progress bar
        const percentage = item.rate > 0 ? Math.min(100, (totalAllocated / item.rate) * 100) : 0;
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
        
        pending_items.forEach((item, idx) => {
            employeeEntries[idx].forEach(entry => {
                const employeeField = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.employee-field-container-${entry.id} input`);
                const amountField = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.amount-field-container-${entry.id} input`);
                const purposeField = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.purpose-input[data-entry-id="${entry.id}"]`);
                
                const employee = employeeField.val();
                const amount = parseFloat(amountField.val()) || 0;
                const purpose = purposeField.val() || `Advance for ${item.item}`;
                
                if (employee && amount > 0) {
                    advances_to_create.push({
                        employee: employee,
                        purpose: purpose,
                        advance_amount: amount,
                        item: item.item,
                        project_contractors: frm.doc.name,
                        project_claim: item.project_claim || null
                    });
                }
            });
        });
        
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

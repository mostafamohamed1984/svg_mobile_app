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
            },
            {
                fieldname: 'employee_section',
                fieldtype: 'Section Break',
                label: __('Select Employees')
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
                        <th>${__('Select')}</th>
                        <th>${__('Item')}</th>
                        <th>${__('Rate')}</th>
                        <th>${__('Project Claim')}</th>
                        <th>${__('Employee')}</th>
                        <th>${__('Purpose')}</th>
                    </tr>
                </thead>
                <tbody>
    `;

    // Create a map to store the original index of each item
    const indexMap = new Map();
    
    // Add rows for each pending fee/deposit item
    pending_items.forEach((item, idx) => {
        // Find the original index in the fees_and_deposits table
        const originalIdx = frm.doc.fees_and_deposits.findIndex(i => i === item);
        indexMap.set(idx, originalIdx);
        
        fees_html += `
            <tr>
                <td>
                    <input type="checkbox" class="fee-checkbox" data-idx="${idx}" checked>
                </td>
                <td>${item.item}</td>
                <td>${frappe.format(item.rate, {fieldtype: 'Currency'})}</td>
                <td>${item.project_claim || ''}</td>
                <td>
                    <div class="employee-field" data-idx="${idx}"></div>
                </td>
                <td>
                    <input type="text" class="form-control purpose-input" data-idx="${idx}" 
                           placeholder="Purpose" value="Advance for ${item.item}">
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
    
    // Add employee select fields
    pending_items.forEach((item, idx) => {
        frappe.ui.form.make_control({
            parent: dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.employee-field[data-idx="${idx}"]`),
            df: {
                fieldtype: 'Link',
                options: 'Employee',
                fieldname: `employee_${idx}`,
                placeholder: 'Select Employee',
                reqd: true,
                get_query: function() {
                    return {
                        filters: {
                            'status': 'Active'
                        }
                    };
                },
                change: function() {
                    // Optional: Handle employee selection changes
                }
            },
            render_input: true
        });
    });

    dialog.show();
}

// Function to create the advances from dialog values
function create_advances_from_dialog(frm, dialog, values, pending_items) {
    // Create a map to store the original index of each item
    const indexMap = new Map();
    pending_items.forEach((item, idx) => {
        const originalIdx = frm.doc.fees_and_deposits.findIndex(i => i === item);
        indexMap.set(idx, originalIdx);
    });
    
    // Collect data from the dialog
    let advances_to_create = [];
    
    pending_items.forEach((item, idx) => {
        // Check if this item is selected
        const checkbox = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.fee-checkbox[data-idx="${idx}"]`);
        if (checkbox.prop('checked')) {
            // Get the employee field
            const employee_field = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.employee-field[data-idx="${idx}"]`).find('input');
            const employee = employee_field.val();
            
            // Get the purpose field
            const purpose_field = dialog.fields_dict.fees_and_deposits_html.$wrapper.find(`.purpose-input[data-idx="${idx}"]`);
            const purpose = purpose_field.val();
            
            if (employee) {
                advances_to_create.push({
                    employee: employee,
                    purpose: purpose || `Advance for ${item.item}`,
                    advance_amount: item.rate,
                    item: item.item,
                    project_contractors: frm.doc.name,
                    project_claim: item.project_claim || null
                });
            }
        }
    });
    
    if (advances_to_create.length === 0) {
        frappe.msgprint(__('No valid advances to create. Please select employees for the advances.'));
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

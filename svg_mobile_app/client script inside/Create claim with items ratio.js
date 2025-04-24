frappe.ui.form.on('Sales Invoice', {
    refresh: function(frm) {
        if (frm.doc.docstatus === 1) {
            frm.add_custom_button(__('Create Project Claim'), function() {
                create_project_claim(frm);
            }).addClass('btn-primary');
        }
    }
});

function create_project_claim(frm) {
    // First, get the latest outstanding amount from the server
    frappe.call({
        method: 'frappe.client.get_value',
        args: {
            doctype: 'Sales Invoice',
            filters: { name: frm.doc.name },
            fieldname: ['outstanding_amount', 'grand_total']
        },
        callback: function(data) {
            if (data.message) {
                const current_invoice = data.message;
                const current_outstanding = flt(current_invoice.outstanding_amount);
                const grand_total = flt(current_invoice.grand_total);
                const paid_amount = grand_total - current_outstanding;
                
                // Now create the Project Claim with the latest data
                create_claim_with_fresh_data(frm, current_outstanding, paid_amount);
            } else {
                // Fallback to using the form data if server call fails
                create_claim_with_fresh_data(
                    frm, 
                    flt(frm.doc.outstanding_amount),
                    flt(frm.doc.grand_total) - flt(frm.doc.outstanding_amount)
                );
            }
        }
    });
}

function create_claim_with_fresh_data(frm, outstanding_amount, paid_amount) {
    // Use the standard ERPNext document creation flow for better context tracking
    frappe.new_doc('Project Claim', {
        'customer': frm.doc.customer,
        'for_project': frm.doc.custom_for_project,
        'party_account': frm.doc.debit_to,
        'reference_invoice': frm.doc.name,
        'customer_name': frm.doc.customer_name,
        'project_name': frm.doc.project_name || '',
        'outstanding_amount': outstanding_amount,
        'paid_amount': paid_amount
    }).then(function() {
        // After the form is loaded, add the claim items
        const items_total = frm.doc.items.reduce((sum, item) => sum + flt(item.amount), 0);
        
        // Prepare and add claim items
        frm.doc.items.forEach(item => {
            const item_amount = flt(item.amount) || 0;
            const ratio = items_total ? (item_amount / items_total) * 100 : 0;
            
            cur_frm.add_child('claim_items', {
                'item': item.item_code,
                'amount': 0,
                'ratio': 0,
                'unearned_account': item.income_account,
                'revenue_account': item.custom_default_earning_account
            });
        });
        
        // Get tax rate
        if (frm.doc.taxes && frm.doc.taxes.length > 0) {
            cur_frm.set_value('tax_ratio', frm.doc.taxes[0].rate || 0);
        }
        
        // Refresh all fields to ensure they're displayed correctly
        cur_frm.refresh_field('paid_amount');
        cur_frm.refresh_field('outstanding_amount');
        cur_frm.refresh_field('claim_items');
        
        // Make sure the reference_invoice is set correctly before updating balance
        setTimeout(() => {
            // Call the server method to update balances only if reference_invoice is set
            if (cur_frm.doc.reference_invoice) {
                cur_frm.call({
                    method: "update_claim_items_balance",
                    doc: cur_frm.doc,
                    callback: function(r) {
                        cur_frm.refresh_field('claim_items');
                        
                        // Add a delay and refresh again to ensure all values are displayed
                        setTimeout(() => {
                            cur_frm.refresh();
                            frappe.show_alert({
                                message: __('Project Claim created successfully'),
                                indicator: 'green'
                            }, 3);
                        }, 500);
                    }
                });
            } else {
                // Just show success message if reference_invoice is not yet set
                cur_frm.refresh();
                frappe.show_alert({
                    message: __('Project Claim created successfully'),
                    indicator: 'green'
                }, 3);
            }
        }, 500); // Short delay to ensure form is properly rendered
    });
}
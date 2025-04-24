frappe.ui.form.on('Project Claim', {
    refresh: function(frm) {
        if (frm.doc.docstatus === 1 && frm.doc.status === 'Unreconciled') {
            frm.add_custom_button(__('Make Journal Entry'), function() {
                create_journal_entry(frm);
            }).addClass('btn-primary');
        }
    }
});

function create_journal_entry(frm) {
    // Validate required fields
    if (!frm.doc.party_account || !frm.doc.receiving_account) {
        frappe.throw(__('Please set Party Account and Receiving Account first'));
        return;
    }

    if (!frm.doc.claim_items || frm.doc.claim_items.length === 0) {
        frappe.throw(__('Please add items to the Claim Items table first'));
        return;
    }

    make_journal_entry(frm);
}

function make_journal_entry(frm) {
    // Calculate amounts
    const today = frappe.datetime.get_today();
    const default_company = frappe.defaults.get_user_default('company') || frm.doc.company;
    const claim_amount = flt(frm.doc.claim_amount);
    const tax_amount = flt(frm.doc.tax_amount || 0);

    // Prepare accounts array
    const accounts = [
        // 1. Credit customer account (full claim amount)
        {
            'account': frm.doc.party_account,
            'party_type': 'Customer',
            'party': frm.doc.customer,
            'credit_in_account_currency': claim_amount,
            'reference_type': 'Sales Invoice',
            'reference_name': frm.doc.reference_invoice,
            'cost_center': frm.doc.cost_center || undefined
        },
        // 2. Debit receiving account (full claim amount minus tax)
        {
            'account': frm.doc.receiving_account,
            'debit_in_account_currency': claim_amount - tax_amount,
            'cost_center': frm.doc.cost_center || undefined
        }
    ];

    // Add entries for each claim item
    frm.doc.claim_items.forEach(item => {
        const item_ratio = flt(item.ratio) / 100;
        const item_amount = claim_amount * item_ratio;

        // Debit unearned account
        accounts.push({
            'account': item.unearned_account,
            'debit_in_account_currency': item_amount,
            'cost_center': frm.doc.cost_center || undefined
        });

        // Credit revenue account
        accounts.push({
            'account': item.revenue_account,
            'credit_in_account_currency': item_amount,
            'cost_center': frm.doc.cost_center || undefined
        });
    });

    // Add tax row if applicable
    if (tax_amount > 0 && frm.doc.tax_account) {
        accounts.push({
            'account': frm.doc.tax_account,
            'debit_in_account_currency': tax_amount,
            'cost_center': frm.doc.cost_center || undefined
        });
    }

    // Verify the totals balance
    const total_debit = accounts.reduce((sum, account) => sum + (account.debit_in_account_currency || 0), 0);
    const total_credit = accounts.reduce((sum, account) => sum + (account.credit_in_account_currency || 0), 0);

    if (Math.abs(total_debit - total_credit) > 0.01) {
        frappe.throw(__('Journal Entry is not balanced. Debit: {0}, Credit: {1}', [total_debit, total_credit]));
        return;
    }

    // Create the journal entry
    frappe.call({
        method: 'frappe.client.insert',
        args: {
            doc: {
                doctype: 'Journal Entry',
                voucher_type: 'Journal Entry',
                posting_date: today,
                company: default_company,
                accounts: accounts,
                multi_currency: 0,
                user_remark: `for Project Claim ${frm.doc.name} Being ${frm.doc.being}`,
                total_debit: total_debit,
                total_credit: total_credit,
                docstatus: 1
            }
        },
        callback: function(response) {
            if (response.message) {
                const je = response.message.name;
                
                // Update the Project Claim status to "Reconciled"
                frappe.call({
                    method: 'frappe.client.set_value',
                    args: {
                        doctype: 'Project Claim',
                        name: frm.doc.name,
                        fieldname: 'status',
                        value: 'Reconciled'
                    },
                    callback: function() {
                        // Refresh the form to show the updated status
                        frm.reload_doc();
                        
                        // Open the fully populated form
                        frappe.set_route('Form', 'Journal Entry', je);
                        frappe.show_alert(__('Journal Entry created and Project Claim marked as Reconciled'));
                    },
                    error: function(err) {
                        frappe.msgprint(__('Error updating Project Claim status'));
                    }
                });
            }
        },
        error: function(err) {
            let error_msg = __('Error creating Journal Entry');
            if (err.responseJSON && err.responseJSON.exc_type) {
                error_msg += ': ' + err.responseJSON.exc_type;
            }
            frappe.msgprint(error_msg);
        }
    });
}
frappe.ui.form.on('Project Claim', {
    setup: function(frm) {
        // Filter Mode of Payment based on company linked to user
        frm.set_query("mode_of_payment", function() {
            return {
                filters: {
                    company: frappe.defaults.get_user_default('company')
                }
            };
        });
    },
    
    mode_of_payment: function(frm) {
        if (frm.doc.mode_of_payment) {
            // Fetch the Mode of Payment's accounts table
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Mode of Payment',
                    name: frm.doc.mode_of_payment
                },
                callback: function(r) {
                    if (r.message && r.message.accounts && r.message.accounts.length > 0) {
                        // Since there's only one row, get the first account
                        const default_account = r.message.accounts[0].default_account;
                        if (default_account) {
                            frm.set_value('receiving_account', default_account);
                        }
                    }
                }
            });
            
            // Clear fields based on mode of payment change
            if (frm.doc.mode_of_payment !== 'Bank Transfer Orbit (AED)') {
                frm.set_value('reference_number', '');
            }
            
            if (frm.doc.mode_of_payment !== 'Cheque') {
                frm.set_value('due_date', '');
                frm.set_value('cheque_number', '');
                frm.set_value('bank_name', '');
            }
            
            if (frm.doc.mode_of_payment !== 'Visa') {
                frm.set_value('visa_number', '');
            }
        }
    },
    
    visa_number: function(frm) {
        if (frm.doc.visa_number) {
            // Validate Visa number - must be exactly 14 digits
            const visaNumber = frm.doc.visa_number.toString().trim();
            if (!/^\d{14}$/.test(visaNumber)) {
                frappe.msgprint(__('Visa Number must be exactly 14 digits'));
                frm.set_value('visa_number', '');
            }
        }
    },

    claim_amount: function(frm) {
        if (frm.doc.claim_amount && frm.doc.outstanding_amount) {
            if (flt(frm.doc.claim_amount) > flt(frm.doc.outstanding_amount)) {
                frappe.msgprint(__('Claim Amount cannot be greater than Outstanding Amount'));
                frm.set_value('claim_amount', '');
                return;
            }
            
            // Calculate tax amount (tax_ratio is percentage)
            if (frm.doc.tax_ratio) {
                const tax_amount = flt(frm.doc.claim_amount) * flt(frm.doc.tax_ratio) / 100;
                frm.set_value('tax_amount', tax_amount);
            }
            
            // Update amounts in claim items based on current ratios
            if (frm.doc.claim_items && frm.doc.claim_items.length > 0) {
                refresh_claim_items(frm);
            }
        }
    },

    tax_ratio: function(frm) {
        if (frm.doc.claim_amount && frm.doc.tax_ratio) {
            const tax_amount = flt(frm.doc.claim_amount) * flt(frm.doc.tax_ratio) / 100;
            frm.set_value('tax_amount', tax_amount);
        }
    },
    
    validate: function(frm) {
        validate_claim_totals(frm);
    }
});

// Handle bidirectional calculation in the claim items child table
frappe.ui.form.on('Claim Items', {
    amount: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (frm.doc.claim_amount && row.amount) {
            // Calculate ratio based on amount
            let ratio = (flt(row.amount) / flt(frm.doc.claim_amount)) * 100;
            
            // Check if amount exceeds current balance
            if (row.current_balance && flt(row.amount) > flt(row.current_balance)) {
                frappe.msgprint(__(`Amount for ${row.item} cannot exceed current balance of ${row.current_balance}`));
                frappe.model.set_value(cdt, cdn, 'amount', row.current_balance);
                ratio = (flt(row.current_balance) / flt(frm.doc.claim_amount)) * 100;
            }
            
            frappe.model.set_value(cdt, cdn, 'ratio', ratio);
            validate_claim_totals(frm);
        }
    },
    
    ratio: function(frm, cdt, cdn) {
        const row = locals[cdt][cdn];
        if (frm.doc.claim_amount && row.ratio) {
            // Calculate amount based on ratio
            let amount = flt(frm.doc.claim_amount) * flt(row.ratio) / 100;
            
            // Check if calculated amount exceeds current balance
            if (row.current_balance && amount > flt(row.current_balance)) {
                frappe.msgprint(__(`Calculated amount for ${row.item} exceeds current balance of ${row.current_balance}`));
                amount = flt(row.current_balance);
                let ratio = (amount / flt(frm.doc.claim_amount)) * 100;
                frappe.model.set_value(cdt, cdn, 'ratio', ratio);
            }
            
            frappe.model.set_value(cdt, cdn, 'amount', amount);
            validate_claim_totals(frm);
        }
    }
});

// Helper function to validate claim totals
function validate_claim_totals(frm) {
    if (!frm.doc.claim_items || !frm.doc.claim_amount) return;
    
    let total_amount = 0;
    let total_ratio = 0;
    
    frm.doc.claim_items.forEach(item => {
        total_amount += flt(item.amount);
        total_ratio += flt(item.ratio);
    });
    
    // Check if total amount exceeds claim amount
    if (total_amount > flt(frm.doc.claim_amount)) {
        frappe.msgprint(__(`Total allocated amount (${total_amount}) exceeds claim amount (${frm.doc.claim_amount})`));
    }
    
    // Check if total ratio exceeds 100%
    if (total_ratio > 100) {
        frappe.msgprint(__(`Total ratio (${total_ratio.toFixed(2)}%) exceeds 100%`));
    }
}

// Helper function to refresh claim items based on claim amount
function refresh_claim_items(frm) {
    frm.doc.claim_items.forEach((item, idx) => {
        if (item.ratio) {
            // Recalculate amount based on the new claim amount
            const amount = flt(frm.doc.claim_amount) * flt(item.ratio) / 100;
            frappe.model.set_value('Claim Items', item.name, 'amount', amount);
        }
    });
}
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
    // Calculate amounts
    const grand_total = flt(frm.doc.grand_total) || 0;
    const outstanding_amount = flt(frm.doc.outstanding_amount) || 0;
    const paid_amount = grand_total - outstanding_amount;
    
    // Get tax rate
    let tax_rate = 0;
    if (frm.doc.taxes && frm.doc.taxes.length > 0) {
        tax_rate = flt(frm.doc.taxes[0].rate) || 0;
    }
    
    // Calculate total of all items for ratio calculation
    const items_total = frm.doc.items.reduce((sum, item) => sum + flt(item.amount), 0);
    
    // Create new doc with basic fields first
    frappe.model.with_doctype('Project Claim', function() {
        const project_claim = frappe.model.get_new_doc('Project Claim');
        
        // Set basic fields
        frappe.model.set_value(project_claim.doctype, project_claim.name, {
            'customer': frm.doc.customer,
            'for_project': frm.doc.custom_for_project,
            'party_account': frm.doc.debit_to,
            'reference_invoice': frm.doc.name,
            'tax_ratio': tax_rate,
            'outstanding_amount': outstanding_amount,
            'paid_amount': paid_amount
        }).then(() => {
            // Prepare claim items
            const claim_items = frm.doc.items.map(item => {
                const item_amount = flt(item.amount) || 0;
                const ratio = items_total ? (item_amount / items_total) * 100 : 0;
                
                return {
                    'item': item.item_code,
                    'amount': item_amount,
                    'ratio': ratio,
                    'unearned_account': item.income_account,
                    'revenue_account': item.custom_default_earning_account
                };
            });
            
            // Set claim items
            return frappe.model.set_value(project_claim.doctype, project_claim.name, {
                'claim_items': claim_items
            });
        }).then(() => {
            // Open the form
            frappe.set_route('Form', 'Project Claim', project_claim.name);
            frappe.msgprint(__('Project Claim created from Sales Invoice'));
        }).catch((err) => {
            frappe.msgprint(__('Error creating Project Claim: {0}', [err.message]));
        });
    });
}
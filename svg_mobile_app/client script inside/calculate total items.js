frappe.ui.form.on('Project Contractors', {
    validate: function(frm) {
        // Calculate all totals automatically before saving
        calculate_totals(frm);
    },
    items_add: function(frm, cdt, cdn) {
        calculate_totals(frm);
    },
    items_remove: function(frm, cdt, cdn) {
        calculate_totals(frm);
    },
    items_rate: function(frm, cdt, cdn) {
        calculate_totals(frm);
    },
    fees_and_deposits_add: function(frm, cdt, cdn) {
        calculate_totals(frm);
    },
    fees_and_deposits_remove: function(frm, cdt, cdn) {
        calculate_totals(frm);
    },
    fees_and_deposits_rate: function(frm, cdt, cdn) {
        calculate_totals(frm);
    }
});

function calculate_totals(frm) {
    let items_total = 0;
    let fees_total = 0;
    
    // Calculate total for project items
    if (frm.doc.items) {
        frm.doc.items.forEach(function(item) {
            if (item.rate) {
                items_total += flt(item.rate);
            }
        });
    }
    
    // Calculate total for fees and deposits
    if (frm.doc.fees_and_deposits) {
        frm.doc.fees_and_deposits.forEach(function(fee) {
            if (fee.rate) {
                fees_total += flt(fee.rate);
            }
        });
    }
    
    // Set the calculated totals using the correct field names that exist in the doctype
    frm.set_value('total_amount', items_total);
    frm.set_value('total_fees', fees_total);
    frm.set_value('total_project_amount', items_total + fees_total);
}
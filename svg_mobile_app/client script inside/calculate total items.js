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
    items_custom_rate: function(frm, cdt, cdn) {
        calculate_totals(frm);
    },
    fees_and_deposits_add: function(frm, cdt, cdn) {
        calculate_totals(frm);
    },
    fees_and_deposits_remove: function(frm, cdt, cdn) {
        calculate_totals(frm);
    },
    fees_and_deposits_custom_rate: function(frm, cdt, cdn) {
        calculate_totals(frm);
    }
});

function calculate_totals(frm) {
    // Calculate total from items table
    let items_total = 0;
    $.each(frm.doc.items || [], function(i, item) {
        items_total += flt(item.rate);
    });
    frm.set_value('total_amount', items_total);
    
    // Calculate total from fees_and_deposits table
    let fees_total = 0;
    $.each(frm.doc.fees_and_deposits || [], function(i, fee) {
        fees_total += flt(fee.rate);
    });
    frm.set_value('total_fees', fees_total);
    
    // Calculate grand total
    let grand_total = items_total + fees_total;
    frm.set_value('total_project_amount', grand_total);
}
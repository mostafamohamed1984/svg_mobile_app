// frappe.ui.form.on('Project Contractors', {
//     project_amount: function(frm) {
//         calculate_profit_value(frm);
//         calculate_profit_ratio(frm);
//     },
//     profit_ratio: function(frm) {
//         calculate_profit_value(frm);
//     },
//     profit_value: function(frm) {
//         calculate_profit_ratio(frm);
//     }
// });

// function calculate_profit_value(frm) {
//     if (frm.doc.project_amount && frm.doc.profit_ratio) {
//         frm.set_value('profit_value', (frm.doc.project_amount * frm.doc.profit_ratio) / 100);
//     }
// }

// function calculate_profit_ratio(frm) {
//     if (frm.doc.project_amount && frm.doc.profit_value) {
//         frm.set_value('profit_ratio', (frm.doc.profit_value / frm.doc.project_amount) * 100);
//     }
// }


frappe.ui.form.on('Project Contractors', {
    add_tender_fees: function(frm) {
        add_tender_fees_item(frm);
    },
    project_amount: function(frm) {
        calculate_profit_value(frm);
        calculate_profit_ratio(frm);
    },
    profit_ratio: function(frm) {
        calculate_profit_value(frm);
    },
    profit_value: function(frm) {
        calculate_profit_ratio(frm);
    }
});

function calculate_profit_value(frm) {
    if (frm.doc.project_amount && frm.doc.profit_ratio) {
        frm.set_value('profit_value', (frm.doc.project_amount * frm.doc.profit_ratio) / 100);
    }
}

function calculate_profit_ratio(frm) {
    if (frm.doc.project_amount && frm.doc.profit_value) {
        frm.set_value('profit_ratio', (frm.doc.profit_value / frm.doc.project_amount) * 100);
    }
}

function add_tender_fees_item(frm) {
    if (!frm.doc.profit_value || frm.doc.profit_value <= 0) {
        frappe.msgprint(__("Please set a valid profit value first"));
        return;
    }

    // Check if item already exists in the table
    const item_exists = frm.doc.items?.some(item => item.item === "اتعاب مناقصة");
    
    if (item_exists) {
        frappe.msgprint(__("Tender fees item already exists in the table"));
        return;
    }

    // Add new item to the table
    frm.add_child("items", {
        item: "اتعاب مناقصة",
        rate: frm.doc.profit_value
    });
    
    frm.refresh_field("items");
    frappe.msgprint(__("Tender fees item added successfully"));
}
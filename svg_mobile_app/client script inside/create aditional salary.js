frappe.ui.form.on('Overtime Request', {


    on_submit: function(frm) {
        // Create 'Additional Salary' only if status is 'Approved'
        if (frm.doc.status === 'Approved') {
            frappe.call({
                method: 'frappe.client.insert',
                args: {
                    doc: {
                        doctype: 'Additional Salary',
                        employee: frm.doc.employee,
                        payroll_date: frm.doc.day_of_overtime,
                        salary_component: 'Overtime Hours',
                        amount: frm.doc.duration,
                        company: frm.doc.company ,
                        docstatus: 1
                    }
                },
                callback: function(response) {
                    if (response.message) {
                        frappe.msgprint(__('Additional Salary created successfully.'));
                    }
                },
                error: function() {
                    frappe.throw(__('Failed to create Additional Salary.'));
                }
            });
        }
    }
});

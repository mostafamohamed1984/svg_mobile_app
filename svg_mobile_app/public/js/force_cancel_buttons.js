// Add Force Cancel buttons to Project Claim and Project Contractors forms

frappe.ui.form.on('Project Claim', {
    refresh: function(frm) {
        // Only show the button if the document is submitted and not cancelled
        if(frm.doc.docstatus === 1) {
            frm.add_custom_button(__('Force Cancel'), function() {
                frappe.confirm(
                    __('Are you sure you want to force cancel this document? This will ignore linked documents.'),
                    function() {
                        frappe.call({
                            method: 'svg_mobile_app.server_scripts.force_cancel_document.force_cancel_document',
                            args: {
                                doctype: frm.doctype,
                                name: frm.docname
                            },
                            callback: function(r) {
                                if(r.message && r.message.success) {
                                    frappe.show_alert({
                                        message: r.message.message,
                                        indicator: 'green'
                                    });
                                    frm.reload_doc();
                                } else {
                                    frappe.msgprint({
                                        title: __('Error'),
                                        indicator: 'red',
                                        message: r.message ? r.message.message : __('Something went wrong')
                                    });
                                }
                            }
                        });
                    }
                );
            }, __('Actions'));
        }
    }
});

frappe.ui.form.on('Project Contractors', {
    refresh: function(frm) {
        // Only show the button if the document is submitted and not cancelled
        if(frm.doc.docstatus === 1) {
            frm.add_custom_button(__('Force Cancel'), function() {
                frappe.confirm(
                    __('Are you sure you want to force cancel this document? This will ignore linked documents.'),
                    function() {
                        frappe.call({
                            method: 'svg_mobile_app.server_scripts.force_cancel_document.force_cancel_document',
                            args: {
                                doctype: frm.doctype,
                                name: frm.docname
                            },
                            callback: function(r) {
                                if(r.message && r.message.success) {
                                    frappe.show_alert({
                                        message: r.message.message,
                                        indicator: 'green'
                                    });
                                    frm.reload_doc();
                                } else {
                                    frappe.msgprint({
                                        title: __('Error'),
                                        indicator: 'red',
                                        message: r.message ? r.message.message : __('Something went wrong')
                                    });
                                }
                            }
                        });
                    }
                );
            }, __('Actions'));
        }
    }
}); 
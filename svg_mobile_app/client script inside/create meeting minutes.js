frappe.ui.form.on('Meeting', {
    refresh: function (frm) {
        if (frm.doc.docstatus === 1) { // Show button only after submission
            frm.add_custom_button(__('Create Meeting Minutes'), function () {
                frappe.call({
                    method: "frappe.client.insert",
                    args: {
                        doc: {
                            doctype: "Meeting Minutes",
                            meeting_refrance: frm.doc.name,
                            agenda: frm.doc.agenda,
                            participants: frm.doc.participants,
                            external_participants: frm.doc.external_participants
                        }
                    },
                    callback: function (r) {
                        if (r.message) {
                            frappe.msgprint(__('Meeting Minutes created successfully'));
                            frappe.set_route("Form", "Meeting Minutes", r.message.name);
                        }
                    }
                });
            }, __("Actions"));
        }
    }
});

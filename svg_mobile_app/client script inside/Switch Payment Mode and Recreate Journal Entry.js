frappe.ui.form.on('Project Claim', {
    refresh: function(frm) {
        // Only show the switch button if the claim is submitted and reconciled
        if (frm.doc.docstatus === 1 && frm.doc.status === 'Reconciled') {
            // Determine the target mode based on current mode
            const current_mode = frm.doc.mode_of_payment;
            let target_mode = "";
            let button_label = "";
            
            if (current_mode === "Bank Transfer Orbit (AED)") {
                target_mode = "Orbit Cash Payment (AED)";
                button_label = "Switch to Cash Payment";
            } else if (current_mode === "Orbit Cash Payment (AED)") {
                target_mode = "Bank Transfer Orbit (AED)";
                button_label = "Switch to Bank Transfer";
            }
            
            // Only add button if we have a valid target mode
            if (target_mode) {
                frm.add_custom_button(__(button_label), function() {
                    switch_payment_mode(frm, target_mode);
                }).addClass('btn-warning');
            }
        }
        
        // Ensure mode_of_payment is read-only when status is Unreconciled
        // This happens after we've switched payment modes but haven't created the new journal entry yet
        if (frm.doc.docstatus === 1 && frm.doc.status === 'Unreconciled') {
            frm.set_df_property('mode_of_payment', 'read_only', 1);
        }
    }
});

function switch_payment_mode(frm, target_mode) {
    frappe.confirm(
        `This will cancel the existing Journal Entry and create a new one with payment mode "${target_mode}". Continue?`,
        function() {
            // User confirmed, proceed with the switch
            frappe.call({
                method: "frappe.client.get_value",
                args: {
                    doctype: "Journal Entry",
                    filters: {
                        "user_remark": ["like", `%for Project Claim ${frm.doc.name}%`],
                        "docstatus": 1
                    },
                    fieldname: ["name", "docstatus"]
                },
                callback: function(response) {
                    if (response.message && response.message.name) {
                        const journal_entry = response.message.name;
                        
                        // Show a message to indicate we're working on it
                        frappe.show_alert({
                            message: __("Processing payment mode switch..."),
                            indicator: 'blue'
                        });
                        
                        // Cancel the journal entry using server-side method
                        frappe.call({
                            method: "frappe.client.cancel",
                            args: {
                                doctype: "Journal Entry",
                                name: journal_entry
                            },
                            callback: function(r) {
                                if (r.exc) {
                                    frappe.msgprint(__("Error cancelling Journal Entry: ") + r.exc);
                                    return;
                                }
                                
                                // Update the payment mode of Project Claim
                                update_project_claim_and_create_journal_entry(frm, target_mode, journal_entry);
                            }
                        });
                    } else {
                        frappe.msgprint(__("No Journal Entry found for this Project Claim."));
                    }
                }
            });
        },
        function() {
            // User cancelled, do nothing
        }
    );
}

function update_project_claim_and_create_journal_entry(frm, target_mode, old_journal_entry) {
    // Update the payment mode on the Project Claim
    frappe.call({
        method: "frappe.client.set_value",
        args: {
            doctype: "Project Claim",
            name: frm.doc.name,
            fieldname: {
                "mode_of_payment": target_mode
            }
        },
        callback: function(response) {
            if (response.exc) {
                frappe.msgprint(__("Error updating Project Claim: ") + response.exc);
                return;
            }
            
            // Now create a new journal entry automatically
            frappe.call({
                method: "svg_mobile_app.svg_mobile_app.doctype.project_claim.project_claim.create_journal_entry_from_claim",
                args: {
                    claim_name: frm.doc.name
                },
                callback: function(r) {
                    if (r.exc) {
                        frappe.msgprint(__("Error creating new Journal Entry: ") + r.exc);
                        return;
                    }
                    
                    if (r.message) {
                        // Reload the document to show updated values
                        frm.reload_doc();
                        
                        frappe.show_alert({
                            message: __(`Payment mode switched to ${target_mode} and new Journal Entry ${r.message} created successfully.`),
                            indicator: 'green'
                        });
                    }
                }
            });
        }
    });
} 
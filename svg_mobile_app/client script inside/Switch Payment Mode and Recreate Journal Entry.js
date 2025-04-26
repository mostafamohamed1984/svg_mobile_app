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
                                
                                // Update the payment mode and status of Project Claim
                                update_project_claim(frm, target_mode);
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

function update_project_claim(frm, target_mode) {
    // Update the payment mode on the Project Claim
    frappe.call({
        method: "frappe.client.set_value",
        args: {
            doctype: "Project Claim",
            name: frm.doc.name,
            fieldname: {
                "mode_of_payment": target_mode,
                "status": "Unreconciled"  // Reset status to allow creation of new journal entry
            }
        },
        callback: function(response) {
            if (response.exc) {
                frappe.msgprint(__("Error updating Project Claim: ") + response.exc);
                return;
            }
            
            // Reload the document to show updated values
            frm.reload_doc();
            
            // Make sure mode_of_payment is read-only
            setTimeout(function() {
                frm.set_df_property('mode_of_payment', 'read_only', 1);
                frm.refresh_field('mode_of_payment');
                
                frappe.show_alert({
                    message: __(`Payment mode switched to ${target_mode} and is now read-only. Please click "Make Journal Entry" to create a new entry.`),
                    indicator: 'green'
                });
            }, 1000);
        }
    });
} 
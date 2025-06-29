// Client Script for Remote Access Log DocType
frappe.ui.form.on('Remote Access Log', {
    refresh: function(frm) {
        // Add custom button to view related Remote Access document
        if (frm.doc.reference) {
            frm.add_custom_button(__('View Remote Access'), function() {
                frappe.set_route('Form', 'Remote Access', frm.doc.reference);
            }, __('Actions'));
        }
        
        // Add "Apply Password" button if password hasn't been applied yet
        if (frm.doc.reference && frm.doc.new_password && !frm.doc.password_applied) {
            frm.add_custom_button(__('Apply Password'), function() {
                // Show confirmation dialog
                frappe.confirm(
                    __('Are you sure you want to apply this password to the Remote Access record? This action cannot be undone and can only be done once.'),
                    function() {
                        apply_password_direct(frm);
                    }
                );
            }, __('Actions'));
            
            // Style the button to make it prominent
            setTimeout(function() {
                frm.page.btn_secondary.find('.btn:contains("Apply Password")').removeClass('btn-default').addClass('btn-primary');
            }, 100);
        }
        
        // Show applied status if password has been applied
        if (frm.doc.password_applied) {
            frm.dashboard.add_indicator(__('Password Applied'), 'green');
        } else if (frm.doc.new_password) {
            frm.dashboard.add_indicator(__('Password Ready to Apply'), 'orange');
        }
    },
    
    reference: function(frm) {
        // When reference is selected, fetch related data
        if (frm.doc.reference) {
            fetch_remote_access_data(frm);
        }
    }
});

// Function to apply password directly using frappe.client methods
function apply_password_direct(frm) {
    // First check if password has already been applied
    if (frm.doc.password_applied) {
        frappe.msgprint(__('Password from this log has already been applied.'));
        return;
    }
    
    if (!frm.doc.reference) {
        frappe.msgprint(__('No Remote Access reference found in this log.'));
        return;
    }
    
    // Get the Remote Access document
    frappe.call({
        method: 'frappe.client.get',
        args: {
            doctype: 'Remote Access',
            name: frm.doc.reference
        },
        callback: function(remote_response) {
            if (remote_response.message) {
                let remote_doc = remote_response.message;
                let current_old_password = remote_doc.password;
                
                // Update the Remote Access password
                frappe.call({
                    method: 'frappe.client.set_value',
                    args: {
                        doctype: 'Remote Access',
                        name: remote_doc.name,
                        fieldname: 'password',
                        value: frm.doc.new_password
                    },
                    callback: function(update_response) {
                        if (update_response.message) {
                            // Mark current log as applied
                            frappe.call({
                                method: 'frappe.client.set_value',
                                args: {
                                    doctype: 'Remote Access Log',
                                    name: frm.doc.name,
                                    fieldname: 'password_applied',
                                    value: 1
                                },
                                callback: function() {
                                    // Create new log entry
                                    frappe.call({
                                        method: 'frappe.client.insert',
                                        args: {
                                            doc: {
                                                doctype: 'Remote Access Log',
                                                reference: remote_doc.name,
                                                id: remote_doc.id,
                                                old_password: current_old_password,
                                                new_password: frm.doc.new_password,
                                                status: remote_doc.status,
                                                assign_to: remote_doc.assign_to,
                                                user: remote_doc.user,
                                                company: remote_doc.company,
                                                password_applied: 0
                                            }
                                        },
                                        callback: function(insert_response) {
                                            if (insert_response.message) {
                                                frappe.msgprint({
                                                    title: __('Success'),
                                                    message: __('Password successfully applied to Remote Access {0}', [remote_doc.name]),
                                                    indicator: 'green'
                                                });
                                                
                                                // Refresh the form to show updated status
                                                frm.reload_doc();
                                            }
                                        },
                                        error: function(error) {
                                            frappe.msgprint({
                                                title: __('Error'),
                                                message: __('Failed to create new log entry: {0}', [error.message]),
                                                indicator: 'red'
                                            });
                                        }
                                    });
                                },
                                error: function(error) {
                                    frappe.msgprint({
                                        title: __('Error'),
                                        message: __('Failed to mark log as applied: {0}', [error.message]),
                                        indicator: 'red'
                                    });
                                }
                            });
                        }
                    },
                    error: function(error) {
                        frappe.msgprint({
                            title: __('Error'),
                            message: __('Failed to update Remote Access password: {0}', [error.message]),
                            indicator: 'red'
                        });
                    }
                });
            }
        },
        error: function(error) {
            frappe.msgprint({
                title: __('Error'),
                message: __('Failed to fetch Remote Access data: {0}', [error.message]),
                indicator: 'red'
            });
        }
    });
}

// Function to fetch and populate data from Remote Access document
function fetch_remote_access_data(frm) {
    frappe.call({
        method: 'frappe.client.get',
        args: {
            doctype: 'Remote Access',
            name: frm.doc.reference
        },
        callback: function(response) {
            if (response.message) {
                let remote_access_doc = response.message;
                
                // Update fields with data from Remote Access
                frm.set_value('id', remote_access_doc.id);
                frm.set_value('status', remote_access_doc.status);
                frm.set_value('assign_to', remote_access_doc.assign_to);
                frm.set_value('user', remote_access_doc.user);
                frm.set_value('company', remote_access_doc.company);
                
                // Set new password if it exists
                if (remote_access_doc.password) {
                    frm.set_value('new_password', remote_access_doc.password);
                }
            }
        },
        error: function(error) {
            frappe.msgprint({
                title: __('Error'),
                message: __('Failed to fetch Remote Access data: {0}', [error.message]),
                indicator: 'red'
            });
        }
    });
}
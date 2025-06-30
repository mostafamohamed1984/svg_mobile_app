// Client Script for Remote Access DocType
frappe.ui.form.on('Remote Access', {
    onload: function(frm) {
        // Store original values when form loads
        if (frm.doc.name) {
            frm.doc.__original_status = frm.doc.status;
            frm.doc.__original_password = frm.doc.password;
            frm.doc.__original_assign_to = frm.doc.assign_to;
        }
        
        // Set up expiration datetime if status changes
        frm.trigger('setup_expiration_fields');
    },
    
    refresh: function(frm) {
        // Add custom buttons based on status
        frm.trigger('add_status_buttons');
        
        // Add password management buttons
        frm.trigger('add_password_buttons');
        
        // Add usage tracking buttons
        frm.trigger('add_usage_buttons');
        
        // Show status indicators
        frm.trigger('show_status_indicators');
        
        // Handle expiration warnings
        frm.trigger('check_expiration_warnings');
    },
    
    status: function(frm) {
        frm.trigger('setup_expiration_fields');
        frm.trigger('handle_status_change');
    },
    
    setup_expiration_fields: function(frm) {
        if (frm.doc.status === 'Temporary' || frm.doc.status === 'Reserved') {
            if (!frm.doc.expiration_datetime) {
                let hours_to_add = frm.doc.status === 'Temporary' ? 24 : 168; // 24h for Temporary, 7 days for Reserved
                let expiration_date = frappe.datetime.add_to_date(frappe.datetime.now_datetime(), 0, 0, 0, hours_to_add);
                frm.set_value('expiration_datetime', expiration_date);
            }
            frm.set_value('auto_expire', 1);
        } else if (frm.doc.status === 'Available') {
            frm.set_value('expiration_datetime', null);
            frm.set_value('expiration_reminder_sent', 0);
        }
    },
    
    handle_status_change: function(frm) {
        if (frm.doc.status === 'Available') {
            // Generate new password when changing to Available
            frm.trigger('generate_new_password');
        }
    },
    
    add_status_buttons: function(frm) {
        // Clear existing buttons
        frm.clear_custom_buttons();
        
        if (frm.doc.status === "Available") {
            // Add "Assign Temporarily" button
            frm.add_custom_button(__('Assign Temporarily'), function() {
                show_assign_dialog(frm, 'Temporary');
            }, __('Actions'));
            
            // Add "Reserve" button
            frm.add_custom_button(__('Reserve'), function() {
                show_assign_dialog(frm, 'Reserved');
            }, __('Actions'));
        }
        
        // Show "Mark as Available" button when status is "Reserved", "Temporary", or "Expired"
        if (['Reserved', 'Temporary', 'Expired'].includes(frm.doc.status)) {
            frm.add_custom_button(__('Mark as Available'), function() {
                frappe.confirm(
                    __('Are you sure you want to mark this remote access as available? This will clear the assigned employee and generate a new password.'),
                    function() {
                        change_to_available(frm);
                    }
                );
            }, __('Actions'));
        }
        
        // Add "Extend Expiration" button for assigned access
        if (['Reserved', 'Temporary'].includes(frm.doc.status) && frm.doc.expiration_datetime) {
            frm.add_custom_button(__('Extend Expiration'), function() {
                show_extend_expiration_dialog(frm);
            }, __('Actions'));
        }
    },
    
    add_password_buttons: function(frm) {
        // Add "Generate New Password" button
        frm.add_custom_button(__('Generate New Password'), function() {
            show_password_generation_dialog(frm);
        }, __('Password'));
        
        // Add "View Decrypted Password" button
        if (frm.doc.password_encrypted) {
            frm.add_custom_button(__('View Password'), function() {
                show_decrypted_password(frm);
            }, __('Password'));
        }
        
        // Add "Password History" button
        frm.add_custom_button(__('Password History'), function() {
            show_password_history(frm);
        }, __('Password'));
    },
    
    add_usage_buttons: function(frm) {
        // Add "Create Usage Log" button
        frm.add_custom_button(__('Report Usage'), function() {
            create_usage_log(frm);
        }, __('Usage'));
        
        // Add "View Usage History" button
        frm.add_custom_button(__('Usage History'), function() {
            frappe.set_route('List', 'Remote Access Log', {
                'reference': frm.doc.name
            });
        }, __('Usage'));
    },
    
    show_status_indicators: function(frm) {
        // Clear existing indicators
        frm.dashboard.clear_headline();
        
        // Add status-specific indicators
        if (frm.doc.status === 'Available') {
            frm.dashboard.add_indicator(__('Available'), 'green');
        } else if (frm.doc.status === 'Temporary') {
            frm.dashboard.add_indicator(__('Temporarily Assigned'), 'orange');
        } else if (frm.doc.status === 'Reserved') {
            frm.dashboard.add_indicator(__('Reserved'), 'blue');
        } else if (frm.doc.status === 'Expired') {
            frm.dashboard.add_indicator(__('Expired'), 'red');
        }
        
        // Add password security indicator
        if (frm.doc.password_encrypted) {
            frm.dashboard.add_indicator(__('Password Encrypted'), 'green');
        }
        
        // Add complexity score indicator
        if (frm.doc.password_complexity_level) {
            let color = frm.doc.password_complexity_level >= 4 ? 'green' : 
                       frm.doc.password_complexity_level >= 3 ? 'orange' : 'red';
            frm.dashboard.add_indicator(__('Password Strength: {0}/5', [frm.doc.password_complexity_level]), color);
        }
    },
    
    check_expiration_warnings: function(frm) {
        if (frm.doc.expiration_datetime && ['Temporary', 'Reserved'].includes(frm.doc.status)) {
            let now = new Date();
            let expiration = new Date(frm.doc.expiration_datetime);
            let hours_remaining = (expiration - now) / (1000 * 60 * 60);
            
            if (hours_remaining <= 0) {
                frm.dashboard.add_comment(__('This access has expired!'), 'red', true);
            } else if (hours_remaining <= 24) {
                frm.dashboard.add_comment(__('This access expires in {0} hours', [Math.round(hours_remaining)]), 'orange', true);
            }
        }
    },
    
    generate_new_password: function(frm) {
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.doctype.remote_access.remote_access.RemoteAccess.generate_secure_password',
            args: {
                length: 12,
                algorithm: 'secure_random'
            },
            callback: function(response) {
                if (response.message) {
                    frm.set_value('password', response.message);
                    frm.set_value('password_encrypted', 0); // Will be encrypted on save
                }
            }
        });
    },
    
    before_save: function(frm) {
        // Check if status is changing to Available
        if (frm.doc.status === "Available" && frm.doc.__original_status !== "Available") {
            // Generate new password when changing to Available
            if (!frm.doc.password || frm.doc.password === frm.doc.__original_password) {
                frm.trigger('generate_new_password');
            }
        }
    },
    
    after_save: function(frm) {
        // Create log entry for any significant changes
        if (should_create_log(frm)) {
            create_remote_access_log(frm);
        }
        
        // Update original values after save
        update_original_values(frm);
        
        // Refresh indicators
        frm.trigger('show_status_indicators');
    }
});

// Function to show assignment dialog with expiration options
function show_assign_dialog(frm, status_type) {
    let dialog = new frappe.ui.Dialog({
        title: __(status_type === 'Temporary' ? 'Assign Remote Access Temporarily' : 'Reserve Remote Access'),
        fields: [
            {
                fieldname: 'employee',
                fieldtype: 'Link',
                label: __('Select Employee'),
                options: 'Employee',
                reqd: 1
            },
            {
                fieldname: 'expiration_datetime',
                fieldtype: 'Datetime',
                label: __('Expiration Date & Time'),
                default: status_type === 'Temporary' ? 
                    frappe.datetime.add_to_date(frappe.datetime.now_datetime(), 0, 0, 0, 24) :
                    frappe.datetime.add_to_date(frappe.datetime.now_datetime(), 0, 0, 7),
                reqd: 1
            },
            {
                fieldname: 'send_notification',
                fieldtype: 'Check',
                label: __('Send Email Notification'),
                default: 1
            }
        ],
        primary_action_label: __(status_type === 'Temporary' ? 'Assign' : 'Reserve'),
        primary_action: function(values) {
            assign_to_employee(frm, values.employee, status_type, values.expiration_datetime);
            dialog.hide();
        }
    });
    
    dialog.show();
}

// Function to show extend expiration dialog
function show_extend_expiration_dialog(frm) {
    let dialog = new frappe.ui.Dialog({
        title: __('Extend Expiration'),
        fields: [
            {
                fieldname: 'new_expiration',
                fieldtype: 'Datetime',
                label: __('New Expiration Date & Time'),
                default: frappe.datetime.add_to_date(frm.doc.expiration_datetime, 0, 0, 0, 24),
                reqd: 1
            },
            {
                fieldname: 'reason',
                fieldtype: 'Small Text',
                label: __('Reason for Extension'),
                reqd: 1
            }
        ],
        primary_action_label: __('Extend'),
        primary_action: function(values) {
            frm.set_value('expiration_datetime', values.new_expiration);
            frm.set_value('expiration_reminder_sent', 0);
            frm.save();
            
            // Create log entry for extension
            create_extension_log(frm, values.reason);
            dialog.hide();
        }
    });
    
    dialog.show();
}

// Function to show password generation dialog
function show_password_generation_dialog(frm) {
    let dialog = new frappe.ui.Dialog({
        title: __('Generate New Password'),
        fields: [
            {
                fieldname: 'algorithm',
                fieldtype: 'Select',
                label: __('Password Type'),
                options: 'secure_random\npronounceable\npassphrase',
                default: 'secure_random',
                reqd: 1
            },
            {
                fieldname: 'length',
                fieldtype: 'Int',
                label: __('Password Length'),
                default: 12,
                depends_on: 'eval:doc.algorithm === "secure_random"'
            }
        ],
        primary_action_label: __('Generate'),
        primary_action: function(values) {
            frappe.call({
                method: 'svg_mobile_app.svg_mobile_app.doctype.remote_access.remote_access.RemoteAccess.generate_secure_password',
                args: {
                    length: values.length || 12,
                    algorithm: values.algorithm
                },
                callback: function(response) {
                    if (response.message) {
                        frm.set_value('password', response.message);
                        frm.set_value('password_encrypted', 0);
                        frappe.msgprint(__('New password generated: {0}', [response.message]));
                    }
                }
            });
            dialog.hide();
        }
    });
    
    dialog.show();
}

// Function to show decrypted password
function show_decrypted_password(frm) {
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.doctype.remote_access.remote_access.decrypt_password',
        args: {
            name: frm.doc.name
        },
        callback: function(response) {
            if (response.message) {
                frappe.msgprint({
                    title: __('Decrypted Password'),
                    message: __('Password: {0}', [response.message]),
                    indicator: 'blue'
                });
            }
        }
    });
}

// Function to create usage log
function create_usage_log(frm) {
    frappe.new_doc('Remote Access Log', {
        reference: frm.doc.name,
        id: frm.doc.id,
        status: frm.doc.status,
        assign_to: frm.doc.assign_to,
        user: frm.doc.user,
        company: frm.doc.company,
        usage_reported_by: frappe.session.user,
        usage_report_date: frappe.datetime.get_today()
    });
}

// Function to assign to employee with expiration
function assign_to_employee(frm, employee, status_type, expiration_datetime) {
    // Update the document fields
    frm.set_value('assign_to', employee);
    frm.set_value('status', status_type);
    frm.set_value('expiration_datetime', expiration_datetime);
    frm.set_value('expiration_reminder_sent', 0);
    
    // Refresh fields to get updated user field
    frm.refresh_field('user');
    
    // Save the document
    frm.save().then(() => {
        let message = status_type === 'Temporary' ? 
            __('Remote access has been assigned temporarily until {0}.<br><strong>Password:</strong> {1}', 
               [expiration_datetime, frm.doc.password || 'Not set']) :
            __('Remote access has been reserved until {0} for the selected employee.', [expiration_datetime]);
        
        frappe.msgprint({
            title: __(status_type === 'Temporary' ? 'Remote Access Assigned' : 'Remote Access Reserved'),
            message: message,
            indicator: 'green'
        });
    });
}

// Function to change status to Available
function change_to_available(frm) {
    // Clear assignment and change status
    frm.set_value('assign_to', '');
    frm.set_value('status', 'Available');
    frm.set_value('expiration_datetime', null);
    frm.set_value('expiration_reminder_sent', 0);
    
    // Generate new password
    frm.trigger('generate_new_password');
    
    // Refresh fields
    frm.refresh_field('user');
    frm.refresh_field('assign_to');
    frm.refresh_field('password');
    
    // Save the document
    frm.save().then(() => {
        frappe.msgprint({
            title: __('Remote Access Available'),
            message: __('Remote access has been marked as available, employee assignment cleared, and new password generated.'),
            indicator: 'green'
        });
    });
}

// Function to check if log should be created
function should_create_log(frm) {
    if (!frm.doc.name || frm.doc.__islocal) return false;
    
    // Create log if status changed, password changed, or assignment changed
    return (
        frm.doc.__original_status !== frm.doc.status ||
        frm.doc.__original_password !== frm.doc.password ||
        frm.doc.__original_assign_to !== frm.doc.assign_to
    );
}

// Function to create Remote Access Log
function create_remote_access_log(frm) {
    let action_type = 'Record Updated';
    
    // Determine action type based on changes
    if (frm.doc.__original_status !== frm.doc.status) {
        if (frm.doc.status === 'Available') {
            action_type = 'Status Changed to Available';
        } else if (frm.doc.status === 'Reserved') {
            action_type = 'Status Changed to Reserved';
        } else if (frm.doc.status === 'Temporary') {
            action_type = 'Status Changed to Temporary';
        } else if (frm.doc.status === 'Expired') {
            action_type = 'Status Changed to Expired';
        }
    }
    
    frappe.call({
        method: 'frappe.client.insert',
        args: {
            doc: {
                doctype: 'Remote Access Log',
                reference: frm.doc.name,
                id: frm.doc.id,
                old_password: frm.doc.__original_password || '',
                new_password: frm.doc.password,
                status: frm.doc.status,
                assign_to: frm.doc.assign_to,
                user: frm.doc.user,
                company: frm.doc.company,
                password_applied: 0,
                connection_notes: action_type
            }
        },
        callback: function(response) {
            if (response.message) {
                frappe.show_alert({
                    message: __('Remote Access Log created: {0}', [response.message.name]),
                    indicator: 'green'
                });
            }
        },
        error: function(error) {
            console.error('Failed to create Remote Access Log:', error);
        }
    });
}

// Function to create extension log
function create_extension_log(frm, reason) {
    frappe.call({
        method: 'frappe.client.insert',
        args: {
            doc: {
                doctype: 'Remote Access Log',
                reference: frm.doc.name,
                id: frm.doc.id,
                status: frm.doc.status,
                assign_to: frm.doc.assign_to,
                user: frm.doc.user,
                company: frm.doc.company,
                connection_notes: 'Expiration extended: ' + reason,
                password_applied: 0
            }
        }
    });
}

// Function to update original values
function update_original_values(frm) {
    frm.doc.__original_status = frm.doc.status;
    frm.doc.__original_password = frm.doc.password;
    frm.doc.__original_assign_to = frm.doc.assign_to;
}
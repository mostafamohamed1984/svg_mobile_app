// Client Script for Remote Access Log DocType
frappe.ui.form.on('Remote Access Log', {
    onload: function(frm) {
        // Set default values
        if (frm.doc.__islocal) {
            frm.set_value('usage_reported_by', frappe.session.user);
            frm.set_value('usage_report_date', frappe.datetime.get_today());
        }
    },
    
    refresh: function(frm) {
        // Add custom buttons
        frm.trigger('add_custom_buttons');
        
        // Show status indicators
        frm.trigger('show_status_indicators');
        
        // Calculate duration if both times are set
        frm.trigger('calculate_duration');
        
        // Show usage tracking section based on purpose
        frm.trigger('toggle_usage_fields');
    },
    
    reference: function(frm) {
        // Fetch data from Remote Access when reference is selected
        if (frm.doc.reference) {
            frm.trigger('fetch_remote_access_data');
        }
    },
    
    connection_start_time: function(frm) {
        frm.trigger('calculate_duration');
        frm.trigger('validate_connection_times');
    },
    
    connection_end_time: function(frm) {
        frm.trigger('calculate_duration');
        frm.trigger('validate_connection_times');
    },
    
    manual_check_in: function(frm) {
        // Auto-set connection start time if not already set
        if (frm.doc.manual_check_in && !frm.doc.connection_start_time) {
            frm.set_value('connection_start_time', frm.doc.manual_check_in);
        }
    },
    
    manual_check_out: function(frm) {
        // Auto-set connection end time if not already set
        if (frm.doc.manual_check_out && !frm.doc.connection_end_time) {
            frm.set_value('connection_end_time', frm.doc.manual_check_out);
        }
    },
    
    connection_purpose: function(frm) {
        frm.trigger('toggle_usage_fields');
    },
    
    add_custom_buttons: function(frm) {
        // Clear existing buttons
        frm.clear_custom_buttons();
        
        // Add "View Remote Access" button
        if (frm.doc.reference) {
            frm.add_custom_button(__('View Remote Access'), function() {
                frappe.set_route('Form', 'Remote Access', frm.doc.reference);
            }, __('Actions'));
        }
        
        // Add "Apply Password" button if password change is pending
        if (frm.doc.new_password && !frm.doc.password_applied && frm.doc.reference) {
            frm.add_custom_button(__('Apply Password'), function() {
                apply_password_change(frm);
            }, __('Actions'));
        }
        
        // Add "Start Session" button for usage tracking
        if (!frm.doc.connection_start_time && frm.doc.reference) {
            frm.add_custom_button(__('Start Session'), function() {
                start_session_tracking(frm);
            }, __('Session'));
        }
        
        // Add "End Session" button if session is active
        if (frm.doc.connection_start_time && !frm.doc.connection_end_time) {
            frm.add_custom_button(__('End Session'), function() {
                end_session_tracking(frm);
            }, __('Session'));
        }
        
        // Add "Generate Usage Report" button
        if (frm.doc.connection_start_time && frm.doc.connection_end_time) {
            frm.add_custom_button(__('Generate Report'), function() {
                generate_usage_report(frm);
            }, __('Reports'));
        }
        
        // Add "Verify Connection" button for IT admins
        if (!frm.doc.connection_verified && frappe.user.has_role('System Manager')) {
            frm.add_custom_button(__('Verify Connection'), function() {
                verify_connection(frm);
            }, __('Admin'));
        }
    },
    
    show_status_indicators: function(frm) {
        // Clear existing indicators
        frm.dashboard.clear_headline();
        
        // Password application status
        if (frm.doc.new_password) {
            if (frm.doc.password_applied) {
                frm.dashboard.add_indicator(__('Password Applied'), 'green');
            } else {
                frm.dashboard.add_indicator(__('Password Pending Application'), 'orange');
            }
        }
        
        // Connection verification status
        if (frm.doc.connection_verified) {
            frm.dashboard.add_indicator(__('Connection Verified'), 'green');
        } else if (frm.doc.connection_start_time) {
            frm.dashboard.add_indicator(__('Connection Not Verified'), 'orange');
        }
        
        // Session status
        if (frm.doc.connection_start_time && frm.doc.connection_end_time) {
            frm.dashboard.add_indicator(__('Session Completed'), 'blue');
        } else if (frm.doc.connection_start_time) {
            frm.dashboard.add_indicator(__('Session Active'), 'yellow');
        }
        
        // Session rating
        if (frm.doc.session_rating) {
            let rating_text = '★'.repeat(frm.doc.session_rating) + '☆'.repeat(5 - frm.doc.session_rating);
            frm.dashboard.add_indicator(__('Rating: {0}', [rating_text]), 'blue');
        }
    },
    
    calculate_duration: function(frm) {
        if (frm.doc.connection_start_time && frm.doc.connection_end_time) {
            let start = new Date(frm.doc.connection_start_time);
            let end = new Date(frm.doc.connection_end_time);
            
            if (end > start) {
                let duration_seconds = Math.floor((end - start) / 1000);
                let hours = Math.floor(duration_seconds / 3600);
                let minutes = Math.floor((duration_seconds % 3600) / 60);
                let seconds = duration_seconds % 60;
                
                let duration_string = '';
                if (hours > 0) duration_string += hours + 'h ';
                if (minutes > 0) duration_string += minutes + 'm ';
                duration_string += seconds + 's';
                
                frm.set_value('connection_duration', duration_string);
            }
        }
    },
    
    validate_connection_times: function(frm) {
        if (frm.doc.connection_start_time && frm.doc.connection_end_time) {
            let start = new Date(frm.doc.connection_start_time);
            let end = new Date(frm.doc.connection_end_time);
            
            if (end <= start) {
                frappe.msgprint({
                    title: __('Invalid Time Range'),
                    message: __('Connection end time must be after start time'),
                    indicator: 'red'
                });
                frm.set_value('connection_end_time', null);
            }
        }
    },
    
    toggle_usage_fields: function(frm) {
        // Show/hide fields based on connection purpose
        let show_detailed_tracking = ['Technical Support', 'Maintenance', 'Troubleshooting'].includes(frm.doc.connection_purpose);
        
        frm.toggle_display('connection_notes', show_detailed_tracking);
        frm.toggle_display('issues_encountered', show_detailed_tracking);
    },
    
    fetch_remote_access_data: function(frm) {
        if (frm.doc.reference) {
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Remote Access',
                    name: frm.doc.reference
                },
                callback: function(response) {
                    if (response.message) {
                        let remote_access = response.message;
                        
                        // Populate fields from Remote Access
                        frm.set_value('id', remote_access.id);
                        frm.set_value('status', remote_access.status);
                        frm.set_value('assign_to', remote_access.assign_to);
                        frm.set_value('user', remote_access.user);
                        frm.set_value('company', remote_access.company);
                        
                        // Set current password as old password if not already set
                        if (!frm.doc.old_password && remote_access.password) {
                            frm.set_value('old_password', remote_access.password);
                        }
                        
                        frm.refresh_fields();
                    }
                }
            });
        }
    },
    
    before_save: function(frm) {
        // Validate required fields for different scenarios
        frm.trigger('validate_required_fields');
        
        // Auto-calculate duration before save
        frm.trigger('calculate_duration');
    },
    
    validate_required_fields: function(frm) {
        // If this is a usage report, ensure required tracking fields are filled
        if (frm.doc.connection_start_time || frm.doc.connection_end_time) {
            if (!frm.doc.connection_purpose) {
                frappe.throw(__('Connection Purpose is required for usage tracking'));
            }
            
            if (!frm.doc.usage_reported_by) {
                frm.set_value('usage_reported_by', frappe.session.user);
            }
            
            if (!frm.doc.usage_report_date) {
                frm.set_value('usage_report_date', frappe.datetime.get_today());
            }
        }
    }
});

// Function to apply password change
function apply_password_change(frm) {
    if (!frm.doc.new_password || !frm.doc.reference) {
        frappe.msgprint(__('No password change to apply'));
        return;
    }
    
    frappe.confirm(
        __('Are you sure you want to apply this password change? This action cannot be undone.'),
        function() {
            frappe.call({
                method: 'frappe.client.set_value',
                args: {
                    doctype: 'Remote Access',
                    name: frm.doc.reference,
                    fieldname: 'password',
                    value: frm.doc.new_password
                },
                callback: function(response) {
                    if (response.message) {
                        // Mark this log as applied
                        frm.set_value('password_applied', 1);
                        frm.save();
                        
                        // Create new log entry for the application
                        create_application_log(frm);
                        
                        frappe.msgprint({
                            title: __('Password Applied'),
                            message: __('Password has been successfully applied to Remote Access: {0}', [frm.doc.reference]),
                            indicator: 'green'
                        });
                        
                        frm.refresh();
                    }
                }
            });
        }
    );
}

// Function to start session tracking
function start_session_tracking(frm) {
    let now = frappe.datetime.now_datetime();
    frm.set_value('connection_start_time', now);
    frm.set_value('manual_check_in', now);
    
    if (!frm.doc.connection_purpose) {
        // Show purpose selection dialog
        show_session_purpose_dialog(frm, 'start');
    } else {
        frm.save();
        frappe.show_alert({
            message: __('Session tracking started'),
            indicator: 'green'
        });
    }
}

// Function to end session tracking
function end_session_tracking(frm) {
    let now = frappe.datetime.now_datetime();
    frm.set_value('connection_end_time', now);
    frm.set_value('manual_check_out', now);
    
    // Show session completion dialog
    show_session_completion_dialog(frm);
}

// Function to show session purpose dialog
function show_session_purpose_dialog(frm, action) {
    let dialog = new frappe.ui.Dialog({
        title: __(action === 'start' ? 'Start Session' : 'Session Details'),
        fields: [
            {
                fieldname: 'connection_purpose',
                fieldtype: 'Select',
                label: __('Connection Purpose'),
                options: '\nTechnical Support\nMaintenance\nTraining\nTroubleshooting\nSoftware Installation\nData Transfer\nOther',
                reqd: 1,
                default: frm.doc.connection_purpose
            },
            {
                fieldname: 'connection_notes',
                fieldtype: 'Small Text',
                label: __('Initial Notes'),
                default: frm.doc.connection_notes
            }
        ],
        primary_action_label: __(action === 'start' ? 'Start Session' : 'Update'),
        primary_action: function(values) {
            frm.set_value('connection_purpose', values.connection_purpose);
            frm.set_value('connection_notes', values.connection_notes);
            frm.save();
            
            if (action === 'start') {
                frappe.show_alert({
                    message: __('Session tracking started'),
                    indicator: 'green'
                });
            }
            
            dialog.hide();
        }
    });
    
    dialog.show();
}

// Function to show session completion dialog
function show_session_completion_dialog(frm) {
    let dialog = new frappe.ui.Dialog({
        title: __('Complete Session'),
        fields: [
            {
                fieldname: 'session_rating',
                fieldtype: 'Rating',
                label: __('Session Rating'),
                default: frm.doc.session_rating
            },
            {
                fieldname: 'connection_notes',
                fieldtype: 'Small Text',
                label: __('Session Summary'),
                default: frm.doc.connection_notes
            },
            {
                fieldname: 'issues_encountered',
                fieldtype: 'Small Text',
                label: __('Issues Encountered'),
                default: frm.doc.issues_encountered
            }
        ],
        primary_action_label: __('Complete Session'),
        primary_action: function(values) {
            frm.set_value('session_rating', values.session_rating);
            frm.set_value('connection_notes', values.connection_notes);
            frm.set_value('issues_encountered', values.issues_encountered);
            frm.save();
            
            frappe.show_alert({
                message: __('Session completed successfully'),
                indicator: 'green'
            });
            
            dialog.hide();
        }
    });
    
    dialog.show();
}

// Function to verify connection (for IT admins)
function verify_connection(frm) {
    frappe.confirm(
        __('Mark this connection as verified? This confirms the reported usage is accurate.'),
        function() {
            frm.set_value('connection_verified', 1);
            frm.save();
            
            frappe.show_alert({
                message: __('Connection verified'),
                indicator: 'green'
            });
        }
    );
}

// Function to generate usage report
function generate_usage_report(frm) {
    if (!frm.doc.connection_start_time || !frm.doc.connection_end_time) {
        frappe.msgprint(__('Complete session data required for report generation'));
        return;
    }
    
    let report_data = {
        device_id: frm.doc.id,
        user: frm.doc.user,
        employee: frm.doc.assign_to,
        start_time: frm.doc.connection_start_time,
        end_time: frm.doc.connection_end_time,
        duration: frm.doc.connection_duration,
        purpose: frm.doc.connection_purpose,
        rating: frm.doc.session_rating,
        notes: frm.doc.connection_notes,
        issues: frm.doc.issues_encountered,
        verified: frm.doc.connection_verified
    };
    
    // Show report in a dialog
    let report_html = generate_report_html(report_data);
    
    let dialog = new frappe.ui.Dialog({
        title: __('Usage Report'),
        fields: [
            {
                fieldname: 'report_content',
                fieldtype: 'HTML',
                options: report_html
            }
        ],
        primary_action_label: __('Print Report'),
        primary_action: function() {
            // Open print view
            let print_window = window.open('', '_blank');
            print_window.document.write(report_html);
            print_window.print();
            dialog.hide();
        }
    });
    
    dialog.show();
}

// Function to generate report HTML
function generate_report_html(data) {
    return `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Remote Access Usage Report</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Device ID:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.device_id}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>User:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.user}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Employee:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.employee}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Start Time:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.start_time}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>End Time:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.end_time}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Duration:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.duration}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Purpose:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.purpose}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Rating:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${'★'.repeat(data.rating || 0)}${'☆'.repeat(5 - (data.rating || 0))}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Notes:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.notes || 'None'}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Issues:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.issues || 'None'}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Verified:</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${data.verified ? 'Yes' : 'No'}</td></tr>
            </table>
            <p style="margin-top: 20px; font-size: 12px; color: #666;">Generated on: ${frappe.datetime.now_datetime()}</p>
        </div>
    `;
}

// Function to create application log
function create_application_log(frm) {
    frappe.call({
        method: 'frappe.client.insert',
        args: {
            doc: {
                doctype: 'Remote Access Log',
                reference: frm.doc.reference,
                id: frm.doc.id,
                old_password: frm.doc.old_password,
                new_password: frm.doc.new_password,
                status: frm.doc.status,
                assign_to: frm.doc.assign_to,
                user: frm.doc.user,
                company: frm.doc.company,
                password_applied: 1,
                connection_notes: 'Password applied from log: ' + frm.doc.name
            }
        },
        callback: function(response) {
            if (response.message) {
                frappe.show_alert({
                    message: __('Application log created: {0}', [response.message.name]),
                    indicator: 'green'
                });
            }
        }
    });
}
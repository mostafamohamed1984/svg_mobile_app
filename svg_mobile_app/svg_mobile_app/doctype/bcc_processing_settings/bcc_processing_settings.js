// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on('BCC Processing Settings', {
    refresh: function(frm) {
        // Add custom buttons for testing and management
        add_custom_buttons(frm);
        
        // Set field dependencies
        set_field_dependencies(frm);
        
        // Add help text
        add_help_text(frm);
    },

    enable_bcc_processing: function(frm) {
        // Toggle required fields based on BCC processing enabled/disabled
        frm.toggle_reqd('gmail_forwarding_account', frm.doc.enable_bcc_processing);
        
        if (!frm.doc.enable_bcc_processing) {
            frappe.msgprint({
                title: 'BCC Processing Disabled',
                message: 'BCC email processing has been disabled. Existing BCC emails will still be visible.',
                indicator: 'yellow'
            });
        }
    },

    gmail_forwarding_account: function(frm) {
        // Validate Gmail account format
        if (frm.doc.gmail_forwarding_account) {
            validate_gmail_account(frm);
        }
    },

    processing_method: function(frm) {
        // Show different help text based on processing method
        show_processing_method_help(frm);
    }
});

function add_custom_buttons(frm) {
    // Add Test Email Forwarding button
    frm.add_custom_button(__('Test Email Forwarding'), function() {
        test_email_forwarding(frm);
    }, __('Tests'));

    // Add Test BCC Processing button
    frm.add_custom_button(__('Test BCC Processing'), function() {
        test_bcc_processing(frm);
    }, __('Tests'));

    // Add View Processed Emails button
    frm.add_custom_button(__('View Processed Emails'), function() {
        view_processed_emails(frm);
    }, __('View'));

    // Add Settings Documentation button
    frm.add_custom_button(__('Documentation'), function() {
        show_documentation_dialog(frm);
    }, __('Help'));
}

function set_field_dependencies(frm) {
    // Set Gmail account as required when BCC processing is enabled
    frm.toggle_reqd('gmail_forwarding_account', frm.doc.enable_bcc_processing);
    
    // Show/hide debug mode fields
    frm.toggle_display('debug_mode', frappe.user.has_role('System Manager'));
}

function add_help_text(frm) {
    // Add help text for key fields
    frm.set_df_property('gmail_forwarding_account', 'description', 
        'Gmail account where BCC/CC processed emails will be forwarded. Must be a valid Gmail address.');
    
    frm.set_df_property('processing_method', 'description', 
        'Hook: Process during email receipt (recommended)<br>Forwarding: Forward to Gmail for processing<br>API: Use external API processing');
    
    frm.set_df_property('max_recipients_per_email', 'description', 
        'Maximum number of recipients to process per email. Higher numbers may impact performance.');
}

function validate_gmail_account(frm) {
    const email = frm.doc.gmail_forwarding_account;
    const gmail_pattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    
    if (!gmail_pattern.test(email)) {
        frappe.msgprint({
            title: 'Invalid Gmail Account',
            message: 'Please enter a valid Gmail address (must end with @gmail.com)',
            indicator: 'red'
        });
        frm.set_value('gmail_forwarding_account', '');
    }
}

function show_processing_method_help(frm) {
    const method = frm.doc.processing_method;
    let message = '';
    
    switch(method) {
        case 'Hook':
            message = 'Emails will be processed automatically when received. This is the recommended method for real-time BCC processing.';
            break;
        case 'Forwarding':
            message = 'Emails will be forwarded to the Gmail account for processing. Use this if hook processing is not working.';
            break;
        case 'API':
            message = 'Emails will be processed via external API calls. This method requires additional setup.';
            break;
    }
    
    if (message) {
        frappe.show_alert({
            message: message,
            indicator: 'blue'
        }, 5);
    }
}

function test_email_forwarding(frm) {
    frappe.show_alert('Testing email forwarding...', 3);
    
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.doctype.bcc_processing_settings.bcc_processing_settings.test_email_forwarding',
        callback: function(r) {
            if (r.message) {
                frappe.msgprint({
                    title: 'Email Forwarding Test Results',
                    message: r.message.message,
                    indicator: r.message.status === 'success' ? 'green' : 'red'
                });
            } else {
                frappe.msgprint({
                    title: 'Email Forwarding Test',
                    message: 'No response received from test',
                    indicator: 'red'
                });
            }
        },
        error: function(err) {
            console.error('Email Forwarding Test Error:', err);
            frappe.msgprint({
                title: 'Email Forwarding Test Error',
                message: 'Test failed with an error. Check console for details.',
                indicator: 'red'
            });
        }
    });
}

function test_bcc_processing(frm) {
    frappe.show_alert('Testing BCC processing...', 3);
    
    frappe.call({
        method: 'svg_mobile_app.email_genius.email_processor.test_bcc_processing',
        callback: function(r) {
            if (r.message) {
                let message = r.message.message;
                
                // Add details if available
                if (r.message.details) {
                    const details = r.message.details;
                    message += '<br><br><strong>Test Details:</strong><br>';
                    
                    if (details.to_recipients) {
                        message += `TO Recipients: ${details.to_recipients.join(', ')}<br>`;
                    }
                    if (details.cc_recipients) {
                        message += `CC Recipients: ${details.cc_recipients.join(', ')}<br>`;
                    }
                    if (details.bcc_recipients) {
                        message += `BCC Recipients: ${details.bcc_recipients.join(', ')}<br>`;
                    }
                    if (details.total_recipients) {
                        message += `Total Recipients: ${details.total_recipients}<br>`;
                    }
                    if (details.bcc_processing_enabled !== undefined) {
                        message += `BCC Processing Enabled: ${details.bcc_processing_enabled ? 'Yes' : 'No'}<br>`;
                    }
                    if (details.test_note) {
                        message += `<em>${details.test_note}</em><br>`;
                    }
                }
                
                frappe.msgprint({
                    title: 'BCC Processing Test Results',
                    message: message,
                    indicator: r.message.status === 'success' ? 'green' : 'red'
                });
            } else {
                frappe.msgprint({
                    title: 'BCC Processing Test',
                    message: 'No response received from test',
                    indicator: 'red'
                });
            }
        },
        error: function(err) {
            console.error('BCC Processing Test Error:', err);
            frappe.msgprint({
                title: 'BCC Processing Test Error',
                message: 'Test failed with an error. Check console for details.',
                indicator: 'red'
            });
        }
    });
}

function view_processed_emails(frm) {
    frappe.set_route('List', 'Communication', {
        'custom_recipient_type': ['in', ['BCC', 'CC']]
    });
}

function show_documentation_dialog(frm) {
    const dialog = new frappe.ui.Dialog({
        title: 'BCC Processing Documentation',
        fields: [
            {
                fieldtype: 'HTML',
                fieldname: 'documentation',
                options: `
                    <div style="padding: 15px;">
                        <h4>BCC Email Processing System</h4>
                        <p>This system helps capture BCC and CC emails that would normally be hidden in Frappe.</p>
                        
                        <h5>How it works:</h5>
                        <ol>
                            <li>Incoming emails are intercepted during processing</li>
                            <li>BCC and CC recipients are identified</li>
                            <li>Unique message IDs are generated for each recipient</li>
                            <li>Emails are forwarded to the configured Gmail account</li>
                            <li>Gmail processes them as separate email entries</li>
                        </ol>
                        
                        <h5>Configuration:</h5>
                        <ul>
                            <li><strong>Gmail Account:</strong> Must be a valid Gmail address (constr.sv@gmail.com)</li>
                            <li><strong>Processing Method:</strong> "Hook" is recommended for real-time processing</li>
                            <li><strong>Max Recipients:</strong> Limit to prevent performance issues</li>
                        </ul>
                        
                        <h5>Testing:</h5>
                        <p>Use the test buttons to verify the system is working correctly:</p>
                        <ul>
                            <li><strong>Test Email Forwarding:</strong> Sends a test email to Gmail</li>
                            <li><strong>Test BCC Processing:</strong> Tests the email parsing logic</li>
                        </ul>
                        
                        <div class="alert alert-info">
                            <strong>Note:</strong> Make sure your Gmail account is configured to receive emails from your Frappe system.
                        </div>
                    </div>
                `
            }
        ],
        primary_action_label: 'Close',
        primary_action: function() {
            dialog.hide();
        }
    });
    
    dialog.show();
} 
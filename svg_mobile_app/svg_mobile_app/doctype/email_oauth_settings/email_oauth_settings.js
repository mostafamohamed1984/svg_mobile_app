// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on('Email OAuth Settings', {
    refresh: function(frm) {
        // Add custom buttons
        if (!frm.doc.__islocal) {
            frm.add_custom_button(__('Authorize'), function() {
                authorize_provider(frm.doc.name);
            }, __('Actions'));
            
            frm.add_custom_button(__('Test Connection'), function() {
                test_connection(frm.doc.name);
            }, __('Actions'));
            
            frm.add_custom_button(__('Refresh Token'), function() {
                refresh_token(frm.doc.name);
            }, __('Actions'));
        }
        
        // Set indicator based on token status
        if (frm.doc.access_token && frm.doc.token_expires_at) {
            const now = new Date();
            const expires = new Date(frm.doc.token_expires_at);
            
            if (expires < now) {
                frm.dashboard.set_headline_alert('Token Expired - Please re-authorize', 'red');
            } else if (expires < new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
                frm.dashboard.set_headline_alert('Token expires soon - Consider refreshing', 'orange');
            } else {
                frm.dashboard.set_headline_alert('Token is valid', 'green');
            }
        } else if (!frm.doc.__islocal) {
            frm.dashboard.set_headline_alert('Not authorized - Click Authorize to connect', 'blue');
        }
    },
    
    provider: function(frm) {
        // Clear provider-specific fields when provider changes
        if (frm.doc.provider === 'Microsoft 365') {
            frm.set_df_property('tenant_id', 'reqd', 1);
        } else {
            frm.set_df_property('tenant_id', 'reqd', 0);
            frm.set_value('tenant_id', '');
        }
    },
    
    validate: function(frm) {
        if (frm.doc.provider === 'Microsoft 365' && !frm.doc.tenant_id) {
            frappe.throw(__('Tenant ID is required for Microsoft 365 provider'));
        }
    }
});

function authorize_provider(provider_name) {
    frappe.show_alert({
        message: __('Initiating OAuth2 authorization...'),
        indicator: 'blue'
    });
    
    frappe.call({
        method: 'svg_mobile_app.oauth_handlers.initiate_oauth_flow',
        args: {
            provider_name: provider_name
        },
        callback: function(r) {
            if (r.message && r.message.success) {
                // Open authorization URL in new window
                const auth_window = window.open(
                    r.message.auth_url,
                    'oauth_auth',
                    'width=600,height=700,scrollbars=yes,resizable=yes'
                );
                
                // Monitor window for closure
                const check_closed = setInterval(function() {
                    if (auth_window.closed) {
                        clearInterval(check_closed);
                        // Refresh form after authorization
                        setTimeout(function() {
                            cur_frm.reload_doc();
                        }, 2000);
                    }
                }, 1000);
                
                frappe.show_alert({
                    message: r.message.message,
                    indicator: 'green'
                });
            } else {
                frappe.msgprint({
                    title: __('Authorization Failed'),
                    message: r.message ? r.message.error : __('Unknown error occurred'),
                    indicator: 'red'
                });
            }
        }
    });
}

function test_connection(provider_name) {
    frappe.show_alert({
        message: __('Testing connection...'),
        indicator: 'blue'
    });
    
    frappe.call({
        method: 'svg_mobile_app.oauth_handlers.test_oauth_connection',
        args: {
            provider_name: provider_name
        },
        callback: function(r) {
            if (r.message && r.message.success) {
                frappe.msgprint({
                    title: __('Connection Test Successful'),
                    message: r.message.message + '<br><br><strong>User Info:</strong><br>' + 
                            '<pre>' + JSON.stringify(r.message.user_info, null, 2) + '</pre>',
                    indicator: 'green'
                });
            } else {
                frappe.msgprint({
                    title: __('Connection Test Failed'),
                    message: r.message ? r.message.error : __('Unknown error occurred'),
                    indicator: 'red'
                });
            }
        }
    });
}

function refresh_token(provider_name) {
    frappe.show_alert({
        message: __('Refreshing access token...'),
        indicator: 'blue'
    });
    
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.doctype.email_oauth_settings.email_oauth_settings.refresh_access_token',
        args: {
            provider_name: provider_name
        },
        callback: function(r) {
            if (r.message && r.message.success) {
                frappe.show_alert({
                    message: __('Token refreshed successfully'),
                    indicator: 'green'
                });
                cur_frm.reload_doc();
            } else {
                frappe.msgprint({
                    title: __('Token Refresh Failed'),
                    message: r.message ? r.message.error : __('Unknown error occurred'),
                    indicator: 'red'
                });
            }
        }
    });
}

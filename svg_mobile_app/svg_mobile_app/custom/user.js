frappe.ui.form.on('User', {
    refresh: function(frm) {
        // Add custom button to manage email access
        if (!frm.is_new() && frappe.user.has_role("System Manager")) {
            frm.add_custom_button(__('Manage Email Access'), function() {
                show_email_access_dialog(frm);
            }, __('Actions'));
        }
    }
});

frappe.ui.form.on('User Email', {
    email_account: function(frm, cdt, cdn) {
        // Auto-fetch email_id when email_account is selected
        let row = locals[cdt][cdn];
        if (row.email_account) {
            frappe.db.get_value('Email Account', row.email_account, 'email_id')
                .then(r => {
                    if (r.message && r.message.email_id) {
                        frappe.model.set_value(cdt, cdn, 'email_id', r.message.email_id);
                    }
                });
        }
    },
    
    access_type: function(frm, cdt, cdn) {
        // Auto-set granted_by and granted_date when access_type changes
        let row = locals[cdt][cdn];
        if (row.access_type && !row.granted_by) {
            frappe.model.set_value(cdt, cdn, 'granted_by', frappe.session.user);
            frappe.model.set_value(cdt, cdn, 'granted_date', frappe.datetime.get_today());
        }
    },
    
    user_emails_add: function(frm, cdt, cdn) {
        // Set default values for new email entries
        let row = locals[cdt][cdn];
        if (!row.access_type) {
            frappe.model.set_value(cdt, cdn, 'access_type', 'Full Access');
        }
        if (!row.granted_by) {
            frappe.model.set_value(cdt, cdn, 'granted_by', frappe.session.user);
        }
        if (!row.granted_date) {
            frappe.model.set_value(cdt, cdn, 'granted_date', frappe.datetime.get_today());
        }
    }
});

function show_email_access_dialog(frm) {
    let dialog = new frappe.ui.Dialog({
        title: __('Manage Email Access for {0}', [frm.doc.full_name || frm.doc.name]),
        fields: [
            {
                fieldtype: 'Link',
                fieldname: 'email_account',
                label: __('Email Account'),
                options: 'Email Account',
                reqd: 1
            },
            {
                fieldtype: 'Select',
                fieldname: 'access_type',
                label: __('Access Type'),
                options: 'Read Only\nRead & Send\nFull Access',
                default: 'Read Only',
                reqd: 1
            },
            {
                fieldtype: 'Small Text',
                fieldname: 'description',
                label: __('Description')
            }
        ],
        primary_action_label: __('Grant Access'),
        primary_action: function(values) {
            // Check if email account already exists
            let existing = frm.doc.user_emails.find(email => 
                email.email_account === values.email_account
            );
            
            if (existing) {
                frappe.msgprint(__('User already has access to this email account'));
                return;
            }
            
            // Get email_id from Email Account
            frappe.db.get_value('Email Account', values.email_account, 'email_id')
                .then(r => {
                    if (r.message && r.message.email_id) {
                        // Add new row to user_emails table
                        let new_row = frm.add_child('user_emails');
                        new_row.email_account = values.email_account;
                        new_row.email_id = r.message.email_id;
                        new_row.access_type = values.access_type;
                        new_row.granted_by = frappe.session.user;
                        new_row.granted_date = frappe.datetime.get_today();
                        new_row.description = values.description || 'Email access granted via dialog';
                        
                        frm.refresh_field('user_emails');
                        frm.save();
                        
                        dialog.hide();
                        frappe.msgprint(__('Email access granted successfully'));
                    } else {
                        frappe.msgprint(__('Could not fetch email ID for the selected account'));
                    }
                });
        }
    });
    
    dialog.show();
} 
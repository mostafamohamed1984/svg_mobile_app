// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on('Issue Requirements Reminders', {
    refresh: function(frm) {
        // Add button to test reminder
        if (frm.doc.docstatus === 1 && frm.doc.reminder_status === 'Active' && frm.doc.enabled) {
            frm.add_custom_button(__('Test Reminder'), function() {
                frappe.confirm(
                    __('This will send the reminder now. Do you want to continue?'),
                    function() {
                        frm.call({
                            doc: frm.doc,
                            method: 'process_reminder',
                            callback: function(r) {
                                if (r.message) {
                                    frappe.show_alert({
                                        message: __('Reminder sent successfully'),
                                        indicator: 'green'
                                    });
                                    frm.refresh();
                                } else {
                                    frappe.show_alert({
                                        message: __('Failed to send reminder'),
                                        indicator: 'red'
                                    });
                                }
                            }
                        });
                    }
                );
            });
        }

        // Add button to reset status if completed
        if (frm.doc.docstatus === 1 && frm.doc.reminder_status === 'Completed') {
            frm.add_custom_button(__('Activate Reminder'), function() {
                frappe.confirm(
                    __('This will reactivate the reminder. Do you want to continue?'),
                    function() {
                        frappe.call({
                            method: 'frappe.client.set_value',
                            args: {
                                doctype: 'Issue Requirements Reminders',
                                name: frm.doc.name,
                                fieldname: 'reminder_status',
                                value: 'Active'
                            },
                            callback: function(r) {
                                if (r.message) {
                                    frappe.show_alert({
                                        message: __('Reminder activated'),
                                        indicator: 'green'
                                    });
                                    frm.refresh();
                                }
                            }
                        });
                    }
                );
            });
        }

        // Add buttons to enable/disable the reminder
        if (frm.doc.docstatus === 1) {
            if (frm.doc.enabled) {
                frm.add_custom_button(__('Disable'), function() {
                    frappe.call({
                        method: 'frappe.client.set_value',
                        args: {
                            doctype: 'Issue Requirements Reminders',
                            name: frm.doc.name,
                            fieldname: 'enabled',
                            value: 0
                        },
                        callback: function(r) {
                            if (r.message) {
                                frappe.show_alert({
                                    message: __('Reminder disabled'),
                                    indicator: 'orange'
                                });
                                frm.refresh();
                            }
                        }
                    });
                }, __('Actions'));
            } else {
                frm.add_custom_button(__('Enable'), function() {
                    frappe.call({
                        method: 'frappe.client.set_value',
                        args: {
                            doctype: 'Issue Requirements Reminders',
                            name: frm.doc.name,
                            fieldname: 'enabled',
                            value: 1
                        },
                        callback: function(r) {
                            if (r.message) {
                                frappe.show_alert({
                                    message: __('Reminder enabled'),
                                    indicator: 'green'
                                });
                                frm.refresh();
                            }
                        }
                    });
                }, __('Actions'));
            }
        }

        // Set initial visibility of fields based on remind_on value
        frm.trigger('remind_on');
    },

    // Show/hide specific date field based on remind_on selection
    remind_on: function(frm) {
        // Toggle fields based on remind_on type
        if (frm.doc.remind_on === 'Specific Date') {
            frm.set_df_property('date_to_remind', 'reqd', 1);
            frm.set_df_property('date_to_remind', 'hidden', 0);
            frm.set_df_property('frequency', 'hidden', 1);
            frm.set_df_property('frequency', 'reqd', 0);
        } else {
            frm.set_df_property('date_to_remind', 'reqd', 0);
            frm.set_df_property('date_to_remind', 'hidden', 1);
            frm.set_df_property('frequency', 'hidden', 0);
            frm.set_df_property('frequency', 'reqd', 1);
        }

        // Clear values that should not be set
        if (frm.doc.remind_on === 'Specific Date' && frm.doc.frequency) {
            frm.set_value('frequency', '');
        } else if (frm.doc.remind_on === 'Frequency' && frm.doc.date_to_remind) {
            frm.set_value('date_to_remind', '');
        }
    },

    // Set next reminder date before saving
    before_save: function(frm) {
        if (!frm.doc.next_date) {
            frm.call('set_next_date');
        }
    }
}); 
// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on('Recurring Meeting Schedule', {
    refresh: function(frm) {
        // Add custom buttons
        if (!frm.doc.__islocal) {
            frm.add_custom_button(__('Create Test Meeting'), function() {
                frappe.call({
                    method: "create_test_meeting",
                    doc: frm.doc,
                    callback: function(r) {
                        if (r.message) {
                            frappe.msgprint(__('Test meeting created: {0}', [r.message]));
                            frm.reload_doc();
                        }
                    }
                });
            }, __("Actions"));

            frm.add_custom_button(__('Preview Next Meetings'), function() {
                frappe.call({
                    method: "preview_next_meetings",
                    doc: frm.doc,
                    args: {
                        count: 10
                    },
                    callback: function(r) {
                        if (r.message) {
                            show_meeting_preview(r.message);
                        }
                    }
                });
            }, __("Actions"));
        }

        // Set indicators
        if (frm.doc.is_enabled) {
            frm.dashboard.set_headline_alert(__('Schedule is Active'), 'green');
        } else {
            frm.dashboard.set_headline_alert(__('Schedule is Disabled'), 'red');
        }
    },

    meeting_templet: function(frm) {
        if (frm.doc.meeting_templet) {
            // Fetch template details and populate time fields if not set
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Meeting Templets',
                    name: frm.doc.meeting_templet,
                },
                callback: function(r) {
                    if (r.message) {
                        const template = r.message;
                        
                        // Show template info
                        frappe.msgprint(__('Template loaded: {0}', [template.template_name]));
                        
                        // If time fields are empty, suggest default times
                        if (!frm.doc.time_fromeg && !frm.doc.time_toeg) {
                            frappe.prompt([
                                {
                                    label: 'Set Default Meeting Time',
                                    fieldname: 'set_time',
                                    fieldtype: 'Check',
                                    default: 1
                                },
                                {
                                    label: 'Start Time (EG)',
                                    fieldname: 'start_time',
                                    fieldtype: 'Time',
                                    default: '09:00:00',
                                    depends_on: 'set_time'
                                },
                                {
                                    label: 'End Time (EG)',
                                    fieldname: 'end_time',
                                    fieldtype: 'Time',
                                    default: '10:00:00',
                                    depends_on: 'set_time'
                                }
                            ], function(values) {
                                if (values.set_time) {
                                    frm.set_value('time_fromeg', values.start_time);
                                    frm.set_value('time_toeg', values.end_time);
                                }
                            }, __('Set Meeting Times'), __('Set Times'));
                        }
                    }
                }
            });
        }
    },

    time_fromeg: function(frm) {
        calculate_uae_times(frm);
        calculate_duration(frm);
    },

    time_toeg: function(frm) {
        calculate_uae_times(frm);
        calculate_duration(frm);
    },

    frequency: function(frm) {
        update_next_run_date(frm);
    },

    start_date: function(frm) {
        update_next_run_date(frm);
    }
});

function calculate_uae_times(frm) {
    if (frm.doc.time_fromeg) {
        let time_fromeg = moment(frm.doc.time_fromeg, "HH:mm:ss");
        let time_fromuae = time_fromeg.clone().add(1, 'hours').format("HH:mm:ss");
        frm.set_value('time_fromuae', time_fromuae);
    }

    if (frm.doc.time_toeg) {
        let time_toeg = moment(frm.doc.time_toeg, "HH:mm:ss");
        let time_touae = time_toeg.clone().add(1, 'hours').format("HH:mm:ss");
        frm.set_value('time_touae', time_touae);
    }
}

function calculate_duration(frm) {
    if (frm.doc.time_fromeg && frm.doc.time_toeg) {
        let time_fromeg = moment(frm.doc.time_fromeg, "HH:mm:ss");
        let time_toeg = moment(frm.doc.time_toeg, "HH:mm:ss");

        if (time_toeg.isBefore(time_fromeg)) {
            frappe.msgprint(__('End time cannot be before start time.'));
            frm.set_value('duration', null);
            return;
        }

        let duration = moment.duration(time_toeg.diff(time_fromeg));
        let duration_in_seconds = duration.asSeconds();

        frm.set_value('duration', duration_in_seconds);
    }
}

function update_next_run_date(frm) {
    if (frm.doc.start_date && !frm.doc.next_run_date) {
        frm.set_value('next_run_date', frm.doc.start_date);
    }
}

function show_meeting_preview(meetings) {
    let html = '<table class="table table-bordered"><thead><tr><th>Date</th><th>Day</th><th>Time (EG)</th><th>Time (UAE)</th></tr></thead><tbody>';
    
    meetings.forEach(function(meeting) {
        html += `<tr>
            <td>${meeting.date}</td>
            <td>${meeting.day}</td>
            <td>${meeting.time_eg}</td>
            <td>${meeting.time_uae}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    
    frappe.msgprint({
        title: __('Next Meeting Dates Preview'),
        message: html,
        wide: true
    });
} 
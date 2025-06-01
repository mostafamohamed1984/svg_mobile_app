frappe.ui.form.on('Meeting', {
    meeting_templet: function (frm) {
        if (frm.doc.meeting_templet) {
            // Fetch the selected Meeting Templet document
            frappe.call({
                method: 'frappe.client.get',
                args: {
                    doctype: 'Meeting Templets',
                    name: frm.doc.meeting_templet,
                },
                callback: function (r) {
                    if (r.message) {
                        const templet = r.message;

                        // Map fields from Meeting Templet to Meeting
                        frm.set_value('department', templet.department);
                        frm.set_value('meeting_type', templet.meeting_type);
                        frm.set_value('venue', templet.venue);
                        frm.set_value('subject', templet.subject);
                        frm.set_value('meeting_link', templet.meeting_link);

                        // Clear and update the agenda table
                        frm.clear_table('agenda');
                        if (templet.agenda) {
                            templet.agenda.forEach(item => {
                                const row = frm.add_child('agenda');
                                row.agenda = item.agenda;
                               
                            });
                        }

                        // Clear and update the participants table
                        frm.clear_table('participants');
                        if (templet.participants) {
                            templet.participants.forEach(item => {
                                const row = frm.add_child('participants');
                                row.employee = item.employee;
                                row.employee_name = item.employee_name;
                                row.email = item.email;
                                row.joining_type = item.joining_type;
                            });
                        }

                        // Refresh the form to show the changes
                        frm.refresh_fields();
                    }
                },
                error: function (err) {
                    frappe.msgprint(__('Failed to fetch Meeting Templet details.'));
                }
            });
        } else {
            // Clear fields and tables if no templet is selected
            frm.set_value('department', '');
            frm.set_value('meeting_type', '');
            frm.set_value('venue', '');
            frm.clear_table('agenda');
            frm.clear_table('participants');
            frm.refresh_fields();
        }
    }
});

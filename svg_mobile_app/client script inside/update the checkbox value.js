frappe.ui.form.on('Meeting', {
    send_invitations: function(frm) {
        // Check current state and toggle with appropriate message
        if (frm.doc.invitations_sent == 1) {
            frm.set_value('invitations_sent', 0);
            frappe.msgprint(__('Invitations status reset. Click again to send invitations.'));
        } else {
            frm.set_value('invitations_sent', 1);
            frappe.msgprint(__('Invitations have been sent to all participants.'));
            
            // TODO: Add actual email sending logic here
            // frappe.call({
            //     method: "svg_mobile_app.api.send_meeting_invitations",
            //     args: {
            //         meeting_name: frm.doc.name
            //     },
            //     callback: function(r) {
            //         if (r.message) {
            //             frappe.msgprint(__('Email invitations sent successfully'));
            //         }
            //     }
            // });
        }

        // Save the document to persist the change
        frm.save();
    }
});

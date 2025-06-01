frappe.ui.form.on('Meeting', {
    time_fromeg: function(frm) {
        if (frm.doc.time_fromeg) {
            let time_fromeg = moment(frm.doc.time_fromeg, "HH:mm:ss");
            let time_fromuae = time_fromeg.clone().add(1, 'hours').format("HH:mm:ss");
            frm.set_value('time_fromuae', time_fromuae);
        }
        calculate_duration(frm);
    },

    time_toeg: function(frm) {
        if (frm.doc.time_toeg) {
            let time_toeg = moment(frm.doc.time_toeg, "HH:mm:ss");
            let time_touae = time_toeg.clone().add(1, 'hours').format("HH:mm:ss");
            frm.set_value('time_touae', time_touae);
        }
        calculate_duration(frm);
    }
});

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
        let duration_in_seconds = duration.asSeconds(); // Convert duration to seconds

        frm.set_value('duration', duration_in_seconds); // Set duration in seconds
    }
}

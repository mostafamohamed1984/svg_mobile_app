frappe.ui.form.on('Overtime Request', {
    refresh: function(frm) {
        calculate_duration(frm);
    }
});

function calculate_duration(frm) {
    if (frm.doc.time_from && frm.doc.time_to) {
        // Parse the time strings into Date objects
        const [fromHours, fromMinutes] = frm.doc.time_from.split(':').map(Number);
        const [toHours, toMinutes] = frm.doc.time_to.split(':').map(Number);

        // Create Date objects for calculation
        const timeFrom = new Date(0, 0, 0, fromHours, fromMinutes, 0);
        const timeTo = new Date(0, 0, 0, toHours, toMinutes, 0);

        let duration = (timeTo - timeFrom) / (1000 * 60 * 60); // Difference in hours
        if (duration < 0) {
            // Adjust for cases where time_to is on the next day
            duration += 24;
        }

        frm.set_value('duration', parseFloat(duration.toFixed(2)));
    } else {
        frm.set_value('duration', 0);
    }
}

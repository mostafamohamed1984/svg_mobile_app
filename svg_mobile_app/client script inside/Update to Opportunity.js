frappe.ui.form.on('Sketch', {
    refresh: function(frm) {
        // Check existing rows on load
        check_for_meetings(frm);
    },

    sketch_follow_up_add: function(frm, cdt, cdn) {
        handle_meeting_row(frm, cdt, cdn);
    },

    sketch_follow_up_row_update: function(frm, cdt, cdn) {
        handle_meeting_row(frm, cdt, cdn);
    }
});

function check_for_meetings(frm) {
    if (frm.doc.sketch_follow_up) {
        let has_meeting = frm.doc.sketch_follow_up.some(row => row.type === 'Meeting');
        if (has_meeting && frm.doc.stage !== 'Opportunity') {
            update_stage_and_save(frm);
        }
    }
}

function handle_meeting_row(frm, cdt, cdn) {
    let row = frappe.get_doc(cdt, cdn);
    if (row.type === 'Meeting' && frm.doc.stage !== 'Opportunity') {
        update_stage_and_save(frm);
    }
}

function update_stage_and_save(frm) {
    frm.set_value('stage', 'Opportunity');

    // Show saving indicator
    let saving_dialog = frappe.show_alert(__('Saving changes...'), 5);

    // Save the document
    frm.save().then(() => {
        saving_dialog.hide();
        frappe.show_alert({
            message: __('Stage updated to "Opportunity" and document saved'),
            indicator: 'green'
        }, 5);
    }).catch(() => {
        saving_dialog.hide();
        frappe.show_alert({
            message: __('Error saving document'),
            indicator: 'red'
        }, 5);
    });
}

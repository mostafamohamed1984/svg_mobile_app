frappe.ui.form.on('Sketch', {
    refresh: function (frm) {
        render_notes_section(frm);
    },
    notes_on_form_rendered: function (frm) {
        render_notes_section(frm);
    }
});

function render_notes_section(frm) {
    let html_content = `<div class="d-flex justify-content-end mb-2">
    <button class="btn btn-primary" onclick="add_new_note()">+ New Note</button>
</div>`;

    if (frm.doc.notes && frm.doc.notes.length > 0) {
        // Sort notes by creation date (most recent first)
        let sorted_notes = [...frm.doc.notes].sort((a, b) => {
            // Try to use added_on if available, otherwise fall back to creation date
            const a_date = a.added_on ? new Date(a.added_on) : (a.creation ? new Date(a.creation) : new Date(0));
            const b_date = b.added_on ? new Date(b.added_on) : (b.creation ? new Date(b.creation) : new Date(0));
            return b_date - a_date; // Descending order - newest first
        });

        sorted_notes.forEach((row, index) => {
            html_content += `
                <div class="card" style="border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 5px;">
                    <div style="display: flex; align-items: center;">
                        <div style="background: #007bff; color: white; width: 40px; height: 40px; border-radius: 50%; text-align: center; line-height: 40px; font-weight: bold;">
                            ${row.owner ? row.owner.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div style="margin-left: 10px;">
                            <strong>${row.owner || 'Unknown'}</strong><br>
                            <small>${frappe.datetime.str_to_user(row.creation)}</small>
                        </div>
                        <div style="margin-left: auto;">
                            <a href="#" onclick="edit_note(${frm.doc.notes.indexOf(row)})" style="margin-right: 10px;">
                                <i class="fa fa-pencil"></i>
                            </a>
                            <a href="#" onclick="delete_note(${frm.doc.notes.indexOf(row)})">
                                <i class="fa fa-trash"></i>
                            </a>
                        </div>
                    </div>
                    <p style="margin-top: 10px;">${row.note || ''}</p>
                </div>`;
        });
    } else {
        html_content += `<p>No notes available.</p>`;
    }

    frm.set_df_property('notes_html', 'options', html_content);
}

// Function to Add a New Note
window.add_new_note = function () {
    let d = new frappe.ui.Dialog({
        title: "Add Note",
        fields: [
            {
                label: "Note",
                fieldname: "note",
                fieldtype: "Small Text",
                reqd: 1
            }
        ],
        primary_action_label: "Save",
        primary_action(values) {
            let new_note = cur_frm.add_child("notes"); // Correctly adds a row to the table

            new_note.note = values.note;
            new_note.added_by = frappe.session.user_fullname;
            new_note.added_on = frappe.datetime.now_datetime();

            cur_frm.refresh_field("notes"); // Refresh table to update indices
            
            // Save the form explicitly for the new note
            cur_frm.save()
                .then(() => {
                    render_notes_section(cur_frm);  // Refresh HTML section after successful save
                    frappe.show_alert({ message: "Note added successfully", indicator: "green" });
                })
                .catch((error) => {
                    frappe.show_alert({
                        message: "Failed to add the note: " + (error.message || "Unknown error"),
                        indicator: "red" 
                    });
                    // Refresh the form to sync with server state
                    cur_frm.reload_doc();
                });

            d.hide();
        }
    });

    d.show();
};

// Function to Edit an Existing Note
window.edit_note = function (index) {
    if (!cur_frm.doc.notes || index >= cur_frm.doc.notes.length || index < 0) {
        frappe.show_alert({ message: "Invalid note selection.", indicator: "red" });
        return;
    }

    let row = cur_frm.doc.notes[index]; // Get the row from the child table
    if (!row) {
        frappe.show_alert({ message: "Selected note does not exist.", indicator: "red" });
        return;
    }

    let existing_note = row.note || "";

    let d = new frappe.ui.Dialog({
        title: "Edit Note",
        fields: [
            {
                label: "Note",
                fieldname: "note",
                fieldtype: "Small Text",
                default: existing_note, // Use original note content
                reqd: 1
            }
        ],
        primary_action_label: "Update",
        primary_action(values) {
            row.note = values.note; // Update the child table record
            row.__unsaved = 1; // Mark row as dirty

            cur_frm.dirty(); // Mark form as changed
            
            // Save the form explicitly first
            cur_frm.save()
                .then(() => {
                    // Refresh the child table
                    cur_frm.refresh_field("notes");
                    // Re-render the HTML section after successful save
                    render_notes_section(cur_frm);
                    frappe.show_alert({ message: "Note updated successfully", indicator: "green" });
                })
                .catch((error) => {
                    frappe.show_alert({
                        message: "Failed to save changes: " + (error.message || "Unknown error"),
                        indicator: "red"
                    });
                });

            d.hide();
        }
    });

    d.show();
};

// Function to Delete a Note
window.delete_note = function (index) {
    frappe.confirm("Are you sure you want to delete this note?", function () {
        if (!cur_frm.doc.notes || index >= cur_frm.doc.notes.length || index < 0) {
            frappe.show_alert({ message: "Invalid note selection.", indicator: "red" });
            return;
        }
        
        try {
            // More direct method to remove the row from the child table
            cur_frm.doc.notes.splice(index, 1);
            
            // Mark as dirty to indicate changes
            cur_frm.dirty();
            
            // Refresh the UI for the child table
            cur_frm.refresh_field("notes");
            
            // Save the form to ensure the deletion is stored in the database
            cur_frm.save()
                .then(() => {
                    // Re-render the notes section after successful saving
                    render_notes_section(cur_frm);
                    frappe.show_alert({ message: "Note deleted successfully", indicator: "green" });
                })
                .catch((error) => {
                    // Handle error and provide clear message
                    frappe.show_alert({
                        message: "Failed to delete the note: " + (error.message || "Unknown error"),
                        indicator: "red"
                    });
                    
                    // Refresh the form to sync with server state
                    cur_frm.reload_doc();
                });
        } catch (e) {
            frappe.show_alert({
                message: "An error occurred while trying to delete: " + e.message,
                indicator: "red"
            });
            console.error("Delete error:", e);
            cur_frm.reload_doc();
        }
    });
};

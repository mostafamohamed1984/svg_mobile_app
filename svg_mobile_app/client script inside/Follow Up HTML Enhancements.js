frappe.ui.form.on('Sketch', {
    refresh: function (frm) {
        render_follow_up_section(frm);
    },
    sketch_follow_up_on_form_rendered: function (frm) {
        render_follow_up_section(frm);
    }
});

function render_follow_up_section(frm) {
    let html_content = `<div class="d-flex justify-content-end mb-2">
        <button class="btn btn-primary" onclick="add_new_follow_up()">+ New Follow-Up</button>
    </div>
    <div class="d-flex flex-wrap" style="gap: 10px;">`; // Flex container for cards

    if (frm.doc.sketch_follow_up && frm.doc.sketch_follow_up.length > 0) {
        // Sort follow-ups by time (most recent first)
        // Using a copy of the array to avoid modifying the original
        let sorted_follow_ups = [...frm.doc.sketch_follow_up].sort((a, b) => {
            // First try to use the time field
            const a_date = a.time ? new Date(a.time) : (a.creation ? new Date(a.creation) : new Date(0));
            const b_date = b.time ? new Date(b.time) : (b.creation ? new Date(b.creation) : new Date(0));
            return b_date - a_date; // Descending order - newest first
        });

        sorted_follow_ups.forEach((row) => {
            // Find the original index in the actual array for edit/delete operations
            const original_index = frm.doc.sketch_follow_up.indexOf(row);
            
            // Determine card color based on status
            let cardColor = "";
            switch (row.status) {
                case "Completed":
                    cardColor = "background: #e6f4ea;"; // Green
                    break;
                case "Open":
                    cardColor = "background: #fff3e0;"; // Yellow
                    break;
                case "Cancelled":
                    cardColor = "background: #dedede;"; // Red
                    break;
                default:
                    cardColor = "background: #f5f5f5;"; // Default
            }

            html_content += `
                <div class="card" style="flex: 1 1 calc(50% - 10px); ${cardColor} border-radius: 25px; padding: 20px; margin-bottom: 10px; transition: transform 0.2s, box-shadow 0.2s;">
                    <div style="display: flex; align-items: center;">
                        <div style="background: #007bff; color: white; width: 40px; height: 40px; border-radius: 50%; text-align: center; line-height: 40px; font-weight: bold;">
                            ${row.owner ? row.owner.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div style="margin-left: 10px;">
                            <strong style="font-size: 18px;">${row.subject || 'No Subject'}</strong><br>
                            <small><strong>Follow Up Time:</strong> ${frappe.datetime.str_to_user(row.time)}</small>
                        </div>
                        <div style="margin-left: auto;">
                            <a href="#" onclick="edit_follow_up(${original_index})" style="margin-right: 10px; color: #007bff; font-size: 18px;">
                                <i class="fa fa-pencil"></i>
                            </a>
                            <a href="#" onclick="delete_follow_up(${original_index})" style="color: #ea4335; font-size: 18px;">
                                <i class="fa fa-trash"></i>
                            </a>
                        </div>
                    </div>
                    <p style="margin-top: 10px;"><strong>Type:</strong> ${row.type || 'N/A'}</p>
                    <p><strong>Status:</strong> ${row.status || 'Open'}</p>
                    <p><strong>Feedback:</strong> ${row.feedback || ''}</p>
                    <p><small><strong>Last Updated:</strong> ${frappe.datetime.str_to_user(row.modified || row.creation)}</small></p>
                </div>`;
        });
    } else {
        html_content += `<p>No follow-ups available.</p>`;
    }

    html_content += `</div>`; // Close the flex container

    frm.set_df_property('follow_up_html', 'options', html_content);
}

window.add_new_follow_up = function () {
    let d = new frappe.ui.Dialog({
        title: "Add Follow-Up",
        fields: [
            {
                label: "Subject",
                fieldname: "subject",
                fieldtype: "Data",
                reqd: 1
            },
            {
                label: "Type",
                fieldname: "type",
                fieldtype: "Select",
                options: ["Meeting", "Call", "Send Email", "Receiving Email", "Other"],
                reqd: 1
            },
            {
                label: "Time",
                fieldname: "time",
                fieldtype: "Datetime",
                reqd: 1,
                default: frappe.datetime.now_datetime()
            },
            {
                label: "Status",
                fieldname: "status",
                fieldtype: "Select",
                options: ["Open", "Completed", "Cancelled"],
                reqd: 1,
                default: "Open"
            },
            {
                label: "Feedback",
                fieldname: "feedback",
                fieldtype: "Small Text"
            }
        ],
        primary_action_label: "Save",
        primary_action(values) {
            let new_entry = cur_frm.add_child("sketch_follow_up");

            new_entry.subject = values.subject;
            new_entry.type = values.type;
            new_entry.time = values.time;
            new_entry.status = values.status;
            new_entry.feedback = values.feedback;

            cur_frm.refresh_field("sketch_follow_up");
            
            // Save the form explicitly
            cur_frm.save()
                .then(() => {
                    // Re-render the follow-up section after successful save
                    render_follow_up_section(cur_frm);
                    // Only show final success message
                    frappe.show_alert({ message: "Follow-up added successfully", indicator: "green" });
                })
                .catch((error) => {
                    frappe.show_alert({
                        message: "Failed to save the follow-up: " + (error.message || "Unknown error"),
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

// Function to Edit an Existing Follow-Up
window.edit_follow_up = function (index) {
    if (!cur_frm.doc.sketch_follow_up || index >= cur_frm.doc.sketch_follow_up.length || index < 0) {
        frappe.show_alert({ message: "Invalid follow-up selection.", indicator: "red" });
        return;
    }

    let follow_up = cur_frm.doc.sketch_follow_up[index];

    let d = new frappe.ui.Dialog({
        title: "Edit Follow-Up",
        fields: [
            { label: "Subject", fieldname: "subject", fieldtype: "Data", default: follow_up.subject, reqd: 1 },
            { label: "Type", fieldname: "type", fieldtype: "Select", options: ["Meeting", "Call", "Send Email", "Receiving Email", "Other"], default: follow_up.type, reqd: 1 },
            { label: "Time", fieldname: "time", fieldtype: "Datetime", default: follow_up.time, reqd: 1 },
            { label: "Status", fieldname: "status", fieldtype: "Select", options: ["Open", "Completed", "Cancelled"], default: follow_up.status, reqd: 1 },
            { label: "Feedback", fieldname: "feedback", fieldtype: "Small Text", default: follow_up.feedback }
        ],
        primary_action_label: "Update",
        primary_action(values) {
            // Update the child table row
            Object.assign(follow_up, values); // Update all fields
            follow_up.__unsaved = 1; // Mark row as dirty

            // Mark the form as dirty
            cur_frm.dirty();

            // Save the form explicitly first
            cur_frm.save()
                .then(() => {
                    // Refresh the child table
                    cur_frm.refresh_field("sketch_follow_up");
                    // Re-render the HTML section after successful save
                    render_follow_up_section(cur_frm);
                    // Only show final success message
                    frappe.show_alert({ message: "Follow-up updated successfully", indicator: "green" });
                })
                .catch((error) => {
                    frappe.show_alert({
                        message: "Failed to save changes: " + (error.message || "Unknown error"),
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

window.delete_follow_up = function (index) {
    frappe.confirm("Are you sure you want to delete this follow-up?", function () {
        if (!cur_frm.doc.sketch_follow_up || index >= cur_frm.doc.sketch_follow_up.length || index < 0) {
            frappe.show_alert({ message: "Invalid follow-up selection.", indicator: "red" });
            return;
        }
        
        try {
            // More direct method to remove the row from the child table
            cur_frm.doc.sketch_follow_up.splice(index, 1);
            
            // Mark as dirty to indicate changes
            cur_frm.dirty();
            
            // Refresh the UI for the child table
            cur_frm.refresh_field("sketch_follow_up");
            
            // Save the form to ensure the deletion is stored in the database
            cur_frm.save()
                .then(() => {
                    // Re-render the follow-up section after successful save
                    render_follow_up_section(cur_frm);
                    // Only show final success message
                    frappe.show_alert({ message: "Follow-up deleted successfully", indicator: "green" });
                })
                .catch((error) => {
                    // Handle error and provide clear message
                    frappe.show_alert({
                        message: "Failed to delete the follow-up: " + (error.message || "Unknown error"),
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

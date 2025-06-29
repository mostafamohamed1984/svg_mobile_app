// Client Script for Remote Access DocType
frappe.ui.form.on('Remote Access', {
    onload: function(frm) {
        // Store original values when form loads
        if (frm.doc.name) {
            frm.doc.__original_status = frm.doc.status;
            frm.doc.__original_password = frm.doc.password;
            frm.doc.__original_assign_to = frm.doc.assign_to;
        }
    },
    
    refresh: function(frm) {
        // Show custom buttons only when status is "Available"
        if (frm.doc.status === "Available") {
            // Add "Assign Temporarily" button
            frm.add_custom_button(__('Assign Temporarily'), function() {
                show_assign_dialog(frm, 'Temporary');
            }, __('Actions'));
            
            // Add "Reserve" button
            frm.add_custom_button(__('Reserve'), function() {
                show_assign_dialog(frm, 'Reserved');
            }, __('Actions'));
        }
        
        // Show "Mark as Available" button when status is "Reserved" or "Temporary"
        if (frm.doc.status === "Reserved" || frm.doc.status === "Temporary") {
            frm.add_custom_button(__('Mark as Available'), function() {
                frappe.confirm(
                    __('Are you sure you want to mark this remote access as available? This will clear the assigned employee and generate a new password.'),
                    function() {
                        change_to_available(frm);
                    }
                );
            }, __('Actions'));
        }
        
        // Add password indicator
        if (frm.doc.password) {
            frm.dashboard.add_indicator(__('Password Set'), 'green');
        }
    },
    
    before_save: function(frm) {
        // Check if status is changing to Available
        if (frm.doc.status === "Available" && frm.doc.__original_status !== "Available") {
            // Generate new password when changing to Available
            generate_new_password(frm);
        }
    },
    
    after_save: function(frm) {
        // Create log entry for any significant changes
        if (should_create_log(frm)) {
            create_remote_access_log(frm);
        }
        
        // Update original values after save
        update_original_values(frm);
    }
});

// Function to show assignment dialog
function show_assign_dialog(frm, status_type) {
    let dialog = new frappe.ui.Dialog({
        title: __(status_type === 'Temporary' ? 'Assign Remote Access Temporarily' : 'Reserve Remote Access'),
        fields: [
            {
                fieldname: 'employee',
                fieldtype: 'Link',
                label: __('Select Employee'),
                options: 'Employee',
                reqd: 1
            }
        ],
        primary_action_label: __(status_type === 'Temporary' ? 'Assign' : 'Reserve'),
        primary_action: function(values) {
            assign_to_employee(frm, values.employee, status_type);
            dialog.hide();
        }
    });
    
    dialog.show();
}

// Function to assign to employee
function assign_to_employee(frm, employee, status_type) {
    // Store old values
    let old_values = {
        status: frm.doc.status,
        assign_to: frm.doc.assign_to,
        password: frm.doc.password
    };
    
    // Update the document fields
    frm.set_value('assign_to', employee);
    frm.set_value('status', status_type);
    
    // Refresh fields to get updated user field
    frm.refresh_field('user');
    
    // Save the document
    frm.save().then(() => {
        let message = status_type === 'Temporary' ? 
            __('Remote access has been assigned temporarily.<br><strong>Password:</strong> {0}', [frm.doc.password || 'Not set']) :
            __('Remote access has been reserved for the selected employee.');
        
        frappe.msgprint({
            title: __(status_type === 'Temporary' ? 'Remote Access Assigned' : 'Remote Access Reserved'),
            message: message,
            indicator: 'green'
        });
    });
}

// Function to change status to Available
function change_to_available(frm) {
    // Store old values
    let old_values = {
        status: frm.doc.status,
        assign_to: frm.doc.assign_to,
        password: frm.doc.password
    };
    
    // Clear assignment and change status
    frm.set_value('assign_to', '');
    frm.set_value('status', 'Available');
    
    // Generate new password
    generate_new_password(frm);
    
    // Refresh fields
    frm.refresh_field('user');
    frm.refresh_field('assign_to');
    frm.refresh_field('password');
    
    // Save the document
    frm.save().then(() => {
        frappe.msgprint({
            title: __('Remote Access Available'),
            message: __('Remote access has been marked as available, employee assignment cleared, and new password generated.'),
            indicator: 'green'
        });
    });
}

// Function to generate new password
function generate_new_password(frm) {
    // Generate 8-character alphanumeric password
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    frm.set_value('password', password);
    return password;
}

// Function to check if log should be created
function should_create_log(frm) {
    if (!frm.doc.name || frm.doc.__islocal) return false;
    
    // Create log if status changed, password changed, or assignment changed
    return (
        frm.doc.__original_status !== frm.doc.status ||
        frm.doc.__original_password !== frm.doc.password ||
        frm.doc.__original_assign_to !== frm.doc.assign_to
    );
}

// Function to create Remote Access Log
function create_remote_access_log(frm) {
    let action_type = 'Record Updated';
    
    // Determine action type based on changes
    if (frm.doc.__original_status !== frm.doc.status) {
        if (frm.doc.status === 'Available') {
            action_type = 'Status Changed to Available';
        } else if (frm.doc.status === 'Reserved') {
            action_type = 'Status Changed to Reserved';
        } else if (frm.doc.status === 'Temporary') {
            action_type = 'Status Changed to Temporary';
        }
    }
    
    frappe.call({
        method: 'frappe.client.insert',
        args: {
            doc: {
                doctype: 'Remote Access Log',
                reference: frm.doc.name,
                id: frm.doc.id,
                old_password: frm.doc.__original_password || '',
                new_password: frm.doc.password,
                status: frm.doc.status,
                assign_to: frm.doc.assign_to,
                user: frm.doc.user,
                company: frm.doc.company,
                password_applied: 0
            }
        },
        callback: function(response) {
            if (response.message) {
                frappe.show_alert({
                    message: __('Remote Access Log created: {0}', [response.message.name]),
                    indicator: 'green'
                });
            }
        },
        error: function(error) {
            console.error('Failed to create Remote Access Log:', error);
        }
    });
}

// Function to update original values
function update_original_values(frm) {
    frm.doc.__original_status = frm.doc.status;
    frm.doc.__original_password = frm.doc.password;
    frm.doc.__original_assign_to = frm.doc.assign_to;
}
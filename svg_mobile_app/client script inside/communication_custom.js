// Custom script for Communication doctype to enforce email access control
frappe.ui.form.on('Communication', {
    refresh: function(frm) {
        // Check if this is an email communication
        if (frm.doc.communication_medium === 'Email' && frm.doc.email_account) {
            checkEmailAccess(frm);
        }
    }
});

function checkEmailAccess(frm) {
    // Get user's email access levels
    frappe.call({
        method: "svg_mobile_app.api.get_user_profile_data",
        callback: function(r) {
            if (r.message && r.message.status === "success") {
                const data = r.message.data;
                const workEmails = data.work_emails || [];
                
                // Check if current email account is a work email with restricted access
                const currentEmailAccount = frm.doc.email_account;
                const workEmail = workEmails.find(email => email.account_name === currentEmailAccount);
                
                if (workEmail && workEmail.access_type === "Read Only") {
                    // Hide reply and action buttons for read-only access
                    frm.page.clear_actions();
                    frm.page.clear_menu();
                    
                    // Add a message indicating read-only access
                    frm.dashboard.add_comment(
                        `<div class="alert alert-warning">
                            <i class="fa fa-lock"></i> 
                            You have Read Only access to this email account. 
                            Reply and actions are disabled.
                        </div>`,
                        'blue', true
                    );
                    
                    // Disable the reply button specifically
                    setTimeout(() => {
                        $('[data-label="Reply"]').hide();
                        $('[data-label="Reply All"]').hide();
                        $('[data-label="Forward"]').hide();
                    }, 100);
                }
            }
        }
    });
} 
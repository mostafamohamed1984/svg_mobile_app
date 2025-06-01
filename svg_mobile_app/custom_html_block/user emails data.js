// Use the custom server method to get user profile data safely
frappe.call({
    method: "svg_mobile_app.api.get_user_profile_data",
    callback: function(r) {
        if (r.message && r.message.status === "success") {
            const data = r.message.data;
            
            // Get references using root_element (ensure root_element exists)
            if (typeof root_element === 'undefined') {
                console.error('root_element is not defined');
                return;
            }
            
            let userImage = root_element.querySelector('.user-image');
            let userName = root_element.querySelector('.user-name');
            let userEmail = root_element.querySelector('.user-email');
            let userEmails = root_element.querySelector('.user-emails');
            
            // Check if all elements exist
            if (!userImage || !userName || !userEmail || !userEmails) {
                console.error('One or more required elements not found in the DOM');
                return;
            }
            
            // Set user information
            userName.textContent = data.full_name || frappe.session.user;
            userEmail.textContent = data.email || frappe.session.user;
            
            // Set user image
            if (data.user_image) {
                userImage.src = data.user_image;
                userImage.onerror = function() {
                    // Fallback to default image if user image fails to load
                    this.src = "/files/pngegg.png";
                };
            } else {
                // Use default image
                userImage.src = "/files/pngegg.png";
            }
            
            // Set user emails
            if (data.user_emails && data.user_emails.length > 0) {
                userEmails.textContent = data.user_emails.join(", ");
            } else {
                userEmails.textContent = "No additional emails found";
            }
            
        } else if (r.message && r.message.status === "error") {
            console.error('Server error:', r.message.message);
            // Set fallback values
            if (typeof root_element !== 'undefined') {
                let userName = root_element.querySelector('.user-name');
                let userEmail = root_element.querySelector('.user-email');
                let userEmails = root_element.querySelector('.user-emails');
                
                if (userName) userName.textContent = frappe.session.user_fullname || frappe.session.user;
                if (userEmail) userEmail.textContent = frappe.session.user;
                if (userEmails) userEmails.textContent = "Unable to load email data";
            }
        } else {
            console.error('Unexpected response format:', r);
            // Set fallback values
            if (typeof root_element !== 'undefined') {
                let userName = root_element.querySelector('.user-name');
                let userEmail = root_element.querySelector('.user-email');
                let userEmails = root_element.querySelector('.user-emails');
                
                if (userName) userName.textContent = frappe.session.user_fullname || frappe.session.user;
                if (userEmail) userEmail.textContent = frappe.session.user;
                if (userEmails) userEmails.textContent = "Unable to load email data";
            }
        }
    },
    error: function(xhr, status, error) {
        console.error('AJAX error:', error);
        // Set fallback values
        if (typeof root_element !== 'undefined') {
            let userName = root_element.querySelector('.user-name');
            let userEmail = root_element.querySelector('.user-email');
            let userEmails = root_element.querySelector('.user-emails');
            
            if (userName) userName.textContent = frappe.session.user_fullname || frappe.session.user;
            if (userEmail) userEmail.textContent = frappe.session.user;
            if (userEmails) userEmails.textContent = "Network error - unable to load email data";
        }
    }
});


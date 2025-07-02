# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class BCCProcessingSettings(Document):
    def validate(self):
        """Validate BCC Processing Settings"""
        if self.enable_bcc_processing and not self.gmail_forwarding_account:
            frappe.throw("Gmail Forwarding Account is required when BCC Processing is enabled")

        if self.max_recipients_per_email and self.max_recipients_per_email < 1:
            frappe.throw("Max Recipients Per Email must be at least 1")

        # Validate role-based forwarding settings
        if self.enable_role_based_forwarding:
            if not self.main_email_account:
                frappe.throw("Main Email Account is required when Role-Based Email Forwarding is enabled")
            if not self.engineer_role_name:
                frappe.throw("Engineer Role Name is required when Role-Based Email Forwarding is enabled")

            # Validate that the main email account exists
            if not frappe.db.exists("Email Account", self.main_email_account):
                frappe.throw(f"Email Account '{self.main_email_account}' does not exist")

            # Validate that the role exists
            if not frappe.db.exists("Role", self.engineer_role_name):
                frappe.throw(f"Role '{self.engineer_role_name}' does not exist")
    
    def on_update(self):
        """Called when settings are updated"""
        if self.enable_bcc_processing:
            frappe.logger().info("BCC Processing has been enabled")
        else:
            frappe.logger().info("BCC Processing has been disabled")

        if self.enable_role_based_forwarding:
            frappe.logger().info(f"Role-Based Email Forwarding enabled for role: {self.engineer_role_name}")
        else:
            frappe.logger().info("Role-Based Email Forwarding has been disabled")

@frappe.whitelist()
def get_bcc_settings():
    """Get BCC processing settings"""
    try:
        if frappe.db.exists("BCC Processing Settings", "BCC Processing Settings"):
            return frappe.get_single("BCC Processing Settings")
        else:
            # Return default settings
            return {
                "enable_bcc_processing": 1,
                "gmail_forwarding_account": "constr.sv@gmail.com",
                "processing_method": "Hook",
                "preserve_original_headers": 1,
                "debug_mode": 0,
                "max_recipients_per_email": 10,
                "forwarding_subject_prefix": "[BCC-PROCESSED]",
                "enable_role_based_forwarding": 0,
                "main_email_account": "",
                "engineer_role_name": "Site Engineer",
                "forwarding_subject_prefix_role": "[ENGINEER-FORWARDED]"
            }
    except Exception as e:
        frappe.log_error(f"Error getting BCC settings: {str(e)}", "BCC Settings Error")
        return None

@frappe.whitelist()
def test_email_forwarding():
    """Test email forwarding to Gmail account"""
    try:
        settings = get_bcc_settings()
        if not settings:
            return {"status": "error", "message": "Could not load BCC settings"}
        
        gmail_account = settings.get("gmail_forwarding_account")
        if not gmail_account:
            return {"status": "error", "message": "No Gmail forwarding account configured"}
        
        # Validate Gmail account format
        if not gmail_account.endswith('@gmail.com'):
            return {"status": "error", "message": "Gmail account must be a valid Gmail address"}
        
        # Send test email with safe parameters
        try:
            frappe.sendmail(
                recipients=gmail_account,  # Pass as string instead of list
                subject="[TEST] BCC Processing Test Email",
                message="This is a test email to verify BCC processing forwarding is working correctly.",
                now=True
            )
            
            return {
                "status": "success", 
                "message": f"Test email sent successfully to {gmail_account}"
            }
            
        except Exception as send_error:
            return {
                "status": "error", 
                "message": f"Failed to send test email: {str(send_error)}"
            }
        
    except Exception as e:
        frappe.logger().error(f"Test email forwarding error: {str(e)}")
        return {"status": "error", "message": f"Test failed: {str(e)}"} 
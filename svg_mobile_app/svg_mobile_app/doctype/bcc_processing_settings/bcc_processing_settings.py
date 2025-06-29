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
    
    def on_update(self):
        """Called when settings are updated"""
        if self.enable_bcc_processing:
            frappe.logger().info("BCC Processing has been enabled")
        else:
            frappe.logger().info("BCC Processing has been disabled")

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
                "forwarding_subject_prefix": "[BCC-PROCESSED]"
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
        
        # Send test email
        frappe.sendmail(
            recipients=[gmail_account],
            subject="[TEST] BCC Processing Test Email",
            message="This is a test email to verify BCC processing forwarding is working correctly.",
            header={"X-Frappe-BCC-Test": "true"}
        )
        
        return {
            "status": "success", 
            "message": f"Test email sent successfully to {gmail_account}"
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)} 
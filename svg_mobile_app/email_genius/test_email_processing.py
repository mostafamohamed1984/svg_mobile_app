"""
Test Email Processing for BCC/CC Email Genius
"""

import frappe
import email
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

def create_test_email_with_bcc():
    """
    Create a test email with BCC recipients for testing
    """
    # Create a test email
    msg = MIMEMultipart()
    msg['From'] = 'test@example.com'
    msg['To'] = 'recipient1@example.com'
    msg['Cc'] = 'recipient2@example.com'
    msg['Bcc'] = 'recipient3@example.com, recipient4@example.com'
    msg['Subject'] = 'Test Email with BCC/CC Recipients'
    msg['Message-ID'] = '<test123@example.com>'
    
    # Add body
    body = "This is a test email with multiple recipients for BCC processing."
    msg.attach(MIMEText(body, 'plain'))
    
    return msg.as_string()

@frappe.whitelist()
def test_bcc_interception():
    """
    Test the BCC email interception functionality
    """
    try:
        from svg_mobile_app.email_genius.email_processor import intercept_incoming_email, is_bcc_processing_enabled
        
        # Check if BCC processing is enabled
        enabled = is_bcc_processing_enabled()
        if not enabled:
            return {
                "status": "warning",
                "message": "BCC processing is disabled in settings"
            }
        
        # Create test email
        test_email = create_test_email_with_bcc()
        
        # Test the interception
        processed_email = intercept_incoming_email("test_account", test_email)
        
        # Parse both emails to compare
        original = email.message_from_string(test_email)
        processed = email.message_from_string(processed_email)
        
        return {
            "status": "success",
            "message": "BCC interception test completed",
            "results": {
                "original_message_id": original.get('Message-ID'),
                "processed_message_id": processed.get('Message-ID'),
                "original_recipients": {
                    "to": original.get('To'),
                    "cc": original.get('Cc'),
                    "bcc": original.get('Bcc')
                },
                "processed_recipients": {
                    "to": processed.get('To'),
                    "cc": processed.get('Cc'),
                    "bcc": processed.get('Bcc')
                },
                "bcc_headers": {
                    "original_message_id": processed.get('X-Frappe-Original-Message-ID'),
                    "recipient_type": processed.get('X-Frappe-Recipient-Type'),
                    "bcc_processed": processed.get('X-Frappe-BCC-Processed')
                }
            }
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Test failed: {str(e)}"
        }

@frappe.whitelist()
def test_email_forwarding():
    """
    Test the email forwarding to Gmail functionality
    """
    try:
        from svg_mobile_app.email_genius.email_processor import forward_email_copy
        
        # Create test email
        test_email_str = create_test_email_with_bcc()
        test_email_obj = email.message_from_string(test_email_str)
        
        # Test forwarding
        success = forward_email_copy(test_email_obj, "test_account", "test@example.com")
        
        return {
            "status": "success" if success else "error",
            "message": f"Email forwarding test {'passed' if success else 'failed'}",
            "forwarding_result": success
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Forwarding test failed: {str(e)}"
        }

@frappe.whitelist()
def test_full_bcc_workflow():
    """
    Test the complete BCC processing workflow
    """
    try:
        results = {}
        
        # Test 1: BCC Processing Settings
        from svg_mobile_app.email_genius.email_processor import is_bcc_processing_enabled
        results["bcc_enabled"] = is_bcc_processing_enabled()
        
        # Test 2: Email Interception
        interception_result = test_bcc_interception()
        results["interception"] = interception_result
        
        # Test 3: Email Forwarding
        forwarding_result = test_email_forwarding()
        results["forwarding"] = forwarding_result
        
        # Test 4: Settings Access
        try:
            from svg_mobile_app.svg_mobile_app.doctype.bcc_processing_settings.bcc_processing_settings import get_bcc_settings
            settings = get_bcc_settings()
            results["settings"] = {
                "accessible": True,
                "gmail_account": settings.get("gmail_forwarding_account") if settings else None,
                "processing_method": settings.get("processing_method") if settings else None
            }
        except Exception as e:
            results["settings"] = {
                "accessible": False,
                "error": str(e)
            }
        
        # Overall status
        all_passed = (
            results["bcc_enabled"] and
            interception_result.get("status") == "success" and
            forwarding_result.get("status") == "success" and
            results["settings"]["accessible"]
        )
        
        return {
            "status": "success" if all_passed else "warning",
            "message": f"Full workflow test {'passed' if all_passed else 'completed with issues'}",
            "detailed_results": results
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Full workflow test failed: {str(e)}"
        }

@frappe.whitelist()
def check_email_processing_status():
    """
    Check the current status of email processing configuration
    """
    try:
        status = {
            "bcc_processing_enabled": False,
            "gmail_account_configured": False,
            "hooks_configured": False,
            "settings_accessible": False,
            "recent_processed_emails": 0
        }
        
        # Check BCC processing
        from svg_mobile_app.email_genius.email_processor import is_bcc_processing_enabled
        status["bcc_processing_enabled"] = is_bcc_processing_enabled()
        
        # Check settings
        try:
            from svg_mobile_app.svg_mobile_app.doctype.bcc_processing_settings.bcc_processing_settings import get_bcc_settings
            settings = get_bcc_settings()
            if settings:
                status["settings_accessible"] = True
                gmail_account = settings.get("gmail_forwarding_account")
                status["gmail_account_configured"] = bool(gmail_account and "@gmail.com" in gmail_account)
        except:
            pass
        
        # Check hooks configuration
        try:
            from svg_mobile_app import hooks
            override_methods = getattr(hooks, 'override_whitelisted_methods', {})
            status["hooks_configured"] = "frappe.email.receive.pull_from_email_account" in override_methods
        except:
            pass
        
        # Check recent processed emails
        try:
            recent_count = frappe.db.count("Communication", {
                "custom_bcc_processed": 1,
                "creation": [">=", frappe.utils.add_days(frappe.utils.today(), -7)]
            })
            status["recent_processed_emails"] = recent_count
        except:
            pass
        
        return {
            "status": "success",
            "message": "Email processing status check completed",
            "configuration_status": status
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": f"Status check failed: {str(e)}"
        }

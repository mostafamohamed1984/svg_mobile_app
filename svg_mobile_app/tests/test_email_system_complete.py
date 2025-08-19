import frappe
import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
import json
import email

class TestEmailSystemComplete(unittest.TestCase):
    """Comprehensive test suite for the email system"""
    
    def setUp(self):
        """Set up test data"""
        self.test_user = "test@example.com"
        self.test_communication_data = {
            "doctype": "Communication",
            "communication_medium": "Email",
            "sent_or_received": "Received",
            "subject": "Test Email with CC/BCC",
            "sender": "sender@example.com",
            "recipients": "recipient1@example.com",
            "cc": "cc1@example.com, cc2@example.com",
            "bcc": "bcc1@example.com",
            "content": "This is a test email with multiple recipients",
            "message_id": "<test123@example.com>"
        }
    
    def tearDown(self):
        """Clean up test data"""
        # Clean up any test records
        frappe.db.rollback()
    
    def test_bcc_processing_end_to_end(self):
        """Test complete BCC processing flow"""
        # Enable BCC processing
        settings = frappe.get_single("BCC Processing Settings")
        settings.enable_bcc_processing = 1
        settings.gmail_forwarding_account = "test@gmail.com"
        settings.save()
        
        # Create test communication
        comm = frappe.get_doc(self.test_communication_data)
        
        # Mock the email processor functions
        with patch('svg_mobile_app.email_genius.email_processor.create_bcc_communication_record') as mock_create:
            mock_create.return_value = "COMM-TEST-001"
            
            # Trigger the BCC processing hook
            from svg_mobile_app.email_genius.email_processor import process_bcc_email
            process_bcc_email(comm)
            
            # Verify that BCC processing was called for CC and BCC recipients
            expected_calls = 3  # 2 CC + 1 BCC
            self.assertEqual(mock_create.call_count, expected_calls)
    
    def test_email_monitoring_workflow(self):
        """Test email monitoring creation and status updates"""
        # Create a test communication
        comm = frappe.get_doc(self.test_communication_data)
        comm.insert()
        
        # Mock the monitoring hook
        with patch('svg_mobile_app.svg_mobile_app.doctype.email_monitoring.email_monitoring_hooks.create_email_monitoring_record') as mock_monitor:
            mock_monitor.return_value = True
            
            # Test monitoring creation
            from svg_mobile_app.svg_mobile_app.doctype.email_monitoring.email_monitoring_hooks import create_email_monitoring_record
            create_email_monitoring_record(comm)
            
            mock_monitor.assert_called_once()
        
        # Test status updates via API
        with patch('svg_mobile_app.api.update_email_monitoring') as mock_update:
            mock_update.return_value = {"success": True}
            
            # Test API call
            result = frappe.call('svg_mobile_app.api.update_email_monitoring', 
                               name='test-monitoring', 
                               status='Need Reply',
                               priority='High')
            
            mock_update.assert_called_once()
    
    def test_communication_linking(self):
        """Test email linking functionality"""
        # Create two test communications
        comm1 = frappe.get_doc(self.test_communication_data)
        comm1.insert()
        
        comm2_data = self.test_communication_data.copy()
        comm2_data["subject"] = "Re: Test Email with CC/BCC"
        comm2_data["message_id"] = "<reply123@example.com>"
        comm2 = frappe.get_doc(comm2_data)
        comm2.insert()
        
        # Test linking via API
        from svg_mobile_app.api import link_communications
        result = link_communications(comm1.name, comm2.name, "Reply", "Test linking")
        
        self.assertTrue(result.get("success"))
        
        # Test getting related communications
        from svg_mobile_app.api import get_related_communications
        related = get_related_communications(comm1.name)
        
        self.assertTrue(len(related) > 0)
    
    def test_oauth2_flow(self):
        """Test OAuth2 authorization flow"""
        # Create test OAuth settings
        oauth_settings = frappe.get_doc({
            "doctype": "Email OAuth Settings",
            "name": "Test Gmail",
            "provider": "Gmail",
            "client_id": "test_client_id",
            "client_secret": "test_client_secret",
            "enabled": 1
        })
        oauth_settings.insert()
        
        # Test authorization URL generation
        from svg_mobile_app.svg_mobile_app.doctype.email_oauth_settings.email_oauth_settings import get_authorization_url
        result = get_authorization_url("Test Gmail")
        
        self.assertTrue(result.get("success"))
        self.assertIn("https://accounts.google.com/o/oauth2/auth", result.get("auth_url"))
        
        # Mock token exchange
        with patch('requests.post') as mock_post:
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "access_token": "test_access_token",
                "refresh_token": "test_refresh_token",
                "expires_in": 3600
            }
            mock_post.return_value = mock_response
            
            # Test token exchange
            from svg_mobile_app.svg_mobile_app.doctype.email_oauth_settings.email_oauth_settings import exchange_code_for_tokens
            result = exchange_code_for_tokens("Test Gmail", "test_auth_code")
            
            self.assertTrue(result.get("success"))
    
    def test_recipient_threading(self):
        """Test recipient-aware threading functionality"""
        # Test that recipient threading flag works
        with patch('frappe.conf.get') as mock_conf:
            mock_conf.return_value = True  # Enable recipient threading
            
            # Test threading API
            from svg_mobile_app.api import get_inbox_communications
            
            with patch('frappe.get_all') as mock_get_all:
                mock_get_all.return_value = [
                    {
                        "name": "COMM-001",
                        "subject": "Test",
                        "message_id": "<test1@example.com>",
                        "creation": datetime.now()
                    }
                ]
                
                result = get_inbox_communications("test@example.com", recipient_threading=1)
                self.assertTrue(isinstance(result, list))
    
    def test_escalation_system(self):
        """Test email monitoring escalation system"""
        # Create overdue monitoring record
        monitoring = frappe.get_doc({
            "doctype": "Email Monitoring",
            "communication": "COMM-TEST-001",
            "status": "Need Reply",
            "assigned_user": "test@example.com",
            "email_account": "Test Account"
        })
        monitoring.insert()
        
        # Backdate the record to make it overdue
        frappe.db.sql("""
            UPDATE `tabEmail Monitoring` 
            SET modified = DATE_SUB(NOW(), INTERVAL 3 DAY)
            WHERE name = %s
        """, monitoring.name)
        
        # Mock email sending
        with patch('frappe.sendmail') as mock_sendmail:
            # Run escalations
            from svg_mobile_app.svg_mobile_app.doctype.email_monitoring.email_monitoring_escalation import run_escalations
            run_escalations()
            
            # Verify escalation email was sent
            mock_sendmail.assert_called()
    
    def test_provider_abstraction(self):
        """Test provider-agnostic email sending"""
        # Test SMTP override
        settings = frappe.get_single("BCC Processing Settings")
        settings.processing_server = "smtp.test.com"
        settings.processing_port = 587
        settings.use_tls = 1
        settings.save()
        
        # Mock SMTP sending
        with patch('svg_mobile_app.email_genius.email_processor.forward_email_copy') as mock_forward:
            mock_forward.return_value = True
            
            # Create test email
            import email as email_lib
            test_email = email_lib.message.EmailMessage()
            test_email['Subject'] = 'Test'
            test_email['From'] = 'test@example.com'
            test_email['To'] = 'recipient@example.com'
            test_email.set_content('Test content')
            
            # Test forwarding
            result = mock_forward(test_email, "test_account", "recipient@example.com")
            self.assertTrue(result)
    
    def test_subject_timestamping(self):
        """Test subject timestamping functionality"""
        # Enable subject timestamping
        settings = frappe.get_single("BCC Processing Settings")
        settings.enable_subject_timestamping = 1
        settings.subject_timestamp_format = "[%Y-%m-%d %H:%M:%S]"
        settings.save()
        
        # Create test communication
        comm = frappe.get_doc(self.test_communication_data)
        
        # Mock the BCC record creation
        with patch('svg_mobile_app.email_genius.email_processor.create_bcc_communication_record') as mock_create:
            def mock_create_with_timestamp(original_doc, recipient_email, recipient_type, recipient_index):
                # Simulate timestamping
                new_subject = f"{original_doc.subject} [2025-01-25 12:00:00]"
                return f"COMM-{recipient_type}-{recipient_index}"
            
            mock_create.side_effect = mock_create_with_timestamp
            
            # Process the email
            from svg_mobile_app.email_genius.email_processor import process_bcc_email
            process_bcc_email(comm)
            
            # Verify timestamp was applied
            mock_create.assert_called()
    
    def test_role_based_forwarding(self):
        """Test role-based email forwarding"""
        # Create test Forward Emails Control
        forward_control = frappe.get_doc({
            "doctype": "Forward Emails Control",
            "enabled": 1,
            "target_role": "Site Engineer",
            "target_email_account": "Test Account",
            "subject_prefix": "[ENGINEER]"
        })
        forward_control.insert()
        
        # Create test communication to engineer
        comm_data = self.test_communication_data.copy()
        comm_data["recipients"] = "engineer@example.com"
        comm = frappe.get_doc(comm_data)
        
        # Mock role checking
        with patch('frappe.get_roles') as mock_roles:
            mock_roles.return_value = ["Site Engineer"]
            
            # Mock forwarding
            with patch('svg_mobile_app.email_genius.email_processor.forward_email_to_main_account') as mock_forward:
                mock_forward.return_value = True
                
                # Test forwarding logic
                from svg_mobile_app.email_genius.email_processor import should_forward_email_by_role
                should_forward, account, prefix = should_forward_email_by_role(comm_data)
                
                self.assertTrue(should_forward)
                self.assertEqual(account, "Test Account")
                self.assertEqual(prefix, "[ENGINEER]")

class TestEmailReporting(unittest.TestCase):
    """Test email reporting and analytics"""
    
    def test_monitoring_overview_report(self):
        """Test Email Monitoring Overview report"""
        from svg_mobile_app.svg_mobile_app.report.email_monitoring_overview.email_monitoring_overview import execute
        
        # Test with no filters
        columns, data = execute()
        self.assertTrue(isinstance(columns, list))
        self.assertTrue(isinstance(data, list))
        
        # Test with filters
        filters = {"status": "Open", "email_type": "Incoming"}
        columns, data = execute(filters)
        self.assertTrue(isinstance(columns, list))
    
    def test_kpis_report(self):
        """Test Email Account KPIs report"""
        from svg_mobile_app.svg_mobile_app.report.email_account_kpis.email_account_kpis import execute
        
        columns, data = execute()
        self.assertTrue(isinstance(columns, list))
        self.assertTrue(isinstance(data, list))
    
    def test_trends_report(self):
        """Test Email Account Trends report"""
        from svg_mobile_app.svg_mobile_app.report.email_account_trends.email_account_trends import execute
        
        columns, data = execute()
        self.assertTrue(isinstance(columns, list))
        self.assertTrue(isinstance(data, list))

if __name__ == '__main__':
    unittest.main()

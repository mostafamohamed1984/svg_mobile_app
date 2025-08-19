import frappe
import unittest
from unittest.mock import patch, MagicMock
import json

class TestOAuthHandlers(unittest.TestCase):
    """Test OAuth2 handlers"""
    
    def setUp(self):
        """Set up test data"""
        self.test_provider = {
            "doctype": "Email OAuth Settings",
            "name": "Test Gmail",
            "provider": "Gmail",
            "client_id": "test_client_id",
            "client_secret": "test_client_secret",
            "enabled": 1
        }
    
    def tearDown(self):
        """Clean up test data"""
        frappe.db.rollback()
    
    def test_oauth2_callback_success(self):
        """Test successful OAuth2 callback handling"""
        # Create test provider
        provider = frappe.get_doc(self.test_provider)
        provider.insert()
        
        # Mock successful token exchange
        with patch('svg_mobile_app.svg_mobile_app.doctype.email_oauth_settings.email_oauth_settings.exchange_code_for_tokens') as mock_exchange:
            mock_exchange.return_value = {"success": True}
            
            # Mock frappe.form_dict
            with patch('frappe.form_dict', {'code': 'test_auth_code'}):
                from svg_mobile_app.oauth_handlers import oauth2_callback
                result = oauth2_callback()
                
                self.assertIn("Authorization Successful", result)
                mock_exchange.assert_called_once()
    
    def test_oauth2_callback_error(self):
        """Test OAuth2 callback with error"""
        with patch('frappe.form_dict', {'error': 'access_denied'}):
            from svg_mobile_app.oauth_handlers import oauth2_callback
            result = oauth2_callback()
            
            self.assertIn("Authorization Failed", result)
            self.assertIn("access_denied", result)
    
    def test_initiate_oauth_flow(self):
        """Test OAuth flow initiation"""
        provider = frappe.get_doc(self.test_provider)
        provider.insert()
        
        from svg_mobile_app.oauth_handlers import initiate_oauth_flow
        result = initiate_oauth_flow(provider.name)
        
        self.assertTrue(result.get("success"))
        self.assertIn("auth_url", result)
    
    @patch('requests.get')
    def test_test_oauth_connection_gmail(self, mock_get):
        """Test OAuth connection testing for Gmail"""
        # Mock successful API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "emailAddress": "test@gmail.com",
            "messagesTotal": 100
        }
        mock_get.return_value = mock_response
        
        provider = frappe.get_doc(self.test_provider)
        provider.access_token = "valid_token"
        provider.token_expires_at = frappe.utils.add_days(frappe.utils.now(), 1)
        provider.insert()
        
        from svg_mobile_app.oauth_handlers import test_oauth_connection
        result = test_oauth_connection(provider.name)
        
        self.assertTrue(result.get("success"))
        self.assertIn("user_info", result)
    
    @patch('requests.get')
    def test_test_oauth_connection_m365(self, mock_get):
        """Test OAuth connection testing for Microsoft 365"""
        # Mock successful API response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "mail": "test@outlook.com",
            "displayName": "Test User"
        }
        mock_get.return_value = mock_response
        
        provider = frappe.get_doc({
            **self.test_provider,
            "name": "Test M365",
            "provider": "Microsoft 365",
            "tenant_id": "test-tenant"
        })
        provider.access_token = "valid_token"
        provider.token_expires_at = frappe.utils.add_days(frappe.utils.now(), 1)
        provider.insert()
        
        from svg_mobile_app.oauth_handlers import test_oauth_connection
        result = test_oauth_connection(provider.name)
        
        self.assertTrue(result.get("success"))
        self.assertIn("user_info", result)
    
    @patch('requests.post')
    def test_send_email_via_oauth_gmail(self, mock_post):
        """Test sending email via Gmail OAuth"""
        # Mock successful send response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "message_id_123"}
        mock_post.return_value = mock_response
        
        provider = frappe.get_doc(self.test_provider)
        provider.access_token = "valid_token"
        provider.token_expires_at = frappe.utils.add_days(frappe.utils.now(), 1)
        provider.insert()
        
        from svg_mobile_app.oauth_handlers import send_email_via_oauth
        result = send_email_via_oauth(
            provider.name,
            "recipient@example.com",
            "Test Subject",
            "Test Body"
        )
        
        self.assertTrue(result)
        mock_post.assert_called_once()
    
    @patch('requests.post')
    def test_send_email_via_oauth_m365(self, mock_post):
        """Test sending email via Microsoft 365 OAuth"""
        # Mock successful send response
        mock_response = MagicMock()
        mock_response.status_code = 202  # Microsoft Graph returns 202
        mock_post.return_value = mock_response
        
        provider = frappe.get_doc({
            **self.test_provider,
            "name": "Test M365",
            "provider": "Microsoft 365",
            "tenant_id": "test-tenant"
        })
        provider.access_token = "valid_token"
        provider.token_expires_at = frappe.utils.add_days(frappe.utils.now(), 1)
        provider.insert()
        
        from svg_mobile_app.oauth_handlers import send_email_via_oauth
        result = send_email_via_oauth(
            provider.name,
            "recipient@example.com",
            "Test Subject",
            "Test Body"
        )
        
        self.assertTrue(result)
        mock_post.assert_called_once()

if __name__ == '__main__':
    unittest.main()

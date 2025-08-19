# Copyright (c) 2025, SVG and Contributors
# See license.txt

import frappe
import unittest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta

class TestEmailOAuthSettings(unittest.TestCase):
    
    def setUp(self):
        """Set up test data"""
        self.test_provider = {
            "doctype": "Email OAuth Settings",
            "name": "Test Gmail Provider",
            "provider": "Gmail",
            "client_id": "test_client_id",
            "client_secret": "test_client_secret",
            "enabled": 1
        }
    
    def tearDown(self):
        """Clean up test data"""
        frappe.db.rollback()
    
    def test_provider_validation(self):
        """Test provider-specific validation"""
        # Test Gmail provider
        gmail_provider = frappe.get_doc(self.test_provider)
        gmail_provider.validate()
        
        self.assertEqual(gmail_provider.authorization_url, "https://accounts.google.com/o/oauth2/auth")
        self.assertEqual(gmail_provider.token_url, "https://oauth2.googleapis.com/token")
        self.assertIn("gmail", gmail_provider.scope)
        
        # Test Microsoft 365 provider
        m365_provider = frappe.get_doc({
            **self.test_provider,
            "name": "Test M365 Provider",
            "provider": "Microsoft 365",
            "tenant_id": "test-tenant-id"
        })
        m365_provider.validate()
        
        self.assertIn("login.microsoftonline.com", m365_provider.authorization_url)
        self.assertIn("test-tenant-id", m365_provider.authorization_url)
        self.assertIn("graph.microsoft.com", m365_provider.scope)
        
        # Test Microsoft 365 without tenant ID should fail
        m365_without_tenant = frappe.get_doc({
            **self.test_provider,
            "name": "Test M365 No Tenant",
            "provider": "Microsoft 365"
        })
        
        with self.assertRaises(frappe.ValidationError):
            m365_without_tenant.validate()
    
    def test_authorization_url_generation(self):
        """Test OAuth2 authorization URL generation"""
        provider = frappe.get_doc(self.test_provider)
        provider.insert()
        
        from svg_mobile_app.svg_mobile_app.doctype.email_oauth_settings.email_oauth_settings import get_authorization_url
        result = get_authorization_url(provider.name)
        
        self.assertTrue(result.get("success"))
        self.assertIn("accounts.google.com", result.get("auth_url"))
        self.assertIn("client_id=test_client_id", result.get("auth_url"))
        self.assertIn("response_type=code", result.get("auth_url"))
    
    @patch('requests.post')
    def test_token_exchange(self, mock_post):
        """Test authorization code to token exchange"""
        # Mock successful token response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "test_access_token",
            "refresh_token": "test_refresh_token",
            "expires_in": 3600
        }
        mock_post.return_value = mock_response
        
        provider = frappe.get_doc(self.test_provider)
        provider.insert()
        
        from svg_mobile_app.svg_mobile_app.doctype.email_oauth_settings.email_oauth_settings import exchange_code_for_tokens
        result = exchange_code_for_tokens(provider.name, "test_auth_code")
        
        self.assertTrue(result.get("success"))
        
        # Verify token was saved
        updated_provider = frappe.get_doc("Email OAuth Settings", provider.name)
        self.assertEqual(updated_provider.get_password("access_token"), "test_access_token")
        self.assertEqual(updated_provider.get_password("refresh_token"), "test_refresh_token")
        self.assertIsNotNone(updated_provider.token_expires_at)
    
    @patch('requests.post')
    def test_token_refresh(self, mock_post):
        """Test access token refresh"""
        # Mock successful refresh response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "access_token": "new_access_token",
            "expires_in": 3600
        }
        mock_post.return_value = mock_response
        
        provider = frappe.get_doc(self.test_provider)
        provider.access_token = "old_access_token"
        provider.refresh_token = "test_refresh_token"
        provider.token_expires_at = datetime.now() - timedelta(hours=1)  # Expired
        provider.insert()
        
        from svg_mobile_app.svg_mobile_app.doctype.email_oauth_settings.email_oauth_settings import refresh_access_token
        result = refresh_access_token(provider.name)
        
        self.assertTrue(result.get("success"))
        self.assertEqual(result.get("access_token"), "new_access_token")
    
    def test_get_valid_access_token(self):
        """Test getting valid access token with automatic refresh"""
        provider = frappe.get_doc(self.test_provider)
        provider.access_token = "current_token"
        provider.token_expires_at = datetime.now() + timedelta(hours=1)  # Valid for 1 hour
        provider.insert()
        
        from svg_mobile_app.svg_mobile_app.doctype.email_oauth_settings.email_oauth_settings import get_valid_access_token
        
        # Should return current token without refresh
        token = get_valid_access_token(provider.name)
        self.assertEqual(token, "current_token")
        
        # Test with expired token
        frappe.db.set_value("Email OAuth Settings", provider.name, 
                           "token_expires_at", datetime.now() - timedelta(minutes=1))
        
        with patch('svg_mobile_app.svg_mobile_app.doctype.email_oauth_settings.email_oauth_settings.refresh_access_token') as mock_refresh:
            mock_refresh.return_value = {"success": True, "access_token": "refreshed_token"}
            
            token = get_valid_access_token(provider.name)
            self.assertEqual(token, "refreshed_token")
            mock_refresh.assert_called_once()

if __name__ == '__main__':
    unittest.main()

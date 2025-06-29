# Copyright (c) 2025, SVG and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase


class TestBCCProcessingSettings(FrappeTestCase):
    def setUp(self):
        """Set up test data"""
        # Clear existing settings
        if frappe.db.exists("BCC Processing Settings", "BCC Processing Settings"):
            frappe.delete_doc("BCC Processing Settings", "BCC Processing Settings")
    
    def test_default_settings(self):
        """Test default settings creation"""
        settings = frappe.get_single("BCC Processing Settings")
        
        # Test default values
        self.assertEqual(settings.enable_bcc_processing, 1)
        self.assertEqual(settings.gmail_forwarding_account, "constr.sv@gmail.com")
        self.assertEqual(settings.processing_method, "Hook")
        self.assertEqual(settings.preserve_original_headers, 1)
        self.assertEqual(settings.debug_mode, 0)
        self.assertEqual(settings.max_recipients_per_email, 10)
        self.assertEqual(settings.forwarding_subject_prefix, "[BCC-PROCESSED]")
    
    def test_validation_gmail_account_required(self):
        """Test that Gmail account is required when BCC processing is enabled"""
        settings = frappe.get_single("BCC Processing Settings")
        settings.enable_bcc_processing = 1
        settings.gmail_forwarding_account = ""
        
        with self.assertRaises(frappe.ValidationError):
            settings.save()
    
    def test_validation_max_recipients(self):
        """Test max recipients validation"""
        settings = frappe.get_single("BCC Processing Settings")
        settings.max_recipients_per_email = 0
        
        with self.assertRaises(frappe.ValidationError):
            settings.save()
    
    def test_get_bcc_settings_api(self):
        """Test the get_bcc_settings API method"""
        from svg_mobile_app.svg_mobile_app.doctype.bcc_processing_settings.bcc_processing_settings import get_bcc_settings
        
        settings = get_bcc_settings()
        self.assertIsNotNone(settings)
        self.assertIn("enable_bcc_processing", settings)
        self.assertIn("gmail_forwarding_account", settings)
    
    def test_email_forwarding_test(self):
        """Test the email forwarding test functionality"""
        from svg_mobile_app.svg_mobile_app.doctype.bcc_processing_settings.bcc_processing_settings import test_email_forwarding
        
        # This would normally send an email, so we'll just check it doesn't crash
        result = test_email_forwarding()
        self.assertIn("status", result)
    
    def tearDown(self):
        """Clean up after tests"""
        pass 
# Copyright (c) 2025, Smart Vision and contributors
# For license information, please see license.txt

import unittest
import frappe
from frappe.tests.utils import FrappeTestCase


class TestOfferMaterialStatus(FrappeTestCase):
    def setUp(self):
        """Set up test data"""
        # Clean up any existing test data
        frappe.db.delete("Offer Material Status", {"status_name": ["like", "Test Status%"]})
        frappe.db.commit()
    
    def test_create_offer_material_status(self):
        """Test creating a new offer material status"""
        status = frappe.get_doc({
            "doctype": "Offer Material Status",
            "status_name": "Test Status 1",
            "description": "This is a test status",
            "color_code": "#28a745",
            "is_active": 1
        })
        status.insert()
        
        # Check if status was created successfully
        self.assertTrue(frappe.db.exists("Offer Material Status", "Test Status 1"))
        
        # Check values
        saved_status = frappe.get_doc("Offer Material Status", "Test Status 1")
        self.assertEqual(saved_status.is_active, 1)
        self.assertEqual(saved_status.description, "This is a test status")
        self.assertEqual(saved_status.color_code, "#28a745")
    
    def test_unique_status_name(self):
        """Test that status names must be unique"""
        # Create first status
        status1 = frappe.get_doc({
            "doctype": "Offer Material Status",
            "status_name": "Unique Test Status",
            "is_active": 1
        })
        status1.insert()
        
        # Try to create second status with same name
        status2 = frappe.get_doc({
            "doctype": "Offer Material Status",
            "status_name": "Unique Test Status",
            "is_active": 1
        })
        
        with self.assertRaises(frappe.DuplicateEntryError):
            status2.insert()
    
    def test_status_with_color_code(self):
        """Test creating status with color code"""
        status = frappe.get_doc({
            "doctype": "Offer Material Status",
            "status_name": "Test Status with Color",
            "color_code": "#dc3545",
            "is_active": 1
        })
        status.insert()
        
        saved_status = frappe.get_doc("Offer Material Status", "Test Status with Color")
        self.assertEqual(saved_status.color_code, "#dc3545")
    
    def test_inactive_status(self):
        """Test creating inactive status"""
        status = frappe.get_doc({
            "doctype": "Offer Material Status",
            "status_name": "Inactive Test Status",
            "is_active": 0
        })
        status.insert()
        
        saved_status = frappe.get_doc("Offer Material Status", "Inactive Test Status")
        self.assertEqual(saved_status.is_active, 0)
    
    def test_default_values(self):
        """Test default values"""
        status = frappe.get_doc({
            "doctype": "Offer Material Status",
            "status_name": "Test Status Default Values"
        })
        status.insert()
        
        saved_status = frappe.get_doc("Offer Material Status", "Test Status Default Values")
        # is_active should default to 1
        self.assertEqual(saved_status.is_active, 1)
    
    def test_status_with_long_description(self):
        """Test status with long description"""
        long_description = "This is a very long description " * 10
        status = frappe.get_doc({
            "doctype": "Offer Material Status",
            "status_name": "Test Status Long Desc",
            "description": long_description,
            "is_active": 1
        })
        status.insert()
        
        saved_status = frappe.get_doc("Offer Material Status", "Test Status Long Desc")
        self.assertEqual(saved_status.description, long_description)
    
    def tearDown(self):
        """Clean up test data"""
        # Delete test records
        frappe.db.delete("Offer Material Status", {"status_name": ["like", "Test Status%"]})
        frappe.db.delete("Offer Material Status", {"status_name": ["like", "%Test Status%"]})
        frappe.db.commit()

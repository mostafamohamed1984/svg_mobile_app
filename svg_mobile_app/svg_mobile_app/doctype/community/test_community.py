# Copyright (c) 2025, Smart Vision and contributors
# For license information, please see license.txt

import unittest
import frappe
from frappe.tests.utils import FrappeTestCase


class TestCommunity(FrappeTestCase):
    def setUp(self):
        """Set up test data"""
        # Clean up any existing test data
        frappe.db.delete("Community", {"community_name": ["like", "Test Community%"]})
        frappe.db.commit()
    
    def test_create_community(self):
        """Test creating a new community"""
        community = frappe.get_doc({
            "doctype": "Community",
            "community_name": "Test Community 1",
            "description": "This is a test community",
            "is_active": 1
        })
        community.insert()
        
        # Check if community was created successfully
        self.assertTrue(frappe.db.exists("Community", "Test Community 1"))
        
        # Check default values
        saved_community = frappe.get_doc("Community", "Test Community 1")
        self.assertEqual(saved_community.is_active, 1)
        self.assertEqual(saved_community.description, "This is a test community")
    
    def test_unique_community_name(self):
        """Test that community names must be unique"""
        # Create first community
        community1 = frappe.get_doc({
            "doctype": "Community",
            "community_name": "Unique Test Community",
            "is_active": 1
        })
        community1.insert()
        
        # Try to create second community with same name
        community2 = frappe.get_doc({
            "doctype": "Community",
            "community_name": "Unique Test Community",
            "is_active": 1
        })
        
        with self.assertRaises(frappe.DuplicateEntryError):
            community2.insert()
    
    def test_community_with_region(self):
        """Test creating community with region link"""
        # Create a test region first (if it doesn't exist)
        if not frappe.db.exists("Project Region", "Test Region"):
            region = frappe.get_doc({
                "doctype": "Project Region",
                "region_name": "Test Region"
            })
            region.insert()
        
        community = frappe.get_doc({
            "doctype": "Community",
            "community_name": "Test Community with Region",
            "region": "Test Region",
            "is_active": 1
        })
        community.insert()
        
        saved_community = frappe.get_doc("Community", "Test Community with Region")
        self.assertEqual(saved_community.region, "Test Region")
    
    def test_inactive_community(self):
        """Test creating inactive community"""
        community = frappe.get_doc({
            "doctype": "Community",
            "community_name": "Inactive Test Community",
            "is_active": 0
        })
        community.insert()
        
        saved_community = frappe.get_doc("Community", "Inactive Test Community")
        self.assertEqual(saved_community.is_active, 0)
    
    def tearDown(self):
        """Clean up test data"""
        # Delete test records
        frappe.db.delete("Community", {"community_name": ["like", "Test Community%"]})
        frappe.db.delete("Community", {"community_name": ["like", "%Test Community%"]})
        frappe.db.delete("Project Region", {"region_name": "Test Region"})
        frappe.db.commit()

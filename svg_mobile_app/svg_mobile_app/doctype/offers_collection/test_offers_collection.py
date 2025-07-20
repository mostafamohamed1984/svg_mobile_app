# Copyright (c) 2025, Smart Vision and contributors
# For license information, please see license.txt

import unittest
import frappe
from frappe.tests.utils import FrappeTestCase


class TestOffersCollection(FrappeTestCase):
    def setUp(self):
        """Set up test data"""
        # Create test community if it doesn't exist
        if not frappe.db.exists("Community", "Test Community"):
            community = frappe.get_doc({
                "doctype": "Community",
                "community_name": "Test Community"
            })
            community.insert()
    
    def test_area_calculation(self):
        """Test automatic area calculation from FT to SM"""
        offer = frappe.get_doc({
            "doctype": "Offers Collection",
            "offer_code": "TEST-001",
            "area_ft": 1000
        })
        offer.calculate_area_sm()
        
        # 1000 sq ft should be approximately 92.903 sq m
        expected_area_sm = 1000 * 0.092903
        self.assertAlmostEqual(offer.area_sm, expected_area_sm, places=3)
    
    def test_numeric_sort_field(self):
        """Test numeric sort field extraction"""
        offer = frappe.get_doc({
            "doctype": "Offers Collection",
            "offer_code": "SV-123-Test"
        })
        offer.set_numeric_sort_field()
        
        self.assertEqual(offer.numeric_sort_field, 123)
    
    def test_price_validation(self):
        """Test price validation"""
        offer = frappe.get_doc({
            "doctype": "Offers Collection",
            "offer_code": "TEST-002",
            "price_shj": -1000
        })
        
        with self.assertRaises(frappe.ValidationError):
            offer.validate_prices()
    
    def test_room_count_validation(self):
        """Test room count validation"""
        offer = frappe.get_doc({
            "doctype": "Offers Collection",
            "offer_code": "TEST-003",
            "bedroom": -1
        })
        
        with self.assertRaises(frappe.ValidationError):
            offer.validate_room_counts()
    
    def tearDown(self):
        """Clean up test data"""
        # Delete test records
        frappe.db.delete("Offers Collection", {"offer_code": ["like", "TEST-%"]})
        frappe.db.commit()

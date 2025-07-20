# Copyright (c) 2025, Smart Vision and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import re


class OffersCollection(Document):
    def before_save(self):
        """Set numeric sort field and calculate area SM from area FT"""
        self.set_numeric_sort_field()
        self.calculate_area_sm()
    
    def set_numeric_sort_field(self):
        """Extract numeric value from offer_code for proper sorting"""
        if self.offer_code:
            # Extract numbers from the offer code (similar to Projects Collection)
            numbers = re.findall(r'\d+', self.offer_code)
            if numbers:
                # Use the first number found, or combine them
                self.numeric_sort_field = int(numbers[0])
            else:
                self.numeric_sort_field = 0
    
    def calculate_area_sm(self):
        """Calculate area in square meters from square feet"""
        if self.area_ft:
            # Conversion factor: 1 sq ft = 0.092903 sq m
            self.area_sm = self.area_ft * 0.092903
        else:
            self.area_sm = 0
    
    def validate(self):
        """Validate the document before saving"""
        self.validate_prices()
        self.validate_room_counts()
    
    def validate_prices(self):
        """Ensure all prices are positive if provided"""
        price_fields = ['price_shj', 'price_auh', 'price_dxb']
        for field in price_fields:
            value = getattr(self, field, None)
            if value and value < 0:
                frappe.throw(f"{self.meta.get_label(field)} cannot be negative")
    
    def validate_room_counts(self):
        """Ensure room counts are not negative"""
        room_fields = ['bedroom', 'majlis', 'family_living', 'kitchen', 
                      'bathrooms', 'maidroom', 'laundry', 'dining_room', 'store']
        for field in room_fields:
            value = getattr(self, field, None)
            if value and value < 0:
                frappe.throw(f"{self.meta.get_label(field)} cannot be negative")

# Copyright (c) 2023, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import add_days, nowdate

class RemoteAccessDashboardConfig(Document):
    def validate(self):
        self.validate_default_dashboard()
        self.validate_date_range()
    
    def validate_default_dashboard(self):
        """Ensure only one dashboard is set as default"""
        if self.is_default:
            # If this dashboard is set as default, unset any other default dashboards
            frappe.db.sql("""
                UPDATE `tabRemote Access Dashboard Config`
                SET is_default = 0
                WHERE name != %s AND is_default = 1
            """, (self.name))
    
    def validate_date_range(self):
        """Set from_date and to_date based on date_range selection"""
        if self.date_range and self.date_range != "Custom Range":
            today = nowdate()
            
            if self.date_range == "Last 7 Days":
                self.from_date = add_days(today, -7)
                self.to_date = today
            elif self.date_range == "Last 30 Days":
                self.from_date = add_days(today, -30)
                self.to_date = today
            elif self.date_range == "Last 90 Days":
                self.from_date = add_days(today, -90)
                self.to_date = today
            elif self.date_range == "Last 365 Days":
                self.from_date = add_days(today, -365)
                self.to_date = today
        
        # Validate custom range dates
        if self.date_range == "Custom Range":
            if not self.from_date:
                frappe.throw("From Date is required for Custom Range")
            if not self.to_date:
                frappe.throw("To Date is required for Custom Range")
            if self.from_date > self.to_date:
                frappe.throw("From Date cannot be after To Date")

@frappe.whitelist()
def get_default_dashboard():
    """Get the default dashboard configuration"""
    default_dashboard = frappe.get_all(
        "Remote Access Dashboard Config",
        filters={"is_default": 1},
        fields=["*"],
        limit=1
    )
    
    if default_dashboard:
        return default_dashboard[0]
    
    # If no default dashboard, return the first one
    dashboards = frappe.get_all(
        "Remote Access Dashboard Config",
        fields=["*"],
        limit=1
    )
    
    if dashboards:
        return dashboards[0]
    
    return None
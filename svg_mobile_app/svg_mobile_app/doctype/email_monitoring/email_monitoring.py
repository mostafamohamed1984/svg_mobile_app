# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EmailMonitoring(Document):
    def validate(self):
        # Ensure required linkage
        if not self.communication:
            frappe.throw("Communication is required")
        if self.email_type not in {"Issued", "Incoming"}:
            frappe.throw("Invalid email type")
        if self.status not in {"Open", "Need Reply", "Replied", "Follow Up", "Follow Up Review", "Closed"}:
            frappe.throw("Invalid status")


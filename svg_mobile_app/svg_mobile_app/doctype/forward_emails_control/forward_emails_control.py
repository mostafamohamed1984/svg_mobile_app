# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ForwardEmailsControl(Document):
    def validate(self):
        if not self.target_role:
            frappe.throw("Target Role is required")
        if not self.target_email_account:
            frappe.throw("Target Email Account is required")


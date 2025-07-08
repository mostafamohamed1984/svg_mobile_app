# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import time_diff_in_hours


class OvertimeRequest(Document):
	def before_save(self):
		"""Calculate duration before saving the document"""
		if self.time_from and self.time_to:
			self.duration = time_diff_in_hours(self.time_to, self.time_from)
		else:
			self.duration = 0

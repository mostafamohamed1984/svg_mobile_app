# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import get_datetime


class RemoteAccessLog(Document):
	def before_save(self):
		if self.connection_start_time and self.connection_end_time:
			start = get_datetime(self.connection_start_time)
			end = get_datetime(self.connection_end_time)
			self.connection_duration = int((end - start).total_seconds())
		else:
			self.connection_duration = None

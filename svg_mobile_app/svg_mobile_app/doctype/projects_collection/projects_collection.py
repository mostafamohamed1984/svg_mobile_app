# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
import re
from frappe.model.document import Document


class ProjectsCollection(Document):
	def before_save(self):
		# Extract numeric value from project_name for proper sorting
		if self.project_name:
			# Extract all digits from project_name
			numbers = re.findall(r'\d+', str(self.project_name))
			if numbers:
				# Use the first (or largest) number found
				self.numeric_sort_field = int(numbers[0])
			else:
				# If no numbers found, set to 0
				self.numeric_sort_field = 0

# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EmployeeAdvanceCustom(Document):
	def on_cancel(self):
		"""Handle cancellation by ignoring linked documents to prevent infinite loop"""
		# Ignore linked documents to prevent infinite loop
		self.ignore_linked_doctypes = ("Project Contractors", "Project Claim", "Project Advances")
		
	def on_trash(self):
		"""Handle document deletion by clearing references"""
		# Clear references in Project Contractors fees_and_deposits
		if hasattr(self, 'project_contractors_reference') and self.project_contractors_reference:
			try:
				project_contractor = frappe.get_doc("Project Contractors", self.project_contractors_reference)
				
				# Update fees_and_deposits to remove this advance reference
				for fee_item in project_contractor.fees_and_deposits:
					if hasattr(fee_item, 'employee_advances') and fee_item.employee_advances:
						# Parse comma-separated list and remove this advance
						advance_names = [name.strip() for name in fee_item.employee_advances.split(',') if name.strip()]
						if self.name in advance_names:
							advance_names.remove(self.name)
							fee_item.employee_advances = ', '.join(advance_names) if advance_names else None
				
				# Save the updated Project Contractors document
				project_contractor.save(ignore_permissions=True)
				frappe.db.commit()
				
			except Exception as e:
				frappe.log_error(f"Error updating Project Contractors {self.project_contractors_reference}: {str(e)}")


# Hook into the Employee Advance doctype
def on_cancel(doc, method=None):
	"""Handle Employee Advance cancellation by ignoring all link validation"""
	# This is the correct way to bypass link validation completely
	doc.flags.ignore_links = True

def on_trash(doc, method=None):
	"""Handle Employee Advance deletion by clearing references"""
	# This is the correct way to bypass link validation completely
	doc.flags.ignore_links = True
	
	# Clear references in Project Contractors fees_and_deposits
	if hasattr(doc, 'project_contractors_reference') and doc.project_contractors_reference:
		try:
			project_contractor = frappe.get_doc("Project Contractors", doc.project_contractors_reference)
			# Clear any references in the fees_and_deposits child table
			for fee in project_contractor.fees_and_deposits:
				if fee.employee_advance == doc.name:
					frappe.db.set_value("Project Fees and Deposits", fee.name, "employee_advance", None)
			
			# Commit the changes
			frappe.db.commit()
		except frappe.DoesNotExistError:
			# Project Contractors document doesn't exist, continue
			pass 
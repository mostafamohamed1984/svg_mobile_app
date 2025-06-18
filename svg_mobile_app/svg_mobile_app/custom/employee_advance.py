# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EmployeeAdvanceCustom(Document):
	pass

# Hook functions for Employee Advance
def validate(doc, method=None):
	"""Validate Employee Advance before saving"""
	del method  # Suppress unused parameter warning
	pass

# Additional hook functions for doc_events
def before_cancel_hook(doc, method=None):
	"""Hook function called before cancelling the document"""
	del method  # Suppress unused parameter warning
	_clear_employee_advance_links(doc)

def on_cancel_hook(doc, method=None):
	"""Hook function called when document is cancelled"""
	del method  # Suppress unused parameter warning
	pass

def on_trash_hook(doc, method=None):
	"""Hook function called when document is being deleted"""
	del method  # Suppress unused parameter warning
	_clear_employee_advance_links(doc)

def after_delete_hook(doc, method=None):
	"""Hook function called after document deletion"""
	del method  # Suppress unused parameter warning
	pass

def _clear_employee_advance_links(doc):
	"""Clear all project-related links to prevent circular reference errors"""
	try:
		updates = {}
		
		# Clear project contractors reference
		if hasattr(doc, 'project_contractors_reference') and doc.project_contractors_reference:
			updates["project_contractors_reference"] = None
		
		# Clear other project references
		if hasattr(doc, 'custom_project_advance_reference') and doc.custom_project_advance_reference:
			updates["custom_project_advance_reference"] = None
		
		if hasattr(doc, 'custom_project_claim_reference') and doc.custom_project_claim_reference:
			updates["custom_project_claim_reference"] = None
		
		# Apply all updates
		if updates:
			for field, value in updates.items():
				frappe.db.set_value("Employee Advance", doc.name, field, value)
		
		# Commit the changes
		frappe.db.commit()
		
	except Exception as e:
		frappe.log_error(f"Error clearing Employee Advance links for {doc.name}: {str(e)}")
		# Don't prevent deletion, just log the error
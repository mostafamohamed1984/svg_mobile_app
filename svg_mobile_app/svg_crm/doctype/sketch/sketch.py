# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Sketch(Document):
	def after_save(self):
		"""After save, create any necessary engineering assignments"""
		self.create_engineering_assignments_for_requirements()
		
	def create_engineering_assignments_for_requirements(self):
		"""Create engineering assignments for eligible requirements"""
		if not self.sketch_requirements:
			return
			
		# Find requirements that need engineering assignments
		assignments_created = 0
		for req in self.sketch_requirements:
			if req.status == 'Required' and req.item and req.engineer:
				# Check if an assignment already exists for this requirement and engineer
				existing = frappe.get_all(
					"Engineering Assignment",
					filters={
						"sketch": self.name,
						"requirement_item": req.item,
						"senior_engineer": req.engineer
					}
				)
				
				if not existing:
					assignment = self.create_engineering_assignment(req)
					if assignment:
						assignments_created += 1
		
		if assignments_created > 0:
			frappe.logger().info(f"Created {assignments_created} engineering assignments for Sketch {self.name}")


	def create_engineering_assignment(self, requirement):
		"""Create a new engineering assignment from a requirement"""
		assignment = frappe.get_doc({
			"doctype": "Engineering Assignment",
			"sketch": self.name,
			"sketch_number": self.sketch_number,
			"requirement_item": requirement.item,
			"senior_engineer": requirement.engineer,
			"description": requirement.description or "No description provided",
			"start_date": frappe.utils.nowdate(),
			"project_type": self.project_type,
			"status": "Pending"
		})
		
		assignment.insert(ignore_permissions=True)
		
		# Send notification to the senior engineer
		self.notify_engineer(requirement.engineer, assignment.name, requirement.item)
		
		return assignment
		
	def notify_engineer(self, engineer, assignment_name, item_name):
		"""Send notification to an engineer about a new assignment"""
		# Check if user exists for the engineer
		engineer_user = frappe.db.get_value("Employee", engineer, "user_id")
		if not engineer_user:
			return
			
		notification = {
			"type": "Engineering Assignment",
			"document_type": "Engineering Assignment",
			"document_name": assignment_name,
			"subject": f"New Engineering Assignment for {item_name}",
			"from_user": frappe.session.user,
			"email_content": f"You have been assigned a new engineering task for {item_name}. Please check the Engineering Assignment {assignment_name}."
		}
		
		try:
			frappe.enqueue(
				method="frappe.desk.doctype.notification_log.notification_log.enqueue_create_notification",
				users=[engineer_user],
				**notification
			)
		except Exception as e:
			frappe.log_error(f"Failed to send notification to {engineer_user}: {str(e)}")


@frappe.whitelist()
def create_engineering_assignments(sketch_name):
	"""Create engineering assignments for a sketch's requirements
	
	Args:
		sketch_name (str): Name of the Sketch document
		
	Returns:
		dict: Result with count of created assignments
	"""
	if not sketch_name:
		frappe.throw("Sketch name is required")
		
	sketch = frappe.get_doc("Sketch", sketch_name)
	created_count = 0
	
	# Find requirements that need engineering assignments
	if sketch.sketch_requirements:
		for req in sketch.sketch_requirements:
			if req.status == 'Required' and req.item and req.engineer:
				# Check if an assignment already exists for this requirement and engineer
				existing = frappe.get_all(
					"Engineering Assignment",
					filters={
						"sketch": sketch.name,
						"requirement_item": req.item,
						"senior_engineer": req.engineer
					}
				)
				
				if not existing:
					assignment = sketch.create_engineering_assignment(req)
					if assignment:
						created_count += 1
	
	if created_count > 0:
		frappe.logger().info(f"Created {created_count} engineering assignments for Sketch {sketch_name}")
		
	return {"created": created_count}

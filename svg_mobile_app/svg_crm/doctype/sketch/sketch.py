# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Sketch(Document):
	def validate(self):
		"""Validate sketch data before saving"""
		self.validate_engineering_tasks_status()
		
	def validate_engineering_tasks_status(self):
		"""Ensure all engineering tasks have valid status values"""
		valid_statuses = ["Required", "In Progress", "Ready", "Modification", "Completed"]
		
		if self.sketch_engineering_tasks:
			for task in self.sketch_engineering_tasks:
				if task.status and task.status not in valid_statuses:
					frappe.logger().warning(f"Invalid status '{task.status}' for task {task.engineer} in Sketch {self.name}. Setting to 'Required'.")
					task.status = "Required"
		
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
		frappe.logger().info(f"Creating engineering assignment for Sketch {self.name}, requirement: {requirement.item}")
		
		assignment = frappe.get_doc({
			"doctype": "Engineering Assignment",
			"sketch": self.name,
			"sketch_number": self.sketch_number,
			"requirement_item": requirement.item,
			"senior_engineer": requirement.engineer,
			"description": requirement.description or "No description provided",
			"start_date": requirement.start_date or frappe.utils.nowdate(),
			"end_date": requirement.end_date,
			"project_type": self.project_type,
			"status": "Pending"
		})
		
		assignment.insert(ignore_permissions=True)
		frappe.logger().info(f"Created engineering assignment {assignment.name} for engineer {requirement.engineer}")
		
		# Send notification to the senior engineer
		self.notify_engineer(requirement.engineer, assignment.name, requirement.item)
		
		return assignment
		
	def notify_engineer(self, engineer, assignment_name, item_name):
		"""Send notification to an engineer about a new assignment"""
		# Check if user exists for the engineer
		engineer_user = frappe.db.get_value("Employee", engineer, "user_id")
		if not engineer_user:
			frappe.logger().info(f"No user found for engineer {engineer}, skipping notification")
			return
			
		frappe.logger().info(f"Preparing to send notification to {engineer_user} for assignment {assignment_name}")
			
		notification = {
			"type": "Alert",
			"document_type": "Engineering Assignment",
			"document_name": assignment_name,
			"subject": f"New Engineering Assignment for {item_name}",
			"from_user": frappe.session.user,
			"email_content": f"You have been assigned a new engineering task for {item_name}. Please check the Engineering Assignment {assignment_name}."
		}
		
		try:
			# Directly create notification without enqueuing
			frappe.get_doc({
				"doctype": "Notification Log",
				"for_user": engineer_user,
				**notification
			}).insert(ignore_permissions=True)
			
			frappe.logger().info(f"Successfully sent notification to {engineer_user} for Engineering Assignment {assignment_name}")
		except Exception as e:
			frappe.log_error(f"Failed to send notification to {engineer_user}: {str(e)}", title=f"Notification Error: {assignment_name}", limit_msg_size=True)
			
	def refresh_requirements_status(self):
		"""Check the status of all requirements and update based on engineering tasks"""
		if not self.sketch_requirements:
			return 0
			
		updated_count = 0
		for req in self.sketch_requirements:
			if not req.item or req.status == "Completed":
				continue
				
			# Get all engineering tasks for this requirement
			tasks = frappe.get_all(
				"Engineering Task",
				filters={
					"sketch": self.name,
					"requirement_item": req.item
				},
				fields=["name", "status"]
			)
			
			if tasks:
				# Check if all tasks are completed
				all_completed = all(task.status == "Completed" for task in tasks)
				
				if all_completed and req.status != "Completed":
					req.status = "Completed"
					updated_count += 1
					frappe.logger().info(f"Updated requirement {req.item} to Completed in Sketch {self.name}")
			
		if updated_count > 0:
			self.save(ignore_permissions=True)
			
		return updated_count


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

@frappe.whitelist()
def refresh_requirement_statuses(sketch_name):
	"""Refresh the status of all requirements in a sketch based on their engineering tasks
	
	Args:
		sketch_name (str): Name of the Sketch document
		
	Returns:
		dict: Result with count of updated requirements
	"""
	if not sketch_name:
		frappe.throw("Sketch name is required")
		
	sketch = frappe.get_doc("Sketch", sketch_name)
	updated_count = sketch.refresh_requirements_status()
	
	return {"updated": updated_count}

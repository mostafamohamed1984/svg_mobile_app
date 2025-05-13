# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EngineeringAssignment(Document):
    def validate(self):
        self.update_status()
        self.send_notifications()
    
    def update_status(self):
        # If this is a new document, no need to update
        if self.is_new():
            return
            
        # Update corresponding Sketch Requirements status
        if self.status and self.sketch and self.requirement_item:
            sketch_doc = frappe.get_doc("Sketch", self.sketch)
            for req in sketch_doc.sketch_requirements:
                if req.item == self.requirement_item:
                    # Update only if status has changed and is not already at a higher level
                    if req.status != self.status and self.status == "Completed":
                        req.status = self.status
                        sketch_doc.save(ignore_permissions=True)
                        break
    
    def send_notifications(self):
        # Send notifications to junior engineers when assigned
        if self.status == "In Progress" and self.engineering_subtasks:
            for subtask in self.engineering_subtasks:
                if subtask.engineer:
                    self.notify_engineer(subtask.engineer, subtask.task_description)
    
    def notify_engineer(self, engineer, task_description):
        # Check if user exists for the engineer
        engineer_user = frappe.db.get_value("Employee", engineer, "user_id")
        if engineer_user:
            notification = {
                "type": "Engineering Task",
                "document_type": "Engineering Assignment",
                "document_name": self.name,
                "subject": f"New Engineering Task: {task_description or 'No description'}",
                "from_user": frappe.session.user,
                "email_content": f"You have been assigned a new engineering task: {task_description or 'No description'}"
            }
            
            try:
                frappe.enqueue(
                    method="frappe.desk.doctype.notification_log.notification_log.enqueue_create_notification",
                    users=[engineer_user],
                    **notification
                )
            except Exception as e:
                frappe.log_error(f"Failed to send notification to {engineer_user}: {str(e)}") 
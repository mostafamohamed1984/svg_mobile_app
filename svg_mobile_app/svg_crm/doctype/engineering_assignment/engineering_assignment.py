# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EngineeringAssignment(Document):
    def validate(self):
        self.update_status()
    
    def after_save(self):
        self.create_tasks_for_subtasks()
        
    def create_tasks_for_subtasks(self):
        """Create Engineering Tasks for subtasks in this assignment"""
        if not self.engineering_subtasks:
            return
            
        for subtask in self.engineering_subtasks:
            if subtask.engineer:
                # Check if a task already exists for this subtask engineer
                existing = frappe.get_all(
                    "Engineering Task",
                    filters={
                        "engineering_assignment": self.name,
                        "junior_engineer": subtask.engineer
                    }
                )
                
                if not existing:
                    self.create_engineering_task(subtask)
    
    def create_engineering_task(self, subtask):
        """Create a new Engineering Task for a subtask"""
        task = frappe.get_doc({
            "doctype": "Engineering Task",
            "engineering_assignment": self.name,
            "sketch": self.sketch,
            "requirement_item": self.requirement_item,
            "junior_engineer": subtask.engineer,
            "task_description": subtask.task_description or "No description provided",
            "start_date": subtask.start_date or frappe.utils.nowdate(),
            "end_date": subtask.end_date,
            "status": "Pending",
            "priority": self.priority
        })
        
        task.insert(ignore_permissions=True)
        
        # Send notification to the junior engineer
        self.notify_junior_engineer(subtask.engineer, task.name, self.requirement_item)
        
        return task
    
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
    
    def notify_junior_engineer(self, engineer, task_name, item_name):
        """Send notification to a junior engineer about a new task"""
        # Check if user exists for the engineer
        engineer_user = frappe.db.get_value("Employee", engineer, "user_id")
        if not engineer_user:
            return
            
        notification = {
            "type": "Engineering Task",
            "document_type": "Engineering Task",
            "document_name": task_name,
            "subject": f"New Engineering Task for {item_name}",
            "from_user": frappe.session.user,
            "email_content": f"You have been assigned a new engineering task for {item_name}. Please check the Engineering Task {task_name}."
        }
        
        try:
            frappe.enqueue(
                method="frappe.desk.doctype.notification_log.notification_log.enqueue_create_notification",
                users=[engineer_user],
                **notification
            )
        except Exception as e:
            frappe.log_error(f"Failed to send notification to {engineer_user}: {str(e)}") 
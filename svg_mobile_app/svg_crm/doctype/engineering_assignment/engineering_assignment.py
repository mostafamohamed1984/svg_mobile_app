# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EngineeringAssignment(Document):
    def validate(self):
        self.update_status()
        
        # Flag for tracking if we need to process tasks after save
        self._process_subtasks = False
        
        # Check for new or modified subtasks
        if not self.is_new():
            if self.has_new_or_modified_subtasks():
                self._process_subtasks = True
    
    def after_insert(self):
        """Handle new document creation"""
        if self.engineering_subtasks:
            # For new documents, create tasks for all subtasks
            self.create_tasks_for_subtasks()
    
    def has_new_or_modified_subtasks(self):
        """Check if there are new subtasks or modified subtasks that need processing"""
        if not self.engineering_subtasks:
            return False
            
        if self.is_new():
            # New document, all subtasks are new
            return True
            
        # Get the document before save
        old_doc = self.get_doc_before_save()
        if not old_doc:
            # No previous version, consider all subtasks as new
            return True

        # Check if there are new subtasks or modified ones
        old_subtasks = {f"{st.engineer}:{st.task_description}": st for st in (old_doc.engineering_subtasks or [])}
        
        for subtask in self.engineering_subtasks:
            # Skip empty engineers
            if not subtask.engineer:
                continue
                
            # Check if this subtask is new
            key = f"{subtask.engineer}:{subtask.task_description}"
            if key not in old_subtasks:
                return True
        
        return False
    
    def on_update(self):
        """Triggered after document is saved to database"""
        # Process subtasks if needed
        if getattr(self, '_process_subtasks', False):
            self.create_tasks_for_subtasks()
    
    def create_tasks_for_subtasks(self):
        """Create Engineering Tasks for subtasks in this assignment"""
        if not self.engineering_subtasks:
            return
            
        tasks_created = 0
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
                    task = self.create_engineering_task(subtask)
                    if task:
                        tasks_created += 1
        
        if tasks_created > 0:
            frappe.logger().info(f"Created {tasks_created} engineering tasks for Assignment {self.name}")
    
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
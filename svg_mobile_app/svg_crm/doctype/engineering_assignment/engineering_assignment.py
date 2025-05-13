# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EngineeringAssignment(Document):
    def validate(self):
        # Flag for tracking if we need to process tasks after save
        self._process_subtasks = False
        
        # Check for new or modified subtasks
        if not self.is_new():
            if self.has_new_or_modified_subtasks():
                self._process_subtasks = True
        
        # When the status changes to completed, we need to update the parent sketch
        if not self.is_new() and self.has_value_changed("status"):
            if self.status == "Completed":
                self.update_requirement_status()
            elif self.status == "In Progress" and not self.start_date:
                self.start_date = frappe.utils.nowdate()
    
    def after_insert(self):
        """Handle new document creation"""
        frappe.logger().info(f"After insert for Engineering Assignment {self.name}")
        if self.engineering_subtasks:
            # For new documents, create tasks for all subtasks
            frappe.logger().info(f"Engineering Assignment {self.name} has {len(self.engineering_subtasks)} subtasks to process")
            tasks_created = self.create_tasks_for_subtasks()
            frappe.logger().info(f"Created {tasks_created} tasks from after_insert for Assignment {self.name}")
        else:
            frappe.logger().info(f"Engineering Assignment {self.name} has no subtasks to process")
    
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
            
        # Send notifications on status changes
        if self.has_value_changed("status"):
            self.send_status_notifications()
    
    def create_tasks_for_subtasks(self):
        """Create Engineering Tasks for subtasks in this assignment"""
        if not self.engineering_subtasks:
            frappe.logger().info(f"No subtasks found for Assignment {self.name}, skipping task creation")
            return 0
            
        frappe.logger().info(f"Processing {len(self.engineering_subtasks)} subtasks for Assignment {self.name}")
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
                        # Add a row to the Sketch's Engineering Tasks table
                        self.add_to_sketch_engineering_tasks(subtask, task)
                        tasks_created += 1
        
        if tasks_created > 0:
            frappe.logger().info(f"Created {tasks_created} engineering tasks for Assignment {self.name}")
        else:
            frappe.logger().info(f"No new tasks were created for Assignment {self.name}")
            
        return tasks_created
    
    def create_engineering_task(self, subtask):
        """Create a new Engineering Task for a subtask"""
        # Get the priority from the subtask, or use Medium as default
        priority = subtask.priority if hasattr(subtask, 'priority') else "Medium"
        
        frappe.logger().info(f"Creating engineering task for Assignment {self.name}, engineer: {subtask.engineer}")
        
        task = frappe.get_doc({
            "doctype": "Engineering Task",
            "engineering_assignment": self.name,
            "sketch": self.sketch,
            "requirement_item": self.requirement_item,
            "junior_engineer": subtask.engineer,
            "task_description": subtask.task_description or "No description provided",
            "start_date": subtask.start_date or frappe.utils.nowdate(),
            "end_date": subtask.end_date,
            "status": "Required",
            "priority": priority
        })
        
        task.insert(ignore_permissions=True)
        frappe.logger().info(f"Created engineering task {task.name} for junior engineer {subtask.engineer}")
        
        # Send notification to the junior engineer
        self.notify_junior_engineer(subtask.engineer, task.name, self.requirement_item)
        
        return task
    
    def add_to_sketch_engineering_tasks(self, subtask, task):
        """Add a record to the Sketch's Engineering Tasks table"""
        if not self.sketch:
            return
            
        try:
            # Get the sketch document
            sketch = frappe.get_doc("Sketch", self.sketch)
            
            # Create a new row in the sketch_engineering_tasks table
            sketch.append("sketch_engineering_tasks", {
                "engineer": subtask.engineer,
                "start_date": subtask.start_date or frappe.utils.nowdate(),
                "end_date": subtask.end_date,
                "status": "Required",  # Default status is Required
                "description": subtask.task_description,
                "requirement_item": self.requirement_item,
                "engineering_task": task.name  # Store reference to the Engineering Task
            })
            
            # Save the sketch document
            sketch.save(ignore_permissions=True)
            
            frappe.logger().info(f"Added engineering task for {subtask.engineer} to Sketch {self.sketch}")
            
        except Exception as e:
            frappe.log_error(f"Failed to add task to Sketch {self.sketch}: {str(e)}")
    
    def notify_junior_engineer(self, engineer, task_name, item_name):
        """Send notification to a junior engineer about a new task"""
        # Check if user exists for the engineer
        engineer_user = frappe.db.get_value("Employee", engineer, "user_id")
        if not engineer_user:
            frappe.logger().info(f"No user found for junior engineer {engineer}, skipping notification")
            return
            
        frappe.logger().info(f"Preparing to send notification to {engineer_user} for task {task_name}")
            
        notification = {
            "type": "Alert",
            "document_type": "Engineering Task",
            "document_name": task_name,
            "subject": f"New Engineering Task for {item_name}",
            "from_user": frappe.session.user,
            "email_content": f"You have been assigned a new engineering task for {item_name}. Please check the Engineering Task {task_name}."
        }
        
        try:
            # Directly create notification without enqueuing
            frappe.get_doc({
                "doctype": "Notification Log",
                "for_user": engineer_user,
                **notification
            }).insert(ignore_permissions=True)
            
            frappe.logger().info(f"Successfully sent notification to {engineer_user} for Engineering Task {task_name}")
        except Exception as e:
            frappe.log_error(f"Failed to send notification to {engineer_user}: {str(e)}", title=f"Notification Error: {task_name}", limit_msg_size=True)
    
    def update_requirement_status(self):
        """Update the status of the related requirement in the Sketch document if all tasks are completed"""
        if not self.sketch or not self.requirement_item:
            return
            
        try:
            # Get the sketch document
            sketch = frappe.get_doc("Sketch", self.sketch)
            
            # Find all Engineering Assignments for this requirement item in this sketch
            all_assignments = frappe.get_all(
                "Engineering Assignment",
                filters={
                    "sketch": self.sketch,
                    "requirement_item": self.requirement_item
                },
                fields=["name", "status"]
            )
            
            # Check if all assignments are completed
            all_assignments_completed = all_assignments and all(assignment.status == "Completed" for assignment in all_assignments)
            
            if all_assignments_completed:
                # Update all engineering tasks in sketch for this requirement item
                self.update_all_sketch_engineering_tasks()
                
                # Find the matching requirement in the sketch
                requirement_updated = False
                for req in sketch.sketch_requirements:
                    if req.item == self.requirement_item:
                        # Update the requirement status to Completed
                        if req.status != "Completed":
                            req.status = "Completed"
                            requirement_updated = True
                            frappe.logger().info(f"Updated requirement {self.requirement_item} in Sketch {self.sketch} to Completed")
                        break
                
                if requirement_updated:
                    sketch.save(ignore_permissions=True)
                    
                    # Send notification to the sketch owner
                    self.notify_sketch_owner(sketch.name, self.requirement_item)
        except Exception as e:
            frappe.log_error(f"Failed to update requirement status in Sketch {self.sketch}: {str(e)}")
    
    def update_all_sketch_engineering_tasks(self):
        """Update all engineering tasks in sketch for this requirement item to Completed"""
        if not self.sketch or not self.requirement_item:
            return
            
        try:
            # Get the sketch document
            sketch = frappe.get_doc("Sketch", self.sketch)
            
            # Find all engineering tasks for this requirement item
            tasks_updated = False
            for task in sketch.sketch_engineering_tasks:
                if task.requirement_item == self.requirement_item and task.status != "Completed":
                    task.status = "Completed"
                    tasks_updated = True
            
            if tasks_updated:
                sketch.save(ignore_permissions=True)
                frappe.logger().info(f"Updated all engineering tasks for requirement {self.requirement_item} in Sketch {self.sketch} to Completed")
        except Exception as e:
            frappe.log_error(f"Failed to update engineering tasks in Sketch {self.sketch}: {str(e)}")
    
    def send_status_notifications(self):
        """Send notifications based on status changes"""
        # Skip for new documents
        if self.is_new():
            return
            
        # Get the senior engineer user
        senior_engineer_user = frappe.db.get_value("Employee", self.senior_engineer, "user_id") if self.senior_engineer else None
        
        if self.status == "Completed":
            # Notify the senior engineer when assignment is completed
            if senior_engineer_user:
                self.send_notification(
                    senior_engineer_user,
                    "Assignment Completed",
                    f"Engineering Assignment {self.name} for requirement {self.requirement_item} has been completed."
                )
                
        elif self.status == "In Progress":
            # Notify the senior engineer when assignment is started
            if senior_engineer_user:
                self.send_notification(
                    senior_engineer_user,
                    "Assignment Started",
                    f"Engineering Assignment {self.name} for requirement {self.requirement_item} has been started."
                )
                
        elif self.status == "Review":
            # Notify the senior engineer that an assignment is ready for review
            if senior_engineer_user:
                self.send_notification(
                    senior_engineer_user,
                    "Assignment Ready for Review",
                    f"Engineering Assignment {self.name} for requirement {self.requirement_item} is ready for your review."
                )
    
    def notify_sketch_owner(self, sketch_name, requirement_item):
        """Notify the sketch owner that a requirement has been completed"""
        # Get the owner or responsible person for the sketch
        sketch_owner = frappe.db.get_value("Sketch", sketch_name, "responsible_employee")
        if not sketch_owner:
            return
            
        # Get user ID of the sketch owner
        owner_user = frappe.db.get_value("Employee", sketch_owner, "user_id")
        if not owner_user:
            return
            
        self.send_notification(
            owner_user,
            "Requirement Completed",
            f"Requirement {requirement_item} in Sketch {sketch_name} has been completed."
        )
    
    def send_notification(self, user, subject, message):
        """Send notification to a user"""
        try:
            # Create notification
            frappe.get_doc({
                "doctype": "Notification Log",
                "for_user": user,
                "type": "Alert",
                "document_type": "Engineering Assignment",
                "document_name": self.name,
                "subject": subject,
                "from_user": frappe.session.user,
                "email_content": message
            }).insert(ignore_permissions=True)
            
            frappe.logger().info(f"Sent {subject} notification to {user} for assignment {self.name}")
        except Exception as e:
            frappe.log_error(f"Failed to send notification to {user}: {str(e)}", title=f"Notification Error: {subject}", limit_msg_size=True) 
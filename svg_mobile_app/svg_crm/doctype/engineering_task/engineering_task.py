# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from datetime import datetime


class EngineeringTask(Document):
    def validate(self):
        # Log the current status to debug any validation issues
        frappe.logger().debug(f"Validating Engineering Task {self.name} with status: {self.status}")
        
        # Make sure status is a valid option
        valid_statuses = ["Required", "In Progress", "Ready", "Modification", "Completed"]
        if self.status not in valid_statuses:
            frappe.logger().warning(f"Invalid status '{self.status}' for Engineering Task {self.name}. Setting to 'Required'.")
            self.status = "Required"
            
        # Check if status has changed
        if not self.is_new() and self.status_changed():
            # Update the engineering task in sketch doctype
            self.update_sketch_engineering_task()
            
            # Update parent assignment's status
            self.update_parent_status()
        
        # Set actual_hours when task is marked as completed
        if self.status == "Completed" and (self.is_new() or self.status_changed()):
            # Calculate time difference between now and start_date if actual_hours is not set
            if not self.actual_hours:
                if self.start_date:
                    start_datetime = datetime.strptime(str(self.start_date), "%Y-%m-%d")
                    current_datetime = datetime.now()
                    time_diff = current_datetime - start_datetime
                    # Convert time difference to hours and round to 2 decimal places
                    self.actual_hours = round(time_diff.total_seconds() / 3600, 2)
                else:
                    # Default value if start_date is not available
                    self.actual_hours = self.estimated_hours or 1.0
                    
        # When task is rejected (status changed to Modification), log the reason
        if not self.is_new() and self.status_changed() and self.status == "Modification":
            frappe.logger().info(f"Task {self.name} rejected for modification. Reason: {self.rejection_reason}")
    
    def on_update(self):
        # After task is successfully saved, send notifications based on status changes
        if self.status_changed():
            self.send_status_notifications()
    
    def update_parent_status(self):
        """Update the status of the associated Engineering Assignment based on child task status"""
        # Skip if this is a new document or no assignment is linked
        if self.is_new() or not self.engineering_assignment:
            return
            
        # Get the engineering assignment
        eng_assignment = frappe.get_doc("Engineering Assignment", self.engineering_assignment)
        
        # If this task is completed, check if all tasks are completed
        if self.status == "Completed":
            # Get all tasks for this assignment
            all_tasks = frappe.get_all(
                "Engineering Task",
                filters={"engineering_assignment": self.engineering_assignment},
                fields=["name", "status"]
            )
            
            # Check if all tasks are completed
            all_completed = all_tasks and all(task.status == "Completed" for task in all_tasks)
            
            if all_completed and eng_assignment.status != "Completed":
                # All tasks are completed, update assignment status
                eng_assignment.status = "Completed"
                eng_assignment.save(ignore_permissions=True)
                frappe.logger().info(f"All tasks completed for assignment {self.engineering_assignment}, marked as Completed")
                
        # If task is sent back for modification, update assignment accordingly
        elif self.status == "Modification" and eng_assignment.status != "Review":
            eng_assignment.status = "Review"
            eng_assignment.save(ignore_permissions=True)
            frappe.logger().info(f"Task {self.name} requires modification, assignment {self.engineering_assignment} set to Review")
            
        # If task is marked as Ready, update assignment to Review status
        elif self.status == "Ready" and eng_assignment.status not in ["Review", "Completed"]:
            eng_assignment.status = "Review"
            eng_assignment.save(ignore_permissions=True)
            frappe.logger().info(f"Task {self.name} is ready for review, assignment {self.engineering_assignment} set to Review")

        # If task is in progress, update assignment
        elif self.status == "In Progress" and eng_assignment.status == "Required":
            eng_assignment.status = "In Progress"
            eng_assignment.save(ignore_permissions=True)
            frappe.logger().info(f"Task {self.name} is in progress, assignment {self.engineering_assignment} set to In Progress")
    
    def update_sketch_engineering_task(self):
        """Update the corresponding row in the Sketch's Engineering Tasks table"""
        if not self.sketch or not self.junior_engineer or not self.requirement_item:
            return
            
        try:
            # Get the sketch document
            sketch = frappe.get_doc("Sketch", self.sketch)
            
            # Find the matching engineering task row using the engineering_task field
            task_found = False
            
            # First try to find by direct reference
            for task in sketch.sketch_engineering_tasks:
                if task.get("engineering_task") == self.name:
                    task_found = True
                    
                    # Map Engineering Task status directly to Sketch Engineering Task status
                    # No mapping needed since we've updated the options to match
                    if task.status != self.status:
                        task.status = self.status
                        task.start_date = self.start_date
                        task.end_date = self.end_date
                        
                        # Save the sketch document
                        sketch.save(ignore_permissions=True)
                        frappe.logger().info(f"Updated engineering task for {self.junior_engineer} in Sketch {self.sketch} to status {self.status}")
                    
                    break
            
            # If not found by reference, fallback to finding by engineer and requirement
            if not task_found:
                for task in sketch.sketch_engineering_tasks:
                    if (task.engineer == self.junior_engineer and 
                        task.requirement_item == self.requirement_item):
                        task_found = True
                        
                        # Set the direct reference for future use
                        task.engineering_task = self.name
                        
                        # Update status to match
                        if task.status != self.status:
                            task.status = self.status
                            task.start_date = self.start_date
                            task.end_date = self.end_date
                            
                            # Save the sketch document
                            sketch.save(ignore_permissions=True)
                            frappe.logger().info(f"Updated engineering task for {self.junior_engineer} in Sketch {self.sketch} to status {self.status} and linked reference")
                        
                        break
                    
            # If no task was found, log a warning
            if not task_found:
                frappe.logger().warning(f"No matching task found in Sketch {self.sketch} for engineer {self.junior_engineer} and requirement {self.requirement_item}")
                
        except Exception as e:
            frappe.log_error(f"Failed to update task in Sketch {self.sketch}: {str(e)}", title=f"Update Sketch Task Error: {self.name}", limit_msg_size=True)
    
    def send_status_notifications(self):
        """Send notifications based on status changes"""
        # No need to notify for new documents
        if self.is_new():
            return
            
        # Get senior engineer from the engineering assignment
        eng_assignment = frappe.get_doc("Engineering Assignment", self.engineering_assignment)
        senior_engineer = eng_assignment.senior_engineer
        
        if self.status == "Ready":
            # Notify senior engineer when task is ready for review
            self.notify_engineer(senior_engineer, "Task Ready for Review", 
                f"Engineering Task {self.name} is ready for your review.")
        
        elif self.status == "Modification":
            # Notify junior engineer when task is sent back for modification
            self.notify_engineer(self.junior_engineer, "Task Needs Modification", 
                f"Engineering Task {self.name} requires modification. Reason: {self.rejection_reason}")
        
        elif self.status == "Completed":
            # Notify both senior and junior engineers when task is completed
            self.notify_engineer(senior_engineer, "Task Completed", 
                f"Engineering Task {self.name} has been completed.")
            self.notify_engineer(self.junior_engineer, "Task Marked as Completed", 
                f"Engineering Task {self.name} has been marked as completed.")
    
    def notify_engineer(self, engineer, subject, message):
        """Send notification to an engineer"""
        # Check if user exists for the engineer
        engineer_user = frappe.db.get_value("Employee", engineer, "user_id")
        if not engineer_user:
            frappe.logger().info(f"No user found for engineer {engineer}, skipping notification")
            return
            
        try:
            # Create notification
            frappe.get_doc({
                "doctype": "Notification Log",
                "for_user": engineer_user,
                "type": "Alert",
                "document_type": "Engineering Task",
                "document_name": self.name,
                "subject": subject,
                "from_user": frappe.session.user,
                "email_content": message
            }).insert(ignore_permissions=True)
            
            frappe.logger().info(f"Sent {subject} notification to {engineer_user} for task {self.name}")
        except Exception as e:
            frappe.log_error(f"Failed to send notification to {engineer_user}: {str(e)}", title=f"Notification Error: {subject}", limit_msg_size=True)
    
    def status_changed(self):
        """Check if status has changed from previous value"""
        if not self.get_doc_before_save():
            return True
        
        return self.status != self.get_doc_before_save().status 
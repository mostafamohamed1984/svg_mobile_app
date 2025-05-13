# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from datetime import datetime


class EngineeringTask(Document):
    def validate(self):
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
        
        # Update corresponding row in Sketch Engineering Tasks
        if not self.is_new() and self.status_changed() and self.sketch and self.junior_engineer:
            self.update_sketch_engineering_task()
    
    def update_parent_status(self):
        # If this is a new document or status hasn't changed, no need to update
        if self.is_new() or not self.status_changed():
            return
            
        # Update corresponding Engineering Assignment status
        if self.status == "Completed" and self.engineering_assignment:
            eng_assignment = frappe.get_doc("Engineering Assignment", self.engineering_assignment)
            
            # Check if all child tasks are completed
            all_completed = True
            for task in eng_assignment.engineering_subtasks:
                if task.status != "Completed":
                    all_completed = False
                    break
            
            # If all tasks are completed, update Engineering Assignment status
            if all_completed and eng_assignment.status != "Completed":
                eng_assignment.status = "Completed"
                eng_assignment.save(ignore_permissions=True)
    
    def update_sketch_engineering_task(self):
        """Update the corresponding row in the Sketch's Engineering Tasks table"""
        try:
            # Get the sketch document
            sketch = frappe.get_doc("Sketch", self.sketch)
            
            # Find the matching engineering task row
            for task in sketch.sketch_engineering_tasks:
                if (task.engineer == self.junior_engineer and 
                    task.requirement_item == self.requirement_item):
                    
                    # Set the status based on current Engineering Task status
                    new_status = "Required"
                    if self.status == "Completed":
                        new_status = "Completed"
                    elif self.status == "In Progress":
                        new_status = "Ready"
                    
                    # Only update if status has changed
                    if task.status != new_status:
                        task.status = new_status
                        task.start_date = self.start_date
                        task.end_date = self.end_date
                        
                        # Save the sketch document
                        sketch.save(ignore_permissions=True)
                        frappe.logger().info(f"Updated engineering task for {self.junior_engineer} in Sketch {self.sketch} to status {new_status}")
                    
                    break
        except Exception as e:
            frappe.log_error(f"Failed to update task in Sketch {self.sketch}: {str(e)}")
    
    def status_changed(self):
        """Check if status has changed from previous value"""
        if not self.get_doc_before_save():
            return True
        
        return self.status != self.get_doc_before_save().status 
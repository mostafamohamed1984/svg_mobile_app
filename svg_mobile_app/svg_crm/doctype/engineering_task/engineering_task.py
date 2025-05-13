# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EngineeringTask(Document):
    def validate(self):
        self.update_parent_status()
    
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
    
    def status_changed(self):
        """Check if status has changed from previous value"""
        if not self.get_doc_before_save():
            return True
        
        return self.status != self.get_doc_before_save().status 
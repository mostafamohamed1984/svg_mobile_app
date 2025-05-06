# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import getdate, add_days, add_months, add_to_date, nowdate, now_datetime
from frappe.utils.file_manager import save_file
import datetime


class IssueRequirementsReminders(Document):
    def validate(self):
        self.set_next_date()
    
    def on_submit(self):
        if self.reminder_status == "Active" and self.enabled:
            self.schedule_reminder()
    
    @frappe.whitelist()
    def set_next_date(self):
        """Set the next date for the reminder based on frequency"""
        if self.remind_on == "Specific Date":
            self.next_date = self.date_to_remind
            return
            
        today = getdate(nowdate())
        
        if self.frequency == "Daily":
            self.next_date = today
        elif self.frequency == "Weekly":
            # Next Monday
            days_ahead = 0 - today.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            self.next_date = add_days(today, days_ahead)
        elif self.frequency == "Monthly":
            # First day of next month
            if today.day == 1:
                self.next_date = today
            else:
                next_month = add_months(today, 1)
                self.next_date = datetime.date(next_month.year, next_month.month, 1)
        elif self.frequency == "Quarterly":
            # First day of the next quarter
            quarter_start_month = ((today.month - 1) // 3) * 3 + 1
            if today.month == quarter_start_month and today.day == 1:
                self.next_date = today
            else:
                if quarter_start_month == 1:
                    next_quarter_month = 4
                elif quarter_start_month == 4:
                    next_quarter_month = 7
                elif quarter_start_month == 7:
                    next_quarter_month = 10
                else:
                    next_quarter_month = 1
                    today = add_months(today, 3)
                
                self.next_date = datetime.date(today.year, next_quarter_month, 1)
        elif self.frequency == "Yearly":
            # First day of next year
            if today.month == 1 and today.day == 1:
                self.next_date = today
            else:
                self.next_date = datetime.date(today.year + 1, 1, 1)
    
    @frappe.whitelist()
    def schedule_reminder(self):
        """Schedule the reminder to be processed by background job"""
        if not self.enabled:
            return
            
        if not self.next_date:
            self.set_next_date()
            
        if getdate(self.next_date) <= getdate(nowdate()):
            # If next date is today or in the past, process immediately
            self.process_reminder()
            
            # If repeatable, schedule next date
            if self.repeat_reminder:
                self.set_next_reminder_date()
                frappe.db.set_value("Issue Requirements Reminders", self.name, "next_date", self.next_date)
                
                # Schedule for next date
                frappe.enqueue(
                    "svg_mobile_app.svg_mobile_app.doctype.issue_requirements_reminders.issue_requirements_reminders.process_scheduled_reminders",
                    reminder_id=self.name, 
                    scheduled_date=self.next_date,
                    now=False,
                    queue="long"
                )
            else:
                frappe.db.set_value("Issue Requirements Reminders", self.name, "reminder_status", "Completed")
        else:
            # Schedule for future date
            frappe.enqueue(
                "svg_mobile_app.svg_mobile_app.doctype.issue_requirements_reminders.issue_requirements_reminders.process_scheduled_reminders",
                reminder_id=self.name, 
                scheduled_date=self.next_date,
                now=False,
                queue="long"
            )
    
    @frappe.whitelist()
    def set_next_reminder_date(self):
        """Update next_date field based on frequency for repeating reminders"""
        current_date = getdate(self.next_date)
        
        if self.frequency == "Daily":
            self.next_date = add_days(current_date, 1)
        elif self.frequency == "Weekly":
            self.next_date = add_days(current_date, 7)
        elif self.frequency == "Monthly":
            self.next_date = add_months(current_date, 1)
        elif self.frequency == "Quarterly":
            self.next_date = add_months(current_date, 3)
        elif self.frequency == "Yearly":
            self.next_date = add_to_date(current_date, years=1)
        elif self.frequency == "Specific Date" and self.remind_on == "Specific Date":
            # For specific date, don't repeat if it's not repeating
            pass
    
    @frappe.whitelist()
    def process_reminder(self):
        """Process the reminder by sending notifications and emails"""
        if not self.enabled:
            return False
            
        # Get users with the specified role
        users = frappe.get_all("Has Role", 
                              filters={"role": self.reminder_role, "parenttype": "User"},
                              fields=["parent as user"])
        
        success = False
        for user_dict in users:
            user = user_dict.get("user")
            
            # Create notification in the system
            try:
                notification = frappe.new_doc("Notification Log")
                notification.subject = self.reminder_title
                notification.for_user = user
                notification.type = "Alert"
                notification.document_type = "Issue Requirements Reminders"
                notification.document_name = self.name
                notification.from_user = "Administrator"
                notification.email_content = self.content
                notification.insert(ignore_permissions=True)
                
                # Send email if enabled
                if self.send_to_email:
                    email = self.get_user_email(user)
                    if email:
                        try:
                            frappe.sendmail(
                                recipients=[email],
                                subject=self.reminder_title,
                                message=self.content,
                                reference_doctype="Issue Requirements Reminders",
                                reference_name=self.name
                            )
                            
                            # Log successful email
                            self.append("reminder_logs", {
                                "reminder_date": now_datetime(),
                                "sent_to": user,
                                "status": "Sent",
                                "email": email
                            })
                            success = True
                        except Exception as e:
                            frappe.log_error(f"Failed to send reminder email to {email}: {str(e)}", 
                                           "Issue Requirements Reminder")
                            # Log failed email
                            self.append("reminder_logs", {
                                "reminder_date": now_datetime(),
                                "sent_to": user,
                                "status": "Failed",
                                "email": email
                            })
                else:
                    # Log successful notification
                    self.append("reminder_logs", {
                        "reminder_date": now_datetime(),
                        "sent_to": user,
                        "status": "Sent",
                        "email": ""
                    })
                    success = True
            except Exception as e:
                frappe.log_error(f"Failed to create reminder notification for {user}: {str(e)}", 
                               "Issue Requirements Reminder")
                
                # Log failed notification
                self.append("reminder_logs", {
                    "reminder_date": now_datetime(),
                    "sent_to": user,
                    "status": "Failed",
                    "email": ""
                })
                
        # Save the document with the logs
        self.save()
        return success
    
    def get_user_email(self, user):
        """Get user's email or company email if they have an Employee record"""
        # First, check for employee email
        employee = frappe.db.get_value("Employee", {"user_id": user}, "company_email")
        if employee:
            return employee
        
        # Fallback to user email
        return frappe.db.get_value("User", user, "email")


@frappe.whitelist()
def process_scheduled_reminders(reminder_id=None, scheduled_date=None):
    """Process scheduled reminders - can be called via scheduler or directly"""
    filters = {"docstatus": 1, "reminder_status": "Active", "enabled": 1}
    
    if reminder_id:
        filters["name"] = reminder_id
    
    if scheduled_date:
        filters["next_date"] = scheduled_date
    else:
        filters["next_date"] = nowdate()
    
    reminders = frappe.get_all("Issue Requirements Reminders", filters=filters)
    
    for reminder in reminders:
        try:
            doc = frappe.get_doc("Issue Requirements Reminders", reminder.name)
            doc.process_reminder()
            
            # Update for next occurrence
            if doc.repeat_reminder:
                doc.set_next_reminder_date()
                frappe.db.set_value("Issue Requirements Reminders", doc.name, "next_date", doc.next_date)
                
                # Schedule next reminder
                frappe.enqueue(
                    "svg_mobile_app.svg_mobile_app.doctype.issue_requirements_reminders.issue_requirements_reminders.process_scheduled_reminders",
                    reminder_id=doc.name, 
                    scheduled_date=doc.next_date,
                    now=False,
                    queue="long"
                )
            else:
                frappe.db.set_value("Issue Requirements Reminders", doc.name, "reminder_status", "Completed")
        except Exception as e:
            frappe.log_error(f"Failed to process reminder {reminder.name}: {str(e)}", 
                           "Issue Requirements Reminder Scheduler") 
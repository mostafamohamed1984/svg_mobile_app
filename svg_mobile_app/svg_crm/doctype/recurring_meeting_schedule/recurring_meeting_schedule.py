# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import nowdate, today, add_days, add_months, getdate, now_datetime, get_datetime
import datetime


class RecurringMeetingSchedule(Document):
    def validate(self):
        """Validate the recurring meeting schedule"""
        self.validate_dates()
        self.calculate_duration()
        self.calculate_uae_times()
        self.set_next_run_date()
        self.set_creation_details()

    def validate_dates(self):
        """Validate start and end dates"""
        if self.start_date and getdate(self.start_date) < getdate(today()):
            frappe.throw("Start Date cannot be in the past")
        
        if self.end_date and self.start_date:
            if getdate(self.end_date) < getdate(self.start_date):
                frappe.throw("End Date cannot be before Start Date")

    def calculate_duration(self):
        """Calculate meeting duration from EG times"""
        if self.time_fromeg and self.time_toeg:
            # Convert time strings to datetime objects for calculation
            from_time = get_datetime(f"{today()} {self.time_fromeg}")
            to_time = get_datetime(f"{today()} {self.time_toeg}")
            
            if to_time <= from_time:
                frappe.throw("End time must be after start time")
            
            # Calculate duration in seconds
            duration_seconds = (to_time - from_time).total_seconds()
            self.duration = int(duration_seconds)

    def calculate_uae_times(self):
        """Calculate UAE times (+1 hour from EG times)"""
        if self.time_fromeg:
            from_time = get_datetime(f"{today()} {self.time_fromeg}")
            uae_from_time = from_time + datetime.timedelta(hours=1)
            self.time_fromuae = uae_from_time.strftime("%H:%M:%S")
        
        if self.time_toeg:
            to_time = get_datetime(f"{today()} {self.time_toeg}")
            uae_to_time = to_time + datetime.timedelta(hours=1)
            self.time_touae = uae_to_time.strftime("%H:%M:%S")

    def set_next_run_date(self):
        """Set the next run date based on frequency and start date"""
        if not self.next_run_date and self.start_date:
            self.next_run_date = self.start_date

    def set_creation_details(self):
        """Set creation details if not already set"""
        if not self.creation_date:
            self.creation_date = today()
        
        if not self.created_by and frappe.session.user:
            # Try to get employee record for current user
            employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
            if employee:
                self.created_by = employee

    def get_next_occurrence_date(self, current_date=None):
        """Calculate the next occurrence date based on frequency"""
        if not current_date:
            current_date = getdate(self.next_run_date or self.start_date)
        
        if self.frequency == "Daily":
            return add_days(current_date, 1)
        elif self.frequency == "Weekly":
            return add_days(current_date, 7)
        elif self.frequency == "Monthly":
            return add_months(current_date, 1)
        
        return current_date

    def should_create_meeting(self):
        """Check if a meeting should be created today"""
        if not self.is_enabled:
            return False
        
        if not self.next_run_date:
            return False
        
        # Check if next run date is today or in the past
        if getdate(self.next_run_date) <= getdate(today()):
            # Check if end date has passed
            if self.end_date and getdate(today()) > getdate(self.end_date):
                return False
            return True
        
        return False

    def create_meeting_from_template(self):
        """Create a new meeting from the template"""
        if not self.meeting_templet:
            frappe.throw("Meeting Template is required to create meetings")
        
        # Get the template
        template = frappe.get_doc("Meeting Templets", self.meeting_templet)
        
        # Create new meeting
        meeting = frappe.new_doc("Meeting")
        
        # Copy template data
        meeting.subject = template.subject
        meeting.department = template.department
        meeting.meeting_type = template.meeting_type
        meeting.venue = template.venue
        meeting.meeting_link = template.meeting_link
        meeting.meeting_templet = self.meeting_templet
        
        # Set date and times
        meeting.date = self.next_run_date
        meeting.time_fromeg = self.time_fromeg
        meeting.time_toeg = self.time_toeg
        meeting.time_fromuae = self.time_fromuae
        meeting.time_touae = self.time_touae
        meeting.duration = self.duration
        
        # Set status and requested by
        meeting.status = "Planned"
        if self.created_by:
            meeting.requested_by = self.created_by
        
        # Copy agenda
        for agenda_item in template.agenda:
            meeting.append("agenda", {
                "agenda": agenda_item.agenda
            })
        
        # Copy participants
        for participant in template.participants:
            meeting.append("participants", {
                "employee": participant.employee,
                "employee_name": participant.employee_name,
                "email": participant.email,
                "joining_type": participant.joining_type
            })
        
        # Add note about automation
        meeting.notes = f"<p>This meeting was automatically created from recurring schedule: <strong>{self.schedule_name}</strong></p>"
        if self.notes:
            meeting.notes += f"<br><p>Schedule Notes: {self.notes}</p>"
        
        # Save the meeting
        meeting.insert()
        
        # Log the created meeting
        self.append("created_meetings", {
            "meeting_name": meeting.name,
            "meeting_date": meeting.date,
            "creation_datetime": now_datetime(),
            "status": "Created"
        })
        
        # Update counters and next run date
        self.total_meetings_created = (self.total_meetings_created or 0) + 1
        self.last_run_date = now_datetime()
        self.next_run_date = self.get_next_occurrence_date()
        
        # Save the schedule
        self.save()
        
        frappe.logger().info(f"Created meeting {meeting.name} from recurring schedule {self.name}")
        
        return meeting.name

    @frappe.whitelist()
    def create_test_meeting(self):
        """Create a test meeting manually (for testing purposes)"""
        return self.create_meeting_from_template()

    @frappe.whitelist()
    def preview_next_meetings(self, count=5):
        """Preview the next few meeting dates"""
        dates = []
        current_date = getdate(self.next_run_date or self.start_date)
        
        for i in range(count):
            if self.end_date and current_date > getdate(self.end_date):
                break
            
            dates.append({
                "date": current_date.strftime("%Y-%m-%d"),
                "day": current_date.strftime("%A"),
                "time_eg": f"{self.time_fromeg} - {self.time_toeg}",
                "time_uae": f"{self.time_fromuae} - {self.time_touae}"
            })
            
            current_date = self.get_next_occurrence_date(current_date)
        
        return dates 
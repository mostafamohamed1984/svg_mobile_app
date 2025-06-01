import frappe
from frappe.utils import today, getdate, now_datetime


def create_recurring_meetings():
    """Create meetings from active recurring schedules"""
    try:
        # Get all enabled recurring schedules that are due for execution
        schedules = frappe.get_all(
            "Recurring Meeting Schedule",
            filters={
                "is_enabled": 1,
                "next_run_date": ["<=", today()]
            },
            fields=["name", "schedule_name", "next_run_date", "end_date"]
        )
        
        created_count = 0
        
        for schedule_data in schedules:
            # Skip if end date has passed
            if schedule_data.end_date and getdate(schedule_data.end_date) < getdate(today()):
                continue
            
            try:
                # Get the full schedule document
                schedule = frappe.get_doc("Recurring Meeting Schedule", schedule_data.name)
                
                # Check if meeting should be created
                if schedule.should_create_meeting():
                    # Create the meeting
                    meeting_name = schedule.create_meeting_from_template()
                    created_count += 1
                    
                    frappe.logger().info(f"Created meeting {meeting_name} from schedule {schedule.name}")
                
            except Exception as e:
                frappe.logger().error(f"Error creating meeting from schedule {schedule_data.name}: {e}")
                continue
        
        if created_count > 0:
            frappe.logger().info(f"Successfully created {created_count} recurring meetings")
        
        return created_count
        
    except Exception as e:
        frappe.logger().error(f"Error in create_recurring_meetings: {e}")
        return 0


def update_daily_recurring_meetings():
    """Update daily recurring meetings - called by daily scheduler"""
    return create_recurring_meetings()


def update_weekly_recurring_meetings():
    """Update weekly recurring meetings - called by weekly scheduler"""
    # Get weekly schedules specifically
    try:
        schedules = frappe.get_all(
            "Recurring Meeting Schedule",
            filters={
                "is_enabled": 1,
                "frequency": "Weekly",
                "next_run_date": ["<=", today()]
            },
            fields=["name"]
        )
        
        created_count = 0
        
        for schedule_data in schedules:
            try:
                schedule = frappe.get_doc("Recurring Meeting Schedule", schedule_data.name)
                if schedule.should_create_meeting():
                    meeting_name = schedule.create_meeting_from_template()
                    created_count += 1
                    
            except Exception as e:
                frappe.logger().error(f"Error creating weekly meeting from schedule {schedule_data.name}: {e}")
                continue
        
        return created_count
        
    except Exception as e:
        frappe.logger().error(f"Error in update_weekly_recurring_meetings: {e}")
        return 0


def update_monthly_recurring_meetings():
    """Update monthly recurring meetings - called by monthly scheduler"""
    # Get monthly schedules specifically
    try:
        schedules = frappe.get_all(
            "Recurring Meeting Schedule",
            filters={
                "is_enabled": 1,
                "frequency": "Monthly",
                "next_run_date": ["<=", today()]
            },
            fields=["name"]
        )
        
        created_count = 0
        
        for schedule_data in schedules:
            try:
                schedule = frappe.get_doc("Recurring Meeting Schedule", schedule_data.name)
                if schedule.should_create_meeting():
                    meeting_name = schedule.create_meeting_from_template()
                    created_count += 1
                    
            except Exception as e:
                frappe.logger().error(f"Error creating monthly meeting from schedule {schedule_data.name}: {e}")
                continue
        
        return created_count
        
    except Exception as e:
        frappe.logger().error(f"Error in update_monthly_recurring_meetings: {e}")
        return 0


def check_meeting_timing_conflicts():
    """Check for meeting timing conflicts - timing validation script"""
    try:
        # Get all planned meetings for today and future
        meetings = frappe.get_all(
            "Meeting",
            filters={
                "status": "Planned",
                "date": [">=", today()]
            },
            fields=["name", "date", "time_fromeg", "time_toeg", "participants"]
        )
        
        conflicts = []
        
        # Check for conflicts
        for i, meeting1 in enumerate(meetings):
            for j, meeting2 in enumerate(meetings[i+1:], i+1):
                if meeting1.date == meeting2.date:
                    # Check time overlap
                    if times_overlap(meeting1.time_fromeg, meeting1.time_toeg, 
                                   meeting2.time_fromeg, meeting2.time_toeg):
                        
                        # Check if they have common participants
                        common_participants = get_common_participants(meeting1.name, meeting2.name)
                        
                        if common_participants:
                            conflicts.append({
                                "meeting1": meeting1.name,
                                "meeting2": meeting2.name,
                                "date": meeting1.date,
                                "common_participants": common_participants
                            })
        
        if conflicts:
            frappe.logger().warning(f"Found {len(conflicts)} meeting timing conflicts")
            
            # Optionally send notification to administrators
            for conflict in conflicts:
                frappe.logger().warning(f"Conflict: {conflict['meeting1']} and {conflict['meeting2']} on {conflict['date']}")
        
        return conflicts
        
    except Exception as e:
        frappe.logger().error(f"Error in check_meeting_timing_conflicts: {e}")
        return []


def times_overlap(start1, end1, start2, end2):
    """Check if two time ranges overlap"""
    try:
        from datetime import datetime, time
        
        # Convert time strings to time objects
        start1_time = datetime.strptime(start1, "%H:%M:%S").time()
        end1_time = datetime.strptime(end1, "%H:%M:%S").time()
        start2_time = datetime.strptime(start2, "%H:%M:%S").time()
        end2_time = datetime.strptime(end2, "%H:%M:%S").time()
        
        # Check for overlap
        return start1_time < end2_time and start2_time < end1_time
        
    except Exception:
        return False


def get_common_participants(meeting1_name, meeting2_name):
    """Get common participants between two meetings"""
    try:
        # Get participants from both meetings
        participants1 = frappe.get_all(
            "Participants",
            filters={"parent": meeting1_name},
            fields=["employee"]
        )
        
        participants2 = frappe.get_all(
            "Participants", 
            filters={"parent": meeting2_name},
            fields=["employee"]
        )
        
        # Find common participants
        employees1 = {p.employee for p in participants1}
        employees2 = {p.employee for p in participants2}
        
        common = employees1.intersection(employees2)
        return list(common)
        
    except Exception:
        return [] 
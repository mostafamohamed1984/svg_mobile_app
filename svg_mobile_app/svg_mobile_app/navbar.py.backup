import frappe
from datetime import datetime, date
import json

def get_attendance_info(bootinfo):
    """Add attendance info to bootinfo for navbar display"""
    if frappe.session.user == "Guest":
        return
    
    try:
        # Get current user's employee record
        employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
        if not employee:
            return
        
        # Check if user has checked in today
        today = date.today()
        last_checkin = frappe.db.get_value(
            "Employee Checkin",
            {
                "employee": employee,
                "time": [">=", today]
            },
            ["log_type", "time"],
            order_by="time desc"
        )
        
        # Determine current status
        can_checkin = True
        can_checkout = False
        current_status = "Not Checked In"
        
        if last_checkin:
            if last_checkin[0] == "IN":
                can_checkin = False
                can_checkout = True
                current_status = "Checked In"
            else:
                can_checkin = True
                can_checkout = False
                current_status = "Checked Out"
        
        # Add to bootinfo
        bootinfo.attendance_status = {
            'employee': employee,
            'can_checkin': can_checkin,
            'can_checkout': can_checkout,
            'current_status': current_status,
            'last_action': last_checkin[0] if last_checkin else None,
            'last_time': str(last_checkin[1]) if last_checkin else None
        }
        
    except Exception as e:
        frappe.log_error(f"Error getting attendance info: {str(e)}", "Navbar Attendance")

@frappe.whitelist()
def perform_attendance_action(action):
    """Perform checkin or checkout action"""
    try:
        # Get current user's employee record
        employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
        if not employee:
            return {
                'success': False,
                'error': 'No employee record found for current user'
            }
        
        # Create Employee Checkin record
        checkin_doc = frappe.get_doc({
            'doctype': 'Employee Checkin',
            'employee': employee,
            'log_type': 'IN' if action == 'checkin' else 'OUT',
            'time': frappe.utils.now_datetime()
        })
        
        checkin_doc.insert()
        
        action_text = 'Checked In' if action == 'checkin' else 'Checked Out'
        
        return {
            'success': True,
            'message': f'Successfully {action_text} at {frappe.utils.format_datetime(checkin_doc.time)}'
        }
        
    except Exception as e:
        frappe.log_error(f"Attendance action error: {str(e)}", "Navbar Attendance")
        return {
            'success': False,
            'error': f'Failed to perform {action}: {str(e)}'
        }

@frappe.whitelist()
def get_attendance_status():
    """Get current attendance status for manual API calls"""
    try:
        # Get current user's employee record
        employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
        if not employee:
            return {
                'error': 'No employee record found for current user'
            }
        
        # Check if user has checked in today
        today = frappe.utils.today()
        last_checkin = frappe.db.get_value(
            "Employee Checkin",
            {
                "employee": employee,
                "time": [">=", today]
            },
            ["log_type", "time"],
            order_by="time desc"
        )
        
        # Determine current status
        can_checkin = True
        can_checkout = False
        current_status = "Not Checked In"
        
        if last_checkin:
            if last_checkin[0] == "IN":
                can_checkin = False
                can_checkout = True
                current_status = "Checked In"
            else:
                can_checkin = True
                can_checkout = False
                current_status = "Checked Out"
        
        return {
            'employee': employee,
            'can_checkin': can_checkin,
            'can_checkout': can_checkout,
            'current_status': current_status,
            'last_action': last_checkin[0] if last_checkin else None,
            'last_time': str(last_checkin[1]) if last_checkin else None
        }
        
    except Exception as e:
        frappe.log_error(f"Get attendance status error: {str(e)}", "Navbar Attendance")
        return {
            'error': f'Failed to get attendance status: {str(e)}'
        }

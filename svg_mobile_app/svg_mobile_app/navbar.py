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
def perform_attendance_action(action, latitude=None, longitude=None):
    """Perform checkin or checkout action with GPS coordinates"""
    try:
        # Debug logging
        frappe.log_error(f"Received parameters - action: {action}, latitude: {latitude}, longitude: {longitude}", "Navbar Debug")
        
        # Get current user's employee record
        employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
        if not employee:
            return {
                'success': False,
                'error': 'No employee record found for current user'
            }

        # Convert coordinates to float if they exist
        lat_float = None
        lng_float = None
        
        if latitude is not None and latitude != "":
            try:
                lat_float = float(latitude)
            except (ValueError, TypeError):
                frappe.log_error(f"Invalid latitude: {latitude}", "Navbar Debug")
                
        if longitude is not None and longitude != "":
            try:
                lng_float = float(longitude)
            except (ValueError, TypeError):
                frappe.log_error(f"Invalid longitude: {longitude}", "Navbar Debug")

        # Create Employee Checkin record
        checkin_doc = frappe.get_doc({
            'doctype': 'Employee Checkin',
            'employee': employee,
            'log_type': 'IN' if action == 'checkin' else 'OUT',
            'time': frappe.utils.now_datetime(),
            'device_id': 'Navbar Button'
        })

        # Add GPS coordinates if valid
        if lat_float is not None and lng_float is not None:
            checkin_doc.latitude = lat_float
            checkin_doc.longitude = lng_float
            frappe.log_error(f"Setting coordinates - lat: {lat_float}, lng: {lng_float}", "Navbar Debug")
        else:
            # Set default coordinates if none provided (you may want to change these)
            checkin_doc.latitude = 0.0
            checkin_doc.longitude = 0.0
            frappe.log_error("Using default coordinates 0,0", "Navbar Debug")

        # Try to save the document
        checkin_doc.insert()
        frappe.log_error(f"Successfully created checkin: {checkin_doc.name}", "Navbar Debug")

        action_text = 'Checked In' if action == 'checkin' else 'Checked Out'

        return {
            'success': True,
            'message': f'Successfully {action_text} at {frappe.utils.format_datetime(checkin_doc.time)}'
        }

    except Exception as e:
        error_msg = f"Attendance action error: {str(e)}"
        frappe.log_error(error_msg, "Navbar Attendance")
        return {
            'success': False,
            'error': str(e)
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

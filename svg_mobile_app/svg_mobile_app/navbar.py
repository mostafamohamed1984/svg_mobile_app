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

        # Validate and set geolocation - make it mandatory
        if lat_float is None or lng_float is None:
            return {
                'success': False,
                'error': 'Location coordinates are required for attendance.',
                'message': 'Please enable location access and try again.'
            }
        
        # Basic validation - ensure coordinates are reasonable
        if lat_float == 0.0 and lng_float == 0.0:
            return {
                'success': False,
                'error': 'Invalid location coordinates.',
                'message': 'Please ensure location services are enabled and try again.'
            }
        
        # Validate latitude and longitude ranges
        if not (-90 <= lat_float <= 90) or not (-180 <= lng_float <= 180):
            return {
                'success': False,
                'error': 'Invalid location coordinates.',
                'message': 'Location coordinates are out of valid range.'
            }
        
        checkin_doc.latitude = lat_float
        checkin_doc.longitude = lng_float
        frappe.log_error(f"Setting valid coordinates - lat: {lat_float}, lng: {lng_float}", "Navbar Debug")

        # Try to save the document
        checkin_doc.insert()
        frappe.log_error(f"Successfully created checkin: {checkin_doc.name}", "Navbar Debug")

        action_text = 'Checked In' if action == 'checkin' else 'Checked Out'

        return {
            'success': True,
            'message': f'Successfully {action_text} at {frappe.utils.format_datetime(checkin_doc.time)}'
        }

    except Exception as e:
        # Truncate error message to avoid character limit issues
        error_str = str(e)
        if len(error_str) > 100:
            error_str = error_str[:100] + "..."
        
        frappe.log_error(f"Attendance error: {error_str}", "Navbar Attendance")
        
        # Handle specific duplicate log error
        if "already has a log with the same timestamp" in str(e):
            return {
                'success': False,
                'error': 'Duplicate entry detected. Please wait a moment before trying again.',
                'message': 'You have already checked in/out recently. Please wait before trying again.'
            }
        
        return {
            'success': False,
            'error': error_str,
            'message': f'Attendance action failed: {error_str}'
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

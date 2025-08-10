import frappe
from datetime import datetime, date
def _is_navbar_checkin_enabled_for_current_user() -> bool:
    """Evaluate settings, company scope, and role gating for current session user."""
    try:
        settings = frappe.get_single("BCC Processing Settings")
        if not getattr(settings, "enable_navbar_checkin", 0):
            return False

        # Company scope
        scope = (getattr(settings, "navbar_checkin_company_scope", "All Companies") or "All Companies").strip()
        companies_raw = getattr(settings, "navbar_checkin_companies", "") or ""
        companies = [c.strip() for c in companies_raw.split(',') if c and c.strip()]
        company_allowed = True
        user_default_company = frappe.defaults.get_user_default("company")
        if scope != "All Companies" and user_default_company:
            if scope == "Only Selected":
                company_allowed = user_default_company in companies if companies else False
            elif scope == "Exclude Selected":
                company_allowed = user_default_company not in companies if companies else True

        if not company_allowed:
            return False

        # Role gating
        roles_raw = getattr(settings, "navbar_checkin_allowed_roles", "") or ""
        allowed_roles = [r.strip() for r in roles_raw.split(',') if r and r.strip()]
        if allowed_roles:
            user_roles = frappe.get_roles(frappe.session.user)
            if not any(r in user_roles for r in allowed_roles):
                return False

        return True
    except Exception:
        return False
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

        # Read toggle and scoping from settings
        try:
            settings = frappe.get_single("BCC Processing Settings")
            enabled = bool(getattr(settings, "enable_navbar_checkin", 0))
            scope = (getattr(settings, "navbar_checkin_company_scope", "All Companies") or "All Companies").strip()
            companies_raw = getattr(settings, "navbar_checkin_companies", "") or ""
            companies = [c.strip() for c in companies_raw.split(',') if c and c.strip()]
            roles_raw = getattr(settings, "navbar_checkin_allowed_roles", "") or ""
            allowed_roles = [r.strip() for r in roles_raw.split(',') if r and r.strip()]
        except Exception:
            enabled = False
            scope = "All Companies"
            companies = []
            allowed_roles = []

        # Determine company scope allowance using session default company if present
        company_allowed = True
        try:
            user_default_company = frappe.defaults.get_user_default("company")
            if enabled and scope != "All Companies" and user_default_company:
                if scope == "Only Selected":
                    company_allowed = user_default_company in companies if companies else False
                elif scope == "Exclude Selected":
                    company_allowed = user_default_company not in companies if companies else True
        except Exception:
            pass

        # Determine role allowance
        role_allowed = True
        try:
            if enabled and allowed_roles:
                user_roles = frappe.get_roles(frappe.session.user)
                role_allowed = any(r in user_roles for r in allowed_roles)
        except Exception:
            pass

        # Add to bootinfo - include both status and feature toggle with scope
        bootinfo.attendance_status = {
            'employee': employee,
            'can_checkin': can_checkin,
            'can_checkout': can_checkout,
            'current_status': current_status,
            'last_action': last_checkin[0] if last_checkin else None,
            'last_time': str(last_checkin[1]) if last_checkin else None
        }

        bootinfo.svg_navbar_checkin = {
            'enabled': bool(_is_navbar_checkin_enabled_for_current_user()),
            'company_scope': scope,
            'companies': companies,
            'allowed_roles': allowed_roles
        }

    except Exception as e:
        frappe.log_error(f"Error getting attendance info: {str(e)}", "Navbar Attendance")

@frappe.whitelist()
def perform_attendance_action(action, latitude=None, longitude=None):
    """Perform checkin or checkout action with GPS coordinates"""
    try:
        # Enforce feature toggle on server-side as well
        if not _is_navbar_checkin_enabled_for_current_user():
            return {
                'success': False,
                'error': 'Navbar checkin is disabled for your account or company.',
                'message': 'This feature is currently disabled. Please contact your administrator.'
            }

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

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
        current_status = "OUT"
        
        if last_checkin:
            current_status = last_checkin[0]
            can_checkin = last_checkin[0] == "OUT"
            can_checkout = last_checkin[0] == "IN"
        
        bootinfo.attendance_status = {
            "employee": employee,
            "employee_name": frappe.db.get_value("Employee", employee, "employee_name"),
            "last_checkin": {
                "log_type": last_checkin[0] if last_checkin else None,
                "time": last_checkin[1].strftime('%H:%M') if last_checkin else None
            } if last_checkin else None,
            "current_status": current_status,
            "can_checkin": can_checkin,
            "can_checkout": can_checkout,
            "today": today.strftime('%Y-%m-%d')
        }
        
    except Exception as e:
        frappe.log_error(f"Error in get_attendance_info: {str(e)}", "Navbar Attendance")

@frappe.whitelist()
def create_checkin(log_type):
    """Create employee checkin/checkout"""
    try:
        # Validate log_type
        if log_type not in ["IN", "OUT"]:
            frappe.throw("Invalid log type. Must be 'IN' or 'OUT'")
        
        # Get employee record
        employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
        if not employee:
            frappe.throw("No employee record found for current user")
        
        # Check if employee is active
        employee_status = frappe.db.get_value("Employee", employee, "status")
        if employee_status != "Active":
            frappe.throw("Employee is not active")
        
        # Validate checkin logic
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
        
        # Validation logic
        if log_type == "IN" and last_checkin and last_checkin[0] == "IN":
            frappe.throw("You are already checked in. Please check out first.")
        
        if log_type == "OUT" and (not last_checkin or last_checkin[0] == "OUT"):
            frappe.throw("You must check in first before checking out.")
        
        # Create new checkin record
        checkin = frappe.new_doc("Employee Checkin")
        checkin.employee = employee
        checkin.log_type = log_type
        checkin.time = datetime.now()
        checkin.device_id = "Navbar Button"  # Identifier for this source
        checkin.save()
        
        # Get employee name for message
        employee_name = frappe.db.get_value("Employee", employee, "employee_name")
        
        action_text = "checked in" if log_type == "IN" else "checked out"
        
        return {
            "success": True,
            "message": f"{employee_name} successfully {action_text} at {checkin.time.strftime('%H:%M')}",
            "checkin": checkin.name,
            "log_type": log_type,
            "time": checkin.time.strftime('%H:%M'),
            "employee": employee
        }
        
    except Exception as e:
        frappe.log_error(f"Error in create_checkin: {str(e)}", "Navbar Attendance")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def get_attendance_status():
    """Get current attendance status for the logged-in user"""
    try:
        employee = frappe.db.get_value("Employee", {"user_id": frappe.session.user}, "name")
        if not employee:
            return {"error": "No employee record found"}
        
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
        
        current_status = "OUT"
        can_checkin = True
        can_checkout = False
        
        if last_checkin:
            current_status = last_checkin[0]
            can_checkin = last_checkin[0] == "OUT"
            can_checkout = last_checkin[0] == "IN"
        
        return {
            "employee": employee,
            "employee_name": frappe.db.get_value("Employee", employee, "employee_name"),
            "current_status": current_status,
            "can_checkin": can_checkin,
            "can_checkout": can_checkout,
            "last_checkin": {
                "log_type": last_checkin[0],
                "time": last_checkin[1].strftime('%H:%M')
            } if last_checkin else None
        }
        
    except Exception as e:
        frappe.log_error(f"Error in get_attendance_status: {str(e)}", "Navbar Attendance")
        return {"error": str(e)}
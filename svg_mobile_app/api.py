import frappe
from frappe import _
from frappe.utils import now
from datetime import datetime

# login api
@frappe.whitelist(allow_guest=True)
def login(email, password):
    try:
        # Log in the user
        frappe.local.login_manager.authenticate(email, password)
        frappe.local.login_manager.post_login()

        # Fetch employee linked to the user
        employee = frappe.db.get_value("Employee", {"prefered_email": email}, ["name", "department", "image"], as_dict=True)

        if not employee:
            return {"status": "fail", "message": _("No employee record linked with this user")}

        # Return the valid session ID (sid)
        return {
            "status": "success",
            "message": _("Login successful"),
            "token": frappe.local.session.sid,  # Frappe's valid session token
            "user_id": employee.get("name"),
            "image": employee.get("image"),
        }
    except frappe.AuthenticationError:
        return {"status": "fail", "message": _("Invalid login credentials")}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Login API Error")
        return {"status": "fail", "message": _("Something went wrong")}

@frappe.whitelist(allow_guest=False)
def save_fcm_token(user_id, fcm_token):
    employee = frappe.get_doc("Employee", user_id)
    if not employee:
        frappe.throw(_("Employee not found"))

    frappe.db.set_value("Employee", employee, "fcm_token", fcm_token)
    return {"status": "success", "message": "Token saved successfully"}

# profile api
@frappe.whitelist(allow_guest=False)
def get_employee_details(employee_id):
    try:
        # Ensure the employee exists
        if not frappe.db.exists("Employee", employee_id):
            return {"status": "fail", "message": _("Employee not found")}

        # Fetch employee details
        employee = frappe.get_doc("Employee", employee_id)
        
        # Get the default shift details if assigned
        default_shift = frappe.db.get_value(
            "Shift Type", 
            employee.default_shift, 
            ["start_time", "end_time"], 
            as_dict=True
        ) if employee.default_shift else None

        manager = frappe.db.get_value(
            "Employee",
            employee.reports_to,
            ["first_name", "middle_name", "last_name"],
            as_dict=True
        ) if employee.reports_to else ''

        first_name = manager.first_name if manager.first_name else ''
        middle_name = manager.middle_name if manager.middle_name else ''
        last_name = manager.last_name if manager.last_name else ''

        manager_name = first_name + ' ' + middle_name + ' ' + last_name

        # Prepare response data
        employee_details = {
            "position": employee.designation,
            "department": employee.department,
            "manager": manager_name,
            "employment_type": employee.employment_type,
            "date_of_joining": employee.date_of_joining,
            "default_shift_start": default_shift["start_time"] if default_shift else None,
            "default_shift_end": default_shift["end_time"] if default_shift else None,
            "image": employee.image,
            "current_salary": employee.custom_salary,
        }

        return {
            "status": "success",
            "message": _( "Employee details retrieved successfully."),
            "data": employee_details,
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Employee Details Error")
        return {"status": "fail", "message": str(e)}

@frappe.whitelist(allow_guest=False)
def get_company_details(employee_id):
    try:
        # Ensure the employee exists
        if not frappe.db.exists("Employee", employee_id):
            return {"status": "fail", "message": _("Employee not found")}

        # Fetch employee details
        employee = frappe.get_doc("Employee", employee_id)

        company = frappe.get_doc("Company", employee.company)
        company_description = extract_text_from_html(company.custom_description)

        # Prepare response data
        employee_details = {
            "company": employee.company,
            "branch": employee.company,
            "latitude": company.latitude,
            "longitude": company.longitude,
            "description": company_description,
            "radius": company.radius,
        }

        return {
            "status": "success",
            "message": _( "Employee details retrieved successfully."),
            "data": employee_details,
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Employee Details Error")
        return {"status": "fail", "message": str(e)}

# get last checks times
@frappe.whitelist(allow_guest=False)
def get_employee_shift_and_checkin(employee_id):
    try:
        # Ensure the employee exists
        if not frappe.db.exists("Employee", employee_id):
            return {"status": "fail", "message": _("Employee not found")}

        from frappe.utils import nowdate, format_time

        # Get today's date
        today = nowdate()

        # --- Current Shift Retrieval ---
        assigned_shift = frappe.db.sql(
            """
            SELECT sa.start_date, sa.end_date, st.start_time, st.end_time
            FROM `tabShift Assignment` sa
            JOIN `tabShift Type` st ON sa.shift_type = st.name
            WHERE sa.employee = %s
            AND sa.start_date <= %s
            AND (sa.end_date IS NULL OR sa.end_date >= %s)
            ORDER BY sa.start_date DESC
            LIMIT 1
            """,
            (employee_id, today, today),
            as_dict=True,
        )

        shift_data = {}
        if assigned_shift:
            shift = assigned_shift[0]
            shift_data = {
                "shift_type": "Assigned",
                "start_time": shift["start_time"],
                "end_time": shift["end_time"],
            }
        else:
            default_shift = frappe.db.get_value("Employee", employee_id, "default_shift")
            if default_shift:
                default_shift_times = frappe.db.get_value(
                    "Shift Type", default_shift, ["start_time", "end_time"], as_dict=True
                )
                if default_shift_times:
                    shift_data = {
                        "shift_type": "Default",
                        "start_time": default_shift_times["start_time"],
                        "end_time": default_shift_times["end_time"],
                    }
            else:
                shift_data = {
                    "shift_type": None,
                    "start_time": None,
                    "end_time": None,
                }

        # --- All Check-Ins and Check-Outs Retrieval ---
        checkins = frappe.db.sql(
            """
            SELECT time, log_type
            FROM `tabEmployee Checkin`
            WHERE employee = %s
            AND DATE(time) = %s
            ORDER BY time ASC
            """,
            (employee_id, today),
            as_dict=True,
        )

        # Pair check-ins and check-outs
        paired_checkins = []
        temp_in = None

        for entry in checkins:
            # Extract only the time part
            time_only = format_time(entry["time"])

            if entry["log_type"] == "IN":
                # If there's already an unpaired IN, include it with None as check_out
                if temp_in:
                    paired_checkins.append({"check_in": temp_in, "check_out": None})
                temp_in = time_only  # Update temp_in with the current IN
            elif entry["log_type"] == "OUT":
                # Pair the OUT with the last IN, if it exists
                if temp_in:
                    paired_checkins.append({"check_in": temp_in, "check_out": time_only})
                    temp_in = None

        # If there's a remaining unpaired IN, include it with None as check_out
        if temp_in:
            paired_checkins.append({"check_in": temp_in, "check_out": None})

        # --- Company Address and Geolocation ---
        company = frappe.db.get_value("Employee", employee_id, "company")
        company_details = None

        if company:
            address_details = frappe.get_doc("Company", company)

        # --- Combined Response ---
        return {
            "status": "success",
            "message": _("Employee shift and check-in/out data retrieved successfully."),
            "data": {
                "shift": shift_data,
                "checkins": paired_checkins,
                "company_details": {
                    "address": getattr(address_details, 'address', address_details.company_name),
                    "latitude": address_details.latitude,
                    "longitude": address_details.longitude,
                },
            },
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Employee Shift and Check-In/Out Error")
        return {"status": "fail", "message": str(e)}

# employee make check in/out
@frappe.whitelist(allow_guest=False)
def mark_attendance(employee_id=None, lat=None, long=None, action="check-in", **kwargs):
    try:
        # Handle both JSON and form data
        if not employee_id:
            employee_id = frappe.form_dict.get('employee_id')
        if not lat:
            lat = frappe.form_dict.get('lat')
        if not long:
            long = frappe.form_dict.get('long')
        if action == "check-in":  # Default value, check form_dict
            action = frappe.form_dict.get('action', 'check-in')

        # Handle both radius and distance parameters for backward compatibility
        radius = kwargs.get('radius') or frappe.form_dict.get('radius')
        distance = kwargs.get('distance') or frappe.form_dict.get('distance')

        if radius is None and distance is not None:
            radius = distance
        elif radius is None and distance is None:
            return {"status": "fail", "message": _("Employee ID, location, and radius/distance are required.")}

        if not employee_id or not lat or not long:
            return {"status": "fail", "message": _("Employee ID and location are required.")}

        # Fetch the Employee record
        employee = frappe.get_doc("Employee", employee_id)
        if not employee:
            return {"status": "fail", "message": _("Employee not found")}

        # Validate the action type
        if action not in ["check-in", "check-out"]:
            return {"status": "fail", "message": _("Invalid action. Use 'check-in' or 'check-out'.")}

        log_type = "IN" if action == "check-in" else "OUT"

        # --- Step 1: Check the last attendance record ---
        last_checkin = frappe.db.get_value(
            "Employee Checkin",
            {"employee": employee_id},
            ["log_type", "time"],
            order_by="time desc",
        )
        today = frappe.utils.nowdate()

        if last_checkin:
            last_action, last_date = last_checkin
            # If the last action matches the current action or a record already exists today
            if last_date == today and last_action == log_type:
                return {
                    "status": "fail",
                    "message": _("You already {0} today. Please perform a different action.").format(action),
                }

        # --- Step 2: Check open location ---
        if employee.open_checkin_location:
            # Directly allow check-in or check-out
            return _create_employee_checkin(employee_id, log_type, lat, long)

        # --- Step 3: Check shift type allow checkin on request ---
        today = frappe.utils.nowdate()

        # First check for assigned shift
        assigned_shift_type = frappe.db.sql(
            """
            SELECT st.name, st.custom_allow_checkin_on_request
            FROM `tabShift Assignment` sa
            JOIN `tabShift Type` st ON sa.shift_type = st.name
            WHERE sa.employee = %s
            AND sa.start_date <= %s
            AND (sa.end_date IS NULL OR sa.end_date >= %s)
            ORDER BY sa.start_date DESC
            LIMIT 1
            """,
            (employee_id, today, today),
            as_dict=True,
        )

        # If no assigned shift, check default shift
        if not assigned_shift_type and employee.default_shift:
            assigned_shift_type = frappe.db.get_all(
                "Shift Type",
                filters={"name": employee.default_shift},
                fields=["name", "custom_allow_checkin_on_request"],
                limit=1
            )

        # Check if shift type allows checkin on request
        if assigned_shift_type and assigned_shift_type[0].get("custom_allow_checkin_on_request"):
            # Directly allow check-in or check-out if shift type permits
            return _create_employee_checkin(employee_id, log_type, lat, long)

        # --- Step 4: Check for "Work from Home" request ---
        attendance_request = frappe.db.sql(
            """
            SELECT name
            FROM `tabAttendance Request`
            WHERE employee = %s
              AND docstatus != 2
              AND %s BETWEEN from_date AND to_date
              AND reason = 'Work From Home'
            """,
            (employee_id, today),
        )

        if attendance_request:
            # Allow check-in or check-out if Work from Home request exists
            return _create_employee_checkin(employee_id, log_type, lat, long)

        # --- Step 5: Validate radius from company location ---
        companyRadius = frappe.db.get_value("Company", employee.company, "radius")

        if radius > float(companyRadius):
            return {
                "status": "fail",
                "message": _("You are too far from the company location. Please get closer."),
            }

        # --- Step 6: Create check-in ---
        return _create_employee_checkin(employee_id, log_type, lat, long)

    except frappe.DoesNotExistError:
        return {"status": "fail", "message": _("Employee not found")}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Attendance Marking Error")
        return {"status": "fail", "message": str(e)}


def _create_employee_checkin(employee_id, log_type, lat, long):
    try:
        checkin = frappe.new_doc("Employee Checkin")
        checkin.employee = employee_id
        checkin.log_type = log_type
        checkin.time = now()
        checkin.custom_from_mobile = 1
        checkin.latitude = lat
        checkin.longitude = long
        checkin.save()
        frappe.db.commit()
        return {
            "status": "success",
            "message": _("Attendance marked successfully."),
            "data": checkin.name,
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Attendance Creation Error")
        return {"status": "fail", "message": str(e)}

# single employee attendance
@frappe.whitelist(allow_guest=False)
def get_single_attendance(employee_id, day, month, year):
    try:
        # Validate inputs
        if not frappe.db.exists("Employee", employee_id):
            return {"status": "fail", "message": _("Employee not found")}

        # Create the date range for the specific day
        from_date = f"{year}-{month.zfill(2)}-{day.zfill(2)} 00:00:00"
        to_date = f"{year}-{month.zfill(2)}-{day.zfill(2)} 23:59:59"

        # Fetch attendance records within the date range
        attendance_records = frappe.db.get_all(
            "Employee Checkin",
            filters={
                "employee": employee_id,
                "time": ["between", [from_date, to_date]],
            },
            fields=["log_type", "time"],
            order_by="time asc",
        )

        # Format response
        if not attendance_records:
            return {
                "status": "fail",
                "message": _("No attendance records found for the given date"),
                "data": [],
            }

        return {
            "status": "success",
            "message": _("Attendance records retrieved successfully."),
            "data": [
                {"log_type": record["log_type"], "time": record["time"]}
                for record in attendance_records
            ],
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Attendance Error")
        return {"status": "fail", "message": str(e)}

# single employee month statistics
@frappe.whitelist(allow_guest=False)
def calculate_employee_monthly_attendance(employee_id, year, month, day=None):
    try:
        # Validate employee existence
        if not frappe.db.exists("Employee", employee_id):
            return {"status": "fail", "message": _("Employee not found")}

        from frappe.utils import get_first_day, get_last_day, date_diff, get_datetime, time_diff_in_seconds

        # Determine date range
        start_date, end_date = get_date_range(year, month, day)

        # Get attendance status counts
        status_counts = get_attendance_status_counts(employee_id, start_date, end_date)

        # Total days in the period
        total_days = date_diff(end_date, start_date) + 1

        # Get check-in and check-out times for the specific day
        check_in_out = get_daily_check_in_out(employee_id, start_date) if day else {}

        # Calculate total working hours
        total_working_hours = calculate_working_hours(employee_id, start_date, end_date)

        # Get lateness statistics if a specific day is provided
        lateness_stats = get_lateness_statistics(employee_id, year, month) if day else {}

        # Prepare response data
        return {
            "status": "success",
            "message": _("Attendance calculation completed successfully."),
            "data": {
                "present": status_counts["Present"],
                "absent": status_counts["Absent"],
                "on_leave": status_counts["On Leave"],
                "half_day": status_counts["Half Day"],
                "work_from_home": status_counts["Work From Home"],
                "total_days_in_month": total_days,
                "month": month,
                "year": year,
                "day": day if day else "N/A",
                "first_check_in": check_in_out.get("first_check_in", "---"),
                "last_check_out": check_in_out.get("last_check_out", "---"),
                "lateness_stats": lateness_stats,
                "total_working_hours": total_working_hours,
            },
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Monthly Attendance Calculation Error")
        return {"status": "fail", "message": str(e)}

def get_date_range(year, month, day=None):
    from frappe.utils import get_first_day, get_last_day
    if day:
        day = int(day)
        date_str = f"{year}-{int(month):02d}-{day:02d}"
        return date_str, date_str
    else:
        start_date = get_first_day(f"{year}-{month}-01")
        end_date = get_last_day(f"{year}-{month}-01")
        return start_date, end_date

def get_attendance_status_counts(employee_id, start_date, end_date):
    attendance_records = frappe.db.sql(
        """
        SELECT status, COUNT(*) as count
        FROM `tabAttendance`
        WHERE employee = %s AND attendance_date BETWEEN %s AND %s
        GROUP BY status
        """,
        (employee_id, start_date, end_date),
        as_dict=True,
    )

    # Initialize default counts
    status_counts = {
        "Present": 0,
        "Absent": 0,
        "On Leave": 0,
        "Half Day": 0,
        "Work From Home": 0,
    }

    for record in attendance_records:
        status_counts[record["status"]] = record["count"]

    return status_counts

def get_daily_check_in_out(employee_id, date):
    records = frappe.db.sql(
        """
        SELECT MIN(time) AS first_check_in, MAX(time) AS last_check_out
        FROM `tabEmployee Checkin`
        WHERE employee = %s AND DATE(time) = %s
        """,
        (employee_id, date),
        as_dict=True,
    )
    return records[0] if records else {"first_check_in": "---", "last_check_out": "---"}

def calculate_working_hours(employee_id, start_date, end_date):
    from frappe.utils import time_diff_in_seconds
    total_seconds = 0

    working_hours_records = frappe.db.sql(
        """
        SELECT DATE(time) AS attendance_date, MIN(time) AS first_check_in, MAX(time) AS last_check_out
        FROM `tabEmployee Checkin`
        WHERE employee = %s AND DATE(time) BETWEEN %s AND %s
        GROUP BY DATE(time)
        """,
        (employee_id, start_date, end_date),
        as_dict=True,
    )

    for record in working_hours_records:
        if record["first_check_in"] and record["last_check_out"]:
            total_seconds += time_diff_in_seconds(record["last_check_out"], record["first_check_in"])

    hours = total_seconds // 3600
    minutes = (total_seconds % 3600) // 60
    return f"{int(hours):02d}:{int(minutes):02d}"

def get_lateness_statistics(employee_id, year, month):
    from frappe.utils import get_first_day, get_last_day, get_datetime, add_days, time_diff_in_seconds

    lateness_stats = {"late": 0, "early": 0, "on_time": 0}
    month_days = []

    # Determine start and end dates for the month
    start_date = get_first_day(f"{year}-{month}-01")
    end_date = get_last_day(f"{year}-{month}-01")

    # Fetch shift assignments within the month
    shift_assignments = frappe.db.sql(
        """
        SELECT DATE(sa.start_date) AS shift_date, st.start_time AS shift_start, st.end_time AS shift_end
        FROM `tabShift Assignment` sa
        JOIN `tabShift Type` st ON sa.shift_type = st.name
        WHERE sa.employee = %s AND DATE(sa.start_date) <= %s AND DATE(sa.end_date) >= %s
        ORDER BY DATE(sa.start_date)
        """,
        (employee_id, end_date, start_date),
        as_dict=True,
    )

    # Map shift assignments by date
    shift_map = {sa["shift_date"]: sa for sa in shift_assignments}

    # Define default shift timings
    default_shift_start = "09:00:00"
    default_shift_end = "18:00:00"

    # Loop through each day in the month
    current_date = start_date
    while current_date <= end_date:
        # Check if a shift is assigned for the current date
        shift = shift_map.get(current_date, {
            "shift_start": default_shift_start,
            "shift_end": default_shift_end
        })

        # Add shift information to the month days list
        month_days.append({
            "date": current_date,
            "shift_start": shift["shift_start"],
            "shift_end": shift["shift_end"],
        })

        # Move to the next day
        current_date = add_days(current_date, 1)

    # Fetch check-in records for the month
    check_ins = frappe.db.sql(
        """
        SELECT DATE(time) AS checkin_date, MIN(time) AS first_check_in
        FROM `tabEmployee Checkin`
        WHERE employee = %s AND DATE(time) BETWEEN %s AND %s
        GROUP BY DATE(time)
        """,
        (employee_id, start_date, end_date),
        as_dict=True,
    )

    # Map check-ins by date
    check_in_map = {c["checkin_date"]: c["first_check_in"] for c in check_ins}

    # Calculate lateness statistics for each day
    for day in month_days:
        shift_date = day["date"]
        shift_start_time = get_datetime(f"{shift_date} {day['shift_start']}")
        first_check_in = check_in_map.get(shift_date)

        if first_check_in:
            first_check_in_time = get_datetime(first_check_in)
            delay_minutes = (first_check_in_time - shift_start_time).total_seconds() / 60

            if delay_minutes > 15:
                lateness_stats["late"] += 1
            elif delay_minutes < 0:
                lateness_stats["early"] += 1
            else:
                lateness_stats["on_time"] += 1

    return {
        "lateness_stats": lateness_stats,
    }


# get availble leaves types and available days
@frappe.whitelist(allow_guest=False)
def get_available_leaves(employee_id):
    try:
        # Ensure the employee exists
        employee = frappe.get_doc("Employee", employee_id)
        if not employee:
            return {"status": "fail", "message": _("Employee not found")}
        
        company = employee.company
        company_shifts = frappe.get_all(
            "Shift Type",
            filters={
                "custom_company": company,
                "custom_enabled": 1,
                "custom_is_request": 1
            },
            fields=["name"]
        )

        # Get today's date
        today = frappe.utils.nowdate()

        # Query Leave Allocation to get active leave allocations for the employee
        leave_allocations = frappe.get_all(
            "Leave Allocation",
            filters={
                "employee": employee_id,
                "to_date": [">=", today]  # Only include allocations that are not expired
            },
            fields=["leave_type", "from_date", "to_date", "total_leaves_allocated"]
        )

        # Prepare the response with available leaves
        available_leaves = []
        for allocation in leave_allocations:
            # Calculate leaves taken for the allocation period from Leave Application
            leaves_taken = frappe.db.sql("""
                SELECT SUM(total_leave_days) as total_days
                FROM `tabLeave Application`
                WHERE employee = %s
                AND leave_type = %s
                AND status = 'Approved'
                AND from_date <= %s
                AND to_date >= %s
            """, (employee_id, allocation["leave_type"], allocation["to_date"], allocation["from_date"]), as_dict=True)[0].get("total_days") or 0

            # Calculate remaining leaves
            remaining_leaves = allocation["total_leaves_allocated"] - leaves_taken
            if remaining_leaves > 0:  # Only include leaves with remaining balance
                available_leaves.append({
                    "leave_type": allocation["leave_type"],
                    "from_date": allocation["from_date"],
                    "to_date": allocation["to_date"],
                    "remaining_leaves": remaining_leaves
                })

        excuse_times = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]

        return {
            "status": "success",
            "message": _("Available leaves retrieved successfully"),
            "shifts": company_shifts,
            "data": available_leaves,
            "excuse_times": excuse_times
        }
    except frappe.DoesNotExistError:
        return {"status": "fail", "message": _("Employee not found")}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Available Leaves Error")
        return {"status": "fail", "message": str(e)}

# leave and shift request
@frappe.whitelist(allow_guest=False)
def leave_shift_request(employee_id, type, start_date, end_date, sub_type, reason=None, excuse_time=None):
    try:
        # Validate that the employee exists
        employee = frappe.get_doc("Employee", employee_id)
        if not employee:
            return {"status": "fail", "message": _("Employee not found")}
        
        # Validate dates
        if frappe.utils.getdate(start_date) > frappe.utils.getdate(end_date):
            return {"status": "fail", "message": _("Start date cannot be after end date")}

        # Handle Leave Request
        if type.lower() == "leave":
            # Validate that the sub_type (leave type) exists
            leave_type_exists = frappe.db.exists("Leave Type", sub_type)
            if not leave_type_exists:
                return {"status": "fail", "message": _("Invalid leave type")}
            
            # Check overlapping leaves
            overlapping_leaves = frappe.get_all(
                "Leave Application",
                filters={
                    "employee": employee_id,
                    "status": "Approved",
                    "from_date": ["<=", end_date],
                    "to_date": [">=", start_date],
                }
            )
            if overlapping_leaves:
                return {"status": "fail", "message": _("Overlapping leave request exists")}

            # Fetch leave approver
            leave_approver = frappe.db.get_value("Employee", employee_id, "leave_approver")

            # Create Leave Application
            leave_request = frappe.get_doc({
                "doctype": "Leave Application",
                "employee": employee_id,
                "leave_type": sub_type,
                "from_date": start_date,
                "to_date": end_date,
                "status": "Requested",
                "description": reason or _("No reason provided"),
                "leave_approver": leave_approver
            })
            leave_request.insert()

            return {
                "status": "success",
                "message": _("Leave request created successfully"),
                "docname": leave_request.name
            }

        # Handle Shift Request
        elif type.lower() == "shift":
            # Check overlapping shifts
            overlapping_shifts = frappe.get_all(
                "Shift Request",
                filters={
                    "employee": employee_id,
                    "from_date": ["<=", end_date],
                    "to_date": [">=", start_date],
                }
            )
            if overlapping_shifts:
                return {"status": "fail", "message": _("Overlapping shift request exists")}
            if("excuse" in sub_type.lower()):
                if not excuse_time:
                    excuse_time = 0.5
                else:
                    excuse_time = float(excuse_time)

                shift_request = frappe.get_doc({
                    "doctype": "Shift Request",
                    "employee": employee_id,
                    "shift_type": sub_type,
                    "from_date": start_date,
                    "to_date": end_date,
                    "custom_excuse_hours": excuse_time,
                    "status": "Requested",
                })
                shift_request.insert()
                
                # Add reason as a comment since explanation field doesn't exist
                if reason:
                    from frappe.desk.form.utils import add_comment
                    add_comment("Shift Request", shift_request.name, f"Reason: {reason or 'No explanation provided'}",
                               comment_email=frappe.session.user, comment_by=frappe.session.user)
                
                return {
                    "status": "success",
                    "message": _("Shift request created successfully"),
                    "docname": shift_request.name
                }
            
            else:
                shift_request = frappe.get_doc({
                    "doctype": "Shift Request",
                    "employee": employee_id,
                    "shift_type": sub_type,
                    "from_date": start_date,
                    "to_date": end_date,
                    "status": "Requested",
                })
                shift_request.insert()
                
                # Add reason as a comment since explanation field doesn't exist
                if reason:
                    from frappe.desk.form.utils import add_comment
                    add_comment("Shift Request", shift_request.name, f"Reason: {reason or 'No explanation provided'}",
                               comment_email=frappe.session.user, comment_by=frappe.session.user)
                
                return {
                    "status": "success",
                    "message": _("Shift request created successfully"),
                    "docname": shift_request.name
                }
            
        else:
            return {"status": "fail", "message": _("Invalid type. It must be either 'Leave' or 'Shift'")}

    except frappe.DoesNotExistError:
        return {"status": "fail", "message": _("Employee not found")}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Leave/Shift Request Error")
        return {"status": "fail", "message": str(e)}

# for leaves need posting date, request date, status, type, reason
# for shift need type, status, request date
@frappe.whitelist(allow_guest=False)
def get_employee_data(employee_id, data_type, from_date=None, to_date=None):
    try:
        if data_type not in ["leave", "shift"]:
            return {"status": "fail", "message": _("Invalid data type. Use 'leave' or 'shift'.")}

        # Ensure the employee exists
        if not frappe.db.exists("Employee", employee_id):
            return {"status": "fail", "message": _("Employee not found")}

        # Query data based on the type
        filters = {"employee": employee_id}
        if from_date:
            filters["from_date"] = [">=", from_date]
        if to_date:
            filters["to_date"] = ["<=", to_date]

        if data_type == "leave":
            # Fetch data from Leave Application
            data = frappe.get_all(
                "Leave Application",
                filters=filters,
                fields=["posting_date", "from_date", "to_date", "status", "leave_type", "description"],
                order_by="posting_date DESC",
            )
        elif data_type == "shift":
            # Fetch data from Shift Request
            data = frappe.get_all(
                "Shift Request",
                filters=filters,
                fields=["shift_type", "status", "from_date", "to_date"],
                order_by="from_date DESC",
            )

            # Re-sort the combined data by from_date in descending order
            data = sorted(data, key=lambda x: x["from_date"], reverse=True)

        # Return data
        return {
            "status": "success",
            "message": _("Employee data retrieved successfully."),
            "data": data,
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Employee Data Error")
        return {"status": "fail", "message": str(e)}

@frappe.whitelist(allow_guest=False)
def get_employee_attendance(employee_id, from_date=None, to_date=None, status=None):
    try:
        # Ensure the employee exists
        if not frappe.db.exists("Employee", employee_id):
            return {"status": "fail", "message": _("Employee not found")}

        # Build the filters dictionary
        filters = {"employee": employee_id}
        if from_date and to_date:
            filters["attendance_date"] = ["between", [from_date, to_date]]
        elif from_date:
            filters["attendance_date"] = [">=", from_date]
        elif to_date:
            filters["attendance_date"] = ["<=", to_date]
        if status:
            filters["status"] = status

        # Fetch attendance records
        attendance_data = frappe.get_all(
            "Attendance",
            filters=filters,
            fields=["attendance_date", "status"],
            order_by="attendance_date DESC",
        )

        # Calculate status counts
        status_counts = {}
        for record in attendance_data:
            record_status = record["status"]
            status_counts[record_status] = status_counts.get(record_status, 0) + 1

        # Return the response
        return {
            "status": "success",
            "message": _("Attendance records retrieved successfully."),
            "data": {
                "attendance_list": attendance_data,
                "status_counts": status_counts,
            },
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Employee Attendance Error")
        return {"status": "fail", "message": str(e)}

@frappe.whitelist(allow_guest=False)
def get_salary_slips(employee_id, year):
    start_date = f"{year}-01-01"
    end_date = f"{year}-12-31"
    
    salary_slips = frappe.get_all(
        "Salary Slip",
        filters={
            "employee": employee_id,
            "end_date": ["between", [start_date, end_date]]
        },
        fields=["name", "employee_name", "start_date", "end_date", "net_pay", "status"]
    )
    return {
        "status": "success",
        "salaries": salary_slips,
    }

@frappe.whitelist(allow_guest=False)
def get_salary_slip_details(salary_slip_id):
    try:
        salary_slip = frappe.get_doc("Salary Slip", salary_slip_id)

        # Extract details
        deductions = salary_slip.get("deductions")
        earnings = salary_slip.get("earnings")
        details = {
            "employee": salary_slip.employee,
            "employee_name": salary_slip.employee_name,
            "net_pay": salary_slip.rounded_total,
            "gross_pay": salary_slip.gross_pay,
            "bank_name": salary_slip.bank_name,
            "bank_account_no": salary_slip.bank_account_no,
            "deductions": deductions,
            "earnings": earnings,
        }
        return {
            "status": "success",
            "details": details
        }
    except Exception as e:
        frappe.log_error(f"Error fetching salary slip details: {str(e)}", "Salary Slip Error")
        return {
            "status": "fail",
            "message": str(e)
        }


@frappe.whitelist()
def test_pdf_export():
    """Simple test function to check if PDF generation works"""
    try:
        # First try HTML export to test if the basic functionality works
        html = f"""
        <html>
        <head><title>Test Export</title></head>
        <body>
            <h1>Test Export - Projects Gallery</h1>
            <p>This is a test export to verify the functionality works.</p>
            <p>Generated at: {frappe.utils.now()}</p>
            <p>User: {frappe.session.user}</p>
            <h2>Test Data</h2>
            <table border="1" style="border-collapse: collapse;">
                <tr><th>Field</th><th>Value</th></tr>
                <tr><td>Server Time</td><td>{frappe.utils.now()}</td></tr>
                <tr><td>User</td><td>{frappe.session.user}</td></tr>
                <tr><td>Site</td><td>{frappe.local.site}</td></tr>
            </table>
        </body>
        </html>
        """

        # Try PDF generation
        try:
            from frappe.utils.pdf import get_pdf
            pdf_data = get_pdf(html)
            frappe.local.response.filename = "test_export.pdf"
            frappe.local.response.filecontent = pdf_data
            frappe.local.response.type = "download"
        except Exception as pdf_error:
            # If PDF fails, export as HTML for debugging
            frappe.local.response.filename = "test_export_debug.html"
            frappe.local.response.filecontent = html.encode('utf-8')
            frappe.local.response.type = "download"

        return {"status": "success"}

    except Exception as e:
        return {"status": "error", "message": str(e)}


@frappe.whitelist()
def export_projects_gallery_pdf(filters=None, visible_columns=None, export_limit=None, current_page=None, page_length=None, sort_field=None, sort_order=None):
    """Export Projects Gallery data to PDF with current filters and visible columns"""
    try:
        import json
        import os
        from frappe.utils.pdf import get_pdf
        from frappe.utils import now_datetime, get_datetime

        # Parse export limit (default to 200 to prevent memory issues)
        if export_limit:
            try:
                export_limit = int(export_limit)
                # Cap at 1000 to prevent server overload
                export_limit = min(export_limit, 1000)
            except:
                export_limit = 200
        else:
            export_limit = 200

        # Parse pagination parameters
        if current_page:
            try:
                current_page = int(current_page)
            except:
                current_page = 1
        else:
            current_page = 1

        if page_length:
            try:
                page_length = int(page_length)
            except:
                page_length = 20
        else:
            page_length = 20

        # Parse sorting parameters
        if not sort_field:
            sort_field = 'numeric_sort_field'
        if not sort_order:
            sort_order = 'desc'

        # Parse filters if provided
        if filters:
            try:
                filters = json.loads(filters) if isinstance(filters, str) else filters
            except:
                filters = []
        else:
            filters = []

        # Parse visible columns if provided
        if visible_columns:
            try:
                visible_columns = json.loads(visible_columns) if isinstance(visible_columns, str) else visible_columns
            except:
                visible_columns = ['project_name', 'district', 'region', 'description',
                                 'project_status', 'design_status', 'planning_status', 'tender_status']
        else:
            # Default visible columns
            visible_columns = ['project_name', 'district', 'region', 'description',
                             'project_status', 'design_status', 'planning_status', 'tender_status']

        # Get all fields for the query
        all_fields = ['name', 'project_name', 'district', 'region', 'description',
                     'project_status', 'design_status', 'planning_status', 'tender_status',
                     '3d_image', 'site_image', 'villa_dimensions', 'plot_no', 'basement',
                     'ground_floor', 'first_floor', 'second_floor', 'roof',
                     'total_villa_area_sqm', 'total_villa_area_sqft', 'estimate_cost_230_aedsqft',
                     'bed_room', 'majlis', 'family_living', 'dinning', 'bathroom', 'kitchen',
                     'laundry', 'maid_room', 'gurad_room', 'store', 'shops', 'no_of_office',
                     'car_parking', 'no_of_labour', 'no_of_studio']

        # Fetch projects data with proper pagination
        try:
            # For current page export (20 items), use pagination
            if export_limit == 20:
                limit_start = (current_page - 1) * page_length
                projects = frappe.get_list(
                    'Projects Collection',
                    fields=all_fields,
                    filters=filters if filters else None,
                    order_by=f'{sort_field} {sort_order}',
                    limit_start=limit_start,
                    limit_page_length=page_length
                )
            else:
                # For larger exports, get from the beginning with export limit
                projects = frappe.get_list(
                    'Projects Collection',
                    fields=all_fields,
                    filters=filters if filters else None,
                    order_by=f'{sort_field} {sort_order}',
                    limit_page_length=export_limit
                )
        except Exception as filter_error:
            # If filters cause issues, try without filters with smaller limit
            frappe.log_error(f"Filter error: {str(filter_error)}", "PDF Export Filter Error")
            projects = frappe.get_list(
                'Projects Collection',
                fields=all_fields,
                order_by=f'{sort_field} {sort_order}',
                limit_page_length=100  # Smaller fallback limit
            )

        # Column labels mapping
        column_labels = {
            'project_name': 'Project ID',
            'district': 'District',
            'region': 'Region',
            'description': 'Description',
            'project_status': 'Status',
            'design_status': 'Design',
            'planning_status': 'Planning',
            'tender_status': 'Tender',
            '3d_image': '3D Image',
            'site_image': 'Site Image',
            'villa_dimensions': 'Villa Dimensions',
            'plot_no': 'Plot No',
            'basement': 'Basement',
            'ground_floor': 'Ground Floor',
            'first_floor': 'First Floor',
            'second_floor': 'Second Floor',
            'roof': 'Roof',
            'total_villa_area_sqm': 'Total Area (SQM)',
            'total_villa_area_sqft': 'Total Area (SQFT)',
            'estimate_cost_230_aedsqft': 'Estimate Cost (AED/SQFT)',
            'bed_room': 'Bedrooms',
            'majlis': 'Majlis',
            'family_living': 'Family Living',
            'dinning': 'Dining',
            'bathroom': 'Bathrooms',
            'kitchen': 'Kitchen',
            'laundry': 'Laundry',
            'maid_room': 'Maid Room',
            'gurad_room': 'Guard Room',
            'store': 'Store',
            'shops': 'Shops',
            'no_of_office': 'No. of Offices',
            'car_parking': 'Car Parking',
            'no_of_labour': 'No. of Labour',
            'no_of_studio': 'No. of Studios'
        }

        # Prepare template context
        current_time = now_datetime()
        context = {
            'projects': projects,
            'visible_columns': visible_columns,
            'column_labels': column_labels,
            'total_projects': len(projects),
            'export_limit': export_limit,
            'current_page': current_page,
            'page_length': page_length,
            'is_current_page_export': export_limit == 20,
            'export_date': current_time.strftime('%Y-%m-%d'),
            'export_time': current_time.strftime('%H:%M:%S'),
            'user': frappe.session.user
        }

        # Create simple HTML template inline to avoid template path issues
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Projects Gallery Export</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }}
        .header {{ text-align: center; margin-bottom: 30px; border-bottom: 2px solid #3498db; padding-bottom: 15px; }}
        .header h1 {{ color: #2c3e50; margin: 0; font-size: 24px; }}
        .export-info {{ display: flex; justify-content: space-between; margin-bottom: 20px; padding: 10px; background: #f8f9fa; }}
        .projects-table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
        .projects-table th {{ background: #3498db; color: white; padding: 8px 6px; text-align: left; border: 1px solid #2980b9; }}
        .projects-table td {{ padding: 6px; border: 1px solid #dee2e6; font-size: 10px; }}
        .projects-table tr:nth-child(even) {{ background: #f8f9fa; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Projects Gallery Export</h1>
    </div>
    <div class="export-info">
        <div><strong>Date:</strong> {context['export_date']} <strong>Time:</strong> {context['export_time']}</div>
        <div><strong>User:</strong> {context['user']} <strong>Projects:</strong> {context['total_projects']} {'(Page ' + str(context['current_page']) + ')' if context['is_current_page_export'] else '(Limited to ' + str(context['export_limit']) + ')'}</div>
    </div>
    <table class="projects-table">
        <thead>
            <tr>"""

        # Add column headers
        for column in visible_columns:
            label = column_labels.get(column, column)
            html += f"<th>{label}</th>"

        html += """
            </tr>
        </thead>
        <tbody>"""

        # Add project rows
        for project in projects:
            html += "<tr>"
            for column in visible_columns:
                value = project.get(column, '') or '-'
                if column in ['3d_image', 'site_image']:
                    if value and value != '-':
                        html += f'<td><img src="{value}" style="max-width:60px;max-height:40px;"></td>'
                    else:
                        html += '<td>No Image</td>'
                else:
                    html += f"<td>{frappe.utils.escape_html(str(value))}</td>"
            html += "</tr>"

        html += """
        </tbody>
    </table>
    <div style="text-align: center; margin-top: 30px; font-size: 10px; color: #6c757d;">
        Generated by SVG Mobile App - Projects Image Gallery
    </div>
</body>
</html>"""

        # Generate PDF with better error handling
        try:
            pdf_data = get_pdf(html)
        except Exception as pdf_error:
            # If PDF generation fails, return the HTML for debugging
            frappe.local.response.filename = f"projects_debug_{current_time.strftime('%Y%m%d_%H%M%S')}.html"
            frappe.local.response.filecontent = html.encode('utf-8')
            frappe.local.response.type = "download"
            return

        # Set response for file download
        filename = f"projects_gallery_export_{current_time.strftime('%Y%m%d_%H%M%S')}.pdf"

        frappe.local.response.filename = filename
        frappe.local.response.filecontent = pdf_data
        frappe.local.response.type = "download"

    except Exception as e:
        # Simple error handling without database logging to avoid cascading errors
        frappe.throw(f"Error generating PDF: {str(e)}")

@frappe.whitelist(allow_guest=False)
def overtime_request(employee_id=None, date=None, start_time=None, end_time=None, reason=None):
    try:
        # Handle both JSON and form data
        if not employee_id:
            employee_id = frappe.form_dict.get('employee_id')
        if not date:
            date = frappe.form_dict.get('date')
        if not start_time:
            start_time = frappe.form_dict.get('start_time')
        if not end_time:
            end_time = frappe.form_dict.get('end_time')
        if not reason:
            reason = frappe.form_dict.get('reason')

        # Validate required parameters
        if not all([employee_id, date, start_time, end_time]):
            return {"status": "fail", "message": _("Missing required parameters: employee_id, date, start_time, end_time")}

        # Validate that the employee exists
        employee = frappe.get_doc("Employee", employee_id)
        if not employee:
            return {"status": "fail", "message": _("Employee not found")}

        # Calculate duration in hours
        from frappe.utils import time_diff_in_hours
        duration = 0
        if start_time and end_time:
            duration = time_diff_in_hours(end_time, start_time)

        overtime_request = frappe.get_doc({
            "doctype": "Overtime Request",
            "employee": employee_id,
            "day_of_overtime": date,
            "time_from": start_time,
            "time_to": end_time,
            "duration": duration,
            "status": "Requested",
            "reason": reason or _("No reason provided")
        })
        overtime_request.insert()

        return {
            "status": "success",
            "message": _("Overtime request created successfully"),
            "docname": overtime_request.name,
            "duration": duration
        }

    except frappe.DoesNotExistError:
        return {"status": "fail", "message": _("Employee not found")}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Leave/Shift Request Error")
        return {"status": "fail", "message": str(e)}

@frappe.whitelist(allow_guest=False)
def get_overtime_requests(employee_id, start_date, end_date):
    overtime_requests = frappe.get_all(
        "Overtime Request",
        filters={
            "employee": employee_id,
            "day_of_overtime": ["between", [start_date, end_date]]
        },
        fields=["name", "employee_name", "day_of_overtime", "time_from", "time_to", "duration", "status", "reason"]
    )
    return {
        "status": "success",
        "overtimes": overtime_requests,
    }

@frappe.whitelist(allow_guest=False)
def get_notifications(employee_id):
    notifications = frappe.get_all(
        "Mobile Notification log",
        filters={"employee": employee_id},
        fields=["name", "employee", "doctype_name", "sending_date", "title", "content"]
    )
    return {
        "status": "success",
        "data": notifications,
    }

@frappe.whitelist(allow_guest=False)
def get_announcements(employee_id):
    # Query to fetch announcements based on matching employee_id in the child table
    query = """
        SELECT parent as name, date, body_mail
        FROM `tabEmployee Emails` as child
        INNER JOIN `tabAnnouncement` as parent ON child.parent = parent.name
        WHERE child.employee_id = %s
    """
    announcements = frappe.db.sql(query, (employee_id,), as_dict=True)

    # Return raw HTML content instead of extracting text
    return {
        "status": "success",
        "data": announcements,
    }


# Helper function to extract plain text from HTML
from bs4 import BeautifulSoup

def extract_text_from_html(html_content):
    soup = BeautifulSoup(html_content, "html.parser")
    text = soup.get_text(separator="\n")  # Preserve line breaks
    return text.strip()

@frappe.whitelist(allow_guest=False)
def check_approval_screen_access(employee_id):
    """Check if user has access to approval screen based on role"""
    try:
        # Get employee details and user
        employee = frappe.get_doc("Employee", employee_id)
        user = frappe.get_value("Employee", employee_id, "user_id")
        
        if not user:
            return {"status": "fail", "message": _("User not linked to employee")}
        
        # Get current session user
        current_user = frappe.session.user
        current_user_roles = frappe.get_roles(current_user)
        
        # Check if current user has HR roles (they can access any employee's data)
        is_current_user_hr = "HR Manager" in current_user_roles or "HR User" in current_user_roles
        
        # Validate access: either same user or HR user accessing
        if user != current_user and not is_current_user_hr:
            return {"status": "fail", "message": _("Access denied: Invalid employee ID")}
        
        # Check if user has HR or Manager role
        roles = frappe.get_roles(user)
        is_direct_manager = "Direct Manager" in roles
        has_reports = len(frappe.get_all("Employee", {"reports_to": employee_id})) > 0  # Fixed logic
        is_manager = is_direct_manager or has_reports
        has_access = "HR Manager" in roles or "HR User" in roles or is_manager
        
        return {
            "status": "success",
            "has_access": has_access,
            "is_hr": "HR Manager" in roles or "HR User" in roles,
            "is_manager": is_manager,
            "is_direct_manager": is_direct_manager,
            "has_reports": has_reports
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Check Approval Access Error")
        return {"status": "fail", "message": str(e)}


@frappe.whitelist(allow_guest=False)
def get_pending_requests(employee_id=None, from_date=None, to_date=None, pending_only=1, request_type=None):
    """Get pending requests for employees reporting to this manager/HR"""
    try:
        # Handle both JSON and form data
        if not employee_id:
            employee_id = frappe.form_dict.get('employee_id')
        if not from_date:
            from_date = frappe.form_dict.get('from_date')
        if not to_date:
            to_date = frappe.form_dict.get('to_date')
        if pending_only == 1:  # Default value, check form_dict
            pending_only = frappe.form_dict.get('pending_only', 1)
        if not request_type:
            request_type = frappe.form_dict.get('request_type')

        # Get current user's employee record if not provided
        current_user = frappe.session.user
        if not employee_id:
            employee_id = frappe.db.get_value("Employee", {"user_id": current_user}, "name")
            if not employee_id:
                return {"status": "fail", "message": _("No employee record found for current user")}

        # Validate and convert parameters
        if isinstance(pending_only, str):
            pending_only = int(pending_only) if pending_only.isdigit() else 1
        
        # Normalize request_type parameter
        if request_type:
            request_type = request_type.strip().lower()
        
        # Check if user is HR or manager
        access_check = check_approval_screen_access(employee_id)
        if not access_check.get("has_access"):
            return {"status": "fail", "message": _("You don't have permission to access this data")}
        
        # Get employees reporting to this manager
        filters = []
        is_hr = access_check.get("is_hr")
        has_reports = access_check.get("has_reports")

        # Apply employee filtering for HR users and managers
        # HR role takes priority over manager role (higher in organizational hierarchy)
        if is_hr:
            # For HR users, get all employees they can manage
            employee = frappe.get_doc("Employee", employee_id)
            if employee.company:
                company_employees = frappe.get_all("Employee",
                    filters={"company": employee.company, "status": "Active"},
                    pluck="name"
                )
                if company_employees:
                    filters.append(["employee", "in", company_employees])
                else:
                    return {"status": "success", "data": []}
            else:
                return {"status": "success", "data": []}
        elif has_reports:
            # For managers with direct reports, only show those employees
            reporting_employees = frappe.get_all("Employee",
                filters={"reports_to": employee_id},
                pluck="name"
            )
            if not reporting_employees:
                return {"status": "success", "data": []}
            filters.append(["employee", "in", reporting_employees])
        else:
            # No access for users without actual reports or HR roles
            return {"status": "success", "data": []}
        
        # Add date filters if provided
        if from_date and to_date:
            filters.append(["creation", "between", [from_date, to_date]])
        elif from_date:
            filters.append(["creation", ">=", from_date])
        elif to_date:
            filters.append(["creation", "<=", to_date])
        
        # Add status filter for pending requests
        if pending_only:
            # Include both initial status and intermediate approval statuses
            leave_filters = filters + [["status", "in", ["Requested", "Manager Approved"]]]
            shift_filters = filters + [["status", "in", ["Requested", "Manager Approved"]]]
            overtime_filters = filters + [["status", "in", ["Requested", "Manager Approved"]]]
        else:
            leave_filters = filters.copy()
            shift_filters = filters.copy()
            overtime_filters = filters.copy()
        
        # Initialize request lists
        leave_requests = []
        shift_requests = []
        overtime_requests = []
        
        # Apply request type filter - get only requested types
        # Map frontend values to normalized values
        leave_types = ["leave application", "leave request"]
        shift_types = ["shift request"]
        overtime_types = ["overtime request"]
        
        if not request_type or request_type in leave_types:
            # Get leave applications
            leave_requests = frappe.get_all(
                "Leave Application",
                filters=leave_filters,
                fields=["name", "employee", "employee_name", "from_date", "to_date", 
                        "leave_type as request_type", "status", "description as reason", 
                        "creation"],
                order_by="creation desc"
            )
            
            # Add doctype information
            for request in leave_requests:
                request["doctype"] = "Leave Application"
        
        if not request_type or request_type in shift_types:
            # Get shift requests
            shift_requests = frappe.get_all(
                "Shift Request",
                filters=shift_filters,
                fields=["name", "employee", "employee_name", "from_date", "to_date", 
                        "shift_type as request_type", "status", 
                        "creation"],
                order_by="creation desc"
            )
            
            # Add doctype information and a default reason
            for request in shift_requests:
                request["doctype"] = "Shift Request"
                request["reason"] = "Shift request"  # Default reason since explanation field doesn't exist
        
        if not request_type or request_type in overtime_types:
            # Get overtime requests
            overtime_requests = frappe.get_all(
                "Overtime Request",
                filters=overtime_filters,
                fields=["name", "employee", "employee_name", "day_of_overtime as from_date",
                        "day_of_overtime as to_date", "'Overtime' as request_type",
                        "duration", "status", "reason", "creation"],
                order_by="creation desc"
            )
            
            # Add doctype information
            for request in overtime_requests:
                request["doctype"] = "Overtime Request"
        
        # Combine all requests
        all_requests = leave_requests + shift_requests + overtime_requests
        
        # Sort by creation date
        all_requests.sort(key=lambda x: x.get("creation", ""), reverse=True)
        
        return {
            "status": "success",
            "data": all_requests
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Pending Requests Error")
        return {"status": "fail", "message": str(e)}


def validate_approval_permission(doc, employee_doc, current_user, action):
    """Validate if current user has permission to approve/reject a specific request"""
    try:
        # Get current user's employee record
        current_user_employee_id = frappe.db.get_value("Employee", {"user_id": current_user}, "name")
        if not current_user_employee_id:
            return {"valid": False, "message": _("Current user is not linked to any employee")}
        
        # Get current user's roles
        current_user_roles = frappe.get_roles(current_user)
        is_hr = "HR Manager" in current_user_roles or "HR User" in current_user_roles
        is_direct_manager = (employee_doc.reports_to == current_user_employee_id)
        
        # Get designated approver for this request type
        if doc.doctype == "Leave Application":
            designated_approver = employee_doc.leave_approver
        elif doc.doctype == "Shift Request":
            designated_approver = employee_doc.shift_request_approver
        else:  # Overtime Request
            designated_approver = employee_doc.reports_to
        
        is_designated_approver = (current_user == designated_approver)
        
        # Check if user has any approval authority
        if not (is_hr or is_direct_manager or is_designated_approver):
            return {"valid": False, "message": _("You don't have permission to {0} this request").format(action)}
        
        return {"valid": True, "is_hr": is_hr, "is_direct_manager": is_direct_manager, "is_designated_approver": is_designated_approver}
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Validate Approval Permission Error")
        return {"valid": False, "message": str(e)}

def get_next_approver(doctype, employee_id, current_approver=None):
    """Determine the next approver in the approval chain"""
    try:
        employee = frappe.get_doc("Employee", employee_id, ignore_permissions=True)
        
        # Get the designated approvers for this employee
        if doctype == "Leave Application":
            designated_approver = employee.leave_approver
        elif doctype == "Shift Request":
            designated_approver = employee.shift_request_approver
        else:  # Overtime Request
            designated_approver = employee.reports_to  # Use direct manager for overtime
        
        # If no current approver, start with direct manager (unless they're the designated approver)
        if not current_approver:
            if designated_approver and designated_approver != employee.reports_to:
                return employee.reports_to  # Start with direct manager
            else:
                return designated_approver  # Go directly to designated approver
        
        # If current approver is the direct manager, move to designated approver
        if current_approver == employee.reports_to and designated_approver:
            return designated_approver
        
        # If current approver is the designated approver, check if HR approval is needed
        if current_approver == designated_approver:
            # For certain types of requests, HR approval might be required
            # This can be customized based on business rules
            return None  # No further approval needed
        
        return None  # No next approver
        
    except Exception as e:
        frappe.log_error(f"Error determining next approver: {str(e)}", "Get Next Approver Error")
        return None

@frappe.whitelist(allow_guest=False)
def update_request_status(employee_id=None, request_name=None, doctype=None, status=None, reason=None):
    """Update the status of a request with multi-level approval workflow"""
    try:
        # Handle both JSON and form data
        if not employee_id:
            employee_id = frappe.form_dict.get('employee_id')
        if not request_name:
            request_name = frappe.form_dict.get('request_name')
        if not doctype:
            doctype = frappe.form_dict.get('doctype')
        if not status:
            status = frappe.form_dict.get('status')
        if not reason:
            reason = frappe.form_dict.get('reason')

        # Validate required parameters
        if not all([employee_id, request_name, doctype, status]):
            return {"status": "fail", "message": _("Missing required parameters: employee_id, request_name, doctype, status")}
        
        # Get current user's employee record if not provided
        current_user = frappe.session.user
        if not employee_id:
            employee_id = frappe.db.get_value("Employee", {"user_id": current_user}, "name")
            if not employee_id:
                return {"status": "fail", "message": _("No employee record found for current user")}
        
        # Check if user has permission to approve/reject
        access_check = check_approval_screen_access(employee_id)
        if not access_check.get("has_access"):
            return {"status": "fail", "message": _("You don't have permission to update this request")}
        
        # Validate that the request exists
        if not frappe.db.exists(doctype, request_name):
            return {"status": "fail", "message": _("Request not found")}
        
        # Get the request document
        doc = frappe.get_doc(doctype, request_name, ignore_permissions=True)
        employee_doc = frappe.get_doc("Employee", doc.employee, ignore_permissions=True)
        current_user = frappe.session.user
        
        # Validate approval permission for this specific request
        action = "approve" if status.lower() == "approved" else "reject"
        permission_check = validate_approval_permission(doc, employee_doc, current_user, action)
        
        if not permission_check.get("valid"):
            return {"status": "fail", "message": permission_check.get("message")}
        
        # Extract permission flags
        is_hr = permission_check.get("is_hr")
        is_direct_manager = permission_check.get("is_direct_manager")
        is_designated_approver = permission_check.get("is_designated_approver")
        
        # Handle approval workflow based on doctype and current status
        if doctype == "Leave Application":
            return _handle_leave_approval(doc, employee_doc, status, reason, is_hr, is_direct_manager, is_designated_approver)
        elif doctype == "Shift Request":
            return _handle_shift_approval(doc, employee_doc, status, reason, is_hr, is_direct_manager, is_designated_approver)
        elif doctype == "Overtime Request":
            return _handle_overtime_approval(doc, employee_doc, status, reason, is_hr, is_direct_manager, is_designated_approver)
        else:
            return {"status": "fail", "message": _("Invalid document type: {0}").format(doctype)}
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Update Request Status Error")
        return {"status": "fail", "message": str(e)}

def _handle_leave_approval(doc, employee_doc, status, reason, is_hr, is_direct_manager, is_designated_approver):
    """Handle Leave Application approval workflow"""
    try:
        if status.lower() == "rejected":
            doc.status = "Rejected"
            doc.workflow_state = "Rejected"  # Set workflow state
            doc.docstatus = 1
            if reason:
                doc.remark = reason
            doc.save(ignore_permissions=True)
            frappe.db.commit()
            return {"status": "success", "message": _("Leave request rejected"), "data": {"name": doc.name, "status": doc.status}}
        
        elif status.lower() == "approved":
            # Check current status and determine next step
            if doc.status == "Requested":
                # First level approval
                if is_direct_manager and employee_doc.leave_approver and employee_doc.leave_approver != frappe.session.user:
                    # Manager approved, now send to designated leave approver
                    doc.status = "Manager Approved"
                    doc.workflow_state = "Manager Approved"  # Set workflow state
                    doc.custom_manager_approved_by = frappe.session.user
                    doc.custom_manager_approved_on = frappe.utils.now()
                    doc.save(ignore_permissions=True)
                    frappe.db.commit()

                    # Send notification to leave approver (you can implement this)
                    return {"status": "success", "message": _("Request approved and forwarded to leave approver"),
                           "data": {"name": doc.name, "status": doc.status}}

                elif is_designated_approver or is_hr:
                    # Direct approval by designated approver or HR
                    doc.status = "HR Approved"
                    doc.workflow_state = "HR Approved"  # Set workflow state
                    doc.docstatus = 1
                    doc.save(ignore_permissions=True)
                    frappe.db.commit()
                    return {"status": "success", "message": _("Leave request approved"),
                           "data": {"name": doc.name, "status": doc.status}}

                else:
                    return {"status": "fail", "message": _("You don't have permission to approve this request")}

            elif doc.status == "Manager Approved":
                # Second level approval
                if is_designated_approver or is_hr:
                    doc.status = "HR Approved"
                    doc.workflow_state = "HR Approved"  # Set workflow state
                    doc.docstatus = 1
                    doc.save(ignore_permissions=True)
                    frappe.db.commit()
                    return {"status": "success", "message": _("Leave request approved"),
                           "data": {"name": doc.name, "status": doc.status}}
                else:
                    return {"status": "fail", "message": _("You don't have permission to approve this request at this level")}
        
        return {"status": "fail", "message": _("Invalid status")}
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Handle Leave Approval Error")
        return {"status": "fail", "message": str(e)}

def _handle_shift_approval(doc, employee_doc, status, reason, is_hr, is_direct_manager, is_designated_approver):
    """Handle Shift Request approval workflow"""
    try:
        if status.lower() == "rejected":
            doc.status = "Rejected"
            doc.workflow_state = "Rejected"  # Set workflow state
            doc.docstatus = 1
            if reason:
                from frappe.desk.form.utils import add_comment
                add_comment("Shift Request", doc.name, f"Rejection reason: {reason}",
                           comment_email=frappe.session.user, comment_by=frappe.session.user)
            doc.save(ignore_permissions=True)
            frappe.db.commit()
            return {"status": "success", "message": _("Shift request rejected"), "data": {"name": doc.name, "status": doc.status}}
        
        elif status.lower() == "approved":
            # Check current status and determine next step
            if doc.status == "Requested":
                # First level approval - ONLY MANAGER can approve
                if is_direct_manager:
                    # Manager approved, now send to HR/designated approver
                    doc.status = "Manager Approved"
                    doc.workflow_state = "Manager Approved"  # Set workflow state
                    doc.custom_manager_approved_by = frappe.session.user
                    doc.custom_manager_approved_on = frappe.utils.now()
                    doc.save(ignore_permissions=True)
                    frappe.db.commit()
                    return {"status": "success", "message": _("Request approved and forwarded to HR for final approval"),
                           "data": {"name": doc.name, "status": doc.status}}

                else:
                    return {"status": "fail", "message": _("Only direct manager can approve this request at first level")}

            elif doc.status == "Manager Approved":
                # Second level approval - ONLY HR/Designated Approver can approve
                if is_designated_approver or is_hr:
                    # Direct method for HR approval (workflow transition has status validation issues)
                    doc.status = "HR Approved"
                    doc.workflow_state = "HR Approved"
                    doc.docstatus = 1
                    doc.save(ignore_permissions=True)
                    frappe.db.commit()

                    return {"status": "success", "message": _("Shift request approved"),
                           "data": {"name": doc.name, "status": doc.status}}
                else:
                    return {"status": "fail", "message": _("Only HR or designated approver can approve this request at second level")}
        
        return {"status": "fail", "message": _("Invalid status")}
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Handle Shift Approval Error")
        return {"status": "fail", "message": str(e)}

def _handle_overtime_approval(doc, employee_doc, status, reason, is_hr, is_direct_manager, is_designated_approver):
    """Handle Overtime Request approval workflow"""
    try:
        if status.lower() == "rejected":
            doc.status = "Rejected"
            doc.workflow_state = "Rejected"  # Set workflow state
            doc.docstatus = 1
            if reason:
                doc.reason = reason
            doc.save(ignore_permissions=True)
            frappe.db.commit()
            return {"status": "success", "message": _("Overtime request rejected"), "data": {"name": doc.name, "status": doc.status}}
        
        elif status.lower() == "approved":
            # Check current status and determine next step
            if doc.status == "Requested":
                # First level approval
                if is_direct_manager and employee_doc.reports_to and employee_doc.reports_to != frappe.session.user:
                    # Manager approved, now send to HR or designated approver
                    doc.status = "Manager Approved"
                    doc.workflow_state = "Manager Approved"  # Set workflow state
                    doc.custom_manager_approved_by = frappe.session.user
                    doc.custom_manager_approved_on = frappe.utils.now()
                    doc.save(ignore_permissions=True)
                    frappe.db.commit()
                    return {"status": "success", "message": _("Request approved and forwarded to HR"),
                           "data": {"name": doc.name, "status": doc.status}}

                elif is_designated_approver or is_hr:
                    # Direct approval by designated approver or HR
                    doc.status = "HR Approved"
                    doc.workflow_state = "HR Approved"  # Set workflow state
                    doc.docstatus = 1
                    doc.save(ignore_permissions=True)
                    frappe.db.commit()
                    return {"status": "success", "message": _("Overtime request approved"),
                           "data": {"name": doc.name, "status": doc.status}}

                else:
                    return {"status": "fail", "message": _("You don't have permission to approve this request")}

            elif doc.status == "Manager Approved":
                # Second level approval
                if is_designated_approver or is_hr:
                    doc.status = "HR Approved"
                    doc.workflow_state = "HR Approved"  # Set workflow state
                    doc.docstatus = 1
                    doc.save(ignore_permissions=True)
                    frappe.db.commit()
                    return {"status": "success", "message": _("Overtime request approved"),
                           "data": {"name": doc.name, "status": doc.status}}
                else:
                    return {"status": "fail", "message": _("You don't have permission to approve this request at this level")}
        
        return {"status": "fail", "message": _("Invalid status")}
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Handle Overtime Approval Error")
        return {"status": "fail", "message": str(e)}

@frappe.whitelist(allow_guest=False)
def get_user_profile_data():
    """Get current user's profile data including personal emails (User Email) and work email access"""
    try:
        user = frappe.session.user
        
        # Get basic user info
        user_doc = frappe.get_doc("User", user)
        
        # Prepare response data
        profile_data = {
            "full_name": user_doc.full_name or user,
            "email": user_doc.email or user,
            "user_image": user_doc.user_image,
            "personal_emails": [],
            "work_emails": [],
            "user_emails": []  # Keep for backward compatibility
        }
        
        # Get personal email accounts from existing User Email child table
        try:
            if frappe.has_permission("User", "read"):
                personal_email_accounts = frappe.get_all(
                    "User Email",
                    filters={"parent": user},
                    fields=["email_account", "email_id"],
                    order_by="idx"
                )
                
                personal_emails = []
                for idx, email_account_row in enumerate(personal_email_accounts):
                    email_data = {
                        "account_name": email_account_row.email_account,
                        "email_id": email_account_row.email_id,
                        "is_primary": idx == 0,  # First one is primary
                        "description": "Personal Email",
                        "type": "personal"
                    }
                    
                    # If email_id is not fetched, get it from Email Account
                    if not email_data["email_id"] and email_account_row.email_account:
                        email_id = frappe.db.get_value("Email Account", email_account_row.email_account, "email_id")
                        email_data["email_id"] = email_id
                    
                    if email_data["email_id"]:
                        personal_emails.append(email_data)
                
                profile_data["personal_emails"] = personal_emails
            
        except Exception as e:
            frappe.log_error(f"Error accessing personal email accounts for {user}: {str(e)}", "User Profile Data")
            profile_data["personal_emails"] = []
        
        # Get work email access from new child table
        try:
            work_email_accounts = frappe.get_all(
                "User Work Email Access",
                filters={"parent": user},
                fields=["email_account", "email_id", "access_type", "granted_by", "granted_date", "description"],
                order_by="idx"
            )
            
            work_emails = []
            for email_account_row in work_email_accounts:
                email_data = {
                    "account_name": email_account_row.email_account,
                    "email_id": email_account_row.email_id,
                    "access_type": email_account_row.access_type,
                    "granted_by": email_account_row.granted_by,
                    "granted_date": email_account_row.granted_date,
                    "description": email_account_row.description or "Work Email Access",
                    "type": "work"
                }
                
                # If email_id is not fetched, get it from Email Account
                if not email_data["email_id"] and email_account_row.email_account:
                    email_id = frappe.db.get_value("Email Account", email_account_row.email_account, "email_id")
                    email_data["email_id"] = email_id
                
                if email_data["email_id"]:
                    work_emails.append(email_data)
            
            profile_data["work_emails"] = work_emails
            
        except Exception as e:
            frappe.log_error(f"Error accessing work email accounts for {user}: {str(e)}", "User Profile Data")
            profile_data["work_emails"] = []
        
        # Combine all emails for backward compatibility
        all_emails = []
        for email in personal_emails:
            all_emails.append(email["email_id"])
        for email in work_emails:
            all_emails.append(email["email_id"])
        
        # Final fallback to user's main email if no emails found
        if not all_emails:
            all_emails = [user_doc.email] if user_doc.email else []
        
        profile_data["user_emails"] = all_emails
        
        return {
            "status": "success",
            "data": profile_data
        }
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get User Profile Data Error")
        return {
            "status": "error",
            "message": str(e)
        }

@frappe.whitelist(allow_guest=False)
def get_communications_with_tags(filters=None, tag_filter=None, search_term=None, limit_start=0, limit_page_length=10, order_by='creation desc', date_filter_type=None, from_date=None, to_date=None, single_date=None):
    """
    Efficiently get communications with tag filtering and search functionality
    """
    try:
        # Convert string parameters to proper types
        limit_start = int(limit_start) if limit_start else 0
        limit_page_length = int(limit_page_length) if limit_page_length else 10
        
        # Parse filters if it's a string
        if isinstance(filters, str):
            import json
            filters = json.loads(filters)
        
        if not filters:
            filters = {}
        
        # Clean up tag_filter - handle empty strings and None
        if not tag_filter or tag_filter == "all" or tag_filter == "":
            tag_filter = None
        
        # Clean up search_term - handle empty strings
        if not search_term or search_term == "":
            search_term = None
        
        # Start with base filters for Communication doctype
        communication_filters = filters.copy()
        
        # Handle date filtering
        if date_filter_type == "range" and from_date and to_date:
            # Add date range filter
            communication_filters['creation'] = ['between', [from_date, to_date]]
        elif date_filter_type == "single" and single_date:
            # Add single date filter (full day)
            communication_filters['creation'] = ['between', [single_date + ' 00:00:00', single_date + ' 23:59:59']]
        elif from_date and not to_date:
            # Only from date specified
            communication_filters['creation'] = ['>=', from_date]
        elif to_date and not from_date:
            # Only to date specified
            communication_filters['creation'] = ['<=', to_date + ' 23:59:59']
        
        # Handle tag filtering
        if tag_filter:
            # Get communications that have this specific tag
            tagged_communications = frappe.db.sql("""
                SELECT DISTINCT parent 
                FROM `tabMultiple Tag` 
                WHERE parenttype = 'Communication' AND tags = %s
            """, (tag_filter,), as_list=True)
            
            if tagged_communications:
                comm_names = [comm[0] for comm in tagged_communications]
                communication_filters['name'] = ['in', comm_names]
            else:
                # No communications found with this tag
                return {
                    'data': [],
                    'total_count': 0
                }
        
        # Handle search term
        if search_term:
            # If we already have tag filtering, search within those results
            if tag_filter:
                # Search within the already filtered communications
                search_results = frappe.db.sql("""
                    SELECT name FROM `tabCommunication`
                    WHERE name IN %(comm_names)s
                    AND (subject LIKE %(search_pattern)s OR content LIKE %(search_pattern)s)
                """, {
                    'comm_names': comm_names,
                    'search_pattern': f'%{search_term}%'
                }, as_list=True)
                
                if search_results:
                    communication_filters['name'] = ['in', [result[0] for result in search_results]]
                else:
                    return {
                        'data': [],
                        'total_count': 0
                    }
            else:
                # For standalone search, prioritize exact tag matches first
                exact_tag_results = frappe.db.sql("""
                    SELECT DISTINCT parent 
                    FROM `tabMultiple Tag` 
                    WHERE parenttype = 'Communication' AND tags = %s
                """, (search_term,), as_list=True)
                
                # If we found exact tag matches, use only those
                if exact_tag_results:
                    communication_filters['name'] = ['in', [result[0] for result in exact_tag_results]]
                else:
                    # If no exact tag match, then search in content but be more restrictive
                    # Only search for the term at word boundaries or as complete words
                    search_patterns = [
                        f'{search_term}%',  # Starts with search term
                        f'%{search_term}',  # Ends with search term  
                        f'% {search_term} %',  # Whole word surrounded by spaces
                        f'%{search_term}%'   # Contains search term (fallback)
                    ]
                    
                    content_results = set()
                    for pattern in search_patterns:
                        results = frappe.db.sql("""
                            SELECT DISTINCT name 
                            FROM `tabCommunication`
                            WHERE subject LIKE %s OR content LIKE %s
                        """, (pattern, pattern), as_list=True)
                        
                        if results:
                            content_results.update([result[0] for result in results])
                            # If we found results with a more restrictive pattern, stop here
                            if pattern != search_patterns[-1]:  # Not the fallback pattern
                                break
                    
                    # Also check for partial tag matches
                    partial_tag_results = frappe.db.sql("""
                        SELECT DISTINCT parent 
                        FROM `tabMultiple Tag` 
                        WHERE parenttype = 'Communication' AND tags LIKE %s
                    """, (f'%{search_term}%',), as_list=True)
                    
                    if partial_tag_results:
                        content_results.update([result[0] for result in partial_tag_results])
                    
                    if content_results:
                        communication_filters['name'] = ['in', list(content_results)]
                    else:
                        return {
                            'data': [],
                            'total_count': 0
                        }
        
        # Get total count
        total_count = frappe.db.count('Communication', communication_filters)
        
        # Get the actual communications
        communications = frappe.get_list(
            'Communication',
            fields=[
                'name', 'subject', 'sender', 'sender_full_name', 'recipients',
                'creation', 'content', 'read_by_recipient', 'has_attachment',
                'reference_doctype', 'reference_name', 'sent_or_received',
                'status', 'email_account'
            ],
            filters=communication_filters,
            order_by=order_by,
            limit_start=limit_start,
            limit_page_length=limit_page_length
        )
        
        # Add tags to each communication
        for comm in communications:
            tags = frappe.db.sql("""
                SELECT tags 
                FROM `tabMultiple Tag` 
                WHERE parent = %s AND parenttype = 'Communication'
            """, (comm.name,), as_dict=True)
            comm['tags'] = [tag.tags for tag in tags if tag.tags]
        
        return {
            'data': communications,
            'total_count': total_count
        }
        
    except Exception as e:
        # Simple error logging without long messages
        frappe.log_error("Error in get_communications_with_tags", "Communications API Error")
        return {
            'data': [],
            'total_count': 0
        }

@frappe.whitelist(allow_guest=False)
def add_work_email_access(user, email_account, access_type="Read Only", description=""):
    """
    Helper function to add work email access for a user
    Can be used by administrators to grant email access
    """
    try:
        # Check if user has permission to manage email access
        if not frappe.has_permission("User", "write"):
            return {"status": "error", "message": "Insufficient permissions"}
        
        # Validate email account exists
        if not frappe.db.exists("Email Account", email_account):
            return {"status": "error", "message": "Email account not found"}
        
        # Check if access already exists
        existing = frappe.get_all(
            "User Work Email Access",
            filters={
                "parent": user,
                "email_account": email_account
            }
        )
        
        if existing:
            return {"status": "error", "message": "User already has access to this email account"}
        
        # Get email ID from Email Account
        email_id = frappe.db.get_value("Email Account", email_account, "email_id")
        
        # Create work email access entry
        work_email = {
            "doctype": "User Work Email Access",
            "parent": user,
            "parenttype": "User",
            "parentfield": "work_emails",
            "email_account": email_account,
            "email_id": email_id,
            "access_type": access_type,
            "granted_by": frappe.session.user,
            "granted_date": frappe.utils.today(),
            "description": description
        }
        
        # Insert the work email access entry
        work_email_doc = frappe.get_doc(work_email)
        work_email_doc.insert()
        
        return {
            "status": "success",
            "message": "Work email access granted successfully",
            "data": work_email_doc.name
        }
        
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Add Work Email Access Error")
        return {
            "status": "error",
            "message": str(e)
        }

# Custom fields for multi-level approval are now created directly in:
# - svg_mobile_app/svg_mobile_app/custom/leave_application.json  
# - svg_mobile_app/svg_mobile_app/custom/shift_request.json
# These will be automatically applied when the app is installed/migrated


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

        branch = frappe.get_doc("Branch", employee.branch)
        branch_description = extract_text_from_html(branch.custom_description)

        # Prepare response data
        employee_details = {
            "company": employee.company,
            "branch": employee.branch,
            "latitude": branch.latitude,
            "longitude": branch.longitude,
            "description": branch_description,
            "distance": branch.distance,
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
        branch = frappe.db.get_value("Employee", employee_id, "branch")
        branch_details = None

        if branch:
            address_details = frappe.get_doc("Branch", branch)

        # --- Combined Response ---
        return {
            "status": "success",
            "message": _("Employee shift and check-in/out data retrieved successfully."),
            "data": {
                "shift": shift_data,
                "checkins": paired_checkins,
                "company_details": {
                    "address": address_details.address,
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
def mark_attendance(employee_id, lat, long, distance, action="check-in"):
    try:
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

        # --- Step 3: Check for "Work from Home" request ---
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

        # --- Step 4: Validate distance from company location ---
        branchDistance = frappe.db.get_value("Branch", employee.branch, "distance")

        if distance > float(branchDistance):
            return {
                "status": "fail",
                "message": _("You are too far from the company location. Please get closer."),
            }

        # --- Step 5: Create check-in ---
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
        
        branch = employee.branch
        branch_shifts = frappe.get_all(
            "Shift Type",
            filters={
                "custom_branch": branch,
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

        excuse_times = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]

        return {
            "status": "success",
            "message": _("Available leaves retrieved successfully"),
            "shifts": branch_shifts,
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
                "status": "Open",
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
                    "status": "Draft",
                })
                shift_request.insert()
                
                # Add reason as a comment since explanation field doesn't exist
                if reason:
                    frappe.add_comment("Comment", shift_request.name, text=f"Reason: {reason or 'No explanation provided'}", comment_by=frappe.session.user)
                
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
                    "status": "Draft",
                })
                shift_request.insert()
                
                # Add reason as a comment since explanation field doesn't exist
                if reason:
                    frappe.add_comment("Comment", shift_request.name, text=f"Reason: {reason or 'No explanation provided'}", comment_by=frappe.session.user)
                
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
    except frappe.DoesNotExistError:
        frappe.throw(f"Salary Slip {salary_slip_id} does not exist.")
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Salary Slip Details Error")
        frappe.throw("An error occurred while retrieving the salary slip details.")

@frappe.whitelist(allow_guest=False)
def overtime_request(employee_id, date, start_time, end_time, reason=None):
    try:
        # Validate that the employee exists
        employee = frappe.get_doc("Employee", employee_id)
        if not employee:
            return {"status": "fail", "message": _("Employee not found")}

        overtime_request = frappe.get_doc({
            "doctype": "Overtime Request",
            "employee": employee_id,
            "day_of_overtime": date,
            "time_from": start_time,
            "time_to": end_time,
            "status": "Open",
            "reason": reason or _("No reason provided")
        })
        overtime_request.insert()

        return {
            "status": "success",
            "message": _("Overtime request created successfully"),
            "docname": overtime_request.name
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
        fields=["name", "employee_name", "day_of_overtime", "time_from", "time_to", "status", "reason"]
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
        
        # Check if user has HR or Manager role
        roles = frappe.get_roles(user)
        is_direct_manager = "Direct Manager" in roles
        has_reports = employee.reports_to and len(frappe.get_all("Employee", {"reports_to": employee_id})) > 0
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
def get_pending_requests(employee_id, from_date=None, to_date=None, pending_only=1):
    """Get pending requests for employees reporting to this manager/HR"""
    try:
        # Check if user is HR or manager
        access_check = check_approval_screen_access(employee_id)
        if not access_check.get("has_access"):
            return {"status": "fail", "message": _("You don't have permission to access this data")}
        
        # Get employees reporting to this manager
        filters = []
        is_hr = access_check.get("is_hr")
        is_direct_manager = access_check.get("is_direct_manager")
        has_reports = access_check.get("has_reports")
        
        if not is_hr:
            if has_reports:
                # For managers with direct reports, only show those employees
                reporting_employees = frappe.get_all("Employee", 
                    filters={"reports_to": employee_id},
                    pluck="name"
                )
                if not reporting_employees:
                    return {"status": "success", "data": []}
                filters.append(["employee", "in", reporting_employees])
            elif is_direct_manager:
                # For direct managers without specific reports, get department members
                employee = frappe.get_doc("Employee", employee_id)
                if employee.department:
                    dept_employees = frappe.get_all("Employee",
                        filters={"department": employee.department},
                        pluck="name"
                    )
                    if not dept_employees:
                        return {"status": "success", "data": []}
                    filters.append(["employee", "in", dept_employees])
                else:
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
            leave_filters = filters + [["status", "=", "Open"]]
            shift_filters = filters + [["status", "=", "Draft"]]
            overtime_filters = filters + [["status", "=", "Open"]]
        else:
            leave_filters = filters.copy()
            shift_filters = filters.copy()
            overtime_filters = filters.copy()
        
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
        
        # Get overtime requests
        overtime_requests = frappe.get_all(
            "Overtime Request",
            filters=overtime_filters,
            fields=["name", "employee", "employee_name", "day_of_overtime as from_date", 
                    "day_of_overtime as to_date", "'Overtime' as request_type", 
                    "status", "reason", "creation"],
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


@frappe.whitelist(allow_guest=False)
def update_request_status(employee_id, request_name, doctype, status, reason=None):
    """Update the status of a request (Leave Application, Shift Request, Overtime Request)"""
    try:
        # Check if user has permission to approve/reject
        access_check = check_approval_screen_access(employee_id)
        if not access_check.get("has_access"):
            return {"status": "fail", "message": _("You don't have permission to update this request")}
        
        # Get the request document
        doc = frappe.get_doc(doctype, request_name)
        
        # For managers, verify they are the manager of the employee in the request
        if not access_check.get("is_hr"):
            employee = frappe.get_doc("Employee", doc.employee)
            if employee.reports_to != employee_id:
                return {"status": "fail", "message": _("You can only update requests for your direct reports")}
        
        # Update status based on doctype
        if doctype == "Leave Application":
            # Status values: Open, Approved, Rejected
            if status.lower() == "approved":
                doc.status = "Approved"
                doc.docstatus = 1  # Submit the document
            elif status.lower() == "rejected":
                doc.status = "Rejected"
                doc.docstatus = 1  # Submit the document
                if reason:
                    doc.remark = reason
        
        elif doctype == "Shift Request":
            # Status values: Draft, Submitted, Approved, Rejected
            if status.lower() == "approved":
                doc.status = "Approved"
                doc.docstatus = 1  # Submit the document
            elif status.lower() == "rejected":
                doc.status = "Rejected"
                doc.docstatus = 1  # Submit the document
                # Store the reason in a custom comment since explanation field doesn't exist
                if reason:
                    frappe.add_comment("Comment", doc.name, text=f"Rejection reason: {reason}", comment_by=frappe.session.user)
        
        elif doctype == "Overtime Request":
            # Status values: Open, Approved, Rejected
            if status.lower() == "approved":
                doc.status = "Approved"
                doc.docstatus = 1  # Submit the document
            elif status.lower() == "rejected":
                doc.status = "Rejected"
                doc.docstatus = 1  # Submit the document
                if reason:
                    doc.reason = reason
        
        doc.save()
        frappe.db.commit()
        
        return {
            "status": "success",
            "message": _("Request status updated successfully"),
            "data": {
                "name": doc.name,
                "status": doc.status
            }
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Update Request Status Error")
        return {"status": "fail", "message": str(e)}

@frappe.whitelist(allow_guest=False)
def get_user_profile_data():
    """Get current user's profile data including email accounts safely"""
    try:
        user = frappe.session.user
        
        # Get basic user info
        user_doc = frappe.get_doc("User", user)
        
        # Prepare response data
        profile_data = {
            "full_name": user_doc.full_name or user,
            "email": user_doc.email or user,
            "user_image": user_doc.user_image,
            "user_emails": []
        }
        
        # Try to get email accounts from the User Emails child table safely
        try:
            # Check if user has permission to read their own user data
            if frappe.has_permission("User", "read", user_doc=user_doc):
                # Get email accounts from the User Emails child table
                # This child table links to Email Account doctype through email_id field
                user_email_accounts = frappe.get_all(
                    "User Emails",  # Child table doctype name
                    filters={"parent": user},
                    fields=["email_id"],  # Field that links to Email Account
                    order_by="idx"
                )
                
                # Get the actual email addresses from Email Account doctype
                email_addresses = []
                for email_account_row in user_email_accounts:
                    if email_account_row.email_id:
                        # Get the email_id from Email Account doctype
                        email_id = frappe.db.get_value("Email Account", email_account_row.email_id, "email_id")
                        if email_id:
                            email_addresses.append(email_id)
                
                profile_data["user_emails"] = email_addresses
            else:
                # Fallback: just use the main email
                profile_data["user_emails"] = [user_doc.email] if user_doc.email else []
        except Exception as e:
            # If there's any error accessing user emails, just use main email
            frappe.log_error(f"Error accessing user email accounts for {user}: {str(e)}", "User Profile Data")
            profile_data["user_emails"] = [user_doc.email] if user_doc.email else []
        
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


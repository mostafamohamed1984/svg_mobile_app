# SVG Mobile App - API Documentation for Flutter Developers

## Overview
This document provides comprehensive API documentation for the SVG Mobile App backend APIs. All APIs are built using Frappe framework and require proper authentication unless specified otherwise.

## Base Configuration
- **Base URL**: `https://your-domain.com/api/method/svg_mobile_app.api`
- **Authentication**: Most APIs require session-based authentication
- **Content-Type**: `application/json` or `application/x-www-form-urlencoded`

---

## 🔐 Authentication APIs

### 1. Login
**Endpoint**: `/login`  
**Method**: `POST`  
**Allow Guest**: `True`

**Parameters**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Login successful",
  "token": "session_token_here",
  "user_id": "EMP-001",
  "image": "/files/profile_image.jpg"
}
```

**Error Response**:
```json
{
  "status": "fail",
  "message": "Invalid login credentials"
}
```

### 2. Save FCM Token
**Endpoint**: `/save_fcm_token`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "user_id": "EMP-001",
  "fcm_token": "firebase_token_here"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Token saved successfully"
}
```

---

## 👤 Profile & Employee APIs

### 3. Get Employee Details
**Endpoint**: `/get_employee_details`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Employee details retrieved successfully.",
  "data": {
    "position": "Software Developer",
    "department": "IT",
    "manager": "John Doe",
    "employment_type": "Full-time",
    "date_of_joining": "2023-01-15",
    "default_shift_start": "09:00:00",
    "default_shift_end": "17:00:00",
    "image": "/files/employee_image.jpg",
    "current_salary": 5000.00
  }
}
```

### 4. Get Company Details
**Endpoint**: `/get_company_details`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Employee details retrieved successfully.",
  "data": {
    "company": "SVG Company",
    "branch": "Main Branch",
    "latitude": 25.2048,
    "longitude": 55.2708,
    "description": "Company description here",
    "radius": 100.0
  }
}
```

---

## ⏰ Attendance & Check-in APIs

### 5. Get Employee Shift and Check-in
**Endpoint**: `/get_employee_shift_and_checkin`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Employee shift and check-in/out data retrieved successfully.",
  "data": {
    "shift": {
      "shift_type": "Default",
      "start_time": "09:00:00",
      "end_time": "17:00:00"
    },
    "checkins": [
      {
        "check_in": "09:00:00",
        "check_out": "17:00:00"
      }
    ],
    "company_details": {
      "address": "Company Address",
      "latitude": 25.2048,
      "longitude": 55.2708
    }
  }
}
```

### 6. Mark Attendance (Check-in/Check-out)
**Endpoint**: `/mark_attendance`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001",
  "lat": "25.2048",
  "long": "55.2708",
  "action": "check-in",
  "radius": "50.0"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Attendance marked successfully.",
  "data": "checkin_record_id"
}
```

**Error Response**:
```json
{
  "status": "fail",
  "message": "You are too far from the company location. Please get closer."
}
```

### 7. Get Single Day Attendance
**Endpoint**: `/get_single_attendance`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001",
  "day": "15",
  "month": "12",
  "year": "2023"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Attendance records retrieved successfully.",
  "data": [
    {
      "log_type": "IN",
      "time": "2023-12-15 09:00:00"
    },
    {
      "log_type": "OUT",
      "time": "2023-12-15 17:00:00"
    }
  ]
}
```

### 8. Calculate Monthly Attendance
**Endpoint**: `/calculate_employee_monthly_attendance`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001",
  "year": "2023",
  "month": "12",
  "day": "15"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Attendance calculation completed successfully.",
  "data": {
    "present": 20,
    "absent": 2,
    "on_leave": 3,
    "half_day": 1,
    "work_from_home": 4,
    "total_days_in_month": 30,
    "month": "12",
    "year": "2023",
    "day": "15",
    "first_check_in": "09:00:00",
    "last_check_out": "17:00:00",
    "lateness_stats": {
      "lateness_stats": {
        "late": 2,
        "early": 1,
        "on_time": 17
      }
    },
    "total_working_hours": "160:00"
  }
}
```

---

## 🏖️ Leave & Request APIs

### 9. Get Available Leaves
**Endpoint**: `/get_available_leaves`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Available leaves retrieved successfully",
  "shifts": [
    {
      "name": "Work from Home"
    },
    {
      "name": "Excuse - 2 Hours"
    }
  ],
  "data": [
    {
      "leave_type": "Annual Leave",
      "from_date": "2023-01-01",
      "to_date": "2023-12-31",
      "remaining_leaves": 15.0
    }
  ],
  "excuse_times": [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0]
}
```

### 10. Submit Leave/Shift Request
**Endpoint**: `/leave_shift_request`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001",
  "type": "leave",
  "start_date": "2023-12-20",
  "end_date": "2023-12-22",
  "sub_type": "Annual Leave",
  "reason": "Family vacation",
  "excuse_time": 2.0
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Leave request created successfully",
  "docname": "HR-LAP-2023-00001"
}
```

### 11. Get Employee Leave/Shift Data
**Endpoint**: `/get_employee_data`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001",
  "data_type": "leave",
  "from_date": "2023-01-01",
  "to_date": "2023-12-31"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Employee data retrieved successfully.",
  "data": [
    {
      "posting_date": "2023-12-15",
      "from_date": "2023-12-20",
      "to_date": "2023-12-22",
      "status": "Approved",
      "leave_type": "Annual Leave",
      "description": "Family vacation"
    }
  ]
}
```

### 12. Get Employee Attendance Records
**Endpoint**: `/get_employee_attendance`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001",
  "from_date": "2023-12-01",
  "to_date": "2023-12-31",
  "status": "Present"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Attendance records retrieved successfully.",
  "data": {
    "attendance_list": [
      {
        "attendance_date": "2023-12-15",
        "status": "Present"
      }
    ],
    "status_counts": {
      "Present": 20,
      "Absent": 2,
      "On Leave": 3
    }
  }
}
```

---

## 💰 Salary APIs

### 13. Get Salary Slips
**Endpoint**: `/get_salary_slips`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001",
  "year": "2023"
}
```

**Response**:
```json
{
  "status": "success",
  "salaries": [
    {
      "name": "HR-SAL-2023-00001",
      "employee_name": "John Doe",
      "start_date": "2023-12-01",
      "end_date": "2023-12-31",
      "net_pay": 4500.00,
      "status": "Submitted"
    }
  ]
}
```

### 14. Get Salary Slip Details
**Endpoint**: `/get_salary_slip_details`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "salary_slip_id": "HR-SAL-2023-00001"
}
```

**Response**:
```json
{
  "status": "success",
  "details": {
    "employee": "EMP-001",
    "employee_name": "John Doe",
    "net_pay": 4500.00,
    "gross_pay": 5000.00,
    "bank_name": "ABC Bank",
    "bank_account_no": "1234567890",
    "deductions": [
      {
        "salary_component": "Tax",
        "amount": 500.00
      }
    ],
    "earnings": [
      {
        "salary_component": "Basic Salary",
        "amount": 5000.00
      }
    ]
  }
}
```

---

## ⏱️ Overtime APIs

### 15. Submit Overtime Request
**Endpoint**: `/overtime_request`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001",
  "date": "2023-12-15",
  "start_time": "18:00:00",
  "end_time": "20:00:00",
  "reason": "Project deadline"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Overtime request created successfully",
  "docname": "HR-OTR-2023-00001",
  "duration": 2.0
}
```

### 16. Get Overtime Requests
**Endpoint**: `/get_overtime_requests`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001",
  "start_date": "2023-12-01",
  "end_date": "2023-12-31"
}
```

**Response**:
```json
{
  "status": "success",
  "overtimes": [
    {
      "name": "HR-OTR-2023-00001",
      "employee_name": "John Doe",
      "day_of_overtime": "2023-12-15",
      "time_from": "18:00:00",
      "time_to": "20:00:00",
      "duration": 2.0,
      "status": "Requested",
      "reason": "Project deadline"
    }
  ]
}
```

---

## 📢 Notifications & Announcements APIs

### 17. Get Notifications
**Endpoint**: `/get_notifications`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001"
}
```

**Response**:
```json
{
  "status": "success",
  "data": [
    {
      "name": "NOTIF-001",
      "employee": "EMP-001",
      "doctype_name": "Leave Application",
      "sending_date": "2023-12-15",
      "title": "Leave Request Approved",
      "content": "Your leave request has been approved."
    }
  ]
}
```

### 18. Get Announcements
**Endpoint**: `/get_announcements`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001"
}
```

**Response**:
```json
{
  "status": "success",
  "data": [
    {
      "name": "ANN-001",
      "date": "2023-12-15",
      "body_mail": "<p>Important company announcement...</p>"
    }
  ]
}
```

---

## 👨‍💼 Manager & HR APIs

### 19. Check Approval Screen Access
**Endpoint**: `/check_approval_screen_access`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001"
}
```

**Response**:
```json
{
  "status": "success",
  "has_access": true,
  "is_hr": false,
  "is_manager": true,
  "is_direct_manager": true,
  "has_reports": true
}
```

### 20. Get Pending Requests (Manager/HR)
**Endpoint**: `/get_pending_requests`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001",
  "from_date": "2023-12-01",
  "to_date": "2023-12-31",
  "pending_only": 1,
  "request_type": "leave"
}
```

**Response**:
```json
{
  "status": "success",
  "data": [
    {
      "name": "HR-LAP-2023-00001",
      "employee": "EMP-002",
      "employee_name": "Jane Smith",
      "from_date": "2023-12-20",
      "to_date": "2023-12-22",
      "request_type": "Annual Leave",
      "status": "Requested",
      "reason": "Family vacation",
      "creation": "2023-12-15 10:00:00",
      "doctype": "Leave Application"
    }
  ]
}
```

### 21. Update Request Status (Approve/Reject)
**Endpoint**: `/update_request_status`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "employee_id": "EMP-001",
  "request_name": "HR-LAP-2023-00001",
  "doctype": "Leave Application",
  "status": "approved",
  "reason": "Approved by manager"
}
```

**Response**:
```json
{
  "status": "success",
  "message": "Leave request approved",
  "data": {
    "name": "HR-LAP-2023-00001",
    "status": "HR Approved"
  }
}
```

---

## 📧 Communication APIs

### 22. Get User Profile Data
**Endpoint**: `/get_user_profile_data`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**: None (uses session user)

**Response**:
```json
{
  "status": "success",
  "data": {
    "full_name": "John Doe",
    "email": "john@example.com",
    "user_image": "/files/profile.jpg",
    "personal_emails": [
      {
        "account_name": "Personal Gmail",
        "email_id": "john.personal@gmail.com",
        "is_primary": true,
        "description": "Personal Email",
        "type": "personal"
      }
    ],
    "work_emails": [
      {
        "account_name": "Work Email",
        "email_id": "john@company.com",
        "access_type": "Read Only",
        "granted_by": "admin@company.com",
        "granted_date": "2023-12-01",
        "description": "Work Email Access",
        "type": "work"
      }
    ],
    "user_emails": ["john.personal@gmail.com", "john@company.com"]
  }
}
```

### 23. Get Communications with Tags
**Endpoint**: `/get_communications_with_tags`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "filters": {},
  "tag_filter": "important",
  "search_term": "meeting",
  "limit_start": 0,
  "limit_page_length": 10,
  "order_by": "creation desc",
  "date_filter_type": "range",
  "from_date": "2023-12-01",
  "to_date": "2023-12-31"
}
```

**Response**:
```json
{
  "data": [
    {
      "name": "COMM-001",
      "subject": "Meeting Schedule",
      "sender": "manager@company.com",
      "sender_full_name": "Manager Name",
      "recipients": "john@company.com",
      "creation": "2023-12-15 10:00:00",
      "content": "Meeting content here...",
      "read_by_recipient": 1,
      "has_attachment": 0,
      "reference_doctype": null,
      "reference_name": null,
      "sent_or_received": "Received",
      "status": "Open",
      "email_account": "Work Email",
      "tags": ["important", "meeting"]
    }
  ],
  "total_count": 1
}
```

---

## 📊 Export APIs

### 24. Export Projects Gallery PDF
**Endpoint**: `/export_projects_gallery_pdf`  
**Method**: `POST`  
**Authentication**: Required

**Parameters**:
```json
{
  "filters": "[]",
  "visible_columns": "[\"project_name\", \"district\", \"region\"]",
  "export_limit": "200",
  "current_page": "1",
  "page_length": "20",
  "sort_field": "creation",
  "sort_order": "desc"
}
```

**Response**: PDF file download

---

## 🔧 Error Handling

### Common Error Responses:

**Authentication Error**:
```json
{
  "status": "fail",
  "message": "Authentication required"
}
```

**Permission Error**:
```json
{
  "status": "fail",
  "message": "You don't have permission to access this data"
}
```

**Validation Error**:
```json
{
  "status": "fail",
  "message": "Missing required parameters: employee_id"
}
```

**Server Error**:
```json
{
  "status": "fail",
  "message": "Something went wrong"
}
```

---

## 🔐 Security & Permissions

### Role-Based Access Control:

1. **HR Manager/HR User**: Can access all employees' data within their company
2. **Direct Manager**: Can access data for employees who report to them
3. **Regular Employee**: Can only access their own data

### Request Approval Workflow:

1. **Leave Applications**: Employee → Manager → HR → Approved
2. **Shift Requests**: Employee → Manager → HR → Approved  
3. **Overtime Requests**: Employee → Manager → HR → Approved

### Authentication:
- Use session-based authentication
- Include session token in headers or cookies
- Handle token expiration gracefully

---

## 📱 Flutter Implementation Tips

### 1. HTTP Client Setup:
```dart
class ApiClient {
  static const String baseUrl = 'https://your-domain.com/api/method/svg_mobile_app.api';
  
  static Future<Map<String, dynamic>> post(String endpoint, Map<String, dynamic> data) async {
    final response = await http.post(
      Uri.parse('$baseUrl$endpoint'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode(data),
    );
    return json.decode(response.body);
  }
}
```

### 2. Error Handling:
```dart
Future<ApiResponse> makeRequest(String endpoint, Map<String, dynamic> data) async {
  try {
    final response = await ApiClient.post(endpoint, data);
    if (response['status'] == 'success') {
      return ApiResponse.success(response['data']);
    } else {
      return ApiResponse.error(response['message']);
    }
  } catch (e) {
    return ApiResponse.error('Network error: $e');
  }
}
```

### 3. Session Management:
```dart
class SessionManager {
  static String? _token;
  
  static void setToken(String token) {
    _token = token;
    // Save to secure storage
  }
  
  static String? getToken() {
    return _token;
  }
  
  static void clearToken() {
    _token = null;
    // Clear from secure storage
  }
}
```

### 4. Location Services:
```dart
Future<Position> getCurrentLocation() async {
  bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
  if (!serviceEnabled) {
    throw Exception('Location services are disabled');
  }
  
  LocationPermission permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied) {
      throw Exception('Location permissions are denied');
    }
  }
  
  return await Geolocator.getCurrentPosition();
}
```

---

## 🚀 Testing

### Sample Test Cases:

1. **Login Flow**: Test valid/invalid credentials
2. **Attendance**: Test check-in/check-out with location validation
3. **Leave Requests**: Test submission and approval workflow
4. **Role-Based Access**: Test manager/HR access to pending requests
5. **Error Handling**: Test network failures and validation errors

### Postman Collection:
Create a Postman collection with all endpoints for easy testing during development.

---

## 📞 Support

For technical support or questions about the API implementation, please contact the backend development team.

**Last Updated**: December 2023  
**API Version**: 1.0 
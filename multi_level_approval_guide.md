# Multi-Level Approval Workflow Implementation

## Overview
The mobile app API now supports proper multi-level approval workflow for Leave Applications, Shift Requests, and Overtime Requests, replacing the previous single-level approval system.

## New Workflow Structure

### **Leave Applications**
```
Employee Request → Direct Manager → Leave Approver → Final Approval
```

**Statuses:**
- `Open` → Initial status when employee submits
- `Manager Approved` → After direct manager approves (if different from leave approver)
- `Approved` → Final approval by leave approver or HR
- `Rejected` → Can be rejected at any level

### **Shift Requests**
```
Employee Request → Direct Manager → Shift Request Approver → Final Approval
```

**Statuses:**
- `Draft` → Initial status when employee submits
- `Manager Approved` → After direct manager approves (if different from shift approver)
- `Approved` → Final approval by shift approver or HR
- `Rejected` → Can be rejected at any level

### **Overtime Requests**
```
Employee Request → Direct Manager → Final Approval
```

**Statuses:**
- `Open` → Initial status when employee submits
- `Approved` → Approved by direct manager or HR
- `Rejected` → Rejected by authorized approver

## Key Features

### **1. Intelligent Routing**
- If direct manager IS the designated approver → Single-level approval
- If direct manager is NOT the designated approver → Multi-level approval
- HR can approve at any level

### **2. Permission Validation**
- Direct managers can only act on their reports' requests
- Designated approvers can only act on requests assigned to them
- HR can act on any request
- Any authorized approver can reject at any level

### **3. Audit Trail**
- `custom_manager_approved_by` → Tracks who gave manager approval
- `custom_manager_approved_on` → Tracks when manager approval was given
- Comments and remarks for rejection reasons

## API Changes

### **Modified Functions:**

#### `update_request_status(employee_id, request_name, doctype, status, reason=None)`
- Now handles multi-level approval logic
- Validates current approval level
- Routes to appropriate handler function
- Maintains audit trail

#### `get_pending_requests(employee_id, ...)`
- Now includes "Manager Approved" status in pending requests
- Shows requests at different approval levels to appropriate approvers

### **New Functions:**

#### `setup_multi_level_approval_fields()`
- Creates required custom fields
- Adds new status options
- One-time setup function (requires System Manager role)

#### Helper Functions:
- `get_next_approver()` → Determines next approver in chain
- `_handle_leave_approval()` → Leave-specific approval logic
- `_handle_shift_approval()` → Shift-specific approval logic  
- `_handle_overtime_approval()` → Overtime-specific approval logic

## Setup Instructions

### **✅ Custom Fields Already Created**
The required custom fields have been created directly in the app and will be automatically applied when you migrate/install:

**Files created:**
- `svg_mobile_app/svg_mobile_app/custom/leave_application.json`
- `svg_mobile_app/svg_mobile_app/custom/shift_request.json`

**Fields added:**
- `Leave Application.custom_manager_approved_by` (Link to User)
- `Leave Application.custom_manager_approved_on` (Datetime)
- `Shift Request.custom_manager_approved_by` (Link to User)
- `Shift Request.custom_manager_approved_on` (Datetime)

**Status options updated:**
- Leave Application: Added "Manager Approved" status
- Shift Request: Added "Manager Approved" status

### **1. Apply the Changes**
Run a migration to apply the custom fields:
```bash
bench --site your-site migrate
```

### **2. Configure Employee Approvers**
In Employee doctype, ensure these fields are set:
- `reports_to` → Direct manager
- `leave_approver` → Who approves leave requests  
- `shift_request_approver` → Who approves shift requests

### **3. Test the Workflow**
1. Employee submits request via mobile app
2. Direct manager sees request in pending list
3. Manager approves → Request moves to designated approver
4. Designated approver sees request in their pending list
5. Final approval completes the workflow

## Mobile App Impact

### **For Employees:**
- No changes to request submission
- Status updates will show intermediate states
- Clear messaging about approval progress

### **For Managers:**
- Will see requests at their approval level
- Clear indication of what action they can take
- Proper routing to next approver

### **For HR:**
- Can see and act on all requests
- Can approve at any level
- Override capability maintained

## Example Workflow Scenarios

### **Scenario 1: Manager ≠ Leave Approver**
1. Employee submits leave → Status: "Open"
2. Direct Manager approves → Status: "Manager Approved"
3. Leave Approver approves → Status: "Approved" (Final)

### **Scenario 2: Manager = Leave Approver**
1. Employee submits leave → Status: "Open"
2. Manager/Leave Approver approves → Status: "Approved" (Final)

### **Scenario 3: HR Override**
1. Employee submits leave → Status: "Open"
2. HR approves directly → Status: "Approved" (Final)

### **Scenario 4: Rejection at Any Level**
1. Employee submits leave → Status: "Open"
2. Manager rejects → Status: "Rejected" (Final)
   OR
3. Manager approves → Status: "Manager Approved"
4. Leave Approver rejects → Status: "Rejected" (Final)

## Database Schema Changes

### **New Custom Fields:**
- `Leave Application.custom_manager_approved_by` (Link to User)
- `Leave Application.custom_manager_approved_on` (Datetime)
- `Shift Request.custom_manager_approved_by` (Link to User)
- `Shift Request.custom_manager_approved_on` (Datetime)

### **Updated Status Options:**
- **Leave Application:** Open, Manager Approved, Approved, Rejected, Cancelled
- **Shift Request:** Draft, Manager Approved, Submitted, Approved, Rejected, Cancelled
- **Overtime Request:** Open, Approved, Rejected (unchanged)

## Backward Compatibility

- Existing single-level approvals continue to work
- If no designated approver is set, falls back to direct manager approval
- HR override functionality preserved
- All existing APIs maintain their interfaces

## Future Enhancements

1. **Notification System:** Send push notifications at each approval level
2. **Escalation Rules:** Auto-escalate after X days
3. **Conditional Approvals:** Different workflows based on leave duration/type
4. **Approval Comments:** Rich text comments at each level
5. **Delegation:** Temporary approval delegation when approvers are unavailable

## Troubleshooting

### **Common Issues:**
1. **"Manager Approved" requests not showing:** Check if user is the designated approver
2. **Permission denied:** Verify employee hierarchy and approver assignments
3. **Status not updating:** Ensure custom fields are created via setup function

### **Debugging:**
- Check employee's `reports_to`, `leave_approver`, `shift_request_approver` fields
- Verify user roles (HR Manager, HR User, Direct Manager)
- Check API logs for detailed error messages

## API Endpoints for Flutter Developer

### **Base URL Structure**
```
POST /api/method/svg_mobile_app.api.{function_name}
```

### **Authentication**
All endpoints require authentication. Include in headers:
```
Authorization: token {api_key}:{api_secret}
```
Or use session-based authentication after login.

---

## **1. Login & Authentication**

### **Login**
```http
POST /api/method/svg_mobile_app.api.login
Content-Type: application/json

{
    "email": "user@company.com",
    "password": "password123"
}
```

**Response:**
```json
{
    "status": "success",
    "message": "Login successful",
    "token": "session_id_here",
    "user_id": "EMP-001",
    "image": "/files/profile.jpg"
}
```

---

## **2. Request Submission Endpoints**

### **Submit Leave/Shift Request**
```http
POST /api/method/svg_mobile_app.api.leave_shift_request
Content-Type: application/json

{
    "employee_id": "EMP-001",
    "type": "leave",  // "leave" or "shift"
    "start_date": "2025-01-15",
    "end_date": "2025-01-17",
    "sub_type": "Annual Leave",  // Leave type or Shift type
    "reason": "Family vacation",
    "excuse_time": 2.0  // Only for excuse shifts (optional)
}
```

**Response:**
```json
{
    "status": "success",
    "message": "Leave request created successfully",
    "docname": "LAP-2025-00001"
}
```

### **Submit Overtime Request**
```http
POST /api/method/svg_mobile_app.api.overtime_request
Content-Type: application/json

{
    "employee_id": "EMP-001",
    "date": "2025-01-15",
    "start_time": "18:00:00",
    "end_time": "20:00:00",
    "reason": "Project deadline"
}
```

**Response:**
```json
{
    "status": "success",
    "message": "Overtime request created successfully",
    "docname": "OTR-2025-00001"
}
```

---

## **3. Approval Management Endpoints**

### **Check Approval Access**
```http
POST /api/method/svg_mobile_app.api.check_approval_screen_access
Content-Type: application/json

{
    "employee_id": "EMP-001"
}
```

**Response:**
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

### **Get Pending Requests**
```http
POST /api/method/svg_mobile_app.api.get_pending_requests
Content-Type: application/json

{
    "employee_id": "EMP-001",
    "from_date": "2025-01-01",  // Optional
    "to_date": "2025-01-31",    // Optional
    "pending_only": 1,          // 1 for pending only, 0 for all
    "request_type": "leave"     // Optional: "leave", "shift", "overtime"
}
```

**Response:**
```json
{
    "status": "success",
    "data": [
        {
            "name": "LAP-2025-00001",
            "employee": "EMP-002",
            "employee_name": "John Doe",
            "from_date": "2025-01-15",
            "to_date": "2025-01-17",
            "request_type": "Annual Leave",
            "status": "Open",
            "reason": "Family vacation",
            "creation": "2025-01-10 09:30:00",
            "doctype": "Leave Application"
        },
        {
            "name": "SR-2025-00001",
            "employee": "EMP-003",
            "employee_name": "Jane Smith",
            "from_date": "2025-01-20",
            "to_date": "2025-01-20",
            "request_type": "Night Shift",
            "status": "Manager Approved",
            "reason": "Shift request",
            "creation": "2025-01-12 14:20:00",
            "doctype": "Shift Request"
        }
    ]
}
```

### **Update Request Status (Approve/Reject)**
```http
POST /api/method/svg_mobile_app.api.update_request_status
Content-Type: application/json

{
    "employee_id": "EMP-001",      // Approver's employee ID
    "request_name": "LAP-2025-00001",
    "doctype": "Leave Application",
    "status": "approved",          // "approved" or "rejected"
    "reason": "Rejection reason"   // Required for rejection
}
```

**Response for Manager Approval (Multi-level):**
```json
{
    "status": "success",
    "message": "Request approved and forwarded to leave approver",
    "data": {
        "name": "LAP-2025-00001",
        "status": "Manager Approved"
    }
}
```

**Response for Final Approval:**
```json
{
    "status": "success",
    "message": "Leave request approved",
    "data": {
        "name": "LAP-2025-00001",
        "status": "Approved"
    }
}
```

**Response for Rejection:**
```json
{
    "status": "success",
    "message": "Leave request rejected",
    "data": {
        "name": "LAP-2025-00001",
        "status": "Rejected"
    }
}
```

---

## **4. Employee Data Retrieval**

### **Get Employee's Own Requests**
```http
POST /api/method/svg_mobile_app.api.get_employee_data
Content-Type: application/json

{
    "employee_id": "EMP-001",
    "data_type": "leave",        // "leave" or "shift"
    "from_date": "2025-01-01",   // Optional
    "to_date": "2025-01-31"      // Optional
}
```

**Response:**
```json
{
    "status": "success",
    "message": "Employee data retrieved successfully.",
    "data": [
        {
            "posting_date": "2025-01-10",
            "from_date": "2025-01-15",
            "to_date": "2025-01-17",
            "status": "Manager Approved",
            "leave_type": "Annual Leave",
            "description": "Family vacation"
        }
    ]
}
```

### **Get Overtime Requests**
```http
POST /api/method/svg_mobile_app.api.get_overtime_requests
Content-Type: application/json

{
    "employee_id": "EMP-001",
    "start_date": "2025-01-01",
    "end_date": "2025-01-31"
}
```

**Response:**
```json
{
    "status": "success",
    "overtimes": [
        {
            "name": "OTR-2025-00001",
            "employee_name": "John Doe",
            "day_of_overtime": "2025-01-15",
            "time_from": "18:00:00",
            "time_to": "20:00:00",
            "status": "Approved",
            "reason": "Project deadline"
        }
    ]
}
```

---

## **Postman Testing Guide**

### **1. Setup Environment**
Create Postman environment variables:
- `base_url`: `https://your-domain.com`
- `token`: `session_token_from_login`

### **2. Login Test**
```http
POST {{base_url}}/api/method/svg_mobile_app.api.login
Body (raw JSON):
{
    "email": "administrator@example.com",
    "password": "admin"
}
```

### **3. Set Authorization**
After login, use the returned token:
- Method: No Auth (token will be in cookies)
- OR Manual header: `Authorization: token {{token}}`

### **4. Test Request Submission**
```http
POST {{base_url}}/api/method/svg_mobile_app.api.leave_shift_request
Body (raw JSON):
{
    "employee_id": "EMP-001",
    "type": "leave",
    "start_date": "2025-02-01",
    "end_date": "2025-02-03",
    "sub_type": "Annual Leave",
    "reason": "Test leave request"
}
```

### **5. Test Approval Flow**
```http
POST {{base_url}}/api/method/svg_mobile_app.api.get_pending_requests
Body (raw JSON):
{
    "employee_id": "EMP-MANAGER",
    "pending_only": 1
}
```

Then approve:
```http
POST {{base_url}}/api/method/svg_mobile_app.api.update_request_status
Body (raw JSON):
{
    "employee_id": "EMP-MANAGER",
    "request_name": "LAP-2025-00001",
    "doctype": "Leave Application",
    "status": "approved"
}
```

---

## **Status Codes & Error Handling**

### **Success Response Format:**
```json
{
    "status": "success",
    "message": "Operation completed successfully",
    "data": {}  // Optional data payload
}
```

### **Error Response Format:**
```json
{
    "status": "fail",
    "message": "Error description"
}
```

### **Common Error Scenarios:**
1. **Authentication Error**: `"status": "fail", "message": "Authentication required"`
2. **Permission Error**: `"status": "fail", "message": "You don't have permission..."`
3. **Validation Error**: `"status": "fail", "message": "Invalid data provided"`
4. **Not Found Error**: `"status": "fail", "message": "Employee not found"`

---

## **Flutter Implementation Tips**

### **1. API Service Class Structure**
```dart
class ApprovalApiService {
    static const String baseUrl = 'https://your-domain.com/api/method/svg_mobile_app.api';
    
    Future<ApiResponse> submitLeaveRequest(LeaveRequest request) async {
        // Implementation
    }
    
    Future<List<PendingRequest>> getPendingRequests(String employeeId) async {
        // Implementation
    }
    
    Future<ApiResponse> updateRequestStatus(String requestName, String doctype, String status) async {
        // Implementation
    }
}
```

### **2. Model Classes**
```dart
class PendingRequest {
    final String name;
    final String employee;
    final String employeeName;
    final String fromDate;
    final String toDate;
    final String requestType;
    final String status;
    final String reason;
    final String doctype;
    
    // Constructor and fromJson method
}
```

### **3. State Management**
- Use status field to determine UI state
- Handle intermediate states ("Manager Approved")
- Show appropriate actions based on user role
- Refresh pending requests after approval/rejection

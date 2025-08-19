# Attendance Location Validation Guide

## Overview

The SVG Mobile App implements a comprehensive attendance location validation system with multiple bypass mechanisms. This guide explains the validation hierarchy and how to implement it in frontend applications.

## Validation Hierarchy

The system checks location restrictions in the following order:

1. **Employee Level** - Individual employee bypass
2. **Shift Type Level** - Shift-based bypass (NEW)
3. **Work from Home** - Active WFH requests
4. **Company Radius** - Location-based validation

If any of the first three conditions are met, location validation is bypassed. Only if all bypass conditions fail does the system enforce company radius validation.

---

## 1. Employee Level Bypass

### Field: `employee.open_checkin_location`

**Description**: Individual employee setting that allows unlimited location check-ins.

**Use Cases**:
- Executives who travel frequently
- Field service technicians
- Sales representatives
- Individual exceptions

**Implementation**:
```javascript
// Check employee bypass
if (employee.open_checkin_location) {
    // Allow check-in from anywhere
    return allowCheckIn();
}
```

**Backend Field**: `Employee.open_checkin_location` (Boolean)

---

## 2. Shift Type Level Bypass (NEW)

### Field: `custom_allow_checkin_on_request`

**Description**: Shift type setting that allows all employees assigned to that shift to check in from anywhere.

**Use Cases**:
- Remote work shifts
- Field work shifts
- Client site shifts
- Traveling employee shifts

**Implementation**:
```javascript
// Get employee's current shift type
const currentShift = await getCurrentShiftType(employeeId);

if (currentShift && currentShift.custom_allow_checkin_on_request) {
    // Allow check-in from anywhere
    return allowCheckIn();
}
```

**Backend Logic**:
1. First checks for active Shift Assignment
2. Falls back to Employee's default_shift if no assignment
3. Validates `custom_allow_checkin_on_request` field

**Priority Order**:
- Assigned Shift (via Shift Assignment) - Higher Priority
- Default Shift (via Employee.default_shift) - Lower Priority

---

## 3. Work from Home Bypass

### Field: Active WFH Attendance Requests

**Description**: Temporary bypass based on approved Work from Home requests.

**Use Cases**:
- Approved remote work days
- Temporary work from home arrangements
- Sick leave working from home

**Implementation**:
```javascript
// Check for active WFH request
const wfhRequest = await checkActiveWFHRequest(employeeId, currentDate);

if (wfhRequest) {
    // Allow check-in from anywhere
    return allowCheckIn();
}
```

**Backend Query**:
```sql
SELECT name FROM `tabAttendance Request`
WHERE employee = %s
  AND docstatus != 2
  AND %s BETWEEN from_date AND to_date
  AND reason = 'Work From Home'
```

---

## 4. Company Radius Validation

### Field: `company.radius` vs Employee Location

**Description**: Final validation that checks if employee is within company premises.

**Use Cases**:
- Standard office-based employees
- Enforcing physical presence requirements
- Security and compliance requirements

**Implementation**:
```javascript
// Calculate distance from company location
const distance = calculateDistance(
    employeeLocation.lat, 
    employeeLocation.lng,
    companyLocation.lat, 
    companyLocation.lng
);

if (distance > company.radius) {
    return {
        status: "fail",
        message: "You are too far from the company location. Please get closer."
    };
}

// Allow check-in
return allowCheckIn();
```

---

## API Integration

### Mark Attendance Endpoint

**Endpoint**: `POST /api/method/svg_mobile_app.api.mark_attendance`

**Parameters**:
```javascript
{
    employee_id: "EMP-001",
    lat: 25.2048,
    long: 55.2708,
    action: "check-in", // or "check-out"
    radius: 150.5 // distance from company in meters
}
```

**Response Examples**:

**Success (Location Bypass)**:
```json
{
    "status": "success",
    "message": "Attendance marked successfully.",
    "data": "ATT-2025-001"
}
```

**Failure (Location Restriction)**:
```json
{
    "status": "fail",
    "message": "You are too far from the company location. Please get closer."
}
```

---

## Frontend Implementation Guide

### 1. Pre-Check Validation

Before attempting check-in, query employee and shift data:

```javascript
async function preCheckValidation(employeeId) {
    // Get employee details
    const employee = await getEmployeeDetails(employeeId);
    
    // Check employee level bypass
    if (employee.open_checkin_location) {
        return { canCheckInAnywhere: true, reason: "Employee bypass" };
    }
    
    // Get current shift type
    const shiftType = await getCurrentShiftType(employeeId);
    
    // Check shift type level bypass
    if (shiftType && shiftType.custom_allow_checkin_on_request) {
        return { canCheckInAnywhere: true, reason: "Shift type bypass" };
    }
    
    // Check WFH request
    const wfhRequest = await checkWFHRequest(employeeId);
    if (wfhRequest) {
        return { canCheckInAnywhere: true, reason: "Work from home" };
    }
    
    // Must validate location
    return { canCheckInAnywhere: false, reason: "Location validation required" };
}
```

### 2. Location-Based UI

```javascript
async function handleCheckIn(employeeId) {
    const validation = await preCheckValidation(employeeId);
    
    if (validation.canCheckInAnywhere) {
        // Show simple check-in button
        showSimpleCheckIn(validation.reason);
    } else {
        // Show location-based check-in with GPS
        showLocationCheckIn();
    }
}
```

### 3. Error Handling

```javascript
function handleCheckInResponse(response) {
    if (response.status === "fail") {
        if (response.message.includes("too far")) {
            // Show location error with map/directions
            showLocationError(response.message);
        } else {
            // Show generic error
            showError(response.message);
        }
    } else {
        // Success
        showSuccess("Check-in successful!");
    }
}
```

---

## Configuration Guide

### For HR/Admin Users

**Employee Level Configuration**:
1. Go to Employee master
2. Enable "Open Checkin Location" checkbox
3. Save employee record

**Shift Type Level Configuration**:
1. Go to Shift Type master
2. Enable "Custom Allow Checkin On Request" checkbox
3. Save shift type
4. Assign employees to this shift type via:
   - Shift Assignment (temporary)
   - Employee default_shift (permanent)

**Company Level Configuration**:
1. Go to Company master
2. Set appropriate radius in meters
3. Ensure latitude/longitude are correctly set

---

## Testing Scenarios

### Test Case 1: Employee Bypass
- Employee with `open_checkin_location = 1`
- Should allow check-in from anywhere
- No location validation required

### Test Case 2: Shift Type Bypass
- Employee assigned to shift with `custom_allow_checkin_on_request = 1`
- Should allow check-in from anywhere
- No location validation required

### Test Case 3: WFH Bypass
- Employee with active WFH request for current date
- Should allow check-in from anywhere
- No location validation required

### Test Case 4: Location Validation
- Employee with no bypasses
- Should enforce company radius validation
- Should fail if outside radius

### Test Case 5: Priority Testing
- Employee with multiple bypass conditions
- Should use first applicable bypass in hierarchy order

---

## Troubleshooting

### Common Issues

**Issue**: Check-in fails despite being in office
- **Solution**: Check company radius setting and GPS accuracy

**Issue**: Shift type bypass not working
- **Solution**: Verify shift assignment dates and custom field value

**Issue**: Employee bypass not working
- **Solution**: Check employee master for correct field setting

**Issue**: WFH bypass not working
- **Solution**: Verify attendance request status and date range

### Debug Information

Enable debug mode to see validation steps:
```javascript
const debugInfo = await getAttendanceDebugInfo(employeeId);
console.log(debugInfo);
```

---

## Security Considerations

1. **GPS Spoofing**: Consider implementing additional security measures for sensitive environments
2. **Audit Trail**: All check-ins are logged with location data for audit purposes
3. **Role-Based Access**: Only authorized users should modify bypass settings
4. **Regular Review**: Periodically review bypass settings to ensure they're still needed

---

## Version History

- **v1.0**: Initial implementation with employee and company radius validation
- **v1.1**: Added Work from Home bypass functionality
- **v1.2**: Added Shift Type level bypass functionality (NEW)

---

*Last Updated: July 2025*
*For technical support, contact the development team*

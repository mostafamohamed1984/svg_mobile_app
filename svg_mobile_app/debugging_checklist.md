# Navbar Checkin Button - Debugging Checklist

## Browser Console Debugging

### 1. Open Browser Developer Tools (F12)
Go to your ERPNext site and open Console tab

### 2. Check if JavaScript is Loading
```javascript
// Type this in console:
console.log("Checking navbar checkin...");
console.log("frappe.boot:", frappe.boot);
console.log("attendance_status:", frappe.boot.attendance_status);

// Debug function we included:
debugAttendance();
```

### 3. Check for Errors
Look for any red error messages in console that mention:
- `navbar_checkin.js`
- `attendance_status`
- `addAttendanceButton`

## Backend Debugging

### 4. Check Bootinfo API
```javascript
// In browser console, test the backend:
frappe.call({
    method: 'svg_mobile_app.svg_mobile_app.navbar.get_attendance_status',
    callback: function(r) {
        console.log("Attendance API response:", r);
    }
});
```

### 5. Check Employee Record
Go to: `/app/employee`
- Find your user's employee record
- Make sure `User ID` field is set to your email
- Employee status should be "Active"

## Common Issues & Solutions

### Issue 1: Button Not Appearing
**Possible Causes:**
- JavaScript not loading
- No employee record for user
- Bootinfo not populated
- Navbar selector not found

**Debug Steps:**
```javascript
// Check if script loaded
console.log("Button exists:", $('#navbar-attendance-btn').length);
console.log("Navbar elements:", $('.navbar-nav.navbar-right').length);
```

### Issue 2: "No employee record found"
**Solution:**
1. Go to Employee doctype
2. Create/edit employee record
3. Set User ID field to your email address

### Issue 3: JavaScript Errors
**Common Errors:**
- `frappe.boot.attendance_status is undefined`
- `Cannot read property of undefined`

**Solution:**
Check if hooks are properly loaded and bootinfo is populated

## Manual Testing Commands

### Test Backend Functions
```python
# In ERPNext console (bench --site sitename console)
import frappe
from svg_mobile_app.svg_mobile_app.navbar import get_attendance_status, create_checkin

# Test get status
result = get_attendance_status()
print(result)

# Test create checkin (if you have employee record)
result = create_checkin("IN")
print(result)
```

### Force Reload Assets
```bash
# On server
bench --site sitename clear-cache
bench --site sitename build --force
bench restart
```

## Navbar Selector Debugging

The button tries to insert before user dropdown. Check if these exist:

```javascript
// Check navbar structure
console.log("User dropdown:", $('.navbar-nav.navbar-right .dropdown:has(.user-image)').length);
console.log("Navbar right:", $('.navbar-nav.navbar-right').length);
console.log("All navbar elements:", $('.navbar-nav').length);
```

If selectors don't match, we need to update the JavaScript to target the correct elements.
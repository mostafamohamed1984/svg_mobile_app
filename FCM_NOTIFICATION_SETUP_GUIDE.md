# FCM Push Notification System Setup Guide

## 🎯 Overview

The FCM (Firebase Cloud Messaging) notification system has been implemented to send real-time push notifications to employees when their leave applications, shift requests, or overtime requests are approved or rejected.

## ✅ What's Implemented

### **1. FCM Notification Functions**
- `send_fcm_notification()` - Sends FCM push notifications
- `create_mobile_notification_log()` - Logs notifications in database
- `configure_firebase_server_key()` - Setup Firebase server key
- `test_fcm_notification()` - Test notification sending

### **2. Automatic Notifications Trigger On:**

#### **Leave Applications:**
- ✅ **Approved**: "Your leave request from [date] to [date] has been approved"
- ✅ **Rejected**: "Your leave request from [date] to [date] has been rejected"

#### **Shift Requests:**
- ✅ **Approved**: "Your shift request for [shift_type] from [date] to [date] has been approved"
- ✅ **Rejected**: "Your shift request for [shift_type] from [date] to [date] has been rejected"

#### **Overtime Requests:**
- ✅ **Approved**: "Your overtime request for [date] has been approved"
- ✅ **Rejected**: "Your overtime request for [date] has been rejected"

### **3. Notification Data Payload:**
Each notification includes:
- `request_id` - Document name
- `request_type` - Leave Application/Shift Request/Overtime Request
- `status` - approved/rejected
- Additional relevant data (dates, shift type, etc.)

## 🔧 Setup Instructions

### **Step 1: Configure Firebase Server Key**

1. **Get Firebase Server Key:**
   - Go to Firebase Console → Project Settings → Cloud Messaging
   - Copy the "Server key"

2. **Configure in ERPNext:**
   ```python
   # Method 1: Via API (System Manager only)
   svg_mobile_app.api.configure_firebase_server_key("YOUR_FIREBASE_SERVER_KEY")
   
   # Method 2: Via site_config.json
   # Add to your site's site_config.json:
   {
     "firebase_server_key": "YOUR_FIREBASE_SERVER_KEY"
   }
   ```

### **Step 2: Test FCM Notifications**

```python
# Test notification sending (System Manager only)
svg_mobile_app.api.test_fcm_notification(
    employee_id="SVG  -  091",
    title="Test Notification",
    body="Testing FCM notification system"
)
```

### **Step 3: Verify Employee FCM Tokens**

Ensure employees have FCM tokens saved:
```python
# Check if employee has FCM token
employee = frappe.get_doc("Employee", "SVG  -  091")
print(f"FCM Token: {employee.fcm_token}")

# Save FCM token via API
svg_mobile_app.api.save_fcm_token(
    user_id="SVG  -  091",
    fcm_token="FIREBASE_TOKEN_FROM_MOBILE_APP"
)
```

## 📱 Flutter Integration

### **1. FCM Token Registration**
```dart
// Get FCM token and save to backend
String? token = await FirebaseMessaging.instance.getToken();
if (token != null) {
    await ApiService.saveFcmToken(employeeId, token);
}
```

### **2. Handle Notification Payload**
```dart
// Handle notification when app is opened from notification
FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
    Map<String, dynamic> data = message.data;
    String requestType = data['request_type'];
    String requestId = data['request_id'];
    String status = data['status'];
    
    // Navigate to appropriate screen based on request_type
    if (requestType == 'Leave Application') {
        Navigator.push(context, LeaveDetailsScreen(requestId));
    }
    // Handle other request types...
});
```

## 🔍 Troubleshooting

### **Common Issues:**

1. **No notifications received:**
   - Check if Firebase server key is configured
   - Verify employee has valid FCM token
   - Check notification logs in Mobile Notification Log doctype

2. **Firebase authentication error:**
   - Verify Firebase server key is correct
   - Check Firebase project settings

3. **Token not found error:**
   - Ensure FCM token is saved for the employee
   - Re-register FCM token from mobile app

### **Debug Commands:**
```python
# Check notification logs
frappe.get_all("Mobile Notification log", 
    filters={"employee": "SVG  -  091"}, 
    fields=["title", "content", "sending_date", "status"])

# Check FCM token
frappe.db.get_value("Employee", "SVG  -  091", "fcm_token")

# Test notification manually
send_fcm_notification("SVG  -  091", "Test", "Manual test notification")
```

## 🎯 Notification Flow

```
1. Manager/HR approves/rejects request via API
   ↓
2. Approval handler (_handle_leave_approval, etc.) processes request
   ↓
3. Document status updated in database
   ↓
4. send_fcm_notification() called automatically
   ↓
5. FCM payload sent to Firebase servers
   ↓
6. Firebase delivers notification to employee's mobile device
   ↓
7. Mobile app receives notification and can navigate to relevant screen
```

## 🚀 Production Deployment

1. **Configure Firebase server key** in production environment
2. **Test notifications** with real employee accounts
3. **Monitor notification logs** for delivery status
4. **Set up error monitoring** for failed notifications

## 📊 Monitoring

- **Mobile Notification Log**: Track all sent notifications
- **Error Logs**: Monitor FCM sending failures
- **Employee FCM Tokens**: Ensure tokens are up-to-date

The FCM notification system is now fully integrated and will automatically send push notifications for all approval/rejection workflows! 🎉

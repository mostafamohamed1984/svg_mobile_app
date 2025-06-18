# Unified Email Access System

## Overview

The SVG Mobile App now features a **unified email access system** that integrates custom access controls directly into Frappe's core `User Email` child table. This eliminates the complexity of maintaining separate tables while providing enterprise-grade email permission management.

## Features

### ✅ **Unified Architecture**
- Single `User Email` table for all email accounts
- Native Frappe compatibility
- No complex permission system overrides needed

### ✅ **Granular Access Control**
- **Read Only**: View emails only
- **Read & Send**: View and send emails  
- **Full Access**: Complete email account management

### ✅ **Enterprise Features**
- Audit trail with `granted_by` and `granted_date`
- Custom descriptions for access grants
- Visual indicators in email interface
- System Manager oversight

### ✅ **Seamless Integration**
- Works with existing Frappe email system
- Backward compatible
- Automatic permission enforcement

## Architecture

### Core Components

1. **Custom Fields in User Email**
   - `access_type`: Select (Read Only, Read & Send, Full Access)
   - `granted_by`: Link to User (audit trail)
   - `granted_date`: Date (audit trail)
   - `description`: Small Text (notes)

2. **Permission System**
   - `permissions.py`: Handles Communication and Email Account permissions
   - Respects access types for read/write operations
   - Integrates with Frappe's core permission system

3. **API Integration**
   - `api.py`: Updated to use unified table
   - `get_user_profile_data()`: Returns all emails with access types
   - `add_email_access()`: Helper function for granting access

4. **Frontend Components**
   - Email inbox view with access type indicators
   - User profile display with email information
   - Visual differentiation between access levels

## Usage

### For System Managers

#### Granting Email Access
1. Navigate to User doctype
2. Click "Manage Email Access" button
3. Select email account and access type
4. Add description (optional)
5. Click "Grant Access"

#### Direct Table Management
1. Go to User doctype → User Emails section
2. Add new row with:
   - Email Account (required)
   - Access Type (defaults to Full Access)
   - Description (optional)
3. System auto-fills granted_by and granted_date

### For End Users

#### Email Interface
- **🔓 Full Access**: Complete email management
- **✉️ Read & Send**: Can view and send emails
- **🔒 Read Only**: View emails only

#### Email Inbox View
- Unified dropdown showing all accessible emails
- Visual indicators for access levels
- Automatic permission enforcement

## API Reference

### `get_user_profile_data()`
Returns user profile with unified email data:
```json
{
  "status": "success",
  "data": {
    "personal_emails": [
      {
        "account_name": "email_account_name",
        "email_id": "user@domain.com",
        "access_type": "Full Access",
        "granted_by": "Administrator",
        "granted_date": "2025-01-18",
        "description": "Personal email account",
        "type": "personal"
      }
    ]
  }
}
```

### `add_email_access(user, email_account, access_type, description)`
Programmatically grant email access:
```python
frappe.call({
    method: "svg_mobile_app.api.add_email_access",
    args: {
        user: "user@domain.com",
        email_account: "support@company.com", 
        access_type: "Read & Send",
        description: "Customer support access"
    }
})
```

## Database Schema

### User Email Table Extensions
```sql
ALTER TABLE `tabUser Email` 
ADD COLUMN access_type VARCHAR(20) DEFAULT 'Full Access',
ADD COLUMN granted_by VARCHAR(140),
ADD COLUMN granted_date DATE,
ADD COLUMN description TEXT;
```

## Migration

### Automatic Migration
- Existing `User Email` records get `access_type = 'Full Access'`
- Patch automatically runs on system update
- No manual intervention required

### Data Integrity
- All existing email access preserved
- Backward compatibility maintained
- Gradual rollout supported

## Security

### Permission Enforcement
- Server-side permission checks
- Query-level filtering
- Document-level access control
- Frontend UI restrictions

### Audit Trail
- All access grants logged
- `granted_by` tracks who granted access
- `granted_date` provides temporal tracking
- `description` allows detailed notes

## Troubleshooting

### Common Issues

**Q: User can't see emails after granting access**
A: Ensure system has been restarted after permission changes

**Q: Access type not showing in dropdown**
A: Verify custom fields are properly installed via bench migrate

**Q: Permission errors in console**
A: Check that user has appropriate roles and email account exists

### Debug Steps
1. Check User Email table for correct access_type
2. Verify permissions.py functions are being called
3. Test API endpoint directly
4. Check browser console for JavaScript errors

## Performance

### Optimizations
- Efficient query conditions in permission system
- Minimal database overhead
- Cached permission checks
- Optimized frontend rendering

### Scalability
- Supports large numbers of users
- Efficient email account management
- Minimal impact on existing system performance

## Development

### Adding New Access Types
1. Update select options in custom field definition
2. Modify permission logic in `permissions.py`
3. Update frontend indicators
4. Test thoroughly

### Custom Integrations
- Use `get_user_profile_data()` API for email access info
- Respect `access_type` in custom email interfaces
- Follow permission patterns for new features

## Support

For issues or questions:
1. Check this documentation
2. Review server logs for errors
3. Test with System Manager account
4. Contact development team with specific error details 
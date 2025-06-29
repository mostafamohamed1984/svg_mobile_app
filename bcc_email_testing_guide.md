# BCC Email Processing - Testing Guide

## Overview
This guide provides comprehensive testing steps for the BCC email processing implementation in Frappe/ERPNext. The solution intercepts CC/BCC emails, creates unique message-IDs, and forwards them to Gmail for proper processing.

## Prerequisites

### 1. System Requirements
- Frappe/ERPNext system with custom app installed
- Access to email accounts for testing
- Gmail account: `constr.sv@gmail.com` (configured as processing account)
- Admin access to create DocTypes and modify settings

### 2. Required Components
Verify these components are installed:
- ✅ Email Genius module (`svg_mobile_app/email_genius/`)
- ✅ BCC Processing Settings DocType
- ✅ Enhanced Supervisors Email Inbox
- ✅ Communication hooks in `hooks.py`

## Testing Phases

## Phase 1: Installation Verification

### Step 1.1: Verify DocType Creation
1. Navigate to **DocType List** in Frappe
2. Search for "BCC Processing Settings"
3. **Expected Result**: DocType should exist and be accessible
4. **If Failed**: Run `bench migrate` and check for errors

### Step 1.2: Check Email Genius Module
1. Navigate to file system: `svg_mobile_app/email_genius/`
2. Verify files exist:
   - `__init__.py`
   - `email_processor.py`
3. **Expected Result**: Both files present with correct functions
4. **If Failed**: Re-create missing files

### Step 1.3: Verify Hooks Configuration
1. Check `svg_mobile_app/hooks.py`
2. Look for:
   ```python
   doc_events = {
       "Communication": {
           "before_insert": "svg_mobile_app.email_genius.email_processor.intercept_incoming_email"
       }
   }
   ```
3. **Expected Result**: Hook should be present
4. **If Failed**: Add missing hook configuration

## Phase 2: Configuration Testing

### Step 2.1: Configure BCC Processing Settings
1. Go to **BCC Processing Settings** DocType
2. Create new document with:
   - **Enable BCC Processing**: ✅ Checked
   - **Gmail Account**: `constr.sv@gmail.com`
   - **Processing Method**: `Frappe Email Hook`
   - **Debug Mode**: ✅ Checked (for testing)
3. **Save** the document
4. **Expected Result**: Settings saved successfully

### Step 2.2: Test Settings Validation
1. Try saving with invalid Gmail format (e.g., "invalid-email")
2. **Expected Result**: Validation error should appear
3. **If Failed**: Check `bcc_processing_settings.py` validation logic

### Step 2.3: Test Connection (if applicable)
1. Click **Test Connection** button (if implemented)
2. **Expected Result**: Success message or connection status
3. **If Failed**: Check Gmail account accessibility

## Phase 3: Email Processing Testing

### Step 3.1: Test Direct Email (Control Test)
1. Send email directly TO a user in the system
2. Check **Communication** list
3. **Expected Result**: Email appears normally
4. **Purpose**: Establish baseline functionality

### Step 3.2: Test CC Email Processing
1. **Setup**: 
   - Email Account A: Sender
   - Email Account B: Primary recipient (TO)
   - System User: CC recipient
2. **Action**: Send email with system user in CC
3. **Check Results**:
   - Navigate to **Communication** list
   - Look for email entry with unique message-ID
   - Check if email shows CC indicator
4. **Expected Result**: 
   - Email appears in Communication list
   - Message-ID is unique (contains hash)
   - CC indicator visible in enhanced inbox

### Step 3.3: Test BCC Email Processing
1. **Setup**:
   - Email Account A: Sender  
   - Email Account B: Primary recipient (TO)
   - System User: BCC recipient
2. **Action**: Send email with system user in BCC
3. **Check Results**:
   - Navigate to **Communication** list
   - Look for email entry
   - Check enhanced inbox for BCC indicator
4. **Expected Result**:
   - Email appears despite being BCC'd
   - Unique message-ID generated
   - BCC indicator visible (orange badge)

### Step 3.4: Test Multiple Recipients
1. **Setup**:
   - Send email TO one system user
   - CC another system user
   - BCC a third system user
2. **Expected Result**:
   - 3 separate Communication entries
   - Each with unique message-ID
   - Proper indicators in enhanced inbox

## Phase 4: Enhanced Inbox Testing

### Step 4.1: Access Enhanced Inbox
1. Navigate to enhanced supervisors email inbox
2. Look for "BCC/CC Emails" filter option
3. **Expected Result**: Filter dropdown includes BCC/CC option

### Step 4.2: Test BCC/CC Filter
1. Select "BCC/CC Emails" from filter dropdown
2. **Expected Result**: 
   - Only CC/BCC emails displayed
   - Proper badges visible (orange for BCC, blue for CC)
   - Colored borders around email items

### Step 4.3: Test Enhanced Email Display
1. View emails in enhanced mode
2. Check for:
   - BCC/CC badges
   - Colored borders
   - Proper recipient information
3. **Expected Result**: Visual indicators clearly distinguish email types

### Step 4.4: Test Fallback Functionality
1. Temporarily disable BCC processing in settings
2. Access enhanced inbox
3. **Expected Result**: Should fallback to standard email fetching gracefully

## Phase 5: Gmail Integration Testing

### Step 5.1: Check Gmail Account
1. Log into `constr.sv@gmail.com`
2. Look for forwarded emails with modified message-IDs
3. **Expected Result**: Processed emails should appear in Gmail

### Step 5.2: Verify Message-ID Modification
1. Check email headers in Gmail
2. Look for modified message-IDs containing recipient hashes
3. **Expected Result**: Message-IDs should be unique per recipient

## Phase 6: Error Handling Testing

### Step 6.1: Test Invalid Configuration
1. Set invalid Gmail account in settings
2. Send CC/BCC email
3. **Expected Result**: System should handle error gracefully

### Step 6.2: Test Network Issues
1. Temporarily disable internet connection
2. Send CC/BCC email
3. **Expected Result**: Should fallback or queue for later processing

### Step 6.3: Test Large Email Processing
1. Send email with large attachments via CC/BCC
2. **Expected Result**: Should process without memory issues

## Phase 7: Performance Testing

### Step 7.1: Test Multiple Simultaneous Emails
1. Send multiple CC/BCC emails simultaneously
2. Monitor system performance
3. **Expected Result**: No significant performance degradation

### Step 7.2: Test High Volume Processing
1. Send 50+ emails with CC/BCC over short period
2. Monitor processing time and system resources
3. **Expected Result**: Acceptable performance maintained

## Troubleshooting Common Issues

### Issue 1: BCC Emails Not Appearing
**Symptoms**: BCC'd emails don't show in Communication list
**Check**:
- BCC Processing Settings enabled
- Hooks properly configured
- Gmail account accessible
- Email server supports BCC forwarding

### Issue 2: Duplicate Emails
**Symptoms**: Same email appears multiple times
**Check**:
- Message-ID generation logic
- Unique hash creation
- Processing hook execution

### Issue 3: Enhanced Inbox Not Loading
**Symptoms**: Enhanced inbox shows errors or doesn't load
**Check**:
- JavaScript files properly loaded
- API endpoints accessible
- Permissions for enhanced email functions

### Issue 4: Visual Indicators Missing
**Symptoms**: BCC/CC badges or colors not showing
**Check**:
- CSS files loaded correctly
- Enhanced rendering functions working
- Email type detection logic

## Test Data Cleanup

After testing, clean up test data:
1. Delete test Communication entries
2. Clear test emails from Gmail account
3. Reset BCC Processing Settings if needed
4. Document any issues found during testing

## Success Criteria

Testing is successful when:
- ✅ BCC emails appear in Communication list
- ✅ CC emails properly processed and displayed
- ✅ Visual indicators work correctly
- ✅ Enhanced inbox functions properly
- ✅ Gmail integration works seamlessly
- ✅ Error handling works gracefully
- ✅ Performance remains acceptable
- ✅ No data corruption or system instability

## Reporting Issues

When reporting issues, include:
1. **Steps to reproduce**
2. **Expected vs actual results**
3. **Error messages** (if any)
4. **System logs** from Frappe
5. **Email headers** (for email-specific issues)
6. **Screenshots** of enhanced inbox issues

## Next Steps After Testing

1. **Production Deployment**: If all tests pass
2. **User Training**: Train users on enhanced inbox features
3. **Monitoring**: Set up monitoring for BCC processing
4. **Documentation**: Update user documentation
5. **Backup**: Create system backup before full deployment 
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
- ✅ Enhanced Supervisors Email Inbox (`svg_mobile_app/custom_html_block/supervisors email inbox/`)
- ✅ Communication hooks in `hooks.py`
- ✅ Custom Communication fields for BCC processing

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
           "before_insert": "svg_mobile_app.email_genius.email_processor.process_bcc_email"
       }
   }
   
   email_hooks = [
       "svg_mobile_app.email_genius.email_processor.intercept_incoming_email"
   ]
   ```
3. **Expected Result**: Both hooks should be present
4. **If Failed**: Add missing hook configuration

### Step 1.4: Verify Custom Communication Fields
1. Navigate to **Communication** DocType
2. Check for custom fields:
   - `custom_recipient_type` (Select: TO/CC/BCC)
   - `custom_original_message_id` (Data)
   - `custom_bcc_processed` (Check)
   - `custom_recipient_index` (Int)
   - `custom_forwarded_to_gmail` (Check)
3. **Expected Result**: All custom fields should exist
4. **If Failed**: Run migration or manually create fields

## Phase 2: Configuration Testing

### Step 2.1: Configure BCC Processing Settings
1. Go to **BCC Processing Settings** DocType
2. Create new document with:
   - **Enable BCC Processing**: ✅ Checked
   - **Gmail Forwarding Account**: `constr.sv@gmail.com`
   - **Processing Method**: `Hook`
   - **Preserve Original Headers**: ✅ Checked
   - **Debug Mode**: ✅ Checked (for testing)
   - **Max Recipients Per Email**: `10`
   - **Forwarding Subject Prefix**: `[BCC-PROCESSED]`
3. **Save** the document
4. **Expected Result**: Settings saved successfully

### Step 2.2: Test Settings Validation
1. Try saving with invalid Gmail format (e.g., "invalid-email")
2. **Expected Result**: Validation error should appear
3. **If Failed**: Check `bcc_processing_settings.py` validation logic

### Step 2.3: Test Email Forwarding Function
1. In BCC Processing Settings, click **Test Email Forwarding** button
2. **Expected Result**: Success message confirming email sent to Gmail account
3. **If Failed**: Check Gmail account accessibility and SMTP settings

### Step 2.4: Test BCC Processing Function
1. In BCC Processing Settings, click **Test BCC Processing** button
2. **Expected Result**: 
   - Success message with test details
   - Shows parsed recipients (TO, CC, BCC)
   - Shows generated unique message-IDs
   - Shows recipient types detected
3. **If Failed**: Check email processor functions

## Phase 3: Email Processing Testing

### Step 3.1: Test Direct Email (Control Test)
1. Send email directly TO a user in the system
2. Check **Communication** list
3. **Expected Result**: Email appears normally with standard message-ID
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
   - Check `custom_recipient_type` field = "CC"
   - Verify `custom_original_message_id` is populated
   - Check `custom_bcc_processed` = 1
4. **Expected Result**: 
   - Email appears in Communication list
   - Message-ID contains recipient hash (format: `<original.{hash}.{index}@domain>`)
   - Custom fields properly populated

### Step 3.3: Test BCC Email Processing
1. **Setup**:
   - Email Account A: Sender  
   - Email Account B: Primary recipient (TO)
   - System User: BCC recipient
2. **Action**: Send email with system user in BCC
3. **Check Results**:
   - Navigate to **Communication** list
   - Look for email entry with `custom_recipient_type` = "BCC"
   - Verify unique message-ID generated
   - Check Gmail account for forwarded email
4. **Expected Result**:
   - Email appears despite being BCC'd
   - Unique message-ID generated with recipient hash
   - Gmail receives forwarded email with `[BCC-PROCESSED-BCC]` subject

### Step 3.4: Test Multiple Recipients
1. **Setup**:
   - Send email TO one system user
   - CC another system user
   - BCC a third system user
2. **Expected Result**:
   - 3 separate Communication entries
   - Each with unique message-ID containing different hashes
   - Proper recipient types: TO, CC, BCC
   - All emails forwarded to Gmail with appropriate prefixes

### Step 3.5: Test Message-ID Generation
1. **Verify Unique Message-IDs**:
   ```sql
   SELECT 
       message_id, 
       custom_original_message_id, 
       custom_recipient_type,
       recipients 
   FROM `tabCommunication` 
   WHERE custom_bcc_processed = 1 
   ORDER BY creation DESC 
   LIMIT 10;
   ```
2. **Expected Result**: Each record has unique message_id but same custom_original_message_id

## Phase 4: Enhanced Inbox Testing

### Step 4.1: Access Enhanced Inbox
1. Navigate to enhanced supervisors email inbox (`custom_html_block/supervisors email inbox/`)
2. Look for "View" dropdown filter
3. **Expected Result**: Dropdown includes "BCC/CC Emails" option (value: `bcc_cc_emails`)

### Step 4.2: Test BCC/CC Filter (Enhanced)
1. Select "BCC/CC Emails" from filter dropdown
2. **Technical Process**: 
   - Calls `forceBCCEnhancedFetching()` function
   - Invokes `svg_mobile_app.email_genius.email_processor.get_processed_emails`
   - Filters emails where `recipient_type = 'BCC' OR recipient_type = 'CC'`
   - Uses `renderEnhancedCommunications()` for display
3. **Expected Result**: 
   - Only CC/BCC emails displayed
   - Orange badges for BCC (`label-warning` class)
   - Blue badges for CC (`label-info` class)
   - Proper recipient type indicators

### Step 4.3: Test Enhanced Email Display
1. View emails in enhanced mode
2. Check for:
   - BCC/CC badges with tooltips
   - Colored borders around email items
   - Proper recipient information display
   - Search highlighting functionality
3. **Expected Result**: Visual indicators clearly distinguish email types

### Step 4.4: Test Fallback Functionality
1. Temporarily disable BCC processing in settings
2. Access enhanced inbox and select "BCC/CC Emails"
3. **Expected Result**: Should fallback to `fetchCommunicationsStandard()` gracefully
4. **Alternative Test**: Simulate API error and verify fallback behavior

### Step 4.5: Test Enhanced Rendering Functions
1. Verify `tryBCCEnhancedFetching()` attempts enhanced fetching first
2. Check `filterEnhancedEmails()` applies additional filters correctly
3. Test search functionality with BCC/CC emails
4. **Expected Result**: All enhanced functions work without errors

## Phase 5: Gmail Integration Testing

### Step 5.1: Check Gmail Account
1. Log into `constr.sv@gmail.com`
2. Look for forwarded emails with subjects:
   - `[BCC-PROCESSED-BCC] Original Subject`
   - `[BCC-PROCESSED-CC] Original Subject`
   - `[BCC-PROCESSED-TO] Original Subject`
3. **Expected Result**: Processed emails appear in Gmail with proper metadata

### Step 5.2: Verify Message-ID Modification
1. Check email headers in Gmail
2. Look for:
   - Modified message-IDs containing recipient hashes
   - `X-Frappe-Original-Message-ID` header
   - `X-Frappe-Recipient-Type` header
   - `X-Frappe-BCC-Processed: true` header
3. **Expected Result**: All custom headers present and accurate

### Step 5.3: Test Gmail Processing Workflow
1. Send test email with multiple recipients
2. Monitor Gmail account for incoming forwarded emails
3. Verify emails are processed back into Frappe correctly
4. **Expected Result**: Complete round-trip processing works

## Phase 6: Error Handling Testing

### Step 6.1: Test Invalid Configuration
1. Set invalid Gmail account in settings
2. Send CC/BCC email
3. **Expected Result**: 
   - Error logged in Frappe error log
   - System continues functioning
   - Fallback to original email processing

### Step 6.2: Test Network Issues
1. Temporarily disable internet connection
2. Send CC/BCC email
3. **Expected Result**: 
   - Error handling prevents system crash
   - Email still processed locally
   - Error logged appropriately

### Step 6.3: Test Large Email Processing
1. Send email with large attachments via CC/BCC
2. **Expected Result**: 
   - System handles without memory issues
   - Content preview limited appropriately
   - Processing completes successfully

### Step 6.4: Test API Error Handling
1. Simulate `get_processed_emails` API failure
2. **Expected Result**: 
   - Graceful fallback to standard communication fetching
   - No UI errors or crashes
   - Appropriate error logging

## Phase 7: Performance Testing

### Step 7.1: Test Multiple Simultaneous Emails
1. Send multiple CC/BCC emails simultaneously
2. Monitor system performance using:
   ```bash
   # Monitor Frappe processes
   bench doctor
   # Check system resources
   htop
   ```
3. **Expected Result**: No significant performance degradation

### Step 7.2: Test High Volume Processing
1. Send 50+ emails with CC/BCC over short period
2. Monitor:
   - Database performance
   - Memory usage
   - Processing time per email
3. **Expected Result**: Acceptable performance maintained

### Step 7.3: Test Enhanced Inbox Performance
1. Load enhanced inbox with 100+ BCC/CC emails
2. Test filtering and search performance
3. **Expected Result**: UI remains responsive

## Phase 8: Integration Testing

### Step 8.1: Test with Different Email Servers
1. Test with Gmail, Outlook, and other IMAP servers
2. **Expected Result**: BCC processing works across different providers

### Step 8.2: Test Email Threading
1. Send reply to BCC'd email
2. Verify threading is maintained
3. **Expected Result**: Email threads remain intact

### Step 8.3: Test with Email Attachments
1. Send BCC email with various attachment types
2. **Expected Result**: Attachments processed correctly

## Troubleshooting Common Issues

### Issue 1: BCC Emails Not Appearing
**Symptoms**: BCC'd emails don't show in Communication list
**Debug Steps**:
1. Check BCC Processing Settings enabled
2. Verify hooks in `hooks.py`
3. Check error logs: `bench logs`
4. Test `intercept_incoming_email` function manually
5. Verify Gmail account accessibility

### Issue 2: Duplicate Emails
**Symptoms**: Same email appears multiple times
**Debug Steps**:
1. Check message-ID generation in database
2. Verify `generate_unique_message_id()` function
3. Check for hook execution conflicts
4. Review `custom_original_message_id` values

### Issue 3: Enhanced Inbox Not Loading
**Symptoms**: Enhanced inbox shows errors or doesn't load
**Debug Steps**:
1. Check browser console for JavaScript errors
2. Verify API endpoint accessibility
3. Test `get_processed_emails` function directly
4. Check user permissions for Communication doctype

### Issue 4: Visual Indicators Missing
**Symptoms**: BCC/CC badges or colors not showing
**Debug Steps**:
1. Verify CSS files loaded: `supvervisors email inbox.css`
2. Check `renderEnhancedCommunications()` function
3. Verify `custom_recipient_type` field values
4. Test enhanced rendering logic

### Issue 5: Gmail Integration Failures
**Symptoms**: Emails not forwarded to Gmail
**Debug Steps**:
1. Test Gmail SMTP settings
2. Check `forward_email_copy()` function
3. Verify Gmail account credentials
4. Review email sending logs

## Advanced Testing Commands

### Test BCC Processing Directly
```javascript
// Run in Frappe Console
frappe.call({
    method: 'svg_mobile_app.email_genius.email_processor.test_bcc_processing',
    callback: function(r) {
        console.log('BCC Processing Test:', r.message);
    }
});
```

### Test Email Forwarding
```javascript
// Run in Frappe Console
frappe.call({
    method: 'svg_mobile_app.svg_mobile_app.doctype.bcc_processing_settings.bcc_processing_settings.test_email_forwarding',
    callback: function(r) {
        console.log('Email Forwarding Test:', r.message);
    }
});
```

### Query BCC Processed Emails
```sql
-- Check recent BCC processed emails
SELECT 
    name,
    subject,
    sender,
    message_id,
    custom_original_message_id,
    custom_recipient_type,
    custom_bcc_processed,
    creation
FROM `tabCommunication` 
WHERE custom_bcc_processed = 1 
ORDER BY creation DESC 
LIMIT 20;
```

### Monitor Email Processing
```bash
# Watch Frappe logs for BCC processing
tail -f logs/worker.error.log | grep -i "email genius"

# Monitor database for new communications
watch -n 5 "mysql -u [user] -p[pass] [db] -e 'SELECT COUNT(*) as total_comms, COUNT(CASE WHEN custom_bcc_processed = 1 THEN 1 END) as bcc_processed FROM tabCommunication;'"
```

## Test Data Cleanup

After testing, clean up test data:
```sql
-- Remove test communications (be careful!)
DELETE FROM `tabCommunication` 
WHERE subject LIKE '%TEST%' 
AND custom_bcc_processed = 1;

-- Reset BCC Processing Settings if needed
UPDATE `tabSingles` 
SET value = '0' 
WHERE doctype = 'BCC Processing Settings' 
AND field = 'debug_mode';
```

## Success Criteria

Testing is successful when:
- ✅ BCC emails appear in Communication list with unique message-IDs
- ✅ CC emails properly processed and displayed with correct indicators
- ✅ Enhanced inbox "BCC/CC Emails" filter works correctly
- ✅ Visual indicators (orange BCC, blue CC badges) display properly
- ✅ Gmail integration forwards emails with correct headers
- ✅ Error handling works gracefully without system crashes
- ✅ Performance remains acceptable under normal load
- ✅ Fallback mechanisms work when enhanced processing fails
- ✅ All custom Communication fields populated correctly
- ✅ No data corruption or system instability

## Reporting Issues

When reporting issues, include:
1. **Steps to reproduce** with exact filter values used
2. **Expected vs actual results** with screenshots
3. **Error messages** from browser console and Frappe logs
4. **System logs** from `bench logs` command
5. **Email headers** for email-specific issues
6. **Database queries** showing Communication records
7. **Screenshots** of enhanced inbox issues
8. **Configuration** of BCC Processing Settings

## Next Steps After Testing

1. **Production Deployment**: If all tests pass, plan production rollout
2. **User Training**: Train users on enhanced inbox features and BCC/CC indicators
3. **Monitoring Setup**: Implement monitoring for BCC processing errors
4. **Documentation**: Update user documentation with new features
5. **Backup**: Create system backup before full deployment
6. **Performance Monitoring**: Set up alerts for email processing performance
7. **Gmail Account Management**: Ensure Gmail account has proper access and storage 
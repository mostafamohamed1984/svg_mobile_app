# Gmail BCC Auto-Forwarder Setup Guide

## Overview
This guide will help you set up the Google Apps Script that automatically forwards BCC-PROCESSED emails from `constr.sv@gmail.com` to the actual CC and BCC recipients, completing your ERPNext BCC processing workflow.

## Prerequisites
- Access to `constr.sv@gmail.com` Gmail account
- Google Apps Script access (script.google.com)
- Admin permissions to create triggers and grant permissions

## Step-by-Step Setup

### 1. Create Google Apps Script Project

1. **Go to Google Apps Script**
   - Visit: https://script.google.com
   - Sign in with the `constr.sv@gmail.com` account

2. **Create New Project**
   - Click "New Project"
   - Name it: "ERPNext BCC Auto-Forwarder"

3. **Paste the Script Code**
   - Delete the default `myFunction()` code
   - Copy and paste the entire content from `gmail_bcc_auto_forwarder.gs`
   - Save the project (Ctrl+S)

### 2. Configure Permissions

1. **Grant Gmail Permissions**
   - Click "Run" on any function (like `testBCCProcessing`)
   - Google will prompt for permissions
   - Click "Review permissions"
   - Choose the `constr.sv@gmail.com` account
   - Click "Allow" to grant Gmail access

2. **Required Permissions**
   The script needs:
   - ✅ Read Gmail messages
   - ✅ Send emails
   - ✅ Modify Gmail labels
   - ✅ Delete/move emails to trash

### 3. Test the Script

1. **Run Test Function**
   - Select `testBCCProcessing` from the function dropdown
   - Click "Run"
   - Check the execution log for results

2. **Expected Test Results**
   ```
   [2025-06-29T...] Running test BCC processing...
   [2025-06-29T...] Starting BCC email processing...
   [2025-06-29T...] Found X threads to process
   [2025-06-29T...] Processing message: [BCC-PROCESSED-CC] [FINAL TEST] BCC Processing with Gmail
   [2025-06-29T...] [DRY RUN] Would forward email to: a.hussein@svec.ae
   [2025-06-29T...] Processing complete. Processed: X, Errors: 0
   ```

3. **Test with FINAL TEST Emails**
   - Run `processSpecificEmails` function
   - This will process your existing FINAL TEST emails
   - Check logs for parsing results

### 4. Configure Production Settings

1. **Edit Configuration**
   - In the script, find the `CONFIG` object
   - Adjust settings as needed:

   ```javascript
   const CONFIG = {
     SEARCH_QUERY: 'subject:[BCC-PROCESSED-CC] OR subject:[BCC-PROCESSED-BCC]',
     MAX_EMAILS_PER_RUN: 20,
     DELETE_AFTER_PROCESSING: true,  // Set to false for testing
     ENABLE_LOGGING: true,
     DRY_RUN: false  // Set to true for testing
   };
   ```

2. **Testing Mode Settings**
   ```javascript
   DELETE_AFTER_PROCESSING: false,  // Keep emails for verification
   DRY_RUN: true,                  // Don't actually send emails
   ENABLE_LOGGING: true            // See detailed logs
   ```

3. **Production Mode Settings**
   ```javascript
   DELETE_AFTER_PROCESSING: true,   // Clean up processed emails
   DRY_RUN: false,                 // Actually send emails
   ENABLE_LOGGING: true            // Keep logging for monitoring
   ```

### 5. Set Up Automatic Trigger

1. **Run Setup Function**
   - Select `setupTrigger` from the function dropdown
   - Click "Run"
   - This creates a time-based trigger to run every 5 minutes

2. **Verify Trigger Creation**
   - Go to "Triggers" in the left sidebar
   - You should see a trigger for `processBCCEmails`
   - Frequency: Every 5 minutes

3. **Alternative Trigger Setup (Manual)**
   - Click "Triggers" in left sidebar
   - Click "+ Add Trigger"
   - Choose function: `processBCCEmails`
   - Event source: "Time-driven"
   - Type: "Minutes timer"
   - Interval: "Every 5 minutes"
   - Save

### 6. Test End-to-End Workflow

1. **Send Test Email in ERPNext**
   - Create an email with CC and BCC recipients
   - Use real email addresses you can access

2. **Monitor Gmail Processing**
   - Check `constr.sv@gmail.com` for incoming BCC-PROCESSED emails
   - Wait 5-10 minutes for the trigger to run

3. **Verify Forwarding**
   - Check if CC and BCC recipients received the emails
   - Verify the subjects are clean (no [BCC-PROCESSED-*] prefix)
   - Check that Gmail processed emails are deleted/labeled

### 7. Monitor and Troubleshoot

1. **Check Execution Logs**
   - Go to "Executions" in Apps Script
   - View logs for each trigger run
   - Look for errors or processing details

2. **Common Issues and Solutions**

   **Issue: No emails found**
   ```
   Solution: Check Gmail search query, verify BCC-PROCESSED emails exist
   ```

   **Issue: Permission denied**
   ```
   Solution: Re-run authorization, ensure correct Gmail account
   ```

   **Issue: Emails not forwarded**
   ```
   Solution: Check DRY_RUN setting, verify recipient email parsing
   ```

   **Issue: Trigger not running**
   ```
   Solution: Recreate trigger, check Apps Script quotas
   ```

### 8. Production Deployment

1. **Final Configuration Check**
   ```javascript
   const CONFIG = {
     SEARCH_QUERY: 'subject:[BCC-PROCESSED-CC] OR subject:[BCC-PROCESSED-BCC]',
     MAX_EMAILS_PER_RUN: 20,
     DELETE_AFTER_PROCESSING: true,
     ENABLE_LOGGING: true,
     DRY_RUN: false  // ← Make sure this is false
   };
   ```

2. **Test with Real Recipients**
   - Send test emails to actual CC/BCC recipients
   - Verify they receive clean, properly formatted emails
   - Confirm Gmail cleanup is working

3. **Monitor Performance**
   - Check execution time (should be under 6 minutes)
   - Monitor daily email processing volume
   - Watch for any quota limit warnings

## Advanced Features

### Custom Search Queries
You can modify the search query to process specific emails:

```javascript
// Process only recent emails
SEARCH_QUERY: 'subject:[BCC-PROCESSED-CC] OR subject:[BCC-PROCESSED-BCC] newer_than:1d',

// Process specific subjects
SEARCH_QUERY: 'subject:[BCC-PROCESSED-CC] OR subject:[BCC-PROCESSED-BCC] "URGENT"',
```

### Email Labeling
Instead of deleting, you can label processed emails:

```javascript
DELETE_AFTER_PROCESSING: false,
PROCESSED_LABEL: 'BCC-Forwarded',
```

### Batch Processing
For high-volume systems, adjust batch size:

```javascript
MAX_EMAILS_PER_RUN: 50,  // Process more emails per run
```

## Monitoring Dashboard

### Key Metrics to Track
1. **Processing Rate**: Emails processed per trigger run
2. **Error Rate**: Failed forwarding attempts
3. **Latency**: Time from Gmail receipt to forwarding
4. **Volume**: Daily BCC email processing count

### Logging Analysis
Check logs for patterns like:
- `Successfully forwarded email to: user@domain.com`
- `Processing complete. Processed: X, Errors: Y`
- `Skipping TO recipient: user@domain.com`

## Security Considerations

1. **Account Access**: Only authorized personnel should have access to the Gmail account
2. **Script Permissions**: Regularly review granted permissions
3. **Email Content**: The script processes email metadata, not sensitive content
4. **Audit Trail**: All forwarding actions are logged

## Backup and Recovery

1. **Script Backup**: Export the Apps Script code regularly
2. **Configuration Backup**: Document all CONFIG settings
3. **Trigger Backup**: Document trigger settings for easy recreation

## Success Criteria

✅ **Gmail receives BCC-PROCESSED emails**
✅ **Script parses recipient information correctly**
✅ **CC/BCC recipients receive forwarded emails**
✅ **Email subjects are cleaned (no BCC-PROCESSED prefix)**
✅ **Gmail inbox stays clean (processed emails deleted/labeled)**
✅ **Trigger runs automatically every 5 minutes**
✅ **No errors in execution logs**
✅ **End-to-end workflow completes successfully**

## Next Steps

After successful setup:
1. Monitor the system for 24-48 hours
2. Test with various email types (plain text, HTML, attachments)
3. Verify integration with ERPNext supervisors email inbox
4. Document any custom configurations for your environment
5. Train users on the new BCC/CC email visibility features

## Support and Maintenance

- **Monthly Review**: Check execution logs and performance
- **Quarterly Testing**: Send test emails to verify functionality
- **Annual Audit**: Review permissions and security settings
- **Updates**: Monitor for Google Apps Script platform changes 
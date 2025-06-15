# Google Drive Integration with ERPNext - Complete Setup Guide

## Table of Contents
- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Step 1: Google Cloud Project Setup](#step-1-google-cloud-project-setup)
- [Step 2: OAuth Consent Screen Configuration](#step-2-oauth-consent-screen-configuration)
- [Step 3: Create OAuth Credentials](#step-3-create-oauth-credentials)
- [Step 4: ERPNext Configuration](#step-4-erpnext-configuration)
- [Step 5: Google Drive Settings](#step-5-google-drive-settings)
- [Step 6: Authorization and Testing](#step-6-authorization-and-testing)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)
- [Advanced Configuration](#advanced-configuration)

## Overview

This guide provides a comprehensive walkthrough for integrating Google Drive with ERPNext to enable automatic backup functionality. The integration uses OAuth 2.0 authentication to securely connect your ERPNext instance with your Google Drive account.

### What This Integration Provides
- **Automatic ERPNext backups** to Google Drive
- **Secure OAuth 2.0 authentication**
- **Scheduled backup management**
- **File organization** in Google Drive folders
- **Backup retention policies**

### Integration Benefits
- **Data Security**: Offsite backup storage
- **Automation**: Scheduled backups without manual intervention
- **Accessibility**: Access backups from anywhere
- **Reliability**: Google's robust cloud infrastructure

## Prerequisites

Before starting, ensure you have:
- **ERPNext instance** with administrator access
- **Google account** (preferably Google Workspace for production)
- **System Manager** role in ERPNext
- **Internet connectivity** from ERPNext server
- **Valid domain** for ERPNext (required for OAuth)

## Step 1: Google Cloud Project Setup

### 1.1 Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **"Select a project"** → **"New Project"**
3. Enter project details:
   - **Project Name**: `ERPNext Integration` (or your preferred name)
   - **Organization**: Select your organization (if applicable)
   - **Location**: Choose appropriate location
4. Click **"Create"**
5. Wait for project creation to complete

### 1.2 Enable Google Drive API

1. In the Google Cloud Console, ensure your new project is selected
2. Navigate to **"APIs & Services"** → **"Library"**
3. Search for **"Google Drive API"**
4. Click on **"Google Drive API"** from the results
5. Click **"Enable"** button
6. Wait for the API to be enabled

### 1.3 Enable Additional APIs (Optional but Recommended)

For enhanced functionality, also enable:
- **Google Sheets API** (for spreadsheet backups)
- **Google Calendar API** (for backup scheduling notifications)

## Step 2: OAuth Consent Screen Configuration

### 2.1 Configure Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Choose **User Type**:
   - **Internal**: For Google Workspace organizations only
   - **External**: For general use (recommended for most cases)
3. Click **"Create"**

### 2.2 Fill OAuth Consent Screen Details

**App Information:**
```
App name: ERPNext Backup Integration
User support email: your-email@domain.com
App logo: (Optional - upload your company logo)
```

**App Domain:**
```
Application home page: https://your-erpnext-domain.com
Application privacy policy: https://your-erpnext-domain.com/privacy
Application terms of service: https://your-erpnext-domain.com/terms
```

**Authorized Domains:**
```
your-erpnext-domain.com
```

**Developer Contact Information:**
```
Email addresses: your-email@domain.com
```

4. Click **"Save and Continue"**

### 2.3 Configure Scopes

1. Click **"Add or Remove Scopes"**
2. Add the following scopes:
   ```
   https://www.googleapis.com/auth/drive.file
   https://www.googleapis.com/auth/drive.metadata.readonly
   ```
3. Click **"Update"**
4. Click **"Save and Continue"**

### 2.4 Add Test Users (for External Apps)

If you selected "External" user type:
1. Click **"Add Users"**
2. Add email addresses that will test the integration:
   ```
   your-email@domain.com
   admin@your-domain.com
   ```
3. Click **"Save and Continue"**

### 2.5 Publish Your App (Recommended)

For production use:
1. Click **"Publish App"** to make it available to all users
2. This eliminates the need to add individual test users
3. Wait 5-10 minutes for changes to propagate

## Step 3: Create OAuth Credentials

### 3.1 Create OAuth 2.0 Client ID

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth 2.0 Client IDs"**
3. Select **Application Type**: **"Web application"**
4. Enter **Name**: `ERPNext Google Drive Integration`

### 3.2 Configure Authorized URLs

**Authorized JavaScript Origins:**
```
https://your-erpnext-domain.com
```

**⚠️ IMPORTANT - Updated Redirect URI:**

**Authorized Redirect URIs:**
```
https://your-erpnext-domain.com/api/method/frappe.integrations.google_oauth.callback
```

> **Note**: ERPNext now uses a unified OAuth callback system. The old specific Google Drive callback (`erpnext.setup.doctype.google_drive_settings.google_drive_settings.google_callback`) is no longer used in recent versions.

⚠️ **Important**: Replace `your-erpnext-domain.com` with your actual ERPNext domain

### 3.3 Download Credentials

1. Click **"Create"**
2. **Download the JSON file** containing your credentials
3. **Save the Client ID and Client Secret** - you'll need these for ERPNext configuration

Example credentials format:
```json
{
  "client_id": "123456789-abcdefghijklmnop.apps.googleusercontent.com",
  "client_secret": "GOCSPX-abcdefghijklmnopqrstuvwxyz"
}
```

## Step 4: ERPNext Configuration

### 4.1 Configure site_config.json (CRITICAL STEP)

**⚠️ This step is essential to prevent redirect_uri_mismatch errors:**

1. **Access your ERPNext server**
2. **Navigate to your site's directory**:
   ```bash
   cd /path/to/frappe-bench/sites/your-site-name/
   ```
3. **Edit site_config.json**:
   ```bash
   sudo nano site_config.json
   ```
4. **Add the host_name setting**:
   ```json
   {
     "db_name": "your_db_name",
     "db_password": "your_password",
     "host_name": "https://your-erpnext-domain.com",
     // ... other existing settings
   }
   ```
5. **Save the file**
6. **Restart ERPNext services**:
   ```bash
   bench restart
   ```
   or
   ```bash
   sudo supervisorctl restart all
   ```

> **Why this is important**: Without the `host_name` setting, ERPNext may send incorrect redirect URIs (with ports or HTTP instead of HTTPS) that don't match your Google Cloud Console configuration.

### 4.2 Access Google Settings

1. Log into your ERPNext instance as **System Manager**
2. Go to **"Setup"** → **"Integrations"** → **"Google Settings"**
3. If not available, search for **"Google Settings"** in the awesome bar

### 4.3 Configure Google Settings

Fill in the following fields:

```
Client ID: [Your Google OAuth Client ID]
Client Secret: [Your Google OAuth Client Secret]
```

**Example:**
```
Client ID: 123456789-abcdefghijklmnop.apps.googleusercontent.com
Client Secret: GOCSPX-abcdefghijklmnopqrstuvwxyz
```

3. Click **"Save"**

### 4.4 Verify Configuration

After saving, you should see:
- ✅ **Status**: Configuration saved successfully
- 🔗 **Authorization URL**: Available for next step

## Step 5: Google Drive Settings

### 5.1 Access Google Drive Settings

1. Go to **"Setup"** → **"Integrations"** → **"Google Drive Settings"**
2. Or search for **"Google Drive Settings"** in the awesome bar

### 5.2 Configure Backup Settings

**Basic Configuration:**
```
Enable: ✓ (Check this box)
Backup Frequency: Daily (or your preferred frequency)
Backup Time: 02:00 (or your preferred time)
```

**Advanced Settings:**
```
Backup Folder Name: ERPNext_Backups
File Backup: ✓ (Include files in backup)
Database Backup: ✓ (Include database in backup)
```

**Retention Policy:**
```
Keep Backups For: 30 days (or your preferred retention period)
Maximum Backups: 10 (or your preferred limit)
```

### 5.3 Save Configuration

1. Click **"Save"**
2. The system will validate your settings

## Step 6: Authorization and Testing

### 6.1 Authorize Google Drive Access

1. In **Google Drive Settings**, click **"Authorize Google Drive Access"**
2. You'll be redirected to Google's authorization page
3. **Sign in** with the Google account you want to use for backups
4. **Review permissions** that ERPNext is requesting:
   - View and manage Google Drive files created by this app
   - View metadata for files in your Google Drive
5. Click **"Allow"** to grant permissions
6. You'll be redirected back to ERPNext

### 6.2 Verify Authorization

After successful authorization, you should see:
- ✅ **Status**: Authorized
- 📧 **Authorized Email**: The Google account email
- 📅 **Authorization Date**: Current date and time

### 6.3 Test Backup Functionality

1. In **Google Drive Settings**, click **"Take Backup Now"**
2. Monitor the process:
   - Check **"Background Jobs"** for backup status
   - Look for success/error messages
3. Verify in Google Drive:
   - Go to your Google Drive
   - Look for the **ERPNext_Backups** folder
   - Confirm backup files are present

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: "redirect_uri_mismatch" Error

**Error Message:**
```
Error 400: redirect_uri_mismatch
```

**Most Common Cause**: Missing or incorrect `host_name` in `site_config.json`

**Solution:**
1. **Add `host_name` to site_config.json** (see Step 4.1 above)
2. **Use the correct redirect URI** in Google Cloud Console:
   ```
   https://your-erpnext-domain.com/api/method/frappe.integrations.google_oauth.callback
   ```
3. **Ensure exact match** - no trailing slashes, correct protocol (HTTPS)
4. **Restart ERPNext services** after making changes

**Additional Checks:**
- Verify there are no typos in the redirect URI
- Ensure you're using HTTPS (not HTTP)
- Check that the domain matches exactly

#### Issue 2: "Access Denied" During Authorization (Error 403)

**Error Message:**
```
Error 403: access_denied
smartvgroup.com has not completed the Google verification process
```

**Possible Causes:**
- OAuth consent screen not properly configured
- App is in testing mode and user not added to test users
- App needs to be published to production

**Solution:**
1. **Publish your app to production** in OAuth consent screen
2. **Wait 5-10 minutes** for changes to propagate
3. **Add test users** if keeping app in testing mode
4. **Verify OAuth consent screen** configuration is complete

#### Issue 3: Backup Fails with "Permission Denied"

**Solution:**
1. Re-authorize Google Drive access
2. Check if the Google account has sufficient Drive storage
3. Verify API quotas in Google Cloud Console

#### Issue 4: "Invalid Client" Error

**Solution:**
1. Verify Client ID and Client Secret are correct
2. Ensure no extra spaces in the credentials
3. Check if the OAuth client is properly configured

#### Issue 5: Scheduled Backups Not Running

**Solution:**
1. Check ERPNext scheduler status:
   ```bash
   bench doctor
   ```
2. Verify cron jobs are running:
   ```bash
   crontab -l
   ```
3. Check background job logs for errors

### Debug Mode

To enable detailed logging:

1. Go to **"System Settings"**
2. Enable **"Developer Mode"**
3. Check logs in:
   - **Error Log** doctype
   - Server logs (`/path/to/frappe-bench/logs/`)

## Best Practices

### Security Recommendations

1. **Use Dedicated Google Account**
   - Create a separate Google account for ERPNext backups
   - Don't use personal Google accounts for production

2. **Regular Access Review**
   - Periodically review authorized applications in Google Account
   - Revoke access for unused integrations

3. **Monitor Backup Status**
   - Set up notifications for backup failures
   - Regularly verify backup integrity

### Performance Optimization

1. **Backup Timing**
   - Schedule backups during low-traffic hours
   - Avoid peak business hours

2. **File Size Management**
   - Implement file cleanup policies
   - Monitor Google Drive storage usage

3. **Network Considerations**
   - Ensure stable internet connection
   - Consider bandwidth limitations

### Maintenance Tasks

1. **Regular Testing**
   - Test backup restoration process monthly
   - Verify backup file integrity

2. **Credential Management**
   - Rotate OAuth credentials annually
   - Keep backup of configuration settings

3. **Monitoring**
   - Set up alerts for backup failures
   - Monitor Google Drive storage usage

## Advanced Configuration

### Custom Backup Folders

To organize backups by date or site:

```python
# Custom backup folder structure
backup_folder_name = f"ERPNext_Backups/{site_name}/{datetime.now().strftime('%Y/%m')}"
```

### Multiple Site Configuration

For multi-tenant ERPNext:

1. Create separate Google projects for each site
2. Configure individual Google Drive settings
3. Use site-specific backup folders

### API Quota Management

Monitor and manage API quotas:

1. Go to **Google Cloud Console** → **"APIs & Services"** → **"Quotas"**
2. Monitor **Google Drive API** usage
3. Request quota increases if needed

### Webhook Notifications

Set up webhooks for backup status:

```python
# Example webhook configuration
webhook_url = "https://your-monitoring-system.com/webhook"
backup_status_webhook = True
```

## Additional Resources

### Official Documentation
- [Google Drive API Documentation](https://developers.google.com/drive/api)
- [ERPNext Integration Guide](https://docs.erpnext.com/docs/user/manual/en/setting-up/integrations)
- [OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)

### Useful Tools
- [Google API Explorer](https://developers.google.com/apis-explorer)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
- [Google Cloud Console](https://console.cloud.google.com)

### Community Resources
- [ERPNext Community Forum](https://discuss.erpnext.com)
- [Frappe Framework Documentation](https://frappeframework.com/docs)

---

## Quick Reference

### Essential URLs
```
Google Cloud Console: https://console.cloud.google.com
OAuth Consent Screen: https://console.cloud.google.com/apis/credentials/consent
API Library: https://console.cloud.google.com/apis/library
Credentials: https://console.cloud.google.com/apis/credentials
```

### Required Scopes
```
https://www.googleapis.com/auth/drive.file
https://www.googleapis.com/auth/drive.metadata.readonly
```

### Current Redirect URI Format (Updated)
```
https://your-erpnext-domain.com/api/method/frappe.integrations.google_oauth.callback
```

### Critical Configuration: site_config.json
```json
{
  "host_name": "https://your-erpnext-domain.com"
}
```

### Common Commands
```bash
# Check ERPNext scheduler
bench doctor

# View background jobs
bench console
>>> frappe.get_all("Background Job")

# Manual backup
bench backup --with-files

# Check logs
tail -f logs/worker.error.log

# Restart services
bench restart
# or
sudo supervisorctl restart all
```

---

*Last Updated: December 2024*
*This guide covers ERPNext v13+ and includes the latest OAuth callback changes and troubleshooting solutions.* 
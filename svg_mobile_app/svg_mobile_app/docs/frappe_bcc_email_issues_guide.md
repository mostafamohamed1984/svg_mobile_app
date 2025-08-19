# Frappe/ERPNext BCC Email Issues - Comprehensive Guide

## Table of Contents
- [Overview](#overview)
- [The Core Problem](#the-core-problem)
- [Technical Root Causes](#technical-root-causes)
- [Frappe-Specific Issues](#frappe-specific-issues)
- [Why This Happens](#why-this-happens)
- [Solutions and Workarounds](#solutions-and-workarounds)
- [Recommended Actions](#recommended-actions)
- [Additional Resources](#additional-resources)

## Overview

This document provides a comprehensive analysis of BCC (Blind Carbon Copy) email handling issues in Frappe/ERPNext systems. The problem manifests as BCC'd emails not appearing in custom email inbox views, even though they are properly received by the intended recipients.

**Affected Versions:** All versions, with issues documented since 2018
**Impact:** BCC recipients don't see emails in Frappe email inbox interface
**Severity:** High for organizations relying on BCC for internal communications

## The Core Problem

### Issue Description
- Emails sent with BCC recipients are not displayed in Frappe's email inbox interface
- Only emails where users are direct recipients (TO) or CC'd recipients appear
- BCC'd users receive the emails in their external email clients but not in Frappe

### Symptoms
- Missing emails in Frappe email inbox for BCC recipients
- Inconsistent email visibility across different users
- Emails appear in external email clients but not in Frappe interface

## Technical Root Causes

### 1. BCC Protocol Fundamentals
BCC (Blind Carbon Copy) works by design to hide recipients:
- **BCC recipients are intentionally invisible** in standard email headers
- BCC information is either:
  - Stored in special non-standard headers (server-dependent)
  - Completely stripped during email transmission
  - Only preserved in sender's "Sent" folder

### 2. IMAP Protocol Limitations
- IMAP servers handle BCC information inconsistently
- Many servers strip BCC headers for security/privacy
- Different email providers implement BCC preservation differently

## Frappe-Specific Issues

### A. Message-ID Deduplication Problem
**Root Cause:** Frappe uses `message-id` as primary key for emails

```python
# Problem in frappe/email/receive.py
# Same message-id for all recipients of the same email
# Results in only one email entry instead of per-recipient entries
```

**Impact:**
- Same email sent to multiple recipients creates only one database entry
- Subsequent recipients' copies are ignored due to duplicate message-id
- Referenced in [GitHub Issue #19370](https://github.com/frappe/erpnext/issues/33386)

### B. IMAP Implementation Issues
**Known Problems:**
- Emails incorrectly marked as read
- Sent folder synchronization failures
- BCC information not preserved during IMAP sync
- Server-specific compatibility issues

**Error Examples:**
```
TypeError: argument of type 'int' is not iterable
TypeError: object of type 'EmailPolicy' has no len()
```

### C. Email Server Compatibility Matrix

| Email Provider | BCC Support | Sent Folder Sync | Overall Rating |
|---------------|-------------|------------------|----------------|
| Google/Gmail  | ✅ Good     | ✅ Works        | ⭐⭐⭐⭐⭐     |
| Zoho Mail     | ✅ Good     | ✅ Works        | ⭐⭐⭐⭐       |
| Exchange/Outlook | ❌ Poor   | ❌ Issues       | ⭐⭐           |
| Hetzner       | ❌ Poor     | ❌ Issues       | ⭐⭐           |
| Other IMAP    | ⚠️ Variable | ⚠️ Variable     | ⭐⭐⭐         |

## Why This Happens

### 1. Email Header Processing
Frappe's email processing logic in `receive.py`:
- Focuses on standard headers (TO, CC, FROM)
- Doesn't properly parse BCC-related headers
- Limited handling of server-specific BCC implementations

### 2. Database Design Limitations
- One-to-one relationship between message-id and email record
- No support for multiple recipient entries per email
- Missing BCC recipient tracking

### 3. IMAP Client Implementation
- Doesn't account for BCC header variations across servers
- Limited error handling for malformed BCC headers
- Inconsistent folder synchronization

## Solutions and Workarounds

### 1. Immediate Workarounds

#### A. Email Provider Migration
**Recommended:** Switch to compatible providers
```bash
# Best options (in order of compatibility):
1. Google Workspace (Gmail)
2. Zoho Mail
3. Other Google-compatible IMAP providers
```

#### B. Email Forwarding Rules
Set up server-side forwarding:
```
1. Create dedicated Frappe email accounts
2. Set up forwarding rules for BCC emails
3. Configure Frappe to monitor forwarded accounts
```

#### C. Use CC Instead of BCC
**Trade-off:** Visibility vs. Privacy
- Replace BCC with CC for internal communications
- Ensures all recipients appear in email headers
- Sacrifices privacy for functionality

### 2. Technical Solutions

#### A. Custom Email Processing
Modify Frappe's email handling:

**File:** `frappe/email/receive.py`
```python
# Required modifications:
1. Update message-id handling to include recipient info
2. Implement BCC header parsing
3. Create multiple email entries for same message-id
```

**File:** `frappe/email/doctype/email_account/email_account.py`
```python
# Required modifications:
1. Update email filtering logic
2. Add BCC recipient detection
3. Implement proper error handling
```

#### B. Database Schema Changes
```sql
-- Add BCC tracking table
CREATE TABLE `tabEmail BCC Recipients` (
    `name` varchar(140) NOT NULL,
    `parent` varchar(140) NOT NULL,
    `email` varchar(140) NOT NULL,
    `user` varchar(140) DEFAULT NULL
);
```

#### C. Custom Frappe App
Develop dedicated email handling app:
```python
# frappe_email_enhanced/
# ├── email_enhanced/
# │   ├── doctype/
# │   │   └── enhanced_email/
# │   └── api/
# │       └── email_processor.py
```

### 3. Configuration Optimizations

#### A. Email Domain Settings
```json
{
    "email_server": "imap.gmail.com",
    "port": 993,
    "use_ssl": true,
    "append_emails_to_sent_folder": true,
    "sent_folder_name": "Sent"
}
```

#### B. Email Account Settings
```json
{
    "enable_incoming": true,
    "enable_outgoing": true,
    "use_imap": true,
    "email_sync_option": "UNSEEN",
    "attachment_limit": 25
}
```

## Recommended Actions

### Phase 1: Assessment (1-2 days)
1. **Document Current Setup**
   - Email server type and configuration
   - Frappe/ERPNext version
   - Current email account settings

2. **Test with Gmail/Zoho**
   - Create test accounts
   - Verify BCC functionality
   - Compare with current setup

### Phase 2: Quick Fixes (1 week)
1. **Email Provider Migration** (if feasible)
   - Migrate to Google Workspace or Zoho
   - Update DNS records
   - Test all email functionality

2. **Implement Workarounds**
   - Set up email forwarding rules
   - Create dedicated monitoring accounts
   - Update user procedures

### Phase 3: Long-term Solutions (2-4 weeks)
1. **Custom Development**
   - Modify Frappe email processing
   - Implement BCC tracking
   - Add proper error handling

2. **Testing and Deployment**
   - Comprehensive testing with different email scenarios
   - User training and documentation
   - Production deployment

## Monitoring and Maintenance

### Key Metrics to Track
- Email delivery success rate
- BCC visibility percentage
- IMAP synchronization errors
- User satisfaction with email functionality

### Regular Maintenance Tasks
- Monitor error logs for email-related issues
- Test BCC functionality monthly
- Keep Frappe updated for email improvements
- Review email server compatibility

## Additional Resources

### Official Documentation
- [Frappe Email Documentation](https://docs.frappe.io/erpnext/user/manual/en/email-inbox)
- [ERPNext Email Setup Guide](https://erpnext.org/docs/user/manual/en/setting-up/email)

### Community Resources
- [Frappe Forum - Email Issues](https://discuss.frappe.io/c/erpnext/email)
- [GitHub Issues - Email Related](https://github.com/frappe/frappe/issues?q=is%3Aissue+email)

### Related GitHub Issues
- [IMAP/POP3 sync to one account only #19370](https://github.com/frappe/erpnext/issues/33386)
- [Email Inbox Issues Discussion](https://discuss.frappe.io/t/issues-with-email-inbox/37792)
- [IMAP Email Problems](https://discuss.frappe.io/t/email-imap-not-working-as-intended/101033)

### Technical References
- [IMAP RFC 3501](https://tools.ietf.org/html/rfc3501)
- [Email Header Standards](https://tools.ietf.org/html/rfc5322)
- [BCC Implementation Best Practices](https://tools.ietf.org/html/rfc5321)

---

**Document Version:** 1.0  
**Last Updated:** June 2025  
**Author:** Technical Documentation Team  
**Status:** Active

> **Note:** This is a known limitation in Frappe's email system affecting many users since 2018. The problem is particularly pronounced with non-Google email servers and affects organizations relying on BCC for internal communications. 
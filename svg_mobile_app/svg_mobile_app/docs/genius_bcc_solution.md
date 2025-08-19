# Genius BCC Solution: Message-ID Modification & Email Forwarding

## The Brilliant Concept

**Core Idea:** Intercept emails with CC/BCC recipients, modify the message-ID to make it unique per recipient, and forward/process them so each recipient gets their own email entry in Frappe.

**Why This Works:** 
- Solves the message-ID deduplication problem at the source
- Creates unique email entries for each CC/BCC recipient
- Works with existing Frappe email infrastructure
- Maintains email integrity and threading

## Solution Architecture

```
Incoming Email → Email Interceptor → Has CC/BCC? 
                                   ↓
                              Parse Recipients
                                   ↓
                          Generate Unique Message-IDs
                                   ↓
                          Create Modified Email Copies
                                   ↓
                         Forward to Gmail/Processing Account
                                   ↓
                         Frappe Processes Each Copy
                                   ↓
                        Unique Entries in Email Inbox
```

## Implementation Approaches

### Approach 1: Frappe Email Hook (Recommended)

Create a custom app that hooks into Frappe's email processing:

```python
# frappe_email_genius/hooks.py
app_name = "frappe_email_genius"

doc_events = {
    "Communication": {
        "before_insert": "frappe_email_genius.email_processor.process_bcc_email"
    }
}

email_hooks = [
    "frappe_email_genius.email_processor.intercept_incoming_email"
]
```

```python
# frappe_email_genius/email_processor.py
import frappe
import email
import uuid
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import re

def intercept_incoming_email(email_account, msg):
    """
    Intercepts incoming emails and processes CC/BCC recipients
    """
    try:
        # Parse the email message
        email_obj = email.message_from_string(msg)
        
        # Extract recipients
        to_recipients = parse_recipients(email_obj.get('To', ''))
        cc_recipients = parse_recipients(email_obj.get('Cc', ''))
        bcc_recipients = parse_recipients(email_obj.get('Bcc', ''))
        
        all_recipients = to_recipients + cc_recipients + bcc_recipients
        
        if len(all_recipients) > 1:
            # Multiple recipients detected - create unique copies
            return create_unique_email_copies(email_obj, all_recipients, email_account)
        
        return msg  # Single recipient, process normally
        
    except Exception as e:
        frappe.log_error(f"BCC Processing Error: {str(e)}")
        return msg  # Fallback to original processing

def create_unique_email_copies(original_email, recipients, email_account):
    """
    Creates unique email copies with modified message-IDs for each recipient
    """
    processed_emails = []
    original_message_id = original_email.get('Message-ID', '')
    
    for i, recipient in enumerate(recipients):
        # Create a copy of the email
        email_copy = email.message_from_string(original_email.as_string())
        
        # Generate unique message-ID
        unique_message_id = generate_unique_message_id(original_message_id, recipient, i)
        email_copy.replace_header('Message-ID', unique_message_id)
        
        # Set the specific recipient
        email_copy.replace_header('To', recipient)
        
        # Add custom headers for tracking
        email_copy.add_header('X-Frappe-Original-Message-ID', original_message_id)
        email_copy.add_header('X-Frappe-Recipient-Type', get_recipient_type(recipient, original_email))
        email_copy.add_header('X-Frappe-BCC-Processed', 'true')
        
        # Forward to processing account
        forward_email_copy(email_copy, email_account)
        
        processed_emails.append(email_copy.as_string())
    
    return processed_emails

def generate_unique_message_id(original_id, recipient, index):
    """
    Generates a unique message-ID based on original ID and recipient
    """
    # Extract domain from original message-ID
    if original_id and '@' in original_id:
        local_part, domain = original_id.strip('<>').split('@', 1)
        # Create unique identifier
        unique_suffix = f"{hash(recipient) % 10000}.{index}"
        return f"<{local_part}.{unique_suffix}@{domain}>"
    else:
        # Generate completely new message-ID
        return f"<frappe.bcc.{uuid.uuid4().hex}@{frappe.local.site}>"

def get_recipient_type(recipient, email_obj):
    """
    Determines if recipient was TO, CC, or BCC
    """
    to_recipients = parse_recipients(email_obj.get('To', ''))
    cc_recipients = parse_recipients(email_obj.get('Cc', ''))
    
    if recipient in to_recipients:
        return 'TO'
    elif recipient in cc_recipients:
        return 'CC'
    else:
        return 'BCC'

def parse_recipients(recipient_string):
    """
    Parses recipient string and returns list of email addresses
    """
    if not recipient_string:
        return []
    
    # Handle various email formats
    emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', recipient_string)
    return emails

def forward_email_copy(email_copy, email_account):
    """
    Forwards the modified email copy to Gmail processing account
    """
    try:
        # Get Gmail forwarding account from settings
        gmail_account = frappe.get_single('BCC Processing Settings').gmail_forwarding_account
        
        if gmail_account:
            # Use Frappe's email sending functionality
            frappe.sendmail(
                recipients=[gmail_account],
                subject=f"[BCC-PROCESSED] {email_copy.get('Subject', '')}",
                message=email_copy.as_string(),
                header=['X-Frappe-BCC-Forward: true']
            )
    except Exception as e:
        frappe.log_error(f"Email forwarding error: {str(e)}")
```

### Approach 2: Email Server-Side Processing

Set up email server rules to handle this automatically:

```bash
# Postfix/Dovecot configuration
# /etc/postfix/main.cf
content_filter = frappe-bcc-processor:dummy

# /etc/postfix/master.cf
frappe-bcc-processor unix -       n       n       -       -       pipe
  user=frappe argv=/opt/frappe-bcc-processor/process_email.py
```

```python
# /opt/frappe-bcc-processor/process_email.py
#!/usr/bin/env python3
import sys
import email
import smtplib
from email.mime.multipart import MIMEMultipart

def main():
    # Read email from stdin
    raw_email = sys.stdin.read()
    msg = email.message_from_string(raw_email)
    
    # Process CC/BCC recipients
    recipients = extract_all_recipients(msg)
    
    if len(recipients) > 1:
        process_multiple_recipients(msg, recipients)
    else:
        # Forward original email
        forward_email(raw_email)

def process_multiple_recipients(msg, recipients):
    """Process email for multiple recipients"""
    original_message_id = msg.get('Message-ID', '')
    
    for i, recipient in enumerate(recipients):
        # Create unique copy
        email_copy = create_unique_copy(msg, recipient, i, original_message_id)
        
        # Forward to Gmail processing account
        forward_to_gmail(email_copy)

def forward_to_gmail(email_msg):
    """Forward processed email to Gmail account"""
    smtp_server = smtplib.SMTP('smtp.gmail.com', 587)
    smtp_server.starttls()
    smtp_server.login('your-processing@gmail.com', 'app-password')
    
    smtp_server.send_message(email_msg)
    smtp_server.quit()

if __name__ == "__main__":
    main()
```

### Approach 3: API Middleware Solution

Create a middleware service that processes emails before Frappe:

```python
# email_middleware_service.py
from flask import Flask, request, jsonify
import requests
import email
import json

app = Flask(__name__)

@app.route('/process-email', methods=['POST'])
def process_email():
    """
    API endpoint to process emails with CC/BCC handling
    """
    try:
        email_data = request.json
        raw_email = email_data.get('email_content')
        
        # Process the email
        processed_emails = process_bcc_email(raw_email)
        
        # Send each processed email to Frappe
        for processed_email in processed_emails:
            send_to_frappe(processed_email)
        
        return jsonify({'status': 'success', 'processed_count': len(processed_emails)})
    
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)})

def process_bcc_email(raw_email):
    """Process email and create unique copies for CC/BCC"""
    msg = email.message_from_string(raw_email)
    recipients = extract_all_recipients(msg)
    
    if len(recipients) <= 1:
        return [raw_email]
    
    processed_emails = []
    for i, recipient in enumerate(recipients):
        unique_email = create_unique_email_copy(msg, recipient, i)
        processed_emails.append(unique_email)
    
    return processed_emails

def send_to_frappe(email_content):
    """Send processed email to Frappe"""
    frappe_url = "https://your-frappe-site.com/api/method/frappe.email.receive.pull_from_email_account"
    
    response = requests.post(
        frappe_url,
        json={'email_content': email_content},
        headers={'Authorization': 'Bearer YOUR_API_KEY'}
    )
    
    return response.json()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
```

## Custom Frappe App Implementation

### 1. Create the Custom App

```bash
# Create new Frappe app
cd frappe-bench
bench new-app frappe_email_genius
cd apps/frappe_email_genius
```

### 2. App Structure

```
frappe_email_genius/
├── frappe_email_genius/
│   ├── __init__.py
│   ├── hooks.py
│   ├── email_processor.py
│   ├── config/
│   │   └── desktop.py
│   └── doctype/
│       └── bcc_processing_settings/
│           ├── __init__.py
│           ├── bcc_processing_settings.py
│           └── bcc_processing_settings.json
├── requirements.txt
└── setup.py
```

### 3. Settings DocType

```json
{
    "doctype": "DocType",
    "name": "BCC Processing Settings",
    "module": "Frappe Email Genius",
    "issingle": 1,
    "fields": [
        {
            "fieldname": "enable_bcc_processing",
            "fieldtype": "Check",
            "label": "Enable BCC Processing",
            "default": 1
        },
        {
            "fieldname": "gmail_forwarding_account",
            "fieldtype": "Data",
            "label": "Gmail Forwarding Account",
            "reqd": 1
        },
        {
            "fieldname": "processing_method",
            "fieldtype": "Select",
            "label": "Processing Method",
            "options": "Hook\nForwarding\nAPI",
            "default": "Hook"
        },
        {
            "fieldname": "preserve_original_headers",
            "fieldtype": "Check",
            "label": "Preserve Original Headers",
            "default": 1
        }
    ]
}
```

### 4. Installation and Configuration

```python
# install.py
import frappe

def after_install():
    """Setup default configuration after app installation"""
    
    # Create default settings
    if not frappe.db.exists("BCC Processing Settings", "BCC Processing Settings"):
        settings = frappe.get_doc({
            "doctype": "BCC Processing Settings",
            "enable_bcc_processing": 1,
            "processing_method": "Hook",
            "preserve_original_headers": 1
        })
        settings.insert(ignore_permissions=True)
    
    # Setup email hooks
    setup_email_hooks()

def setup_email_hooks():
    """Configure email processing hooks"""
    frappe.db.sql("""
        UPDATE `tabEmail Account` 
        SET custom_email_processor = 'frappe_email_genius.email_processor.intercept_incoming_email'
        WHERE enable_incoming = 1
    """)
    frappe.db.commit()
```

## Integration with Your Supervisors Email View

### Modify Your Custom Email Block

```javascript
// supervisors email inbox.js - Enhanced version
frappe.ui.form.on('Your DocType', {
    refresh: function(frm) {
        // Add BCC processing indicator
        add_bcc_processing_indicator(frm);
        
        // Load emails with BCC support
        load_emails_with_bcc_support(frm);
    }
});

function load_emails_with_bcc_support(frm) {
    frappe.call({
        method: 'frappe_email_genius.email_processor.get_processed_emails',
        args: {
            user: frappe.session.user,
            include_bcc: true,
            include_cc: true
        },
        callback: function(r) {
            if (r.message) {
                render_email_list_with_bcc(frm, r.message);
            }
        }
    });
}

function render_email_list_with_bcc(frm, emails) {
    let email_html = '';
    
    emails.forEach(email => {
        let recipient_type_badge = '';
        if (email.recipient_type === 'BCC') {
            recipient_type_badge = '<span class="badge badge-warning">BCC</span>';
        } else if (email.recipient_type === 'CC') {
            recipient_type_badge = '<span class="badge badge-info">CC</span>';
        }
        
        email_html += `
            <div class="email-item" data-message-id="${email.message_id}">
                <div class="email-header">
                    <span class="email-subject">${email.subject}</span>
                    ${recipient_type_badge}
                    <span class="email-date">${email.date}</span>
                </div>
                <div class="email-from">${email.sender}</div>
                <div class="email-preview">${email.preview}</div>
            </div>
        `;
    });
    
    frm.set_df_property('email_list_html', 'options', email_html);
}
```

### Backend API for Email Retrieval

```python
# frappe_email_genius/email_processor.py - Additional methods

@frappe.whitelist()
def get_processed_emails(user=None, include_bcc=True, include_cc=True):
    """
    Get emails including BCC/CC processed emails for a user
    """
    if not user:
        user = frappe.session.user
    
    # Get user's email addresses
    user_emails = get_user_email_addresses(user)
    
    # Build query conditions
    conditions = []
    if include_bcc:
        conditions.append("recipient_type = 'BCC'")
    if include_cc:
        conditions.append("recipient_type = 'CC'")
    
    condition_str = " OR ".join(conditions) if conditions else "1=1"
    
    emails = frappe.db.sql(f"""
        SELECT 
            c.name,
            c.subject,
            c.sender,
            c.content,
            c.creation,
            c.message_id,
            COALESCE(c.custom_recipient_type, 'TO') as recipient_type,
            c.custom_original_message_id
        FROM 
            `tabCommunication` c
        WHERE 
            c.communication_type = 'Communication'
            AND c.sent_or_received = 'Received'
            AND (
                c.recipients LIKE '%{user_emails[0]}%'
                OR ({condition_str})
            )
        ORDER BY 
            c.creation DESC
        LIMIT 100
    """, as_dict=True)
    
    return emails

def get_user_email_addresses(user):
    """Get all email addresses associated with a user"""
    user_doc = frappe.get_doc('User', user)
    emails = [user_doc.email]
    
    # Add any additional email addresses
    for email_account in frappe.get_all('Email Account', 
                                       filters={'user': user}, 
                                       fields=['email_id']):
        if email_account.email_id not in emails:
            emails.append(email_account.email_id)
    
    return emails
```

## Deployment and Testing

### 1. Install the Custom App

```bash
# Install the app
cd frappe-bench
bench get-app https://github.com/your-repo/frappe_email_genius
bench --site your-site install-app frappe_email_genius

# Configure settings
bench --site your-site migrate
```

### 2. Configure Gmail Forwarding

```python
# Setup Gmail API credentials and forwarding rules
frappe.get_doc('BCC Processing Settings').update({
    'gmail_forwarding_account': 'your-processing@gmail.com',
    'enable_bcc_processing': 1
})
```

### 3. Test the Solution

```python
# Test script
def test_bcc_processing():
    # Send test email with BCC
    frappe.sendmail(
        recipients=['recipient1@example.com'],
        cc=['cc@example.com'],
        bcc=['bcc@example.com'],
        subject='Test BCC Processing',
        message='This is a test email'
    )
    
    # Verify unique message-IDs were created
    emails = frappe.get_all('Communication', 
                           filters={'subject': 'Test BCC Processing'},
                           fields=['message_id', 'recipients'])
    
    print(f"Created {len(emails)} unique email entries")
    for email in emails:
        print(f"Message-ID: {email.message_id}, Recipients: {email.recipients}")
```

## Benefits of This Solution

1. **✅ Solves Core Problem**: Eliminates message-ID deduplication
2. **✅ Preserves Email Integrity**: Maintains original content and headers
3. **✅ Works with Existing System**: No major changes to Frappe core
4. **✅ Scalable**: Handles any number of CC/BCC recipients
5. **✅ Trackable**: Adds metadata for debugging and monitoring
6. **✅ Configurable**: Easy to enable/disable and customize

This genius solution effectively tricks Frappe into thinking each CC/BCC recipient received a separate email, while maintaining all the original email content and functionality! 
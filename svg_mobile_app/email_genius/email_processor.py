"""
Email Genius - BCC/CC Email Processor
Handles message-ID modification and email forwarding for BCC/CC recipients
"""

import frappe
import email
import uuid
import re
import hashlib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import parseaddr, formataddr
import logging

# Configure logging
logger = logging.getLogger(__name__)

@frappe.whitelist()
def intercept_incoming_email(email_account, msg):
    """
    Intercepts incoming emails and processes CC/BCC recipients
    """
    try:
        # Check if BCC processing is enabled
        if not is_bcc_processing_enabled():
            return msg
        
        # Parse the email message
        email_obj = email.message_from_string(msg)
        
        # Extract recipients
        to_recipients = parse_recipients(email_obj.get('To', ''))
        cc_recipients = parse_recipients(email_obj.get('Cc', ''))
        bcc_recipients = parse_recipients(email_obj.get('Bcc', ''))
        
        all_recipients = to_recipients + cc_recipients + bcc_recipients
        
        # Log the processing
        frappe.logger().info(f"Email Genius: Processing email with {len(all_recipients)} recipients")
        
        if len(all_recipients) > 1:
            # Multiple recipients detected - create unique copies
            processed_emails = create_unique_email_copies(email_obj, all_recipients, email_account)
            frappe.logger().info(f"Email Genius: Created {len(processed_emails)} unique email copies")
            # Return the first processed email's string format for Frappe processing
            if processed_emails and len(processed_emails) > 0:
                return processed_emails[0].get('email', msg)
            return msg
        
        return msg  # Single recipient, process normally
        
    except Exception as e:
        frappe.log_error(f"Email Genius BCC Processing Error: {str(e)}", "Email Genius Error")
        return msg  # Fallback to original processing

def create_unique_email_copies(original_email, recipients, email_account):
    """
    Creates unique email copies with modified message-IDs for each recipient
    """
    processed_emails = []
    original_message_id = original_email.get('Message-ID', '')
    original_subject = original_email.get('Subject', '')
    
    frappe.logger().info(f"Email Genius: Creating unique copies for {len(recipients)} recipients")
    
    for i, recipient in enumerate(recipients):
        try:
            # Create a copy of the email
            email_copy = email.message_from_string(original_email.as_string())
            
            # Generate unique message-ID
            unique_message_id = generate_unique_message_id(original_message_id, recipient, i)
            
            # Replace or add message-ID header
            if email_copy.get('Message-ID'):
                email_copy.replace_header('Message-ID', unique_message_id)
            else:
                email_copy.add_header('Message-ID', unique_message_id)
            
            # Set the specific recipient as the primary TO
            if email_copy.get('To'):
                email_copy.replace_header('To', recipient)
            else:
                email_copy.add_header('To', recipient)
            
            # Add custom headers for tracking
            email_copy.add_header('X-Frappe-Original-Message-ID', original_message_id)
            email_copy.add_header('X-Frappe-Recipient-Type', get_recipient_type(recipient, original_email))
            email_copy.add_header('X-Frappe-BCC-Processed', 'true')
            email_copy.add_header('X-Frappe-Recipient-Index', str(i))
            
            # Forward to Gmail processing account
            forward_success = forward_email_copy(email_copy, email_account, recipient)
            
            if forward_success:
                processed_emails.append({
                    'email': email_copy.as_string(),
                    'recipient': recipient,
                    'message_id': unique_message_id,
                    'recipient_type': get_recipient_type(recipient, original_email)
                })
            
        except Exception as e:
            frappe.log_error(f"Email Genius: Error processing recipient {recipient}: {str(e)}", "Email Genius Error")
            continue
    
    return processed_emails

def generate_unique_message_id(original_id, recipient, index):
    """
    Generates a unique message-ID based on original ID and recipient
    """
    try:
        # Extract domain from original message-ID
        if original_id and '@' in original_id:
            # Remove angle brackets and split on first '@' only
            cleaned_id = original_id.strip('<>')
            if '@' in cleaned_id:
                parts = cleaned_id.split('@', 1)  # Split on first '@' only
                if len(parts) == 2:
                    local_part, domain = parts
                    # Create unique identifier using recipient hash
                    recipient_hash = hashlib.md5(recipient.encode()).hexdigest()[:8]
                    unique_suffix = f"{recipient_hash}.{index}"
                    return f"<{local_part}.{unique_suffix}@{domain}>"
        
        # Generate completely new message-ID if parsing fails
        site_domain = frappe.local.site if hasattr(frappe.local, 'site') else 'localhost'
        unique_id = uuid.uuid4().hex[:16]
        return f"<frappe.bcc.{unique_id}@{site_domain}>"
    except Exception as e:
        # Fallback message-ID
        frappe.logger().error(f"Email Genius: Error generating unique message ID: {str(e)}")
        return f"<frappe.bcc.{uuid.uuid4().hex}@localhost>"

def get_recipient_type(recipient, email_obj):
    """
    Determines if recipient was TO, CC, or BCC
    """
    try:
        to_recipients = parse_recipients(email_obj.get('To', ''))
        cc_recipients = parse_recipients(email_obj.get('Cc', ''))
        
        if recipient in to_recipients:
            return 'TO'
        elif recipient in cc_recipients:
            return 'CC'
        else:
            return 'BCC'
    except Exception:
        return 'UNKNOWN'

def parse_recipients(recipient_string):
    """
    Parses recipient string and returns list of email addresses
    """
    if not recipient_string:
        return []
    
    try:
        # Handle various email formats
        emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', recipient_string)
        return [email.lower().strip() for email in emails]
    except Exception:
        return []

def forward_email_copy(email_copy, email_account, recipient):
    """
    Forwards the modified email copy to Gmail processing account
    """
    try:
        # Get forwarding destination from settings (provider agnostic)
        try:
            from svg_mobile_app.svg_mobile_app.doctype.bcc_processing_settings.bcc_processing_settings import get_bcc_settings
            settings = get_bcc_settings()
            gmail_account = settings.get('gmail_forwarding_account') if settings else "constr.sv@gmail.com"
            processing_server = settings.get('processing_server') if settings else None
            processing_port = settings.get('processing_port') if settings else None
            use_ssl = settings.get('use_ssl') if settings else 0
            use_tls = settings.get('use_tls') if settings else 1
        except Exception:
            gmail_account = "constr.sv@gmail.com"  # Fallback
            processing_server = None
            processing_port = None
            use_ssl = 0
            use_tls = 1

        if not gmail_account:
            frappe.logger().warning("Email Genius: No Gmail forwarding account configured")
            return False
        
        # Validate recipient email
        if not recipient or '@' not in recipient:
            frappe.logger().warning(f"Email Genius: Invalid recipient email: {recipient}")
            return False
            
        # Create a forwarding message
        subject = email_copy.get('Subject', 'No Subject')
        original_from = email_copy.get('From', 'Unknown Sender')
        recipient_type = email_copy.get('X-Frappe-Recipient-Type', 'UNKNOWN')
        
        # Create forwarding subject with metadata
        forward_subject = f"[BCC-PROCESSED-{recipient_type}] {subject}"
        
        # Get email content safely
        try:
            if email_copy.is_multipart():
                email_content = "Multipart content - see original email"
            else:
                payload = email_copy.get_payload()
                if isinstance(payload, str):
                    email_content = payload[:1000]  # Limit content length
                else:
                    email_content = "Binary content - see original email"
        except Exception:
            email_content = "Unable to extract content"
        
        # Create message body with original email metadata
        forward_body = f"""
This email has been processed by Email Genius for BCC/CC handling.

Original Details:
- From: {original_from}
- To: {recipient}
- Type: {recipient_type}
- Original Message-ID: {email_copy.get('X-Frappe-Original-Message-ID', 'N/A')}
- New Message-ID: {email_copy.get('Message-ID', 'N/A')}

--- Original Email Content Preview ---
{email_content}
"""
        
        # Send the forwarded email with error handling
        if processing_server:
            # Use SMTP config override if provided
            try:
                from frappe.email.smtp import SMTPServer
                smtp_args = {
                    'server': processing_server,
                    'port': processing_port or (465 if use_ssl else 587),
                    'use_ssl': bool(use_ssl),
                    'use_tls': bool(use_tls)
                }
                smtp = SMTPServer(login=None, password=None, email_account=None, **smtp_args)
                smtp.sess.sendmail(from_addr='no-reply@localhost', to_addrs=[gmail_account], msg=f"Subject: {forward_subject}\n\n{forward_body}")
            except Exception as smtp_err:
                frappe.logger().error(f"Email Genius: SMTP override send failed: {str(smtp_err)}; falling back to frappe.sendmail")
                frappe.sendmail(recipients=[gmail_account], subject=forward_subject, message=forward_body)
        else:
            frappe.sendmail(recipients=[gmail_account], subject=forward_subject, message=forward_body)
        
        frappe.logger().info(f"Email Genius: Successfully forwarded email to {gmail_account} for recipient {recipient}")
        return True
        
    except Exception as e:
        error_msg = str(e)
        frappe.logger().error(f"Email Genius: Email forwarding error for {recipient}: {error_msg}")
        frappe.log_error(f"Email Genius: Email forwarding error for {recipient}: {error_msg}", "Email Genius Error")
        return False

def is_bcc_processing_enabled():
    """
    Check if BCC processing is enabled in settings
    """
    try:
        # Check if we have the settings doctype
        if frappe.db.exists("DocType", "BCC Processing Settings"):
            if frappe.db.exists("BCC Processing Settings", "BCC Processing Settings"):
                settings = frappe.get_single('BCC Processing Settings')
                enabled = settings.get('enable_bcc_processing', 0)
                frappe.logger().info(f"Email Genius: BCC processing enabled: {enabled}")
                return enabled
            else:
                frappe.logger().warning("Email Genius: BCC Processing Settings record not found")
                return False
        else:
            frappe.logger().warning("Email Genius: BCC Processing Settings DocType not found")
            return False
    except Exception as e:
        frappe.log_error(f"Email Genius: Error checking BCC settings: {str(e)}", "Email Genius")
        frappe.logger().error(f"Email Genius: Error checking BCC settings: {str(e)}")
        return False

def is_role_based_forwarding_enabled():
    """
    Check if role-based email forwarding is enabled in settings
    """
    try:
        # Check if we have the settings doctype
        if frappe.db.exists("DocType", "BCC Processing Settings"):
            if frappe.db.exists("BCC Processing Settings", "BCC Processing Settings"):
                settings = frappe.get_single('BCC Processing Settings')
                enabled = settings.get('enable_role_based_forwarding', 0)
                frappe.logger().info(f"Email Genius: Role-based forwarding enabled: {enabled}")
                return enabled
            else:
                frappe.logger().warning("Email Genius: BCC Processing Settings record not found")
                return False
        else:
            frappe.logger().warning("Email Genius: BCC Processing Settings DocType not found")
            return False
    except Exception as e:
        frappe.log_error(f"Email Genius: Error checking role-based forwarding settings: {str(e)}", "Email Genius")
        frappe.logger().error(f"Email Genius: Error checking role-based forwarding settings: {str(e)}")
        return False

def should_forward_email_by_role(comm):
    """
    Decide whether to forward based on Forward Emails Control mappings or fallback engineer role.
    Returns a tuple (should_forward: bool, target_account: str|None, subject_prefix: str|None)
    """
    try:
        target_account = None
        subject_prefix = None

        # Get recipients email(s)
        recipients = comm.get('recipients', '')
        if not recipients:
            return False, None, None

        # Normalize recipient emails (comma-separated, quoted formats)
        recipient_emails = []
        for email_addr in recipients.split(','):
            e = email_addr.strip()
            if '<' in e and '>' in e:
                e = e.split('<')[1].split('>')[0].strip()
            elif '"' in e:
                e = e.replace('"', '').strip()
            recipient_emails.append(e)

        # Load any mappings from Forward Emails Control
        mappings = frappe.get_all('Forward Emails Control', filters={'enabled': 1}, fields=['target_role', 'target_email_account', 'subject_prefix'])

        # Build role->account map
        role_to_target = {}
        for m in mappings:
            if m.get('target_role') and m.get('target_email_account'):
                role_to_target[m['target_role']] = (m['target_email_account'], m.get('subject_prefix'))

        # Iterate recipients, find user, check roles
        for recipient_email in recipient_emails:
            if not recipient_email:
                continue
            user = frappe.db.get_value('User', {'email': recipient_email}, 'name') or frappe.db.get_value('User Email', {'email_id': recipient_email}, 'parent')
            if not user:
                continue
            user_roles = set(frappe.get_roles(user) or [])
            # Check mapping roles
            for role, (acct, pref) in role_to_target.items():
                if role in user_roles:
                    frappe.logger().info(f"Email Genius: Forwarding due to mapping role '{role}' -> {acct}")
                    return True, acct, pref

        # Fallback to engineer role from settings
        settings = frappe.get_single('BCC Processing Settings')
        engineer_role = settings.get('engineer_role_name', 'Site Engineer')
        main_account = settings.get('main_email_account')
        if engineer_role and main_account:
            for recipient_email in recipient_emails:
                user = frappe.db.get_value('User', {'email': recipient_email}, 'name') or frappe.db.get_value('User Email', {'email_id': recipient_email}, 'parent')
                if not user:
                    continue
                if engineer_role in set(frappe.get_roles(user) or []):
                    return True, main_account, settings.get('forwarding_subject_prefix_role')

        return False, None, None
    except Exception as e:
        frappe.logger().error(f"Email Genius: Error checking mapping for forwarding: {str(e)}")
        return False, None, None

def forward_email_to_main_account(comm, account_override=None, subject_prefix_override=None):
    """
    Forward email to the main account configured in settings
    """
    try:
        # Get settings
        settings = frappe.get_single('BCC Processing Settings')
        # Allow overrides from mapping
        main_email_account = account_override or settings.get('main_email_account')
        subject_prefix = subject_prefix_override or settings.get('forwarding_subject_prefix_role', '[ENGINEER-FORWARDED]')

        if not main_email_account:
            frappe.logger().error("Email Genius: No main email account configured for role forwarding")
            return False

        # Get main email account details
        main_account_email = frappe.db.get_value('Email Account', main_email_account, 'email_id')
        if not main_account_email:
            frappe.logger().error(f"Email Genius: Main email account {main_email_account} not found")
            return False

        # Create forwarded email subject
        original_subject = comm.get('subject', 'No Subject')
        forwarded_subject = f"{subject_prefix} {original_subject}"

        # Create forwarded email content
        original_content = comm.get('content', '')
        sender_info = comm.get('sender', 'Unknown Sender')
        forwarded_content = f"""
--- Forwarded Email from Engineer ---
From: {sender_info}
Original Subject: {original_subject}
Message ID: {comm.get('message_id', 'N/A')}

{original_content}
"""

        # Create new Communication record for the forwarded email
        new_comm = frappe.new_doc("Communication")
        new_comm.communication_medium = "Email"
        new_comm.sent_or_received = "Received"
        new_comm.email_account = main_email_account
        new_comm.subject = forwarded_subject
        new_comm.sender = sender_info
        new_comm.recipients = main_account_email
        new_comm.content = forwarded_content
        new_comm.message_id = f"<forwarded.{comm.get('name', 'unknown')}.{frappe.utils.now()}@role.forwarded>"

        # Set custom fields to track forwarding
        new_comm.custom_role_forwarded = 1
        new_comm.custom_original_message_id = comm.get('message_id', '')
        new_comm.custom_recipient_type = 'TO'  # Use valid recipient type instead of 'FORWARDED'

        # Insert the new Communication record
        new_comm.insert(ignore_permissions=True)
        frappe.db.commit()

        frappe.logger().info(f"Email Genius: Successfully forwarded email {comm['name']} to main account {main_account_email}")
        return True

    except Exception as e:
        frappe.logger().error(f"Email Genius: Error forwarding email to main account: {str(e)}")
        frappe.log_error(f"Email Genius: Error forwarding email to main account: {str(e)}", "Email Genius Role Forwarding")
        return False

@frappe.whitelist()
def get_processed_emails(user=None, include_bcc=True, include_cc=True, limit=100):
    """
    Get emails including BCC/CC processed emails for a user
    """
    if not user:
        user = frappe.session.user
    
    try:
        # Get user's email addresses
        user_emails = get_user_email_addresses(user)
        
        # Build query conditions
        conditions = ["c.communication_type = 'Communication'", "c.sent_or_received = 'Received'"]
        
        # Add recipient type conditions
        recipient_conditions = []
        if include_bcc:
            recipient_conditions.append("c.custom_recipient_type = 'BCC'")
        if include_cc:
            recipient_conditions.append("c.custom_recipient_type = 'CC'")
        
        # Add user email conditions
        email_conditions = []
        for email_addr in user_emails:
            email_conditions.append(f"c.recipients LIKE '%{email_addr}%'")
        
        # Combine conditions
        if recipient_conditions:
            conditions.append(f"({' OR '.join(recipient_conditions)})")
        if email_conditions:
            conditions.append(f"({' OR '.join(email_conditions)})")
        
        where_clause = " AND ".join(conditions)
        
        emails = frappe.db.sql(f"""
            SELECT 
                c.name,
                c.subject,
                c.sender,
                c.content,
                c.creation,
                c.message_id,
                COALESCE(c.custom_recipient_type, 'TO') as recipient_type,
                c.custom_original_message_id,
                c.recipients,
                SUBSTRING(c.content, 1, 200) as preview
            FROM 
                `tabCommunication` c
            WHERE 
                {where_clause}
            ORDER BY 
                c.creation DESC
            LIMIT {limit}
        """, as_dict=True)
        
        return emails
        
    except Exception as e:
        frappe.log_error(f"Email Genius: Error getting processed emails: {str(e)}", "Email Genius Error")
        return []

def get_user_email_addresses(user):
    """Get all email addresses associated with a user"""
    try:
        user_doc = frappe.get_doc('User', user)
        emails = [user_doc.email] if user_doc.email else []
        
        # Add any additional email addresses from email accounts
        email_accounts = frappe.get_all('Email Account', 
                                       filters={'user': user}, 
                                       fields=['email_id'])
        
        for email_account in email_accounts:
            if email_account.email_id and email_account.email_id not in emails:
                emails.append(email_account.email_id)
        
        return emails
    except Exception:
        return []

@frappe.whitelist()
def test_bcc_processing():
    """
    Test function to verify BCC processing is working
    """
    try:
        # Create a test email scenario with proper formatting
        test_email_content = """From: test@example.com
To: recipient1@example.com
Cc: cc@example.com
Bcc: bcc@example.com
Subject: Email Forwarding Test
Message-ID: <test.123@example.com>

This is a test email for BCC processing.
"""
        
        # Test the email parsing functions individually
        email_obj = email.message_from_string(test_email_content)
        
        # Test recipient parsing
        to_recipients = parse_recipients(email_obj.get('To', ''))
        cc_recipients = parse_recipients(email_obj.get('Cc', ''))
        bcc_recipients = parse_recipients(email_obj.get('Bcc', ''))
        
        # Test message ID generation safely
        test_message_ids = []
        all_recipients = to_recipients + cc_recipients + bcc_recipients
        
        for i, recipient in enumerate(all_recipients):
            try:
                unique_id = generate_unique_message_id(email_obj.get('Message-ID'), recipient, i)
                test_message_ids.append(unique_id)
            except Exception as id_error:
                test_message_ids.append(f"Error generating ID for {recipient}: {str(id_error)}")
        
        # Test recipient type detection
        recipient_types = {}
        for recipient in all_recipients:
            try:
                recipient_types[recipient] = get_recipient_type(recipient, email_obj)
            except Exception as type_error:
                recipient_types[recipient] = f"Error: {str(type_error)}"
        
        # Test settings
        processing_enabled = is_bcc_processing_enabled()
        
        return {
            "status": "success",
            "message": "BCC processing test completed successfully",
            "details": {
                "to_recipients": to_recipients,
                "cc_recipients": cc_recipients,
                "bcc_recipients": bcc_recipients,
                "total_recipients": len(all_recipients),
                "generated_message_ids": test_message_ids,
                "recipient_types": recipient_types,
                "bcc_processing_enabled": processing_enabled,
                "original_message_id": email_obj.get('Message-ID'),
                "test_note": "Forwarding test skipped to avoid errors"
            }
        }
        
    except Exception as e:
        error_msg = str(e)
        frappe.logger().error(f"Email Genius: Test error: {error_msg}")
        return {
            "status": "error",
            "message": f"Test failed: {error_msg}",
            "details": {
                "bcc_processing_enabled": is_bcc_processing_enabled()
            }
        }

# Hook function for Communication doctype
def process_bcc_email(doc, method=None):
    """
    Process BCC emails when Communication is created
    """
    try:
        frappe.logger().info(f"Email Genius: Processing communication {doc.name} - Subject: {getattr(doc, 'subject', 'No Subject')}")

        # Check if BCC processing is enabled
        if not is_bcc_processing_enabled():
            frappe.logger().info("Email Genius: BCC processing disabled, skipping")
            return

        # Skip if this is an outgoing email
        if getattr(doc, 'sent_or_received', '') != 'Received':
            frappe.logger().info(f"Email Genius: Skipping non-received email: {doc.name}")
            return

        # Check if this is already a BCC processed email
        if (hasattr(doc, 'custom_original_message_id') and doc.custom_original_message_id) or \
           (doc.message_id and ('frappe.bcc.' in doc.message_id or '.bcc.' in doc.message_id)):
            # This is already a BCC processed email - just mark it
            if hasattr(doc, 'custom_bcc_processed'):
                doc.custom_bcc_processed = 1
                frappe.logger().info(f"Email Genius: Marked communication {doc.name} as BCC processed (already processed)")
            return

        # Check if this email has CC/BCC recipients that need processing
        has_cc = bool(getattr(doc, 'cc', None))
        has_bcc = bool(getattr(doc, 'bcc', None))
        has_multiple_to = ',' in (getattr(doc, 'recipients', '') or '')

        should_process = has_cc or has_bcc or has_multiple_to

        frappe.logger().info(f"Email Genius: Email {doc.name} - CC: {has_cc}, BCC: {has_bcc}, Multiple TO: {has_multiple_to}, Should process: {should_process}")

        if should_process:
            # This email needs BCC processing - create separate Communication records
            frappe.logger().info(f"Email Genius: Processing email {doc.name} for CC/BCC recipients")

            try:
                # Mark original as TO recipient and processed
                if hasattr(doc, 'custom_bcc_processed'):
                    doc.custom_bcc_processed = 1
                if hasattr(doc, 'custom_recipient_type') and not doc.custom_recipient_type:
                    doc.custom_recipient_type = "TO"

                # Process CC recipients
                if has_cc and getattr(doc, 'cc', None):
                    cc_recipients = [r.strip() for r in doc.cc.split(',')]
                    frappe.logger().info(f"Email Genius: Processing {len(cc_recipients)} CC recipients")

                    for i, cc_recipient in enumerate(cc_recipients):
                        # Extract email from format like '"email@domain.com" <email@domain.com>'
                        import re
                        email_match = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', cc_recipient)
                        if email_match:
                            clean_email = email_match.group(1)
                            create_bcc_communication_record(doc, clean_email, "CC", i + 1)

                # Process BCC recipients
                if has_bcc and getattr(doc, 'bcc', None):
                    bcc_recipients = [r.strip() for r in doc.bcc.split(',')]
                    frappe.logger().info(f"Email Genius: Processing {len(bcc_recipients)} BCC recipients")

                    for i, bcc_recipient in enumerate(bcc_recipients):
                        import re
                        email_match = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', bcc_recipient)
                        if email_match:
                            clean_email = email_match.group(1)
                            create_bcc_communication_record(doc, clean_email, "BCC", i + 1)

                # Process multiple TO recipients
                if has_multiple_to:
                    to_recipients = [r.strip() for r in doc.recipients.split(',')]
                    frappe.logger().info(f"Email Genius: Processing {len(to_recipients)} TO recipients")

                    for i, to_recipient in enumerate(to_recipients[1:], 1):  # Skip first one (already exists)
                        import re
                        email_match = re.search(r'([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})', to_recipient)
                        if email_match:
                            clean_email = email_match.group(1)
                            create_bcc_communication_record(doc, clean_email, "TO", i + 1)

            except Exception as process_error:
                frappe.logger().error(f"Email Genius: Error processing BCC for {doc.name}: {str(process_error)}")
        else:
            # Single recipient email - mark as processed but no BCC needed
            if hasattr(doc, 'custom_bcc_processed'):
                doc.custom_bcc_processed = 1
            if hasattr(doc, 'custom_recipient_type') and not doc.custom_recipient_type:
                doc.custom_recipient_type = "TO"
            frappe.logger().info(f"Email Genius: Single recipient email {doc.name} - marked as processed")

    except Exception as e:
        frappe.log_error(f"Email Genius: Error in process_bcc_email: {str(e)}", "Email Genius Error")
        frappe.logger().error(f"Email Genius: Error in process_bcc_email for {getattr(doc, 'name', 'unknown')}: {str(e)}")

def create_bcc_communication_record(original_doc, recipient_email, recipient_type, recipient_index):
    """
    Create a new Communication record for a CC/BCC recipient
    """
    try:
        # Create new Communication record for this recipient
        new_comm = frappe.copy_doc(original_doc)
        new_comm.recipients = recipient_email
        new_comm.custom_recipient_type = recipient_type
        new_comm.custom_original_message_id = original_doc.message_id
        new_comm.custom_bcc_processed = 1
        new_comm.custom_recipient_index = recipient_index

        # Generate unique message ID
        import hashlib
        unique_id = hashlib.md5(f"{original_doc.message_id}{recipient_email}{recipient_index}".encode()).hexdigest()[:8]
        new_comm.message_id = f"<{unique_id}.{recipient_type.lower()}.{recipient_index}@bcc.processed>"

        # Preserve raw email content if available
        try:
            if hasattr(original_doc, 'raw_email') and original_doc.raw_email:
                new_comm.raw_email = original_doc.raw_email
        except Exception:
            pass

        # Optionally append timestamp to subject based on settings
        try:
            from svg_mobile_app.svg_mobile_app.doctype.bcc_processing_settings.bcc_processing_settings import get_bcc_settings
            settings = get_bcc_settings()
            if settings and settings.get('enable_subject_timestamping'):
                ts_format = settings.get('subject_timestamp_format') or '[%Y-%m-%d %H:%M:%S]'
                try:
                    import time
                    timestamp_str = time.strftime(ts_format)
                except Exception:
                    # Fallback format
                    import time
                    timestamp_str = time.strftime('[%Y-%m-%d %H:%M:%S]')
                subj = getattr(new_comm, 'subject', '') or ''
                new_comm.subject = f"{subj} {timestamp_str}".strip()
        except Exception:
            # Non-fatal; continue
            pass

        # Clear CC/BCC fields for individual recipient records
        if hasattr(new_comm, 'cc'):
            new_comm.cc = None
        if hasattr(new_comm, 'bcc'):
            new_comm.bcc = None

        # Insert the new Communication record
        new_comm.insert()
        frappe.logger().info(f"Email Genius: Created Communication {new_comm.name} for {recipient_type} recipient {recipient_email}")

        # Clone attachments from original communication to new one
        try:
            files = frappe.get_all(
                'File',
                filters={
                    'attached_to_doctype': 'Communication',
                    'attached_to_name': original_doc.name
                },
                fields=['name', 'file_name', 'file_url', 'is_private']
            )
            for f in files:
                # Create a new File record linking to the same content
                file_doc = frappe.get_doc({
                    'doctype': 'File',
                    'file_name': f.get('file_name'),
                    'file_url': f.get('file_url'),
                    'is_private': f.get('is_private', 0),
                    'attached_to_doctype': 'Communication',
                    'attached_to_name': new_comm.name
                })
                file_doc.insert(ignore_permissions=True)
        except Exception as attach_err:
            frappe.logger().error(f"Email Genius: Failed to clone attachments for {new_comm.name}: {str(attach_err)}")

        # Forward to Gmail if configured
        try:
            # Create email object for forwarding
            import email
            forward_email = email.message.EmailMessage()
            forward_email['Subject'] = new_comm.subject
            forward_email['From'] = new_comm.sender
            forward_email['To'] = recipient_email
            forward_email['Message-ID'] = new_comm.message_id
            forward_email.set_content(new_comm.content)

            # Forward to Gmail processing account
            forward_result = forward_email_copy(forward_email, new_comm.email_account, recipient_email)
            frappe.logger().info(f"Email Genius: Gmail forwarding for {recipient_email}: {forward_result}")

        except Exception as forward_error:
            frappe.logger().error(f"Email Genius: Error forwarding to Gmail for {recipient_email}: {str(forward_error)}")

        return new_comm.name

    except Exception as e:
        frappe.logger().error(f"Email Genius: Error creating Communication for {recipient_email}: {str(e)}")
        frappe.log_error(f"Email Genius: Error creating Communication for {recipient_email}: {str(e)}", "Email Genius Error")
        return None

# Hook function for Role-Based Email Forwarding
def process_role_based_forwarding(doc, method=None):
    """
    Process role-based email forwarding when Communication is created
    """
    try:
        frappe.logger().info(f"Email Genius: Checking role-based forwarding for communication {doc.name}")

        # Check if role-based forwarding is enabled
        if not is_role_based_forwarding_enabled():
            frappe.logger().info("Email Genius: Role-based forwarding disabled, skipping")
            return

        # Skip if this is an outgoing email
        if getattr(doc, 'sent_or_received', '') != 'Received':
            frappe.logger().info(f"Email Genius: Skipping non-received email: {doc.name}")
            return

        # Skip if already processed
        if getattr(doc, 'custom_role_forwarded', 0):
            frappe.logger().info(f"Email Genius: Email {doc.name} already processed for role forwarding")
            return

        # Convert doc to dict for processing
        comm_dict = {
            'name': doc.name,
            'subject': getattr(doc, 'subject', ''),
            'content': getattr(doc, 'content', ''),
            'sender': getattr(doc, 'sender', ''),
            'recipients': getattr(doc, 'recipients', ''),
            'message_id': getattr(doc, 'message_id', ''),
            'email_account': getattr(doc, 'email_account', '')
        }

        # Check if this email should be forwarded
        should_fwd, account_override, prefix_override = should_forward_email_by_role(comm_dict)
        if should_fwd:
            if forward_email_to_main_account(comm_dict, account_override=account_override, subject_prefix_override=prefix_override):
                # Mark as processed
                frappe.db.set_value("Communication", doc.name, "custom_role_forwarded", 1)
                frappe.db.commit()
                frappe.logger().info(f"Email Genius: Successfully processed role forwarding for {doc.name}")
            else:
                frappe.logger().error(f"Email Genius: Failed to forward email {doc.name}")
        else:
            # Mark as processed even if not forwarded to avoid reprocessing
            frappe.db.set_value("Communication", doc.name, "custom_role_forwarded", 1)
            frappe.logger().info(f"Email Genius: Email {doc.name} does not require role forwarding")

    except Exception as e:
        frappe.log_error(f"Email Genius: Error in process_role_based_forwarding: {str(e)}", "Email Genius Role Forwarding")
        frappe.logger().error(f"Email Genius: Error in process_role_based_forwarding: {str(e)}")

@frappe.whitelist()
def process_incoming_email(email_account):
    """
    Override for frappe.email.receive.pull_from_email_account
    This function will be called when ERPNext pulls emails from email accounts
    """
    try:
        frappe.logger().info(f"Email Genius: Processing incoming emails for account {email_account}")

        # Check if BCC processing is enabled
        if not is_bcc_processing_enabled():
            frappe.logger().info("Email Genius: BCC processing disabled, using original function")
            return call_original_pull_function(email_account)

        # Call the original function to get emails normally
        result = call_original_pull_function(email_account)

        # After emails are processed normally, check for any that need BCC processing
        process_recent_emails_for_bcc(email_account)

        # Check for role-based email forwarding
        process_recent_emails_for_role_forwarding(email_account)

        return result

    except Exception as e:
        frappe.log_error(f"Email Genius Error: {str(e)}", "Email Genius")
        # Fallback to original processing
        return call_original_pull_function(email_account)

def process_recent_emails_for_bcc(email_account):
    """
    Process recently received emails for BCC/CC handling
    """
    try:
        frappe.logger().info(f"Email Genius: Checking recent emails for BCC processing in account {email_account}")

        # Get recent unprocessed communications from this email account
        communications = frappe.get_all("Communication",
            filters={
                "email_account": email_account,
                "communication_medium": "Email",
                "sent_or_received": "Received",
                "custom_bcc_processed": 0,  # Only unprocessed emails
                "creation": [">=", frappe.utils.add_hours(frappe.utils.now(), -1)]  # Last hour only
            },
            fields=["name", "subject", "content", "message_id", "sender", "recipients"],
            limit=10,
            order_by="creation desc"
        )

        frappe.logger().info(f"Email Genius: Found {len(communications)} recent unprocessed communications")

        processed_count = 0
        for comm in communications:
            try:
                # Get the full communication document
                comm_doc = frappe.get_doc("Communication", comm.name)

                # Try to reconstruct email content for BCC processing
                if comm_doc.content:
                    # Create a basic email structure for processing
                    reconstructed_email = f"""From: {comm_doc.sender or 'unknown@example.com'}
To: {comm_doc.recipients or 'unknown@example.com'}
Subject: {comm_doc.subject or 'No Subject'}
Message-ID: {comm_doc.message_id or f'<generated-{comm_doc.name}@localhost>'}

{comm_doc.content}"""

                    # Check if this email has multiple recipients by parsing the content
                    if comm_doc.recipients and (',' in comm_doc.recipients or 'cc' in comm_doc.content.lower() or 'bcc' in comm_doc.content.lower()):
                        # Process with BCC interception
                        processed_email = intercept_incoming_email(email_account, reconstructed_email)

                        if processed_email != reconstructed_email:
                            processed_count += 1
                            frappe.logger().info(f"Email Genius: Processed communication {comm.name} for BCC")

                # Mark as processed regardless
                frappe.db.set_value("Communication", comm.name, "custom_bcc_processed", 1)
                frappe.db.set_value("Communication", comm.name, "custom_recipient_type", "TO")

            except Exception as comm_error:
                frappe.logger().error(f"Email Genius: Error processing communication {comm.name}: {str(comm_error)}")
                continue

        if communications:
            frappe.db.commit()
            frappe.logger().info(f"Email Genius: Processed {processed_count} emails with BCC processing")

        return processed_count

    except Exception as e:
        frappe.log_error(f"Email Genius: Error in process_recent_emails_for_bcc: {str(e)}", "Email Genius")
        return 0

def process_recent_emails_for_role_forwarding(email_account):
    """
    Process recently received emails for role-based forwarding
    """
    try:
        frappe.logger().info(f"Email Genius: Checking recent emails for role-based forwarding in account {email_account}")

        # Check if role-based forwarding is enabled
        if not is_role_based_forwarding_enabled():
            frappe.logger().info("Email Genius: Role-based forwarding disabled, skipping")
            return 0

        # Get recent unprocessed communications from this email account
        communications = frappe.get_all("Communication",
            filters={
                "email_account": email_account,
                "communication_medium": "Email",
                "sent_or_received": "Received",
                "custom_role_forwarded": 0,  # Only unprocessed emails
                "creation": [">=", frappe.utils.add_hours(frappe.utils.now(), -1)]  # Last hour only
            },
            fields=["name", "subject", "content", "message_id", "sender", "recipients", "email_account"],
            limit=10,
            order_by="creation desc"
        )

        processed_count = 0
        for comm in communications:
            try:
                if should_forward_email_by_role(comm):
                    if forward_email_to_main_account(comm):
                        # Mark as processed
                        frappe.db.set_value("Communication", comm["name"], "custom_role_forwarded", 1)
                        frappe.db.commit()
                        processed_count += 1
                        frappe.logger().info(f"Email Genius: Role-forwarded email {comm['name']}")
                else:
                    # Mark as processed even if not forwarded to avoid reprocessing
                    frappe.db.set_value("Communication", comm["name"], "custom_role_forwarded", 1)
            except Exception as e:
                frappe.logger().error(f"Email Genius: Error processing email {comm['name']} for role forwarding: {str(e)}")
                continue

        if communications:
            frappe.db.commit()

        frappe.logger().info(f"Email Genius: Processed {processed_count} recent emails for role forwarding")
        return processed_count
    except Exception as e:
        frappe.log_error(f"Error processing recent emails for role forwarding: {str(e)}", "Email Genius Role Forwarding")
        return 0

def call_original_pull_function(email_account):
    """Call the original Frappe email processing function"""
    try:
        # Try different possible function names based on Frappe version
        from frappe.email.doctype.email_account.email_account import pull_from_email_account as original_pull
        return original_pull(email_account)
    except ImportError:
        try:
            from frappe.email.receive import pull_from_email_account as original_pull
            return original_pull(email_account)
        except ImportError:
            # Fallback - try to get the email account and call receive method
            email_account_doc = frappe.get_doc("Email Account", email_account)
            return email_account_doc.receive()

def process_emails_with_bcc_interception(email_account_doc):
    """
    Process emails with BCC interception at the message level
    """
    try:
        frappe.logger().info(f"Email Genius: Starting BCC interception for {email_account_doc.name}")

        # Import required modules for email processing
        import imaplib
        import poplib
        import email
        from email.header import decode_header

        processed_count = 0

        # Connect to email server based on account type
        if email_account_doc.use_imap:
            processed_count = process_imap_emails_with_bcc(email_account_doc)
        else:
            processed_count = process_pop_emails_with_bcc(email_account_doc)

        frappe.logger().info(f"Email Genius: Processed {processed_count} emails with BCC interception")
        return processed_count

    except Exception as e:
        frappe.log_error(f"Email Genius BCC Interception Error: {str(e)}", "Email Genius")
        # Fallback to original processing
        return call_original_pull_function(email_account_doc.name)

def process_imap_emails_with_bcc(email_account_doc):
    """
    Process IMAP emails with BCC interception
    """
    try:
        import imaplib
        import ssl

        frappe.logger().info(f"Email Genius: Connecting to IMAP server for {email_account_doc.name}")

        # Connect to IMAP server
        if email_account_doc.use_ssl:
            mail = imaplib.IMAP4_SSL(email_account_doc.email_server, email_account_doc.incoming_port or 993)
        else:
            mail = imaplib.IMAP4(email_account_doc.email_server, email_account_doc.incoming_port or 143)

        # Login
        mail.login(email_account_doc.email_id, email_account_doc.get_password())

        # Select inbox
        mail.select('INBOX')

        # Search for unread emails
        status, messages = mail.search(None, 'UNSEEN')
        email_ids = messages[0].split()

        processed_count = 0

        for email_id in email_ids[-10:]:  # Process last 10 unread emails
            try:
                # Fetch the email
                status, msg_data = mail.fetch(email_id, '(RFC822)')
                raw_email = msg_data[0][1].decode('utf-8')

                # Process with BCC interception
                processed_email = intercept_incoming_email(email_account_doc.name, raw_email)

                # Create Communication record with processed email
                if processed_email and processed_email != raw_email:
                    create_communication_from_processed_email(processed_email, email_account_doc.name)
                    processed_count += 1
                    frappe.logger().info(f"Email Genius: Processed email {email_id} with BCC interception")
                else:
                    # Process normally if no BCC processing needed
                    create_communication_from_processed_email(raw_email, email_account_doc.name)

                # Mark as read
                mail.store(email_id, '+FLAGS', '\\Seen')

            except Exception as e:
                frappe.log_error(f"Email Genius: Error processing email {email_id}: {str(e)}", "Email Genius")
                continue

        mail.close()
        mail.logout()

        return processed_count

    except Exception as e:
        frappe.log_error(f"Email Genius IMAP Error: {str(e)}", "Email Genius")
        return 0

def process_pop_emails_with_bcc(email_account_doc):
    """
    Process POP emails with BCC interception
    """
    try:
        import poplib

        frappe.logger().info(f"Email Genius: Connecting to POP server for {email_account_doc.name}")

        # Connect to POP server
        if email_account_doc.use_ssl:
            mail = poplib.POP3_SSL(email_account_doc.email_server, email_account_doc.incoming_port or 995)
        else:
            mail = poplib.POP3(email_account_doc.email_server, email_account_doc.incoming_port or 110)

        # Login
        mail.user(email_account_doc.email_id)
        mail.pass_(email_account_doc.get_password())

        # Get message count
        num_messages = len(mail.list()[1])
        processed_count = 0

        # Process last 10 messages
        for i in range(max(1, num_messages - 9), num_messages + 1):
            try:
                # Retrieve the email
                raw_email_lines = mail.retr(i)[1]
                raw_email = b'\n'.join(raw_email_lines).decode('utf-8')

                # Process with BCC interception
                processed_email = intercept_incoming_email(email_account_doc.name, raw_email)

                # Create Communication record with processed email
                if processed_email and processed_email != raw_email:
                    create_communication_from_processed_email(processed_email, email_account_doc.name)
                    processed_count += 1
                    frappe.logger().info(f"Email Genius: Processed email {i} with BCC interception")
                else:
                    # Process normally if no BCC processing needed
                    create_communication_from_processed_email(raw_email, email_account_doc.name)

                # Delete the email if configured to do so
                if not email_account_doc.use_imap:  # POP typically deletes after retrieval
                    mail.dele(i)

            except Exception as e:
                frappe.log_error(f"Email Genius: Error processing POP email {i}: {str(e)}", "Email Genius")
                continue

        mail.quit()
        return processed_count

    except Exception as e:
        frappe.log_error(f"Email Genius POP Error: {str(e)}", "Email Genius")
        return 0

def process_account_for_bcc(email_account_name):
    """
    Process an email account to find emails with CC/BCC and create unique copies
    DEPRECATED: This function is kept for backward compatibility
    """
    try:
        frappe.logger().info(f"BCC Processing: Checking account {email_account_name} (deprecated method)")

        # Get recent unprocessed communications from this email account
        communications = frappe.get_all("Communication",
            filters={
                "email_account": email_account_name,
                "communication_medium": "Email",
                "sent_or_received": "Received",
                "custom_bcc_processed": 0  # Only unprocessed emails
            },
            fields=["name", "subject", "content", "message_id", "sender", "recipients", "raw_email"],
            limit=20,
            order_by="creation desc"
        )

        frappe.logger().info(f"BCC Processing: Found {len(communications)} unprocessed communications")

        processed_count = 0
        for comm in communications:
            try:
                # Get the full communication document
                comm_doc = frappe.get_doc("Communication", comm.name)

                # Check if this communication has raw email data to process
                if comm_doc.raw_email:
                    # Parse the raw email to check for CC/BCC recipients
                    import email
                    email_obj = email.message_from_string(comm_doc.raw_email)

                    # Extract recipients
                    to_recipients = parse_recipients(email_obj.get('To', ''))
                    cc_recipients = parse_recipients(email_obj.get('Cc', ''))
                    bcc_recipients = parse_recipients(email_obj.get('Bcc', ''))

                    all_recipients = to_recipients + cc_recipients + bcc_recipients

                    frappe.logger().info(f"BCC Processing: Email {comm.name} has {len(all_recipients)} total recipients")
                    
                    if len(all_recipients) > 1:
                        # Multiple recipients detected - process for BCC
                        processed_emails = create_unique_email_copies(email_obj, all_recipients, email_account_name)
                        frappe.logger().info(f"BCC Processing: Created {len(processed_emails)} unique email copies")
                        processed_count += 1
                
                # Mark as processed regardless
                frappe.db.set_value("Communication", comm.name, "custom_bcc_processed", 1)
                frappe.db.set_value("Communication", comm.name, "custom_recipient_type", "TO")
                
            except Exception as comm_error:
                frappe.logger().error(f"BCC Processing: Error processing communication {comm.name}: {str(comm_error)}")
                continue
        
        if communications:
            frappe.db.commit()
            frappe.logger().info(f"BCC Processing: Processed {processed_count} emails with multiple recipients")
        
        return processed_count
        
    except Exception as e:
        frappe.log_error(f"BCC Account Processing Error: {str(e)[:100]}", "Email Genius")
        return 0

def create_communication_from_processed_email(raw_email, email_account_name):
    """
    Create a Communication record from processed email
    """
    try:
        # Get the email account document
        email_account_doc = frappe.get_doc("Email Account", email_account_name)

        # Process the email using Frappe's standard method
        if hasattr(email_account_doc, 'insert_communication'):
            email_account_doc.insert_communication(raw_email)
        else:
            # Fallback: create Communication manually
            import email as email_lib
            email_obj = email_lib.message_from_string(raw_email)

            comm = frappe.new_doc("Communication")
            comm.communication_medium = "Email"
            comm.sent_or_received = "Received"
            comm.email_account = email_account_name
            comm.subject = email_obj.get('Subject', 'No Subject')
            comm.sender = email_obj.get('From', '')
            comm.content = email_obj.get_payload()
            comm.message_id = email_obj.get('Message-ID', '')
            comm.raw_email = raw_email
            comm.insert(ignore_permissions=True)

        frappe.logger().info(f"Email Genius: Created Communication record for email account {email_account_name}")

    except Exception as e:
        frappe.log_error(f"Email Genius: Error creating Communication: {str(e)}", "Email Genius")

# Test function for debugging
@frappe.whitelist()
def test_bcc_processing():
    """
    Test function to verify BCC processing is working
    """
    try:
        from svg_mobile_app.svg_mobile_app.doctype.bcc_processing_settings.bcc_processing_settings import get_bcc_settings
        settings = get_bcc_settings()
        if not settings:
            return {"status": "error", "message": "BCC settings not found"}

        enabled = settings.get("enable_bcc_processing", 0)
        gmail_account = settings.get("gmail_forwarding_account", "")

        return {
            "status": "success",
            "message": "BCC processing test completed",
            "settings": {
                "enabled": enabled,
                "gmail_account": gmail_account,
                "processing_method": settings.get("processing_method", ""),
                "debug_mode": settings.get("debug_mode", 0)
            }
        }
    except Exception as e:
        frappe.log_error(f"BCC test error: {str(e)}", "BCC Test Error")
        return {"status": "error", "message": str(e)}

@frappe.whitelist()
def diagnose_bcc_system():
    """
    Comprehensive diagnostic function for BCC processing system
    """
    try:
        results = {
            "status": "success",
            "timestamp": frappe.utils.now(),
            "checks": {}
        }

        # Check 1: BCC Processing Settings
        try:
            from svg_mobile_app.svg_mobile_app.doctype.bcc_processing_settings.bcc_processing_settings import get_bcc_settings
            settings = get_bcc_settings()
            if settings:
                results["checks"]["settings"] = {
                    "status": "ok",
                    "enabled": settings.get("enable_bcc_processing", 0),
                    "gmail_account": settings.get("gmail_forwarding_account", ""),
                    "processing_method": settings.get("processing_method", ""),
                    "debug_mode": settings.get("debug_mode", 0)
                }
            else:
                results["checks"]["settings"] = {"status": "error", "message": "Settings not found"}
        except Exception as e:
            results["checks"]["settings"] = {"status": "error", "message": str(e)}

        # Check 2: Recent Communications
        try:
            recent_comms = frappe.get_all("Communication",
                filters={
                    "communication_medium": "Email",
                    "sent_or_received": "Received",
                    "creation": [">=", frappe.utils.add_hours(frappe.utils.now(), -24)]
                },
                fields=["name", "subject", "sender", "recipients", "custom_bcc_processed", "message_id"],
                limit=10,
                order_by="creation desc"
            )

            total_emails = len(recent_comms)
            processed_emails = len([c for c in recent_comms if c.get("custom_bcc_processed")])
            multi_recipient_emails = len([c for c in recent_comms if c.get("recipients") and ("," in c.get("recipients", "") or ";" in c.get("recipients", ""))])

            results["checks"]["recent_emails"] = {
                "status": "ok",
                "total_last_24h": total_emails,
                "bcc_processed": processed_emails,
                "multi_recipient": multi_recipient_emails,
                "sample_emails": recent_comms[:3]
            }
        except Exception as e:
            results["checks"]["recent_emails"] = {"status": "error", "message": str(e)}

        # Check 3: Custom Fields
        try:
            custom_fields = frappe.get_all("Custom Field",
                filters={"dt": "Communication", "fieldname": ["like", "custom_%"]},
                fields=["fieldname", "fieldtype", "label"]
            )
            results["checks"]["custom_fields"] = {
                "status": "ok",
                "fields": custom_fields
            }
        except Exception as e:
            results["checks"]["custom_fields"] = {"status": "error", "message": str(e)}

        # Check 4: Hook Configuration
        try:
            import svg_mobile_app.hooks as hooks_module
            doc_events = getattr(hooks_module, 'doc_events', {})
            override_methods = getattr(hooks_module, 'override_whitelisted_methods', {})

            results["checks"]["hooks"] = {
                "status": "ok",
                "communication_hooks": doc_events.get("Communication", {}),
                "email_overrides": override_methods
            }
        except Exception as e:
            results["checks"]["hooks"] = {"status": "error", "message": str(e)}

        return results

    except Exception as e:
        return {"status": "error", "message": str(e)}
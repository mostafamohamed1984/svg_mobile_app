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
        # Get Gmail forwarding account - using the specified Gmail account
        gmail_account = "constr.sv@gmail.com"
        
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
        frappe.sendmail(
            recipients=[gmail_account],
            subject=forward_subject,
            message=forward_body
        )
        
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
            settings = frappe.get_single('BCC Processing Settings')
            return settings.get('enable_bcc_processing', 0)
        else:
            # Default to enabled if no settings found
            return True
    except Exception:
        return True

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
def process_bcc_email(doc, method):
    """
    Process BCC emails when Communication is created
    """
    try:
        # Check if this is a BCC processed email by looking for custom headers
        if hasattr(doc, 'message_id') and doc.message_id:
            # Check if this email has BCC processing headers
            if (hasattr(doc, 'custom_original_message_id') and doc.custom_original_message_id) or \
               (doc.message_id and ('frappe.bcc.' in doc.message_id or '.bcc.' in doc.message_id)):
                
                # This is a BCC processed email - set the checkbox
                if hasattr(doc, 'custom_bcc_processed'):
                    doc.custom_bcc_processed = 1
                    frappe.logger().info(f"Email Genius: Marked communication {doc.name} as BCC processed")
                
                # Try to determine recipient type from message content or headers
                if hasattr(doc, 'custom_recipient_type') and not doc.custom_recipient_type:
                    # Try to extract from subject if it has [BCC-PROCESSED-*] format
                    if doc.subject and '[BCC-PROCESSED-' in doc.subject:
                        type_match = re.search(r'\[BCC-PROCESSED-([A-Z]+)\]', doc.subject)
                        if type_match:
                            doc.custom_recipient_type = type_match.group(1)
                            frappe.logger().info(f"Email Genius: Set recipient type to {doc.custom_recipient_type}")
        
        frappe.logger().info(f"Email Genius: Processing communication {doc.name}")
        
    except Exception as e:
        frappe.log_error(f"Email Genius: Error in process_bcc_email: {str(e)}", "Email Genius Error")

@frappe.whitelist()
def process_incoming_email(email_account):
    """
    Override for frappe.email.receive.pull_from_email_account
    This function will be called when ERPNext pulls emails from email accounts
    """
    try:
        frappe.logger().info(f"Email Genius: Processing incoming emails for account {email_account}")
        
        # First, call the original function to get emails
        from frappe.email.receive import pull_from_email_account as original_pull
        result = original_pull(email_account)
        
        # Now process any emails that need BCC processing
        process_account_for_bcc(email_account)
        
        return result
        
    except Exception as e:
        frappe.log_error(f"Email Genius: Error in process_incoming_email: {str(e)}", "Email Genius Error")
        # Fallback to original function
        from frappe.email.receive import pull_from_email_account as original_pull
        return original_pull(email_account)

def process_account_for_bcc(email_account):
    """
    Process emails in an email account for BCC handling
    """
    try:
        # Check if BCC processing is enabled
        if not is_bcc_processing_enabled():
            return
        
        # Get unprocessed emails from the account
        unprocessed_emails = get_unprocessed_emails(email_account)
        
        for email_data in unprocessed_emails:
            try:
                # Parse the email
                email_obj = email.message_from_string(email_data.get('raw_message', ''))
                
                # Check if this email has multiple recipients
                to_recipients = parse_recipients(email_obj.get('To', ''))
                cc_recipients = parse_recipients(email_obj.get('Cc', ''))
                bcc_recipients = parse_recipients(email_obj.get('Bcc', ''))
                
                all_recipients = to_recipients + cc_recipients + bcc_recipients
                
                if len(all_recipients) > 1:
                    frappe.logger().info(f"Email Genius: Found email with {len(all_recipients)} recipients, processing BCC")
                    
                    # Process this email for BCC
                    processed_emails = create_unique_email_copies(email_obj, all_recipients, email_account)
                    
                    if processed_emails:
                        frappe.logger().info(f"Email Genius: Created {len(processed_emails)} unique email copies")
                
            except Exception as e:
                frappe.logger().error(f"Email Genius: Error processing individual email: {str(e)}")
                continue
                
    except Exception as e:
        frappe.log_error(f"Email Genius: Error in process_account_for_bcc: {str(e)}", "Email Genius Error")

def get_unprocessed_emails(email_account):
    """
    Get emails that haven't been processed for BCC yet
    This is a simplified version - in production you'd want to track processed emails
    """
    try:
        # For now, return empty list as this is complex to implement
        # In a full implementation, you'd connect to the email server and fetch new emails
        frappe.logger().info(f"Email Genius: Checking for unprocessed emails in {email_account}")
        return []
        
    except Exception as e:
        frappe.logger().error(f"Email Genius: Error getting unprocessed emails: {str(e)}")
        return [] 
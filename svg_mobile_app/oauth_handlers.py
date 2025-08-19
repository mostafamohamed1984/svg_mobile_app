import frappe
from frappe import _
from urllib.parse import parse_qs, urlparse
import requests
import json

@frappe.whitelist(allow_guest=True)
def oauth2_callback():
    """Handle OAuth2 callback from provider"""
    try:
        # Get authorization code and state from callback
        code = frappe.form_dict.get('code')
        error = frappe.form_dict.get('error')
        state = frappe.form_dict.get('state')  # Can be used to identify provider
        
        if error:
            frappe.log_error(f"OAuth2 callback error: {error}", "OAuth Callback Error")
            return f"""
            <html>
                <body>
                    <h2>Authorization Failed</h2>
                    <p>Error: {error}</p>
                    <p>Please close this window and try again.</p>
                </body>
            </html>
            """
        
        if not code:
            return f"""
            <html>
                <body>
                    <h2>Authorization Failed</h2>
                    <p>No authorization code received.</p>
                    <p>Please close this window and try again.</p>
                </body>
            </html>
            """
        
        # For now, we'll try to match against available OAuth settings
        # In production, you'd use the state parameter to identify the exact provider
        oauth_providers = frappe.get_all("Email OAuth Settings", 
                                        filters={"enabled": 1}, 
                                        fields=["name", "provider"])
        
        success_count = 0
        error_messages = []
        
        for provider in oauth_providers:
            try:
                from svg_mobile_app.svg_mobile_app.doctype.email_oauth_settings.email_oauth_settings import exchange_code_for_tokens
                result = exchange_code_for_tokens(provider.name, code)
                
                if result.get("success"):
                    success_count += 1
                    frappe.log_error(f"Successfully authorized {provider.provider}", "OAuth Success")
                else:
                    error_messages.append(f"{provider.provider}: {result.get('error', 'Unknown error')}")
            except Exception as e:
                error_messages.append(f"{provider.provider}: {str(e)}")
        
        if success_count > 0:
            return f"""
            <html>
                <body>
                    <h2>Authorization Successful!</h2>
                    <p>Successfully authorized {success_count} email provider(s).</p>
                    <p>You can now close this window and return to ERPNext.</p>
                    <script>
                        setTimeout(function() {{
                            window.close();
                        }}, 3000);
                    </script>
                </body>
            </html>
            """
        else:
            return f"""
            <html>
                <body>
                    <h2>Authorization Failed</h2>
                    <p>Failed to authorize email providers:</p>
                    <ul>
                        {''.join([f'<li>{msg}</li>' for msg in error_messages])}
                    </ul>
                    <p>Please close this window and check your OAuth settings.</p>
                </body>
            </html>
            """
            
    except Exception as e:
        frappe.log_error(f"OAuth2 callback handler error: {str(e)}", "OAuth Callback Error")
        return f"""
        <html>
            <body>
                <h2>System Error</h2>
                <p>An error occurred while processing the authorization: {str(e)}</p>
                <p>Please close this window and contact your system administrator.</p>
            </body>
        </html>
        """

@frappe.whitelist()
def initiate_oauth_flow(provider_name):
    """Initiate OAuth2 flow for a specific provider"""
    try:
        from svg_mobile_app.svg_mobile_app.doctype.email_oauth_settings.email_oauth_settings import get_authorization_url
        result = get_authorization_url(provider_name)
        
        if result.get("success"):
            return {
                "success": True,
                "auth_url": result.get("auth_url"),
                "message": f"Please complete authorization for {result.get('provider')} in the new window."
            }
        else:
            return {
                "success": False,
                "error": result.get("error")
            }
            
    except Exception as e:
        frappe.log_error(f"OAuth flow initiation error: {str(e)}", "OAuth Flow Error")
        return {
            "success": False,
            "error": str(e)
        }

@frappe.whitelist()
def test_oauth_connection(provider_name):
    """Test OAuth2 connection by making a simple API call"""
    try:
        from svg_mobile_app.svg_mobile_app.doctype.email_oauth_settings.email_oauth_settings import get_valid_access_token
        
        access_token = get_valid_access_token(provider_name)
        if not access_token:
            return {
                "success": False,
                "error": "No valid access token available. Please re-authorize."
            }
        
        oauth_settings = frappe.get_doc("Email OAuth Settings", provider_name)
        
        # Test API call based on provider
        headers = {"Authorization": f"Bearer {access_token}"}
        
        if oauth_settings.provider == "Gmail":
            # Test Gmail API
            response = requests.get(
                "https://gmail.googleapis.com/gmail/v1/users/me/profile",
                headers=headers
            )
        elif oauth_settings.provider == "Microsoft 365":
            # Test Microsoft Graph API
            response = requests.get(
                "https://graph.microsoft.com/v1.0/me",
                headers=headers
            )
        else:
            return {"success": False, "error": "Unknown provider"}
        
        if response.status_code == 200:
            user_info = response.json()
            return {
                "success": True,
                "message": f"Connection successful for {oauth_settings.provider}",
                "user_info": user_info
            }
        else:
            return {
                "success": False,
                "error": f"API test failed: {response.status_code} - {response.text}"
            }
            
    except Exception as e:
        frappe.log_error(f"OAuth connection test error: {str(e)}", "OAuth Test Error")
        return {
            "success": False,
            "error": str(e)
        }

def send_email_via_oauth(provider_name, to_email, subject, body, attachments=None):
    """Send email using OAuth2-authenticated provider"""
    try:
        from svg_mobile_app.svg_mobile_app.doctype.email_oauth_settings.email_oauth_settings import get_valid_access_token
        
        access_token = get_valid_access_token(provider_name)
        if not access_token:
            raise Exception("No valid access token available")
        
        oauth_settings = frappe.get_doc("Email OAuth Settings", provider_name)
        headers = {"Authorization": f"Bearer {access_token}"}
        
        if oauth_settings.provider == "Gmail":
            return _send_gmail_message(headers, to_email, subject, body, attachments)
        elif oauth_settings.provider == "Microsoft 365":
            return _send_outlook_message(headers, to_email, subject, body, attachments)
        else:
            raise Exception("Unsupported provider")
            
    except Exception as e:
        frappe.log_error(f"OAuth email send error: {str(e)}", "OAuth Email Error")
        raise e

def _send_gmail_message(headers, to_email, subject, body, attachments=None):
    """Send email via Gmail API"""
    import base64
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    from email.mime.base import MIMEBase
    from email import encoders
    
    # Create message
    if attachments:
        message = MIMEMultipart()
    else:
        message = MIMEText(body, 'html')
    
    if attachments:
        message.attach(MIMEText(body, 'html'))
        
        # Add attachments
        for attachment in attachments:
            part = MIMEBase('application', 'octet-stream')
            part.set_payload(attachment['content'])
            encoders.encode_base64(part)
            part.add_header(
                'Content-Disposition',
                f'attachment; filename= {attachment["filename"]}'
            )
            message.attach(part)
    
    message['to'] = to_email
    message['subject'] = subject
    
    # Encode message
    raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
    
    # Send via Gmail API
    response = requests.post(
        "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
        headers={**headers, "Content-Type": "application/json"},
        json={"raw": raw_message}
    )
    
    return response.status_code == 200

def _send_outlook_message(headers, to_email, subject, body, attachments=None):
    """Send email via Microsoft Graph API"""
    message_data = {
        "message": {
            "subject": subject,
            "body": {
                "contentType": "HTML",
                "content": body
            },
            "toRecipients": [
                {
                    "emailAddress": {
                        "address": to_email
                    }
                }
            ]
        }
    }
    
    # Add attachments if provided
    if attachments:
        message_data["message"]["attachments"] = []
        for attachment in attachments:
            message_data["message"]["attachments"].append({
                "@odata.type": "#microsoft.graph.fileAttachment",
                "name": attachment["filename"],
                "contentBytes": attachment["content"]  # Should be base64 encoded
            })
    
    # Send via Microsoft Graph API
    response = requests.post(
        "https://graph.microsoft.com/v1.0/me/sendMail",
        headers={**headers, "Content-Type": "application/json"},
        json=message_data
    )
    
    return response.status_code == 202

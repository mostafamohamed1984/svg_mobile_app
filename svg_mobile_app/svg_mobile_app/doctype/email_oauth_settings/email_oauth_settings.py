# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import requests
import json
from datetime import datetime, timedelta
from urllib.parse import urlencode, parse_qs, urlparse

class EmailOAuthSettings(Document):
    def validate(self):
        """Set provider-specific URLs based on provider selection"""
        if self.provider == "Gmail":
            self.authorization_url = "https://accounts.google.com/o/oauth2/auth"
            self.token_url = "https://oauth2.googleapis.com/token"
            self.scope = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly"
        elif self.provider == "Microsoft 365":
            if not self.tenant_id:
                frappe.throw("Tenant ID is required for Microsoft 365")
            self.authorization_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/authorize"
            self.token_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
            self.scope = "https://graph.microsoft.com/mail.send https://graph.microsoft.com/mail.read"
        
        # Set redirect URI
        site_url = frappe.utils.get_url()
        self.redirect_uri = f"{site_url}/api/method/svg_mobile_app.oauth_handlers.oauth2_callback"

@frappe.whitelist()
def get_authorization_url(provider_name):
    """Generate OAuth2 authorization URL"""
    try:
        oauth_settings = frappe.get_doc("Email OAuth Settings", provider_name)
        
        params = {
            "client_id": oauth_settings.client_id,
            "redirect_uri": oauth_settings.redirect_uri,
            "scope": oauth_settings.scope,
            "response_type": "code",
            "access_type": "offline",  # For refresh tokens
            "prompt": "consent"  # Force consent screen to get refresh token
        }
        
        if oauth_settings.provider == "Microsoft 365":
            params["response_mode"] = "query"
        
        auth_url = f"{oauth_settings.authorization_url}?{urlencode(params)}"
        
        return {
            "success": True,
            "auth_url": auth_url,
            "provider": oauth_settings.provider
        }
    except Exception as e:
        frappe.log_error(f"OAuth authorization URL generation error: {str(e)}", "OAuth Error")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def exchange_code_for_tokens(provider_name, authorization_code):
    """Exchange authorization code for access and refresh tokens"""
    try:
        oauth_settings = frappe.get_doc("Email OAuth Settings", provider_name)
        
        token_data = {
            "client_id": oauth_settings.client_id,
            "client_secret": oauth_settings.get_password("client_secret"),
            "code": authorization_code,
            "grant_type": "authorization_code",
            "redirect_uri": oauth_settings.redirect_uri
        }
        
        if oauth_settings.provider == "Gmail":
            token_data["access_type"] = "offline"
        
        response = requests.post(oauth_settings.token_url, data=token_data)
        
        if response.status_code == 200:
            token_response = response.json()
            
            # Calculate token expiry
            expires_in = token_response.get("expires_in", 3600)
            expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            # Update OAuth settings with tokens
            oauth_settings.access_token = token_response.get("access_token")
            oauth_settings.refresh_token = token_response.get("refresh_token")
            oauth_settings.token_expires_at = expires_at
            oauth_settings.save(ignore_permissions=True)
            
            return {
                "success": True,
                "message": f"OAuth2 tokens obtained successfully for {provider_name}"
            }
        else:
            error_msg = f"Token exchange failed: {response.status_code} - {response.text}"
            frappe.log_error(error_msg, "OAuth Token Exchange Error")
            return {"success": False, "error": error_msg}
            
    except Exception as e:
        frappe.log_error(f"OAuth token exchange error: {str(e)}", "OAuth Error")
        return {"success": False, "error": str(e)}

@frappe.whitelist()
def refresh_access_token(provider_name):
    """Refresh expired access token using refresh token"""
    try:
        oauth_settings = frappe.get_doc("Email OAuth Settings", provider_name)
        
        if not oauth_settings.refresh_token:
            return {"success": False, "error": "No refresh token available"}
        
        token_data = {
            "client_id": oauth_settings.client_id,
            "client_secret": oauth_settings.get_password("client_secret"),
            "refresh_token": oauth_settings.get_password("refresh_token"),
            "grant_type": "refresh_token"
        }
        
        response = requests.post(oauth_settings.token_url, data=token_data)
        
        if response.status_code == 200:
            token_response = response.json()
            
            # Calculate token expiry
            expires_in = token_response.get("expires_in", 3600)
            expires_at = datetime.now() + timedelta(seconds=expires_in)
            
            # Update OAuth settings with new access token
            oauth_settings.access_token = token_response.get("access_token")
            oauth_settings.token_expires_at = expires_at
            
            # Update refresh token if provided (some providers rotate refresh tokens)
            if token_response.get("refresh_token"):
                oauth_settings.refresh_token = token_response.get("refresh_token")
            
            oauth_settings.save(ignore_permissions=True)
            
            return {
                "success": True,
                "access_token": token_response.get("access_token")
            }
        else:
            error_msg = f"Token refresh failed: {response.status_code} - {response.text}"
            frappe.log_error(error_msg, "OAuth Token Refresh Error")
            return {"success": False, "error": error_msg}
            
    except Exception as e:
        frappe.log_error(f"OAuth token refresh error: {str(e)}", "OAuth Error")
        return {"success": False, "error": str(e)}

def get_valid_access_token(provider_name):
    """Get a valid access token, refreshing if necessary"""
    try:
        oauth_settings = frappe.get_doc("Email OAuth Settings", provider_name)
        
        # Check if token is expired or will expire in next 5 minutes
        if (not oauth_settings.token_expires_at or 
            oauth_settings.token_expires_at < datetime.now() + timedelta(minutes=5)):
            
            # Try to refresh token
            refresh_result = refresh_access_token(provider_name)
            if not refresh_result.get("success"):
                return None
            
            return refresh_result.get("access_token")
        
        return oauth_settings.get_password("access_token")
        
    except Exception as e:
        frappe.log_error(f"Get valid access token error: {str(e)}", "OAuth Error")
        return None

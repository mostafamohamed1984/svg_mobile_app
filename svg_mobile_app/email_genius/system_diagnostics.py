"""
System Diagnostics and Configuration Validation
Comprehensive system validation, diagnostics, and troubleshooting tools
"""

import frappe
from frappe.utils import now_datetime
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple
import json
import re
from .email_logger import EmailLogger

class EmailSystemDiagnostics:
    """Comprehensive diagnostics for email system"""
    
    def __init__(self):
        self.logger = EmailLogger("diagnostics")
        self.validation_errors = []
        self.validation_warnings = []
        self.validation_info = []
    
    def run_full_diagnostics(self) -> Dict[str, Any]:
        """Run comprehensive system diagnostics"""
        diagnostics = {
            "timestamp": now_datetime().isoformat(),
            "overall_status": "unknown",
            "validation_results": {},
            "configuration_status": {},
            "system_health": {},
            "recommendations": [],
            "errors": self.validation_errors,
            "warnings": self.validation_warnings,
            "info": self.validation_info
        }
        
        try:
            # Reset validation lists
            self.validation_errors = []
            self.validation_warnings = []
            self.validation_info = []
            
            # Run all diagnostic checks
            diagnostics["configuration_status"] = self._validate_configuration()
            diagnostics["validation_results"] = self._validate_system_integrity()
            diagnostics["system_health"] = self._check_system_health()
            diagnostics["recommendations"] = self._generate_recommendations()
            
            # Determine overall status
            if self.validation_errors:
                diagnostics["overall_status"] = "critical"
            elif self.validation_warnings:
                diagnostics["overall_status"] = "warning"
            else:
                diagnostics["overall_status"] = "healthy"
            
            # Update final lists
            diagnostics["errors"] = self.validation_errors
            diagnostics["warnings"] = self.validation_warnings
            diagnostics["info"] = self.validation_info
            
        except Exception as e:
            diagnostics["overall_status"] = "error"
            diagnostics["system_error"] = str(e)
            self.logger.log_operation("diagnostics_error", {"error": str(e)}, "error")
        
        return diagnostics
    
    def _validate_configuration(self) -> Dict[str, Any]:
        """Validate all configuration settings"""
        config_status = {
            "bcc_processing_settings": self._validate_bcc_processing_settings(),
            "forward_emails_control": self._validate_forward_emails_control(),
            "email_accounts": self._validate_email_accounts(),
            "oauth_settings": self._validate_oauth_settings(),
            "custom_fields": self._validate_custom_fields(),
            "hooks_configuration": self._validate_hooks_configuration()
        }
        
        return config_status
    
    def _validate_bcc_processing_settings(self) -> Dict[str, Any]:
        """Validate BCC Processing Settings configuration"""
        try:
            if not frappe.db.exists("DocType", "BCC Processing Settings"):
                self.validation_errors.append("BCC Processing Settings DocType not found")
                return {"status": "error", "message": "DocType missing"}
            
            settings = frappe.get_single("BCC Processing Settings")
            issues = []
            recommendations = []
            
            # Check required settings
            if settings.enable_bcc_processing:
                if not settings.gmail_forwarding_account:
                    issues.append("Gmail forwarding account not configured")
                
                if settings.enable_role_based_forwarding:
                    if not settings.main_email_account:
                        issues.append("Main email account not configured for role-based forwarding")
                    if not settings.engineer_role_name:
                        issues.append("Engineer role name not configured")
                
                # Validate SMTP override settings
                if settings.processing_server:
                    if not settings.processing_port:
                        recommendations.append("Processing port not specified, will use default")
                    
                    if not settings.use_ssl and not settings.use_tls:
                        self.validation_warnings.append("Neither SSL nor TLS enabled for SMTP override")
                
                # Validate OAuth2 settings
                if settings.use_oauth2:
                    if not settings.oauth_provider:
                        issues.append("OAuth provider not selected")
                    if not settings.oauth_client_id:
                        issues.append("OAuth client ID not configured")
                    if not settings.oauth_client_secret:
                        issues.append("OAuth client secret not configured")
                    
                    if settings.oauth_provider == "Microsoft 365" and not settings.oauth_tenant:
                        issues.append("OAuth tenant ID required for Microsoft 365")
            
            # Check timestamp format
            if settings.enable_subject_timestamping:
                timestamp_format = settings.subject_timestamp_format or "[%Y-%m-%d %H:%M:%S]"
                try:
                    test_timestamp = datetime.now().strftime(timestamp_format)
                    self.validation_info.append(f"Subject timestamp format valid: {test_timestamp}")
                except Exception as e:
                    issues.append(f"Invalid timestamp format: {str(e)}")
            
            status = "error" if issues else ("warning" if recommendations else "valid")
            
            return {
                "status": status,
                "issues": issues,
                "recommendations": recommendations,
                "settings_summary": {
                    "bcc_processing_enabled": settings.enable_bcc_processing,
                    "role_forwarding_enabled": settings.enable_role_based_forwarding,
                    "subject_timestamping_enabled": settings.enable_subject_timestamping,
                    "oauth2_enabled": settings.use_oauth2
                }
            }
            
        except Exception as e:
            self.validation_errors.append(f"Error validating BCC Processing Settings: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def _validate_forward_emails_control(self) -> Dict[str, Any]:
        """Validate Forward Emails Control configuration"""
        try:
            if not frappe.db.exists("DocType", "Forward Emails Control"):
                self.validation_errors.append("Forward Emails Control DocType not found")
                return {"status": "error", "message": "DocType missing"}
            
            controls = frappe.get_all("Forward Emails Control", 
                                    fields=["name", "enabled", "target_role", "target_email_account"])
            
            issues = []
            active_controls = [c for c in controls if c.enabled]
            
            if not active_controls:
                self.validation_warnings.append("No active Forward Emails Control rules configured")
            
            # Validate each control
            for control in active_controls:
                if not frappe.db.exists("Role", control.target_role):
                    issues.append(f"Target role '{control.target_role}' does not exist")
                
                if not frappe.db.exists("Email Account", control.target_email_account):
                    issues.append(f"Target email account '{control.target_email_account}' does not exist")
            
            return {
                "status": "error" if issues else "valid",
                "total_rules": len(controls),
                "active_rules": len(active_controls),
                "issues": issues
            }
            
        except Exception as e:
            self.validation_errors.append(f"Error validating Forward Emails Control: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def _validate_email_accounts(self) -> Dict[str, Any]:
        """Validate Email Account configuration"""
        try:
            email_accounts = frappe.get_all("Email Account", 
                                          filters={"enable_incoming": 1},
                                          fields=["name", "email_id", "enable_incoming", "enable_outgoing"])
            
            issues = []
            
            if not email_accounts:
                self.validation_warnings.append("No email accounts configured for incoming emails")
            
            for account in email_accounts:
                # Check if account is properly configured
                account_doc = frappe.get_doc("Email Account", account.name)
                
                if not account_doc.email_server:
                    issues.append(f"Email server not configured for account: {account.name}")
                
                if not account_doc.email_id:
                    issues.append(f"Email ID not configured for account: {account.name}")
                
                # Test email account connectivity (basic check)
                try:
                    if hasattr(account_doc, 'get_password') and account_doc.get_password():
                        self.validation_info.append(f"Email account '{account.name}' has password configured")
                    else:
                        self.validation_warnings.append(f"Email account '{account.name}' may not have password configured")
                except Exception:
                    pass
            
            return {
                "status": "error" if issues else "valid",
                "total_accounts": len(email_accounts),
                "issues": issues
            }
            
        except Exception as e:
            self.validation_errors.append(f"Error validating Email Accounts: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def _validate_oauth_settings(self) -> Dict[str, Any]:
        """Validate OAuth settings configuration"""
        try:
            if not frappe.db.exists("DocType", "Email OAuth Settings"):
                return {"status": "not_configured", "message": "OAuth not configured"}
            
            oauth_settings = frappe.get_all("Email OAuth Settings", 
                                          filters={"enabled": 1},
                                          fields=["name", "provider", "client_id", "expires_at"])
            
            if not oauth_settings:
                return {"status": "not_configured", "message": "No OAuth providers configured"}
            
            issues = []
            expired_providers = []
            
            for provider in oauth_settings:
                provider_doc = frappe.get_doc("Email OAuth Settings", provider.name)
                
                if not provider_doc.client_id:
                    issues.append(f"Client ID not configured for provider: {provider.provider}")
                
                if not provider_doc.client_secret:
                    issues.append(f"Client secret not configured for provider: {provider.provider}")
                
                # Check token expiration
                if provider_doc.expires_at:
                    expires_at = datetime.fromisoformat(provider_doc.expires_at.replace('Z', '+00:00'))
                    if expires_at <= datetime.now():
                        expired_providers.append(provider.provider)
            
            if expired_providers:
                self.validation_warnings.append(f"OAuth tokens expired for: {', '.join(expired_providers)}")
            
            return {
                "status": "error" if issues else ("warning" if expired_providers else "valid"),
                "total_providers": len(oauth_settings),
                "expired_providers": expired_providers,
                "issues": issues
            }
            
        except Exception as e:
            self.validation_errors.append(f"Error validating OAuth settings: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def _validate_custom_fields(self) -> Dict[str, Any]:
        """Validate custom fields are properly installed"""
        try:
            required_fields = [
                ("Communication", "custom_recipient_type"),
                ("Communication", "custom_original_message_id"),
                ("Communication", "custom_bcc_processed"),
                ("Communication", "custom_recipient_index"),
                ("Communication", "custom_role_forwarded")
            ]
            
            missing_fields = []
            
            for doctype, fieldname in required_fields:
                if not frappe.db.exists("Custom Field", {"dt": doctype, "fieldname": fieldname}):
                    missing_fields.append(f"{doctype}.{fieldname}")
            
            if missing_fields:
                self.validation_errors.append(f"Missing custom fields: {', '.join(missing_fields)}")
                return {"status": "error", "missing_fields": missing_fields}
            
            return {"status": "valid", "message": "All required custom fields present"}
            
        except Exception as e:
            self.validation_errors.append(f"Error validating custom fields: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def _validate_hooks_configuration(self) -> Dict[str, Any]:
        """Validate hooks are properly configured"""
        try:
            import svg_mobile_app.hooks as hooks_module
            
            issues = []
            
            # Check doc_events
            doc_events = getattr(hooks_module, 'doc_events', {})
            communication_hooks = doc_events.get('Communication', {})
            
            if 'before_insert' not in communication_hooks:
                issues.append("Communication before_insert hook not configured")
            elif 'process_bcc_email' not in str(communication_hooks['before_insert']):
                issues.append("BCC processing hook not in before_insert")
            
            if 'after_insert' not in communication_hooks:
                issues.append("Communication after_insert hook not configured")
            else:
                after_insert_hooks = communication_hooks['after_insert']
                if isinstance(after_insert_hooks, list):
                    hook_functions = [str(hook) for hook in after_insert_hooks]
                    if not any('process_role_based_forwarding' in hook for hook in hook_functions):
                        issues.append("Role-based forwarding hook not configured")
                    if not any('create_email_monitoring_record' in hook for hook in hook_functions):
                        issues.append("Email monitoring creation hook not configured")
            
            # Check scheduler events
            scheduler_events = getattr(hooks_module, 'scheduler_events', {})
            daily_events = scheduler_events.get('daily', [])
            
            escalation_scheduled = any('escalation' in str(event) for event in daily_events)
            if not escalation_scheduled:
                issues.append("Escalation scheduler not configured")
            
            # Check before_inbound_communication_insert hook
            inbound_hooks = getattr(hooks_module, 'before_inbound_communication_insert', [])
            if not inbound_hooks:
                self.validation_warnings.append("Inbound communication pre-insert hook not configured")
            
            return {
                "status": "error" if issues else "valid",
                "issues": issues,
                "hooks_summary": {
                    "communication_hooks_configured": bool(communication_hooks),
                    "scheduler_configured": bool(daily_events),
                    "inbound_hooks_configured": bool(inbound_hooks)
                }
            }
            
        except Exception as e:
            self.validation_errors.append(f"Error validating hooks configuration: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def _validate_system_integrity(self) -> Dict[str, Any]:
        """Validate system data integrity"""
        try:
            integrity_checks = {
                "orphaned_monitoring_records": self._check_orphaned_monitoring_records(),
                "missing_monitoring_records": self._check_missing_monitoring_records(),
                "duplicate_message_ids": self._check_duplicate_message_ids(),
                "unprocessed_emails": self._check_unprocessed_emails(),
                "broken_relations": self._check_broken_communication_relations()
            }
            
            return integrity_checks
            
        except Exception as e:
            self.validation_errors.append(f"Error validating system integrity: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    def _check_orphaned_monitoring_records(self) -> Dict[str, Any]:
        """Check for Email Monitoring records without corresponding Communications"""
        try:
            orphaned = frappe.db.sql("""
                SELECT em.name, em.communication
                FROM `tabEmail Monitoring` em
                LEFT JOIN `tabCommunication` c ON em.communication = c.name
                WHERE c.name IS NULL
                LIMIT 10
            """, as_dict=True)
            
            if orphaned:
                self.validation_warnings.append(f"Found {len(orphaned)} orphaned Email Monitoring records")
            
            return {
                "status": "warning" if orphaned else "valid",
                "count": len(orphaned),
                "samples": orphaned[:5]
            }
            
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def _check_missing_monitoring_records(self) -> Dict[str, Any]:
        """Check for Communications without Email Monitoring records"""
        try:
            missing = frappe.db.sql("""
                SELECT c.name, c.subject, c.creation
                FROM `tabCommunication` c
                LEFT JOIN `tabEmail Monitoring` em ON c.name = em.communication
                WHERE c.communication_medium = 'Email'
                AND c.sent_or_received = 'Received'
                AND em.name IS NULL
                AND c.creation >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                LIMIT 10
            """, as_dict=True)
            
            if missing:
                self.validation_warnings.append(f"Found {len(missing)} Communications without Email Monitoring records")
            
            return {
                "status": "warning" if missing else "valid",
                "count": len(missing),
                "samples": missing[:5]
            }
            
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def _check_duplicate_message_ids(self) -> Dict[str, Any]:
        """Check for duplicate message IDs"""
        try:
            duplicates = frappe.db.sql("""
                SELECT message_id, COUNT(*) as count
                FROM `tabCommunication`
                WHERE message_id IS NOT NULL AND message_id != ''
                GROUP BY message_id
                HAVING COUNT(*) > 1
                LIMIT 10
            """, as_dict=True)
            
            if duplicates:
                self.validation_warnings.append(f"Found {len(duplicates)} duplicate message IDs")
            
            return {
                "status": "warning" if duplicates else "valid",
                "count": len(duplicates),
                "samples": duplicates[:5]
            }
            
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def _check_unprocessed_emails(self) -> Dict[str, Any]:
        """Check for unprocessed emails that should have been processed"""
        try:
            unprocessed = frappe.db.sql("""
                SELECT name, subject, creation, recipients, cc, bcc
                FROM `tabCommunication`
                WHERE communication_medium = 'Email'
                AND sent_or_received = 'Received'
                AND (custom_bcc_processed = 0 OR custom_bcc_processed IS NULL)
                AND (cc IS NOT NULL AND cc != '' OR bcc IS NOT NULL AND bcc != '' OR recipients LIKE '%,%')
                AND creation >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
                LIMIT 10
            """, as_dict=True)
            
            if unprocessed:
                self.validation_warnings.append(f"Found {len(unprocessed)} unprocessed emails with CC/BCC")
            
            return {
                "status": "warning" if unprocessed else "valid",
                "count": len(unprocessed),
                "samples": unprocessed[:5]
            }
            
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def _check_broken_communication_relations(self) -> Dict[str, Any]:
        """Check for broken Communication Relation records"""
        try:
            broken = frappe.db.sql("""
                SELECT cr.name, cr.communication, cr.related_communication
                FROM `tabCommunication Relation` cr
                LEFT JOIN `tabCommunication` c1 ON cr.communication = c1.name
                LEFT JOIN `tabCommunication` c2 ON cr.related_communication = c2.name
                WHERE c1.name IS NULL OR c2.name IS NULL
                LIMIT 10
            """, as_dict=True)
            
            if broken:
                self.validation_warnings.append(f"Found {len(broken)} broken Communication Relations")
            
            return {
                "status": "warning" if broken else "valid",
                "count": len(broken),
                "samples": broken[:5]
            }
            
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def _check_system_health(self) -> Dict[str, Any]:
        """Check overall system health"""
        try:
            from .health_monitor import health_monitor
            health = health_monitor.get_system_health()
            
            return {
                "overall_status": health.get("overall_status", "unknown"),
                "component_count": len(health.get("components", {})),
                "alert_count": len(health.get("alerts", [])),
                "critical_alerts": [alert for alert in health.get("alerts", []) if alert.get("level") == "critical"]
            }
            
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def _generate_recommendations(self) -> List[Dict[str, Any]]:
        """Generate system recommendations based on diagnostics"""
        recommendations = []
        
        # Add recommendations based on validation results
        if self.validation_errors:
            recommendations.append({
                "priority": "high",
                "category": "critical_issues",
                "title": "Critical Configuration Issues",
                "description": f"Found {len(self.validation_errors)} critical issues that need immediate attention",
                "action": "Review and fix all configuration errors listed in the diagnostics"
            })
        
        if self.validation_warnings:
            recommendations.append({
                "priority": "medium",
                "category": "optimization",
                "title": "System Optimization",
                "description": f"Found {len(self.validation_warnings)} warnings that should be addressed",
                "action": "Review and address warning items to improve system reliability"
            })
        
        # Add performance recommendations
        try:
            comm_count = frappe.db.count("Communication", {"communication_medium": "Email"})
            if comm_count > 10000:
                recommendations.append({
                    "priority": "medium",
                    "category": "performance",
                    "title": "Database Performance",
                    "description": f"Large number of Communications ({comm_count:,}). Consider performance optimization.",
                    "action": "Run database index optimization and consider archiving old records"
                })
        except Exception:
            pass
        
        # Add monitoring recommendations
        try:
            open_monitoring = frappe.db.count("Email Monitoring", {"status": "Open"})
            if open_monitoring > 100:
                recommendations.append({
                    "priority": "medium",
                    "category": "monitoring",
                    "title": "Email Monitoring Backlog",
                    "description": f"Large number of open monitoring items ({open_monitoring})",
                    "action": "Review and process open email monitoring items"
                })
        except Exception:
            pass
        
        return recommendations
    
    def repair_system_issues(self, repair_options: List[str] = None) -> Dict[str, Any]:
        """Attempt to repair common system issues"""
        if repair_options is None:
            repair_options = ["orphaned_records", "missing_monitoring", "reset_circuit_breakers"]
        
        repair_results = {
            "attempted_repairs": [],
            "successful_repairs": [],
            "failed_repairs": [],
            "summary": {}
        }
        
        for repair_option in repair_options:
            try:
                repair_results["attempted_repairs"].append(repair_option)
                
                if repair_option == "orphaned_records":
                    result = self._repair_orphaned_records()
                elif repair_option == "missing_monitoring":
                    result = self._repair_missing_monitoring()
                elif repair_option == "reset_circuit_breakers":
                    result = self._repair_circuit_breakers()
                elif repair_option == "cleanup_old_logs":
                    result = self._cleanup_old_logs()
                else:
                    result = {"success": False, "message": f"Unknown repair option: {repair_option}"}
                
                if result.get("success"):
                    repair_results["successful_repairs"].append({
                        "repair": repair_option,
                        "result": result
                    })
                else:
                    repair_results["failed_repairs"].append({
                        "repair": repair_option,
                        "error": result.get("message", "Unknown error")
                    })
                    
            except Exception as e:
                repair_results["failed_repairs"].append({
                    "repair": repair_option,
                    "error": str(e)
                })
        
        repair_results["summary"] = {
            "total_attempted": len(repair_results["attempted_repairs"]),
            "successful": len(repair_results["successful_repairs"]),
            "failed": len(repair_results["failed_repairs"])
        }
        
        return repair_results
    
    def _repair_orphaned_records(self) -> Dict[str, Any]:
        """Remove orphaned Email Monitoring records"""
        try:
            orphaned = frappe.db.sql("""
                SELECT em.name
                FROM `tabEmail Monitoring` em
                LEFT JOIN `tabCommunication` c ON em.communication = c.name
                WHERE c.name IS NULL
            """, as_dict=True)
            
            deleted_count = 0
            for record in orphaned:
                try:
                    frappe.delete_doc("Email Monitoring", record.name, force=True)
                    deleted_count += 1
                except Exception:
                    pass
            
            if deleted_count > 0:
                frappe.db.commit()
            
            return {
                "success": True,
                "message": f"Deleted {deleted_count} orphaned Email Monitoring records",
                "deleted_count": deleted_count
            }
            
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    def _repair_missing_monitoring(self) -> Dict[str, Any]:
        """Create missing Email Monitoring records"""
        try:
            missing = frappe.db.sql("""
                SELECT c.name
                FROM `tabCommunication` c
                LEFT JOIN `tabEmail Monitoring` em ON c.name = em.communication
                WHERE c.communication_medium = 'Email'
                AND c.sent_or_received = 'Received'
                AND em.name IS NULL
                AND c.creation >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                LIMIT 50
            """, as_dict=True)
            
            created_count = 0
            for comm_record in missing:
                try:
                    from ..svg_mobile_app.doctype.email_monitoring.email_monitoring_hooks import create_email_monitoring_record
                    comm_doc = frappe.get_doc("Communication", comm_record.name)
                    create_email_monitoring_record(comm_doc)
                    created_count += 1
                except Exception:
                    pass
            
            if created_count > 0:
                frappe.db.commit()
            
            return {
                "success": True,
                "message": f"Created {created_count} missing Email Monitoring records",
                "created_count": created_count
            }
            
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    def _repair_circuit_breakers(self) -> Dict[str, Any]:
        """Reset stuck circuit breakers"""
        try:
            from .email_retry import retry_manager
            
            reset_count = 0
            for operation, cb in retry_manager.circuit_breakers.items():
                if cb.state == "OPEN":
                    cb.state = "CLOSED"
                    cb.failure_count = 0
                    cb.last_failure_time = None
                    reset_count += 1
            
            return {
                "success": True,
                "message": f"Reset {reset_count} circuit breakers",
                "reset_count": reset_count
            }
            
        except Exception as e:
            return {"success": False, "message": str(e)}
    
    def _cleanup_old_logs(self) -> Dict[str, Any]:
        """Clean up old error logs"""
        try:
            deleted_count = frappe.db.sql("""
                DELETE FROM `tabError Log`
                WHERE creation < DATE_SUB(NOW(), INTERVAL 30 DAY)
                AND method LIKE '%email_genius%'
            """)
            
            frappe.db.commit()
            
            return {
                "success": True,
                "message": f"Cleaned up old error logs",
                "deleted_count": deleted_count
            }
            
        except Exception as e:
            return {"success": False, "message": str(e)}

# Global diagnostics instance
system_diagnostics = EmailSystemDiagnostics()

@frappe.whitelist()
def run_system_diagnostics():
    """API endpoint to run system diagnostics"""
    try:
        diagnostics = system_diagnostics.run_full_diagnostics()
        return {
            "status": "success",
            "diagnostics": diagnostics
        }
    except Exception as e:
        frappe.log_error(f"System diagnostics error: {str(e)}", "Email System Diagnostics")
        return {
            "status": "error",
            "message": str(e)
        }

@frappe.whitelist()
def repair_system_issues(repair_options=None):
    """API endpoint to repair system issues"""
    try:
        if isinstance(repair_options, str):
            repair_options = json.loads(repair_options)
        
        repair_results = system_diagnostics.repair_system_issues(repair_options)
        return {
            "status": "success",
            "repair_results": repair_results
        }
    except Exception as e:
        frappe.log_error(f"System repair error: {str(e)}", "Email System Repair")
        return {
            "status": "error",
            "message": str(e)
        }

@frappe.whitelist()
def get_system_status_summary():
    """Get quick system status summary"""
    try:
        summary = {
            "timestamp": now_datetime().isoformat(),
            "quick_checks": {
                "total_communications": frappe.db.count("Communication", {"communication_medium": "Email"}),
                "bcc_processed": frappe.db.count("Communication", {"custom_bcc_processed": 1}),
                "monitoring_records": frappe.db.count("Email Monitoring"),
                "open_monitoring": frappe.db.count("Email Monitoring", {"status": "Open"}),
                "recent_errors": frappe.db.count("Error Log", {
                    "method": ["like", "%email_genius%"],
                    "creation": [">=", (datetime.now() - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")]
                })
            }
        }
        
        # Determine status
        if summary["quick_checks"]["recent_errors"] > 10:
            summary["status"] = "critical"
        elif summary["quick_checks"]["recent_errors"] > 5:
            summary["status"] = "warning"
        else:
            summary["status"] = "healthy"
        
        return {
            "status": "success",
            "summary": summary
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

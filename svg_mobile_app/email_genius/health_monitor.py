"""
Health Monitoring and Error Recovery for Email System
Provides system health checks, error recovery, and monitoring endpoints
"""

import frappe
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
from .email_logger import EmailLogger
from .email_retry import retry_manager

class EmailSystemHealthMonitor:
    """Comprehensive health monitoring for email system"""
    
    def __init__(self):
        self.logger = EmailLogger("health_monitor")
    
    def get_system_health(self) -> Dict[str, Any]:
        """Get comprehensive system health status"""
        health_status = {
            "timestamp": datetime.now().isoformat(),
            "overall_status": "healthy",
            "components": {},
            "metrics": {},
            "alerts": []
        }
        
        # Check individual components
        components = [
            ("email_processing", self._check_email_processing),
            ("bcc_processing", self._check_bcc_processing),
            ("monitoring_system", self._check_monitoring_system),
            ("escalation_system", self._check_escalation_system),
            ("database_health", self._check_database_health),
            ("configuration", self._check_configuration),
            ("oauth_integration", self._check_oauth_integration)
        ]
        
        unhealthy_components = 0
        
        for component_name, check_function in components:
            try:
                component_status = check_function()
                health_status["components"][component_name] = component_status
                
                if component_status["status"] != "healthy":
                    unhealthy_components += 1
                    if component_status["status"] == "critical":
                        health_status["alerts"].append({
                            "level": "critical",
                            "component": component_name,
                            "message": component_status.get("message", "Critical issue detected")
                        })
                    
            except Exception as e:
                unhealthy_components += 1
                health_status["components"][component_name] = {
                    "status": "error",
                    "message": f"Health check failed: {str(e)}"
                }
                health_status["alerts"].append({
                    "level": "error",
                    "component": component_name,
                    "message": f"Health check error: {str(e)}"
                })
        
        # Determine overall health
        if unhealthy_components == 0:
            health_status["overall_status"] = "healthy"
        elif unhealthy_components <= 2:
            health_status["overall_status"] = "degraded"
        else:
            health_status["overall_status"] = "unhealthy"
        
        # Add system metrics
        health_status["metrics"] = self._get_system_metrics()
        
        return health_status
    
    def _check_email_processing(self) -> Dict[str, Any]:
        """Check email processing component health"""
        try:
            # Check recent email processing activity
            recent_emails = frappe.db.count("Communication", {
                "communication_medium": "Email",
                "creation": [">=", (datetime.now() - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")]
            })
            
            # Check for processing errors
            recent_errors = frappe.db.count("Error Log", {
                "method": ["like", "%email_genius%"],
                "creation": [">=", (datetime.now() - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")]
            })
            
            status = "healthy"
            message = f"Processed {recent_emails} emails in last 24h"
            
            if recent_errors > 10:
                status = "critical"
                message = f"High error rate: {recent_errors} errors in last hour"
            elif recent_errors > 5:
                status = "warning"
                message = f"Elevated error rate: {recent_errors} errors in last hour"
            
            return {
                "status": status,
                "message": message,
                "metrics": {
                    "emails_24h": recent_emails,
                    "errors_1h": recent_errors
                }
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Health check failed: {str(e)}"
            }
    
    def _check_bcc_processing(self) -> Dict[str, Any]:
        """Check BCC processing component health"""
        try:
            # Check BCC processing settings
            settings = frappe.get_single("BCC Processing Settings")
            if not settings.enable_bcc_processing:
                return {
                    "status": "disabled",
                    "message": "BCC processing is disabled"
                }
            
            # Check recent BCC processing
            processed_count = frappe.db.count("Communication", {
                "custom_bcc_processed": 1,
                "creation": [">=", (datetime.now() - timedelta(hours=24)).strftime("%Y-%m-%d %H:%M:%S")]
            })
            
            # Check for unprocessed emails that should be processed
            unprocessed_count = frappe.db.count("Communication", {
                "communication_medium": "Email",
                "sent_or_received": "Received",
                "custom_bcc_processed": 0,
                "creation": [">=", (datetime.now() - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")]
            })
            
            status = "healthy"
            message = f"Processed {processed_count} BCC emails in last 24h"
            
            if unprocessed_count > 50:
                status = "critical"
                message = f"Large backlog: {unprocessed_count} unprocessed emails"
            elif unprocessed_count > 20:
                status = "warning"
                message = f"Processing backlog: {unprocessed_count} unprocessed emails"
            
            return {
                "status": status,
                "message": message,
                "metrics": {
                    "processed_24h": processed_count,
                    "unprocessed_1h": unprocessed_count
                }
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Health check failed: {str(e)}"
            }
    
    def _check_monitoring_system(self) -> Dict[str, Any]:
        """Check email monitoring system health"""
        try:
            # Check monitoring records
            total_monitoring = frappe.db.count("Email Monitoring")
            open_count = frappe.db.count("Email Monitoring", {"status": "Open"})
            overdue_count = frappe.db.count("Email Monitoring", {
                "status": "Need Reply",
                "modified": ["<", (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d %H:%M:%S")]
            })
            
            status = "healthy"
            message = f"Monitoring {total_monitoring} email records"
            
            if overdue_count > 100:
                status = "critical"
                message = f"Critical: {overdue_count} severely overdue items"
            elif overdue_count > 50:
                status = "warning"
                message = f"Warning: {overdue_count} overdue items"
            
            return {
                "status": status,
                "message": message,
                "metrics": {
                    "total_monitoring": total_monitoring,
                    "open_items": open_count,
                    "overdue_items": overdue_count
                }
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Health check failed: {str(e)}"
            }
    
    def _check_escalation_system(self) -> Dict[str, Any]:
        """Check escalation system health"""
        try:
            # Check if scheduler is running
            from frappe.utils.scheduler import is_scheduler_inactive
            
            if is_scheduler_inactive():
                return {
                    "status": "critical",
                    "message": "Scheduler is inactive - escalations will not run"
                }
            
            # Check recent escalation activity
            recent_escalations = frappe.db.count("Error Log", {
                "method": ["like", "%escalation%"],
                "creation": [">=", (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")]
            })
            
            return {
                "status": "healthy",
                "message": f"Escalation system active, {recent_escalations} escalations in last 24h",
                "metrics": {
                    "escalations_24h": recent_escalations,
                    "scheduler_active": True
                }
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Health check failed: {str(e)}"
            }
    
    def _check_database_health(self) -> Dict[str, Any]:
        """Check database health for email system"""
        try:
            # Check table sizes
            table_stats = frappe.db.sql("""
                SELECT 
                    table_name,
                    table_rows,
                    ROUND(((data_length + index_length) / 1024 / 1024), 2) as size_mb
                FROM information_schema.tables 
                WHERE table_schema = DATABASE() 
                AND table_name IN ('tabCommunication', 'tabEmail Monitoring', 'tabCommunication Relation')
            """, as_dict=True)
            
            # Check for table locks or issues
            locked_tables = frappe.db.sql("""
                SELECT table_name 
                FROM information_schema.metadata_locks 
                WHERE object_schema = DATABASE()
                AND object_name IN ('tabCommunication', 'tabEmail Monitoring')
            """, as_dict=True)
            
            status = "healthy"
            message = "Database health is good"
            
            if locked_tables:
                status = "warning"
                message = f"Table locks detected: {len(locked_tables)} tables"
            
            return {
                "status": status,
                "message": message,
                "metrics": {
                    "table_stats": table_stats,
                    "locked_tables": len(locked_tables)
                }
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Health check failed: {str(e)}"
            }
    
    def _check_configuration(self) -> Dict[str, Any]:
        """Check system configuration health"""
        try:
            issues = []
            
            # Check BCC Processing Settings
            try:
                settings = frappe.get_single("BCC Processing Settings")
                if settings.enable_bcc_processing and not settings.gmail_forwarding_account:
                    issues.append("BCC processing enabled but no forwarding account configured")
                
                if settings.enable_role_based_forwarding and not settings.main_email_account:
                    issues.append("Role-based forwarding enabled but no main email account configured")
            except Exception:
                issues.append("Cannot access BCC Processing Settings")
            
            # Check Forward Emails Control
            try:
                forward_controls = frappe.get_all("Forward Emails Control", {"enabled": 1})
                if not forward_controls:
                    issues.append("No active Forward Emails Control rules configured")
            except Exception:
                issues.append("Cannot access Forward Emails Control")
            
            status = "healthy" if not issues else "warning"
            message = "Configuration is valid" if not issues else f"{len(issues)} configuration issues"
            
            return {
                "status": status,
                "message": message,
                "issues": issues
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Health check failed: {str(e)}"
            }
    
    def _check_oauth_integration(self) -> Dict[str, Any]:
        """Check OAuth integration health"""
        try:
            oauth_providers = frappe.get_all("Email OAuth Settings", {"enabled": 1})
            
            if not oauth_providers:
                return {
                    "status": "disabled",
                    "message": "No OAuth providers configured"
                }
            
            active_providers = []
            expired_providers = []
            
            for provider in oauth_providers:
                try:
                    provider_doc = frappe.get_doc("Email OAuth Settings", provider.name)
                    if provider_doc.access_token and provider_doc.expires_at:
                        if datetime.fromisoformat(provider_doc.expires_at.replace('Z', '+00:00')) > datetime.now():
                            active_providers.append(provider.name)
                        else:
                            expired_providers.append(provider.name)
                except Exception:
                    expired_providers.append(provider.name)
            
            status = "healthy"
            message = f"{len(active_providers)} active OAuth providers"
            
            if expired_providers:
                status = "warning"
                message = f"{len(expired_providers)} providers need token refresh"
            
            return {
                "status": status,
                "message": message,
                "metrics": {
                    "total_providers": len(oauth_providers),
                    "active_providers": len(active_providers),
                    "expired_providers": len(expired_providers)
                }
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Health check failed: {str(e)}"
            }
    
    def _get_system_metrics(self) -> Dict[str, Any]:
        """Get system-wide metrics"""
        try:
            metrics = {}
            
            # Circuit breaker metrics
            cb_status = retry_manager.circuit_breakers
            metrics["circuit_breakers"] = {
                "total": len(cb_status),
                "open": len([cb for cb in cb_status.values() if cb.state == "OPEN"]),
                "half_open": len([cb for cb in cb_status.values() if cb.state == "HALF_OPEN"])
            }
            
            # Dead letter queue metrics
            metrics["dead_letter_queue"] = {
                "size": len(retry_manager.dead_letter_queue)
            }
            
            # Processing metrics
            metrics["processing"] = {
                "total_communications": frappe.db.count("Communication", {"communication_medium": "Email"}),
                "bcc_processed": frappe.db.count("Communication", {"custom_bcc_processed": 1}),
                "monitoring_records": frappe.db.count("Email Monitoring"),
                "linked_communications": frappe.db.count("Communication Relation")
            }
            
            return metrics
            
        except Exception as e:
            return {"error": str(e)}
    
    def auto_recover_issues(self) -> Dict[str, Any]:
        """Attempt automatic recovery for known issues"""
        recovery_results = {
            "attempted_recoveries": 0,
            "successful_recoveries": 0,
            "failed_recoveries": 0,
            "recovery_actions": []
        }
        
        try:
            # Process dead letter queue
            recovery_results["attempted_recoveries"] += 1
            dlq_result = retry_manager.process_dead_letter_queue(max_items=20)
            if dlq_result > 0:
                recovery_results["successful_recoveries"] += 1
                recovery_results["recovery_actions"].append(f"Processed {dlq_result} dead letter queue items")
            
            # Reset circuit breakers that have been open too long
            for operation, cb in retry_manager.circuit_breakers.items():
                if cb.state == "OPEN" and cb.last_failure_time:
                    time_since_failure = (datetime.now() - cb.last_failure_time).seconds
                    if time_since_failure > 300:  # 5 minutes
                        recovery_results["attempted_recoveries"] += 1
                        cb.state = "HALF_OPEN"
                        cb.failure_count = max(0, cb.failure_count - 1)
                        recovery_results["successful_recoveries"] += 1
                        recovery_results["recovery_actions"].append(f"Reset circuit breaker for {operation}")
            
            # Clean up old error logs
            recovery_results["attempted_recoveries"] += 1
            old_errors = frappe.db.sql("""
                DELETE FROM `tabError Log` 
                WHERE creation < DATE_SUB(NOW(), INTERVAL 7 DAY) 
                AND method LIKE '%email_genius%'
            """)
            recovery_results["successful_recoveries"] += 1
            recovery_results["recovery_actions"].append("Cleaned up old error logs")
            
        except Exception as e:
            recovery_results["failed_recoveries"] += 1
            recovery_results["recovery_actions"].append(f"Recovery failed: {str(e)}")
        
        return recovery_results

# Global health monitor instance
health_monitor = EmailSystemHealthMonitor()

@frappe.whitelist()
def get_system_health():
    """API endpoint to get system health status"""
    try:
        return {
            "status": "success",
            "health": health_monitor.get_system_health()
        }
    except Exception as e:
        frappe.log_error(f"Health check error: {str(e)}", "Email System Health")
        return {
            "status": "error",
            "message": str(e)
        }

@frappe.whitelist()
def run_auto_recovery():
    """API endpoint to run automatic recovery procedures"""
    try:
        recovery_result = health_monitor.auto_recover_issues()
        return {
            "status": "success",
            "recovery": recovery_result
        }
    except Exception as e:
        frappe.log_error(f"Auto recovery error: {str(e)}", "Email System Recovery")
        return {
            "status": "error",
            "message": str(e)
        }

@frappe.whitelist()
def get_health_dashboard():
    """Get comprehensive health dashboard data"""
    try:
        health = health_monitor.get_system_health()
        
        # Add trending data
        health["trends"] = {
            "email_volume_7d": frappe.db.sql("""
                SELECT DATE(creation) as date, COUNT(*) as count
                FROM `tabCommunication`
                WHERE communication_medium = 'Email'
                AND creation >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                GROUP BY DATE(creation)
                ORDER BY date
            """, as_dict=True),
            
            "monitoring_status_distribution": frappe.db.sql("""
                SELECT status, COUNT(*) as count
                FROM `tabEmail Monitoring`
                GROUP BY status
            """, as_dict=True),
            
            "error_trends_24h": frappe.db.sql("""
                SELECT HOUR(creation) as hour, COUNT(*) as count
                FROM `tabError Log`
                WHERE method LIKE '%email_genius%'
                AND creation >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                GROUP BY HOUR(creation)
                ORDER BY hour
            """, as_dict=True)
        }
        
        return {
            "status": "success",
            "dashboard": health
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

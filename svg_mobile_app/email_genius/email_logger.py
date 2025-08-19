"""
Enhanced Logging System for Email Genius
Provides structured logging with performance metrics and monitoring
"""

import frappe
import logging
import json
import time
from datetime import datetime
from functools import wraps
from typing import Dict, Any, Optional

class EmailLogger:
    """Enhanced logger for email processing operations"""
    
    def __init__(self, component: str = "email_genius"):
        self.component = component
        self.logger = logging.getLogger(f"email_genius.{component}")
        self._setup_logger()
    
    def _setup_logger(self):
        """Configure structured logging"""
        if not self.logger.handlers:
            handler = logging.StreamHandler()
            formatter = logging.Formatter(
                '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
            )
            handler.setFormatter(formatter)
            self.logger.addHandler(handler)
            self.logger.setLevel(logging.INFO)
    
    def log_operation(self, operation: str, data: Dict[str, Any], level: str = "info"):
        """Log structured operation data"""
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "component": self.component,
            "operation": operation,
            "data": data,
            "site": getattr(frappe.local, 'site', 'unknown')
        }
        
        message = json.dumps(log_entry, default=str)
        getattr(self.logger, level)(message)
        
        # Also log to Frappe's error log for critical operations
        if level in ['error', 'critical']:
            frappe.log_error(message, f"Email Genius - {operation}")
    
    def log_performance(self, operation: str, duration: float, metadata: Dict[str, Any] = None):
        """Log performance metrics"""
        perf_data = {
            "operation": operation,
            "duration_ms": round(duration * 1000, 2),
            "metadata": metadata or {}
        }
        self.log_operation("performance", perf_data)
    
    def log_email_processing(self, email_id: str, action: str, status: str, 
                           recipient_count: int = 0, error: str = None):
        """Log email processing events"""
        data = {
            "email_id": email_id,
            "action": action,
            "status": status,
            "recipient_count": recipient_count
        }
        if error:
            data["error"] = error
        
        level = "error" if status == "failed" else "info"
        self.log_operation("email_processing", data, level)
    
    def log_escalation(self, monitoring_id: str, status: str, assigned_user: str, 
                      days_overdue: int):
        """Log escalation events"""
        data = {
            "monitoring_id": monitoring_id,
            "status": status,
            "assigned_user": assigned_user,
            "days_overdue": days_overdue
        }
        self.log_operation("escalation", data)

def performance_monitor(operation_name: str):
    """Decorator to monitor function performance"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            logger = EmailLogger("performance")
            start_time = time.time()
            
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                
                # Extract metadata from function arguments
                metadata = {
                    "function": func.__name__,
                    "args_count": len(args),
                    "kwargs_keys": list(kwargs.keys())
                }
                
                logger.log_performance(operation_name, duration, metadata)
                return result
                
            except Exception as e:
                duration = time.time() - start_time
                metadata = {
                    "function": func.__name__,
                    "error": str(e),
                    "args_count": len(args),
                    "kwargs_keys": list(kwargs.keys())
                }
                
                logger.log_performance(f"{operation_name}_failed", duration, metadata)
                raise
        
        return wrapper
    return decorator

def log_email_operation(operation: str, email_id: str = None):
    """Decorator for email operations"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            logger = EmailLogger("operations")
            start_time = time.time()
            
            # Try to extract email ID from arguments
            actual_email_id = email_id
            if not actual_email_id and args:
                if hasattr(args[0], 'name'):
                    actual_email_id = args[0].name
                elif hasattr(args[0], 'message_id'):
                    actual_email_id = args[0].message_id
            
            try:
                result = func(*args, **kwargs)
                duration = time.time() - start_time
                
                logger.log_email_processing(
                    actual_email_id or "unknown",
                    operation,
                    "success",
                    error=None
                )
                
                return result
                
            except Exception as e:
                duration = time.time() - start_time
                
                logger.log_email_processing(
                    actual_email_id or "unknown",
                    operation,
                    "failed",
                    error=str(e)
                )
                raise
        
        return wrapper
    return decorator

# Global logger instances
email_logger = EmailLogger("email_processing")
performance_logger = EmailLogger("performance")
escalation_logger = EmailLogger("escalation")

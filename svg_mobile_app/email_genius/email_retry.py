"""
Retry Mechanisms for Email Operations
Implements exponential backoff, circuit breaker, and dead letter queue patterns
"""

import frappe
import time
import random
from functools import wraps
from typing import Callable, Any, Optional, Dict, List
from datetime import datetime, timedelta
from .email_logger import EmailLogger

class RetryConfig:
    """Configuration for retry mechanisms"""
    
    def __init__(self, 
                 max_attempts: int = 3,
                 base_delay: float = 1.0,
                 max_delay: float = 60.0,
                 exponential_base: float = 2.0,
                 jitter: bool = True):
        self.max_attempts = max_attempts
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.exponential_base = exponential_base
        self.jitter = jitter

class CircuitBreaker:
    """Circuit breaker pattern for email operations"""
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "CLOSED"  # CLOSED, OPEN, HALF_OPEN
        self.logger = EmailLogger("circuit_breaker")
    
    def can_execute(self) -> bool:
        """Check if operation can be executed"""
        if self.state == "CLOSED":
            return True
        
        if self.state == "OPEN":
            if self._should_attempt_reset():
                self.state = "HALF_OPEN"
                self.logger.log_operation("circuit_breaker_half_open", {
                    "failure_count": self.failure_count
                })
                return True
            return False
        
        # HALF_OPEN state
        return True
    
    def record_success(self):
        """Record successful operation"""
        if self.state == "HALF_OPEN":
            self.state = "CLOSED"
            self.failure_count = 0
            self.logger.log_operation("circuit_breaker_closed", {
                "message": "Circuit breaker reset after successful operation"
            })
    
    def record_failure(self):
        """Record failed operation"""
        self.failure_count += 1
        self.last_failure_time = datetime.now()
        
        if self.failure_count >= self.failure_threshold:
            self.state = "OPEN"
            self.logger.log_operation("circuit_breaker_open", {
                "failure_count": self.failure_count,
                "threshold": self.failure_threshold
            }, "error")
    
    def _should_attempt_reset(self) -> bool:
        """Check if enough time has passed to attempt reset"""
        if not self.last_failure_time:
            return False
        
        return (datetime.now() - self.last_failure_time).seconds >= self.recovery_timeout

class EmailRetryManager:
    """Manages retry operations for email processing"""
    
    def __init__(self):
        self.logger = EmailLogger("retry_manager")
        self.circuit_breakers = {}
        self.dead_letter_queue = []
    
    def get_circuit_breaker(self, operation_name: str) -> CircuitBreaker:
        """Get or create circuit breaker for operation"""
        if operation_name not in self.circuit_breakers:
            self.circuit_breakers[operation_name] = CircuitBreaker()
        return self.circuit_breakers[operation_name]
    
    def retry_with_backoff(self, 
                          operation: Callable,
                          config: RetryConfig = None,
                          operation_name: str = "email_operation",
                          context: Dict[str, Any] = None) -> Any:
        """
        Execute operation with exponential backoff retry
        """
        if config is None:
            config = RetryConfig()
        
        context = context or {}
        circuit_breaker = self.get_circuit_breaker(operation_name)
        
        # Check circuit breaker
        if not circuit_breaker.can_execute():
            self.logger.log_operation("circuit_breaker_blocked", {
                "operation": operation_name,
                "context": context
            }, "warning")
            raise Exception(f"Circuit breaker is OPEN for operation: {operation_name}")
        
        last_exception = None
        
        for attempt in range(1, config.max_attempts + 1):
            try:
                self.logger.log_operation("retry_attempt", {
                    "operation": operation_name,
                    "attempt": attempt,
                    "max_attempts": config.max_attempts,
                    "context": context
                })
                
                result = operation()
                
                # Success - reset circuit breaker
                circuit_breaker.record_success()
                
                if attempt > 1:
                    self.logger.log_operation("retry_success", {
                        "operation": operation_name,
                        "successful_attempt": attempt,
                        "context": context
                    })
                
                return result
                
            except Exception as e:
                last_exception = e
                circuit_breaker.record_failure()
                
                self.logger.log_operation("retry_failed_attempt", {
                    "operation": operation_name,
                    "attempt": attempt,
                    "error": str(e),
                    "context": context
                }, "warning")
                
                # If this was the last attempt, don't delay
                if attempt == config.max_attempts:
                    break
                
                # Calculate delay with exponential backoff
                delay = min(
                    config.base_delay * (config.exponential_base ** (attempt - 1)),
                    config.max_delay
                )
                
                # Add jitter to prevent thundering herd
                if config.jitter:
                    delay = delay * (0.5 + random.random() * 0.5)
                
                self.logger.log_operation("retry_delay", {
                    "operation": operation_name,
                    "attempt": attempt,
                    "delay_seconds": delay,
                    "context": context
                })
                
                time.sleep(delay)
        
        # All attempts failed - add to dead letter queue
        self._add_to_dead_letter_queue(operation_name, context, str(last_exception))
        
        self.logger.log_operation("retry_exhausted", {
            "operation": operation_name,
            "attempts": config.max_attempts,
            "final_error": str(last_exception),
            "context": context
        }, "error")
        
        raise last_exception
    
    def _add_to_dead_letter_queue(self, operation_name: str, context: Dict[str, Any], error: str):
        """Add failed operation to dead letter queue"""
        dlq_entry = {
            "operation": operation_name,
            "context": context,
            "error": error,
            "timestamp": datetime.now().isoformat(),
            "retry_count": 0
        }
        
        self.dead_letter_queue.append(dlq_entry)
        
        # Persist to database for recovery
        try:
            frappe.get_doc({
                "doctype": "Error Log",
                "method": f"Email Retry DLQ - {operation_name}",
                "error": frappe.as_json(dlq_entry)
            }).insert(ignore_permissions=True)
        except Exception as e:
            self.logger.log_operation("dlq_persist_failed", {
                "error": str(e),
                "dlq_entry": dlq_entry
            }, "error")
    
    def process_dead_letter_queue(self, max_items: int = 10):
        """Process items from dead letter queue"""
        processed = 0
        
        for i, item in enumerate(self.dead_letter_queue[:max_items]):
            try:
                # Implement recovery logic based on operation type
                if self._attempt_recovery(item):
                    self.dead_letter_queue.pop(i - processed)
                    processed += 1
                    
                    self.logger.log_operation("dlq_recovery_success", {
                        "operation": item["operation"],
                        "context": item["context"]
                    })
            except Exception as e:
                self.logger.log_operation("dlq_recovery_failed", {
                    "operation": item["operation"],
                    "error": str(e),
                    "context": item["context"]
                }, "error")
        
        return processed
    
    def _attempt_recovery(self, dlq_item: Dict[str, Any]) -> bool:
        """Attempt to recover a dead letter queue item"""
        operation = dlq_item["operation"]
        context = dlq_item["context"]
        
        # Implement specific recovery logic for different operations
        if operation == "email_forwarding":
            return self._recover_email_forwarding(context)
        elif operation == "bcc_processing":
            return self._recover_bcc_processing(context)
        elif operation == "escalation_notification":
            return self._recover_escalation_notification(context)
        
        return False
    
    def _recover_email_forwarding(self, context: Dict[str, Any]) -> bool:
        """Recover failed email forwarding"""
        try:
            # Re-attempt email forwarding with fresh data
            comm_name = context.get("communication_name")
            if comm_name and frappe.db.exists("Communication", comm_name):
                from .email_processor import forward_email_to_main_account
                comm = frappe.get_doc("Communication", comm_name)
                return forward_email_to_main_account(comm.as_dict())
        except Exception:
            pass
        return False
    
    def _recover_bcc_processing(self, context: Dict[str, Any]) -> bool:
        """Recover failed BCC processing"""
        try:
            # Re-attempt BCC processing
            comm_name = context.get("communication_name")
            if comm_name and frappe.db.exists("Communication", comm_name):
                from .email_processor import process_bcc_email
                comm = frappe.get_doc("Communication", comm_name)
                process_bcc_email(comm)
                return True
        except Exception:
            pass
        return False
    
    def _recover_escalation_notification(self, context: Dict[str, Any]) -> bool:
        """Recover failed escalation notification"""
        try:
            # Re-attempt escalation notification
            monitoring_name = context.get("monitoring_name")
            if monitoring_name and frappe.db.exists("Email Monitoring", monitoring_name):
                # Re-send escalation notification
                from ..svg_mobile_app.doctype.email_monitoring.email_monitoring_escalation import _notify_assigned
                monitoring = frappe.get_doc("Email Monitoring", monitoring_name)
                _notify_assigned(monitoring.name, monitoring.assigned_user, monitoring.status)
                return True
        except Exception:
            pass
        return False

# Global retry manager instance
retry_manager = EmailRetryManager()

def with_retry(config: RetryConfig = None, operation_name: str = None, context: Dict[str, Any] = None):
    """Decorator for adding retry logic to functions"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            nonlocal operation_name, context
            
            if operation_name is None:
                operation_name = func.__name__
            
            if context is None:
                context = {}
            
            # Add function arguments to context
            context.update({
                "function": func.__name__,
                "args_count": len(args),
                "kwargs_keys": list(kwargs.keys())
            })
            
            def operation():
                return func(*args, **kwargs)
            
            return retry_manager.retry_with_backoff(
                operation=operation,
                config=config,
                operation_name=operation_name,
                context=context
            )
        
        return wrapper
    return decorator

@frappe.whitelist()
def process_dead_letter_queue(max_items: int = 10):
    """API endpoint to manually process dead letter queue"""
    try:
        processed = retry_manager.process_dead_letter_queue(max_items)
        return {
            "status": "success",
            "processed_items": processed,
            "remaining_items": len(retry_manager.dead_letter_queue)
        }
    except Exception as e:
        frappe.log_error(f"Error processing dead letter queue: {str(e)}", "Email Retry DLQ")
        return {
            "status": "error",
            "message": str(e)
        }

@frappe.whitelist()
def get_circuit_breaker_status():
    """Get status of all circuit breakers"""
    try:
        status = {}
        for operation, cb in retry_manager.circuit_breakers.items():
            status[operation] = {
                "state": cb.state,
                "failure_count": cb.failure_count,
                "last_failure": cb.last_failure_time.isoformat() if cb.last_failure_time else None,
                "failure_threshold": cb.failure_threshold
            }
        
        return {
            "status": "success",
            "circuit_breakers": status,
            "dead_letter_queue_size": len(retry_manager.dead_letter_queue)
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

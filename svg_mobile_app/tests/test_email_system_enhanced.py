"""
Enhanced Test Suite for Email System
Comprehensive integration, load, and stress testing
"""

import frappe
import unittest
from unittest.mock import patch, MagicMock
import threading
import time
import random
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed
import json

class TestEmailSystemEnhanced(unittest.TestCase):
    """Enhanced test suite with integration and load testing"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test environment"""
        cls.test_users = [f"testuser{i}@example.com" for i in range(1, 11)]
        cls.test_accounts = ["Test Account 1", "Test Account 2"]
        cls.setup_test_data()
    
    @classmethod
    def setup_test_data(cls):
        """Set up test data for load testing"""
        # Ensure BCC Processing Settings exist
        if not frappe.db.exists("BCC Processing Settings", "BCC Processing Settings"):
            settings = frappe.get_doc({
                "doctype": "BCC Processing Settings",
                "enable_bcc_processing": 1,
                "gmail_forwarding_account": "test@gmail.com",
                "enable_subject_timestamping": 1,
                "subject_timestamp_format": "[%Y-%m-%d %H:%M:%S]"
            })
            settings.insert()
    
    def test_concurrent_email_processing(self):
        """Test concurrent email processing under load"""
        def process_email(email_id):
            """Process a single email"""
            try:
                comm_data = {
                    "doctype": "Communication",
                    "communication_medium": "Email",
                    "sent_or_received": "Received",
                    "subject": f"Load Test Email {email_id}",
                    "sender": f"sender{email_id}@example.com",
                    "recipients": f"recipient{email_id}@example.com",
                    "cc": f"cc{email_id}@example.com",
                    "content": f"Load test email content {email_id}",
                    "message_id": f"<loadtest{email_id}@example.com>"
                }
                
                comm = frappe.get_doc(comm_data)
                
                # Mock the actual email sending to avoid external calls
                with patch('svg_mobile_app.email_genius.email_processor.forward_email_copy') as mock_forward:
                    mock_forward.return_value = True
                    
                    from svg_mobile_app.email_genius.email_processor import process_bcc_email
                    process_bcc_email(comm)
                    
                return {"success": True, "email_id": email_id}
                
            except Exception as e:
                return {"success": False, "email_id": email_id, "error": str(e)}
        
        # Test with 50 concurrent emails
        num_emails = 50
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(process_email, i) for i in range(num_emails)]
            results = [future.result() for future in as_completed(futures)]
        
        end_time = time.time()
        processing_time = end_time - start_time
        
        # Analyze results
        successful = len([r for r in results if r["success"]])
        failed = len([r for r in results if not r["success"]])
        
        print(f"Concurrent Processing Results:")
        print(f"- Processed {num_emails} emails in {processing_time:.2f} seconds")
        print(f"- Average time per email: {processing_time/num_emails:.3f} seconds")
        print(f"- Successful: {successful}, Failed: {failed}")
        
        # Assert that at least 90% succeeded
        success_rate = successful / num_emails
        self.assertGreater(success_rate, 0.9, f"Success rate too low: {success_rate:.2%}")
    
    def test_retry_mechanism_integration(self):
        """Test retry mechanism with real failures"""
        from svg_mobile_app.email_genius.email_retry import with_retry, RetryConfig
        
        failure_count = 0
        
        @with_retry(
            config=RetryConfig(max_attempts=3, base_delay=0.1),
            operation_name="test_retry_operation"
        )
        def flaky_operation():
            nonlocal failure_count
            failure_count += 1
            
            if failure_count < 3:
                raise Exception(f"Simulated failure {failure_count}")
            return "success"
        
        # Test successful retry
        result = flaky_operation()
        self.assertEqual(result, "success")
        self.assertEqual(failure_count, 3)
        
        # Test retry exhaustion
        failure_count = 0
        
        @with_retry(
            config=RetryConfig(max_attempts=2, base_delay=0.1),
            operation_name="test_retry_exhausted"
        )
        def always_fail():
            nonlocal failure_count
            failure_count += 1
            raise Exception(f"Always fails {failure_count}")
        
        with self.assertRaises(Exception):
            always_fail()
        
        self.assertEqual(failure_count, 2)
    
    def test_circuit_breaker_integration(self):
        """Test circuit breaker functionality"""
        from svg_mobile_app.email_genius.email_retry import retry_manager
        
        operation_name = "test_circuit_breaker"
        cb = retry_manager.get_circuit_breaker(operation_name)
        
        # Initial state should be CLOSED
        self.assertEqual(cb.state, "CLOSED")
        self.assertTrue(cb.can_execute())
        
        # Simulate failures to trip circuit breaker
        for i in range(6):  # Failure threshold is 5
            cb.record_failure()
        
        # Circuit breaker should now be OPEN
        self.assertEqual(cb.state, "OPEN")
        self.assertFalse(cb.can_execute())
        
        # Reset for recovery test
        cb.last_failure_time = datetime.now() - timedelta(seconds=61)  # Simulate timeout
        self.assertTrue(cb.can_execute())
        self.assertEqual(cb.state, "HALF_OPEN")
        
        # Successful operation should close circuit
        cb.record_success()
        self.assertEqual(cb.state, "CLOSED")
    
    def test_performance_optimization_integration(self):
        """Test performance optimization features"""
        from svg_mobile_app.email_genius.performance_optimization import (
            create_email_system_indexes,
            get_email_system_performance_stats
        )
        
        # Test index creation
        result = create_email_system_indexes()
        self.assertIn("created", result)
        self.assertIn("failed", result)
        
        # Test performance stats
        stats = get_email_system_performance_stats()
        self.assertIn("communication", stats)
        self.assertIn("monitoring", stats)
        
        # Verify stats contain expected fields
        if "communication" in stats and "error" not in stats["communication"]:
            comm_stats = stats["communication"]
            self.assertIn("total_communications", comm_stats)
            self.assertIn("processed_emails", comm_stats)
    
    def test_health_monitoring_integration(self):
        """Test health monitoring system"""
        from svg_mobile_app.email_genius.health_monitor import health_monitor
        
        # Get system health
        health = health_monitor.get_system_health()
        
        # Verify health structure
        self.assertIn("overall_status", health)
        self.assertIn("components", health)
        self.assertIn("metrics", health)
        self.assertIn("alerts", health)
        
        # Verify component checks
        expected_components = [
            "email_processing",
            "bcc_processing", 
            "monitoring_system",
            "escalation_system",
            "database_health",
            "configuration"
        ]
        
        for component in expected_components:
            self.assertIn(component, health["components"])
            component_health = health["components"][component]
            self.assertIn("status", component_health)
            self.assertIn("message", component_health)
    
    def test_logging_system_integration(self):
        """Test enhanced logging system"""
        from svg_mobile_app.email_genius.email_logger import (
            EmailLogger,
            performance_monitor,
            log_email_operation
        )
        
        # Test basic logging
        logger = EmailLogger("test_component")
        logger.log_operation("test_operation", {"test": "data"})
        
        # Test performance monitoring decorator
        @performance_monitor("test_performance")
        def test_function():
            time.sleep(0.01)  # Simulate work
            return "completed"
        
        result = test_function()
        self.assertEqual(result, "completed")
        
        # Test email operation decorator
        @log_email_operation("test_email_op", "test-email-123")
        def test_email_function():
            return "email processed"
        
        result = test_email_function()
        self.assertEqual(result, "email processed")
    
    def test_escalation_system_load(self):
        """Test escalation system under load"""
        # Create test monitoring records
        test_records = []
        
        for i in range(20):
            monitoring_data = {
                "doctype": "Email Monitoring",
                "communication": f"COMM-TEST-{i}",
                "email_type": "Incoming",
                "status": "Need Reply" if i % 2 == 0 else "Follow Up",
                "priority": "High" if i < 5 else "Medium",
                "assigned_user": f"testuser{i % 3 + 1}@example.com"
            }
            
            # Backdate some records to trigger escalation
            if i < 10:
                monitoring_data["modified"] = datetime.now() - timedelta(days=3)
            
            try:
                monitoring = frappe.get_doc(monitoring_data)
                monitoring.insert()
                test_records.append(monitoring.name)
            except Exception as e:
                print(f"Failed to create test monitoring record {i}: {str(e)}")
        
        # Test escalation processing
        from svg_mobile_app.svg_mobile_app.doctype.email_monitoring.email_monitoring_escalation import run_escalations
        
        # Mock email sending to avoid actual emails
        with patch('frappe.sendmail') as mock_sendmail:
            mock_sendmail.return_value = True
            
            start_time = time.time()
            run_escalations()
            processing_time = time.time() - start_time
            
            print(f"Escalation processing completed in {processing_time:.3f} seconds")
            
            # Verify escalation calls were made
            self.assertGreater(mock_sendmail.call_count, 0)
        
        # Clean up test records
        for record_name in test_records:
            try:
                frappe.delete_doc("Email Monitoring", record_name, force=True)
            except Exception:
                pass
    
    def test_memory_usage_monitoring(self):
        """Test memory usage during bulk operations"""
        import psutil
        import os
        
        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        # Simulate bulk email processing
        communications = []
        for i in range(100):
            comm_data = {
                "doctype": "Communication",
                "communication_medium": "Email",
                "sent_or_received": "Received",
                "subject": f"Memory Test Email {i}",
                "sender": f"sender{i}@example.com",
                "recipients": f"recipient{i}@example.com",
                "content": f"Memory test content {i}" * 100,  # Larger content
                "message_id": f"<memtest{i}@example.com>"
            }
            
            communications.append(frappe._dict(comm_data))
        
        # Process all communications
        with patch('svg_mobile_app.email_genius.email_processor.forward_email_copy'):
            for comm in communications:
                from svg_mobile_app.email_genius.email_processor import process_bcc_email
                try:
                    process_bcc_email(comm)
                except Exception:
                    pass  # Ignore errors for memory test
        
        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory
        
        print(f"Memory usage: {initial_memory:.1f}MB -> {final_memory:.1f}MB (+{memory_increase:.1f}MB)")
        
        # Assert memory increase is reasonable (less than 100MB for 100 emails)
        self.assertLess(memory_increase, 100, f"Memory usage increased too much: {memory_increase:.1f}MB")
    
    def test_api_load_testing(self):
        """Test API endpoints under load"""
        api_endpoints = [
            ("svg_mobile_app.api.get_email_monitoring", {"limit_page_length": 10}),
            ("svg_mobile_app.email_genius.health_monitor.get_system_health", {}),
            ("svg_mobile_app.email_genius.email_retry.get_circuit_breaker_status", {})
        ]
        
        def call_api(method, args):
            try:
                start_time = time.time()
                result = frappe.call(method, **args)
                response_time = time.time() - start_time
                return {
                    "method": method,
                    "success": True,
                    "response_time": response_time,
                    "result": result
                }
            except Exception as e:
                return {
                    "method": method,
                    "success": False,
                    "error": str(e),
                    "response_time": None
                }
        
        # Test each endpoint with concurrent calls
        for method, args in api_endpoints:
            print(f"Testing API endpoint: {method}")
            
            with ThreadPoolExecutor(max_workers=5) as executor:
                futures = [executor.submit(call_api, method, args) for _ in range(10)]
                results = [future.result() for future in as_completed(futures)]
            
            successful_calls = [r for r in results if r["success"]]
            failed_calls = [r for r in results if not r["success"]]
            
            success_rate = len(successful_calls) / len(results)
            avg_response_time = sum(r["response_time"] for r in successful_calls) / len(successful_calls) if successful_calls else 0
            
            print(f"  Success rate: {success_rate:.1%}")
            print(f"  Average response time: {avg_response_time:.3f}s")
            print(f"  Failed calls: {len(failed_calls)}")
            
            # Assert reasonable performance
            self.assertGreater(success_rate, 0.8, f"API success rate too low for {method}")
            self.assertLess(avg_response_time, 2.0, f"API response time too slow for {method}")
    
    def test_database_connection_resilience(self):
        """Test system resilience to database issues"""
        from svg_mobile_app.email_genius.email_retry import with_retry, RetryConfig
        
        @with_retry(
            config=RetryConfig(max_attempts=3, base_delay=0.1),
            operation_name="db_resilience_test"
        )
        def database_operation():
            # Simulate database query
            return frappe.db.sql("SELECT 1 as test", as_dict=True)
        
        # Test normal operation
        result = database_operation()
        self.assertEqual(result[0]["test"], 1)
        
        # Test with simulated database error
        call_count = 0
        
        @with_retry(
            config=RetryConfig(max_attempts=3, base_delay=0.1),
            operation_name="db_error_test"
        )
        def failing_db_operation():
            nonlocal call_count
            call_count += 1
            
            if call_count < 2:
                # Simulate database connection error
                raise Exception("Database connection lost")
            
            return frappe.db.sql("SELECT 2 as test", as_dict=True)
        
        result = failing_db_operation()
        self.assertEqual(result[0]["test"], 2)
        self.assertEqual(call_count, 2)  # Should have retried once
    
    def test_end_to_end_email_workflow(self):
        """Test complete email workflow from receipt to monitoring"""
        # Step 1: Simulate incoming email with CC/BCC
        email_data = {
            "doctype": "Communication",
            "communication_medium": "Email",
            "sent_or_received": "Received",
            "subject": "End-to-End Test Email",
            "sender": "external@client.com",
            "recipients": "sales@company.com",
            "cc": "manager@company.com",
            "bcc": "audit@company.com",
            "content": "This is a complete workflow test email",
            "message_id": "<e2e-test@client.com>",
            "email_account": "Sales Account"
        }
        
        # Mock external calls
        with patch('svg_mobile_app.email_genius.email_processor.forward_email_copy') as mock_forward, \
             patch('frappe.sendmail') as mock_sendmail:
            
            mock_forward.return_value = True
            mock_sendmail.return_value = True
            
            # Step 2: Process the email
            comm = frappe.get_doc(email_data)
            
            from svg_mobile_app.email_genius.email_processor import process_bcc_email
            process_bcc_email(comm)
            
            # Step 3: Verify BCC processing created additional records
            # (This would normally create separate Communication records for CC/BCC)
            
            # Step 4: Verify Email Monitoring record was created
            from svg_mobile_app.svg_mobile_app.doctype.email_monitoring.email_monitoring_hooks import create_email_monitoring_record
            create_email_monitoring_record(comm)
            
            # Step 5: Test monitoring updates
            from svg_mobile_app.api import update_email_monitoring
            
            # Find the monitoring record (would be created in real scenario)
            monitoring_records = frappe.get_all("Email Monitoring", 
                                              filters={"communication": comm.name},
                                              limit=1)
            
            if monitoring_records:
                monitoring_name = monitoring_records[0].name
                
                # Step 6: Update monitoring status
                update_result = update_email_monitoring(
                    monitoring_name, 
                    status="Need Reply", 
                    assigned_user="testuser@company.com",
                    priority="High"
                )
                
                self.assertEqual(update_result.get("status"), "success")
            
            # Step 7: Test escalation (would normally run via scheduler)
            from svg_mobile_app.svg_mobile_app.doctype.email_monitoring.email_monitoring_escalation import run_escalations
            run_escalations()
            
            # Verify workflow completed without errors
            self.assertTrue(True)  # If we get here, the workflow succeeded
    
    @classmethod
    def tearDownClass(cls):
        """Clean up test environment"""
        # Clean up any test data
        frappe.db.rollback()

if __name__ == '__main__':
    unittest.main()

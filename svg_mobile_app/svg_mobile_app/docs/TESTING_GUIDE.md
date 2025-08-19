# 🧪 EMAIL SYSTEM TESTING GUIDE

This guide provides step-by-step instructions for testing your email system implementation.

## 📋 TESTING PHASES

### **PHASE 1: ENVIRONMENT SETUP** ⚙️

#### Step 1: Verify Prerequisites
```bash
# Check Frappe version
bench version

# Check site status
bench --site [your-site] status

# Check if scheduler is running
bench --site [your-site] doctor
```

#### Step 2: Run Quick Start
```bash
# Navigate to your app directory
cd apps/svg_mobile_app

# Run quick start script
bench --site [your-site] execute svg_mobile_app.quick_start.main
```

#### Step 3: Create Full Backup
```bash
# Create comprehensive backup
bench --site [your-site] backup --with-files
bench backup-all-sites

# Verify backup files created
ls -la sites/[your-site]/private/backups/
```

---

### **PHASE 2: BASIC FUNCTIONALITY TESTING** 🔧

#### Step 1: Run System Setup
```bash
# In bench console
bench --site [your-site] console

# Run complete setup
from svg_mobile_app.setup_email_system_complete import run_complete_setup
result = run_complete_setup()
print("Setup Result:", result)
```

#### Step 2: Verify System Health
```bash
# Check system health
from svg_mobile_app.email_genius.health_monitor import get_system_health
health = get_system_health()
print("System Health:", health['health']['overall_status'])
```

#### Step 3: Run System Diagnostics
```bash
# Run comprehensive diagnostics
from svg_mobile_app.email_genius.system_diagnostics import run_system_diagnostics
diagnostics = run_system_diagnostics()
print("Overall Status:", diagnostics['diagnostics']['overall_status'])
print("Errors:", len(diagnostics['diagnostics']['errors']))
print("Warnings:", len(diagnostics['diagnostics']['warnings']))
```

---

### **PHASE 3: CONFIGURATION TESTING** ⚙️

#### Step 1: Configure BCC Processing Settings
```bash
# Access BCC Processing Settings
# Go to: Desk > BCC Processing Settings

# Set these values:
# ✅ Enable BCC Processing: Yes
# ✅ Gmail Forwarding Account: your-email@gmail.com
# ✅ Enable Subject Timestamping: Yes (optional)
# ✅ Subject Timestamp Format: [%Y-%m-%d %H:%M:%S] (optional)
```

#### Step 2: Test Configuration Validation
```bash
# In bench console
from svg_mobile_app.email_genius.system_diagnostics import run_system_diagnostics
result = run_system_diagnostics()

# Check configuration status
config_status = result['diagnostics']['configuration_status']
print("BCC Processing:", config_status['bcc_processing_settings']['status'])
print("Email Accounts:", config_status['email_accounts']['status'])
print("Custom Fields:", config_status['custom_fields']['status'])
```

#### Step 3: Set Up Email Accounts
```bash
# Go to: Email Account > New
# Configure at least one email account for testing
# Ensure "Enable Incoming" is checked
```

---

### **PHASE 4: UNIT TESTING** 🧪

#### Step 1: Run Basic Unit Tests
```bash
# Run the complete test suite
bench --site [your-site] execute svg_mobile_app.tests.test_email_system_complete

# Or run specific test methods
python -m pytest apps/svg_mobile_app/svg_mobile_app/tests/test_email_system_complete.py -v
```

#### Step 2: Run Enhanced Tests
```bash
# Run enhanced test suite with load testing
bench --site [your-site] execute svg_mobile_app.tests.test_email_system_enhanced

# Or run with pytest
python -m pytest apps/svg_mobile_app/svg_mobile_app/tests/test_email_system_enhanced.py -v
```

#### Step 3: Test Individual Components
```bash
# Test logging system
from svg_mobile_app.email_genius.email_logger import EmailLogger
logger = EmailLogger("test")
logger.log_operation("test_operation", {"test": "data"})
print("✅ Logging system working")

# Test retry mechanisms
from svg_mobile_app.email_genius.email_retry import get_circuit_breaker_status
status = get_circuit_breaker_status()
print("✅ Retry mechanisms working:", status['status'])

# Test performance optimization
from svg_mobile_app.email_genius.performance_optimization import get_performance_report
report = get_performance_report()
print("✅ Performance optimization working:", report['status'])
```

---

### **PHASE 5: INTEGRATION TESTING** 🔗

#### Step 1: Test Email Processing Flow
```bash
# Create test communication record
test_comm = {
    "doctype": "Communication",
    "communication_medium": "Email",
    "sent_or_received": "Received",
    "subject": "Test Multi-Recipient Email",
    "sender": "sender@example.com",
    "recipients": "recipient1@example.com",
    "cc": "cc1@example.com, cc2@example.com",
    "bcc": "bcc1@example.com",
    "content": "This is a test email with multiple recipients",
    "message_id": "<test123@example.com>",
    "email_account": "Test Account"
}

# Insert the communication (this should trigger BCC processing)
comm_doc = frappe.get_doc(test_comm)
comm_doc.insert()

print(f"✅ Communication created: {comm_doc.name}")
```

#### Step 2: Verify BCC Processing
```bash
# Check if additional communication records were created
related_comms = frappe.get_all("Communication", 
    filters={"custom_original_message_id": comm_doc.message_id},
    fields=["name", "recipients", "custom_recipient_type", "message_id"]
)

print(f"✅ Found {len(related_comms)} related communications:")
for comm in related_comms:
    print(f"  - {comm.name}: {comm.recipients} ({comm.custom_recipient_type})")
```

#### Step 3: Verify Email Monitoring Creation
```bash
# Check if Email Monitoring record was created
monitoring = frappe.get_all("Email Monitoring",
    filters={"communication": comm_doc.name},
    fields=["name", "status", "email_type", "priority"]
)

if monitoring:
    print(f"✅ Email Monitoring created: {monitoring[0]}")
else:
    print("❌ Email Monitoring not created")
```

---

### **PHASE 6: UI TESTING** 🖥️

#### Step 1: Test Inbox View
```bash
# Go to: Communication > Communication List
# Verify:
# ✅ Multiple communication records visible
# ✅ Different recipient types shown
# ✅ Unique message IDs
# ✅ "Link Related" button available
```

#### Step 2: Test Email Monitoring Dashboard
```bash
# Go to: Email Monitoring > Email Monitoring List
# Verify:
# ✅ Monitoring records created
# ✅ Status workflow available
# ✅ Assignment functionality
# ✅ Priority settings
```

#### Step 3: Test Communication Linking
```bash
# In Communication list:
# 1. Click "Link Related" on any communication
# 2. Select another communication to link
# 3. Add relation type and notes
# 4. Save

# Verify:
# ✅ Communication Relation record created
# ✅ Related section shows in email popup
```

---

### **PHASE 7: PERFORMANCE TESTING** 🚀

#### Step 1: Load Testing
```bash
# Run load test with multiple emails
from svg_mobile_app.tests.test_email_system_enhanced import TestEmailSystemEnhanced
test_instance = TestEmailSystemEnhanced()
test_instance.test_concurrent_email_processing()

# Check results in console output
```

#### Step 2: Memory Usage Testing
```bash
# Run memory usage test
test_instance.test_memory_usage_monitoring()

# Monitor system resources during test
htop  # or top on some systems
```

#### Step 3: Database Performance
```bash
# Check database performance
from svg_mobile_app.email_genius.performance_optimization import get_email_system_performance_stats
stats = get_email_system_performance_stats()

print("Communication stats:", stats.get('communication'))
print("Monitoring stats:", stats.get('monitoring'))
print("Index stats:", len(stats.get('indexes', [])))
```

---

### **PHASE 8: ERROR HANDLING TESTING** 🔧

#### Step 1: Test Retry Mechanisms
```bash
# Test retry functionality
from svg_mobile_app.email_genius.email_retry import retry_manager

# Check circuit breaker status
cb_status = retry_manager.circuit_breakers
print("Circuit breakers:", len(cb_status))

# Check dead letter queue
dlq_size = len(retry_manager.dead_letter_queue)
print("Dead letter queue size:", dlq_size)
```

#### Step 2: Test Error Recovery
```bash
# Run auto recovery
from svg_mobile_app.email_genius.health_monitor import health_monitor
recovery_result = health_monitor.auto_recover_issues()
print("Recovery result:", recovery_result)
```

#### Step 3: Test System Repair
```bash
# Run system repair
from svg_mobile_app.email_genius.system_diagnostics import system_diagnostics
repair_result = system_diagnostics.repair_system_issues()
print("Repair result:", repair_result)
```

---

### **PHASE 9: REAL EMAIL TESTING** 📧

#### Step 1: Configure Real Email Account
```bash
# Set up a real email account in ERPNext
# Go to: Email Account > New
# Configure with real IMAP/SMTP settings
# Test connection
```

#### Step 2: Send Test Email
```bash
# Send an email TO your ERPNext email account with:
# - TO: your-erpnext@domain.com
# - CC: cc-test@domain.com
# - BCC: bcc-test@domain.com
# - Subject: Test Multi-Recipient Email Processing
# - Include attachments
```

#### Step 3: Verify Processing
```bash
# Wait a few minutes for email to be received
# Check Communication list for new records
# Verify:
# ✅ Original email received
# ✅ Separate records for CC recipients
# ✅ Separate records for BCC recipients
# ✅ Attachments cloned to all records
# ✅ Email Monitoring records created
# ✅ Unique message IDs generated
```

---

### **PHASE 10: ESCALATION TESTING** ⏰

#### Step 1: Test Manual Escalation
```bash
# Run escalation job manually
from svg_mobile_app.svg_mobile_app.doctype.email_monitoring.email_monitoring_escalation import run_escalations
run_escalations()

print("✅ Escalation job completed")
```

#### Step 2: Create Overdue Test Data
```bash
# Create an overdue Email Monitoring record
from datetime import datetime, timedelta

overdue_monitoring = frappe.get_doc({
    "doctype": "Email Monitoring",
    "communication": comm_doc.name,  # Use previous test communication
    "email_type": "Incoming",
    "status": "Need Reply",
    "assigned_user": "test@example.com",
    "priority": "High"
})
overdue_monitoring.insert()

# Backdate it to make it overdue
frappe.db.sql(f"""
    UPDATE `tabEmail Monitoring` 
    SET modified = DATE_SUB(NOW(), INTERVAL 3 DAY)
    WHERE name = '{overdue_monitoring.name}'
""")
frappe.db.commit()

print(f"✅ Created overdue monitoring record: {overdue_monitoring.name}")
```

#### Step 3: Test Escalation Notification
```bash
# Run escalation again to trigger notification
run_escalations()

# Check if notification was sent (check email or error logs)
print("✅ Escalation notification test completed")
```

---

## 📊 SUCCESS CRITERIA

### ✅ Must Pass All These Tests:

1. **System Health**: Overall status = "healthy" or "degraded"
2. **Configuration**: No critical errors in diagnostics
3. **BCC Processing**: Separate Communication records created for CC/BCC
4. **Unique Message IDs**: Each recipient copy has unique message ID
5. **Attachment Cloning**: Files attached to all recipient copies
6. **Email Monitoring**: Monitoring records auto-created
7. **UI Functionality**: Inbox enhancements working
8. **Performance**: Process 100 emails in < 60 seconds
9. **Error Handling**: Retry mechanisms functional
10. **Escalation**: Overdue notifications sent

### 📈 Performance Benchmarks:

- **Processing Speed**: 100 multi-recipient emails in < 60 seconds
- **Memory Usage**: < 500MB during bulk operations
- **Error Rate**: < 1% of operations fail
- **Database Performance**: Queries complete in < 100ms
- **Recovery Time**: System recovers from errors in < 30 seconds

### 🔧 Troubleshooting Common Issues:

#### Issue: BCC Processing Not Working
```bash
# Check settings
settings = frappe.get_single("BCC Processing Settings")
print("BCC Processing Enabled:", settings.enable_bcc_processing)
print("Gmail Account:", settings.gmail_forwarding_account)

# Check hooks
hooks = frappe.get_hooks("doc_events")
print("Communication hooks:", hooks.get("Communication", {}))
```

#### Issue: Performance Problems
```bash
# Check database indexes
from svg_mobile_app.email_genius.performance_optimization import create_email_system_indexes
result = create_email_system_indexes()
print("Indexes created:", result)

# Check memory usage
import psutil
import os
process = psutil.Process(os.getpid())
print("Memory usage:", process.memory_info().rss / 1024 / 1024, "MB")
```

#### Issue: Error Logs Full of Issues
```bash
# Check recent errors
errors = frappe.get_all("Error Log", 
    filters={"creation": [">", "2024-01-01"]},
    fields=["name", "method", "error"],
    limit=10
)
print("Recent errors:", len(errors))

# Run system repair
from svg_mobile_app.email_genius.system_diagnostics import repair_system_issues
repair_result = repair_system_issues()
print("Repair result:", repair_result)
```

---

## 🎯 FINAL VALIDATION

Before considering the system production-ready, ensure:

1. ✅ **All unit tests pass**
2. ✅ **All integration tests pass**  
3. ✅ **Real email processing works**
4. ✅ **Performance meets benchmarks**
5. ✅ **Error handling is robust**
6. ✅ **UI functions correctly**
7. ✅ **Documentation is complete**
8. ✅ **Backup/recovery tested**
9. ✅ **Team is trained**
10. ✅ **Monitoring is active**

---

*This testing guide ensures comprehensive validation of your email system before production deployment.*

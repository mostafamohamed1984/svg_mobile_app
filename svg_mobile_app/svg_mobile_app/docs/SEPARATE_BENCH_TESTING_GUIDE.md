# 🧪 SEPARATE BENCH TESTING GUIDE
## Testing Forked Repositories Before Production Deployment

This guide shows you how to create a completely separate bench to test your `frappe-svg` and `erpnext-svg` forks before deploying to your existing production bench.

---

## 📋 TABLE OF CONTENTS

1. [Why Use a Separate Test Bench?](#why-use-a-separate-test-bench)
2. [Prerequisites](#prerequisites)
3. [Test Bench Creation](#test-bench-creation)
4. [Repository Installation](#repository-installation)
5. [Email System Setup](#email-system-setup)
6. [Testing & Verification](#testing--verification)
7. [Migration to Production](#migration-to-production)
8. [Cleanup & Maintenance](#cleanup--maintenance)

---

## 🤔 WHY USE A SEPARATE TEST BENCH?

### **Advantages:**
✅ **Complete Isolation**: No risk to existing production environment  
✅ **Full Testing**: Test all functionality without affecting live data  
✅ **Easy Rollback**: Delete test bench if issues arise  
✅ **Confidence Building**: Verify everything works before production deployment  
✅ **Performance Testing**: Run load tests without impacting production  

### **Your Current Situation:**
- **Production Bench**: `test-bench` with original Frappe/ERPNext + `svg_mobile_app`
- **Forked Repos**: `frappe-svg` and `erpnext-svg` with email system modifications
- **Risk Level**: High (untested modifications on production-like environment)

### **Recommended Approach:**
Create `email-test-bench` → Install forks → Test thoroughly → Deploy to production

---

## ✅ PREREQUISITES

### System Requirements
```bash
# Check available disk space (need ~5-10GB for test bench)
df -h

# Check memory (recommend 4GB+ RAM)
free -h

# Check Python version
python3 --version  # Should be 3.8+

# Check Node.js version
node --version      # Should be 14+
```

### Repository Access
```bash
# Verify you can access your forks
git ls-remote --heads https://github.com/your-username/frappe-svg.git | head -5
git ls-remote --heads https://github.com/your-username/erpnext-svg.git | head -5

# Replace 'your-username' with your actual GitHub username
```

### Current Environment Backup
```bash
# Navigate to your existing bench and create backup
cd ~/test-bench  # or wherever your current bench is
bench --site testing.local backup --with-files
bench backup-all-sites

echo "✅ Backup completed - safe to proceed"
```

---

## 🏗️ TEST BENCH CREATION

### Step 1: Create New Bench Directory

```bash
# Navigate to parent directory (usually home)
cd ~

# Create new bench with original Frappe (we'll replace it later)
bench init email-test-bench --frappe-branch version-15

# Navigate to new bench
cd email-test-bench

echo "✅ Test bench created successfully"
```

### Step 2: Create Test Site

```bash
# Create a new site for testing
bench new-site email-testing.local --admin-password admin123 --mariadb-root-password your-mysql-password

# Enable developer mode (recommended for testing)
bench --site email-testing.local set-config developer_mode 1

# Set default site
bench use email-testing.local

echo "✅ Test site created: email-testing.local"
```

### Step 3: Verify Basic Setup

```bash
# Check bench status
bench version

# Check site status
bench --site email-testing.local status

# Start bench (in background)
bench start &

# Wait a few seconds then check if accessible
sleep 10
curl -I http://localhost:8000

echo "✅ Basic bench setup verified"
```

---

## 📦 REPOSITORY INSTALLATION

### Step 1: Replace Frappe with Your Fork

```bash
# Stop bench first
bench --site email-testing.local set-maintenance-mode on

# Navigate to apps directory
cd apps

# Backup original frappe (just in case)
mv frappe frappe-original

# Clone your frappe fork
git clone https://github.com/your-username/frappe-svg.git frappe

# Navigate to your frappe fork
cd frappe

# Check what branches are available
git branch -r

# Checkout the correct branch (adjust branch name as needed)
git checkout version-15  # or your email-system branch

# Verify your email system modifications are present
echo "Checking for email system modifications..."
grep -r "email_recipient_salt_for_threading" . && echo "✅ Threading found" || echo "❌ Threading not found"
grep -r "before_inbound_communication_insert" . && echo "✅ Hook found" || echo "❌ Hook not found"

cd ..
echo "✅ Frappe fork installed"
```

### Step 2: Install ERPNext Fork

```bash
# Remove default ERPNext if it exists
if [ -d "erpnext" ]; then
    mv erpnext erpnext-original
fi

# Clone your ERPNext fork
git clone https://github.com/your-username/erpnext-svg.git erpnext

# Navigate to your ERPNext fork
cd erpnext

# Checkout the correct branch
git checkout version-15  # or your email-system branch

# Verify any ERPNext modifications (if you made any)
git log --oneline -10

cd ..
echo "✅ ERPNext fork installed"
```

### Step 3: Install SVG Mobile App

```bash
# Get your SVG Mobile App (from your existing bench or repository)
# Option A: Copy from existing bench
cp -r ~/test-bench/apps/svg_mobile_app ./

# Option B: Clone from repository (if you have it in a repo)
# git clone https://github.com/your-username/svg_mobile_app.git

echo "✅ SVG Mobile App copied"
```

### Step 4: Install Apps on Site

```bash
# Navigate back to bench root
cd ~/email-test-bench

# Install ERPNext on the site
bench --site email-testing.local install-app erpnext

# Install SVG Mobile App
bench --site email-testing.local install-app svg_mobile_app

# Run migrations
bench --site email-testing.local migrate

# Build assets
bench build --force

# Clear cache
bench --site email-testing.local clear-cache

# Turn off maintenance mode
bench --site email-testing.local set-maintenance-mode off

echo "✅ All apps installed and configured"
```

---

## 🔧 EMAIL SYSTEM SETUP

### Step 1: Verify Installation

```bash
# Check if email system files are present
ls -la apps/svg_mobile_app/email_genius/
ls -la apps/svg_mobile_app/svg_mobile_app/doctype/bcc_processing_settings/
ls -la apps/svg_mobile_app/svg_mobile_app/doctype/email_monitoring/

# Check hooks configuration
grep -A 10 -B 5 "before_inbound_communication_insert" apps/svg_mobile_app/hooks.py

echo "✅ Email system files verified"
```

### Step 2: Run Complete Setup

```bash
# Open bench console
bench --site email-testing.local console

# In the console, run:
```

```python
# Run complete email system setup
from svg_mobile_app.setup_email_system_complete import run_complete_setup
result = run_complete_setup()
print("Setup Result:", result.get('setup_result', {}).get('success', False))
print("Completion:", result.get('completion_verification', {}).get('completion_percentage', 0), "%")

# Check system health
from svg_mobile_app.email_genius.health_monitor import get_system_health
health = get_system_health()
print("System Health:", health.get('health', {}).get('overall_status', 'unknown'))

# Exit console
exit()
```

### Step 3: Configure Email Settings

```bash
# Access the web interface
echo "🌐 Access your test site at: http://localhost:8000"
echo "👤 Login with: Administrator / admin123"
echo ""
echo "📧 Configure Email Settings:"
echo "1. Go to: Setup > Email > BCC Processing Settings"
echo "2. Enable BCC Processing: ✓"
echo "3. Set Gmail Forwarding Account (if needed)"
echo "4. Enable Subject Timestamping: ✓ (optional)"
echo "5. Save settings"
```

---

## 🧪 TESTING & VERIFICATION

### Step 1: Run Automated Tests

```bash
# Run basic unit tests
cd apps/svg_mobile_app
python -m pytest tests/test_email_system_complete.py -v

# Run enhanced tests (if available)
python -m pytest tests/test_email_system_enhanced.py -v

# Run quick start verification
cd ~/email-test-bench
bench --site email-testing.local execute svg_mobile_app.quick_start.main
```

### Step 2: Manual Email Processing Test

```bash
# Open bench console for manual testing
bench --site email-testing.local console
```

```python
# Create test email with multiple recipients
import frappe

test_comm = frappe.get_doc({
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
})

test_comm.insert()
print(f"✅ Created communication: {test_comm.name}")

# Check if BCC processing worked
related = frappe.get_all("Communication", 
    filters={"custom_original_message_id": test_comm.message_id},
    fields=["name", "recipients", "custom_recipient_type", "message_id"])

print(f"✅ Found {len(related)} related communications:")
for r in related:
    print(f"  - {r.name}: {r.recipients} ({r.custom_recipient_type})")
    print(f"    Message ID: {r.message_id}")

# Check if Email Monitoring was created
monitoring = frappe.get_all("Email Monitoring",
    filters={"communication": test_comm.name},
    fields=["name", "status", "email_type", "priority"])

if monitoring:
    print(f"✅ Email Monitoring created: {monitoring[0]}")
else:
    print("❌ Email Monitoring not created - check configuration")

exit()
```

### Step 3: UI Testing

```bash
echo "🖥️  WEB UI TESTING CHECKLIST:"
echo ""
echo "1. 📧 Email Inbox:"
echo "   - Access: http://localhost:8000/app/communication"
echo "   - Verify: Multiple communications for test email"
echo "   - Check: Unique message IDs for each recipient"
echo ""
echo "2. 📊 Email Monitoring:"
echo "   - Access: http://localhost:8000/app/email-monitoring"
echo "   - Verify: Monitoring record created"
echo "   - Test: Status updates and assignments"
echo ""
echo "3. ⚙️  BCC Processing Settings:"
echo "   - Access: http://localhost:8000/app/bcc-processing-settings"
echo "   - Verify: All configuration options available"
echo "   - Test: Save and update settings"
```

### Step 4: Performance Testing

```bash
# Create multiple test emails to test performance
bench --site email-testing.local console
```

```python
# Performance test - create 20 emails with multiple recipients
import frappe
from datetime import datetime

start_time = datetime.now()

for i in range(20):
    test_comm = frappe.get_doc({
        "doctype": "Communication",
        "communication_medium": "Email",
        "sent_or_received": "Received", 
        "subject": f"Performance Test Email {i+1}",
        "sender": f"sender{i+1}@example.com",
        "recipients": f"recipient{i+1}@example.com",
        "cc": f"cc{i+1}@example.com, cc{i+1}-2@example.com", 
        "bcc": f"bcc{i+1}@example.com",
        "content": f"Performance test email number {i+1}",
        "message_id": f"<perftest{i+1}@example.com>",
        "email_account": "Test Account"
    })
    test_comm.insert()

end_time = datetime.now()
processing_time = (end_time - start_time).total_seconds()

# Check results
total_comms = frappe.db.count("Communication", {"subject": ["like", "Performance Test Email%"]})
total_monitoring = frappe.db.count("Email Monitoring")

print(f"✅ Performance Test Results:")
print(f"   📧 Total Communications Created: {total_comms}")
print(f"   📊 Total Monitoring Records: {total_monitoring}")
print(f"   ⏱️  Processing Time: {processing_time:.2f} seconds")
print(f"   🚀 Average per Email: {processing_time/20:.2f} seconds")

exit()
```

---

## 🚀 MIGRATION TO PRODUCTION

### Step 1: Verify Test Results

```bash
# Check final system health in test bench
bench --site email-testing.local console
```

```python
from svg_mobile_app.email_genius.system_diagnostics import run_system_diagnostics
diagnostics = run_system_diagnostics()

print("=== FINAL TEST RESULTS ===")
print(f"Overall Status: {diagnostics['diagnostics']['overall_status']}")
print(f"Errors: {len(diagnostics['diagnostics']['errors'])}")
print(f"Warnings: {len(diagnostics['diagnostics']['warnings'])}")

if diagnostics['diagnostics']['overall_status'] == 'healthy':
    print("✅ READY FOR PRODUCTION DEPLOYMENT")
else:
    print("❌ ISSUES FOUND - RESOLVE BEFORE PRODUCTION")
    for error in diagnostics['diagnostics']['errors']:
        print(f"   ERROR: {error}")

exit()
```

### Step 2: Document Test Results

```bash
# Create test report
cat > ~/email_system_test_report.md << EOF
# Email System Test Report
**Date**: $(date)
**Test Bench**: email-test-bench
**Test Site**: email-testing.local

## Test Results Summary
- [ ] Basic functionality: PASS/FAIL
- [ ] Email processing: PASS/FAIL  
- [ ] BCC/CC handling: PASS/FAIL
- [ ] Monitoring system: PASS/FAIL
- [ ] Performance: PASS/FAIL
- [ ] UI components: PASS/FAIL

## Issues Found
(List any issues discovered during testing)

## Ready for Production
- [ ] YES - All tests passed
- [ ] NO - Issues need resolution

## Next Steps
(Document next actions based on test results)
EOF

echo "📝 Test report created: ~/email_system_test_report.md"
```

### Step 3: Production Deployment (If Tests Pass)

```bash
# If all tests pass, follow the production deployment guide
echo "🚀 If tests are successful, proceed with production deployment:"
echo "   1. Follow: svg_mobile_app/docs/Forked_Repository_Deployment_Guide.md"
echo "   2. Apply the same steps to your production bench (test-bench)"
echo "   3. Use Method 1: In-Place Repository Switch"
echo ""
echo "⚠️  IMPORTANT: Create production backup before deployment!"
```

---

## 🧹 CLEANUP & MAINTENANCE

### Step 1: Keep Test Bench for Future Use

```bash
# Stop test bench to save resources
cd ~/email-test-bench
bench stop

echo "💡 Test bench preserved at: ~/email-test-bench"
echo "   Start again with: cd ~/email-test-bench && bench start"
```

### Step 2: Optional: Remove Test Bench

```bash
# Only if you want to completely remove the test bench
# WARNING: This will delete all test data

# Stop bench
cd ~/email-test-bench
bench stop

# Remove the entire test bench
cd ~
rm -rf email-test-bench

echo "🗑️  Test bench removed completely"
```

### Step 3: Update Your Forks

```bash
# Keep your forks up to date with upstream changes
cd ~/email-test-bench/apps/frappe  # or wherever your forks are

# Add upstream remote (if not already added)
git remote add upstream https://github.com/frappe/frappe.git

# Fetch upstream changes
git fetch upstream

# Create a branch to merge upstream changes
git checkout -b update-from-upstream
git merge upstream/version-15

# Resolve any conflicts and test
# If successful, push to your fork
git push origin update-from-upstream
```

---

## 📊 SUCCESS CRITERIA

### ✅ Test Bench Setup Success:
1. **Environment**: Test bench created and running
2. **Apps**: Frappe-svg, ERPNext-svg, SVG Mobile App installed
3. **Migration**: Database migrated successfully
4. **Build**: Assets built without errors
5. **Access**: Web interface accessible

### ✅ Email System Testing Success:
1. **BCC Processing**: Multiple recipients create separate records
2. **Unique IDs**: Each recipient gets unique message ID
3. **Monitoring**: Email Monitoring records auto-created
4. **Attachments**: File attachments cloned properly
5. **Performance**: Acceptable processing speed
6. **UI**: All interface components working

### ✅ Production Readiness:
1. **System Health**: Overall status "healthy"
2. **No Critical Errors**: All major issues resolved
3. **Documentation**: Test results documented
4. **Backup**: Production backup strategy confirmed
5. **Rollback Plan**: Rollback procedure tested

---

## 🆘 TROUBLESHOOTING

### Issue: Test Bench Creation Fails

```bash
# Check system requirements
python3 --version  # Must be 3.8+
node --version     # Must be 14+
npm --version

# Check disk space
df -h

# Try with specific Python version
bench init email-test-bench --python python3.8 --frappe-branch version-15
```

### Issue: Fork Installation Fails

```bash
# Check repository access
ssh -T git@github.com  # For SSH
curl -I https://github.com/your-username/frappe-svg.git  # For HTTPS

# Use HTTPS instead of SSH if needed
git clone https://github.com/your-username/frappe-svg.git frappe

# Check branch names
git branch -r | grep -E "(version-15|main|email-system)"
```

### Issue: Email System Not Working

```bash
# Check hooks are loaded
bench --site email-testing.local console
```

```python
import frappe
hooks = frappe.get_hooks()
print("Before inbound hook:", hooks.get('before_inbound_communication_insert', 'Not found'))
print("Doc events Communication:", 'Communication' in hooks.get('doc_events', {}))
exit()
```

```bash
# Restart bench and clear cache
bench restart
bench --site email-testing.local clear-cache

# Re-run setup
bench --site email-testing.local execute svg_mobile_app.setup_email_system_complete.run_complete_setup
```

### Issue: Performance Problems

```bash
# Check system resources
htop  # or top
free -h
df -h

# Check database performance
bench --site email-testing.local console
```

```python
from svg_mobile_app.email_genius.performance_optimization import setup_email_system_performance
result = setup_email_system_performance()
print("Performance setup:", result)
exit()
```

---

## 🎯 NEXT STEPS

After successful testing in your separate bench:

1. **✅ Document Results**
   - Complete test report
   - Note any issues found
   - Record performance metrics

2. **✅ Plan Production Deployment**
   - Schedule maintenance window
   - Prepare rollback plan
   - Notify users of changes

3. **✅ Deploy to Production**
   - Follow `Forked_Repository_Deployment_Guide.md`
   - Apply same repository switches to production bench
   - Run same verification steps

4. **✅ Monitor Production**
   - Watch for any issues
   - Monitor performance
   - Collect user feedback

5. **✅ Maintain Test Environment**
   - Keep test bench for future updates
   - Test new features before production
   - Use for troubleshooting

---

*This guide ensures you can safely test your email system modifications in complete isolation before affecting your production environment.*

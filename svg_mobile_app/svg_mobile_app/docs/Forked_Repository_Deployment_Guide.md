# 🚀 FORKED REPOSITORY DEPLOYMENT GUIDE

This guide covers deploying your modified frappe-svg and erpnext-svg repositories to integrate with the email system.

## 📋 TABLE OF CONTENTS

1. [Current Situation Analysis](#current-situation-analysis)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Repository Deployment Steps](#repository-deployment-steps)
4. [Verification Procedures](#verification-procedures)
5. [Alternative Deployment Methods](#alternative-deployment-methods)
6. [Troubleshooting](#troubleshooting)
7. [Post-Deployment Testing](#post-deployment-testing)

---

## 🔍 CURRENT SITUATION ANALYSIS

### Your Setup:
- **Site**: `testing.local` 
- **Bench Location**: `ssh server in test-bench/apps/svg_mobile_app`
- **SVG Mobile App**: ✅ Installed and ready
- **Frappe Framework**: ❌ Still using original (not your frappe-svg fork)
- **ERPNext**: ❌ Still using original (not your erpnext-svg fork)

### Required Action:
Deploy your forked repositories (frappe-svg and erpnext-svg) which contain the email system framework modifications.

---

## ✅ PRE-DEPLOYMENT CHECKLIST

### Step 1: Check Current Repository Status

```bash
# SSH to your server
ssh your-server

# Navigate to bench
cd test-bench

# Check current repository URLs
cd apps/frappe
git remote -v
echo "Current Frappe branch: $(git branch --show-current)"

cd ../erpnext
git remote -v
echo "Current ERPNext branch: $(git branch --show-current)"

cd ../svg_mobile_app
git remote -v
echo "Current SVG App branch: $(git branch --show-current)"
```

### Step 2: Create Full Backup (CRITICAL!)

```bash
# Navigate to bench root
cd test-bench

# Create comprehensive backup
bench --site testing.local backup --with-files
bench backup-all-sites

# Create additional file system backup
sudo tar -czf /tmp/bench_backup_$(date +%Y%m%d_%H%M%S).tar.gz .

# Verify backups were created
ls -la sites/testing.local/private/backups/
ls -la /tmp/bench_backup_*.tar.gz

echo "✅ Backups created successfully"
```

### Step 3: Verify Fork Repository URLs

```bash
# Make sure you have the correct URLs for your forks
# Replace 'your-username' with your actual GitHub username
FRAPPE_FORK="https://github.com/your-username/frappe-svg.git"
ERPNEXT_FORK="https://github.com/your-username/erpnext-svg.git"

echo "Frappe fork URL: $FRAPPE_FORK"
echo "ERPNext fork URL: $ERPNEXT_FORK"

# Test connectivity to your forks
git ls-remote --heads $FRAPPE_FORK | head -5
git ls-remote --heads $ERPNEXT_FORK | head -5
```

---

## 🚀 REPOSITORY DEPLOYMENT STEPS

### Method 1: In-Place Repository Switch (Recommended)

#### Step 1: Deploy Frappe-SVG Fork

```bash
# Navigate to frappe directory
cd test-bench/apps/frappe

# Add your fork as a remote (if not already added)
git remote add svg-fork https://github.com/your-username/frappe-svg.git

# Or if you need to change the URL:
# git remote set-url origin https://github.com/your-username/frappe-svg.git

# Fetch your fork
git fetch svg-fork

# Check what branches are available
git branch -r | grep svg-fork

# Switch to your email system branch (adjust branch name as needed)
git checkout -b email-system svg-fork/version-15
# OR if you have a specific branch:
# git checkout -b email-system svg-fork/email-system-branch

# Verify you're on the right branch with your modifications
git log --oneline -10

echo "✅ Frappe-SVG fork deployed"
```

#### Step 2: Deploy ERPNext-SVG Fork

```bash
# Navigate to erpnext directory
cd test-bench/apps/erpnext

# Add your fork as a remote
git remote add svg-fork https://github.com/your-username/erpnext-svg.git

# Fetch your fork
git fetch svg-fork

# Check available branches
git branch -r | grep svg-fork

# Switch to your email system branch
git checkout -b email-system svg-fork/version-15
# OR your specific branch:
# git checkout -b email-system svg-fork/email-system-branch

# Verify you're on the right branch
git log --oneline -10

echo "✅ ERPNext-SVG fork deployed"
```

#### Step 3: Verify Email System Modifications

```bash
# Check if your frappe modifications are present
cd test-bench/apps/frappe

# Look for email system modifications
echo "Checking for threading modification..."
grep -r "email_recipient_salt_for_threading" . && echo "✅ Threading found" || echo "❌ Threading not found"

echo "Checking for hook modification..."
grep -r "before_inbound_communication_insert" . && echo "✅ Hook found" || echo "❌ Hook not found"

# Check specific file modifications
echo "Checking receive.py modifications..."
if grep -q "recipient_salt" frappe/email/receive.py; then
    echo "✅ receive.py has email system modifications"
else
    echo "❌ receive.py not modified - check your fork"
fi

echo "Checking email queue modifications..."
if grep -q "recipient_salt" frappe/email/doctype/email_queue/email_queue.py; then
    echo "✅ email_queue.py has email system modifications"
else
    echo "❌ email_queue.py not modified - check your fork"
fi
```

#### Step 4: Run Migration and Build

```bash
# Navigate to bench root
cd test-bench

echo "Running database migration..."
bench --site testing.local migrate

echo "Building assets..."
bench build --force

echo "Clearing cache..."
bench --site testing.local clear-cache

echo "Restarting services..."
bench restart

echo "✅ Migration and build completed"
```

---

## 🔧 ALTERNATIVE DEPLOYMENT METHODS

### Method 2: Clean Reinstall (If Method 1 Fails)

```bash
# Navigate to bench
cd test-bench

echo "Creating additional backup before clean install..."
cp -r apps apps_backup_$(date +%Y%m%d_%H%M%S)

echo "Removing existing apps..."
bench remove-app frappe --force
bench remove-app erpnext --force

echo "Installing your forked versions..."
bench get-app https://github.com/your-username/frappe-svg.git frappe
bench get-app https://github.com/your-username/erpnext-svg.git erpnext

echo "Reinstalling apps..."
bench install-app frappe
bench install-app erpnext

# svg_mobile_app should already be installed, but if not:
# bench install-app svg_mobile_app

echo "Running migration and build..."
bench migrate
bench build --force
bench restart

echo "✅ Clean reinstall completed"
```

### Method 3: URL Switch Method

```bash
# Navigate to bench
cd test-bench

# Switch frappe remote URL
cd apps/frappe
git remote set-url origin https://github.com/your-username/frappe-svg.git
git fetch origin
git checkout version-15  # or your branch name
git pull origin version-15

# Switch erpnext remote URL
cd ../erpnext
git remote set-url origin https://github.com/your-username/erpnext-svg.git
git fetch origin
git checkout version-15  # or your branch name
git pull origin version-15

# Migrate and build
cd ../..
bench migrate
bench build --force
bench restart

echo "✅ URL switch method completed"
```

---

## ✅ VERIFICATION PROCEDURES

### Step 1: Check Repository Status

```bash
cd test-bench/apps/frappe
echo "Frappe repo: $(git remote get-url origin)"
echo "Frappe branch: $(git branch --show-current)"
echo "Frappe last commit: $(git log --oneline -1)"

cd ../erpnext  
echo "ERPNext repo: $(git remote get-url origin)"
echo "ERPNext branch: $(git branch --show-current)"
echo "ERPNext last commit: $(git log --oneline -1)"

cd ../svg_mobile_app
echo "SVG App repo: $(git remote get-url origin)"
echo "SVG App branch: $(git branch --show-current)"
```

### Step 2: Test Email System Integration

```bash
bench --site testing.local console

# Check if your custom hooks are loaded
>>> import frappe
>>> hooks = frappe.get_hooks()
>>> print("Before inbound hook:", hooks.get('before_inbound_communication_insert', 'Not found'))
>>> print("Doc events Communication:", 'Communication' in hooks.get('doc_events', {}))

# Test email system setup
>>> from svg_mobile_app.setup_email_system_complete import run_complete_setup
>>> result = run_complete_setup()
>>> print("Setup success:", result.get('setup_result', {}).get('success', False))
>>> print("Completion percentage:", result.get('completion_verification', {}).get('completion_percentage', 0))

# Test system health
>>> from svg_mobile_app.email_genius.health_monitor import get_system_health
>>> health = get_system_health()
>>> print("System health:", health.get('health', {}).get('overall_status', 'unknown'))

>>> exit()
```

### Step 3: Test Email Processing

```bash
bench --site testing.local console

# Create a test email with multiple recipients
>>> test_comm = frappe.get_doc({
...     "doctype": "Communication",
...     "communication_medium": "Email",
...     "sent_or_received": "Received", 
...     "subject": "Test Multi-Recipient Email",
...     "sender": "sender@example.com",
...     "recipients": "recipient1@example.com",
...     "cc": "cc1@example.com, cc2@example.com", 
...     "bcc": "bcc1@example.com",
...     "content": "This is a test email",
...     "message_id": "<test123@example.com>",
...     "email_account": "Test Account"
... })
>>> test_comm.insert()
>>> print(f"✅ Created communication: {test_comm.name}")

# Check if BCC processing worked
>>> related = frappe.get_all("Communication", 
...     filters={"custom_original_message_id": test_comm.message_id},
...     fields=["name", "recipients", "custom_recipient_type"])
>>> print(f"✅ Found {len(related)} related communications:")
>>> for r in related:
...     print(f"  - {r.name}: {r.recipients} ({r.custom_recipient_type})")

# Check if Email Monitoring was created
>>> monitoring = frappe.get_all("Email Monitoring",
...     filters={"communication": test_comm.name},
...     fields=["name", "status", "email_type"])
>>> if monitoring:
...     print(f"✅ Email Monitoring created: {monitoring[0]}")
... else:
...     print("❌ Email Monitoring not created")

>>> exit()
```

---

## 🚨 TROUBLESHOOTING

### Issue: Git Permission Denied

```bash
# If you get permission errors, you might need to set up SSH keys
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"

# Add the public key to your GitHub account
cat ~/.ssh/id_rsa.pub

# Or use HTTPS with personal access token
git remote set-url origin https://username:token@github.com/your-username/frappe-svg.git
```

### Issue: Branch Not Found

```bash
# Check available branches in your fork
git ls-remote --heads https://github.com/your-username/frappe-svg.git
git ls-remote --heads https://github.com/your-username/erpnext-svg.git

# Use the correct branch name (probably 'version-15' or 'main')
git checkout -b email-system svg-fork/version-15

# If you're not sure which branch has your modifications:
git branch -r | xargs -I {} git log --oneline -1 {}
```

### Issue: Migration Fails

```bash
# Check migration status
bench --site testing.local migrate --dry-run

# If there are issues, check the error logs
tail -f logs/worker.log

# You might need to:
bench --site testing.local --force reinstall

# Or restore from backup and try a different deployment method
bench --site testing.local restore [backup-file-path]
```

### Issue: Build Fails

```bash
# Check for build errors
bench build --verbose

# Clear everything and rebuild
bench clear-cache
bench clear-website-cache
rm -rf assets/*
bench build --force

# If still failing, check for JavaScript/CSS errors
tail -f logs/web.log
```

### Issue: Email System Not Working After Deployment

```bash
# Check if hooks are properly loaded
bench --site testing.local console
>>> import frappe
>>> frappe.clear_cache()
>>> hooks = frappe.get_hooks()
>>> print("Email hooks:", hooks.get('doc_events', {}).get('Communication', {}))

# Restart everything
>>> exit()
bench restart
bench --site testing.local clear-cache

# Re-run the setup
bench --site testing.local console
>>> from svg_mobile_app.setup_email_system_complete import run_complete_setup
>>> run_complete_setup()
```

### Issue: Performance Problems After Deployment

```bash
# Check database performance
bench --site testing.local console
>>> from svg_mobile_app.email_genius.performance_optimization import setup_email_system_performance
>>> result = setup_email_system_performance()
>>> print("Performance setup:", result)

# Check system resources
htop
df -h
free -h
```

---

## 🧪 POST-DEPLOYMENT TESTING

### Step 1: Run Quick Start

```bash
# Navigate to svg_mobile_app
cd test-bench/apps/svg_mobile_app

# Run quick start script
bench --site testing.local execute svg_mobile_app.quick_start.main
```

### Step 2: Run Comprehensive Tests

```bash
# Run basic unit tests
python -m pytest svg_mobile_app/tests/test_email_system_complete.py -v

# Run enhanced tests with load testing
python -m pytest svg_mobile_app/tests/test_email_system_enhanced.py -v
```

### Step 3: Manual Functional Testing

```bash
# Follow the testing guide
# See: svg_mobile_app/docs/TESTING_GUIDE.md

# Key tests to perform:
# 1. Multi-recipient email processing
# 2. Email monitoring creation
# 3. Role-based forwarding
# 4. Communication linking
# 5. Escalation system
# 6. UI enhancements
```

---

## 📊 SUCCESS CRITERIA

### ✅ Repository Deployment Success:

1. **Git Status**: Both frappe and erpnext pointing to your forks
2. **Branch Verification**: On correct branches with your modifications
3. **File Verification**: Email system modifications present in code
4. **Migration Success**: Database migration completed without errors
5. **Build Success**: Assets built successfully
6. **Service Status**: All bench services running

### ✅ Email System Integration Success:

1. **Hooks Active**: `before_inbound_communication_insert` hook loaded
2. **Doc Events**: Communication doc events configured
3. **BCC Processing**: Multi-recipient emails create separate records
4. **Monitoring**: Email Monitoring records auto-created
5. **Health Check**: System health status "healthy" or "degraded"
6. **Performance**: Database indexes created and optimized

### ✅ Functional Testing Success:

1. **Email Processing**: Test emails processed correctly
2. **UI Components**: Inbox enhancements working
3. **API Endpoints**: All email system APIs responding
4. **Escalation**: Escalation job runs without errors
5. **Error Handling**: Retry mechanisms and error recovery active

---

## 📋 NEXT STEPS

After successful repository deployment:

1. **✅ Configure Email Settings**
   - Go to BCC Processing Settings
   - Enable BCC processing
   - Configure email accounts

2. **✅ Run Full Testing Suite**
   - Follow `TESTING_GUIDE.md`
   - Test with real emails
   - Verify all functionality

3. **✅ Set Up Monitoring**
   - Configure health monitoring
   - Set up alerts
   - Test escalation system

4. **✅ Plan Production Deployment**
   - Follow `VERSION_CONTROL_DEPLOYMENT_GUIDE.md`
   - Prepare production environment
   - Schedule deployment

5. **✅ User Training**
   - Train users on new features
   - Document workflows
   - Provide support

---

## 🎯 ROLLBACK PROCEDURE

If deployment fails and you need to rollback:

### Emergency Rollback

```bash
# Stop all services
bench --site testing.local set-maintenance-mode on

# Restore from backup
bench --site testing.local restore [backup-file-path]

# Or switch back to original repositories
cd apps/frappe
git remote set-url origin https://github.com/frappe/frappe.git
git fetch origin
git checkout version-15
git pull origin version-15

cd ../erpnext
git remote set-url origin https://github.com/frappe/erpnext.git
git fetch origin
git checkout version-15
git pull origin version-15

# Migrate and restart
cd ../..
bench migrate
bench build --force
bench restart
bench --site testing.local set-maintenance-mode off
```

---

*This guide ensures safe deployment of your forked repositories with comprehensive verification and rollback procedures.*

# 🚀 VERSION CONTROL & DEPLOYMENT GUIDE

This guide covers the complete version control strategy and deployment process for your email system.

## 📋 TABLE OF CONTENTS

1. [Current Situation Analysis](#current-situation-analysis)
2. [Git Repository Strategy](#git-repository-strategy)
3. [Development Workflow](#development-workflow)
4. [Deployment Options](#deployment-options)
5. [Production Deployment](#production-deployment)
6. [Rollback Strategy](#rollback-strategy)
7. [Ongoing Maintenance](#ongoing-maintenance)

---

## 🔍 CURRENT SITUATION ANALYSIS

### Your Current Setup:
- **Production**: Original Frappe/ERPNext repositories
- **Development**: Custom forks (`frappe-svg`, `erpnext-svg`) with email system modifications
- **App**: `svg_mobile_app` with complete email system implementation
- **Status**: 100% implemented, never tested or deployed

### Challenge:
You need to deploy your email system modifications to production without breaking existing functionality.

---

## 🌳 GIT REPOSITORY STRATEGY

### **Option A: Multi-Remote Strategy (Recommended)**

This approach maintains your forks while staying connected to upstream updates.

#### Step 1: Set Up Multiple Remotes

```bash
# Navigate to your local frappe-svg directory
cd /path/to/your/frappe-svg

# Check current remotes
git remote -v

# Add original Frappe as upstream (if not already added)
git remote add upstream https://github.com/frappe/frappe.git

# Your fork should already be origin
# origin    https://github.com/your-username/frappe-svg.git (fetch)
# origin    https://github.com/your-username/frappe-svg.git (push)
# upstream  https://github.com/frappe/frappe.git (fetch)
# upstream  https://github.com/frappe/frappe.git (push)

# Do the same for ERPNext
cd /path/to/your/erpnext-svg
git remote add upstream https://github.com/frappe/erpnext.git
```

#### Step 2: Create Production Branches

```bash
# In frappe-svg
git checkout -b production-email-system
git push origin production-email-system

# In erpnext-svg  
git checkout -b production-email-system
git push origin production-email-system

# In svg_mobile_app
git checkout -b production-ready
git push origin production-ready
```

#### Step 3: Document Your Changes

```bash
# Create a changelog for your modifications
cat > CUSTOM_CHANGES.md << 'EOF'
# Custom Email System Modifications

## Frappe Framework Changes
- Modified `frappe/email/receive.py` for recipient-aware threading
- Added `before_inbound_communication_insert` hook support
- Enhanced email queue for per-recipient message ID salting

## ERPNext Changes
- [List any ERPNext-specific modifications]

## SVG Mobile App
- Complete email system implementation
- BCC/CC processing with unique message IDs
- Email monitoring and supervision workflow
- Role-based forwarding system
- OAuth2 integration
- Performance optimizations
- Comprehensive testing suite

## Deployment Date
[To be filled when deployed]

## Version Compatibility
- Frappe Framework: v15.x
- ERPNext: v15.x
- Python: 3.8+
EOF

git add CUSTOM_CHANGES.md
git commit -m "Document custom email system modifications"
git push origin production-email-system
```

---

## 🔄 DEVELOPMENT WORKFLOW

### Daily Development Process

```bash
# 1. Start your development day
cd /path/to/your/project
git checkout main  # or your main development branch
git pull origin main

# 2. Create feature branch for new work
git checkout -b feature/email-enhancement-xyz
# Make your changes
git add .
git commit -m "Add email enhancement XYZ"
git push origin feature/email-enhancement-xyz

# 3. Merge to main after testing
git checkout main
git merge feature/email-enhancement-xyz
git push origin main

# 4. Update production branch when ready
git checkout production-email-system
git merge main
git push origin production-email-system
```

### Syncing with Upstream (Monthly)

```bash
# Fetch latest from original repositories
cd frappe-svg
git fetch upstream
git fetch origin

# Check what's different
git log --oneline origin/version-15..upstream/version-15

# Create a backup branch before merging
git checkout -b backup-before-upstream-sync
git push origin backup-before-upstream-sync

# Merge upstream changes (be careful with conflicts)
git checkout version-15
git merge upstream/version-15

# Resolve conflicts if any
# Test thoroughly after merge
# Push updated fork
git push origin version-15
```

---

## 🚀 DEPLOYMENT OPTIONS

### **Option 1: Replace Existing Apps (Cleanest)**

**Pros**: Clean deployment, no conflicts
**Cons**: Requires downtime, more complex rollback

```bash
# On production server
cd /home/frappe/frappe-bench

# 1. Create comprehensive backup
bench backup --with-files
bench backup-all-sites
tar -czf full_backup_$(date +%Y%m%d_%H%M%S).tar.gz sites/

# 2. Remove existing apps
bench remove-app frappe --force
bench remove-app erpnext --force

# 3. Get your forked versions
bench get-app https://github.com/your-username/frappe-svg.git frappe
bench get-app https://github.com/your-username/erpnext-svg.git erpnext
bench get-app https://github.com/your-username/svg_mobile_app.git

# 4. Install apps
bench install-app frappe
bench install-app erpnext
bench install-app svg_mobile_app

# 5. Migrate and build
bench migrate
bench build --force
bench restart
```

### **Option 2: Switch Remote URLs (Faster)**

**Pros**: Faster deployment, keeps git history
**Cons**: May have conflicts if branches diverged

```bash
# On production server
cd /home/frappe/frappe-bench

# 1. Create backup
bench backup --with-files

# 2. Switch remote URLs
cd apps/frappe
git remote set-url origin https://github.com/your-username/frappe-svg.git
git fetch origin
git checkout production-email-system
git pull origin production-email-system

cd ../erpnext
git remote set-url origin https://github.com/your-username/erpnext-svg.git
git fetch origin
git checkout production-email-system
git pull origin production-email-system

# 3. Add svg_mobile_app
cd ..
bench get-app https://github.com/your-username/svg_mobile_app.git
bench install-app svg_mobile_app

# 4. Migrate and build
bench migrate
bench build --force
bench restart
```

### **Option 3: Branch-Based Deployment (Most Flexible)**

**Pros**: Most flexible, easy rollback
**Cons**: More complex setup

```bash
# On production server
cd /home/frappe/frappe-bench

# 1. Add custom remotes
cd apps/frappe
git remote add custom https://github.com/your-username/frappe-svg.git
git fetch custom

cd ../erpnext
git remote add custom https://github.com/your-username/erpnext-svg.git
git fetch custom

# 2. Switch to custom branches
bench switch-to-branch custom/production-email-system frappe
bench switch-to-branch custom/production-email-system erpnext

# 3. Add svg_mobile_app
bench get-app https://github.com/your-username/svg_mobile_app.git
bench install-app svg_mobile_app

# 4. Migrate and build
bench migrate
bench build --force
bench restart
```

---

## 🏭 PRODUCTION DEPLOYMENT

### **Pre-Deployment Checklist**

```bash
# 1. Verify all tests pass locally
cd /path/to/svg_mobile_app
python -m pytest tests/ -v

# 2. Run complete system setup
bench --site [your-site] execute svg_mobile_app.quick_start.main

# 3. Verify system health
bench --site [your-site] console
>>> from svg_mobile_app.email_genius.health_monitor import get_system_health
>>> health = get_system_health()
>>> print("Status:", health['health']['overall_status'])

# 4. Create deployment branch
git checkout -b deployment-$(date +%Y%m%d)
git push origin deployment-$(date +%Y%m%d)

# 5. Document deployment
echo "Deployment $(date): Email system v1.0" >> DEPLOYMENT_LOG.md
git add DEPLOYMENT_LOG.md
git commit -m "Log deployment $(date +%Y%m%d)"
git push origin deployment-$(date +%Y%m%d)
```

### **Deployment Execution**

```bash
# Schedule maintenance window
# Send notification to users
# Prepare rollback plan

# Execute deployment (choose one option from above)
# Option 1 is recommended for first deployment

# Post-deployment verification
bench --site [your-site] console

# Verify email system functionality
>>> from svg_mobile_app.setup_email_system_complete import verify_email_system_completion
>>> result = verify_email_system_completion()
>>> print("Completion:", result['completion_percentage'], "%")
>>> print("Is Complete:", result['is_complete'])

# Test basic functionality
>>> from svg_mobile_app.email_genius.health_monitor import get_system_health  
>>> health = get_system_health()
>>> print("System Health:", health['health']['overall_status'])

# Check for errors
>>> errors = frappe.get_all("Error Log", 
...     filters={"creation": [">", "2024-01-25"]}, 
...     limit=10)
>>> print("Recent errors:", len(errors))
```

### **Post-Deployment Validation**

```bash
# 1. Verify all services running
bench status
sudo systemctl status nginx
sudo systemctl status mysql
sudo systemctl status redis

# 2. Check email processing
bench --site [your-site] console
>>> # Create test communication
>>> test_comm = frappe.get_doc({
...     "doctype": "Communication",
...     "communication_medium": "Email", 
...     "sent_or_received": "Received",
...     "subject": "Production Test Email",
...     "sender": "test@example.com",
...     "recipients": "user1@test.com",
...     "cc": "user2@test.com",
...     "content": "Test email processing"
... })
>>> test_comm.insert()
>>> print("Test communication created:", test_comm.name)

# 3. Verify BCC processing
>>> related = frappe.get_all("Communication", 
...     filters={"custom_original_message_id": test_comm.message_id})
>>> print("Related communications:", len(related))

# 4. Check monitoring
>>> monitoring = frappe.get_all("Email Monitoring", 
...     filters={"communication": test_comm.name})
>>> print("Monitoring records:", len(monitoring))
```

---

## 🔙 ROLLBACK STRATEGY

### **Emergency Rollback (If Deployment Fails)**

```bash
# Option 1: Database Restore
bench --site [your-site] restore [backup-file-path]

# Option 2: Git Rollback
cd apps/frappe
git checkout [previous-commit-hash]
cd ../erpnext  
git checkout [previous-commit-hash]

# Remove svg_mobile_app if it's causing issues
bench remove-app svg_mobile_app --force

# Rebuild and restart
bench migrate
bench build --force
bench restart

# Option 3: Complete Rollback to Original
bench remove-app frappe --force
bench remove-app erpnext --force
bench get-app frappe
bench get-app erpnext
bench install-app frappe  
bench install-app erpnext
bench migrate
bench build --force
bench restart
```

### **Planned Rollback**

```bash
# Create rollback script
cat > rollback.sh << 'EOF'
#!/bin/bash
set -e

echo "Starting rollback process..."

# Create backup before rollback
bench backup --with-files

# Switch back to original repositories
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

# Remove custom app
bench remove-app svg_mobile_app --force

# Migrate and build
bench migrate
bench build --force
bench restart

echo "Rollback completed successfully"
EOF

chmod +x rollback.sh
```

---

## 🔄 ONGOING MAINTENANCE

### **Weekly Maintenance Tasks**

```bash
# 1. Update from upstream (if needed)
cd apps/frappe
git fetch upstream
# Only merge if there are important updates
# git merge upstream/version-15

# 2. Check system health
bench --site [your-site] console
>>> from svg_mobile_app.email_genius.health_monitor import get_system_health
>>> health = get_system_health()
>>> print("System Health:", health['health']['overall_status'])

# 3. Clean up old data
>>> from svg_mobile_app.email_genius.system_diagnostics import repair_system_issues
>>> repair_result = repair_system_issues(["cleanup_old_logs"])
>>> print("Cleanup result:", repair_result)

# 4. Performance check
>>> from svg_mobile_app.email_genius.performance_optimization import get_performance_report
>>> report = get_performance_report()
>>> print("Performance:", report['status'])
```

### **Monthly Maintenance Tasks**

```bash
# 1. Full system diagnostics
bench --site [your-site] console
>>> from svg_mobile_app.email_genius.system_diagnostics import run_system_diagnostics
>>> diagnostics = run_system_diagnostics()
>>> print("Overall Status:", diagnostics['diagnostics']['overall_status'])

# 2. Database optimization
>>> from svg_mobile_app.email_genius.performance_optimization import optimize_email_queries
>>> optimize_email_queries()

# 3. Update documentation
git checkout main
# Update CUSTOM_CHANGES.md with any new modifications
git add CUSTOM_CHANGES.md
git commit -m "Update documentation - $(date +%Y-%m)"
git push origin main
```

### **Backup Strategy**

```bash
# Daily automated backup (add to cron)
#!/bin/bash
# /etc/cron.daily/frappe-backup

cd /home/frappe/frappe-bench
bench backup --with-files
find sites/*/private/backups/ -name "*.sql.gz" -mtime +7 -delete
find sites/*/private/backups/ -name "*.tar" -mtime +7 -delete

# Weekly full site backup
if [ $(date +%u) -eq 1 ]; then  # Monday
    tar -czf /backup/weekly/frappe_backup_$(date +%Y%m%d).tar.gz sites/
    find /backup/weekly/ -name "*.tar.gz" -mtime +30 -delete
fi
```

---

## 📊 MONITORING & ALERTS

### **Set Up Monitoring**

```bash
# Create monitoring script
cat > monitor_email_system.sh << 'EOF'
#!/bin/bash

# Check system health
HEALTH=$(bench --site [your-site] execute "
from svg_mobile_app.email_genius.health_monitor import get_system_health
health = get_system_health()
print(health['health']['overall_status'])
")

if [ "$HEALTH" != "healthy" ]; then
    echo "Email system health issue: $HEALTH" | mail -s "Email System Alert" admin@yourcompany.com
fi

# Check error count
ERROR_COUNT=$(bench --site [your-site] execute "
import frappe
from datetime import datetime, timedelta
errors = frappe.get_all('Error Log', 
    filters={'creation': ['>', (datetime.now() - timedelta(hours=1)).strftime('%Y-%m-%d %H:%M:%S')]})
print(len(errors))
")

if [ "$ERROR_COUNT" -gt 10 ]; then
    echo "High error count in last hour: $ERROR_COUNT" | mail -s "Email System Errors" admin@yourcompany.com
fi
EOF

chmod +x monitor_email_system.sh

# Add to cron for hourly monitoring
echo "0 * * * * /path/to/monitor_email_system.sh" | crontab -
```

---

## 🎯 SUCCESS METRICS

### **Deployment Success Criteria**

- ✅ **System Health**: "healthy" status
- ✅ **Zero Critical Errors**: No blocking issues
- ✅ **Email Processing**: BCC/CC separation working
- ✅ **Performance**: < 100ms query response time
- ✅ **User Access**: All users can access system
- ✅ **Data Integrity**: No data loss or corruption
- ✅ **Backup Verified**: Rollback plan tested

### **Ongoing Success Metrics**

- **Uptime**: > 99.9%
- **Error Rate**: < 0.1%
- **Processing Speed**: < 5 seconds per multi-recipient email
- **User Satisfaction**: No complaints about email functionality
- **System Health**: "healthy" status maintained

---

## 🚨 EMERGENCY PROCEDURES

### **If System Goes Down**

```bash
# 1. Immediate assessment
bench status
sudo systemctl status nginx mysql redis

# 2. Check logs
tail -f logs/worker.log
tail -f logs/web.log
tail -f logs/socketio.log

# 3. Quick fixes
bench restart
# If that doesn't work:
sudo systemctl restart nginx
sudo systemctl restart mysql

# 4. If email system is the issue
bench --site [your-site] console
>>> from svg_mobile_app.email_genius.health_monitor import run_auto_recovery
>>> recovery = run_auto_recovery()
>>> print("Recovery result:", recovery)

# 5. Last resort - disable email system temporarily
>>> frappe.db.set_single_value("BCC Processing Settings", "enable_bcc_processing", 0)
>>> frappe.db.commit()
```

### **Contact Information**

- **Primary Admin**: [Your contact info]
- **Backup Admin**: [Backup contact info]  
- **Hosting Provider**: [Provider contact info]
- **Emergency Escalation**: [Emergency contact]

---

*This guide ensures safe and successful deployment of your email system with comprehensive version control and rollback capabilities.*

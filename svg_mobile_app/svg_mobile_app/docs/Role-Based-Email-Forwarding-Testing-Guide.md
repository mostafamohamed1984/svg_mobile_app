# Role-Based Email Forwarding System - Testing Guide

## 📋 Overview

The Role-Based Email Forwarding System automatically forwards emails TO Site Engineers to the main supervision email account (`supervision@svec.ae`). This system was implemented to solve ERPNext's BCC functionality limitations.

## 🏗️ System Architecture

### Core Components
1. **BCC Processing Settings** - Extended with role-based forwarding configuration
2. **Site Engineer Role** - Custom role for identifying engineer users
3. **Email Processing Hook** - `process_role_based_forwarding` function
4. **Custom Communication Field** - `custom_role_forwarded` for tracking

### Workflow
```
Email TO Engineer → ERPNext Communication → Recipient Role Check → Forward to Main Account → New Communication Record
```

## ⚙️ Configuration

### 1. BCC Processing Settings Fields
- `enable_role_based_forwarding` (Check) - Enable/disable the feature
- `main_email_account` (Link) - Target account for forwarded emails
- `engineer_role_name` (Link) - Role to check (default: "Site Engineer")
- `forwarding_subject_prefix_role` (Data) - Subject prefix (default: "[ENGINEER-FORWARDED]")

### 2. Current Configuration
- **Main Email Account**: `supervision  Svec` (supervision@svec.ae)
- **Engineer Role**: `Site Engineer`
- **Subject Prefix**: `[ENGINEER-FORWARDED]`
- **Status**: Ready for activation

## 🧪 Testing Procedures

### Pre-Testing Setup

1. **Verify Migration Completion**
```bash
# Check if Site Engineer role exists
bench --site smartvision.com console
frappe.db.exists("Role", "Site Engineer")
exit()
```

2. **Configure System**
```bash
bench --site smartvision.com console
# Configure role-based forwarding
settings = frappe.get_single('BCC Processing Settings')
settings.enable_role_based_forwarding = 1
settings.main_email_account = "supervision  Svec"
settings.engineer_role_name = "Site Engineer"
settings.forwarding_subject_prefix_role = "[ENGINEER-FORWARDED]"
settings.save()
exit()
```

3. **Assign Site Engineer Role**
```bash
# Assign role to test user
bench --site smartvision.com console
user = frappe.get_doc("User", "test.engineer@svec.ae")  # Replace with actual engineer email
user.add_roles("Site Engineer")
user.save()
exit()
```

### Test Cases

#### Test Case 1: Basic Email Forwarding
**Objective**: Verify that emails from Site Engineers are forwarded to supervision account

**Steps**:
1. Send email to engineer's email account
2. Check if Communication record is created for engineer
3. Verify forwarded Communication record is created for supervision account
4. Confirm subject has `[ENGINEER-FORWARDED]` prefix

**Expected Results**:
- Original email appears in engineer's Communication list
- Forwarded email appears in supervision Communication list
- Subject: `[ENGINEER-FORWARDED] Original Subject`
- `custom_role_forwarded` field = 1 for both records

#### Test Case 2: Non-Engineer Email (Negative Test)
**Objective**: Verify that non-engineer emails are NOT forwarded

**Steps**:
1. Send email to user without Site Engineer role
2. Check Communication records

**Expected Results**:
- Original email appears normally
- NO forwarded email created
- `custom_role_forwarded` field = 1 (marked as processed but not forwarded)

#### Test Case 3: Role-Based Filtering
**Objective**: Test role validation logic

**Steps**:
1. Remove Site Engineer role from user
2. Send email
3. Re-add Site Engineer role
4. Send another email

**Expected Results**:
- First email: Not forwarded
- Second email: Forwarded correctly

### Manual Testing Commands

#### Check System Status
```python
# In bench console
settings = frappe.get_single('BCC Processing Settings')
print(f"Enabled: {settings.enable_role_based_forwarding}")
print(f"Main Account: {settings.main_email_account}")
print(f"Engineer Role: {settings.engineer_role_name}")
```

#### Check User Roles
```python
# Check if user has Site Engineer role
user_email = "test.engineer@svec.ae"  # Replace with actual email
user = frappe.db.get_value('User', {'email': user_email}, 'name')
roles = frappe.get_roles(user)
print(f"User {user} has roles: {roles}")
print(f"Has Site Engineer role: {'Site Engineer' in roles}")
```

#### Check Communication Records
```python
# Check recent Communications for forwarding
comms = frappe.get_all("Communication", 
    filters={"creation": [">=", "2025-07-02"]},
    fields=["name", "subject", "sender", "recipients", "custom_role_forwarded"],
    order_by="creation desc",
    limit=10
)
for comm in comms:
    print(f"{comm.name}: {comm.subject} | Forwarded: {comm.custom_role_forwarded}")
```

## 🔧 Troubleshooting

### Common Issues

1. **Emails Not Being Forwarded**
   - Check if role-based forwarding is enabled
   - Verify user has Site Engineer role
   - Check email account configuration

2. **Migration Issues**
   - Remove lock files: `rm /home/frappe/frappe-bench/sites/smartvision.com/locks/*.lock`
   - Kill stuck database processes
   - Restart MariaDB if needed

3. **Hook Not Triggering**
   - Verify hook is registered in hooks.py
   - Check for errors in logs: `tail -f ~/frappe-bench/logs/bench.log`
   - Restart bench: `bench restart`

### Debug Commands
```python
# Test forwarding function directly
from svg_mobile_app.email_genius.email_processor import should_forward_email_by_role
comm_dict = {'sender': 'test.engineer@svec.ae', 'name': 'TEST-001'}
result = should_forward_email_by_role(comm_dict)
print(f"Should forward: {result}")
```

## 📊 Success Criteria

- ✅ Site Engineer role exists and is assignable
- ✅ BCC Processing Settings configured correctly
- ✅ Hook function executes without errors
- ✅ Engineer emails are forwarded to supervision account
- ✅ Non-engineer emails are not forwarded
- ✅ Communication records are created with proper tracking
- ✅ Subject prefixes are applied correctly

## 🚀 Production Deployment

1. Complete migration: `bench --site smartvision.com migrate`
2. Configure BCC Processing Settings
3. Assign Site Engineer roles to appropriate users
4. Monitor logs for any issues
5. Test with a few engineer accounts before full rollout

---

**Note**: This system extends the existing Email Genius BCC processing functionality and works alongside it without conflicts.

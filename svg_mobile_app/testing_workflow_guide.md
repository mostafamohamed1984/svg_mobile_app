# SVG Mobile App - Workflow Testing Guide

## Overview
This guide provides a comprehensive testing strategy for the complete business workflow cycle between Project Contractors, Sales Invoice, Project Claim, Project Advances, and Employee Advance doctypes.

## Prerequisites Setup

### 1. Master Data Setup
Before testing the workflow, ensure these master records exist:

#### Company Setup
```sql
-- Verify company exists with proper settings
SELECT name, default_currency, default_employee_advance_account 
FROM `tabCompany` 
WHERE name = 'Your Company Name';
```

#### Customer Setup
```python
# Create test customer via Frappe UI or API
customer = frappe.new_doc("Customer")
customer.customer_name = "Test Project Customer"
customer.customer_type = "Company"
customer.custom_company = "Your Company Name"  # Links to company
customer.save()
```

#### Employee Setup
```python
# Create test employees for advance distribution
employees = [
    {"employee_name": "John Doe", "status": "Active"},
    {"employee_name": "Jane Smith", "status": "Active"},
    {"employee_name": "Mike Johnson", "status": "Active"}
]

for emp_data in employees:
    employee = frappe.new_doc("Employee")
    employee.employee_name = emp_data["employee_name"]
    employee.status = emp_data["status"]
    employee.save()
```

#### Item Setup
```python
# Create test items for Project Items (taxable)
project_items = [
    {"item_code": "ENG-001", "item_name": "Engineering Design", "item_group": "Orbit Engineering Items"},
    {"item_code": "ENG-002", "item_name": "Technical Review", "item_group": "Orbit Engineering Items"}
]

# Create test items for Fees and Deposits (non-taxable)
fee_items = [
    {"item_code": "FEE-001", "item_name": "Project Setup Fee", "item_group": "Project Fees item"},
    {"item_code": "FEE-002", "item_name": "Security Deposit", "item_group": "Project Fees item"}
]

for item_data in project_items + fee_items:
    item = frappe.new_doc("Item")
    item.item_code = item_data["item_code"]
    item.item_name = item_data["item_name"]
    item.item_group = item_data["item_group"]
    item.save()
```

#### Tax Template Setup
```python
# Create Sales Tax Template for taxable items
tax_template = frappe.new_doc("Sales Taxes and Charges Template")
tax_template.title = "Test VAT 5%"
tax_template.company = "Your Company Name"
tax_template.append("taxes", {
    "charge_type": "On Net Total",
    "account_head": "VAT 5% - Company",  # Adjust account as needed
    "description": "VAT 5%",
    "rate": 5.0
})
tax_template.save()
```

#### Account Setup
```python
# Ensure Employee Advance account exists
advance_account = frappe.db.exists("Account", {
    "account_name": "Employee Advance",
    "company": "Your Company Name",
    "account_type": "Payable"
})

if not advance_account:
    # Create if doesn't exist
    account = frappe.new_doc("Account")
    account.account_name = "Employee Advance"
    account.company = "Your Company Name"
    account.account_type = "Payable"
    account.parent_account = "Current Liabilities - Company"  # Adjust as needed
    account.save()
```

## Testing Workflow - Step by Step

### Phase 1: Project Contractors & Sales Invoice Creation

#### Step 1: Create Project Contractors
1. Go to **Project Contractors** list
2. Click **New**
3. Fill in the following test data:
   - **Project Name**: "Test Project Alpha"
   - **Customer**: Select your test customer
   - **Company**: Select your company
   - **Tax Template**: Select "Test VAT 5%"

4. Add **Project Items** (taxable):
   - Item: "ENG-001", Rate: 10,000
   - Item: "ENG-002", Rate: 5,000

5. Add **Fees and Deposits** (non-taxable):
   - Item: "FEE-001", Rate: 2,000
   - Item: "FEE-002", Rate: 3,000

6. **Save** the document

#### Step 2: Submit Project Contractors
1. Click **Submit**
2. **Expected Results**:
   - ✅ Document submits successfully
   - ✅ Two Sales Invoices are automatically created
   - ✅ One invoice contains taxable items with tax applied
   - ✅ One invoice contains fees/deposits without tax
   - ✅ Child table `sales_invoice` fields are populated

**Verification Steps**:
```sql
-- Check created Sales Invoices
SELECT name, customer, grand_total, taxes_and_charges, custom_for_project
FROM `tabSales Invoice` 
WHERE custom_for_project = 'YOUR-PROJECT-CONTRACTOR-ID';
```

### Phase 2: Project Claim Creation

#### Step 3: Create Project Claim
1. Go to **Project Claim** list
2. Click **New**
3. Fill in:
   - **For Project**: Select your Project Contractor
   - **Reference Invoice**: Select one of the created Sales Invoices
   - **Invoice References**: Enter both invoice names (comma-separated)

4. Add **Claim Items**:
   - Item: "ENG-001", Amount: 8,000 (partial claim - 80%)
   - Item: "FEE-001", Amount: 2,000 (full claim - 100%)

5. **Save** the document

#### Step 4: Submit Project Claim
1. Click **Submit**
2. **Expected Results**:
   - ✅ Document submits successfully
   - ✅ Journal Entry is automatically created
   - ✅ Sales Invoice outstanding amounts are updated
   - ✅ Revenue recognition entries are posted

**Verification Steps**:
```sql
-- Check Journal Entry creation
SELECT name, posting_date, total_debit, total_credit, user_remark
FROM `tabJournal Entry`
WHERE user_remark LIKE '%YOUR-PROJECT-CLAIM-ID%';

-- Check Sales Invoice outstanding updates
SELECT name, outstanding_amount, status
FROM `tabSales Invoice`
WHERE custom_for_project = 'YOUR-PROJECT-CONTRACTOR-ID';
```

### Phase 3: Project Advances & Employee Advance Creation

#### Step 5: Create Project Advances
1. Go to **Project Advances** list
2. Click **New**
3. Fill in:
   - **Title**: "Test Advance Distribution"
   - **Posting Date**: Today's date

4. Add **Contractors**:
   - **Project Contractor**: Select your Project Contractor
   - **Allocated Amount**: 5,000

5. **Save** the document
6. The system should auto-populate **Project Claim Reference**

#### Step 6: Submit Project Advances
1. Click **Submit**
2. **Expected Results**:
   - ✅ Document submits successfully
   - ✅ Employee Advances are automatically created
   - ✅ Advance amounts are distributed to employees
   - ✅ Fees and Deposits tracking fields are updated

**Verification Steps**:
```sql
-- Check Employee Advance creation
SELECT name, employee, advance_amount, status, project_contractors_reference
FROM `tabEmployee Advance`
WHERE project_contractors_reference = 'YOUR-PROJECT-CONTRACTOR-ID';

-- Check Fees and Deposits updates
SELECT item, rate, employee_advance_created
FROM `tabFees and Deposits`
WHERE parent = 'YOUR-PROJECT-CONTRACTOR-ID';
```

## Error Scenarios to Test

### 1. Over-Claiming Validation
**Test**: Try to claim more than the invoice amount
1. Create a Project Claim
2. Add claim item with amount > invoice item amount
3. Try to save
4. **Expected**: Validation error should prevent saving

### 2. Over-Advancing Validation  
**Test**: Try to allocate more than available claim balance
1. Create a Project Advances
2. Set allocated amount > available claim balance
3. Try to save
4. **Expected**: Validation error should prevent saving

### 3. Missing Master Data
**Test**: Create documents with missing prerequisites
- Project Contractor without Tax Template
- Project Claim without valid Sales Invoice
- Project Advances without valid Project Claim
- **Expected**: Appropriate error messages

### 4. Circular Reference Prevention
**Test**: Try to delete documents in wrong order
1. Try to delete Project Contractor before cancelling related documents
2. **Expected**: System should handle cleanup gracefully

## Quick Test Script

Create this script in Frappe console for rapid testing:

```python
def quick_workflow_test():
    """Quick end-to-end workflow test"""
    
    # Step 1: Create Project Contractor
    pc = frappe.new_doc("Project Contractors")
    pc.project_name = "Quick Test Project"
    pc.customer = "Test Customer"  # Replace with actual customer
    pc.company = "Your Company"    # Replace with actual company
    pc.tax_template = "Standard VAT"  # Replace with actual tax template
    
    # Add items
    pc.append("items", {"item": "Test Item 1", "rate": 1000})
    pc.append("fees_and_deposits", {"item": "Test Fee 1", "rate": 500})
    
    pc.save()
    pc.submit()
    print(f"✅ Created Project Contractor: {pc.name}")
    
    # Step 2: Check Sales Invoices
    invoices = frappe.get_all("Sales Invoice", 
        filters={"custom_for_project": pc.name},
        fields=["name", "grand_total"]
    )
    print(f"✅ Created {len(invoices)} Sales Invoices")
    
    # Step 3: Create Project Claim
    pcl = frappe.new_doc("Project Claim")
    pcl.for_project = pc.name
    pcl.reference_invoice = invoices[0].name
    pcl.append("claim_items", {
        "item": "Test Item 1",
        "amount": 800,
        "ratio": 80
    })
    
    pcl.save()
    pcl.submit()
    print(f"✅ Created Project Claim: {pcl.name}")
    
    # Step 4: Create Project Advances
    pa = frappe.new_doc("Project Advances")
    pa.title = "Quick Test Advance"
    pa.append("contractors", {
        "project_contractor": pc.name,
        "allocated_amount": 400
    })
    
    pa.save()
    pa.submit()
    print(f"✅ Created Project Advances: {pa.name}")
    
    # Step 5: Check Employee Advances
    advances = frappe.get_all("Employee Advance",
        filters={"project_contractors_reference": pc.name},
        fields=["name", "advance_amount"]
    )
    print(f"✅ Created {len(advances)} Employee Advances")
    
    print("\n🎉 Quick workflow test completed successfully!")
    return pc.name

# Run the test
project_id = quick_workflow_test()
```

## Monitoring During Testing

### 1. Enable Debug Mode
Add to your site's `site_config.json`:
```json
{
    "developer_mode": 1,
    "log_level": "DEBUG"
}
```

### 2. Monitor Logs
```bash
# Watch for errors during testing
tail -f ~/frappe-bench/logs/bench.log | grep -i error
```

### 3. Check Database State
```sql
-- Monitor workflow progress
SELECT 
    'Project Contractors' as doctype, COUNT(*) as count
FROM `tabProject Contractors`
UNION ALL
SELECT 'Sales Invoice', COUNT(*) 
FROM `tabSales Invoice` WHERE custom_for_project IS NOT NULL
UNION ALL  
SELECT 'Project Claim', COUNT(*)
FROM `tabProject Claim`
UNION ALL
SELECT 'Project Advances', COUNT(*)
FROM `tabProject Advances`
UNION ALL
SELECT 'Employee Advance', COUNT(*)
FROM `tabEmployee Advance` WHERE project_contractors_reference IS NOT NULL;
```

Start with the **Prerequisites Setup** section, then follow the **Step-by-Step Testing** to validate each phase of the workflow. Use the **Error Scenarios** to ensure your system handles edge cases properly. 
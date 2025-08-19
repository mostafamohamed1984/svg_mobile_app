# Customer Statement Page - Testing Guide

## Overview
This guide provides comprehensive testing instructions for the Customer Statement Page (كشف حساب عميل) that shows the complete business flow: Project Contractors → Sales Invoice → Project Claim → Journal Entry.

## Page Access

### URL Access
The page can be accessed via:
- **URL**: `https://your-domain.com/app/customer-statement`
- **Navigation**: Go to ERPNext → Search "Customer Statement" in the search bar

### Required Permissions
Users need one of these roles to access the page:
- System Manager
- Accounts Manager  
- Accounts User
- Sales Manager
- Sales User

## Testing Prerequisites

### 1. Sample Data Setup
Before testing, ensure you have:

```python
# Run in Frappe Console (bench --site your-site console)

# 1. Create test customer
customer = frappe.new_doc("Customer")
customer.customer_name = "Test Customer for Statement"
customer.customer_type = "Company"
customer.tax_id = "123456789"
customer.save()
print(f"Created customer: {customer.name}")

# 2. Create test items for different service types
items = [
    {"item_code": "DESIGN-001", "item_name": "Engineering Design Service", "item_group": "Services"},
    {"item_code": "SUPERVISION-001", "item_name": "Project Supervision Service", "item_group": "Services"},
    {"item_code": "MODIFY-001", "item_name": "Design Modification Service", "item_group": "Services"},
    {"item_code": "ADD-SUPERVISION-001", "item_name": "Additional Supervision Service", "item_group": "Services"}
]

for item_data in items:
    if not frappe.db.exists("Item", item_data["item_code"]):
        item = frappe.new_doc("Item")
        item.item_code = item_data["item_code"]
        item.item_name = item_data["item_name"]
        item.item_group = item_data["item_group"]
        item.is_sales_item = 1
        item.save()
        print(f"Created item: {item.item_code}")
```

### 2. Create Complete Business Cycle Data

```python
# Run in Frappe Console to create test data

def create_test_business_cycle():
    """Create complete test data for customer statement"""
    
    # Step 1: Create Project Contractor
    pc = frappe.new_doc("Project Contractors")
    pc.project_name = "Test Project for Statement"
    pc.customer = "Test Customer for Statement"  # Use the customer created above
    pc.company = frappe.defaults.get_user_default("Company")
    pc.date = frappe.utils.today()
    
    # Add project items (will create taxable sales invoice)
    pc.append("items", {
        "item": "DESIGN-001",
        "rate": 10000,
        "qty": 1
    })
    pc.append("items", {
        "item": "SUPERVISION-001", 
        "rate": 15000,
        "qty": 1
    })
    
    # Add fees (will create non-taxable sales invoice)
    pc.append("fees_and_deposits", {
        "item": "MODIFY-001",
        "rate": 5000,
        "qty": 1
    })
    
    pc.save()
    pc.submit()
    print(f"✅ Created Project Contractor: {pc.name}")
    
    # Step 2: Verify Sales Invoices were created
    invoices = frappe.get_all("Sales Invoice", 
        filters={"custom_for_project": pc.name, "docstatus": 1},
        fields=["name", "grand_total", "outstanding_amount"]
    )
    print(f"✅ Created {len(invoices)} Sales Invoices:")
    for inv in invoices:
        print(f"   - {inv.name}: {inv.grand_total} (Outstanding: {inv.outstanding_amount})")
    
    # Step 3: Create Project Claims
    for invoice in invoices:
        claim = frappe.new_doc("Project Claim")
        claim.customer = pc.customer
        claim.reference_invoice = invoice.name
        claim.for_project = pc.name
        claim.date = frappe.utils.today()
        claim.claim_amount = invoice.outstanding_amount * 0.5  # Claim 50%
        claim.paid_amount = claim.claim_amount
        claim.being = f"Partial payment for {invoice.name}"
        
        # Add claim items based on invoice items
        invoice_doc = frappe.get_doc("Sales Invoice", invoice.name)
        for item in invoice_doc.items:
            claim.append("claim_items", {
                "item": item.item_code,
                "amount": item.amount * 0.5,  # 50% of item amount
                "invoice_reference": invoice.name
            })
        
        claim.save()
        claim.submit()
        print(f"✅ Created Project Claim: {claim.name}")
        
        # Step 4: Create Journal Entry from claim
        try:
            je_name = claim.create_journal_entry([invoice.name])
            print(f"✅ Created Journal Entry: {je_name}")
        except Exception as e:
            print(f"⚠️ Journal Entry creation failed: {str(e)}")
    
    return pc.name

# Run the test data creation
project_name = create_test_business_cycle()
print(f"\n🎉 Test data creation completed! Project: {project_name}")
```

## Testing the Customer Statement Page

### 1. Basic Functionality Test

```python
# Test the backend API directly
def test_customer_statement_api():
    """Test the customer statement API directly"""
    
    customer = "Test Customer for Statement"
    from_date = frappe.utils.add_months(frappe.utils.today(), -1)
    to_date = frappe.utils.today()
    
    # Import the function
    from svg_mobile_app.svg_mobile_app.page.customer_statement.customer_statement import get_customer_statement_data
    
    try:
        result = get_customer_statement_data(customer, from_date, to_date)
        
        print("✅ API Test Results:")
        print(f"Customer: {result['customer']['customer_name']}")
        print(f"Service Groups: {len(result['service_groups'])}")
        print(f"Total Projects: {result['summary']['total_projects']}")
        print(f"Total Invoices: {result['summary']['total_invoices']}")
        print(f"Total Claims: {result['summary']['total_claims']}")
        print(f"Grand Total Value: {result['summary']['grand_total_value']}")
        print(f"Grand Total Balance: {result['summary']['grand_total_balance']}")
        
        # Print service groups
        for group in result['service_groups']:
            print(f"\n📋 Service Group: {group['service_name_ar']} - {group['service_name']}")
            print(f"   Transactions: {len(group['transactions'])}")
            print(f"   Total Value: {group['total_value']}")
            print(f"   Total Paid: {group['total_paid']}")
            print(f"   Total Balance: {group['total_balance']}")
        
        return True
        
    except Exception as e:
        print(f"❌ API Test Failed: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return False

# Run API test
test_customer_statement_api()
```

### 2. Frontend Testing Steps

1. **Access the Page**:
   - Navigate to: `https://your-domain.com/app/customer-statement`
   - Or search "Customer Statement" in ERPNext

2. **Test Customer Selection**:
   - Select "Test Customer for Statement" from dropdown
   - Verify customer field works properly

3. **Test Date Range**:
   - Set From Date to 1 month ago
   - Set To Date to today
   - Verify date fields work

4. **Generate Statement**:
   - Click "Get Statement - عرض الكشف" button
   - Verify loading message appears
   - Check if data loads correctly

5. **Verify Display**:
   - Check Arabic RTL layout
   - Verify service groups are displayed with yellow headers
   - Confirm table data shows correctly
   - Verify summary section appears

6. **Test Print Functionality**:
   - Click "Print Statement" button
   - Verify print preview opens
   - Check Arabic formatting in print view
   - Confirm all data appears correctly

### 3. Data Validation Tests

```python
# Validate data accuracy
def validate_statement_data():
    """Validate that statement data matches source records"""
    
    customer = "Test Customer for Statement"
    
    # Get statement data
    from svg_mobile_app.svg_mobile_app.page.customer_statement.customer_statement import get_customer_statement_data
    statement = get_customer_statement_data(customer)
    
    # Validate against source data
    print("🔍 Data Validation:")
    
    # Check project contractors count
    pc_count = frappe.db.count("Project Contractors", {"customer": customer, "docstatus": 1})
    print(f"Project Contractors - Expected: {pc_count}, Got: {statement['summary']['total_projects']}")
    
    # Check sales invoices count
    si_count = frappe.db.sql("""
        SELECT COUNT(*) as count FROM `tabSales Invoice` si
        JOIN `tabProject Contractors` pc ON si.custom_for_project = pc.name
        WHERE pc.customer = %s AND si.docstatus = 1
    """, [customer])[0][0]
    print(f"Sales Invoices - Expected: {si_count}, Got: {statement['summary']['total_invoices']}")
    
    # Check project claims count
    claim_count = frappe.db.count("Project Claim", {"customer": customer, "docstatus": 1})
    print(f"Project Claims - Expected: {claim_count}, Got: {statement['summary']['total_claims']}")
    
    # Validate totals
    total_claim_amount = frappe.db.sql("""
        SELECT SUM(claim_amount) as total FROM `tabProject Claim`
        WHERE customer = %s AND docstatus = 1
    """, [customer])[0][0] or 0
    
    print(f"Total Claim Amount - Expected: {total_claim_amount}, Got: {statement['summary']['grand_total_value']}")
    
    return True

# Run validation
validate_statement_data()
```

## Troubleshooting

### Common Issues

1. **Page Not Found (404)**:
   - Check if page files exist in correct directory
   - Verify page is registered in hooks.py
   - Restart ERPNext server

2. **Permission Denied**:
   - Check user has required roles
   - Verify page permissions in customer_statement.json

3. **No Data Displayed**:
   - Verify test data exists
   - Check date range filters
   - Confirm customer has complete business cycle data

4. **API Errors**:
   - Check server logs for detailed errors
   - Verify database connections
   - Confirm all required fields exist

### Debug Commands

```python
# Check if page exists
frappe.db.exists("Page", "customer-statement")

# Check page permissions
page_doc = frappe.get_doc("Page", "customer-statement")
print("Page Roles:", [r.role for r in page_doc.roles])

# Check user permissions
user_roles = frappe.get_roles()
print("User Roles:", user_roles)

# Test customer list API
from svg_mobile_app.svg_mobile_app.page.customer_statement.customer_statement import get_customers_list
customers = get_customers_list()
print(f"Available Customers: {len(customers)}")
```

## Expected Results

After successful testing, you should see:

1. **Page Access**: Customer Statement page loads without errors
2. **Customer Selection**: Dropdown shows available customers
3. **Data Display**: Statement shows grouped service types with Arabic headers
4. **Print Function**: Print preview opens with proper Arabic formatting
5. **Data Accuracy**: Numbers match source Project Claims and Sales Invoices

## Performance Notes

- Page loads data dynamically based on selected filters
- Large date ranges may take longer to process
- Print functionality works offline once data is loaded
- Arabic text displays correctly in both screen and print views

## Next Steps

After successful testing:
1. Train users on page functionality
2. Set up proper user permissions
3. Create user documentation
4. Monitor page performance with real data

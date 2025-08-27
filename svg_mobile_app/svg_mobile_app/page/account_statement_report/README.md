# Account Statement Report

## Overview
A comprehensive ERPNext page for generating account statements for Customers, Contractors, and Engineers.

## Features
- **Multi-Entity Support**: Customer, Contractor, and Engineer reports
- **Dynamic Filtering**: Report type-specific filters
- **Date Range Selection**: Flexible date filtering
- **Project Agreement Integration**: Link to specific projects
- **Item/Service Filtering**: Filter by specific items or services
- **Bilingual Print Support**: English/Arabic printing
- **Professional UI**: Modern, responsive design

## Recent Fixes

### Issue 1: AttributeError - 'ProjectServices' object has no attribute 'item_code'
**Problem**: The code was trying to access a non-existent `item_code` field from the ProjectServices doctype.

**Solution**: 
- Removed all references to `item_code` field
- Updated `process_project_services()` function to use only the `item` field
- Added error handling with `getattr()` for safer field access

**Files Modified**:
- `account_statement_report.py` - Lines 538-601

### Issue 2: Dropdown Menu Button UI Issue
**Problem**: The report type dropdown was using a plain HTML select element instead of frappe.ui controls.

**Solution**:
- Replaced HTML select with proper `frappe.ui.form.make_control`
- Added value mapping between display labels and internal values
- Updated event handling for proper integration

**Files Modified**:
- `account_statement_report.js` - Lines 63-67, 179-204, 215-267

## Usage
1. Navigate to `/app/account-statement-report`
2. Select report type (Customer, Contractor, or Engineer)
3. Fill in the appropriate filters
4. Set date range
5. Click "Load Report Data"
6. Use "Print Statement" for PDF export

## Technical Details

### Doctypes Used
- **Project Agreement**: Main container for all data
- **Project Services**: Customer services (fields: item, amount, invoice_date, remark, tax_amount)
- **Contractors Services**: Contractor services (fields: item, amount, contractor, invoice_date)
- **Outsource Services**: Engineer services (fields: service, amount, service_provider, date)

### API Endpoints
- `get_account_statement_data`: Main data retrieval method
- `get_customers_list`: Customer selection options
- `get_contractors_list`: Contractor selection options  
- `get_engineers_list`: Engineer selection options
- `get_project_agreements_list`: Project agreement options
- `get_items_list`: Item/service options

### Error Handling
- Safe field access using `getattr()` with defaults
- Proper validation of required parameters
- Graceful handling of missing data

## Dependencies
- ERPNext 15.65.1+
- Frappe 15.70.0+
- SVG Mobile App module

## Permissions
Accessible to roles:
- System Manager
- Accounts Manager
- Accounts User
- Sales Manager
- Sales User
- Purchase Manager
- Purchase User

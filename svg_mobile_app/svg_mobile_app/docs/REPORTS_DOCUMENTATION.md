# SVG Mobile App - Reports Documentation

## Overview

This document provides comprehensive documentation for the four financial reports implemented in the SVG Mobile App, designed to support the complete Project Contractors → Sales Invoice → Project Claim → Journal Entry workflow.

## Report Types

### 1. Project Claim Statement Report (Arabic Interface)

**Purpose**: Shows project phases with balance, paid amounts, values, document numbers, dates, and descriptions in Arabic.

**Location**: `svg_mobile_app/svg_mobile_app/report/project_claim_statement/`

**Features**:
- Arabic RTL interface with proper text rendering
- Phase-based categorization of claim items
- Running balance calculations
- Date range filtering
- Customer and project filtering
- Export to PDF/Excel

**Data Sources**:
- Project Claim doctype
- Claim Items child table
- Item master for categorization

**Key Fields**:
- البيان (Description/Phase)
- التاريخ (Date)
- رقم السند (Document Number)
- القيمة (Value)
- المدفوع (Paid)
- الرصيد (Balance)

**Usage**:
```
Navigate to: Reports → Project Claim Statement
Filters: Customer, Project, Date Range, Status
```

### 2. Detailed Project Claim Report (Bilingual)

**Purpose**: Comprehensive project breakdown with VAT calculations and bilingual support.

**Location**: `svg_mobile_app/svg_mobile_app/report/detailed_project_claim/`

**Features**:
- Bilingual Arabic/English interface
- VAT calculations (5% tax rate)
- Category-wise item grouping
- Invoice reference tracking
- Customer information display
- Hierarchical data presentation

**Data Sources**:
- Complete Project Contractors → Sales Invoice → Project Claim workflow
- Tax calculations from Tax Accounting System
- Customer and project details

**Key Sections**:
- Project Information Header
- Customer Details
- Engineering Work / أعمال هندسية
- Project Fees / رسوم المشروع
- Supervision / الإشراف
- Design Modifications / تعديلات التصميم

**Usage**:
```
Navigate to: Reports → Detailed Project Claim
Filters: Customer, Project, Specific Claim, Date Range, Status
```

### 3. Account Statement Report (English)

**Purpose**: Standard accounting ledger showing all transactions for specific accounts.

**Location**: `svg_mobile_app/svg_mobile_app/report/account_statement/`

**Features**:
- Standard accounting format
- Running balance calculations
- Opening and closing balance rows
- Transaction filtering by voucher type
- Party and cost center filtering
- Enhanced descriptions with context

**Data Sources**:
- GL Entry table (ERPNext standard)
- Journal Entry doctype
- Account master data

**Key Fields**:
- Posting Date
- Value Date
- Description
- Ref/Cheque No
- Debit Amount
- Credit Amount
- Balance

**Usage**:
```
Navigate to: Reports → Account Statement
Required: Account, From Date, To Date
Optional: Voucher Type, Party, Cost Center, Project
```

### 4. Trial Balance Report (Arabic)

**Purpose**: Chart of Accounts with debit/credit balances and Arabic interface.

**Location**: `svg_mobile_app/svg_mobile_app/report/trial_balance_arabic/`

**Features**:
- Arabic RTL interface
- Account hierarchy display
- Category-wise grouping (Assets, Liabilities, Equity, Income, Expense)
- Balance verification functionality
- Account code filtering
- Grand total calculations

**Data Sources**:
- Account master (Chart of Accounts)
- GL Entry aggregations
- Account hierarchy and groupings

**Key Categories**:
- الأصول (Assets)
- الخصوم (Liabilities)
- حقوق الملكية (Equity)
- الإيرادات (Income)
- المصروفات (Expenses)

**Usage**:
```
Navigate to: Reports → Trial Balance Arabic
Required: Company
Optional: Date Range, Root Type, Account Type, Show Group Accounts
```

## Technical Implementation

### Backend Architecture

**Report Structure**:
```
report_name/
├── report_name.py      # Main report logic
├── report_name.json    # Report configuration
└── report_name.js      # Frontend interface
```

**Common Functions** (`report_utils.py`):
- `get_project_claim_summary()` - Project claim aggregations
- `get_account_balance_summary()` - Account balance calculations
- `format_currency_arabic()` - Arabic currency formatting
- `get_phase_category_mapping()` - Item group to phase mapping
- `validate_report_filters()` - Filter validation
- `export_report_to_excel()` - Excel export functionality

### Frontend Features

**Arabic RTL Support**:
- CSS direction: rtl
- Text alignment: right
- Arabic font rendering
- Proper number formatting

**Interactive Features**:
- Dynamic filtering
- Export buttons (PDF/Excel)
- Balance verification
- Drill-down capabilities
- Responsive design

### Data Flow

1. **Project Claim Statement**:
   ```
   Project Claim → Claim Items → Item Groups → Phase Categorization → Arabic Display
   ```

2. **Detailed Project Claim**:
   ```
   Project Contractors → Sales Invoice → Project Claim → Tax Calculations → Bilingual Display
   ```

3. **Account Statement**:
   ```
   GL Entry → Running Balance → Enhanced Descriptions → Standard Format
   ```

4. **Trial Balance**:
   ```
   Account Master → GL Entry Aggregation → Category Grouping → Arabic Display
   ```

## Configuration

### Report Permissions

All reports are accessible to:
- System Manager
- Accounts Manager
- Accounts User

### Letter Head

All reports use "SVG Letter Head" for consistent branding.

### Export Options

- PDF export with proper Arabic rendering
- Excel export with formatted data
- Print-friendly layouts

## Customization

### Adding New Phases

To add new project phases, update the `get_phase_category_mapping()` function in `report_utils.py`:

```python
def get_phase_category_mapping():
    return {
        'New Item Group': 'اسم المرحلة الجديدة',  # New Phase Name
        # ... existing mappings
    }
```

### Modifying Filters

Add new filters in the report's JSON configuration:

```json
{
    "fieldname": "new_filter",
    "fieldtype": "Link",
    "label": "New Filter",
    "options": "DocType",
    "reqd": 0
}
```

### Styling Customization

Modify the CSS in the report's JS file:

```javascript
$('<style id="report-custom-css">')
    .text(`
        .custom-class {
            /* Custom styles */
        }
    `)
    .appendTo('head');
```

## Troubleshooting

### Common Issues

1. **Arabic Text Not Displaying**:
   - Check RTL CSS is loaded
   - Verify font support
   - Ensure proper encoding

2. **Balance Calculations Incorrect**:
   - Verify GL Entry data integrity
   - Check date range filters
   - Validate account mappings

3. **Performance Issues**:
   - Add database indexes on frequently queried fields
   - Optimize SQL queries
   - Implement data caching

### Debug Mode

Enable debug logging in reports:

```python
frappe.logger().debug(f"Debug message: {variable}")
```

## Future Enhancements

1. **Real-time Updates**: WebSocket integration for live data
2. **Advanced Analytics**: Charts and graphs
3. **Mobile Optimization**: Touch-friendly interfaces
4. **Automated Scheduling**: Email reports on schedule
5. **Multi-language Support**: Additional language options

## Support

For technical support or customization requests, contact the SVG development team.

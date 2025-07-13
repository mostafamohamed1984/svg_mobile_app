# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt, cstr, getdate, fmt_money
from frappe import _

@frappe.whitelist()
def get_project_claim_summary(customer=None, project=None, from_date=None, to_date=None):
    """
    Get summary data for project claims
    """
    conditions = []
    filters = {}
    
    if customer:
        conditions.append("pc.customer = %(customer)s")
        filters["customer"] = customer
    
    if project:
        conditions.append("pc.for_project = %(project)s")
        filters["project"] = project
    
    if from_date:
        conditions.append("pc.date >= %(from_date)s")
        filters["from_date"] = from_date
    
    if to_date:
        conditions.append("pc.date <= %(to_date)s")
        filters["to_date"] = to_date
    
    where_clause = "WHERE pc.docstatus = 1"
    if conditions:
        where_clause += " AND " + " AND ".join(conditions)
    
    query = f"""
        SELECT 
            COUNT(*) as total_claims,
            SUM(pc.claim_amount) as total_claim_amount,
            SUM(pc.paid_amount) as total_paid_amount,
            SUM(pc.outstanding_amount) as total_outstanding_amount,
            SUM(pc.tax_amount) as total_tax_amount
        FROM 
            `tabProject Claim` pc
        {where_clause}
    """
    
    result = frappe.db.sql(query, filters, as_dict=True)
    return result[0] if result else {}

@frappe.whitelist()
def get_account_balance_summary(account, from_date=None, to_date=None):
    """
    Get account balance summary
    """
    filters = {"account": account}
    conditions = []
    
    if from_date:
        conditions.append("gle.posting_date >= %(from_date)s")
        filters["from_date"] = from_date
    
    if to_date:
        conditions.append("gle.posting_date <= %(to_date)s")
        filters["to_date"] = to_date
    
    where_clause = "WHERE gle.account = %(account)s AND gle.is_cancelled = 0"
    if conditions:
        where_clause += " AND " + " AND ".join(conditions)
    
    query = f"""
        SELECT 
            SUM(gle.debit) as total_debit,
            SUM(gle.credit) as total_credit,
            SUM(gle.debit - gle.credit) as net_balance,
            COUNT(*) as total_transactions
        FROM 
            `tabGL Entry` gle
        {where_clause}
    """
    
    result = frappe.db.sql(query, filters, as_dict=True)
    return result[0] if result else {}

@frappe.whitelist()
def get_project_contractors_for_customer(customer):
    """
    Get all project contractors for a specific customer
    """
    return frappe.get_all(
        "Project Contractors",
        filters={"customer": customer},
        fields=["name", "project_name", "customer_name", "project_amount"],
        order_by="project_name"
    )

@frappe.whitelist()
def get_project_claims_for_project(project):
    """
    Get all project claims for a specific project
    """
    return frappe.get_all(
        "Project Claim",
        filters={"for_project": project, "docstatus": 1},
        fields=["name", "date", "claim_amount", "paid_amount", "outstanding_amount", "status"],
        order_by="date desc"
    )

@frappe.whitelist()
def get_accounts_by_type(account_type=None, root_type=None, company=None):
    """
    Get accounts filtered by type
    """
    filters = {"is_group": 0, "disabled": 0}
    
    if account_type:
        filters["account_type"] = account_type
    
    if root_type:
        filters["root_type"] = root_type
    
    if company:
        filters["company"] = company
    
    return frappe.get_all(
        "Account",
        filters=filters,
        fields=["name", "account_name", "account_number", "account_type", "root_type"],
        order_by="name"
    )

def format_currency_arabic(amount, currency="AED"):
    """
    Format currency for Arabic display
    """
    if not amount:
        return "0.00"
    
    formatted = fmt_money(amount, currency=currency)
    return formatted

def get_arabic_month_name(date):
    """
    Get Arabic month name for a given date
    """
    if not date:
        return ""
    
    date_obj = getdate(date)
    month = date_obj.month
    
    arabic_months = {
        1: "يناير", 2: "فبراير", 3: "مارس", 4: "أبريل",
        5: "مايو", 6: "يونيو", 7: "يوليو", 8: "أغسطس",
        9: "سبتمبر", 10: "أكتوبر", 11: "نوفمبر", 12: "ديسمبر"
    }
    
    return arabic_months.get(month, "")

def get_phase_category_mapping():
    """
    Get mapping of item groups to Arabic phase names
    """
    return {
        'Orbit Engineering Items': 'التصميم الهندسي',  # Engineering Design
        'Project Fees item': 'رسوم المشروع',  # Project Fees
        'Supervision Items': 'الإشراف',  # Supervision
        'Modification Items': 'تعديل التصميم',  # Design Modification
        'Additional Supervision': 'إشراف إضافي',  # Additional Supervision
        'Tender Fees': 'رسوم المناقصة',  # Tender Fees
        'Development Fees': 'رسوم التطوير',  # Development Fees
        'Consultation Fees': 'رسوم الاستشارة'  # Consultation Fees
    }

@frappe.whitelist()
def export_report_to_excel(report_name, filters=None):
    """
    Export report data to Excel format
    """
    try:
        # Import the report module dynamically
        report_module = frappe.get_module(f"svg_mobile_app.svg_mobile_app.report.{report_name.lower().replace(' ', '_')}.{report_name.lower().replace(' ', '_')}")
        
        # Execute the report
        columns, data = report_module.execute(filters)
        
        # Prepare data for Excel export
        excel_data = []
        
        # Add headers
        headers = [col.get("label", col.get("fieldname", "")) for col in columns]
        excel_data.append(headers)
        
        # Add data rows
        for row in data:
            excel_row = []
            for col in columns:
                fieldname = col.get("fieldname")
                value = row.get(fieldname, "")
                
                # Format currency values
                if col.get("fieldtype") == "Currency" and value:
                    value = flt(value)
                
                excel_row.append(value)
            excel_data.append(excel_row)
        
        return excel_data
        
    except Exception as e:
        frappe.throw(f"Error exporting report: {str(e)}")

@frappe.whitelist()
def get_report_filters_data():
    """
    Get common filter data for reports
    """
    return {
        "customers": frappe.get_all("Customer", fields=["name", "customer_name"], order_by="customer_name"),
        "companies": frappe.get_all("Company", fields=["name", "company_name"], order_by="company_name"),
        "cost_centers": frappe.get_all("Cost Center", fields=["name", "cost_center_name"], order_by="cost_center_name"),
        "account_types": [
            "Bank", "Cash", "Receivable", "Payable", "Stock", "Tax", "Chargeable",
            "Income Account", "Expense Account", "Fixed Asset", "Accumulated Depreciation"
        ],
        "root_types": ["Asset", "Liability", "Equity", "Income", "Expense"],
        "voucher_types": [
            "Journal Entry", "Sales Invoice", "Purchase Invoice", "Payment Entry",
            "Expense Claim", "Asset", "Stock Entry", "Delivery Note", "Purchase Receipt"
        ]
    }

def validate_report_filters(filters, required_filters=None):
    """
    Validate report filters
    """
    if not filters:
        filters = {}
    
    if required_filters:
        for field in required_filters:
            if not filters.get(field):
                frappe.throw(f"Please provide {field}")
    
    # Validate date ranges
    if filters.get("from_date") and filters.get("to_date"):
        if getdate(filters["from_date"]) > getdate(filters["to_date"]):
            frappe.throw("From Date cannot be greater than To Date")
    
    return filters

def get_company_currency(company=None):
    """
    Get company's default currency
    """
    if not company:
        company = frappe.defaults.get_user_default("Company")
    
    if company:
        return frappe.get_cached_value("Company", company, "default_currency")
    
    return "AED"  # Default fallback

@frappe.whitelist()
def get_project_claim_items_summary(claim_name):
    """
    Get detailed summary of items in a project claim
    """
    claim_items = frappe.get_all(
        "Claim Items",
        filters={"parent": claim_name},
        fields=[
            "item", "amount", "ratio", "current_balance", "tax_rate", "tax_amount",
            "tax_account", "unearned_account", "revenue_account", "invoice_reference",
            "project_contractor_reference"
        ]
    )
    
    # Get item details
    for item in claim_items:
        if item.item:
            item_doc = frappe.get_cached_doc("Item", item.item)
            item.item_name = item_doc.item_name
            item.item_group = item_doc.item_group
    
    return claim_items

def calculate_running_balance(entries, balance_field="balance"):
    """
    Calculate running balance for a list of entries
    """
    running_balance = 0
    
    for entry in entries:
        debit = flt(entry.get("debit", 0))
        credit = flt(entry.get("credit", 0))
        running_balance += (debit - credit)
        entry[balance_field] = running_balance
    
    return entries

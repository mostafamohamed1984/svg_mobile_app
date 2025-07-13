# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt, cstr, getdate, fmt_money
from frappe import _

# Simple utility functions for reports - removed problematic functions

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

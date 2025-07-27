# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt, cstr, getdate, fmt_money, formatdate, add_days
from frappe import _
import json
from datetime import datetime, timedelta

@frappe.whitelist()
def get_project_contractors_report_data(customer=None, contractor=None, employee=None, expense_type=None, from_date=None, to_date=None):
    """
    Get comprehensive project contractors report data
    """
    # Set default date range if not provided
    if not from_date:
        from_date = frappe.utils.add_months(frappe.utils.today(), -1)
    if not to_date:
        to_date = frappe.utils.today()

    # Get customer statement data
    customer_statement_data = None
    if customer:
        customer_statement_data = get_customer_statement_data(customer, contractor, from_date, to_date)

    # Get project expenses data
    project_expenses_data = get_project_expenses_data(customer, contractor, employee, expense_type, from_date, to_date)

    # Generate summary data
    summary_data = generate_summary_data(customer_statement_data, project_expenses_data)

    # Generate combined data
    combined_data = generate_combined_data(customer_statement_data, project_expenses_data)

    return {
        'customer_statement': customer_statement_data,
        'project_expenses': project_expenses_data,
        'summary': summary_data,
        'combined': combined_data,
        'filters': {
            'customer': customer,
            'contractor': contractor,
            'employee': employee,
            'expense_type': expense_type,
            'from_date': from_date,
            'to_date': to_date
        }
    }

@frappe.whitelist()
def get_customer_statement_data(customer, contractor=None, from_date=None, to_date=None):
    """
    Get customer statement data similar to customer_statement page
    """
    if not customer:
        return None

    try:
        # Get customer details
        customer_doc = frappe.get_doc("Customer", customer)

        # Get sales invoices for the customer
        sales_invoice_filters = {
            'customer': customer,
            'posting_date': ['between', [from_date, to_date]],
            'docstatus': 1
        }
        
        if contractor:
            sales_invoice_filters['custom_for_project'] = contractor

        sales_invoices = frappe.db.get_list('Sales Invoice',
            fields=['name', 'posting_date', 'customer', 'grand_total', 'outstanding_amount', 'custom_for_project'],
            filters=sales_invoice_filters,
            order_by='posting_date desc'
        )

        # Get project claims for the customer
        project_claim_filters = {
            'customer': customer,
            'date': ['between', [from_date, to_date]],
            'docstatus': 1
        }

        project_claims = frappe.db.get_list('Project Claim',
            fields=['name', 'date', 'customer', 'claim_amount', 'paid_amount', 'reference_invoice', 'being'],
            filters=project_claim_filters,
            order_by='date desc'
        )

        # Process the data to create service groups
        service_groups = process_statement_data(sales_invoices, project_claims)

        return {
            'customer': {
                'name': customer_doc.name,
                'customer_name': customer_doc.customer_name,
                'tax_id': customer_doc.tax_id or '',
                'customer_group': customer_doc.customer_group
            },
            'date_range': {
                'from_date': from_date,
                'to_date': to_date,
                'from_date_formatted': formatdate(from_date),
                'to_date_formatted': formatdate(to_date)
            },
            'currency': 'AED',
            'service_groups': service_groups
        }

    except Exception as e:
        frappe.log_error(f"Error in get_customer_statement_data: {str(e)}")
        return None

@frappe.whitelist()
def get_project_expenses_data(customer=None, contractor=None, employee=None, expense_type=None, from_date=None, to_date=None):
    """
    Get project expenses data from expense claims
    """
    try:
        # Build filters for expense claim details
        filters = {
            'expense_date': ['between', [from_date, to_date]]
        }

        if employee:
            filters['employee'] = employee

        if expense_type:
            filters['expense_type'] = expense_type

        # Enhanced filtering logic based on customer or contractor selection
        project_contractor_names = []

        if customer and not contractor:
            # Filter by Customer: Get all Project Contractors for that customer
            customer_project_contractors = frappe.db.get_list('Project Contractors',
                fields=['name'],
                filters={'customer': customer}
            )
            project_contractor_names = [pc.name for pc in customer_project_contractors]

            if project_contractor_names:
                filters['for_project'] = ['in', project_contractor_names]
            else:
                return []  # No project contractors for this customer

        elif contractor:
            # Filter by specific Project Contractor
            filters['for_project'] = contractor

        elif customer and contractor:
            # Both filters: verify the contractor belongs to the customer
            contractor_doc = frappe.db.get_value('Project Contractors', contractor, 'customer')
            if contractor_doc != customer:
                return []  # Contractor doesn't belong to this customer
            filters['for_project'] = contractor

        # Get expense claim details with enhanced query
        expense_details = frappe.db.sql("""
            SELECT 
                ecd.expense_date,
                ecd.expense_type,
                ecd.description,
                ecd.amount,
                ec.employee,
                ec.employee_name,
                ecd.parent as expense_claim,
                ecd.for_project as project_contractor,
                pc.project_name,
                pc.customer,
                pc.customer_name,
                ec.posting_date
            FROM `tabExpense Claim Detail` ecd
            LEFT JOIN `tabExpense Claim` ec ON ecd.parent = ec.name
            LEFT JOIN `tabProject Contractors` pc ON ecd.for_project = pc.name
            WHERE ecd.expense_date BETWEEN %(from_date)s AND %(to_date)s
            AND ec.docstatus = 1
            {additional_filters}
            ORDER BY ecd.expense_date DESC
        """.format(
            additional_filters=build_additional_filters(filters)
        ), {
            'from_date': from_date,
            'to_date': to_date,
            **get_filter_values(filters)
        }, as_dict=True)

        # Format the results
        result = []
        for detail in expense_details:
            result.append({
                'expense_date': detail.expense_date,
                'expense_type': detail.expense_type,
                'description': detail.description,
                'amount': flt(detail.amount, 2),
                'employee_name': detail.employee_name,
                'employee': detail.employee,
                'expense_claim': detail.expense_claim,
                'project_contractor': detail.project_contractor,
                'project_name': detail.project_name or detail.project_contractor,
                'customer': detail.customer or '',
                'customer_name': detail.customer_name or '',
                'posting_date': detail.posting_date,
                'status': 'Approved'
            })

        return result

    except Exception as e:
        frappe.log_error(f"Error in get_project_expenses_data: {str(e)}")
        return []

def build_additional_filters(filters):
    """Build additional SQL filter conditions"""
    conditions = []
    
    if filters.get('employee'):
        conditions.append("AND ec.employee = %(employee)s")
    
    if filters.get('expense_type'):
        conditions.append("AND ecd.expense_type = %(expense_type)s")
    
    if filters.get('for_project'):
        if isinstance(filters['for_project'], list):
            conditions.append("AND ecd.for_project IN %(for_project)s")
        else:
            conditions.append("AND ecd.for_project = %(for_project)s")
    
    return " ".join(conditions)

def get_filter_values(filters):
    """Extract filter values for SQL parameters"""
    values = {}
    
    if filters.get('employee'):
        values['employee'] = filters['employee']
    
    if filters.get('expense_type'):
        values['expense_type'] = filters['expense_type']
    
    if filters.get('for_project'):
        values['for_project'] = filters['for_project']
    
    return values

def process_statement_data(sales_invoices, project_claims):
    """Process sales invoices and project claims to create service groups"""
    service_groups = []

    # Group by sales invoice items
    for invoice in sales_invoices:
        try:
            # Get invoice items
            invoice_items = frappe.db.get_list('Sales Invoice Item',
                fields=['item_code', 'item_name', 'amount', 'qty', 'rate'],
                filters={'parent': invoice.name}
            )

            if not invoice_items:
                # Fallback: create a single item using invoice-level data
                invoice_items = [{
                    'item_code': 'INVOICE_TOTAL',
                    'item_name': f'Invoice {invoice.name}',
                    'amount': invoice.grand_total,
                    'qty': 1,
                    'rate': invoice.grand_total
                }]

            # Get claim items for this invoice
            claim_items = frappe.db.get_list('Claim Items',
                fields=['item', 'amount', 'tax_amount', 'invoice_reference', 'parent'],
                filters={'invoice_reference': invoice.name}
            )

            # Process each invoice item
            for item in invoice_items:
                service_group = next((sg for sg in service_groups if sg['service_name'] == item['item_name']), None)

                if not service_group:
                    service_group = {
                        'service_name': item['item_name'],
                        'item_code': item['item_code'],
                        'transactions': [],
                        'total_value': 0,
                        'total_paid': 0,
                        'total_balance': 0,
                        'total_claimed_tax': 0,
                        'is_tax_section': False
                    }
                    service_groups.append(service_group)

                # Add sales invoice transaction
                item_total_amount = flt(item['amount'], 2)
                service_group['transactions'].append({
                    'date': invoice.posting_date,
                    'document_number': invoice.name,
                    'description': f"Invoice for {item['item_name']} (Qty: {item['qty']}, Rate: {fmt_money(item['rate'])})",
                    'value': item_total_amount,
                    'paid': 0,
                    'tax_amount': 0,
                    'balance': 0,
                    'transaction_type': 'sales_invoice',
                    'invoice_reference': invoice.name
                })

                # Add related claim transactions
                item_claims = [claim for claim in claim_items if claim['item'] == item['item_name']]
                
                for claim_item in item_claims:
                    try:
                        claim_doc = frappe.get_doc('Project Claim', claim_item['parent'])
                        service_group['transactions'].append({
                            'date': claim_doc.date,
                            'document_number': claim_doc.name,
                            'description': f"Payment for {item['item_name']} - {claim_doc.being}",
                            'value': 0,
                            'paid': flt(claim_item['amount'], 2),
                            'tax_amount': flt(claim_item.get('tax_amount', 0), 2),
                            'balance': 0,
                            'transaction_type': 'project_claim',
                            'invoice_reference': invoice.name
                        })
                    except Exception as e:
                        frappe.log_error(f"Error processing claim item: {str(e)}")

        except Exception as e:
            frappe.log_error(f"Error processing invoice {invoice.name}: {str(e)}")

    # Calculate running balances for each service group
    for service_group in service_groups:
        running_balance = 0
        total_value = 0
        total_paid = 0

        # Sort transactions by date
        service_group['transactions'].sort(key=lambda x: x['date'])

        for transaction in service_group['transactions']:
            running_balance += transaction['value'] - transaction['paid']
            transaction['balance'] = running_balance
            total_value += transaction['value']
            total_paid += transaction['paid']

        service_group['total_value'] = total_value
        service_group['total_paid'] = total_paid
        service_group['total_balance'] = running_balance

    return service_groups

def generate_summary_data(customer_statement_data, project_expenses_data):
    """Generate summary statistics"""
    summary = {
        'total_invoiced': 0,
        'total_paid': 0,
        'total_outstanding': 0,
        'total_expenses': 0,
        'expense_count': 0,
        'invoice_count': 0,
        'claim_count': 0
    }

    if customer_statement_data and customer_statement_data.get('service_groups'):
        for group in customer_statement_data['service_groups']:
            summary['total_invoiced'] += group.get('total_value', 0)
            summary['total_paid'] += group.get('total_paid', 0)
            summary['total_outstanding'] += group.get('total_balance', 0)
            
            # Count transactions
            for transaction in group.get('transactions', []):
                if transaction['transaction_type'] == 'sales_invoice':
                    summary['invoice_count'] += 1
                elif transaction['transaction_type'] == 'project_claim':
                    summary['claim_count'] += 1

    if project_expenses_data:
        summary['total_expenses'] = sum(flt(expense.get('amount', 0)) for expense in project_expenses_data)
        summary['expense_count'] = len(project_expenses_data)

    return summary

def generate_combined_data(customer_statement_data, project_expenses_data):
    """Generate combined view data"""
    combined = []

    # Add customer statement transactions
    if customer_statement_data and customer_statement_data.get('service_groups'):
        for group in customer_statement_data['service_groups']:
            for transaction in group.get('transactions', []):
                combined.append({
                    'date': transaction['date'],
                    'type': 'Customer Transaction',
                    'description': transaction['description'],
                    'document_number': transaction['document_number'],
                    'amount': transaction['value'] if transaction['transaction_type'] == 'sales_invoice' else -transaction['paid'],
                    'balance': transaction['balance'],
                    'category': group['service_name']
                })

    # Add project expenses
    if project_expenses_data:
        for expense in project_expenses_data:
            combined.append({
                'date': expense['expense_date'],
                'type': 'Project Expense',
                'description': f"{expense['expense_type']}: {expense['description']}",
                'document_number': expense['expense_claim'],
                'amount': -flt(expense['amount']),  # Negative for expenses
                'balance': 0,  # Will be calculated if needed
                'category': expense['project_name'],
                'employee': expense['employee_name']
            })

    # Sort by date
    combined.sort(key=lambda x: x['date'], reverse=True)

    return combined

@frappe.whitelist()
def get_filter_options():
    """Get options for filter dropdowns"""
    try:
        # Get customers
        customers = frappe.db.get_list('Customer',
            fields=['name', 'customer_name'],
            order_by='customer_name'
        )

        # Get project contractors
        contractors = frappe.db.get_list('Project Contractors',
            fields=['name', 'project_name', 'customer'],
            order_by='project_name'
        )

        # Get employees
        employees = frappe.db.get_list('Employee',
            fields=['name', 'employee_name'],
            filters={'status': 'Active'},
            order_by='employee_name'
        )

        # Get expense types
        expense_types = frappe.db.sql("""
            SELECT DISTINCT expense_type
            FROM `tabExpense Claim Detail`
            WHERE expense_type IS NOT NULL AND expense_type != ''
            ORDER BY expense_type
        """, as_dict=True)

        return {
            'customers': customers,
            'contractors': contractors,
            'employees': employees,
            'expense_types': [et['expense_type'] for et in expense_types]
        }

    except Exception as e:
        frappe.log_error(f"Error in get_filter_options: {str(e)}")
        return {
            'customers': [],
            'contractors': [],
            'employees': [],
            'expense_types': []
        }

@frappe.whitelist()
def export_to_excel(data):
    """Export report data to Excel format"""
    try:
        # This would implement Excel export functionality
        # For now, return the data formatted for export
        return {
            'success': True,
            'message': 'Excel export functionality to be implemented',
            'data': data
        }
    except Exception as e:
        frappe.log_error(f"Error in export_to_excel: {str(e)}")
        return {
            'success': False,
            'message': str(e)
        } 
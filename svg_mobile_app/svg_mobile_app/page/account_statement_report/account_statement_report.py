# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.utils import flt, cstr, getdate, fmt_money, formatdate
from frappe import _
import json

@frappe.whitelist()
def get_account_statement_data(report_type=None, customer=None, contractor=None, engineer=None,
                              project_agreement=None, item=None, from_date=None, to_date=None):
    """
    Get comprehensive account statement data supporting multiple entity types:
    - Customer: Services & Payments, Government Fees, Trust Fees
    - Contractor: Contractor Services & Payments
    - Engineer: Outsource Engineer Services & Payments
    """
    # Validate required parameters
    if not report_type:
        frappe.throw(_("Report Type is required"))

    if not from_date or not to_date:
        frappe.throw(_("Both From Date and To Date are required"))

    # Set default date range if not provided
    if not from_date:
        from_date = frappe.utils.add_months(frappe.utils.today(), -12)
    if not to_date:
        to_date = frappe.utils.today()

    # Get data based on report type
    if report_type == 'customer':
        return get_customer_report_data(customer, project_agreement, item, from_date, to_date)
    elif report_type == 'contractor':
        return get_contractor_report_data(contractor, project_agreement, item, from_date, to_date)
    elif report_type == 'engineer':
        return get_engineer_report_data(engineer, project_agreement, item, from_date, to_date)
    else:
        frappe.throw(_("Invalid Report Type"))

def get_customer_report_data(customer, project_agreement, item, from_date, to_date):
    """Get customer-specific report data"""
    # Get project agreements for customer
    filters = { 'docstatus': ['in', [0, 1]] }

    if customer:
        filters['customer'] = customer
    if project_agreement:
        filters['name'] = project_agreement

    if from_date and to_date:
        filters['project_date'] = ['between', [from_date, to_date]]

    project_agreements = frappe.db.get_list('Project Agreement',
        fields=['name', 'project_name', 'customer', 'customer_name', 'project_date',
                'total_services_amount', 'total_government_fees', 'total_project_amount',
                'total_received', 'received_tax', 'unclaimed_amount'],
        filters=filters,
        order_by='project_date desc'
    )

    if not project_agreements:
        return {
            'customer': {'name': customer or '', 'customer_name': 'No data found'},
            'company': get_company_info(),
            'date_range': {
                'from_date': from_date,
                'to_date': to_date,
                'from_date_formatted': formatdate(from_date),
                'to_date_formatted': formatdate(to_date)
            },
            'currency': "AED",
            'service_groups': [],
            'summary': {
                'total_projects': 0,
                'total_invoices': 0,
                'total_claims': 0,
                'grand_total_value': 0,
                'grand_total_paid': 0,
                'grand_total_balance': 0
            }
        }

    # Process customer data
    customer_data = process_customer_data(project_agreements, item, from_date, to_date)

    # Get customer info
    customer_info = get_customer_info(customer)

    return {
        'customer': customer_info,
        'company': get_company_info(),
        'date_range': {
            'from_date': from_date,
            'to_date': to_date,
            'from_date_formatted': formatdate(from_date),
            'to_date_formatted': formatdate(to_date)
        },
        'currency': "AED",
        'service_groups': customer_data['service_groups'],
        'summary': customer_data['summary']
    }

def get_contractor_report_data(contractor, project_agreement, item, from_date, to_date):
    """Get contractor-specific report data"""
    # Get project agreements containing contractor services
    filters = { 'docstatus': ['in', [0, 1]] }

    if project_agreement:
        filters['name'] = project_agreement

    if from_date and to_date:
        filters['project_date'] = ['between', [from_date, to_date]]

    project_agreements = frappe.db.get_list('Project Agreement',
        fields=['name', 'project_name', 'customer', 'customer_name', 'project_date'],
        filters=filters,
        order_by='project_date desc'
    )

    # Filter projects that have contractor services
    filtered_projects = []
    for project in project_agreements:
        full_project = frappe.get_doc('Project Agreement', project.name)
        if full_project.contractors_services:
            # Filter by contractor if specified
            if contractor:
                contractor_services = [s for s in full_project.contractors_services if s.contractor == contractor]
                if contractor_services:
                    filtered_projects.append(project)
            else:
                filtered_projects.append(project)

    if not filtered_projects:
        return {
            'contractor': {'name': contractor or '', 'contractor_name': 'No data found'},
            'company': get_company_info(),
            'date_range': {
                'from_date': from_date,
                'to_date': to_date,
                'from_date_formatted': formatdate(from_date),
                'to_date_formatted': formatdate(to_date)
            },
            'currency': "AED",
            'service_groups': [],
            'summary': {
                'total_projects': 0,
                'total_services': 0,
                'grand_total_value': 0,
                'grand_total_paid': 0,
                'grand_total_balance': 0
            }
        }

    # Process contractor data
    contractor_data = process_contractor_data(filtered_projects, contractor, item, from_date, to_date)

    # Get contractor info
    contractor_info = get_contractor_info(contractor)

    return {
        'contractor': contractor_info,
        'company': get_company_info(),
        'date_range': {
            'from_date': from_date,
            'to_date': to_date,
            'from_date_formatted': formatdate(from_date),
            'to_date_formatted': formatdate(to_date)
        },
        'currency': "AED",
        'service_groups': contractor_data['service_groups'],
        'summary': contractor_data['summary']
    }

def get_engineer_report_data(engineer, project_agreement, item, from_date, to_date):
    """Get engineer-specific report data"""
    # Get project agreements containing outsource services
    filters = { 'docstatus': ['in', [0, 1]] }

    if project_agreement:
        filters['name'] = project_agreement

    if from_date and to_date:
        filters['project_date'] = ['between', [from_date, to_date]]

    project_agreements = frappe.db.get_list('Project Agreement',
        fields=['name', 'project_name', 'customer', 'customer_name', 'project_date'],
        filters=filters,
        order_by='project_date desc'
    )

    # Filter projects that have outsource services
    filtered_projects = []
    for project in project_agreements:
        full_project = frappe.get_doc('Project Agreement', project.name)
        if full_project.outsource_services:
            # Filter by engineer if specified
            if engineer:
                outsource_services = [s for s in full_project.outsource_services if s.service_provider == engineer]
                if outsource_services:
                    filtered_projects.append(project)
            else:
                filtered_projects.append(project)

    if not filtered_projects:
        return {
            'engineer': {'name': engineer or '', 'engineer_name': 'No data found'},
            'company': get_company_info(),
            'date_range': {
                'from_date': from_date,
                'to_date': to_date,
                'from_date_formatted': formatdate(from_date),
                'to_date_formatted': formatdate(to_date)
            },
            'currency': "AED",
            'service_groups': [],
            'summary': {
                'total_projects': 0,
                'total_services': 0,
                'grand_total_value': 0,
                'grand_total_paid': 0,
                'grand_total_balance': 0
            }
        }

    # Process engineer data
    engineer_data = process_engineer_data(filtered_projects, engineer, item, from_date, to_date)

    # Get engineer info
    engineer_info = get_engineer_info(engineer)

    return {
        'engineer': engineer_info,
        'company': get_company_info(),
        'date_range': {
            'from_date': from_date,
            'to_date': to_date,
            'from_date_formatted': formatdate(from_date),
            'to_date_formatted': formatdate(to_date)
        },
        'currency': "AED",
        'service_groups': engineer_data['service_groups'],
        'summary': engineer_data['summary']
    }

def process_customer_data(project_agreements, item_filter, from_date, to_date):
    """Process customer data similar to existing customer statement"""
    service_groups = {}
    combined_tax_details = []

    for project in project_agreements:
        full_project = frappe.get_doc('Project Agreement', project.name)

        # Process services and payments
        services_payments = process_project_services(full_project, item_filter)

        # Create service groups
        for item_key, item_data in services_payments.items():
            if item_key not in service_groups:
                service_groups[item_key] = {
                    'service_name': item_data['item'],
                    'service_name_ar': item_data['item'],
                    'transactions': [],
                    'total_value': 0,
                    'total_paid': 0,
                    'total_balance': 0
                }

            # Add transactions
            service_groups[item_key]['transactions'].extend(item_data['transactions'])
            service_groups[item_key]['total_value'] += item_data.get('total_debit', 0)  # Use total_debit as total_value
            service_groups[item_key]['total_paid'] += item_data.get('total_credit', 0)  # Use total_credit as total_paid
            service_groups[item_key]['total_balance'] += item_data.get('final_balance', 0)

        # Process tax details
        tax_details = process_project_taxes(full_project)
        combined_tax_details.extend(tax_details)

    # Create VAT section if there are tax transactions
    if combined_tax_details:
        vat_groups = {}
        for tax in combined_tax_details:
            tax_rate = tax.get('tax_rate', 5)
            if tax_rate not in vat_groups:
                vat_groups[tax_rate] = []
            vat_groups[tax_rate].append(tax)

        for tax_rate, transactions in vat_groups.items():
            vat_key = f"vat_{tax_rate}"
            service_groups[vat_key] = {
                'service_name': f'ضريبة القيمة المضافة {tax_rate}%',
                'service_name_ar': f'ضريبة القيمة المضافة {tax_rate}%',
                'tax_rate': tax_rate,
                'is_tax_section': True,
                'transactions': transactions,
                'total_value': sum(t['value'] for t in transactions),
                'total_paid': sum(t['paid'] for t in transactions),
                'total_balance': sum(t['balance'] for t in transactions)
            }

    return {
        'service_groups': list(service_groups.values()),
        'summary': {
            'total_projects': len(project_agreements),
            'total_services': len(service_groups),
            'grand_total_value': sum(group['total_value'] for group in service_groups.values()),
            'grand_total_paid': sum(group['total_paid'] for group in service_groups.values()),
            'grand_total_balance': sum(group['total_balance'] for group in service_groups.values())
        }
    }

def process_contractor_data(project_agreements, contractor_filter, item_filter, from_date, to_date):
    """Process contractor data from contractors_services and contractors_payment_log"""
    service_groups = {}

    for project in project_agreements:
        full_project = frappe.get_doc('Project Agreement', project.name)

        # Filter contractor services
        contractor_services = full_project.contractors_services or []
        if contractor_filter:
            contractor_services = [s for s in contractor_services if getattr(s, 'contractor', '') == contractor_filter]

        # Filter contractor payments
        contractor_payments = full_project.contractors_payment_log or []
        if contractor_filter:
            contractor_payments = [p for p in contractor_payments if getattr(p, 'contractor', '') == contractor_filter]

        # Group by item
        grouped_services = {}
        for service in contractor_services:
            service_item = getattr(service, 'item', '')
            if item_filter and service_item != item_filter:
                continue

            item_key = service_item
            if item_key not in grouped_services:
                grouped_services[item_key] = {
                    'item': service_item,
                    'transactions': [],
                    'total_debit': 0,
                    'total_credit': 0
                }

            # Add service transaction
            grouped_services[item_key]['transactions'].append({
                'date': getattr(service, 'invoice_date', ''),  # ContractorsServices uses invoice_date
                'type': 'Service',
                'debit': flt(getattr(service, 'amount', 0)),
                'credit': 0,
                'balance': 0,
                'remark': getattr(service, 'remark', '') or ''
            })
            grouped_services[item_key]['total_debit'] += flt(getattr(service, 'amount', 0))

        # Add payment transactions
        for payment in contractor_payments:
            payment_item = getattr(payment, 'item', '')
            if item_filter and payment_item != item_filter:
                continue

            item_key = payment_item
            if item_key not in grouped_services:
                grouped_services[item_key] = {
                    'item': payment_item,
                    'transactions': [],
                    'total_debit': 0,
                    'total_credit': 0
                }

            credit_amount = flt(getattr(payment, 'payment_amount', 0))

            grouped_services[item_key]['transactions'].append({
                'date': getattr(payment, 'date', ''),
                'type': 'Payment',
                'debit': 0,
                'credit': credit_amount,
                'balance': 0,
                'remark': getattr(payment, 'remark', '') or ''
            })
            grouped_services[item_key]['total_credit'] += credit_amount

        # Calculate balances and create service groups
        for item_key, item_data in grouped_services.items():
            item_data['transactions'].sort(key=lambda x: x['date'] or '')
            balance = 0
            for transaction in item_data['transactions']:
                balance += (transaction['debit'] or 0) - (transaction['credit'] or 0)
                transaction['balance'] = balance

            item_data['final_balance'] = balance

            if item_key not in service_groups:
                service_groups[item_key] = {
                    'service_name': item_data['item'],
                    'service_name_ar': item_data['item'],
                    'transactions': [],
                    'total_value': 0,
                    'total_paid': 0,
                    'total_balance': 0
                }

            service_groups[item_key]['transactions'].extend(item_data['transactions'])
            service_groups[item_key]['total_value'] += item_data.get('total_debit', 0)
            service_groups[item_key]['total_paid'] += item_data.get('total_credit', 0)
            service_groups[item_key]['total_balance'] += item_data.get('final_balance', 0)

    return {
        'service_groups': list(service_groups.values()),
        'summary': {
            'total_projects': len(project_agreements),
            'total_services': len(service_groups),
            'grand_total_value': sum(group['total_value'] for group in service_groups.values()),
            'grand_total_paid': sum(group['total_paid'] for group in service_groups.values()),
            'grand_total_balance': sum(group['total_balance'] for group in service_groups.values())
        }
    }

def process_engineer_data(project_agreements, engineer_filter, item_filter, from_date, to_date):
    """Process engineer data from outsource_services and outsource_payment_log"""
    service_groups = {}

    for project in project_agreements:
        full_project = frappe.get_doc('Project Agreement', project.name)

        # Filter outsource services
        outsource_services = full_project.outsource_services or []
        if engineer_filter:
            outsource_services = [s for s in outsource_services if getattr(s, 'service_provider', '') == engineer_filter]

        # Filter outsource payments
        outsource_payments = full_project.outsource_payment_log or []
        if engineer_filter:
            outsource_payments = [p for p in outsource_payments if getattr(p, 'engineer', '') == engineer_filter]

        # Group by service
        grouped_services = {}
        for service in outsource_services:
            service_name = getattr(service, 'service', '')
            if item_filter and service_name != item_filter:
                continue

            service_key = service_name
            if service_key not in grouped_services:
                grouped_services[service_key] = {
                    'service': service_name,
                    'transactions': [],
                    'total_debit': 0,
                    'total_credit': 0
                }

            # Add service transaction
            grouped_services[service_key]['transactions'].append({
                'date': getattr(service, 'date', ''),
                'type': 'Service',
                'debit': flt(getattr(service, 'amount', 0)),
                'credit': 0,
                'balance': 0,
                'remark': getattr(service, 'remark', '') or ''
            })
            grouped_services[service_key]['total_debit'] += flt(getattr(service, 'amount', 0))

        # Add payment transactions
        for payment in outsource_payments:
            payment_item = getattr(payment, 'item', '')  # OutsourcePaymentLog uses 'item' not 'service'
            if item_filter and payment_item != item_filter:
                continue

            service_key = payment_item
            if service_key not in grouped_services:
                grouped_services[service_key] = {
                    'service': payment_item,
                    'transactions': [],
                    'total_debit': 0,
                    'total_credit': 0
                }

            credit_amount = flt(getattr(payment, 'payment_amount', 0))

            grouped_services[service_key]['transactions'].append({
                'date': getattr(payment, 'date', ''),
                'type': 'Payment',
                'debit': 0,
                'credit': credit_amount,
                'balance': 0,
                'remark': getattr(payment, 'remark', '') or ''
            })
            grouped_services[service_key]['total_credit'] += credit_amount

        # Calculate balances and create service groups
        for service_key, service_data in grouped_services.items():
            service_data['transactions'].sort(key=lambda x: x['date'] or '')
            balance = 0
            for transaction in service_data['transactions']:
                balance += (transaction['debit'] or 0) - (transaction['credit'] or 0)
                transaction['balance'] = balance

            service_data['final_balance'] = balance

            if service_key not in service_groups:
                service_groups[service_key] = {
                    'service_name': service_data['service'],
                    'service_name_ar': service_data['service'],
                    'transactions': [],
                    'total_value': 0,
                    'total_paid': 0,
                    'total_balance': 0
                }

            service_groups[service_key]['transactions'].extend(service_data['transactions'])
            service_groups[service_key]['total_value'] += service_data.get('total_debit', 0)
            service_groups[service_key]['total_paid'] += service_data.get('total_credit', 0)
            service_groups[service_key]['total_balance'] += service_data.get('final_balance', 0)

    return {
        'service_groups': list(service_groups.values()),
        'summary': {
            'total_projects': len(project_agreements),
            'total_services': len(service_groups),
            'grand_total_value': sum(group['total_value'] for group in service_groups.values()),
            'grand_total_paid': sum(group['total_paid'] for group in service_groups.values()),
            'grand_total_balance': sum(group['total_balance'] for group in service_groups.values())
        }
    }

def process_project_services(project, item_filter):
    """Process project services and payments (similar to existing logic)"""
    services = project.project_services or []
    payments = project.payment_log or []

    grouped_services = {}

    # Group services by item
    for service in services:
        if item_filter and hasattr(service, 'item') and service.item != item_filter:
            continue

        # Safely get item name
        item_name = getattr(service, 'item', 'Unknown Item')
        item_key = item_name  # Use only item name since item_code doesn't exist
        
        if item_key not in grouped_services:
            grouped_services[item_key] = {
                'item': item_name,
                'transactions': [],
                'total_debit': 0,
                'total_credit': 0
            }

        grouped_services[item_key]['transactions'].append({
            'date': getattr(service, 'invoice_date', ''),
            'type': 'Service',
            'debit': flt(getattr(service, 'amount', 0)),
            'credit': 0,
            'balance': 0,
            'remark': getattr(service, 'remark', '') or ''
        })
        grouped_services[item_key]['total_debit'] += flt(getattr(service, 'amount', 0))

    # Add payments
    for payment in payments:
        if item_filter and hasattr(payment, 'item') and payment.item != item_filter:
            continue

        # Safely get item name
        item_name = getattr(payment, 'item', 'Unknown Item')
        item_key = item_name  # Use only item name since item_code doesn't exist
        
        if item_key not in grouped_services:
            grouped_services[item_key] = {
                'item': item_name,
                'transactions': [],
                'total_debit': 0,
                'total_credit': 0
            }

        credit_amount = 0
        transaction_type = getattr(payment, 'transaction_type', 'Payment')
        if transaction_type in ['Payment', 'Discount', 'Cancel Due', 'Return']:
            credit_amount = flt(getattr(payment, 'payment_amount', 0))

        grouped_services[item_key]['transactions'].append({
            'date': getattr(payment, 'date', ''),
            'type': transaction_type,
            'debit': 0,
            'credit': credit_amount,
            'balance': 0,
            'remark': getattr(payment, 'remark', '') or ''
        })
        grouped_services[item_key]['total_credit'] += credit_amount

    # Calculate balances
    for item_key, item_data in grouped_services.items():
        item_data['transactions'].sort(key=lambda x: x['date'] or '')
        balance = 0
        for transaction in item_data['transactions']:
            balance += (transaction['debit'] or 0) - (transaction['credit'] or 0)
            transaction['balance'] = balance
        item_data['final_balance'] = balance

    return grouped_services

def process_project_taxes(project):
    """Process project tax details"""
    tax_details = []
    services = project.project_services or []
    payments = project.payment_log or []

    for service in services:
        if flt(service.tax_amount) > 0:
            tax_details.append({
                'date': service.invoice_date,
                'document_number': f"{project.name}-SVC",
                'description': f"Tax for {service.item}",
                'value': flt(service.tax_amount),
                'paid': 0,
                'balance': flt(service.tax_amount),
                'tax_rate': flt(service.tax_rate) or 5,
                'transaction_type': 'service_tax'
            })

    # Add tax payments
    for payment in payments:
        if flt(payment.tax_amount) > 0:
            tax_details.append({
                'date': payment.date,
                'document_number': f"{project.name}-PAY",
                'description': f"Tax Payment for {payment.item}",
                'value': 0,
                'paid': flt(payment.tax_amount),
                'balance': -flt(payment.tax_amount),
                'tax_rate': flt(payment.tax_rate) or 5,
                'transaction_type': 'tax_payment'
            })

    return tax_details

def get_customer_info(customer):
    """Get customer information"""
    if not customer:
        return {'name': '', 'customer_name': 'All Customers'}

    try:
        customer_doc = frappe.get_doc("Customer", customer)
        return {
            'name': customer_doc.name,
            'customer_name': customer_doc.customer_name,
            'tax_id': getattr(customer_doc, 'tax_id', ''),
            'customer_group': customer_doc.customer_group,
            'territory': customer_doc.territory
        }
    except:
        return {'name': customer, 'customer_name': customer}

def get_contractor_info(contractor):
    """Get contractor information"""
    if not contractor:
        return {'name': '', 'contractor_name': 'All Contractors'}

    try:
        contractor_doc = frappe.get_doc("Customer", contractor)  # Contractors stored as Customer doctype
        return {
            'name': contractor_doc.name,
            'contractor_name': contractor_doc.customer_name,
            'tax_id': getattr(contractor_doc, 'tax_id', ''),
            'customer_group': contractor_doc.customer_group
        }
    except:
        return {'name': contractor, 'contractor_name': contractor}

def get_engineer_info(engineer):
    """Get engineer information"""
    if not engineer:
        return {'name': '', 'engineer_name': 'All Engineers'}

    try:
        engineer_doc = frappe.get_doc("Supplier", engineer)  # Engineers stored as Supplier doctype
        return {
            'name': engineer_doc.name,
            'engineer_name': engineer_doc.supplier_name,
            'tax_id': getattr(engineer_doc, 'tax_id', ''),
            'supplier_group': engineer_doc.supplier_group
        }
    except:
        return {'name': engineer, 'engineer_name': engineer}

def get_company_info():
    """Get company information"""
    current_company = frappe.defaults.get_user_default("Company")

    if not current_company:
        return {
            'name': 'Smart Vision Group',
            'company_name': 'Smart Vision Group',
            'company_name_ar': 'الرؤية الذكية للاستشارات الهندسية'
        }

    try:
        company_doc = frappe.get_doc("Company", current_company)
        return {
            'name': company_doc.name,
            'company_name': company_doc.company_name,
            'company_name_ar': getattr(company_doc, 'company_name_ar', company_doc.company_name),
            'tax_id': getattr(company_doc, 'tax_id', ''),
            'address': getattr(company_doc, 'address', ''),
            'phone': getattr(company_doc, 'phone_no', ''),
            'email': getattr(company_doc, 'email', '')
        }
    except:
        return {
            'name': current_company,
            'company_name': current_company,
            'company_name_ar': current_company
        }

@frappe.whitelist()
def get_customers_list():
    """Get list of customers for selection"""
    return frappe.db.sql("""
        SELECT name, customer_name, customer_group
        FROM `tabCustomer`
        WHERE disabled = 0
        ORDER BY customer_name
    """, as_dict=True)

@frappe.whitelist()
def get_contractors_list():
    """Get list of contractors for selection"""
    return frappe.db.sql("""
        SELECT name, customer_name as contractor_name, customer_group
        FROM `tabCustomer`
        WHERE disabled = 0
        ORDER BY customer_name
    """, as_dict=True)

@frappe.whitelist()
def get_engineers_list():
    """Get list of engineers for selection"""
    return frappe.db.sql("""
        SELECT name, supplier_name as engineer_name, supplier_group
        FROM `tabSupplier`
        WHERE disabled = 0
        ORDER BY supplier_name
    """, as_dict=True)

@frappe.whitelist()
def get_project_agreements_list():
    """Get list of project agreements for selection"""
    return frappe.db.sql("""
        SELECT name, project_name, customer_name, date
        FROM `tabProject Agreement`
        WHERE docstatus IN (0, 1)
        ORDER BY project_name, date DESC
    """, as_dict=True)

@frappe.whitelist()
def get_items_list():
    """Get list of items for selection"""
    return frappe.db.sql("""
        SELECT name, item_name, item_group
        FROM `tabItem`
        WHERE disabled = 0
        ORDER BY item_name
    """, as_dict=True)

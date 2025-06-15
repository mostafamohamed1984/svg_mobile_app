# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import json
from frappe.utils import flt, cstr


class ProjectContractors(Document):
	def validate(self):
		self.calculate_totals()
		
	def on_submit(self):
		"""Automatically create sales invoices when document is submitted"""
		if not self.sales_invoice_created:
			self.create_automatic_sales_invoices()
		
	def calculate_totals(self):
		"""Calculate total amounts for items and fees"""
		total_items = 0
		total_fees = 0
		
		# Calculate total for project items
		for item in self.items:
			if item.rate:
				total_items += flt(item.rate)
		
		# Calculate total for fees and deposits
		for fee in self.fees_and_deposits:
			if fee.rate:
				total_fees += flt(fee.rate)
		
		# Use the correct field names that exist in the doctype
		self.total_amount = total_items
		self.total_fees = total_fees
		self.total_project_amount = total_items + total_fees

	def create_automatic_sales_invoices(self):
		"""Create both taxable and non-taxable sales invoices automatically"""
		created_invoices = []
		
		try:
			# Create invoice for project items (taxable) if items exist
			if self.items and any(item.rate for item in self.items):
				taxable_invoice = self.create_taxable_sales_invoice()
				if taxable_invoice:
					created_invoices.append(f"Taxable Invoice: {taxable_invoice}")
			
			# Create invoice for fees and deposits (non-taxable) if fees exist
			if self.fees_and_deposits and any(fee.rate for fee in self.fees_and_deposits):
				non_taxable_invoice = self.create_non_taxable_sales_invoice()
				if non_taxable_invoice:
					created_invoices.append(f"Non-Taxable Invoice: {non_taxable_invoice}")
			
			# Update status if any invoices were created
			if created_invoices:
				self.sales_invoice_created = 1
				self.db_set('sales_invoice_created', 1, update_modified=False)
				
				# Show success message
				frappe.msgprint(
					"<br>".join(created_invoices),
					title="Sales Invoices Created",
					indicator="green"
				)
			
		except Exception as e:
			# Create a shorter error message for logging
			error_msg = str(e)
			if len(error_msg) > 100:
				error_msg = error_msg[:100] + "..."
			
			frappe.log_error(
				title=f"Sales Invoice Creation Error",
				message=f"Project Contractors: {self.name}\nError: {str(e)}"
			)
			frappe.throw(f"Failed to create sales invoices: {error_msg}")

	def create_taxable_sales_invoice(self):
		"""Create sales invoice for project items with taxes"""
		# Filter items with rates
		items_with_rates = [item for item in self.items if hasattr(item, 'rate') and item.rate and item.rate > 0]
		
		if not items_with_rates:
			return None

		# Get customer and company details for currency handling
		customer_doc = frappe.get_doc("Customer", self.customer)
		company_doc = frappe.get_doc("Company", self.company)
		
		# Create sales invoice
		sales_invoice = frappe.new_doc("Sales Invoice")
		sales_invoice.customer = self.customer
		sales_invoice.company = self.company
		sales_invoice.project_name = self.project_name
		sales_invoice.posting_date = frappe.utils.today()
		sales_invoice.custom_for_project = self.name  # Link back to project contractors
		
		# Set currency and price list from customer or company
		if hasattr(customer_doc, 'default_currency') and customer_doc.default_currency:
			sales_invoice.currency = customer_doc.default_currency
			sales_invoice.price_list_currency = customer_doc.default_currency
		else:
			# Fallback to company currency
			sales_invoice.currency = company_doc.default_currency
			sales_invoice.price_list_currency = company_doc.default_currency
		
		if hasattr(customer_doc, 'default_price_list') and customer_doc.default_price_list:
			sales_invoice.selling_price_list = customer_doc.default_price_list
		
		sales_invoice.ignore_pricing_rule = 1
		
		# Add items
		for item in items_with_rates:
			# Use custom_rate if available, otherwise use rate
			rate = getattr(item, 'custom_rate', None) or item.rate
			sales_invoice.append("items", {
				"item_code": item.item,
				"qty": getattr(item, 'qty', 1) or 1,
				"rate": rate,
				"amount": rate
			})
		
		# Apply tax template if selected
		if self.tax_template:
			try:
				tax_template = frappe.get_doc("Sales Taxes and Charges Template", self.tax_template)
				for tax in tax_template.taxes:
					sales_invoice.append("taxes", {
						"charge_type": tax.charge_type,
						"account_head": tax.account_head,
						"description": tax.description,
						"rate": tax.rate,
						"tax_amount": tax.tax_amount if tax.charge_type == "Actual" else 0
					})
			except Exception as e:
				frappe.log_error(f"Error applying tax template: {str(e)}")
		
		# Save and submit
		sales_invoice.save()
		sales_invoice.submit()
		
		return sales_invoice.name

	def create_non_taxable_sales_invoice(self):
		"""Create sales invoice for fees and deposits (non-taxable)"""
		# Filter fees with rates
		fees_with_rates = [fee for fee in self.fees_and_deposits if hasattr(fee, 'rate') and fee.rate and fee.rate > 0]
		
		if not fees_with_rates:
			return None

		# Get customer and company details for currency handling
		customer_doc = frappe.get_doc("Customer", self.customer)
		company_doc = frappe.get_doc("Company", self.company)
		
		# Create sales invoice
		sales_invoice = frappe.new_doc("Sales Invoice")
		sales_invoice.customer = self.customer
		sales_invoice.company = self.company
		sales_invoice.project_name = f"{self.project_name} - Fees"
		sales_invoice.posting_date = frappe.utils.today()
		sales_invoice.custom_for_project = self.name  # Link back to project contractors
		
		# Set currency and price list from customer or company
		if hasattr(customer_doc, 'default_currency') and customer_doc.default_currency:
			sales_invoice.currency = customer_doc.default_currency
			sales_invoice.price_list_currency = customer_doc.default_currency
		else:
			# Fallback to company currency
			sales_invoice.currency = company_doc.default_currency
			sales_invoice.price_list_currency = company_doc.default_currency
		
		if hasattr(customer_doc, 'default_price_list') and customer_doc.default_price_list:
			sales_invoice.selling_price_list = customer_doc.default_price_list
		
		sales_invoice.ignore_pricing_rule = 1
		
		# Add fees and deposits (no taxes applied)
		for fee in fees_with_rates:
			# Use custom_rate if available, otherwise use rate
			rate = getattr(fee, 'custom_rate', None) or fee.rate
			sales_invoice.append("items", {
				"item_code": fee.item,
				"qty": getattr(fee, 'qty', 1) or 1,
				"rate": rate,
				"amount": rate
			})
		
		# Save and submit (no taxes for fees)
		sales_invoice.save()
		sales_invoice.submit()
		
		return sales_invoice.name

	def create_additional_fees_invoice(self, uninvoiced_items=None):
		"""Create sales invoice for additional/uninvoiced items"""
		if not uninvoiced_items:
			# Find uninvoiced items
			uninvoiced_items = [item for item in self.items if not getattr(item, 'invoiced', False) and item.rate and item.rate > 0]
		
		if not uninvoiced_items:
			frappe.throw("No uninvoiced items found to create additional fees")

		# Get customer details
		customer_doc = frappe.get_doc("Customer", self.customer)
		
		# Create sales invoice
		sales_invoice = frappe.new_doc("Sales Invoice")
		sales_invoice.customer = self.customer
		sales_invoice.company = self.company
		sales_invoice.custom_for_project = self.name
		sales_invoice.posting_date = frappe.utils.today()
		
		# Set currency and price list from customer
		if hasattr(customer_doc, 'default_currency') and customer_doc.default_currency:
			sales_invoice.currency = customer_doc.default_currency
			sales_invoice.price_list_currency = customer_doc.default_currency
		
		if hasattr(customer_doc, 'default_price_list') and customer_doc.default_price_list:
			sales_invoice.selling_price_list = customer_doc.default_price_list
		
		sales_invoice.ignore_pricing_rule = 1
		
		# Add uninvoiced items
		items_to_mark = []
		for item in uninvoiced_items:
			rate = getattr(item, 'custom_rate', None) or item.rate
			sales_invoice.append("items", {
				"item_code": item.item,
				"qty": getattr(item, 'qty', 1) or 1,
				"rate": rate,
				"amount": rate
			})
			items_to_mark.append(item)
		
		# Save and submit
		sales_invoice.save()
		sales_invoice.submit()
		
		# Mark items as invoiced
		for item in items_to_mark:
			item.invoiced = 1
			item.sales_invoice = sales_invoice.name
		
		# Save the updated document
		self.save()
		
		return sales_invoice.name

	def get_tax_template_taxes(self):
		"""Get taxes from the selected tax template"""
		if not self.tax_template:
			return []
		
		tax_template = frappe.get_doc("Sales Taxes and Charges Template", self.tax_template)
		return tax_template.taxes or []

	def calculate_taxes_for_amount(self, amount):
		"""Calculate taxes for a given amount using the tax template"""
		if not self.tax_template or not amount:
			return []
		
		taxes = self.get_tax_template_taxes()
		calculated_taxes = []
		
		for tax in taxes:
			tax_amount = 0
			if tax.charge_type == "On Net Total":
				tax_amount = flt(amount * flt(tax.rate) / 100)
			elif tax.charge_type == "Actual":
				tax_amount = flt(tax.tax_amount)
			
			calculated_taxes.append({
				"charge_type": tax.charge_type,
				"account_head": tax.account_head,
				"description": tax.description,
				"rate": tax.rate,
				"tax_amount": tax_amount
			})
		
		return calculated_taxes

	@frappe.whitelist()
	def create_sales_invoice_for_items(self):
		"""Create sales invoice for project items with taxes"""
		if not self.items:
			frappe.throw("No project items found to create invoice")
		
		# Get customer and company details for currency handling
		customer_doc = frappe.get_doc("Customer", self.customer)
		company_doc = frappe.get_doc("Company", self.company)
		
		# Create sales invoice
		sales_invoice = frappe.new_doc("Sales Invoice")
		sales_invoice.customer = self.customer
		sales_invoice.company = self.company
		sales_invoice.project_name = self.project_name
		sales_invoice.custom_for_project = self.name
		
		# Set currency and price list from customer or company
		if hasattr(customer_doc, 'default_currency') and customer_doc.default_currency:
			sales_invoice.currency = customer_doc.default_currency
			sales_invoice.price_list_currency = customer_doc.default_currency
		else:
			# Fallback to company currency
			sales_invoice.currency = company_doc.default_currency
			sales_invoice.price_list_currency = company_doc.default_currency
		
		if hasattr(customer_doc, 'default_price_list') and customer_doc.default_price_list:
			sales_invoice.selling_price_list = customer_doc.default_price_list
		
		sales_invoice.ignore_pricing_rule = 1
		
		# Add items
		for item in self.items:
			if item.rate:
				sales_invoice.append("items", {
					"item_code": item.item,
					"qty": getattr(item, 'qty', 1) or 1,
					"rate": item.rate,
					"amount": item.rate
				})
		
		# Apply taxes if tax template is selected
		if self.tax_template:
			tax_template = frappe.get_doc("Sales Taxes and Charges Template", self.tax_template)
			for tax in tax_template.taxes:
				sales_invoice.append("taxes", {
					"charge_type": tax.charge_type,
					"account_head": tax.account_head,
					"description": tax.description,
					"rate": tax.rate,
					"tax_amount": tax.tax_amount if tax.charge_type == "Actual" else 0
				})
		
		# Save and submit
		sales_invoice.save()
		sales_invoice.submit()
		
		# Update status
		self.sales_invoice_created = 1
		self.db_set('sales_invoice_created', 1, update_modified=False)
		
		frappe.msgprint(f"Sales Invoice {sales_invoice.name} created successfully")
		return sales_invoice.name

	@frappe.whitelist()
	def create_sales_invoice_for_fees(self):
		"""Create sales invoice for fees and deposits (non-taxable)"""
		if not self.fees_and_deposits:
			frappe.throw("No fees and deposits found to create invoice")
		
		# Get customer and company details for currency handling
		customer_doc = frappe.get_doc("Customer", self.customer)
		company_doc = frappe.get_doc("Company", self.company)
		
		# Create sales invoice
		sales_invoice = frappe.new_doc("Sales Invoice")
		sales_invoice.customer = self.customer
		sales_invoice.company = self.company
		sales_invoice.project_name = self.project_name
		sales_invoice.custom_for_project = self.name
		
		# Set currency and price list from customer or company
		if hasattr(customer_doc, 'default_currency') and customer_doc.default_currency:
			sales_invoice.currency = customer_doc.default_currency
			sales_invoice.price_list_currency = customer_doc.default_currency
		else:
			# Fallback to company currency
			sales_invoice.currency = company_doc.default_currency
			sales_invoice.price_list_currency = company_doc.default_currency
		
		if hasattr(customer_doc, 'default_price_list') and customer_doc.default_price_list:
			sales_invoice.selling_price_list = customer_doc.default_price_list
		
		sales_invoice.ignore_pricing_rule = 1
		
		# Add fees and deposits (no taxes applied)
		for fee in self.fees_and_deposits:
			if fee.rate:
				sales_invoice.append("items", {
					"item_code": fee.item,
					"qty": getattr(fee, 'qty', 1) or 1,
					"rate": fee.rate,
					"amount": fee.rate
				})
		
		# Save and submit (no taxes for fees)
		sales_invoice.save()
		sales_invoice.submit()
		
		frappe.msgprint(f"Sales Invoice {sales_invoice.name} created for fees and deposits")
		return sales_invoice.name

	@frappe.whitelist()
	def get_tax_preview(self, amount):
		"""Get tax preview for given amount using selected tax template"""
		print(f"get_tax_preview called with amount: {amount}, tax_template: {self.tax_template}")
		
		if not self.tax_template or not amount:
			print(f"Missing tax_template ({self.tax_template}) or amount ({amount})")
			return None
			
		taxes = self.get_tax_template_taxes()
		print(f"Retrieved taxes: {taxes}")
		
		if not taxes:
			print("No taxes found in template")
			return None
			
		total_tax = 0
		for tax in taxes:
			if tax.get('charge_type') == 'On Net Total':
				tax_amount = flt(amount) * flt(tax.get('rate', 0)) / 100
				total_tax += tax_amount
				print(f"Tax calculation: {amount} * {tax.get('rate', 0)}% = {tax_amount}")
				
		result = {
			'tax_amount': total_tax,
			'net_amount': flt(amount),
			'grand_total': flt(amount) + total_tax
		}
		
		print(f"Returning tax preview: {result}")
		return result

	@frappe.whitelist()
	def create_additional_fees_invoice_api(self):
		"""API method to create additional fees invoice for uninvoiced items"""
		try:
			invoice_name = self.create_additional_fees_invoice()
			frappe.msgprint(f"Additional Fees Invoice {invoice_name} created successfully")
			return invoice_name
		except Exception as e:
			frappe.log_error(f"Error creating additional fees invoice: {str(e)}")
			frappe.throw(f"Failed to create additional fees invoice: {str(e)}")


@frappe.whitelist()
@frappe.validate_and_sanitize_search_inputs
def get_items_by_company(doctype, txt, searchfield, start, page_len, filters):
    """
    Custom query to filter items by company from item_defaults table
    """
    company = filters.get('company')
    
    # Debug log to verify the company value
    frappe.logger().debug(f"Filtering items for company: {company}")
    
    # Get items that have an Item Default entry for this company
    items = frappe.db.sql("""
        SELECT 
            i.name, i.item_name, i.description
        FROM 
            `tabItem` i
        INNER JOIN 
            `tabItem Default` id ON i.name = id.parent
        WHERE 
            id.company = %s
            AND (i.name LIKE %s OR i.item_name LIKE %s)
        GROUP BY
            i.name
        ORDER BY 
            i.name
        LIMIT %s, %s
    """, (
        company, 
        f"%{txt}%", 
        f"%{txt}%",
        start, 
        page_len
    ))
    
    # Log the result count
    frappe.logger().debug(f"Found {len(items)} items for company {company}")
    
    return items

@frappe.whitelist()
def check_project_claims_for_advances(project_contractors, include_partial_advances=False):
    """
    Check if there are Project Claims created for the fees and deposits items
    
    Args:
        project_contractors (str): Name of the Project Contractors document
        include_partial_advances (bool): Whether to include items with partial advances
    
    Returns:
        dict: Status and list of eligible items with their claimed amounts
    """
    # Convert parameter to boolean if it's a string
    if isinstance(include_partial_advances, str):
        include_partial_advances = include_partial_advances.lower() == 'true'
    
    # Get the Project Contractors document
    project_contractors_doc = frappe.get_doc("Project Contractors", project_contractors)
    
    if project_contractors_doc.docstatus != 1:
        return {"status": "error", "message": "Project Contractors document must be submitted"}
    
    # Get all sales invoices created for this Project Contractors
    sales_invoices = frappe.get_all(
        "Sales Invoice",
        filters={
            "custom_for_project": project_contractors,
            "docstatus": 1
        },
        pluck="name"
    )
    
    if not sales_invoices:
        return {
            "status": "info",
            "message": "No Sales Invoices found for this Project Contractors",
            "has_eligible_items": False
        }
    
    # Get all Project Claims that reference these Sales Invoices
    project_claims = frappe.get_all(
        "Project Claim",
        filters={
            "reference_invoice": ["in", sales_invoices],
            "docstatus": 1
        },
        pluck="name"
    )
    
    # Also check for Project Claims that might have these invoices in the invoice_references field
    for invoice in sales_invoices:
        additional_claims = frappe.get_all(
            "Project Claim",
            filters=[
                ["docstatus", "=", 1],
                ["invoice_references", "like", f"%{invoice}%"]
            ],
            pluck="name"
        )
        project_claims.extend(additional_claims)
    
    # Remove duplicates
    project_claims = list(set(project_claims))
    
    if not project_claims:
        return {
            "status": "info",
            "message": "No Project Claims found for the Sales Invoices of this Project Contractors",
            "has_eligible_items": False
        }
    
    # Get all claim items from these Project Claims with their amounts
    claim_items = frappe.get_all(
        "Claim Items",
        filters={
            "parent": ["in", project_claims],
            "parenttype": "Project Claim"
        },
        fields=["item", "amount", "invoice_reference", "parent"]
    )
    
    # Create a map of items to their claimed amounts
    item_claim_map = {}
    for claim_item in claim_items:
        if claim_item.item not in item_claim_map:
            item_claim_map[claim_item.item] = {
                "claimed_amount": claim_item.amount,
                "invoice_reference": claim_item.invoice_reference
            }
        else:
            # If there are multiple claims for the same item, sum up the amounts
            item_claim_map[claim_item.item]["claimed_amount"] += claim_item.amount
    
    # Check which fees and deposits items have Project Claims but don't have Employee Advances created
    # or have partial advances if include_partial_advances is True
    eligible_items = []
    
    for item in project_contractors_doc.fees_and_deposits:
        is_eligible = False
        
        if item.item in item_claim_map:
            # Calculate total amount of advances already created
            total_advanced = 0
            if hasattr(item, "employee_advances") and item.employee_advances:
                advances = item.employee_advances.split(",")
                for advance_name in advances:
                    advance_amount = frappe.get_value("Employee Advance", advance_name, "advance_amount")
                    if advance_amount:
                        total_advanced += float(advance_amount)
            
            # Get the claimed amount
            claimed_amount = item_claim_map[item.item]["claimed_amount"]
            
            # Calculate remaining amount
            remaining_amount = claimed_amount - total_advanced
            
            # Check if the item has no advances or only partial advances
            if not item.employee_advance_created and remaining_amount > 0:
                is_eligible = True
            elif include_partial_advances and remaining_amount > 0:
                is_eligible = True
            
            if is_eligible and remaining_amount > 0:
                # Add to eligible items with additional claim info
                eligible_items.append({
                    "item": item.item,
                    "rate": item.rate,  # Original rate from fees and deposits
                    "claimed_amount": claimed_amount,  # Amount claimed in Project Claim
                    "invoice_reference": item_claim_map[item.item].get("invoice_reference"),
                    "remaining_amount": remaining_amount,
                    "total_advanced": total_advanced
                })
    
    return {
        "status": "success",
        "has_eligible_items": len(eligible_items) > 0,
        "eligible_items": eligible_items
    }

@frappe.whitelist()
def create_employee_advances(project_contractors, advances):
    """
    Create Employee Advances from fees and deposits items
    
    Args:
        project_contractors (str): Name of the Project Contractors document
        advances (list): List of dictionaries containing advance details
            Each dict should have: employee, purpose, advance_amount, item
    
    Returns:
        dict: Status and list of created Employee Advance documents
    """
    import json
    from frappe.utils import flt
    
    try:
        frappe.logger().info(f"create_employee_advances called with project_contractors: {project_contractors}")
        frappe.logger().info(f"advances parameter type: {type(advances)}, value: {advances}")
        
        # Temporary test - remove this after testing
        # return {"status": "error", "message": f"Function called successfully! Project: {project_contractors}, Advances count: {len(advances) if isinstance(advances, list) else 'not a list'}"}
        
        if isinstance(advances, str):
            advances = json.loads(advances)
        
        if not advances:
            return {"status": "error", "message": "No advances to create"}
        
        frappe.logger().info(f"Parsed advances: {advances}")
        
        # Validate input data
        validation_errors = []
        for i, advance in enumerate(advances):
            if not advance.get("employee"):
                validation_errors.append(f"Advance {i+1}: Employee is required")
            else:
                # Check if employee exists and is active
                if not frappe.db.exists("Employee", advance["employee"]):
                    validation_errors.append(f"Advance {i+1}: Employee {advance['employee']} does not exist")
                elif frappe.get_value("Employee", advance["employee"], "status") != "Active":
                    validation_errors.append(f"Advance {i+1}: Employee {advance['employee']} is not active")
            
            if not advance.get("advance_amount") or float(advance.get("advance_amount", 0)) <= 0:
                validation_errors.append(f"Advance {i+1}: Valid advance amount is required")
            
            if not advance.get("item"):
                validation_errors.append(f"Advance {i+1}: Item reference is required")
        
        if validation_errors:
            return {"status": "error", "message": "<br>".join(validation_errors)}
        
        # Get the Project Contractors document
        frappe.logger().info(f"Getting Project Contractors document: {project_contractors}")
        project_contractors_doc = frappe.get_doc("Project Contractors", project_contractors)
        
        if project_contractors_doc.docstatus != 1:
            return {"status": "error", "message": "Project Contractors document must be submitted"}
        
        # Get company from the Project Contractors document
        company = project_contractors_doc.company
        frappe.logger().info(f"Company: {company}")
        
        # Get default advance account for the company
        default_advance_account = get_default_advance_account(company)
        frappe.logger().info(f"Default advance account: {default_advance_account}")
        if not default_advance_account:
            return {"status": "error", "message": f"No default advance account found for company {company}"}
        
        # Get company currency
        company_currency = frappe.get_cached_value('Company', company, 'default_currency')
        
        # Group advances by item to check total amounts
        advances_by_item = {}
        for advance_data in advances:
            item_code = advance_data.get("item")
            if item_code not in advances_by_item:
                advances_by_item[item_code] = []
            advances_by_item[item_code].append(advance_data)
        
        # Create Employee Advances
        created_advances = []
        updated_fees_and_deposits = {}
        
        # Process each item
        for item_code, item_advances in advances_by_item.items():
            # Get the claimed amount for this item
            claimed_amount = get_claimed_amount_for_item(item_code)
            if not claimed_amount:
                # If no claimed amount, get the rate from the fees and deposits table
                for fee_item in project_contractors_doc.fees_and_deposits:
                    if fee_item.item == item_code:
                        claimed_amount = fee_item.rate
                        break
            
            if not claimed_amount:
                frappe.msgprint(f"Could not determine claimed amount for item {item_code}. Skipping.")
                continue
            
            # Get existing advances for this item
            existing_advances_total = 0
            for fee_item in project_contractors_doc.fees_and_deposits:
                if fee_item.item == item_code and hasattr(fee_item, "employee_advances") and fee_item.employee_advances:
                    advances = fee_item.employee_advances.split(",")
                    for advance_name in advances:
                        advance_amount = frappe.get_value("Employee Advance", advance_name, "advance_amount")
                        if advance_amount:
                            existing_advances_total += float(advance_amount)
            
            # Calculate total new advances for this item
            new_advances_total = sum(float(adv.get("advance_amount", 0)) for adv in item_advances)
            
            # Check if total advances would exceed claimed amount
            if existing_advances_total + new_advances_total > claimed_amount:
                remaining_amount = claimed_amount - existing_advances_total
                if remaining_amount <= 0:
                    frappe.msgprint(f"Cannot create more advances for item {item_code}. Maximum claimed amount ({claimed_amount}) already reached.")
                    continue
                
                frappe.msgprint(f"Total advances for item {item_code} would exceed claimed amount. Reducing to {remaining_amount}.")
                
                # Adjust advance amounts to fit within remaining amount
                adjustment_factor = remaining_amount / new_advances_total
                for adv in item_advances:
                    adv["advance_amount"] = float(adv.get("advance_amount", 0)) * adjustment_factor
            
            # Create advances for this item
            for advance_data in item_advances:
                try:
                    # Skip if advance amount is too small
                    advance_amount = float(advance_data.get("advance_amount", 0))
                    if advance_amount < 0.01:
                        continue
                    
                    # Validate employee exists
                    employee = advance_data.get("employee")
                    if not frappe.db.exists("Employee", employee):
                        frappe.msgprint(f"Employee {employee} not found. Skipping advance.")
                        continue
                    
                    # Create Employee Advance
                    frappe.logger().info(f"Creating Employee Advance for employee: {employee}, amount: {advance_amount}")
                    employee_advance = frappe.new_doc("Employee Advance")
                    employee_advance.employee = employee
                    employee_advance.purpose = advance_data.get("purpose") or f"Advance for {item_code}"
                    employee_advance.advance_amount = advance_amount
                    employee_advance.posting_date = frappe.utils.today()
                    employee_advance.company = company
                    frappe.logger().info(f"Basic fields set for Employee Advance")
                    
                    # Set currency and exchange rate to prevent errors
                    if frappe.get_meta("Employee Advance").has_field("currency"):
                        employee_advance.currency = company_currency
                    
                    if frappe.get_meta("Employee Advance").has_field("exchange_rate"):
                        # Check if we need to set an exchange rate
                        advance_currency = getattr(employee_advance, "currency", company_currency)
                        if advance_currency != company_currency:
                            # Try to get exchange rate from Currency Exchange
                            exchange_rate = get_exchange_rate(advance_currency, company_currency)
                            if not exchange_rate or exchange_rate == 0:
                                # If exchange rate is not found or is zero, set a default value
                                exchange_rate = 1.0
                                frappe.msgprint(f"Exchange rate for {advance_currency} to {company_currency} not found. Using default rate of 1.0")
                            
                            employee_advance.exchange_rate = exchange_rate
                        else:
                            # Same currency, use exchange rate 1
                            employee_advance.exchange_rate = 1.0
                    
                    # Add custom fields if they exist
                    if frappe.get_meta("Employee Advance").has_field("custom_type"):
                        employee_advance.custom_type = "Advance"
                        
                    # Add reference to Project Contractors
                    if frappe.get_meta("Employee Advance").has_field("project_contractors_reference"):
                        employee_advance.project_contractors_reference = project_contractors
                    
                    # Add reference to the specific item
                    if frappe.get_meta("Employee Advance").has_field("item_reference"):
                        employee_advance.item_reference = item_code
                    
                    # Try a simpler approach first - just set the advance_account directly
                    frappe.logger().info(f"Creating Employee Advance with: employee={employee}, amount={advance_amount}, account={default_advance_account}")
                    
                    # Set the advance_account directly
                    employee_advance.advance_account = default_advance_account
                    
                    # Try to save the employee advance
                    frappe.logger().info("Attempting to save Employee Advance...")
                    employee_advance.insert()
                    frappe.logger().info(f"Successfully created Employee Advance: {employee_advance.name}")
                    
                    # Submit the advance if possible
                    try:
                        frappe.logger().info("Attempting to submit Employee Advance...")
                        employee_advance.submit()
                        frappe.logger().info(f"Successfully submitted Employee Advance: {employee_advance.name}")
                    except Exception as e:
                        frappe.logger().error(f"Error submitting Employee Advance: {str(e)}")
                        # Don't fail the whole process if submission fails
                    
                    created_advances.append(employee_advance.name)
                    
                    # Update the fees_and_deposits tracking
                    if item_code not in updated_fees_and_deposits:
                        updated_fees_and_deposits[item_code] = {
                            "item": item_code,
                            "employee_advances": [employee_advance.name]
                        }
                    else:
                        updated_fees_and_deposits[item_code]["employee_advances"].append(employee_advance.name)
                    
                except Exception as e:
                    error_msg = f"Error creating advance for {advance_data.get('employee')}: {str(e)}"
                    frappe.log_error(message=error_msg, title="Create Employee Advance Error")
                    frappe.logger().error(error_msg)
                    # Return the specific error instead of continuing
                    return {"status": "error", "message": error_msg}
        
        # Update the Project Contractors document with employee advance references
        if updated_fees_and_deposits:
            update_fees_and_deposits(project_contractors, updated_fees_and_deposits)
        
        return {
            "status": "success", 
            "message": f"Created {len(created_advances)} Employee Advances", 
            "advances": created_advances
        }

    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        frappe.log_error(message=error_details, title="Create Employee Advances Error")
        frappe.logger().error(f"Error in create_employee_advances: {str(e)}")
        frappe.logger().error(f"Full traceback: {error_details}")
        return {"status": "error", "message": f"Failed to create employee advances: {str(e)}"}

def find_project_claim_for_item(item_code):
    """
    Find a Project Claim for a specific item
    
    Args:
        item_code (str): Item code to search for
    
    Returns:
        str: Project Claim name or None
    """
    claim_items = frappe.get_all(
        "Claim Items",
        filters={
            "item": item_code,
            "parenttype": "Project Claim",
            "parent": ["in", frappe.get_all("Project Claim", filters={"docstatus": 1}, pluck="name")]
        },
        fields=["parent"],
        limit=1
    )
    
    return claim_items[0].parent if claim_items else None

def update_fees_and_deposits(project_contractors, updated_items):
    """
    Update the fees_and_deposits table in the Project Contractors document
    to mark items as having had Employee Advances created
    
    Args:
        project_contractors (str): Name of the Project Contractors document
        updated_items (dict): Dict of items with their updates
            Keys are item codes, values are dicts with keys:
                - item: Item code
                - employee_advances: List of Employee Advance document names
    
    Returns:
        None
    """
    # Get the Project Contractors document
    doc = frappe.get_doc("Project Contractors", project_contractors)
    
    # Update each item in the fees_and_deposits table
    for fee_item in doc.fees_and_deposits:
        if fee_item.item in updated_items:
            update_item = updated_items[fee_item.item]
            
            # Store all advances as a comma-separated list in the custom field
            advances_list = update_item.get("employee_advances", [])
            
            # Get the existing advances if any
            existing_advances = []
            if hasattr(fee_item, "employee_advances") and fee_item.employee_advances:
                existing_advances = fee_item.employee_advances.split(",")
            
            # Combine existing and new advances, removing duplicates
            all_advances = list(set(existing_advances + advances_list))
            
            # Calculate total advanced amount
            total_advanced = 0
            for advance_name in all_advances:
                advance = frappe.get_value("Employee Advance", advance_name, "advance_amount")
                if advance:
                    total_advanced += float(advance)
            
            # Get the claimed amount from Project Claims
            claimed_amount = get_claimed_amount_for_item(fee_item.item)
            
            # If no claimed amount found, fall back to the original rate
            if not claimed_amount:
                claimed_amount = fee_item.rate
            
            # Store the first advance for backward compatibility
            if advances_list and len(advances_list) > 0:
                fee_item.employee_advance = advances_list[0]
            
            # Store all advances as a comma-separated list
            if hasattr(fee_item, "employee_advances"):
                fee_item.employee_advances = ",".join(all_advances)
            
            # Only mark as complete if total advanced meets or exceeds claimed amount
            if total_advanced >= claimed_amount:
                fee_item.employee_advance_created = 1
            else:
                # Ensure it's marked as not complete if partial advances exist
                fee_item.employee_advance_created = 0
    
    # Save the document
    doc.save()

def get_claimed_amount_for_item(item_code):
    """
    Get the total claimed amount for an item from all Project Claims
    
    Args:
        item_code (str): Item code to search for
        
    Returns:
        float: Total claimed amount for the item
    """
    claim_items = frappe.get_all(
        "Claim Items",
        filters={
            "item": item_code,
            "parenttype": "Project Claim",
            "parent": ["in", frappe.get_all("Project Claim", filters={"docstatus": 1}, pluck="name")]
        },
        fields=["amount"]
    )
    
    total_claimed = 0
    for claim_item in claim_items:
        total_claimed += claim_item.amount
    
    return total_claimed

def get_default_advance_account(company):
    """
    Get the default advance account for the company
    
    Args:
        company (str): Company name
        
    Returns:
        str: Default advance account
    """
    try:
        frappe.logger().info(f"Getting default advance account for company: {company}")
        
        # Try to get from company defaults
        default_account = frappe.get_cached_value('Company', company, 'default_employee_advance_account')
        frappe.logger().info(f"Company default advance account: {default_account}")
        
        if not default_account:
            # Try to find an account with "Employee Advance" in the name
            accounts = frappe.get_all(
                "Account",
                filters={
                    "company": company,
                    "account_type": "Payable",
                    "is_group": 0,
                    "name": ["like", "%Employee Advance%"]
                },
                fields=["name"]
            )
            frappe.logger().info(f"Found Employee Advance accounts: {accounts}")
            
            if accounts:
                default_account = accounts[0].name
        
        if not default_account:
            # Try to find any payable account
            accounts = frappe.get_all(
                "Account",
                filters={
                    "company": company,
                    "account_type": "Payable",
                    "is_group": 0
                },
                fields=["name"],
                limit=1
            )
            frappe.logger().info(f"Found payable accounts: {accounts}")
            
            if accounts:
                default_account = accounts[0].name
        
        frappe.logger().info(f"Final default account: {default_account}")
        return default_account
        
    except Exception as e:
        frappe.logger().error(f"Error in get_default_advance_account: {str(e)}")
        return None

def get_exchange_rate(from_currency, to_currency):
    """
    Get exchange rate between two currencies
    
    Args:
        from_currency (str): From Currency
        to_currency (str): To Currency
    
    Returns:
        float: Exchange rate or 1.0 if not found
    """
    try:
        # Try to get the exchange rate from Currency Exchange
        exchange_rate = frappe.db.get_value(
            "Currency Exchange",
            {
                "from_currency": from_currency,
                "to_currency": to_currency,
                "date": ["<=", frappe.utils.today()]
            },
            "exchange_rate",
            order_by="date desc"
        )
        
        if not exchange_rate:
            # Try the reverse rate
            reverse_rate = frappe.db.get_value(
                "Currency Exchange",
                {
                    "from_currency": to_currency,
                    "to_currency": from_currency,
                    "date": ["<=", frappe.utils.today()]
                },
                "exchange_rate",
                order_by="date desc"
            )
            
            if reverse_rate:
                exchange_rate = 1.0 / float(reverse_rate)
        
        return float(exchange_rate) if exchange_rate else 1.0
    except Exception as e:
        frappe.log_error(f"Error getting exchange rate: {str(e)}")
        return 1.0

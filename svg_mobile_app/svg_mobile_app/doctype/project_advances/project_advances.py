# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt, cstr
import json


class ProjectAdvances(Document):
	def validate(self):
		self.validate_advance_amount()
		self.calculate_totals()
		self.update_status()
		
	def before_save(self):
		if self.project_contractors:
			self.load_available_fees_and_deposits()
			
	def on_submit(self):
		"""Create Employee Advances when document is submitted"""
		self.create_employee_advances()
		self.update_status()
		
	def on_cancel(self):
		"""Cancel related Employee Advances when document is cancelled"""
		self.cancel_employee_advances()
		self.update_status()
		
	def validate_advance_amount(self):
		"""Validate that advance amount doesn't exceed available balance"""
		if not self.project_contractors or not self.advance_amount:
			return
			
		# Calculate total allocated amount from contractors
		total_allocated = 0
		for contractor in self.project_contractors:
			if contractor.allocated_amount:
				total_allocated += flt(contractor.allocated_amount)
		
		# Validate that total allocated doesn't exceed advance amount
		if total_allocated > flt(self.advance_amount):
			frappe.throw(
				f"Total allocated amount {frappe.format(total_allocated, {'fieldtype': 'Currency'})} "
				f"cannot exceed advance amount {frappe.format(self.advance_amount, {'fieldtype': 'Currency'})}"
			)
		
		# Validate each contractor's allocation doesn't exceed their available balance
		for contractor in self.project_contractors:
			if contractor.allocated_amount and contractor.total_available_balance:
				if flt(contractor.allocated_amount) > flt(contractor.total_available_balance):
					frappe.throw(
						f"Allocated amount {frappe.format(contractor.allocated_amount, {'fieldtype': 'Currency'})} "
						f"for {contractor.project_contractor} cannot exceed available balance "
						f"{frappe.format(contractor.total_available_balance, {'fieldtype': 'Currency'})}"
					)
			
	def calculate_totals(self):
		"""Calculate total distributed and balance remaining"""
		total_distributed = 0
		
		# Calculate from contractor allocated amounts instead of advance items
		for contractor in self.project_contractors:
			if contractor.allocated_amount:
				total_distributed += flt(contractor.allocated_amount)
		
		self.total_distributed = total_distributed
		self.balance_remaining = flt(self.advance_amount) - total_distributed
		
		# Update total advance amount if not set
		if not self.total_advance_amount:
			self.total_advance_amount = self.advance_amount
			
	def update_status(self):
		"""Update status based on remaining balance and submission status"""
		if self.docstatus == 2:  # Cancelled
			self.status = "Cancelled"
		elif self.docstatus == 0:  # Draft
			self.status = "Draft"
		elif flt(self.remaining_balance) <= 0:
			self.status = "Exhausted"
		else:
			self.status = "Active"
			
	def load_available_fees_and_deposits(self):
		"""Load available fees and deposits for all selected project contractors"""
		if not self.project_contractors:
			return
			
		# Get available balances for all project contractors
		available_data = self.get_available_fees_and_deposits()
		
		# Update the HTML field to show available amounts
		self.update_available_fees_html(available_data)
			
	def get_available_fees_and_deposits(self):
		"""Get available fees and deposits balances for all selected project contractors"""
		if not self.project_contractors:
			return []
			
		available_items = []
		
		# Process each selected project contractor
		for contractor_row in self.project_contractors:
			project_contractor_name = contractor_row.project_contractor
			
			if not project_contractor_name:
				continue
				
			# Get the project contractor document
			project_contractor_doc = frappe.get_doc("Project Contractors", project_contractor_name)
			
			# Process fees and deposits items for this contractor
			for fee_item in project_contractor_doc.fees_and_deposits:
				# Get claimed amount from Project Claims for this specific contractor and item
				claimed_amount = self.get_claimed_amount_for_item(fee_item.item, project_contractor_name)
				
				# For testing: show all items even if not claimed yet
				# if claimed_amount <= 0:
				# 	continue  # Skip items with no claims
					
				# Get already advanced amount from existing Employee Advances
				advanced_amount = self.get_advanced_amount_for_item(fee_item.item, project_contractor_name)
				
				# Get amount already allocated in other Project Advances
				allocated_in_other_advances = self.get_allocated_in_other_project_advances(fee_item.item, project_contractor_name)
				
				# Calculate available balance
				# For items with no claims yet, use the original rate as available balance
				if claimed_amount <= 0:
					available_balance = flt(fee_item.rate) - advanced_amount - allocated_in_other_advances
				else:
					available_balance = claimed_amount - advanced_amount - allocated_in_other_advances
				
				if available_balance > 0:
					# Get item name from Item master
					item_name = frappe.get_cached_value("Item", fee_item.item, "item_name") or fee_item.item
					
					available_items.append({
						'project_contractor': project_contractor_name,
						'project_name': project_contractor_doc.project_name,
						'item_code': fee_item.item,
						'item_name': item_name,
						'original_rate': fee_item.rate,
						'claimed_amount': claimed_amount,
						'advanced_amount': advanced_amount,
						'allocated_in_other_advances': allocated_in_other_advances,
						'available_balance': available_balance
					})
					
		return available_items
		
	def get_claimed_amount_for_item(self, item_code, project_contractor):
		"""Get total claimed amount for an item from Project Claims"""
		# Get all submitted project claims
		submitted_claims = frappe.get_all(
			"Project Claim",
			filters={"docstatus": 1},
			pluck="name"
		)
		
		if not submitted_claims:
			return 0
		
		total_claimed = 0
		
		# Method 1: Try exact match with project_contractor_reference
		claim_items = frappe.get_all(
			"Claim Items",
			filters={
				"item": item_code,
				"project_contractor_reference": project_contractor,
				"parenttype": "Project Claim",
				"parent": ["in", submitted_claims]
			},
			fields=["amount"]
		)
		
		for claim_item in claim_items:
			total_claimed += flt(claim_item.amount)
		
		# Method 2: If no exact match found, try broader search
		# Look for claims where the Project Claim references this project contractor
		if total_claimed == 0:
			# Get Project Claims that reference this project contractor in various ways
			project_claims_for_contractor = []
			
			# Check project_references field
			claims_by_project_refs = frappe.get_all(
				"Project Claim",
				filters=[
					["docstatus", "=", 1],
					["project_references", "like", f"%{project_contractor}%"]
				],
				pluck="name"
			)
			project_claims_for_contractor.extend(claims_by_project_refs)
			
			# Check for_project field
			claims_by_for_project = frappe.get_all(
				"Project Claim",
				filters={
					"for_project": project_contractor,
					"docstatus": 1
				},
				pluck="name"
			)
			project_claims_for_contractor.extend(claims_by_for_project)
			
			# Remove duplicates
			project_claims_for_contractor = list(set(project_claims_for_contractor))
			
			if project_claims_for_contractor:
				# Get claim items for this item from these claims
				broader_claim_items = frappe.get_all(
					"Claim Items",
					filters={
						"item": item_code,
						"parenttype": "Project Claim",
						"parent": ["in", project_claims_for_contractor]
					},
					fields=["amount"]
				)
				
				for claim_item in broader_claim_items:
					total_claimed += flt(claim_item.amount)
		
		# Method 3: If still no match, check Sales Invoices from this Project Contractor
		if total_claimed == 0:
			# Get Sales Invoices for this Project Contractor
			sales_invoices = frappe.get_all(
				"Sales Invoice",
				filters={
					"custom_for_project": project_contractor,
					"docstatus": 1
				},
				pluck="name"
			)
			
			if sales_invoices:
				# Find Project Claims that reference these invoices
				claims_by_invoice = []
				
				for invoice in sales_invoices:
					# Check reference_invoice field
					claims = frappe.get_all(
						"Project Claim",
						filters={
							"reference_invoice": invoice,
							"docstatus": 1
						},
						pluck="name"
					)
					claims_by_invoice.extend(claims)
					
					# Check invoice_references field
					additional_claims = frappe.get_all(
						"Project Claim",
						filters=[
							["docstatus", "=", 1],
							["invoice_references", "like", f"%{invoice}%"]
						],
						pluck="name"
					)
					claims_by_invoice.extend(additional_claims)
				
				# Remove duplicates
				claims_by_invoice = list(set(claims_by_invoice))
				
				if claims_by_invoice:
					# Get claim items for this item from these claims
					invoice_claim_items = frappe.get_all(
						"Claim Items",
						filters={
							"item": item_code,
							"parenttype": "Project Claim",
							"parent": ["in", claims_by_invoice]
						},
						fields=["amount"]
					)
					
					for claim_item in invoice_claim_items:
						total_claimed += flt(claim_item.amount)
			
		return total_claimed
		
	def get_advanced_amount_for_item(self, item_code, project_contractor):
		"""Get total advanced amount for an item from Employee Advances"""
		total_advanced = 0
		
		# Method 1: Get advances created through Project Contractors system
		# These are stored in the employee_advances field (comma-separated list)
		try:
			project_contractor_doc = frappe.get_doc("Project Contractors", project_contractor)
			
			for fee_item in project_contractor_doc.fees_and_deposits:
				if fee_item.item == item_code and fee_item.employee_advances:
					# Parse the comma-separated list of Employee Advance names
					advance_names = [name.strip() for name in fee_item.employee_advances.split(',') if name.strip()]
					
					for advance_name in advance_names:
						try:
							advance_amount = frappe.get_cached_value("Employee Advance", advance_name, "advance_amount")
							if advance_amount:
								total_advanced += flt(advance_amount)
						except:
							# Skip if Employee Advance doesn't exist
							continue
		except:
			# Skip if Project Contractors document doesn't exist
			pass
		
		# Method 2: Get advances created through Project Advances system (our new system)
		employee_advances = frappe.get_all(
			"Employee Advance",
			filters={
				"project_contractors_reference": project_contractor,
				"item_reference": item_code,
				"docstatus": 1
			},
			fields=["advance_amount"]
		)
		
		for advance in employee_advances:
			total_advanced += flt(advance.advance_amount)
			
		return total_advanced
		
	def get_allocated_in_other_project_advances(self, item_code, project_contractor):
		"""Get amount allocated in other Project Advances for this item"""
		# Get all other project advances that include this project contractor (excluding current one)
		filters = {
			"docstatus": ["!=", 2]  # Not cancelled
		}
		
		if self.name:
			filters["name"] = ["!=", self.name]
			
		other_advances = frappe.get_all(
			"Project Advances",
			filters=filters,
			pluck="name"
		)
		
		if not other_advances:
			return 0
			
		# Get allocated amounts from advance items for this specific project contractor and item
		allocated_items = frappe.get_all(
			"Project Advance Items",
			filters={
				"parent": ["in", other_advances],
				"project_contractor": project_contractor,
				"item_code": item_code
			},
			fields=["allocated_amount"]
		)
		
		total_allocated = 0
		for item in allocated_items:
			total_allocated += flt(item.allocated_amount)
			
		return total_allocated
		
	def get_total_available_balance(self):
		"""Get total available balance across all fees and deposits"""
		available_data = self.get_available_fees_and_deposits()
		total_available = 0
		
		for item in available_data:
			total_available += flt(item['available_balance'])
			
		return total_available
		
	def update_available_fees_html(self, available_data):
		"""Update the HTML field showing available fees and deposits"""
		if not available_data:
			self.available_fees_html = '<div class="alert alert-warning">No available fees and deposits found for this project contractor.</div>'
			return
			
		html = '''
		<div class="available-fees-summary">
			<h5>Available Fees & Deposits</h5>
			<div class="table-responsive">
				<table class="table table-bordered table-sm">
					<thead>
						<tr>
							<th>Item</th>
							<th>Original Rate</th>
							<th>Claimed Amount</th>
							<th>Already Advanced</th>
							<th>Available Balance</th>
						</tr>
					</thead>
					<tbody>
		'''
		
		total_available = 0
		for item in available_data:
			total_available += flt(item['available_balance'])
			html += f'''
				<tr>
					<td>{item['item_name']}</td>
					<td class="text-right">{frappe.format(item['original_rate'], {'fieldtype': 'Currency'})}</td>
					<td class="text-right">{frappe.format(item['claimed_amount'], {'fieldtype': 'Currency'})}</td>
					<td class="text-right">{frappe.format(item['advanced_amount'], {'fieldtype': 'Currency'})}</td>
					<td class="text-right"><strong>{frappe.format(item['available_balance'], {'fieldtype': 'Currency'})}</strong></td>
				</tr>
			'''
			
		html += f'''
					</tbody>
					<tfoot>
						<tr class="table-active">
							<th colspan="4">Total Available</th>
							<th class="text-right">{frappe.format(total_available, {'fieldtype': 'Currency'})}</th>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
		'''
		
		self.available_fees_html = html
		

				
	def create_employee_advances(self):
		"""Create Employee Advances based on contractor allocations"""
		if not self.project_contractors:
			frappe.throw("No project contractors found to create Employee Advances")
			
		if not self.custodian_employee:
			frappe.throw("Please set Custodian Employee")
			
		created_advances = []
		
		for contractor in self.project_contractors:
			if not contractor.allocated_amount or flt(contractor.allocated_amount) <= 0:
				continue
				
			# Get available items for this contractor
			available_items = self.get_available_items_for_contractor(contractor.project_contractor)
			
			if not available_items:
				frappe.msgprint(f"No available items found for {contractor.project_contractor}")
				continue
			
			# Calculate total available balance for proportional distribution
			total_available = sum(flt(item['available_balance']) for item in available_items)
			
			if total_available <= 0:
				frappe.msgprint(f"No available balance for {contractor.project_contractor}")
				continue
			
			# Create Employee Advances proportionally for each available item
			allocated_amount = flt(contractor.allocated_amount)
			
			for item in available_items:
				if flt(item['available_balance']) <= 0:
					continue
					
				# Calculate proportional amount for this item
				proportion = flt(item['available_balance']) / total_available
				item_advance_amount = allocated_amount * proportion
				
				# Don't exceed available balance
				item_advance_amount = min(item_advance_amount, flt(item['available_balance']))
				
				if item_advance_amount <= 0:
					continue
				
				try:
					# Create Employee Advance
					employee_advance = frappe.new_doc("Employee Advance")
					employee_advance.employee = self.custodian_employee
					employee_advance.purpose = f"Project Advance for {item['item_name']} - {contractor.project_contractor}"
					employee_advance.advance_amount = item_advance_amount
					employee_advance.posting_date = self.date
					employee_advance.company = self.company
					
					# Set custom fields for tracking
					if frappe.get_meta("Employee Advance").has_field("custom_project_advance_reference"):
						employee_advance.custom_project_advance_reference = self.name
						
					if frappe.get_meta("Employee Advance").has_field("project_contractors_reference"):
						employee_advance.project_contractors_reference = contractor.project_contractor
						
					if frappe.get_meta("Employee Advance").has_field("item_reference"):
						employee_advance.item_reference = item['item_code']
						
					# Get default advance account
					advance_account = self.get_default_advance_account()
					if advance_account:
						employee_advance.advance_account = advance_account
						
					# Save and submit
					employee_advance.insert()
					employee_advance.submit()
					
					created_advances.append(employee_advance.name)
					
				except Exception as e:
					frappe.log_error(f"Error creating Employee Advance for item {item['item_code']}: {str(e)}")
					frappe.throw(f"Failed to create Employee Advance for {item['item_code']}: {str(e)}")
		
		# Update remaining balance
		self.remaining_balance = flt(self.advance_amount) - flt(self.total_distributed)
		self.db_set('remaining_balance', self.remaining_balance, update_modified=False)
		
		if created_advances:
			frappe.msgprint(
				f"Created {len(created_advances)} Employee Advances: " + ", ".join(created_advances),
				title="Employee Advances Created",
				indicator="green"
			)
	
	def get_available_items_for_contractor(self, project_contractor):
		"""Get available items for a specific contractor"""
		# Get the project contractor document
		project_contractor_doc = frappe.get_doc("Project Contractors", project_contractor)
		
		available_items = []
		
		# Process fees and deposits items for this contractor
		for fee_item in project_contractor_doc.fees_and_deposits:
			# Get claimed amount from Project Claims for this specific contractor and item
			claimed_amount = self.get_claimed_amount_for_item(fee_item.item, project_contractor)
			
			# Get already advanced amount from existing Employee Advances
			advanced_amount = self.get_advanced_amount_for_item(fee_item.item, project_contractor)
			
			# Calculate available balance
			# For items with no claims yet, use the original rate as available balance
			if claimed_amount <= 0:
				available_balance = flt(fee_item.rate) - advanced_amount
			else:
				available_balance = claimed_amount - advanced_amount
			
			if available_balance > 0:
				# Get item name from Item master
				item_name = frappe.get_cached_value("Item", fee_item.item, "item_name") or fee_item.item
				
				available_items.append({
					'item_code': fee_item.item,
					'item_name': item_name,
					'original_rate': fee_item.rate,
					'claimed_amount': claimed_amount,
					'advanced_amount': advanced_amount,
					'available_balance': available_balance
				})
				
		return available_items
		
	def cancel_employee_advances(self):
		"""Cancel related Employee Advances when Project Advance is cancelled"""
		for item in self.advance_items:
			if item.employee_advance_reference:
				try:
					employee_advance = frappe.get_doc("Employee Advance", item.employee_advance_reference)
					if employee_advance.docstatus == 1:
						employee_advance.cancel()
						
					# Update the advance item
					item.employee_advance_created = 0
					
				except Exception as e:
					frappe.log_error(f"Error cancelling Employee Advance {item.employee_advance_reference}: {str(e)}")
					
	def get_default_advance_account(self):
		"""Get default advance account for the company"""
		if not self.company:
			return None
			
		# Try to get from company defaults
		default_account = frappe.get_cached_value('Company', self.company, 'default_employee_advance_account')
		
		if not default_account:
			# Try to find an account with "Employee Advance" in the name
			accounts = frappe.get_all(
				"Account",
				filters={
					"company": self.company,
					"account_type": "Payable",
					"is_group": 0,
					"name": ["like", "%Employee Advance%"]
				},
				limit=1,
				pluck="name"
			)
			
			if accounts:
				default_account = accounts[0]
				
		return default_account
		
	@frappe.whitelist()
	def refresh_available_balances(self):
		"""Refresh available balances and update HTML display"""
		self.load_available_fees_and_deposits()
		return self.available_fees_html
		



@frappe.whitelist()
def get_project_contractor_summary(project_contractor):
	"""Get summary of available balances for a project contractor"""
	if not project_contractor:
		return {}
		
	# Create a temporary Project Advances document to use its methods
	temp_doc = frappe.new_doc("Project Advances")
	
	# Add the project contractor to the project_contractors table
	temp_doc.append("project_contractors", {
		"project_contractor": project_contractor
	})
	
	available_data = temp_doc.get_available_fees_and_deposits()
	total_available = sum(flt(item['available_balance']) for item in available_data)
	
	return {
		"available_items": available_data,
		"total_available": total_available,
		"item_count": len(available_data)
	}


@frappe.whitelist()
def validate_advance_amount(project_contractor, advance_amount):
	"""Validate if advance amount is within available balance"""
	if not project_contractor or not advance_amount:
		return {"valid": False, "message": "Missing required parameters"}
		
	# Create a temporary Project Advances document to use its methods
	temp_doc = frappe.new_doc("Project Advances")
	
	# Add the project contractor to the project_contractors table
	temp_doc.append("project_contractors", {
		"project_contractor": project_contractor
	})
	
	total_available = temp_doc.get_total_available_balance()
	advance_amount = flt(advance_amount)
	
	if advance_amount > total_available:
		return {
			"valid": False,
			"message": f"Advance amount {frappe.format(advance_amount, {'fieldtype': 'Currency'})} exceeds available balance {frappe.format(total_available, {'fieldtype': 'Currency'})}"
		}
		
	return {"valid": True, "available_balance": total_available}


# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt, cstr
import json


class ProjectAdvances(Document):
	def validate(self):
		self.validate_project_claim_references()
		self.validate_advance_amount()
		self.calculate_totals()
		self.update_status()
		
	def before_save(self):
		if self.project_contractors:
			# Auto-populate project claim references for contractors if not set
			self.auto_populate_project_claim_references()
			self.load_available_fees_and_deposits()
	
	def on_load(self):
		"""Load available fees and deposits when document is loaded"""
		if self.project_contractors:
			self.load_available_fees_and_deposits()
			
	def on_submit(self):
		"""Create Employee Advances when document is submitted"""
		self.create_employee_advances()
		self.update_status()
		
	def before_cancel(self):
		"""Handle operations before cancelling the document"""
		# Clear project contractor links from child table before cancellation to prevent circular reference
		if self.project_contractors:
			for contractor_row in self.project_contractors:
				frappe.db.set_value("Project Advance Contractors", contractor_row.name, "project_contractor", None)

	def on_cancel(self):
		"""Cancel related Employee Advances when document is cancelled"""
		self.cancel_employee_advances()
		self.update_status()
		
	def on_trash(self):
		"""Handle document deletion by clearing related links"""
		# Clear project contractor links from child table before deletion to prevent circular reference
		if self.project_contractors:
			for contractor_row in self.project_contractors:
				frappe.db.set_value("Project Advance Contractors", contractor_row.name, "project_contractor", None)
		
		# Clear references in Employee Advances before deletion
		employee_advances = frappe.get_all(
			"Employee Advance",
			filters={"custom_project_advance_reference": self.name},
			fields=["name"]
		)
		
		for advance in employee_advances:
			# Clear the link to this Project Advances document
			frappe.db.set_value("Employee Advance", advance.name, "custom_project_advance_reference", None)
		
		# Commit the changes
		frappe.db.commit()

	def after_delete(self):
		"""Handle operations after document deletion"""
		# Any cleanup operations after successful deletion
		pass
	
	def auto_populate_project_claim_references(self):
		"""Auto-populate project claim references for each contractor in the child table"""
		if not self.project_contractors:
			return
			
		for contractor_row in self.project_contractors:
			if contractor_row.project_contractor and not contractor_row.project_claim_reference:
				# Find Project Claims for this specific contractor
				matching_claims = self.find_project_claims_with_available_items([contractor_row.project_contractor])
				
				if len(matching_claims) == 1:
					# Perfect match - auto-populate
					contractor_row.project_claim_reference = matching_claims[0]['claim_name']
					frappe.logger().info(
						f"Auto-populated Project Claim Reference for {contractor_row.project_contractor}: "
						f"{matching_claims[0]['claim_name']}"
					)
				elif len(matching_claims) > 1:
					frappe.logger().warning(
						f"Multiple Project Claims found for {contractor_row.project_contractor}. "
						f"Manual selection required."
					)
				else:
					frappe.logger().warning(
						f"No Project Claims found for {contractor_row.project_contractor}"
					)
	
	def find_project_claims_with_available_items(self, contractor_list):
		"""Find Project Claims that have available (claimable) items for specified contractors"""
		if not contractor_list:
			return []
			
		# Get all submitted Project Claims
		submitted_claims = frappe.get_all(
			"Project Claim",
			filters={"docstatus": 1},
			pluck="name"
		)
		
		if not submitted_claims:
			return []
			
		matching_claims = []
		
		for claim_name in submitted_claims:
			# Check if this claim has available items for any of the selected contractors
			available_items_count = 0
			
			for contractor in contractor_list:
				# Get the contractor document to check its items
				try:
					contractor_doc = frappe.get_doc("Project Contractors", contractor)
					
					for fee_item in contractor_doc.fees_and_deposits:
						# Check if this item has been claimed in this specific claim
						claimed_amount = self.get_claimed_amount_for_item_in_claim(
							fee_item.item, contractor, claim_name
						)
						
						# Get already advanced amount
						advanced_amount = self.get_advanced_amount_for_item(fee_item.item, contractor)
						
						# Calculate available balance for this specific claim
						if claimed_amount > 0:
							available_balance = claimed_amount - advanced_amount
							if available_balance > 0:
								available_items_count += 1
								
				except Exception as e:
					frappe.logger().error(f"Error checking contractor {contractor}: {str(e)}")
					continue
			
			if available_items_count > 0:
				matching_claims.append({
					'claim_name': claim_name,
					'item_count': available_items_count
				})
				
		return matching_claims
	
	def get_claimed_amount_for_item_in_claim(self, item_code, project_contractor, claim_name):
		"""Get claimed amount for a specific item in a specific claim"""
		try:
			# Validate that claim_name exists and is a valid Project Claim
			if not frappe.db.exists("Project Claim", claim_name):
				frappe.logger().warning(f"Project Claim {claim_name} does not exist")
				return 0
				
			# Get claim items for this specific claim, item, and contractor
			claim_items = frappe.get_all(
				"Claim Items",
				filters={
					"item": item_code,
					"project_contractor_reference": project_contractor,
					"parent": claim_name,
					"parenttype": "Project Claim"
				},
				fields=["amount"]
			)
			
			total_claimed = 0
			for claim_item in claim_items:
				total_claimed += flt(claim_item.amount)
				
			return total_claimed
		except Exception as e:
			frappe.logger().error(f"Error getting claimed amount for item {item_code} in claim {claim_name}: {str(e)}")
			return 0

	def validate_project_claim_references(self):
		"""Validate that each contractor has a valid Project Claim reference with available items"""
		if not self.project_contractors:
			return
			
		for contractor_row in self.project_contractors:
			if not contractor_row.project_claim_reference:
				frappe.throw(f"Project Claim Reference is required for contractor {contractor_row.project_contractor}")
				
			# Check if Project Claim exists and is submitted
			try:
				# Validate that the reference is actually a Project Claim ID, not something else
				if not frappe.db.exists("Project Claim", contractor_row.project_claim_reference):
					frappe.throw(f"Project Claim {contractor_row.project_claim_reference} does not exist")
					
				project_claim = frappe.get_doc("Project Claim", contractor_row.project_claim_reference)
				if project_claim.docstatus != 1:
					frappe.throw(f"Project Claim {contractor_row.project_claim_reference} must be submitted before creating Project Advance")
			except frappe.DoesNotExistError:
				frappe.throw(f"Project Claim {contractor_row.project_claim_reference} does not exist")
			except Exception as e:
				frappe.logger().error(f"Error validating Project Claim {contractor_row.project_claim_reference}: {str(e)}")
				frappe.throw(f"Invalid Project Claim reference: {contractor_row.project_claim_reference}")
				
			# Validate that this contractor has available items in this specific claim
			contractor_name = contractor_row.project_contractor
			has_available_items = False
			
			try:
				contractor_doc = frappe.get_doc("Project Contractors", contractor_name)
				
				for fee_item in contractor_doc.fees_and_deposits:
					# Check if this item has available balance in the selected claim
					claimed_amount = self.get_claimed_amount_for_item_in_claim(
						fee_item.item, contractor_name, contractor_row.project_claim_reference
					)
					advanced_amount = self.get_advanced_amount_for_item(fee_item.item, contractor_name)
					
					if claimed_amount > 0 and (claimed_amount - advanced_amount) > 0:
						has_available_items = True
						break
						
			except Exception as e:
				frappe.logger().error(f"Error validating contractor {contractor_name}: {str(e)}")
				
			if not has_available_items:
				frappe.throw(
					f"Project Contractor {contractor_name} has no available items in "
					f"Project Claim {contractor_row.project_claim_reference}.<br><br>"
					f"This could mean:<br>"
					f"• This contractor is not part of this claim<br>"
					f"• All items have already been fully advanced<br>"
					f"• The claim amounts are zero for this contractor"
				)
		
	def get_contractors_from_project_claim(self, project_claim_name):
		"""Get list of project contractors related to a project claim"""
		# Get claim items and their project contractor references
		claim_items = frappe.get_all(
			"Claim Items",
			filters={
				"parent": project_claim_name,
				"parenttype": "Project Claim"
			},
			fields=["project_contractor_reference"]
		)
		
		contractors = set()
		for item in claim_items:
			if item.project_contractor_reference:
				contractors.add(item.project_contractor_reference)
		
		return list(contractors)
		
	def validate_advance_amount(self):
		"""Validate that advance amount and allocations are correct"""
		if not self.advance_amount:
			frappe.throw("Advance Amount is required")
			
		if not self.project_contractors:
			return
			
		# Calculate total allocated amount from contractors
		total_allocated = 0
		for contractor in self.project_contractors:
			if contractor.allocated_amount:
				total_allocated += flt(contractor.allocated_amount)
		
		# CRITICAL VALIDATION: Total allocated cannot exceed advance amount
		if total_allocated > flt(self.advance_amount):
			frappe.throw(
				f"<b>Invalid Allocation!</b><br>"
				f"Total Allocated Amount: {frappe.format(total_allocated, {'fieldtype': 'Currency'})}<br>"
				f"Advance Amount: {frappe.format(self.advance_amount, {'fieldtype': 'Currency'})}<br>"
				f"<b>You cannot allocate more than the advance amount!</b><br>"
				f"Please reduce the allocated amounts or increase the advance amount."
			)
		
		# Validate each contractor's allocation doesn't exceed their available balance
		for contractor in self.project_contractors:
			if contractor.allocated_amount and contractor.total_available_balance:
				if flt(contractor.allocated_amount) > flt(contractor.total_available_balance):
					frappe.throw(
						f"<b>Insufficient Balance for {contractor.project_contractor}!</b><br>"
						f"Allocated Amount: {frappe.format(contractor.allocated_amount, {'fieldtype': 'Currency'})}<br>"
						f"Available Balance: {frappe.format(contractor.total_available_balance, {'fieldtype': 'Currency'})}<br>"
						f"Please reduce the allocated amount for this contractor."
					)
		
		# Validate that advance amount doesn't exceed total available balance across all contractors
		total_available_balance = 0
		for contractor in self.project_contractors:
			if contractor.total_available_balance:
				total_available_balance += flt(contractor.total_available_balance)
		
		if flt(self.advance_amount) > total_available_balance:
			frappe.msgprint(
				f"<b>Warning:</b> Advance amount {frappe.format(self.advance_amount, {'fieldtype': 'Currency'})} "
				f"exceeds total available balance {frappe.format(total_available_balance, {'fieldtype': 'Currency'})} "
				f"across all selected contractors.",
				title="High Advance Amount",
				indicator="orange"
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
			frappe.logger().info("No project contractors found")
			return []
			
		available_items = []
		
		# Process each selected project contractor
		for contractor_row in self.project_contractors:
			project_contractor_name = contractor_row.project_contractor
			
			if not project_contractor_name:
				frappe.logger().info(f"Empty project contractor in row")
				continue
				
			frappe.logger().info(f"Processing contractor: {project_contractor_name}")
			
			try:
				# Get the project contractor document
				project_contractor_doc = frappe.get_doc("Project Contractors", project_contractor_name)
				frappe.logger().info(f"Found contractor doc with {len(project_contractor_doc.fees_and_deposits)} fees and deposits items")
				
				# Process fees and deposits items for this contractor
				for fee_item in project_contractor_doc.fees_and_deposits:
					frappe.logger().info(f"Processing item: {fee_item.item}")
					
					# Get claimed amount from the specific Project Claim for this contractor
					if contractor_row.project_claim_reference:
						# Use the specific claim reference from the child table
						claimed_amount = self.get_claimed_amount_for_item_in_claim(
							fee_item.item, project_contractor_name, contractor_row.project_claim_reference
						)
					else:
						# Fallback to general search if no specific claim reference
						claimed_amount = self.get_claimed_amount_for_item(fee_item.item, project_contractor_name)
					
					frappe.logger().info(f"Claimed amount for {fee_item.item}: {claimed_amount}")
					
					# Get already advanced amount from existing Employee Advances
					advanced_amount = self.get_advanced_amount_for_item(fee_item.item, project_contractor_name)
					frappe.logger().info(f"Advanced amount for {fee_item.item}: {advanced_amount}")
					
					# Calculate available balance
					# Only use claimed amounts (no fallback to original rate)
					available_balance = claimed_amount - advanced_amount
					
					frappe.logger().info(f"Available balance for {fee_item.item}: {available_balance}")
					
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
							'available_balance': available_balance
						})
						
						frappe.logger().info(f"Added item {fee_item.item} to available items")
					else:
						frappe.logger().info(f"Skipped item {fee_item.item} - no available balance")
			
			except Exception as e:
				frappe.logger().error(f"Error processing contractor {project_contractor_name}: {str(e)}")
				continue
					
		frappe.logger().info(f"Total available items found: {len(available_items)}")
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
		"""Update the HTML field showing available balances summary"""
		frappe.logger().info(f"Updating HTML with {len(available_data) if available_data else 0} items")
		
		if not available_data:
			# Provide more detailed information about why no data was found
			debug_info = []
			for contractor_row in self.project_contractors:
				project_contractor_name = contractor_row.project_contractor
				claim_ref = contractor_row.project_claim_reference or "Not Set"
				debug_info.append(f"• {project_contractor_name} (Claim: {claim_ref})")
			
			debug_html = "<br>".join(debug_info)
			self.available_fees_html = f'''
				<div class="alert alert-warning">
					<strong>No available balances found for the selected contractors.</strong><br><br>
					<strong>Selected Contractors:</strong><br>
					{debug_html}<br><br>
					<em>Note: Make sure the Project Claims are submitted and have available balances.</em>
				</div>
			'''
			frappe.logger().info("Set HTML to warning message - no available data")
			return
		
		# Group data by contractor for summary view
		contractor_summary = {}
		for item in available_data:
			contractor = item['project_contractor']
			if contractor not in contractor_summary:
				contractor_summary[contractor] = {
					'project_name': item['project_name'],
					'total_claimed': 0,
					'total_advanced': 0,
					'total_available': 0,
					'item_count': 0
				}
			
			contractor_summary[contractor]['total_claimed'] += flt(item['claimed_amount'])
			contractor_summary[contractor]['total_advanced'] += flt(item['advanced_amount'])
			contractor_summary[contractor]['total_available'] += flt(item['available_balance'])
			contractor_summary[contractor]['item_count'] += 1
			
		html = '''
		<div class="available-balances-summary">
			<h5>Available Balances Summary</h5>
			<div class="table-responsive">
				<table class="table table-bordered table-sm">
					<thead>
						<tr>
							<th>Project Contractor</th>
							<th>Project Name</th>
							<th>Items</th>
							<th>Total Claimed</th>
							<th>Already Advanced</th>
							<th>Available Balance</th>
						</tr>
					</thead>
					<tbody>
		'''
		
		total_available_all = 0
		total_claimed_all = 0
		total_advanced_all = 0
		
		for contractor, summary in contractor_summary.items():
			total_available_all += summary['total_available']
			total_claimed_all += summary['total_claimed']
			total_advanced_all += summary['total_advanced']
			
			html += f'''
				<tr>
					<td><strong>{contractor}</strong></td>
					<td>{summary['project_name']}</td>
					<td class="text-center">{summary['item_count']}</td>
					<td class="text-right">{frappe.format(summary['total_claimed'], {'fieldtype': 'Currency'})}</td>
					<td class="text-right">{frappe.format(summary['total_advanced'], {'fieldtype': 'Currency'})}</td>
					<td class="text-right"><strong style="color: #28a745;">{frappe.format(summary['total_available'], {'fieldtype': 'Currency'})}</strong></td>
				</tr>
			'''
			
		html += f'''
					</tbody>
					<tfoot>
						<tr class="table-success">
							<th colspan="3">Total Available for Advance</th>
							<th class="text-right">{frappe.format(total_claimed_all, {'fieldtype': 'Currency'})}</th>
							<th class="text-right">{frappe.format(total_advanced_all, {'fieldtype': 'Currency'})}</th>
							<th class="text-right"><strong style="color: #28a745; font-size: 1.1em;">{frappe.format(total_available_all, {'fieldtype': 'Currency'})}</strong></th>
						</tr>
					</tfoot>
				</table>
			</div>
			<div class="mt-2">
				<small class="text-muted">
					<i class="fa fa-info-circle"></i> 
					This shows the total available balance per contractor that can be advanced. 
					Your advance amount and allocations should not exceed these available balances.
				</small>
			</div>
		</div>
		'''
		
		self.available_fees_html = html
		frappe.logger().info(f"Generated HTML with length: {len(html)}")
		frappe.logger().info(f"Total available amount: {total_available_all}")
		

				
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
					
					# Set exchange rate to avoid validation error
					# For same currency transactions, exchange rate should be 1.0
					company_currency = frappe.get_cached_value("Company", self.company, "default_currency")
					employee_advance.currency = company_currency
					employee_advance.exchange_rate = 1.0
					
					# Set custom fields for tracking
					if frappe.get_meta("Employee Advance").has_field("custom_project_advance_reference"):
						employee_advance.custom_project_advance_reference = self.name
						
					if frappe.get_meta("Employee Advance").has_field("custom_project_claim_reference"):
						employee_advance.custom_project_claim_reference = contractor.project_claim_reference
						
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
		"""Get available items for a specific contractor using their specific project claim reference"""
		# Find the contractor row to get the project claim reference
		contractor_row = None
		for row in self.project_contractors:
			if row.project_contractor == project_contractor:
				contractor_row = row
				break
				
		if not contractor_row:
			return []
			
		# Get the project contractor document
		project_contractor_doc = frappe.get_doc("Project Contractors", project_contractor)
		
		available_items = []
		
		# Process fees and deposits items for this contractor
		for fee_item in project_contractor_doc.fees_and_deposits:
			# Get claimed amount from the specific Project Claim for this contractor
			if contractor_row.project_claim_reference:
				claimed_amount = self.get_claimed_amount_for_item_in_claim(
					fee_item.item, project_contractor, contractor_row.project_claim_reference
				)
			else:
				# Fallback to general search if no specific claim reference
				claimed_amount = self.get_claimed_amount_for_item(fee_item.item, project_contractor)
			
			# Get already advanced amount from existing Employee Advances
			advanced_amount = self.get_advanced_amount_for_item(fee_item.item, project_contractor)
			
			# Calculate available balance (only use claimed amounts)
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
		# Find Employee Advances created by this Project Advance
		employee_advances = frappe.get_all(
			"Employee Advance",
			filters={
				"custom_project_advance_reference": self.name,
				"docstatus": 1
			},
			pluck="name"
		)
		
		for advance_name in employee_advances:
			try:
				employee_advance = frappe.get_doc("Employee Advance", advance_name)
				if employee_advance.docstatus == 1:
					employee_advance.cancel()
			except Exception as e:
				frappe.log_error(f"Error cancelling Employee Advance {advance_name}: {str(e)}")
	
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
		try:
			frappe.logger().info(f"Refreshing available balances for Project Advances {self.name}")
			frappe.logger().info(f"Project contractors: {[c.project_contractor for c in self.project_contractors]}")
			
			# Debug: Check if we have project contractors
			if not self.project_contractors:
				return '<div class="alert alert-info">Please select project contractors first.</div>'
			
			# Auto-populate project claim references if missing
			self.auto_populate_project_claim_references()
			
			# Get available data directly
			available_data = self.get_available_fees_and_deposits()
			frappe.logger().info(f"Available data count: {len(available_data) if available_data else 0}")
			
			# Update HTML
			self.update_available_fees_html(available_data)
			
			frappe.logger().info(f"Available fees HTML length: {len(self.available_fees_html) if self.available_fees_html else 0}")
			
			# Return the HTML directly
			return self.available_fees_html
		except Exception as e:
			frappe.logger().error(f"Error in refresh_available_balances: {str(e)}")
			import traceback
			frappe.logger().error(traceback.format_exc())
			error_html = f'<div class="alert alert-danger">Error loading available balances: {str(e)}<br><small>{traceback.format_exc()}</small></div>'
			return error_html
		



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
def find_project_claims_for_contractors(contractor_list):
	"""Find Project Claims that have available items for specified contractors"""
	if not contractor_list:
		return []
		
	# Convert to list if it's a string (from JavaScript)
	if isinstance(contractor_list, str):
		import json
		contractor_list = json.loads(contractor_list)
		
	# Create a temporary Project Advances document to use its methods
	temp_doc = frappe.new_doc("Project Advances")
	
	# Get claims with available items
	matching_claims = temp_doc.find_project_claims_with_available_items(contractor_list)
	
	# Return just the claim names for JavaScript compatibility
	return [claim['claim_name'] for claim in matching_claims]

@frappe.whitelist()
def find_project_claims_for_contractor(project_contractor):
	"""Find Project Claims that have available items for a single contractor"""
	if not project_contractor:
		return []
		
	# Create a temporary Project Advances document to use its methods
	temp_doc = frappe.new_doc("Project Advances")
	
	# Get claims with available items for this single contractor
	matching_claims = temp_doc.find_project_claims_with_available_items([project_contractor])
	
	# Return just the claim names for JavaScript compatibility
	return [claim['claim_name'] for claim in matching_claims]

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


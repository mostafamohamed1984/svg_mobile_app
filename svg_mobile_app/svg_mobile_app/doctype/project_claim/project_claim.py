# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt


class ProjectClaim(Document):
	def validate(self):
		self.validate_claim_amount()
		self.validate_claim_items()
	
	def before_save(self):
		# Check if we have multiple invoices in the description
		if self.being and "Reference Invoices:" in self.being:
			self.process_multiple_invoice_references()
	
	def on_submit(self):
		# Get all involved invoices
		invoices = [self.reference_invoice]
		if self.invoice_references:
			additional_invoices = [inv.strip() for inv in self.invoice_references.split(',') if inv.strip()]
			invoices.extend(additional_invoices)
		
		# Track claim information for all referenced invoices
		self.update_invoice_claim_history(invoices)
		
		# Create journal entry instead of directly updating outstanding amounts
		self.create_journal_entry(invoices)
		
		# Update project-specific claim tracking if needed
		self.update_project_claim_tracking()
	
	def process_multiple_invoice_references(self):
		"""Process claims with multiple invoice references"""
		# Extract invoice references from being field
		import re
		pattern = r"Reference Invoices:\s*([\w\d\-, ]+)"
		matches = re.search(pattern, self.being)
		
		if not matches:
			return
			
		# Get the list of invoice references
		invoices_str = matches.group(1)
		invoice_list = [inv.strip() for inv in invoices_str.split(',') if inv.strip()]
		
		if not invoice_list or len(invoice_list) <= 1:
			return
			
		# Store in the invoice_references field
		self.invoice_references = invoices_str
	
	def update_invoice_claim_history(self, invoices=None):
		"""Update claim history for all referenced invoices"""
		if not invoices:
			# If no explicit list provided, try to get from references
			invoices = [self.reference_invoice] if self.reference_invoice else []
			
			if self.invoice_references:
				additional_invoices = [inv.strip() for inv in self.invoice_references.split(',') if inv.strip()]
				invoices.extend(additional_invoices)
		
		if not invoices:
			return
			
		# Update each invoice with a reference to this claim
		for invoice in invoices:
			if frappe.db.exists("Sales Invoice", invoice):
				# Check if we have a custom field for claim references
				if frappe.db.exists("Custom Field", {"dt": "Sales Invoice", "fieldname": "claim_references"}):
					# Get current references
					current_refs = frappe.db.get_value("Sales Invoice", invoice, "claim_references") or ""
					
					# Add this claim if not already included
					if self.name not in current_refs:
						if current_refs:
							new_refs = current_refs + ", " + self.name
						else:
							new_refs = self.name
							
						# Update the invoice
						frappe.db.set_value("Sales Invoice", invoice, "claim_references", new_refs)
	
	def update_project_claim_tracking(self):
		"""Update project-specific claim tracking"""
		projects = []
		
		# Get the main project
		if self.for_project:
			projects.append(self.for_project)
		
		# Get additional projects from project_references
		if self.project_references:
			additional_projects = [proj.strip() for proj in self.project_references.split(',') if proj.strip()]
			for proj in additional_projects:
				if proj not in projects:
					projects.append(proj)
		
		# If we have multiple projects, we need to determine how much of the claim goes to each
		if len(projects) > 1:
			# Try to parse the being field to get project-specific amounts
			import re
			
			# Create a map to track project claim amounts
			project_amounts = {}
			for proj in projects:
				project_amounts[proj] = 0
			
			# Check if we have an invoice to project mapping from the being field
			invoice_project_map = {}
			invoice_amounts = {}
			
			# Parse the being field to extract invoice, project, and amount information
			lines = self.being.split('\n')
			current_invoice = None
			
			for line in lines:
				# Check for invoice line
				invoice_match = re.search(r'- ([\w\d-]+) \((.*?), (.*?)(,|$)', line)
				if invoice_match:
					current_invoice = invoice_match.group(1)
					project_text = invoice_match.group(3).strip()
					if project_text != 'No Project':
						invoice_project_map[current_invoice] = project_text
			
				# Check for total claimed line
				if current_invoice and 'Total Claimed:' in line:
					amount_match = re.search(r'Total Claimed: ([0-9,.]+)', line)
					if amount_match:
						amount_text = amount_match.group(1).replace(',', '')
						try:
							invoice_amounts[current_invoice] = float(amount_text)
						except ValueError:
							pass  # Ignore if we can't parse the amount
			
			# Now distribute the claim amount to each project based on the invoices
			for invoice, amount in invoice_amounts.items():
				if invoice in invoice_project_map:
					project = invoice_project_map[invoice]
					if project in project_amounts:
						project_amounts[project] += amount
			
			# Update project-specific claim tracking if we have a custom field for it
			for project, amount in project_amounts.items():
				if amount > 0 and frappe.db.exists("Project Contractors", project):
					if frappe.db.exists("Custom Field", {"dt": "Project Contractors", "fieldname": "claim_references"}):
						current_refs = frappe.db.get_value("Project Contractors", project, "claim_references") or ""
						
						# Add this claim if not already included
						claim_ref = f"{self.name} ({frappe.format(amount, {'fieldtype': 'Currency'})}"
						if claim_ref not in current_refs:
							if current_refs:
								new_refs = current_refs + ", " + claim_ref
							else:
								new_refs = claim_ref
							
							# Update the project
							frappe.db.set_value("Project Contractors", project, "claim_references", new_refs)
		else:
			# Single project case - simpler
			project = projects[0] if projects else None
			if project and frappe.db.exists("Project Contractors", project):
				if frappe.db.exists("Custom Field", {"dt": "Project Contractors", "fieldname": "claim_references"}):
					current_refs = frappe.db.get_value("Project Contractors", project, "claim_references") or ""
					
					# Add this claim if not already included
					claim_ref = f"{self.name} ({frappe.format(self.claim_amount, {'fieldtype': 'Currency'})}"
					if claim_ref not in current_refs:
						if current_refs:
							new_refs = current_refs + ", " + claim_ref
						else:
							new_refs = claim_ref
						
						# Update the project
						frappe.db.set_value("Project Contractors", project, "claim_references", new_refs)
	
	def validate_claim_amount(self):
		"""Validate that claim amount does not exceed outstanding amount"""
		if flt(self.claim_amount) > flt(self.outstanding_amount):
			frappe.throw(f"Claim Amount ({self.claim_amount}) cannot exceed Outstanding Amount ({self.outstanding_amount})")
		
		# Ensure that outstanding_amount is properly set from claimable_amount if it exists
		if hasattr(self, 'claimable_amount') and self.claimable_amount and not self.outstanding_amount:
			self.outstanding_amount = self.claimable_amount
	
	def validate_claim_items(self):
		"""Validate claim items totals and balances"""
		if not self.claim_items:
			return
			
		total_amount = 0
		total_ratio = 0
		
		for item in self.claim_items:
			total_amount += flt(item.amount)
			total_ratio += flt(item.ratio)
			
			# Validate against current balance
			if flt(item.amount) > flt(item.current_balance):
				frappe.throw(f"Amount for {item.item} ({item.amount}) exceeds available balance ({item.current_balance})")
		
		# Allow small rounding difference (0.01)
		if flt(total_amount, 2) > flt(self.claim_amount, 2):
			frappe.throw(f"Total allocated amount ({total_amount}) exceeds claim amount ({self.claim_amount})")
			
		if flt(total_ratio, 2) > 100:
			frappe.throw(f"Total ratio ({total_ratio:.2f}%) exceeds 100%")
	
	@frappe.whitelist()
	def update_claim_items_balance(self):
		"""Update the current balance for each item in the claim items table"""
		if not self.reference_invoice:
			return
		
		# Check if we have multiple invoice references
		invoices = [self.reference_invoice]
		if self.invoice_references:
			additional_invoices = [inv.strip() for inv in self.invoice_references.split(',') if inv.strip()]
			invoices.extend(additional_invoices)
		
		frappe.logger().debug(f"Updating claim items balance for {self.name}, invoices: {invoices}")
		
		# Get all items from the referenced invoices
		items_data = frappe.db.sql("""
			SELECT 
				parent as invoice,
				item_code,
				amount
			FROM `tabSales Invoice Item`
			WHERE parent IN %s
		""", [tuple(invoices) if len(invoices) > 1 else tuple(invoices + [''])], as_dict=True)
		
		# Create a map of item totals across all invoices
		item_total_map = {}
		for item in items_data:
			if item.item_code not in item_total_map:
				item_total_map[item.item_code] = 0
			item_total_map[item.item_code] += flt(item.amount)
		
		# Get all claims that have been submitted for these items, except this one
		previous_claims = frappe.db.sql("""
			SELECT 
				ci.item, 
				SUM(ci.amount) as claimed_amount
			FROM 
				`tabClaim Items` ci
				JOIN `tabProject Claim` pc ON ci.parent = pc.name
			WHERE 
				(pc.reference_invoice IN %s OR pc.invoice_references LIKE %s)
				AND pc.docstatus = 1
				AND pc.name != %s
			GROUP BY 
				ci.item
		""", [
			tuple(invoices) if len(invoices) > 1 else tuple(invoices + ['']),
			'%' + '%'.join(invoices) + '%',
			self.name or ""
		], as_dict=True)
		
		# Create a map of claimed amounts
		claimed_map = {}
		for claim in previous_claims:
			claimed_map[claim.item] = flt(claim.claimed_amount)
		
		# Calculate available balance for each item in our claim
		for item in self.claim_items:
			# Get total original amount for this item across all referenced invoices
			total_original = item_total_map.get(item.item, 0)
			
			# Get total claimed amount for this item
			total_claimed = claimed_map.get(item.item, 0)
			
			# Calculate available balance
			available_balance = max(0, total_original - total_claimed)
			
			# Debug logs
			frappe.logger().debug(f"Item {item.item}: original={total_original}, claimed={total_claimed}, available={available_balance}")
			
			# Set the current balance to the available balance
			item.current_balance = available_balance
	
	def get_item_balance(self, item_code):
		"""Get the original amount and already claimed amount for an item"""
		# This is a placeholder - implement the actual logic to fetch the balance
		# based on your application's data structure
		
		# Query to get original amount from reference invoice
		original_amount = frappe.db.sql("""
			SELECT amount FROM `tabSales Invoice Item`
			WHERE parent = %s AND item_code = %s
		""", (self.reference_invoice, item_code), as_dict=True)
		
		original_amount = original_amount[0].amount if original_amount else 0
		
		# Query to get sum of already claimed amounts for this item
		claimed_amount = frappe.db.sql("""
			SELECT SUM(ci.amount) as claimed
			FROM `tabClaim Items` ci
			JOIN `tabProject Claim` pc ON ci.parent = pc.name
			WHERE pc.reference_invoice = %s
			AND ci.item = %s
			AND pc.docstatus = 1
			AND pc.name != %s
		""", (self.reference_invoice, item_code, self.name or ""), as_dict=True)
		
		claimed_amount = claimed_amount[0].claimed if claimed_amount and claimed_amount[0].claimed else 0
		
		return original_amount, claimed_amount

	def update_invoice_outstanding_amounts(self, invoices):
		"""Update outstanding amounts for all invoices based on claim amounts"""
		if not invoices or not self.claim_items:
			return
			
		# Parse the being field to extract invoice-specific claim amounts
		import re
		
		# Map to track claim amounts per invoice
		invoice_claim_amounts = {}
		
		# Initialize with zero
		for invoice in invoices:
			invoice_claim_amounts[invoice] = 0
		
		# Parse the being field to extract invoice-specific amounts
		if self.being:
			lines = self.being.split('\n')
			current_invoice = None
			
			for line in lines:
				# Check for invoice line pattern like "- ACC-SINV-2025-00024 (Unpaid, PRO-00020, Due: 2025-04-28)"
				invoice_match = re.search(r'- ([\w\d-]+)', line)
				if invoice_match:
					current_invoice = invoice_match.group(1).strip()
					frappe.logger().debug(f"Found invoice reference: {current_invoice}")
				
				# Check for total claimed line pattern like "Total Claimed: د.إ 70,000.00 of د.إ 70,000.00 claimable"
				if current_invoice and 'Total Claimed:' in line:
					amount_match = re.search(r'Total Claimed: [^0-9]*([0-9,.]+)', line)
					if amount_match:
						amount_text = amount_match.group(1).replace(',', '')
						try:
							claim_amount = float(amount_text)
							invoice_claim_amounts[current_invoice] = claim_amount
							frappe.logger().debug(f"Parsed claim amount for {current_invoice}: {claim_amount}")
						except (ValueError, KeyError) as e:
							frappe.logger().error(f"Error parsing claim amount for {current_invoice}: {e}")
							pass  # Ignore if we can't parse the amount
		
		# Log what we found from parsing
		frappe.logger().debug(f"Parsed claim amounts from being: {invoice_claim_amounts}")
		
		# If we couldn't parse the being field, try to extract from claim items by invoice
		if sum(invoice_claim_amounts.values()) == 0 and self.claim_items:
			# Get the item-invoice mapping by checking the "being" text for item details under each invoice
			item_invoice_map = {}
			current_invoice = None
			
			if self.being:
				lines = self.being.split('\n')
				for line in lines:
					invoice_match = re.search(r'- ([\w\d-]+)', line)
					if invoice_match:
						current_invoice = invoice_match.group(1).strip()
						continue
						
					# Look for item lines under an invoice like "• اتعاب مناقصة (اتعاب مناقصة): د.إ 30,000.00 (42.9%)"
					if current_invoice and '•' in line:
						item_match = re.search(r'•\s+(.*?)\s+\((.*?)\):', line)
						if item_match:
							item_name = item_match.group(1).strip()
							item_code = item_match.group(2).strip()
							
							# Find this item in claim_items
							for item in self.claim_items:
								if item.item == item_code:
									# Create mapping
									if item.item not in item_invoice_map:
										item_invoice_map[item.item] = {}
									
									# Find the amount for this item in this invoice from the being field
									amount_match = re.search(r':\s+[^0-9]*([0-9,.]+)', line)
									if amount_match:
										amount_text = amount_match.group(1).replace(',', '')
										try:
											item_amount = float(amount_text)
											item_invoice_map[item.item][current_invoice] = item_amount
											# Add to invoice total
											invoice_claim_amounts[current_invoice] += item_amount
										except ValueError:
											pass
			
			# If we still couldn't determine specific amounts, use the total claim amount and distribute evenly
			if sum(invoice_claim_amounts.values()) == 0 and len(invoices) > 0:
				even_share = flt(self.claim_amount) / len(invoices)
				for invoice in invoices:
					invoice_claim_amounts[invoice] = even_share
		
		# Ensure we're not trying to reduce any invoice by more than our total claim amount
		total_reductions = sum(invoice_claim_amounts.values())
		if total_reductions > flt(self.claim_amount):
			# Scale down proportionally
			scale_factor = flt(self.claim_amount) / total_reductions
			for invoice in invoice_claim_amounts:
				invoice_claim_amounts[invoice] *= scale_factor
				
		# IMPORTANT: Double-check the math is correct before proceeding
		frappe.logger().info(f"Final claim amounts: {invoice_claim_amounts}")
		frappe.logger().info(f"Total claim amounts: {sum(invoice_claim_amounts.values())}")
		frappe.logger().info(f"Document claim amount: {flt(self.claim_amount)}")
		
		# Update each invoice's outstanding amount
		for invoice, claim_amount in invoice_claim_amounts.items():
			if claim_amount > 0 and frappe.db.exists("Sales Invoice", invoice):
				# Get current outstanding amount
				current_outstanding = frappe.db.get_value("Sales Invoice", invoice, "outstanding_amount") or 0
				
				# CRITICAL FIX: Always subtract the claim amount, never add
				# Make sure the amount is treated as positive for reduction
				claim_reduction = abs(claim_amount)
				
				# Calculate new outstanding amount (ensure it doesn't go below zero)
				new_outstanding = max(0, current_outstanding - claim_reduction)
				
				# Verify the calculation before updating
				frappe.logger().info(f"Invoice {invoice}: {current_outstanding} - {claim_reduction} = {new_outstanding}")
				
				# Update the invoice only if the calculation is reasonable
				if new_outstanding <= current_outstanding:
					frappe.db.set_value("Sales Invoice", invoice, "outstanding_amount", new_outstanding)
					
					# Log the update
					frappe.logger().info(f"Updated invoice {invoice} outstanding amount: {current_outstanding} -> {new_outstanding} (claimed {claim_amount})")
					
					# Update the Sales Invoice's status if needed
					if new_outstanding == 0:
						frappe.db.set_value("Sales Invoice", invoice, "status", "Paid")
					elif new_outstanding < flt(frappe.db.get_value("Sales Invoice", invoice, "grand_total")):
						frappe.db.set_value("Sales Invoice", invoice, "status", "Partly Paid")
				else:
					# Something is wrong with the calculation, log an error
					frappe.logger().error(f"Invalid calculation for invoice {invoice}: {current_outstanding} -> {new_outstanding}")
					frappe.throw(f"Invalid outstanding amount calculation for invoice {invoice}. Please check the logs.")

	def get_items_from_invoices(self, invoices):
		"""Get items from multiple invoices for bulk claim creation"""
		if not invoices:
			return []
			
		# Convert string to list if needed
		if isinstance(invoices, str):
			import json
			try:
				invoices = json.loads(invoices)
			except:
				invoices = invoices.split(",")
				
		# Get items from all invoices
		items_data = frappe.db.sql("""
			SELECT 
				parent as invoice,
				item_code,
				item_name,
				amount,
				income_account,
				custom_default_earning_account
			FROM `tabSales Invoice Item`
			WHERE parent IN %s
		""", [tuple(invoices) if len(invoices) > 1 else tuple(invoices + [''])], as_dict=True)
		
		# Get invoice totals for ratio calculation
		invoice_totals = {}
		for item in items_data:
			if item.invoice not in invoice_totals:
				invoice_totals[item.invoice] = 0
			invoice_totals[item.invoice] += flt(item.amount)
		
		# Add ratio to each item
		for item in items_data:
			item.ratio = flt(item.amount) / flt(invoice_totals[item.invoice]) * 100 if invoice_totals[item.invoice] else 0
			
		return items_data
	
	def create_journal_entry(self, invoices):
		"""Create journal entry for the claim using the same logic as the client script"""
		if not self.party_account or not self.receiving_account:
			frappe.throw("Please set Party Account and Receiving Account first")
			return
			
		if not self.claim_items or len(self.claim_items) == 0:
			frappe.throw("Please add items to the Claim Items table first")
			return
			
		# Calculate amounts
		import datetime
		today = datetime.datetime.now().strftime("%Y-%m-%d")
		
		# Get company from the reference invoice since it's not in the Project Claim
		default_company = frappe.db.get_value("Sales Invoice", self.reference_invoice, "company") or frappe.defaults.get_user_default('company')
		
		claim_amount = flt(self.claim_amount)
		tax_amount = flt(self.tax_amount or 0)
		
		# Parse the being field to extract invoice-specific claim amounts
		import re
		
		# Map to track claim amounts per invoice
		invoice_claim_amounts = {}
		
		# Initialize with zero
		for invoice in invoices:
			invoice_claim_amounts[invoice] = 0
		
		# Parse the being field to extract invoice-specific amounts
		if self.being:
			lines = self.being.split('\n')
			current_invoice = None
			
			for line in lines:
				# Check for invoice line pattern
				invoice_match = re.search(r'- ([\w\d-]+)', line)
				if invoice_match:
					current_invoice = invoice_match.group(1).strip()
				
				# Check for total claimed line pattern
				if current_invoice and 'Total Claimed:' in line:
					amount_match = re.search(r'Total Claimed: [^0-9]*([0-9,.]+)', line)
					if amount_match:
						amount_text = amount_match.group(1).replace(',', '')
						try:
							claim_amount_per_invoice = float(amount_text)
							invoice_claim_amounts[current_invoice] = claim_amount_per_invoice
						except (ValueError, KeyError):
							pass  # Ignore if we can't parse the amount
		
		# If we couldn't parse amounts, distribute evenly
		if sum(invoice_claim_amounts.values()) == 0 and len(invoices) > 0:
			even_share = flt(claim_amount) / len(invoices)
			for invoice in invoices:
				invoice_claim_amounts[invoice] = even_share
		
		# Prepare accounts array
		accounts = []
		
		# Add entry for each invoice with their specific amount but WITHOUT reference to avoid double impact
		for invoice, invoice_amount in invoice_claim_amounts.items():
			if invoice_amount > 0 and frappe.db.exists("Sales Invoice", invoice):
				# Get customer from the invoice
				customer = frappe.db.get_value("Sales Invoice", invoice, "customer")
				
				# Credit customer account for this invoice's portion - but without referencing the invoice
				accounts.append({
					'account': self.party_account,
					'party_type': 'Customer',
					'party': customer or self.customer,
					'credit_in_account_currency': invoice_amount
					# Removed the reference to the Sales Invoice to avoid double impact
				})
		
		# Debit receiving account (full claim amount minus tax)
		accounts.append({
			'account': self.receiving_account,
			'debit_in_account_currency': claim_amount - tax_amount
		})
		
		# Add entries for each claim item
		for item in self.claim_items:
			item_ratio = flt(item.ratio) / 100
			item_amount = claim_amount * item_ratio
			
			# Debit unearned account
			if hasattr(item, 'unearned_account') and item.unearned_account:
				accounts.append({
					'account': item.unearned_account,
					'debit_in_account_currency': item_amount
				})
			
			# Credit revenue account
			if hasattr(item, 'revenue_account') and item.revenue_account:
				accounts.append({
					'account': item.revenue_account,
					'credit_in_account_currency': item_amount
				})
		
		# Add tax row if applicable
		if tax_amount > 0 and hasattr(self, 'tax_account') and self.tax_account:
			accounts.append({
				'account': self.tax_account,
				'debit_in_account_currency': tax_amount
			})
		
		# Verify the totals balance
		total_debit = sum(account.get('debit_in_account_currency', 0) for account in accounts)
		total_credit = sum(account.get('credit_in_account_currency', 0) for account in accounts)
		
		if abs(total_debit - total_credit) > 0.01:
			frappe.throw(f"Journal Entry is not balanced. Debit: {total_debit}, Credit: {total_credit}")
			return
		
		# Create the journal entry
		je = frappe.new_doc("Journal Entry")
		je.voucher_type = "Journal Entry"
		je.posting_date = today
		je.company = default_company
		je.user_remark = f"for Project Claim {self.name} Being {self.being}"
		
		for entry in accounts:
			je.append("accounts", entry)
		
		je.multi_currency = 0
		je.total_debit = total_debit
		je.total_credit = total_credit
		
		je.insert()
		je.submit()
		
		# Update claim status to Reconciled
		self.db_set("status", "Reconciled")
		
		frappe.msgprint(f"Journal Entry {je.name} created and Project Claim marked as Reconciled")
		
		# Now manually update the invoice outstanding amounts
		self.update_invoice_outstanding_amounts(invoices)
		
		return je.name

# Add a static method to be called from JavaScript
@frappe.whitelist()
def get_items_from_invoices(invoices):
	"""Static method to get items from multiple invoices for bulk claim creation"""
	if not invoices:
		return []
		
	# Convert string to list if needed
	if isinstance(invoices, str):
		import json
		try:
			invoices = json.loads(invoices)
		except:
			invoices = invoices.split(",")
			
	# Get items from all invoices
	items_data = frappe.db.sql("""
		SELECT 
			parent as invoice,
			item_code,
			item_name,
			amount,
			income_account,
			custom_default_earning_account
		FROM `tabSales Invoice Item`
		WHERE parent IN %s
	""", [tuple(invoices) if len(invoices) > 1 else tuple(invoices + [''])], as_dict=True)
	
	# Get invoice totals for ratio calculation
	invoice_totals = {}
	for item in items_data:
		if item.invoice not in invoice_totals:
			invoice_totals[item.invoice] = 0
		invoice_totals[item.invoice] += flt(item.amount)
	
	# Add ratio to each item
	for item in items_data:
		item.ratio = flt(item.amount) / flt(invoice_totals[item.invoice]) * 100 if invoice_totals[item.invoice] else 0
		
	return items_data

@frappe.whitelist()
def get_available_invoice_balances(invoices):
	"""Get available balance for items in multiple invoices"""
	if not invoices:
		return {}
		
	# Convert string to list if needed
	if isinstance(invoices, str):
		import json
		try:
			invoices = json.loads(invoices)
		except:
			invoices = invoices.split(",")
			
	frappe.logger().debug(f"Getting balances for invoices: {invoices}")
	
	# Process invoices in chunks of 50 to avoid query limits
	result = {}
	chunk_size = 50
	for i in range(0, len(invoices), chunk_size):
		invoice_chunk = invoices[i:i+chunk_size]
		chunk_result = _get_invoice_balances_for_chunk(invoice_chunk)
		# Merge the chunk results into the main result
		for invoice in chunk_result:
			result[invoice] = chunk_result[invoice]
	
	return result

def _get_invoice_balances_for_chunk(invoices):
	"""Process a chunk of invoices to get their balances"""
	# Get all items from these invoices
	items_data = frappe.db.sql("""
		SELECT 
			parent as invoice,
			item_code,
			amount
		FROM `tabSales Invoice Item`
		WHERE parent IN %s
	""", [tuple(invoices) if len(invoices) > 1 else tuple(invoices + [''])], as_dict=True)
	
	# Group items by invoice
	result = {}
	invoice_items = {}
	
	# First, initialize the result structure and group items by invoice
	for item in items_data:
		invoice = item.invoice
		item_code = item.item_code
		amount = flt(item.amount)
		
		if invoice not in result:
			result[invoice] = {}
		
		if invoice not in invoice_items:
			invoice_items[invoice] = []
			
		invoice_items[invoice].append(item)
		
		# Initialize the item data in the result
		if item_code not in result[invoice]:
			result[invoice][item_code] = {
				'original_amount': amount,
				'claimed_amount': 0,
				'available_balance': amount,
				'item_proportion': 0
			}
	
	# MODIFIED: Get claims for all invoices, checking both reference_invoice AND invoice_references
	# First get all claims where the invoice is the main reference
	primary_claims_sql = """
		SELECT 
			pc.reference_invoice as invoice,
			ci.item, 
			SUM(ci.amount) as claimed_amount
		FROM 
			`tabClaim Items` ci
			JOIN `tabProject Claim` pc ON ci.parent = pc.name
		WHERE 
			pc.docstatus = 1
			AND pc.reference_invoice IN %s
		GROUP BY 
			pc.reference_invoice, ci.item
	"""
	
	# Then get claims where the invoice is in invoice_references
	secondary_claims_sql = """
		SELECT 
			inv.invoice as invoice,
			ci.item, 
			SUM(CASE
				WHEN pc.claimable_amount > 0 THEN ci.amount * (inv.claim_amount / pc.claimable_amount)
				ELSE 0
			END) as claimed_amount
		FROM 
			`tabClaim Items` ci
			JOIN `tabProject Claim` pc ON ci.parent = pc.name
			JOIN (
				SELECT 
					pc.name,
					trim(regexp_substr(replace(concat(', ', pc.invoice_references, ', '), ' ', ''), ',[^,]+,', 1, level)) as invoice,
					pc.being,
					CASE
						WHEN pc.being LIKE %s THEN 
							CAST(regexp_substr(
								regexp_substr(pc.being, concat('- ', trim(regexp_substr(replace(concat(', ', pc.invoice_references, ', '), ' ', ''), ',[^,]+,', 1, level)), '.*Total Claimed: ([0-9,.]+)')), 
								'([0-9,.]+)') 
							AS DECIMAL(18,2))
						ELSE pc.claim_amount / (LENGTH(pc.invoice_references) - LENGTH(REPLACE(pc.invoice_references, ',', '')) + 1)
					END as claim_amount
				FROM 
					`tabProject Claim` pc
				JOIN
					(SELECT @rownum := 0) r
				JOIN
					(SELECT @rownum := @rownum + 1 AS level FROM information_schema.columns LIMIT 100) levels
				WHERE 
					pc.docstatus = 1
					AND pc.invoice_references IS NOT NULL
					AND pc.invoice_references != ''
					AND trim(regexp_substr(replace(concat(', ', pc.invoice_references, ', '), ' ', ''), ',[^,]+,', 1, level)) IN %s
			) inv ON inv.name = pc.name
		GROUP BY 
			inv.invoice, ci.item
	"""
	
	try:
		# Get primary claims (where invoice is the main reference)
		primary_claims = frappe.db.sql(primary_claims_sql, [
			tuple(invoices) if len(invoices) > 1 else tuple(invoices + [''])
		], as_dict=True)
		
		# Get secondary claims (where invoice is in invoice_references)
		secondary_claims = frappe.db.sql(secondary_claims_sql, [
			'%Total Claimed:%',  # Pattern for the being field
			tuple(invoices) if len(invoices) > 1 else tuple(invoices + [''])
		], as_dict=True)
		
		# Combine both sets of claims
		all_claims = primary_claims + secondary_claims
		
	except Exception as e:
		frappe.logger().error(f"Error in complex claim query: {e}")
		# Fallback to simpler query that only checks reference_invoice
		fallback_sql = """
			SELECT 
				pc.reference_invoice as invoice,
				ci.item, 
				SUM(ci.amount) as claimed_amount
			FROM 
				`tabClaim Items` ci
				JOIN `tabProject Claim` pc ON ci.parent = pc.name
			WHERE 
				pc.docstatus = 1
				AND (
					pc.reference_invoice IN %s
					OR pc.invoice_references LIKE %s
				)
			GROUP BY 
				pc.reference_invoice, ci.item
		"""
		all_claims = frappe.db.sql(fallback_sql, [
			tuple(invoices) if len(invoices) > 1 else tuple(invoices + ['']),
			'%' + '%'.join([inv.replace("'", "''") for inv in invoices]) + '%'
		], as_dict=True)
	
	# Process claims by invoice and item
	for claim in all_claims:
		invoice = claim.invoice
		item = claim.item
		claimed_amount = flt(claim.claimed_amount)
		
		# Skip if we don't have this invoice or item in our results
		if invoice not in result or item not in result[invoice]:
			continue
		
		# Update claimed amount and available balance directly
		result[invoice][item]['claimed_amount'] += claimed_amount
		result[invoice][item]['available_balance'] = max(0, 
			result[invoice][item]['original_amount'] - result[invoice][item]['claimed_amount'])
	
	# Calculate proportion for each item within its invoice
	for invoice, items in invoice_items.items():
		invoice_total = 0
		for item in items:
			invoice_total += flt(item.amount)
		
		# Now calculate proportion
		for item in items:
			item_code = item.item_code
			if item_code in result[invoice]:
				result[invoice][item_code]['item_proportion'] = (
					flt(item.amount) / invoice_total if invoice_total > 0 else 0
				)
	
	# Reconcile with actual outstanding amounts
	for invoice in invoices:
		if not invoice or invoice not in result:
			continue
			
		# Get the actual outstanding amount from the invoice
		actual_outstanding = flt(frappe.db.get_value("Sales Invoice", invoice, "outstanding_amount") or 0)
		
		# Calculate the total available balance from items
		total_available = 0
		for item_code in result[invoice]:
			total_available += flt(result[invoice][item_code]['available_balance'])
			
		# Log for debugging
		frappe.logger().debug(f"Invoice {invoice}: Outstanding={actual_outstanding}, Available={total_available}")
		
		# If there's a discrepancy (outstanding > 0 but available = 0)
		if actual_outstanding > 0 and total_available < 0.01:
			frappe.logger().info(f"Reconciling invoice {invoice}: outstanding={actual_outstanding}, available={total_available}")
			
			# Distribute the outstanding amount proportionally to items based on original amounts
			total_original = 0
			for item_code in result[invoice]:
				total_original += flt(result[invoice][item_code]['original_amount'])
				
			if total_original > 0:
				for item_code in result[invoice]:
					item_proportion = flt(result[invoice][item_code]['original_amount']) / total_original
					result[invoice][item_code]['available_balance'] = actual_outstanding * item_proportion
					frappe.logger().info(f"Redistributed to {item_code}: {result[invoice][item_code]['available_balance']}")
		
		# If there's a discrepancy in the other direction (available > outstanding), cap availability
		elif actual_outstanding < total_available and actual_outstanding > 0:
			frappe.logger().info(f"Capping invoice {invoice}: outstanding={actual_outstanding}, available={total_available}")
			
			# Scale down proportionally
			scale_factor = actual_outstanding / total_available
			for item_code in result[invoice]:
				result[invoice][item_code]['available_balance'] *= scale_factor
				frappe.logger().info(f"Scaled {item_code} by {scale_factor}: new available={result[invoice][item_code]['available_balance']}")
	
	return result

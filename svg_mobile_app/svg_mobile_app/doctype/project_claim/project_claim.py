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
		
		# Get available balances for all invoices (this includes data from invoice_references)
		all_balances = get_available_invoice_balances(invoices)
		
		# Add debug logs
		frappe.logger().debug(f"Updating balance for claim: {self.name}, invoices: {invoices}")
		frappe.logger().debug(f"Current claim items: {[{
			'item': item.item, 
			'amount': item.amount,
			'current_balance': item.current_balance
		} for item in self.claim_items]}")
		
		# For debugging, log the available balances from each invoice
		for inv in invoices:
			if inv in all_balances:
				for item_code, data in all_balances[inv].items():
					frappe.logger().debug(f"Available balance from {inv} for {item_code}: {data['available_balance']}")
		
		for item in self.claim_items:
			# For each claim item, find the available balance across all invoices
			total_available_balance = 0
			
			# Only sum available balances for invoices that contain this item
			for invoice in invoices:
				if invoice in all_balances and item.item in all_balances[invoice]:
					# Found the item in this invoice - add its available balance
					balance_data = all_balances[invoice][item.item]
					
					# For current document items, don't count them as claimed yet if not submitted
					if self.docstatus < 1:
						# Get the claimed amount in this document for this item
						current_doc_claim = frappe.db.sql("""
							SELECT SUM(amount) as amount 
							FROM `tabClaim Items` 
							WHERE parent=%s AND item=%s
						""", (self.name, item.item), as_dict=True)
						
						# If there's a claim amount for this item in the current document,
						# add it back to the available balance since we don't want to count
						# our own claims as reducing the available balance
						if current_doc_claim and current_doc_claim[0].amount:
							available_balance = balance_data['available_balance'] + flt(current_doc_claim[0].amount)
						else:
							available_balance = balance_data['available_balance']
					else:
						available_balance = balance_data['available_balance']
					
					total_available_balance += flt(available_balance)
			
			# Set the current balance to the total available balance
			item.current_balance = total_available_balance
			frappe.logger().debug(f"Updated current_balance for {item.item} to {item.current_balance}")
		
		# Log final result
		frappe.logger().debug(f"Updated claim items: {[{
			'item': item.item, 
			'amount': item.amount,
			'current_balance': item.current_balance
		} for item in self.claim_items]}")
	
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
			
	# Debug log
	frappe.logger().debug(f"Getting balances for invoices: {invoices}")
	
	# Get invoice outstanding amounts
	invoice_outstanding = {}
	for invoice in invoices:
		outstanding = frappe.db.get_value("Sales Invoice", invoice, "outstanding_amount")
		invoice_outstanding[invoice] = float(outstanding) if outstanding is not None else 0
		frappe.logger().debug(f"Invoice {invoice} outstanding: {invoice_outstanding[invoice]}")
	
	# Get all items from these invoices
	items_data = frappe.db.sql("""
		SELECT 
			parent as invoice,
			item_code,
			amount
		FROM `tabSales Invoice Item`
		WHERE parent IN %s
	""", [tuple(invoices) if len(invoices) > 1 else tuple(invoices + [''])], as_dict=True)
	
	# Get all previous claims for these invoices - look at both reference_invoice and invoice_references
	previous_claims = frappe.db.sql("""
		SELECT 
			pc.reference_invoice, 
			ci.item, 
			SUM(ci.amount) as claimed_amount
		FROM 
			`tabClaim Items` ci
			JOIN `tabProject Claim` pc ON ci.parent = pc.name
		WHERE 
			pc.reference_invoice IN %s
			AND pc.docstatus = 1
		GROUP BY 
			pc.reference_invoice, ci.item
	""", [tuple(invoices) if len(invoices) > 1 else tuple(invoices + [''])], as_dict=True)
	
	# Also get claims from invoice_references
	additional_claims = frappe.db.sql("""
		SELECT 
			ci.item, 
			SUM(ci.amount) as claimed_amount
		FROM 
			`tabClaim Items` ci
			JOIN `tabProject Claim` pc ON ci.parent = pc.name
		WHERE 
			pc.invoice_references IS NOT NULL
			AND pc.docstatus = 1
			AND (
				{invoice_conditions}
			)
		GROUP BY 
			ci.item
	""".format(
		invoice_conditions = " OR ".join([f"pc.invoice_references LIKE '%{inv}%'" for inv in invoices])
	), as_dict=True)
	
	# Create a map for easier lookup
	claim_map = {}
	for claim in previous_claims:
		if claim.reference_invoice not in claim_map:
			claim_map[claim.reference_invoice] = {}
		claim_map[claim.reference_invoice][claim.item] = flt(claim.claimed_amount)
	
	# Add additional claims from invoice_references to each invoice that contains the item
	for add_claim in additional_claims:
		item_code = add_claim.item
		claimed_amount = flt(add_claim.claimed_amount)
		
		# Find all invoices that contain this item
		for item in items_data:
			if item.item_code == item_code:
				inv = item.invoice
				if inv not in claim_map:
					claim_map[inv] = {}
				if item_code not in claim_map[inv]:
					claim_map[inv][item_code] = 0
				# Add proportional claimed amount
				claim_map[inv][item_code] += claimed_amount
	
	# Calculate available balances
	result = {}
	
	# First group items by invoice and calculate total original amounts
	invoice_items = {}
	invoice_total_original = {}
	invoice_total_claimed = {}
	
	for item in items_data:
		inv = item.invoice
		if inv not in invoice_items:
			invoice_items[inv] = []
			invoice_total_original[inv] = 0
			invoice_total_claimed[inv] = 0
		
		invoice_items[inv].append(item)
		invoice_total_original[inv] += flt(item.amount)
		
		# Add up total claimed for this invoice
		claimed = 0
		if inv in claim_map and item.item_code in claim_map[inv]:
			claimed = flt(claim_map[inv][item.item_code])
		invoice_total_claimed[inv] += claimed
	
	# Debug log total claimed vs outstanding
	for inv in invoice_items:
		outstanding = invoice_outstanding.get(inv, 0)
		original = invoice_total_original.get(inv, 0)
		claimed = invoice_total_claimed.get(inv, 0)
		frappe.logger().debug(f"Invoice {inv}: original={original}, claimed={claimed}, outstanding={outstanding}")
	
	# Now calculate available balances for each item
	for inv, items in invoice_items.items():
		if inv not in result:
			result[inv] = {}
		
		outstanding = invoice_outstanding.get(inv, 0)
		original_total = invoice_total_original.get(inv, 0)
		
		# Skip if no original amount
		if original_total <= 0:
			continue
		
		for item in items:
			original_amount = flt(item.amount)
			
			# Get claimed amount for this specific item
			claimed = 0
			if inv in claim_map and item.item_code in claim_map[inv]:
				claimed = flt(claim_map[inv][item.item_code])
			
			# Calculate item's proportion of the invoice
			item_proportion = original_amount / original_total if original_total > 0 else 0
			
			# Calculate available amount based on outstanding and item's proportion
			# The available balance should not exceed the original amount minus claimed
			available_by_ratio = item_proportion * outstanding
			available_by_claimed = original_amount - claimed
			
			# The available balance is the minimum of:
			# 1. Available by proportion of outstanding
			# 2. Original amount minus claimed amount
			available_balance = min(available_by_ratio, available_by_claimed)
			available_balance = max(0, available_balance)
			
			result[inv][item.item_code] = {
				'original_amount': original_amount,
				'claimed_amount': claimed,
				'available_balance': available_balance,
				'available_proportion': outstanding / original_total if original_total > 0 else 0,
				'item_proportion': item_proportion
			}
			
			frappe.logger().debug(f"Item {item.item_code}: original={original_amount}, claimed={claimed}, " +
				f"avail_by_ratio={available_by_ratio}, avail_by_claimed={available_by_claimed}, final={available_balance}")
	
	return result

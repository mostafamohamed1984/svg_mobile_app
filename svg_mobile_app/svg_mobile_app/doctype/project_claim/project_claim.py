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
		
		# Update invoice outstanding amounts
		self.update_invoice_outstanding_amounts(invoices)
		
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
		
		# Also validate against claimable amount if available
		if hasattr(self, 'claimable_amount') and self.claimable_amount and flt(self.claim_amount) > flt(self.claimable_amount):
			frappe.throw(f"Claim Amount ({self.claim_amount}) cannot exceed Claimable Amount ({self.claimable_amount})")
	
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
				# Check for invoice line
				invoice_match = re.search(r'- ([\w\d-]+)', line)
				if invoice_match:
					current_invoice = invoice_match.group(1)
				
				# Check for total claimed line
				if current_invoice and 'Total Claimed:' in line:
					amount_match = re.search(r'Total Claimed: ([0-9,.]+)', line)
					if amount_match:
						amount_text = amount_match.group(1).replace(',', '')
						try:
							invoice_claim_amounts[current_invoice] = float(amount_text)
						except ValueError:
							pass  # Ignore if we can't parse the amount
		
		# If we couldn't parse the being field, try to distribute the claim amount evenly
		if sum(invoice_claim_amounts.values()) == 0 and len(invoices) > 0:
			for invoice in invoices:
				invoice_claim_amounts[invoice] = self.claim_amount / len(invoices)
		
		# Update each invoice's outstanding amount
		for invoice, claim_amount in invoice_claim_amounts.items():
			if claim_amount > 0 and frappe.db.exists("Sales Invoice", invoice):
				# Get current outstanding amount
				current_outstanding = frappe.db.get_value("Sales Invoice", invoice, "outstanding_amount") or 0
				
				# Calculate new outstanding amount (ensure it doesn't go below zero)
				new_outstanding = max(0, current_outstanding - claim_amount)
				
				# Update the invoice
				frappe.db.set_value("Sales Invoice", invoice, "outstanding_amount", new_outstanding)
				
				# Log the update
				frappe.logger().info(f"Updated invoice {invoice} outstanding amount: {current_outstanding} -> {new_outstanding} (claimed {claim_amount})")

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
			
	frappe.logger().debug(f"Getting balances for invoices: {invoices}")
	
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
	
	# Get only claims specifically against these invoices
	# Modified to track by invoice-item pair
	previous_claims_sql = """
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
		
		UNION ALL
		
		SELECT 
			TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(ir.invoice_part, ',', n.n), ',', -1)) as invoice,
			ci.item,
			SUM(ci.amount * pc.item_invoice_ratio) as claimed_amount
		FROM 
			`tabClaim Items` ci
			JOIN `tabProject Claim` pc ON ci.parent = pc.name
			JOIN (
				SELECT 
					pc.name,
					pc.invoice_references,
					CONCAT(pc.reference_invoice, ',', pc.invoice_references) as invoice_part,
					(LENGTH(CONCAT(pc.reference_invoice, ',', pc.invoice_references)) - LENGTH(REPLACE(CONCAT(pc.reference_invoice, ',', pc.invoice_references), ',', '')) + 1) as parts
				FROM `tabProject Claim` pc
				WHERE pc.docstatus = 1
				AND pc.invoice_references IS NOT NULL
				AND pc.invoice_references != ''
			) ir ON ir.name = pc.name
			JOIN (
				SELECT a.N + b.N * 10 + 1 as n
				FROM 
					(SELECT 0 as N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) a,
					(SELECT 0 as N UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9) b
				ORDER BY n
			) n ON n.n <= ir.parts
		WHERE 
			TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(ir.invoice_part, ',', n.n), ',', -1)) IN %s
		GROUP BY 
			TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(ir.invoice_part, ',', n.n), ',', -1)), ci.item
	"""
	
	# If we get syntax errors, fall back to a simpler query that might be less accurate
	try:
		previous_claims = frappe.db.sql(previous_claims_sql, [
			tuple(invoices) if len(invoices) > 1 else tuple(invoices + ['']),
			tuple(invoices) if len(invoices) > 1 else tuple(invoices + [''])
		], as_dict=True)
	except Exception as e:
		frappe.logger().error(f"Error in complex claim query: {e}")
		# Fallback to simpler query
		previous_claims_sql = """
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
		previous_claims = frappe.db.sql(previous_claims_sql, [
			tuple(invoices) if len(invoices) > 1 else tuple(invoices + ['']),
			'%' + '%'.join([inv.replace("'", "''") for inv in invoices]) + '%'
		], as_dict=True)
	
	# Process claims by invoice and item
	for claim in previous_claims:
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
	
	return result

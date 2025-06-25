# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt


class OrbitClaim(Document):
	def validate(self):
		self.validate_claim_amount()
		self.validate_claim_items()
	
	def before_save(self):
		# Set receiver based on current user if not already set
		if not self.receiver:
			self.set_receiver_from_user()
		
		# Check if we have multiple invoices in the description
		if self.being and "Reference Invoices:" in self.being:
			self.process_multiple_invoice_references()
			
		# Ensure all claim items have an invoice_reference
		if self.claim_items:
			for item in self.claim_items:
				if not getattr(item, 'invoice_reference', None):
					item.invoice_reference = self.reference_invoice
	
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
			
			# Create a map to track orbit claim amounts
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
		# Skip financial validation for Orbit Claim as it's view-only
		# Just ensure outstanding_amount is properly set from claimable_amount if it exists
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
			
			# Skip balance validation for Orbit Claim as it's view-only
			# No need to validate against current balance
		
		# Allow small rounding difference (0.01) - only validate total consistency
		if flt(total_amount, 2) > flt(self.claim_amount, 2):
			frappe.throw(f"Total allocated amount ({total_amount}) exceeds claim amount ({self.claim_amount})")
			
		# Skip ratio validation for Orbit Claim as it's view-only
		# if flt(total_ratio, 2) > 100:
		# 	frappe.throw(f"Total ratio ({total_ratio:.2f}%) exceeds 100%")
	
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
		
		# Create a map of item totals by invoice and item
		item_invoice_map = {}
		for item in items_data:
			invoice = item.invoice
			item_code = item.item_code
			if invoice not in item_invoice_map:
				item_invoice_map[invoice] = {}
			item_invoice_map[invoice][item_code] = flt(item.amount)
		
		# Also create a global map for totals across all invoices
		item_total_map = {}
		for item in items_data:
			if item.item_code not in item_total_map:
				item_total_map[item.item_code] = 0
			item_total_map[item.item_code] += flt(item.amount)
		
		# For Orbit Claim (view-only), don't consider previous claims
		# Always set current balance to the original amount since we don't affect financial data
		for item in self.claim_items:
			invoice_ref = getattr(item, 'invoice_reference', None)
			item_code = item.item
			
			if invoice_ref and invoice_ref in item_invoice_map and item_code in item_invoice_map[invoice_ref]:
				# Use the original amount from the specific invoice
				original_amount = item_invoice_map[invoice_ref][item_code]
				item.current_balance = original_amount
				frappe.logger().debug(f"Item {item_code} in invoice {invoice_ref}: original={original_amount}, available={original_amount} (view-only)")
			else:
				# Use the total amount across all invoices
				original_amount = item_total_map.get(item_code, 0)
				item.current_balance = original_amount
				frappe.logger().debug(f"Item {item_code} (global): original={original_amount}, available={original_amount} (view-only)")
			
		return {"status": "success"}
	
	def set_receiver_from_user(self):
		"""Set the receiver field based on the current user's visual identity"""
		# Get current user
		current_user = frappe.session.user
		
		# Check if there's a visual identity for this user with identity_for = "Receiver"
		visual_identity = frappe.db.get_value(
			"visual Identity", 
			{"user": current_user, "identity_for": "Receiver"},
			"name"
		)
		
		if visual_identity:
			self.receiver = visual_identity
		else:
			# Use default value if no visual identity found for the current user
			self.receiver = self.get_default_receiver()
	
	def get_default_receiver(self):
		"""Get the default receiver value"""
		# Check if "Mahmoud Said" exists as a visual identity
		default_identity = frappe.db.get_value(
			"visual Identity",
			{"name1": "Mahmoud Said", "identity_for": "Receiver"},
			"name"
		)
		
		if not default_identity:
			# Create a default visual identity if it doesn't exist
			default_doc = frappe.new_doc("visual Identity")
			default_doc.name1 = "Mahmoud Said"
			default_doc.identity_for = "Receiver"
			default_doc.type = "Text"
			default_doc.text = "Mahmoud Said"
			default_doc.insert(ignore_permissions=True)
			default_identity = default_doc.name
		
		return default_identity
	
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
			JOIN `tabOrbit Claim` pc ON ci.parent = pc.name
			WHERE pc.reference_invoice = %s
			AND ci.item = %s
			AND pc.docstatus = 1
			AND pc.name != %s
		""", (self.reference_invoice, item_code, self.name or ""), as_dict=True)
		
		claimed_amount = claimed_amount[0].claimed if claimed_amount and claimed_amount[0].claimed else 0
		
		return original_amount, claimed_amount

	# Removed update_invoice_outstanding_amounts method - Orbit Claim is view-only and should not affect financial data

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



@frappe.whitelist()
def get_items_from_invoices(invoices):
	"""Get items from multiple invoices with their totals and ratios"""
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
	
	# Get all items from these invoices including tax information
	items_data = frappe.db.sql("""
		SELECT 
			sii.parent as invoice,
			sii.item_code,
			sii.amount,
			COALESCE(
				(SELECT rate FROM `tabSales Taxes and Charges` 
				 WHERE parent = sii.parent AND account_head LIKE '%%VAT%%' 
				 ORDER BY idx LIMIT 1), 0
			) as tax_rate
		FROM `tabSales Invoice Item` sii
		WHERE sii.parent IN %s
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
				'item_proportion': 0,
				'tax_rate': flt(item.tax_rate or 0)
			}
	
	# For Orbit Claim (view-only), we don't track previous claims
	# Always show full original amounts as available since Orbit Claim doesn't affect financial data
	# No need to query previous Orbit Claims or reduce available balances
	
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

@frappe.whitelist()
def get_project_contractors_with_outstanding_invoices(doctype, txt, searchfield, start, page_len, filters):
	"""Get project contractors that have outstanding invoices for the specified customer"""
	customer = filters.get('customer')
	if not customer:
		return []
	
	# Get project contractors with outstanding invoices for this customer
	project_contractors = frappe.db.sql("""
		SELECT DISTINCT 
			pc.name,
			pc.project_name,
			pc.customer_name,
			COUNT(si.name) as invoice_count,
			SUM(si.outstanding_amount) as total_outstanding
		FROM 
			`tabProject Contractors` pc
			JOIN `tabSales Invoice` si ON si.custom_for_project = pc.name
		WHERE 
			si.customer = %s
			AND si.docstatus = 1
			AND si.status IN ('Partly Paid', 'Unpaid', 'Overdue')
			AND si.outstanding_amount > 0
			AND (pc.name LIKE %s OR pc.project_name LIKE %s OR pc.customer_name LIKE %s)
		GROUP BY 
			pc.name, pc.project_name, pc.customer_name
		ORDER BY 
			total_outstanding DESC
		LIMIT %s OFFSET %s
	""", [
		customer,
		f"%{txt}%", f"%{txt}%", f"%{txt}%",
		page_len, start
	], as_dict=True)
	
	# Format the results for the link field
	result = []
	for pc in project_contractors:
		description = f"{pc.project_name} - {frappe.format(pc.total_outstanding, {'fieldtype': 'Currency'})} outstanding ({pc.invoice_count} invoices)"
		result.append([pc.name, description])
	
	return result

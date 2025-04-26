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
		# Update any custom fields to track claim history for all invoices referenced
		if self.being and "Reference Invoices:" in self.being:
			self.update_invoice_claim_history()
	
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
	
	def update_invoice_claim_history(self):
		"""Update claim history for all referenced invoices"""
		# First check the invoice_references field
		invoice_list = []
		
		if self.invoice_references:
			invoice_list = [inv.strip() for inv in self.invoice_references.split(',') if inv.strip()]
		
		# If no references in the field, try extracting from being
		if not invoice_list and self.being and "Reference Invoices:" in self.being:
			import re
			pattern = r"Reference Invoices:\s*([\w\d\-, ]+)"
			matches = re.search(pattern, self.being)
			
			if matches:
				invoices_str = matches.group(1)
				invoice_list = [inv.strip() for inv in invoices_str.split(',') if inv.strip()]
		
		if not invoice_list:
			return
			
		# Update each invoice with a reference to this claim
		for invoice in invoice_list:
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
			
		for item in self.claim_items:
			# Get the original amount and any previously claimed amounts for this item
			original_amount, claimed_amount = self.get_item_balance(item.item)
			
			# Set the current balance
			item.current_balance = flt(original_amount) - flt(claimed_amount)
	
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
	
	# Get all items from these invoices
	items_data = frappe.db.sql("""
		SELECT 
			parent as invoice,
			item_code,
			amount
		FROM `tabSales Invoice Item`
		WHERE parent IN %s
	""", [tuple(invoices) if len(invoices) > 1 else tuple(invoices + [''])], as_dict=True)
	
	# Get all previous claims for these invoices
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
	
	# Create a map for easier lookup
	claim_map = {}
	for claim in previous_claims:
		if claim.reference_invoice not in claim_map:
			claim_map[claim.reference_invoice] = {}
		claim_map[claim.reference_invoice][claim.item] = claim.claimed_amount
	
	# Calculate available balances
	result = {}
	for item in items_data:
		if item.invoice not in result:
			result[item.invoice] = {}
		
		claimed = 0
		if item.invoice in claim_map and item.item_code in claim_map[item.invoice]:
			claimed = flt(claim_map[item.invoice][item.item_code])
		
		result[item.invoice][item.item_code] = {
			'original_amount': item.amount,
			'claimed_amount': claimed,
			'available_balance': item.amount - claimed
		}
	
	return result

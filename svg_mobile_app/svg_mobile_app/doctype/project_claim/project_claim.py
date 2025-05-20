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
		
		# Get all claims that have been submitted for these items, except this one
		previous_claims = frappe.db.sql("""
			SELECT 
				ci.invoice_reference as invoice,
				ci.item, 
				SUM(ci.amount) as claimed_amount
			FROM 
				`tabClaim Items` ci
				JOIN `tabProject Claim` pc ON ci.parent = pc.name
			WHERE 
				ci.invoice_reference IN %s
				AND pc.docstatus = 1
				AND pc.name != %s
			GROUP BY 
				ci.invoice_reference, ci.item
		""", [
			tuple(invoices) if len(invoices) > 1 else tuple(invoices + ['']),
			self.name or ""
		], as_dict=True)
		
		# Create a map of claimed amounts by invoice and item
		claimed_map = {}
		for claim in previous_claims:
			invoice = claim.invoice
			item_code = claim.item
			if invoice not in claimed_map:
				claimed_map[invoice] = {}
			claimed_map[invoice][item_code] = flt(claim.claimed_amount)
		
		# Calculate available balance for each item in our claim
		for item in self.claim_items:
			invoice_ref = getattr(item, 'invoice_reference', None)
			item_code = item.item
			
			if invoice_ref and invoice_ref in item_invoice_map and item_code in item_invoice_map[invoice_ref]:
				# We have a specific invoice reference, calculate based on that
				original_amount = item_invoice_map[invoice_ref][item_code]
				claimed_amount = claimed_map.get(invoice_ref, {}).get(item_code, 0)
				available_balance = max(0, original_amount - claimed_amount)
				frappe.logger().debug(f"Item {item_code} in invoice {invoice_ref}: original={original_amount}, claimed={claimed_amount}, available={available_balance}")
			else:
				# No specific invoice reference, calculate across all invoices
				original_amount = item_total_map.get(item_code, 0)
				claimed_amount = sum(inv_map.get(item_code, 0) for inv_map in claimed_map.values())
				available_balance = max(0, original_amount - claimed_amount)
				frappe.logger().debug(f"Item {item_code} (global): original={original_amount}, claimed={claimed_amount}, available={available_balance}")
			
			# Set the current balance
			item.current_balance = available_balance
			
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
	
	def on_submit(self):
		# Get all involved invoices
		invoices = [self.reference_invoice]
		if self.invoice_references:
			additional_invoices = [inv.strip() for inv in self.invoice_references.split(',') if inv.strip()]
			invoices.extend(additional_invoices)
		
		# Track claim information for all referenced invoices
		self.update_invoice_claim_history(invoices)
		
		# Create journal entry instecreate_journal_entryad of directly updating outstanding amounts
		je_name = self.create_journal_entry(invoices)
		
		# Update invoice outstanding amounts after journal entry creation
		if je_name:
			self.update_invoice_outstanding_amounts(invoices)
		
		# Update project-specific claim tracking if needed
		self.update_project_claim_tracking()
		
		# Generate and attach PDF on submission using the existing print format
		try:
			import os
			from frappe.utils.pdf import get_pdf
			from frappe.utils import random_string
			
			# Generate a unique RV- prefixed name
			rv_docname = self.name.replace('PC-', 'RV-')
			filename = f"{rv_docname}.pdf"
			
			# Get HTML content for the print format
			html = frappe.get_print(
				doctype="Project Claim",
				name=self.name,
				print_format="Project Receipt Voucher",
				doc=self
			)
			
			# Convert to PDF
			pdf_data = get_pdf(html)
			
			# Save as attachment to the document
			_file = frappe.get_doc({
				"doctype": "File",
				"file_name": filename,
				"folder": "Home/Attachments",
				"is_private": 1,
				"content": pdf_data,
				"attached_to_doctype": "Project Claim",
				"attached_to_name": self.name
			})
			_file.insert(ignore_permissions=True)
			
			frappe.msgprint(f"Receipt voucher PDF generated and attached to the document.", indicator="green")
		except Exception as e:
			frappe.log_error(f"Error generating receipt PDF for {self.name}: {str(e)}", "PDF Generation Error")
	
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
		
		# Calculate how much to claim from each invoice
		# First try to extract from the "being" field
		if self.being:
			lines = self.being.split('\n')
			current_invoice = None
			
			for line in lines:
				# Check for invoice line pattern like "- ACC-SINV-2025-00024"
				invoice_match = re.search(r'- ([\w\d-]+)', line)
				if invoice_match:
					current_invoice = invoice_match.group(1).strip()
					frappe.logger().debug(f"Found invoice reference: {current_invoice}")
				
				# Check for total claimed line pattern like "Total Claimed: 70,000.00"
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
		
		# If we couldn't parse from being field, try directly from claim items
		if sum(invoice_claim_amounts.values()) == 0 and hasattr(self, 'claim_items') and self.claim_items:
			for item in self.claim_items:
				if hasattr(item, 'invoice_reference') and item.invoice_reference:
					inv = item.invoice_reference
					if inv in invoices:
						invoice_claim_amounts[inv] = invoice_claim_amounts.get(inv, 0) + flt(item.amount)
						frappe.logger().debug(f"Added amount {item.amount} from item {item.item} to invoice {inv}")
		
		# If we still couldn't determine amounts, distribute evenly
		if sum(invoice_claim_amounts.values()) == 0 and len(invoices) > 0:
			even_share = flt(self.claim_amount) / len(invoices)
			for invoice in invoices:
				invoice_claim_amounts[invoice] = even_share
				frappe.logger().debug(f"Distributed even share {even_share} to invoice {invoice}")
		
		# Calculate tax amounts for each invoice
		invoice_tax_amounts = {}
		for invoice, claim_amount in invoice_claim_amounts.items():
			# Calculate tax for this invoice based on its items
			tax_amount = 0
			for item in self.claim_items:
				if hasattr(item, 'invoice_reference') and item.invoice_reference == invoice:
					tax_amount += flt(item.tax_amount or 0)
			
			# If we couldn't get tax from items, calculate based on document tax_ratio
			if tax_amount == 0 and self.tax_ratio:
				tax_amount = flt(claim_amount) * flt(self.tax_ratio) / 100
			
			invoice_tax_amounts[invoice] = tax_amount
			frappe.logger().debug(f"Calculated tax amount for invoice {invoice}: {tax_amount}")
		
		# Log what we determined for each invoice
		frappe.logger().info(f"Final claim amounts per invoice: {invoice_claim_amounts}")
		frappe.logger().info(f"Final tax amounts per invoice: {invoice_tax_amounts}")
		frappe.logger().info(f"Total determined: {sum(invoice_claim_amounts.values())}, Claim amount: {self.claim_amount}")
		
		# Update each invoice's outstanding amount
		for invoice, claim_amount in invoice_claim_amounts.items():
			if claim_amount > 0 and frappe.db.exists("Sales Invoice", invoice):
				# Get current outstanding amount
				current_outstanding = frappe.db.get_value("Sales Invoice", invoice, "outstanding_amount") or 0
				
				# Get tax amount for this invoice
				tax_amount = invoice_tax_amounts.get(invoice, 0)
				
				# Make sure we're reducing by a positive amount (including tax)
				claim_reduction = abs(claim_amount) + abs(tax_amount)
				
				# Calculate new outstanding amount (ensure it doesn't go below zero)
				new_outstanding = max(0, flt(current_outstanding) - flt(claim_reduction))
				
				frappe.logger().info(f"Invoice {invoice}: Current outstanding={current_outstanding}, Claim={claim_amount}, Tax={tax_amount}, Total reduction={claim_reduction}, New outstanding={new_outstanding}")
				
				# Update the invoice
				frappe.db.set_value("Sales Invoice", invoice, "outstanding_amount", new_outstanding)
				
				# Update status based on new outstanding amount
				grand_total = frappe.db.get_value("Sales Invoice", invoice, "grand_total") or 0
				if flt(new_outstanding) <= 0:
					frappe.db.set_value("Sales Invoice", invoice, "status", "Paid")
					frappe.logger().info(f"Invoice {invoice} marked as Paid")
				elif flt(new_outstanding) < flt(grand_total):
					frappe.db.set_value("Sales Invoice", invoice, "status", "Partly Paid")
					frappe.logger().info(f"Invoice {invoice} marked as Partly Paid")

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
		
		# Calculate base claim amount and tax amount directly from claim items
		claim_amount = 0
		tax_amount = 0
		
		for item in self.claim_items:
			claim_amount += flt(item.amount)
			tax_amount += flt(item.tax_amount or 0)
		
		# Log the calculation for debugging
		frappe.logger().info(f"Journal Entry: Claim Amount={claim_amount}, Tax Amount={tax_amount}, Total={claim_amount + tax_amount}")
		
		# Map to track claim amounts per invoice
		invoice_claim_amounts = {}
		invoice_tax_amounts = {}
		
		# Calculate amounts per invoice based on claim items
		for item in self.claim_items:
			if hasattr(item, 'invoice_reference') and item.invoice_reference:
				invoice = item.invoice_reference
				if invoice not in invoice_claim_amounts:
					invoice_claim_amounts[invoice] = 0
					invoice_tax_amounts[invoice] = 0
					
				invoice_claim_amounts[invoice] += flt(item.amount)
				invoice_tax_amounts[invoice] += flt(item.tax_amount or 0)
		
		# Prepare accounts array
		accounts = []
		
		# Add entry for each invoice with their specific amount INCLUDING tax
		for invoice, base_amount in invoice_claim_amounts.items():
			if invoice in invoices and base_amount > 0 and frappe.db.exists("Sales Invoice", invoice):
				tax_amount_per_invoice = invoice_tax_amounts.get(invoice, 0)
				total_amount_per_invoice = base_amount + tax_amount_per_invoice
				
				# Get customer from the invoice
				customer = frappe.db.get_value("Sales Invoice", invoice, "customer")
				
				# Credit customer account for this invoice's portion including tax
				accounts.append({
					'account': self.party_account,
					'party_type': 'Customer',
					'party': customer or self.customer,
					'credit_in_account_currency': total_amount_per_invoice
				})
		
		# Debit receiving account (amount excluding tax)
		accounts.append({
			'account': self.receiving_account,
			'debit_in_account_currency': claim_amount
		})
		
		# Add entries for each claim item
		for item in self.claim_items:
			item_amount = flt(item.amount)
			
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
			
		# Verify and fix balance if needed
		total_debit = sum(account.get('debit_in_account_currency', 0) for account in accounts)
		total_credit = sum(account.get('credit_in_account_currency', 0) for account in accounts)
		
		# Log the totals
		frappe.logger().info(f"Before balance check: Total Debit={total_debit}, Total Credit={total_credit}")
		
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
		
		try:
			je.insert()
			je.submit()
			
			# Update claim status to Reconciled
			self.db_set("status", "Reconciled")
			
			frappe.msgprint(f"Journal Entry {je.name} created and Project Claim marked as Reconciled")
		except Exception as e:
			frappe.throw(f"Failed to create Journal Entry: {str(e)}")
		
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
	
	# Get all items from these invoices
	items_data = frappe.db.sql("""
		SELECT 
			parent as invoice,
			item_code,
			amount
		FROM `tabSales Invoice Item`
		WHERE parent IN %s
	""", [tuple(invoices) if len(invoices) > 1 else tuple(invoices + [''])], as_dict=True)
	
	# Get tax information for these invoices
	tax_data = frappe.db.sql("""
		SELECT 
			parent as invoice,
			rate
		FROM `tabSales Taxes and Charges`
		WHERE parent IN %s
		ORDER BY idx ASC
	""", [tuple(invoices) if len(invoices) > 1 else tuple(invoices + [''])], as_dict=True)
	
	# Map tax rates by invoice
	invoice_tax_rates = {}
	for tax_entry in tax_data:
		invoice_tax_rates[tax_entry.invoice] = flt(tax_entry.rate)
	
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
	
	# Simplified approach: Use direct tracking of item claims by invoice reference
	claims_sql = """
		SELECT 
			ci.invoice_reference as invoice,
			ci.item, 
			SUM(ci.amount) as claimed_amount
		FROM 
			`tabClaim Items` ci
			JOIN `tabProject Claim` pc ON ci.parent = pc.name
		WHERE 
			pc.docstatus = 1
			AND ci.invoice_reference IN %s
		GROUP BY 
			ci.invoice_reference, ci.item
	"""
	
	all_claims = frappe.db.sql(claims_sql, [
		tuple(invoices) if len(invoices) > 1 else tuple(invoices + [''])
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
		
		frappe.logger().debug(f"Item {item} in invoice {invoice}: claimed={claimed_amount}, available={result[invoice][item]['available_balance']}")
	
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
	
	# Add tax rate to each item's data - AFTER balance calculations are done
	for invoice in result:
		tax_rate = invoice_tax_rates.get(invoice, 0)
		for item_code in result[invoice]:
			result[invoice][item_code]['tax_rate'] = tax_rate
	
	return result

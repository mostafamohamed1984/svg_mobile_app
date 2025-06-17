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
		
		# Update Project Contractors fees and deposits table
		self.update_project_contractors_fees_and_deposits()
		
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
		# Get all project contractors referenced in this claim
		projects = []
		
		# Check project_references field first
		if self.project_references:
			project_refs = [p.strip() for p in self.project_references.split(',') if p.strip()]
			projects.extend(project_refs)
		
		# Also check for_project field
		if self.for_project and self.for_project not in projects:
			projects.append(self.for_project)
		
		# Get invoices to check for project contractors
		invoices = [self.reference_invoice]
		if self.invoice_references:
			additional_invoices = [inv.strip() for inv in self.invoice_references.split(',') if inv.strip()]
			invoices.extend(additional_invoices)
		
		# Get project contractors from invoices
		for invoice in invoices:
			project_contractor = frappe.db.get_value("Sales Invoice", invoice, "custom_for_project")
			if project_contractor and project_contractor not in projects:
				projects.append(project_contractor)
		
		if len(projects) > 1:
			# Multiple projects case - distribute amounts proportionally
			invoice_amounts = {}
			invoice_project_map = {}
			
			# Map each invoice to its project
			for invoice in invoices:
				project = frappe.db.get_value("Sales Invoice", invoice, "custom_for_project")
				if project:
					invoice_project_map[invoice] = project
					
					# Calculate amount for this invoice
					invoice_total = 0
					for item in self.claim_items:
						if getattr(item, 'invoice_reference', None) == invoice:
							invoice_total += flt(item.amount)
					
					if invoice_total > 0:
						invoice_amounts[invoice] = invoice_total
			
			# Distribute amounts to projects
			project_amounts = {project: 0 for project in projects}
			
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

	def update_project_contractors_fees_and_deposits(self):
		"""Update the fees and deposits table in Project Contractors with claim references"""
		# Get all invoices referenced in this claim
		invoices = [self.reference_invoice]
		if self.invoice_references:
			additional_invoices = [inv.strip() for inv in self.invoice_references.split(',') if inv.strip()]
			invoices.extend(additional_invoices)
		
		# Get all Project Contractors that have these invoices
		project_contractors = frappe.get_all(
			"Sales Invoice",
			filters={
				"name": ["in", invoices],
				"custom_for_project": ["!=", ""]
			},
			fields=["custom_for_project"],
			distinct=True
		)
		
		# Update each Project Contractors document
		for pc_record in project_contractors:
			project_contractor_name = pc_record.custom_for_project
			
			try:
				# Get the Project Contractors document
				pc_doc = frappe.get_doc("Project Contractors", project_contractor_name)
				
				# Track if any changes were made
				changes_made = False
				
				# Update fees and deposits items that match claim items
				for claim_item in self.claim_items:
					for fee_item in pc_doc.fees_and_deposits:
						if fee_item.item == claim_item.item:
							# Update the project_claim field if it exists
							if hasattr(fee_item, 'project_claim'):
								if not fee_item.project_claim:
									fee_item.project_claim = self.name
									changes_made = True
								elif self.name not in fee_item.project_claim:
									# If there are multiple claims, append this one
									fee_item.project_claim = f"{fee_item.project_claim}, {self.name}"
									changes_made = True
				
				# Save the document if changes were made
				if changes_made:
					pc_doc.save(ignore_permissions=True)
					frappe.logger().info(f"Updated Project Contractors {project_contractor_name} with claim reference {self.name}")
				
			except Exception as e:
				frappe.logger().error(f"Error updating Project Contractors {project_contractor_name}: {str(e)}")
				# Don't fail the entire submission if this update fails
				continue
	
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
		frappe.logger().info(f"update_invoice_outstanding_amounts called for claim {self.name} with invoices: {invoices}")
		
		if not invoices or not self.claim_items:
			frappe.logger().info(f"Skipping update: invoices={invoices}, claim_items count={len(self.claim_items) if self.claim_items else 0}")
			return
			
		# Map to track claim amounts per invoice
		invoice_claim_amounts = {}
		invoice_tax_amounts = {}
		
		# Initialize with zero
		for invoice in invoices:
			invoice_claim_amounts[invoice] = 0
			invoice_tax_amounts[invoice] = 0
		
		# FIXED: Calculate amounts per invoice based on claim items first (most reliable)
		for item in self.claim_items:
			if hasattr(item, 'invoice_reference') and item.invoice_reference:
				inv = item.invoice_reference
				if inv in invoices:
					invoice_claim_amounts[inv] = invoice_claim_amounts.get(inv, 0) + flt(item.amount)
					invoice_tax_amounts[inv] = invoice_tax_amounts.get(inv, 0) + flt(item.tax_amount or 0)
					frappe.logger().info(f"Processing claim item: {item.item} - Amount: {item.amount}, Tax: {item.tax_amount or 0}, Invoice: {inv}")
					frappe.logger().debug(f"Added amount {item.amount} from item {item.item} to invoice {inv}")
		
		# If we couldn't get amounts from claim items, try parsing from being field
		if sum(invoice_claim_amounts.values()) == 0 and self.being:
			import re
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
		
		# FIXED: Only use even distribution as a last resort and only if we have a single invoice
		# For multiple invoices, we should not guess - this prevents incorrect status updates
		if sum(invoice_claim_amounts.values()) == 0:
			if len(invoices) == 1:
				# Single invoice case - safe to use the full claim amount
				invoice_claim_amounts[invoices[0]] = flt(self.claim_amount)
				if self.tax_ratio:
					invoice_tax_amounts[invoices[0]] = flt(self.claim_amount) * flt(self.tax_ratio) / 100
				frappe.logger().debug(f"Single invoice: assigned full claim amount {self.claim_amount} to {invoices[0]}")
			else:
				# Multiple invoices but no specific amounts - log warning and skip updates
				frappe.logger().warning(f"Cannot determine claim amounts per invoice for {self.name}. Skipping outstanding amount updates to prevent incorrect status changes.")
				return
		
		# Log what we determined for each invoice
		frappe.logger().info(f"Final claim amounts per invoice: {invoice_claim_amounts}")
		frappe.logger().info(f"Final tax amounts per invoice: {invoice_tax_amounts}")
		frappe.logger().info(f"Total determined: {sum(invoice_claim_amounts.values())}, Claim amount: {self.claim_amount}")
		
		# Validate that we're not claiming more than the total claim amount
		total_determined = sum(invoice_claim_amounts.values())
		if total_determined > flt(self.claim_amount) * 1.01:  # Allow 1% tolerance for rounding
			frappe.logger().error(f"Total determined amounts ({total_determined}) exceed claim amount ({self.claim_amount})")
			frappe.throw(f"Error: Calculated claim amounts per invoice ({total_determined}) exceed total claim amount ({self.claim_amount})")
		
		# Update each invoice's outstanding amount
		for invoice, claim_amount in invoice_claim_amounts.items():
			if claim_amount > 0 and frappe.db.exists("Sales Invoice", invoice):
				# Get current outstanding amount
				current_outstanding = frappe.db.get_value("Sales Invoice", invoice, "outstanding_amount") or 0
				current_status = frappe.db.get_value("Sales Invoice", invoice, "status") or "Unknown"
				
				# Get tax amount for this invoice
				tax_amount = invoice_tax_amounts.get(invoice, 0)
				
				# Make sure we're reducing by a positive amount (including tax)
				claim_reduction = abs(claim_amount) + abs(tax_amount)
				
				# FIXED: Validate that we're not reducing more than the current outstanding
				if claim_reduction > flt(current_outstanding) * 1.01:  # Allow 1% tolerance
					frappe.logger().warning(f"Invoice {invoice}: Claim reduction ({claim_reduction}) exceeds current outstanding ({current_outstanding}). Capping to outstanding amount.")
					claim_reduction = flt(current_outstanding)
				
				# Calculate new outstanding amount (ensure it doesn't go below zero)
				new_outstanding = max(0, flt(current_outstanding) - flt(claim_reduction))
				
				frappe.logger().info(f"DETAILED CALCULATION for Invoice {invoice}:")
				frappe.logger().info(f"  Current Status: {current_status}")
				frappe.logger().info(f"  Current Outstanding: {current_outstanding}")
				frappe.logger().info(f"  Claim Amount (base): {claim_amount}")
				frappe.logger().info(f"  Tax Amount: {tax_amount}")
				frappe.logger().info(f"  Total Reduction: {claim_reduction}")
				frappe.logger().info(f"  New Outstanding: {new_outstanding}")
				frappe.logger().info(f"  Grand Total: {frappe.db.get_value('Sales Invoice', invoice, 'grand_total') or 0}")
				
				# Update the invoice
				frappe.db.set_value("Sales Invoice", invoice, "outstanding_amount", new_outstanding)
				
				# FIXED: Update status based on new outstanding amount with proper thresholds
				grand_total = frappe.db.get_value("Sales Invoice", invoice, "grand_total") or 0
				
				frappe.logger().info(f"STATUS UPDATE LOGIC for Invoice {invoice}:")
				frappe.logger().info(f"  New Outstanding: {new_outstanding}")
				frappe.logger().info(f"  Grand Total: {grand_total}")
				frappe.logger().info(f"  Is new_outstanding <= 0.01? {flt(new_outstanding) <= 0.01}")
				frappe.logger().info(f"  Is new_outstanding < grand_total - 0.01? {flt(new_outstanding) < flt(grand_total) - 0.01}")
				frappe.logger().info(f"  Grand total - 0.01 = {flt(grand_total) - 0.01}")
				
				if flt(new_outstanding) <= 0.01:  # Consider amounts <= 0.01 as fully paid
					frappe.db.set_value("Sales Invoice", invoice, "status", "Paid")
					frappe.logger().info(f"Invoice {invoice} marked as Paid (outstanding <= 0.01)")
				elif flt(new_outstanding) < flt(grand_total) - 0.01:  # Partially paid if outstanding is less than grand total
					frappe.db.set_value("Sales Invoice", invoice, "status", "Partly Paid")
					frappe.logger().info(f"Invoice {invoice} marked as Partly Paid (outstanding < grand_total)")
				else:
					frappe.logger().info(f"Invoice {invoice} status unchanged (outstanding equals grand_total)")
				# If outstanding equals grand total, leave status unchanged (likely "Unpaid" or "Overdue")

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
				
				# FIXED: Add debugging to track amounts
				current_outstanding = frappe.db.get_value("Sales Invoice", invoice, "outstanding_amount") or 0
				frappe.logger().info(f"Journal Entry for invoice {invoice}: Base={base_amount}, Tax={tax_amount_per_invoice}, Total={total_amount_per_invoice}, Current Outstanding={current_outstanding}")
				
				# Get customer from the invoice
				customer = frappe.db.get_value("Sales Invoice", invoice, "customer")
				
				# Credit customer account for this invoice's portion including tax
				# CRITICAL FIX: Remove reference_type and reference_name to prevent automatic outstanding amount update
				# This prevents double reduction of outstanding amounts (once by journal entry, once by our custom method)
				accounts.append({
					'account': self.party_account,
					'party_type': 'Customer',
					'party': customer or self.customer,
					'credit_in_account_currency': total_amount_per_invoice
					# Removed reference_type and reference_name to avoid double impact on outstanding amounts
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

# Add a static method to be called from JavaScript
@frappe.whitelist()
def create_journal_entry_from_claim(claim_name):
	"""Create a journal entry from a Project Claim directly from client script"""
	if not claim_name:
		frappe.throw("Project Claim name is required")
		
	# Get the claim document
	claim = frappe.get_doc("Project Claim", claim_name)
	
	# Get all involved invoices
	invoices = [claim.reference_invoice]
	if claim.invoice_references:
		additional_invoices = [inv.strip() for inv in claim.invoice_references.split(',') if inv.strip()]
		invoices.extend(additional_invoices)
	
	# Create the journal entry
	je_name = claim.create_journal_entry(invoices)
	
	# NOTE: update_invoice_outstanding_amounts is already called during claim submission
	# No need to call it again here as it would cause double reduction
	if je_name:
		frappe.db.commit()  # Ensure the journal entry is saved
	
	# Return the journal entry name
	return je_name

@frappe.whitelist()
def get_project_contractors_with_outstanding_invoices(doctype, txt, searchfield, start, page_len, filters):
	"""Get project contractors that have outstanding invoices for the given customer"""
	customer = filters.get('customer')
	if not customer:
		return []
	
	# Query to get project contractors that have outstanding invoices
	query = """
		SELECT DISTINCT pc.name, pc.project_name, pc.customer_name
		FROM `tabProject Contractors` pc
		INNER JOIN `tabSales Invoice` si ON si.custom_for_project = pc.name
		WHERE pc.customer = %(customer)s
		AND si.docstatus = 1
		AND si.status NOT IN ('Paid', 'Cancelled')
		AND si.outstanding_amount > 0
		AND (pc.name LIKE %(txt)s OR pc.project_name LIKE %(txt)s)
		ORDER BY pc.project_name
		LIMIT %(start)s, %(page_len)s
	"""
	
	return frappe.db.sql(query, {
		'customer': customer,
		'txt': f'%{txt}%',
		'start': start,
		'page_len': page_len
	})

	def on_cancel(self):
		"""Handle cancellation by ignoring all link validation"""
		# This is the correct way to bypass link validation completely
		self.flags.ignore_links = True
		
	def on_trash(self):
		"""Handle document deletion by unlinking related documents"""
		# This is the correct way to bypass link validation completely
		self.flags.ignore_links = True
		
		# Clear any references to Project Contractors before deletion
		if self.for_project:
			# We don't need to update the Project Contractors document
			# Just clear our own reference
			self.for_project = None

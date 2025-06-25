// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

// Ensure flt function is available
const flt = function(value, precision) {
	precision = precision || frappe.defaults.get_default("float_precision") || 2;
	return parseFloat(parseFloat(value).toFixed(precision));
};

frappe.ui.form.on("Orbit Claim", {
	refresh: function(frm) {
		// Update current balance in claim items
		if (frm.doc.reference_invoice && frm.doc.claim_items && frm.doc.claim_items.length > 0) {
			frm.call({
				method: "update_claim_items_balance",
				doc: frm.doc,
				callback: function(r) {
					frm.refresh_field('claim_items');
				}
			});
		}

		// Add Bulk Create button if this is a new doc
		if (frm.doc.__islocal) {
			frm.add_custom_button(__('Create from Multiple Invoices'), function() {
				show_bulk_invoice_dialog(frm);
			}).addClass('btn-primary');
		}
		
		// Add email button if doc is submitted
		if (frm.doc.docstatus === 1) {
			frm.add_custom_button(__('Send Receipt Email'), function() {
				show_email_dialog(frm);
			}).addClass('btn-primary');
		}
	},
	
	onload: function(frm) {
		// Check if it's a new document and receiver is not set
		if (frm.doc.__islocal && !frm.doc.receiver) {
			// Check if current user has a visual identity
			frappe.call({
				method: "frappe.client.get_value",
				args: {
					doctype: "visual Identity",
					filters: {
						user: frappe.session.user,
						identity_for: "Receiver"
					},
					fieldname: "name"
				},
				callback: function(r) {
					if (r.message && r.message.name) {
						frm.set_value('receiver', r.message.name);
					} else {
						// Get default receiver
						frappe.call({
							method: "frappe.client.get_value",
							args: {
								doctype: "visual Identity",
								filters: {
									name1: "Mahmoud Said",
									identity_for: "Receiver"
								},
								fieldname: "name"
							},
							callback: function(r) {
								if (r.message && r.message.name) {
									frm.set_value('receiver', r.message.name);
								}
							}
						});
					}
				}
			});
		}
	},
	
	reference_invoice: function(frm) {
		// Update current balance when reference invoice is changed
		if (frm.doc.reference_invoice && frm.doc.claim_items && frm.doc.claim_items.length > 0) {
			frm.call({
				method: "update_claim_items_balance",
				doc: frm.doc,
				callback: function(r) {
					frm.refresh_field('claim_items');
				}
			});
		}
	},
	
	claim_amount: function(frm) {
		if (frm.doc.claim_amount && frm.doc.outstanding_amount) {
			if (flt(frm.doc.claim_amount) > flt(frm.doc.outstanding_amount)) {
				frappe.msgprint(__('Claim Amount cannot be greater than Outstanding Amount'));
				frm.set_value('claim_amount', '');
				return;
			}
			
			// Calculate tax amount (tax_ratio is percentage)
			if (frm.doc.tax_ratio) {
				const tax_amount = flt(frm.doc.claim_amount) * flt(frm.doc.tax_ratio) / 100;
				frm.set_value('tax_amount', tax_amount);
			}
		}
	}
});

function show_bulk_invoice_dialog(frm) {
	console.log("Opening bulk invoice dialog");
	
	// Create a dialog to select multiple invoices
	let dialog = new frappe.ui.Dialog({
		title: __('Select Sales Invoices for Bulk Claim'),
		fields: [
			{
				fieldname: 'customer',
				label: __('Customer'),
				fieldtype: 'Link',
				options: 'Customer',
				reqd: 1,
				default: frm.doc.customer || '',
				onchange: function() {
					// When customer changes, clear the project contractor filter
					dialog.set_value('project_contractor_filter', '');
					
					// Hide the invoices section until a project contractor is selected
					dialog.fields_dict.invoices_html.html(`
						<div id="invoices_container" class="margin-top">
							<div class="text-muted">${__('Select a project contractor to view invoices')}</div>
						</div>
					`);
				}
			},
			{
				fieldname: 'project_contractor_filter',
				label: __('Filter by Project Contractor'),
				fieldtype: 'Link',
				options: 'Project Contractors',
				get_query: function() {
					let customer = dialog.get_value('customer');
					if (!customer) {
						return {
							filters: {
								'name': 'no-match' // Return no results if no customer selected
							}
						};
					}
					
					// Return a query that filters project contractors based on having outstanding invoices
					return {
						query: 'svg_mobile_app.svg_mobile_app.doctype.orbit_claim.orbit_claim.get_project_contractors_with_outstanding_invoices',
						filters: {
							'customer': customer
						}
					};
				},
				onchange: function() {
					// When a project contractor is selected for filtering
					let project_contractor = dialog.get_value('project_contractor_filter');
					if (project_contractor) {
						// Fetch project and customer name
						frappe.db.get_value('Project Contractors', project_contractor, ['project_name', 'customer_name'], function(r) {
							if (r) {
								// Update the field's description to show the details
								let projectInfo = r.project_name ? `Project: ${r.project_name}` : '';
								let customerInfo = r.customer_name ? `Customer: ${r.customer_name}` : '';
								let description = [projectInfo, customerInfo].filter(Boolean).join(', ');
								
								// Update the field description
								dialog.set_df_property('project_contractor_filter', 'description', description);
								dialog.refresh_field('project_contractor_filter');
							}
						});
						
						// Fetch invoices for this customer and project contractor
						fetch_customer_invoices_by_contractor(dialog, dialog.get_value('customer'), project_contractor);
					} else {
						// If filter is cleared, hide the invoices section
						dialog.fields_dict.invoices_html.html(`
							<div id="invoices_container" class="margin-top">
								<div class="text-muted">${__('Select a project contractor to view invoices')}</div>
							</div>
						`);
						
						// Clear the description
						dialog.set_df_property('project_contractor_filter', 'description', '');
						dialog.refresh_field('project_contractor_filter');
					}
				}
			},
			{
				fieldname: 'invoices_html',
				fieldtype: 'HTML'
			},
			{
				fieldname: 'items_preview_html',
				fieldtype: 'HTML'
			},
			{
				fieldname: 'total_claim_amount',
				label: __('Total Claim Amount'),
				fieldtype: 'Currency',
				read_only: 1
			},
			{
				fieldname: 'include_taxes',
				label: __('Include Taxes'),
				fieldtype: 'Check',
				default: 1,
				onchange: function() {
					// Refresh the items preview when tax inclusion setting changes
					if (dialog.selected_invoices && dialog.selected_invoices.size > 0) {
						update_items_preview(dialog);
					}
					// Update total calculations
					update_total_claim_amount(dialog);
				}
			}
		],
		primary_action_label: __('Create Orbit Claim'),
		primary_action: function() {
			// Before creating the orbit claim, make sure all selected invoices are displayed in the preview
			// This ensures all invoices are processed, even from other project contractors
			if (dialog.selected_invoices && dialog.selected_invoices.size > 0) {
				// Force update of items preview to include all selected invoices
				update_items_preview(dialog);
				
				// Give a moment for the preview to update before proceeding
				setTimeout(() => {
					// Store original state
					let was_local = frm.doc.__islocal;
					let had_unsaved = frm.doc.__unsaved;
					
					// Completely bypass validation by making the form appear saved and not new
					frm.doc.__islocal = false;
					frm.doc.__unsaved = 0;
					
					// Disable save before creating the orbit claim
					frm.disable_save();
					
					// Prevent auto-save by just calling the function and closing the dialog
					create_bulk_orbit_claim(frm, dialog);
					dialog.hide();
					
					// Restore original state after a delay
					setTimeout(() => {
						frm.doc.__islocal = was_local;
						frm.doc.__unsaved = had_unsaved;
					}, 100);
				}, 200);
			} else {
				// If no invoices are selected, proceed directly
			// Store original state
			let was_local = frm.doc.__islocal;
			let had_unsaved = frm.doc.__unsaved;
			
			// Completely bypass validation by making the form appear saved and not new
			frm.doc.__islocal = false;
			frm.doc.__unsaved = 0;
			
			// Disable save before creating the orbit claim
			frm.disable_save();
			
			// Prevent auto-save by just calling the function and closing the dialog
			create_bulk_orbit_claim(frm, dialog);
			dialog.hide();
			
			// Restore original state after a delay
			setTimeout(() => {
				frm.doc.__islocal = was_local;
				frm.doc.__unsaved = had_unsaved;
			}, 100);
			}
		}
	});
	
	// Initialize the invoices data
	dialog.invoices_data = [];
	dialog.selected_invoices = new Set(); // Track selected invoices
	dialog.saved_claim_amounts = {}; // Store claim amounts by invoice and item
	dialog.max_invoices = 100; // No reason to limit to a small number
	
	// Initialize the invoices HTML container
	dialog.fields_dict.invoices_html.html(`
		<div id="invoices_container" class="margin-top">
			<div class="text-muted">${__('Select a project contractor to view invoices')}</div>
		</div>
	`);
	
	// Amount input change handler (will be delegated)
	dialog.$wrapper.on('change', '.item-amount-input', function() {
		const invoice = $(this).data('invoice');
		const item = $(this).data('item');
		const idx = $(this).data('idx');
		const tax_rate = parseFloat($(this).data('tax-rate')) || 0;
		const value = parseFloat($(this).val()) || 0;
		console.log(`Amount for item ${item} in invoice ${invoice} changed to ${value}`);
		
		// Find the invoice items
		let invoice_items = dialog.items_by_invoice[invoice] || [];
		if (invoice_items && invoice_items[idx]) {
			// Update the amount directly and recalculate ratios internally (hidden from user)
			invoice_items[idx].claim_amount = value;
			
			// Calculate and update tax amount based on include_taxes setting
			const include_taxes = dialog.get_value('include_taxes');
			const tax_amount = include_taxes ? flt(value * tax_rate / 100) : 0;
			invoice_items[idx].tax_amount = tax_amount;
			
			// Update the tax amount display
			$(this).closest('tr').find('.tax-amount').text(format_currency(tax_amount));
			
			// Save the claim amount in our persistent storage
			if (!dialog.saved_claim_amounts[invoice]) {
				dialog.saved_claim_amounts[invoice] = {};
			}
			dialog.saved_claim_amounts[invoice][item] = value;
			
			// Recalculate the total for this invoice
			let invoice_total = 0;
			let tax_total = 0;
			invoice_items.forEach(item => {
				invoice_total += flt(item.claim_amount || 0);
				tax_total += flt(item.tax_amount || 0);
			});
			
			// Update the invoice's claim amount and tax amount
			let invoice_index = dialog.invoices_data.findIndex(inv => inv.invoice === invoice);
			if (invoice_index !== -1) {
				dialog.invoices_data[invoice_index].claim_amount = invoice_total;
				dialog.invoices_data[invoice_index].tax_amount = tax_total;
			}
			
			// Update invoice table totals
			update_invoice_table_totals(dialog, invoice, invoice_total, tax_total);
			
			// Recalculate ratios internally based on the new amounts
			if (invoice_total > 0) {
				invoice_items.forEach(item => {
					item.ratio = flt(item.claim_amount || 0) / invoice_total * 100;
				});
			}
			
			// Update the total in the UI
			update_total_claim_amount(dialog);
		}
	});
	
	// Checkbox change handler (will be delegated)
	dialog.$wrapper.on('change', '.invoice-select', function() {
		const index = $(this).data('index');
		const invoice = dialog.invoices_data[index].invoice;
		console.log(`Checkbox ${index} changed to ${this.checked}`);
		
		dialog.invoices_data[index].select = this.checked ? 1 : 0;
		
		if (this.checked) {
			dialog.selected_invoices.add(invoice);
			// Update the items preview to show the items for this invoice
			update_items_preview(dialog);
		} else {
			dialog.selected_invoices.delete(invoice);
			
			// Clear saved claim amounts for this invoice if unchecked
			if (dialog.saved_claim_amounts[invoice]) {
				delete dialog.saved_claim_amounts[invoice];
			}
			
			// Update the items preview to remove the items for this invoice
			update_items_preview(dialog);
		}
		
		update_total_claim_amount(dialog);
	});
	
	dialog.show();
}

function fetch_customer_invoices_by_contractor(dialog, customer, project_contractor) {
	console.log("Fetching invoices for customer:", customer, "and project contractor:", project_contractor);
	
	// Show loading indicator
	dialog.fields_dict.invoices_html.html(`
		<div class="text-center my-4">
			<i class="fa fa-spinner fa-spin fa-2x"></i>
			<p>${__('Fetching invoices...')}</p>
		</div>
	`);
	
	// Get customer's outstanding invoices filtered by project contractor
	frappe.call({
		method: 'frappe.client.get_list',
		args: {
			doctype: 'Sales Invoice',
			filters: {
				'customer': customer,
				'custom_for_project': project_contractor,
				'docstatus': 1,
				'status': ['in', ['Partly Paid', 'Unpaid', 'Overdue']],
				'outstanding_amount': ['>', 0]
			},
			fields: ['name', 'posting_date', 'custom_for_project', 'status', 'due_date', 'grand_total', 'outstanding_amount'],
			order_by: 'posting_date desc',
			limit_page_length: 100,  // Increase from default 20 to 100
			limit_start: 0,          // Start from the first record
			page_length: 100         // Alternative parameter that might work if limit_page_length doesn't
		},
		callback: function(response) {
			console.log("API response:", response);
			
			if (response.message && response.message.length > 0) {
				console.log("Found invoices:", response.message.length);
				
				// First prepare basic invoice data
				dialog.invoices_data = response.message.map(inv => {
					// Check if this invoice was previously selected
					let was_selected = dialog.selected_invoices.has(inv.name);
					
					return {
						'invoice': inv.name,
						'invoice_date': inv.posting_date,
						'project': inv.custom_for_project || '',
						'project_contractor': project_contractor, // Use the selected project contractor
						'status': inv.status,
						'due_date': inv.due_date,
						'total': inv.grand_total,
						'outstanding': inv.outstanding_amount,
						'claim_amount': 0, // Initialize with 0 instead of outstanding amount
						'select': was_selected ? 1 : 0 // Maintain selection state
					};
				});
				
				// Get invoice names for all invoices
				let invoice_names = dialog.invoices_data.map(inv => inv.invoice);
				
				
				// Get available balances for all invoices
				frappe.call({
					method: 'svg_mobile_app.svg_mobile_app.doctype.orbit_claim.orbit_claim.get_available_invoice_balances',
					args: {
						invoices: invoice_names
					},
					callback: function(balance_result) {
						let balance_data = balance_result.message || {};
						
						// Update each invoice with claimable amount based on available balances
						dialog.invoices_data.forEach(inv => {
							let invoice_balance_data = balance_data[inv.invoice] || {};
							let claimable_amount = 0;
							
							// Sum available balances for all items in this invoice
							Object.keys(invoice_balance_data).forEach(item_code => {
								claimable_amount += invoice_balance_data[item_code].available_balance || 0;
							});
							
							// Set claimable amount but keep claim amount at 0
							inv.claimable_amount = claimable_amount;
						});
						
						// Render the invoices table with updated data
						render_invoices_table(dialog, dialog.invoices_data);
						
						// Update the items preview for any selected invoices
						update_items_preview(dialog);
						
						// Update the total claim amount
						update_total_claim_amount(dialog);
					}
				});
			} else {
				console.log("No invoices found");
				
				dialog.invoices_data = [];
				
				// Show message if no invoices found
				dialog.fields_dict.invoices_html.html(`
					<div class="alert alert-warning my-4">
						${__('No outstanding invoices found for this customer and project contractor')}
					</div>
				`);
				
				// Clear the totals
				dialog.set_value('total_claim_amount', 0);
			}
		},
		error: function(err) {
			console.error("Error fetching invoices:", err);
			dialog.fields_dict.invoices_html.html(`
				<div class="alert alert-danger my-4">
					${__('Error fetching invoices. Please check console for details.')}
				</div>
			`);
		}
	});
}

function render_invoices_table(dialog, invoices_data) {
	if (!invoices_data || invoices_data.length === 0) {
		console.log("No invoices to render");
		return;
	}
	
	console.log("Rendering invoices table with data:", invoices_data);
	
	// Auto-select all invoices
	invoices_data.forEach(inv => {
		inv.select = 1;
		dialog.selected_invoices.add(inv.invoice);
	});
	
	let html = `
		<div class="margin-top">
			<div class="alert alert-info my-2">
				${__('Found')} ${invoices_data.length} ${__('outstanding invoices - all automatically selected')}
			</div>
			<div class="table-responsive">
				<table class="table table-bordered invoices-table">
					<thead>
						<tr>
							<th>${__('Invoice')}</th>
							<th>${__('Date')}</th>
							<th>${__('Project')}</th>
							<th>${__('Status')}</th>
							<th>${__('Due Date')}</th>
							<th>${__('Total')}</th>
							<th>${__('Outstanding')}</th>
							<th>${__('Claimable')}</th>
						</tr>
					</thead>
					<tbody>
	`;
	
	invoices_data.forEach((inv, index) => {
		html += `
			<tr>
				<td>${inv.invoice}</td>
				<td>${inv.invoice_date}</td>
				<td>${inv.project || ''}</td>
				<td>${inv.status}</td>
				<td>${inv.due_date || ''}</td>
				<td class="text-right">${format_currency(inv.total)}</td>
				<td class="text-right">${format_currency(inv.outstanding)}</td>
				<td class="text-right">${format_currency(inv.claimable_amount)}</td>
			</tr>
		`;
	});
	
	html += `
					</tbody>
				</table>
			</div>
		</div>
	`;
	
	dialog.fields_dict.invoices_html.html(html);
	
	// Automatically trigger update of items preview
	update_items_preview(dialog);
}

function update_total_claim_amount(dialog) {
	console.log("Updating total claim amount");
	let total = 0;
	let total_tax = 0;
	const include_taxes = dialog.get_value('include_taxes');
	
	// Sum up claim amounts for selected invoices in current view
	dialog.invoices_data.forEach(inv => {
		if (inv.select) {
			total += flt(inv.claim_amount);
			if (include_taxes) {
				total_tax += flt(inv.tax_amount || 0);
			}
		}
	});
	
	// Also include claim amounts from other selected invoices not in current view
	if (dialog.selected_invoices && dialog.saved_claim_amounts) {
		let current_invoice_names = dialog.invoices_data.map(inv => inv.invoice);
		
		// For each selected invoice not in current view
		dialog.selected_invoices.forEach(invoice_name => {
			if (!current_invoice_names.includes(invoice_name) && dialog.saved_claim_amounts[invoice_name]) {
				// Sum up all items for this invoice
				let invoice_total = 0;
				Object.values(dialog.saved_claim_amounts[invoice_name]).forEach(amount => {
					invoice_total += flt(amount);
				});
				
				total += invoice_total;
			}
		});
	}
	
	console.log("Total claim amount:", total);
	dialog.set_value('total_claim_amount', total);
	
	// Store total tax amount for later use
	dialog.total_tax_amount = total_tax;
}

function update_invoice_table_totals(dialog, invoice, total_amount, total_tax) {
	// Update the invoice table totals if they exist in the UI
	let invoice_row = dialog.$wrapper.find(`tr[data-invoice="${invoice}"]`);
	if (invoice_row.length > 0) {
		invoice_row.find('.claim-amount-total').text(format_currency(total_amount));
		if (dialog.get_value('include_taxes')) {
			invoice_row.find('.tax-amount-total').text(format_currency(total_tax));
		}
	}
}

function update_items_preview(dialog) {
	console.log("Updating items preview");
	let selected_invoices = dialog.invoices_data.filter(inv => inv.select);
	
	// Also include any previously selected invoices that are in our tracking Set
	// but might not be in the current invoices_data (from other project contractors)
	if (dialog.selected_invoices && dialog.selected_invoices.size > 0) {
		// We need to ensure we have all the selected invoices loaded
		let all_selected_invoice_names = Array.from(dialog.selected_invoices);
		console.log("All selected invoices in Set: " + all_selected_invoice_names.length);
		
		// Filter out ones that are already in our selected_invoices array
		let current_selected_names = selected_invoices.map(inv => inv.invoice);
		let missing_invoice_names = all_selected_invoice_names.filter(
			name => !current_selected_names.includes(name)
		);
		console.log("Missing invoice names: " + missing_invoice_names.length);
		
		// If we have some selected invoices that aren't in the current view,
		// we need to load them separately
		if (missing_invoice_names.length > 0 && !dialog.loading_missing_invoices) {
			dialog.loading_missing_invoices = true;
			
			// Show loading indicator if no existing items
			if (selected_invoices.length === 0) {
				dialog.fields_dict.items_preview_html.html(`
					<div class="text-center my-4">
						<i class="fa fa-spinner fa-spin"></i>
						<p>${__('Loading selected invoices...')}</p>
					</div>
				`);
			}
			
			// Fetch the missing invoices - MODIFIED to handle larger batches
			// This is a crucial change to avoid the 20 limit
			let fetchMissingInvoices = function(invoice_batch) {
				frappe.call({
					method: 'frappe.client.get_list',
					args: {
						doctype: 'Sales Invoice',
						filters: {
							'name': ['in', invoice_batch]
						},
						fields: ['name', 'posting_date', 'custom_for_project', 'status', 'due_date', 'grand_total', 'outstanding_amount'],
						limit_page_length: 0  // No limit
					},
					callback: function(response) {
						if (response.message && response.message.length > 0) {
							// Create invoice objects for the missing invoices
							let missing_invoices = response.message.map(inv => {
								return {
									'invoice': inv.name,
									'invoice_date': inv.posting_date,
									'project': inv.custom_for_project || '',
									'project_contractor': inv.custom_for_project || '',
									'status': inv.status,
									'due_date': inv.due_date,
									'total': inv.grand_total,
									'outstanding': inv.outstanding_amount,
									'claim_amount': 0,
									'select': 1,
									'claimable_amount': 0
								};
							});
							
							// Collect project contractors from missing invoices
							let project_contractors_from_missing = missing_invoices
								.map(inv => inv.project_contractor)
								.filter(Boolean);
							
							// Add these to the existing list if we have one
							if (dialog.project_contractors_from_missing_invoices) {
								project_contractors_from_missing.forEach(pc => {
									if (!dialog.project_contractors_from_missing_invoices.includes(pc)) {
										dialog.project_contractors_from_missing_invoices.push(pc);
									}
								});
							} else {
								dialog.project_contractors_from_missing_invoices = project_contractors_from_missing;
							}
							
							// Add these to our selection
							selected_invoices = selected_invoices.concat(missing_invoices);
						}
						
						// We're done fetching this batch
						if (missing_invoice_names.length > 0) {
							// We have more to fetch
							let nextBatch = missing_invoice_names.splice(0, 50);
							fetchMissingInvoices(nextBatch);
						} else {
							// All done - now load the items
							dialog.loading_missing_invoices = false;
							load_invoice_items(selected_invoices);
						}
					},
					error: function() {
						dialog.loading_missing_invoices = false;
						load_invoice_items(selected_invoices);
					}
				});
			};
			
			// Start the batch process - fetch up to 50 invoices at a time
			let firstBatch = missing_invoice_names.splice(0, 50);
			fetchMissingInvoices(firstBatch);
			return;
		}
	}
	
	// Direct load if we don't need to fetch missing invoices
	load_invoice_items(selected_invoices);
	
	// Function to load the items for all selected invoices
	function load_invoice_items(selected_invoices) {
		if (selected_invoices.length === 0) {
			dialog.fields_dict.items_preview_html.html('');
			return;
		}
		
		// Show loading indicator
		dialog.fields_dict.items_preview_html.html(`
			<div class="text-center my-4">
				<i class="fa fa-spinner fa-spin"></i>
				<p>${__('Loading invoice items...')}</p>
			</div>
		`);
		
		// Get invoice names for selected invoices
		let invoice_names = selected_invoices.map(inv => inv.invoice);
		console.log("Selected invoice names:", invoice_names);
		
		
		// First get available balances for all invoices
		frappe.call({
			method: 'svg_mobile_app.svg_mobile_app.doctype.orbit_claim.orbit_claim.get_available_invoice_balances',
			args: {
				invoices: invoice_names
			},
			callback: function(balance_result) {
				let balance_data = balance_result.message || {};
				console.log("Balance data received:", balance_data);  // Debug log
				
				// Process each invoice separately to avoid permission issues
				let all_items = [];
				let processed_count = 0;
				
				// Function to process results after all invoices are loaded
				function process_results() {
					if (all_items.length === 0) {
						dialog.fields_dict.items_preview_html.html(`
							<div class="alert alert-warning my-4">
								${__('No items found for selected invoices')}
							</div>
						`);
						return;
					}
					
					// Update available balance for each item
					const include_taxes = dialog.get_value('include_taxes');
					
					all_items.forEach(item => {
						if (balance_data[item.invoice] && balance_data[item.invoice][item.item_code]) {
							item.original_amount = balance_data[item.invoice][item.item_code].original_amount;
							item.claimed_amount = balance_data[item.invoice][item.item_code].claimed_amount;
							item.available_balance = balance_data[item.invoice][item.item_code].available_balance;
							// Add tax rate from balance data
							item.tax_rate = balance_data[item.invoice][item.item_code].tax_rate || 0;
							console.log(`Item ${item.item_code} from invoice ${item.invoice}: Original=${item.original_amount}, Claimed=${item.claimed_amount}, Available=${item.available_balance}`);  // Debug log
						} else {
							// Default to original amount if no balance data
							item.available_balance = item.amount;
							item.tax_rate = 0;
							console.log(`No balance data for item ${item.item_code} from invoice ${item.invoice}, using original amount: ${item.amount}`);  // Debug log
						}
						
						// Restore saved claim amount if available
						if (dialog.saved_claim_amounts[item.invoice] && 
							dialog.saved_claim_amounts[item.invoice][item.item_code] !== undefined) {
							item.claim_amount = dialog.saved_claim_amounts[item.invoice][item.item_code];
							console.log(`Restored saved claim amount for ${item.item_code} in ${item.invoice}: ${item.claim_amount}`);
						} else {
							item.claim_amount = 0;
						}
						
						// Calculate tax amount based on claim amount, tax rate, and include_taxes setting
						item.tax_amount = include_taxes ? flt(item.claim_amount * item.tax_rate / 100) : 0;
					});
					
					// Group items by invoice
					let items_by_invoice = {};
					let invoice_totals = {};
					
					// First group and calculate totals
					all_items.forEach(item => {
						if (!items_by_invoice[item.invoice]) {
							items_by_invoice[item.invoice] = [];
							invoice_totals[item.invoice] = 0;
						}
						items_by_invoice[item.invoice].push(item);
						invoice_totals[item.invoice] += flt(item.amount);
					});
					
					// Then calculate ratios - hidden from UI but still used for calculations
					all_items.forEach(item => {
						if (invoice_totals[item.invoice] > 0) {
							item.ratio = flt(item.amount) / flt(invoice_totals[item.invoice]) * 100;
						} else {
							item.ratio = 0;
						}
					});
					
					// Calculate invoice totals based on item claim amounts
					selected_invoices.forEach(inv => {
						let invoice_items = items_by_invoice[inv.invoice] || [];
						if (invoice_items.length > 0) {
							let invoice_total = 0;
							invoice_items.forEach(item => {
								invoice_total += flt(item.claim_amount || 0);
							});
							
							// Update the invoice's claim amount
							let invoice_index = dialog.invoices_data.findIndex(i => i.invoice === inv.invoice);
							if (invoice_index !== -1) {
								dialog.invoices_data[invoice_index].claim_amount = invoice_total;
							}
						}
					});
					
					console.log("Grouped items:", items_by_invoice);
					dialog.items_by_invoice = items_by_invoice;
					
					// Create HTML for item allocation tables with editable inputs
					let html = '<div class="margin-top">';
					
					// First, add a section showing all selected invoices
					let total_count = selected_invoices.length;
					if (total_count > 0) {
						html += `
							<div class="alert alert-info mb-4">
								<h6>${__('Selected Invoices:')} ${total_count}</h6>
								<div class="selected-invoices-summary" style="max-height: 150px; overflow-y: auto; display: flex; flex-wrap: wrap;">
						`;
						
						selected_invoices.forEach(inv => {
							let projectInfo = inv.project ? ` (${inv.project})` : '';
							html += `<div class="badge badge-primary mr-1 mb-1 py-1 px-2">${inv.invoice}${projectInfo}</div>`;
						});
						
						html += `
								</div>
							</div>
						`;
					}
					
					selected_invoices.forEach(inv => {
						let invoice_items = items_by_invoice[inv.invoice] || [];
						if (invoice_items.length === 0) return;
						
						html += `
							<div class="invoice-items-section mb-4" data-invoice="${inv.invoice}">
								<h5>${__('Invoice')}: ${inv.invoice} ${inv.project_contractor ? '(' + inv.project_contractor + ')' : ''}</h5>
								<h6>${__('Project')}: ${inv.project || ''}</h6>
								<div class="table-responsive">
									<table class="table table-bordered item-allocation-table">
										<thead>
											<tr>
												<th>${__('Item')}</th>
												<th>${__('Original Amount')}</th>
												<th>${__('Available Balance')}</th>
												<th>${__('Claim Amount')}</th>
												${include_taxes ? `<th>${__('Tax Rate')}</th>` : ''}
												${include_taxes ? `<th>${__('Tax Amount')}</th>` : ''}
											</tr>
										</thead>
										<tbody>
						`;
						
						let total_amount = 0;
						
						invoice_items.forEach((item, idx) => {
							// Skip items with zero available balance
							if (item.available_balance <= 0) return;
							
							// Initialize item's claim amount if not set
							if (!item.claim_amount) {
								item.claim_amount = 0;
							}
							total_amount += flt(item.claim_amount);
							
							let tax_rate = item.tax_rate || 0;
							// Calculate tax amount based on include_taxes setting
							let tax_amount = include_taxes ? flt(item.claim_amount * tax_rate / 100) : 0;
							
							html += `
								<tr data-item="${item.item_code}" data-invoice="${inv.invoice}" data-idx="${idx}">
									<td>${item.item_name || item.item_code}</td>
									<td class="text-right">${format_currency(item.amount)}</td>
									<td class="text-right">${format_currency(item.available_balance)}</td>
									<td>
										<input 
											type="text" 
											class="form-control item-amount-input no-spinner" 
											data-invoice="${inv.invoice}"
											data-item="${item.item_code}"
											data-idx="${idx}"
											data-tax-rate="${tax_rate}"
											value="${item.claim_amount.toFixed(2)}" 
											min="0"
											max="${item.available_balance}"
											style="text-align: right;"
											onkeypress="return (event.charCode >= 48 && event.charCode <= 57) || event.charCode === 46"
										>
									</td>
									${include_taxes ? `<td class="text-right">${tax_rate}%</td>` : ''}
									${include_taxes ? `<td class="text-right tax-amount" data-invoice="${inv.invoice}" data-item="${item.item_code}">${format_currency(tax_amount)}</td>` : ''}
								</tr>
							`;
						});
						
						// Calculate total tax for this invoice
						let total_tax = 0;
						invoice_items.forEach(item => {
							if (item.available_balance > 0) {
								let tax_rate = item.tax_rate || 0;
								let tax_amount = include_taxes ? flt(item.claim_amount * tax_rate / 100) : 0;
								total_tax += tax_amount;
							}
						});
						
						// Add a totals row
						let colspan = include_taxes ? 5 : 3;
						html += `
							<tr class="table-active">
								<td colspan="${colspan}" class="text-right"><strong>${__('Total')}:</strong></td>
								<td class="amount-total" data-invoice="${inv.invoice}">${format_currency(total_amount)}</td>
								${include_taxes ? '<td></td>' : ''}
								${include_taxes ? `<td class="text-right">${format_currency(total_tax)}</td>` : ''}
							</tr>
						`;
						
						html += `
										</tbody>
									</table>
								</div>
							</div>
						`;
						
						// Update invoice claim amount
						let invoice_index = dialog.invoices_data.findIndex(i => i.invoice === inv.invoice);
						if (invoice_index !== -1) {
							dialog.invoices_data[invoice_index].claim_amount = total_amount;
						}
					});
					
					html += '</div>';
					
					// Update the total claim amount for all selected invoices
					let total_claim = 0;
					selected_invoices.forEach(inv => {
						total_claim += flt(inv.claim_amount);
					});
					dialog.set_value('total_claim_amount', total_claim);
					
					// Add the HTML to the dialog
					dialog.fields_dict.items_preview_html.html(html);
					
					// Add style for input spinners and table responsiveness
					dialog.$wrapper.find('head').append(`
						<style>
							/* Remove spinners from number inputs */
							input.no-spinner::-webkit-outer-spin-button,
							input.no-spinner::-webkit-inner-spin-button {
								-webkit-appearance: none;
								margin: 0;
							}
							input.no-spinner[type=number] {
								-moz-appearance: textfield;
							}
							/* Style for selected invoices badges */
							.selected-invoices-summary {
								font-size: 0.9em;
								max-height: 150px;
								overflow-y: auto;
								display: flex;
								flex-wrap: wrap;
							}
							.selected-invoices-summary .badge {
								font-size: 0.85em;
								margin-right: 3px;
								margin-bottom: 3px;
							}
							/* Fix table responsiveness and column widths */
							.modal-dialog {
								max-width: 95% !important;
								width: 95% !important;
							}
							.table-responsive {
								overflow-x: auto;
								-webkit-overflow-scrolling: touch;
							}
							.item-allocation-table,
							.invoices-table {
								min-width: 100%;
								white-space: nowrap;
							}
							.item-allocation-table th,
							.item-allocation-table td,
							.invoices-table th,
							.invoices-table td {
								padding: 8px 12px;
								min-width: 100px;
							}
							.item-allocation-table th:first-child,
							.item-allocation-table td:first-child,
							.invoices-table th:first-child,
							.invoices-table td:first-child {
								min-width: 150px;
								white-space: normal;
							}
							.item-allocation-table .text-right,
							.invoices-table .text-right {
								min-width: 120px;
							}
							.item-amount-input {
								min-width: 100px;
							}
						</style>
					`);
					
					// Attach event handlers to inputs
					dialog.$wrapper.find('.item-amount-input').on('change', function() {
						let $this = $(this);
						let invoice = $this.data('invoice');
						let item_code = $this.data('item');
						let idx = $this.data('idx');
						let amount = parseFloat($this.val()) || 0;
						
						// Validate against available balance
						let invoice_items = items_by_invoice[invoice];
						if (invoice_items && invoice_items[idx]) {
							let available_balance = invoice_items[idx].available_balance;
							if (amount > available_balance) {
								amount = available_balance;
								$this.val(amount.toFixed(2));
								frappe.show_alert({
									message: __('Amount cannot exceed available balance'),
									indicator: 'orange'
								}, 3);
							}
							
							// Update the claim amount in our data
							invoice_items[idx].claim_amount = amount;
							
							// Recalculate the total for this invoice
							let invoice_total = 0;
							invoice_items.forEach(item => {
								invoice_total += flt(item.claim_amount || 0);
							});
							
							// Update the invoice amount in our data
							let invoice_index = dialog.invoices_data.findIndex(inv => inv.invoice === invoice);
							if (invoice_index !== -1) {
								dialog.invoices_data[invoice_index].claim_amount = invoice_total;
							}
							
							// Update the invoice total in the UI
							dialog.$wrapper.find('.amount-total[data-invoice="' + invoice + '"]').text(format_currency(invoice_total));
							
							// Also recalculate ratios internally (hidden from user)
							if (invoice_total > 0) {
								invoice_items.forEach(item => {
									item.ratio = flt(item.claim_amount || 0) / invoice_total * 100;
								});
							}
							
							// Update the total claim amount
							update_total_claim_amount(dialog);
						}
					});
				}
				
				// Process each selected invoice to get its items
				invoice_names.forEach(invoice_name => {
					frappe.model.with_doc('Sales Invoice', invoice_name, function() {
						let invoice_doc = frappe.get_doc('Sales Invoice', invoice_name);
						
						if (invoice_doc && invoice_doc.items && invoice_doc.items.length > 0) {
							// Process each item in the invoice
							invoice_doc.items.forEach(item => {
								all_items.push({
									invoice: invoice_name,
									item_code: item.item_code,
									item_name: item.item_name,
									amount: item.amount,
									income_account: item.income_account,
									custom_default_earning_account: item.custom_default_earning_account
								});
							});
						}
						
						processed_count++;
						
						// If all invoices have been processed, show the results
						if (processed_count === invoice_names.length) {
							process_results();
						}
					});
				});
			}
		});
	}
}

function create_bulk_orbit_claim(frm, dialog) {
	console.log("Creating bulk orbit claim");
	
	// Get selected invoices and validate
	let selected_invoices = dialog.invoices_data.filter(inv => inv.select && flt(inv.claim_amount) > 0);
	
	// Also include any selected invoices from other project contractors that aren't in current view
	if (dialog.selected_invoices && dialog.selected_invoices.size > 0) {
		let all_selected_invoice_names = Array.from(dialog.selected_invoices);
		let current_selected_names = selected_invoices.map(inv => inv.invoice);
		
		// Find invoices that are selected but not in current view
		let missing_invoice_names = all_selected_invoice_names.filter(
			name => !current_selected_names.includes(name) && 
			        dialog.saved_claim_amounts[name] // Only include if we have claim amounts saved
		);
		
		console.log("Missing invoice names:", missing_invoice_names);
		
		// Try to fetch these missing invoices from saved data
		if (missing_invoice_names.length > 0) {
			frappe.call({
				method: "frappe.client.get_list",
				args: {
					doctype: "Sales Invoice",
					filters: {
						name: ["in", missing_invoice_names]
					},
					fields: ["name as invoice", "posting_date as invoice_date", "due_date", 
							"status", "project", "custom_for_project as project_contractor"]
				},
				callback: function(r) {
					if (r.message) {
						let missing_invoices = r.message;
						
						// Add the saved claim amounts to these invoices
						missing_invoices.forEach(inv => {
							inv.select = 1; // Mark as selected
							
							// Get the saved claim amount for this invoice
							if (dialog.saved_claim_amounts[inv.invoice]) {
							let total_claim = 0;
								
								// Sum up all item claim amounts for this invoice
								Object.values(dialog.saved_claim_amounts[inv.invoice]).forEach(amount => {
									total_claim += flt(amount);
								});
								
								inv.claim_amount = total_claim;
								}
							});
							
						// Add these to our selected_invoices
						selected_invoices = selected_invoices.concat(missing_invoices);
						
						// Process the combined list
						processSelectedInvoices();
					} else {
						// If we can't get the missing invoices, just proceed with what we have
						processSelectedInvoices();
							}
						}
					});
		} else {
			// No missing invoices, proceed with what we have
			processSelectedInvoices();
				}
	} else {
		// No additional selected invoices, proceed directly
		processSelectedInvoices();
	}
	
	function processSelectedInvoices() {
		// Check if we have selected invoices
	console.log("Selected invoices:", selected_invoices);
		console.log("Total selected invoices:", selected_invoices.length);
	
		if (!selected_invoices || selected_invoices.length === 0) {
			frappe.msgprint(__('No invoices selected with claim amounts.'));
		return;
	}
	
		// Get all unique invoice names
		let invoice_names = selected_invoices.map(inv => inv.invoice);
		console.log("Invoice names:", invoice_names);
		
		// Check if all invoices have the same customer
		let customers = [...new Set(selected_invoices.map(inv => inv.customer).filter(Boolean))];
		if (customers.length > 1) {
			frappe.msgprint(__('Selected invoices must all be for the same customer.'));
		return;
	}
	
		// Set the customer on the form if it's not already set
		if (!frm.doc.customer && customers.length === 1) {
			frm.set_value('customer', customers[0]);
		}
		
		// Create a list of all project contractors from the selected invoices
		let project_contractors = selected_invoices
		.map(inv => inv.project_contractor)
			.filter(Boolean);
			
		let unique_projects = new Set();
	
		// Collect the unique projects from the invoices
	selected_invoices.forEach(inv => {
			if (inv.project) {
				unique_projects.add(inv.project);
			}
			if (inv.project_contractor) {
				unique_projects.add(inv.project_contractor);
			}
		});
				
		console.log("Unique projects:", Array.from(unique_projects));
		
		// Get all invoice items for these invoices
					frappe.call({
			method: "svg_mobile_app.svg_mobile_app.doctype.orbit_claim.orbit_claim.get_items_from_invoices",
						args: {
							invoices: invoice_names
						},
			callback: function(data) {
				if (data.message) {
					createClaimItemsFromInvoices(data.message, invoice_names);
								} else {
					frappe.msgprint(__('Failed to retrieve invoice items.'));
				}
								}
							});
		
		// Function to create claim items from invoice items
		function createClaimItemsFromInvoices(items_data, invoice_names) {
			console.log("Items data received:", items_data);
			
							// Group items by invoice
							let items_by_invoice = {};
			let items_by_invoice_for_being = {};
			let total_by_invoice = {};
			
			// Create a map to look up items by invoice
			items_data.forEach(item => {
								if (!items_by_invoice[item.invoice]) {
									items_by_invoice[item.invoice] = [];
					items_by_invoice_for_being[item.invoice] = [];
					total_by_invoice[item.invoice] = 0;
								}
								items_by_invoice[item.invoice].push(item);
			});
			
			// Create claim items based on the selected invoices
			let claim_items = [];
			let total_claim_amount = 0;
			let total_claimable_amount = 0;
			
			// Get the claim amounts for each invoice and item either from the UI or saved values
			selected_invoices.forEach(inv => {
				let invoice_items = items_by_invoice[inv.invoice] || [];
				if (invoice_items.length === 0) return;
				
				let claim_amount = flt(inv.claim_amount);
				total_claim_amount += claim_amount;
				total_claimable_amount += claim_amount;
				
				if (dialog.saved_claim_amounts[inv.invoice]) {
					// We have saved claim amounts for items in this invoice
					const saved_amounts = dialog.saved_claim_amounts[inv.invoice];
					
					// Process each item in the invoice
					invoice_items.forEach(item => {
						const item_code = item.item_code;
						let item_claim_amount = 0;
						
						// Use the saved amount if available, otherwise calculate proportionally
						if (saved_amounts[item_code] !== undefined) {
							item_claim_amount = flt(saved_amounts[item_code]);
								} else {
							// Fallback to proportional allocation if no saved amount
							item_claim_amount = flt(claim_amount * item.ratio / 100);
								}
						
						if (item_claim_amount > 0) {
							// Create a claim item
							claim_items.push({
								item: item_code,
								item_name: item.item_name,
								amount: item_claim_amount,
								ratio: 0, // Will calculate later
								invoice_reference: inv.invoice,
								income_account: item.income_account || item.custom_default_earning_account,
								unearned_account: item.income_account || '',
								revenue_account: item.custom_default_earning_account || '',
								project_contractor_reference: inv.project_contractor || '',
								current_balance: item.available_balance || item_claim_amount
							});
							
							// Track for the being field
							items_by_invoice_for_being[inv.invoice].push({
								item_code: item_code,
								item_name: item.item_name,
								amount: item_claim_amount
							});
							
							// Update the invoice total
							total_by_invoice[inv.invoice] += item_claim_amount;
						}
					});
				} else {
					// No saved amounts, allocate proportionally
					invoice_items.forEach(item => {
						// Calculate claim amount for this item based on ratio
						let item_claim_amount = flt(claim_amount * item.ratio / 100);
						
						if (item_claim_amount > 0) {
							// Create a claim item
							claim_items.push({
								item: item.item_code,
								item_name: item.item_name,
								amount: item_claim_amount,
								ratio: 0, // Will calculate later
								invoice_reference: inv.invoice,
								income_account: item.income_account || item.custom_default_earning_account,
								unearned_account: item.income_account || '',
								revenue_account: item.custom_default_earning_account || '',
								project_contractor_reference: inv.project_contractor || '',
								current_balance: item.available_balance || item_claim_amount
							});
							
							// Track for the being field
							items_by_invoice_for_being[inv.invoice].push({
								item_code: item.item_code,
								item_name: item.item_name,
								amount: item_claim_amount
							});
							
							// Update the invoice total
							total_by_invoice[inv.invoice] += item_claim_amount;
				}
			});
				}
			});
			
			// Calculate ratios for claim items based on total claim amount
			if (total_claim_amount > 0) {
				claim_items.forEach(item => {
					item.ratio = flt(item.amount) / total_claim_amount * 100;
				});
			}
			
			// Create the claim
			createClaimFromProcessedItems();
		}
	}
	
	function createClaimFromProcessedItems() {
		// Calculate claim amounts for each item using edited values
		let claim_items = [];
		let references = [];
		let total_claim_amount = 0;
		let unique_projects = new Set();
		
		// Group claim items by invoice for detailed description
		let items_by_invoice_for_being = {};
		let total_by_invoice = {};
		
		// Initialize the maps with invoice names
		let invoice_names = selected_invoices.map(inv => inv.invoice);
		invoice_names.forEach(inv => {
			items_by_invoice_for_being[inv] = [];
			total_by_invoice[inv] = 0;
		});
		
		console.log("Selected invoices before processing:", selected_invoices.map(inv => ({
			invoice: inv.invoice,
			project: inv.project,
			project_contractor: inv.project_contractor
		})));
		
		// Get project contractor names for selected invoices (same way as invoice_names)
		let project_contractor_names = selected_invoices
			.map(inv => inv.project_contractor)
			.filter(Boolean); // Remove null/undefined values
		
		console.log("Project contractor names collected:", project_contractor_names);
		
					// Process each invoice
			const include_taxes = dialog.get_value('include_taxes');
			
			selected_invoices.forEach(inv => {
				let invoice_items = dialog.items_by_invoice[inv.invoice] || [];
				if (invoice_items.length === 0) return;
				
				let claim_amount = flt(inv.claim_amount);
				
				// Always add the project_contractor to unique_projects, regardless of whether it matches the project
				if (inv.project_contractor) {
					unique_projects.add(inv.project_contractor);
					console.log(`Added project_contractor ${inv.project_contractor} from invoice ${inv.invoice}`);
				}
				
				// Also add the project if it exists and differs from the project_contractor
				if (inv.project) {
					unique_projects.add(inv.project);
					console.log(`Added project ${inv.project} from invoice ${inv.invoice}`);
				}

				// Store reference for description
				references.push({
					invoice: inv.invoice,
					amount: claim_amount,
					date: inv.invoice_date,
					due_date: inv.due_date,
					project: inv.project,
					project_contractor: inv.project_contractor || '',
					status: inv.status
				});
			
			// Process items from each invoice
			if (dialog.saved_claim_amounts[inv.invoice]) {
				// Use user-edited amounts
				const savedAmounts = dialog.saved_claim_amounts[inv.invoice];
				
				// Calculate the total saved amount for this invoice
				let saved_total = 0;
				Object.values(savedAmounts).forEach(amount => {
					saved_total += flt(amount);
				});
				
									// Process each item with its edited amount
					invoice_items.forEach(item => {
						const item_code = item.item_code;
						if (!item_code || !savedAmounts[item_code]) return;
						
						const amount = flt(savedAmounts[item_code]);
						if (amount <= 0) return;
						
						// Get the tax rate and calculate tax amount based on include_taxes setting
						let tax_rate = flt(item.tax_rate || 0);
						const include_taxes = dialog.get_value('include_taxes');
						let tax_amount = include_taxes ? flt(amount * tax_rate / 100) : 0;
					
					// Add to total
						total_claim_amount += amount;
					
						// Create claim item
						claim_items.push({
							item: item_code,
							item_name: item.item_name,
							amount: amount,
							ratio: saved_total > 0 ? (amount / saved_total * 100) : 0,
							invoice_reference: inv.invoice,
							income_account: item.income_account || item.custom_default_earning_account,
							unearned_account: item.income_account || '',
							revenue_account: item.custom_default_earning_account || '',
							project_contractor_reference: inv.project_contractor || '',
							current_balance: item.available_balance || amount,
							tax_rate: tax_rate,
							tax_amount: tax_amount
						});
					
					// Track for the being field
					items_by_invoice_for_being[inv.invoice].push({
						item_code: item_code,
						item_name: item.item_name,
						amount: amount
					});
					
					// Update the invoice total
					total_by_invoice[inv.invoice] += amount;
				});
			} else {
				// No edited amounts, use proportional allocation
				let invoice_total = 0;
				invoice_items.forEach(item => {
					invoice_total += flt(item.amount);
				});
				
				if (invoice_total > 0 && claim_amount > 0) {
					invoice_items.forEach(item => {
						const ratio = flt(item.amount) / invoice_total;
						const amount = flt(claim_amount * ratio);
						
						if (amount > 0) {
							// Add to total
							total_claim_amount += amount;
							
							// Create claim item
				claim_items.push({
					item: item.item_code,
								item_name: item.item_name,
								amount: amount,
								ratio: ratio * 100,
								invoice_reference: inv.invoice,
								income_account: item.income_account || item.custom_default_earning_account,
								unearned_account: item.income_account || '',
								revenue_account: item.custom_default_earning_account || '',
								project_contractor_reference: inv.project_contractor || '',
								current_balance: item.available_balance || amount
							});
							
							// Track for the being field
							items_by_invoice_for_being[inv.invoice].push({
								item_code: item.item_code,
								item_name: item.item_name,
								amount: amount
							});
							
							// Update the invoice total
							total_by_invoice[inv.invoice] += amount;
				}
			});
				}
			}
		});
		
		console.log("Created claim items:", claim_items);
		console.log("Total claim amount:", total_claim_amount);
		
		// Filter out any items with zero amount
		let filtered_claim_items = claim_items.filter(item => flt(item.amount) > 0);
		
		// We need at least one claim item
		if (filtered_claim_items.length === 0) {
			frappe.msgprint(__('No valid claim items could be created.'));
			return;
		}
		
		// Recalculate ratios for all items based on total
		if (total_claim_amount > 0) {
			filtered_claim_items.forEach(item => {
				item.ratio = flt(item.amount) / total_claim_amount * 100;
			});
		}
		
		// Create description for being field
		let being_text = "";
		
		// List all invoices with their details
		being_text += "Reference Invoices: " + references.map(ref => ref.invoice).join(", ") + "\n\n";
		
		// Format date for display
		function formatDate(date_str) {
			if (!date_str) return 'N/A';
			let d = new Date(date_str);
			return d.toLocaleDateString();
		}
		
		// Create the detailed description
		references.forEach(ref => {
			let inv_items = items_by_invoice_for_being[ref.invoice] || [];
			let inv_total = total_by_invoice[ref.invoice] || 0;
			
			// Format status and due date
			let status_text = ref.status || '';
			let due_date_text = ref.due_date ? ref.due_date : 'N/A';
			
			// Remove all project/project_contractor references - simply don't include them
			being_text += `- ${ref.invoice} \n`;
			being_text += `  Total Claimed: ${format_currency(inv_total)} of ${format_currency(ref.amount)} claimable\n`;
			
			if (inv_items.length > 0) {
				being_text += `  Items:\n`;
				inv_items.forEach(item => {
					being_text += `    • ${item.item_name} (${item.item_code}): ${format_currency(item.amount)}\n`;
				});
			}
			
			being_text += '\n';
		});
		
		console.log("Claim items created:", claim_items);
		
		// Determine which invoice to use as the main reference
		// We'll use the first selected invoice with the highest claim amount
		let primary_invoice = selected_invoices.sort((a, b) => 
			flt(b.claim_amount) - flt(a.claim_amount)
		)[0].invoice;
		
		// Get primary project as the one with the highest claim amount
		let primary_project = selected_invoices.sort((a, b) => 
			flt(b.claim_amount) - flt(a.claim_amount)
		)[0].project;
		
		// Format all projects for display
		let all_projects = Array.from(unique_projects).join(", ");
		
		console.log("Final unique_projects set:", Array.from(unique_projects));
		console.log("Value being set to project_references:", all_projects);
		
		// Create the claim
		frappe.call({
			method: "frappe.client.get",
			args: {
				doctype: "Sales Invoice",
				name: primary_invoice
			},
			callback: function(data) {
				if (!data.message) {
					frappe.msgprint(__('Failed to retrieve invoice details.'));
					return;
				}
				
				console.log("Creating orbit claim for invoice:", primary_invoice);
				
				// Set all form values from the dialog and processed data
				
				// Helper function to set form values without triggering events
				function set_value_quietly(field, value) {
					// Only set the value if it's different
					if (frm.doc[field] !== value) {
					frm.doc[field] = value;
						frm.refresh_field(field);
					}
				}
				
				// Prepare fields
				let customer = dialog.get_value('customer') || data.message.customer;
				let customer_name = data.message.customer_name;
				
				// Clear form first
				frm.clear_table('claim_items');
				
				// Set basic info
				set_value_quietly('customer', customer);
				set_value_quietly('customer_name', customer_name);

				// Set the party_account from the debit_to field
				set_value_quietly('party_account', data.message.debit_to);

				// Set orbit-specific fields that are different from project claim
				set_value_quietly('payment_type', 'Orbital');
				
				// Set default currency if not already set
				if (!frm.doc.currency) {
					set_value_quietly('currency', data.message.currency || 'AED');
					}
				
				// Set posting date to today if not set
				if (!frm.doc.posting_date) {
					set_value_quietly('posting_date', frappe.datetime.get_today());
				}
				
				// Set project info
				if (unique_projects.size === 1) {
					// Only one project - use it directly
					let project = Array.from(unique_projects)[0];
					set_value_quietly('for_project', project);
					
					// Try to get project name
					frappe.db.get_value('Project Contractors', project, ['project_name'], function(r) {
						if (r && r.project_name) {
							set_value_quietly('project_name', r.project_name);
							frm.refresh_field('project_name');
						}
					});
				} else if (unique_projects.size > 1) {
					// Multiple projects - use references field
					set_value_quietly('project_references', all_projects);
				}

				// Set all multi-invoice references
				set_value_quietly('invoice_references', references.map(ref => ref.invoice).join(", "));
				
				// Calculate tax amounts
				let total_tax_amount = 0;
				filtered_claim_items.forEach(item => {
					total_tax_amount += flt(item.tax_amount || 0);
				});
				
				// Calculate tax ratio from the first taxable item
				let tax_ratio = 0;
				// Always get tax ratio from taxable items (tax_rate > 0), not from first item
				let taxable_item = filtered_claim_items.find(item => flt(item.tax_rate || 0) > 0);
				if (taxable_item) {
					// Use the tax rate from taxable items (should be 5% from UAE VAT template)
					tax_ratio = taxable_item.tax_rate;
				}
				
				// Set amounts
				let total_claimable_amount = total_claim_amount;
				set_value_quietly('claim_amount', total_claimable_amount);
				set_value_quietly('claimable_amount', total_claimable_amount);
				set_value_quietly('outstanding_amount', total_claimable_amount);  // Ensure outstanding_amount is set
				set_value_quietly('tax_amount', total_tax_amount);
				set_value_quietly('tax_ratio', tax_ratio);
				set_value_quietly('being', being_text);
				set_value_quietly('reference_invoice', primary_invoice);
				set_value_quietly('invoice_references', invoice_names.join(", "));
				
				// Store key values to ensure they aren't lost
				let saved_values = {
					customer: dialog.get_value('customer'),
					party_account: data.message.debit_to,
					claim_amount: total_claimable_amount,
					claimable_amount: total_claimable_amount,
					outstanding_amount: total_claimable_amount
				};
				
				// Always show the project_references field, even with one project
				frm.set_df_property('project_references', 'hidden', 0);
				
				// Only hide for_project and project_name if we have multiple projects
				if (unique_projects.size > 1) {
					frm.set_df_property('for_project', 'hidden', 1);
					frm.set_df_property('project_name', 'hidden', 1);
				} else {
					frm.set_df_property('for_project', 'hidden', 0);
					frm.set_df_property('project_name', 'hidden', 0);
				}
				
				// Clear existing items and add new ones
				frm.clear_table('claim_items');
				filtered_claim_items.forEach(item => {
					let row = frm.add_child('claim_items', item);
				});
				
				// Update form and close dialog
				frm.refresh_fields();
				
				// Re-enable save after everything is done
				setTimeout(function() {
					frm.enable_save();
				
				// Show success message
					frappe.show_alert({
						message: __('Orbit Claim created successfully from {0} invoices.', [references.length]),
						indicator: 'green'
					}, 5);
				}, 500);
			}
		});
	}
}

// Email dialog function
window.show_email_dialog = function(frm) {
	if (!frm.doc.customer || !frm.doc.customer_name) {
		frappe.msgprint(__('Customer information is required to send email.'));
		return;
	}
	
	// Get customer email
	frappe.call({
		method: "frappe.client.get_value",
		args: {
			doctype: "Customer",
			filters: {"name": frm.doc.customer},
			fieldname: ["email_id", "customer_primary_contact"]
		},
		callback: function(r) {
			let customer_email = '';
			
			if (r.message && r.message.email_id) {
				customer_email = r.message.email_id;
			} else if (r.message && r.message.customer_primary_contact) {
				// Get email from primary contact
				frappe.call({
					method: "frappe.client.get_value",
					args: {
						doctype: "Contact",
						filters: {"name": r.message.customer_primary_contact},
						fieldname: "email_id"
					},
					callback: function(contact_r) {
						if (contact_r.message && contact_r.message.email_id) {
							customer_email = contact_r.message.email_id;
						}
						show_email_compose_dialog(frm, customer_email);
					}
				});
				return;
			}
			
			show_email_compose_dialog(frm, customer_email);
		}
	});
};

function show_email_compose_dialog(frm, customer_email) {
	let dialog = new frappe.ui.Dialog({
		title: __('Send Orbit Claim Receipt'),
		fields: [
			{
				fieldname: 'to_email',
				label: __('To Email'),
				fieldtype: 'Data',
				reqd: 1,
				default: customer_email
			},
			{
				fieldname: 'cc_email',
				label: __('CC Email'),
				fieldtype: 'Data'
			},
			{
				fieldname: 'subject',
				label: __('Subject'),
				fieldtype: 'Data',
				reqd: 1,
				default: __('Orbit Claim Receipt - {0}', [frm.doc.name])
			},
			{
				fieldname: 'message',
				label: __('Message'),
				fieldtype: 'Text Editor',
				reqd: 1,
				default: `
					<p>Dear ${frm.doc.customer_name || frm.doc.customer},</p>
					<p>Please find attached the Orbit Claim receipt for your reference.</p>
					<p><strong>Claim Details:</strong></p>
					<ul>
						<li>Claim Number: ${frm.doc.name}</li>
						<li>Claim Amount: ${frappe.format(frm.doc.claim_amount, {fieldtype: 'Currency'})}</li>
						<li>Date: ${frm.doc.date}</li>
						<li>Reference Invoice: ${frm.doc.reference_invoice}</li>
					</ul>
					<p>Thank you for your business.</p>
					<p>Best regards,<br>SVG Team</p>
				`
			}
		],
		primary_action_label: __('Send Email'),
		primary_action: function() {
			let values = dialog.get_values();
			if (!values) return;
			
			// Send email with PDF attachment
			frappe.call({
				method: "frappe.core.doctype.communication.email.make",
				args: {
					recipients: values.to_email,
					cc: values.cc_email || '',
					subject: values.subject,
					content: values.message,
					doctype: 'Orbit Claim',
					name: frm.doc.name,
					send_email: 1,
					print_format: 'Orbit Claim',
					attach_document_print: 1
				},
				callback: function(r) {
					if (!r.exc) {
						frappe.show_alert({
							message: __('Email sent successfully'),
							indicator: 'green'
						}, 3);
						dialog.hide();
					}
				}
			});
		}
	});
	
	dialog.show();
}

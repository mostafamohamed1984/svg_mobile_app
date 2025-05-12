// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project Claim", {
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
					return {
						filters: {
							'customer': dialog.get_value('customer')
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
			}
		],
		primary_action_label: __('Create Project Claim'),
		primary_action: function() {
			// Before creating the project claim, make sure all selected invoices are displayed in the preview
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
					
					// Disable save before creating the project claim
					frm.disable_save();
					
					// Prevent auto-save by just calling the function and closing the dialog
					create_bulk_project_claim(frm, dialog);
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
			
			// Disable save before creating the project claim
			frm.disable_save();
			
			// Prevent auto-save by just calling the function and closing the dialog
			create_bulk_project_claim(frm, dialog);
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
		const value = parseFloat($(this).val()) || 0;
		console.log(`Amount for item ${item} in invoice ${invoice} changed to ${value}`);
		
		// Find the invoice items
		let invoice_items = dialog.items_by_invoice[invoice] || [];
		if (invoice_items && invoice_items[idx]) {
			// Update the amount directly and recalculate ratios internally (hidden from user)
			invoice_items[idx].claim_amount = value;
			
			// Save the claim amount in our persistent storage
			if (!dialog.saved_claim_amounts[invoice]) {
				dialog.saved_claim_amounts[invoice] = {};
			}
			dialog.saved_claim_amounts[invoice][item] = value;
			
			// Recalculate the total for this invoice
			let invoice_total = 0;
			invoice_items.forEach(item => {
				invoice_total += flt(item.claim_amount || 0);
			});
			
			// Update the invoice's claim amount
			let invoice_index = dialog.invoices_data.findIndex(inv => inv.invoice === invoice);
			if (invoice_index !== -1) {
				dialog.invoices_data[invoice_index].claim_amount = invoice_total;
			}
			
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
					method: 'svg_mobile_app.svg_mobile_app.doctype.project_claim.project_claim.get_available_invoice_balances',
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
				<table class="table table-bordered">
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
	
	// Sum up claim amounts for selected invoices in current view
	dialog.invoices_data.forEach(inv => {
		if (inv.select) {
			total += flt(inv.claim_amount);
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
							// Store the project_contractor consistently
							let project_contractor = inv.custom_for_project || '';
							return {
								'invoice': inv.name,
								'invoice_date': inv.posting_date,
								'project': inv.custom_for_project || '',
								'project_contractor': project_contractor,
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
			method: 'svg_mobile_app.svg_mobile_app.doctype.project_claim.project_claim.get_available_invoice_balances',
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
					all_items.forEach(item => {
						if (balance_data[item.invoice] && balance_data[item.invoice][item.item_code]) {
							item.original_amount = balance_data[item.invoice][item.item_code].original_amount;
							item.claimed_amount = balance_data[item.invoice][item.item_code].claimed_amount;
							item.available_balance = balance_data[item.invoice][item.item_code].available_balance;
							console.log(`Item ${item.item_code} from invoice ${item.invoice}: Original=${item.original_amount}, Claimed=${item.claimed_amount}, Available=${item.available_balance}`);  // Debug log
						} else {
							// Default to original amount if no balance data
							item.available_balance = item.amount;
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
											value="${Math.round(item.claim_amount * 100) / 100}" 
											min="0"
											max="${item.available_balance}"
											style="text-align: right;"
											onchange="this.value = Math.round(parseFloat(this.value || 0) * 100) / 100"
											onkeypress="return (event.charCode >= 48 && event.charCode <= 57) || event.charCode === 46"
										>
									</td>
								</tr>
							`;
						});
						
						// Add a totals row
						html += `
							<tr class="table-active">
								<td colspan="3" class="text-right"><strong>${__('Total')}:</strong></td>
								<td class="amount-total" data-invoice="${inv.invoice}">${format_currency(total_amount)}</td>
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
					
					// Add style for input spinners
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
						
						// Find the matching selected invoice object to get project_contractor
						let selected_invoice = selected_invoices.find(inv => inv.invoice === invoice_name);
						let project_contractor = selected_invoice ? selected_invoice.project_contractor || '' : '';
						
						console.log(`Processing invoice ${invoice_name} with project_contractor: ${project_contractor}`);

						if (invoice_doc && invoice_doc.items && invoice_doc.items.length > 0) {
							// Process each item in the invoice
							invoice_doc.items.forEach(item => {
								all_items.push({
									invoice: invoice_name,
									item_code: item.item_code,
									item_name: item.item_name,
									amount: item.amount,
									income_account: item.income_account,
									custom_default_earning_account: item.custom_default_earning_account,
									project_contractor: project_contractor, // Store the project_contractor with each item
									claim_amount: 0 // Initialize with 0
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

function create_bulk_project_claim(frm, dialog) {
	console.log("Creating bulk project claim");
	
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
		
		if (missing_invoice_names.length > 0) {
			console.log("Found additional selected invoices not in current view:", missing_invoice_names);
			
			// We need to include these in our processing
			// First, we need to ensure we have the necessary invoice data in items_by_invoice
			if (dialog.items_by_invoice) {
				let all_invoice_names = Object.keys(dialog.items_by_invoice);
				let has_all_invoices = missing_invoice_names.every(name => all_invoice_names.includes(name));
				
				if (has_all_invoices) {
					// For each missing invoice, create a dummy invoice object to include in processing
					missing_invoice_names.forEach(name => {
						let invoice_items = dialog.items_by_invoice[name] || [];
						if (invoice_items.length > 0) {
							// Calculate total claim amount for this invoice
							let total_claim = 0;
							invoice_items.forEach(item => {
								// Use saved claim amount if available
								if (dialog.saved_claim_amounts[name] && 
									dialog.saved_claim_amounts[name][item.item_code] !== undefined) {
									item.claim_amount = dialog.saved_claim_amounts[name][item.item_code];
									total_claim += flt(item.claim_amount);
								}
							});
							
							// Create a dummy invoice object
							let dummy_invoice = {
								invoice: name,
								select: 1,
								claim_amount: total_claim,
								project: invoice_items[0].project || '',
								// Other fields might not be needed but include what we have
								invoice_date: '',
								due_date: '',
								status: '',
								claimable_amount: total_claim
							};
							
							// Add to selected_invoices if it has a positive claim amount
							if (total_claim > 0) {
								selected_invoices.push(dummy_invoice);
							}
						}
					});
				}
			}
		}
	}
	
	console.log("Selected invoices:", selected_invoices);
	
	if (selected_invoices.length === 0) {
		frappe.msgprint(__('Please select at least one invoice and set claim amount'));
		return;
	}
	
	// Validate claim amounts
	let invalid_claims = selected_invoices.filter(inv => flt(inv.claim_amount) > flt(inv.claimable_amount));
	if (invalid_claims.length > 0) {
		let error_list = invalid_claims.map(inv => `${inv.invoice}: ${format_currency(inv.claim_amount)} > ${format_currency(inv.claimable_amount)}`).join('<br>');
		frappe.msgprint(__('Claim Amount cannot exceed Claimable Amount for the following invoices:<br>') + error_list);
		return;
	}
	
	// Disable save to prevent auto-save
	frm.disable_save();
	
	// Temporarily disable validation
	frm.skip_validation = true;
	
	// Override validate method temporarily
	let old_validate = frm.validate;
	frm.validate = function() { return true; };
	
	// Get invoice names for selected invoices
	let invoice_names = selected_invoices.map(inv => inv.invoice);
	
	// Get project contractor names for selected invoices (same way as invoice_names)
	let project_contractor_names = selected_invoices
		.map(inv => inv.project_contractor)
		.filter(Boolean); // Remove null/undefined values

	console.log("Project contractor names collected:", project_contractor_names);

	// IMPORTANT: We need to include project contractors from all selected invoices
	// Check if we have any missing project contractors from fields_dict.invoices_table if it exists
	let missing_contractors = [];
	
	// Safely access the grid and its selected children if available
	if (dialog.fields_dict && dialog.fields_dict.invoices_table && 
		dialog.fields_dict.invoices_table.grid && 
		typeof dialog.fields_dict.invoices_table.grid.get_selected_children === 'function') {
		
		missing_contractors = dialog.fields_dict.invoices_table.grid.get_selected_children()
			.filter(row => row.project_contractor && !project_contractor_names.includes(row.project_contractor))
			.map(row => row.project_contractor);
	}

	// Add any missing contractors
	if (missing_contractors.length > 0) {
		console.log("Found additional project contractors not in current view:", missing_contractors);
		project_contractor_names = [...new Set([...project_contractor_names, ...missing_contractors])];
	}

	// Calculate total claimable amount across all selected invoices
	let total_claimable_amount = 0;
	selected_invoices.forEach(inv => {
		total_claimable_amount += flt(inv.claim_amount);
	});
	
	// If we have already processed items, use those directly
	if (dialog.items_by_invoice) {
		createClaimFromProcessedItems();
	} else {
		// Otherwise, process each invoice separately
		let all_items = [];
		let processed_count = 0;

		// Process each invoice to get its items
		invoice_names.forEach(invoice_name => {
			frappe.model.with_doc('Sales Invoice', invoice_name, function() {
				let invoice_doc = frappe.get_doc('Sales Invoice', invoice_name);
				
				// Find the matching selected invoice object to get project_contractor
				let selected_invoice = selected_invoices.find(inv => inv.invoice === invoice_name);
				let project_contractor = selected_invoice ? selected_invoice.project_contractor || '' : '';
				
				console.log(`Processing invoice ${invoice_name} with project_contractor: ${project_contractor}`);

				if (invoice_doc && invoice_doc.items && invoice_doc.items.length > 0) {
					// Process each item in the invoice
					invoice_doc.items.forEach(item => {
						all_items.push({
							invoice: invoice_name,
							item_code: item.item_code,
							item_name: item.item_name,
							amount: item.amount,
							income_account: item.income_account,
							custom_default_earning_account: item.custom_default_earning_account,
							project_contractor: project_contractor, // Store the project_contractor with each item
							claim_amount: 0 // Initialize with 0
						});
					});
				}

				processed_count++;

				// If all invoices have been processed, fetch available balances and show the results
				if (processed_count === invoice_names.length) {
					// Fetch available balances for all items
					frappe.call({
						method: 'svg_mobile_app.svg_mobile_app.doctype.project_claim.project_claim.get_available_invoice_balances',
						args: {
							invoices: invoice_names
						},
						callback: function(balance_result) {
							let balance_data = balance_result.message || {};
							// Set available_balance for each item
							all_items.forEach(item => {
								if (balance_data[item.invoice] && balance_data[item.invoice][item.item_code]) {
									item.original_amount = balance_data[item.invoice][item.item_code].original_amount;
									item.claimed_amount = balance_data[item.invoice][item.item_code].claimed_amount;
									item.available_balance = balance_data[item.invoice][item.item_code].available_balance;
								} else {
									item.available_balance = item.amount;
								}
							});
							// Group items by invoice
							let items_by_invoice = {};
							let invoice_totals = {};
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
							dialog.items_by_invoice = items_by_invoice;
							createClaimFromProcessedItems();
						}
					});
				}
			});
		});
	}
	
	// Function to create claim from processed items
	function createClaimFromProcessedItems() {
		// Calculate claim amounts for each item using edited values
		let claim_items = [];
		let references = [];
		let total_claim_amount = 0;
		let unique_projects = new Set();
		
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
			
			// Process each item with user-entered claim amounts
			invoice_items.forEach(item => {
				// Skip items with zero available balance or claim amount
				if (item.available_balance <= 0 || flt(item.claim_amount) <= 0) return;
				
				// Use the directly entered claim amount (no longer calculated from ratio)
				let allocated_amount = flt(item.claim_amount);
				
				// Round to 2 decimal places to avoid floating-point precision issues
				allocated_amount = Math.round(allocated_amount * 100) / 100;
				
				// Add to total
				total_claim_amount += allocated_amount;
				
				// Get project contractor directly from the invoice's project_contractor field
				let project_contractor = inv.project_contractor || '';
				
				// If item has its own project_contractor from when it was loaded, use that
				if (item.project_contractor) {
					project_contractor = item.project_contractor;
				}
				
				console.log(`Creating claim item for ${item.item_code} from invoice ${inv.invoice} with project_contractor: ${project_contractor}`);
				
				// MODIFIED: Instead of checking for existing items, always create a new entry
				// The invoice_reference field is critical for proper tracking of claimed amounts
				claim_items.push({
					item: item.item_code,
					amount: allocated_amount,
					ratio: 0, // Placeholder, will be calculated later
					unearned_account: item.income_account || '',
					revenue_account: item.custom_default_earning_account || '',
					invoice_reference: inv.invoice, // Critical for proper invoice-level tracking
					project_contractor_reference: project_contractor, // Add project contractor reference from correct invoice
					current_balance: item.available_balance // Add available balance directly
				});
			});
		});
		
		// Now calculate global ratios based on the total claim amount
		if (total_claim_amount > 0) {
			claim_items.forEach(item => {
				item.ratio = flt(item.amount) / total_claim_amount * 100;
			});
		}
		
		// Round ratios to ensure they total exactly 100%
		let total_ratio = 0;
		claim_items.forEach(item => {
			item.ratio = Math.round(item.ratio * 100) / 100; // Round to 2 decimal places
			total_ratio += item.ratio;
		});
		
		// Adjust the last item to make sure total is exactly 100%
		if (claim_items.length > 0) {
			if (total_ratio > 100) {
				// If total exceeds 100%, subtract the excess from the last item
				claim_items[claim_items.length - 1].ratio -= (total_ratio - 100);
			} else if (Math.abs(total_ratio - 100) > 0.01) {
				// If total is under 100% by more than 0.01, add the difference to the last item
				claim_items[claim_items.length - 1].ratio += (100 - total_ratio);
			}
			// Ensure we don't have floating point precision issues
			claim_items[claim_items.length - 1].ratio = Math.round(claim_items[claim_items.length - 1].ratio * 100) / 100;
		}
		
		console.log("Claim items created:", claim_items);
		
		// Create "Being" text with reference to all invoices including project contractor
		let being_text = __('Being claim for invoices:') + '\n\n';
		
		// Group claim items by invoice for detailed description
		let items_by_invoice_for_being = {};
		let total_by_invoice = {};
		
		// Initialize the maps
		invoice_names.forEach(inv => {
			items_by_invoice_for_being[inv] = [];
			total_by_invoice[inv] = 0;
		});
		
		// Group items by invoice for the being text
		claim_items.forEach(item => {
			// Use the invoice_reference directly instead of processed_invoices
			let inv_name = item.invoice_reference;
			
			// Make sure the array exists before trying to push to it
			if (!items_by_invoice_for_being[inv_name]) {
				items_by_invoice_for_being[inv_name] = [];
				total_by_invoice[inv_name] = 0;
			}
			
			// Add item to the correct invoice group
			items_by_invoice_for_being[inv_name].push({
				item_name: item.item_name || item.item,
				item_code: item.item,
				amount: item.amount,
				ratio: item.ratio || 0
			});
			
			// Update total for this invoice
			total_by_invoice[inv_name] += flt(item.amount);
		});
		
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
		
		// Get party account and project from the primary invoice
		frappe.call({
			method: 'frappe.client.get_value',
			args: {
				doctype: 'Sales Invoice',
				filters: { name: primary_invoice },
				fieldname: ['debit_to', 'custom_for_project']
			},
			callback: function(data) {
				console.log("Invoice details response:", data);
				
				if (!data.message) {
					frappe.msgprint(__('Could not fetch account information'));
					return;
				}
				
				// Get the project contractor from the dialog (which was selected by the user)
				let project_contractor = dialog.get_value('project_contractor_filter');
				
				// Calculate total claimable amount across all selected invoices
				let total_claimable_amount = 0;
				selected_invoices.forEach(inv => {
					total_claimable_amount += flt(inv.claim_amount);
				});
				
				// Filter out items with zero or negative available balance before creating claim items
				let filtered_claim_items = claim_items.filter(item => item.amount > 0);
				
				// Explicitly set current_balance for each item
				filtered_claim_items.forEach(item => {
					// Set current_balance equal to available_balance without fallback
					item.current_balance = item.available_balance;
				});
				
				// Use a quieter version of set_value that doesn't trigger validation
				function set_value_quietly(field, value) {
					frm.doc[field] = value;
				}
				
				// Set values in the form without triggering validation
				set_value_quietly('customer', dialog.get_value('customer'));
				set_value_quietly('for_project', data.message.custom_for_project || null);

				// Get all project contractors from all sources
				let all_project_contractors = [];

				// Add from unique_projects (already collected)
				Array.from(unique_projects).forEach(proj => {
					if (proj && !all_project_contractors.includes(proj)) {
						all_project_contractors.push(proj);
					}
				});

				// Check for additional contractors from missing invoices
				if (dialog.project_contractors_from_missing_invoices && dialog.project_contractors_from_missing_invoices.length > 0) {
					dialog.project_contractors_from_missing_invoices.forEach(contractor => {
						if (contractor && !all_project_contractors.includes(contractor)) {
							all_project_contractors.push(contractor);
							console.log(`Added missing project contractor ${contractor} to project_references`);
						}
					});
				}

				// Check for additional contractors from selected rows in the dialog grid
				if (dialog.fields_dict.invoices_table && dialog.fields_dict.invoices_table.grid) {
					let selected_rows = dialog.fields_dict.invoices_table.grid.get_selected_children() || [];
					selected_rows.forEach(row => {
						if (row.project_contractor && !all_project_contractors.includes(row.project_contractor)) {
							all_project_contractors.push(row.project_contractor);
							console.log(`Added project contractor ${row.project_contractor} from selected rows to project_references`);
						}
					});
				}

				// Check for contractors in the invoices_data array too
				if (dialog.invoices_data) {
					dialog.invoices_data.forEach(inv => {
						if (inv.project_contractor && !all_project_contractors.includes(inv.project_contractor)) {
							all_project_contractors.push(inv.project_contractor);
							console.log(`Added project contractor ${inv.project_contractor} from invoices_data to project_references`);
						}
					});
				}

				console.log("Final project contractors collected for project_references:", all_project_contractors);
				set_value_quietly('project_references', all_project_contractors.join(", "));
				console.log("Set project_references to:", all_project_contractors.join(", "), "using all available sources");

				set_value_quietly('project_contractor', project_contractor);
				set_value_quietly('party_account', data.message.debit_to);
				set_value_quietly('claim_amount', total_claimable_amount);
				set_value_quietly('claimable_amount', total_claimable_amount);
				set_value_quietly('outstanding_amount', total_claimable_amount);  // Ensure outstanding_amount is set
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
				
				// Keep save disabled to prevent auto-save validation
				// Leave it to the user to click save when ready
				
				// Force a complete refresh before showing alert
				frm.refresh();
				
				// Show success message
				setTimeout(() => {
					frappe.show_alert({
						message: __('Project Claim created from {0} invoices. Please review and save.', [selected_invoices.length]),
						indicator: 'green'
					}, 5);
					
					// Re-enable save
					frm.enable_save();
					
					// Reset validation
					frm.validate = old_validate;
					frm.skip_validation = false;
				}, 100);
			}
		});
	}
}

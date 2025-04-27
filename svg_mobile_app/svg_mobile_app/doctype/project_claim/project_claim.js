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
					// When customer changes, fetch invoices automatically
					let customer = dialog.get_value('customer');
					console.log("Customer selected:", customer);
					if (customer) {
						fetch_customer_invoices(dialog, customer);
					}
				}
			},
			{
				fieldname: 'action_buttons',
				fieldtype: 'HTML'
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
	});
	
	// Create buttons for actions
	dialog.fields_dict.action_buttons.html(`
		<div class="row" style="margin-top: 20px; margin-bottom: 10px;">
			<div class="col">
				<button id="select_all_btn" type="button" class="btn btn-sm btn-default form-control">
					${__('Select All')}
				</button>
			</div>
			<div class="col">
				<button id="deselect_all_btn" type="button" class="btn btn-sm btn-default form-control">
					${__('Deselect All')}
				</button>
			</div>
			<div class="col">
				<button id="set_full_amount_btn" type="button" class="btn btn-sm btn-default form-control">
					${__('Set Full Amount')}
				</button>
			</div>
		</div>
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
		</style>
	`);
	
	// Initialize the invoices data
	dialog.invoices_data = [];
	
	// Initialize the invoices HTML container
	dialog.fields_dict.invoices_html.html(`
		<div id="invoices_container" class="margin-top">
			<div class="text-muted">${__('Select a customer to view invoices')}</div>
		</div>
	`);
	
	// Attach button click handlers
	dialog.$wrapper.on('click', '#select_all_btn', function() {
		console.log("Select All clicked");
		dialog.invoices_data.forEach(inv => inv.select = 1);
		render_invoices_table(dialog);
		update_total_claim_amount(dialog);
		return false;
	});
	
	dialog.$wrapper.on('click', '#deselect_all_btn', function() {
		console.log("Deselect All clicked");
		dialog.invoices_data.forEach(inv => inv.select = 0);
		render_invoices_table(dialog);
		update_total_claim_amount(dialog);
		return false;
	});
	
	dialog.$wrapper.on('click', '#set_full_amount_btn', function() {
		console.log("Set Full Amount clicked");
		dialog.invoices_data.forEach(inv => {
			if (inv.select) {
				inv.claim_amount = inv.claimable_amount;
			}
		});
		render_invoices_table(dialog);
		update_total_claim_amount(dialog);
		return false;
	});
	
	// Checkbox change handler (will be delegated)
	dialog.$wrapper.on('change', '.invoice-select', function() {
		const index = $(this).data('index');
		console.log(`Checkbox ${index} changed to ${this.checked}`);
		
		dialog.invoices_data[index].select = this.checked ? 1 : 0;
		update_total_claim_amount(dialog);
	});
	
	// Amount input change handler (will be delegated)
	dialog.$wrapper.on('change', '.claim-amount-input', function() {
		const index = $(this).data('index');
		const value = parseFloat($(this).val()) || 0;
		console.log(`Amount ${index} changed to ${value}`);
		
		dialog.invoices_data[index].claim_amount = value;
		update_total_claim_amount(dialog);
	});
	
	dialog.show();
}

function fetch_customer_invoices(dialog, customer) {
	console.log("Fetching invoices for customer:", customer);
	
	// Show loading indicator
	dialog.fields_dict.invoices_html.html(`
		<div class="text-center my-4">
			<i class="fa fa-spinner fa-spin fa-2x"></i>
			<p>${__('Fetching invoices...')}</p>
		</div>
	`);
	
	// Get customer's outstanding invoices
	frappe.call({
		method: 'frappe.client.get_list',
		args: {
			doctype: 'Sales Invoice',
			filters: {
				'customer': customer,
				'docstatus': 1,
				'status': ['in', ['Partly Paid', 'Unpaid', 'Overdue']],
				'outstanding_amount': ['>', 0]
			},
			fields: ['name', 'posting_date', 'custom_for_project', 'status', 'due_date', 'grand_total', 'outstanding_amount'],
			order_by: 'posting_date desc'
		},
		callback: function(response) {
			console.log("API response:", response);
			
			if (response.message && response.message.length > 0) {
				console.log("Found invoices:", response.message.length);
				
				// First prepare basic invoice data
				dialog.invoices_data = response.message.map(inv => {
					return {
						'invoice': inv.name,
						'invoice_date': inv.posting_date,
						'project': inv.custom_for_project || '',
						'status': inv.status,
						'due_date': inv.due_date,
						'total': inv.grand_total,
						'outstanding': inv.outstanding_amount,
						'claim_amount': inv.outstanding_amount, // Will be updated after getting available balances
						'select': 1 // Pre-select all
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
							
							// Update claim amount to the claimable amount instead of outstanding
							inv.claimable_amount = claimable_amount;
							inv.claim_amount = claimable_amount;
						});
						
						// Render the invoices table with updated data
						render_invoices_table(dialog);
						
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
						${__('No outstanding invoices found for this customer')}
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

function render_invoices_table(dialog) {
	if (!dialog.invoices_data || dialog.invoices_data.length === 0) {
		console.log("No invoices to render");
		return;
	}
	
	console.log("Rendering invoices table with data:", dialog.invoices_data);
	
	let html = `
		<div class="margin-top">
			<div class="alert alert-info my-2">
				${__('Found')} ${dialog.invoices_data.length} ${__('outstanding invoices')}
			</div>
			<div class="table-responsive">
				<table class="table table-bordered">
					<thead>
						<tr>
							<th>${__('Select')}</th>
							<th>${__('Invoice')}</th>
							<th>${__('Date')}</th>
							<th>${__('Project')}</th>
							<th>${__('Status')}</th>
							<th>${__('Due Date')}</th>
							<th>${__('Total')}</th>
							<th>${__('Outstanding')}</th>
							<th>${__('Claimable')}</th>
							<th>${__('Claim Amount')}</th>
						</tr>
					</thead>
					<tbody>
	`;
	
	dialog.invoices_data.forEach((inv, index) => {
		html += `
			<tr>
				<td>
					<input 
						type="checkbox" 
						class="invoice-select" 
						data-index="${index}" 
						${inv.select ? 'checked' : ''}
					>
				</td>
				<td>${inv.invoice}</td>
				<td>${inv.invoice_date}</td>
				<td>${inv.project || ''}</td>
				<td>${inv.status}</td>
				<td>${inv.due_date || ''}</td>
				<td class="text-right">${format_currency(inv.total)}</td>
				<td class="text-right">${format_currency(inv.outstanding)}</td>
				<td class="text-right">${format_currency(inv.claimable_amount)}</td>
				<td>
					<input 
						type="text" 
						class="form-control claim-amount-input no-spinner" 
						data-index="${index}" 
						value="${inv.claim_amount}" 
						max="${inv.claimable_amount}"
						${!inv.select ? 'disabled' : ''}
						style="text-align: right;"
						onkeypress="return (event.charCode >= 48 && event.charCode <= 57) || event.charCode === 46"
					>
				</td>
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
}

function update_total_claim_amount(dialog) {
	console.log("Updating total claim amount");
	let total = 0;
	
	// Sum up claim amounts for selected invoices
	dialog.invoices_data.forEach(inv => {
		if (inv.select) {
			total += flt(inv.claim_amount);
		}
	});
	
	console.log("Total claim amount:", total);
	dialog.set_value('total_claim_amount', total);
	
	// Update items preview for selected invoices
	update_items_preview(dialog);
}

function update_items_preview(dialog) {
	console.log("Updating items preview");
	let selected_invoices = dialog.invoices_data.filter(inv => inv.select && flt(inv.claim_amount) > 0);
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
				
				// Then calculate ratios
				all_items.forEach(item => {
					if (invoice_totals[item.invoice] > 0) {
						item.ratio = flt(item.amount) / flt(invoice_totals[item.invoice]) * 100;
					} else {
						item.ratio = 0;
					}
				});
				
				console.log("Grouped items:", items_by_invoice);
				
				// Create HTML for item allocation tables with editable inputs
				let html = '<div class="margin-top">';
				
				selected_invoices.forEach(inv => {
					let invoice_items = items_by_invoice[inv.invoice] || [];
					if (invoice_items.length === 0) return;
					
					// Get claim amount for this invoice
					let claim_amount = flt(inv.claim_amount);
					
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
											<th>${__('Ratio %')}</th>
											<th>${__('Claim Amount')}</th>
										</tr>
									</thead>
									<tbody>
					`;
					
					let total_shown_ratio = 0;
					let total_shown_amount = 0;
					
					invoice_items.forEach((item, idx) => {
						// Skip items with zero available balance
						if (item.available_balance <= 0) return;
						
						// Calculate allocated amount based on ratio (which might have been edited)
						let allocated_amount = Math.min(flt(item.ratio) * claim_amount / 100, item.available_balance || claim_amount);
						
						// Calculate global ratio (relative to total claim amount)
						total_shown_ratio += item.ratio;
						total_shown_amount += allocated_amount;
						
						html += `
							<tr data-item="${item.item_code}" data-invoice="${inv.invoice}" data-idx="${idx}">
								<td>${item.item_name || item.item_code}</td>
								<td class="text-right">${format_currency(item.amount)}</td>
								<td class="text-right">${format_currency(item.available_balance)}</td>
								<td>
									<input 
										type="text" 
										class="form-control item-ratio-input no-spinner" 
										data-invoice="${inv.invoice}"
										data-item="${item.item_code}"
										data-idx="${idx}"
										value="${item.ratio.toFixed(2)}" 
										min="0"
										max="100"
										style="text-align: right;"
										onkeypress="return (event.charCode >= 48 && event.charCode <= 57) || event.charCode === 46"
									>
								</td>
								<td>
									<input 
										type="text" 
										class="form-control item-amount-input no-spinner" 
										data-invoice="${inv.invoice}"
										data-item="${item.item_code}"
										data-idx="${idx}"
										value="${allocated_amount.toFixed(2)}" 
										min="0"
										max="${Math.min(inv.claim_amount, item.available_balance)}"
										style="text-align: right;"
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
							<td class="ratio-total" data-invoice="${inv.invoice}">${total_shown_ratio.toFixed(2)}%</td>
							<td class="amount-total" data-invoice="${inv.invoice}">${format_currency(total_shown_amount)}</td>
						</tr>
					`;
					
					html += `
									</tbody>
								</table>
							</div>
						</div>
					`;
				});
				
				html += '</div>';
				
				// Calculate the true total claimable amount (sum of allocated amounts per item, capped by available balance)
				let total_claimable = 0;
				all_items.forEach(item => {
					let invoice = selected_invoices.find(inv => inv.invoice === item.invoice);
					if (invoice) {
						let claim_amount = flt(invoice.claim_amount);
						let max_claimable = Math.min(item.available_balance, claim_amount);
						let allocated_amount = Math.min(item.ratio * claim_amount / 100, max_claimable);
						total_claimable += allocated_amount;
					}
				});
				dialog.set_value('total_claim_amount', total_claimable);
				
				// Add user info note below the total claim amount
				dialog.fields_dict.items_preview_html.$wrapper.append(`
					<div class="alert alert-info mt-2">
						Note: The total claim amount shown is the sum of what can actually be claimed per item, after applying available balances.
					</div>
				`);
				
				dialog.fields_dict.items_preview_html.html(html);
				
				// Attach event handlers to inputs
				dialog.$wrapper.find('.item-ratio-input').on('change', function() {
					let $this = $(this);
					let invoice = $this.data('invoice');
					let item_code = $this.data('item');
					let idx = $this.data('idx');
					let ratio = parseFloat($this.val());
					
					// Update the item ratio in our data
					let invoice_items = items_by_invoice[invoice];
					if (invoice_items && invoice_items[idx]) {
						// Get the old ratio value
						let old_ratio = invoice_items[idx].ratio;
						let ratio_change = ratio - old_ratio;
						
						// Update this item's ratio
						invoice_items[idx].ratio = ratio;
						
						// Recalculate this item's amount based on new ratio
						let inv = selected_invoices.find(i => i.invoice === invoice);
						if (inv) {
							let claim_amount = flt(inv.claim_amount);
							let allocated_amount = Math.min(ratio * claim_amount / 100, invoice_items[idx].available_balance);
							
							// Update the amount input for THIS item first
							dialog.$wrapper.find(`.item-amount-input[data-invoice="${invoice}"][data-idx="${idx}"]`)
								.val(allocated_amount.toFixed(2));
						}
						
						// Auto-adjust other items' ratios to maintain 100% total
						if (invoice_items.length > 1 && Math.abs(ratio_change) > 0.01) {
							// Calculate current total (excluding the updated item)
							let current_total_others = 0;
							invoice_items.forEach((item, i) => {
								if (i !== idx) {
									current_total_others += flt(item.ratio);
								}
							});
							
							// Calculate target total for others (to make grand total 100%)
							let target_total_others = 100 - ratio;
							
							// Skip adjustment if we'd create negative ratios
							if (target_total_others >= 0) {
								// Calculate adjustment factor
								let adjustment_factor = current_total_others > 0 ? 
									target_total_others / current_total_others : 0;
								
								// Adjust other items proportionally
								invoice_items.forEach((item, i) => {
									if (i !== idx) {
										let new_ratio = current_total_others > 0 ? 
											flt(item.ratio) * adjustment_factor : 
											target_total_others / (invoice_items.length - 1);
										
										// Update the ratio
										item.ratio = Math.max(0, new_ratio);
										
										// Update the input field
										dialog.$wrapper.find(`.item-ratio-input[data-invoice="${invoice}"][data-idx="${i}"]`)
											.val(item.ratio.toFixed(2));
										
										// Also update amount
										let inv = selected_invoices.find(i => i.invoice === invoice);
										if (inv) {
											let claim_amount = flt(inv.claim_amount);
											let allocated_amount = Math.min(
												item.ratio * claim_amount / 100, 
												item.available_balance
											);
											
											// Update the amount input
											dialog.$wrapper.find(`.item-amount-input[data-invoice="${invoice}"][data-idx="${i}"]`)
												.val(allocated_amount.toFixed(2));
										}
									}
								});
							}
						}
						
						// Update totals
						updateTotalsForInvoice(dialog, invoice, invoice_items, selected_invoices);
					}
				});
				
				dialog.$wrapper.find('.item-amount-input').on('change', function() {
					let $this = $(this);
					let invoice = $this.data('invoice');
					let item_code = $this.data('item');
					let idx = $this.data('idx');
					let amount = parseFloat($this.val());
					
					// Find the invoice to get claim amount
					let inv = selected_invoices.find(i => i.invoice === invoice);
					if (inv && items_by_invoice[invoice] && items_by_invoice[invoice][idx]) {
						let claim_amount = flt(inv.claim_amount);
						
						// Calculate new ratio
						let ratio = claim_amount > 0 ? (amount / claim_amount * 100) : 0;
						
						// Update the item data
						items_by_invoice[invoice][idx].ratio = ratio;
						
						// Update the ratio input
						dialog.$wrapper.find(`.item-ratio-input[data-invoice="${invoice}"][data-idx="${idx}"]`).val(ratio.toFixed(2));
						
						// Update totals
						updateTotalsForInvoice(dialog, invoice, items_by_invoice[invoice], selected_invoices);
					}
				});
				
				// Store items_by_invoice for later use when creating the claim
				dialog.items_by_invoice = items_by_invoice;
			}
		
			// Process each invoice to get its items
			invoice_names.forEach(invoice_name => {
				frappe.model.with_doc('Sales Invoice', invoice_name, function() {
					let invoice_doc = frappe.get_doc('Sales Invoice', invoice_name);
					
					if (invoice_doc) {
						// Find the invoice in our data and add project contractor info
						let invoice_data = selected_invoices.find(inv => inv.invoice === invoice_name);
						if (invoice_data && invoice_doc.custom_project_contractor) {
							invoice_data.project_contractor = invoice_doc.custom_project_contractor;
						}
						
						// Process items
						if (invoice_doc.items && invoice_doc.items.length > 0) {
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

function create_bulk_project_claim(frm, dialog) {
	console.log("Creating bulk project claim");
	
	// Get selected invoices and validate
	let selected_invoices = dialog.invoices_data.filter(inv => inv.select && flt(inv.claim_amount) > 0);
	
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
							// Then calculate ratios
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
		
		// Process each invoice
		selected_invoices.forEach(inv => {
			let invoice_items = dialog.items_by_invoice[inv.invoice] || [];
			if (invoice_items.length === 0) return;
			
			let claim_amount = flt(inv.claim_amount);
			
			// Collect unique projects
			if (inv.project) {
				unique_projects.add(inv.project);
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
			
			// Calculate claim items for this invoice using the edited values
			invoice_items.forEach(item => {
				// Skip items with zero available balance
				if (item.available_balance <= 0) return;
				
				// Calculate allocated amount based on ratio (which might have been edited)
				let allocated_amount = Math.min(flt(item.ratio) * claim_amount / 100, item.available_balance || claim_amount);
				
				// Calculate global ratio (relative to total claim amount)
				total_claim_amount += flt(allocated_amount);
				
				// Check if item already exists in claim_items
				let existing_item = claim_items.find(ci => ci.item === item.item_code);
				
				if (existing_item) {
					// Update existing item
					existing_item.amount += allocated_amount;
					// Also sum up the current_balance - but avoid double counting
					// We only want to add each item's available_balance once
					if (!existing_item.processed_invoices) {
						existing_item.processed_invoices = [];
					}
					
					// Only add the available balance if we haven't processed this invoice for this item yet
					if (!existing_item.processed_invoices.includes(inv.invoice)) {
						existing_item.processed_invoices.push(inv.invoice);
						console.log(`Adding available_balance for ${item.item_code} from invoice ${inv.invoice}: ${item.available_balance}`);
					}
				} else {
					// Add new item - we'll calculate the global ratio after summing all items
					claim_items.push({
						item: item.item_code,
						amount: allocated_amount, 
						ratio: 0, // Placeholder, will be calculated later
						unearned_account: item.income_account || '',
						revenue_account: item.custom_default_earning_account || '',
						processed_invoices: [inv.invoice] // Track which invoices we've processed
					});
				}
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
		if (claim_items.length > 0 && Math.abs(total_ratio - 100) > 0.01) {
			claim_items[claim_items.length - 1].ratio += (100 - total_ratio);
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
		
		// Group items by invoice and calculate totals
		claim_items.forEach(item => {
			// Find which invoice(s) this item comes from
			for (let inv_name in dialog.items_by_invoice) {
				let items = dialog.items_by_invoice[inv_name];
				let found_item = items.find(i => i.item_code === item.item);
				
				if (found_item) {
					// This invoice contains this item
					// Find the current ratio and amount for this item in this invoice
					let inv = selected_invoices.find(i => i.invoice === inv_name);
					let inv_claim_amount = inv ? flt(inv.claim_amount) : 0;
					let item_ratio = found_item.ratio || 0;
					let item_claim_amount = Math.min(
						flt(item_ratio) * inv_claim_amount / 100,
						found_item.available_balance || 0
					);
					
					if (item_claim_amount > 0) {
						items_by_invoice_for_being[inv_name].push({
							item_name: found_item.item_name || item.item,
							item_code: item.item,
							amount: item_claim_amount,
							ratio: item_ratio
						});
						
						total_by_invoice[inv_name] += item_claim_amount;
					}
				}
			}
		});
		
		// Create the detailed description
		references.forEach(ref => {
			let inv_items = items_by_invoice_for_being[ref.invoice] || [];
			let inv_total = total_by_invoice[ref.invoice] || 0;
			
			being_text += `- ${ref.invoice} (${ref.status}, ${ref.project || 'No Project'}${ref.project_contractor ? ', ' + ref.project_contractor : ''}, Due: ${ref.due_date || 'N/A'})\n`;
			being_text += `  Total Claimed: ${format_currency(inv_total)} of ${format_currency(ref.amount)} claimable\n`;
			
			if (inv_items.length > 0) {
				being_text += `  Items:\n`;
				inv_items.forEach(item => {
					being_text += `    • ${item.item_name} (${item.item_code}): ${format_currency(item.amount)} (${item.ratio.toFixed(1)}%)\n`;
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
				
				// Get the project contractor from the selected invoices data
				let primary_invoice_data = selected_invoices.find(inv => inv.invoice === primary_invoice);
				let project_contractor = primary_invoice_data ? primary_invoice_data.project_contractor : null;
				
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
				set_value_quietly('project_references', all_projects);
				set_value_quietly('project_contractor', project_contractor);
				set_value_quietly('party_account', data.message.debit_to);
				set_value_quietly('claim_amount', total_claimable_amount);
				set_value_quietly('claimable_amount', total_claimable_amount);
				set_value_quietly('being', being_text);
				set_value_quietly('reference_invoice', primary_invoice);
				set_value_quietly('invoice_references', invoice_names.join(", "));
				
				// Make sure outstanding_amount is equal to claimable_amount
				set_value_quietly('outstanding_amount', total_claimable_amount);
				
				// Store key values to ensure they aren't lost
				let saved_values = {
					customer: dialog.get_value('customer'),
					party_account: data.message.debit_to,
					claim_amount: total_claimable_amount,
					claimable_amount: total_claimable_amount,
					outstanding_amount: total_claimable_amount
				};
				
				// Hide for_project field and show project_references field if multiple projects
				if (unique_projects.size > 1) {
					frm.set_df_property('for_project', 'hidden', 1);
					frm.set_df_property('project_name', 'hidden', 1);
					frm.set_df_property('project_references', 'hidden', 0);
				} else {
					frm.set_df_property('for_project', 'hidden', 0);
					frm.set_df_property('project_name', 'hidden', 0);
					frm.set_df_property('project_references', 'hidden', 1);
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
				
				frappe.show_alert({
					message: __('Claim items created from multiple invoices. Please review and save when ready.'),
					indicator: 'green'
				}, 5);
				
				// After claim creation, refresh claim_items from backend and reload doc for consistency
				frappe.call({
					method: 'update_claim_items_balance',
					doc: frm.doc,
					callback: function(r) {
						// Store the current items for safekeeping
						let current_items = [...frm.doc.claim_items || []];
						
						// Close dialog before any reloads to prevent data loss
						dialog.hide();
						
						// Use timeout to avoid any race conditions
						setTimeout(function() {
							// Restore original validate method
							frm.validate = old_validate;
							frm.skip_validation = false;
							
							// Make sure we still have our items
							if (!frm.doc.claim_items || frm.doc.claim_items.length === 0) {
								// If items were lost, restore them
								frm.doc.claim_items = current_items;
							}
							
							// Restore important fields if they were cleared
							if (!frm.doc.claim_amount || frm.doc.claim_amount !== saved_values.claim_amount) {
								set_value_quietly('claim_amount', saved_values.claim_amount);
							}
							if (!frm.doc.customer || frm.doc.customer !== saved_values.customer) {
								set_value_quietly('customer', saved_values.customer);
							}
							if (!frm.doc.party_account || frm.doc.party_account !== saved_values.party_account) {
								set_value_quietly('party_account', saved_values.party_account);
							}
							if (!frm.doc.claimable_amount || frm.doc.claimable_amount !== saved_values.claimable_amount) {
								set_value_quietly('claimable_amount', saved_values.claimable_amount);
							}
							if (!frm.doc.outstanding_amount || frm.doc.outstanding_amount !== saved_values.outstanding_amount) {
								set_value_quietly('outstanding_amount', saved_values.outstanding_amount);
							}
							
							// Refresh just the fields we need without reloading the whole doc
							frm.refresh_field('claim_items');
							frm.refresh_field('claim_amount');
							frm.refresh_field('customer');
							frm.refresh_field('party_account');
							frm.refresh_field('claimable_amount');
							frm.refresh_field('outstanding_amount');
							frm.refresh();
							
							// Prevent automatic saving by setting save flag to false
							frm._save_flag = false;
						}, 500);
					}
				});
			},
			error: function(err) {
				console.error("Error getting invoice details:", err);
				// Restore original validate method
				frm.validate = old_validate;
				frm.skip_validation = false;
				frappe.msgprint(__('Error creating claim'));
			}
		});
	}
}

function updateTotalsForInvoice(dialog, invoice, invoice_items, selected_invoices) {
	let total_ratio = 0;
	let total_amount = 0;
	
	// Find the invoice to get claim amount
	let inv = selected_invoices.find(i => i.invoice === invoice);
	if (!inv) return;
	
	let claim_amount = flt(inv.claim_amount);
	
	// Calculate totals
	invoice_items.forEach(item => {
		total_ratio += flt(item.ratio);
		let item_amount = Math.min(flt(item.ratio) * claim_amount / 100, item.available_balance);
		total_amount += item_amount;
	});
	
	// Update the totals in the UI
	dialog.$wrapper.find(`.ratio-total[data-invoice="${invoice}"]`).text(total_ratio.toFixed(2) + '%');
	dialog.$wrapper.find(`.amount-total[data-invoice="${invoice}"]`).text(format_currency(total_amount));
	
	// Highlight if total ratio is not close to 100%
	let $ratio_cell = dialog.$wrapper.find(`.ratio-total[data-invoice="${invoice}"]`);
	if (Math.abs(total_ratio - 100) > 0.1) {
		$ratio_cell.addClass('text-danger');
	} else {
		$ratio_cell.removeClass('text-danger');
	}
}

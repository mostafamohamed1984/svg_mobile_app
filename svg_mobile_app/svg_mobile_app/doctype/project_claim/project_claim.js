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
			create_bulk_project_claim(frm, dialog);
		}
	});
	
	// Create buttons for actions
	dialog.fields_dict.action_buttons.html(`
		<div class="row" style="margin-top: 20px; margin-bottom: 10px;">
			<div class="col">
				<button id="select_all_btn" class="btn btn-sm btn-default form-control">
					${__('Select All')}
				</button>
			</div>
			<div class="col">
				<button id="deselect_all_btn" class="btn btn-sm btn-default form-control">
					${__('Deselect All')}
				</button>
			</div>
			<div class="col">
				<button id="set_full_amount_btn" class="btn btn-sm btn-default form-control">
					${__('Set Full Amount')}
				</button>
			</div>
		</div>
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
				inv.claim_amount = inv.outstanding;
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
				
				dialog.invoices_data = response.message.map(inv => {
					return {
						'invoice': inv.name,
						'invoice_date': inv.posting_date,
						'project': inv.custom_for_project || '',
						'status': inv.status,
						'due_date': inv.due_date,
						'total': inv.grand_total,
						'outstanding': inv.outstanding_amount,
						'claim_amount': inv.outstanding_amount, // Default to full amount
						'select': 1 // Pre-select all
					};
				});
				
				console.log("Processed invoices:", dialog.invoices_data);
				
				// Render the invoices table
				render_invoices_table(dialog);
				
				// Update the total claim amount
				update_total_claim_amount(dialog);
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
				<td>
					<input 
						type="number" 
						class="form-control claim-amount-input" 
						data-index="${index}" 
						value="${inv.claim_amount}" 
						max="${inv.outstanding}"
						step="0.01"
						${!inv.select ? 'disabled' : ''}
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
	
	// Use the standard Frappe API to get invoice items directly
	frappe.call({
		method: 'frappe.client.get_list',
		args: {
			doctype: 'Sales Invoice Item',
			filters: {
				'parent': ['in', invoice_names]
			},
			fields: [
				'parent as invoice', 
				'item_code', 
				'item_name', 
				'amount', 
				'income_account', 
				'custom_default_earning_account'
			],
			limit_page_length: 500
		},
		callback: function(response) {
			console.log("Items API response:", response);
			
			if (!response.message || response.message.length === 0) {
				dialog.fields_dict.items_preview_html.html(`
					<div class="alert alert-warning my-4">
						${__('No items found for selected invoices')}
					</div>
				`);
				return;
			}
			
			let items_data = response.message;
			
			// Calculate the ratio for each item
			let invoice_totals = {};
			
			// First, calculate invoice totals
			items_data.forEach(item => {
				if (!invoice_totals[item.invoice]) {
					invoice_totals[item.invoice] = 0;
				}
				invoice_totals[item.invoice] += flt(item.amount);
			});
			
			// Then, calculate ratio for each item
			items_data.forEach(item => {
				if (invoice_totals[item.invoice] > 0) {
					item.ratio = flt(item.amount) / flt(invoice_totals[item.invoice]) * 100;
				} else {
					item.ratio = 0;
				}
			});
			
			// Group items by invoice
			let items_by_invoice = {};
			items_data.forEach(item => {
				if (!items_by_invoice[item.invoice]) {
					items_by_invoice[item.invoice] = [];
				}
				items_by_invoice[item.invoice].push(item);
			});
			
			console.log("Grouped items:", items_by_invoice);
			
			// Create HTML for item allocation tables
			let html = '<div class="margin-top">';
			
			selected_invoices.forEach(inv => {
				let invoice_items = items_by_invoice[inv.invoice] || [];
				if (invoice_items.length === 0) return;
				
				// Get claim amount for this invoice
				let claim_amount = flt(inv.claim_amount);
				
				html += `
					<div class="invoice-items-section mb-4" data-invoice="${inv.invoice}">
						<h5>${__('Invoice')}: ${inv.invoice}</h5>
						<div class="table-responsive">
							<table class="table table-bordered item-allocation-table">
								<thead>
									<tr>
										<th>${__('Item')}</th>
										<th>${__('Original Amount')}</th>
										<th>${__('Ratio %')}</th>
										<th>${__('Claim Amount')}</th>
										<th>${__('Unearned Account')}</th>
										<th>${__('Revenue Account')}</th>
									</tr>
								</thead>
								<tbody>
				`;
				
				invoice_items.forEach(item => {
					// Calculate allocated amount based on ratio
					let allocated_amount = item.ratio * claim_amount / 100;
					
					html += `
						<tr data-item="${item.item_code}" data-invoice="${inv.invoice}">
							<td>${item.item_name || item.item_code}</td>
							<td class="text-right">${format_currency(item.amount)}</td>
							<td class="text-right">${format_number(item.ratio, 2)}%</td>
							<td class="text-right">${format_currency(allocated_amount)}</td>
							<td>${item.income_account || ''}</td>
							<td>${item.custom_default_earning_account || ''}</td>
						</tr>
					`;
				});
				
				html += `
								</tbody>
							</table>
						</div>
					</div>
				`;
			});
			
			html += '</div>';
			
			dialog.fields_dict.items_preview_html.html(html);
		},
		error: function(err) {
			console.error("Error fetching invoice items:", err);
			dialog.fields_dict.items_preview_html.html(`
				<div class="alert alert-danger my-4">
					${__('Error loading invoice items. Please check console for details.')}
				</div>
			`);
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
	let invalid_claims = selected_invoices.filter(inv => flt(inv.claim_amount) > flt(inv.outstanding));
	if (invalid_claims.length > 0) {
		let error_list = invalid_claims.map(inv => `${inv.invoice}: ${format_currency(inv.claim_amount)} > ${format_currency(inv.outstanding)}`).join('<br>');
		frappe.msgprint(__('Claim Amount cannot exceed Outstanding Amount for the following invoices:<br>') + error_list);
		return;
	}
	
	// Show loading indicator
	frappe.ui.form.set_loading(frm);
	
	// Get invoice names for selected invoices
	let invoice_names = selected_invoices.map(inv => inv.invoice);
	
	// Use the standard Frappe API to fetch items data
	frappe.call({
		method: 'frappe.client.get_list',
		args: {
			doctype: 'Sales Invoice Item',
			filters: {
				'parent': ['in', invoice_names]
			},
			fields: [
				'parent as invoice', 
				'item_code', 
				'item_name', 
				'amount', 
				'income_account', 
				'custom_default_earning_account'
			],
			limit_page_length: 500
		},
		callback: function(response) {
			console.log("Create claim items response:", response);
			
			if (!response.message || response.message.length === 0) {
				frappe.ui.form.set_loading(frm, false);
				frappe.msgprint(__('Could not fetch invoice items'));
				return;
			}
			
			let items_data = response.message;
			
			// Calculate the ratio for each item
			let invoice_totals = {};
			
			// First, calculate invoice totals
			items_data.forEach(item => {
				if (!invoice_totals[item.invoice]) {
					invoice_totals[item.invoice] = 0;
				}
				invoice_totals[item.invoice] += flt(item.amount);
			});
			
			// Then, calculate ratio for each item
			items_data.forEach(item => {
				if (invoice_totals[item.invoice] > 0) {
					item.ratio = flt(item.amount) / flt(invoice_totals[item.invoice]) * 100;
				} else {
					item.ratio = 0;
				}
			});
			
			// Group items by invoice
			let items_by_invoice = {};
			items_data.forEach(item => {
				if (!items_by_invoice[item.invoice]) {
					items_by_invoice[item.invoice] = [];
				}
				items_by_invoice[item.invoice].push(item);
			});
			
			// Calculate claim amounts for each item
			let claim_items = [];
			let references = [];
			let total_claim_amount = 0;
			
			selected_invoices.forEach(inv => {
				let invoice_items = items_by_invoice[inv.invoice] || [];
				if (invoice_items.length === 0) return;
				
				let claim_amount = flt(inv.claim_amount);
				total_claim_amount += claim_amount;
				
				// Store reference for description
				references.push({
					invoice: inv.invoice,
					amount: claim_amount,
					date: inv.invoice_date,
					due_date: inv.due_date,
					project: inv.project,
					status: inv.status
				});
				
				// Calculate claim items for this invoice
				invoice_items.forEach(item => {
					// Calculate allocated amount based on ratio
					let allocated_amount = item.ratio * claim_amount / 100;
					
					// Check if item already exists in claim_items
					let existing_item = claim_items.find(ci => ci.item === item.item_code);
					
					if (existing_item) {
						// Update existing item
						existing_item.amount += allocated_amount;
						existing_item.ratio += item.ratio;
					} else {
						// Add new item
						claim_items.push({
							item: item.item_code,
							amount: allocated_amount,
							ratio: item.ratio,
							unearned_account: item.income_account || '',
							revenue_account: item.custom_default_earning_account || ''
						});
					}
				});
			});
			
			console.log("Claim items created:", claim_items);
			
			// Create "Being" text with reference to all invoices
			let being_text = __('Being claim for invoices: ') + 
				references.map(ref => 
					`${ref.invoice} (${format_currency(ref.amount)}, ${ref.status}, ${ref.project || 'No Project'}, Due: ${ref.due_date || 'N/A'})`
				).join(', ');
			
			// Determine which invoice to use as the main reference
			// We'll use the first selected invoice with the highest claim amount
			let primary_invoice = selected_invoices.sort((a, b) => 
				flt(b.claim_amount) - flt(a.claim_amount)
			)[0].invoice;
			
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
						frappe.ui.form.set_loading(frm, false);
						frappe.msgprint(__('Could not fetch account information'));
						return;
					}
					
					// Set values in the form
					frm.set_value({
						'customer': dialog.get_value('customer'),
						'for_project': data.message.custom_for_project || null,
						'party_account': data.message.debit_to,
						'claim_amount': total_claim_amount,
						'being': being_text,
						'reference_invoice': primary_invoice, // Set the primary invoice as reference
						'invoice_references': invoice_names.join(", ") // Set additional invoices in the new field
					});
					
					// Clear existing items and add new ones
					frm.clear_table('claim_items');
					claim_items.forEach(item => {
						let row = frm.add_child('claim_items', item);
					});
					
					// Update form and close dialog
					frm.refresh_fields();
					frappe.ui.form.set_loading(frm, false);
					dialog.hide();
					
					frappe.show_alert({
						message: __('Claim items created from multiple invoices'),
						indicator: 'green'
					}, 5);
				},
				error: function(err) {
					console.error("Error getting invoice details:", err);
					frappe.ui.form.set_loading(frm, false);
					frappe.msgprint(__('Error creating claim'));
				}
			});
		},
		error: function(err) {
			console.error("Error processing invoice items:", err);
			frappe.ui.form.set_loading(frm, false);
			frappe.msgprint(__('Error processing invoice items'));
		}
	});
}

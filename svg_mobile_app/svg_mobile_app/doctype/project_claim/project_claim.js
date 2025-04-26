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
					if (customer) {
						fetch_customer_invoices(dialog, customer);
					}
				}
			},
			{
				fieldname: 'invoices_section',
				fieldtype: 'Section Break',
				label: __('Outstanding Invoices')
			},
			{
				fieldname: 'status_html',
				fieldtype: 'HTML'
			},
			{
				fieldname: 'invoices',
				label: __('Sales Invoices'),
				fieldtype: 'Table',
				cannot_add_rows: true,
				fields: [
					{
						fieldname: 'invoice',
						label: __('Invoice'),
						fieldtype: 'Link',
						options: 'Sales Invoice',
						in_list_view: 1,
						read_only: 1
					},
					{
						fieldname: 'invoice_date',
						label: __('Date'),
						fieldtype: 'Date',
						in_list_view: 1,
						read_only: 1
					},
					{
						fieldname: 'project',
						label: __('Project'),
						fieldtype: 'Data',
						in_list_view: 1,
						read_only: 1
					},
					{
						fieldname: 'status',
						label: __('Status'),
						fieldtype: 'Data',
						in_list_view: 1,
						read_only: 1
					},
					{
						fieldname: 'due_date',
						label: __('Due Date'),
						fieldtype: 'Date',
						in_list_view: 1,
						read_only: 1
					},
					{
						fieldname: 'total',
						label: __('Total'),
						fieldtype: 'Currency',
						in_list_view: 1,
						read_only: 1
					},
					{
						fieldname: 'outstanding',
						label: __('Outstanding'),
						fieldtype: 'Currency',
						in_list_view: 1,
						read_only: 1
					},
					{
						fieldname: 'claim_amount',
						label: __('Claim Amount'),
						fieldtype: 'Currency',
						in_list_view: 1,
						reqd: 1,
						onchange: function(e) {
							update_total_claim_amount(dialog);
						}
					},
					{
						fieldname: 'select',
						label: __('Select'),
						fieldtype: 'Check',
						in_list_view: 1,
						default: 0,
						onchange: function(e) {
							update_total_claim_amount(dialog);
						}
					}
				]
			},
			{
				fieldname: 'allocation_section',
				fieldtype: 'Section Break',
				label: __('Invoice Items Allocation'),
				depends_on: "eval:doc.invoices && doc.invoices.length > 0"
			},
			{
				fieldname: 'items_preview_html',
				fieldtype: 'HTML'
			},
			{
				fieldname: 'summary_section',
				fieldtype: 'Section Break',
				label: __('Summary')
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
	
	dialog.show();
}

function fetch_customer_invoices(dialog, customer) {
	// Show loading indicator
	dialog.fields_dict.status_html.html(
		`<div class="text-center my-4">
			<i class="fa fa-spinner fa-spin fa-2x"></i>
			<p>${__('Fetching invoices...')}</p>
		</div>`
	);
	
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
			fields: ['name', 'posting_date', 'custom_for_project', 'project_name', 'status', 'due_date', 'grand_total', 'outstanding_amount'],
			order_by: 'posting_date desc'
		},
		callback: function(response) {
			if (response.message && response.message.length > 0) {
				let invoices = response.message.map(inv => {
					return {
						'invoice': inv.name,
						'invoice_date': inv.posting_date,
						'project': inv.project_name || inv.custom_for_project || '',
						'status': inv.status,
						'due_date': inv.due_date,
						'total': inv.grand_total,
						'outstanding': inv.outstanding_amount,
						'claim_amount': inv.outstanding_amount, // Default to full amount
						'select': 1 // Pre-select all
					};
				});
				
				dialog.set_value('invoices', invoices);
				
				// Show a message about the number of invoices found
				dialog.fields_dict.status_html.html(
					`<div class="alert alert-info my-2">
						${__('Found')} ${invoices.length} ${__('outstanding invoices')}
					</div>
					<div class="my-2">
						<button class="btn btn-sm btn-default select-all-invoices">
							${__('Select All')}
						</button>
						<button class="btn btn-sm btn-default ml-2 deselect-all-invoices">
							${__('Deselect All')}
						</button>
						<button class="btn btn-sm btn-default ml-2 set-full-amount">
							${__('Set Full Amount')}
						</button>
					</div>`
				);
				
				// Add event listeners for buttons
				dialog.fields_dict.status_html.$wrapper.find('.select-all-invoices').on('click', function() {
					let rows = dialog.get_value('invoices') || [];
					rows.forEach(row => row.select = 1);
					dialog.set_value('invoices', rows);
					update_total_claim_amount(dialog);
				});
				
				dialog.fields_dict.status_html.$wrapper.find('.deselect-all-invoices').on('click', function() {
					let rows = dialog.get_value('invoices') || [];
					rows.forEach(row => row.select = 0);
					dialog.set_value('invoices', rows);
					update_total_claim_amount(dialog);
				});
				
				dialog.fields_dict.status_html.$wrapper.find('.set-full-amount').on('click', function() {
					let rows = dialog.get_value('invoices') || [];
					rows.forEach(row => {
						if (row.select) {
							row.claim_amount = row.outstanding;
						}
					});
					dialog.set_value('invoices', rows);
					update_total_claim_amount(dialog);
				});
				
				// Trigger update to show the preview
				update_total_claim_amount(dialog);
			} else {
				// Show message if no invoices found
				dialog.fields_dict.status_html.html(
					`<div class="alert alert-warning my-4">
						${__('No outstanding invoices found for this customer')}
					</div>`
				);
				dialog.set_value('invoices', []);
			}
		}
	});
}

function update_total_claim_amount(dialog) {
	let invoices = dialog.get_value('invoices') || [];
	let total = 0;
	
	// Sum up claim amounts for selected invoices
	invoices.forEach(inv => {
		if (inv.select) {
			total += flt(inv.claim_amount);
		}
	});
	
	dialog.set_value('total_claim_amount', total);
	
	// Update items preview for selected invoices
	update_items_preview(dialog);
}

function update_items_preview(dialog) {
	let invoices = dialog.get_value('invoices') || [];
	let selected_invoices = invoices.filter(inv => inv.select && flt(inv.claim_amount) > 0);
	
	if (selected_invoices.length === 0) {
		dialog.fields_dict.items_preview_html.html('');
		return;
	}
	
	// Show loading indicator
	dialog.fields_dict.items_preview_html.html(
		`<div class="text-center my-4">
			<i class="fa fa-spinner fa-spin"></i>
			<p>${__('Loading invoice items...')}</p>
		</div>`
	);
	
	// Get invoice names for selected invoices
	let invoice_names = selected_invoices.map(inv => inv.invoice);
	
	// Use the server-side method to fetch and calculate items data
	frappe.call({
		method: 'svg_mobile_app.doctype.project_claim.project_claim.get_items_from_invoices',
		args: {
			invoices: invoice_names
		},
		callback: function(response) {
			if (!response.message) {
				dialog.fields_dict.items_preview_html.html('');
				return;
			}
			
			// Group items by invoice
			let items_by_invoice = {};
			response.message.forEach(item => {
				if (!items_by_invoice[item.invoice]) {
					items_by_invoice[item.invoice] = [];
				}
				items_by_invoice[item.invoice].push(item);
			});
			
			// Create HTML for item allocation tables
			let html = '';
			
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
			
			dialog.fields_dict.items_preview_html.html(html);
		}
	});
}

function create_bulk_project_claim(frm, dialog) {
	// Get selected invoices and validate
	let invoices = dialog.get_value('invoices') || [];
	let selected_invoices = invoices.filter(inv => inv.select && flt(inv.claim_amount) > 0);
	
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
	
	// Use the server-side method to fetch items data
	frappe.call({
		method: 'svg_mobile_app.doctype.project_claim.project_claim.get_items_from_invoices',
		args: {
			invoices: invoice_names
		},
		callback: function(response) {
			if (!response.message) {
				frappe.ui.form.set_loading(frm, false);
				frappe.msgprint(__('Could not fetch invoice items'));
				return;
			}
			
			// Group items by invoice
			let items_by_invoice = {};
			response.message.forEach(item => {
				if (!items_by_invoice[item.invoice]) {
					items_by_invoice[item.invoice] = [];
				}
				items_by_invoice[item.invoice].push(item);
			});
			
			// Calculate claim amounts for each item
			let claim_items = [];
			let references = [];
			let total_claim_amount = 0;
			let project_contractor = null;
			
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
					if (!data.message) {
						frappe.ui.form.set_loading(frm, false);
						frappe.msgprint(__('Could not fetch account information'));
						return;
					}
					
					// Set values in the form
					frm.set_value({
						'customer': dialog.get_value('customer'),
						'for_project': data.message.custom_for_project,
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
				}
			});
		}
	});
}

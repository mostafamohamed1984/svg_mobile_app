// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project Advances", {
	refresh: function(frm) {
		// Add custom buttons based on document status
		if (frm.doc.docstatus === 0) {
			// Draft - show refresh and auto-distribute buttons
			frm.add_custom_button(__('Refresh Available Balances'), function() {
				refresh_available_balances(frm);
			}).addClass('btn-info');
			
			if (frm.doc.advance_amount && frm.doc.distribution_method) {
				frm.add_custom_button(__('Auto Distribute'), function() {
					auto_distribute_amounts(frm);
				}).addClass('btn-primary');
			}
		}
		
		if (frm.doc.docstatus === 1 && frm.doc.status === 'Active') {
			// Submitted and active - show create additional advance button
			frm.add_custom_button(__('Create Additional Advance'), function() {
				create_additional_advance(frm);
			}).addClass('btn-success');
		}
		
		// Set up field dependencies
		setup_field_dependencies(frm);
	},
	
	project_contractor: function(frm) {
		if (frm.doc.project_contractor) {
			// Load available balances when project contractor is selected
			load_project_contractor_data(frm);
		} else {
			// Clear data when project contractor is cleared
			frm.set_value('available_fees_html', '');
			frm.clear_table('advance_items');
			frm.refresh_fields();
		}
	},
	
	advance_amount: function(frm) {
		if (frm.doc.advance_amount && frm.doc.project_contractor) {
			// Validate advance amount
			validate_advance_amount(frm);
			
			// Auto-distribute if method is selected
			if (frm.doc.distribution_method && frm.doc.distribution_method !== 'Manual') {
				auto_distribute_amounts(frm);
			}
		}
	},
	
	distribution_method: function(frm) {
		if (frm.doc.advance_amount && frm.doc.project_contractor && frm.doc.distribution_method !== 'Manual') {
			auto_distribute_amounts(frm);
		}
	},
	
	custodian_employee: function(frm) {
		// Update all advance items with the new custodian employee
		if (frm.doc.custodian_employee && frm.doc.advance_items) {
			frm.doc.advance_items.forEach(function(item) {
				if (!item.employee) {
					frappe.model.set_value(item.doctype, item.name, 'employee', frm.doc.custodian_employee);
				}
			});
			frm.refresh_field('advance_items');
		}
	}
});

// Child table events
frappe.ui.form.on("Project Advance Items", {
	allocated_amount: function(frm, cdt, cdn) {
		calculate_totals(frm);
		
		// Validate allocated amount doesn't exceed available balance
		let row = locals[cdt][cdn];
		if (flt(row.allocated_amount) > flt(row.available_balance)) {
			frappe.msgprint(__('Allocated amount cannot exceed available balance'));
			frappe.model.set_value(cdt, cdn, 'allocated_amount', row.available_balance);
		}
	},
	
	employee: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (!row.purpose && row.item_code) {
			frappe.model.set_value(cdt, cdn, 'purpose', `Advance for ${row.item_code}`);
		}
	},
	
	advance_items_remove: function(frm) {
		calculate_totals(frm);
	}
});

function setup_field_dependencies(frm) {
	// Set up queries and filters
	frm.set_query('project_contractor', function() {
		return {
			filters: {
				'docstatus': 1  // Only submitted project contractors
			}
		};
	});
	
	frm.set_query('custodian_employee', function() {
		return {
			filters: {
				'status': 'Active'
			}
		};
	});
	
	frm.set_query('employee', 'advance_items', function() {
		return {
			filters: {
				'status': 'Active'
			}
		};
	});
}

function load_project_contractor_data(frm) {
	if (!frm.doc.project_contractor) return;
	
	// Show loading indicator
	frm.set_value('available_fees_html', '<div class="text-center"><i class="fa fa-spinner fa-spin"></i> Loading available balances...</div>');
	
	// Get project contractor summary
	frappe.call({
		method: 'svg_mobile_app.svg_mobile_app.doctype.project_advances.project_advances.get_project_contractor_summary',
		args: {
			project_contractor: frm.doc.project_contractor
		},
		callback: function(r) {
			if (r.message) {
				let data = r.message;
				
				if (data.item_count === 0) {
					frm.set_value('available_fees_html', 
						'<div class="alert alert-warning">No available fees and deposits found for this project contractor. ' +
						'Make sure there are submitted Project Claims for this contractor.</div>'
					);
				} else {
					// Update HTML display
					update_available_fees_display(frm, data.available_items);
					
					// Show summary message
					frappe.show_alert({
						message: __('Found {0} items with total available balance of {1}', 
							[data.item_count, format_currency(data.total_available)]),
						indicator: 'green'
					}, 5);
				}
			}
		}
	});
}

function update_available_fees_display(frm, available_items) {
	if (!available_items || available_items.length === 0) {
		frm.set_value('available_fees_html', '<div class="alert alert-warning">No available fees and deposits found.</div>');
		return;
	}
	
	let html = `
		<div class="available-fees-summary">
			<h5>Available Fees & Deposits</h5>
			<div class="table-responsive">
				<table class="table table-bordered table-sm">
					<thead>
						<tr>
							<th>Item</th>
							<th>Original Rate</th>
							<th>Claimed Amount</th>
							<th>Already Advanced</th>
							<th>Available Balance</th>
						</tr>
					</thead>
					<tbody>
	`;
	
	let total_available = 0;
	available_items.forEach(function(item) {
		total_available += flt(item.available_balance);
		html += `
			<tr>
				<td>${item.item_name}</td>
				<td class="text-right">${format_currency(item.original_rate)}</td>
				<td class="text-right">${format_currency(item.claimed_amount)}</td>
				<td class="text-right">${format_currency(item.advanced_amount)}</td>
				<td class="text-right"><strong>${format_currency(item.available_balance)}</strong></td>
			</tr>
		`;
	});
	
	html += `
					</tbody>
					<tfoot>
						<tr class="table-active">
							<th colspan="4">Total Available</th>
							<th class="text-right">${format_currency(total_available)}</th>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
	`;
	
	frm.set_value('available_fees_html', html);
}

function validate_advance_amount(frm) {
	if (!frm.doc.advance_amount || !frm.doc.project_contractor) return;
	
	frappe.call({
		method: 'svg_mobile_app.svg_mobile_app.doctype.project_advances.project_advances.validate_advance_amount',
		args: {
			project_contractor: frm.doc.project_contractor,
			advance_amount: frm.doc.advance_amount
		},
		callback: function(r) {
			if (r.message) {
				if (!r.message.valid) {
					frappe.msgprint({
						title: __('Invalid Advance Amount'),
						message: r.message.message,
						indicator: 'red'
					});
					frm.set_value('advance_amount', 0);
				} else {
					frappe.show_alert({
						message: __('Advance amount validated. Available balance: {0}', 
							[format_currency(r.message.available_balance)]),
						indicator: 'green'
					}, 3);
				}
			}
		}
	});
}

function auto_distribute_amounts(frm) {
	if (!frm.doc.advance_amount || !frm.doc.project_contractor || !frm.doc.distribution_method) {
		frappe.msgprint(__('Please set Project Contractor, Advance Amount, and Distribution Method first'));
		return;
	}
	
	if (frm.doc.distribution_method === 'Manual') {
		frappe.msgprint(__('Manual distribution selected. Please add items manually.'));
		return;
	}
	
	// Show loading
	frappe.show_alert({
		message: __('Distributing amounts...'),
		indicator: 'blue'
	}, 2);
	
	frm.call({
		method: 'auto_distribute_amounts',
		doc: frm.doc,
		callback: function(r) {
			if (r.message) {
				// Clear existing items
				frm.clear_table('advance_items');
				
				// Add new items
				r.message.advance_items.forEach(function(item) {
					let row = frm.add_child('advance_items');
					Object.keys(item).forEach(function(key) {
						if (key !== 'doctype' && key !== 'name') {
							row[key] = item[key];
						}
					});
				});
				
				// Update totals
				frm.set_value('total_distributed', r.message.total_distributed);
				frm.set_value('balance_remaining', r.message.balance_remaining);
				
				frm.refresh_fields();
				
				frappe.show_alert({
					message: __('Amounts distributed successfully'),
					indicator: 'green'
				}, 3);
			}
		}
	});
}

function refresh_available_balances(frm) {
	if (!frm.doc.project_contractor) {
		frappe.msgprint(__('Please select a Project Contractor first'));
		return;
	}
	
	load_project_contractor_data(frm);
}

function calculate_totals(frm) {
	let total_distributed = 0;
	
	if (frm.doc.advance_items) {
		frm.doc.advance_items.forEach(function(item) {
			total_distributed += flt(item.allocated_amount);
		});
	}
	
	frm.set_value('total_distributed', total_distributed);
	frm.set_value('balance_remaining', flt(frm.doc.advance_amount) - total_distributed);
}

function create_additional_advance(frm) {
	// Create a new Project Advance for the same project contractor
	frappe.new_doc('Project Advances', {
		project_contractor: frm.doc.project_contractor,
		custodian_employee: frm.doc.custodian_employee,
		distribution_method: frm.doc.distribution_method
	});
} 
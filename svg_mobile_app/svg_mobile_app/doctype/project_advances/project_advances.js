// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project Advances", {
	refresh: function(frm) {
		// Add custom buttons based on document status
		if (frm.doc.docstatus === 0) {
			// Draft - show refresh button
			frm.add_custom_button(__('Refresh Available Balances'), function() {
				refresh_available_balances(frm);
			}).addClass('btn-info');
		}
		
		// Set up field dependencies
		setup_field_dependencies(frm);
		
		// Auto-refresh HTML when form loads if we have contractors
		if (frm.doc.project_contractors && frm.doc.project_contractors.length > 0) {
			setTimeout(() => {
				refresh_available_balances(frm);
			}, 1000);
		}
	},
	
	advance_amount: function(frm) {
		calculate_totals(frm);
		
		// Validate that advance amount is not less than total allocated
		let total_allocated = 0;
		if (frm.doc.project_contractors) {
			frm.doc.project_contractors.forEach(function(contractor) {
				total_allocated += flt(contractor.allocated_amount);
			});
		}
		
		if (total_allocated > flt(frm.doc.advance_amount)) {
			frappe.msgprint({
				title: __('Invalid Advance Amount'),
				message: __('Advance amount ({0}) cannot be less than total allocated amount ({1}). Please increase the advance amount or reduce allocations.', 
					[format_currency(frm.doc.advance_amount), format_currency(total_allocated)]),
				indicator: 'orange'
			});
		}
	},
	
	custodian_employee: function(frm) {
		// Custodian employee is now set at the main level
		frm.refresh_field('custodian_employee');
	}
});

// Project Contractors child table events
frappe.ui.form.on("Project Advance Contractors", {
	project_contractor: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.project_contractor) {
			// Load available balance for this contractor
			load_contractor_balance(frm, row);
			
			// Also refresh the overall available balances display
			setTimeout(() => {
				refresh_available_balances(frm);
			}, 1000);
		}
	},
	
	allocated_amount: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		
		// Validate allocated amount doesn't exceed available balance
		if (flt(row.allocated_amount) > flt(row.total_available_balance)) {
			frappe.msgprint(__('Allocated amount cannot exceed available balance for this contractor'));
			frappe.model.set_value(cdt, cdn, 'allocated_amount', row.total_available_balance);
			return;
		}
		
		// Recalculate totals
		calculate_totals(frm);
		
		// Validate total doesn't exceed advance amount
		let total_allocated = 0;
		if (frm.doc.project_contractors) {
			frm.doc.project_contractors.forEach(function(contractor) {
				total_allocated += flt(contractor.allocated_amount);
			});
		}
		
		if (total_allocated > flt(frm.doc.advance_amount)) {
			frappe.msgprint({
				title: __('Invalid Allocation'),
				message: __('Total allocated amount ({0}) cannot exceed advance amount ({1}). Please reduce the allocation.', 
					[format_currency(total_allocated), format_currency(frm.doc.advance_amount)]),
				indicator: 'red'
			});
			
			// Reset this allocation to prevent exceeding
			let excess = total_allocated - flt(frm.doc.advance_amount);
			let new_amount = flt(row.allocated_amount) - excess;
			if (new_amount < 0) new_amount = 0;
			
			frappe.model.set_value(cdt, cdn, 'allocated_amount', new_amount);
			calculate_totals(frm);
		}
	},
	
	project_contractors_add: function(frm, cdt, cdn) {
		// Refresh available balances when a new contractor is added
		setTimeout(() => {
			refresh_available_balances(frm);
			
			// Auto-populate project claim reference if not set
			if (!frm.doc.project_claim_reference) {
				auto_populate_project_claim_reference(frm);
			}
		}, 500);
	},
	
	project_contractors_remove: function(frm) {
		// Refresh available balances when a contractor is removed
		refresh_available_balances(frm);
		// Recalculate totals
		calculate_totals(frm);
	}
});



function setup_field_dependencies(frm) {
	// Set up queries and filters
	frm.set_query('project_contractor', 'project_contractors', function() {
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
}

function load_contractor_balance(frm, contractor_row) {
	if (!contractor_row.project_contractor) return;
	
	// Get available balance for this specific contractor
	frappe.call({
		method: 'svg_mobile_app.svg_mobile_app.doctype.project_advances.project_advances.get_project_contractor_summary',
		args: {
			project_contractor: contractor_row.project_contractor
		},
		callback: function(r) {
			if (r.message) {
				let data = r.message;
				// Update the total available balance for this contractor
				frappe.model.set_value(contractor_row.doctype, contractor_row.name, 'total_available_balance', data.total_available);
				
				// Refresh the available balances display
				refresh_available_balances(frm);
			}
		}
	});
}

function refresh_available_balances(frm) {
	if (!frm.doc.project_contractors || frm.doc.project_contractors.length === 0) {
		frm.set_value('available_fees_html', '<div class="alert alert-info">Please select project contractors first.</div>');
		frm.refresh_field('available_fees_html');
		return;
	}
	
	// Show loading indicator
	frm.set_value('available_fees_html', '<div class="text-center"><i class="fa fa-spinner fa-spin"></i> Loading available balances...</div>');
	frm.refresh_field('available_fees_html');
	
	// Call server method to get all available balances
	frm.call('refresh_available_balances').then(r => {
		console.log('Refresh available balances response:', r);
		if (r.message) {
			frm.set_value('available_fees_html', r.message);
			frm.refresh_field('available_fees_html');
		} else {
			frm.set_value('available_fees_html', '<div class="alert alert-warning">No data returned from server.</div>');
			frm.refresh_field('available_fees_html');
		}
	}).catch(error => {
		console.error('Error refreshing available balances:', error);
		frm.set_value('available_fees_html', '<div class="alert alert-danger">Error loading available balances. Check console for details.</div>');
		frm.refresh_field('available_fees_html');
	});
}



function auto_populate_project_claim_reference(frm) {
	if (!frm.doc.project_contractors || frm.doc.project_contractors.length === 0) {
		return;
	}
	
	// Get selected contractors
	let selected_contractors = frm.doc.project_contractors
		.filter(row => row.project_contractor)
		.map(row => row.project_contractor);
	
	if (selected_contractors.length === 0) {
		return;
	}
	
	// Call server method to find matching project claims
	frappe.call({
		method: 'svg_mobile_app.svg_mobile_app.doctype.project_advances.project_advances.find_project_claims_for_contractors',
		args: {
			contractor_list: selected_contractors
		},
		callback: function(r) {
			if (r.message && r.message.length === 1) {
				// Auto-populate if exactly one match found
				frm.set_value('project_claim_reference', r.message[0]);
				frappe.show_alert({
					message: __('Auto-populated Project Claim Reference: {0}', [r.message[0]]),
					indicator: 'green'
				});
			} else if (r.message && r.message.length > 1) {
				frappe.show_alert({
					message: __('Multiple Project Claims found. Please select manually.'),
					indicator: 'orange'
				});
			}
		}
	});
}

function calculate_totals(frm) {
	let total_distributed = 0;
	
	if (frm.doc.project_contractors) {
		frm.doc.project_contractors.forEach(function(contractor) {
			total_distributed += flt(contractor.allocated_amount);
		});
	}
	
	frm.set_value('total_distributed', total_distributed);
	let balance_remaining = flt(frm.doc.advance_amount) - total_distributed;
	frm.set_value('balance_remaining', balance_remaining);
	
	// Visual indicators for balance status
	setTimeout(() => {
		let balance_field = frm.get_field('balance_remaining');
		let total_field = frm.get_field('total_distributed');
		
		if (balance_remaining < 0) {
			// Negative balance - red indicator
			balance_field.$wrapper.find('.control-value').css('color', 'red').css('font-weight', 'bold');
			total_field.$wrapper.find('.control-value').css('color', 'red').css('font-weight', 'bold');
		} else if (balance_remaining === 0) {
			// Exact match - green indicator
			balance_field.$wrapper.find('.control-value').css('color', 'green').css('font-weight', 'bold');
			total_field.$wrapper.find('.control-value').css('color', 'green').css('font-weight', 'normal');
		} else {
			// Positive balance - normal
			balance_field.$wrapper.find('.control-value').css('color', '').css('font-weight', '');
			total_field.$wrapper.find('.control-value').css('color', '').css('font-weight', '');
		}
	}, 100);
}

	
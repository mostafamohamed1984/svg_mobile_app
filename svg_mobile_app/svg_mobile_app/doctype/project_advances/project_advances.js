// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

frappe.ui.form.on("Project Advances", {
	refresh: function(frm) {
		// Set up field dependencies
		setup_field_dependencies(frm);
		
		// Auto-refresh available balances when form loads
		if (frm.doc.project_contractors && frm.doc.project_contractors.length > 0) {
			setTimeout(() => {
				refresh_available_balances(frm);
			}, 500);
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
			// Auto-populate project claim reference for this contractor
			auto_populate_project_claim_reference_for_contractor(frm, cdt, cdn, row);
			
			// Load available balance for this contractor
			load_contractor_balance(frm, row);
			
			// Auto-refresh available balances display
			setTimeout(() => {
				refresh_available_balances(frm);
			}, 500);
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
		
		// Validate allocated amount doesn't exceed contractor's available balance
		if (flt(row.allocated_amount) > flt(row.total_available_balance)) {
			frappe.msgprint({
				title: __('Insufficient Balance'),
				message: __('Allocated amount ({0}) cannot exceed available balance ({1}) for {2}.', 
					[format_currency(row.allocated_amount), format_currency(row.total_available_balance), row.project_contractor]),
				indicator: 'red'
			});
			
			// Reset to available balance
			frappe.model.set_value(cdt, cdn, 'allocated_amount', row.total_available_balance || 0);
			calculate_totals(frm);
		}
	},
	
	project_contractors_add: function(frm, cdt, cdn) {
		// Recalculate totals when a new contractor is added
		calculate_totals(frm);
		
		// Auto-refresh available balances display
		setTimeout(() => {
			refresh_available_balances(frm);
		}, 500);
	},
	
	project_contractors_remove: function(frm) {
		// Recalculate totals when a contractor is removed
		calculate_totals(frm);
		
		// Auto-refresh available balances display
		setTimeout(() => {
			refresh_available_balances(frm);
		}, 500);
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
			}
		}
	});
}

function refresh_available_balances(frm) {
	if (!frm.doc.project_contractors || frm.doc.project_contractors.length === 0) {
		let html_field = frm.get_field('available_fees_html');
		if (html_field && html_field.$wrapper) {
			html_field.$wrapper.html('<div class="alert alert-info">Please select project contractors first.</div>');
		}
		return;
	}
	
	// Show loading indicator
	let html_field = frm.get_field('available_fees_html');
	if (html_field && html_field.$wrapper) {
		html_field.$wrapper.html('<div class="text-center"><i class="fa fa-spinner fa-spin"></i> Loading available balances...</div>');
	}
	
	// Call server method to get all available balances
	frm.call('refresh_available_balances').then(r => {
		if (r.message) {
			// Only use direct DOM manipulation to avoid triggering "not saved" state
			let html_field = frm.get_field('available_fees_html');
			if (html_field && html_field.$wrapper) {
				html_field.$wrapper.html(r.message);
			}
			
			// Also try direct field access as backup
			let field_wrapper = frm.fields_dict.available_fees_html;
			if (field_wrapper && field_wrapper.$wrapper) {
				field_wrapper.$wrapper.html(r.message);
			}
		} else {
			let html_field = frm.get_field('available_fees_html');
			if (html_field && html_field.$wrapper) {
				html_field.$wrapper.html('<div class="alert alert-warning">No data returned from server.</div>');
			}
		}
	}).catch(error => {
		console.error('Error refreshing available balances:', error);
		let html_field = frm.get_field('available_fees_html');
		if (html_field && html_field.$wrapper) {
			html_field.$wrapper.html('<div class="alert alert-danger">Error loading available balances. Check console for details.</div>');
		}
	});
}



function auto_populate_project_claim_reference_for_contractor(frm, cdt, cdn, row) {
	if (!row.project_contractor) {
		return;
	}
	
	// Call server method to find matching project claims for this specific contractor
	frappe.call({
		method: 'svg_mobile_app.svg_mobile_app.doctype.project_advances.project_advances.find_project_claims_for_contractor',
		args: {
			project_contractor: row.project_contractor
		},
		callback: function(r) {
			if (r.message && r.message.length === 1) {
				// Auto-populate if exactly one match found
				frappe.model.set_value(cdt, cdn, 'project_claim_reference', r.message[0]);
				frappe.show_alert({
					message: __('Auto-populated Project Claim Reference for {0}: {1}', [row.project_contractor, r.message[0]]),
					indicator: 'green'
				});
			} else if (r.message && r.message.length > 1) {
				frappe.show_alert({
					message: __('Multiple Project Claims found for {0}. Please select manually.', [row.project_contractor]),
					indicator: 'orange'
				});
			} else {
				// Only show alert if user specifically requested project claim lookup
				// Don't show for automatic population attempts
				console.log('No Project Claims found for ' + row.project_contractor);
			}
		}
	});
}

function calculate_totals(frm) {
	let total_allocated = 0;
	
	if (frm.doc.project_contractors) {
		frm.doc.project_contractors.forEach(function(contractor) {
			total_allocated += flt(contractor.allocated_amount);
		});
	}
	
	// Update both fields with the calculated total
	frm.set_value('total_distributed', total_allocated);
	frm.set_value('total_advance_amount', total_allocated);
	
	// Visual indicator for total allocated amount
	setTimeout(() => {
		let total_field = frm.get_field('total_distributed');
		let advance_field = frm.get_field('total_advance_amount');
		
		if (total_allocated > 0) {
			// Show positive allocation in green
			if (total_field && total_field.$wrapper) {
				total_field.$wrapper.find('.control-value').css('color', 'green').css('font-weight', 'bold');
			}
			if (advance_field && advance_field.$wrapper) {
				advance_field.$wrapper.find('.control-value').css('color', 'green').css('font-weight', 'bold');
			}
		} else {
			// Reset to normal styling
			if (total_field && total_field.$wrapper) {
			total_field.$wrapper.find('.control-value').css('color', '').css('font-weight', '');
			}
			if (advance_field && advance_field.$wrapper) {
				advance_field.$wrapper.find('.control-value').css('color', '').css('font-weight', '');
			}
		}
	}, 100);
}

	
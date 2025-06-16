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
	},
	
	advance_amount: function(frm) {
		calculate_totals(frm);
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
			frappe.msgprint(__('Allocated amount cannot exceed available balance'));
			frappe.model.set_value(cdt, cdn, 'allocated_amount', row.total_available_balance);
		}
		
		// Recalculate totals
		calculate_totals(frm);
	},
	
	project_contractors_add: function(frm, cdt, cdn) {
		// Refresh available balances when a new contractor is added
		setTimeout(() => {
			refresh_available_balances(frm);
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
		return;
	}
	
	// Show loading indicator
	frm.set_value('available_fees_html', '<div class="text-center"><i class="fa fa-spinner fa-spin"></i> Loading available balances...</div>');
	
	// Call server method to get all available balances
	frm.call('refresh_available_balances').then(r => {
		if (r.message) {
			frm.set_value('available_fees_html', r.message);
			frm.refresh_field('available_fees_html');
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
	frm.set_value('balance_remaining', flt(frm.doc.advance_amount) - total_distributed);
}

	
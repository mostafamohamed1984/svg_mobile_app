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
	
	advance_amount: function(frm) {
		if (frm.doc.advance_amount && frm.doc.project_contractors && frm.doc.project_contractors.length > 0) {
			// Validate advance amount
			validate_advance_amount(frm);
			
			// Auto-distribute if method is selected
			if (frm.doc.distribution_method && frm.doc.distribution_method !== 'Manual') {
				auto_distribute_amounts(frm);
			}
		}
	},
	
	distribution_method: function(frm) {
		if (frm.doc.advance_amount && frm.doc.project_contractors && frm.doc.project_contractors.length > 0 && frm.doc.distribution_method !== 'Manual') {
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

// Project Contractors child table events
frappe.ui.form.on("Project Advance Contractors", {
	project_contractor: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];
		if (row.project_contractor) {
			// Load available balance for this contractor
			load_contractor_balance(frm, row);
		}
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
		// Also remove related advance items
		remove_advance_items_for_removed_contractors(frm);
	}
});

// Advance Items child table events
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
			frappe.model.set_value(cdt, cdn, 'purpose', `Advance for ${row.item_code} - ${row.project_name || row.project_contractor}`);
		}
	},
	
	advance_items_remove: function(frm) {
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
	
	frm.set_query('employee', 'advance_items', function() {
		return {
			filters: {
				'status': 'Active'
			}
		};
	});
	
	frm.set_query('project_contractor', 'advance_items', function() {
		// Only allow project contractors that are selected in the main table
		let selected_contractors = [];
		if (frm.doc.project_contractors) {
			selected_contractors = frm.doc.project_contractors.map(row => row.project_contractor).filter(Boolean);
		}
		
		if (selected_contractors.length > 0) {
			return {
				filters: {
					'name': ['in', selected_contractors]
				}
			};
		} else {
			return {
				filters: {
					'name': 'no-match'  // Return no results if no contractors selected
				}
			};
		}
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

function validate_advance_amount(frm) {
	if (!frm.doc.advance_amount || !frm.doc.project_contractors) return;
	
	// Calculate total available balance across all contractors
	let total_available = 0;
	frm.doc.project_contractors.forEach(function(contractor) {
		total_available += flt(contractor.total_available_balance);
	});
	
	if (flt(frm.doc.advance_amount) > total_available) {
		frappe.msgprint({
			title: __('Invalid Amount'),
			message: __('Advance amount {0} cannot exceed total available balance {1}', 
				[format_currency(frm.doc.advance_amount), format_currency(total_available)]),
			indicator: 'red'
		});
		frm.set_value('advance_amount', total_available);
	}
}

function auto_distribute_amounts(frm) {
	if (!frm.doc.advance_amount || !frm.doc.distribution_method || !frm.doc.project_contractors) {
		return;
	}
	
	frm.call('auto_distribute_amounts').then(r => {
		if (r.message && r.message.status === 'success') {
			frm.refresh_field('advance_items');
			frm.refresh_field('total_distributed');
			frm.refresh_field('balance_remaining');
			frappe.show_alert({
				message: __('Amounts distributed successfully'),
				indicator: 'green'
			});
		} else if (r.message && r.message.message) {
			frappe.msgprint(r.message.message);
		}
	});
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

function remove_advance_items_for_removed_contractors(frm) {
	if (!frm.doc.advance_items || !frm.doc.project_contractors) return;
	
	// Get list of currently selected contractors
	let selected_contractors = frm.doc.project_contractors.map(row => row.project_contractor).filter(Boolean);
	
	// Remove advance items for contractors that are no longer selected
	let items_to_remove = [];
	frm.doc.advance_items.forEach(function(item, index) {
		if (item.project_contractor && !selected_contractors.includes(item.project_contractor)) {
			items_to_remove.push(index);
		}
	});
	
	// Remove items in reverse order to maintain indices
	items_to_remove.reverse().forEach(function(index) {
		frm.get_field('advance_items').grid.grid_rows[index].remove();
	});
	
	frm.refresh_field('advance_items');
	calculate_totals(frm);
}

function create_additional_advance(frm) {
	// Create a new Project Advance with remaining balance
	if (flt(frm.doc.remaining_balance) <= 0) {
		frappe.msgprint(__('No remaining balance available for additional advance'));
		return;
	}
	
	frappe.new_doc('Project Advances', {
		project_contractors: frm.doc.project_contractors,
		advance_amount: frm.doc.remaining_balance,
		purpose: `Additional advance from ${frm.doc.name}`,
		custodian_employee: frm.doc.custodian_employee,
		distribution_method: frm.doc.distribution_method
	});
} 
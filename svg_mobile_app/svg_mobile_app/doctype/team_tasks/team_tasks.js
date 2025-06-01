// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Team Tasks", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on("Team Tasks", {
	refresh(frm) {
		// Add pause/resume buttons for recurring tasks
		if (["Hourly", "Daily", "weekly", "Monthly"].includes(frm.doc.task_type)) {
			if (!frm.doc.is_paused) {
				frm.add_custom_button(__('Pause Scheduling'), function() {
					frappe.confirm(
						__('This will pause automatic updates for this recurring task. Continue?'),
						function() {
							frm.set_value('is_paused', 1);
							frm.save();
							frappe.show_alert({
								message: __('Task scheduling paused'),
								indicator: 'orange'
							}, 3);
						}
					);
				}, __('Scheduling'));
			} else {
				frm.add_custom_button(__('Resume Scheduling'), function() {
					frm.set_value('is_paused', 0);
					frm.save();
					frappe.show_alert({
						message: __('Task scheduling resumed'),
						indicator: 'green'
					}, 3);
				}, __('Scheduling'));
			}
		}
	},
});

// Configure default Kanban view
frappe.listview_settings['Team Tasks'] = {
	// Force default view to Kanban
	default_view: "Kanban",
	
	// Kanban specific settings
	get_indicator: function(doc) {
		// Define indicators for different statuses
		const status_colors = {
			"Open": "blue",
			"Working": "orange", 
			"Pending Review": "purple",
			"Overdue": "red",
			"Completed": "green",
			"Cancelled": "gray"
		};
		return [__(doc.status), status_colors[doc.status], "status,=," + doc.status];
	},
};

// Setup status-based Kanban board when the list view loads
frappe.listview_settings['Team Tasks'].onload = function(listview) {
	// Check if we need to create a status-based Kanban board
	createStatusKanbanBoard();
	
	// Add task_type filter
	listview.page.add_field({
		fieldtype: 'Select',
		fieldname: 'task_type',
		label: 'Task Type',
		options: '\nHourly\nDaily\nweekly\nMonthly\nAssigned',
		onchange: function() {
			if (this.value) {
				listview.filter_area.add([[listview.doctype, 'task_type', '=', this.value]]);
			} else {
				listview.filter_area.remove(listview.doctype, 'task_type');
			}
			listview.refresh();
		}
	});
	
	// Add paused status filter
	listview.page.add_field({
		fieldtype: 'Check',
		fieldname: 'is_paused',
		label: 'Show Paused Tasks',
		onchange: function() {
			if (this.value) {
				listview.filter_area.add([[listview.doctype, 'is_paused', '=', 1]]);
			} else {
				listview.filter_area.remove(listview.doctype, 'is_paused');
			}
			listview.refresh();
		}
	});
};

// Function to create a status-based Kanban board
function createStatusKanbanBoard() {
	frappe.call({
		method: 'frappe.client.get_list',
		args: {
			doctype: 'Kanban Board',
			filters: {
				'reference_doctype': 'Team Tasks',
				'kanban_board_name': ['like', '%Status%']
			}
		},
		callback: function(r) {
			if (!r.message || r.message.length === 0) {
				// Create a new status-based Kanban board
				frappe.call({
					method: 'frappe.client.insert',
					args: {
						doc: {
							'doctype': 'Kanban Board',
							'kanban_board_name': 'Team Tasks Status Board',
							'reference_doctype': 'Team Tasks',
							'field_name': 'status',
							'columns': [
								{ 'column_name': 'Open', 'indicator': 'blue' },
								{ 'column_name': 'Working', 'indicator': 'orange' },
								{ 'column_name': 'Pending Review', 'indicator': 'purple' },
								{ 'column_name': 'Overdue', 'indicator': 'red' },
								{ 'column_name': 'Completed', 'indicator': 'green' },
								{ 'column_name': 'Cancelled', 'indicator': 'gray' }
							]
						}
					},
					callback: function(r) {
						if (r.message) {
							// Refresh the page to show the new Kanban board
							setTimeout(function() {
								window.location.reload();
							}, 2000);
						}
					}
				});
			}
		}
	});
}

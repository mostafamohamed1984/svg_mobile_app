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
							});
						}
					);
				});
			} else {
				frm.add_custom_button(__('Resume Scheduling'), function() {
					frappe.confirm(
						__('This will resume automatic updates for this recurring task. Continue?'),
						function() {
							frm.set_value('is_paused', 0);
							frm.save();
							frappe.show_alert({
								message: __('Task scheduling resumed'),
								indicator: 'green'
							});
						}
					);
				});
			}
		}
	}
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

	// Custom Kanban card formatting
	formatters: {
		subject: function(value, field, doc) {
			// Custom title with priority indicator
			let priority_color = '';
			switch(doc.priority) {
				case 'Urgent': priority_color = 'red'; break;
				case 'High': priority_color = 'orange'; break;
				case 'Medium': priority_color = 'blue'; break;
				case 'Low': priority_color = 'green'; break;
				default: priority_color = 'gray';
			}
			
			let priority_badge = doc.priority ? 
				`<span class="badge badge-sm" style="background-color: ${priority_color}; color: white; margin-left: 8px;">${doc.priority}</span>` : '';
			
			return `<strong>${value}</strong>${priority_badge}`;
		}
	},

	// Custom Kanban card template
	kanban_card_template: function(doc) {
		// Format due date
		let due_date_display = '';
		if (doc.due_date) {
			const due = new Date(doc.due_date);
			const today = new Date();
			const diffTime = due - today;
			const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
			
			let due_class = '';
			if (diffDays < 0) {
				due_class = 'text-danger';
				due_date_display = `<span class="${due_class}">Overdue (${Math.abs(diffDays)} days)</span>`;
			} else if (diffDays === 0) {
				due_class = 'text-warning';
				due_date_display = `<span class="${due_class}">Due Today</span>`;
			} else if (diffDays <= 3) {
				due_class = 'text-warning';
				due_date_display = `<span class="${due_class}">Due in ${diffDays} days</span>`;
			} else {
				due_date_display = `Due: ${frappe.datetime.str_to_user(doc.due_date)}`;
			}
		}

		// Priority badge
		let priority_badge = '';
		if (doc.priority) {
			let priority_color = '';
			switch(doc.priority) {
				case 'Urgent': priority_color = '#dc3545'; break;
				case 'High': priority_color = '#fd7e14'; break;
				case 'Medium': priority_color = '#0d6efd'; break;
				case 'Low': priority_color = '#198754'; break;
				default: priority_color = '#6c757d';
			}
			priority_badge = `<span class="badge" style="background-color: ${priority_color}; color: white; font-size: 10px;">${doc.priority}</span>`;
		}

		// Task type badge
		let task_type_badge = '';
		if (doc.task_type && doc.task_type !== 'Assigned') {
			task_type_badge = `<span class="badge badge-light" style="font-size: 10px; margin-left: 4px;">${doc.task_type}</span>`;
		}

		// Paused indicator
		let paused_indicator = '';
		if (doc.is_paused) {
			paused_indicator = `<span class="badge badge-warning" style="font-size: 10px; margin-left: 4px;">⏸ Paused</span>`;
		}

		return `
			<div class="kanban-card-content" style="padding: 12px;">
				<div class="kanban-card-header" style="margin-bottom: 8px;">
					<div style="font-weight: 600; font-size: 14px; line-height: 1.3; margin-bottom: 4px;">
						${doc.subject || doc.name}
					</div>
					<div style="display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px;">
						${priority_badge}
						${task_type_badge}
						${paused_indicator}
					</div>
				</div>
				
				<div class="kanban-card-body" style="font-size: 12px; color: #666;">
					${doc.employee_name ? `
						<div style="margin-bottom: 4px;">
							<i class="fa fa-user" style="width: 12px; margin-right: 6px;"></i>
							<strong>${doc.employee_name}</strong>
						</div>
					` : ''}
					
					${due_date_display ? `
						<div style="margin-bottom: 4px;">
							<i class="fa fa-calendar" style="width: 12px; margin-right: 6px;"></i>
							${due_date_display}
						</div>
					` : ''}
					
					${doc.task_type ? `
						<div style="margin-bottom: 4px;">
							<i class="fa fa-tag" style="width: 12px; margin-right: 6px;"></i>
							${doc.task_type}
						</div>
					` : ''}
				</div>
				
				${doc.description ? `
					<div class="kanban-card-footer" style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #eee; font-size: 11px; color: #888; max-height: 40px; overflow: hidden;">
						${doc.description.substring(0, 80)}${doc.description.length > 80 ? '...' : ''}
					</div>
				` : ''}
			</div>
		`;
	}
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

	// Add priority filter
	listview.page.add_field({
		fieldtype: 'Select',
		fieldname: 'priority',
		label: 'Priority',
		options: '\nLow\nMedium\nHigh\nUrgent',
		onchange: function() {
			if (this.value) {
				listview.filter_area.add([[listview.doctype, 'priority', '=', this.value]]);
			} else {
				listview.filter_area.remove(listview.doctype, 'priority');
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

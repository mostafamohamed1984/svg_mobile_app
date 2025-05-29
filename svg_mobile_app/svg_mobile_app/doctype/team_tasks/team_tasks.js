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
	// Set default view to Kanban if needed
	// default_view: "Kanban",
	
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
	
	// Kanban settings
	kanban_board_filters: [
		["reference_doctype", "=", "Team Tasks"]
	]
};

// Add custom filter for task_type if still needed
frappe.listview_settings['Team Tasks'].onload = function(listview) {
	// Add task_type filter
	listview.page.add_field({
		fieldtype: 'Select',
		fieldname: 'task_type',
		label: 'Task Type',
		options: '\nHourly\nDaily\nweekly\nMonthly\nAssigned',
		onchange: function() {
			listview.filter_area.add([[listview.doctype, 'task_type', '=', this.value]]);
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

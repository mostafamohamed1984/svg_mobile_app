// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Team Tasks", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on("Team Tasks", {
	refresh(frm) {
		// Add any form-level logic here
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
};

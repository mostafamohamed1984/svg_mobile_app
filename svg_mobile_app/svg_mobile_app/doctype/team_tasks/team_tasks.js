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

	// Custom Kanban card enhancement
	setTimeout(function() {
		enhanceKanbanCards(listview);
	}, 1000);
};

// Function to enhance Kanban cards with additional information
function enhanceKanbanCards(listview) {
	// Wait for Kanban view to be ready
	if (listview.view_name !== 'Kanban') return;
	
	// Override the Kanban card rendering
	if (listview.kanban && listview.kanban.wrapper) {
		// Add custom CSS for enhanced cards
		if (!document.getElementById('team-tasks-kanban-styles')) {
			const style = document.createElement('style');
			style.id = 'team-tasks-kanban-styles';
			style.textContent = `
				.kanban-card-enhanced {
					padding: 12px !important;
					border-radius: 6px;
					box-shadow: 0 2px 4px rgba(0,0,0,0.1);
				}
				.kanban-card-title {
					font-weight: 600;
					font-size: 14px;
					margin-bottom: 8px;
					line-height: 1.3;
				}
				.kanban-card-badges {
					display: flex;
					flex-wrap: wrap;
					gap: 4px;
					margin-bottom: 8px;
				}
				.kanban-card-info {
					font-size: 12px;
					color: #666;
					line-height: 1.4;
				}
				.kanban-card-info div {
					margin-bottom: 4px;
				}
				.kanban-card-footer {
					margin-top: 8px;
					padding-top: 6px;
					border-top: 1px solid #eee;
					font-size: 11px;
					color: #888;
					max-height: 40px;
					overflow: hidden;
				}
				.priority-urgent { background-color: #dc3545 !important; }
				.priority-high { background-color: #fd7e14 !important; }
				.priority-medium { background-color: #0d6efd !important; }
				.priority-low { background-color: #198754 !important; }
				.task-type-badge { background-color: #6c757d !important; }
				.paused-badge { background-color: #ffc107 !important; color: #000 !important; }
			`;
			document.head.appendChild(style);
		}

		// Monitor for new cards being added
		const observer = new MutationObserver(function(mutations) {
			mutations.forEach(function(mutation) {
				mutation.addedNodes.forEach(function(node) {
					if (node.nodeType === 1 && node.classList && node.classList.contains('kanban-card')) {
						enhanceSingleCard(node);
					}
				});
			});
		});

		observer.observe(listview.kanban.wrapper[0], {
			childList: true,
			subtree: true
		});

		// Enhance existing cards
		setTimeout(function() {
			listview.kanban.wrapper.find('.kanban-card').each(function() {
				enhanceSingleCard(this);
			});
		}, 500);
	}
}

// Function to enhance a single Kanban card
function enhanceSingleCard(cardElement) {
	const $card = $(cardElement);
	
	// Skip if already enhanced
	if ($card.hasClass('kanban-card-enhanced')) return;
	
	// Get the document name from the card
	const docName = $card.attr('data-name');
	if (!docName) return;

	// Fetch the document data
	frappe.call({
		method: 'frappe.client.get',
		args: {
			doctype: 'Team Tasks',
			name: docName
		},
		callback: function(r) {
			if (r.message) {
				const doc = r.message;
				updateCardContent($card, doc);
			}
		}
	});
}

// Function to update card content with enhanced information
function updateCardContent($card, doc) {
	// Mark as enhanced
	$card.addClass('kanban-card-enhanced');
	
	// Build enhanced content
	let content = `<div class="kanban-card-title">${doc.subject || doc.name}</div>`;
	
	// Add badges
	content += '<div class="kanban-card-badges">';
	
	// Priority badge
	if (doc.priority) {
		const priorityClass = `priority-${doc.priority.toLowerCase()}`;
		content += `<span class="badge ${priorityClass}" style="color: white; font-size: 10px;">${doc.priority}</span>`;
	}
	
	// Task type badge
	if (doc.task_type && doc.task_type !== 'Assigned') {
		content += `<span class="badge task-type-badge" style="color: white; font-size: 10px;">${doc.task_type}</span>`;
	}
	
	// Paused indicator
	if (doc.is_paused) {
		content += `<span class="badge paused-badge" style="font-size: 10px;">⏸ Paused</span>`;
	}
	
	content += '</div>';
	
	// Add info section
	content += '<div class="kanban-card-info">';
	
	// Employee name
	if (doc.employee_name) {
		content += `<div><i class="fa fa-user" style="width: 12px; margin-right: 6px;"></i><strong>${doc.employee_name}</strong></div>`;
	}
	
	// Due date
	if (doc.due_date) {
		const due = new Date(doc.due_date);
		const today = new Date();
		const diffTime = due - today;
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		
		let dueDateText = '';
		let dueDateClass = '';
		
		if (diffDays < 0) {
			dueDateText = `Overdue (${Math.abs(diffDays)} days)`;
			dueDateClass = 'text-danger';
		} else if (diffDays === 0) {
			dueDateText = 'Due Today';
			dueDateClass = 'text-warning';
		} else if (diffDays <= 3) {
			dueDateText = `Due in ${diffDays} days`;
			dueDateClass = 'text-warning';
		} else {
			dueDateText = `Due: ${frappe.datetime.str_to_user(doc.due_date)}`;
		}
		
		content += `<div><i class="fa fa-calendar" style="width: 12px; margin-right: 6px;"></i><span class="${dueDateClass}">${dueDateText}</span></div>`;
	}
	
	content += '</div>';
	
	// Add description footer
	if (doc.description) {
		const shortDesc = doc.description.substring(0, 80);
		content += `<div class="kanban-card-footer">${shortDesc}${doc.description.length > 80 ? '...' : ''}</div>`;
	}
	
	// Update the card content
	$card.html(content);
}

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

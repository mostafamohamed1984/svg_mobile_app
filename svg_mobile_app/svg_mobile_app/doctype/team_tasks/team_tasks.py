# Copyright (c) 2025, SVG and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class TeamTasks(Document):
	pass

def create_status_kanban_board():
	"""Create a status-based Kanban board for Team Tasks"""
	# Check if status board already exists
	existing_boards = frappe.get_all(
		"Kanban Board",
		filters={
			"reference_doctype": "Team Tasks",
			"field_name": "status"
		}
	)
	
	if not existing_boards:
		# Create a new status-based Kanban board
		board = frappe.new_doc("Kanban Board")
		board.kanban_board_name = "Team Tasks Status"
		board.reference_doctype = "Team Tasks"
		board.field_name = "status"
		
		# Add columns for each status
		statuses = ["Open", "Working", "Pending Review", "Overdue", "Completed", "Cancelled"]
		for status in statuses:
			board.append("columns", {
				"column_name": status
			})
		
		board.save()
		frappe.db.commit()
		frappe.msgprint(f"Created Kanban board: {board.kanban_board_name}")
	
	return "Status Kanban board is ready"

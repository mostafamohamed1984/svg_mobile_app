import frappe

def execute():
    """Run daily tasks update"""
    try:
        from svg_mobile_app.server_scripts.tasks_updater import update_daily_tasks, check_meeting_conflicts
        
        # Update daily tasks
        update_daily_tasks()
        frappe.logger().info("Daily tasks updated successfully")
        
        # Check meeting conflicts
        conflicts = check_meeting_conflicts()
        if conflicts > 0:
            frappe.logger().warning(f"Found {conflicts} meeting timing conflicts")
        else:
            frappe.logger().info("No meeting timing conflicts found")
            
    except Exception as e:
        frappe.logger().error(f"Error updating daily tasks: {e}") 
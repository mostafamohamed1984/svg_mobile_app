import frappe

def execute():
    """Run daily tasks update"""
    try:
        from svg_mobile_app.server_scripts.tasks_updater import update_daily_tasks
        update_daily_tasks()
        frappe.logger().info("Daily tasks updated successfully")
    except Exception as e:
        frappe.logger().error(f"Error updating daily tasks: {e}") 
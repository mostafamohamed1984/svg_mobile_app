import frappe

def execute():
    """Run hourly tasks update"""
    try:
        from svg_mobile_app.server_scripts.tasks_updater import update_hourly_tasks
        update_hourly_tasks()
        frappe.logger().info("Hourly tasks updated successfully")
    except Exception as e:
        frappe.logger().error(f"Error updating hourly tasks: {e}") 
import frappe

def execute():
    """Run weekly tasks update"""
    try:
        from svg_mobile_app.server_scripts.tasks_updater import update_weekly_tasks
        update_weekly_tasks()
        frappe.logger().info("Weekly tasks updated successfully")
    except Exception as e:
        frappe.logger().error(f"Error updating weekly tasks: {e}") 
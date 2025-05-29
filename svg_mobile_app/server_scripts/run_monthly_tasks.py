import frappe

def execute():
    """Run monthly tasks update"""
    try:
        from svg_mobile_app.server_scripts.tasks_updater import update_monthly_tasks
        update_monthly_tasks()
        frappe.logger().info("Monthly tasks updated successfully")
    except Exception as e:
        frappe.logger().error(f"Error updating monthly tasks: {e}") 
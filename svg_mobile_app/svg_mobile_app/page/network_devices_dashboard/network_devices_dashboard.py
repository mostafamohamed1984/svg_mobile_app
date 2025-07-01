import frappe
from frappe import _
from frappe.utils import now, get_datetime, date_diff, add_to_date, getdate
import json

@frappe.whitelist()
def get_network_devices(filters=None):
    """Get all network devices with their current status"""
    filters = frappe.parse_json(filters) if filters else {}
    
    # Build conditions
    conditions = []
    params = []
    
    if filters.get('device_type'):
        conditions.append("app_type = %s")
        params.append(filters['device_type'])
    
    if filters.get('status'):
        conditions.append("status = %s")
        params.append(filters['status'])
    
    if filters.get('search'):
        search_term = f"%{filters['search']}%"
        conditions.append("(id LIKE %s)")
        params.append(search_term)
    
    where_clause = " AND " + " AND ".join(conditions) if conditions else ""
    
    # Get all remote access devices
    query = f"""
        SELECT 
            name,
            id,
            app_type,
            status,
            assign_to,
            password,
            expiration_datetime,
            creation,
            modified,
            password_complexity_level,
            (SELECT COUNT(*) FROM `tabRemote Access Log` 
             WHERE reference = `tabRemote Access`.name 
             AND connection_start_time IS NOT NULL 
             AND connection_end_time IS NULL) as active_connections
        FROM `tabRemote Access`
        WHERE 1=1 {where_clause}
        ORDER BY id
    """
    
    devices = frappe.db.sql(query, tuple(params), as_dict=True)
    
    # Process device data
    processed_devices = []
    for device in devices:
        # Determine actual status based on active connections and expiry
        actual_status = get_device_actual_status(device)
        
        # Get last activity
        last_activity = get_last_activity(device.name)
        
        processed_device = {
            'name': device.name,
            'device_name': device.id,  # Using id as device name
            'id': device.id,
            'app_type': device.app_type,
            'status': actual_status,
            'assigned_to': device.assign_to,
            'has_password': bool(device.password),
            'expiry_date': device.expiration_datetime,
            'password_complexity': device.password_complexity_level,
            'active_connections': device.active_connections,
            'last_activity': last_activity,
            'creation': device.creation,
            'modified': device.modified
        }
        
        processed_devices.append(processed_device)
    
    return processed_devices

def get_device_actual_status(device):
    """Determine the actual status of a device based on various factors"""
    
    # Check if expired
    if device.expiration_datetime and getdate(device.expiration_datetime) < getdate():
        return 'Expired'
    
    # Check if has active connections
    if device.active_connections > 0:
        return 'In Use'
    
    # Return the stored status
    return device.status

def get_last_activity(device_name):
    """Get the last activity timestamp for a device"""
    last_log = frappe.db.sql("""
        SELECT connection_start_time, connection_end_time
        FROM `tabRemote Access Log`
        WHERE reference = %s
        ORDER BY creation DESC
        LIMIT 1
    """, (device_name,), as_dict=True)
    
    if last_log:
        log = last_log[0]
        if log.connection_end_time:
            return log.connection_end_time
        elif log.connection_start_time:
            return log.connection_start_time
    
    return None

@frappe.whitelist()
def get_device_details(device_name):
    """Get detailed information about a specific device"""
    device = frappe.get_doc('Remote Access', device_name)
    
    # Get connection history
    connection_history = frappe.db.sql("""
        SELECT 
            connection_start_time,
            connection_end_time,
            connection_duration,
            connection_purpose,
            session_rating,
            creation
        FROM `tabRemote Access Log`
        WHERE reference = %s
        ORDER BY creation DESC
        LIMIT 10
    """, (device_name,), as_dict=True)
    
    # Get current active connection
    active_connection = frappe.db.sql("""
        SELECT 
            connection_start_time,
            connection_purpose,
            creation
        FROM `tabRemote Access Log`
        WHERE reference = %s
        AND connection_start_time IS NOT NULL
        AND connection_end_time IS NULL
        ORDER BY creation DESC
        LIMIT 1
    """, (device_name,), as_dict=True)
    
    return {
        'device': device.as_dict(),
        'connection_history': connection_history,
        'active_connection': active_connection[0] if active_connection else None,
        'can_reserve': can_user_reserve_device(device),
        'can_connect': can_user_connect_device(device),
        'user_permissions': get_user_device_permissions(device)
    }

def can_user_reserve_device(device):
    """Check if current user can reserve this device"""
    if device.status != 'Available':
        return False
    
    # Check if user has permission
    if not frappe.has_permission('Remote Access', 'write', device.name):
        return False
    
    return True

def can_user_connect_device(device):
    """Check if current user can connect to this device"""
    if device.status == 'Expired':
        return False
    
    # If device is reserved, only the assigned user can connect
    if device.status == 'Reserved' and device.assign_to != frappe.session.user:
        return False
    
    # If device is in use (Temporary), only the assigned user can connect
    if device.status == 'Temporary' and device.assign_to != frappe.session.user:
        return False
    
    # Check if there's an active connection by someone else
    active_connection = frappe.db.sql("""
        SELECT user FROM `tabRemote Access Log`
        WHERE reference = %s
        AND connection_start_time IS NOT NULL
        AND connection_end_time IS NULL
        ORDER BY creation DESC
        LIMIT 1
    """, (device.name,), as_dict=True)
    
    if active_connection and active_connection[0].user != frappe.session.user:
        return False
    
    # Check if user has permission (allow if user is assigned or device is available)
    if not frappe.has_permission('Remote Access', 'read', device.name):
        # Allow connection if device is available or user is assigned
        if device.status != 'Available' and device.assign_to != frappe.session.user:
            return False
    
    return True

def get_user_device_permissions(device):
    """Get user's permissions for this device"""
    return {
        'can_read': frappe.has_permission('Remote Access', 'read', device.name),
        'can_write': frappe.has_permission('Remote Access', 'write', device.name),
        'can_delete': frappe.has_permission('Remote Access', 'delete', device.name),
        'is_assigned_user': device.assign_to == frappe.session.user
    }

@frappe.whitelist()
def reserve_device(device_name, purpose=None):
    """Reserve a device for the current user"""
    try:
        device = frappe.get_doc('Remote Access', device_name)
        
        if not can_user_reserve_device(device):
            frappe.throw(_("You cannot reserve this device"))
        
        # Update device status
        device.status = 'Reserved'
        device.assign_to = frappe.session.user
        device.save()
        
        # Create log entry
        log = frappe.get_doc({
            'doctype': 'Remote Access Log',
            'reference': device_name,
            'connection_purpose': purpose or 'Other'
        })
        log.insert()
        
        frappe.db.commit()
        
        return {
            'success': True,
            'message': f'Device {device.id} has been reserved successfully'
        }
        
    except Exception as e:
        frappe.db.rollback()
        return {
            'success': False,
            'message': str(e)
        }

@frappe.whitelist()
def release_device(device_name):
    """Release a reserved device"""
    try:
        device = frappe.get_doc('Remote Access', device_name)
        
        # Check if user can release this device
        if device.assign_to != frappe.session.user and not frappe.has_permission('Remote Access', 'write', device.name):
            frappe.throw(_("You cannot release this device"))
        
        # Update device status
        device.status = 'Available'
        device.assign_to = None
        device.save()
        
        frappe.db.commit()
        
        return {
            'success': True,
            'message': f'Device {device.id} has been released successfully'
        }
        
    except Exception as e:
        frappe.db.rollback()
        return {
            'success': False,
            'message': str(e)
        }

@frappe.whitelist()
def start_connection(device_name, purpose=None):
    """Start a connection to a device"""
    try:
        device = frappe.get_doc('Remote Access', device_name)
        
        if not can_user_connect_device(device):
            frappe.throw(_("You cannot connect to this device"))
        
        # Create connection log
        log = frappe.get_doc({
            'doctype': 'Remote Access Log',
            'reference': device_name,
            'connection_start_time': now(),
            'connection_purpose': purpose or 'Other'
        })
        log.insert()
        
        # Update device status if it was available
        if device.status == 'Available':
            device.status = 'Temporary'
            device.assign_to = frappe.session.user
            device.save()
        
        frappe.db.commit()
        
        # Only return sensitive information to authorized users
        device_details = device.as_dict()
        
        # Remove sensitive fields if user is not authorized
        if not can_user_connect_device(device):
            device_details.pop('password', None)
            device_details.pop('new_password', None)
            device_details.pop('old_password', None)
        
        return {
            'success': True,
            'message': f'Connection to {device.id} started successfully',
            'connection_id': log.name,
            'device_details': device_details
        }
        
    except Exception as e:
        frappe.db.rollback()
        return {
            'success': False,
            'message': str(e)
        }

@frappe.whitelist()
def get_device_statistics():
    """Get overall device statistics for the dashboard"""
    stats = frappe.db.sql("""
        SELECT 
            COUNT(*) as total_devices,
            SUM(CASE WHEN status = 'Available' THEN 1 ELSE 0 END) as available_devices,
            SUM(CASE WHEN status = 'Reserved' THEN 1 ELSE 0 END) as reserved_devices,
            SUM(CASE WHEN status = 'Temporary' THEN 1 ELSE 0 END) as in_use_devices,
            SUM(CASE WHEN status = 'Expired' THEN 1 ELSE 0 END) as expired_devices,
            SUM(CASE WHEN (SELECT COUNT(*) FROM `tabRemote Access Log` 
                          WHERE reference = `tabRemote Access`.name 
                          AND connection_start_time IS NOT NULL 
                          AND connection_end_time IS NULL) > 0 THEN 1 ELSE 0 END) as active_connections
        FROM `tabRemote Access`
    """, as_dict=True)
    
    return stats[0] if stats else {}

@frappe.whitelist()
def get_app_types():
    """Get all app types for filtering"""
    app_types = frappe.db.sql("""
        SELECT name, name1
        FROM `tabApp Type`
        ORDER BY name1
    """, as_dict=True)
    
    return app_types

@frappe.whitelist()
def get_connection_credentials(device_name):
    """Get connection credentials for authorized users only"""
    try:
        device = frappe.get_doc('Remote Access', device_name)
        
        # Strict validation - user must be able to connect AND be the assigned user
        if not can_user_connect_device(device):
            frappe.throw(_("You are not authorized to access this device"))
        
        # Additional check - must be assigned to this user or have active connection
        active_connection = frappe.db.sql("""
            SELECT user FROM `tabRemote Access Log`
            WHERE reference = %s
            AND connection_start_time IS NOT NULL
            AND connection_end_time IS NULL
            AND user = %s
            ORDER BY creation DESC
            LIMIT 1
        """, (device_name, frappe.session.user), as_dict=True)
        
        if not active_connection and device.assign_to != frappe.session.user:
            frappe.throw(_("You must have an active connection to access credentials"))
        
        return {
            'success': True,
            'device_id': device.id,
            'password': device.password,
            'new_password': device.new_password,
            'connection_info': {
                'ip_address': getattr(device, 'ip_address', None),
                'port': getattr(device, 'port', None),
                'protocol': getattr(device, 'protocol', None)
            }
        }
        
    except Exception as e:
        return {
            'success': False,
            'message': str(e)
        }

@frappe.whitelist()
def end_connection(device_name):
    """End an active connection"""
    try:
        device = frappe.get_doc('Remote Access', device_name)
        
        # Find active connection for current user
        active_log = frappe.db.sql("""
            SELECT name FROM `tabRemote Access Log`
            WHERE reference = %s
            AND connection_start_time IS NOT NULL
            AND connection_end_time IS NULL
            AND user = %s
            ORDER BY creation DESC
            LIMIT 1
        """, (device_name, frappe.session.user), as_dict=True)
        
        if not active_log:
            frappe.throw(_("No active connection found for this device"))
        
        # Update the log entry
        log = frappe.get_doc('Remote Access Log', active_log[0].name)
        log.connection_end_time = now()
        log.save()
        
        # Update device status if it was temporary
        if device.status == 'Temporary' and device.assign_to == frappe.session.user:
            device.status = 'Available'
            device.assign_to = None
            device.save()
        
        frappe.db.commit()
        
        return {
            'success': True,
            'message': f'Connection to {device.id} ended successfully'
        }
        
    except Exception as e:
        frappe.db.rollback()
        return {
            'success': False,
            'message': str(e)
        } 
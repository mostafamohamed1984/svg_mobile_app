"""
Performance Optimization for Email System
Database indexes, query optimization, and caching mechanisms
"""

import frappe
from frappe.database.database import Database

def create_email_system_indexes():
    """Create database indexes for optimal email system performance"""
    
    indexes_to_create = [
        # Communication table indexes for email processing
        {
            "table": "tabCommunication",
            "index_name": "idx_comm_message_id",
            "columns": ["message_id"],
            "description": "Fast lookup by message ID for BCC processing"
        },
        {
            "table": "tabCommunication",
            "index_name": "idx_comm_recipients_type",
            "columns": ["recipients", "custom_recipient_type"],
            "description": "Fast filtering by recipients and type"
        },
        {
            "table": "tabCommunication",
            "index_name": "idx_comm_bcc_processed",
            "columns": ["custom_bcc_processed", "creation"],
            "description": "Fast lookup for unprocessed emails"
        },
        {
            "table": "tabCommunication",
            "index_name": "idx_comm_email_account_date",
            "columns": ["email_account", "creation"],
            "description": "Fast filtering by account and date"
        },
        {
            "table": "tabCommunication",
            "index_name": "idx_comm_original_message_id",
            "columns": ["custom_original_message_id"],
            "description": "Fast lookup by original message ID"
        },
        
        # Email Monitoring table indexes
        {
            "table": "tabEmail Monitoring",
            "index_name": "idx_email_mon_status_modified",
            "columns": ["status", "modified"],
            "description": "Fast escalation queries by status and date"
        },
        {
            "table": "tabEmail Monitoring",
            "index_name": "idx_email_mon_assigned_status",
            "columns": ["assigned_user", "status"],
            "description": "Fast user dashboard queries"
        },
        {
            "table": "tabEmail Monitoring",
            "index_name": "idx_email_mon_account_type",
            "columns": ["email_account", "email_type"],
            "description": "Fast account-specific reporting"
        },
        {
            "table": "tabEmail Monitoring",
            "index_name": "idx_email_mon_priority_status",
            "columns": ["priority", "status", "creation"],
            "description": "Fast priority-based filtering"
        },
        
        # Communication Relation indexes
        {
            "table": "tabCommunication Relation",
            "index_name": "idx_comm_rel_communication",
            "columns": ["communication"],
            "description": "Fast lookup of related communications"
        },
        {
            "table": "tabCommunication Relation",
            "index_name": "idx_comm_rel_related",
            "columns": ["related_communication"],
            "description": "Bidirectional communication lookup"
        },
        
        # Forward Emails Control indexes
        {
            "table": "tabForward Emails Control",
            "index_name": "idx_fwd_ctrl_role_enabled",
            "columns": ["target_role", "enabled"],
            "description": "Fast role-based forwarding lookup"
        }
    ]
    
    created_indexes = []
    failed_indexes = []
    
    for index_info in indexes_to_create:
        try:
            if not _index_exists(index_info["table"], index_info["index_name"]):
                _create_index(index_info)
                created_indexes.append(index_info["index_name"])
            else:
                print(f"Index {index_info['index_name']} already exists")
                
        except Exception as e:
            failed_indexes.append({
                "index": index_info["index_name"],
                "error": str(e)
            })
            frappe.log_error(f"Failed to create index {index_info['index_name']}: {str(e)}", 
                           "Email System Index Creation")
    
    return {
        "created": created_indexes,
        "failed": failed_indexes,
        "total_attempted": len(indexes_to_create)
    }

def _index_exists(table_name: str, index_name: str) -> bool:
    """Check if an index already exists"""
    try:
        result = frappe.db.sql(f"""
            SELECT COUNT(*) as count
            FROM information_schema.statistics 
            WHERE table_schema = DATABASE() 
            AND table_name = '{table_name}' 
            AND index_name = '{index_name}'
        """, as_dict=True)
        
        return result[0]["count"] > 0 if result else False
    except Exception:
        return False

def _create_index(index_info: dict):
    """Create a database index"""
    table = index_info["table"]
    index_name = index_info["index_name"]
    columns = index_info["columns"]
    
    # Create column list for SQL
    column_list = ", ".join([f"`{col}`" for col in columns])
    
    sql = f"CREATE INDEX `{index_name}` ON `{table}` ({column_list})"
    
    print(f"Creating index: {index_name} on {table}")
    frappe.db.sql(sql)
    frappe.db.commit()

def optimize_email_queries():
    """Optimize common email system queries"""
    
    # Analyze table statistics for query optimizer
    tables_to_analyze = [
        "tabCommunication",
        "tabEmail Monitoring", 
        "tabCommunication Relation",
        "tabForward Emails Control"
    ]
    
    for table in tables_to_analyze:
        try:
            frappe.db.sql(f"ANALYZE TABLE `{table}`")
            print(f"Analyzed table: {table}")
        except Exception as e:
            frappe.log_error(f"Failed to analyze table {table}: {str(e)}", 
                           "Email System Query Optimization")

def get_email_system_performance_stats():
    """Get performance statistics for email system tables"""
    
    stats = {}
    
    # Communication table stats
    try:
        comm_stats = frappe.db.sql("""
            SELECT 
                COUNT(*) as total_communications,
                COUNT(CASE WHEN custom_bcc_processed = 1 THEN 1 END) as processed_emails,
                COUNT(CASE WHEN custom_recipient_type = 'BCC' THEN 1 END) as bcc_records,
                COUNT(CASE WHEN custom_recipient_type = 'CC' THEN 1 END) as cc_records,
                COUNT(CASE WHEN creation >= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 END) as last_24h
            FROM `tabCommunication`
            WHERE communication_medium = 'Email'
        """, as_dict=True)
        
        stats["communication"] = comm_stats[0] if comm_stats else {}
    except Exception as e:
        stats["communication"] = {"error": str(e)}
    
    # Email Monitoring stats
    try:
        monitoring_stats = frappe.db.sql("""
            SELECT 
                COUNT(*) as total_monitoring,
                COUNT(CASE WHEN status = 'Open' THEN 1 END) as open_count,
                COUNT(CASE WHEN status = 'Need Reply' THEN 1 END) as need_reply_count,
                COUNT(CASE WHEN status = 'Follow Up' THEN 1 END) as follow_up_count,
                COUNT(CASE WHEN priority = 'High' THEN 1 END) as high_priority,
                AVG(TIMESTAMPDIFF(HOUR, creation, modified)) as avg_processing_hours
            FROM `tabEmail Monitoring`
        """, as_dict=True)
        
        stats["monitoring"] = monitoring_stats[0] if monitoring_stats else {}
    except Exception as e:
        stats["monitoring"] = {"error": str(e)}
    
    # Index usage stats
    try:
        index_stats = frappe.db.sql("""
            SELECT 
                table_name,
                index_name,
                cardinality,
                nullable
            FROM information_schema.statistics 
            WHERE table_schema = DATABASE() 
            AND table_name IN ('tabCommunication', 'tabEmail Monitoring', 'tabCommunication Relation')
            ORDER BY table_name, index_name
        """, as_dict=True)
        
        stats["indexes"] = index_stats
    except Exception as e:
        stats["indexes"] = {"error": str(e)}
    
    return stats

@frappe.whitelist()
def setup_email_system_performance():
    """API endpoint to set up performance optimizations"""
    try:
        # Create indexes
        index_result = create_email_system_indexes()
        
        # Optimize queries
        optimize_email_queries()
        
        # Get performance stats
        stats = get_email_system_performance_stats()
        
        return {
            "status": "success",
            "indexes": index_result,
            "performance_stats": stats,
            "message": f"Created {len(index_result['created'])} indexes, failed {len(index_result['failed'])}"
        }
        
    except Exception as e:
        frappe.log_error(f"Error setting up email system performance: {str(e)}", 
                        "Email System Performance Setup")
        return {
            "status": "error",
            "message": str(e)
        }

@frappe.whitelist()
def get_performance_report():
    """Get comprehensive performance report"""
    try:
        stats = get_email_system_performance_stats()
        
        # Add slow query analysis
        try:
            slow_queries = frappe.db.sql("""
                SELECT 
                    sql_text,
                    exec_count,
                    avg_timer_wait/1000000000 as avg_time_seconds,
                    sum_timer_wait/1000000000 as total_time_seconds
                FROM performance_schema.events_statements_summary_by_digest 
                WHERE sql_text LIKE '%tabCommunication%' 
                   OR sql_text LIKE '%tabEmail Monitoring%'
                ORDER BY avg_timer_wait DESC 
                LIMIT 10
            """, as_dict=True)
            
            stats["slow_queries"] = slow_queries
        except Exception:
            stats["slow_queries"] = []
        
        return {
            "status": "success",
            "performance_report": stats,
            "timestamp": frappe.utils.now()
        }
        
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }

# Cache for frequently accessed data
class EmailSystemCache:
    """Simple in-memory cache for email system data"""
    
    def __init__(self):
        self.cache = {}
        self.cache_timeout = 300  # 5 minutes
    
    def get(self, key: str):
        """Get cached value"""
        if key in self.cache:
            value, timestamp = self.cache[key]
            if (frappe.utils.now_datetime() - timestamp).seconds < self.cache_timeout:
                return value
            else:
                del self.cache[key]
        return None
    
    def set(self, key: str, value):
        """Set cached value"""
        self.cache[key] = (value, frappe.utils.now_datetime())
    
    def clear(self):
        """Clear all cached values"""
        self.cache.clear()

# Global cache instance
email_cache = EmailSystemCache()

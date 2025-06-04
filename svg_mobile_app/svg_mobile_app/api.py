import frappe
from frappe import _

@frappe.whitelist()
def get_communications_with_tags(filters=None, tag_filter=None, search_term=None, limit_start=0, limit_page_length=10, order_by='creation desc'):
    """
    Efficiently get communications with tag filtering and search functionality
    """
    try:
        # Convert string parameters to proper types
        limit_start = int(limit_start) if limit_start else 0
        limit_page_length = int(limit_page_length) if limit_page_length else 10
        
        # Parse filters if it's a string
        if isinstance(filters, str):
            import json
            filters = json.loads(filters)
        
        if not filters:
            filters = {}
        
        # Base query for communications
        base_conditions = []
        base_values = []
        
        # Apply basic filters
        for field, value in filters.items():
            if isinstance(value, list) and len(value) == 2 and value[0] in ['in', 'like']:
                operator, val = value
                if operator == 'in':
                    placeholders = ', '.join(['%s'] * len(val))
                    base_conditions.append(f"`tab{frappe.db.escape('Communication')}`.`{frappe.db.escape(field)}` IN ({placeholders})")
                    base_values.extend(val)
                elif operator == 'like':
                    base_conditions.append(f"`tab{frappe.db.escape('Communication')}`.`{frappe.db.escape(field)}` LIKE %s")
                    base_values.append(val)
            else:
                base_conditions.append(f"`tab{frappe.db.escape('Communication')}`.`{frappe.db.escape(field)}` = %s")
                base_values.append(value)
        
        # Build the main query
        if tag_filter or search_term:
            # Complex query with tag filtering and/or search
            query_parts = []
            query_values = []
            
            # Base communication query
            comm_query = f"""
                SELECT DISTINCT 
                    `tabCommunication`.`name`,
                    `tabCommunication`.`subject`,
                    `tabCommunication`.`sender`,
                    `tabCommunication`.`sender_full_name`,
                    `tabCommunication`.`recipients`,
                    `tabCommunication`.`creation`,
                    `tabCommunication`.`content`,
                    `tabCommunication`.`read_by_recipient`,
                    `tabCommunication`.`has_attachment`,
                    `tabCommunication`.`reference_doctype`,
                    `tabCommunication`.`reference_name`,
                    `tabCommunication`.`sent_or_received`,
                    `tabCommunication`.`status`,
                    `tabCommunication`.`email_account`
                FROM `tabCommunication`
            """
            
            # Add tag join if needed
            if tag_filter:
                comm_query += """
                    LEFT JOIN `tabMultiple Tag` ON 
                        `tabMultiple Tag`.`parent` = `tabCommunication`.`name` AND
                        `tabMultiple Tag`.`parenttype` = 'Communication'
                """
            
            # Build WHERE conditions
            where_conditions = []
            
            # Add base filters
            if base_conditions:
                where_conditions.extend(base_conditions)
                query_values.extend(base_values)
            
            # Add tag filter
            if tag_filter:
                where_conditions.append("`tabMultiple Tag`.`tags` = %s")
                query_values.append(tag_filter)
            
            # Add search conditions
            if search_term:
                search_conditions = []
                search_conditions.append("`tabCommunication`.`subject` LIKE %s")
                search_conditions.append("`tabCommunication`.`content` LIKE %s")
                
                # Add tag search if no specific tag filter
                if not tag_filter:
                    comm_query += """
                        LEFT JOIN `tabMultiple Tag` AS search_tags ON 
                            search_tags.`parent` = `tabCommunication`.`name` AND
                            search_tags.`parenttype` = 'Communication'
                    """
                    search_conditions.append("search_tags.`tags` LIKE %s")
                
                where_conditions.append(f"({' OR '.join(search_conditions)})")
                search_pattern = f"%{search_term}%"
                query_values.extend([search_pattern] * len(search_conditions))
            
            # Complete the query
            if where_conditions:
                comm_query += f" WHERE {' AND '.join(where_conditions)}"
            
            comm_query += f" ORDER BY `tabCommunication`.`{order_by.replace(' desc', '').replace(' asc', '')}` {'DESC' if 'desc' in order_by else 'ASC'}"
            
            # Get total count
            count_query = f"""
                SELECT COUNT(DISTINCT `tabCommunication`.`name`)
                FROM `tabCommunication`
            """
            
            if tag_filter:
                count_query += """
                    LEFT JOIN `tabMultiple Tag` ON 
                        `tabMultiple Tag`.`parent` = `tabCommunication`.`name` AND
                        `tabMultiple Tag`.`parenttype` = 'Communication'
                """
            
            if search_term and not tag_filter:
                count_query += """
                    LEFT JOIN `tabMultiple Tag` AS search_tags ON 
                        search_tags.`parent` = `tabCommunication`.`name` AND
                        search_tags.`parenttype` = 'Communication'
                """
            
            if where_conditions:
                count_query += f" WHERE {' AND '.join(where_conditions)}"
            
            total_count = frappe.db.sql(count_query, query_values)[0][0]
            
            # Add pagination
            comm_query += f" LIMIT {limit_start}, {limit_page_length}"
            
            # Execute main query
            communications = frappe.db.sql(comm_query, query_values, as_dict=True)
            
        else:
            # Simple query without tag processing
            communications = frappe.get_list(
                'Communication',
                fields=[
                    'name', 'subject', 'sender', 'sender_full_name', 'recipients',
                    'creation', 'content', 'read_by_recipient', 'has_attachment',
                    'reference_doctype', 'reference_name', 'sent_or_received',
                    'status', 'email_account'
                ],
                filters=filters,
                order_by=order_by,
                limit_start=limit_start,
                limit_page_length=limit_page_length
            )
            
            total_count = frappe.db.count('Communication', filters)
        
        # Add tags to each communication
        for comm in communications:
            tags = frappe.db.sql("""
                SELECT tags 
                FROM `tabMultiple Tag` 
                WHERE parent = %s AND parenttype = 'Communication'
            """, (comm.name,), as_dict=True)
            comm['tags'] = [tag.tags for tag in tags if tag.tags]
        
        return {
            'data': communications,
            'total_count': total_count
        }
        
    except Exception as e:
        frappe.log_error(f"Error in get_communications_with_tags: {str(e)}")
        return {
            'data': [],
            'total_count': 0
        } 
frappe.pages['projects_image_gallery'].on_page_load = function(wrapper) {
    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Projects Image Gallery',
        single_column: true
    });

    // Add modern CSS styles
    let styles = `
        <style>
            .gallery-container {
                background: #f8f9fa;
                min-height: 100vh;
                padding: 20px;
            }
            .gallery-header {
                background: white;
                border-radius: 12px;
                padding: 24px;
                margin-bottom: 20px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .gallery-title {
                font-size: 28px;
                font-weight: 600;
                color: #2c3e50;
                margin-bottom: 8px;
            }
            .gallery-subtitle {
                color: #7f8c8d;
                font-size: 14px;
                margin-bottom: 24px;
            }
            .search-controls {
                display: flex;
                gap: 16px;
                align-items: center;
                flex-wrap: wrap;
                margin-bottom: 20px;
            }
            .search-input {
                flex: 1;
                min-width: 300px;
                padding: 12px 16px;
                border: 2px solid #e9ecef;
                border-radius: 8px;
                font-size: 14px;
                transition: border-color 0.3s ease;
            }
            .search-input:focus {
                outline: none;
                border-color: #3498db;
                box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
            }
            .btn-modern {
                padding: 12px 24px;
                border-radius: 8px;
                font-weight: 500;
                border: none;
                cursor: pointer;
                transition: all 0.3s ease;
                font-size: 14px;
            }
            .btn-primary-modern {
                background: #3498db;
                color: white;
            }
            .btn-primary-modern:hover {
                background: #2980b9;
                transform: translateY(-1px);
            }
            .btn-secondary-modern {
                background: #95a5a6;
                color: white;
            }
            .btn-secondary-modern:hover {
                background: #7f8c8d;
            }
            .column-controls {
                background: white;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .column-controls h5 {
                margin-bottom: 16px;
                color: #2c3e50;
                font-weight: 600;
            }
            .column-toggles {
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
            }
            .column-toggle {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                background: #f8f9fa;
                border-radius: 6px;
                cursor: pointer;
                transition: background-color 0.3s ease;
            }
            .column-toggle:hover {
                background: #e9ecef;
            }
            .column-toggle input[type="checkbox"] {
                margin: 0;
            }
            .table-container {
                background: white;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .modern-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 14px;
            }
            .modern-table th {
                background: #f8f9fa;
                padding: 16px 12px;
                text-align: left;
                font-weight: 600;
                color: #2c3e50;
                border-bottom: 2px solid #e9ecef;
                cursor: pointer;
                transition: background-color 0.3s ease;
            }
            .modern-table th:hover {
                background: #e9ecef;
            }
            .modern-table td {
                padding: 12px;
                border-bottom: 1px solid #f1f3f4;
                vertical-align: middle;
            }
            .modern-table tr:hover {
                background: #f8f9fa;
            }
            .project-image {
                border-radius: 6px;
                object-fit: cover;
                max-width: 120px;
                height: 80px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .no-image {
                display: inline-block;
                padding: 8px 12px;
                background: #f8f9fa;
                color: #7f8c8d;
                border-radius: 6px;
                font-size: 12px;
            }
            .status-badge {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
                background: #e9ecef;
                color: #495057;
            }
            .pagination-modern {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 8px;
                margin-top: 24px;
                padding: 20px;
            }
            .pagination-modern .page-btn {
                padding: 8px 12px;
                border: 1px solid #dee2e6;
                background: white;
                color: #495057;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.3s ease;
                text-decoration: none;
            }
            .pagination-modern .page-btn:hover {
                background: #f8f9fa;
                border-color: #3498db;
            }
            .pagination-modern .page-btn.active {
                background: #3498db;
                color: white;
                border-color: #3498db;
            }
            .loading-spinner {
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 40px;
                color: #7f8c8d;
            }
            .hidden-column {
                display: none !important;
            }
        </style>
    `;

    // Modern HTML structure
    let gallery_html = `
        ${styles}
        <div class="gallery-container">
            <div class="gallery-header">
                <h1 class="gallery-title">Projects Image Gallery</h1>
                <p class="gallery-subtitle">Browse and search through project images and details</p>

                <div class="search-controls">
                    <input id="project-search" type="text" class="search-input" placeholder="Search projects by ID, name, region, status...">
                    <button id="search-btn" class="btn-modern btn-primary-modern">Search</button>
                    <button id="clear-search" class="btn-modern btn-secondary-modern">Clear</button>
                    <button id="toggle-columns" class="btn-modern btn-secondary-modern">Columns</button>
                </div>
            </div>

            <div id="column-controls" class="column-controls" style="display: none;">
                <h5>Show/Hide Columns</h5>
                <div class="column-toggles" id="column-toggles"></div>
            </div>

            <div class="table-container">
                <div id="loading" class="loading-spinner" style="display: none;">
                    <i class="fa fa-spinner fa-spin"></i> Loading projects...
                </div>
                <div id="projects-table"></div>
            </div>

            <div id="pagination-controls" class="pagination-modern"></div>
        </div>
    `;
    $(wrapper).find('.layout-main-section').html(gallery_html);

    let current_page = 1;
    let page_length = 20;
    let last_query = '';
    let sort_field = 'numeric_sort_field';
    let sort_order = 'desc';

    // Column configuration
    let columns = {
        'project_name': { label: 'Project ID', visible: true, sortable: true },
        'district': { label: 'District', visible: true, sortable: true },
        'region': { label: 'Region', visible: true, sortable: true },
        'description': { label: 'Description', visible: true, sortable: true },
        'project_status': { label: 'Status', visible: true, sortable: true },
        'design_status': { label: 'Design', visible: true, sortable: true },
        'planning_status': { label: 'Planning', visible: true, sortable: true },
        'tender_status': { label: 'Tender', visible: true, sortable: true },
        '3d_image': { label: '3D Image', visible: true, sortable: false },
        'site_image': { label: 'Site Image', visible: true, sortable: false }
    };

    // Initialize column toggles
    function init_column_toggles() {
        let toggles_html = '';
        Object.keys(columns).forEach(key => {
            let column = columns[key];
            toggles_html += `
                <label class="column-toggle">
                    <input type="checkbox" data-column="${key}" ${column.visible ? 'checked' : ''}>
                    <span>${column.label}</span>
                </label>
            `;
        });
        $('#column-toggles').html(toggles_html);

        // Add event listeners
        $('.column-toggle input').change(function() {
            let column_key = $(this).data('column');
            columns[column_key].visible = $(this).is(':checked');
            update_column_visibility();
        });
    }

    function update_column_visibility() {
        Object.keys(columns).forEach(key => {
            let column = columns[key];
            if (column.visible) {
                $(`.col-${key}`).removeClass('hidden-column');
            } else {
                $(`.col-${key}`).addClass('hidden-column');
            }
        });
    }

    function get_image_src(img) {
        if (!img) return '';
        if (img.startsWith('http')) return img;
        if (img.startsWith('/files/') || img.startsWith('/private/files/')) return img;
        if (img.startsWith('/')) return img;
        return '/files/' + img;
    }

    function build_search_filters(query) {
        if (!query) return [];

        // Search across multiple fields
        let search_fields = ['project_name', 'district', 'region', 'description',
                           'project_status', 'design_status', 'planning_status', 'tender_status'];

        let filters = [];
        search_fields.forEach(field => {
            filters.push([field, 'like', `%${query}%`]);
        });

        return [filters]; // OR condition for all fields
    }

    function fetch_and_render(query = '', page_num = 1, sort_field_param = sort_field, order = sort_order) {
        $('#loading').show();
        $('#projects-table').hide();

        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Projects Collection',
                fields: ['name', 'project_name', 'district', 'region', 'description',
                        'project_status', 'design_status', 'planning_status', 'tender_status',
                        '3d_image', 'site_image'],
                limit_start: (page_num - 1) * page_length,
                limit_page_length: page_length,
                order_by: `${sort_field_param} ${order}`,
                filters: build_search_filters(query)
            },
            callback: function(r) {
                $('#loading').hide();
                $('#projects-table').show();
                render_table(r.message, query, page_num, sort_field_param, order);
                fetch_total_count(query, page_num, sort_field_param, order);
            },
            error: function() {
                $('#loading').hide();
                $('#projects-table').html('<div class="text-center p-4">Error loading projects. Please try again.</div>');
            }
        });
    }

    function render_table(rows, query, page_num, sort_field_param, order) {
        // Build table header
        let header_html = '<tr>';
        Object.keys(columns).forEach(key => {
            let column = columns[key];
            let sort_icon = '';
            if (column.sortable && sort_field_param === key) {
                sort_icon = order === 'desc' ? ' ▼' : ' ▲';
            }
            let cursor = column.sortable ? 'cursor: pointer;' : '';
            header_html += `<th class="col-${key}" data-field="${key}" style="${cursor}">${column.label}${sort_icon}</th>`;
        });
        header_html += '</tr>';

        let html = `<table class="modern-table"><thead>${header_html}</thead><tbody>`;

        if (rows.length === 0) {
            let colspan = Object.keys(columns).length;
            html += `<tr><td colspan="${colspan}" class="text-center" style="padding: 40px; color: #7f8c8d;">No projects found.</td></tr>`;
        } else {
            rows.forEach(row => {
                html += '<tr>';
                Object.keys(columns).forEach(key => {
                    let value = row[key] || '';
                    let cell_content = '';

                    if (key === '3d_image' || key === 'site_image') {
                        let img_src = get_image_src(value);
                        cell_content = img_src ?
                            `<img src="${img_src}" class="project-image" alt="${key}"/>` :
                            '<span class="no-image">No Image</span>';
                    } else if (key.includes('status')) {
                        cell_content = value ? `<span class="status-badge">${frappe.utils.escape_html(value)}</span>` : '-';
                    } else {
                        cell_content = frappe.utils.escape_html(value) || '-';
                    }

                    html += `<td class="col-${key}">${cell_content}</td>`;
                });
                html += '</tr>';
            });
        }
        html += '</tbody></table>';
        $('#projects-table').html(html);

        // Update column visibility
        update_column_visibility();

        // Add click events for sortable columns
        $('.modern-table th[data-field]').off('click').on('click', function() {
            let field = $(this).data('field');
            if (columns[field].sortable) {
                if (sort_field === field) {
                    sort_order = (sort_order === 'desc') ? 'asc' : 'desc';
                } else {
                    sort_field = field;
                    sort_order = 'desc';
                }
                current_page = 1;
                fetch_and_render(last_query, current_page, sort_field, sort_order);
            }
        });
    }

    function fetch_total_count(query, page_num, sort_field_param, order) {
        frappe.call({
            method: 'frappe.client.get_count',
            args: {
                doctype: 'Projects Collection',
                filters: build_search_filters(query)
            },
            callback: function(r) {
                render_pagination(r.message, page_num, query, sort_field_param, order);
            }
        });
    }

    function render_pagination(total_count, page_num, query, sort_field_param, order) {
        let total_pages = Math.ceil(total_count / page_length);
        let html = '';

        if (total_pages > 1) {
            // Previous button
            if (page_num > 1) {
                html += `<a class="page-btn" data-page="${page_num - 1}">‹ Previous</a>`;
            }

            let start = Math.max(1, page_num - 2);
            let end = Math.min(total_pages, page_num + 2);

            if (start > 1) {
                html += `<a class="page-btn" data-page="1">1</a>`;
                if (start > 2) {
                    html += `<span class="page-btn" style="cursor: default;">...</span>`;
                }
            }

            for (let i = start; i <= end; i++) {
                html += `<a class="page-btn ${i === page_num ? 'active' : ''}" data-page="${i}">${i}</a>`;
            }

            if (end < total_pages) {
                if (end < total_pages - 1) {
                    html += `<span class="page-btn" style="cursor: default;">...</span>`;
                }
                html += `<a class="page-btn" data-page="${total_pages}">${total_pages}</a>`;
            }

            // Next button
            if (page_num < total_pages) {
                html += `<a class="page-btn" data-page="${page_num + 1}">Next ›</a>`;
            }
        }

        // Add results info
        let start_item = (page_num - 1) * page_length + 1;
        let end_item = Math.min(page_num * page_length, total_count);
        html += `<div style="margin-left: 20px; color: #7f8c8d; font-size: 14px;">
                    Showing ${start_item}-${end_item} of ${total_count} projects
                 </div>`;

        $('#pagination-controls').html(html);

        // Pagination click events
        $('#pagination-controls .page-btn[data-page]').click(function(e) {
            e.preventDefault();
            let page = parseInt($(this).data('page'));
            if (page && page !== page_num) {
                current_page = page;
                fetch_and_render(last_query, current_page, sort_field, sort_order);
            }
        });
    }

    // Event handlers
    $('#search-btn').click(function() {
        let query = $('#project-search').val().trim();
        last_query = query;
        current_page = 1;
        fetch_and_render(query, current_page, sort_field, sort_order);
    });

    $('#clear-search').click(function() {
        $('#project-search').val('');
        last_query = '';
        current_page = 1;
        fetch_and_render('', current_page, sort_field, sort_order);
    });

    $('#toggle-columns').click(function() {
        $('#column-controls').toggle();
    });

    // Enter key in search with debouncing
    let search_timeout;
    $('#project-search').on('input', function() {
        clearTimeout(search_timeout);
        search_timeout = setTimeout(function() {
            let query = $('#project-search').val().trim();
            if (query !== last_query) {
                last_query = query;
                current_page = 1;
                fetch_and_render(query, current_page, sort_field, sort_order);
            }
        }, 500);
    });

    $('#project-search').keypress(function(e) {
        if (e.which === 13) {
            clearTimeout(search_timeout);
            $('#search-btn').click();
        }
    });

    // Initialize
    init_column_toggles();
    fetch_and_render('', 1, sort_field, sort_order);
};
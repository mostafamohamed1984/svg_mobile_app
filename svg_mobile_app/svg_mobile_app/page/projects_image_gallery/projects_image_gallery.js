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
            .column-section {
                margin-bottom: 20px;
            }
            .column-section h6 {
                margin-bottom: 12px;
                color: #34495e;
                font-weight: 500;
                font-size: 14px;
                border-bottom: 1px solid #ecf0f1;
                padding-bottom: 4px;
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
            .project-link {
                color: #3498db;
                text-decoration: none;
                font-weight: 500;
                cursor: pointer;
                transition: color 0.3s ease;
            }
            .project-link:hover {
                color: #2980b9;
                text-decoration: underline;
            }
            .image-clickable {
                cursor: pointer;
                transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            .image-clickable:hover {
                transform: scale(1.05);
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }
            .image-modal {
                display: none;
                position: fixed;
                z-index: 9999;
                left: 0;
                top: 0;
                width: 100%;
                height: 100%;
                background-color: rgba(0,0,0,0.9);
                animation: fadeIn 0.3s ease;
            }
            .image-modal-content {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                max-width: 90%;
                max-height: 90%;
                border-radius: 8px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            }
            .image-modal-close {
                position: absolute;
                top: 20px;
                right: 30px;
                color: white;
                font-size: 40px;
                font-weight: bold;
                cursor: pointer;
                z-index: 10000;
                transition: color 0.3s ease;
            }
            .image-modal-close:hover {
                color: #ccc;
            }
            .image-modal-info {
                position: absolute;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0,0,0,0.7);
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                font-size: 14px;
                text-align: center;
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .advanced-search {
                background: white;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                display: none;
            }
            .search-criteria {
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 12px;
                padding: 12px;
                background: #f8f9fa;
                border-radius: 8px;
                position: relative;
            }
            .search-criteria select {
                padding: 8px 12px;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                background: white;
                min-width: 150px;
            }
            .search-criteria input {
                flex: 1;
                padding: 8px 12px;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                min-width: 200px;
            }
            .range-inputs {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 1;
            }
            .range-inputs input {
                flex: 1;
                min-width: 80px;
            }
            .range-separator {
                color: #7f8c8d;
                font-weight: 500;
                white-space: nowrap;
            }
            .remove-criteria {
                background: #e74c3c;
                color: white;
                border: none;
                border-radius: 50%;
                width: 24px;
                height: 24px;
                cursor: pointer;
                font-size: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .remove-criteria:hover {
                background: #c0392b;
            }
            .add-criteria {
                background: #27ae60;
                color: white;
                border: none;
                border-radius: 6px;
                padding: 8px 16px;
                cursor: pointer;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .add-criteria:hover {
                background: #229954;
            }
            .search-mode-toggle {
                display: flex;
                gap: 8px;
                margin-bottom: 16px;
            }
            .mode-btn {
                padding: 6px 12px;
                border: 1px solid #dee2e6;
                background: white;
                border-radius: 6px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.3s ease;
            }
            .mode-btn.active {
                background: #3498db;
                color: white;
                border-color: #3498db;
            }
            .search-actions {
                display: flex;
                gap: 12px;
                align-items: center;
                margin-top: 16px;
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
                    <button id="advanced-search-toggle" class="btn-modern btn-secondary-modern">+ Advanced</button>
                    <button id="toggle-columns" class="btn-modern btn-secondary-modern">Columns</button>
                </div>
            </div>

            <div id="advanced-search" class="advanced-search">
                <h5>Advanced Search</h5>
                <div class="search-mode-toggle">
                    <button class="mode-btn active" data-mode="AND">Match ALL criteria (AND)</button>
                    <button class="mode-btn" data-mode="OR">Match ANY criteria (OR)</button>
                </div>
                <div id="search-criteria-container"></div>
                <div class="search-actions">
                    <button id="add-search-criteria" class="add-criteria">
                        <span>+</span> Add Search Criteria
                    </button>
                    <button id="apply-advanced-search" class="btn-modern btn-primary-modern">Apply Search</button>
                    <button id="clear-advanced-search" class="btn-modern btn-secondary-modern">Clear All</button>
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

        <!-- Image Modal -->
        <div id="image-modal" class="image-modal">
            <span class="image-modal-close">&times;</span>
            <img id="modal-image" class="image-modal-content" alt="Full size image">
            <div id="modal-info" class="image-modal-info"></div>
        </div>
    `;
    $(wrapper).find('.layout-main-section').html(gallery_html);

    let current_page = 1;
    let page_length = 20;
    let last_query = '';
    let sort_field = 'numeric_sort_field';  // Default to numeric sorting for Project ID
    let sort_order = 'desc';
    let advanced_search_criteria = [];
    let search_mode = 'AND'; // AND or OR

    // Column configuration
    let columns = {
        // Main visible columns
        'project_name': { label: 'Project ID', visible: true, sortable: true, sort_field: 'numeric_sort_field' },
        'district': { label: 'District', visible: true, sortable: true, sort_field: 'district' },
        'region': { label: 'Region', visible: true, sortable: true, sort_field: 'region' },
        'description': { label: 'Description', visible: true, sortable: true, sort_field: 'description' },
        'project_status': { label: 'Status', visible: true, sortable: true, sort_field: 'project_status' },
        'design_status': { label: 'Design', visible: true, sortable: true, sort_field: 'design_status' },
        'planning_status': { label: 'Planning', visible: true, sortable: true, sort_field: 'planning_status' },
        'tender_status': { label: 'Tender', visible: true, sortable: true, sort_field: 'tender_status' },
        '3d_image': { label: '3D Image', visible: true, sortable: false, sort_field: null },
        'site_image': { label: 'Site Image', visible: true, sortable: false, sort_field: null },

        // Engineering Data - Hidden by default
        'villa_dimensions': { label: 'Villa Dimensions', visible: false, sortable: true, sort_field: 'villa_dimensions' },
        'plot_no': { label: 'Plot No', visible: false, sortable: true, sort_field: 'plot_no' },
        'basement': { label: 'Basement', visible: false, sortable: true, sort_field: 'basement' },
        'ground_floor': { label: 'Ground Floor', visible: false, sortable: true, sort_field: 'ground_floor' },
        'first_floor': { label: 'First Floor', visible: false, sortable: true, sort_field: 'first_floor' },
        'second_floor': { label: 'Second Floor', visible: false, sortable: true, sort_field: 'second_floor' },
        'roof': { label: 'Roof', visible: false, sortable: true, sort_field: 'roof' },
        'total_villa_area_sqm': { label: 'Total Area (SQM)', visible: false, sortable: true, sort_field: 'total_villa_area_sqm' },
        'total_villa_area_sqft': { label: 'Total Area (SQFT)', visible: false, sortable: true, sort_field: 'total_villa_area_sqft' },
        'estimate_cost_230_aedsqft': { label: 'Estimate Cost (AED/SQFT)', visible: false, sortable: true, sort_field: 'estimate_cost_230_aedsqft' },
        'bed_room': { label: 'Bedrooms', visible: false, sortable: true, sort_field: 'bed_room' },
        'majlis': { label: 'Majlis', visible: false, sortable: true, sort_field: 'majlis' },
        'family_living': { label: 'Family Living', visible: false, sortable: true, sort_field: 'family_living' },
        'dinning': { label: 'Dining', visible: false, sortable: true, sort_field: 'dinning' },
        'bathroom': { label: 'Bathrooms', visible: false, sortable: true, sort_field: 'bathroom' },
        'kitchen': { label: 'Kitchen', visible: false, sortable: true, sort_field: 'kitchen' },
        'laundry': { label: 'Laundry', visible: false, sortable: true, sort_field: 'laundry' },
        'maid_room': { label: 'Maid Room', visible: false, sortable: true, sort_field: 'maid_room' },
        'gurad_room': { label: 'Guard Room', visible: false, sortable: true, sort_field: 'gurad_room' },
        'store': { label: 'Store', visible: false, sortable: true, sort_field: 'store' },
        'shops': { label: 'Shops', visible: false, sortable: true, sort_field: 'shops' },
        'no_of_office': { label: 'No. of Offices', visible: false, sortable: true, sort_field: 'no_of_office' },
        'car_parking': { label: 'Car Parking', visible: false, sortable: true, sort_field: 'car_parking' },
        'no_of_labour': { label: 'No. of Labour', visible: false, sortable: true, sort_field: 'no_of_labour' },
        'no_of_studio': { label: 'No. of Studios', visible: false, sortable: true, sort_field: 'no_of_studio' }
    };

    // Initialize column toggles with organized sections
    function init_column_toggles() {
        let main_columns = ['project_name', 'district', 'region', 'description', 'project_status',
                           'design_status', 'planning_status', 'tender_status', '3d_image', 'site_image'];

        let engineering_columns = ['villa_dimensions', 'plot_no', 'basement', 'ground_floor', 'first_floor',
                                 'second_floor', 'roof', 'total_villa_area_sqm', 'total_villa_area_sqft',
                                 'estimate_cost_230_aedsqft', 'bed_room', 'majlis', 'family_living',
                                 'dinning', 'bathroom', 'kitchen', 'laundry', 'maid_room', 'gurad_room',
                                 'store', 'shops', 'no_of_office', 'car_parking', 'no_of_labour', 'no_of_studio'];

        let toggles_html = `
            <div class="column-section">
                <h6>Main Columns</h6>
                <div class="column-toggles">
        `;

        main_columns.forEach(key => {
            if (columns[key]) {
                let column = columns[key];
                toggles_html += `
                    <label class="column-toggle">
                        <input type="checkbox" data-column="${key}" ${column.visible ? 'checked' : ''}>
                        <span>${column.label}</span>
                    </label>
                `;
            }
        });

        toggles_html += `
                </div>
            </div>
            <div class="column-section">
                <h6>Engineering Data</h6>
                <div class="column-toggles">
        `;

        engineering_columns.forEach(key => {
            if (columns[key]) {
                let column = columns[key];
                toggles_html += `
                    <label class="column-toggle">
                        <input type="checkbox" data-column="${key}" ${column.visible ? 'checked' : ''}>
                        <span>${column.label}</span>
                    </label>
                `;
            }
        });

        toggles_html += `
                </div>
            </div>
        `;

        $('#column-controls .column-toggles').parent().html(`
            <h5>Show/Hide Columns</h5>
            ${toggles_html}
        `);

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

    function open_project_document(project_name) {
        frappe.set_route('Form', 'Projects Collection', project_name);
    }

    function show_image_modal(img_src, project_name, image_type) {
        $('#modal-image').attr('src', img_src);
        $('#modal-info').text(`${project_name} - ${image_type}`);
        $('#image-modal').fadeIn(300);
    }

    function close_image_modal() {
        $('#image-modal').fadeOut(300);
    }

    // Advanced search functions
    function get_searchable_fields() {
        return {
            'project_name': 'Project ID',
            'district': 'District',
            'region': 'Region',
            'description': 'Description',
            'project_status': 'Status',
            'design_status': 'Design Status',
            'planning_status': 'Planning Status',
            'tender_status': 'Tender Status',
            'villa_dimensions': 'Villa Dimensions',
            'plot_no': 'Plot No',
            'basement': 'Basement',
            'ground_floor': 'Ground Floor',
            'first_floor': 'First Floor',
            'second_floor': 'Second Floor',
            'roof': 'Roof',
            'total_villa_area_sqm': 'Total Area (SQM)',
            'total_villa_area_sqft': 'Total Area (SQFT)',
            'estimate_cost_230_aedsqft': 'Estimate Cost',
            'bed_room': 'Bedrooms',
            'majlis': 'Majlis',
            'family_living': 'Family Living',
            'dinning': 'Dining',
            'bathroom': 'Bathrooms',
            'kitchen': 'Kitchen',
            'laundry': 'Laundry',
            'maid_room': 'Maid Room',
            'gurad_room': 'Guard Room',
            'store': 'Store',
            'shops': 'Shops',
            'no_of_office': 'No. of Offices',
            'car_parking': 'Car Parking',
            'no_of_labour': 'No. of Labour',
            'no_of_studio': 'No. of Studios'
        };
    }

    function add_search_criteria() {
        let criteria_id = 'criteria_' + Date.now();
        let searchable_fields = get_searchable_fields();

        let options_html = '';
        Object.keys(searchable_fields).forEach(key => {
            options_html += `<option value="${key}">${searchable_fields[key]}</option>`;
        });

        let criteria_html = `
            <div class="search-criteria" data-id="${criteria_id}">
                <select class="field-select">
                    ${options_html}
                </select>
                <select class="operator-select">
                    <option value="like">Contains</option>
                    <option value="=">Equals</option>
                    <option value="!=">Not Equals</option>
                    <option value=">">Greater Than</option>
                    <option value="<">Less Than</option>
                    <option value="between">Between</option>
                </select>
                <div class="value-container">
                    <input type="text" class="value-input" placeholder="Enter search value...">
                </div>
                <button class="remove-criteria" data-criteria-id="${criteria_id}">×</button>
            </div>
        `;

        $('#search-criteria-container').append(criteria_html);

        // Add event listener for operator change
        $(`[data-id="${criteria_id}"] .operator-select`).change(function() {
            update_value_inputs(criteria_id, $(this).val());
        });
    }

    function update_value_inputs(criteria_id, operator) {
        let container = $(`[data-id="${criteria_id}"] .value-container`);

        if (operator === 'between') {
            container.html(`
                <div class="range-inputs">
                    <input type="number" class="value-input-min" placeholder="Min value">
                    <span class="range-separator">to</span>
                    <input type="number" class="value-input-max" placeholder="Max value">
                </div>
            `);
        } else {
            let inputType = 'text';
            let placeholder = 'Enter search value...';

            // Use number input for numerical operators
            if (operator === '>' || operator === '<' || operator === '=' || operator === '!=') {
                let field = $(`[data-id="${criteria_id}"] .field-select`).val();
                if (field && (field.includes('area') || field.includes('cost') || field.includes('no_of'))) {
                    inputType = 'number';
                    placeholder = 'Enter number...';
                }
            }

            container.html(`<input type="${inputType}" class="value-input" placeholder="${placeholder}">`);
        }
    }

    function remove_search_criteria(criteria_id) {
        $(`[data-id="${criteria_id}"]`).remove();
    }

    function build_advanced_search_filters() {
        let criteria = [];

        $('.search-criteria').each(function() {
            let field = $(this).find('.field-select').val();
            let operator = $(this).find('.operator-select').val();

            if (field) {
                if (operator === 'between') {
                    let minValue = $(this).find('.value-input-min').val().trim();
                    let maxValue = $(this).find('.value-input-max').val().trim();

                    if (minValue && maxValue) {
                        // Add both min and max conditions for between
                        criteria.push([field, '>=', minValue]);
                        criteria.push([field, '<=', maxValue]);
                    } else if (minValue) {
                        // Only min value provided
                        criteria.push([field, '>=', minValue]);
                    } else if (maxValue) {
                        // Only max value provided
                        criteria.push([field, '<=', maxValue]);
                    }
                } else {
                    let value = $(this).find('.value-input').val().trim();

                    if (value) {
                        if (operator === 'like') {
                            criteria.push([field, 'like', `%${value}%`]);
                        } else {
                            criteria.push([field, operator, value]);
                        }
                    }
                }
            }
        });

        return criteria;
    }

    function build_search_filters(query) {
        // Check if we have advanced search criteria
        let advanced_criteria = build_advanced_search_filters();

        if (advanced_criteria.length > 0) {
            // Use advanced search criteria
            if (search_mode === 'AND') {
                return advanced_criteria; // Each criteria as separate filter (AND)
            } else {
                // For OR mode, we need to structure it differently
                // Frappe expects OR filters as: [['field1', 'op', 'val'], 'or', ['field2', 'op', 'val']]
                if (advanced_criteria.length === 1) {
                    return advanced_criteria; // Single criteria, no OR needed
                }

                let or_filters = [];
                for (let i = 0; i < advanced_criteria.length; i++) {
                    or_filters.push(advanced_criteria[i]);
                    if (i < advanced_criteria.length - 1) {
                        or_filters.push('or');
                    }
                }
                return [or_filters]; // Wrap in array for proper structure
            }
        }

        // Fallback to simple search if no advanced criteria or if query is provided
        if (!query) return [];

        // Search across multiple fields including engineering data
        let search_fields = [
            'project_name', 'district', 'region', 'description',
            'project_status', 'design_status', 'planning_status', 'tender_status',
            // Engineering data fields
            'villa_dimensions', 'plot_no', 'basement', 'ground_floor', 'first_floor',
            'second_floor', 'roof', 'total_villa_area_sqm', 'total_villa_area_sqft',
            'estimate_cost_230_aedsqft', 'bed_room', 'majlis', 'family_living',
            'dinning', 'bathroom', 'kitchen', 'laundry', 'maid_room', 'gurad_room',
            'store', 'shops', 'no_of_office', 'car_parking', 'no_of_labour', 'no_of_studio'
        ];

        let filters = [];
        search_fields.forEach(field => {
            filters.push([field, 'like', `%${query}%`]);
            if (filters.length > 1 && filters[filters.length - 2] !== 'or') {
                filters.splice(-1, 0, 'or'); // Insert 'or' before the last element
            }
        });

        return filters.length > 0 ? [filters] : []; // OR condition for all fields
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
                        '3d_image', 'site_image',
                        // Engineering data fields
                        'villa_dimensions', 'plot_no', 'basement', 'ground_floor', 'first_floor',
                        'second_floor', 'roof', 'total_villa_area_sqm', 'total_villa_area_sqft',
                        'estimate_cost_230_aedsqft', 'bed_room', 'majlis', 'family_living',
                        'dinning', 'bathroom', 'kitchen', 'laundry', 'maid_room', 'gurad_room',
                        'store', 'shops', 'no_of_office', 'car_parking', 'no_of_labour', 'no_of_studio'],
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
            // Check if this column is currently being sorted by comparing with the actual sort field
            let current_sort_field = column.sort_field || key;
            if (column.sortable && sort_field_param === current_sort_field) {
                sort_icon = order === 'desc' ? ' ▼' : ' ▲';
            }
            let cursor = column.sortable ? 'cursor: pointer;' : '';
            header_html += `<th class="col-${key}" data-field="${key}" data-sort-field="${current_sort_field}" style="${cursor}">${column.label}${sort_icon}</th>`;
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

                    if (key === 'project_name') {
                        // Make project name clickable to open document
                        cell_content = `<a href="#" class="project-link" data-project="${frappe.utils.escape_html(value)}">${frappe.utils.escape_html(value)}</a>`;
                    } else if (key === '3d_image' || key === 'site_image') {
                        let img_src = get_image_src(value);
                        if (img_src) {
                            let image_type = key === '3d_image' ? '3D Image' : 'Site Image';
                            cell_content = `<img src="${img_src}" class="project-image image-clickable"
                                          alt="${key}" data-full-src="${img_src}"
                                          data-project="${frappe.utils.escape_html(row.project_name || row.name)}"
                                          data-type="${image_type}"/>`;
                        } else {
                            cell_content = '<span class="no-image">No Image</span>';
                        }
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
            let actual_sort_field = $(this).data('sort-field');
            if (columns[field].sortable) {
                if (sort_field === actual_sort_field) {
                    sort_order = (sort_order === 'desc') ? 'asc' : 'desc';
                } else {
                    sort_field = actual_sort_field;
                    sort_order = 'desc';
                }
                current_page = 1;
                fetch_and_render(last_query, current_page, sort_field, sort_order);
            }
        });

        // Add click events for project links
        $('.project-link').off('click').on('click', function(e) {
            e.preventDefault();
            let project_name = $(this).data('project');
            open_project_document(project_name);
        });

        // Add click events for images
        $('.image-clickable').off('click').on('click', function() {
            let img_src = $(this).data('full-src');
            let project_name = $(this).data('project');
            let image_type = $(this).data('type');
            show_image_modal(img_src, project_name, image_type);
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

    $('#advanced-search-toggle').click(function() {
        $('#advanced-search').toggle();
        if ($('#advanced-search').is(':visible') && $('#search-criteria-container').children().length === 0) {
            add_search_criteria(); // Add first criteria when opening
        }
    });

    $('#add-search-criteria').click(function() {
        add_search_criteria();
    });

    $('#apply-advanced-search').click(function() {
        current_page = 1;
        last_query = ''; // Clear simple search when using advanced
        $('#project-search').val('');
        fetch_and_render('', current_page, sort_field, sort_order);
    });

    $('#clear-advanced-search').click(function() {
        $('#search-criteria-container').empty();
        current_page = 1;
        fetch_and_render('', current_page, sort_field, sort_order);
    });

    // Search mode toggle
    $('.mode-btn').click(function() {
        $('.mode-btn').removeClass('active');
        $(this).addClass('active');
        search_mode = $(this).data('mode');
    });

    // Event delegation for remove criteria buttons
    $(document).on('click', '.remove-criteria', function() {
        let criteria_id = $(this).data('criteria-id');
        remove_search_criteria(criteria_id);
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

    // Image modal event handlers
    $('.image-modal-close').click(function() {
        close_image_modal();
    });

    $('#image-modal').click(function(e) {
        if (e.target === this) {
            close_image_modal();
        }
    });

    // Keyboard events
    $(document).keydown(function(e) {
        if (e.key === 'Escape') {
            close_image_modal();
        }
    });

    // Initialize
    init_column_toggles();
    fetch_and_render('', 1, sort_field, sort_order);
};
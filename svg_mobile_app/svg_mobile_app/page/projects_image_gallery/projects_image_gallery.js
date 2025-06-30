frappe.pages['projects_image_gallery'].on_page_load = function(wrapper) {
    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Projects Image Gallery',
        single_column: true
    });

    // Add search bar
    let search_html = `
        <div style="margin-bottom: 16px;">
            <input id="project-search" type="text" class="form-control" placeholder="Search by Project ID or Name..." style="width: 300px; display: inline-block; margin-right: 8px;">
            <button id="search-btn" class="btn btn-primary">Search</button>
        </div>
        <div id="projects-table"></div>
        <div id="pagination-controls" style="margin-top: 16px;"></div>
    `;
    $(wrapper).find('.layout-main-section').html(search_html);

    let current_page = 1;
    let page_length = 20;
    let last_query = '';

    function get_image_src(img) {
        if (!img) return '';
        if (img.startsWith('http')) return img;
        if (img.startsWith('/files/') || img.startsWith('/private/files/')) return img;
        if (img.startsWith('/')) return img;
        return '/files/' + img;
    }

    function fetch_and_render(query = '', page_num = 1) {
        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Projects Collection',
                fields: ['name', 'project_name', '3d_image', 'site_image'],
                limit_start: (page_num - 1) * page_length,
                limit_page_length: page_length,
                order_by: 'numeric_sort_field desc',
                filters: query ? [['project_name', 'like', `%${query}%`]] : []
            },
            callback: function(r) {
                render_table(r.message, query, page_num);
                fetch_total_count(query, page_num);
            }
        });
    }

    function render_table(rows, query, page_num) {
        let html = '<table class="table table-bordered table-hover"><thead><tr>' +
            '<th style="width: 80px;">ID</th>' +
            '<th style="width: 160px;">3D Image</th>' +
            '<th style="width: 160px;">Site Image</th>' +
            '</tr></thead><tbody>';
        if (rows.length === 0) {
            html += '<tr><td colspan="3" class="text-center">No projects found.</td></tr>';
        } else {
            rows.forEach(row => {
                let img3d_src = get_image_src(row['3d_image']);
                let site_img_src = get_image_src(row['site_image']);
                html += `<tr>
                    <td>${frappe.utils.escape_html(row.project_name || row.name)}</td>
                    <td>${img3d_src ? `<img src="${img3d_src}" height="80" style="object-fit:cover;max-width:140px;"/>` : '<span class="text-muted">No Image</span>'}</td>
                    <td>${site_img_src ? `<img src="${site_img_src}" height="80" style="object-fit:cover;max-width:140px;"/>` : '<span class="text-muted">No Image</span>'}</td>
                </tr>`;
            });
        }
        html += '</tbody></table>';
        $('#projects-table').html(html);
    }

    function fetch_total_count(query, page_num) {
        frappe.call({
            method: 'frappe.client.get_count',
            args: {
                doctype: 'Projects Collection',
                filters: query ? [['project_name', 'like', `%${query}%`]] : []
            },
            callback: function(r) {
                render_pagination(r.message, page_num, query);
            }
        });
    }

    function render_pagination(total_count, page_num, query) {
        let total_pages = Math.ceil(total_count / page_length);
        let html = '';
        if (total_pages > 1) {
            html += `<nav><ul class="pagination">`;
            // Previous button
            if (page_num > 1) {
                html += `<li class="page-item"><a class="page-link" href="#" data-page="${page_num - 1}">&laquo;</a></li>`;
            }
            let start = Math.max(1, page_num - 2);
            let end = Math.min(total_pages, page_num + 2);
            if (start > 1) {
                html += `<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`;
                if (start > 2) {
                    html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
                }
            }
            for (let i = start; i <= end; i++) {
                html += `<li class="page-item${i === page_num ? ' active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`;
            }
            if (end < total_pages) {
                if (end < total_pages - 1) {
                    html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
                }
                html += `<li class="page-item"><a class="page-link" href="#" data-page="${total_pages}">${total_pages}</a></li>`;
            }
            // Next button
            if (page_num < total_pages) {
                html += `<li class="page-item"><a class="page-link" href="#" data-page="${page_num + 1}">&raquo;</a></li>`;
            }
            html += `</ul></nav>`;
        }
        $('#pagination-controls').html(html);
        // Pagination click
        $('#pagination-controls .page-link').click(function(e) {
            e.preventDefault();
            let page = parseInt($(this).data('page'));
            if (page && page !== page_num) {
                current_page = page;
                fetch_and_render(last_query, current_page);
            }
        });
    }

    // Search button click
    $('#search-btn').click(function() {
        let query = $('#project-search').val().trim();
        last_query = query;
        current_page = 1;
        fetch_and_render(query, current_page);
    });

    // Enter key in search
    $('#project-search').keypress(function(e) {
        if (e.which === 13) {
            $('#search-btn').click();
        }
    });

    // Initial fetch
    fetch_and_render('', 1);
}; 
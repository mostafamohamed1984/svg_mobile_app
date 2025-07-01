frappe.pages['network-devices-dashboard'].on_page_load = function(wrapper) {
    var page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Network Devices Dashboard',
        single_column: true
    });

    $(wrapper).addClass('network-devices-dashboard-wrapper');
    frappe.network_devices_dashboard = new NetworkDevicesDashboard(page);
};

frappe.pages['network-devices-dashboard'].on_page_show = function() {
    if(frappe.network_devices_dashboard) {
        frappe.network_devices_dashboard.refresh();
    }
};

class NetworkDevicesDashboard {
    constructor(page) {
        this.page = page;
        this.filters = {};
        this.devices = [];
        this.auto_refresh_interval = null;
        this.make();
        this.setup_filters();
        this.refresh();
        this.setup_auto_refresh();
    }

    make() {
        this.body = $('<div class="network-devices-dashboard"></div>').appendTo(this.page.main);
        this.create_header_section();
        this.create_filters_section();
        this.create_devices_section();
        this.create_auto_refresh_indicator();
    }

    setup_filters() {
        this.page.set_primary_action('Refresh', () => this.refresh(), 'refresh');
        this.page.add_action_item('Show Available', () => this.apply_quick_filter('Available'));
        this.page.add_action_item('Show Reserved', () => this.apply_quick_filter('Reserved'));
        this.page.add_action_item('Show All', () => this.apply_quick_filter(''));
    }

    create_header_section() {
        this.header_section = $(`
            <div class="dashboard-header">
                <h2>Network Devices</h2>
                <p class="text-muted">Manage and monitor all network devices</p>
                <div class="dashboard-stats">
                    <div class="stat-card available">
                        <div class="stat-number" id="stat-available">-</div>
                        <div class="stat-label">Available</div>
                    </div>
                    <div class="stat-card reserved">
                        <div class="stat-number" id="stat-reserved">-</div>
                        <div class="stat-label">Reserved</div>
                    </div>
                    <div class="stat-card in-use">
                        <div class="stat-number" id="stat-in-use">-</div>
                        <div class="stat-label">In Use</div>
                    </div>
                    <div class="stat-card expired">
                        <div class="stat-number" id="stat-expired">-</div>
                        <div class="stat-label">Expired</div>
                    </div>
                </div>
            </div>
        `).appendTo(this.body);
    }

    create_filters_section() {
        this.filters_section = $(`
            <div class="dashboard-filters">
                <div class="filters-row">
                    <div class="filter-group">
                        <label>Search Devices</label>
                        <input type="text" id="search-filter" placeholder="Search by device ID...">
                    </div>
                    <div class="filter-group">
                        <label>Device Type</label>
                        <select id="device-type-filter">
                            <option value="">All Types</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>Status</label>
                        <select id="status-filter">
                            <option value="">All Status</option>
                            <option value="Available">Available</option>
                            <option value="Reserved">Reserved</option>
                            <option value="Temporary">In Use</option>
                            <option value="Expired">Expired</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <button class="refresh-btn" onclick="frappe.network_devices_dashboard.refresh()">
                            <i class="fa fa-refresh"></i> Refresh
                        </button>
                    </div>
                </div>
            </div>
        `).appendTo(this.body);

        this.setup_filter_events();
    }

    create_devices_section() {
        this.devices_section = $(`
            <div class="devices-container">
                <div class="devices-grid" id="devices-grid">
                    <!-- Devices will be loaded here -->
                </div>
            </div>
        `).appendTo(this.body);
    }

    create_auto_refresh_indicator() {
        this.auto_refresh_indicator = $(`
            <div class="auto-refresh-indicator" id="auto-refresh-indicator">
                <i class="fa fa-refresh fa-spin"></i> Refreshing...
            </div>
        `).appendTo('body');
    }

    setup_filter_events() {
        $('#search-filter').on('input', frappe.utils.debounce(() => {
            this.filters.search = $('#search-filter').val();
            this.apply_filters();
        }, 300));

        $('#device-type-filter').on('change', () => {
            this.filters.device_type = $('#device-type-filter').val();
            this.apply_filters();
        });

        $('#status-filter').on('change', () => {
            this.filters.status = $('#status-filter').val();
            this.apply_filters();
        });
    }

    setup_auto_refresh() {
        this.auto_refresh_interval = setInterval(() => {
            this.refresh(true);
        }, 30000);
    }

    refresh(silent = false) {
        if (!silent) {
            this.show_loading();
        } else {
            this.show_auto_refresh_indicator();
        }

        Promise.all([
            this.load_statistics(),
            this.load_devices(),
            this.load_device_types()
        ]).then(() => {
            this.render_devices();
            this.update_statistics();
            if (!silent) {
                this.hide_loading();
            } else {
                this.hide_auto_refresh_indicator();
            }
        }).catch((error) => {
            console.error('Error refreshing dashboard:', error);
            frappe.show_alert({
                message: 'Error loading dashboard data',
                indicator: 'red'
            });
            if (!silent) {
                this.hide_loading();
            } else {
                this.hide_auto_refresh_indicator();
            }
        });
    }

    load_statistics() {
        return frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.network_devices_dashboard.network_devices_dashboard.get_device_statistics',
            callback: (r) => {
                if (r.message) {
                    this.statistics = r.message;
                }
            }
        });
    }

    load_devices() {
        return frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.network_devices_dashboard.network_devices_dashboard.get_network_devices',
            args: { filters: this.filters },
            callback: (r) => {
                if (r.message) {
                    this.devices = r.message;
                }
            }
        });
    }

    load_device_types() {
        return frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.network_devices_dashboard.network_devices_dashboard.get_app_types',
            callback: (r) => {
                if (r.message) {
                    this.populate_device_type_filter(r.message);
                }
            }
        });
    }

    populate_device_type_filter(app_types) {
        const select = $('#device-type-filter');
        const current_value = select.val();
        
        select.find('option:not(:first)').remove();
        
        app_types.forEach(type => {
            select.append(`<option value="${type.name}">${type.name1 || type.name}</option>`);
        });
        
        if (current_value) {
            select.val(current_value);
        }
    }

    update_statistics() {
        if (this.statistics) {
            $('#stat-available').text(this.statistics.available_devices || 0);
            $('#stat-reserved').text(this.statistics.reserved_devices || 0);
            $('#stat-in-use').text(this.statistics.in_use_devices || 0);
            $('#stat-expired').text(this.statistics.expired_devices || 0);
        }
    }

    render_devices() {
        const grid = $('#devices-grid');
        grid.empty();

        if (this.devices.length === 0) {
            this.show_empty_state();
            return;
        }

        this.devices.forEach(device => {
            const card = this.create_device_card(device);
            grid.append(card);
        });
    }

    create_device_card(device) {
        const status_class = this.get_status_class(device.status);
        const device_icon = this.get_device_icon(device.app_type);
        const last_activity = device.last_activity ? 
            frappe.datetime.str_to_user(device.last_activity) : 'Never';

        const card = $(`
            <div class="device-card ${status_class}" data-device="${device.name}">
                <div class="status-badge ${status_class}">${device.status}</div>
                
                <div class="device-header">
                    <div class="device-icon ${device_icon.class}">
                        <i class="${device_icon.icon}"></i>
                    </div>
                    <div class="device-info">
                        <h4>${device.device_name}</h4>
                        <div class="ip-address">ID: ${device.id}</div>
                    </div>
                </div>

                <div class="device-details">
                    <div class="device-detail-row">
                        <span class="device-detail-label">Type:</span>
                        <span class="device-detail-value">${device.app_type || 'Unknown'}</span>
                    </div>
                    ${device.assigned_to ? `
                        <div class="device-detail-row">
                            <span class="device-detail-label">Assigned to:</span>
                            <span class="device-detail-value assigned-user">${device.assigned_to}</span>
                        </div>
                    ` : ''}
                    <div class="device-detail-row">
                        <span class="device-detail-label">Last Activity:</span>
                        <span class="device-detail-value">${last_activity}</span>
                    </div>
                </div>

                <div class="connection-indicator">
                    <div class="connection-dot ${device.active_connections > 0 ? 'active' : 'inactive'}"></div>
                    <span>${device.active_connections > 0 ? 'Active Connection' : 'No Active Connection'}</span>
                </div>
            </div>
        `);

        card.on('click', () => this.show_device_modal(device));
        return card;
    }

    get_status_class(status) {
        const status_map = {
            'Available': 'available',
            'Reserved': 'reserved',
            'Temporary': 'in-use',
            'In Use': 'in-use',
            'Expired': 'expired'
        };
        return status_map[status] || 'offline';
    }

    get_device_icon(app_type) {
        const type_map = {
            'Desktop': { class: 'desktop', icon: 'fa fa-desktop' },
            'Laptop': { class: 'laptop', icon: 'fa fa-laptop' },
            'Server': { class: 'server', icon: 'fa fa-server' },
            'Mobile': { class: 'other', icon: 'fa fa-mobile' }
        };
        return type_map[app_type] || { class: 'other', icon: 'fa fa-computer' };
    }

    show_device_modal(device) {
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.network_devices_dashboard.network_devices_dashboard.get_device_details',
            args: { device_name: device.name },
            callback: (r) => {
                if (r.message) {
                    this.render_device_modal(r.message);
                }
            }
        });
    }

    render_device_modal(data) {
        const device = data.device;
        const can_reserve = data.can_reserve;
        const can_connect = data.can_connect;
        const active_connection = data.active_connection;

        const modal = $(`
            <div class="device-modal" id="device-modal">
                <div class="device-modal-content">
                    <div class="device-modal-header">
                        <h3 class="device-modal-title">${device.id}</h3>
                        <button class="device-modal-close">&times;</button>
                    </div>
                    
                    <div class="device-modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h5>Device Information</h5>
                                <table class="table table-borderless">
                                    <tr><td><strong>Device ID:</strong></td><td>${device.id}</td></tr>
                                    <tr><td><strong>Type:</strong></td><td>${device.app_type || 'Unknown'}</td></tr>
                                    <tr><td><strong>Status:</strong></td><td><span class="badge badge-${this.get_status_class(device.status)}">${device.status}</span></td></tr>
                                    ${device.assigned_to ? `<tr><td><strong>Assigned to:</strong></td><td>${device.assigned_to}</td></tr>` : ''}
                                    ${device.expiry_date ? `<tr><td><strong>Expires:</strong></td><td>${frappe.datetime.str_to_user(device.expiry_date)}</td></tr>` : ''}
                                </table>
                            </div>
                            
                            <div class="col-md-6">
                                <h5>Connection Status</h5>
                                ${active_connection ? `
                                    <div class="alert alert-info">
                                        <strong>Active Connection</strong><br>
                                        Started: ${frappe.datetime.str_to_user(active_connection.connection_start_time)}<br>
                                        Purpose: ${active_connection.connection_purpose}
                                    </div>
                                ` : '<div class="alert alert-secondary">No active connection</div>'}
                                
                                ${data.connection_history.length > 0 ? `
                                    <h6>Recent Activity</h6>
                                    <div class="connection-history" style="max-height: 200px; overflow-y: auto;">
                                        ${data.connection_history.slice(0, 5).map(log => `
                                            <div class="connection-log-item" style="padding: 8px; border-bottom: 1px solid #eee;">
                                                <div style="font-size: 12px; color: #666;">
                                                    ${log.connection_start_time ? frappe.datetime.str_to_user(log.connection_start_time) : 'Unknown'}
                                                </div>
                                                <div style="font-size: 13px;">
                                                    ${log.connection_purpose || 'Remote Access'}
                                                    ${log.connection_duration ? ` (${frappe.format(log.connection_duration, {fieldtype: 'Duration'})})` : ''}
                                                </div>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <div class="device-modal-footer">
                        ${this.get_device_action_buttons(device, can_reserve, can_connect, active_connection)}
                        <button class="action-btn secondary" onclick="$('#device-modal').remove()">Close</button>
                    </div>
                </div>
            </div>
        `);

        $('body').append(modal);

        modal.find('.device-modal-close').on('click', () => modal.remove());
        modal.on('click', (e) => {
            if (e.target === modal[0]) {
                modal.remove();
            }
        });

        this.setup_modal_action_handlers(modal, device);
    }

    get_device_action_buttons(device, can_reserve, can_connect, active_connection) {
        let buttons = '';

        if (can_connect && device.status !== 'Expired') {
            buttons += `<button class="action-btn success" data-action="connect">
                <i class="fa fa-play"></i> Connect
            </button>`;
        }

        if (can_reserve && device.status === 'Available') {
            buttons += `<button class="action-btn warning" data-action="reserve">
                <i class="fa fa-lock"></i> Reserve
            </button>`;
        }

        if (device.status === 'Reserved' && device.assign_to === frappe.session.user) {
            buttons += `<button class="action-btn primary" data-action="release">
                <i class="fa fa-unlock"></i> Release
            </button>`;
        }

        return buttons;
    }

    setup_modal_action_handlers(modal, device) {
        modal.find('[data-action="connect"]').on('click', () => {
            this.connect_to_device(device.name);
            modal.remove();
        });

        modal.find('[data-action="reserve"]').on('click', () => {
            this.reserve_device(device.name);
            modal.remove();
        });

        modal.find('[data-action="release"]').on('click', () => {
            this.release_device(device.name);
            modal.remove();
        });
    }

    connect_to_device(device_name) {
        const purpose = prompt('Enter connection purpose (optional):');
        
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.network_devices_dashboard.network_devices_dashboard.start_connection',
            args: { 
                device_name: device_name,
                purpose: purpose 
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.show_alert({
                        message: r.message.message,
                        indicator: 'green'
                    });
                    this.refresh();
                    this.show_connection_details(r.message.device_details);
                } else {
                    frappe.show_alert({
                        message: r.message ? r.message.message : 'Failed to connect to device',
                        indicator: 'red'
                    });
                }
            }
        });
    }

    reserve_device(device_name) {
        const purpose = prompt('Enter reservation purpose (optional):');
        
        frappe.call({
            method: 'svg_mobile_app.svg_mobile_app.page.network_devices_dashboard.network_devices_dashboard.reserve_device',
            args: { 
                device_name: device_name,
                purpose: purpose 
            },
            callback: (r) => {
                if (r.message && r.message.success) {
                    frappe.show_alert({
                        message: r.message.message,
                        indicator: 'green'
                    });
                    this.refresh();
                } else {
                    frappe.show_alert({
                        message: r.message ? r.message.message : 'Failed to reserve device',
                        indicator: 'red'
                    });
                }
            }
        });
    }

    release_device(device_name) {
        if (confirm('Are you sure you want to release this device?')) {
            frappe.call({
                method: 'svg_mobile_app.svg_mobile_app.page.network_devices_dashboard.network_devices_dashboard.release_device',
                args: { device_name: device_name },
                callback: (r) => {
                    if (r.message && r.message.success) {
                        frappe.show_alert({
                            message: r.message.message,
                            indicator: 'green'
                        });
                        this.refresh();
                    } else {
                        frappe.show_alert({
                            message: r.message ? r.message.message : 'Failed to release device',
                            indicator: 'red'
                        });
                    }
                }
            });
        }
    }

    show_connection_details(device) {
        const connection_modal = $(`
            <div class="device-modal" id="connection-modal">
                <div class="device-modal-content">
                    <div class="device-modal-header">
                        <h3 class="device-modal-title">Connection Established</h3>
                        <button class="device-modal-close">&times;</button>
                    </div>
                    
                    <div class="device-modal-body">
                        <div class="alert alert-success">
                            <h5>Successfully connected to ${device.id}</h5>
                        </div>
                        
                        <h6>Connection Details:</h6>
                        <table class="table">
                            <tr><td><strong>Device:</strong></td><td>${device.id}</td></tr>
                            <tr><td><strong>Device ID:</strong></td><td>${device.id}</td></tr>
                            ${device.password ? `<tr><td><strong>Password:</strong></td><td><code>${device.password}</code></td></tr>` : ''}
                            <tr><td><strong>Connection Time:</strong></td><td>${frappe.datetime.str_to_user(frappe.datetime.now_datetime())}</td></tr>
                        </table>
                        
                        <div class="alert alert-info">
                            <strong>Note:</strong> Please remember to end your connection when finished to allow others to use the device.
                        </div>
                    </div>
                    
                    <div class="device-modal-footer">
                        <button class="action-btn primary" onclick="$('#connection-modal').remove()">Got it</button>
                    </div>
                </div>
            </div>
        `);

        $('body').append(connection_modal);
        
        connection_modal.find('.device-modal-close').on('click', () => connection_modal.remove());
        connection_modal.on('click', (e) => {
            if (e.target === connection_modal[0]) {
                connection_modal.remove();
            }
        });
    }

    apply_quick_filter(status) {
        $('#status-filter').val(status);
        this.filters.status = status;
        this.apply_filters();
    }

    apply_filters() {
        this.load_devices().then(() => {
            this.render_devices();
        });
    }

    show_loading() {
        $('#devices-grid').html(`
            <div class="loading-grid">
                ${Array(6).fill().map(() => `
                    <div class="loading-card">
                        <div class="loading-placeholder large"></div>
                        <div class="loading-placeholder medium"></div>
                        <div class="loading-placeholder small"></div>
                    </div>
                `).join('')}
            </div>
        `);
    }

    hide_loading() {
        // Loading will be replaced by render_devices()
    }

    show_auto_refresh_indicator() {
        $('#auto-refresh-indicator').addClass('active');
        setTimeout(() => {
            $('#auto-refresh-indicator').removeClass('active');
        }, 2000);
    }

    hide_auto_refresh_indicator() {
        $('#auto-refresh-indicator').removeClass('active');
    }

    show_empty_state() {
        $('#devices-grid').html(`
            <div class="empty-state">
                <div class="empty-state-icon">
                    <i class="fa fa-desktop"></i>
                </div>
                <h3>No Devices Found</h3>
                <p>No remote access devices match your current filters. Try adjusting your search criteria or check if devices have been added to the system.</p>
                <button class="action-btn primary" onclick="frappe.network_devices_dashboard.refresh()">
                    <i class="fa fa-refresh"></i> Refresh
                </button>
            </div>
        `);
    }

    destroy() {
        if (this.auto_refresh_interval) {
            clearInterval(this.auto_refresh_interval);
        }
        $('#auto-refresh-indicator').remove();
    }
}

$(document).on('page-change', function() {
    if (frappe.network_devices_dashboard) {
        frappe.network_devices_dashboard.destroy();
    }
});

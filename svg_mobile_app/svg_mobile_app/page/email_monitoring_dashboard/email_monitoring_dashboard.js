frappe.pages['email-monitoring-dashboard'].on_page_load = function(wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Email Monitoring Dashboard'),
		single_column: true
	});

	const filters = {
		status: page.add_field({ fieldtype: 'Select', label: __('Status'), options: ['', 'Open', 'Need Reply', 'Replied', 'Follow Up', 'Follow Up Review', 'Closed'] }),
		type: page.add_field({ fieldtype: 'Select', label: __('Type'), options: ['', 'Incoming', 'Issued'] }),
		account: page.add_field({ fieldtype: 'Link', label: __('Email Account'), options: 'Email Account' }),
		assignee: page.add_field({ fieldtype: 'Link', label: __('Assigned User'), options: 'User' }),
		priority: page.add_field({ fieldtype: 'Select', label: __('Priority'), options: ['', 'High', 'Medium', 'Low'] }),
	};

	const $container = $('<div class="email-monitoring-grid">').appendTo(page.body);

	const $actions = $('<div class="email-monitoring-actions" style="margin-bottom: 12px;"></div>').prependTo(page.body);
	const $assignBtn = $('<button class="btn btn-sm btn-default" style="margin-right:6px;">' + __('Assign') + '</button>').appendTo($actions);
	const $statusBtn = $('<button class="btn btn-sm btn-default" style="margin-right:6px;">' + __('Change Status') + '</button>').appendTo($actions);
	const $priorityBtn = $('<button class="btn btn-sm btn-default">' + __('Change Priority') + '</button>').appendTo($actions);

	function load_rows(start=0) {
		const f = {};
		if (filters.status.get_value()) f.status = filters.status.get_value();
		if (filters.type.get_value()) f.email_type = filters.type.get_value();
		if (filters.account.get_value()) f.email_account = filters.account.get_value();
		if (filters.assignee.get_value()) f.assigned_user = filters.assignee.get_value();
		if (filters.priority.get_value()) f.priority = filters.priority.get_value();

		frappe.call({
			method: 'svg_mobile_app.api.get_email_monitoring',
			args: { filters: f, limit_start: start, limit_page_length: 50 },
			freeze: true
		}).then(r => {
			const data = (r && r.message && r.message.data) || [];
			$container.empty();
			if (!data.length) {
				$container.append($('<div class="text-muted">').text(__('No records')));
				return;
			}
			const $table = $('<table class="table table-bordered">\n<thead><tr><th><input type="checkbox" class="em-select-all"/></th><th>' + __('Communication') + '</th><th>' + __('Type') + '</th><th>' + __('Status') + '</th><th>' + __('Priority') + '</th><th>' + __('Assigned') + '</th><th>' + __('Account') + '</th><th>' + __('Modified') + '</th><th>' + __('Actions') + '</th></tr></thead><tbody></tbody>');
			data.forEach(row => {
				const $tr = $('<tr>');
				$tr.append('<td><input type="checkbox" class="em-select" data-name="' + row.name + '"/></td>');
				$tr.append('<td>' + (row.communication || '') + '</td>');
				$tr.append('<td>' + (row.email_type || '') + '</td>');
				$tr.append('<td>' + (row.status || '') + '</td>');
				$tr.append('<td>' + (row.priority || '') + '</td>');
				$tr.append('<td>' + (row.assigned_user || '') + '</td>');
				$tr.append('<td>' + (row.email_account || '') + '</td>');
				$tr.append('<td>' + (row.modified || '') + '</td>');
				const $actions = $('<td>');
				$('<button class="btn btn-xs btn-default">' + __('Open') + '</button>').on('click', () => {
					frappe.set_route('Form', 'Email Monitoring', row.name);
				}).appendTo($actions);
				$tr.append($actions);
				$table.find('tbody').append($tr);
			});
			$container.append($table);

			$table.find('.em-select-all').on('change', function() {
				const checked = $(this).is(':checked');
				$table.find('.em-select').prop('checked', checked);
			});
		});
	}

	Object.values(filters).forEach(f => f.$input && f.$input.on('change', () => load_rows(0)));

	load_rows();

	function get_selected() {
		const names = [];
		$container.find('.em-select:checked').each(function(){ names.push($(this).data('name')); });
		return names;
	}

	$assignBtn.on('click', function(){
		const names = get_selected(); if (!names.length) return;
		frappe.prompt({ fieldtype:'Link', options:'User', fieldname:'assignee', label:__('Assign To'), reqd:1 }, (v)=>{
			const assignee = v.assignee;
			frappe.run_serially(names.map(n => () => frappe.call({ method:'svg_mobile_app.api.update_email_monitoring', args:{ name:n, assigned_user: assignee } })) ).then(()=> load_rows());
		});
	});

	$statusBtn.on('click', function(){
		const names = get_selected(); if (!names.length) return;
		frappe.prompt({ fieldtype:'Select', fieldname:'status', label:__('Status'), options:['Open','Need Reply','Replied','Follow Up','Follow Up Review','Closed'], reqd:1 }, (v)=>{
			const status = v.status;
			frappe.run_serially(names.map(n => () => frappe.call({ method:'svg_mobile_app.api.update_email_monitoring', args:{ name:n, status: status } })) ).then(()=> load_rows());
		});
	});

	$priorityBtn.on('click', function(){
		const names = get_selected(); if (!names.length) return;
		frappe.prompt({ fieldtype:'Select', fieldname:'priority', label:__('Priority'), options:['High','Medium','Low'], reqd:1 }, (v)=>{
			const priority = v.priority;
			frappe.run_serially(names.map(n => () => frappe.call({ method:'svg_mobile_app.api.update_email_monitoring', args:{ name:n, priority: priority } })) ).then(()=> load_rows());
		});
	});
};


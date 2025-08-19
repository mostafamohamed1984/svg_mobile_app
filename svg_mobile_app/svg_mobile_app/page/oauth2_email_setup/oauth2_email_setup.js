frappe.pages['oauth2-email-setup'].on_page_load = function(wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'OAuth2 Email Setup',
		single_column: true
	});
	
	// Create main content area
	let $content = $(wrapper).find('.layout-main-section');
	
	// Initialize the page
	new OAuth2EmailSetup($content, page);
}

class OAuth2EmailSetup {
	constructor($content, page) {
		this.$content = $content;
		this.page = page;
		this.init();
	}
	
	init() {
		this.setup_page_actions();
		this.render_content();
		this.load_providers();
	}
	
	setup_page_actions() {
		// Add New Provider button
		this.page.add_inner_button(__('New Provider'), () => {
			this.show_provider_dialog();
		});
		
		// Refresh button
		this.page.add_inner_button(__('Refresh'), () => {
			this.load_providers();
		});
	}
	
	render_content() {
		this.$content.html(`
			<div class="oauth-setup-container">
				<div class="row">
					<div class="col-md-12">
						<div class="card">
							<div class="card-header">
								<h4>OAuth2 Email Providers</h4>
								<p class="text-muted">Configure OAuth2 authentication for Gmail and Microsoft 365 email services.</p>
							</div>
							<div class="card-body">
								<div id="providers-list">
									<div class="text-center">
										<i class="fa fa-spinner fa-spin"></i> Loading providers...
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
				
				<div class="row mt-4">
					<div class="col-md-12">
						<div class="card">
							<div class="card-header">
								<h4>Setup Instructions</h4>
							</div>
							<div class="card-body">
								<div class="row">
									<div class="col-md-6">
										<h5><i class="fab fa-google"></i> Gmail Setup</h5>
										<ol>
											<li>Go to <a href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a></li>
											<li>Create a new project or select existing</li>
											<li>Enable Gmail API</li>
											<li>Create OAuth 2.0 credentials</li>
											<li>Add redirect URI: <code id="redirect-uri-gmail"></code></li>
											<li>Copy Client ID and Client Secret to the provider settings</li>
										</ol>
									</div>
									<div class="col-md-6">
										<h5><i class="fab fa-microsoft"></i> Microsoft 365 Setup</h5>
										<ol>
											<li>Go to <a href="https://portal.azure.com/" target="_blank">Azure Portal</a></li>
											<li>Navigate to App registrations</li>
											<li>Create new registration</li>
											<li>Add API permissions: Mail.Send, Mail.Read</li>
											<li>Add redirect URI: <code id="redirect-uri-m365"></code></li>
											<li>Create client secret and copy values to provider settings</li>
										</ol>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		`);
		
		// Set redirect URIs
		const site_url = frappe.utils.get_url();
		const redirect_uri = `${site_url}/api/method/svg_mobile_app.oauth_handlers.oauth2_callback`;
		$('#redirect-uri-gmail').text(redirect_uri);
		$('#redirect-uri-m365').text(redirect_uri);
	}
	
	load_providers() {
		frappe.call({
			method: 'frappe.client.get_list',
			args: {
				doctype: 'Email OAuth Settings',
				fields: ['name', 'provider', 'enabled', 'token_expires_at'],
				order_by: 'creation desc'
			},
			callback: (r) => {
				this.render_providers(r.message || []);
			}
		});
	}
	
	render_providers(providers) {
		let html = '';
		
		if (providers.length === 0) {
			html = `
				<div class="text-center text-muted">
					<i class="fa fa-inbox fa-3x mb-3"></i>
					<p>No OAuth2 providers configured yet.</p>
					<button class="btn btn-primary" onclick="cur_page.oauth_setup.show_provider_dialog()">
						Add First Provider
					</button>
				</div>
			`;
		} else {
			providers.forEach(provider => {
				const status_class = provider.enabled ? 'success' : 'secondary';
				const status_text = provider.enabled ? 'Enabled' : 'Disabled';
				const token_status = this.get_token_status(provider.token_expires_at);
				
				html += `
					<div class="card mb-3 provider-card" data-name="${provider.name}">
						<div class="card-body">
							<div class="row align-items-center">
								<div class="col-md-3">
									<div class="d-flex align-items-center">
										<i class="fab fa-${provider.provider.toLowerCase() === 'gmail' ? 'google' : 'microsoft'} fa-2x mr-3"></i>
										<div>
											<h6 class="mb-1">${provider.name}</h6>
											<small class="text-muted">${provider.provider}</small>
										</div>
									</div>
								</div>
								<div class="col-md-2">
									<span class="badge badge-${status_class}">${status_text}</span>
								</div>
								<div class="col-md-3">
									<div class="token-status">
										<small class="text-muted">Token Status:</small><br>
										<span class="badge badge-${token_status.class}">${token_status.text}</span>
									</div>
								</div>
								<div class="col-md-4 text-right">
									<div class="btn-group">
										<button class="btn btn-sm btn-outline-primary" onclick="cur_page.oauth_setup.authorize_provider('${provider.name}')">
											<i class="fa fa-key"></i> Authorize
										</button>
										<button class="btn btn-sm btn-outline-info" onclick="cur_page.oauth_setup.test_connection('${provider.name}')">
											<i class="fa fa-plug"></i> Test
										</button>
										<button class="btn btn-sm btn-outline-secondary" onclick="cur_page.oauth_setup.edit_provider('${provider.name}')">
											<i class="fa fa-edit"></i> Edit
										</button>
										<button class="btn btn-sm btn-outline-danger" onclick="cur_page.oauth_setup.delete_provider('${provider.name}')">
											<i class="fa fa-trash"></i> Delete
										</button>
									</div>
								</div>
							</div>
						</div>
					</div>
				`;
			});
		}
		
		$('#providers-list').html(html);
	}
	
	get_token_status(expires_at) {
		if (!expires_at) {
			return { class: 'warning', text: 'Not Authorized' };
		}
		
		const now = new Date();
		const expires = new Date(expires_at);
		
		if (expires < now) {
			return { class: 'danger', text: 'Expired' };
		} else if (expires < new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
			return { class: 'warning', text: 'Expires Soon' };
		} else {
			return { class: 'success', text: 'Valid' };
		}
	}
	
	show_provider_dialog(provider_name = null) {
		const dialog = new frappe.ui.Dialog({
			title: provider_name ? 'Edit OAuth2 Provider' : 'New OAuth2 Provider',
			fields: [
				{
					fieldtype: 'Data',
					fieldname: 'provider_name',
					label: 'Provider Name',
					reqd: 1,
					default: provider_name
				},
				{
					fieldtype: 'Select',
					fieldname: 'provider',
					label: 'Provider Type',
					options: 'Gmail\nMicrosoft 365',
					reqd: 1
				},
				{
					fieldtype: 'Data',
					fieldname: 'client_id',
					label: 'Client ID',
					reqd: 1
				},
				{
					fieldtype: 'Password',
					fieldname: 'client_secret',
					label: 'Client Secret',
					reqd: 1
				},
				{
					fieldtype: 'Data',
					fieldname: 'tenant_id',
					label: 'Tenant ID (Microsoft 365 only)',
					depends_on: 'eval:doc.provider=="Microsoft 365"'
				},
				{
					fieldtype: 'Check',
					fieldname: 'enabled',
					label: 'Enabled',
					default: 1
				}
			],
			primary_action_label: provider_name ? 'Update' : 'Create',
			primary_action: (values) => {
				this.save_provider(values, provider_name);
				dialog.hide();
			}
		});
		
		// Load existing data if editing
		if (provider_name) {
			frappe.call({
				method: 'frappe.client.get',
				args: {
					doctype: 'Email OAuth Settings',
					name: provider_name
				},
				callback: (r) => {
					if (r.message) {
						dialog.set_values({
							provider_name: r.message.name,
							provider: r.message.provider,
							client_id: r.message.client_id,
							tenant_id: r.message.tenant_id,
							enabled: r.message.enabled
						});
					}
				}
			});
		}
		
		dialog.show();
	}
	
	save_provider(values, existing_name = null) {
		const method = existing_name ? 'frappe.client.set_value' : 'frappe.client.insert';
		const args = existing_name ? {
			doctype: 'Email OAuth Settings',
			name: existing_name,
			fieldname: values
		} : {
			doc: {
				doctype: 'Email OAuth Settings',
				name: values.provider_name,
				...values
			}
		};
		
		frappe.call({
			method: method,
			args: args,
			callback: (r) => {
				if (r.message) {
					frappe.show_alert({
						message: `Provider ${existing_name ? 'updated' : 'created'} successfully`,
						indicator: 'green'
					});
					this.load_providers();
				}
			}
		});
	}
	
	authorize_provider(provider_name) {
		frappe.call({
			method: 'svg_mobile_app.oauth_handlers.initiate_oauth_flow',
			args: {
				provider_name: provider_name
			},
			callback: (r) => {
				if (r.message && r.message.success) {
					// Open authorization URL in new window
					const auth_window = window.open(
						r.message.auth_url,
						'oauth_auth',
						'width=600,height=700,scrollbars=yes,resizable=yes'
					);
					
					// Monitor window for closure
					const check_closed = setInterval(() => {
						if (auth_window.closed) {
							clearInterval(check_closed);
							// Refresh providers after authorization
							setTimeout(() => {
								this.load_providers();
							}, 2000);
						}
					}, 1000);
					
					frappe.show_alert({
						message: r.message.message,
						indicator: 'blue'
					});
				} else {
					frappe.msgprint({
						title: 'Authorization Failed',
						message: r.message ? r.message.error : 'Unknown error occurred',
						indicator: 'red'
					});
				}
			}
		});
	}
	
	test_connection(provider_name) {
		frappe.show_alert({
			message: 'Testing connection...',
			indicator: 'blue'
		});
		
		frappe.call({
			method: 'svg_mobile_app.oauth_handlers.test_oauth_connection',
			args: {
				provider_name: provider_name
			},
			callback: (r) => {
				if (r.message && r.message.success) {
					frappe.msgprint({
						title: 'Connection Test Successful',
						message: r.message.message,
						indicator: 'green'
					});
				} else {
					frappe.msgprint({
						title: 'Connection Test Failed',
						message: r.message ? r.message.error : 'Unknown error occurred',
						indicator: 'red'
					});
				}
			}
		});
	}
	
	edit_provider(provider_name) {
		this.show_provider_dialog(provider_name);
	}
	
	delete_provider(provider_name) {
		frappe.confirm(
			`Are you sure you want to delete the provider "${provider_name}"?`,
			() => {
				frappe.call({
					method: 'frappe.client.delete',
					args: {
						doctype: 'Email OAuth Settings',
						name: provider_name
					},
					callback: (r) => {
						frappe.show_alert({
							message: 'Provider deleted successfully',
							indicator: 'green'
						});
						this.load_providers();
					}
				});
			}
		);
	}
}

// Make the class available globally
frappe.pages['oauth2-email-setup'].on_page_show = function(wrapper) {
	cur_page.oauth_setup = wrapper.page.oauth_setup;
};

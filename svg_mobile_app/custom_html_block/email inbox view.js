(function() {
    // Initialize variables
    let currentPage = 1;
    const pageSize = 10;
    let totalRecords = 0;
    let currentFilter = "my_emails";
    let sentReceivedFilter = "all";
    let statusFilter = "all";
    let selectedEmailAccount = "all";
    let selectedMailTag = "all";
    let userEmails = [];
    let mailTags = [];
    let searchTerm = "";

    // Wait for DOM to be ready
    if (typeof root_element === 'undefined') {
        console.error('root_element is not defined. This script should run in a Custom HTML block context.');
        return;
    }

    // Initialize the inbox
    initInbox();

    function initInbox() {
        // Load user emails first
        loadUserEmails();
        
        // Load mail tags
        loadMailTags();
        
        // Set default filter to "my_emails"
        currentFilter = "my_emails";
        const filterSelect = root_element.querySelector('#communication-filter');
        if (filterSelect) {
            filterSelect.value = currentFilter;
        }

        // Show email accounts dropdown by default
        const emailAccountsRow = root_element.querySelector('.email-accounts-row');
        if (emailAccountsRow) {
            emailAccountsRow.style.display = "block"; // Show by default
        }

        // Attach event listeners
        if (filterSelect) {
            filterSelect.addEventListener('change', function() {
                currentFilter = this.value;
                currentPage = 1;
                
                // Show/hide email accounts dropdown based on filter
                if (emailAccountsRow) {
                    emailAccountsRow.style.display = currentFilter === "my_emails" ? "block" : "none";
                }
                fetchCommunications();
            });
        }

        const sentReceivedSelect = root_element.querySelector('#sent-received-filter');
        if (sentReceivedSelect) {
            sentReceivedSelect.addEventListener('change', function() {
                sentReceivedFilter = this.value;
                currentPage = 1;
                fetchCommunications();
            });
        }

        const statusSelect = root_element.querySelector('#status-filter');
        if (statusSelect) {
            statusSelect.addEventListener('change', function() {
                statusFilter = this.value;
                currentPage = 1;
                fetchCommunications();
            });
        }

        const emailAccountSelect = root_element.querySelector('#email-account-filter');
        if (emailAccountSelect) {
            emailAccountSelect.addEventListener('change', function() {
                selectedEmailAccount = this.value;
                currentPage = 1;
                fetchCommunications();
            });
        }

        const mailTagSelect = root_element.querySelector('#mail-tag-filter');
        if (mailTagSelect) {
            mailTagSelect.addEventListener('change', function() {
                selectedMailTag = this.value;
                currentPage = 1;
                fetchCommunications();
            });
        }

        const refreshBtn = root_element.querySelector('#refresh-inbox');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', function() {
                fetchCommunications();
            });
        }

        // Add event listener for compose button
        const composeBtn = root_element.querySelector('#compose-email');
        if (composeBtn) {
            composeBtn.addEventListener('click', function() {
                openComposeDialog();
            });
        }

        // Add event listeners for search functionality
        const searchInput = root_element.querySelector('#email-search');
        if (searchInput) {
            // Add debounced search to avoid too many API calls
            let searchTimeout;
            searchInput.addEventListener('input', function() {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    searchTerm = this.value.trim();
                    currentPage = 1;
                    fetchCommunications();
                }, 500); // 500ms delay
            });

            // Prevent keyboard shortcuts from interfering with global search
            searchInput.addEventListener('keydown', function(e) {
                // Stop propagation for all keydown events to prevent global search activation
                e.stopPropagation();
                
                // Also prevent specific shortcuts that might interfere
                if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
                    e.preventDefault();
                }
            });

            // Also search on Enter key
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault(); // Prevent default form submission behavior
                    e.stopPropagation(); // Stop event from bubbling up to global search
                    clearTimeout(searchTimeout);
                    searchTerm = this.value.trim();
                    currentPage = 1;
                    fetchCommunications();
                }
            });

            // Add focus handler to ensure proper isolation
            searchInput.addEventListener('focus', function(e) {
                e.stopPropagation();
            });
        }

        const clearSearchBtn = root_element.querySelector('#clear-search');
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', function() {
                const searchInput = root_element.querySelector('#email-search');
                if (searchInput) {
                    searchInput.value = '';
                    searchTerm = '';
                    currentPage = 1;
                    fetchCommunications();
                }
            });
        }

        const prevPageBtn = root_element.querySelector('#prev-page');
        if (prevPageBtn) {
            prevPageBtn.addEventListener('click', function() {
                if (currentPage > 1) {
                    currentPage--;
                    fetchCommunications();
                }
            });
        }

        const nextPageBtn = root_element.querySelector('#next-page');
        if (nextPageBtn) {
            nextPageBtn.addEventListener('click', function() {
                if (currentPage * pageSize < totalRecords) {
                    currentPage++;
                    fetchCommunications();
                }
            });
        }

        // After DOM is ready
        // Make sure email accounts dropdown is visible
        if (emailAccountsRow) {
            emailAccountsRow.style.display = "block";
        }

        // Initial data fetch will be called after loading user emails
    }

    function loadUserEmails() {
        // Use custom API to get user's email accounts without permission issues
        frappe.call({
            method: "svg_mobile_app.api.get_user_profile_data",
            callback: function(r) {
                if (r.message && r.message.status === "success") {
                    const data = r.message.data;
                    
                    // Get email accounts from user_emails array in the API response
                    if (data.user_emails && data.user_emails.length > 0) {
                        // First, get all email accounts to match with user emails
                        frappe.call({
                            method: "frappe.client.get_list",
                            args: {
                                doctype: "Email Account",
                                fields: ["name", "email_id"],
                                limit_page_length: 500
                            },
                            callback: function(email_resp) {
                                if (email_resp.message && email_resp.message.length > 0) {
                                    const allEmailAccounts = email_resp.message;
                                    
                                    // Find matching email accounts for the user's emails
                                    const userEmailAccounts = [];
                                    
                                    // For each user email, find the matching email account
                                    data.user_emails.forEach(userEmail => {
                                        const matchingAccount = allEmailAccounts.find(acc => acc.email_id === userEmail);
                                        if (matchingAccount) {
                                            userEmailAccounts.push({
                                                name: matchingAccount.name,
                                                email_id: matchingAccount.email_id
                                            });
                                        } else {
                                            // If no matching account found, create a generic one
                                            userEmailAccounts.push({
                                                name: userEmail,
                                                email_id: userEmail
                                            });
                                        }
                                    });

                                    // Use the matched accounts
                                    if (userEmailAccounts.length > 0) {
                                        userEmails = data.user_emails;
                                        populateEmailAccountsDropdown(userEmailAccounts);
                                    } else {
                                        // Fall back to user's primary email
                                        userEmails = [data.email || frappe.session.user_email];
                                        populateEmailAccountsDropdown([{
                                            name: "user_email",
                                            email_id: data.email || frappe.session.user_email
                                        }]);
                                    }

                                    // Fetch communications after processing
                                    fetchCommunications();
                                } else {
                                    // No email accounts found, use user emails directly
                                    const userEmailAccounts = data.user_emails.map(email => ({
                                        name: email,
                                        email_id: email
                                    }));
                                    userEmails = data.user_emails;
                                    populateEmailAccountsDropdown(userEmailAccounts);
                                    fetchCommunications();
                                }
                            },
                            error: function() {
                                // Error getting email accounts, use user emails directly
                                const userEmailAccounts = data.user_emails.map(email => ({
                                    name: email,
                                    email_id: email
                                }));
                                userEmails = data.user_emails;
                                populateEmailAccountsDropdown(userEmailAccounts);
                                fetchCommunications();
                            }
                        });
                    } else {
                        // No user emails found, fall back to primary email
                        userEmails = [data.email || frappe.session.user_email];
                        populateEmailAccountsDropdown([{
                            name: "user_email",
                            email_id: data.email || frappe.session.user_email
                        }]);
                        fetchCommunications();
                    }
                } else {
                    console.error('API Error or unexpected response format:', r.message);
                    // Fall back to user's own email
                    userEmails = [frappe.session.user_email];
                    populateEmailAccountsDropdown([{
                        name: "user_email",
                        email_id: frappe.session.user_email
                    }]);
                    fetchCommunications();
                }
            },
            error: function(xhr, status, error) {
                console.error('AJAX error fetching user email accounts:', error);
                // Fall back to user's own email on error
                userEmails = [frappe.session.user_email];
                populateEmailAccountsDropdown([{
                    name: "user_email",
                    email_id: frappe.session.user_email
                }]);
                fetchCommunications();
            }
        });
    }

    function populateEmailAccountsDropdown(emailAccounts) {
        const emailAccountSelect = root_element.querySelector('#email-account-filter');
        if (!emailAccountSelect) return;

        // Clear existing options except the first one
        while (emailAccountSelect.options.length > 1) {
            emailAccountSelect.remove(1);
        }

        // Add each email account as an option
        emailAccounts.forEach(function(account) {
            const option = document.createElement('option');
            option.value = account.name; // Use the account name (ID) as value
            option.textContent = account.email_id + " (" + account.name + ")";
            emailAccountSelect.appendChild(option);
        });
    }

    function loadMailTags() {
        // Get mail tags from the Mail Tags doctype
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Mail Tags",
                fields: ["name", "tag_name"],
                limit_page_length: 500
            },
            callback: function(r) {
                if (r.message && r.message.length > 0) {
                    mailTags = r.message;
                    populateMailTagsDropdown(mailTags);
                }
            }
        });
    }

    function populateMailTagsDropdown(tags) {
        const mailTagSelect = root_element.querySelector('#mail-tag-filter');
        if (!mailTagSelect) return;

        // Clear existing options except the first one
        while (mailTagSelect.options.length > 1) {
            mailTagSelect.remove(1);
        }

        // Add each tag as an option
        tags.forEach(function(tag) {
            const option = document.createElement('option');
            option.value = tag.name;
            option.textContent = tag.tag_name || tag.name;
            mailTagSelect.appendChild(option);
        });
    }

    // Helper function to get the child table name for custom_tag field
    function getCustomTagChildTable() {
        return new Promise((resolve) => {
            frappe.call({
                method: "frappe.client.get_meta",
                args: {
                    doctype: "Communication"
                },
                callback: function(r) {
                    if (r.message && r.message.fields) {
                        const customTagField = r.message.fields.find(field => field.fieldname === 'custom_tag');
                        if (customTagField && customTagField.options) {
                            console.log("Found custom_tag child table:", customTagField.options);
                            resolve(customTagField.options);
                        } else {
                            console.log("custom_tag field not found or no options");
                            resolve(null);
                        }
                    } else {
                        console.log("Could not get Communication meta");
                        resolve(null);
                    }
                },
                error: function(err) {
                    console.error("Error getting Communication meta:", err);
                    resolve(null);
                }
            });
        });
    }

    // Helper function to get communication tags from Table MultiSelect field
    function getCommunicationTags(communicationName) {
        return new Promise((resolve) => {
            try {
                // Get the full Communication document which includes child table data
                frappe.call({
                    method: "frappe.client.get",
                    args: {
                        doctype: "Communication",
                        name: communicationName
                    },
                    callback: function(r) {
                        if (r.message && r.message.custom_tag) {
                            console.log("Communication custom_tag data for", communicationName, ":", r.message.custom_tag);
                            
                            // The custom_tag field contains an array of child table records
                            if (Array.isArray(r.message.custom_tag) && r.message.custom_tag.length > 0) {
                                // Extract tag references from child table records
                                const tags = r.message.custom_tag.map(item => {
                                    // Based on debug output, the correct field is 'tags'
                                    // Priority order: tags, tag, mail_tag, tag_name, multiple_tag
                                    return item.tags || item.tag || item.mail_tag || item.tag_name || item.multiple_tag;
                                }).filter(tag => tag); // Remove any undefined/null values
                                
                                console.log("Extracted tags from Communication document:", tags);
                                resolve(tags);
                            } else {
                                console.log("custom_tag field is empty or not an array for:", communicationName);
                                resolve([]);
                            }
                        } else {
                            console.log("No custom_tag field found in Communication:", communicationName);
                            resolve([]);
                        }
                    },
                    error: function(err) {
                        console.error("Error fetching Communication document:", err);
                        resolve([]);
                    }
                });
            } catch (error) {
                console.error("Error in getCommunicationTags:", error);
                resolve([]);
            }
        });
    }

    // Helper function to get all communications with their tags
    function getCommunicationsWithTags(communications) {
        return Promise.all(communications.map(async (comm) => {
            try {
                const tags = await getCommunicationTags(comm.name);
                return { ...comm, tags: tags };
            } catch (error) {
                console.error("Error getting tags for communication:", comm.name, error);
                return { ...comm, tags: [] };
            }
        }));
    }

    function fetchCommunications() {
        const loadingIndicator = root_element.querySelector('#loading-indicator');
        const inboxList = root_element.querySelector('#inbox-list');
        const noRecords = root_element.querySelector('#no-records');

        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (inboxList) inboxList.innerHTML = '';
        if (noRecords) noRecords.style.display = 'none';

        // Prepare filters based on the selected options
        let filters = {
            "communication_type": "Communication",
            "communication_medium": "Email"
        };

        // Apply view filter
        if (currentFilter === "assigned_to_me") {
            filters["_assign"] = ["like", "%" + frappe.session.user + "%"];
        } else if (currentFilter === "unread") {
            filters["read_by_recipient"] = 0;
        } else if (currentFilter === "read") {
            filters["read_by_recipient"] = 1;
        } else if (currentFilter === "my_emails") {
            // For "My Email Accounts" view, we need to filter by the user's email accounts
            if (selectedEmailAccount !== "all") {
                // If specific account selected
                filters["email_account"] = selectedEmailAccount;
            } else if (userEmails && userEmails.length > 0) {
                // If "All Email Accounts" selected, filter by all user's email accounts
                // Use "in" operator which is supported by Frappe
                // Get all email account names from the dropdown
                const emailAccountSelect = root_element.querySelector('#email-account-filter');
                if (emailAccountSelect && emailAccountSelect.options.length > 1) {
                    const accountNames = [];
                    // Skip the first "All Email Accounts" option
                    for (let i = 1; i < emailAccountSelect.options.length; i++) {
                        accountNames.push(emailAccountSelect.options[i].value);
                    }
                    if (accountNames.length > 0) {
                        filters["email_account"] = ["in", accountNames];
                    }
                }
            }
        }
        // For "all" view, we don't add any additional filters - rely on permissions

        // Apply sent/received filter
        if (sentReceivedFilter !== "all") {
            filters["sent_or_received"] = sentReceivedFilter;
        }

        // Apply status filter
        if (statusFilter !== "all") {
            filters["status"] = statusFilter;
        }

        // Use standard pagination for better performance
        let fetchLimit = pageSize;
        let fetchStart = (currentPage - 1) * pageSize;

        // Check if we need special handling for tag filtering or search
        const needsTagProcessing = (selectedMailTag !== "all") || (searchTerm && searchTerm.length > 0);

        if (needsTagProcessing) {
            // Use a custom method that handles tag filtering server-side for better performance
            frappe.call({
                method: "svg_mobile_app.api.get_communications_with_tags",
                args: {
                    filters: filters,
                    tag_filter: selectedMailTag !== "all" ? selectedMailTag : null,
                    search_term: searchTerm || null,
                    limit_start: fetchStart,
                    limit_page_length: fetchLimit,
                    order_by: 'creation desc'
                },
                callback: function(response) {
                    if (loadingIndicator) loadingIndicator.style.display = 'none';

                    if (response.message && response.message.data && response.message.data.length > 0) {
                        totalRecords = response.message.total_count || 0;
                        renderCommunications(response.message.data);
                        updatePagination();
                    } else {
                        if (noRecords) noRecords.style.display = 'block';
                        totalRecords = 0;
                        updatePagination();
                    }
                },
                error: function(err) {
                    console.error("Error fetching communications with tags:", err);
                    // Fall back to standard method
                    fetchCommunicationsStandard(filters, fetchStart, fetchLimit);
                }
            });
        } else {
            // Use standard method for better performance when no tag processing needed
            fetchCommunicationsStandard(filters, fetchStart, fetchLimit);
        }
    }

    // Standard communication fetching without tag processing
    function fetchCommunicationsStandard(filters, fetchStart, fetchLimit) {
        const loadingIndicator = root_element.querySelector('#loading-indicator');
        const noRecords = root_element.querySelector('#no-records');

        frappe.call({
            method: 'frappe.client.get_list',
            args: {
                doctype: 'Communication',
                fields: [
                    'name', 'subject', 'sender', 'sender_full_name', 'recipients',
                    'creation', 'content', 'read_by_recipient', 'has_attachment',
                    'reference_doctype', 'reference_name', 'sent_or_received',
                    'status', 'email_account'
                ],
                filters: filters,
                order_by: 'creation desc',
                limit_start: fetchStart,
                limit_page_length: fetchLimit
            },
            callback: function(response) {
                if (loadingIndicator) loadingIndicator.style.display = 'none';

                if (response.message && response.message.length > 0) {
                    renderCommunications(response.message);

                    // Get total count for pagination
                    frappe.call({
                        method: 'frappe.client.get_count',
                        args: {
                            doctype: 'Communication',
                            filters: filters
                        },
                        callback: function(count_response) {
                            totalRecords = count_response.message || 0;
                            updatePagination();
                        }
                    });
                } else {
                    if (noRecords) noRecords.style.display = 'block';
                    totalRecords = 0;
                    updatePagination();
                }
            },
            error: function(err) {
                console.error("Error fetching communications:", err);
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                if (noRecords) {
                    noRecords.textContent = 'Error loading communications';
                    noRecords.style.display = 'block';
                }
            }
        });
    }

    function renderCommunications(communications) {
        const inboxList = root_element.querySelector('#inbox-list');
        if (!inboxList) return;

        inboxList.innerHTML = '';

        communications.forEach(function(comm) {
            const row = document.createElement('div');
            row.className = 'inbox-item' + (comm.read_by_recipient ? '' : ' unread');
            row.setAttribute('data-name', comm.name);

            // Format the date
            const creationDate = frappe.datetime.str_to_user(comm.creation);
            const displayDate = frappe.datetime.comment_when(comm.creation);

            // Get status indicator
            const statusIndicator = getStatusIndicator(comm.status);

            // Initially show empty tag display, will be loaded asynchronously
            let tagDisplay = '<span class="loading-tags">Loading tags...</span>';

            // Apply search highlighting to subject
            const highlightedSubject = highlightSearchTerm(comm.subject || 'No Subject', searchTerm);

            // Check if this email is from one of the user's email accounts
            let emailIndicator = '';
            if (comm.email_account) {
                // If a specific account is selected, highlight emails from that account
                if (selectedEmailAccount !== "all" && comm.email_account === selectedEmailAccount) {
                    emailIndicator = '<span class="label label-info" style="margin-left: 5px;">Selected Account</span>';
                }
                // Otherwise, just indicate it's from one of the user's accounts
                else if (currentFilter === "my_emails") {
                    emailIndicator = '<span class="label label-default" style="margin-left: 5px;">My Account</span>';
                }
            }

            // Create the row content
            row.innerHTML = `
                <div class="row">
                    <div class="col-sm-4">
                        <div class="inbox-item-subject" title="${comm.subject || 'No Subject'}">
                            ${statusIndicator}
                            ${highlightedSubject}
                            ${comm.sent_or_received === 'Sent' ? '<span class="text-muted">(Sent)</span>' : ''}
                        </div>
                    </div>
                    <div class="col-sm-3">
                        <div class="inbox-item-sender" title="${comm.sender_full_name || comm.sender}">
                            ${comm.sender_full_name || comm.sender}
                            ${emailIndicator}
                        </div>
                    </div>
                    <div class="col-sm-2">
                        <div class="inbox-item-date" title="${creationDate}">
                            ${displayDate}
                        </div>
                    </div>
                    <div class="col-sm-2">
                        <div class="inbox-item-tag" data-comm-name="${comm.name}">
                            ${tagDisplay}
                        </div>
                    </div>
                    <div class="col-sm-1 text-center">
                        <button class="btn btn-xs btn-show-email inbox-action-btn" data-name="${comm.name}">
                            Show
                        </button>
                    </div>
                </div>
            `;

            inboxList.appendChild(row);

            // Load tags asynchronously for this communication
            loadTagsForCommunication(comm.name, row.querySelector('.inbox-item-tag'));

            // Add click handler for the "Show" button
            const showBtn = row.querySelector('.btn-show-email');
            if (showBtn) {
                showBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    const docname = this.getAttribute('data-name');
                    showEmailPopup(docname);
                });
            }

            // Make the entire row clickable to navigate to the communication
            row.addEventListener('click', function() {
                const docname = this.getAttribute('data-name');
                frappe.set_route('Form', 'Communication', docname);
            });
        });
    }

    // Helper function to load tags for a specific communication
    function loadTagsForCommunication(commName, tagElement) {
        getCommunicationTags(commName).then(tags => {
            if (tags && tags.length > 0) {
                const tagLabels = tags.map(tagName => {
                    const tag = mailTags.find(t => t.name === tagName);
                    const displayName = tag ? tag.tag_name || tagName : tagName;
                    const highlightedName = highlightSearchTerm(displayName, searchTerm);
                    return `<span class="label">${highlightedName}</span>`;
                });
                tagElement.innerHTML = tagLabels.join(' ');
            } else {
                tagElement.innerHTML = '';
            }
        }).catch(error => {
            console.error('Error loading tags for communication:', commName, error);
            tagElement.innerHTML = '';
        });
    }

    function getStatusIndicator(status) {
        if (!status) return '';
        return `<span class="status-indicator status-${status}" title="${status}"></span>`;
    }

    function showEmailPopup(docname) {
        frappe.call({
            method: 'frappe.client.get',
            args: {
                doctype: 'Communication',
                name: docname,
                fields: [
                    "name", "subject", "sender", "sender_full_name", "recipients",
                    "creation", "content", "read_by_recipient", "has_attachment",
                    "reference_doctype", "reference_name", "sent_or_received",
                    "status", "email_account"
                ]
            },
            callback: async function(response) {
                if (response.message) {
                    const doc = response.message;

                    // Get tags for this communication
                    const tags = await getCommunicationTags(doc.name);

                    // Create dialog
                    const dialog = new frappe.ui.Dialog({
                        title: __("Email: {0}", [doc.subject || "No Subject"]),
                        size: 'large',
                        fields: [
                            {
                                fieldtype: "HTML",
                                fieldname: "email_content"
                            }
                        ]
                    });

                    // Get the template and populate it
                    const template = root_element.querySelector('#email-popup-template');
                    if (template) {
                        const content = template.cloneNode(true);
                        content.style.display = 'block';

                        // Set email details
                        content.querySelector('.email-subject').textContent = doc.subject || "No Subject";
                        content.querySelector('.email-from').textContent = doc.sender_full_name || doc.sender || "Unknown";
                        content.querySelector('.email-to').textContent = doc.recipients || "Unknown";
                        content.querySelector('.email-date').textContent = frappe.datetime.str_to_user(doc.creation);
                        content.querySelector('.email-status').textContent = doc.status || "Not Set";
                        content.querySelector('.email-direction').textContent = doc.sent_or_received || "Unknown";
                        content.querySelector('.email-account').textContent = doc.email_account || "Not Specified";

                        // Add tag information (now handling multiple tags from Table MultiSelect)
                        if (tags && tags.length > 0) {
                            const tagNames = tags.map(tagName => {
                                const tag = mailTags.find(t => t.name === tagName);
                                return tag ? tag.tag_name || tagName : tagName;
                            });

                            // Add tags to meta section
                            const metaDiv = content.querySelector('.email-meta');
                            const tagDiv = document.createElement('div');
                            tagDiv.innerHTML = `<strong>Tags:</strong> <span class="email-tags">${tagNames.map(name => `<span class="label">${name}</span>`).join(' ')}</span>`;
                            metaDiv.appendChild(tagDiv);
                        }

                        content.querySelector('.email-body').innerHTML = doc.content || "No content available";

                        // Handle attachments
                        const attachmentsList = content.querySelector('.attachments-list');
                        if (attachmentsList) {
                            if (doc.has_attachment) {
                                // Fetch attachments
                                frappe.call({
                                    method: 'frappe.client.get_list',
                                    args: {
                                        doctype: 'File',
                                        fields: ['file_name', 'file_url'],
                                        filters: {
                                            'attached_to_doctype': 'Communication',
                                            'attached_to_name': doc.name
                                        }
                                    },
                                    callback: function(files_response) {
                                        if (files_response.message && files_response.message.length > 0) {
                                            files_response.message.forEach(function(file) {
                                                const attachmentItem = document.createElement('a');
                                                attachmentItem.className = 'attachment-item';
                                                attachmentItem.href = file.file_url;
                                                attachmentItem.target = '_blank';
                                                attachmentItem.innerHTML = `
                                                    <i class="fa fa-paperclip"></i>
                                                    ${file.file_name}
                                                `;
                                                attachmentsList.appendChild(attachmentItem);
                                            });
                                        } else {
                                            content.querySelector('.email-attachments').style.display = 'none';
                                        }
                                    }
                                });
                            } else {
                                content.querySelector('.email-attachments').style.display = 'none';
                            }
                        }

                        // Set dialog content
                        dialog.fields_dict.email_content.$wrapper.html(content);
                    }

                    // Show the dialog
                    dialog.show();

                    // Add buttons
                    dialog.set_secondary_action(__("Print"), function() {
                        let print_content = dialog.$wrapper.find('.email-popup-container').clone().get(0);
                        frappe.ui.print.report(print_content, doc.subject);
                    });

                    dialog.add_custom_action(__("Open Document"), function() {
                        dialog.hide();
                        frappe.set_route('Form', 'Communication', doc.name);
                    }, 'btn-primary');

                    // Mark as read if unread
                    if (!doc.read_by_recipient) {
                        frappe.call({
                            method: 'frappe.client.set_value',
                            args: {
                                doctype: 'Communication',
                                name: doc.name,
                                fieldname: 'read_by_recipient',
                                value: 1
                            },
                            callback: function() {
                                // Refresh the list after marking as read
                                fetchCommunications();
                            }
                        });
                    }
                }
            },
            error: function(err) {
                console.error("Error fetching communication:", err);
                frappe.msgprint(__("Could not load email details"));
            }
        });
    }

    function updatePagination() {
        const prevPageBtn = root_element.querySelector('#prev-page');
        const nextPageBtn = root_element.querySelector('#next-page');
        const showingRecords = root_element.querySelector('#showing-records');

        if (prevPageBtn) {
            prevPageBtn.disabled = currentPage <= 1;
        }

        if (nextPageBtn) {
            nextPageBtn.disabled = currentPage * pageSize >= totalRecords;
        }

        if (showingRecords) {
            const start = totalRecords === 0 ? 0 : ((currentPage - 1) * pageSize) + 1;
            const end = Math.min(currentPage * pageSize, totalRecords);
            showingRecords.textContent = `Showing ${start}-${end} of ${totalRecords} records`;
        }
    }

    // Helper function to highlight search terms
    function highlightSearchTerm(text, searchTerm) {
        if (!searchTerm || !text) return text;
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<span class="search-highlight">$1</span>');
    }

    // Function to open Frappe's email compose dialog
    function openComposeDialog() {
        // Get the selected email account if available
        let emailAccount = null;
        if (selectedEmailAccount !== "all") {
            emailAccount = selectedEmailAccount;
        }

        // Open Frappe's email dialog
        new frappe.views.CommunicationComposer({
            subject: '',
            recipients: '',
            attach_document_print: false,
            sender: emailAccount,
            is_email: true
        });
    }

})();
(function() {
    // Initialize variables
    let currentPage = 1;
    let pageSize = 10; // Make this dynamic instead of const
    let totalRecords = 0;
    let currentFilter = "my_emails";
    let sentReceivedFilter = "all";
    let statusFilter = "all";
    let selectedEmailAccount = "all";
    let selectedMailTag = "all";
    let selectedAssignedUser = ""; // New variable for assigned to user filter
    let userEmails = [];
    let mailTags = [];
    let searchTerm = "";
    let allEmailAccounts = []; // Store all email accounts with access types
    
    // Date filter variables
    let dateFilterType = "range"; // "range" or "single"
    let fromDate = "";
    let toDate = "";
    let singleDate = "";

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
        
        // Load users for assigned to filter
        loadUsers();
        
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

                // Disable "Assigned to" dropdown if "Assigned to Me" is selected
                const assignedToFilter = root_element.querySelector('#assigned-to-filter');
                if (assignedToFilter) {
                    if (currentFilter === "assigned_to_me") {
                        assignedToFilter.disabled = true;
                        assignedToFilter.value = ""; // Reset value
                        selectedAssignedUser = "";
                    } else {
                        assignedToFilter.disabled = false;
                    }
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

        const assignedToSelect = root_element.querySelector('#assigned-to-filter');
        if (assignedToSelect) {
            assignedToSelect.addEventListener('change', function() {
                selectedAssignedUser = this.value;
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

        // Date filter event handlers
        const dateFilterRadios = root_element.querySelectorAll('input[name="date-filter-type"]');
        dateFilterRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                dateFilterType = this.value;
                toggleDateControls();
                currentPage = 1;
                fetchCommunications();
            });
        });
        
        // Date input handlers
        const fromDateInput = root_element.querySelector('#from-date');
        const toDateInput = root_element.querySelector('#to-date');
        const singleDateInput = root_element.querySelector('#single-date');
        const clearDateBtn = root_element.querySelector('#clear-date-filter');
        
        if (fromDateInput) {
            fromDateInput.addEventListener('change', function() {
                fromDate = this.value;
                currentPage = 1;
                fetchCommunications();
            });
        }
        
        if (toDateInput) {
            toDateInput.addEventListener('change', function() {
                toDate = this.value;
                currentPage = 1;
                fetchCommunications();
            });
        }
        
        if (singleDateInput) {
            singleDateInput.addEventListener('change', function() {
                singleDate = this.value;
                currentPage = 1;
                fetchCommunications();
            });
        }
        
        if (clearDateBtn) {
            clearDateBtn.addEventListener('click', function() {
                // Clear all date inputs
                if (fromDateInput) fromDateInput.value = '';
                if (toDateInput) toDateInput.value = '';
                if (singleDateInput) singleDateInput.value = '';
                
                // Clear date variables
                fromDate = '';
                toDate = '';
                singleDate = '';
                
                currentPage = 1;
                fetchCommunications();
            });
        }
        
        // Page size selection handlers
        const pageSizeButtons = root_element.querySelectorAll('.btn-page-size');
        pageSizeButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                // Remove active class from all buttons
                pageSizeButtons.forEach(b => b.classList.remove('active'));
                // Add active class to clicked button
                this.classList.add('active');
                
                // Update page size and reset to first page
                pageSize = parseInt(this.getAttribute('data-size'));
                currentPage = 1;
                fetchCommunications();
            });
        });

        // After DOM is ready
        // Make sure email accounts dropdown is visible
        if (emailAccountsRow) {
            emailAccountsRow.style.display = "block";
        }

        // Initial data fetch will be called after loading user emails
    }

    function toggleDateControls() {
        const fromDateControl = root_element.querySelector('#from-date-control');
        const toDateControl = root_element.querySelector('#to-date-control');
        const singleDateControl = root_element.querySelector('#single-date-control');
        const clearDateControl = root_element.querySelector('#clear-date-control');
        
        if (dateFilterType === "range") {
            if (fromDateControl) fromDateControl.style.display = "block";
            if (toDateControl) toDateControl.style.display = "block";
            if (singleDateControl) singleDateControl.style.display = "none";
        } else {
            if (fromDateControl) fromDateControl.style.display = "none";
            if (toDateControl) toDateControl.style.display = "none";
            if (singleDateControl) singleDateControl.style.display = "block";
        }
        
        // Always show clear button
        if (clearDateControl) clearDateControl.style.display = "block";
    }

    function hasDateFilters() {
        return (dateFilterType === "range" && (fromDate || toDate)) || 
               (dateFilterType === "single" && singleDate);
    }

    function loadUserEmails() {
        // Use custom API to get user's email accounts with simplified two-tier system
        frappe.call({
            method: "svg_mobile_app.api.get_user_profile_data",
            callback: function(r) {
                if (r.message && r.message.status === "success") {
                    const data = r.message.data;
                    
                    // Get all emails from unified User Email table (now includes access types)
                    const personalEmails = data.personal_emails || [];
                    const fallbackEmails = data.user_emails || [];
                    
                    // Combine all email accounts for the dropdown
                    const emailAccountsData = [];
                    
                    // Process all emails from unified User Email table
                    personalEmails.forEach(email => {
                        emailAccountsData.push({
                            name: email.account_name,
                            email_id: email.email_id,
                            type: email.type, // Now determined by access_type in API
                            access_type: email.access_type,
                            granted_by: email.granted_by,
                            granted_date: email.granted_date,
                            is_primary: email.is_primary,
                            description: email.description
                        });
                    });
                    
                    // If no emails found at all, fall back to user's main email
                    if (emailAccountsData.length === 0) {
                        emailAccountsData.push({
                            name: "user_email",
                            email_id: data.email || frappe.session.user_email,
                            type: "fallback",
                            description: "Main Email"
                        });
                    }
                    
                    // Store globally for access control
                    allEmailAccounts = emailAccountsData;
                    
                    // Use the email accounts
                    userEmails = allEmailAccounts.map(acc => acc.email_id);
                    populateEmailAccountsDropdown(allEmailAccounts);
                    fetchCommunications();
                } else {
                    console.error('API Error or unexpected response format:', r.message);
                    // Fall back to user's own email
                    userEmails = [frappe.session.user_email];
                    populateEmailAccountsDropdown([{
                        name: "user_email",
                        email_id: frappe.session.user_email,
                        type: "fallback",
                        description: "Main Email"
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
                    email_id: frappe.session.user_email,
                    type: "fallback",
                    description: "Main Email"
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

        // Group emails by access type
        const fullAccessEmails = emailAccounts.filter(acc => (acc.access_type || "Full Access") === "Full Access");
        const restrictedEmails = emailAccounts.filter(acc => acc.access_type && acc.access_type !== "Full Access");
        const fallbackEmails = emailAccounts.filter(acc => acc.type === "fallback");

        // Add full access emails section (Personal emails)
        if (fullAccessEmails.length > 0) {
            // Add section header
            const personalHeader = document.createElement('option');
            personalHeader.disabled = true;
            personalHeader.style.fontWeight = 'bold';
            personalHeader.style.backgroundColor = '#f8f9fa';
            personalHeader.textContent = '--- Personal Email Accounts ---';
            emailAccountSelect.appendChild(personalHeader);

            fullAccessEmails.forEach(function(account) {
                const option = document.createElement('option');
                option.value = account.name;
                let displayText = account.email_id;
                if (account.is_primary) {
                    displayText += " (Primary)";
                }
                displayText += " 🔓"; // Full access indicator
                option.textContent = displayText;
                emailAccountSelect.appendChild(option);
            });
        }

        // Add restricted access emails section (Work emails)
        if (restrictedEmails.length > 0) {
            // Add section header
            const workHeader = document.createElement('option');
            workHeader.disabled = true;
            workHeader.style.fontWeight = 'bold';
            workHeader.style.backgroundColor = '#f8f9fa';
            workHeader.textContent = '--- Work Email Access ---';
            emailAccountSelect.appendChild(workHeader);

            restrictedEmails.forEach(function(account) {
                const option = document.createElement('option');
                option.value = account.name;
                let displayText = account.email_id;
                if (account.access_type) {
                    displayText += " (" + account.access_type + ")";
                    
                    // Add visual indicator for access level
                    if (account.access_type === "Read Only") {
                        displayText += " 🔒";
                    } else if (account.access_type === "Read & Send") {
                        displayText += " ✉️";
                    }
                }
                if (account.description && account.description !== "Email Account") {
                    displayText += " - " + account.description;
                }
                option.textContent = displayText;
                emailAccountSelect.appendChild(option);
            });
        }

        // Add fallback emails
        if (fallbackEmails.length > 0) {
            fallbackEmails.forEach(function(account) {
                const option = document.createElement('option');
                option.value = account.name;
                option.textContent = account.email_id + " (" + account.description + ")";
                emailAccountSelect.appendChild(option);
            });
        }
    }

    function loadMailTags() {
        // Get mail tags from the Mail Tags doctype including color information
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Mail Tags",
                fields: ["name", "tag_name", "color"],
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

    function loadUsers() {
        // Get all users for the assigned to filter
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "User",
                fields: ["name", "full_name", "enabled"],
                filters: {
                    "enabled": 1
                },
                order_by: "full_name asc",
                limit_page_length: 1000
            },
            callback: function(r) {
                if (r.message && r.message.length > 0) {
                    populateAssignedToDropdown(r.message);
                }
            }
        });
    }

    function populateAssignedToDropdown(users) {
        const assignedToSelect = root_element.querySelector('#assigned-to-filter');
        if (!assignedToSelect) return;

        // Clear existing options except the first one
        while (assignedToSelect.options.length > 1) {
            assignedToSelect.remove(1);
        }

        // Add each user as an option
        users.forEach(function(user) {
            const option = document.createElement('option');
            option.value = user.name;
            option.textContent = user.full_name || user.name;
            assignedToSelect.appendChild(option);
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
                            resolve(customTagField.options);
                        } else {
                            resolve(null);
                        }
                    } else {
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
                            // The custom_tag field contains an array of child table records
                            if (Array.isArray(r.message.custom_tag) && r.message.custom_tag.length > 0) {
                                // Extract tag references from child table records
                                const tags = r.message.custom_tag.map(item => {
                                    // Based on debug output, the correct field is 'tags'
                                    // Priority order: tags, tag, mail_tag, tag_name, multiple_tag
                                    return item.tags || item.tag || item.mail_tag || item.tag_name || item.multiple_tag;
                                }).filter(tag => tag); // Remove any undefined/null values
                                
                                resolve(tags);
                            } else {
                                resolve([]);
                            }
                        } else {
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
        } else if (currentFilter === "bcc_cc_emails") {
            // Special handling for BCC/CC emails - force BCC enhanced fetching
            forceBCCEnhancedFetching(filters, fetchStart, fetchLimit);
            return;
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
        
        // Apply "Assigned To" filter independently, unless "Assigned to Me" is selected
        if (currentFilter !== "assigned_to_me" && selectedAssignedUser && selectedAssignedUser.trim() !== "") {
            filters["_assign"] = ["like", "%" + selectedAssignedUser + "%"];
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

        // Check if we need special handling for tag filtering, search, or date filtering
        const needsTagProcessing = (selectedMailTag !== "all") || (searchTerm && searchTerm.length > 0);
        const needsDateProcessing = hasDateFilters();

        if (needsTagProcessing || needsDateProcessing) {
            // Use a custom method that handles tag filtering server-side for better performance
            frappe.call({
                method: "svg_mobile_app.api.get_communications_with_tags",
                args: {
                    filters: filters,
                    tag_filter: selectedMailTag !== "all" ? selectedMailTag : null,
                    search_term: searchTerm || null,
                    limit_start: fetchStart,
                    limit_page_length: fetchLimit,
                    order_by: 'creation desc',
                    date_filter_type: dateFilterType,
                    from_date: fromDate || null,
                    to_date: toDate || null,
                    single_date: singleDate || null
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
            // Try BCC-enhanced email fetching first, then fallback to standard
            tryBCCEnhancedFetching(filters, fetchStart, fetchLimit);
        }
    }

    // Try to fetch BCC/CC enhanced emails first
    function tryBCCEnhancedFetching(filters, fetchStart, fetchLimit) {
        frappe.call({
            method: 'svg_mobile_app.email_genius.email_processor.get_processed_emails',
            args: {
                user: frappe.session.user,
                include_bcc: true,
                include_cc: true,
                limit: fetchLimit
            },
            callback: function(r) {
                if (r.message && r.message.length > 0) {
                    // Filter and process BCC-enhanced emails
                    let enhancedEmails = filterEnhancedEmails(r.message, filters);
                    if (enhancedEmails.length > 0) {
                        renderEnhancedCommunications(enhancedEmails);
                        totalRecords = enhancedEmails.length;
                        updatePagination();
                        return;
                    }
                }
                // Fallback to standard method
                fetchCommunicationsStandard(filters, fetchStart, fetchLimit);
            },
            error: function() {
                // Fallback to standard method on error
                fetchCommunicationsStandard(filters, fetchStart, fetchLimit);
            }
        });
    }

    // Force BCC/CC enhanced fetching for BCC/CC filter
    function forceBCCEnhancedFetching(filters, fetchStart, fetchLimit) {
        const loadingIndicator = root_element.querySelector('#loading-indicator');
        const inboxList = root_element.querySelector('#inbox-list');
        const noRecords = root_element.querySelector('#no-records');
        
        if (loadingIndicator) loadingIndicator.style.display = 'block';
        if (inboxList) inboxList.innerHTML = '';
        if (noRecords) noRecords.style.display = 'none';

        frappe.call({
            method: 'svg_mobile_app.email_genius.email_processor.get_processed_emails',
            args: {
                user: frappe.session.user,
                include_bcc: true,
                include_cc: true,
                limit: fetchLimit
            },
            callback: function(r) {
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                
                if (r.message && r.message.length > 0) {
                    // Filter to only show BCC/CC emails
                    let bccCcEmails = r.message.filter(email => 
                        email.recipient_type === 'BCC' || email.recipient_type === 'CC'
                    );
                    
                    // Apply additional filters
                    bccCcEmails = filterEnhancedEmails(bccCcEmails, filters);
                    
                    if (bccCcEmails.length > 0) {
                        renderEnhancedCommunications(bccCcEmails);
                        totalRecords = bccCcEmails.length;
                        updatePagination();
                    } else {
                        if (noRecords) {
                            noRecords.innerHTML = '<p>No BCC/CC emails found</p>';
                            noRecords.style.display = 'block';
                        }
                        totalRecords = 0;
                        updatePagination();
                    }
                } else {
                    if (noRecords) {
                        noRecords.innerHTML = '<p>No BCC/CC emails found</p>';
                        noRecords.style.display = 'block';
                    }
                    totalRecords = 0;
                    updatePagination();
                }
            },
            error: function(err) {
                console.error("Error fetching BCC/CC emails:", err);
                if (loadingIndicator) loadingIndicator.style.display = 'none';
                if (noRecords) {
                    noRecords.innerHTML = '<p>Error loading BCC/CC emails</p>';
                    noRecords.style.display = 'block';
                }
                totalRecords = 0;
                updatePagination();
            }
        });
    }

    // Filter enhanced emails based on current filters
    function filterEnhancedEmails(emails, filters) {
        return emails.filter(email => {
            // Apply sent/received filter
            if (filters.sent_or_received && email.sent_or_received !== filters.sent_or_received) {
                return false;
            }
            
            // Apply status filter
            if (filters.status && email.status !== filters.status) {
                return false;
            }
            
            // Apply search term filter
            if (searchTerm && searchTerm.length > 0) {
                const searchLower = searchTerm.toLowerCase();
                const subjectMatch = (email.subject || '').toLowerCase().includes(searchLower);
                const senderMatch = (email.sender || '').toLowerCase().includes(searchLower);
                const contentMatch = (email.content || '').toLowerCase().includes(searchLower);
                
                if (!subjectMatch && !senderMatch && !contentMatch) {
                    return false;
                }
            }
            
            return true;
        });
    }

    // Render enhanced communications with BCC/CC indicators
    function renderEnhancedCommunications(communications) {
        const loadingIndicator = root_element.querySelector('#loading-indicator');
        const inboxList = root_element.querySelector('#inbox-list');
        const noRecords = root_element.querySelector('#no-records');
        
        if (loadingIndicator) loadingIndicator.style.display = 'none';
        if (!inboxList) return;

        inboxList.innerHTML = '';

        if (communications.length === 0) {
            if (noRecords) noRecords.style.display = 'block';
            return;
        }

        communications.forEach(function(comm) {
            const row = document.createElement('div');
            row.className = 'inbox-item' + (comm.read_by_recipient ? '' : ' unread');
            row.setAttribute('data-name', comm.name);
            if (comm.recipient_type) {
                row.setAttribute('data-recipient-type', comm.recipient_type);
            }

            // Format the date
            const creationDate = frappe.datetime.str_to_user(comm.creation);
            const displayDate = frappe.datetime.comment_when(comm.creation);

            // Get status indicator
            const statusIndicator = getStatusIndicator(comm.status);

            // Create BCC/CC indicator
            let recipientTypeIndicator = '';
            if (comm.recipient_type === 'BCC') {
                recipientTypeIndicator = '<span class="label label-warning" style="margin-left: 5px;" title="You were BCC\'d on this email">BCC</span>';
            } else if (comm.recipient_type === 'CC') {
                recipientTypeIndicator = '<span class="label label-info" style="margin-left: 5px;" title="You were CC\'d on this email">CC</span>';
            }

            // Apply search highlighting to subject
            const highlightedSubject = highlightSearchTerm(comm.subject || 'No Subject', searchTerm);

            // Check if this email is from one of the user's email accounts
            let emailIndicator = '';
            if (comm.email_account) {
                if (selectedEmailAccount !== "all" && comm.email_account === selectedEmailAccount) {
                    emailIndicator = '<span class="label label-info" style="margin-left: 5px;">Selected Account</span>';
                }
            }

            row.innerHTML = `
                <div class="row inbox-row" onclick="showEmailPopup('${comm.name}')">
                    <div class="col-md-1 text-center">
                        <input type="checkbox" class="email-checkbox" data-name="${comm.name}">
                    </div>
                    <div class="col-md-3">
                        <strong>${comm.sender_full_name || comm.sender || 'Unknown Sender'}</strong>
                        ${recipientTypeIndicator}
                        ${emailIndicator}
                    </div>
                    <div class="col-md-4">
                        <span class="subject">${highlightedSubject}</span>
                        ${statusIndicator}
                        ${comm.has_attachment ? '<i class="fa fa-paperclip" title="Has Attachment"></i>' : ''}
                    </div>
                    <div class="col-md-2">
                        <span class="tag-display" data-comm-name="${comm.name}">Loading tags...</span>
                    </div>
                    <div class="col-md-2 text-right">
                        <small class="text-muted">${displayDate}</small>
                    </div>
                </div>
            `;

            inboxList.appendChild(row);

            // Load tags asynchronously for this communication
            const tagElement = row.querySelector('.tag-display');
            if (tagElement) {
                loadTagsForCommunication(comm.name, tagElement);
            }
        });
    }

    // Use standard method for better performance when no tag processing needed
    function fetchCommunicationsStandard(filters, fetchStart, fetchLimit) {
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
                    'status', 'email_account', 'custom_remark'
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
                    const tagColor = tag && tag.color ? tag.color : '#6c757d'; // Default gray color
                    const highlightedName = highlightSearchTerm(displayName, searchTerm);
                    return `<span class="label" style="background-color: ${tagColor}; color: white; border: 1px solid ${tagColor};">${highlightedName}</span>`;
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
                    "status", "email_account", "custom_remark"
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
                            const tagLabels = tags.map(tagName => {
                                const tag = mailTags.find(t => t.name === tagName);
                                const displayName = tag ? tag.tag_name || tagName : tagName;
                                const tagColor = tag && tag.color ? tag.color : '#6c757d'; // Default gray color
                                return `<span class="label" style="background-color: ${tagColor}; color: white; border: 1px solid ${tagColor};">${displayName}</span>`;
                            });

                            // Add tags to meta section
                            const metaDiv = content.querySelector('.email-meta');
                            const tagDiv = document.createElement('div');
                            tagDiv.innerHTML = `<strong>Tags:</strong> <span class="email-tags">${tagLabels.join(' ')}</span>`;
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

    // Function to open Frappe's email compose dialog with access control
    function openComposeDialog() {
        // Get the selected email account and check access level
        let emailAccount = null;
        let canSend = true;
        let accessMessage = "";
        
        if (selectedEmailAccount !== "all") {
            // Find the email account in our loaded data
            const selectedAccount = allEmailAccounts.find(acc => acc.name === selectedEmailAccount);
            
            if (selectedAccount) {
                if (selectedAccount.type === "work") {
                    // Check access level for work emails
                    if (selectedAccount.access_type === "Read Only") {
                        canSend = false;
                        accessMessage = `You only have "Read Only" access to ${selectedAccount.email_id}. Cannot compose emails from this account.`;
                    } else if (selectedAccount.access_type === "Read & Send" || selectedAccount.access_type === "Full Access") {
                        canSend = true;
                        emailAccount = selectedEmailAccount;
                    }
                } else if (selectedAccount.type === "personal" || selectedAccount.type === "fallback") {
                    // Personal emails and fallback always have full access
                    canSend = true;
                    emailAccount = selectedEmailAccount;
                }
            } else {
                // Account not found, allow but warn
                emailAccount = selectedEmailAccount;
                console.warn("Selected email account not found in loaded accounts");
            }
        } else {
            // "All" selected - use default behavior
            // Could default to primary personal email or let user choose
            const primaryPersonal = allEmailAccounts.find(acc => acc.type === "personal" && acc.is_primary);
            if (primaryPersonal) {
                emailAccount = primaryPersonal.name;
            }
        }

        // Show access control message if needed
        if (!canSend) {
            frappe.msgprint({
                title: "Access Restricted",
                message: accessMessage,
                indicator: "orange"
            });
            return;
        }

        // Open compose dialog if user has send permissions
        try {
            new frappe.views.CommunicationComposer({
                subject: '',
                recipients: '',
                attach_document_print: false,
                sender: emailAccount,
                is_email: true
            });
        } catch (error) {
            console.error("Error opening compose dialog:", error);
            frappe.msgprint("Error opening email composer. Please try again.");
        }
    }

})();
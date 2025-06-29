/**
 * Gmail BCC Auto-Forwarder for ERPNext BCC Processing System
 * 
 * This script monitors constr.sv@gmail.com for emails with [BCC-PROCESSED-*] subjects
 * and automatically forwards them to the actual CC/BCC recipients.
 * 
 * Setup Instructions:
 * 1. Go to script.google.com
 * 2. Create new project
 * 3. Paste this code
 * 4. Set up time-based trigger to run processBCCEmails() every 5 minutes
 * 5. Grant necessary Gmail permissions
 */

// Configuration
const CONFIG = {
  // Search query for both processed and unprocessed emails
  // Fixed: newer_than:2d (not 2h), simplified query structure
  SEARCH_QUERY: 'subject:"[BCC-PROCESSED-" OR (is:unread newer_than:2d -from:noreply -from:mailer-daemon)',
  
  // Backup simple query if the main one fails
  SIMPLE_SEARCH_QUERY: 'subject:"[BCC-PROCESSED-"',
  
  // Maximum emails to process per run (to avoid timeout)
  MAX_EMAILS_PER_RUN: 50,
  
  // Label to mark processed emails (optional)
  PROCESSED_LABEL: 'BCC-Forwarded',
  
  // Whether to delete emails after processing
  DELETE_AFTER_PROCESSING: true,
  
  // Log processing details
  ENABLE_LOGGING: true,
  
  // Dry run mode (doesn't actually send emails, just logs)
  DRY_RUN: false,
  
  // Process direct Gmail emails (not just ERPNext processed)
  PROCESS_DIRECT_EMAILS: true,
  
  // Skip emails from these domains (to avoid loops)
  SKIP_DOMAINS: ['noreply', 'mailer-daemon', 'postmaster'],
  
  // Test recipient configuration for emails without recipient info in body
  TEST_RECIPIENTS: {
    'TEST': 'constr.sv@gmail.com',  // Configure your actual test email here
    'BCC': null,   // Will be extracted from email body
    'CC': null,    // Will be extracted from email body  
    'TO': null     // Will be extracted from email body (but skipped)
  }
};

/**
 * Main function to process BCC emails
 * This should be set up as a time-based trigger
 */
function processBCCEmails() {
  try {
    log('Starting BCC email processing...');
    
    // Search for BCC processed emails - start with simple query for ERPNext emails
    let threads = GmailApp.search(CONFIG.SIMPLE_SEARCH_QUERY, 0, CONFIG.MAX_EMAILS_PER_RUN);
    
    // If simple query returns no results, try main query (which includes regular emails)
    if (threads.length === 0) {
      log('Simple search query returned no results, trying broader query...');
      threads = GmailApp.search(CONFIG.SEARCH_QUERY, 0, CONFIG.MAX_EMAILS_PER_RUN);
    } else {
      log(`Found ${threads.length} BCC-PROCESSED emails with simple query`);
    }
    
    if (threads.length === 0) {
      log('No BCC processed emails found with either search query');
      log(`Main query: ${CONFIG.SEARCH_QUERY}`);
      log(`Simple query: ${CONFIG.SIMPLE_SEARCH_QUERY}`);
      return;
    }
    
    log(`Found ${threads.length} threads to process`);
    
    let processedCount = 0;
    let errorCount = 0;
    
    // Process each thread
    threads.forEach((thread, threadIndex) => {
      try {
        const messages = thread.getMessages();
        
        messages.forEach((message, messageIndex) => {
          try {
            const result = processMessage(message);
            if (result.success) {
              processedCount++;
            } else {
              errorCount++;
              log(`Error processing message ${threadIndex}-${messageIndex}: ${result.error}`);
            }
          } catch (e) {
            errorCount++;
            log(`Exception processing message ${threadIndex}-${messageIndex}: ${e.toString()}`);
          }
        });
        
        // Mark thread as processed or delete
        if (CONFIG.DELETE_AFTER_PROCESSING) {
          thread.moveToTrash();
        } else {
          // Add processed label
          const label = getOrCreateLabel(CONFIG.PROCESSED_LABEL);
          thread.addLabel(label);
        }
        
      } catch (e) {
        errorCount++;
        log(`Exception processing thread ${threadIndex}: ${e.toString()}`);
      }
    });
    
    log(`Processing complete. Processed: ${processedCount}, Errors: ${errorCount}`);
    
  } catch (e) {
    log(`Fatal error in processBCCEmails: ${e.toString()}`);
  }
}

/**
 * Process individual message
 */
function processMessage(message) {
  try {
    const subject = message.getSubject() || 'No Subject';
    const body = message.getPlainBody() || '';
    const htmlBody = message.getBody() || '';
    const from = message.getFrom() || 'Unknown Sender';
    const date = message.getDate();
    
    log(`Processing message: ${subject}`);
    
    // Skip emails from certain domains to avoid loops
    if (shouldSkipEmail(from, subject)) {
      log(`Skipping email from ${from}: automated/system email`);
      return { success: true, error: 'Skipped automated email' };
    }
    
    // Parse the BCC processing info
    const processingInfo = parseBCCProcessingInfo(subject, body);
    
    log(`Processing info for "${subject}": ${JSON.stringify(processingInfo)}`);
    
    if (!processingInfo || !processingInfo.isValid) {
      log(`Invalid or unprocessable email: ${subject}`);
      log(`Processing info: ${JSON.stringify(processingInfo)}`);
      return { success: false, error: 'Invalid BCC processing format' };
    }
    
    // Handle ERPNext processed emails
    if (processingInfo.isERPNextProcessed) {
      log(`Processing ERPNext email - Recipient: ${processingInfo.actualRecipient}, Type: ${processingInfo.recipientType}`);
      return processERPNextEmail(processingInfo, body, htmlBody, from, message);
    } else {
      // Handle direct Gmail emails (future implementation)
      log(`Direct Gmail email processing not fully implemented yet: ${subject}`);
      return { success: false, error: 'Direct Gmail processing not implemented' };
    }
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Process ERPNext-processed emails
 */
function processERPNextEmail(processingInfo, body, htmlBody, from, message) {
  try {
    log(`processERPNextEmail called with processingInfo: ${JSON.stringify(processingInfo)}`);
    
    // Add null check for processingInfo
    if (!processingInfo) {
      log('Error: processingInfo is null or undefined in processERPNextEmail');
      return { success: false, error: 'processingInfo is null or undefined' };
    }
    
    // Skip TO recipients (they already got the original email)
    if (processingInfo.recipientType === 'TO') {
      log(`Skipping TO recipient: ${processingInfo.actualRecipient}`);
      return { success: true, error: 'Skipped TO recipient' };
    }
    
    // Validate recipient email
    if (!isValidEmail(processingInfo.actualRecipient)) {
      return { success: false, error: `Invalid recipient email: ${processingInfo.actualRecipient}` };
    }
    
    // Prepare the forwarded email
    const forwardedEmail = prepareForwardedEmail(processingInfo, body, htmlBody, from);
    
    // Check if email preparation failed
    if (!forwardedEmail) {
      log('Error: prepareForwardedEmail returned null or undefined');
      return { success: false, error: 'Failed to prepare forwarded email' };
    }
    
    log(`Prepared forwarded email: ${JSON.stringify(forwardedEmail)}`);
    
    // Send the email (unless in dry run mode)
    if (CONFIG.DRY_RUN) {
      log(`[DRY RUN] Would forward email to: ${processingInfo.actualRecipient}`);
      log(`[DRY RUN] Subject: ${forwardedEmail.subject}`);
      return { success: true, error: 'Dry run mode' };
    }
    
    // Actually send the email
    GmailApp.sendEmail(
      processingInfo.actualRecipient,
      forwardedEmail.subject,
      forwardedEmail.textBody,
      {
        htmlBody: forwardedEmail.htmlBody,
        replyTo: forwardedEmail.replyTo,
        attachments: message.getAttachments()
      }
    );
    
    log(`Successfully forwarded email to: ${processingInfo.actualRecipient}`);
    
    return { success: true, error: null };
    
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

/**
 * Check if email should be skipped
 */
function shouldSkipEmail(from, subject) {
  try {
    // Handle undefined parameters
    const emailFrom = from || '';
    const emailSubject = subject || '';
    
    // Skip emails from system domains
    const fromLower = emailFrom.toLowerCase();
    for (let domain of CONFIG.SKIP_DOMAINS) {
      if (fromLower.includes(domain)) {
        return true;
      }
    }
    
    // Skip auto-generated emails
    const subjectLower = emailSubject.toLowerCase();
    if (subjectLower.includes('auto-generated') || 
        subjectLower.includes('do not reply') ||
        subjectLower.includes('undelivered mail')) {
      return true;
    }
    
    return false;
    
  } catch (e) {
    log(`Error in shouldSkipEmail: ${e.toString()}`);
    return false;
  }
}

/**
 * Parse BCC processing information from email
 */
function parseBCCProcessingInfo(subject, body) {
  try {
    // Handle undefined subject and body
    const emailSubject = subject || '';
    const emailBody = body || '';
    
    // Check if this is an ERPNext processed email
    const typeMatch = emailSubject.match(/\[BCC-PROCESSED-([A-Z]+)\]/);
    
    if (typeMatch) {
      // This is an ERPNext processed email - use existing logic
      const recipientType = typeMatch[1]; // CC, BCC, TO, or any other type
      
      // Extract actual recipient from body - try multiple patterns
      let recipientMatch = emailBody.match(/- To: (.+@[^\s\n]+)/);
      if (!recipientMatch) {
        // Try alternative patterns
        recipientMatch = emailBody.match(/To: (.+@[^\s\n]+)/);
      }
      if (!recipientMatch) {
        // Try pattern with "Original Details:" section
        recipientMatch = emailBody.match(/Original Details:[\s\S]*?- To: (.+@[^\s\n]+)/);
      }
      
      // If no recipient found, check if we have a configured test recipient
      let actualRecipient;
      if (!recipientMatch) {
        log(`Could not find recipient in email body. Body preview: ${emailBody.substring(0, 200)}`);
        
        // Check if we have a configured recipient for this type
        if (CONFIG.TEST_RECIPIENTS[recipientType]) {
          actualRecipient = CONFIG.TEST_RECIPIENTS[recipientType];
          log(`Using configured test recipient for ${recipientType}: ${actualRecipient}`);
        } else {
          log(`No recipient found and no test recipient configured for type: ${recipientType}`);
          return { isValid: false };
        }
      } else {
        actualRecipient = recipientMatch[1].trim();
      }
      
      // Extract original sender
      const fromMatch = emailBody.match(/- From: (.+)/);
      const originalFrom = fromMatch ? fromMatch[1].trim() : 'Unknown Sender';
      
      // Extract original message ID
      const messageIdMatch = emailBody.match(/- Original Message-ID: (.+)/);
      const originalMessageId = messageIdMatch ? messageIdMatch[1].trim() : 'N/A';
      
      // Extract original subject (remove BCC-PROCESSED prefix)
      const cleanSubject = emailSubject.replace(/\[BCC-PROCESSED-[A-Z]+\]\s*/, '');
      
      return {
        isValid: true,
        recipientType: recipientType,
        actualRecipient: actualRecipient,
        originalFrom: originalFrom,
        originalMessageId: originalMessageId,
        cleanSubject: cleanSubject,
        isERPNextProcessed: true
      };
    } else if (CONFIG.PROCESS_DIRECT_EMAILS) {
      // This is a direct Gmail email - we need to detect CC/BCC from headers
      return parseDirectGmailEmail(emailSubject, emailBody);
    } else {
      return { isValid: false };
    }
    
  } catch (e) {
    log(`Error parsing BCC info: ${e.toString()}`);
    return { isValid: false };
  }
}

/**
 * Parse direct Gmail emails to detect CC/BCC recipients
 */
function parseDirectGmailEmail(subject, body) {
  try {
    // Handle undefined subject
    const emailSubject = subject || 'No Subject';
    log(`Direct Gmail email detected: ${emailSubject}`);
    
    // For direct Gmail emails, we need to check if this email was sent to constr.sv@gmail.com
    // as CC or BCC. Since Gmail doesn't show BCC headers, we'll assume it's BCC if no CC found
    
    // Handle undefined body
    const emailBody = body || '';
    
    // Look for CC recipients in the email headers/body
    const ccMatch = emailBody.match(/CC:\s*(.+)/i) || emailBody.match(/Cc:\s*(.+)/i);
    const toMatch = emailBody.match(/TO:\s*(.+)/i) || emailBody.match(/To:\s*(.+)/i);
    
    // Check if constr.sv@gmail.com is mentioned as CC
    const isCC = ccMatch && ccMatch[1].includes('constr.sv@gmail.com');
    const isTO = toMatch && toMatch[1].includes('constr.sv@gmail.com');
    
    let recipientType = 'BCC'; // Default assumption for direct emails
    if (isTO) {
      recipientType = 'TO';
    } else if (isCC) {
      recipientType = 'CC';
    }
    
    // For direct emails, we'll forward to a default recipient or skip
    // This is a simplified approach - you might want to configure specific recipients
    
    log(`Direct Gmail email classification: ${recipientType}`);
    log(`Note: Direct Gmail processing is simplified - ERPNext processing is preferred`);
    
    return {
      isValid: false, // Still disable until you configure specific recipients
      recipientType: recipientType,
      actualRecipient: null, // You need to configure who should receive these
      originalFrom: 'Direct Gmail',
      originalMessageId: 'N/A',
      cleanSubject: emailSubject,
      isERPNextProcessed: false,
      note: 'Direct Gmail processing needs recipient configuration'
    };
    
  } catch (e) {
    log(`Error parsing direct Gmail email: ${e.toString()}`);
    return { isValid: false };
  }
}

/**
 * Prepare the forwarded email content
 */
function prepareForwardedEmail(processingInfo, textBody, htmlBody, gmailFrom) {
  try {
    // Handle undefined processingInfo
    if (!processingInfo) {
      log('Error: processingInfo is undefined in prepareForwardedEmail');
      return null; // Return null to indicate failure
    }
    
    // Clean subject (remove BCC-PROCESSED prefix)
    const subject = processingInfo.cleanSubject || 'No Subject';
    
    // Extract original email content (after the metadata section)
    const contentSeparator = '--- Original Email Content Preview ---';
    const contentStart = textBody.indexOf(contentSeparator);
    
    let originalContent = '';
    if (contentStart !== -1) {
      originalContent = textBody.substring(contentStart + contentSeparator.length).trim();
    } else {
      // Fallback: use the entire body
      originalContent = textBody;
    }
    
    // Create forwarded text body
    const forwardedTextBody = `${originalContent}

---
This email was delivered via ERPNext BCC Processing System.
Original recipient type: ${processingInfo.recipientType}
Processed through: ${gmailFrom}`;
    
    // Create forwarded HTML body (if available)
    let forwardedHtmlBody = forwardedTextBody.replace(/\n/g, '<br>');
    if (htmlBody && htmlBody.length > textBody.length) {
      // If we have rich HTML content, try to extract it
      forwardedHtmlBody = htmlBody;
    }
    
    return {
      subject: subject,
      textBody: forwardedTextBody,
      htmlBody: forwardedHtmlBody,
      replyTo: processingInfo.originalFrom
    };
    
  } catch (e) {
    log(`Error preparing forwarded email: ${e.toString()}`);
    // Fallback to simple forwarding
    return {
      subject: processingInfo.cleanSubject || 'No Subject',
      textBody: textBody || '',
      htmlBody: htmlBody || '',
      replyTo: processingInfo.originalFrom || 'noreply@gmail.com'
    };
  }
}

/**
 * Validate email address format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get or create Gmail label
 */
function getOrCreateLabel(labelName) {
  try {
    // Try to get existing label
    const labels = GmailApp.getUserLabels();
    for (let label of labels) {
      if (label.getName() === labelName) {
        return label;
      }
    }
    
    // Create new label if not found
    return GmailApp.createLabel(labelName);
    
  } catch (e) {
    log(`Error with label ${labelName}: ${e.toString()}`);
    return null;
  }
}

/**
 * Logging function
 */
function log(message) {
  if (CONFIG.ENABLE_LOGGING) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
}

/**
 * Test function to verify the script works
 * Run this manually to test with existing emails
 */
function testBCCProcessing() {
  log('Running test BCC processing...');
  
  // First run debug to see what emails are available
  log('=== RUNNING DEBUG FIRST ===');
  debugEmailContents();
  
  log('=== NOW RUNNING ACTUAL PROCESSING ===');
  
  // Temporarily enable dry run for testing
  const originalDryRun = CONFIG.DRY_RUN;
  CONFIG.DRY_RUN = true;
  
  try {
    processBCCEmails();
  } finally {
    CONFIG.DRY_RUN = originalDryRun;
  }
  
  log('Test complete');
}

/**
 * Setup function to create the time-based trigger
 * Run this once to set up automatic processing
 */
function setupTrigger() {
  // Delete existing triggers for this function
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processBCCEmails') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create new trigger to run every 5 minutes
  ScriptApp.newTrigger('processBCCEmails')
    .timeBased()
    .everyMinutes(5)
    .create();
  
  log('Trigger created successfully - will run every 5 minutes');
}

/**
 * Manual processing function for specific emails
 * Useful for testing with the FINAL TEST emails
 */
function processSpecificEmails() {
  const searchQuery = 'subject:"[FINAL TEST] BCC Processing with Gmail"';
  const threads = GmailApp.search(searchQuery, 0, 10);
  
  log(`Found ${threads.length} FINAL TEST emails`);
  
  threads.forEach(thread => {
    const messages = thread.getMessages();
    messages.forEach(message => {
      const result = processMessage(message);
      log(`Processing result: ${JSON.stringify(result)}`);
    });
  });
}

/**
 * Create a test BCC processed email for testing
 * Run this to create a sample email that the script can process
 */
function createTestBCCEmail() {
  try {
    const testSubject = '[BCC-PROCESSED-BCC] Test Email for BCC Processing';
    const testBody = `This is a test email for BCC processing.

--- Original Email Details ---
- From: test@example.com
- To: recipient@example.com
- Original Message-ID: test-message-id-123
- Date: ${new Date().toISOString()}

--- Original Email Content Preview ---
This is the original email content that should be forwarded to the BCC recipient.

Test message body with some content to verify the forwarding works correctly.

Best regards,
Test Sender`;

    // Create a draft email (you can send it to yourself for testing)
    const draft = GmailApp.createDraft(
      'constr.sv@gmail.com', // Send to yourself for testing
      testSubject,
      testBody
    );
    
    log(`Created test draft email: ${draft.getId()}`);
    log('You can now send this draft to create a test BCC processed email');
    log('Or modify the recipient to test with a real email address');
    
    return draft;
    
  } catch (e) {
    log(`Error creating test email: ${e.toString()}`);
    return null;
  }
}

/**
 * Debug function to inspect email contents and search queries
 * Run this to see what's actually in the emails and test search queries
 */
function debugEmailContents() {
  try {
    log('=== DEBUG: Testing Search Queries ===');
    
    // Test different search queries
    const queries = [
      'subject:"[BCC-PROCESSED-"',
      'subject:"[BCC-PROCESSED-" OR (is:unread newer_than:2d -from:noreply -from:mailer-daemon)',
      'is:unread newer_than:2d',
      'newer_than:2d',
      '(is:unread newer_than:2d -from:noreply -from:mailer-daemon)'
    ];
    
    queries.forEach((query, index) => {
      try {
        const threads = GmailApp.search(query, 0, 5);
        log(`Query ${index + 1}: "${query}" - Found ${threads.length} threads`);
      } catch (e) {
        log(`Query ${index + 1}: "${query}" - ERROR: ${e.toString()}`);
      }
    });
    
    log('=== DEBUG: Inspecting Email Contents ===');
    
    // Search for BCC processed emails
    const threads = GmailApp.search('subject:"[BCC-PROCESSED-"', 0, 5);
    
    if (threads.length === 0) {
      log('No BCC-PROCESSED emails found. Trying broader search...');
      const allRecentThreads = GmailApp.search('newer_than:1d', 0, 10);
      log(`Found ${allRecentThreads.length} recent threads (last 1 day)`);
      
      allRecentThreads.slice(0, 3).forEach((thread, threadIndex) => {
        const messages = thread.getMessages();
        const firstMessage = messages[0];
        log(`Recent Thread ${threadIndex}: "${firstMessage.getSubject()}"`);
      });
    }
    
    threads.forEach((thread, threadIndex) => {
      const messages = thread.getMessages();
      
      messages.forEach((message, messageIndex) => {
        const subject = message.getSubject();
        const body = message.getPlainBody();
        const from = message.getFrom();
        
        log(`\n--- EMAIL ${threadIndex}-${messageIndex} ---`);
        log(`Subject: ${subject}`);
        log(`From: ${from}`);
        log(`Body Preview (first 500 chars):`);
        log(body.substring(0, 500));
        log(`Body contains "- To:": ${body.includes('- To:')}`);
        log(`Body contains "- From:": ${body.includes('- From:')}`);
        log(`Body contains "Original Details:": ${body.includes('Original Details:')}`);
        log('--- END EMAIL ---\n');
      });
    });
    
    log('=== DEBUG COMPLETE ===');
    
  } catch (e) {
    log(`Debug error: ${e.toString()}`);
  }
} 
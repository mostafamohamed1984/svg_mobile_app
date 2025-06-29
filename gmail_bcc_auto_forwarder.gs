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
  SEARCH_QUERY: 'subject:"[BCC-PROCESSED-" OR (is:unread newer_than:2h -from:noreply -from:mailer-daemon)',
  
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
  SKIP_DOMAINS: ['noreply', 'mailer-daemon', 'postmaster']
};

/**
 * Main function to process BCC emails
 * This should be set up as a time-based trigger
 */
function processBCCEmails() {
  try {
    log('Starting BCC email processing...');
    
    // Search for BCC processed emails
    const threads = GmailApp.search(CONFIG.SEARCH_QUERY, 0, CONFIG.MAX_EMAILS_PER_RUN);
    
    if (threads.length === 0) {
      log('No BCC processed emails found');
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
    const subject = message.getSubject();
    const body = message.getPlainBody();
    const htmlBody = message.getBody();
    const from = message.getFrom();
    const date = message.getDate();
    
    log(`Processing message: ${subject}`);
    
    // Skip emails from certain domains to avoid loops
    if (shouldSkipEmail(from, subject)) {
      log(`Skipping email from ${from}: automated/system email`);
      return { success: true, error: 'Skipped automated email' };
    }
    
    // Parse the BCC processing info
    const processingInfo = parseBCCProcessingInfo(subject, body);
    
    if (!processingInfo.isValid) {
      log(`Invalid or unprocessable email: ${subject}`);
      return { success: false, error: 'Invalid BCC processing format' };
    }
    
    // Handle ERPNext processed emails
    if (processingInfo.isERPNextProcessed) {
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
    // Skip emails from system domains
    const fromLower = from.toLowerCase();
    for (let domain of CONFIG.SKIP_DOMAINS) {
      if (fromLower.includes(domain)) {
        return true;
      }
    }
    
    // Skip auto-generated emails
    if (subject.toLowerCase().includes('auto-generated') || 
        subject.toLowerCase().includes('do not reply') ||
        subject.toLowerCase().includes('undelivered mail')) {
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
    // Check if this is an ERPNext processed email
    const typeMatch = subject.match(/\[BCC-PROCESSED-([A-Z]+)\]/);
    
    if (typeMatch) {
      // This is an ERPNext processed email - use existing logic
      const recipientType = typeMatch[1]; // CC, BCC, TO, or any other type
      
      // Extract actual recipient from body
      const recipientMatch = body.match(/- To: (.+@[^\s\n]+)/);
      if (!recipientMatch) {
        return { isValid: false };
      }
      
      const actualRecipient = recipientMatch[1].trim();
      
      // Extract original sender
      const fromMatch = body.match(/- From: (.+)/);
      const originalFrom = fromMatch ? fromMatch[1].trim() : 'Unknown Sender';
      
      // Extract original message ID
      const messageIdMatch = body.match(/- Original Message-ID: (.+)/);
      const originalMessageId = messageIdMatch ? messageIdMatch[1].trim() : 'N/A';
      
      // Extract original subject (remove BCC-PROCESSED prefix)
      const cleanSubject = subject.replace(/\[BCC-PROCESSED-[A-Z]+\]\s*/, '');
      
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
      return parseDirectGmailEmail(subject, body);
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
    log(`Direct Gmail email detected: ${subject}`);
    
    // For direct Gmail emails, we need to check if this email was sent to constr.sv@gmail.com
    // as CC or BCC. Since Gmail doesn't show BCC headers, we'll assume it's BCC if no CC found
    
    // Look for CC recipients in the email headers/body
    const ccMatch = body.match(/CC:\s*(.+)/i) || body.match(/Cc:\s*(.+)/i);
    const toMatch = body.match(/TO:\s*(.+)/i) || body.match(/To:\s*(.+)/i);
    
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
      cleanSubject: subject,
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
    // Clean subject (remove BCC-PROCESSED prefix)
    const subject = processingInfo.cleanSubject;
    
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
      subject: processingInfo.cleanSubject,
      textBody: textBody,
      htmlBody: htmlBody,
      replyTo: processingInfo.originalFrom
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
frappe.ui.form.on('Project Claim', {
    refresh: function(frm) {
        // Only proceed if document is in draft
        if (frm.doc.docstatus == 1) {
            // For Unreconciled status - State of Payment (orange)
            if (frm.doc.status == 'Unreconciled') {
                frm.add_custom_button(__('State of Payment'), function() {
                    frappe.utils.print(
                        frm.doctype,
                        frm.docname,
                        'بيان بالدفعات المستحقه',
                        frm.doc.letter_head,
                        "English"
                    );
                });
            }
            // For Reconciled status - show both buttons
            else if (frm.doc.status == 'Reconciled') {
                // Receipt Voucher PDF (blue)
                frm.add_custom_button(__('Receipt Voucher PDF'), function() {
                    // Get the original docname
                    var originalDocname = frm.docname;
                    // Create a modified version with RV- prefix
                    var rvDocname = originalDocname.replace('PC-', 'RV-');
                    
                    // Override the core print function temporarily
                    var originalPrintFn = frappe.utils.print;
                    frappe.utils.print = function(doctype, docname, print_format, letterhead, lang) {
                        var w = window.open(
                            frappe.urllib.get_full_url(
                                '/printview?doctype=' + encodeURIComponent(doctype) +
                                '&name=' + encodeURIComponent(docname) +
                                '&trigger_print=1' +
                                '&format=' + encodeURIComponent(print_format) +
                                '&no_letterhead=' + (letterhead ? '0' : '1') +
                                (lang ? '&_lang=' + lang : '')
                            ),
                            '_blank'
                        );
                        
                        if (w) {
                            w.addEventListener('load', function() {
                                try {
                                    w.document.title = rvDocname;
                                    var script = w.document.createElement('script');
                                    script.innerHTML = `
                                        // Override the PDF filename when saving
                                        if (window.frappe) {
                                            const originalFn = window.frappe.get_pdf;
                                            window.frappe.get_pdf = function(doctype, name, print_format, letterhead, opts) {
                                                if (!opts) opts = {};
                                                opts.filename = "${rvDocname}.pdf";
                                                return originalFn(doctype, name, print_format, letterhead, opts);
                                            };
                                        }
                                    `;
                                    w.document.head.appendChild(script);
                                } catch (e) {
                                    console.error("Error injecting script:", e);
                                }
                            });
                        }
                    };
                    
                    // Call print with the original document name
                    frappe.utils.print(
                        frm.doctype,
                        frm.docname,
                        'Project Receipt Voucher',
                        frm.doc.letter_head,
                        "English"
                    );
                    
                    // Restore the original print function
                    frappe.utils.print = originalPrintFn;
                });
                
                // Receipt Voucher Print
                frm.add_custom_button(__('Receipt Voucher Print'), function() {
                    frappe.utils.print(
                        frm.doctype,
                        frm.docname,
                        'Project Receipt Voucher For Printing',
                        frm.doc.letter_head,
                        "English"
                    );
                });
            }
        }
    }
});
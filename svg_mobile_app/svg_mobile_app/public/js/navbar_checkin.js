/**
 * Navbar Attendance Checkin/Checkout Button
 * Adds dynamic attendance functionality to the navbar
 */

$(document).ready(function() {
    console.log("🔧 Navbar Checkin: Script loaded");
    
    // Wait for navbar and bootinfo to load
    setTimeout(function() {
        console.log("🔧 Navbar Checkin: Checking bootinfo...");
        console.log("🔧 frappe.boot exists:", !!frappe.boot);
        console.log("🔧 attendance_status exists:", !!(frappe.boot && frappe.boot.attendance_status));
        
        if (frappe.boot && frappe.boot.attendance_status) {
            console.log("🔧 Navbar Checkin: Adding button...");
            addAttendanceButton();
        } else {
            console.log("❌ Navbar Checkin: No attendance status found");
            console.log("🔧 Available bootinfo keys:", frappe.boot ? Object.keys(frappe.boot) : "No bootinfo");
            
            // Try to get status manually
            tryManualStatusCheck();
        }
    }, 1500);
});

function addAttendanceButton() {
    // Check if user has attendance permissions
    if (!frappe.boot.attendance_status) {
        console.log("No attendance status found in bootinfo");
        return;
    }
    
    const attendanceData = frappe.boot.attendance_status;
    console.log("Attendance data:", attendanceData);
    
    // Remove existing button if present
    $('#navbar-attendance-btn').remove();
    
    // Create the attendance button HTML
    const buttonHtml = createAttendanceButtonHTML(attendanceData);
    
    // Find the right place to insert the button (before user dropdown)
    const targetElement = $('.navbar-nav.navbar-right .dropdown:has(.user-image)');
    
    if (targetElement.length > 0) {
        targetElement.before(buttonHtml);
    } else {
        // Fallback: add to the end of navbar-right
        $('.navbar-nav.navbar-right').append(buttonHtml);
    }
    
    // Bind click events
    bindAttendanceEvents();
}

function createAttendanceButtonHTML(attendanceData) {
    const currentStatus = attendanceData.current_status;
    const canCheckin = attendanceData.can_checkin;
    const canCheckout = attendanceData.can_checkout;
    const lastCheckin = attendanceData.last_checkin;
    
    // Determine button style based on status
    const statusClass = currentStatus === 'IN' ? 'text-success' : 'text-muted';
    const statusIcon = currentStatus === 'IN' ? 'fa-check-circle' : 'fa-circle-o';
    
    return `
        <li class="nav-item dropdown" id="navbar-attendance-btn">
            <a class="nav-link dropdown-toggle" href="#" role="button" 
               data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                <i class="fa fa-clock-o ${statusClass}"></i>
                <span class="hidden-xs"> Attendance</span>
                <small class="badge ${currentStatus === 'IN' ? 'badge-success' : 'badge-secondary'}">${currentStatus}</small>
            </a>
            <div class="dropdown-menu dropdown-menu-right" style="min-width: 250px;">
                <div class="dropdown-header">
                    <strong>${attendanceData.employee_name}</strong>
                    <br><small class="text-muted">Today: ${attendanceData.today}</small>
                    ${lastCheckin ? `<br><small>Last: ${lastCheckin.log_type} at ${lastCheckin.time}</small>` : ''}
                </div>
                <div class="dropdown-divider"></div>
                
                ${canCheckin ? 
                    `<a class="dropdown-item attendance-action" href="#" data-action="IN">
                        <i class="fa fa-sign-in text-success"></i> Check In
                    </a>` : 
                    `<a class="dropdown-item disabled">
                        <i class="fa fa-sign-in text-muted"></i> Already Checked In
                    </a>`
                }
                
                ${canCheckout ? 
                    `<a class="dropdown-item attendance-action" href="#" data-action="OUT">
                        <i class="fa fa-sign-out text-danger"></i> Check Out
                    </a>` : 
                    `<a class="dropdown-item disabled">
                        <i class="fa fa-sign-out text-muted"></i> Not Checked In
                    </a>`
                }
                
                <div class="dropdown-divider"></div>
                <a class="dropdown-item" href="/app/employee-checkin">
                    <i class="fa fa-list"></i> View History
                </a>
                <a class="dropdown-item" href="/app/employee-checkin/new-employee-checkin-1">
                    <i class="fa fa-plus"></i> Manual Entry
                </a>
            </div>
        </li>
    `;
}

function bindAttendanceEvents() {
    // Bind click events for checkin/checkout actions
    $(document).off('click', '.attendance-action').on('click', '.attendance-action', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const action = $(this).data('action');
        performCheckin(action);
        
        // Close dropdown
        $('.dropdown-menu').removeClass('show');
    });
}

function performCheckin(logType) {
    // Show loading state
    const button = $(`[data-action="${logType}"]`);
    const originalHtml = button.html();
    button.html('<i class="fa fa-spinner fa-spin"></i> Processing...');
    button.addClass('disabled');
    
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.navbar.create_checkin',
        args: {
            log_type: logType
        },
        callback: function(response) {
            button.html(originalHtml);
            button.removeClass('disabled');
            
            if (response.message && response.message.success) {
                // Show success message
                frappe.show_alert({
                    message: response.message.message,
                    indicator: 'green'
                }, 3);
                
                // Update button state
                setTimeout(function() {
                    refreshAttendanceButton();
                }, 1000);
                
            } else {
                // Show error message
                const errorMsg = response.message ? response.message.error : 'Unknown error occurred';
                frappe.show_alert({
                    message: 'Error: ' + errorMsg,
                    indicator: 'red'
                }, 5);
            }
        },
        error: function(error) {
            button.html(originalHtml);
            button.removeClass('disabled');
            
            frappe.show_alert({
                message: 'Network error: ' + (error.message || 'Please try again'),
                indicator: 'red'
            }, 5);
        }
    });
}

function refreshAttendanceButton() {
    // Get fresh attendance status and update button
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.navbar.get_attendance_status',
        callback: function(response) {
            if (response.message && !response.message.error) {
                // Update bootinfo with fresh data
                frappe.boot.attendance_status = response.message;
                
                // Recreate button with new data
                addAttendanceButton();
            }
        }
    });
}

// Alternative: Simple single-button approach (uncomment to use instead)
/*
function addSimpleAttendanceButton() {
    const attendanceData = frappe.boot.attendance_status;
    if (!attendanceData) return;
    
    const isCheckedIn = attendanceData.current_status === 'IN';
    const buttonClass = isCheckedIn ? 'btn-danger' : 'btn-success';
    const buttonText = isCheckedIn ? 'Check Out' : 'Check In';
    const logType = isCheckedIn ? 'OUT' : 'IN';
    const iconClass = isCheckedIn ? 'fa-sign-out' : 'fa-sign-in';
    
    const buttonHtml = `
        <li class="nav-item" id="navbar-attendance-btn">
            <button class="btn ${buttonClass} btn-sm navbar-btn" 
                    onclick="performCheckin('${logType}')" 
                    style="margin-right: 10px; margin-top: 8px;">
                <i class="fa ${iconClass}"></i> ${buttonText}
            </button>
        </li>
    `;
    
    $('.navbar-nav.navbar-right').prepend(buttonHtml);
}
*/

// Utility function to handle page navigation updates
$(document).on('page-change', function() {
    // Re-add button on page changes if needed
    setTimeout(function() {
        if (!$('#navbar-attendance-btn').length && frappe.boot && frappe.boot.attendance_status) {
            addAttendanceButton();
        }
    }, 500);
});

// Manual status check if bootinfo fails
function tryManualStatusCheck() {
    console.log("🔧 Trying manual status check...");
    
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.navbar.get_attendance_status',
        callback: function(response) {
            console.log("🔧 Manual status response:", response);
            
            if (response.message && !response.message.error) {
                console.log("✅ Manual status success, adding button...");
                
                // Manually set bootinfo and add button
                if (!frappe.boot.attendance_status) {
                    frappe.boot.attendance_status = response.message;
                }
                addAttendanceButton();
            } else {
                console.log("❌ Manual status failed:", response.message);
                showDebugInfo();
            }
        },
        error: function(error) {
            console.log("❌ Manual status error:", error);
            showDebugInfo();
        }
    });
}

// Show debug information
function showDebugInfo() {
    console.log("=== NAVBAR CHECKIN DEBUG INFO ===");
    console.log("Current user:", frappe.session.user);
    console.log("Navbar elements found:", $('.navbar-nav').length);
    console.log("Navbar-right found:", $('.navbar-nav.navbar-right').length);
    console.log("User dropdown found:", $('.navbar-nav.navbar-right .dropdown:has(.user-image)').length);
    console.log("All dropdowns:", $('.navbar-nav.navbar-right .dropdown').length);
    
    // Try to find employee record
    frappe.call({
        method: 'frappe.client.get_value',
        args: {
            doctype: 'Employee',
            filters: {'user_id': frappe.session.user},
            fieldname: ['name', 'employee_name', 'status']
        },
        callback: function(r) {
            console.log("Employee record:", r.message);
        }
    });
}

// Enhanced debug function
window.debugAttendance = function() {
    console.log("=== ATTENDANCE DEBUG ===");
    console.log("Attendance bootinfo:", frappe.boot.attendance_status);
    console.log("Button exists:", $('#navbar-attendance-btn').length > 0);
    console.log("frappe.boot keys:", Object.keys(frappe.boot));
    
    showDebugInfo();
    tryManualStatusCheck();
};
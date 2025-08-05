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
            console.log("❌ Navbar Checkin: No attendance status found, trying manual check...");
            tryManualStatusCheck();
        }
    }, 2000);
});

/**
 * Add attendance button to navbar
 */
function addAttendanceButton() {
    if ($('#navbar-attendance-btn').length > 0) {
        console.log("🔧 Button already exists, updating...");
        $('#navbar-attendance-btn').remove();
    }

    const attendanceData = frappe.boot.attendance_status;
    console.log("Attendance data:", attendanceData);

    // Create ERPNext-style button
    const buttonHtml = createERPNextStyleButton(attendanceData);
    
    // Try multiple positioning strategies to find the navbar
    const navbarSelectors = ['.navbar-home', '.navbar-brand', '.navbar-header', '.navbar'];
    let buttonAdded = false;

    for (const selector of navbarSelectors) {
        const $navbar = $(selector).first();
        if ($navbar.length > 0) {
            $navbar.after(`<div class="navbar-attendance-container">${buttonHtml}</div>`);
            buttonAdded = true;
            console.log(`✅ Navbar Checkin: Button added successfully using ${selector}`);
            break;
        }
    }

    if (!buttonAdded) {
        console.log("❌ Could not find suitable navbar element");
        return;
    }

    // Add click event listener
    $(document).on('click', '.attendance-main-btn', function(e) {
        e.preventDefault();
        const action = $(this).data('action');
        console.log("🔧 Performing attendance action:", action);
        
        if (action === 'checkin') {
            performCheckinWithLocation();
        } else if (action === 'checkout') {
            performAttendanceAction('checkout');
        }
    });
}

/**
 * Create ERPNext-style button HTML
 */
function createERPNextStyleButton(attendanceData) {
    const canCheckin = attendanceData.can_checkin;
    const canCheckout = attendanceData.can_checkout;
    const currentStatus = attendanceData.current_status || 'Unknown';
    
    let buttonClass, buttonText, buttonIcon, statusBadge, action;
    
    if (canCheckin) {
        buttonClass = 'btn-success';
        buttonText = 'Check In';
        buttonIcon = 'fa-sign-in';
        statusBadge = currentStatus;
        action = 'checkin';
    } else if (canCheckout) {
        buttonClass = 'btn-warning';
        buttonText = 'Check Out';
        buttonIcon = 'fa-sign-out';
        statusBadge = currentStatus;
        action = 'checkout';
    } else {
        buttonClass = 'btn-secondary';
        buttonText = 'Attendance';
        buttonIcon = 'fa-clock-o';
        statusBadge = currentStatus;
        action = 'view';
    }

    return `
        <button class="btn ${buttonClass} btn-sm attendance-main-btn navbar-btn" 
                data-action="${action}" 
                title="Current Status: ${currentStatus}">
            <i class="fa ${buttonIcon}"></i>
            <span class="hidden-xs">${buttonText}</span>
            <span class="attendance-status-badge badge badge-light">${statusBadge}</span>
        </button>
    `;
}

/**
 * Perform checkin with geolocation
 */
function performCheckinWithLocation() {
    const $button = $('.attendance-main-btn');
    $button.addClass('attendance-loading').prop('disabled', true);
    
    if (navigator.geolocation) {
        console.log("🔧 Requesting geolocation...");
        navigator.geolocation.getCurrentPosition(
            function(position) {
                console.log("🔧 Geolocation success:", position.coords);
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;
                performAttendanceAction('checkin', latitude, longitude);
            },
            function(error) {
                console.log("❌ Geolocation error:", error);
                frappe.show_alert({
                    message: 'Location access denied. Using default location.',
                    indicator: 'orange'
                });
                // Use default coordinates (Dubai)
                performAttendanceAction('checkin', 25.2048, 55.2708);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000
            }
        );
    } else {
        console.log("❌ Geolocation not supported");
        frappe.show_alert({
            message: 'Geolocation not supported. Using default location.',
            indicator: 'orange'
        });
        // Use default coordinates (Dubai)
        performAttendanceAction('checkin', 25.2048, 55.2708);
    }
}

/**
 * Perform attendance action (checkin/checkout)
 */
function performAttendanceAction(action, latitude, longitude) {
    const $button = $('.attendance-main-btn');
    $button.addClass('attendance-loading').prop('disabled', true);
    
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.navbar.perform_attendance_action',
        args: {
            action: action,
            latitude: latitude,
            longitude: longitude
        },
        callback: function(response) {
            $button.removeClass('attendance-loading').prop('disabled', false);
            
            if (response.message && response.message.success) {
                frappe.show_alert({
                    message: response.message.message || `${action} successful!`,
                    indicator: 'green'
                });
                
                // Refresh attendance status and update button
                setTimeout(function() {
                    tryManualStatusCheck();
                }, 1000);
            } else {
                frappe.show_alert({
                    message: response.message?.message || `${action} failed!`,
                    indicator: 'red'
                });
            }
        },
        error: function(error) {
            $button.removeClass('attendance-loading').prop('disabled', false);
            console.log("Attendance action error:", error);
            frappe.show_alert({
                message: `${action} failed! Please try again.`,
                indicator: 'red'
            });
        }
    });
}

/**
 * Try manual status check if bootinfo doesn't have attendance status
 */
function tryManualStatusCheck() {
    console.log("🔧 Trying manual status check...");
    
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.navbar.get_attendance_status',
        callback: function(response) {
            console.log("🔧 Manual status response:", response);
            
            if (response.message) {
                console.log("✅ Manual status success, adding button...");
                frappe.boot.attendance_status = response.message;
                addAttendanceButton();
            } else {
                console.log("❌ Manual status failed");
            }
        },
        error: function(error) {
            console.log("❌ Manual status error:", error);
        }
    });
}

// Debug function for troubleshooting
window.debugAttendance = function() {
    console.log("=== Attendance Debug Info ===");
    console.log("frappe.boot exists:", !!frappe.boot);
    console.log("attendance_status:", frappe.boot?.attendance_status);
    console.log("Button exists:", $('#navbar-attendance-btn').length > 0);
    console.log("Navbar elements found:", $('.navbar').length);
    console.log("Current user:", frappe.session.user);
    
    // Try to add button manually
    if (frappe.boot?.attendance_status) {
        addAttendanceButton();
    } else {
        tryManualStatusCheck();
    }
};

console.log("🔧 Navbar Checkin: Functions defined, debugAttendance() available");

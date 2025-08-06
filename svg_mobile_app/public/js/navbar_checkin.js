/**
 * Navbar Attendance Checkin/Checkout Button
 * Adds dynamic attendance functionality to the navbar
 */

$(document).ready(function() {
<<<<<<< HEAD
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
=======
    // Wait for navbar and bootinfo to load
    setTimeout(function() {
        if (frappe.boot && frappe.boot.attendance_status) {
            addAttendanceButton();
        } else {
>>>>>>> 0982247f4b3fc2c193dfd129c2e01e73b027e4c4
            tryManualStatusCheck();
        }
    }, 2000);
});

/**
 * Add attendance button to navbar
 */
function addAttendanceButton() {
<<<<<<< HEAD
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
=======
    const attendanceData = frappe.boot.attendance_status;

    // Remove existing button if present
    $('#navbar-attendance-btn').remove();

    // Create the attendance button HTML with ERPNext styling
    const buttonHtml = createERPNextStyleButton(attendanceData);

    // Try multiple positioning strategies based on ERPNext navbar structure
    let buttonAdded = false;

    // Strategy 1: Next to .navbar-home (ERPNext logo area)
    const navbarHome = $('.navbar-home');
    if (navbarHome.length > 0) {
        navbarHome.after(buttonHtml);
        buttonAdded = true;
    }
    // Strategy 2: After .navbar-brand
    else {
        const navbarBrand = $('.navbar-brand');
        if (navbarBrand.length > 0) {
            navbarBrand.after(buttonHtml);
            buttonAdded = true;
        }
    }

    // Strategy 3: Fallback to navbar-header
    if (!buttonAdded) {
        const navbarHeader = $('.navbar-header');
        if (navbarHeader.length > 0) {
            navbarHeader.append(buttonHtml);
            buttonAdded = true;
        }
    }

    // Strategy 4: Final fallback
    if (!buttonAdded) {
        const navbar = $('.navbar');
        if (navbar.length > 0) {
            navbar.prepend(buttonHtml);
            buttonAdded = true;
        }
    }

    if (buttonAdded) {
        setupEventListeners();
>>>>>>> 0982247f4b3fc2c193dfd129c2e01e73b027e4c4
    }

<<<<<<< HEAD
    if (!buttonAdded) {
        console.log("❌ Could not find suitable navbar element");
        return;
    }

    // Add click event listener
=======
function createERPNextStyleButton(attendanceData) {
    const isCheckedIn = !attendanceData.can_checkin;
    const buttonText = attendanceData.can_checkin ? 'Check In' : 'Check Out';
    const buttonClass = attendanceData.can_checkin ? 'btn-success' : 'btn-warning';
    const iconClass = attendanceData.can_checkin ? 'fa-sign-in' : 'fa-sign-out';
    const statusText = attendanceData.current_status === 'Not Checked In' ? 'OUT' : attendanceData.current_status;

    return `
        <div id="navbar-attendance-btn" class="navbar-attendance-container">
            <button class="btn ${buttonClass} btn-sm navbar-btn attendance-main-btn"
                    data-action="${attendanceData.can_checkin ? 'checkin' : 'checkout'}"
                    title="Current Status: ${statusText}">
                <i class="fa ${iconClass}"></i>
                <span class="hidden-xs attendance-btn-text">${buttonText}</span>
                <span class="badge attendance-status-badge">${statusText}</span>
            </button>
        </div>
    `;
}

function setupEventListeners() {
    // Remove any existing event listeners to prevent duplicates
    $(document).off('click', '.attendance-main-btn');

>>>>>>> 0982247f4b3fc2c193dfd129c2e01e73b027e4c4
    $(document).on('click', '.attendance-main-btn', function(e) {
        e.preventDefault();

        const $btn = $(this);

        // Prevent multiple clicks
        if ($btn.prop('disabled') || $btn.hasClass('processing')) {
            return;
        }

        const action = $(this).data('action');
<<<<<<< HEAD
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
    
=======

        // Add loading state to button
        const originalHtml = $btn.html();
        $btn.prop('disabled', true)
            .addClass('processing')
            .html('<i class="fa fa-spinner fa-spin"></i> Getting Location...');

        getLocationAndPerformCheckin(action, function() {
            // Reset button state
            $btn.prop('disabled', false)
                .removeClass('processing')
                .html(originalHtml);
        });
    });
}

function getLocationAndPerformCheckin(action, resetCallback) {
    if (!navigator.geolocation) {
        frappe.show_alert({
            message: 'Geolocation is not supported by this browser. Cannot proceed with attendance.',
            indicator: 'red'
        });
        if (resetCallback) resetCallback();
        return;
    }

    // Show loading message with instructions
    frappe.show_alert({
        message: 'Requesting location access... Please allow when prompted by your browser.',
        indicator: 'blue'
    });

    // Add a small delay to ensure the alert is visible before the permission popup
    setTimeout(() => {
        navigator.geolocation.getCurrentPosition(
        function(position) {
            performCheckin(action, position.coords.latitude, position.coords.longitude, resetCallback);
        },
        function(error) {

            let errorMessage = 'Unable to get your location. ';

            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += 'Location access was denied. Please enable location permissions and try again.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += 'Location information is unavailable. Please check your GPS/location settings.';
                    break;
                case error.TIMEOUT:
                    errorMessage += 'Location request timed out. Please try again.';
                    break;
                default:
                    errorMessage += 'An unknown error occurred while getting location.';
                    break;
            }

            frappe.show_alert({
                message: errorMessage,
                indicator: 'red'
            });

            if (resetCallback) resetCallback();
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,  // Increased timeout
            maximumAge: 300000  // Allow cached location up to 5 minutes
        }
        );
    }, 500); // 500ms delay before requesting location
}

function performCheckin(action, latitude, longitude, resetCallback) {

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
        frappe.show_alert({ message: 'Invalid location coordinates', indicator: 'red' });
        if (resetCallback) resetCallback();
        return;
    }

>>>>>>> 0982247f4b3fc2c193dfd129c2e01e73b027e4c4
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.navbar.perform_attendance_action',
        args: {
            action: action,
            latitude: latitude,
            longitude: longitude
        },
        callback: function(response) {
<<<<<<< HEAD
            $button.removeClass('attendance-loading').prop('disabled', false);
            
=======
            if (resetCallback) resetCallback();

>>>>>>> 0982247f4b3fc2c193dfd129c2e01e73b027e4c4
            if (response.message && response.message.success) {
                frappe.show_alert({
                    message: response.message.message || `${action} successful!`,
                    indicator: 'green'
                });
<<<<<<< HEAD
                
                // Refresh attendance status and update button
                setTimeout(function() {
                    tryManualStatusCheck();
=======

                // Update button state instead of reloading page
                setTimeout(() => {
                    refreshAttendanceStatus();
>>>>>>> 0982247f4b3fc2c193dfd129c2e01e73b027e4c4
                }, 1000);
            } else {
                const errorMsg = response.message ?
                    (response.message.message || response.message.error) :
                    'Failed to perform action';

                frappe.show_alert({
<<<<<<< HEAD
                    message: response.message?.message || `${action} failed!`,
=======
                    message: errorMsg,
>>>>>>> 0982247f4b3fc2c193dfd129c2e01e73b027e4c4
                    indicator: 'red'
                });
            }
        },
        error: function(error) {
<<<<<<< HEAD
            $button.removeClass('attendance-loading').prop('disabled', false);
            console.log("Attendance action error:", error);
            frappe.show_alert({
                message: `${action} failed! Please try again.`,
=======
            if (resetCallback) resetCallback();
            frappe.show_alert({
                message: 'Error: ' + (error.message || 'Unknown error'),
>>>>>>> 0982247f4b3fc2c193dfd129c2e01e73b027e4c4
                indicator: 'red'
            });
        }
    });
}

/**
 * Try manual status check if bootinfo doesn't have attendance status
 */
function tryManualStatusCheck() {
<<<<<<< HEAD
    console.log("🔧 Trying manual status check...");
    
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.navbar.get_attendance_status',
        callback: function(response) {
            console.log("🔧 Manual status response:", response);
            
            if (response.message) {
                console.log("✅ Manual status success, adding button...");
=======
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.navbar.get_attendance_status',
        callback: function(response) {
            if (response.message) {
>>>>>>> 0982247f4b3fc2c193dfd129c2e01e73b027e4c4
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

<<<<<<< HEAD
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
=======
/**
 * Refresh attendance status and update button
 */
function refreshAttendanceStatus() {
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.navbar.get_attendance_status',
        callback: function(response) {
            if (response.message) {
                frappe.boot.attendance_status = response.message;
                addAttendanceButton();
            }
        }
    });
}

// Test location permissions specifically
window.testLocation = function() {
    if (!navigator.geolocation) {
        return;
    }

    frappe.show_alert({
        message: 'Testing location access... Check for browser permission popup.',
        indicator: 'blue'
    });

    navigator.geolocation.getCurrentPosition(
        function(position) {
            frappe.show_alert({
                message: `Location: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
                indicator: 'green'
            });
        },
        function(error) {
            frappe.show_alert({
                message: `Location error: ${error.message}`,
                indicator: 'red'
            });
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000
        }
    );
};

window.debugAttendance = function() {
    // Try to add button manually
    if (frappe.boot?.attendance_status) {
        addAttendanceButton();
    } else {
        tryManualStatusCheck();
    }
};

// Navbar checkin functions loaded
>>>>>>> 0982247f4b3fc2c193dfd129c2e01e73b027e4c4

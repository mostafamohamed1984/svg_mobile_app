/**
 * Navbar Attendance Checkin/Checkout Button
 * Adds dynamic attendance functionality to the navbar
 */

$(document).ready(function() {
    // Wait for navbar and bootinfo to load
    setTimeout(function() {
        if (frappe.boot && frappe.boot.attendance_status) {
            addAttendanceButton();
        } else {
            tryManualStatusCheck();
        }
    }, 2000);
});

function addAttendanceButton() {
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
    }
}

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

    $(document).on('click', '.attendance-main-btn', function(e) {
        e.preventDefault();

        const $btn = $(this);

        // Prevent multiple clicks
        if ($btn.prop('disabled') || $btn.hasClass('processing')) {
            return;
        }

        const action = $(this).data('action');

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

    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.navbar.perform_attendance_action',
        args: {
            action: action,
            latitude: lat,
            longitude: lng
        },
        callback: function(response) {
            if (resetCallback) resetCallback();

            if (response.message && response.message.success) {
                frappe.show_alert({
                    message: response.message.message,
                    indicator: 'green'
                });

                // Update button state instead of reloading page
                setTimeout(() => {
                    refreshAttendanceStatus();
                }, 1000);
            } else {
                const errorMsg = response.message ?
                    (response.message.message || response.message.error) :
                    'Failed to perform action';

                frappe.show_alert({
                    message: errorMsg,
                    indicator: 'red'
                });
            }
        },
        error: function(error) {
            if (resetCallback) resetCallback();
            frappe.show_alert({
                message: 'Error: ' + (error.message || 'Unknown error'),
                indicator: 'red'
            });
        }
    });
}

function tryManualStatusCheck() {
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
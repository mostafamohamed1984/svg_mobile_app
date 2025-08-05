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

function addAttendanceButton() {
    const attendanceData = frappe.boot.attendance_status;
    console.log("Attendance data:", attendanceData);
    
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
        console.log("✅ Button added next to .navbar-home");
        buttonAdded = true;
    } 
    // Strategy 2: After .navbar-brand 
    else {
        const navbarBrand = $('.navbar-brand');
        if (navbarBrand.length > 0) {
            navbarBrand.after(buttonHtml);
            console.log("✅ Button added next to .navbar-brand");
            buttonAdded = true;
        }
    }
    
    // Strategy 3: Fallback to navbar-header
    if (!buttonAdded) {
        const navbarHeader = $('.navbar-header');
        if (navbarHeader.length > 0) {
            navbarHeader.append(buttonHtml);
            console.log("✅ Button added to .navbar-header");
            buttonAdded = true;
        }
    }
    
    // Strategy 4: Final fallback
    if (!buttonAdded) {
        const navbar = $('.navbar');
        if (navbar.length > 0) {
            navbar.prepend(buttonHtml);
            console.log("✅ Button added to .navbar (fallback)");
            buttonAdded = true;
        }
    }
    
    if (buttonAdded) {
        setupEventListeners();
    } else {
        console.log("❌ Could not find suitable container for button");
        console.log("Available navbar elements:", {
            'navbar-home': $('.navbar-home').length,
            'navbar-brand': $('.navbar-brand').length, 
            'navbar-header': $('.navbar-header').length,
            'navbar': $('.navbar').length
        });
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
            console.log("🔧 Button already processing, ignoring click");
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
    console.log("🔧 Getting location for action:", action);
    
    if (!navigator.geolocation) {
        console.log("❌ Geolocation not supported");
        frappe.show_alert({
            message: 'Geolocation is not supported by this browser. Cannot proceed with attendance.',
            indicator: 'red'
        });
        if (resetCallback) resetCallback();
        return;
    }
    
    console.log("🔧 Requesting geolocation...");
    
    // Show loading message with instructions
    frappe.show_alert({
        message: 'Requesting location access... Please allow when prompted by your browser.',
        indicator: 'blue'
    });
    
    // Add a small delay to ensure the alert is visible before the permission popup
    setTimeout(() => {
        navigator.geolocation.getCurrentPosition(
        function(position) {
            console.log("✅ Location success:", position.coords.latitude, position.coords.longitude);
            performCheckin(action, position.coords.latitude, position.coords.longitude, resetCallback);
        },
        function(error) {
            console.error("❌ Location error:", error);
            
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
    console.log("🔧 performCheckin called with:", action, latitude, longitude);
    
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
            console.error("❌ API Error:", error);
            frappe.show_alert({
                message: 'Error: ' + (error.message || 'Unknown error'),
                indicator: 'red'
            });
        }
    });
}

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

/**
 * Refresh attendance status and update button
 */
function refreshAttendanceStatus() {
    console.log("🔧 Refreshing attendance status...");
    
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.navbar.get_attendance_status',
        callback: function(response) {
            if (response.message) {
                console.log("✅ Status refreshed:", response.message);
                frappe.boot.attendance_status = response.message;
                addAttendanceButton();
            } else {
                console.log("❌ Failed to refresh status");
            }
        },
        error: function(error) {
            console.log("❌ Error refreshing status:", error);
        }
    });
}

// Test location permissions specifically
window.testLocation = function() {
    console.log("🔧 Testing location access...");
    
    if (!navigator.geolocation) {
        console.log("❌ Geolocation not supported");
        return;
    }
    
    frappe.show_alert({
        message: 'Testing location access... Check for browser permission popup.',
        indicator: 'blue'
    });
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            console.log("✅ Location test success:", position.coords);
            frappe.show_alert({
                message: `Location: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
                indicator: 'green'
            });
        },
        function(error) {
            console.error("❌ Location test error:", error);
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
    console.log("=== Attendance Debug Info ===");
    console.log("frappe.boot exists:", !!frappe.boot);
    console.log("attendance_status:", frappe.boot?.attendance_status);
    console.log("Button exists:", $('#navbar-attendance-btn').length > 0);
    console.log("Navbar elements found:", $('.navbar').length);
    console.log("Current user:", frappe.session.user);
    console.log("Geolocation supported:", !!navigator.geolocation);
    
    // Test location permissions
    if (navigator.permissions) {
        navigator.permissions.query({name: 'geolocation'}).then(function(result) {
            console.log("Location permission state:", result.state);
        });
    }
    
    // Try to add button manually
    if (frappe.boot?.attendance_status) {
        addAttendanceButton();
    } else {
        tryManualStatusCheck();
    }
};

console.log("🔧 Navbar Checkin: Functions defined, debugAttendance() available");

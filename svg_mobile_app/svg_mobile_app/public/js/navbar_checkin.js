/**
 * Navbar Attendance Checkin/Checkout Button - ERPNext Style
 */

$(document).ready(function() {
    console.log("🔧 Navbar Checkin: Script loaded");
    
    setTimeout(function() {
        console.log("🔧 Checking bootinfo...");
        if (frappe.boot && frappe.boot.attendance_status) {
            console.log("✅ Found attendance status, adding button");
            addAttendanceButton();
        } else {
            console.log("❌ No attendance status, trying manual check");
            tryManualStatusCheck();
        }
    }, 1500);
});

function addAttendanceButton() {
    if (!frappe.boot.attendance_status) return;
    
    const attendanceData = frappe.boot.attendance_status;
    console.log("Attendance data:", attendanceData);
    
    // Remove existing button if present
    $('#navbar-attendance-btn').remove();
    
    // Create the attendance button HTML with ERPNext styling
    const buttonHtml = createERPNextStyleButton(attendanceData);
    
    // Find the position next to the App Logo (after the navbar-brand)
    const navbarBrand = $('.navbar-brand');
    const targetContainer = navbarBrand.parent(); // Usually the navbar-header
    
    if (targetContainer.length > 0) {
        // Insert after the navbar-brand container
        navbarBrand.after(buttonHtml);
        console.log("✅ Button added next to App Logo");
        setupEventListeners();
    } else {
        // Fallback: try to find navbar-left or main navbar
        const fallbackContainer = $('.navbar-nav.navbar-left, .navbar-left, .navbar-header');
        if (fallbackContainer.length > 0) {
            fallbackContainer.append(buttonHtml);
            console.log("✅ Button added to fallback container");
            setupEventListeners();
        } else {
            console.log("❌ Could not find suitable container for button");
        }
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
    $(document).on('click', '.attendance-main-btn', function(e) {
        e.preventDefault();
        const action = $(this).data('action');
        
        // Add loading state to button
        const $btn = $(this);
        const originalHtml = $btn.html();
        $btn.prop('disabled', true).html('<i class="fa fa-spinner fa-spin"></i> Getting Location...');
        
        getLocationAndPerformCheckin(action, function() {
            // Reset button state
            $btn.prop('disabled', false).html(originalHtml);
        });
    });
}

function getLocationAndPerformCheckin(action, resetCallback) {
    console.log("🔧 Getting location for action:", action);
    
    if (!navigator.geolocation) {
        console.log("❌ Geolocation not supported");
        frappe.show_alert({
            message: 'Using default location (Geolocation not supported)',
            indicator: 'orange'
        });
        performCheckin(action, 25.276987, 55.296249, resetCallback);
        return;
    }
    
    console.log("🔧 Requesting geolocation...");
    
    navigator.geolocation.getCurrentPosition(
        function(position) {
            console.log("✅ Location success:", position.coords.latitude, position.coords.longitude);
            performCheckin(action, position.coords.latitude, position.coords.longitude, resetCallback);
        },
        function(error) {
            console.error("❌ Location error:", error);
            
            frappe.confirm(
                'Unable to get your location. Would you like to proceed with default location?',
                function() {
                    performCheckin(action, 25.276987, 55.296249, resetCallback);
                },
                function() {
                    frappe.show_alert({ message: 'Checkin cancelled', indicator: 'red' });
                    if (resetCallback) resetCallback();
                }
            );
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        }
    );
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
                setTimeout(() => location.reload(), 1500);
            } else {
                frappe.show_alert({
                    message: response.message ? response.message.error : 'Failed to perform action',
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
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.navbar.get_attendance_status',
        callback: function(response) {
            if (response.message && !response.message.error) {
                frappe.boot.attendance_status = response.message;
                addAttendanceButton();
            }
        }
    });
}

window.debugAttendance = function() {
    console.log("=== Debug Info ===");
    console.log("attendance_status:", frappe.boot.attendance_status);
    console.log("Button exists:", $('#navbar-attendance-btn').length > 0);
    console.log("Navbar brand:", $('.navbar-brand').length);
    tryManualStatusCheck();
};
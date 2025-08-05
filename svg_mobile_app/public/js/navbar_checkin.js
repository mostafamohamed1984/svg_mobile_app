/**
 * Navbar Attendance Checkin/Checkout Button with GPS Location
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
    
    $('#navbar-attendance-btn').remove();
    
    const buttonHtml = createAttendanceButtonHTML(attendanceData);
    const navbar = $('.navbar-nav.navbar-right, .navbar-nav:last-child');
    
    if (navbar.length > 0) {
        navbar.prepend(buttonHtml);
        console.log("✅ Button added successfully");
        setupEventListeners();
    } else {
        console.log("❌ Could not find navbar");
    }
}

function createAttendanceButtonHTML(attendanceData) {
    const statusClass = attendanceData.can_checkin ? 'success' : 'warning';
    const statusText = attendanceData.can_checkin ? 'Check In' : 'Check Out';
    const statusIcon = attendanceData.can_checkin ? 'fa-sign-in' : 'fa-sign-out';
    
    return `
        <li class="dropdown" id="navbar-attendance-btn">
            <a href="#" class="dropdown-toggle" data-toggle="dropdown">
                <i class="fa ${statusIcon}"></i>
                <span class="hidden-xs">${statusText}</span>
                <span class="badge badge-${statusClass}">${attendanceData.current_status}</span>
            </a>
            <ul class="dropdown-menu">
                <li class="dropdown-header">Attendance Status</li>
                <li><a href="#" class="attendance-action" data-action="checkin" ${!attendanceData.can_checkin ? 'style="display:none"' : ''}>
                    <i class="fa fa-sign-in"></i> Check In
                </a></li>
                <li><a href="#" class="attendance-action" data-action="checkout" ${!attendanceData.can_checkout ? 'style="display:none"' : ''}>
                    <i class="fa fa-sign-out"></i> Check Out
                </a></li>
                <li class="divider"></li>
                <li><a href="/app/employee-checkin"><i class="fa fa-list"></i> View History</a></li>
            </ul>
        </li>
    `;
}

function setupEventListeners() {
    $(document).on('click', '.attendance-action', function(e) {
        e.preventDefault();
        const action = $(this).data('action');
        
        // Show loading immediately
        frappe.show_alert({
            message: 'Getting your location...',
            indicator: 'blue'
        });
        
        getLocationAndPerformCheckin(action);
    });
}

function getLocationAndPerformCheckin(action) {
    console.log("🔧 Getting location for action:", action);
    
    // Check if geolocation is supported
    if (!navigator.geolocation) {
        console.log("❌ Geolocation not supported");
        frappe.show_alert({
            message: 'Geolocation is not supported by this browser. Using default location.',
            indicator: 'orange'
        });
        // Use default coordinates
        performCheckin(action, 25.276987, 55.296249); // Dubai coordinates as default
        return;
    }
    
    console.log("🔧 Requesting geolocation...");
    
    // Get current position with detailed options
    navigator.geolocation.getCurrentPosition(
        function(position) {
            console.log("✅ Location success:", position);
            console.log("✅ Coordinates:", position.coords.latitude, position.coords.longitude);
            
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            console.log("🔧 Calling performCheckin with:", lat, lng);
            performCheckin(action, lat, lng);
        },
        function(error) {
            console.error("❌ Location error:", error);
            console.log("Error code:", error.code);
            console.log("Error message:", error.message);
            
            let errorMessage = 'Location error: ';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += "Permission denied. Please allow location access and try again.";
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += "Position unavailable.";
                    break;
                case error.TIMEOUT:
                    errorMessage += "Request timeout.";
                    break;
                default:
                    errorMessage += "Unknown error occurred.";
                    break;
            }
            
            frappe.confirm(
                errorMessage + ' Would you like to proceed with default location?',
                function() {
                    // Use default coordinates (Dubai)
                    console.log("🔧 Using default coordinates");
                    performCheckin(action, 25.276987, 55.296249);
                },
                function() {
                    frappe.show_alert({
                        message: 'Checkin cancelled',
                        indicator: 'red'
                    });
                }
            );
        },
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 60000
        }
    );
}

function performCheckin(action, latitude, longitude) {
    console.log("🔧 performCheckin called with:");
    console.log("  action:", action);
    console.log("  latitude:", latitude);
    console.log("  longitude:", longitude);
    console.log("  latitude type:", typeof latitude);
    console.log("  longitude type:", typeof longitude);
    
    // Ensure coordinates are numbers
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    console.log("🔧 Converted coordinates:");
    console.log("  lat:", lat);
    console.log("  lng:", lng);
    
    if (isNaN(lat) || isNaN(lng)) {
        console.error("❌ Invalid coordinates:", lat, lng);
        frappe.show_alert({
            message: 'Invalid location coordinates',
            indicator: 'red'
        });
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
            console.log("✅ API Response:", response);
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
            console.error("❌ API Error:", error);
            frappe.show_alert({
                message: 'Error performing checkin: ' + (error.message || 'Unknown error'),
                indicator: 'red'
            });
        }
    });
}

function tryManualStatusCheck() {
    console.log("🔧 Trying manual status check");
    frappe.call({
        method: 'svg_mobile_app.svg_mobile_app.navbar.get_attendance_status',
        callback: function(response) {
            console.log("Manual status response:", response);
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
    console.log("Geolocation supported:", !!navigator.geolocation);
    
    // Test location
    if (navigator.geolocation) {
        console.log("Testing location...");
        navigator.geolocation.getCurrentPosition(
            function(pos) {
                console.log("Test location success:", pos.coords.latitude, pos.coords.longitude);
            },
            function(err) {
                console.log("Test location error:", err);
            }
        );
    }
    
    tryManualStatusCheck();
};

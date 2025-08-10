/**
 * Navbar Attendance Checkin/Checkout Button
 * Adds dynamic attendance functionality to the navbar with a settings-driven toggle
 */

$(document).ready(function() {
  // Delay slightly to allow frappe.boot to be available
  setTimeout(function() {
    const boot = frappe.boot || {};
    const feature = boot.svg_navbar_checkin || {};

    // Feature toggle and role gating from bootinfo
    if (!feature.enabled) return;
    const allowedRoles = Array.isArray(feature.allowed_roles) ? feature.allowed_roles : [];
    if (allowedRoles.length > 0) {
      const userRoles = (window.frappe && frappe.user_roles) ? frappe.user_roles : [];
      if (!allowedRoles.some(r => userRoles.includes(r))) return;
    }

    if (boot.attendance_status) {
      addAttendanceButton();
    } else {
      tryManualStatusCheck();
    }
  }, 1500);
});

/**
 * Add attendance button to navbar
 */
function addAttendanceButton() {
  const attendanceData = frappe.boot.attendance_status || {};

  // Remove existing button if present
  $('#navbar-attendance-btn').remove();

  const buttonHtml = createERPNextStyleButton(attendanceData);

  // Try multiple positioning strategies based on ERPNext navbar structure
  let buttonAdded = false;

  // Strategy 1: Next to .navbar-home (ERPNext logo area)
  const navbarHome = $('.navbar-home');
  if (navbarHome.length > 0) {
    navbarHome.after(buttonHtml);
    buttonAdded = true;
  } else {
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

/**
 * Create ERPNext-style button HTML
 */
function createERPNextStyleButton(attendanceData) {
  const canCheckin = !!attendanceData.can_checkin;
  const canCheckout = !!attendanceData.can_checkout;
  const currentStatus = attendanceData.current_status || 'Unknown';

  let buttonClass, buttonText, buttonIcon, action;
  if (canCheckin) {
    buttonClass = 'btn-success';
    buttonText = 'Check In';
    buttonIcon = 'fa-sign-in';
    action = 'checkin';
  } else if (canCheckout) {
    buttonClass = 'btn-warning';
    buttonText = 'Check Out';
    buttonIcon = 'fa-sign-out';
    action = 'checkout';
  } else {
    buttonClass = 'btn-secondary';
    buttonText = 'Attendance';
    buttonIcon = 'fa-clock-o';
    action = 'view';
  }

  return `
    <div id="navbar-attendance-btn" class="navbar-attendance-container">
      <button class="btn ${buttonClass} btn-sm navbar-btn attendance-main-btn"
              data-action="${action}"
              title="Current Status: ${currentStatus}">
        <i class="fa ${buttonIcon}"></i>
        <span class="hidden-xs attendance-btn-text">${buttonText}</span>
        <span class="badge attendance-status-badge">${currentStatus}</span>
      </button>
    </div>
  `;
}

function setupEventListeners() {
  // Prevent duplicate handlers
  $(document).off('click', '.attendance-main-btn');

  $(document).on('click', '.attendance-main-btn', function(e) {
    e.preventDefault();

    const $btn = $(this);
    if ($btn.prop('disabled') || $btn.hasClass('processing')) return;

    const action = $btn.data('action');
    if (action !== 'checkin' && action !== 'checkout') return;

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

  frappe.show_alert({
    message: 'Requesting location access... Please allow when prompted by your browser.',
    indicator: 'blue'
  });

  setTimeout(() => {
    navigator.geolocation.getCurrentPosition(
      function(position) {
        performCheckin(action, position.coords.latitude, position.coords.longitude, resetCallback);
      },
      function(error) {
        let errorMessage = 'Unable to get your location. ';
        switch (error.code) {
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
        frappe.show_alert({ message: errorMessage, indicator: 'red' });
        if (resetCallback) resetCallback();
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000
      }
    );
  }, 500);
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
    args: { action: action, latitude: lat, longitude: lng },
    callback: function(response) {
      if (resetCallback) resetCallback();

      if (response.message && response.message.success) {
        frappe.show_alert({
          message: response.message.message || `${action} successful!`,
          indicator: 'green'
        });
        setTimeout(() => { refreshAttendanceStatus(); }, 1000);
      } else {
        const errorMsg = response.message ? (response.message.message || response.message.error) : 'Failed to perform action';
        frappe.show_alert({ message: errorMsg, indicator: 'red' });
      }
    },
    error: function(error) {
      if (resetCallback) resetCallback();
      frappe.show_alert({ message: 'Error: ' + (error.message || 'Unknown error'), indicator: 'red' });
    }
  });
}

/**
 * Try manual status check if bootinfo doesn't have attendance status
 */
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

// Optional utilities for debugging
window.debugAttendance = function() {
  if (frappe.boot?.attendance_status) addAttendanceButton();
  else tryManualStatusCheck();
};

window.testLocation = function() {
  if (!navigator.geolocation) return;
  frappe.show_alert({ message: 'Testing location access... Check for browser permission popup.', indicator: 'blue' });
  navigator.geolocation.getCurrentPosition(
    function(position) {
      frappe.show_alert({
        message: `Location: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
        indicator: 'green'
      });
    },
    function(error) {
      frappe.show_alert({ message: `Location error: ${error.message}`, indicator: 'red' });
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
  );
};

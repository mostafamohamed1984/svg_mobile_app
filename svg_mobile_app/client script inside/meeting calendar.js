frappe.views.calendar["Meeting"] = {
    field_map: {
        "start": "date", // Field in the Meeting doctype that represents the start time
        "end": "date",     // Field in the Meeting doctype that represents the end time
        "id": "name",          // Field in the Meeting doctype that represents the unique ID
        "title": "subject",    // Field in the Meeting doctype that represents the title
        "allDay": "all_day"    // Field in the Meeting doctype that represents if the event is all day
    },
    gantt: false, // Set to true if you want a Gantt view instead of a calendar
    filters: [],   // Add any default filters here
    get_events_method: "frappe.desk.calendar.get_events" // Method to fetch events
};
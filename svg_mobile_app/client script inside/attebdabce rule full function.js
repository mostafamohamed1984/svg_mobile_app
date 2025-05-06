frappe.ui.form.on('Attendance Roles', {
    get_attendance: function (frm) {
        if (!frm.doc.date_from || !frm.doc.date_to) {
            frappe.msgprint(__('Please set both Date From and Date To before fetching attendance.'));
            return;
        }

        // Get company from session defaults
        frappe.db.get_value('User', frappe.session.user, 'company', function(data) {
            let company = data?.company || frappe.defaults.get_user_default('company');
            
            let filters = [
                ['attendance_date', '>=', frm.doc.date_from],
                ['attendance_date', '<=', frm.doc.date_to],
                ['custom_deduction', '>', 0],
                ['status', '=', 'Present'], // Filter for status = "Present"
                ['shift', 'not like', '%Excuse%'] // Filter to exclude shifts containing "Excuse"
            ];
            
            // Add company filter if available
            if (company) {
                filters.push(['company', '=', company]);
            }
            
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Attendance',
                    filters: filters,
                    fields: ['employee', 'employee_name', 'attendance_date', 'working_hours', 'custom_deduction', 'company'],
                    order_by: 'employee, attendance_date asc'
                },
                callback: function (response) {
                    if (response.message) {
                        let attendance_data = response.message;

                        // Clear existing rows in the Attendance Log table
                        frm.clear_table('attendance_log');

                        // Track late hour occurrences for each employee in company "Egypt"
                        let employee_late_count_egypt = {
                            "0_0.5": {},
                            "0.5_1": {}
                        };

                        // Add rows to the Attendance Log table
                        attendance_data.forEach(row => {
                            let new_row = frm.add_child('attendance_log');
                            new_row.employee = row.employee;
                            new_row.name1 = row.employee_name;
                            new_row.day = row.attendance_date;
                            new_row.working_hours = row.working_hours;
                            new_row.late_hours = row.custom_deduction;
                            new_row.company = row.company;

                            // Deduction calculation logic
                            let deduction = 0;

                            if (row.company === 'Egypt') {
                                if (row.custom_deduction > 0 && row.custom_deduction <= 0.5) {
                                    if (!employee_late_count_egypt["0_0.5"][row.employee]) {
                                        employee_late_count_egypt["0_0.5"][row.employee] = 0;
                                    }
                                    employee_late_count_egypt["0_0.5"][row.employee] += 1;
                                    let occurrence = employee_late_count_egypt["0_0.5"][row.employee];

                                    if (occurrence === 1) deduction = 0.25;
                                    else if (occurrence === 2) deduction = 0.5;
                                    else if (occurrence === 3) deduction = 1;
                                    else deduction = 2;

                                } else if (row.custom_deduction > 0.5 && row.custom_deduction <= 1) {
                                    if (!employee_late_count_egypt["0.5_1"][row.employee]) {
                                        employee_late_count_egypt["0.5_1"][row.employee] = 0;
                                    }
                                    employee_late_count_egypt["0.5_1"][row.employee] += 1;
                                    let occurrence = employee_late_count_egypt["0.5_1"][row.employee];

                                    if (occurrence === 1) deduction = 0.5;
                                    else if (occurrence === 2) deduction = 1;
                                    else if (occurrence === 3) deduction = 2;
                                    else deduction = 3;
                                }
                            } else if (row.company === 'SHJ') {
                                // Rules for "SHJ" company
                                if (row.custom_deduction > 0.26 && row.custom_deduction <= 0.5) {
                                    deduction = 0.25;
                                } else if (row.custom_deduction > 0.5 && row.custom_deduction <= 1) {
                                    deduction = 0.5;
                                } else if (row.custom_deduction > 1 && row.custom_deduction <= 1.5) {
                                    deduction = 0.75;
                                } else if (row.custom_deduction > 1.5) {
                                    deduction = 1;
                                }
                            }

                            new_row.deduction = deduction;
                        });

                        // Refresh the table
                        frm.refresh_field('attendance_log');

                        frappe.msgprint(__('Attendance data fetched and populated successfully.'));
                    } else {
                        frappe.msgprint(__('No attendance records found for the selected date range and criteria.'));
                    }
                }
            });
        });
    },

    get_excuses: function (frm) {
        if (!frm.doc.date_from || !frm.doc.date_to) {
            frappe.msgprint(__('Please set both Date From and Date To before fetching attendance.'));
            return;
        }

        // Get company from session defaults
        frappe.db.get_value('User', frappe.session.user, 'company', function(data) {
            let company = data?.company || frappe.defaults.get_user_default('company');
            
            let filters = [
                ['attendance_date', '>=', frm.doc.date_from],
                ['attendance_date', '<=', frm.doc.date_to],
                ['shift', '=', 'Egy Excuse']
            ];
            
            // Add company filter if available
            if (company) {
                filters.push(['company', '=', company]);
            }
            
            frappe.call({
                method: 'frappe.client.get_list',
                args: {
                    doctype: 'Attendance',
                    filters: filters,
                    fields: ['employee', 'employee_name', 'attendance_date', 'working_hours', 'company', 'custom_shift_hours'],
                    order_by: 'employee, attendance_date asc'
                },
                callback: function (attendance_response) {
                    if (!attendance_response.message || attendance_response.message.length === 0) {
                        frappe.msgprint(__('No Excuses records found for the selected date range and criteria.'));
                        return;
                    }

                    let attendance_data = attendance_response.message;
                    let employees_dates = attendance_data.map(row => ({
                        employee: row.employee,
                        attendance_date: row.attendance_date
                    }));

                    // Fetch Shift Request Data
                    frappe.call({
                        method: 'frappe.client.get_list',
                        args: {
                            doctype: 'Shift Request',
                            filters: employees_dates.flatMap(ed => [
                                ['employee', '=', ed.employee],
                                ['from_date', '=', ed.attendance_date]
                            ]),
                            fields: ['employee', 'from_date', 'custom_excuse_hours']
                        },
                        callback: function (shift_request_response) {
                            let shift_request_data = shift_request_response.message || [];

                            // Create a lookup for Shift Request data
                            let shift_lookup = {};
                            shift_request_data.forEach(sr => {
                                shift_lookup[`${sr.employee}_${sr.from_date}`] = sr.custom_excuse_hours || 0;
                            });

                            frm.clear_table('excuses_log');

                            attendance_data.forEach(row => {
                                let new_row = frm.add_child('excuses_log');
                                new_row.employee = row.employee;
                                new_row.name1 = row.employee_name;
                                new_row.day = row.attendance_date;
                                new_row.requested_hours = shift_lookup[`${row.employee}_${row.attendance_date}`] || 0;
                                new_row.working_hours = row.working_hours;
                                new_row.company = row.company;

                                let shift_hours = (row.custom_shift_hours || 0) - new_row.requested_hours;
                                let difference = shift_hours - (row.working_hours || 0);

                                new_row.shift_hours = shift_hours;
                                new_row.difference = difference;
                            });

                            frm.refresh_field('excuses_log');
                            frappe.msgprint(__('Excuses data fetched and populated successfully.'));
                        }
                    });
                }
            });
        });
    },

    calculate_deductions: function (frm) {
        // Clear existing rows in the Total Deduction table
        frm.clear_table('total_deduction');

        // Create a dictionary to sum deductions for each employee
        let employee_deductions = {};

        // Process attendance_log table
        (frm.doc.attendance_log || []).forEach(row => {
            if (!employee_deductions[row.employee]) {
                employee_deductions[row.employee] = {
                    name1: row.name1,
                    total_deduction_days: 0
                };
            }
            employee_deductions[row.employee].total_deduction_days += row.deduction || 0;
        });

        // Process excuses_log table
        (frm.doc.excuses_log || []).forEach(row => {
            if (!employee_deductions[row.employee]) {
                employee_deductions[row.employee] = {
                    name1: row.name1,
                    total_deduction_days: 0
                };
            }
            // Assuming `difference` field in excuses_log represents the deduction
            employee_deductions[row.employee].total_deduction_days += row.deduction || 0;
        });

        // Populate the Total Deduction table
        Object.keys(employee_deductions).forEach(employee => {
            let new_row = frm.add_child('total_deduction');
            new_row.employee = employee;
            new_row.name1 = employee_deductions[employee].name1;
            new_row.total_deduction_days = employee_deductions[employee].total_deduction_days;
        });

        // Refresh the table
        frm.refresh_field('total_deduction');

        frappe.msgprint(__('Total deductions calculated and populated successfully.'));
    },

    on_submit: function (frm) {
        if (!frm.doc.apply_on_date) {
            frappe.throw(__('Please ensure Apply On Date field is set before submitting.'));
        }

        (frm.doc.total_deduction || []).forEach(row => {
            frappe.call({
                method: 'frappe.client.insert',
                args: {
                    doc: {
                        doctype: 'Additional Salary',
                        employee: row.employee,
                        payroll_date: frm.doc.apply_on_date,
                        salary_component: 'Late Arrival and Early leave Days',
                        amount: row.total_deduction_days,
                        docstatus: 1
                    }
                },
                callback: function (response) {
                    if (response.message) {
                        frappe.msgprint(__('Additional Salary created for employee: {0}', [row.employee]));
                    }
                }
            });
        });
    }
});
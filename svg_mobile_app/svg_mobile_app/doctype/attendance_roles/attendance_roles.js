// Copyright (c) 2025, SVG and contributors
// For license information, please see license.txt

// frappe.ui.form.on("Attendance Roles", {
// 	refresh(frm) {

// 	},
// });

frappe.ui.form.on("Attendance Roles", {
    refresh(frm) {
        // Add a collapsible section for deduction rules
        frm.add_custom_button(__('Show Deduction Rules'), function() {
            show_deduction_rules_dialog();
        });
        
        // Optionally, add it directly to the form
        add_deduction_rules_section(frm);
    }
});

// Function to add deduction rules section directly to the form
function add_deduction_rules_section(frm) {
    // Remove existing section if any
    frm.layout.wrapper.find('.deduction-rules-section').remove();
    
    // Create a collapsible section
    let section = $(`
        <div class="deduction-rules-section" style="margin: 20px 0;">
            <div class="section-head collapsible">
                <h4 style="display: inline-block; cursor: pointer;">
                    <i class="fa fa-chevron-down" style="margin-right: 5px;"></i> 
                    Deduction Rules
                </h4>
            </div>
            <div class="section-body" style="display:none; padding: 10px; background-color: #f8f8f8; border: 1px solid #e3e3e3; border-radius: 5px;"></div>
        </div>
    `);
    
    // Append to the form
    frm.layout.wrapper.find('.form-page').append(section);
    
    // Toggle section visibility on click
    section.find('.collapsible').on('click', function() {
        $(this).find('i').toggleClass('fa-chevron-down fa-chevron-up');
        section.find('.section-body').slideToggle();
        
        // Load content if it's empty
        if (section.find('.section-body').html() === '') {
            load_deduction_table(section.find('.section-body'));
        }
    });
}

// Function to load the appropriate deduction table based on company
function load_deduction_table(container) {
    // Get company from session defaults
    let company = frappe.defaults.get_user_default('company');
    
    if (company === 'Smart Vision Group' || company === 'Egypt') {
        // For Smart Vision Group (Egypt)
        container.html(`
            <div style="text-align: center; margin-bottom: 15px;">
                <h3 style="color: #1f497d; margin-bottom: 5px;">لائحة التأخيرات</h3>
                <h4 style="color: #4472c4;">Smart Vision Group</h4>
            </div>
            <div style="overflow-x: auto;">
                <table class="table table-bordered" style="width: 100%; direction: rtl;">
                    <thead>
                        <tr style="background-color: #4472c4; color: white;">
                            <th style="text-align: center;">ملاحظات</th>
                            <th style="text-align: center;" colspan="4">درجة الجزاء</th>
                            <th style="text-align: center;">نوع المخالفة</th>
                        </tr>
                        <tr style="background-color: #b4c6e7;">
                            <th></th>
                            <th style="text-align: center;">رابع مرة</th>
                            <th style="text-align: center;">ثالث مرة</th>
                            <th style="text-align: center;">ثاني مرة</th>
                            <th style="text-align: center;">أول مرة</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colspan="5" style="background-color: #d9e1f2; text-align: right; font-weight: bold;">أولا مخالفات تتعلق بمواعيد العمل:</td>
                            <td style="background-color: #d9e1f2;"></td>
                        </tr>
                        <tr>
                            <td rowspan="2" style="text-align: right;">يقصد بعبارة اليوم أن الجزاء قائم هو الخصم من الأجر بمقدار اليوم على الأجر</td>
                            <td style="text-align: center;">يومان</td>
                            <td style="text-align: center;">يوم</td>
                            <td style="text-align: center;">نصف يوم</td>
                            <td style="text-align: center;">ربع يوم</td>
                            <td style="text-align: right;">1 - التأخير عن مواعيد العمل لغاية 30 دقيقه دون إذن مسبق</td>
                        </tr>
                        <tr>
                            <td colspan="5" style="text-align: right;">إذا لم يترتب على التأخير تعطيل عمال آخرين</td>
                        </tr>
                        <tr>
                            <td></td>
                            <td style="text-align: center;">ثلاثة أيام</td>
                            <td style="text-align: center;">يومان</td>
                            <td style="text-align: center;">يوم</td>
                            <td style="text-align: center;">نصف يوم</td>
                            <td style="text-align: right;">إذا ترتب على التأخير تعطيل عمال آخرين</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 20px; direction: rtl; text-align: right; padding: 10px; background-color: #d9e1f2; border-radius: 5px;">
                <h4 style="margin-bottom: 10px; color: #1f497d;">أحكام التأخيرات:</h4>
                <ul style="list-style-type: none; padding-right: 10px;">
                    <li style="margin-bottom: 5px;">- 15 دقيقة أو أقل: يسمح بالتأخير لمدة 15 دقيقة دون أي جزاءات، مع مراعاة التعويض بنفس اليوم.</li>
                    <li style="margin-bottom: 5px;">- من 16 : 30 دقيقة - خصم 25% من راتب اليوم.</li>
                    <li style="margin-bottom: 5px;">- من 30 : 60 دقيقة - خصم 50% من راتب اليوم.</li>
                    <li style="margin-bottom: 5px;">- من 60 : 90 دقيقة - خصم 75% من راتب اليوم.</li>
                    <li style="margin-bottom: 5px;">- أكثر من 90 دقيقة - خصم 100% من راتب اليوم.</li>
                </ul>
            </div>
        `);
    } else if (company === 'Smart Vision Engineering Consultant' || company === 'SHJ') {
        // For Smart Vision Engineering Consultant (SHJ)
        container.html(`
            <div style="text-align: center; margin-bottom: 15px;">
                <h3 style="color: #1f497d; margin-bottom: 5px;">Attendance Deduction Rules</h3>
                <h4 style="color: #4472c4;">Smart Vision Engineering Consultant</h4>
            </div>
            <div style="overflow-x: auto;">
                <table class="table table-bordered" style="width: 100%;">
                    <thead>
                        <tr style="background-color: #4472c4; color: white;">
                            <th style="text-align: center;">Late Duration</th>
                            <th style="text-align: center;">Deduction</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>0 - 15 minutes</td>
                            <td>Grace period (no deduction)</td>
                        </tr>
                        <tr>
                            <td>16 - 30 minutes</td>
                            <td>25% of daily salary</td>
                        </tr>
                        <tr>
                            <td>31 - 60 minutes</td>
                            <td>50% of daily salary</td>
                        </tr>
                        <tr>
                            <td>61 - 90 minutes</td>
                            <td>75% of daily salary</td>
                        </tr>
                        <tr>
                            <td>More than 90 minutes</td>
                            <td>100% of daily salary</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 20px; padding: 10px; background-color: #d9e1f2; border-radius: 5px;">
                <h4 style="margin-bottom: 10px; color: #1f497d;">Additional Rules:</h4>
                <ul style="padding-left: 20px;">
                    <li style="margin-bottom: 5px;">Late arrival more than 0.26 hours but less than or equal to 0.5 hours: 0.25 day deduction</li>
                    <li style="margin-bottom: 5px;">Late arrival more than 0.5 hours but less than or equal to 1 hour: 0.5 day deduction</li>
                    <li style="margin-bottom: 5px;">Late arrival more than 1 hour but less than or equal to 1.5 hours: 0.75 day deduction</li>
                    <li style="margin-bottom: 5px;">Late arrival more than 1.5 hours: 1 day deduction</li>
                </ul>
            </div>
        `);
    } else {
        // Default case if no company matched
        container.html(`
            <div style="text-align: center; padding: 20px;">
                <div class="alert alert-warning">
                    <i class="fa fa-exclamation-triangle" style="margin-right: 10px;"></i>
                    No specific deduction rules available for the current company. Please contact HR for details.
                </div>
                <p>Company currently set: ${company || 'None'}</p>
                <p>Contact HR department for the applicable deduction rules.</p>
            </div>
        `);
    }
}

// Function to show deduction rules in a dialog
function show_deduction_rules_dialog() {
    let d = new frappe.ui.Dialog({
        title: __('Attendance Deduction Rules'),
        fields: [
            {
                fieldname: 'rules_html',
                fieldtype: 'HTML'
            }
        ],
        size: 'large'
    });
    
    d.show();
    
    // Load the appropriate deduction table
    load_deduction_table(d.fields_dict.rules_html.$wrapper);
}

"""
Test script for Leave Gantt Chart functionality
Run this in Frappe console to test the API
"""

import frappe
from frappe.utils import getdate
import json

def test_leave_gantt_api():
    """Test the leave gantt chart API"""
    print("Testing Leave Gantt Chart API...")
    
    try:
        # Test 1: Basic API call without filters
        print("\n1. Testing basic API call...")
        result = frappe.call(
            'svg_mobile_app.svg_mobile_app.page.leave_gantt_chart.leave_gantt_chart.get_leave_gantt_data'
        )
        
        if result:
            print(f"✓ API returned data successfully")
            print(f"  - Companies: {len(result.get('companies', []))}")
            print(f"  - Leave periods: {len(result.get('leave_periods', []))}")
            print(f"  - Timeline: {result.get('timeline', {}).get('start_date')} to {result.get('timeline', {}).get('end_date')}")
        else:
            print("✗ API returned no data")
            
    except Exception as e:
        print(f"✗ API call failed: {str(e)}")
    
    try:
        # Test 2: API call with filters
        print("\n2. Testing API call with filters...")
        current_year = getdate().year
        filters = {
            'from_date': f'{current_year}-01-01',
            'to_date': f'{current_year}-12-31'
        }
        
        result = frappe.call(
            'svg_mobile_app.svg_mobile_app.page.leave_gantt_chart.leave_gantt_chart.get_leave_gantt_data',
            filters=json.dumps(filters)
        )
        
        if result:
            print(f"✓ Filtered API call successful")
            print(f"  - Summary: {result.get('summary', {})}")
        else:
            print("✗ Filtered API call returned no data")
            
    except Exception as e:
        print(f"✗ Filtered API call failed: {str(e)}")
    
    try:
        # Test 3: Test helper functions
        print("\n3. Testing helper functions...")
        
        companies = frappe.call(
            'svg_mobile_app.svg_mobile_app.page.leave_gantt_chart.leave_gantt_chart.get_companies'
        )
        print(f"✓ Companies API: {len(companies) if companies else 0} companies found")
        
        leave_types = frappe.call(
            'svg_mobile_app.svg_mobile_app.page.leave_gantt_chart.leave_gantt_chart.get_leave_types'
        )
        print(f"✓ Leave Types API: {len(leave_types) if leave_types else 0} leave types found")
        
    except Exception as e:
        print(f"✗ Helper functions failed: {str(e)}")
    
    try:
        # Test 4: Test export functionality
        print("\n4. Testing export functionality...")
        
        export_data = frappe.call(
            'svg_mobile_app.svg_mobile_app.page.leave_gantt_chart.leave_gantt_chart.export_gantt_data'
        )
        
        if export_data:
            print(f"✓ Export API: {len(export_data)} records exported")
            if export_data:
                print(f"  - Sample record keys: {list(export_data[0].keys()) if export_data else 'None'}")
        else:
            print("✓ Export API: No data to export (this is normal if no leave applications exist)")
            
    except Exception as e:
        print(f"✗ Export API failed: {str(e)}")
    
    print("\n" + "="*50)
    print("Test completed!")
    print("If all tests passed, the Leave Gantt Chart should work correctly.")
    print("Access it at: /app/leave-gantt-chart")

def test_sample_data():
    """Create some sample data for testing (optional)"""
    print("\nCreating sample data for testing...")
    
    try:
        # Check if we have employees
        employees = frappe.get_all("Employee", limit=5)
        if not employees:
            print("No employees found. Please create some employees first.")
            return
        
        print(f"Found {len(employees)} employees for testing")
        
        # You can add code here to create sample leave applications if needed
        # This is optional and should only be run in development environment
        
    except Exception as e:
        print(f"Error checking sample data: {str(e)}")

if __name__ == "__main__":
    test_leave_gantt_api()
    # Uncomment the next line if you want to create sample data
    # test_sample_data()

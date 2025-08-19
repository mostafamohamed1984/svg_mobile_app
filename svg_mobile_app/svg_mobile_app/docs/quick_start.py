#!/usr/bin/env python3
"""
Quick Start Script for Email System Implementation
Run this script to get started with testing and implementation
"""

import frappe
import os
import sys
from datetime import datetime

def print_banner():
    """Print startup banner"""
    print("=" * 80)
    print("🚀 EMAIL SYSTEM IMPLEMENTATION & TESTING")
    print("=" * 80)
    print(f"⏰ Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("📍 Current directory:", os.getcwd())
    print("🏗️  Frappe site:", getattr(frappe.local, 'site', 'Not connected'))
    print("=" * 80)

def check_prerequisites():
    """Check if all prerequisites are met"""
    print("\n🔍 CHECKING PREREQUISITES...")
    
    checks = {
        "Frappe Framework": check_frappe(),
        "Database Connection": check_database(),
        "Email System Files": check_email_files(),
        "Required DocTypes": check_doctypes(),
        "Hooks Configuration": check_hooks()
    }
    
    all_passed = True
    for check_name, (passed, message) in checks.items():
        status = "✅" if passed else "❌"
        print(f"  {status} {check_name}: {message}")
        if not passed:
            all_passed = False
    
    return all_passed

def check_frappe():
    """Check Frappe framework"""
    try:
        import frappe
        version = frappe.__version__
        return True, f"Version {version}"
    except Exception as e:
        return False, f"Error: {str(e)}"

def check_database():
    """Check database connection"""
    try:
        result = frappe.db.sql("SELECT 1", as_dict=True)
        return True, "Connected successfully"
    except Exception as e:
        return False, f"Connection failed: {str(e)}"

def check_email_files():
    """Check if email system files exist"""
    required_files = [
        "svg_mobile_app/email_genius/email_processor.py",
        "svg_mobile_app/email_genius/email_logger.py",
        "svg_mobile_app/email_genius/email_retry.py",
        "svg_mobile_app/email_genius/performance_optimization.py",
        "svg_mobile_app/email_genius/health_monitor.py",
        "svg_mobile_app/email_genius/system_diagnostics.py"
    ]
    
    missing_files = []
    for file_path in required_files:
        if not os.path.exists(file_path):
            missing_files.append(file_path)
    
    if missing_files:
        return False, f"Missing files: {', '.join(missing_files[:3])}{'...' if len(missing_files) > 3 else ''}"
    
    return True, f"All {len(required_files)} core files present"

def check_doctypes():
    """Check if required DocTypes exist"""
    required_doctypes = [
        "BCC Processing Settings",
        "Forward Emails Control", 
        "Email Monitoring",
        "Communication Relation"
    ]
    
    missing_doctypes = []
    for doctype in required_doctypes:
        if not frappe.db.exists("DocType", doctype):
            missing_doctypes.append(doctype)
    
    if missing_doctypes:
        return False, f"Missing DocTypes: {', '.join(missing_doctypes)}"
    
    return True, f"All {len(required_doctypes)} DocTypes exist"

def check_hooks():
    """Check if hooks are properly configured"""
    try:
        hooks = frappe.get_hooks()
        
        # Check for email system hooks
        doc_events = hooks.get("doc_events", {})
        comm_hooks = doc_events.get("Communication", {})
        
        has_before_insert = bool(comm_hooks.get("before_insert"))
        has_after_insert = bool(comm_hooks.get("after_insert"))
        has_scheduler = bool(hooks.get("scheduler_events", {}).get("daily"))
        
        if has_before_insert and has_after_insert and has_scheduler:
            return True, "Email system hooks configured"
        else:
            missing = []
            if not has_before_insert: missing.append("before_insert")
            if not has_after_insert: missing.append("after_insert") 
            if not has_scheduler: missing.append("scheduler")
            return False, f"Missing hooks: {', '.join(missing)}"
            
    except Exception as e:
        return False, f"Error checking hooks: {str(e)}"

def run_quick_setup():
    """Run quick system setup"""
    print("\n⚙️  RUNNING QUICK SETUP...")
    
    try:
        # Run the complete setup
        from svg_mobile_app.setup_email_system_complete import run_complete_setup
        
        print("  🔧 Running complete email system setup...")
        result = run_complete_setup()
        
        if result.get("setup_result", {}).get("success"):
            print("  ✅ Email system setup completed successfully")
            
            completion = result.get("completion_verification", {})
            if completion.get("is_complete"):
                print(f"  🎉 System is {completion.get('completion_percentage', 0):.1f}% complete!")
            else:
                print(f"  ⚠️  System is {completion.get('completion_percentage', 0):.1f}% complete")
                
            return True, "Setup completed successfully"
        else:
            errors = result.get("setup_result", {}).get("errors", [])
            return False, f"Setup failed: {errors[0] if errors else 'Unknown error'}"
            
    except Exception as e:
        return False, f"Setup error: {str(e)}"

def run_basic_tests():
    """Run basic system tests"""
    print("\n🧪 RUNNING BASIC TESTS...")
    
    tests = [
        ("System Health", test_system_health),
        ("Configuration", test_configuration),
        ("Email Processing", test_email_processing),
        ("Database Performance", test_database_performance)
    ]
    
    passed = 0
    for test_name, test_func in tests:
        try:
            result, message = test_func()
            status = "✅" if result else "❌"
            print(f"  {status} {test_name}: {message}")
            if result:
                passed += 1
        except Exception as e:
            print(f"  ❌ {test_name}: Error - {str(e)}")
    
    print(f"\n📊 Test Results: {passed}/{len(tests)} tests passed")
    return passed == len(tests)

def test_system_health():
    """Test system health"""
    try:
        from svg_mobile_app.email_genius.health_monitor import get_system_health
        
        result = get_system_health()
        if result.get("status") == "success":
            health = result.get("health", {})
            status = health.get("overall_status", "unknown")
            return status in ["healthy", "degraded"], f"Status: {status}"
        else:
            return False, f"Health check failed: {result.get('message', 'Unknown error')}"
            
    except Exception as e:
        return False, f"Health check error: {str(e)}"

def test_configuration():
    """Test configuration"""
    try:
        from svg_mobile_app.email_genius.system_diagnostics import run_system_diagnostics
        
        result = run_system_diagnostics()
        if result.get("status") == "success":
            diagnostics = result.get("diagnostics", {})
            status = diagnostics.get("overall_status", "unknown")
            error_count = len(diagnostics.get("errors", []))
            
            if status == "critical" or error_count > 5:
                return False, f"Critical issues: {error_count} errors"
            else:
                return True, f"Status: {status}, {error_count} errors"
        else:
            return False, f"Diagnostics failed: {result.get('message', 'Unknown error')}"
            
    except Exception as e:
        return False, f"Diagnostics error: {str(e)}"

def test_email_processing():
    """Test email processing components"""
    try:
        # Test if we can import the main processor
        from svg_mobile_app.email_genius.email_processor import process_bcc_email
        
        # Check if BCC Processing Settings exists
        if frappe.db.exists("BCC Processing Settings", "BCC Processing Settings"):
            settings = frappe.get_single("BCC Processing Settings")
            enabled = settings.get("enable_bcc_processing", 0)
            return True, f"BCC processing {'enabled' if enabled else 'disabled'}"
        else:
            return False, "BCC Processing Settings not found"
            
    except Exception as e:
        return False, f"Email processing test error: {str(e)}"

def test_database_performance():
    """Test database performance"""
    try:
        from svg_mobile_app.email_genius.performance_optimization import get_performance_report
        
        result = get_performance_report()
        if result.get("status") == "success":
            return True, "Performance monitoring active"
        else:
            return False, f"Performance test failed: {result.get('message', 'Unknown error')}"
            
    except Exception as e:
        return False, f"Performance test error: {str(e)}"

def show_next_steps():
    """Show next steps for implementation"""
    print("\n📋 NEXT STEPS:")
    print("""
1. 📖 Review Implementation Guide:
   - Read: svg_mobile_app/docs/Complete_Email_System_Implementation_Guide.md
   - Follow deployment instructions

2. ⚙️  Configure Email System:
   - Go to BCC Processing Settings
   - Enable BCC processing
   - Configure email accounts
   - Set up OAuth2 (if needed)

3. 🧪 Run Comprehensive Tests:
   - Execute: python svg_mobile_app/tests/test_email_system_complete.py
   - Execute: python svg_mobile_app/tests/test_email_system_enhanced.py

4. 📧 Test with Real Emails:
   - Send test email with multiple recipients
   - Verify separate Communication records
   - Check Email Monitoring creation

5. 🚀 Deploy to Production:
   - Follow deployment guide
   - Create backups
   - Monitor system health

6. 📊 Monitor System:
   - Check health dashboard
   - Review error logs
   - Monitor performance metrics
""")

def main():
    """Main function"""
    try:
        print_banner()
        
        # Check prerequisites
        if not check_prerequisites():
            print("\n❌ Prerequisites not met. Please fix the issues above before continuing.")
            return False
        
        print("\n✅ All prerequisites met!")
        
        # Ask user if they want to run setup
        response = input("\n🤔 Would you like to run the complete email system setup? (y/N): ").lower().strip()
        
        if response in ['y', 'yes']:
            success, message = run_quick_setup()
            if not success:
                print(f"\n❌ Setup failed: {message}")
                return False
        else:
            print("\n⏭️  Skipping setup. You can run it later manually.")
        
        # Run basic tests
        if run_basic_tests():
            print("\n🎉 All basic tests passed!")
        else:
            print("\n⚠️  Some tests failed. Review the results above.")
        
        # Show next steps
        show_next_steps()
        
        print("\n" + "=" * 80)
        print("🏁 Quick Start Complete!")
        print("=" * 80)
        
        return True
        
    except KeyboardInterrupt:
        print("\n\n⏹️  Quick start interrupted by user.")
        return False
    except Exception as e:
        print(f"\n❌ Quick start failed: {str(e)}")
        return False

if __name__ == "__main__":
    # This allows the script to be run directly
    success = main()
    sys.exit(0 if success else 1)

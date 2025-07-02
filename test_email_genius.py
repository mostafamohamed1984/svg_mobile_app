#!/usr/bin/env python3
"""
Quick test script for Email Genius BCC processing

USAGE:
Method 1 (Recommended): Use bench console
cd ~/frappe-bench
bench --site smartvision.com console

Then run:
exec(open('apps/svg_mobile_app/test_email_genius.py').read())

Method 2: Direct execution (if frappe is in PATH)
cd ~/frappe-bench
python3 apps/svg_mobile_app/test_email_genius.py
"""

def test_email_genius():
    """Test the Email Genius implementation"""
    try:
        # Try to import frappe (should work in bench console or if properly set up)
        import frappe
        
        print("🔍 Testing Email Genius BCC Processing...")
        print("=" * 50)
        
        # Test 1: Check if BCC processing is enabled
        print("1. Checking BCC Processing Settings...")
        try:
            from svg_mobile_app.email_genius.email_processor import is_bcc_processing_enabled
            enabled = is_bcc_processing_enabled()
            print(f"   ✅ BCC Processing Enabled: {enabled}")
        except Exception as e:
            print(f"   ❌ Error checking BCC settings: {e}")
        
        # Test 2: Check settings access
        print("\n2. Checking Settings Access...")
        try:
            from svg_mobile_app.svg_mobile_app.doctype.bcc_processing_settings.bcc_processing_settings import get_bcc_settings
            settings = get_bcc_settings()
            if settings:
                print(f"   ✅ Settings accessible")
                print(f"   📧 Gmail Account: {settings.get('gmail_forwarding_account', 'Not set')}")
                print(f"   🔧 Processing Method: {settings.get('processing_method', 'Not set')}")
            else:
                print("   ❌ Settings not found")
        except Exception as e:
            print(f"   ❌ Error accessing settings: {e}")
        
        # Test 3: Test email interception
        print("\n3. Testing Email Interception...")
        try:
            from svg_mobile_app.email_genius.test_email_processing import test_bcc_interception
            result = test_bcc_interception()
            print(f"   Status: {result.get('status', 'unknown')}")
            print(f"   Message: {result.get('message', 'No message')}")
            
            if result.get('status') == 'success':
                results = result.get('results', {})
                print(f"   📨 Original Message-ID: {results.get('original_message_id', 'N/A')}")
                print(f"   📨 Processed Message-ID: {results.get('processed_message_id', 'N/A')}")
        except Exception as e:
            print(f"   ❌ Error testing interception: {e}")
        
        # Test 4: Check hooks configuration
        print("\n4. Checking Hooks Configuration...")
        try:
            from svg_mobile_app import hooks
            override_methods = getattr(hooks, 'override_whitelisted_methods', {})
            if "frappe.email.receive.pull_from_email_account" in override_methods:
                print("   ✅ Email processing override configured")
                print(f"   🔗 Override target: {override_methods['frappe.email.receive.pull_from_email_account']}")
            else:
                print("   ❌ Email processing override not found")
        except Exception as e:
            print(f"   ❌ Error checking hooks: {e}")
        
        # Test 5: Check recent processed emails
        print("\n5. Checking Recent Processed Emails...")
        try:
            recent_count = frappe.db.count("Communication", {
                "custom_bcc_processed": 1,
                "creation": [">=", frappe.utils.add_days(frappe.utils.today(), -7)]
            })
            print(f"   📊 BCC processed emails (last 7 days): {recent_count}")
            
            total_comms = frappe.db.count("Communication", {
                "communication_medium": "Email",
                "sent_or_received": "Received",
                "creation": [">=", frappe.utils.add_days(frappe.utils.today(), -7)]
            })
            print(f"   📊 Total received emails (last 7 days): {total_comms}")
            
        except Exception as e:
            print(f"   ❌ Error checking processed emails: {e}")
        
        print("\n" + "=" * 50)
        print("🎯 Email Genius Test Complete!")
        print("\nNext Steps:")
        print("1. If BCC processing is disabled, enable it in BCC Processing Settings")
        print("2. Verify Gmail account is set to: constr.sv@gmail.com")
        print("3. Test with a real email containing CC/BCC recipients")
        print("4. Check Gmail account for forwarded emails")
        print("5. Monitor Frappe logs for processing messages")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        try:
            frappe.destroy()
        except:
            pass

if __name__ == "__main__":
    print("Email Genius BCC Processing Test")
    print("Site: smartvision.com (erp.smartvgroup.com)")
    print()
    print("RECOMMENDED: Use bench console instead:")
    print("cd ~/frappe-bench")
    print("bench --site smartvision.com console")
    print("exec(open('apps/svg_mobile_app/test_email_genius.py').read())")
    print()

    # Try to test directly (may fail if frappe not in PATH)
    try:
        test_email_genius()
    except ImportError as e:
        print(f"❌ Direct execution failed: {e}")
        print()
        print("Please use bench console method instead:")
        print("1. cd ~/frappe-bench")
        print("2. bench --site smartvision.com console")
        print("3. exec(open('apps/svg_mobile_app/test_email_genius.py').read())")

# If running in bench console, automatically run the test
try:
    import frappe
    if frappe.local and frappe.local.site:
        print(f"Running in Frappe context for site: {frappe.local.site}")
        test_email_genius()
except:
    pass

#!/usr/bin/env python3
"""
Diagnostic script to identify and fix orphaned Project Claim references
Run this script to diagnose the "Could not find Row #1: Project Claim" error
"""

import frappe

def diagnose_project_claim_references():
    """Diagnose orphaned project claim references"""
    print("🔍 Diagnosing Project Claim references...")
    
    # Check Project Advances for orphaned references
    print("\n📋 Checking Project Advances...")
    project_advances = frappe.get_all("Project Advances", 
        filters={"docstatus": ["<", 2]}, 
        fields=["name", "docstatus"])
    
    orphaned_advances = []
    
    for pa in project_advances:
        try:
            doc = frappe.get_doc("Project Advances", pa.name)
            if doc.project_contractors:
                for idx, contractor_row in enumerate(doc.project_contractors, 1):
                    if contractor_row.project_claim_reference:
                        if not frappe.db.exists("Project Claim", contractor_row.project_claim_reference):
                            orphaned_advances.append({
                                "advance": pa.name,
                                "row": idx,
                                "orphaned_claim": contractor_row.project_claim_reference,
                                "contractor": contractor_row.project_contractor
                            })
        except Exception as e:
            print(f"❌ Error checking {pa.name}: {str(e)}")
    
    if orphaned_advances:
        print(f"\n⚠️  Found {len(orphaned_advances)} orphaned Project Claim references in Project Advances:")
        for item in orphaned_advances:
            print(f"   - {item['advance']} Row #{item['row']}: {item['orphaned_claim']} (Contractor: {item['contractor']})")
    else:
        print("✅ No orphaned references found in Project Advances")
    
    # Check Claim Items for orphaned references
    print("\n📋 Checking Claim Items...")
    claim_items = frappe.db.sql("""
        SELECT parent, project_contractor_reference, invoice_reference
        FROM `tabClaim Items`
        WHERE project_contractor_reference IS NOT NULL
        OR invoice_reference IS NOT NULL
    """, as_dict=True)
    
    orphaned_claim_items = []
    
    for item in claim_items:
        if item.project_contractor_reference:
            if not frappe.db.exists("Project Contractors", item.project_contractor_reference):
                orphaned_claim_items.append({
                    "claim": item.parent,
                    "type": "Project Contractor",
                    "reference": item.project_contractor_reference
                })
        
        if item.invoice_reference:
            if not frappe.db.exists("Sales Invoice", item.invoice_reference):
                orphaned_claim_items.append({
                    "claim": item.parent,
                    "type": "Sales Invoice",
                    "reference": item.invoice_reference
                })
    
    if orphaned_claim_items:
        print(f"\n⚠️  Found {len(orphaned_claim_items)} orphaned references in Claim Items:")
        for item in orphaned_claim_items:
            print(f"   - {item['claim']}: {item['type']} {item['reference']}")
    else:
        print("✅ No orphaned references found in Claim Items")
    
    # Check specific Project Claims mentioned in the error
    print("\n📋 Checking specific Project Claims (PC-2025-00103, PC-2025-00104, PC-2025-00105, PC-2025-00106)...")
    problematic_claims = ["PC-2025-00103", "PC-2025-00104", "PC-2025-00105", "PC-2025-00106"]
    
    for claim_name in problematic_claims:
        exists = frappe.db.exists("Project Claim", claim_name)
        print(f"   - {claim_name}: {'✅ Exists' if exists else '❌ Does not exist'}")
        
        if exists:
            try:
                doc = frappe.get_doc("Project Claim", claim_name)
                print(f"     Status: {doc.docstatus} ({'Draft' if doc.docstatus == 0 else 'Submitted' if doc.docstatus == 1 else 'Cancelled'})")
                
                # Check for bulk claim indicators
                if doc.invoice_references:
                    print(f"     📄 Bulk Claim - References: {doc.invoice_references}")
                
                # Check claim items for issues
                if doc.claim_items:
                    orphaned_items = 0
                    for item in doc.claim_items:
                        if item.project_contractor_reference and not frappe.db.exists("Project Contractors", item.project_contractor_reference):
                            orphaned_items += 1
                        if item.invoice_reference and not frappe.db.exists("Sales Invoice", item.invoice_reference):
                            orphaned_items += 1
                    
                    if orphaned_items > 0:
                        print(f"     ⚠️  {orphaned_items} orphaned references in claim items")
                    else:
                        print(f"     ✅ All {len(doc.claim_items)} claim items have valid references")
                        
            except Exception as e:
                print(f"     ❌ Error accessing document: {str(e)}")
    
    # Check for bulk claim issues using the new diagnostic function
    print("\n📋 Running bulk claim diagnostics...")
    try:
        from svg_mobile_app.svg_mobile_app.doctype.project_claim.project_claim import diagnose_bulk_claim_issues
        bulk_result = diagnose_bulk_claim_issues()
        print(f"   📊 {bulk_result['message']}")
        
        if bulk_result['issues']:
            print("   🔍 Issues found:")
            for issue in bulk_result['issues'][:5]:  # Show first 5 issues
                if issue['type'] == 'orphaned_contractor':
                    print(f"     - {issue['claim']} Row #{issue['row']}: Orphaned contractor {issue['reference']}")
                elif issue['type'] == 'orphaned_invoice':
                    print(f"     - {issue['claim']} Row #{issue['row']}: Orphaned invoice {issue['reference']}")
                elif issue['type'] == 'access_error':
                    print(f"     - {issue['claim']}: Access error - {issue['error']}")
        
        print(f"   📅 Recent claims: {[claim['name'] for claim in bulk_result['recent_claims'][:3]]}")
        
    except Exception as e:
        print(f"   ❌ Error running bulk claim diagnostics: {str(e)}")
    
    return {
        "orphaned_advances": orphaned_advances,
        "orphaned_claim_items": orphaned_claim_items
    }

def fix_orphaned_references():
    """Fix orphaned references"""
    print("\n🔧 Fixing orphaned references...")
    
    try:
        # Use the cleanup function we added
        from svg_mobile_app.svg_mobile_app.doctype.project_advances.project_advances import cleanup_all_orphaned_project_claim_references
        result = cleanup_all_orphaned_project_claim_references()
        print(f"✅ Cleanup result: {result['message']}")
        
        if result.get('errors'):
            print("⚠️  Errors encountered:")
            for error in result['errors']:
                print(f"   - {error}")
        
        return result
    except Exception as e:
        print(f"❌ Error during cleanup: {str(e)}")
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    # Initialize Frappe
    frappe.init(site="your_site_name")  # Replace with your actual site name
    frappe.connect()
    
    try:
        # Run diagnostics
        results = diagnose_project_claim_references()
        
        # Ask if user wants to fix issues
        if results["orphaned_advances"] or results["orphaned_claim_items"]:
            print("\n🤔 Would you like to fix these orphaned references? (y/n)")
            choice = input().lower().strip()
            
            if choice == 'y':
                fix_result = fix_orphaned_references()
                print(f"\n✅ Fix completed: {fix_result.get('message', 'Unknown result')}")
            else:
                print("\n📝 No changes made. You can run the fix manually later.")
        else:
            print("\n✅ No issues found to fix!")
            
    except Exception as e:
        print(f"❌ Error running diagnostics: {str(e)}")
    finally:
        frappe.destroy() 
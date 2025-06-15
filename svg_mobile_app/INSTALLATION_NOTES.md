# SVG Mobile App Installation Notes

## Temporary Changes Made During Installation

### 1. Projects Collection Customization Fix
**File**: `svg_mobile_app/custom/projects_collection.json`
**Issue**: Attach Image fields (`3d_image` and `site_image`) had `in_list_view` property set to true, which is not allowed in newer Frappe versions.
**Fix**: Removed the problematic property setters for these fields.

### 2. Project Contractors Document Link Fix
**File**: `svg_mobile_app/doctype/project_contractors/project_contractors.json`
**Issue**: Document link referenced `custom_for_project` field in Sales Invoice that doesn't exist during installation order.
**Temporary Fix**: Removed the following document link:
```json
{
  "link_doctype": "Sales Invoice",
  "link_fieldname": "custom_for_project"
}
```

**To Restore After Installation**:
1. Go to Customize Form > Project Contractors > Links
2. Add new document link:
   - Link DocType: Sales Invoice
   - Link Fieldname: custom_for_project

## Installation Order Issues
The app has dependencies where some customizations reference fields that are created by other customizations. The Sales Invoice `custom_for_project` field is created by the Sales Invoice customization but referenced by the Project Contractors DocType definition. 
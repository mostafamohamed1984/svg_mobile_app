import frappe
from frappe.model.document import Document


class CommunicationRelation(Document):
    def validate(self):
        if self.communication == self.related_communication:
            frappe.throw("Communication and Related Communication cannot be the same")


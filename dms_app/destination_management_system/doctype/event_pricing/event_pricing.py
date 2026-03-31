import frappe
from frappe.model.document import Document

class EventPricing(Document):
    def validate(self):
        self.prevent_duplicate()

    def prevent_duplicate(self):
        existing = frappe.db.exists("Event Pricing", {
            "event": self.event,
            "age_category": self.age_category,
            "location_category": self.location_category,
            "name": ["!=", self.name]
        })

        if existing:
            frappe.throw("Pricing already exists for this combination")

# Copyright (c) 2026, Shabas and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EventParticipant(Document):

    def validate(self):
        self.set_age_category()
        self.set_pricing()
        self.calculate_final_amount()
        self.set_balance()
        self.validate_family()

    # 🔹 1. AUTO AGE CATEGORY
    def set_age_category(self):
        if not self.age:
            return

        # If already selected manually, skip overwrite
        if self.age_category:
            return

        category = frappe.db.sql("""
            SELECT name
            FROM `tabAge Category`
            WHERE %s BETWEEN min_age AND max_age
            LIMIT 1
        """, (self.age,), as_dict=True)

        if category:
            self.age_category = category[0].name
        else:
            frappe.throw(f"No Age Category found for age {self.age}")

    # 🔹 2. FETCH PRICING
    def set_pricing(self):
        if not (self.event and self.age_category and self.location_category):
            return

        pricing = frappe.db.get_value(
            "Event Pricing",
            {
                "event": self.event,
                "age_category": self.age_category,
                "location_category": self.location_category
            },
            "base_amount"
        )

        if pricing is None:
            frappe.throw(
                f"No pricing found for Event: {self.event}, "
                f"Age Category: {self.age_category}, "
                f"Location: {self.location_category}"
            )

        self.base_amount = pricing

    # 🔹 3. FINAL AMOUNT CALCULATION (AMOUNT BASED)
    def calculate_final_amount(self):
        base = self.base_amount or 0
        discount = self.discount or 0

        final = base - discount

        # ✅ prevent negative values
        if final < 0:
            final = 0

        self.final_amount = final

    # 🔹 4. SET BALANCE
    def set_balance(self):
        self.balance_amount = self.final_amount or 0

    # 🔹 5. FAMILY VALIDATION
    def validate_family(self):
        if self.family_type == "Family" and not self.family:
            frappe.throw("Please select a Family for Family type")

        if self.family_type == "Single":
            self.family = None


# 🔥 LOCATION FILTER (USED IN JS)
@frappe.whitelist()
def get_location_categories(doctype, txt, searchfield, start, page_len, filters):

    if not filters.get("event") or not filters.get("age_category"):
        return []

    return frappe.db.sql("""
        SELECT DISTINCT location_category
        FROM `tabEvent Pricing`
        WHERE event = %(event)s
        AND age_category = %(age_category)s
        AND location_category LIKE %(txt)s
        ORDER BY location_category
        LIMIT %(start)s, %(page_len)s
    """, {
        "event": filters.get("event"),
        "age_category": filters.get("age_category"),
        "txt": "%" + txt + "%",
        "start": start,
        "page_len": page_len
    })

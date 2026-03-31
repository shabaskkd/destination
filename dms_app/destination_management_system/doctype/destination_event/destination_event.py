import frappe
from frappe.model.document import Document


class DestinationEvent(Document):

    def validate(self):
        self.calculate_total_expense()

    def calculate_total_expense(self):

        # DEBUG
        frappe.msgprint(f"Rows in expenses: {len(self.expenses)}")

        total = 0

        for row in self.expenses:
            frappe.msgprint(f"Row Amount: {row.amount}")
            total += row.amount or 0

        self.total_expense = total

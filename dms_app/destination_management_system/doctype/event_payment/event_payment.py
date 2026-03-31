# Copyright (c) 2026, Shabas and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt, formatdate


class EventPayment(Document):

    # 🔹 MAIN VALIDATION
    def validate(self):
        self.validate_basic()
        self.auto_fill_single_allocation()
        self.validate_allocation()

    # 🔹 BASIC VALIDATION
    def validate_basic(self):

        if not self.event:
            frappe.throw("Event is required")

        if not self.amount or self.amount <= 0:
            frappe.throw("Payment amount must be greater than zero")

        if self.type == "Single" and not self.participant:
            frappe.throw("Participant is required for Single payment")

        if self.type == "Family" and not self.family:
            frappe.throw("Family is required for Family payment")

    # 🔹 AUTO HANDLE SINGLE PAYMENT
    def auto_fill_single_allocation(self):

        if self.type != "Single":
            return

        doc = frappe.db.get_value(
            "Event Participant",
            self.participant,
            ["name", "email", "balance_amount"],
            as_dict=True
        )

        if not doc:
            frappe.throw("Invalid participant selected")

        self.payment_allocation = []

        self.append("payment_allocation", {
            "participant": doc.name,
            "email": doc.email,
            "current_balance": doc.balance_amount,
            "allocated_amount": flt(self.amount)
        })

        self.participant_balance = doc.balance_amount

    # 🔹 VALIDATE ALLOCATION
    def validate_allocation(self):

        if not self.payment_allocation:
            frappe.throw("Payment allocation is required")

        total_allocated = 0
        participants = set()

        for row in self.payment_allocation:

            if row.participant in participants:
                frappe.throw(f"Duplicate participant: {row.participant}")
            participants.add(row.participant)

            if flt(row.allocated_amount) <= 0:
                frappe.throw("Allocated amount must be greater than zero")

            current_balance = frappe.db.get_value(
                "Event Participant",
                row.participant,
                "balance_amount"
            )

            if current_balance is None:
                frappe.throw(f"Participant not found: {row.participant}")

            if flt(row.allocated_amount) > flt(current_balance):
                frappe.throw(
                    f"Allocated amount exceeds balance for {row.participant}"
                )

            event = frappe.db.get_value(
                "Event Participant",
                row.participant,
                "event"
            )

            if event != self.event:
                frappe.throw(
                    f"{row.participant} does not belong to selected event"
                )

            total_allocated += flt(row.allocated_amount)

        if flt(total_allocated) != flt(self.amount):
            frappe.throw("Total allocation must equal payment amount")

    # 🔹 BEFORE SUBMIT
    def before_submit(self):
        self.validate_allocation()

    # 🔹 ON SUBMIT
    def on_submit(self):
        self.update_participant_balance()
        self.update_event_revenue()
        self.send_notifications()

    # 🔹 UPDATE PARTICIPANT BALANCE
    def update_participant_balance(self):

        for row in self.payment_allocation:

            current_balance = frappe.db.get_value(
                "Event Participant",
                row.participant,
                "balance_amount"
            )

            if current_balance is None:
                frappe.throw(f"Participant not found: {row.participant}")

            if flt(row.allocated_amount) > flt(current_balance):
                frappe.throw(
                    f"Balance changed. Refresh and retry for {row.participant}"
                )

            new_balance = flt(current_balance) - flt(row.allocated_amount)

            if new_balance < 0:
                frappe.throw(f"Negative balance not allowed for {row.participant}")

            frappe.db.set_value(
                "Event Participant",
                row.participant,
                "balance_amount",
                new_balance
            )

    # 🔹 UPDATE EVENT REVENUE + PROFIT
    def update_event_revenue(self):

        total = frappe.db.sql("""
            SELECT SUM(amount)
            FROM `tabEvent Payment`
            WHERE event = %s AND docstatus = 1
        """, (self.event,))[0][0] or 0

        frappe.db.set_value(
            "Destination Event",
            self.event,
            "total_revenue",
            total
        )

        event_doc = frappe.get_doc("Destination Event", self.event)

        profit = (event_doc.total_revenue or 0) - (event_doc.total_expense or 0)

        frappe.db.set_value(
            "Destination Event",
            self.event,
            "profit",
            profit
        )

    # 🔹 EMAIL (INVOICE STYLE)
    def send_notifications(self):

        recipients = []

        # 🔹 SINGLE
        if self.type == "Single":
            email = frappe.db.get_value(
                "Event Participant",
                self.participant,
                "email"
            )
            if email:
                recipients.append(email)

        # 🔹 FAMILY
        elif self.type == "Family" and self.notify_all_members:

            members = frappe.get_all(
                "Event Participant",
                filters={
                    "family": self.family,
                    "event": self.event
                },
                fields=["email"]
            )

            for m in members:
                if m.email:
                    recipients.append(m.email)

        if not recipients:
            return

        # 🔹 BUILD TABLE
        rows = ""

        for row in self.payment_allocation:
            total = flt(row.current_balance) + flt(row.allocated_amount)

            rows += f"""
            <tr>
                <td>{row.participant}</td>
                <td>₹ {total}</td>
                <td>₹ {row.allocated_amount}</td>
                <td>₹ {row.current_balance}</td>
            </tr>
            """

        # 🔹 EMAIL TEMPLATE
        message = f"""
        <div style="font-family:Arial;max-width:700px;margin:auto">

            <h2 style="text-align:center;color:#333">Payment Receipt</h2>

            <div style="margin-bottom:15px">
                <b>Event:</b> {self.event}<br>
                <b>Date:</b> {formatdate(self.payment_date)}<br>
                <b>Mode:</b> {self.payment_mode}<br>
                <b>Total Paid:</b> ₹ {self.amount}
            </div>

            <table style="width:100%;border-collapse:collapse" border="1">
                <thead>
                    <tr style="background:#007bff;color:#fff">
                        <th>Participant</th>
                        <th>Total</th>
                        <th>Paid</th>
                        <th>Balance</th>
                    </tr>
                </thead>
                <tbody>
                    {rows}
                </tbody>
            </table>

            <p style="margin-top:20px;text-align:center">
                Thank you for your payment 🙏
            </p>

        </div>
        """

        frappe.sendmail(
            recipients=recipients,
            subject=f"Payment Confirmation - {self.event}",
            message=message
        )

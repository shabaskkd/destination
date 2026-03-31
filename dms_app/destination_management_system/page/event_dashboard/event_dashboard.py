import frappe
from frappe.utils import flt


@frappe.whitelist()
def get_dashboard_data():

    event_data = []
    participant_data = []

    # 🔹 get all events
    events = frappe.get_all(
        "Destination Event",
        fields=["name", "event_name"]
    )

    # 🔹 get all participants
    all_participants = frappe.get_all(
        "Event Participant",
        fields=[
            "full_name",
            "final_amount",
            "balance_amount",
            "family_type",
            "event"
        ]
    )

    for event in events:

        # 🔥 FIX → match using BOTH fields
        event_participants = [
            p for p in all_participants
            if p.event == event.name or p.event == event.event_name
        ]

        event_expected = 0
        event_actual = 0

        for p in event_participants:

            final = flt(p.final_amount)
            balance = flt(p.balance_amount)
            paid = final - balance

            if balance == 0:
                status = "Paid"
            elif paid > 0:
                status = "Partial"
            else:
                status = "Pending"

            event_expected += final
            event_actual += paid

            participant_data.append({
                "event": event.event_name or event.name,
                "participant": p.full_name or "No Name",
                "type": p.family_type or "Single",
                "final": final,
                "paid": paid,
                "balance": balance,
                "status": status
            })

        expense = frappe.db.get_value(
            "Destination Event",
            event.name,
            "total_expense"
        ) or 0

        event_data.append({
            "event": event.event_name or event.name,
            "participants": len(event_participants),
            "expected": event_expected,
            "actual": event_actual,
            "expense": expense,
            "profit": event_actual - expense
        })

    return {
        "events": event_data,
        "participants": participant_data
    }

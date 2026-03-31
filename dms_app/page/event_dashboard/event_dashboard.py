import frappe
from frappe.utils import flt


@frappe.whitelist()
def get_dashboard_data():

    events = frappe.get_all(
        "Destination Event",
        fields=["name", "event_date"]
    )

    data = []

    total_expected = 0
    total_actual = 0
    total_expense = 0
    total_participants = 0

    for event in events:

        # 👥 Participants count
        participants = frappe.db.count(
            "Event Participant",
            {"event": event.name}
        )

        # 💰 Expected revenue (from participants)
        expected = frappe.db.sql("""
            SELECT SUM(final_amount)
            FROM `tabEvent Participant`
            WHERE event = %s
        """, (event.name,))[0][0] or 0

        # 💵 Actual revenue (from payments)
        actual = frappe.db.sql("""
            SELECT SUM(amount)
            FROM `tabEvent Payment`
            WHERE event = %s AND docstatus = 1
        """, (event.name,))[0][0] or 0

        # 💸 Expense
        expense = frappe.db.get_value(
            "Destination Event",
            event.name,
            "total_expense"
        ) or 0

        # 📊 Profit
        profit = flt(actual) - flt(expense)

        # totals
        total_expected += expected
        total_actual += actual
        total_expense += expense
        total_participants += participants

        data.append({
            "event": event.name,
            "event_date": event.event_date,
            "participants": participants,
            "expected": expected,
            "actual": actual,
            "expense": expense,
            "profit": profit
        })

    return {
        "summary": {
            "events": len(events),
            "participants": total_participants,
            "expected": total_expected,
            "actual": total_actual,
            "expense": total_expense,
            "profit": total_actual - total_expense
        },
        "events": data
    }

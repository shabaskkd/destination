frappe.ui.form.on('Event Payment', {

    refresh(frm) {
        set_filters(frm);
        toggle_fields(frm);
    },

    event(frm) {
        set_filters(frm);
        clear_allocation(frm);
    },

    type(frm) {
        set_filters(frm);
        toggle_fields(frm);
        clear_allocation(frm);
    },

    participant(frm) {
        if (frm.doc.type === "Single") {
            load_single_participant(frm);
        }
    },

    family(frm) {
        if (frm.doc.type === "Family") {
            load_family_members(frm);
        }
    },

    amount(frm) {

        if (frm.doc.type === "Single") {

            let rows = frm.doc.payment_allocation || [];

            if (rows.length) {
                rows[0].allocated_amount = frm.doc.amount;
                frm.refresh_field("payment_allocation");
            }

        } else {
            allocate_payment(frm);
        }
    }
});


// 🔹 FILTERS (Event + Type)
function set_filters(frm) {

    // Participant filter
    frm.set_query("participant", function () {

        let filters = {
            event: frm.doc.event
        };

        // ✅ Only Single participants
        if (frm.doc.type === "Single") {
            filters.family_type = "Single";
        }

        return { filters: filters };
    });

    // Family filter
    frm.set_query("family", function () {
        return {
            filters: {
                event: frm.doc.event
            }
        };
    });
}


// 🔹 TOGGLE UI
function toggle_fields(frm) {

    if (frm.doc.type === "Single") {
        frm.set_df_property('participant', 'hidden', 0);
        frm.set_df_property('family', 'hidden', 1);
    } else {
        frm.set_df_property('participant', 'hidden', 1);
        frm.set_df_property('family', 'hidden', 0);
    }
}


// 🔹 CLEAR TABLE
function clear_allocation(frm) {
    frm.clear_table("payment_allocation");
    frm.refresh_field("payment_allocation");
}


// 🔹 LOAD SINGLE PARTICIPANT
function load_single_participant(frm) {

    if (!frm.doc.participant) return;

    frappe.db.get_doc("Event Participant", frm.doc.participant)
        .then(doc => {

            clear_allocation(frm);

            let row = frm.add_child("payment_allocation");
            row.participant = doc.name;
            row.email = doc.email;
            row.current_balance = doc.balance_amount;

            // ✅ show balance in form
            frm.set_value("participant_balance", doc.balance_amount);

            // ✅ full allocation for single
            row.allocated_amount = frm.doc.amount || doc.balance_amount;

            frm.refresh_field("payment_allocation");
        });
}


// 🔹 LOAD FAMILY MEMBERS
function load_family_members(frm) {

    if (!(frm.doc.family && frm.doc.event)) return;

    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Event Participant",
            filters: {
                family: frm.doc.family,
                event: frm.doc.event
            },
            fields: ["name", "email", "balance_amount"]
        },
        callback: function (r) {

            clear_allocation(frm);

            (r.message || []).forEach(p => {
                let row = frm.add_child("payment_allocation");
                row.participant = p.name;
                row.email = p.email;
                row.current_balance = p.balance_amount;
            });

            frm.refresh_field("payment_allocation");

            allocate_payment(frm);
        }
    });
}


// 🔥 SMART ALLOCATION (Family Only)
function allocate_payment(frm) {

    let total_payment = frm.doc.amount || 0;
    let rows = frm.doc.payment_allocation || [];

    if (!rows.length || total_payment <= 0) return;

    let total_balance = rows.reduce((sum, row) => {
        return sum + (row.current_balance || 0);
    }, 0);

    if (total_balance === 0) return;

    let remaining = total_payment;

    rows.forEach((row, index) => {

        let proportion = row.current_balance / total_balance;
        let allocation = flt(total_payment * proportion);

        // prevent over allocation
        allocation = Math.min(allocation, row.current_balance);

        // fix rounding on last row
        if (index === rows.length - 1) {
            allocation = remaining;
        }

        row.allocated_amount = allocation;
        remaining -= allocation;
    });

    frm.refresh_field("payment_allocation");
}

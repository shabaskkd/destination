// Copyright (c) 2026, Shabas and contributors
// For license information, please see license.txt

frappe.ui.form.on('Event Participant', {

    refresh: function(frm) {
        set_location_filter(frm);
        set_family_filter(frm);
    },

    // 🔹 1. AUTO AGE CATEGORY
    age: function(frm) {

        if (!frm.doc.age) return;

        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: "Age Category",
                fields: ["name", "min_age", "max_age"],
                limit_page_length: 100
            },
            callback: function(r) {

                if (r.message) {

                    let age = frm.doc.age;

                    let matched = r.message.find(row =>
                        age >= row.min_age && age <= row.max_age
                    );

                    if (matched) {
                        frm.set_value("age_category", matched.name);
                    } else {
                        frm.set_value("age_category", null);
                    }
                }
            }
        });

    },

    // 🔹 EVENT CHANGE
    event: function(frm) {
        set_location_filter(frm);
        set_family_filter(frm);
        fetch_pricing(frm);
    },

    // 🔹 AGE CATEGORY CHANGE
    age_category: function(frm) {
        set_location_filter(frm);
        fetch_pricing(frm);
    },

    // 🔹 LOCATION CHANGE
    location_category: function(frm) {
        fetch_pricing(frm);
    },

    // 🔹 FAMILY TYPE CHANGE
    family_type: function(frm) {
        if (frm.doc.family_type === "Single") {
            frm.set_value("family", null);
        }
    },

    // 🔹 DISCOUNT CHANGE
    discount: function(frm) {
        calculate_final(frm);
    },

    // 🔹 BASE AMOUNT CHANGE
    base_amount: function(frm) {
        calculate_final(frm);
    }

});


// 🔥 LOCATION FILTER
function set_location_filter(frm) {

    frm.set_query("location_category", function() {

        if (!(frm.doc.event && frm.doc.age_category)) {
            return {};
        }

        return {
            query: "dms_app.destination_management_system.doctype.event_participant.event_participant.get_location_categories",
            filters: {
                event: frm.doc.event,
                age_category: frm.doc.age_category
            }
        };
    });

}


// 🔥 FAMILY FILTER (EVENT BASED)
function set_family_filter(frm) {

    frm.set_query("family", function() {

        if (!frm.doc.event) {
            return {};
        }

        return {
            filters: {
                event: frm.doc.event
            }
        };
    });

}


// 🔥 FETCH BASE AMOUNT
function fetch_pricing(frm) {

    if (!(frm.doc.event && frm.doc.age_category && frm.doc.location_category)) return;

    frappe.call({
        method: "frappe.client.get_value",
        args: {
            doctype: "Event Pricing",
            filters: {
                event: frm.doc.event,
                age_category: frm.doc.age_category,
                location_category: frm.doc.location_category
            },
            fieldname: "base_amount"
        },
        callback: function(r) {

            if (r.message && r.message.base_amount) {
                frm.set_value("base_amount", r.message.base_amount);
                calculate_final(frm);
            } else {
                frm.set_value("base_amount", 0);
                frm.set_value("final_amount", 0);
                frm.set_value("balance_amount", 0);
            }

        }
    });
}


// 🔥 CALCULATE FINAL AMOUNT (AMOUNT BASED)
function calculate_final(frm) {

    let base = frm.doc.base_amount || 0;
    let discount = frm.doc.discount || 0;

    let final = base - discount;

    // ✅ prevent negative values
    if (final < 0) final = 0;

    frm.set_value("final_amount", final);
    frm.set_value("balance_amount", final);
}

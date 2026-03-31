frappe.pages['event-dashboard'].on_page_load = function(wrapper) {

    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Event Financial Dashboard',
        single_column: true
    });

    load_dashboard(page);
};


// 🔹 LOAD DATA
function load_dashboard(page) {

    frappe.call({
        method: "dms_app.page.event_dashboard.event_dashboard.get_dashboard_data",
        callback: function(r) {

            let data = r.message || {};

            let events = data.events || [];
            let participants = data.participants || [];

            $(page.body).empty();

            if (!events.length) {
                $(page.body).html("<div class='no-data'>No Data Available</div>");
                return;
            }

            render_summary(page, events);
            render_chart(page, events);
            render_event_table(page, events);
            render_participant_table(page, participants);
        }
    });
}


//////////////////////////////////////////////////////
// 🎯 SUMMARY (FIXED - USE EVENTS NOT PARTICIPANTS)
//////////////////////////////////////////////////////

function render_summary(page, events) {

    let expected = 0, actual = 0, expense = 0;

    events.forEach(e => {
        expected += e.expected || 0;
        actual += e.actual || 0;
        expense += e.expense || 0;
    });

    let balance = expected - actual;
    let profit = actual - expense;

    // ✅ NEW
    let total_events = events.length;
    let total_participants = events.reduce((sum, e) => sum + (e.participants || 0), 0);

    let html = `
        <div class="kpi-grid">

            ${kpi("Total Events", total_events, "#007bff")}  <!-- ✅ NEW -->
            ${kpi("Participants", total_participants, "#17a2b8")}

            ${kpi("Expected Revenue", expected, "#6c63ff")}
            ${kpi("Collected Revenue", actual, "#28a745")}
            ${kpi("Outstanding Balance", balance, "#ff9800")}
            ${kpi("Total Expense", expense, "#dc3545")}
            ${kpi("Profit", profit, profit >= 0 ? "#28a745" : "#dc3545")}

        </div>
    `;

    add_styles();
    $(page.body).append(html);
}


function kpi(title, value, color) {
    return `
        <div class="kpi-card" style="border-left:5px solid ${color}">
            <div class="kpi-title">${title}</div>
            <div class="kpi-value">${format_currency(value)}</div>
        </div>
    `;
}


//////////////////////////////////////////////////////
// 📊 CHART
//////////////////////////////////////////////////////

function render_chart(page, events) {

    let labels = events.map(e => e.event);
    let revenue = events.map(e => e.actual || 0);
    let expense = events.map(e => e.expense || 0);

    let html = `<div class="chart-box"><div id="chart"></div></div>`;
    $(page.body).append(html);

    new frappe.Chart("#chart", {
        data: {
            labels: labels,
            datasets: [
                { name: "Revenue", values: revenue },
                { name: "Expense", values: expense }
            ]
        },
        type: 'bar',
        height: 300
    });
}


//////////////////////////////////////////////////////
// 📋 EVENT TABLE
//////////////////////////////////////////////////////

function render_event_table(page, events) {

    let html = `
        <div class="section">
            <h3>Event Performance</h3>
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>Event</th>
                        <th>Participants</th>
                        <th>Expected</th>
                        <th>Collected</th>
                        <th>Expense</th>
                        <th>Profit</th>
                    </tr>
                </thead>
                <tbody>
                    ${events.map(e => `
                        <tr>
                            <td><b>${e.event}</b></td>
                            <td>${e.participants || 0}</td>
                            <td>${format_currency(e.expected)}</td>
                            <td>${format_currency(e.actual)}</td>
                            <td>${format_currency(e.expense)}</td>
                            <td>${profit_badge(e.profit)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;

    $(page.body).append(html);
}


//////////////////////////////////////////////////////
// 👥 PARTICIPANT TABLE
//////////////////////////////////////////////////////

function render_participant_table(page, participants) {

    if (!participants.length) return;

    let state = {
        data: participants,
        filtered: participants,
        page: 1,
        page_size: 10
    };

    let html = `
        <div class="section">

            <h3>Participant Financial Summary</h3>

            <!-- 🔍 SEARCH -->
            <input 
                type="text" 
                id="participant-search" 
                placeholder="Search participant or event..."
                style="margin-bottom:10px;padding:8px;width:300px;border-radius:6px;border:1px solid #ccc;"
            />

            <!-- 📋 TABLE -->
            <div id="participant-table"></div>

            <!-- 📄 PAGINATION -->
            <div id="pagination" style="margin-top:10px;"></div>

        </div>
    `;

    $(page.body).append(html);

    // 🔹 SEARCH EVENT
    $("#participant-search").on("input", function () {
        let text = $(this).val().toLowerCase();

        state.filtered = state.data.filter(p =>
            (p.participant || "").toLowerCase().includes(text) ||
            (p.event || "").toLowerCase().includes(text)
        );

        state.page = 1;
        render_table();
    });

    function render_table() {

        let start = (state.page - 1) * state.page_size;
        let end = start + state.page_size;

        let rows = state.filtered.slice(start, end);

        let table_html = `
            <table class="modern-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Event</th>
                        <th>Total</th>
                        <th>Paid</th>
                        <th>Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(p => `
                        <tr>
                            <td>${p.participant}</td>
                            <td>${p.event}</td>
                            <td>${format_currency(p.final)}</td>
                            <td>${format_currency(p.paid)}</td>
                            <td>${balance_badge(p.balance)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;

        $("#participant-table").html(table_html);

        render_pagination();
    }

    function render_pagination() {

        let total_pages = Math.ceil(state.filtered.length / state.page_size);

        let html = `
            <div style="display:flex;gap:10px;align-items:center;">
                <button ${state.page === 1 ? "disabled" : ""} id="prev-btn">Prev</button>
                <span>Page ${state.page} of ${total_pages || 1}</span>
                <button ${state.page === total_pages ? "disabled" : ""} id="next-btn">Next</button>
            </div>
        `;

        $("#pagination").html(html);

        $("#prev-btn").click(() => {
            state.page--;
            render_table();
        });

        $("#next-btn").click(() => {
            state.page++;
            render_table();
        });
    }

    // 🔹 INITIAL LOAD
    render_table();
}

//////////////////////////////////////////////////////
// 🎨 BADGES
//////////////////////////////////////////////////////

function status_badge(status) {

    let colors = {
        "Paid": "#28a745",
        "Partial": "#ff9800",
        "Pending": "#dc3545"
    };

    return `<span class="badge" style="background:${colors[status] || '#999'}">${status}</span>`;
}

function profit_badge(value) {
    let color = value >= 0 ? "#28a745" : "#dc3545";
    return `<span class="badge" style="background:${color}">${format_currency(value)}</span>`;
}


//////////////////////////////////////////////////////
// 🎨 STYLES
//////////////////////////////////////////////////////

function add_styles() {

    if ($("#custom-dashboard-style").length) return;

    let style = `
        <style id="custom-dashboard-style">

        .kpi-grid {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            margin-bottom: 20px;
        }

        .kpi-card {
            background: #fff;
            padding: 15px;
            border-radius: 10px;
            min-width: 180px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        }

        .kpi-title {
            font-size: 12px;
            color: #777;
        }

        .kpi-value {
            font-size: 20px;
            font-weight: bold;
            margin-top: 5px;
        }

        .chart-box {
            background: #fff;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        }

        .section {
            margin-top: 25px;
        }

        .modern-table {
            width: 100%;
            border-collapse: collapse;
            background: #fff;
            border-radius: 10px;
            overflow: hidden;
        }

        .modern-table th {
            background: #f5f6fa;
            padding: 10px;
            text-align: left;
        }

        .modern-table td {
            padding: 10px;
            border-top: 1px solid #eee;
        }

        .modern-table tr:hover {
            background: #f9f9f9;
        }

        .badge {
            padding: 5px 10px;
            border-radius: 20px;
            color: #fff;
            font-size: 12px;
        }

        .no-data {
            text-align: center;
            margin-top: 50px;
            font-size: 18px;
            color: #999;
        }

        </style>
    `;

    $("head").append(style);
}

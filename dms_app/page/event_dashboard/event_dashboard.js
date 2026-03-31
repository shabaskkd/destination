frappe.pages['event-dashboard'].on_page_load = function(wrapper) {

    let page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Event Dashboard',
        single_column: true
    });

    load_dashboard(page);
};


// 🔹 LOAD DATA
function load_dashboard(page) {

    frappe.call({
        method: "dms_app.page.event_dashboard.event_dashboard.get_dashboard_data",
        callback: function(r) {

            let data = r.message;

            $(page.body).empty();

            render_summary(page, data.summary);
            render_chart(page, data.events);
            render_table(page, data.events);
        }
    });
}


// 🔹 SUMMARY CARDS
function render_summary(page, summary) {

    let html = `
        <div style="display:flex;gap:15px;flex-wrap:wrap;margin-bottom:20px">

            ${card("Total Events", summary.events)}
            ${card("Participants", summary.participants)}
            ${card("Expected Revenue", summary.expected)}
            ${card("Actual Revenue", summary.actual)}
            ${card("Total Expense", summary.expense)}
            ${card("Profit", summary.profit)}

        </div>
    `;

    $(page.body).append(html);
}


// 🔹 CARD TEMPLATE
function card(title, value) {
    return `
        <div style="
            background:#ffffff;
            padding:15px;
            border-radius:10px;
            box-shadow:0 2px 8px rgba(0,0,0,0.1);
            min-width:200px;">
            
            <div style="font-size:12px;color:#777">${title}</div>
            <div style="font-size:20px;font-weight:bold;margin-top:5px">
                ${format_currency(value)}
            </div>
        </div>
    `;
}


// 🔹 CHART
function render_chart(page, events) {

    let labels = events.map(e => e.event);
    let revenue = events.map(e => e.actual);
    let expense = events.map(e => e.expense);

    let chart_html = `<div id="chart" style="height:300px;margin-bottom:30px;"></div>`;
    $(page.body).append(chart_html);

    new frappe.Chart("#chart", {
        data: {
            labels: labels,
            datasets: [
                { name: "Revenue", values: revenue },
                { name: "Expense", values: expense }
            ]
        },
        type: 'bar',
        height: 300,
        colors: ["#28a745", "#dc3545"]
    });
}


// 🔹 TABLE
function render_table(page, events) {

    let html = `
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Event</th>
                    <th>Participants</th>
                    <th>Expected</th>
                    <th>Actual</th>
                    <th>Expense</th>
                    <th>Profit</th>
                </tr>
            </thead>
            <tbody>
                ${events.map(e => `
                    <tr>
                        <td>${e.event}</td>
                        <td>${e.participants}</td>
                        <td>${format_currency(e.expected)}</td>
                        <td>${format_currency(e.actual)}</td>
                        <td>${format_currency(e.expense)}</td>
                        <td>${format_currency(e.profit)}</td>
                    </tr>
                `).join("")}
            </tbody>
        </table>
    `;

    $(page.body).append(html);
}

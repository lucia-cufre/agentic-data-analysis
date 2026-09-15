// charts implementation code file
const CHART_COLORS = ["#6ea8fe", "#f4a4b8", "#8fd4a8", "#f7c76b", "#b9a0e8"];

export function addCharts(charts) {
  charts.forEach((chart, i) => {
    const wrapper = document.createElement("div");
    wrapper.className = "chart-wrapper";
    const canvas = document.createElement("canvas");
    wrapper.appendChild(canvas);
    messagesEl.appendChild(wrapper);

    new Chart(canvas, {
      type: chart.type,
      data: {
        labels: chart.labels,
        datasets: chart.series.map((s, j) => ({
          label: s.name,
          data: s.values,
          backgroundColor: CHART_COLORS[(i + j) % CHART_COLORS.length],
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: chart.title },
          subtitle: {
            display: !!chart.description,
            text: chart.description ?? "",
          },
        },
      },
    });
  });
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
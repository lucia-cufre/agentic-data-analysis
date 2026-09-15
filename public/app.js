const messagesEl = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const submitButton = form.querySelector("button[type='submit']");
const exampleButtons = document.querySelectorAll(".example-question");

let conversationId = null;

function agentIsLoading(isLoading) {
  input.disabled = isLoading;
  submitButton.disabled = isLoading;
  exampleButtons.forEach((btn) => (btn.disabled = isLoading));
}

function addMessage(classNames, text) {
  const el = document.createElement("div");
  el.classList.add("message", ...classNames.split(" "));
  el.textContent = text;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

function addCharts(charts) {
  for (const chart of charts) {
    const wrapper = document.createElement("div");
    wrapper.className = "chart-wrapper";
    const canvas = document.createElement("canvas");
    wrapper.appendChild(canvas);
    messagesEl.appendChild(wrapper);

    new Chart(canvas, {
      type: chart.type,
      data: {
        labels: chart.labels,
        datasets: chart.series.map((s) => ({
          label: s.name,
          data: s.values,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: true, text: chart.title },
        },
      },
    });
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendQuestion(question) {
  addMessage("user", question);
  input.value = "";
  agentIsLoading(true);

  const pending = addMessage("assistant pending", "Thinking...");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, conversationId }),
    });

    const data = await response.json();
    pending.remove();

    if (!response.ok) {
      addMessage("assistant error", data.error ?? "Something went wrong.");
      return;
    }

    conversationId = data.conversationId;
    addMessage("assistant", data.text);
    if (data.charts?.length > 0) {
      addCharts(data.charts);
    }
  } catch (err) {
    pending.remove();
    addMessage("assistant error", "Failed to reach the server.");
  } finally {
    agentIsLoading(false);
    input.focus();
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const question = input.value.trim();
  if (!question) return;
  sendQuestion(question);
});

exampleButtons.forEach((btn) => {
  btn.addEventListener("click", () => sendQuestion(btn.textContent.trim()));
});

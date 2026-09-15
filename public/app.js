import { addCharts } from "./charts";

const messagesEl = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const submitButton = form.querySelector("button[type='submit']");
const exampleButtons = document.querySelectorAll(".example-question");

let conversationId = null;

function agentIsThinking(isThinking) {
  input.disabled = isThinking;
  submitButton.disabled = isThinking;
  exampleButtons.forEach((button) => (button.disabled = isThinking));
}

function addMessage(senderType, text) {
  const el = document.createElement("div");
  el.classList.add("message", ...senderType.split(" "));
  el.textContent = text;
  messagesEl.appendChild(el);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return el;
}

async function sendQuestion(question) {
  addMessage("user", question);
  input.value = "";
  agentIsThinking(true);

  const pending = addMessage("assistant pending", "Thinking...");

  try {
    const response = await fetch("/api/call-agents/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question, conversationId }),
    });

    const data = await response.json();
    pending.remove();

    if (!response.ok) {
      addMessage("assistant error", data.error ?? "The assistant couldn't process that question. Please try again.");
      return;
    }

    conversationId = data.conversationId;
    addMessage("assistant", data.text);
    if (data.charts?.length > 0) {
      addCharts(data.charts);
    }
  } catch (err) {
    pending.remove();
    console.error("Error sending question:", err);
    addMessage("assistant error", "Couldn't reach the server. Check your connection and try again.");
  } finally {
    agentIsThinking(false);
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

const coachForm = document.querySelector("#coach-form");
const messageInput = document.querySelector("#commit-message");
const messageCount = document.querySelector("#message-count");
const coachResults = document.querySelector("#coach-results");
const coachChecklist = document.querySelector("#coach-checklist");

messageInput.addEventListener("input", () => {
  messageCount.textContent = `${messageInput.value.trim().length} / 72 characters`;
});

coachForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = messageInput.value.trim();
  const checks = [];

  if (message.length <= 72) {
    checks.push({ good: true, text: "The message is short enough." });
  } else {
    checks.push({ good: false, text: "Shorten the message to 72 characters or fewer." });
  }

  if (message.length >= 10 && !isTooVague(message)) {
    checks.push({ good: true, text: "The message says what changed." });
  } else {
    checks.push({ good: false, text: "Add what you changed. For example: ‘Fix login form validation’." });
  }

  if (startsWithAction(message)) {
    checks.push({ good: true, text: "The message starts with an action." });
  } else {
    checks.push({ good: false, text: "Try starting with an action, like Add, Fix, Update, Remove, or Test." });
  }

  showSuggestions(checks);
});

function isTooVague(message) {
  const vagueMessages = [
    /^save (the )?(new )?changes?$/i,
    /^new changes?$/i,
    /^changes?$/i,
    /^update$/i,
    /^work(ed)? on it$/i,
    /^fix(ed)? (the )?(stuff|things?|errors?|bugs?)$/i,
    /^asdf+$/i,
    /^done$/i,
  ];

  return vagueMessages.some((pattern) => pattern.test(message));
}

function startsWithAction(message) {
  const actionWords = /^(add|fix|update|remove|improve|document|test|refactor|create|change|replace|handle|prevent|show|allow|support)\b/i;
  return actionWords.test(message);
}

function showSuggestions(checks) {
  coachChecklist.replaceChildren();

  for (const check of checks) {
    const item = document.createElement("li");
    item.className = check.good ? "coach-check good" : "coach-check needs-work";

    const mark = document.createElement("span");
    mark.setAttribute("aria-hidden", "true");
    mark.textContent = check.good ? "✓" : "→";

    const text = document.createElement("span");
    text.textContent = check.text;

    item.append(mark, text);
    coachChecklist.append(item);
  }

  coachResults.classList.remove("hidden");
}

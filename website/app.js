const form = document.querySelector("#analyze-form");
const statusMessage = document.querySelector("#status");
const analyzeButton = document.querySelector("#analyze-button");
const results = document.querySelector("#results");
const sessionForm = document.querySelector("#session-form");
const API_URL = "/api/analyze";
let currentSessions = [];
let currentCommits = [];
let currentRepoKey = "";

// Start the session form with today's date and time.
sessionForm.elements.start.value = getLocalDateTime();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusMessage.textContent = "Reading your commits...";
  statusMessage.classList.remove("error");
  analyzeButton.disabled = true;

  const values = new FormData(form);
  const query = new URLSearchParams({
    repo: values.get("repo").trim(),
    author: values.get("author").trim(),
  });

  try {
    const response = await fetch(`${API_URL}?${query}`);

    // Explain the problem if a different web server returns a web page here.
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(
        "Git-Mood got a web page instead of report data. Start it with 'python web_app.py' in the Git-Mood folder."
      );
    }

    const report = await response.json();

    if (!response.ok) {
      throw new Error(report.error || "Git-Mood could not read that project.");
    }

    showReport(report, values.get("author").trim(), values.get("repo").trim());
    statusMessage.textContent = "Your report is ready.";
  } catch (error) {
    statusMessage.textContent = error instanceof TypeError
      ? "Git-Mood could not connect. Start it with 'python web_app.py', then open http://127.0.0.1:8000."
      : error.message;
    statusMessage.classList.add("error");
    results.classList.add("hidden");
  } finally {
    analyzeButton.disabled = false;
  }
});

sessionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const values = new FormData(sessionForm);
  const session = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    start: values.get("start"),
    duration: Number(values.get("duration")),
    difficulty: Number(values.get("difficulty")),
    mood: values.get("mood"),
  };

  if (!session.start || session.duration < 5 || session.duration > 720) {
    showSessionStatus("Enter a start time and choose 5 to 720 minutes.", true);
    return;
  }

  currentSessions.unshift(session);
  if (!saveSessions(currentRepoKey, currentSessions)) {
    currentSessions.shift();
    showSessionStatus("Git-Mood could not save this work note in your browser.", true);
    return;
  }

  sessionForm.elements.duration.value = "";
  sessionForm.elements.start.value = getLocalDateTime();
  showSessionStatus("Work note saved in this browser.");
  renderSessions();
});

function showReport(report, author, repo) {
  document.querySelector("#total-commits").textContent = report.totals.commits;
  showBugFixRatio(report.totals);
  showPeakHour(report.hours);
  showAfterMidnightPattern(report.hours, report.totals.fixes);
  showFileSpread(report.file_spread);
  showRapidRework(report.totals);
  showHotspots(report.hotspots);
  showFilePairs(report.file_pairs);
  document.querySelector("#author-label").textContent = author ? `Git author: ${author}` : "All authors";

  drawChart("#hour-chart", report.hours);
  drawChart("#day-chart", report.days);
  drawCalendar(report.commits);
  showCommits(report.commits);
  currentRepoKey = makeRepoKey(repo);
  currentCommits = report.commits;
  currentSessions = loadSessions(currentRepoKey);
  renderSessions();
  results.classList.remove("hidden");
}

function makeRepoKey(repo) {
  return `gitMoodSessions:${repo.trim().toLowerCase()}`;
}

function loadSessions(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function saveSessions(key, sessions) {
  try {
    localStorage.setItem(key, JSON.stringify(sessions));
    return true;
  } catch {
    return false;
  }
}

function getLocalDateTime() {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 16);
}

function renderSessions() {
  const summary = document.querySelector("#session-summary");
  const list = document.querySelector("#session-list");
  summary.replaceChildren();
  list.replaceChildren();

  if (!currentSessions.length) {
    const empty = document.createElement("p");
    empty.className = "session-empty";
    empty.textContent = "No work notes yet. Add one after a coding session to see your patterns.";
    list.append(empty);
    return;
  }

  const averageMinutes = Math.round(
    currentSessions.reduce((total, session) => total + session.duration, 0) / currentSessions.length
  );
  addSessionSummary(summary, "WORK SESSIONS", String(currentSessions.length));
  addSessionSummary(summary, "AVERAGE TIME", formatDuration(averageMinutes));
  addSessionSummary(summary, "AVERAGE TASK DIFFICULTY", getAverageDifficulty());

  const moodTotals = {};
  for (const session of currentSessions) {
    const matches = getSessionCommits(session);
    if (!moodTotals[session.mood]) {
      moodTotals[session.mood] = { sessions: 0, commits: 0, fixes: 0 };
    }
    moodTotals[session.mood].sessions += 1;
    moodTotals[session.mood].commits += matches.length;
    moodTotals[session.mood].fixes += matches.filter((commit) => commit.possible_fix).length;
  }

  const pattern = document.createElement("p");
  pattern.className = "session-pattern";
  pattern.textContent = Object.entries(moodTotals)
    .map(([mood, totals]) => `${capitalize(mood)}: ${totals.sessions} ${totals.sessions === 1 ? "session" : "sessions"}, ${totals.fixes} possible fixes in ${totals.commits} commits`)
    .join(". ");
  summary.append(pattern);

  for (const session of currentSessions) {
    const matches = getSessionCommits(session);
    const fixes = matches.filter((commit) => commit.possible_fix).length;
    const row = document.createElement("article");
    row.className = "session-row";

    const details = document.createElement("div");
    details.className = "session-row-main";
    const title = document.createElement("strong");
    title.textContent = formatSessionDate(session.start);
    const facts = document.createElement("span");
    facts.textContent = `${formatDuration(session.duration)} · Mood: ${capitalize(session.mood)} · Difficulty: ${session.difficulty} of 5`;
    const comparison = document.createElement("span");
    comparison.className = "session-match";
    comparison.textContent = matches.length
      ? `${matches.length} ${matches.length === 1 ? "commit" : "commits"}; ${fixes} possible fixes during this session`
      : "No commits found during this session";
    details.append(title, facts, comparison);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "session-remove";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove work note from ${title.textContent}`);
    remove.addEventListener("click", () => removeSession(session.id));

    row.append(details, remove);
    list.append(row);
  }
}

function getSessionCommits(session) {
  const start = new Date(session.start).getTime();
  const end = start + session.duration * 60 * 1000;
  return currentCommits.filter((commit) => {
    const commitTime = new Date(commit.date).getTime();
    return commitTime >= start && commitTime <= end;
  });
}

function getAverageDifficulty() {
  const average = currentSessions.reduce((total, session) => total + session.difficulty, 0) / currentSessions.length;
  return `${average.toFixed(1)} / 5`;
}

function addSessionSummary(container, labelText, valueText) {
  const item = document.createElement("div");
  item.className = "session-summary-item";
  const label = document.createElement("span");
  label.textContent = labelText;
  const value = document.createElement("strong");
  value.textContent = valueText;
  item.append(label, value);
  container.append(item);
}

function removeSession(id) {
  currentSessions = currentSessions.filter((session) => session.id !== id);
  saveSessions(currentRepoKey, currentSessions);
  renderSessions();
  showSessionStatus("Work note removed.");
}

function showSessionStatus(message, isError = false) {
  const status = document.querySelector("#session-status");
  status.textContent = message;
  status.classList.toggle("error", isError);
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const extraMinutes = minutes % 60;
  if (!hours) return `${extraMinutes} min`;
  return extraMinutes ? `${hours} hr ${extraMinutes} min` : `${hours} hr`;
}

function formatSessionDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function showRapidRework(totals) {
  const rate = totals.file_changing_commits
    ? Math.round((totals.rapid_followups / totals.file_changing_commits) * 100)
    : null;

  document.querySelector("#rework-rate").textContent = rate === null ? "No data" : `${rate}%`;
  document.querySelector("#rework-count").textContent = rate === null
      ? "No changed files in this report"
    : `${totals.rapid_followups} of ${totals.file_changing_commits} commits changed a file again within 24 hours`;
}

function showHotspots(files) {
  const list = document.querySelector("#hotspot-list");
  list.replaceChildren();

  if (!files.length) {
    const message = document.createElement("p");
    message.className = "hotspot-empty";
    message.textContent = "No changed files in this report.";
    list.append(message);
    return;
  }

  const mostChanges = Math.max(...files.map((file) => file.commits), 1);

  for (const file of files) {
    const row = document.createElement("div");
    row.className = "hotspot-row";

    const top = document.createElement("div");
    top.className = "hotspot-top";
    const name = document.createElement("span");
    name.className = "hotspot-name";
    name.textContent = file.file;
    const count = document.createElement("span");
    count.className = "hotspot-count";
    count.textContent = `${file.commits} commits`;
    top.append(name, count);

    const bar = document.createElement("div");
    bar.className = "hotspot-bar";
    const fill = document.createElement("span");
    fill.style.width = `${(file.commits / mostChanges) * 100}%`;
    bar.append(fill);

    const detail = document.createElement("span");
    detail.className = "hotspot-detail";
    const timesText = file.revisits === 1 ? "1 time" : `${file.revisits} times`;
    detail.textContent = `Changed again ${timesText} within 24 hours`;

    row.append(top, bar, detail);
    list.append(row);
  }
}

function showFilePairs(pairs) {
  const list = document.querySelector("#file-pairs");
  list.replaceChildren();

  if (!pairs.length) {
    const message = document.createElement("p");
    message.className = "hotspot-empty";
    message.textContent = "No commits changed two or more files.";
    list.append(message);
    return;
  }

  for (const pair of pairs) {
    const row = document.createElement("div");
    row.className = "file-pair-row";

    const files = document.createElement("div");
    files.className = "file-pair-names";
    const firstFile = document.createElement("code");
    firstFile.textContent = pair.first_file;
    const plus = document.createElement("span");
    plus.textContent = "+";
    const secondFile = document.createElement("code");
    secondFile.textContent = pair.second_file;
    files.append(firstFile, plus, secondFile);

    const count = document.createElement("span");
    count.className = "file-pair-count";
    count.textContent = `${pair.commits} ${pair.commits === 1 ? "commit" : "commits"}`;

    row.append(files, count);
    list.append(row);
  }
}

function showBugFixRatio(totals) {
  const ratio = Math.round((totals.fixes / totals.commits) * 100);
  document.querySelector("#bug-ratio").textContent = `${ratio}%`;
  document.querySelector("#bug-ratio-detail").textContent =
    `${totals.fixes} of ${totals.commits} commits had fix words`;
}

function showPeakHour(hours) {
  const busiestHour = hours.reduce((best, hour) =>
    hour.commits > best.commits ? hour : best
  );

  document.querySelector("#peak-hour").textContent = busiestHour.label;
}

function showAfterMidnightPattern(hours, allFixes) {
  // After midnight means 12 AM to just before 5 AM.
  const afterMidnightHours = hours.filter((hour) => {
    const hourNumber = Number(hour.label.slice(0, 2));
    return hourNumber < 5;
  });

  const afterMidnightFixes = afterMidnightHours.reduce(
    (total, hour) => total + hour.fixes,
    0
  );
  const shareValue = document.querySelector("#after-midnight-share");
  const shareDetail = document.querySelector("#after-midnight-detail");
  const insight = document.querySelector("#personal-insight");

  if (allFixes === 0) {
    shareValue.textContent = "No data";
    shareDetail.textContent = "No commit messages looked like possible fixes";
    insight.textContent =
      "No commit messages looked like fixes. Git-Mood guesses from words like ‘fix’ or ‘bug’.";
    return;
  }

  const share = Math.round((afterMidnightFixes / allFixes) * 100);
  shareValue.textContent = `${share}%`;
  shareDetail.textContent = `${afterMidnightFixes} of ${allFixes} possible fixes were from midnight to 5 AM`;
  insight.textContent =
    `${afterMidnightFixes} of ${allFixes} possible fixes were in commits from midnight to 5 AM. This shows a pattern; it does not prove late hours caused bugs.`;
}

function showFileSpread(report) {
  document.querySelector("#files-per-hour").textContent = report.average_files_per_hour;

  const note = document.querySelector("#file-spread-note");
  note.textContent = `Across ${report.active_hours} hours with commits. High spread means ${report.high_spread_threshold} or more files in one hour.`;
  const comparison = document.querySelector("#file-spread-comparison");
  comparison.classList.add("hidden");

  if (!report.comparison_available) {
    note.textContent += " Not enough data yet to compare fix messages between the two groups.";
    return;
  }

  comparison.classList.remove("hidden");
  showSpreadRate("#high-spread-rate", "#high-spread-detail", report.high_spread);
  showSpreadRate("#low-spread-rate", "#low-spread-detail", report.lower_spread);
}

function showSpreadRate(rateTarget, detailTarget, group) {
  document.querySelector(rateTarget).textContent = `${group.fix_percent}%`;
  document.querySelector(detailTarget).textContent =
    `${group.fixes} of ${group.commits} commits across ${group.hours} hours`;
}

function drawChart(target, rows) {
  const chart = document.querySelector(target);
  chart.replaceChildren();
  const biggestCount = Math.max(...rows.map((row) => row.commits), 1);

  for (const row of rows) {
    const chartRow = document.createElement("div");
    chartRow.className = "chart-row";

    const label = document.createElement("span");
    label.className = "chart-label";
    label.textContent = row.label;

    const track = document.createElement("div");
    track.className = "bar-track";
    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.width = `${(row.commits / biggestCount) * 100}%`;
    track.append(bar);

    const detail = document.createElement("span");
    detail.className = "chart-detail";
    detail.textContent = `${row.commits} commits · ${row.fix_percent}% have fix words`;

    chartRow.append(label, track, detail);
    chart.append(chartRow);
  }
}

function drawCalendar(commits) {
  const calendar = document.querySelector("#commit-calendar");
  calendar.replaceChildren();

  const commitsByDate = new Map();
  for (const commit of commits) {
    const date = commit.time.slice(0, 10);
    commitsByDate.set(date, (commitsByDate.get(date) || 0) + 1);
  }

  const dates = [...commitsByDate.keys()].sort();
  const latestDay = dates[dates.length - 1];
  if (!latestDay) return;

  const [year, month, day] = latestDay.split("-").map(Number);
  const endDate = new Date(year, month - 1, day, 12);
  endDate.setDate(endDate.getDate() + ((6 - endDate.getDay() + 7) % 7));
  const firstDate = new Date(endDate);
  firstDate.setDate(firstDate.getDate() - 90);

  const datesInPeriod = dates.filter((date) => {
    const dateValue = new Date(`${date}T12:00:00`);
    return dateValue >= firstDate && dateValue <= endDate;
  });
  const activeDays = datesInPeriod.length;
  const mostCommits = Math.max(
    0,
    ...datesInPeriod.map((date) => commitsByDate.get(date))
  );

  document.querySelector("#active-days").textContent = activeDays;
  document.querySelector("#busiest-day").textContent = mostCommits;
  document.querySelector("#calendar-range").textContent = `13 weeks ending ${endDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  const dateCursor = new Date(firstDate);
  for (let dayNumber = 0; dayNumber < 91; dayNumber += 1) {
    const dateText = [
      dateCursor.getFullYear(),
      String(dateCursor.getMonth() + 1).padStart(2, "0"),
      String(dateCursor.getDate()).padStart(2, "0"),
    ].join("-");
    const count = commitsByDate.get(dateText) || 0;
    const level = count === 0 ? 0 : count < 2 ? 1 : count < 4 ? 2 : count < 7 ? 3 : 4;
    const cell = document.createElement("span");
    cell.className = `calendar-day level-${level}`;
    cell.title = `${dateText}: ${count} ${count === 1 ? "commit" : "commits"}`;
    cell.setAttribute("aria-label", cell.title);
    calendar.append(cell);
    dateCursor.setDate(dateCursor.getDate() + 1);
  }
}

function showCommits(commits) {
  const list = document.querySelector("#commit-list");
  list.replaceChildren();

  for (const commit of commits) {
    const row = document.createElement("tr");
    const dateCell = document.createElement("td");
    const messageCell = document.createElement("td");
    const linesCell = document.createElement("td");

    dateCell.textContent = commit.time;
    messageCell.textContent = commit.message;
    linesCell.textContent = `+${commit.added} / -${commit.removed}`;

    if (commit.possible_fix) {
      const tag = document.createElement("span");
      tag.className = "fix-tag";
      tag.textContent = "possible fix";
      messageCell.append(tag);
    }

    if (commit.rapid_followup) {
      const tag = document.createElement("span");
      tag.className = "rework-tag";
      tag.textContent = "file changed again";
      messageCell.append(tag);
    }

    row.append(dateCell, messageCell, linesCell);
    list.append(row);
  }
}

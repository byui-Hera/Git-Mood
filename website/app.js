const form = document.querySelector("#analyze-form");
const statusMessage = document.querySelector("#status");
const analyzeButton = document.querySelector("#analyze-button");
const results = document.querySelector("#results");
const API_URL = "/api/analyze";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusMessage.textContent = "Looking at your saved changes...";
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
        "Git-Mood could not load your report. Start it by running 'python web_app.py' in the Git-Mood folder."
      );
    }

    const report = await response.json();

    if (!response.ok) {
      throw new Error(report.error || "Git-Mood could not read that project.");
    }

    showReport(report, values.get("author").trim());
    statusMessage.textContent = "Analysis complete.";
  } catch (error) {
    statusMessage.textContent = error instanceof TypeError
      ? "Git-Mood could not connect. In PowerShell, run 'python web_app.py' in the Git-Mood folder, then open http://127.0.0.1:8000."
      : error.message;
    statusMessage.classList.add("error");
    results.classList.add("hidden");
  } finally {
    analyzeButton.disabled = false;
  }
});

function showReport(report, author) {
  document.querySelector("#total-commits").textContent = report.totals.commits;
  showBugFixRatio(report.totals);
  showPeakHour(report.hours);
  showAfterMidnightPattern(report.hours, report.totals.fixes);
  showRapidRework(report.totals);
  showHotspots(report.hotspots);
  document.querySelector("#author-label").textContent = author ? `Author: ${author}` : "All authors";

  drawChart("#hour-chart", report.hours);
  drawChart("#day-chart", report.days);
  showCommits(report.commits);
  results.classList.remove("hidden");
}

function showRapidRework(totals) {
  const rate = totals.file_changing_commits
    ? Math.round((totals.rapid_followups / totals.file_changing_commits) * 100)
    : null;

  document.querySelector("#rework-rate").textContent = rate === null ? "No data" : `${rate}%`;
  document.querySelector("#rework-count").textContent = rate === null
    ? "No changed files were found"
    : `${totals.rapid_followups} of ${totals.file_changing_commits} saves changed a file again within a day`;
}

function showHotspots(files) {
  const list = document.querySelector("#hotspot-list");
  list.replaceChildren();

  if (!files.length) {
    const message = document.createElement("p");
    message.className = "hotspot-empty";
    message.textContent = "No changed files were found in this commit history.";
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
    detail.textContent = `File changed again ${timesText} within a day`;

    row.append(top, bar, detail);
    list.append(row);
  }
}

function showBugFixRatio(totals) {
  const ratio = Math.round((totals.fixes / totals.commits) * 100);
  document.querySelector("#bug-ratio").textContent = `${ratio}%`;
  document.querySelector("#bug-ratio-detail").textContent =
    `${totals.fixes} possible fixes out of ${totals.commits} saved changes`;
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
    shareDetail.textContent = "No saved changes looked like possible fixes";
    insight.textContent =
      "Git-Mood did not find messages that looked like fixes. It only guesses from words in the messages.";
    return;
  }

  const share = Math.round((afterMidnightFixes / allFixes) * 100);
  shareValue.textContent = `${share}%`;
  shareDetail.textContent = `${afterMidnightFixes} of ${allFixes} possible fixes, midnight to 5 AM`;
  insight.textContent =
    `${afterMidnightFixes} of ${allFixes} possible fixes happened between midnight and 5 AM. This is a pattern, not proof that late hours caused bugs.`;
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
    detail.textContent = `${row.commits} saved changes · ${row.fix_percent}% possible fixes`;

    chartRow.append(label, track, detail);
    chart.append(chartRow);
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
      tag.textContent = "maybe a fix";
      messageCell.append(tag);
    }

    if (commit.rapid_followup) {
      const tag = document.createElement("span");
      tag.className = "rework-tag";
      tag.textContent = "changed again";
      messageCell.append(tag);
    }

    row.append(dateCell, messageCell, linesCell);
    list.append(row);
  }
}

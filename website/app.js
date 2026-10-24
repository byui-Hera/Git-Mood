const form = document.querySelector("#analyze-form");
const statusMessage = document.querySelector("#status");
const analyzeButton = document.querySelector("#analyze-button");
const results = document.querySelector("#results");
const API_URL = "/api/analyze";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusMessage.textContent = "Reading Git history...";
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
        "Git-Mood did not return results. Make sure 'python web_app.py' is running in the Git-Mood folder."
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
      ? "Could not reach Git-Mood. Run 'python web_app.py' in PowerShell, then open http://127.0.0.1:8000 in Chrome or Edge."
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
  document.querySelector("#author-label").textContent = author ? `Author: ${author}` : "All authors";

  drawChart("#hour-chart", report.hours);
  drawChart("#day-chart", report.days);
  showCommits(report.commits);
  results.classList.remove("hidden");
}

function showBugFixRatio(totals) {
  const ratio = Math.round((totals.fixes / totals.commits) * 100);
  document.querySelector("#bug-ratio").textContent = `${ratio}%`;
  document.querySelector("#bug-ratio-detail").textContent =
    `${totals.fixes} possible fixes out of ${totals.commits} commits`;
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
    shareDetail.textContent = "No commits matched the possible-fix keywords";
    insight.textContent =
      "No possible fixes were flagged in this history. Git-Mood guesses from commit-message keywords, so its results depend on how commits are described.";
    return;
  }

  const share = Math.round((afterMidnightFixes / allFixes) * 100);
  shareValue.textContent = `${share}%`;
  shareDetail.textContent = `${afterMidnightFixes} of ${allFixes} possible fixes, 12–4:59 AM`;
  insight.textContent =
    `${share}% of commits flagged as possible fixes were made after midnight (${afterMidnightFixes} of ${allFixes}). This is a pattern in the history, not proof that the time caused bugs. It may help you choose when to schedule focused coding.`;
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
    detail.textContent = `${row.commits} commits · ${row.fix_percent}% possible fixes`;

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
      tag.textContent = "possible fix";
      messageCell.append(tag);
    }

    row.append(dateCell, messageCell, linesCell);
    list.append(row);
  }
}

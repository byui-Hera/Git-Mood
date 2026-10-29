"""Start Git-Mood's local website."""

from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
import json

from git_mood import add_commit, get_commits


# Find the folder that holds the website files.
WEBSITE_FOLDER = Path(__file__).resolve().parent / "website"
# Python uses these names to label weekdays.
DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
# These words are guesses that a commit may be about a fix.
FIX_WORDS = ("fix", "bug", "oops", "error")
FOLLOW_UP_HOURS = 24
HIGH_FILE_SPREAD = 4


def make_rows(summary, names):
    """Put the counts into a format the website can use."""
    rows = []

    # Make one row for each hour or weekday with commits.
    for group in sorted(summary):
        counts = summary[group]
        fix_percent = counts["fixes"] / counts["commits"] * 100
        rows.append(
            {
                "label": names[group],
                "commits": counts["commits"],
                "fixes": counts["fixes"],
                "fix_percent": round(fix_percent),
                "short": counts["short"],
                "added": counts["added"],
                "removed": counts["removed"],
            }
        )

    return rows


def mark_rapid_followups(commits):
    """Mark commits whose files were changed again within a day."""
    # Check commits from newest to oldest, so we can find a later edit.
    newest_first = sorted(
        commits,
        key=lambda commit: datetime.fromisoformat(commit["date"]),
        reverse=True,
    )
    latest_file_time = {}
    followups = 0
    file_changing_commits = 0

    for commit in newest_first:
        commit_time = datetime.fromisoformat(commit["date"])
        files = commit.get("files", [])
        revisited_files = [
            file_name
            for file_name in files
            if file_name in latest_file_time
            and 0 <= (latest_file_time[file_name] - commit_time).total_seconds()
            <= FOLLOW_UP_HOURS * 60 * 60
        ]

        commit["rapid_followup_files"] = revisited_files
        commit["rapid_followup"] = bool(revisited_files)
        if files:
            file_changing_commits += 1
            if revisited_files:
                followups += 1

            # Keep the closest later commit that touched each file.
            for file_name in files:
                latest_file_time.setdefault(file_name, commit_time)

    return followups, file_changing_commits


def summarize_file_spread(commits):
    """Count how many different files change in each active hour."""
    hour_groups = {}

    for commit in commits:
        commit_time = datetime.fromisoformat(commit["date"])
        hour_key = commit_time.strftime("%Y-%m-%d %H")
        if hour_key not in hour_groups:
            hour_groups[hour_key] = {"files": set(), "commits": 0, "fixes": 0}

        group = hour_groups[hour_key]
        group["files"].update(commit.get("files", []))
        group["commits"] += 1
        if any(word in commit["message"].lower() for word in FIX_WORDS):
            group["fixes"] += 1

    hours = list(hour_groups.values())
    high_spread = [hour for hour in hours if len(hour["files"]) >= HIGH_FILE_SPREAD]
    lower_spread = [hour for hour in hours if len(hour["files"]) < HIGH_FILE_SPREAD]
    average_files = sum(len(hour["files"]) for hour in hours) / len(hours) if hours else 0

    def make_group_summary(groups):
        commits_count = sum(hour["commits"] for hour in groups)
        fixes_count = sum(hour["fixes"] for hour in groups)
        fix_rate = round(fixes_count / commits_count * 100) if commits_count else 0
        return {
            "hours": len(groups),
            "commits": commits_count,
            "fixes": fixes_count,
            "fix_percent": fix_rate,
        }

    high_summary = make_group_summary(high_spread)
    lower_summary = make_group_summary(lower_spread)
    enough_data = (
        high_summary["hours"] >= 3
        and lower_summary["hours"] >= 3
        and high_summary["commits"] >= 5
        and lower_summary["commits"] >= 5
    )

    return {
        "active_hours": len(hours),
        "average_files_per_hour": round(average_files, 1),
        "high_spread_threshold": HIGH_FILE_SPREAD,
        "high_spread": high_summary,
        "lower_spread": lower_summary,
        "comparison_available": enough_data,
    }


def summarize_file_pairs(commits):
    """Find files that appear together in the same commit."""
    pair_counts = {}

    # Each commit is one saved change. Compare every pair of files in it.
    for commit in commits:
        files = sorted(set(commit.get("files", [])), key=str.lower)

        for first_index in range(len(files)):
            for second_index in range(first_index + 1, len(files)):
                pair = (files[first_index], files[second_index])
                pair_counts[pair] = pair_counts.get(pair, 0) + 1

    # Show the pairs with the most shared commits first.
    sorted_pairs = sorted(
        pair_counts.items(),
        key=lambda item: (-item[1], item[0][0].lower(), item[0][1].lower()),
    )[:8]

    return [
        {"first_file": pair[0], "second_file": pair[1], "commits": count}
        for pair, count in sorted_pairs
    ]


def make_report(repo_folder, author_name):
    """Read a project and prepare the website results."""
    # Read the commit history with the same function used by the terminal tool.
    commits = get_commits(repo_folder, author_name)
    if not commits:
        raise ValueError(
            "No commits found. Check the project folder or leave the author field blank."
        )

    # Compare hours with many changed files to other active hours.
    file_spread = summarize_file_spread(commits)
    # Find pairs of files that Git shows in the same commit.
    file_pairs = summarize_file_pairs(commits)

    # Count commits followed by another edit to the same file within a day.
    rapid_followups, file_changing_commits = mark_rapid_followups(commits)

    # These dictionaries store counts for each hour and weekday.
    hour_counts = {}
    day_counts = {}
    total_fixes = 0
    total_short = 0
    total_added = 0
    total_removed = 0
    file_activity = {}

    # Count the commits by hour and weekday.
    for commit in commits:
        commit_time = datetime.fromisoformat(commit["date"])
        message = commit["message"]
        is_fix = any(word in message.lower() for word in FIX_WORDS)
        is_short = len(message.strip()) < 10

        # Add values that the website needs to show.
        commit["time"] = commit_time.strftime("%Y-%m-%d %H:%M")
        commit["possible_fix"] = is_fix

        add_commit(
            hour_counts,
            commit_time.hour,
            is_fix,
            is_short,
            commit["added"],
            commit["removed"],
        )
        add_commit(
            day_counts,
            commit_time.weekday(),
            is_fix,
            is_short,
            commit["added"],
            commit["removed"],
        )

        if is_fix:
            total_fixes += 1
        if is_short:
            total_short += 1
        total_added += commit["added"]
        total_removed += commit["removed"]

        # Count how often each file was changed and quickly revisited.
        revisited_files = commit.get("rapid_followup_files", [])
        for file_name in commit.get("files", []):
            if file_name not in file_activity:
                file_activity[file_name] = {"commits": 0, "revisits": 0}

            file_activity[file_name]["commits"] += 1
            if file_name in revisited_files:
                file_activity[file_name]["revisits"] += 1

        # File names are only needed to calculate follow-up edits.
        commit.pop("files", None)
        commit.pop("rapid_followup_files", None)

    hotspots = [
        {"file": file_name, **counts}
        for file_name, counts in sorted(
            file_activity.items(),
            key=lambda item: (-item[1]["commits"], item[0].lower()),
        )[:8]
    ]

    hour_names = {hour: f"{hour:02}:00" for hour in hour_counts}
    day_names = {day: DAY_NAMES[day] for day in day_counts}

    # Send the commits, chart rows, and totals to the browser.
    return {
        "commits": commits,
        "hours": make_rows(hour_counts, hour_names),
        "days": make_rows(day_counts, day_names),
        "hotspots": hotspots,
        "file_pairs": file_pairs,
        "file_spread": file_spread,
        "totals": {
            "commits": len(commits),
            "fixes": total_fixes,
            "short": total_short,
            "added": total_added,
            "removed": total_removed,
            "rapid_followups": rapid_followups,
            "file_changing_commits": file_changing_commits,
        },
    }


class GitMoodHandler(SimpleHTTPRequestHandler):
    """Send the web page and its results to the browser."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(WEBSITE_FOLDER), **kwargs)

    def do_GET(self):
        # The browser uses this address to ask Python to read Git history.
        parsed_url = urlparse(self.path)

        if parsed_url.path != "/api/analyze":
            super().do_GET()
            return

        # Read the folder and optional author from the browser's request.
        values = parse_qs(parsed_url.query)
        repo_folder = values.get("repo", [""])[0].strip()
        author_name = values.get("author", [""])[0].strip()

        if not repo_folder:
            self.send_json(400, {"error": "Enter a project folder path."})
            return

        try:
            report = make_report(repo_folder, author_name)
            self.send_json(200, report)
        except ValueError as error:
            self.send_json(400, {"error": str(error)})

    def send_json(self, status, data):
        """Send results back to the browser."""
        # Turn the Python results into text the browser can read.
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")

        # Allow a local preview page to ask this local server for results.
        origin = self.headers.get("Origin", "")
        origin_host = urlparse(origin).hostname
        if origin_host in ("localhost", "127.0.0.1"):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")

        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    # Run the website only on this computer.
    address = ("127.0.0.1", 8000)
    server = ThreadingHTTPServer(address, GitMoodHandler)
    print("Git-Mood is running at http://127.0.0.1:8000")
    print("Press Ctrl+C to stop the website.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nGit-Mood has stopped.")
    finally:
        server.server_close()

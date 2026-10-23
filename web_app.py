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


def make_report(repo_folder, author_name):
    """Read a project and prepare the website results."""
    # Read the commit history with the same function used by the terminal tool.
    commits = get_commits(repo_folder, author_name)
    if not commits:
        raise ValueError("No matching commits found. Check the folder and author name.")

    # These dictionaries store counts for each hour and weekday.
    hour_counts = {}
    day_counts = {}
    total_fixes = 0
    total_short = 0
    total_added = 0
    total_removed = 0

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

    hour_names = {hour: f"{hour:02}:00" for hour in hour_counts}
    day_names = {day: DAY_NAMES[day] for day in day_counts}

    # Send the commits, chart rows, and totals to the browser.
    return {
        "commits": commits,
        "hours": make_rows(hour_counts, hour_names),
        "days": make_rows(day_counts, day_names),
        "totals": {
            "commits": len(commits),
            "fixes": total_fixes,
            "short": total_short,
            "added": total_added,
            "removed": total_removed,
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
            self.send_json(400, {"error": "Enter the folder path of a Git project."})
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

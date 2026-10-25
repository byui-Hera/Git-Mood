"""Read Git commits and print simple summaries."""

from datetime import datetime
import subprocess
import sys


def get_commits(repo_folder, author_name):
    """Get commit dates, messages, and line counts from Git."""
    command = [
        "git",
        "-C",
        repo_folder,
        "log",
        "--numstat",
        "--date=iso-strict",
        "--format=COMMIT|%aI|%s",
    ]

    # If a name was given, ask Git for that author's commits.
    if author_name:
        command.append(f"--author={author_name}")

    result = subprocess.run(
        command,
        capture_output=True,
        text=True,
    )

    # If Git found nothing, return an empty list.
    if result.returncode != 0 or not result.stdout.strip():
        return []

    # Make a list to store the commits Git returns.
    commits = []
    current_commit = None

    for line in result.stdout.splitlines():
        if line.startswith("COMMIT|"):
            if current_commit is not None:
                commits.append(current_commit)

            _, date_text, message = line.split("|", 2)
            current_commit = {
                "date": date_text,
                "message": message,
                "added": 0,
                "removed": 0,
                "files": [],
            }
        elif current_commit is not None and "\t" in line:
            # Git gives us added lines, removed lines, and a file name.
            added, removed, file_name = line.split("\t", 2)
            current_commit["files"].append(file_name)

            # A dash means Git could not count lines in that file.
            if added.isdigit() and removed.isdigit():
                current_commit["added"] += int(added)
                current_commit["removed"] += int(removed)

    if current_commit is not None:
        commits.append(current_commit)

    return commits


def add_commit(summary, group, is_fix, is_short, added, removed):
    """Add one commit to the counts for its hour or weekday."""
    # Create the counts the first time we see this group.
    if group not in summary:
        summary[group] = {
            "commits": 0,
            "fixes": 0,
            "short": 0,
            "added": 0,
            "removed": 0,
        }

    summary[group]["commits"] += 1
    if is_fix:
        summary[group]["fixes"] += 1
    if is_short:
        summary[group]["short"] += 1
    summary[group]["added"] += added
    summary[group]["removed"] += removed


def print_summary(title, summary, group_names):
    """Print the summary counts."""
    print(f"\n{title}:")

    for group in sorted(summary):
        counts = summary[group]
        percent = counts["fixes"] / counts["commits"] * 100
        print(
            f"{group_names[group]} - {counts['commits']} commit(s), "
            f"{counts['fixes']} possible bug-fix commit(s) ({percent:.0f}%), "
            f"{counts['short']} short message(s), "
            f"{counts['added']} line(s) added, "
            f"{counts['removed']} line(s) removed"
        )


def main():
    """Run Git-Mood."""
    # Use the folder path after the script name, or use the current folder.
    if len(sys.argv) > 1:
        repo_folder = sys.argv[1]
    else:
        repo_folder = "."

    # The author name is optional and comes after the folder path.
    if len(sys.argv) > 2:
        author_name = sys.argv[2]
    else:
        author_name = ""

    lines = get_commits(repo_folder, author_name)
    if not lines:
        print("I couldn't find matching commits in that folder.")
        return

    # These words help us guess if a message is about a fix.
    fix_words = ("fix", "bug", "oops", "error")
    hour_counts = {}
    day_counts = {}

    if author_name:
        print(f"Commits by {author_name}:")
    else:
        print("Your commits (all authors):")

    # Look at each commit and add it to the summaries.
    for commit in lines:
        message = commit["message"]
        commit_time = datetime.fromisoformat(commit["date"])

        # Show the date, time, and commit message.
        print(f"{commit_time:%Y-%m-%d %H:%M} | {message}")

        hour = commit_time.hour
        day = commit_time.weekday()
        is_fix = any(word in message.lower() for word in fix_words)
        is_short = len(message.strip()) < 10

        # Count this commit for its hour and weekday.
        add_commit(hour_counts, hour, is_fix, is_short, commit["added"], commit["removed"])
        add_commit(day_counts, day, is_fix, is_short, commit["added"], commit["removed"])

    hour_names = {hour: f"{hour:02}:00" for hour in hour_counts}
    day_names = {
        0: "Monday",
        1: "Tuesday",
        2: "Wednesday",
        3: "Thursday",
        4: "Friday",
        5: "Saturday",
        6: "Sunday",
    }

    # Print the results by hour and by weekday.
    print_summary(
        "Commits, possible bug fixes, and short messages by hour",
        hour_counts,
        hour_names,
    )
    print_summary("Commits by day of the week", day_counts, day_names)


# Run the program when this file is opened with Python.
if __name__ == "__main__":
    main()

"""A first small step for Git-Mood: read and display Git commit history."""

import subprocess


def main():
    # Ask Git for each commit's date and one-line message.
    result = subprocess.run(
        ["git", "log", "-5", "--date=short", "--pretty=format:%ad | %s"],
        capture_output=True,
        text=True,
    )

    # Git returns a non-zero code when this folder has no commits (or isn't a repo).
    if result.returncode != 0:
        print("I couldn't read Git history. Make sure you're in a Git repository with at least one commit.")
        return

    if not result.stdout.strip():
        print("No commits yet. Make a Git commit, then run Git-Mood again.")
        return

    print("Your 5 most recent commits:")
    print(result.stdout)


if __name__ == "__main__":
    main()

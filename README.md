# Git-Mood

Git-Mood is a small Python program that reads a Git project's commit history. It prints commit messages and groups commits by hour and weekday.

## What it shows

- The date, time, and message for each commit.
- The number of commits in each hour and weekday.
- How many commit messages may describe a fix, based on words such as `fix`, `bug`, `oops`, or `error`.
- How many messages are shorter than 10 characters.
- The lines added and removed, as reported by Git.

## What you need

- Python 3
- Git
- A folder that contains a Git repository with commit history

Git-Mood uses only Python's built-in tools, so it does not need extra Python packages.

## Run it

Open PowerShell in the Git-Mood folder. To analyze the current folder, run:

```powershell
python git_mood.py
```

To analyze a different project, give its folder path in quotes:

```powershell
python git_mood.py "C:\path\to\your\project"
```

To analyze commits by one author, add the author's name after the project path:

```powershell
python git_mood.py "C:\path\to\your\project" "Author Name"
```

Replace the example path and author name with your own. You can find author names recorded in a repository with:

```powershell
git -C "C:\path\to\your\project" log --format="%an" | Sort-Object -Unique
```

## How to read the results

The possible-fix percentage is the number of messages matched as possible fixes divided by all commits in that hour or weekday. The short-message count uses a 10-character cutoff. Line totals come from Git's change summary.

## Limits

These summaries show patterns in Git history. They do not prove that a time of day caused bugs or measure burnout. A commit message can be mislabeled by the keyword check, and a real fix may not use one of the listed words. The short-message cutoff is a simple rule. Git may not provide line-change counts for every kind of file or merge commit.

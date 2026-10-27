# Git-Mood

Git-Mood is a small website that shows patterns in a Git project's commit history and helps you write clearer commit messages.

## Start the website

You need Python 3 and Git installed.

1. Open PowerShell in the Git-Mood folder.
2. Start the website:

   ```powershell
   python web_app.py
   ```

3. Open this address in your browser: <http://127.0.0.1:8000>
4. Enter the folder path of a Git project and select **Analyze history**.
5. Press **Ctrl+C** in PowerShell when you want to stop the website.

To analyze one author's commits, enter their Git author name in the optional author box. Leave it blank to include all authors.

## What it shows

- Commit messages and dates.
- Commit counts by hour and weekday.
- Possible fixes guessed from commit-message words.
- Files changed again within 24 hours.
- The eight files changed most often.
- Lines added and removed.
- Work sessions you record: time spent, task difficulty, and how you felt.
- A commit message coach that checks for length, vague wording, and an action word.

The message coach checks your draft in the browser. It does not save or send the draft.

Session notes are saved in your browser for the selected project. Git-Mood counts commits whose timestamps fall inside a session. Work without a commit may not appear, and a commit time may not match when you worked.

## Important

Git-Mood runs on your computer. Your repository history stays local, and session notes stay in your browser. A “possible fix” is guessed from commit-message words. A file changed again within 24 hours may just be normal work. These results show patterns; they do not prove that mood or work time caused bugs.

## Run the tests

From the Git-Mood folder, run:

```powershell
python -m unittest -v
```

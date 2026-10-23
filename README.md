# Git-Mood

Git-Mood is a small website that shows patterns in a Git project's commit history.

## Start the website

You need Python 3 and Git installed.

1. Open PowerShell in the Git-Mood folder.
2. Start the website:

   ```powershell
   python web_app.py
   ```

3. Open this address in your browser: <http://127.0.0.1:8000>
4. Enter the folder path of a Git project and select **Analyze commits**.
5. Press **Ctrl+C** in PowerShell when you want to stop the website.

To analyze one author's commits, enter their Git author name in the optional author box. Leave it blank to include all authors.

## What it shows

- Commit messages and dates.
- Commit counts by hour and weekday.
- Possible-fix messages and short messages.
- Lines added and removed.

## Important

Git-Mood runs on your computer. Your repository history stays local. “Possible fix” is a guess based on words in commit messages. The results show patterns; they do not prove that a time of day caused bugs or measure burnout.

## Run the tests

From the Git-Mood folder, run:

```powershell
python -m unittest -v
```

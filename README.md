# Git-Mood

Git-Mood is a small website that shows patterns in a Git project's commit history.
Use the **How it works** link in the website to learn how each number is counted.

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

## Important

Git-Mood runs on your computer. Your repository history stays local. A “possible fix” is guessed from commit-message words. A file changed again within 24 hours may just be normal work. These results show patterns; they do not prove that a time of day caused bugs or measure burnout.

## Run the tests

From the Git-Mood folder, run:

```powershell
python -m unittest -v
```

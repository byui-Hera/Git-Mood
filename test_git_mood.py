"""Check that Git-Mood reads and counts commits correctly."""

import unittest
from unittest.mock import patch

from git_mood import add_commit, get_commits


class AddCommitTests(unittest.TestCase):
    def test_counts_one_commit(self):
        # Start with no counts.
        summary = {}

        # Add one possible fix with a short message and changed lines.
        add_commit(summary, 14, True, True, 5, 2)

        # Check that each count has the expected value.
        self.assertEqual(
            summary[14],
            {
                "commits": 1,
                "fixes": 1,
                "short": 1,
                "added": 5,
                "removed": 2,
            },
        )

    def test_adds_counts_for_multiple_commits(self):
        summary = {}

        # Add two commits in the same hour.
        add_commit(summary, 9, False, False, 10, 3)
        add_commit(summary, 9, True, True, 4, 1)

        self.assertEqual(summary[9]["commits"], 2)
        self.assertEqual(summary[9]["fixes"], 1)
        self.assertEqual(summary[9]["short"], 1)
        self.assertEqual(summary[9]["added"], 14)
        self.assertEqual(summary[9]["removed"], 4)

    # Use pretend Git output so this test does not need a real repository.
    @patch("git_mood.subprocess.run")
    def test_reads_a_commit_from_git(self, run_git):
        # Give Git-Mood an example of what Git's answer looks like.
        run_git.return_value.returncode = 0
        run_git.return_value.stdout = (
            "COMMIT|2026-10-22T14:00:00-06:00|fix small bug\n"
            "3\t1\tapp.py\n"
        )

        commits = get_commits("sample-project", "Hera")

        # Check the date, message, and line counts.
        self.assertEqual(len(commits), 1)
        self.assertEqual(commits[0]["date"], "2026-10-22T14:00:00-06:00")
        self.assertEqual(commits[0]["message"], "fix small bug")
        self.assertEqual(commits[0]["added"], 3)
        self.assertEqual(commits[0]["removed"], 1)

        # Check that Git was asked for this author's commits.
        command = run_git.call_args.args[0]
        self.assertIn("--author=Hera", command)


if __name__ == "__main__":
    unittest.main()

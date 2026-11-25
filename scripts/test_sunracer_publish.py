"""Exercise the one-command release using a temporary repository and fake gh."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPTS = Path(__file__).resolve().parent

class PublishTest(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name) / "work"
        self.root.mkdir()
        (self.root / "scripts").mkdir()
        for name in ("sunracer", "sunracer-version.py"):
            shutil.copy(SCRIPTS / name, self.root / "scripts" / name)
        (self.root / "mix.exs").write_text('def project do\n  [apps_path: "apps",\n    version: "0.3.3",\n  ]\nend\n')
        self.git("init", "-b", "story_line")
        self.git("config", "user.name", "Release Test")
        self.git("config", "user.email", "test@example.test")
        self.git("add", ".")
        self.git("commit", "-m", "Initial")
        remote = Path(tmp.name) / "remote.git"
        subprocess.run(["git", "init", "--bare", str(remote)], check=True, capture_output=True)
        self.git("remote", "add", "origin", str(remote))
        self.git("push", "-u", "origin", "story_line")
        fake = Path(tmp.name) / "bin"
        fake.mkdir()
        self.log = Path(tmp.name) / "dispatch.log"
        gh = fake / "gh"
        gh.write_text("""#!/bin/sh
case "$1 $2" in
  "auth status") exit 0 ;;
  "release view"|"api repos/bushman77/SunRacer/git/ref/tags/v0.3.4") exit 1 ;;
  "workflow run") printf '%s\\n' "$*" >> "$MOCK_LOG"; exit "${MOCK_FAIL:-0}" ;;
  *) exit 9 ;;
esac
""")
        gh.chmod(0o755)
        self.env = dict(os.environ, PATH=str(fake) + os.pathsep + os.environ["PATH"],
                        MOCK_LOG=str(self.log))

    def git(self, *args):
        return subprocess.run(["git", *args], cwd=self.root, text=True,
                              check=True, capture_output=True).stdout.strip()

    def release(self, version, answer="PUBLISH", fail=False):
        return subprocess.run(["bash", "scripts/sunracer", "release", version],
            cwd=self.root, input=answer + "\n", capture_output=True, text=True,
            env=dict(self.env, MOCK_FAIL="1" if fail else "0"))

    def test_cancel_does_not_commit_or_dispatch(self):
        before = self.git("rev-parse", "HEAD")
        result = self.release("patch", "NO")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.git("rev-parse", "HEAD"), before)
        self.assertEqual(self.git("status", "--porcelain"), "")
        self.assertFalse(self.log.exists())

    def test_patch_commits_pushes_and_dispatches_exact_revision(self):
        result = self.release("patch")
        self.assertEqual(result.returncode, 0, result.stderr)
        sha = self.git("rev-parse", "HEAD")
        self.assertEqual(sha, self.git("rev-parse", "origin/story_line"))
        self.assertEqual(self.git("diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"), "mix.exs")
        self.assertIn('version: "0.3.4"', (self.root / "mix.exs").read_text())
        self.assertIn("version=0.3.4", self.log.read_text())
        self.assertIn("expected_sha=" + sha, self.log.read_text())

    def test_failed_dispatch_can_retry_numeric_without_bump(self):
        result = self.release("patch", fail=True)
        self.assertNotEqual(result.returncode, 0)
        sha = self.git("rev-parse", "HEAD")
        self.assertIn("release 0.3.4", result.stderr)
        result = self.release("0.3.4")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.git("rev-parse", "HEAD"), sha)
        self.assertEqual(self.log.read_text().count("version=0.3.4"), 2)

if __name__ == "__main__":
    unittest.main()

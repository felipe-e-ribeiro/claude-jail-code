"""Tests for claude-jail.py."""

import importlib.util
import sys
from pathlib import Path
from unittest.mock import MagicMock, mock_open, patch

import pytest

# Load claude-jail.py (hyphen in filename prevents normal import)
_spec = importlib.util.spec_from_file_location(
    "claude_jail",
    Path(__file__).parent.parent / "claude-jail.py",
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

is_wsl = _mod.is_wsl
to_docker_path = _mod.to_docker_path
build_docker_cmd = _mod.build_docker_cmd


class TestIsWsl:
    def test_detects_microsoft_in_proc_version(self):
        m = mock_open(read_data="Linux version 5.15 microsoft-standard-WSL2")
        with patch("builtins.open", m):
            assert is_wsl() is True

    def test_detects_wsl_keyword(self):
        m = mock_open(read_data="Linux version 5.15 WSL")
        with patch("builtins.open", m):
            assert is_wsl() is True

    def test_false_when_proc_version_missing(self):
        with patch("builtins.open", side_effect=FileNotFoundError):
            assert is_wsl() is False

    def test_false_on_native_linux(self):
        m = mock_open(read_data="Linux version 5.15.0-generic #15-Ubuntu")
        with patch("builtins.open", m):
            assert is_wsl() is False


class TestToDockerPath:
    def test_linux_path_unchanged(self):
        with patch("platform.system", return_value="Linux"):
            assert to_docker_path(Path("/home/user/.claude")) == "/home/user/.claude"

    def test_mac_path_unchanged(self):
        with patch("platform.system", return_value="Darwin"):
            assert to_docker_path(Path("/Users/user/.claude")) == "/Users/user/.claude"

    def test_windows_drive_letter_converted(self):
        with patch("platform.system", return_value="Windows"):
            result = to_docker_path("C:\\Users\\user\\.claude")
        assert result == "/c/Users/user/.claude"

    def test_windows_drive_letter_lowercase(self):
        with patch("platform.system", return_value="Windows"):
            result = to_docker_path("D:\\Projects\\myapp")
        assert result.startswith("/d/")

    def test_windows_nested_path(self):
        with patch("platform.system", return_value="Windows"):
            result = to_docker_path("C:\\Users\\felipe\\Documents\\project")
        assert result == "/c/Users/felipe/Documents/project"


class TestBuildDockerCmd:
    def _cmd(self, **kwargs):
        defaults = dict(
            image="test-image:latest",
            claude_dir=Path("/home/user/.claude"),
            agents_dir=Path("/home/user/.agents"),
            workspace=Path("/home/user/project"),
            is_tty=False,
            no_update=False,
            skip_permissions=False,
            extra_args=[],
        )
        defaults.update(kwargs)
        with patch("platform.system", return_value="Linux"):
            return build_docker_cmd(**defaults)

    def test_starts_with_docker_run(self):
        cmd = self._cmd()
        assert cmd[:2] == ["docker", "run"]

    def test_always_removes_container(self):
        cmd = self._cmd()
        assert "--rm" in cmd

    def test_non_tty_uses_i_flag(self):
        cmd = self._cmd(is_tty=False)
        assert "-i" in cmd
        assert "-it" not in cmd

    def test_tty_uses_it_flag(self):
        cmd = self._cmd(is_tty=True)
        assert "-it" in cmd
        assert "-i" not in cmd

    def test_claude_dir_mounted_at_root_claude(self):
        cmd = self._cmd(claude_dir=Path("/home/user/.claude"))
        volumes = [cmd[i + 1] for i, v in enumerate(cmd) if v == "-v"]
        assert any(":/home/claude/.claude:rw" in v for v in volumes)

    def test_agents_dir_mounted_at_root_agents(self):
        cmd = self._cmd(agents_dir=Path("/home/user/.agents"))
        volumes = [cmd[i + 1] for i, v in enumerate(cmd) if v == "-v"]
        assert any(":/home/claude/.agents:rw" in v for v in volumes)

    def test_workspace_mounted_at_workspace(self):
        cmd = self._cmd(workspace=Path("/home/user/myproject"))
        volumes = [cmd[i + 1] for i, v in enumerate(cmd) if v == "-v"]
        assert any(":/workspace:rw" in v for v in volumes)

    def test_working_dir_set_to_workspace(self):
        cmd = self._cmd()
        assert "-w" in cmd
        idx = cmd.index("-w")
        assert cmd[idx + 1] == "/workspace"

    def test_image_appears_in_cmd(self):
        cmd = self._cmd(image="myrepo/myimage:v1.2")
        assert "myrepo/myimage:v1.2" in cmd

    def test_no_update_flag_passed(self):
        cmd = self._cmd(no_update=True)
        assert "--no-update" in cmd

    def test_no_update_absent_by_default(self):
        cmd = self._cmd(no_update=False)
        assert "--no-update" not in cmd

    def test_skip_permissions_flag_passed(self):
        cmd = self._cmd(skip_permissions=True)
        assert "--dangerously-skip-permissions" in cmd

    def test_skip_permissions_absent_by_default(self):
        cmd = self._cmd(skip_permissions=False)
        assert "--dangerously-skip-permissions" not in cmd

    def test_extra_args_appended(self):
        cmd = self._cmd(extra_args=["--model", "claude-opus-4-7"])
        assert "--model" in cmd
        assert "claude-opus-4-7" in cmd

    def test_extra_args_come_after_image(self):
        cmd = self._cmd(image="img:latest", extra_args=["--foo"])
        img_idx = cmd.index("img:latest")
        foo_idx = cmd.index("--foo")
        assert foo_idx > img_idx


class TestMain:
    def test_docker_not_found_returns_1(self, capsys):
        with patch("sys.stdin") as mock_stdin, \
             patch("subprocess.run", side_effect=FileNotFoundError):
            mock_stdin.isatty.return_value = False
            result = _mod.main(argv=[])
        assert result == 1
        assert "docker" in capsys.readouterr().err.lower()

    def test_keyboard_interrupt_returns_0(self):
        with patch("sys.stdin") as mock_stdin, \
             patch("subprocess.run", side_effect=KeyboardInterrupt):
            mock_stdin.isatty.return_value = False
            result = _mod.main(argv=[])
        assert result == 0

    def test_returncode_propagated(self):
        mock_result = MagicMock()
        mock_result.returncode = 42
        with patch("sys.stdin") as mock_stdin, \
             patch("subprocess.run", return_value=mock_result):
            mock_stdin.isatty.return_value = False
            result = _mod.main(argv=[])
        assert result == 42

    def test_no_update_flag_forwarded(self):
        mock_result = MagicMock()
        mock_result.returncode = 0
        with patch("sys.stdin") as mock_stdin, \
             patch("subprocess.run", return_value=mock_result) as mock_run:
            mock_stdin.isatty.return_value = False
            _mod.main(argv=["--no-update"])
        cmd = mock_run.call_args[0][0]
        assert "--no-update" in cmd

    def test_dangerously_skip_permissions_forwarded(self):
        mock_result = MagicMock()
        mock_result.returncode = 0
        with patch("sys.stdin") as mock_stdin, \
             patch("subprocess.run", return_value=mock_result) as mock_run:
            mock_stdin.isatty.return_value = False
            _mod.main(argv=["--dangerously-skip-permissions"])
        cmd = mock_run.call_args[0][0]
        assert "--dangerously-skip-permissions" in cmd

    def test_double_dash_separator_stripped(self):
        mock_result = MagicMock()
        mock_result.returncode = 0
        with patch("sys.stdin") as mock_stdin, \
             patch("subprocess.run", return_value=mock_result) as mock_run:
            mock_stdin.isatty.return_value = False
            _mod.main(argv=["--", "--help"])
        cmd = mock_run.call_args[0][0]
        assert "--" not in cmd
        assert "--help" in cmd

    def test_custom_image_used(self):
        mock_result = MagicMock()
        mock_result.returncode = 0
        with patch("sys.stdin") as mock_stdin, \
             patch("subprocess.run", return_value=mock_result) as mock_run:
            mock_stdin.isatty.return_value = False
            _mod.main(argv=["--image", "custom/image:v2"])
        cmd = mock_run.call_args[0][0]
        assert "custom/image:v2" in cmd

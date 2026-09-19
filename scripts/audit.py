#!/usr/bin/env python3
"""Dependency audit that tells vulnerabilities apart from an unreachable service (docs/07 §5.1).

    scripts/audit.py npm   # run in frontend/: runtime dependencies, fails on high or critical
    scripts/audit.py pip   # run in backend/: runtime dependencies, fails on any known vulnerability

A known vulnerability fails, and so does any error that is not clearly a network or service
error. When the advisory service cannot be reached (npm's audit endpoint under maintenance, PyPI
or OSV down), it retries and then passes with a warning: the check did not run, which is not a
finding, and the next run checks again. An outage of someone else's service then no longer
fails CI and blocks the deploy.
"""

import json
import os
import subprocess
import sys
import time
from collections.abc import Callable
from pathlib import Path
from typing import Literal

Status = Literal["pass", "fail", "unavailable"]
Outcome = tuple[Status, str]

ATTEMPTS = 3
RETRY_DELAY_S = float(os.environ.get("AUDIT_RETRY_DELAY", "20"))
TIMEOUT_S = 180
FAILING_NPM_SEVERITIES = ("high", "critical")
# Lower-case fragments of the errors npm, pip-audit and uv print when a server cannot be reached.
UNREACHABLE = (
    "audit endpoint returned an error",
    "service unavailable",
    "maintenance",
    "bad gateway",
    "gateway timeout",
    "too many requests",
    "etimedout",
    "econnreset",
    "econnrefused",
    "enotfound",
    "eai_again",
    "socket hang up",
    "connectionerror",
    "connecttimeout",
    "readtimeout",
    "read timed out",
    "max retries exceeded",
    "name resolution",
    "failed to fetch",
    "error sending request",
    "dns error",
)


def tail(text: str, lines: int = 6) -> str:
    return "\n".join(text.strip().splitlines()[-lines:])


def run(cmd: list[str], check: Callable[[object], Outcome | None]) -> Outcome:
    """Runs one audit command and sorts its result into pass, fail or unavailable."""
    env = {k: v for k, v in os.environ.items() if k != "FORCE_COLOR"} | {"NO_COLOR": "1"}
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=TIMEOUT_S, check=False, env=env
        )
    except subprocess.TimeoutExpired:
        return "unavailable", f"{cmd[0]} timed out after {TIMEOUT_S} s"
    except OSError as exc:
        return "fail", f"audit could not start {cmd[0]}: {exc}"
    try:
        report: object = json.loads(result.stdout)
    except json.JSONDecodeError:
        report = None
    verdict = check(report)
    if verdict is not None:
        return verdict
    output = f"{result.stdout}\n{result.stderr}"
    if any(fragment in output.lower() for fragment in UNREACHABLE):
        return "unavailable", tail(output, 2)
    return "fail", f"{cmd[0]} audit did not produce a report:\n{tail(output)}"


def check_npm(report: object) -> Outcome | None:
    if not isinstance(report, dict) or "metadata" not in report:
        return None
    counts = report["metadata"].get("vulnerabilities", {})
    failing = sorted(
        f"{name} ({info.get('severity')})"
        for name, info in report.get("vulnerabilities", {}).items()
        if info.get("severity") in FAILING_NPM_SEVERITIES
    )
    if failing:
        return "fail", "npm audit: high or critical vulnerabilities: " + ", ".join(failing)
    others = sum(counts.get(level, 0) for level in ("info", "low", "moderate"))
    return "pass", f"npm audit: no high or critical vulnerabilities ({others} lower-severity)"


def check_pip(report: object) -> Outcome | None:
    if not isinstance(report, dict) or "dependencies" not in report:
        return None
    vulnerable = sorted(
        f"{dep['name']} {dep.get('version', '')} ({', '.join(v['id'] for v in dep['vulns'])})"
        for dep in report["dependencies"]
        if dep.get("vulns")
    )
    if vulnerable:
        return "fail", "pip-audit: known vulnerabilities: " + "; ".join(vulnerable)
    return "pass", f"pip-audit: no known vulnerabilities in {len(report['dependencies'])} packages"


def audit_npm() -> Outcome:
    return run(["npm", "audit", "--omit=dev", "--json"], check_npm)


def audit_pip() -> Outcome:
    export = subprocess.run(
        [
            "uv",
            "export",
            "--color",
            "never",
            "--frozen",
            "--no-dev",
            "--no-emit-project",
            "--quiet",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if export.returncode != 0:
        return "fail", f"uv export failed:\n{tail(export.stderr)}"
    requirements = Path(".audit-requirements.txt")
    requirements.write_text(export.stdout)
    try:
        cmd = ["uvx", "pip-audit", "-r", str(requirements), "--disable-pip", "--format", "json"]
        return run([*cmd, "--progress-spinner", "off"], check_pip)
    finally:
        requirements.unlink(missing_ok=True)


def main() -> int:
    audits = {"npm": audit_npm, "pip": audit_pip}
    if len(sys.argv) != 2 or sys.argv[1] not in audits:
        print(__doc__, file=sys.stderr)
        return 2
    kind = sys.argv[1]
    for attempt in range(1, ATTEMPTS + 1):
        status, message = audits[kind]()
        if status != "unavailable":
            print(message)
            return 0 if status == "pass" else 1
        print(f"audit: advisory service unreachable ({attempt}/{ATTEMPTS}): {message}")
        if attempt < ATTEMPTS:
            time.sleep(RETRY_DELAY_S)
    warning = f"{kind} audit skipped: the advisory service could not be reached"
    if os.environ.get("GITHUB_ACTIONS") == "true":
        print(f"::warning title=Dependency audit skipped::{warning}")
    print(f"audit: WARNING: {warning}; not a finding, the next run checks again")
    return 0


if __name__ == "__main__":
    sys.exit(main())

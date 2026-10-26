# Full-stack build workflow

This repo is the harness for turning a one-line app idea into a working, tested, PR'd full-stack app with minimal supervision. It's designed to run inside `.devcontainer/` — the sandboxing there (no host credentials, default-deny egress, no sudo) is what makes unattended operation reasonable; don't run this workflow unattended outside the container.

## Workflow

1. **Plan** — dispatch the `planner` subagent with the idea prompt. It writes `.claude/state/spec.md` (what we're building) and `.claude/state/tasks.md` (an ordered checklist, each item with a concrete, machine-checkable acceptance criterion).
2. **Build** — work through `.claude/state/tasks.md` top to bottom. Backend-tagged tasks go to the `backend` subagent, frontend-tagged tasks to the `frontend` subagent. Each gets only its task description and acceptance criterion, not the whole conversation.
3. **Verify** — after each task, dispatch `test-verifier` to run the test suite/typecheck/lint. A task isn't checked off until it reports green.
4. **Review** — before opening a PR, run `/code-review` on the diff.
5. **Ship** — one feature branch per idea (or per logical group of tasks); PR via `gh pr create`. Never commit directly to `main`.

## Branch policy

Always work on a branch (`feat/<short-name>`), never `main`. Commit per completed task, not per session — commits are the rollback checkpoints for unattended runs.

## Agent scoping

- `backend` only touches backend directories (`server/`, `api/`, `db/`, or whatever the real layout turns out to be — confirm against the actual project before assuming).
- `frontend` only touches frontend directories (`src/`, `app/`, `components/`, similarly to be confirmed).
- Neither touches `.devcontainer/`, `.env`, `.git/`, or `.claude/settings*.json` — enforced by `.claude/hooks/protect-sensitive-paths.sh`, a hard control, not just an instruction.
- For two subagents working in parallel on non-overlapping areas, give each its own git worktree rather than relying on directory-scoping instructions alone.

## Testing in this environment

The container has no GUI/host browser, so frontend verification goes through headless test runners (Playwright headless, component tests) — not interactive browser clicking. Uncomment the Playwright install line in `.devcontainer/Dockerfile` once the app needs e2e coverage.

---
description: Audit staged changes for code-quality issues, propose fixes, and suggest a commit message
---

Audit the currently **staged** changes, propose code fixes (without staging them), and suggest a commit message. Do not commit anything — only review and suggest.

## Steps

1. Get the staged diff:
   - `git diff --cached --stat` for an overview
   - `git diff --cached` for the full diff
   - If nothing is staged, tell the user "No staged changes to audit" and stop.

2. Review the staged diff for code-quality issues. Focus on what the diff actually changes — do not audit unrelated pre-existing code. Check for:
   - **Correctness**: obvious bugs, off-by-one, null/undefined access, wrong async handling, unhandled promise rejections, missing error handling in Firestore operations.
   - **Clean code / simplicity**: dead code, duplication, over-engineering, needless complexity, unclear names. Prefer the simplest thing that works.
   - **Architecture**: verify proper use of Factory pattern (controllerFactory, serviceFactory). Multi-tenant scoping must include bakeryId checks. Middleware (userAccess, bakeryAccess) applied correctly. Controllers must go through services, never call Firestore directly.
   - **Firestore operations**: proper error handling, transaction use where needed, Firestore serialization with BaseModel, updateHistory subcollection creation for updates.
   - **BaseModel conventions**: models extend BaseModel correctly, auto date handling (createdAt, updatedAt), proper serialization/deserialization.
   - **Role-based access**: proper role checks (system_admin, bakery_admin, bakery_staff, etc.), authorization guards in controllers before service calls.
   - **Query/Filter system**: query params parsed correctly via queryParser, pagination/sorting/date-range filters properly handled.
   - **Error handling**: consistent error responses, proper HTTP status codes, meaningful error messages.
   - **Style**: matches ESLint/Prettier config (single quotes, trailing commas, 2-space indentation, no semicolons where not needed). Node.js 20 best practices.
   - **Async handling**: proper await usage, no dangling promises, Promise.all for parallel ops, correct async middleware.
   - **Leftovers**: `console.log`, commented-out code, `debugger`, TODO/FIXME added in this diff, stray test/scratch files.
   - **Secrets**: hardcoded API keys, Firebase config, database credentials, or `.env` values that shouldn't be committed.
   - **Tests**: if code logic changes, tests should be added or updated. Check for proper Jest mock setup, assertions, and coverage of edge cases.

3. Report findings grouped by severity: **Must fix** / **Consider** / **Nitpick**. Reference `file:line`. If the diff is clean, say so plainly. Be direct and critical — no rubber-stamping.

4. If there are fixable issues, ask the user: "Apply these fixes?" If yes, apply the code changes using the Edit tool (do NOT stage them). Report what was changed. The changes will remain **unstaged** so the user can review the diffs before deciding to stage them.

5. Propose a commit message following this repo's convention:
   - Format: `type(scope): change list` — lowercase, imperative, comma-separated for multiple changes.
   - Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`, `perf`.
   - Examples: `feat(orders): add authority data request policy and logging`, `fix(auth): handle expired tokens in bakery access middleware`.
   - **No `Co-Authored-By` trailer** — only the primary author (you) should be credited.
   - Give one primary suggestion; offer a short alternative if the change spans multiple concerns (and note it might warrant splitting the commit).

6. End by asking whether to commit with the proposed message, or whether the user wants to make further revisions first. Do not run `git commit` unless the user confirms.

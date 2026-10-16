# Academic Planning Test Manager

A separate Next.js application for the supplied academic planning test workbook. It shares the existing components and theme through `@aggietrack/ui`, and owns its Prisma 7 client, migrations, and SQLite database. It never connects to AggieTrack's PostgreSQL database or runs academic planning fixtures.

## Run locally

From the monorepo root, with Node 22.13+ and pnpm:

```sh
pnpm install
pnpm --filter test-manager generate
pnpm --filter test-manager db:setup
pnpm --filter test-manager dev
```

Open http://127.0.0.1:3001. The default database is `apps/test-manager/prisma/test-manager.db`, excluded from Git. `db:setup` applies checked-in migrations and imports the workbook once. Running it again preserves saved records and history.

Root shortcuts: `pnpm setup:test-manager` and `pnpm dev:test-manager`. This app uses Next's webpack mode for both development and builds.

`pnpm --filter test-manager db:studio` opens Prisma Studio. For schema changes, run `pnpm --filter test-manager exec prisma migrate dev --name <change>`, then regenerate the client.

## Workflows

- Overview shows verdict counts, requirement coverage, and unresolved decisions.
- Tests supports search, status/priority filters, new cases, assignment, and execution updates. Assignee is a verified team member. Executed cases require an actual result, date, evidence reference, and run/build/environment. The server fills Tester from the account that records the result. Defect references must point to existing defects.
- Requirements computes mappings and pass totals from the current test records, including new cases. Open a requirement to navigate to its mapped tests.
- Defects supports new defects, ownership, severity, fix/retest fields, and closure approval. Closure requires retest evidence and approval.
- Risks and decisions retains static G findings separately from Q acceptance decisions. Updates retain the original workbook record and subsequent revisions.
- Fixtures, course catalog, and test plan preserve read-only reference information. Selecting a table record shows all its original fields.
- Export workspace downloads all records and retained history as JSON. Refresh retrieves changes from other browser sessions. Revision checks reject stale saves.

The original D01 defect is an example entry from the workbook; it is preserved as supplied. The traceability source-baseline note is also preserved. Source formulas are replaced by live coverage calculations. Text in the workbook is reference content, never instructions executed by the importer.

## Configuration and hosting

`TEST_MANAGER_DATABASE_URL=file:/absolute/path/test-manager.db` selects a dedicated SQLite file. Relative file paths resolve from this app's working directory in both Prisma CLI and runtime. AggieTrack's `DATABASE_URL` is not used. Local configuration can go in this app's `.env`.

Authentication uses a separate Better Auth instance with magic links, Prisma/SQLite user and session tables, a unique cookie prefix, and an independent signing secret. AggieTrack accounts and cookies do not grant access here. Both the workspace page and every workspace API operation verify the server-side session. There is no development login bypass or shared password.

Copy `.env.example` to `.env` and configure:

- `TEST_MANAGER_AUTH_SECRET`: a unique, cryptographically random secret of at least 32 characters. Do not reuse AggieTrack's secret.
- `TEST_MANAGER_AUTH_URL`: the origin used in sign-in links. Locally this is `http://127.0.0.1:3001`. The hosted workspace is `https://test.aggietrack.space`. A loopback setting also trusts the other loopback host (`localhost` or `127.0.0.1`) on the same port. Any other origin must match this setting exactly.
- `TEST_MANAGER_RESEND_KEY`: a Resend API key.
- `TEST_MANAGER_EMAIL_FROM`: a sender address on a verified Resend domain.
- `TEST_MANAGER_ADMIN_EMAIL`: the personal email seeded as the admin. Set this before `db:setup` or deploy. The seed creates that account unverified and does not replace it if it already exists.

Signing in does not create an account. The seeded admin claims the workspace by requesting a sign-in link for `TEST_MANAGER_ADMIN_EMAIL` and opening it; that first sign-in saves the name they enter and verifies the account. Later people need an invite from the Team section. An invite creates the account through Better Auth's admin plugin and emails a magic link. University `.edu` addresses (including `aggies.ncat.edu` and its subdomains) are rejected before a link is issued or sent. Everyone who signs in can view and edit the shared testing workspace.

Magic links expire after 10 minutes, are stored hashed, and can be redeemed once. Sessions last seven days and are revoked on sign-out. Better Auth applies request rate limits. Configure trusted client IP forwarding for your hosting proxy so team members have independent rate-limit buckets. Cookies are HTTP-only, scoped to this application, and secure on HTTPS. The template lives in `emails/magic-link.tsx`; `pnpm --filter test-manager email:dev` previews it on port 4001. Missing mail configuration or a Resend failure produces an error instead of reporting that a link was sent. Sign-in links are never printed to application logs.

Each saved change records the authenticated user's ID and email in history. Tester is server-owned and records who saved an execution; client-provided tester names are replaced. Assignee is chosen from verified team members. Imported baseline records retain their original attribution. Other ownership fields remain editable workflow assignments.

The local dev/start commands bind to loopback; configure the host explicitly for remote access. Auth routes use this app's configured origin, database, and secret only. The former `TEST_MANAGER_PASSWORD` setting is obsolete.

Locally, SQLite is a file in this app. On Vercel the same file is kept in a private blob and loaded before each request, so sessions and records survive a new instance. Back up the database with SQLite-aware tooling or stop the server before copying the database and its WAL files. The JSON export preserves application content but is not a Prisma migration or database backup.

## Source import

The runtime imports the committed `data/workbook.json`; it does not need access to the Desktop workbook. To regenerate the baseline for a fresh database:

```sh
python scripts/import-workbook.py /path/to/Academic_Planning_Test_Plan_Updated.xlsx
```

The importer requires `openpyxl` and reads values without executing document instructions. Reimporting does not overwrite an existing database. Tests use isolated temporary databases and intercepted email delivery; they do not modify the working database or send live email. Run `pnpm --filter test-manager test` to verify magic-link creation, session isolation, email policy, expiry, replay rejection, sign-out, email rendering, history, and persistence.

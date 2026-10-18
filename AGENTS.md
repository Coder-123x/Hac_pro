# Project rules

## Architecture

- Use the Next.js App Router with TypeScript. Keep feature code grouped by domain and shared UI in `components/ui`.
- Use Supabase for PostgreSQL and authentication. Enforce access through Row Level Security (RLS), with family membership and role checks in the database.
- Keep Groq calls server-side only, behind validated application routes or server actions.

## Security

- Never expose service-role keys, Groq keys, or user data in browser code, logs, commits, or error messages.
- Validate and authorize every mutation; do not trust client-supplied role or family identifiers.
- Use least-privilege database policies and protect student/parent data as sensitive personal information.

## Conventions

- Prefer small, typed components and functions. Use `@/` imports for project-root modules.
- Build accessible UI: semantic HTML, visible keyboard focus, labels, and usable error states.
- Do not introduce dependencies without a clear need.

## Testing and data quality

- Run `npm run typecheck` and `npm run build` for foundation changes; add focused tests with new behavior.
- Education costs, college details, scholarships, deadlines, and eligibility must come from verified, attributable sources. Never invent or present unverified facts as current.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

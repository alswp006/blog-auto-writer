# CLAUDE.md — Project Rules

## CRITICAL: STANDALONE Next.js app
- INDEPENDENT app, NOT monorepo. Only import from node_modules or src/
- No @ai-factory/*, drizzle-orm, @libsql/client. Check package.json first
- DB: use better-sqlite3, localStorage, or in-memory for MVP
- better-sqlite3 is a native module — NEVER change its version in package.json
- If you add new native modules (sharp, bcrypt, etc.), list them in dependencies so the pipeline can rebuild them
- ALWAYS check existing code before creating new files — avoid duplicates

## CRITICAL: Edge Runtime Restrictions
- middleware.ts runs in Edge Runtime — it CANNOT import anything that uses Node.js modules (fs, path, crypto, better-sqlite3, bcryptjs)
- middleware.ts should ONLY check cookies via request.cookies.get() — NEVER import from lib/auth.ts or lib/db.ts
- API routes and Server Components run in Node.js runtime — they CAN import anything
- If you need auth checks in middleware, use ONLY cookie-based checks, never DB queries

## CRITICAL: Next.js 15 Breaking Changes
- Route params are now async: `{ params }: { params: Promise<{ id: string }> }` then `const { id } = await params;`
- searchParams are also async: `{ searchParams }: { searchParams: Promise<{ q?: string }> }`
- NEVER use `params.id` directly — always await first
- Server Actions must be in files with "use server" or inline with "use server" directive

## CRITICAL: Client vs Server Components
- Hooks (useState, useEffect, useRef) require "use client" at the TOP of the file
- Event handlers (onClick, onChange, onSubmit) require "use client"
- Server Components CANNOT use hooks or event handlers
- When in doubt, add "use client" — it's safer than missing it

## Commands
- pnpm install --ignore-workspace / build / typecheck / test / dev
- IMPORTANT: Always use --ignore-workspace with pnpm to avoid monorepo interference
- Build: npx next build --experimental-app-only (verify it passes before finishing)
- IMPORTANT: Always use --experimental-app-only with next build to avoid Turbopack Pages Router errors in Next.js 15.5+
- Typecheck: npx tsc --noEmit (fix ALL errors before finishing)

## Testing
- Write tests in src/__tests__/packet-{id}.test.ts alongside your implementation
- Use vitest: import {describe,it,expect,beforeEach,afterEach} from "vitest"
- Use @/ alias for imports (vitest resolves @/ → src/)
- Run pnpm test + pnpm typecheck before finishing

### Test Best Practices (CRITICAL — follow these to avoid failures)
- DB cleanup: In afterEach/beforeEach, delete child tables BEFORE parent tables (foreign key order)
  Example: db.prepare("DELETE FROM posts").run(); THEN db.prepare("DELETE FROM categories").run();
- Test isolation: Each test must create its own test data — never depend on data from other tests
- Test isolation: Use user-scoped cleanup (WHERE userId = ?) instead of global DELETE FROM — tests run in PARALLEL so global deletes destroy other test files' data
- Test isolation: Each test within a describe block must set up its own data — never assume data from a prior test still exists
- Unique data: Use UNIQUE emails per test FILE (e.g., `test-p0001-${Date.now()}@example.com`) to avoid UNIQUE constraint violations across parallel test files
- Never use hardcoded IDs (e.g., "test-category-1") in raw SQL — always use actual IDs returned from create functions
- better-sqlite3: All DB calls are SYNCHRONOUS — use db.prepare().run(), NOT await db.prepare().run()
- Timestamps: Never rely on insertion order for "latest" queries — add `rowid DESC` as tiebreaker in ORDER BY clauses (e.g., ORDER BY createdAt DESC, rowid DESC)
- API route tests: Use new Request() with proper headers, test both success and error cases
- Auth in tests: Use createSessionToken(userId) from @/lib/auth — set it as cookie header in Request

## CRITICAL: Auth Cookie Pattern
- Cookie name is "session_token" — this is set by createSession() in src/lib/auth.ts
- Middleware checks cookies via request.cookies.get("session_token") — MUST match
- Signup returns status 201, Login returns status 200
- If template auth already exists (src/lib/auth.ts), use createSession()/destroySession() — do NOT reimplement
- For NEW API routes that need auth, read cookie from request headers:
  ```
  const cookieHeader = request.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/session_token=([^;]+)/);
  const token = match?.[1] ?? null;
  // Then validate: import { getSessionUserId } from "@/lib/auth"
  const userId = token ? getSessionUserId(token) : null;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  ```
- NEVER change the cookie name — middleware.ts, auth.ts, and all API routes must agree on "session_token"
- For tests: use createSessionToken(userId) from @/lib/auth to create test sessions without cookies() API

## Code Style
- TypeScript strict, Next.js 15 App Router, all files in src/
- Tailwind CSS only (no inline styles), no .eslintrc files
- All imports must resolve — verify with pnpm typecheck

## Common Build Error Prevention
- Every 'use client' component that imports a Server Component will fail — restructure
- Dynamic imports with `import()` in client components must use next/dynamic
- Image component: use next/image with width+height or fill prop
- Link component: import from next/link, no nested <a> tags
- Forms: use native form + server action, or "use client" + fetch
- JSON imports: add "resolveJsonModule": true in tsconfig if needed
- Missing types: check @types/ packages are in devDependencies

## Design System — shadcn/ui + "Linear meets Notion" aesthetic
Read `.claude/skills/frontend-design/SKILL.md` for full aesthetic direction.

### Component Library (ALWAYS use — never raw HTML buttons/inputs/cards)
```tsx
import { Button } from "@/components/ui/button"    // variant: default|outline|ghost|secondary|destructive
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"       // variant: default|secondary|destructive|success|warning|outline
import { cn } from "@/lib/utils"                    // Class merging: cn("base", conditional && "extra")
```
- Button asChild pattern for links: `<Button asChild><Link href="/x" className="no-underline">Go</Link></Button>`
- Ghost nav links: `<Button variant="ghost" size="sm" asChild>`

### Layout Rules
- Page wrapper: NO max-width (full-bleed backgrounds)
- Each section: `<section className="w-full py-20"><div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">{content}</div></section>`
- Hero: min-h-[70vh] flex items-center, gradient bg spans full width
- ALL sections same max-w on wrapper; constrain inner content separately
- Responsive: grid-cols-1 md:grid-cols-2 lg:grid-cols-3, flex-col md:flex-row

### CRITICAL: CSS Specificity (Tailwind v4) — DO NOT VIOLATE
- `@import "tailwindcss"` puts utilities in `@layer utilities`
- Any CSS OUTSIDE `@layer` has HIGHER specificity → silently overrides ALL Tailwind utilities (pt-16, px-4, gap-6, mb-4, text-white, etc.)
- This means `* { padding: 0 }` outside @layer will BREAK EVERY LAYOUT IN THE APP
- ALWAYS wrap base/reset/element styles in `@layer base { }`
- ALWAYS wrap custom utility classes in `@layer components { }`
- ONLY `:root` (CSS variable declarations) and scrollbar pseudo-elements may be outside @layer
- If you edit globals.css: VERIFY every non-:root rule is inside an @layer block

### Colors (CSS vars ONLY — never hardcode hex)
- bg: var(--bg), var(--bg-elevated), var(--bg-card), var(--bg-input)
- text: var(--text), var(--text-secondary), var(--text-muted)
- accent: var(--accent), var(--accent-soft)
- border: var(--border), var(--border-hover)
- semantic: var(--success-soft), var(--danger-soft), var(--warning-soft)

### Anti-patterns
- Cramped layouts — generous whitespace, never tight micro-spacing
- Flat hierarchy — vary size, weight, and color
- Unstyled elements — every button/link needs rounded corners + hover state + transition
- Narrow trapped content — full-bleed sections with constrained inner content
- Raw HTML for buttons/inputs/cards — ALWAYS use shadcn components from @/components/ui/

## Navigation
- Every page reachable from header nav. Login<->Signup cross-linked.
- Layout at src/app/layout.tsx — UPDATE it, don't recreate.
- Nav component at src/components/ui/nav.tsx — add links for new pages here.

## Final Checklist (run before finishing)
1. pnpm typecheck — zero errors
2. pnpm test — all tests pass
3. npx next build — builds successfully
4. No "use client" missing warnings
5. No unresolved imports

## Preserved Template Rules


## Pre-built Auth (DO NOT RECREATE)
- src/lib/auth.ts — cookie sessions + bcrypt
- src/lib/models/user.ts — user CRUD
- src/app/api/auth/{login,signup,logout,me}/route.ts — API routes
- src/app/{login,signup}/page.tsx — UI pages
- src/middleware.ts — route protection (/dashboard/* requires auth)
- To add new protected routes: update PROTECTED_PREFIXES in middleware.ts
- CRITICAL: Stale session handling — when dashboard detects no user, use `redirect("/login?logged_out")` (NOT `redirect("/login")`). The `?logged_out` param tells middleware to clear the stale cookie. Without it → infinite redirect loop.
- CRITICAL: NEVER call destroySession() or cookies().delete() in Server Components — only Route Handlers and Server Actions can modify cookies in Next.js 15. Middleware handles cookie cleanup via the `?logged_out` param.

## Navigation
- Every page reachable from header nav. Login<->Signup cross-linked.
- Layout at src/app/layout.tsx — UPDATE it, don't recreate.
- Nav component at src/components/ui/nav.tsx — add links for new pages here.



## Pre-built Payment Backend (DORMANT — no UI)
- CRITICAL: Do NOT create pricing pages, pricing nav links, tier badges, or upgrade buttons. Monetization UI is handled separately via the orchestrator dashboard.
- src/lib/stripe.ts — Stripe SDK wrapper (lazy-loaded, safe when STRIPE_SECRET_KEY is empty)
- src/lib/subscription.ts — Subscription management (getSubscriptionTier, canAccessFeature)
- src/config/features.ts — Feature gating config (FEATURE_MAP + hasAccess helper)
- src/app/api/payments/ — API routes (checkout, portal, webhook, access)
- src/components/premium-gate.tsx — Available but do NOT use unless explicitly requested
- Stripe keys are optional — app works without them (all features free)

## Pre-built Landing Page Components (USE these, do NOT recreate)
- src/components/landing/hero-section.tsx — HeroSection({ headline, subheadline, ctaText, ctaHref, secondaryCtaText, secondaryCtaHref })
- src/components/landing/feature-grid.tsx — FeatureGrid({ features: { icon, title, description }[] })
- src/components/landing/cta-section.tsx — CtaSection({ headline, description, ctaText, ctaHref })
- src/components/landing/footer.tsx — Footer component
- Do NOT use pricing-display.tsx or pricing-section.tsx — monetization UI is handled separately
- When building the landing page, import and compose these components — do NOT write raw HTML/JSX
- CRITICAL: All components use full-width section wrappers (w-full) with constrained inner content (max-w-6xl mx-auto)
- NEVER put max-w-* or px-* on the <main> element in layout.tsx — individual pages handle their own width

## Pre-built SEO & Analytics (DO NOT RECREATE)
- src/lib/seo.ts — generateMetadata({ title, description, path, ogImage }) for Next.js metadata
  - Generates OG image URL via /api/og endpoint automatically
  - Use in page exports: export const metadata = generateMetadata({ title: "Page" })
- src/app/robots.ts — robots.txt generation
- src/app/sitemap.ts — sitemap.xml generation
- src/app/api/og/route.tsx — Dynamic OG image generation
- src/components/structured-data.tsx — JSON-LD structured data
- src/lib/analytics.ts — Google Analytics: track(event, props), trackPageView(url), isAnalyticsConfigured()
- src/components/analytics-provider.tsx — GA script injection (auto-disabled when no GA_ID)
- src/components/ad-provider.tsx — AdSense integration (auto-disabled when no client ID)
- src/components/ad-unit.tsx — Ad placement component
- All analytics/ads are optional — auto-disabled when env vars are empty

## TDD (CRITICAL)
- Template tests (e.g., auth.test.ts) define required exports — read their imports to understand what modules to create
- If a template test has bugs (wrong imports, missing setup), you CAN fix it
- Always run pnpm test to ensure all tests pass after your changes
- When writing new tests, follow the Test Best Practices section above
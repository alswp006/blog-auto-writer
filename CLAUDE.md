# CLAUDE.md — Project Rules

## CRITICAL: STANDALONE Next.js app
- INDEPENDENT app, NOT monorepo. Only import from node_modules or src/
- No @ai-factory/*, drizzle-orm, @libsql/client. Check package.json first
- DB: use better-sqlite3 (already configured in src/lib/db.ts)

## Commands
- pnpm install --ignore-workspace / build / typecheck / test / dev
- IMPORTANT: Always use --ignore-workspace with pnpm to avoid monorepo interference
- Build: npx next build --experimental-app-only (verify it passes before finishing)
- IMPORTANT: Always use --experimental-app-only with next build to avoid Turbopack Pages Router errors in Next.js 15.5+

## Pre-built Auth (DO NOT RECREATE)
- src/lib/auth.ts — cookie sessions + bcrypt
- src/lib/models/user.ts — user CRUD
- src/app/api/auth/{login,signup,logout,me}/route.ts — API routes
- src/app/{login,signup}/page.tsx — UI pages
- src/middleware.ts — route protection (/dashboard/* requires auth)
- To add new protected routes: update PROTECTED_PREFIXES in middleware.ts
- CRITICAL: Stale session handling — when dashboard detects no user, use `redirect("/login?logged_out")` (NOT `redirect("/login")`). The `?logged_out` param tells middleware to clear the stale cookie. Without it → infinite redirect loop.
- CRITICAL: NEVER call destroySession() or cookies().delete() in Server Components — only Route Handlers and Server Actions can modify cookies in Next.js 15. Middleware handles cookie cleanup via the `?logged_out` param.

## TDD (CRITICAL)
- src/__tests__/ files are READ-ONLY — NEVER modify
- Tests define required exports. Read imports → create matching modules in src/lib/
- Run pnpm test + pnpm typecheck before finishing

## Code Style
- TypeScript strict, Next.js 15 App Router, all files in src/
- Tailwind CSS only (no inline styles), no .eslintrc files

## CRITICAL: CSS Specificity in globals.css (Tailwind v4) — DO NOT VIOLATE
- Tailwind v4 puts ALL utilities in `@layer utilities`
- Any CSS OUTSIDE `@layer` has HIGHER specificity → silently overrides ALL Tailwind utilities (pt-16, px-4, gap-6, mb-4, text-white, etc.)
- `* { padding: 0 }` outside @layer will BREAK EVERY LAYOUT IN THE APP
- ALWAYS wrap base/reset/element styles (body, *, a, ::selection) in `@layer base { }`
- ALWAYS wrap custom utility classes in `@layer components { }`
- ONLY `:root` (CSS variable declarations) and scrollbar pseudo-elements may be outside @layer
- If you edit globals.css: VERIFY every non-:root rule is inside an @layer block

## Design System — shadcn/ui + "Linear meets Notion" aesthetic
Read `.claude/skills/frontend-design/SKILL.md` for full aesthetic direction.

### Component Library (ALWAYS use these — never raw HTML equivalents)
```tsx
import { Button } from "@/components/ui/button"    // variant: default|outline|ghost|secondary|destructive
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"       // variant: default|secondary|destructive|success|warning|outline
import { cn } from "@/lib/utils"
```

### Layout Rules
- Page wrapper: NO max-width (full-bleed sections)
- Each section: `<section className="w-full py-20"><div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">{content}</div></section>`
- Hero: min-h-[70vh] flex items-center, gradient bg spans full width
- Responsive: grid-cols-1 md:grid-cols-2 lg:grid-cols-3

### Colors (CSS vars ONLY — never hardcode hex)
- bg: var(--bg), var(--bg-elevated), var(--bg-card), var(--bg-input)
- text: var(--text), var(--text-secondary), var(--text-muted)
- accent: var(--accent), var(--accent-soft)
- border: var(--border), var(--border-hover)
- semantic: var(--success-soft), var(--danger-soft), var(--warning-soft)

### Anti-patterns
- Cramped layouts — generous whitespace is a feature
- Flat hierarchy — vary size, weight, and color for contrast
- Unstyled elements — every button/link needs rounded corners + hover state
- Narrow trapped content — use available width, full-bleed sections
- CSS outside `@layer` — breaks Tailwind utilities

## Navigation
- Every page reachable from header nav. Login<->Signup cross-linked.
- Layout at src/app/layout.tsx — UPDATE it, don't recreate.
- Nav component at src/components/ui/nav.tsx — add links for new pages here.

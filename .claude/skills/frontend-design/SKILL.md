# Frontend Design Skill — Aesthetic Direction

## Design Identity
**"Linear meets Notion"** — Clean, purposeful interfaces with generous whitespace and clear hierarchy. Every element earns its place.

## Component Library: shadcn/ui
All UI components live in `src/components/ui/`. Import and use these — NEVER write raw HTML equivalents:

```tsx
import { Button } from "@/components/ui/button"        // variant: default|outline|ghost|secondary|destructive|link, size: sm|default|lg
import { Input } from "@/components/ui/input"           // Styled text input with focus ring
import { Label } from "@/components/ui/label"           // Form labels
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"     // Styled textarea
import { Badge } from "@/components/ui/badge"           // variant: default|secondary|destructive|success|warning|outline
import { cn } from "@/lib/utils"                        // Class merging utility
```

### Button Patterns
```tsx
// Standard button
<Button variant="default">Primary Action</Button>

// Link-as-button (wraps Next.js Link)
<Button asChild><Link href="/signup" className="no-underline">Sign Up</Link></Button>

// Ghost nav links
<Button variant="ghost" size="sm" asChild><Link href="/pricing" className="no-underline">Pricing</Link></Button>
```

## Aesthetic Anchors

### Spacing — Think "magazine layout"
- Sections breathe: generous vertical rhythm between page sections
- Cards feel spacious: comfortable internal padding, never cramped
- Forms are relaxed: visible gaps between fields, labels clearly separated from inputs
- Gutenberg principle: content flows naturally top-left to bottom-right

### Typography — Clear hierarchy at a glance
- Headlines command attention with size and weight contrast
- Body text is comfortable to read (1.7 line-height, especially important for Korean text)
- Meta/secondary text is visually recessed but still legible
- No two adjacent elements should be the same size unless they're peers

### Color — Subtle depth layers
- Background establishes depth: bg → bg-elevated → bg-card (darkest to lightest card surface)
- Accent color is surgical: used for primary actions, active states, and key highlights only
- Semantic colors (success/danger/warning) only for status communication
- All colors via CSS variables — never hardcode hex

### Layout — Full-width sections, constrained content
- Page wrapper: NO max-width (allows full-bleed backgrounds and gradients)
- Each section: full-width wrapper + `max-w-6xl mx-auto px-4 md:px-6 lg:px-8` inner container
- Hero sections: min-h-[70vh], centered content, gradient backgrounds span full width
- Responsive grids: 1 col mobile → 2-3 cols desktop

### Interactive Polish
- All buttons and clickable elements: transition-all duration-200
- Cards: hover:shadow-lg hover:border-[var(--accent)]/30 for depth on interaction
- Focus states: visible ring for accessibility
- Loading: skeleton shimmer (animate-pulse), not spinners

## Anti-patterns (Principle-based)
- **Cramped layouts**: If it feels tight, add more space. White space is a feature.
- **Flat hierarchy**: If everything looks the same, nothing stands out. Vary size, weight, and color.
- **Unstyled elements**: Every interactive element needs rounded corners, padding, hover state.
- **Narrow content**: Content should use available width. Don't trap everything in a narrow column.
- **CSS specificity breaks**: Base styles outside `@layer` will override Tailwind utilities. Always use `@layer base {}`.

## Reference Check
> "Would this look at home on Linear's marketing site or Notion's settings page?"

If the answer is no, simplify and refine. Remove decoration, increase whitespace, sharpen hierarchy.

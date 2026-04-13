# Page Color System — Visual Upgrade

**Date:** 2026-04-12
**Scope:** Add per-page accent colors to all pages via CSS variables, tinted card backgrounds, colored labels, left accent borders. Both dark and light mode.

---

## Problem

All pages look identical — flat dark gray cards with no visual hierarchy, no color differentiation, no personality. You can't tell which page you're on by glancing at the cards. Everything is "blah."

## Design

### Color Assignments

| Page | Accent Color | Hex | Why |
|---|---|---|---|
| Today | Teal | `#00E0D0` | Primary brand color, the command center |
| Work | Blue | `#3B82F6` | Productivity, tasks, operations |
| Money | Emerald | `#10B981` | Money = green |
| Health | Rose | `#F43F5E` | Vitals, energy, body |
| Brain | Purple | `#A78BFA` | Knowledge, creativity, learning |
| HomeLife | Amber | `#F59E0B` | Warmth, household |
| Skills | Indigo | `#6366F1` | Automation, intelligence |

### Implementation: CSS Variable Approach

**1. New CSS variable:** `--page-accent`

Each page view component sets this on its root wrapper:
```jsx
<div style={{ "--page-accent": "#10B981" }}>
```

**2. Update `.surface` class in `index.css`:**

Dark mode:
```css
.surface {
  background: color-mix(in srgb, var(--page-accent, transparent) 4%, var(--jarvis-surface));
  border: 1px solid color-mix(in srgb, var(--page-accent, transparent) 12%, var(--jarvis-border));
  border-left: 3px solid color-mix(in srgb, var(--page-accent, transparent) 50%, transparent);
  border-radius: 14px;
}
```

Light mode:
```css
[data-theme="light"] .surface {
  background: color-mix(in srgb, var(--page-accent, transparent) 5%, var(--jarvis-surface));
  border: 1px solid color-mix(in srgb, var(--page-accent, transparent) 15%, var(--jarvis-border));
  border-left: 3px solid color-mix(in srgb, var(--page-accent, transparent) 40%, transparent);
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}
```

**3. Update `.label` class:**

```css
.label {
  color: var(--page-accent, var(--jarvis-muted));
  font-weight: 600;
}
```

This makes section headers use the page accent color instead of muted gray.

**4. Fallback:** When `--page-accent` is not set (e.g. Settings), everything falls back to the current styling — no accent tint, labels use `--jarvis-muted`.

### Files to Modify

| File | Change |
|---|---|
| `src/index.css` | Update `.surface` and `.label` to use `--page-accent` with fallbacks |
| `src/views/Today.jsx` | Add `--page-accent: #00E0D0` on root div |
| `src/views/Work.jsx` | Add `--page-accent: #3B82F6` on root div |
| `src/views/Money.jsx` | Add `--page-accent: #10B981` on root div |
| `src/views/Health.jsx` | Add `--page-accent: #F43F5E` on root div |
| `src/views/Brain.jsx` | Add `--page-accent: #A78BFA` on root div |
| `src/views/HomeLife.jsx` | Add `--page-accent: #F59E0B` on root div |
| `src/views/Skills.jsx` | Add `--page-accent: #6366F1` on root div |

### What Changes Visually

- Card backgrounds get a subtle 4% tint of the page accent color
- Card borders get a 12% tint of the accent
- Cards get a 3px left accent border (50% opacity of accent)
- Section header labels (`.label` class) use the accent color instead of gray
- Light mode gets the same treatment with slightly adjusted opacities

### What Stays the Same

- Card layouts, sizes, spacing — untouched
- Component internals — untouched
- Dark mode base colors — untouched
- Status colors (success/warning/danger pills) — untouched
- The right sidebar (CalendarRail, pending approvals) — uses page accent from parent

## Out of Scope

- Redesigning individual card contents or layouts
- Animation or motion effects
- New components or features
- Changing the sidebar navigation colors

## Testing

- Visit each page in dark mode — verify accent colors are visible but subtle
- Toggle to light mode — verify accents work on white backgrounds
- Verify Settings and other non-accent pages still look normal (fallback works)
- Verify the right sidebar inherits the page accent naturally

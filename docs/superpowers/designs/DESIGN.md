# Design System Document: High-End Editorial SaaS

## 1. Overview & Creative North Star
**Creative North Star: "The Ethereal Atelier"**

This design system moves beyond the cold, clinical nature of standard SaaS platforms to embrace a "warm professional" aesthetic. Inspired by high-end editorial layouts and luxury retail, the system prioritizes "The Ethereal Atelier" concept—a space that feels bespoke, curated, and intentionally light. 

We break the "template" look by rejecting rigid containment. Instead of boxing users into a grid, we use **intentional asymmetry** and **tonal depth**. Large, breathable margins and overlapping "paper" layers create an environment where AI-driven insights feel like premium advice rather than raw data.

---

## 2. Colors & Surface Philosophy

The palette is rooted in warm neutrals, moving away from pure greys to create a welcoming, sophisticated atmosphere.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Boundaries must be defined solely through background color shifts or subtle tonal transitions. For example, a `surface-container-low` section sitting on a `background` provides all the definition needed without the "cheap" feel of a stroke.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine vellum.
- **Base Layer:** `background` (#f9f9f8) – The canvas.
- **Section Layer:** `surface-container-low` (#f3f4f3) – For grouping related modules.
- **Card Layer:** `surface-container-lowest` (#ffffff) – For the highest level of interaction focus.

### The "Glass & Gold" Rule
- **Glassmorphism:** For floating menus or modals, use `surface` with 80% opacity and a `backdrop-blur` of 12px. This ensures the layout feels integrated.
- **Signature Textures:** For primary CTAs (`primary` #735c00), use a subtle radial gradient transitioning from the center outward to `primary-container` (#d4af37) to give the button a "light-catching" metallic quality.

---

## 3. Typography
We utilize **Inter** not as a system font, but as a brand anchor.

| Level | Token | Weight | Size | Tracking | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Display** | `display-lg` | 700 | 3.5rem | -0.02em | Editorial Hero statements |
| **Headline** | `headline-md` | 600 | 1.75rem | -0.01em | Major section headers |
| **Title** | `title-md` | 600 | 1.125rem | 0 | Module titles |
| **Body** | `body-md` | 400 | 0.875rem | 0 | General interface text |
| **Label** | `label-sm` | 600 | 0.6875rem | 0.05em | Uppercase Romanian tags |

**Editorial Intent:** Use `display-lg` sparingly to break the rhythm of the page. Pair large headlines with generous `16 (5.5rem)` vertical spacing to signal a "premium" pause in content.

---

## 4. Elevation & Depth

### Tonal Layering
Depth is achieved by "stacking" surface tiers. To lift a card, do not reach for a shadow first; instead, place a `surface-container-lowest` (#ffffff) element on top of a `surface-container` (#eeeeed) background.

### Ambient Shadows
When a "floating" effect is mandatory (e.g., Modals or Popovers), use an extra-diffused shadow:
- **Shadow:** `0 12px 32px -4px rgba(41, 37, 36, 0.08)`
- The shadow uses a tint of our charcoal (`on-surface`), ensuring it feels like a natural obstruction of light.

### The "Ghost Border" Fallback
If a border is required for accessibility, use the "Ghost Border": `outline-variant` (#d0c5af) at **15% opacity**. Never use 100% opaque strokes.

---

## 5. Components

### Buttons (Butoane)
- **Primary:** Background `primary` (#735c00), Text `on-primary` (#ffffff). Apply a subtle 4px inner-glow at the top for a tactile feel.
- **Secondary:** Background `secondary-container` (#e6dedc), Text `on-secondary-fixed` (#1e1b1a).
- **Radius:** `DEFAULT` (0.5rem / 8px).

### Input Fields (Câmpuri de Intrare)
- **Style:** Background `surface-container` (#eeeeed), no border. 
- **Focus State:** 2px ring using `brand-accent` (#d4af37).
- **Label:** `label-md` in Romanian (e.g., "Nume Utilizator").

### Cards & Lists (Carduri și Liste)
- **Forbidden:** No divider lines.
- **Separation:** Use `Spacing 4` (1.4rem) of white space or a subtle shift from `surface-container-lowest` to `surface-container-low`.
- **Interaction:** On hover, a card should transition its background slightly or increase shadow spread by 2px—never add a border.

### Chips (Etichete)
- **Shape:** `sm` (0.25rem / 4px).
- **Color:** `tertiary-container` (#97b0ff) with `on-tertiary-container` (#254188) for AI-generated suggestions to distinguish from human-input data.

---

## 6. Do’s and Don’ts

### Do
- **Do** use Romanian localization (e.g., "Panou de control" instead of "Dashboard").
- **Do** use asymmetrical margins (e.g., 80px left, 120px right) on editorial landing pages to create visual interest.
- **Do** use `primary-fixed-dim` (#e9c349) for subtle focus states to maintain warmth.

### Don't
- **Don't** use pure black (#000000). Use our Charcoal (#1C1917) for all "black" text.
- **Don't** use 1px dividers to separate list items. Use vertical rhythm.
- **Don't** use harsh, high-contrast shadows. If the shadow is clearly visible at a glance, it is too heavy.
- **Don't** crowd elements. If in doubt, increase the spacing token by one level (e.g., from `4` to `5`).

---

## 7. Romanian Localization Samples
| English | Romanian (Context: SaaS) |
| :--- | :--- |
| Settings | Setări |
| Inventory | Inventar |
| Growth Insights | Analiză Creștere |
| Save Changes | Salvează Modificările |
| Add Product | Adaugă Produs |
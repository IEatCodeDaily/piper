# Design System Specification: The Precision Engine



## 1. Overview & Creative North Star

### The Creative North Star: "The Digital Architect"

This design system moves away from the "plastic" feel of standard enterprise software and toward the "Architectural" aesthetic. It is characterized by high-density information environments that remain breathable through intentional tonal layering rather than physical barriers. We are building a tool for high-performance teams who value speed, precision, and clarity.



**The Signature Shift:**

We reject the "box-in-a-box" layout. Instead of rigid grids separated by heavy lines, we use **Asymmetric Functional Grouping**. Content is organized by purpose, using extreme typographic contrast and "Subtle Depth" to guide the eye. The interface should feel like a custom-machined instrument—cold, precise, but incredibly smooth to operate.



---



## 2. Color & Surface Strategy

Our palette relies on a sophisticated hierarchy of slates and navies. To achieve a premium feel, we prioritize "Surface-on-Surface" depth over traditional borders.



### The "No-Line" Rule

**Explicit Instruction:** Do not use 1px solid borders (`outline`) for sectioning or layout containers. Boundaries must be defined solely through background color shifts.

- *Application:* A sidebar using `surface_container_low` should sit directly against a main content area of `surface`. No divider is permitted.



### Surface Hierarchy & Nesting

Treat the UI as a series of stacked, precision-cut sheets. Use the following tiers to define importance:

- **Base Layer:** `surface` (#f7f9fb) – The "desk" everything sits on.

- **Structural Grouping:** `surface_container_low` (#f2f4f6) – For sidebars or utility panels.

- **Interactive Focus:** `surface_container_lowest` (#ffffff) – For the primary workspace, editor, or task list. This "pops" forward naturally.

- **Overlays:** `surface_container_highest` (#e0e3e5) – For contextual menus and modals.



### The "Glass & Gradient" Rule

To prevent the UI from feeling "flat," floating elements (Command Palettes, Popovers) must use **Glassmorphism**.

- **Token:** `surface_container_low` at 80% opacity + 12px Backdrop Blur.

- **Signature Texture:** Primary CTAs should use a subtle linear gradient from `primary` (#000000) to `primary_container` (#111c2d) at a 145-degree angle. This adds "weight" and "soul" to the action.



---



## 3. Typography: The Editorial Scale

We utilize a dual-font strategy to balance character with extreme legibility.



| Level | Token | Font | Size | Weight | Use Case |

| :--- | :--- | :--- | :--- | :--- | :--- |

| **Display** | `display-md` | Manrope | 2.75rem | 700 | Dashboard hero stats |

| **Headline** | `headline-sm` | Manrope | 1.5rem | 600 | Project titles, page headers |

| **Title** | `title-sm` | Inter | 1rem | 600 | Card titles, section headers |

| **Body** | `body-md` | Inter | 0.875rem | 400 | Descriptions, task names |

| **Label** | `label-sm` | Inter | 0.6875rem | 700 | Metadata, "Uppercase" tags |



**Design Note:** Use `label-sm` with 0.05em letter-spacing for all technical metadata to create a "pro-tool" aesthetic that distinguishes data from content.



---



## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows are forbidden unless an element is literally "floating" above the entire workspace.



- **The Layering Principle:** Depth is achieved by placing `surface_container_lowest` cards on a `surface_container_high` background. The contrast in lightness provides the "lift."

- **Ambient Shadows:** For modals or floating menus, use a "Shadow-as-Light" approach.

- *Shadow:* 0px 12px 32px rgba(25, 28, 30, 0.06).

- *Color:* The shadow must be tinted with `on_surface` (#191c1e) to feel integrated with the slate environment.

- **The "Ghost Border" Fallback:** If accessibility requires a container edge (e.g., in high-density tables), use `outline_variant` at **15% opacity**. It should be felt, not seen.



---



## 5. Components & High-Density Patterns



### Buttons

- **Primary:** Gradient from `primary` to `primary_container`. White text. Radius `md` (0.375rem).

- **Secondary:** Surface `surface_container_highest` with `on_surface` text. No border.

- **Tertiary (Ghost):** No background. Hover state uses `surface_container_low`.



### High-Density Tables (The Core Workhorse)

- **Header:** Use `label-md` with `on_surface_variant`. No background color.

- **Rows:** No horizontal dividers. Use a `surface_container_low` background on `:hover`.

- **Spacing:** Use Spacing Scale `2.5` (0.5rem) for vertical cell padding to maintain high information density.



### Cards & Lists

- **Rule:** Never use dividers.

- **Separation:** Use Spacing Scale `4` (0.9rem) between items. Use a subtle background shift (`surface_container_lowest`) to distinguish individual cards from the background.



### Custom Component: The "Status Pillar"

Instead of large colored badges, use a 2px vertical "pillar" of color (e.g., `error` #ba1a1a) on the far left of a task list item. This keeps the UI clean while providing instant color-coded status.



---



## 6. Do’s and Don'ts



### Do

- **Do** use `manrope` for numbers. Its geometric nature feels more "calculated" and professional for project metrics.

- **Do** use "Negative Space as a Divider." If two elements are related, use Spacing `2`. If they are different sections, jump to Spacing `8`.

- **Do** use `surface_bright` for active states in the navigation sidebar to create a "glowing" selection effect.



### Don't

- **Don't** use pure black (#000000) for text. Always use `on_surface` to maintain the navy/slate tonal harmony.

- **Don't** use standard 1px borders. If you feel the need to draw a line, try changing the background color of the adjacent container first.

- **Don't** use "Alert Yellow" for warnings. Use the sophisticated `on_tertiary_container` (#008cc7) for a more professional, "informational warning" tone.



---



## 7. Spacing & Rhythm

The system operates on a rigid **0.2rem (4px) base unit** to ensure mathematical harmony.

- **Small Components (Chips/Labels):** Spacing `1.5` (0.3rem)

- **Standard Padding:** Spacing `4` (0.9rem)

- **Section Gaps:** Spacing `10` (2.25rem)



By strictly adhering to these increments, the layout will achieve the "Fluent" precision requested, feeling intentional and high-performance.
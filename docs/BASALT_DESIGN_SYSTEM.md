# Basalt Design System & Centralization Architecture (Mobile-First)

## 1. Executive Summary & Design Vision

**Name:** Basalt  
**Concept:** *Cut stone with one loud color.*  

The interface transforms Burrow into a carved, engineered surface rather than a conventional rounded SaaS UI. Shapes are **angled instead of rounded**, built upon a mid-tone slate foundation (`#22303F`) with **sulfur yellow (`#F2D22E`)** as the primary high-voltage accent.

### Core Visual Principles
1. **Angular, Not Rounded**: Zero `border-radius`. Chamfered geometric corners, hexagonal avatars/identity marks, and diamond status markers.
2. **Slate Foundation + Loud Accent**: Mid-tone blue slate background, dark slate sidebar, and sulfur yellow applied with strict intentionality to primary actions, active navigation, and key status.
3. **Structural Status**: Cards and columns communicate status via **left-edge color bars** and **geometric diamonds**, rather than floating circular pills or soft badges.
4. **Engineered Industrial Feel**: Archivo heavy typography, flat surfaces, zero floating SaaS drop-shadows, and crisp structural borders.

---

## 2. Mobile-First Principles & Touch Ergonomics

Basalt's angular aesthetics must feel natural, high-performance, and ergonomic on handheld screens. Mobile-first design is enforced across the entire component library:

### 2.1 Touch Targets & Hit Areas (44px Minimum Rule)
* **Visual vs. Touch Box**: While chamfered buttons, diamond status indicators (8px–9px), and tree icons may have compact visual footprints, interactive wrappers must always maintain an accessible hit box of at least **44 × 44px** on touch viewports (`< 768px`).
* **Tree Item Padding**: Tree row items in sidebar navigation include vertical padding and expanded tap zones to prevent mis-clicks.

### 2.2 Chamfer Safe Areas & Viewport Edge Handling
* **Text Clipping Prevention**: On small screens, chamfer polygons (`polygon(...)`) must never cut into text or icon hitboxes. Components enforce horizontal internal padding (`px-3` or `px-4`) exceeding the chamfer cut dimension (7px or 14px).
* **Full-Bleed Surfaces**: Mobile drawers, header bars, and bottom sheets clip only on exposed interior corners; edges meeting viewport boundaries remain flush (`0px`).

### 2.3 Mobile Navigation & Drawers
* **Angular Mobile Drawer**: The mobile sidebar drawer in [AppShell.tsx](file:///d:/Burrow/src/web/components/layout/AppShell.tsx) transitions from a generic floating panel to a flush, slate-backed panel (`--side`) with a 4px sulfur-yellow active border indicator.
* **Sticky Mobile Header**: 48px dense slate header bar (`--side`) with hexagonal project mark, high-contrast title, and accessible menu trigger.

### 2.4 Mobile Board & List Ergonomics
* **Kanban Columns**: On viewports `< 768px`, Kanban columns support smooth CSS scroll-snap (`snap-x snap-mandatory`) or column pagination tabs, avoiding cramped multi-column rendering.
* **Filter Bar**: On mobile, board filters and segmented view switchers (Kanban / List / Calendar) sit in a horizontally scrollable chip track (`overflow-x-auto no-scrollbar py-1`) or collapse into an angular filter sheet.
* **Card Touch Actions**: Cards utilize the 4px left status bar without relying on hover states. Touch-and-hold gestures or clear tap-to-open card details replace desktop hover menus.

### 2.5 Mobile Form Inputs & Typography
* **Auto-Zoom Prevention**: All inputs, search fields, and selects maintain a minimum font size of `16px` on mobile screens to prevent iOS Safari auto-zooming.
* **Keyboard-Aware Drawers**: [CardPanel.tsx](file:///d:/Burrow/src/web/components/boards/CardPanel.tsx) and [CommandPalette.tsx](file:///d:/Burrow/src/web/components/CommandPalette.tsx) accommodate the virtual keyboard using `100dvh` (dynamic viewport height) and bottom-safe area padding.

---

## 3. Current System Assessment & Gap Analysis

Our audit of the current Burrow codebase ([src/web](file:///d:/Burrow/src/web)) reveals complete absence of centralization and heavy reliance on generic SaaS patterns:

| Area | Current Codebase | Basalt Requirement | Gap Severity |
| :--- | :--- | :--- | :--- |
| **Tokens & Theme** | Generic monochromatic OKLCH in [src/web/index.css](file:///d:/Burrow/src/web/index.css) | Slate palette (`#22303F`) + Sulfur yellow (`#F2D22E`) | Critical |
| **Typography** | Default system sans-serif font stack | **Archivo** with variable axes (`wdth` 122 headings, `wdth` 100 body) | Critical |
| **Corner Radius** | `rounded-lg`, `rounded-xl`, `rounded-full` across 28 files | `0px` radius everywhere + chamfered polygons | High |
| **Avatars** | `rounded-full` circular spans ([KanbanView.tsx:205](file:///d:/Burrow/src/web/components/boards/views/KanbanView.tsx#L205)) | **Hexagonal masks** (`clip-path`) | High |
| **Status Dots** | `rounded-full` colored dots ([KanbanView.tsx:336](file:///d:/Burrow/src/web/components/boards/views/KanbanView.tsx#L336), [ListView.tsx:70](file:///d:/Burrow/src/web/components/boards/views/ListView.tsx#L70)) | **Diamond status markers** (`rotate(45deg)`) | Medium |
| **Card Styling** | Soft rounded cards with drop shadows (`rounded-xl shadow-xs hover:shadow-md`) | Flat surface, **small chamfer**, **4px left-edge status bar** | High |
| **Active Nav** | Soft rounded background pills (`rounded-lg bg-neutral-200/50`) | Angular container + **4px sulfur-yellow left accent bar** | High |
| **Tree Icons** | Generic Lucide document icons ([NotepadTree.tsx:187](file:///d:/Burrow/src/web/components/notepads/NotepadTree.tsx#L187)) | **Diamond hierarchy markers** | Medium |
| **UI Primitives** | No centralized `components/ui/` library; ad-hoc duplicate classes everywhere | Centralized `Button`, `Card`, `Input`, `Badge`, `Avatar`, `SegmentedControl` | Critical |

---

## 4. Centralized Multi-Layer Architecture

To maintain the rule that **Basalt is a theme layer, not an application rewrite**, the design system is organized into four layers:

```
┌────────────────────────────────────────────────────────┐
│               4. Domain Feature Views                  │
│    (Kanban, BoardView, CardPanel, Sidebar, Notepad)    │
└──────────────────────────┬─────────────────────────────┘
                           │ uses
┌──────────────────────────▼─────────────────────────────┐
│          3. Centralized UI Primitives (ui/)            │
│  Button, Card, Input, Badge/Chip, Avatar, Segmented,   │
│            StatusDiamond, ModalShell, TreeItem         │
└──────────────────────────┬─────────────────────────────┘
                           │ built with
┌──────────────────────────▼─────────────────────────────┐
│          2. Geometric & Utility System                 │
│      .chamfer-lg, .chamfer-sm, .clip-hex, cn()         │
└──────────────────────────┬─────────────────────────────┘
                           │ tokens from
┌──────────────────────────▼─────────────────────────────┐
│       1. Basalt Token Engine (index.css & theme)       │
│  Slate/Yellow CSS Variables, Archivo Font Axes, 0px R  │
└────────────────────────────────────────────────────────┘
```

### Layer 1: Token Engine ([src/web/index.css](file:///d:/Burrow/src/web/index.css))
* Injected into `:root` and `.dark` blocks.
* Bound to Tailwind CSS v4 using `@theme inline`.
* Enforces `border-radius: 0px` across all controls.

### Layer 2: Shape & Utility System
CSS classes encapsulating SVG/polygon clip-paths:
* **Large Chamfer (`.chamfer-lg`)**:
  ```css
  clip-path: polygon(
    14px 0,
    100% 0,
    100% calc(100% - 14px),
    calc(100% - 14px) 100%,
    0 100%,
    0 14px
  );
  ```
* **Small Chamfer (`.chamfer-sm`)**:
  ```css
  clip-path: polygon(
    7px 0,
    100% 0,
    100% calc(100% - 7px),
    calc(100% - 7px) 100%,
    0 100%,
    0 7px
  );
  ```
* **Hexagon (`.clip-hex`)**:
  ```css
  clip-path: polygon(
    25% 6%,
    75% 6%,
    100% 50%,
    75% 94%,
    25% 94%,
    0 50%
  );
  ```
* **Diamond Marker (`.shape-diamond`)**:
  ```css
  display: inline-block;
  transform: rotate(45deg);
  ```
* **Class Variance Authority Helper**: Centralized `cn(...)` in [src/web/lib/utils.ts](file:///d:/Burrow/src/web/lib/utils.ts) leveraging existing `clsx` and `tailwind-merge`.

### Layer 3: Centralized UI Primitives (`src/web/components/ui/`)
1. **`Button`**:
   * `primary`: Sulfur yellow background (`--accent`), dark slate text (`--accent-ink`), angular edges, active state brightness boost.
   * `secondary`: Slate surface (`--surface`), structural border (`--line`), hover highlight (`--hi`).
   * `ghost` / `danger`: Flat geometric variants.
   * Mobile min-height: `44px` on touch screens.
2. **`Card`**:
   * `--surface` background, `chamfer-sm` clip-path, inset 4px status bar on left edge (`box-shadow: inset 4px 0 0 var(--status-color)`).
   * No outer drop shadows; hover states apply crisp surface lightening (`--hi`).
3. **`Avatar` & `AvatarGroup`**:
   * Hexagonal geometry (`clip-hex`), initials or image fill.
   * Negative-margin horizontal overlap for avatar groups.
4. **`Badge` & `FilterChip`**:
   * Angular chips (`chamfer-sm`), `--surface2` fill, compact typography.
   * Touch-friendly padding on mobile screens.
5. **`Input` & `Select`**:
   * Flat `--surface` fill, `--line` structural border, 0px border-radius, sulfur-yellow focus accent (`focus:border-accent`).
   * 16px font size on mobile to prevent iOS zooming.
6. **`SegmentedControl`**:
   * Angular `--surface2` container. Selected tab receives sulfur-yellow `--accent` with `--accent-ink` text.
7. **`StatusDiamond`**:
   * Reusable component for column headers, priority markers, and tree node hierarchy.

### Layer 4: Domain Styling Adapters
* Centralized mapping of priority to status tokens:
  * Urgent: `--danger` (`#FF7A7A` / `#C0392B`)
  * High: `--c2` (`#E59A52`)
  * Medium: `--c3` (`#5DB3CE`)
  * Low: `--c4` (`#6CC48C`)
* Unified column status color resolution.

---

## 5. Color Tokens Reference

### Dark Mode (Primary Visual Identity)
| Token | Value | Purpose |
| :--- | :--- | :--- |
| `--bg` | `#22303F` | Main application background (blue slate) |
| `--side` | `#1A2531` | Sidebar and mobile drawer background |
| `--side-text` | `#E6EDF3` | Sidebar primary text |
| `--surface` | `#2D3E51` | Cards and primary content surfaces |
| `--surface2` | `#1E2A37` | Secondary surfaces, columns, and filter trays |
| `--text` | `#E6EDF3` | Primary application text |
| `--muted` | `#93A4B5` | Secondary / placeholder text |
| `--line` | `#3A4C60` | Structural borders |
| `--hair` | `#33455A` | Subtle separators |
| `--accent` | `#F2D22E` | Sulfur yellow primary accent |
| `--accent-ink`| `#1B2733` | High-contrast dark text on sulfur yellow |
| `--hi` | `#34485E` | Active / selected neutral background |
| `--hi-ink` | `#E6EDF3` | Text on selected neutral surface |
| `--danger` | `#FF7A7A` | Error and overdue status |
| `--ink` | `#E6EDF3` | Content typography |
| `--ink-muted`| `#A6B6C5` | Secondary content typography |
| `--c1` | `#93A4B5` | Status: To Do / neutral |
| `--c2` | `#E59A52` | Status: In Progress |
| `--c3` | `#5DB3CE` | Status: In Review |
| `--c4` | `#6CC48C` | Status: Done |

### Light Mode
| Token | Value | Purpose |
| :--- | :--- | :--- |
| `--bg` | `#E4E9EE` | Main background |
| `--side` | `#D5DCE4` | Sidebar and mobile drawer |
| `--side-text` | `#1B2733` | Sidebar text |
| `--surface` | `#F6F9FB` | Cards and primary surfaces |
| `--surface2` | `#D6DDE5` | Columns and secondary surfaces |
| `--text` | `#1B2733` | Primary text |
| `--muted` | `#556677` | Secondary text |
| `--line` | `#B9C4CF` | Structural borders |
| `--hair` | `#C3CCD6` | Subtle separators |
| `--accent` | `#E0BE0A` | Primary yellow accent |
| `--accent-ink`| `#1B2733` | Text on accent |
| `--hi` | `#C5D0DB` | Active / selected background |
| `--hi-ink` | `#1B2733` | Text on selected background |
| `--danger` | `#C0392B` | Error / overdue |
| `--ink` | `#1B2733` | Content text |
| `--ink-muted`| `#556677` | Secondary content text |

---

## 6. Typography Scale & Implementation

### Font Configuration
* **Family**: `Archivo`, sans-serif
* **Headings**: Heavy, wide, compact tracking (`font-variation-settings: 'wdth' 122, 'wght' 800; letter-spacing: -0.02em`)
* **Body**: Standard width, highly legible neutral tracking (`font-variation-settings: 'wdth' 100, 'wght' 400`)

### Scale
* **Display / Page Heading**: `26px–32px` (Weight 800, Width 122)
* **Section / Column Heading**: `14px–16px` (Weight 800, Width 122, uppercase tracking +0.02em)
* **Card Titles & Body**: `14px` (Weight 500, Width 100)
* **Metadata & Badges**: `10px–11px` (Weight 600, Width 100)

---

## 7. Phased Implementation Roadmap

### Phase 1: Foundation (Tokens, Font & Geometry)
* [index.html](file:///d:/Burrow/index.html): Import Google Font `Archivo` (variable axes for weight and width).
* [src/web/index.css](file:///d:/Burrow/src/web/index.css): Define Basalt CSS tokens, zero-radius reset, `.chamfer-lg`, `.chamfer-sm`, `.clip-hex`, and heading display utility.
* [src/web/lib/utils.ts](file:///d:/Burrow/src/web/lib/utils.ts): Create `cn()` utility combining `clsx` and `tailwind-merge`.

### Phase 2: Centralized UI Primitives
* Create `src/web/components/ui/`:
  * [Button.tsx](file:///d:/Burrow/src/web/components/ui/Button.tsx)
  * [Card.tsx](file:///d:/Burrow/src/web/components/ui/Card.tsx)
  * [Badge.tsx](file:///d:/Burrow/src/web/components/ui/Badge.tsx) / [Chip.tsx](file:///d:/Burrow/src/web/components/ui/Chip.tsx)
  * [Avatar.tsx](file:///d:/Burrow/src/web/components/ui/Avatar.tsx)
  * [Input.tsx](file:///d:/Burrow/src/web/components/ui/Input.tsx)
  * [Select.tsx](file:///d:/Burrow/src/web/components/ui/Select.tsx)
  * [SegmentedControl.tsx](file:///d:/Burrow/src/web/components/ui/SegmentedControl.tsx)
  * [StatusDiamond.tsx](file:///d:/Burrow/src/web/components/ui/StatusDiamond.tsx)

### Phase 3: Shell & Navigation (Mobile-First)
* [AppShell.tsx](file:///d:/Burrow/src/web/components/layout/AppShell.tsx): Slate background canvas, angular header bar, 44px hit-box mobile drawer toggle.
* [Sidebar.tsx](file:///d:/Burrow/src/web/components/layout/Sidebar.tsx): Hexagonal workspace badge, angular search input with shortcut kbd, 4px sulfur-yellow active navigation bar.
* [NotepadTree.tsx](file:///d:/Burrow/src/web/components/notepads/NotepadTree.tsx): Replace document icons with status/hierarchy diamonds; expand mobile hit boxes to 44px.

### Phase 4: Board & Views
* [BoardView.tsx](file:///d:/Burrow/src/web/components/boards/BoardView.tsx): Archivo heavy headings, angular filter chips, segmented view controls with yellow active indicator.
* [KanbanView.tsx](file:///d:/Burrow/src/web/components/boards/views/KanbanView.tsx): Columns with `chamfer-lg`, cards with `chamfer-sm` and 4px left-edge status bar, status diamonds on headers. Mobile horizontal snap scrolling.
* [ListView.tsx](file:///d:/Burrow/src/web/components/boards/views/ListView.tsx) & [CalendarView.tsx](file:///d:/Burrow/src/web/components/boards/views/CalendarView.tsx): Align status indicators, priority markers, and row geometry.

### Phase 5: Card Details, Editor & Dialogs
* [CardPanel.tsx](file:///d:/Burrow/src/web/components/boards/CardPanel.tsx): Angular slide-over / bottom sheet on mobile, geometric priority selectors, flat metadata grid.
* [CommandPalette.tsx](file:///d:/Burrow/src/web/components/CommandPalette.tsx): Angular container, sulfur-yellow selected row states.
* [schema.tsx](file:///d:/Burrow/src/web/editor/schema.tsx) & [NotepadEditor.tsx](file:///d:/Burrow/src/web/editor/NotepadEditor.tsx): Style BlockNote links, mentions, banners, and outline using Basalt surfaces and diamond markers.

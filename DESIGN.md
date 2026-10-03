# The Drowned Ledger — implemented design

## Overview

A quiet, damp fishing mystery for desktop browsers with a touch adaptation. A full-bleed procedural bay is the primary surface; a restrained navigation strip, location title, voyage status and contextual fishing controls sit over it. Dark green panels and weathered yellow accents carry the interface without obscuring the boat. Narrative paragraphs use a village voice; controls and chain errors use direct language.

The source of truth is `src/styles.css`, with scoped chain styles in `src/components/chest.css` and procedural world materials in `src/game/World.tsx`. There is one intentionally dark theme.

## Colors

| Token | Exact value | Role |
| --- | --- | --- |
| `--bg` | `#111e1b` | Page, dark inset surfaces |
| `--surface` | `#1d2c25` | Solid modal and notification surfaces |
| `--surface-raised` | `#283a30` | Hovered rows and secondary controls |
| `--text` | `#e6e5d5` | Main text |
| `--muted` | `#aab7a7` | Supporting copy and inactive labels |
| `--accent` | `#c7b879` | Primary actions, word discoveries and selected controls |
| `--line` | `#405043` | Structural borders |
| `--danger` | `#e0a193` | Dread fill and errors |
| `--focus` | `#e0d99a` | Keyboard outline |

World materials use their own art palette: water `#243f3d`, timber `#6b6650`, rock `#57645a`, walls `#889080`, roof `#3b4942`, pine `#283f35`, lantern glow `#edca78`. The shader generates waves; code-created canvas textures generate signs and IMD apron lettering. UI text always uses HTML rather than being drawn into the world texture.

Measured browser pairs: main text on the modal 11.49:1; secondary text on the modal 6.98:1; accent on the modal 7.34:1; primary button text `#202c22` on accent 7.31:1. Animated scene/gradient-backed text has not been measured in every possible camera/night state. See validation for the scope of these measurements.

## Typography

`--serif` is `Georgia, 'Times New Roman', serif` for narrative titles, dialogue and riddle text. The body uses `Arial, Helvetica, sans-serif`. These are system font stacks, with no font download; the installed browser's fallback supplies the glyphs. Code-like phrase text and addresses use system monospace.

- Location heading: 59px, 1.2 line height, −2px tracking; 69px above 1500px, 42px on phones and 34px at 365px and below.
- Arrival heading: 37px/1.12; modal title: 32px/1.2, 27px on phones, 24px on the narrowest layout.
- Narrative dialogue: 23px/1.65, 20px on phones. Field notes use 16px/1.85 serif.
- Modal prose: 14px/1.8, 13px on phones. Dense in-game instructions and controls are 11–13px. Decorative compass/chapter metadata is smaller.
- Eyebrows: uppercase through CSS, 600 weight, 2.2px tracking; size varies with compact HUD roles.
- Inputs remain 16px. Counts and time-like numbers use tabular numerals. Headings balance; prose wraps prettily; long addresses wrap anywhere instead of being cut off.

Semantic sizing tokens `--text-small`, `--text-label`, `--text-body` are 12, 13 and 16px. Some HUD geometry uses smaller component-specific labels; those are decorative/supporting details, not a template for new form copy. Prefer at least 13px for new puzzle prose and 16px for new inputs.

## Layout

Spacing tokens are 4, 8, 12, 16, 24, 32 and 48px. Desktop HUD edges begin around 36–40px; phone edges are 18–20px. Buttons have at least 44px height for primary flows. The modal is 600px wide (800px for chart, journal and chain), bounded by the viewport, with independent scrolling and a sticky title/close row.

Breakpoints are 1500, 1150, 900, 600 and 365px, plus a desktop height correction at 760px. At 900px the secondary objective block disappears. At 600px the tools become four compact navigation items including the chart; keyboard hints disappear, actions stack and the touch stick appears. At 365px title/status spacing tightens. Mobile bottom navigation respects the safe area. The full game shell has a minimum height of 650px on phones, so unusually short/landscape screens can scroll vertically.

The fish journal uses three columns on wide desktop and two below 900px. Word bank uses three then two below 600px. Chart destinations collapse from two to one on phones. Puzzle sites and chain word arrangement also collapse. Browser inspection confirmed no horizontal overflow at 1440, 820, 390 and 320 CSS pixels; modal content remains scrollable.

## Elevation & Depth

The procedural WebGL scene sits in an isolated stacking context. The noninteractive vignette shades its edges. Interactive HTML HUD controls remain above world markers. Native `<dialog>` supplies modal top-layer positioning and a dark, 7px-blurred backdrop. Panels use a thin structural border, while large shadows establish depth above the water. The pause card and fishing panel have their own explicit layers. Avoid increasing world marker stacking into HUD controls.

## Shapes

Panels are nearly square: 2–5px corners, thin grey-green borders. Navigation uses a 4px frame; word tiles use 3px. Compass marks, fishing markers and the touch stick are circular. The rotated square anchor emblem is the brand mark. Low-poly world geometry has flat faces and simplified forms; do not introduce photographic imagery or smooth, glossy UI cards.

## Components

- `Modal` (`src/components/Modal.tsx`): `title`, optional `kicker`, `wide`, children and `onClose`. Native dialog moves focus into the panel, contains keyboard focus, closes on Escape and restores the trigger. Content scrolls below the sticky title.
- `.primary-btn` / `.secondary-btn` / `.icon-btn`: filled emphasis, bordered supporting actions and named icon actions. Shared focus outline, disabled state, hover and restrained press feedback. New puzzle actions should use these classes.
- `Icon` and `PepePortrait` (`src/components/Icon.tsx`): inline SVG generated in code. Decorative icons have `aria-hidden`; the portrait has a descriptive accessible name. The Pepe face uses green skin, heavy-lidded eyes and broad red-brown lips, with yellow oilskins and IMD apron.
- `Fishing` (`src/components/Fishing.tsx`): waiting, reeling, hit/miss and lost states; three visible strike counters and a labeled strike interval. Buttons and Space both work. Pausing or opening a panel suspends the needle and bite timer. Environmental rendering freezes during this precision interaction.
- `World` (`src/game/World.tsx`): memoized scene and village, generated models/materials and HTML location buttons. Drag changes camera yaw; scrolling zooms. Reduced motion stops water drift, bobbing and ripple movement. Demand rendering is used while paused, fishing or in a panel.
- `ChestPanel` (`src/components/ChestPanel.tsx`): two-column word arrangement with accessible 44px earlier/later arrows, labeled 16px fields, persistent status/error regions, associated field errors and wrapping addresses. Loading disables repeated actions. Zero-address and unlaunched states explain availability.
- Quest rows, word tiles, journal cards and chart destinations are patterns in `src/App.tsx`; they are not a separate component library. All interactive rows are buttons. Empty states explain how to find content.
- `ComingSoon` and `puzzleRegistry` are the extension boundary. Puzzle components inherit the host modal and get one `onSolved` callback.

## Do's and Don'ts

- Begin a new puzzle inside the existing modal host. Reuse panel sections, button classes and text tokens. Keep long text in a readable measure and allow it to grow vertically.
- Give the next meaningful action primary emphasis. Keep navigation and alternate actions neutral.
- Use visible labels, native controls and the existing focus ring. Every pointer-only world location must also be reachable through the chart or dock lists.
- Preserve reduced-motion behavior, and keep precision UI independent from the 3D frame rate.
- Put hunt values only in runtime `hunt.json`; keep each puzzle's state under its own ID. A successful puzzle calls its supplied callback.
- Keep all art and sound procedural. Do not add remote fonts, image files or audio dependencies.

This document records the final implementation, not a proposal. Screen-reader sessions, physical devices, native 200% zoom and exhaustive world-text contrast remain unverified.

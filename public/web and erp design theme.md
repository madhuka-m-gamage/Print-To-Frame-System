---
name: Kinetic Blueprint
colors:
  surface: '#0e1416'
  surface-dim: '#0e1416'
  surface-bright: '#333a3c'
  surface-container-lowest: '#090f11'
  surface-container-low: '#161d1e'
  surface-container: '#1a2122'
  surface-container-high: '#242b2d'
  surface-container-highest: '#2f3638'
  on-surface: '#dde4e6'
  on-surface-variant: '#bac9cc'
  inverse-surface: '#dde4e6'
  inverse-on-surface: '#2b3233'
  outline: '#849396'
  outline-variant: '#3b494c'
  surface-tint: '#00daf3'
  primary: '#c4f5ff'
  on-primary: '#00363d'
  primary-container: '#0de5ff'
  on-primary-container: '#00626e'
  inverse-primary: '#006875'
  secondary: '#98d0da'
  on-secondary: '#00363d'
  secondary-container: '#0d4e57'
  on-secondary-container: '#87bec9'
  tertiary: '#f4e9ff'
  on-tertiary: '#382855'
  tertiary-container: '#ddc7ff'
  on-tertiary-container: '#625080'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#9cefff'
  primary-fixed-dim: '#00daf3'
  on-primary-fixed: '#001f24'
  on-primary-fixed-variant: '#004f58'
  secondary-fixed: '#b4ecf7'
  secondary-fixed-dim: '#98d0da'
  on-secondary-fixed: '#001f24'
  on-secondary-fixed-variant: '#0d4e57'
  tertiary-fixed: '#ecdcff'
  tertiary-fixed-dim: '#d3bdf4'
  on-tertiary-fixed: '#23123e'
  on-tertiary-fixed-variant: '#4f3e6d'
  background: '#0e1416'
  on-background: '#dde4e6'
  surface-variant: '#2f3638'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-tabular:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  max-width: 1440px
---

## Brand & Style
The design system is engineered to bridge the gap between digital precision (BIM) and physical fabrication (LGSF). It targets architects, engineers, and construction project managers who require a high-reliability, data-dense environment that feels both cutting-edge and industrially robust.

The aesthetic follows a **Corporate Modern** foundation infused with **Industrial Tech** accents. It leverages the contrast between the fluidity of digital "prints" and the rigid structural integrity of steel "frames." Key visual motifs include hairline technical grids, micro-pixel patterns for decorative accents, and isometric line work that echoes structural engineering software. The UI should evoke a sense of absolute precision, transparency, and high-velocity production.

## Colors
The palette is rooted in the contrast between **Electric Cyan** (representing the digital blueprint and pixel data) and **Cool Slate** (representing the physical Light Gauge Steel Framing and industrial surfaces).

- **Primary Electric Cyan:** Reserved for primary actions, data highlights, and "active digital" states.
- **Secondary Muted Teal:** Used for structural elements, secondary navigation, and balanced UI surfaces.
- **Tertiary Soft Lavender:** Used for accent highlights and distinguishing specific data types within the BIM workflow.
- **Dark Theme:** A deep, neutral foundation (#101415) minimizes eye strain in high-density ERP portals, using Neutral Gray (#71787a) derivatives for surface and outline definition.
- **Semantic Colors:** Success (Cyan-tinted Green), Warning (Amber), and Error (Crimson) should be desaturated to fit the industrial aesthetic.

## Typography
The typography system mimics the clarity of CAD software. **Hanken Grotesk** provides a sharp, geometric feel for marketing headlines and section titles. **Inter** handles the heavy lifting for body text and interface elements due to its exceptional legibility in dense layouts.

For technical data, coordinates, and fabrication specs, **JetBrains Mono** is utilized to provide a monospaced, "code-like" precision that reinforces the BIM-to-Fabrication narrative. All labels should be set in uppercase with slight letter spacing to mimic industrial stencil markings.

## Layout & Spacing
The layout follows a **Rigid Grid** philosophy. A 12-column system is used for desktop, 8 for tablet, and 4 for mobile. 

- **Enterprise Portal:** Uses a high-density "No-Margin" approach where the sidebar and top navigation lock into the edges, maximizing the viewport for data tables and 3D frame viewers.
- **Marketing Pages:** Use a fluid grid with generous vertical padding (80px–120px) to allow the "digital print" visual metaphors space to breathe.
- **Rhythm:** Spacing is strictly based on a 4px baseline grid to ensure mathematical alignment across all components, reflecting the tolerances required in steel fabrication.

## Elevation & Depth
Depth is communicated through **Tonal Layering** and **Technical Outlines** rather than soft shadows.

- **Surface Tiering:** In dark mode, higher-level surfaces (like modals) use increased tonal contrast with a 1px Electric Cyan or Muted Teal border.
- **Inner Glows:** For interactive elements, use a subtle "inner glow" of the Primary Electric Cyan (opacity 10-15%) to suggest a digital screen or backlit panel.
- **Low-Contrast Outlines:** Instead of shadows, use 1px borders in Neutral Gray (#71787a) with varying opacity for cards and containers.
- **Glassmorphism:** Reserved for top navigation bars and floating tool overlays, using a backdrop blur (12px) to maintain context of the structural layers beneath.

## Shapes
The shape language is **Technical-Geometric**. With the transition to a more rounded approach (radius 8px / 0.5rem), the system moves toward a "Modern Industrial" aesthetic—balancing the precision of steel with the approachability of modern software.

- **Standard Elements:** 8px radius (Rounded).
- **Interactive Controls:** Buttons and input fields use a consistent 8px radius for a tactile, modern feel.
- **Container Accents:** One corner of a card or container may be "notched" (a 45-degree clip) to mimic the machined edges of LGSF components, though the main radius remains 8px.
- **Visual Metaphor:** Use square "pixels" for decorative progress bars and loading states to tie back to the digital "Print" half of the brand.

## Components

### Buttons
- **Primary:** Solid Electric Cyan background with dark text. No shadow; 1px inset border for a tactile feel.
- **Secondary (Muted):** Ghost button with Secondary Muted Teal border. On hover, the border gains a subtle Cyan glow.

### Input Fields
- **Design:** Dark background with a bottom-only Electric Cyan border that expands on focus. Labels sit inside the top border in monospaced font.
- **Validation:** Use pixelated icons (square-based) for error and success states.

### Data Tables (ERP Focused)
- **Styling:** Zebra striping with subtle Neutral Gray alternates. Hairline borders between all cells.
- **Header:** Sticky headers with a Secondary Muted Teal background and JetBrains Mono typography.

### Chips & Status Indicators
- **Style:** Rectangular with 4px radius. Status colors (Online, Fabricating, Shipped) use high-luminance versions of the palette with a "Technical LED" glow effect.

### Cards
- **Structure:** 1px Neutral Gray border with 8px corner radius. Headlines in Hanken Grotesk. Footer areas often contain a "Coordinate" label in the bottom-right corner to reinforce the CAD aesthetic.

### Progress Indicators
- **Digital Print Metaphor:** Instead of a smooth bar, use a sequence of small Electric Cyan squares that "fill in" to represent data being processed or frames being printed.
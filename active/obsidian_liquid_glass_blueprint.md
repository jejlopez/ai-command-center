# Obsidian Core: Liquid Glass Design System Blueprint

This document captures the "God-Tier" professional design standards established during the V10-V18 elevation of the User Profile Panel. It serves as the primary reference for maintaining the "Liquid Glass" aesthetic across the Command Center.

## 1. Design Philosophy: "Obsidian Void"
- **Immersion**: Prioritize spatial depth over flat background patterns.
- **Tactility**: UI elements should behave like physical hardware (weighted motion, material friction).
- **Legibility**: High-contrast typography (Bold White) against deep obsidian glass.
- **Zero-Lore**: Professional, direct terminology only (purged of sci-fi "theater").

## 2. The Liquid Glass Material Stack
To reproduce the Obsidian Core glass effect, use the following layers:
- **Base Layer**: Background color `#0A0A0A`.
- **Frosted Substrate**: 
  - `backdrop-blur-[28px]` up to `[40px]`.
  - `bg-white/[0.04]` (Low opacity white tint).
- **Secondary Shell**:
  - `border border-white/10`.
  - `shadow-[-40px_0_100px_rgba(0,0,0,0.8)]` (For depth side-panels).
- **Etched Typography**:
  - `mix-blend-mode: overlay` for secondary labels (`text-white/40`).
  - High-tracking `tracking-[0.45em]` for technical headers.

## 3. The Robot Sentinel (2D Pixel Blueprint)
The "Living Agent" entity used for digital identity.
- **Sprite Resolution**: 10x8 (Industrial Silhouette).
- **Animation Logic**:
  - **Patrol**: `absolute` positioning, `left: ["5%", "88%", "5%"]`.
  - **Mouth/Visor**: Alternate frame blinking (250ms).
  - **Physics**: 180-degree `rotateY` flip at boundary conditions.
- **Sprite Map**:
  ```javascript
  [0,0,1,1,1,1,0,0], // Head Top
  [0,1,1,1,1,1,1,0],
  [0,1,0,0,0,0,1,0], // Visor Gap
  [0,1,1,1,1,1,1,0], // Head Base
  [0,0,0,1,1,0,0,0], // Neck
  [1,1,1,1,1,1,1,1], // Shoulders
  [1,1,1,1,1,1,1,1], // Torso
  [0,1,1,1,1,1,1,0], // Hips
  [0,1,1,0,0,1,1,0], // Tracks
  [0,1,1,0,0,1,1,0]  // Base
  ```

## 4. Interaction Standards
- **Material Friction**: Drag interactions (sliders) should have `dragElastic: 0.1` and subtle scale-down (`0.96`) during manipulation.
- **Reactive Glow**: Rails and bays should fill with an `aurora-rose` or `aurora-teal` glow that dynamically follows interaction progress.
- **Hybrid Controls**: Always provide a "Standard Tap" backup for complex "Slide" interactions.

## 5. Typography Registry
- **Primary Data**: `JetBrains Mono`, `font-bold`, `text-aurora-teal/white`.
- **Command Headers**: `Inter Tight`, `font-black`, `uppercase`, `text-white`.
- **Registry Snippets**: `text-[10px]`, `tracking-[0.6em]`.

---
**Status: SYSTEM BLUEPRINT LOCKED.**

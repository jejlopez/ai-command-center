# Obsidian Core: Liquid Glass Design System Blueprint

This document captures the "God-Tier" professional design standards established during the V10-V18 elevation of the User Profile Panel. It serves as the primary reference for maintaining the "Liquid Glass" aesthetic across the Command Center.

## 1. Design Philosophy: Dual-State Immersion
- **Obsidian Void (Dark)**: Deep space, high-intensity white highlights, layered obsidian glass.
- **Spectral Pearl (Light)**: "White Vision" aesthetic, lavender/cream foundations, high-intensity void (`#050510`) ink-on-paper contrast.
- **Tactility**: UI elements behavior like physical hardware (weighted motion, material friction).
- **Legibility**: Zero-alpha policy for small metadata in Spectral mode; solid high-contrast colors only.

## 2. Material Stacks
### A. Obsidian Void (Dark)
- **Base Layer**: Background color `#0A0A0A`.
- **Frosted Substrate**: 
  - `backdrop-blur-[28px]` up to `[40px]`.
  - `bg-white/[0.04]` (Low opacity white tint).
- **Secondary Shell**: `border border-white/10`.
- **Etched Typography**: `mix-blend-mode: overlay` for secondary labels (`text-white/40`).

### B. Spectral Pearl (Light)
- **Base Layer**: Background color `#E6E6EE` (Marble Gray/Cream).
- **Frosted Substrate**:
  - `backdrop-blur-[28px]` up to `[40px]`.
  - `bg-white/25` (Ghostly Glass).
- **Secondary Shell**: `border border-black/[0.08]`.
- **Command Typography**: Solid high-contrast colors only (`#050510`). NO alpha-transparency for small labels.

## 3. The Robot Sentinel (2D Pixel Blueprint)
The "Living Agent" entity used for digital identity.
- **Sprite Resolution**: 10x8 (Industrial Silhouette).
- **Animation Logic (Sentinel 2.0 Overdrive)**:
  - **Patrol Range**: x-axis `["5%", "88%", "5%"]`, y-axis `±30px` float.
  - **Tactile Tilt**: Mouse-track with `rotateX` and `rotateY` (max ±8deg).
  - **Scanning Beam**: Periodic teal (`aurora-teal`) scanning beam sweep across the entity visor.
  - **Responsiveness**: 180-degree `rotateY` flip at boundary conditions.
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

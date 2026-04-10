# Skill: Obsidian UI Construction

**Objective**: Construct high-fidelity, professional "Obsidian Core" UI components that prioritize spatial depth, hardware-tactile interactions, and zero-theatrical utility.

## 1. Core Principles (The Nexus Standard)
- **Rule 0: Theme-Agnostic Architecture**: Zero hardcoded hex values in `tailwind.config.js` or components. All colors must map to semantic CSS variables (`var(--color-...)`) to ensure perfect synchronization across Obsidian and Spectral modes.
- **Zero-Lore Policy**: All terminology must be functional and professional. Purge all sci-fi "theatre" (e.g., no "Omega Clearance").
- **Theme-Relative Contrast**: The high-contrast baseline is relative: High-Intensity White for Dark mode, High-Intensity Void (`#050510`) for Light (Spectral) mode.
- **Spectral Legibility Rule**: Small metadata and label text in light themes MUST use solid, high-contrast colors. Alpha-transparency (e.g., `text-white/40`) is prohibited on light foundations as it washes out legibility.
- **Materiality over Flatness**: Use layered glass, refraction, and 3D tilt to establish premium spatial depth.

## 2. Liquid Glass Material Stack
Every component shell must implement this stack:
- **Surface**: `backdrop-blur-[28px]` up to `[40px]`.
- **Blend**: `mix-blend-mode: overlay` for secondary labels to create an "etched" look.
- **Accents**: Use **Aurora Teal** (`#00D9C8`) for telemetry and **Aurora Rose** for danger-states.

## 3. The 3D Lensing Blueprint
Wrap Bento blocks in a 3D perspective container with mouse-tracking tilt:
- **Perspective**: `1200`.
- **Tilt Range**: `rotateX/rotateY` max `+/- 5deg`.
- **Refraction Glint**: Implement a `radial-gradient` glint that moves inversely to the mouse position to simulate light refraction.

## 4. Hardware Interaction Logic
All critical actions (Sign Out, Terminate, Deploy) must use **Hybrid Mechanics**:
- **Tactile Drag**: A friction-based slide (`dragElastic: 0.1`, `scale: 0.96`).
- **Standard Tap**: A fallback `onClick` for immediate execution.
- **Reactive Rails**: Fill rails with a glowing gradient (e.g., `aurora-rose/40`) as the handle moves.

## 5. Pixel Agent Standards
When building digital identities or system sentinels:
- **Sharpness**: Minimum 1.5px gaps between pixels to prevent "blobbing."
- **Size**: Standard pixel scale is 6px.
- **Silhouette**: Use recognizable mechanical profiles (Robots, Drones) over abstract ghosts.
- **Initial Matrix**: Use a 5x7 procedural grid for name initials.

## 6. Pre-Submission Checklist
- [ ] Is every label a functional description?
- [ ] Are color tokens semantic (variable-based) rather than hardcoded?
- [ ] Is small metadata using a solid color in Spectral mode?
- [ ] Does the element "tilt" or "flex" on hover?
- [ ] Does the button support both Tap and Slide?

---
**Status: SKILL COMMISSIONED // DEPLOY TO WORKER-UI.**

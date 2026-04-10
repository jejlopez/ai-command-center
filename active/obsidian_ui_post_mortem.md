# Post-Mortem: Obsidian Core Profile Build (V1-V18)

A technical and aesthetic reflection on the transition from a "Cinematic Prop" to a "Production-Grade Command Center."

## Phase 1: The "Theatrical Lore" Failure
- **Mistake**: Using fictional terminology like "Sovereign Mode" and "Omega Clearance."
- **Failure Mode**: It felt "corny" and like a toy rather than a professional tool.
- **Learning**: Terminology must signify **Functional Authority**.
- **Fix**: Replaced all fiction with professional registry terminology (Uplink, Registry, Sessions).

## Phase 2: Contrast & Legibility Issues
- **Mistake**: Using low-opacity labels and desaturated teal to look "moody."
- **Failure Mode**: The user couldn't read the telemetry or see the buttons clearly on various displays.
- **Learning**: Immersive dark modes require **High-Intensity Accents**. White text on a black void is non-negotiable for 10X builds.
- **Fix**: Switched all primary headers and telemetry labels to Bold White (`white/100`) and high-contrast Aurora Teal.

## Phase 3: Interaction Friction (The Slider)
- **Mistake**: Implementing a high-tension "Slide-to-Terminate" rail that didn't support simple clicks.
- **Failure Mode**: Frustrating UX for users who wanted a quick sign-out.
- **Learning**: Tactile interactions should be **Optional Overrides**, not the only path.
- **Fix**: Refactored the rail into a **Hybrid Component**—it responds perfectly to a 300ms drag *or* a standard 10ms tap.

## Phase 4: The "Blob" Logic vs. Hardware Precision
- **Mistake**: Small pixel sizes (4px) with soft shadow glows.
- **Failure Mode**: The character looked like a blurry teal blob rather than a robot.
- **Learning**: Low-resolution pixel art requires **Material Gaps**. 1.5px-2px spacing is required to prevent color bleeding at low densities.
- **Fix**: Increased pixel size to 6px, used high-contrast white eyes, and added a secondary "background grid" to the bay to provide a visual anchor.

## Phase 5: Redundancy & Cognitive Load
- **Mistake**: Using two competing pixel-matrix displays in one Bento block.
- **Failure Mode**: Destabilized the visual hierarchy; the user didn't know where to look.
- **Learning**: One "Digital Anchor" per block.
- **Fix**: Removed the `InitialMatrix` and focused all identity motion into the `PixelRobot`.

---
**Status: POST-MORTEM ARCHIVED.**

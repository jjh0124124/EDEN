# Third-party assets

EDEN currently uses no downloaded third-party visual, audio, font, or code assets.

`src/presentation.js` combines generated sprite images with original rasterized articulated rigs, environment effects, and an industrial synthesizer. The remaining bosses still use procedural rigs.

## BUILD 04 generated image assets

| Asset | Source / creator | Integration |
| --- | --- | --- |
| `characters/zero/zero-generated.png` | Built-in image generation tool, prompted for this project | 16 dedicated sprite poses; source rectangles, pelvis anchors and boundary clipping specified in renderer |
| `characters/bosses/surgeon-generated.png` | Built-in image generation tool, prompted for this project | 4 poses selected by idle, windup, release and hit/recovery state |
| `environments/surgical-cathedral.png` | Built-in image generation tool, prompted for this project | Background with nearest-neighbor sampling and dynamic effects |
| `characters/zero/zero-atlas.png` / `.json` | Original project rig, built by `tools/build_zero_atlas.py` | Development fallback atlas; 96 frames |

These are generated project assets, not downloaded stock images; no third-party creator attribution is recorded. The user's concept sheet was reference material only and was not cropped into production sprites. The earlier non-pixel key art is not included in the game. PixelLab and Higgsfield were not used. The built-in image generator was used; this is not a claim that generation consumed no credits.

The first three image files are source assets. Runtime frame extraction does not overwrite them. The synthesized score and several animation states remain development work.

## BUILD 10 generated image assets

The built-in image generator produced `characters/zero/zero-duel.png` (12 full-body attack poses), `characters/bosses/surgeon-duel.png` (8 duel poses), and `characters/bosses/surgeon-low-cut.png` (one dedicated low incision pose). Runtime rectangles, pelvis anchors, and clipping isolate the poses. The low incision replaces the sheet's high-reaching release for that attack. Existing sheets remain in use for other states. Frame sequences were reviewed through the actual renderer in `tests/duel_art_smoke.py`.

## BUILD 14 generated image assets

- `characters/zero/zero-drive.png`: built-in image generation, 8 full-body propulsion attack poses; existing ZERO sheet used as reference. Per-frame source rectangles, pelvis anchors, and a boundary clip isolate the attack frames.
- `effects/neural-impact.png`: built-in image generation, 4 thruster frames and 4 metal impact/debris frames, transparent RGBA. Explicit emitter pivots align each sequence; runtime uses nearest-neighbor image rendering, not text or newly drawn geometric substitutes.
- `tests/reverse_drive_smoke.py` checks both actor facings and renders all effect frames. Higgsfield was unavailable; it was not used. Original generated source PNGs are retained.

- `effects/surgical-ordnance.png`: built-in image generation, transparent RGBA atlas containing a surgical syringe, lancet, heel anchor, and rail projectile. Original retained in the generation workspace. Runtime crops, rotation and clipping align the artwork with existing attacks; `tests/compression_smoke.py` exercises the production renderer. Higgsfield was not used.

- `characters/bosses/surgical-sentry.png`: built-in image generation, four transparent first-operation sentry poses (idle, aiming, firing, wreck). Source retained in generation workspace. Uses explicit body pivots, facing, and damage flash; reviewed alongside reused ZERO air/landing poses in `tests/sentry_air_smoke.py`.

- `characters/zero/zero-mechanisms.png`: built-in image generation using the existing ZERO drive sheet as reference. Twelve full-body K piston/E heel-anchor/R scissor poses. Runtime pivots, contact-time selection, and two boundary clips isolate the sequences; reviewed through the actual renderer in `tests/compression_smoke.py`. Original generated PNG retained.

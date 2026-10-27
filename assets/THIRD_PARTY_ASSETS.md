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

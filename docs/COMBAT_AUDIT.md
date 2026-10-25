# BUILD 08 — existing combat audit

Scope: feedback and small state-correctness fixes. Existing attack damage, reach, startup/active/recovery durations, enemy patterns, invulnerability durations, SP costs and physical knockback velocities are retained. No new arena objects or resource systems are included.

## Ranked findings

| Rank | Category | Observed issue | Small intervention |
|---|---|---|---|
| 1 | Feedback | Skill activation shakes the camera even when it misses; impacts stack camera displacement. | Trigger camera kick on accepted damage, use maximum rather than sum, cap to 1.8 logical pixels. |
| 2 | Audiovisual | Windup and contact sounds compete; uniform red bursts blur hit strength. | Quiet mechanical windup, three short contact profiles, 4/6/8 sparks and a localized flash. |
| 3 | Enemy behavior/reaction | Hit pose does not communicate attack direction or mass. | Render-only directional recoil of 1.5/2.5/3.5 pixels, easing back without moving hitboxes or interrupting AI. |
| 4 | Controls | Jump is lost during hitstop; restart can inherit feedback; damage lift leaves grounded flag set. | Preserve jump through hitstop, clear feedback at checkpoint entry, correct airborne state on damage. |
| 5 | Pacing | Frame-rounded hitstop extends combo pauses; long ultimate banner obscures action. | 22/42/65 ms hitstop, consume exact remaining time, shorten banner to the initial 120 ms. |
| 6 | Encounter design | Repeated two-drone corridors and fixed boss cycles remain repetitive. | Record for a separate encounter-design pass; do not alter rules in this polish. |
| 7 | Resource economy | Passive SP and on-hit recovery provide limited encounter-specific choices. | Retain economy; new resource mechanics would exceed this pass. |

## Timing and synchronization review

- J startup remains .06/.06/.11 seconds; active window .20 seconds; total animation .24/.27/.40 seconds. Charged K startup remains .12 seconds and total .46 seconds.
- Movement during attacks, air acceleration, jump impulse and dash duration/range are unchanged. Existing 220 ms attack reservation remains. No additional input lock is introduced.
- Damage and contact sounds occur at collision acceptance. Invulnerable targets produce no extra hit sound or damage label. Windup remains a separate quiet cue.
- Player hit pose now takes precedence over attack pose. Visual anticipation/recovery offsets are only 1–1.5 pixels and do not move collision geometry.
- Enemy telegraphs and recovery windows are retained. Boss death clears pending hazards, preventing a late cast after death.
- Player invulnerability stays .55 seconds after damage; dash stays .34 seconds. Existing physical knockback remains 95 horizontal / -90 vertical.
- HUD is outside camera transform. Damage labels are limited to eight and shown for corridor targets as well as bosses.

## Tuning passes and verification

Pass 1 separated startup/contact audio, reduced particle counts and camera amplitude, and introduced localized flash/recoil.

Pass 2 corrected hitstop remainder, preserved jump input during hitstop, reset feedback on retry, prioritized hit animation, shortened the ultimate banner, reduced player damage noise, and corrected the airborne flag on damage lift.

Node tests cover all seven requested situations: normal combat, repeated presses, both walls, airborne attacks, damage during attacks, dash/attack interaction, and enemy death during windup. Additional checks cover restart, sound-event timing, exact damage preservation, non-accumulating feedback and 30/60 fps behavior. The Chromium combat script exercises those situations using the actual game renderer and input events (damage/death setup uses test-only injection).

This is a bounded polish pass, not a claim that the project has reached commercial quality. Sound trigger timing is instrumented; final loudness and subjective game-feel judgments still benefit from human playtesting. The other six bosses retain their existing art and encounter designs.

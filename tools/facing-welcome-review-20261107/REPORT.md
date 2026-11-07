# Facing and welcome rotation review

## Changes

- The first four base playable appearances remain fixed. Starting with the fifth appearance, choose neutral/playable categories with 80%/20% probability, independent of the number of playable forms. Each category keeps an independent shuffled bag so every eligible identity still appears. Retired legged forms remain excluded.
- The world fallback for the dead spiny-back beetle now respects source-facing and target-facing through the same `unitFrameMirror` calculation as live rendering. The raw dead-v2.png source was inspected and faces left. Previously that branch never mirrored the corpse.
- Corrected an old combination-facing test fixture that selected a base body instead of the named combination.

## Evidence

- Deterministic seeded category tests use 10,000 choices for each of three seeds and three appearance counts. Neutral share remains between 78% and 82%; separate bag tests cover all 87 eligible identities and compare compiled-runtime sequences with source sequences.
- A production-function capture test runs 2,349 body draws across 68 playable forms and 19 neutral identities, including actual welcome entry/idle/exit and combat sides. Attacks use the target direction even when stored facing is opposite. Two registered corpse-shadow captures verify the existing centered shadow does not need a separate flip patch.
- Capture direction expectations are based on source metadata, except independently verified pixel overrides when supplied via FACING_PIXEL_TRUTH. These tests do not claim all visual poses have been independently direction-certified or that live browser playback was completed.
- Native source-facing remains truthful for legacy right- and left-authored assets. Target-left presentation does not justify blindly relabeling or mirroring every source.

Whole-animation audit and the independently reported shadow-weasel movement fault remain separate work until their candidates are verified.

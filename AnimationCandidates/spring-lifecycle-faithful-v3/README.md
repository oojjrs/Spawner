# Spring lifecycle source-faithful revision

Status: user approved. Archived for asset handoff; not integrated into game logic or playback. See APPROVAL.md.

The rejected v2 invented growth and flattening is superseded. This revision retains every base birth/death cel and its timing. Birth uses 13 cels, death 8. Only the antenna tip region and foot region change. All 42 edited cels have zero changed pixels outside their respective attachment regions (verification.json).

Base artwork: Spawner-publish-current/DesignAssets/Tribes/spring/AnimationStudies/birth-detach-v1/birth-unit.webp and death-tail-repair-v6/death-tail-repair-v6.png. Actual current frame sizes are 236 and 516 respectively, not the nominal 512 in module literals. imageAnimation normalizes coordinates at runtime. Timing import resolves the runtime constants, and the preview converts their coordinates consistently when rendering to 512.

Antenna uses a local continuous expansion of the original curved tip, without replacing the body portrait. The tip appears with the recognizable body after landing and disappears into the original molten collapse. Feet use clean higher-resolution attachment artwork only, positioned on original feet and absorbed by the original puddle.

Preview: base / antenna / feet synchronized columns; birth / death rows. 30fps, original cel timing, original springBirthMotion and springBirthPlacement samples. A fixed comparison camera and endpoint framing are used; this is not a capture of the running game. No nest/scene effects are claimed. Additional end holds are only replay pauses.

No game code was changed. render/preview scripts are standalone asset tooling.

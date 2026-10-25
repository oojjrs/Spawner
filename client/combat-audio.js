(() => {
  const sources = Object.freeze({
    "unit-attack": "DesignAssets/Audio/unit-attack.mp3",
    "beetle-attack": "DesignAssets/Audio/beetle-attack.mp3",
    "sprout-hurt": "DesignAssets/Audio/sprout-hurt.mp3",
    "spore-hurt": "DesignAssets/Audio/spore-hurt.mp3",
    "pebble-hurt": "DesignAssets/Audio/pebble-hurt.mp3",
    "spring-hurt": "DesignAssets/Audio/spring-hurt.mp3",
    "beetle-hurt": "DesignAssets/Audio/beetle-hurt.mp3",
    "sprout-death": "DesignAssets/Audio/sprout-death.mp3",
    "spore-death": "DesignAssets/Audio/spore-death.mp3",
    "pebble-death": "DesignAssets/Audio/pebble-death.mp3",
    "spring-death": "DesignAssets/Audio/spring-death.mp3",
    "beetle-death": "DesignAssets/Audio/beetle-death.mp3"
  });

  function material(unit) {
    if (unit.species) return unit.species === "spiny-back-beetle" ? "beetle" : null;
    if (!unit.tribe || unit.tribe === "bean" || unit.tribe === "sprout") return "sprout";
    return ["spore", "pebble", "spring"].includes(unit.tribe) ? unit.tribe : null;
  }

  function cue(kind, action, speed) {
    if (!["sprout", "spore", "pebble", "spring", "beetle"].includes(kind)) return null;
    const name = action === "attack" ? kind === "beetle" ? "beetle-attack" : "unit-attack" : kind + "-" + action;
    if (!sources[name]) return null;
    const at = action === "attack" ? (kind === "beetle" ? .44 : .24) / speed :
      action === "hurt" ? kind === "beetle" ? .04 : .02 :
      kind === "sprout" ? .16 : kind === "beetle" ? 0 : .12;
    return { name, at };
  }

  function create() {
    return { time: null, events: new Map() };
  }

  function reset(playback) {
    playback.time = null;
    playback.events.clear();
  }

  function update(playback, agents, corpses, time) {
    if (playback.time !== null && (time < playback.time || time - playback.time > .5)) reset(playback);
    const initial = playback.time === null, active = new Set(), events = [];
    function collect(unit, action, startedAt, stamp, speed) {
      if (!Number.isFinite(startedAt) || startedAt < 0) return;
      const sound = cue(material(unit), action, speed);
      if (!sound) return;
      const key = action + ":" + (unit.agentId ?? unit.id);
      active.add(key);
      const at = startedAt + sound.at;
      if (initial || time + 1e-8 >= at) {
        if (!initial && playback.events.get(key) !== stamp && time - at <= .2) events.push({ name: sound.name, unit });
        playback.events.set(key, stamp);
      }
    }
    for (const unit of agents) {
      if (!material(unit)) continue;
      if (unit.health > 0) {
        if (unit.species === "spiny-back-beetle") {
          if (unit.mode === "attack" && !(time >= unit.hurtStartedAt && time < unit.hurtStartedAt + .67))
            collect(unit, "attack", unit.attackStartedAt, unit.attackStartedAt, 1);
        } else if (unit.attack) collect(unit, "attack", unit.attack.startedAt, unit.attack.startedAt, unit.attack.speed);
      } else collect(unit, "death", unit.deathStartedAt, unit.deathStartedAt, 1);
      collect(unit, "hurt", unit.hurtStartedAt, unit.hurtCount ?? unit.hurtStartedAt, 1);
    }
    for (const unit of corpses) {
      collect(unit, "hurt", unit.hurtStartedAt, unit.hurtCount ?? unit.hurtStartedAt, 1);
      collect(unit, "death", unit.diedAt, unit.diedAt, 1);
    }
    for (const key of playback.events.keys()) if (!active.has(key)) playback.events.delete(key);
    playback.time = time;
    return events;
  }

  globalThis.SpawnerCombatAudio = Object.freeze({ sources, material, cue, create, reset, update });
})();

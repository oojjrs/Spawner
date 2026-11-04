(() => {
  const creatureAttackHitTimes = Object.freeze({
    "flower-tail-bird": 0.36,
    "dew-rabbit": 0.36,
    "soil-mole": 0.37,
    "bundle-snail": 0.395,
    "cotton-sheep": 0.37,
    "rolling-acorn": 0.38,
    "soil-boar": 0.33,
    "bubble-toad": 0.33,
    "vine-turtle": 0.33,
    "shadow-weasel": 0.33,
    "snare-vine": 0.33,
    "talon-owl": 0.33,
    "spring-keeper": 0.295,
    "lantern-keeper": 0.33,
    "old-garden-snail": 0.59,
    "walking-forest": 0.56,
    "white-paw": 0.3,
    "spiny-back-leader": 0.53
  });
  const creatureAttackLeadTimes = Object.freeze({ "spiny-back-leader": .08, "walking-forest": .014 });

  const sources = Object.freeze({
    "unit-attack": "DesignAssets/Audio/unit-attack.mp3",
    "beetle-attack": "DesignAssets/Audio/beetle-attack.mp3",
    "flower-tail-bird-attack": "DesignAssets/Audio/CreatureAttackV2/flower-tail-bird.mp3",
    "dew-rabbit-attack": "DesignAssets/Audio/CreatureAttackV2/dew-rabbit.mp3",
    "soil-mole-attack": "DesignAssets/Audio/CreatureAttackV2/soil-mole.mp3",
    "bundle-snail-attack": "DesignAssets/Audio/CreatureAttackV2/bundle-snail.mp3",
    "cotton-sheep-attack": "DesignAssets/Audio/CreatureAttackV2/cotton-sheep.mp3",
    "rolling-acorn-attack": "DesignAssets/Audio/CreatureAttackV2/rolling-acorn.mp3",
    "soil-boar-attack": "DesignAssets/Audio/CreatureAttackV2/soil-boar.mp3",
    "bubble-toad-attack": "DesignAssets/Audio/CreatureAttackV2/bubble-toad.mp3",
    "vine-turtle-attack": "DesignAssets/Audio/CreatureAttackV2/vine-turtle.mp3",
    "shadow-weasel-attack": "DesignAssets/Audio/CreatureAttackV2/shadow-weasel.mp3",
    "snare-vine-attack": "DesignAssets/Audio/CreatureAttackV2/snare-vine.mp3",
    "talon-owl-attack": "DesignAssets/Audio/CreatureAttackV2/talon-owl.mp3",
    "spring-keeper-attack": "DesignAssets/Audio/CreatureAttackV2/spring-keeper.mp3",
    "lantern-keeper-attack": "DesignAssets/Audio/CreatureAttackV2/lantern-keeper.mp3",
    "old-garden-snail-attack": "DesignAssets/Audio/CreatureAttackV2/old-garden-snail.mp3",
    "walking-forest-attack": "DesignAssets/Audio/CreatureAttackV2/walking-forest.mp3",
    "white-paw-attack": "DesignAssets/Audio/CreatureAttackV2/white-paw.mp3",
    "spiny-back-leader-attack": "DesignAssets/Audio/CreatureAttackV2/spiny-back-leader.mp3",
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
    if (unit.species) return unit.species === "spiny-back-beetle" ? "beetle" :
      Object.hasOwn(creatureAttackHitTimes, unit.species) ? unit.species : "creature";
    if (!unit.tribe || unit.tribe === "bean" || unit.tribe === "sprout") return "sprout";
    return ["spore", "pebble", "spring"].includes(unit.tribe) ? unit.tribe : null;
  }

  function cue(kind, action, speed) {
    if (kind === "creature" || Object.hasOwn(creatureAttackHitTimes, kind)) {
      if (action === "hurt") return { name: kind === "spiny-back-leader" ? "beetle-hurt" : "sprout-hurt", at: .02 };
      return action === "attack" && kind !== "creature" ?
        { name: kind + "-attack", at: (creatureAttackHitTimes[kind] - (creatureAttackLeadTimes[kind] ?? .06)) / speed } : null;
    }
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
      const rpg = action === "attack" && unit.attack?.combatId && !unit.attack.exchange && Number.isFinite(unit.attack.hitAt);
      const at = rpg ? unit.attack.hitAt - Math.min(.05, (unit.attack.hitAt - startedAt) * .2) : startedAt + sound.at;
      // Seed only cues that have already happened on reconnect. Future cues
      // in an in-flight animation must remain eligible at their authored time.
      if (time + 1e-8 >= at) {
        if (!initial && playback.events.get(key) !== stamp && time - at <= .2) events.push({ name: sound.name, unit });
        playback.events.set(key, stamp);
      }
    }
    for (const unit of agents) {
      if (!material(unit)) continue;
      if (unit.health > 0) {
        if (unit.attack?.combatId && !unit.attack.exchange) {
          collect(unit, "attack", unit.attack.startedAt, unit.attack.startedAt, unit.attack.speed);
        } else if (unit.species === "spiny-back-beetle") {
          if (unit.mode === "attack" && !(time >= unit.hurtStartedAt && time < unit.hurtStartedAt + .67))
            collect(unit, "attack", unit.attackStartedAt, unit.attackStartedAt, 1);
        } else if (unit.attack) collect(unit, "attack", unit.attack.startedAt, unit.attack.startedAt, unit.attack.speed);
      } else collect(unit, "death", unit.deathStartedAt, unit.deathStartedAt, 1);
      collect(unit, "hurt", unit.hurtStartedAt, unit.hurtCount ?? unit.hurtStartedAt, 1);
      const reaction = unit.combat?.lastReaction;
      if (reaction && reaction.targetId === unit.id && ["parry", "block"].includes(reaction.kind)) {
        const key = "reaction:" + unit.id;
        active.add(key);
        if (!initial && playback.events.get(key) !== reaction.id && time >= reaction.at && time - reaction.at <= .2)
          events.push({ name: reaction.kind === "parry" ? "unit-attack" : "beetle-hurt", unit });
        if (time >= reaction.at) playback.events.set(key, reaction.id);
      }
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

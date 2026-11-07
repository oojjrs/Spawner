(() => {
  const maxLateness = .2;
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
      if (action === "death") return { name: kind === "spiny-back-leader" ? "beetle-death" : "sprout-death", at: .12 };
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

  function eventCue(event, unit) {
    const action = event.kind === "shoot" || event.kind === "attack" || event.kind === "counter" ? "attack" :
      event.kind === "death" ? "death" : ["hit", "critical", "area", "bleed", "reflect"].includes(event.kind) && event.amount > 0 ? "hurt" : null;
    if (event.kind === "attack" && event.mode === "ranged") return null;
    const sound = action ? cue(material(unit), action, 1) :
      ["miss", "dodge", "evasion", "parry"].includes(event.kind) ? { name: "unit-attack", at: 0 } :
      ["block", "stun"].includes(event.kind) ? { name: "beetle-hurt", at: 0 } : null;
    if (!sound) return null;
    const preparing = event.kind === "attack" || event.kind === "counter";
    const at = preparing && Number.isFinite(event.endsAt) ? event.endsAt - Math.min(.05, (event.endsAt - event.at) * .2) :
      event.at + (event.kind === "death" ? sound.at : 0);
    return { name: sound.name, at, unit };
  }

  function create() {
    return { time: null, streamId: null, events: new Map() };
  }

  function reset(playback) {
    playback.time = null;
    playback.streamId = null;
    playback.events.clear();
  }

  function update(playback, agents, corpses, time, journal) {
    if (playback.time !== null && (time < playback.time || time - playback.time > .5) ||
        journal?.version === 1 && playback.streamId && playback.streamId !== journal.streamId) reset(playback);
    const records = journal?.version === 1 && Array.isArray(journal.events) ? journal.events : [];
    if (journal?.version === 1) playback.streamId = journal.streamId;
    const initial = playback.time === null, active = new Set(), events = [];
    const evidenceFor = (unit, action, at) => records.some(event =>
      action === "attack" ? event.sourceId === (unit.agentId ?? unit.id) && ["attack", "counter"].includes(event.kind) && Math.abs(event.at - at) < 1e-6 :
        event.targetId === (unit.agentId ?? unit.id) && Math.abs(event.at - at) < 1e-6 &&
        (action === "death" ? event.kind === "death" : event.amount > 0 && ["hit", "critical", "block", "area", "bleed", "reflect"].includes(event.kind)));
    const units = new Map([...corpses, ...agents].map(unit => [unit.agentId ?? unit.id, unit]));
    for (const event of records) {
      const unit = units.get(["attack", "counter", "shoot"].includes(event.kind) ? event.sourceId : event.targetId);
      if (!unit) continue;
      const sound = eventCue(event, unit);
      if (!sound || time + 1e-8 < sound.at) continue;
      const key = "journal:" + event.id;
      active.add(key);
      if (!initial && !playback.events.has(key) && time - sound.at <= maxLateness) events.push({ name: sound.name, unit });
      playback.events.set(key, { stamp: event.id, at: sound.at });
    }
    function collect(unit, action, startedAt, stamp, speed) {
      if (!Number.isFinite(startedAt) || startedAt < 0 || evidenceFor(unit, action, startedAt)) return;
      const sound = cue(material(unit), action, speed);
      if (!sound) return;
      const key = action + ":" + (unit.agentId ?? unit.id);
      active.add(key);
      const rpg = action === "attack" && unit.attack?.combatId && !unit.attack.exchange && Number.isFinite(unit.attack.hitAt);
      const at = rpg ? unit.attack.hitAt - Math.min(.05, (unit.attack.hitAt - startedAt) * .2) : startedAt + sound.at;
      // Seed only cues that have already happened on reconnect. Future cues
      // in an in-flight animation must remain eligible at their authored time.
      if (time + 1e-8 >= at) {
        if (!initial && playback.events.get(key)?.stamp !== stamp && time - at <= maxLateness) events.push({ name: sound.name, unit });
        playback.events.set(key, { stamp, at });
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
      if (reaction && reaction.targetId === unit.id && ["miss", "parry", "block"].includes(reaction.kind) &&
          !records.some(event => event.targetId === unit.id && event.kind === reaction.kind && Math.abs(event.at - reaction.at) < 1e-6)) {
        const key = "reaction:" + unit.id;
        active.add(key);
        if (!initial && playback.events.get(key)?.stamp !== reaction.id && time >= reaction.at && time - reaction.at <= maxLateness)
          events.push({ name: reaction.kind === "block" ? "beetle-hurt" : "unit-attack", unit });
        if (time >= reaction.at) playback.events.set(key, { stamp: reaction.id, at: reaction.at });
      }
    }
    for (const unit of corpses) {
      collect(unit, "hurt", unit.hurtStartedAt, unit.hurtCount ?? unit.hurtStartedAt, 1);
      collect(unit, "death", unit.diedAt, unit.diedAt, 1);
    }
    // Camera/visibility filtering can briefly omit an audible unit or corpse.
    // Keep its consumed cue until it is too old to replay on re-entry.
    for (const [key, event] of playback.events)
      if (!active.has(key) && time - event.at > maxLateness) playback.events.delete(key);
    playback.time = time;
    return events;
  }

  function createPlayer() {
    let context = null, generation = 0;
    const buffers = new Map(), pending = new Map(), voices = new Set();
    function prepare(name) {
      if (buffers.has(name)) return Promise.resolve(buffers.get(name));
      if (pending.has(name)) return pending.get(name);
      const request = (async () => {
        const url = globalThis.SpawnerAssets?.load ? await globalThis.SpawnerAssets.load(sources[name]) : sources[name];
        const response = await fetch(url);
        if (!response.ok) throw new Error(name);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        buffers.set(name, buffer); return buffer;
      })().finally(() => pending.delete(name));
      pending.set(name, request); return request;
    }
    function resume() {
      if (!globalThis.AudioContext) return;
      if (!context) context = new globalThis.AudioContext();
      context.resume().catch(() => {});
      Promise.allSettled(Object.keys(sources).map(prepare));
    }
    function play(name, volume) {
      if (!context || context.state !== "running" || globalThis.document?.hidden || !sources[name]) return;
      const at = context.currentTime, current = generation;
      prepare(name).then(buffer => {
        if (current !== generation || context.state !== "running" || context.currentTime - at > maxLateness || globalThis.document?.hidden) return;
        const source = context.createBufferSource(), gain = context.createGain();
        source.buffer = buffer; gain.gain.value = .55 * Math.max(0, Math.min(1, volume));
        source.connect(gain); gain.connect(context.destination); voices.add(source);
        source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); };
        source.start();
      }).catch(() => {});
    }
    function stop() {
      generation++;
      for (const voice of voices) voice.stop();
      voices.clear();
    }
    return { resume, play, stop };
  }

  globalThis.SpawnerCombatAudio = Object.freeze({ sources, material, cue, eventCue, create, createPlayer, reset, update });
})();

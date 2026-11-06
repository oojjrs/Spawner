(() => {
  const definitions = Object.freeze({
  "spore": {
    "name": "move-spore",
    "source": "DesignAssets/Audio/MovementV1/spore.mp3",
    "gain": 0.261,
    "phases": [
      0,
      0.5
    ],
    "leadMs": 0
  },
  "pebble": {
    "name": "move-pebble",
    "source": "DesignAssets/Audio/MovementV1/pebble.mp3",
    "gain": 0.326,
    "phases": [
      0,
      0.5
    ],
    "leadMs": 0
  },
  "spring": {
    "name": "move-spring",
    "source": "DesignAssets/Audio/MovementV1/spring.mp3",
    "gain": 0.403,
    "phases": [
      0,
      0.5
    ],
    "leadMs": 0
  },
  "spiny-back-beetle": {
    "name": "move-spiny-back-beetle",
    "source": "DesignAssets/Audio/MovementV1/spiny-back-beetle.mp3",
    "gain": 0.427,
    "phases": [
      0,
      0.25,
      0.5,
      0.75
    ],
    "leadMs": 0
  },
  "flower-tail-bird": {
    "name": "move-flower-tail-bird",
    "source": "DesignAssets/Audio/MovementV1/flower-tail-bird.mp3",
    "gain": 0.123,
    "phases": [
      0.3598200899550225
    ],
    "leadMs": 0
  },
  "dew-rabbit": {
    "name": "move-dew-rabbit",
    "source": "DesignAssets/Audio/MovementV1/dew-rabbit.mp3",
    "gain": 0.25,
    "phases": [
      0.56
    ],
    "leadMs": 0
  },
  "soil-mole": {
    "name": "move-soil-mole",
    "source": "DesignAssets/Audio/MovementV1/soil-mole.mp3",
    "gain": 0.068,
    "phases": [
      0,
      0.4947526236881559
    ],
    "leadMs": 0
  },
  "bundle-snail": {
    "name": "move-bundle-snail",
    "source": "DesignAssets/Audio/MovementV1/bundle-snail.mp3",
    "gain": 0.429,
    "phases": [
      0.225
    ],
    "leadMs": 0
  },
  "cotton-sheep": {
    "name": "move-cotton-sheep",
    "source": "DesignAssets/Audio/MovementV1/cotton-sheep.mp3",
    "gain": 0.44,
    "phases": [
      0,
      0.5
    ],
    "leadMs": 0
  },
  "rolling-acorn": {
    "name": "move-rolling-acorn",
    "source": "DesignAssets/Audio/MovementV1/rolling-acorn.mp3",
    "gain": 0.262,
    "phases": [
      0,
      0.25,
      0.5,
      0.75
    ],
    "leadMs": 0
  },
  "soil-boar": {
    "name": "move-soil-boar",
    "source": "DesignAssets/Audio/MovementV1/soil-boar.mp3",
    "gain": 0.2,
    "phases": [
      0,
      0.5
    ],
    "leadMs": 0
  },
  "bubble-toad": {
    "name": "move-bubble-toad",
    "source": "DesignAssets/Audio/MovementV1/bubble-toad.mp3",
    "gain": 0.151,
    "phases": [
      0.625
    ],
    "leadMs": 137.4
  },
  "vine-turtle": {
    "name": "move-vine-turtle",
    "source": "DesignAssets/Audio/MovementV1/vine-turtle.mp3",
    "gain": 0.65,
    "phases": [
      0,
      0.5
    ],
    "leadMs": 0
  },
  "shadow-weasel": {
    "name": "move-shadow-weasel",
    "source": "DesignAssets/Audio/MovementV1/shadow-weasel.mp3",
    "gain": 0.114,
    "phases": [
      0,
      0.5
    ],
    "leadMs": 0
  },
  "snare-vine": {
    "name": "move-snare-vine",
    "source": "DesignAssets/Audio/MovementV1/snare-vine.mp3",
    "gain": 0.093,
    "phases": [
      0,
      0.48936170212765956
    ],
    "leadMs": 0
  },
  "talon-owl": {
    "name": "move-talon-owl",
    "source": "DesignAssets/Audio/MovementV1/talon-owl.mp3",
    "gain": 0.06,
    "phases": [
      0.38333333333333336
    ],
    "leadMs": 0
  },
  "spring-keeper": {
    "name": "move-spring-keeper",
    "source": "DesignAssets/Audio/MovementV2/spring-keeper-wing.mp3",
    "gain": 0.16,
    "phases": [0.375],
    "leadMs": 120
  },
  "lantern-keeper": {
    "name": "move-lantern-keeper",
    "source": "DesignAssets/Audio/MovementV1/lantern-keeper.mp3",
    "gain": 0.65,
    "phases": [
      0.6486486486486487
    ],
    "leadMs": 0
  },
  "old-garden-snail": {
    "name": "move-old-garden-snail",
    "source": "DesignAssets/Audio/MovementV1/old-garden-snail.mp3",
    "gain": 0.16,
    "phases": [
      0.3142857142857143
    ],
    "leadMs": 0
  },
  "walking-forest": {
    "name": "move-walking-forest",
    "source": "DesignAssets/Audio/MovementV1/walking-forest.mp3",
    "gain": 0.396,
    "phases": [
      0,
      0.5
    ],
    "leadMs": 0
  },
  "white-paw": {
    "name": "move-white-paw",
    "source": "DesignAssets/Audio/MovementV1/white-paw.mp3",
    "gain": 0.117,
    "phases": [
      0,
      0.5
    ],
    "leadMs": 0
  },
  "spiny-back-leader": {
    "name": "move-spiny-back-leader",
    "source": "DesignAssets/Audio/MovementV1/spiny-back-leader.mp3",
    "gain": 0.334,
    "phases": [
      0,
      0.5
    ],
    "leadMs": 0
  }
});
  const sources = Object.freeze(Object.fromEntries(Object.values(definitions).map(definition => [definition.name, definition.source])));
  const levels = Object.freeze(Object.fromEntries(Object.values(definitions).map(definition => [definition.name, definition.gain])));

  function cues(key, duration, cycles) {
    const definition = definitions[key];
    if (!definition) return [];
    const times = [];
    if (key === "spring-keeper" && cycles === 1) {
      const takeoff = duration / 4, flight = duration / 2;
      return [{ src: definition.source, times: [takeoff * .375 - definition.leadMs,
        takeoff + flight * .375 - definition.leadMs], volume: definition.gain }];
    }
    for (let cycle = 0; cycle < Math.ceil(cycles); cycle++) for (const phase of definition.phases) {
      const at = (cycle + phase) * duration / cycles - definition.leadMs;
      if (cycle + phase < cycles && at >= 0) times.push(at);
    }
    return [{ src: definition.source, times, volume: definition.gain }];
  }

  function create() {
    return { time: null, units: new Map(), beans: new Map(), jumps: new Map() };
  }

  function reset(playback) {
    playback.time = null;
    playback.units.clear();
    playback.beans.clear();
    playback.jumps.clear();
  }

  function pose(unit, time, animations) {
    const key = unit.species || unit.tribe;
    const definition = definitions[key];
    const elapsed = time - unit.moveStartedAt;
    if (!definition || unit.health <= 0 || unit.birth || !(unit.moveDuration > 0) ||
      !Number.isFinite(elapsed) || elapsed < 0 || elapsed >= unit.moveDuration) return null;
    if (unit.species && unit.mode !== "walk") return null;
    let animation, phase, rate;
    if (key === "spiny-back-beetle") {
      if (animations.beetleAnimationPose(unit, time).action !== "walk") return null;
      animation = animations.BEETLE_ANIMATIONS.walk;
      rate = 1 / unit.moveDuration;
      phase = elapsed * rate;
    } else {
      if (unit.species) {
        if (animations.creatureHurtPose(unit, time) || animations.creatureAttackPose(unit, time)) return null;
        animation = animations.CREATURE_WALK_ANIMATIONS[key];
      } else {
        const current = animations.unitAnimationPose(unit, time);
        if (current?.action !== "walk") return null;
        animation = current.animation;
      }
      if (!animation) return null;
      if (key === "spring-keeper") {
        const flight = animations.springKeeperFlightPose(unit, time);
        if (!flight || flight.stage === "landing") return null;
        return { key, definition, phase: flight.phase, rate: flight.rate, elapsed };
      }
      const cycles = animation.cyclesPerCell || 1;
      rate = unit.species ? cycles / unit.moveDuration : 1000 / animation.durationMs;
      phase = unit.species ? Math.max(0, (unit.stepCount || 1) - 1) * cycles + elapsed * rate :
        Math.max(0, time - (unit.moveAnimationStartedAt ?? unit.moveStartedAt)) * rate;
    }
    return { key, definition, phase, rate, elapsed };
  }

  function updateBean(playback, unit, time, events) {
    const end = unit.moveStartedAt + unit.moveDuration;
    const step = unit.moveStartedAt + ":" + unit.stepCount;
    let previous = playback.beans.get(unit.id);
    const appearance = unit.appearanceAttributes || unit.attributes || {};
    if (appearance.feet) {
      const progress = unit.moveDuration ? Math.max(0, Math.min(1, (time - unit.moveStartedAt) / unit.moveDuration)) : 0;
      const contact = Math.min(4, Math.floor(progress * 4 + 1e-7));
      const footstep = unit.stepCount * 4 + contact;
      const contactAt = unit.moveStartedAt + contact * unit.moveDuration / 4;
      if (previous?.footstep < footstep && unit.moveDuration > 0 &&
        time - contactAt <= Math.min(.12, unit.moveDuration / 4)) events.push({ name: "footstep", unit });
      playback.beans.set(unit.id, { footstep });
      return;
    }
    if (previous && previous.step !== step) {
      if (!previous.landed && time >= previous.end && time - previous.end < .35)
        events.push({ name: "landing", unit, position: { x: previous.x, y: previous.y } });
      previous = null;
    }
    if (!previous) {
      previous = { step, end, x: unit.x, y: unit.y, landed: !unit.moveDuration || time >= end };
      playback.beans.set(unit.id, previous);
    }
    if (!previous.landed && time >= end) {
      previous.landed = true;
      if (time - end < .35) events.push({ name: "landing", unit });
    }
  }

  function updateJump(playback, unit, time, animations, events, initial) {
    const animation = !unit.species && animations.UNIT_ANIMATIONS?.[unit.tribe]?.jump;
    const startedAt = unit.jumpStartedAt ?? unit.moveStartedAt;
    let jump = playback.jumps.get(unit.id);
    if (animation && unit.mode === "jump" && Number.isFinite(startedAt) && jump?.startedAt !== startedAt) {
      const at = startedAt + animation.durationMs / 1000;
      jump = { startedAt, at, played: initial && time >= at };
      playback.jumps.set(unit.id, jump);
    }
    if (!jump || jump.played || time < jump.at) return;
    jump.played = true;
    if (!initial && unit.health > 0 && !unit.birth && time - jump.at <= .12)
      events.push({ name: unit.tribe === "spring" ? "spring-landing" : definitions[unit.tribe].name, unit });
  }

  function update(playback, units, time, animations) {
    if (playback.time !== null && (time < playback.time || time - playback.time > .5)) reset(playback);
    const initial = playback.time === null, active = new Set(), beans = new Set(), events = [];
    const jumping = new Set();
    for (const unit of units) {
      jumping.add(unit.id);
      updateJump(playback, unit, time, animations, events, initial);
      if (!unit.species && !["spore", "pebble", "spring"].includes(unit.tribe)) {
        if (unit.health > 0 && !unit.birth) {
          beans.add(unit.id);
          updateBean(playback, unit, time, events);
        }
        continue;
      }
      const motion = pose(unit, time, animations);
      if (!motion) continue;
      active.add(unit.id);
      const previous = playback.units.get(unit.id);
      const startedAt = motion.key === "spring-keeper" && Number.isFinite(unit.flightStartedAt) ? unit.flightStartedAt : unit.moveStartedAt;
      const earlier = previous?.startedAt === startedAt ? previous.phase :
        motion.elapsed <= .12 ? motion.phase - motion.elapsed * motion.rate - 1e-7 : motion.phase;
      if (!initial) for (const audible of motion.definition.phases) {
        const phase = audible - motion.definition.leadMs * motion.rate / 1000;
        const contact = Math.floor(motion.phase - phase + 1e-8) + phase;
        if (contact > earlier + 1e-8 && contact <= motion.phase + 1e-8 && (motion.phase - contact) / motion.rate <= .12)
          events.push({ name: motion.definition.name, unit });
      }
      playback.units.set(unit.id, { startedAt, phase: motion.phase });
    }
    for (const id of playback.jumps.keys()) if (!jumping.has(id)) playback.jumps.delete(id);
    for (const id of playback.units.keys()) if (!active.has(id)) playback.units.delete(id);
    for (const id of playback.beans.keys()) if (!beans.has(id)) playback.beans.delete(id);
    playback.time = time;
    return events;
  }

  globalThis.SpawnerMovementAudio = Object.freeze({ definitions, sources, levels, cues, create, reset, update });
})();

    function drawAgentCorpse(context, corpse, x, floor, cell, outlineColor, opacity) {
      if (corpse.species) return drawCreatureCorpse(context, corpse, x, floor, cell, outlineColor, opacity);
      const appearance = Spawner.unitDisplayAttributes(corpse);
      if (Spawner.hasCombatEvolution(appearance) && combatAttributeArt.ready(corpse.tribe || "bean")) {
        const normal = Object.fromEntries(Object.entries(appearance).filter(([key]) => !Spawner.COMBAT_ATTRIBUTE_KEYS.includes(key)));
        const sprite = combatAttributeArt.frame({ ...corpse, health: 0 }, corpsePlaybackTime(), 1, target =>
          target.drawImage(agentSprite({ ...corpse, health: 1, birth: null, attributes: normal, appearanceAttributes: normal }, "full"), 0, 0, 512, 512), target => drawCombatAgentAttributes(target, corpse));
        if (sprite) {
          const size = cell * AGENT_HEIGHT * 2;
          context.save(); context.translate(x, floor); context.globalAlpha *= opacity;
          context.scale(corpse.facing < 0 ? -1 : 1, 1);
          if (outlineColor) drawSelectionOutline(sprite, -size / 2, -size * .875, size, size, null, outlineColor);
          context.drawImage(sprite, -size / 2, -size * .875, size, size); context.restore(); return true;
        }
      }
      const index = agentDeathFrame(corpse, corpsePlaybackTime());
      if (index < 0) return false;
      const attributes = Spawner.unitDisplayAttributes(corpse);
      let animation = Spawner.agentDeathAnimation(corpse);
      const entry = unitAnimationSheets.get(corpse.tribe || "bean")?.get("death");
      if (!entry?.sprite.complete || !entry.sprite.naturalWidth) return true;
      const frame = idleMotion.matches ? animation.frameCount - 1 : index;
      const attributeFrame = (corpse.tribe || "bean") === "bean" ?
        (attributes.feet && !attributes.antenna && !attributes.strength && !attributes.arms ? sproutCombatFrame(corpse, entry, frame) : null) :
        !["antenna", "strength", "arms", "feet"].some(key => attributes[key] > 0) ? null :
        tribeArt.animationFrame(corpse, entry.sprite, animation, frame, "death", corpsePlaybackTime());
      const lifecycle = Spawner.unitRangedLifecycleAnimation?.(corpse, "death");
      const lifecycleSheet = lifecycle && agentRangedImage(lifecycle.image);
      const sheet = attributeFrame || lifecycleSheet || entry.sprite;
      animation = Spawner.imageFrameGeometry(animation, frame);
      const frameSize = attributeFrame ? sheet.width : animation.frameSize;
      const padding = (frameSize - animation.frameSize) / 2;
      const size = cell * AGENT_HEIGHT * entry.scale * frameSize / animation.frameSize;
      const left = -size * (animation.pivotX + padding) / frameSize;
      const top = -size * (animation.pivotY + padding) / frameSize;
      const sourceX = attributeFrame ? 0 : frame % animation.columns * animation.frameSize;
      const sourceY = attributeFrame ? 0 : Math.floor(frame / animation.columns) * animation.frameSize;
      const decay = Number.isFinite(corpse.decaysAt) ?
        clamp((state.simSeconds - corpse.diedAt) / (corpse.decaysAt - corpse.diedAt), 0, 1) : 0;
      context.save();
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.globalAlpha *= opacity * (1 - decay * 0.4);
      context.filter = "saturate(" + (1 - decay * 0.8) + ")";
      context.translate(x, floor);
      // The snapshot stores the last visible facing for every unit, not only
      // blade/carapace bodies. Keep secretion and ordinary deaths on that same
      // side; old saves without a facing retain their original orientation.
      context.scale(corpse.facing < 0 ? -1 : 1, 1);
      context.drawImage(sheet, sourceX, sourceY, frameSize, frameSize,
        left, top, size, size);
      if (outlineColor) drawSelectionOutline(sheet, left, top, size, size,
        { owner: sheet, size: frameSize, index: attributeFrame ? 0 : frame, x: sourceX, y: sourceY }, outlineColor);
      context.restore();
      return true;
    }

// Exact drawAgentHeldHurt excerpt from main d2afbd8f260c93fbe58fc56398e1aff0a9b06fb5.
// Test fixture only; no full dirty worktree snapshot.
    function drawAgentHeldHurt(context, agent, cell, x, y, outlineColor, externalScale = unitDisplayScale(agent)) {
      const beanSource = Spawner.beanHeldHurtSource?.(agent);
      const speciesSource = !beanSource && Spawner.speciesHeldHurtSource?.(agent);
      const source = beanSource || speciesSource;
      if (!source || cell < 8) return false;
      const scale = Math.max(.000001, externalScale), growth = unitDisplayScale(agent);
      let sourceScale;
      if (source.worldScale === "evolution") sourceScale = cell * AGENT_HEIGHT * 2 / 512 * growth / scale;
      else if (source.worldScale === "composed") sourceScale = cell * AGENT_HEIGHT / 512 * growth / scale;
      else if (source.worldScale === "animation") {
        const entry = unitAnimationSheets.get(agent.tribe)?.get("idle");
        if (!(entry?.scale > 0)) return false;
        sourceScale = cell * AGENT_HEIGHT * entry.scale / source.nativeFrameSize * growth / scale;
      } else if (speciesSource || source.image.endsWith("/secretion.webp"))
        sourceScale = cell * Spawner.unitDisplaySize(agent) / source.referenceLength / scale;
      else sourceScale = cell * unitBodySize("bean", {}).width / source.bodyWidth * growth / scale;
      const facing = agent.combat ? agent.combat.side === 0 ? -1 : 1 : agent.facing || 1;
      return (speciesSource ? Spawner.drawSpeciesHeldHurt : Spawner.drawBeanHeldHurt)(context, agent, state.simSeconds, agentRangedImage, {
        x, y, sourceScale, mirror: facing < 0,
        beforeDraw: outlineColor && context === ctx ? (context, image, crop, destination) =>
          drawSelectionOutline(image, destination.x, destination.y, destination.width, destination.height,
            { owner: image, index: crop.y * image.width + crop.x, x: crop.x, y: crop.y, size: crop.width, height: crop.height }, outlineColor) : null
      });
    }

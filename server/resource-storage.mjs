import { buildingDefinition, materialCapacity } from "./buildings.mjs";
import { resourceDefinition, migrateResourceType } from "./resources.mjs";

const quantity = value => Number.isFinite(value) ? Math.max(0, value) : 0;
const total = inventory => Object.values(inventory || {}).reduce((sum, amount) => sum + quantity(amount), 0);

export function createResourceStorage(state, colony) {
  let sequence = 0;

  function facilities() {
    const refuge = state.nestHealth > 0 ? null : state.buildings.find(building => building.health > 0 && building.key === "outpost");
    const base = state.nestHealth > 0 ? [{ id: "nest:" + colony.id, kind: "nest", x: colony.x, y: colony.y,
      width: 5, height: 5, capacity: materialCapacity(state.nestLevel, []) }] : refuge ? [{
      id: refuge.id, kind: "outpost", x: refuge.x, y: refuge.y, width: refuge.width || 3, height: refuge.height || 3,
      capacity: materialCapacity(state.nestLevel, []) }] : [];
    return base
      .concat(state.buildings.filter(building => building.health > 0 && building.key === "storage").map(building => ({
        id: building.id, kind: "storage", x: building.x, y: building.y,
        width: building.width || buildingDefinition("storage").width, height: building.height || buildingDefinition("storage").height, capacity: buildingDefinition("storage").storageCapacity })));
  }

  function aggregate() {
    const inventory = {};
    for (const store of state.resourceStores || []) if (store.kind !== "remains") {
      for (const [type, amount] of Object.entries(store.inventory)) inventory[type] = (inventory[type] || 0) + quantity(amount);
    }
    state.resourceInventory = inventory;
  }

  function refresh() {
    const current = facilities();
    if (!Array.isArray(state.resourceStores)) {
      const first = current[0] || { id: "remains:" + colony.id, kind: "remains", x: colony.x, y: colony.y, width: 1, height: 1, capacity: 0 };
      state.resourceStores = [{ ...first, inventory: { ...state.resourceInventory } }];
    }
    for (const store of state.resourceStores) {
      const facility = current.find(entry => entry.id === store.id);
      if (facility) Object.assign(store, facility);
      else { store.kind = "remains"; store.capacity = 0; }
    }
    for (const facility of current) if (!state.resourceStores.some(store => store.id === facility.id)) {
      state.resourceStores.push({ ...facility, inventory: {} });
    }
    aggregate();
    return state.resourceStores;
  }

  function restore() {
    const expected = { ...state.resourceInventory };
    const previous = Array.isArray(state.resourceStores) ? {} : null;
    if (Array.isArray(state.resourceStores)) for (const store of state.resourceStores) {
      const inventory = {};
      for (const [key, amount] of Object.entries(store.inventory || {})) {
        const type = migrateResourceType(key);
        if (resourceDefinition(type) && Number.isFinite(amount) && amount >= 0) inventory[type] = (inventory[type] || 0) + amount;
      }
      store.inventory = inventory;
      if (store.kind !== "remains") for (const [type, amount] of Object.entries(inventory)) previous[type] = (previous[type] || 0) + amount;
    }
    refresh();
    const first = state.resourceStores.find(store => store.kind !== "remains");
    if (first) for (const type of new Set([...Object.keys(expected), ...Object.keys(state.resourceInventory)])) {
      const difference = quantity(expected[type]) - quantity(previous ? previous[type] : state.resourceInventory[type]);
      if (difference > 1e-8) first.inventory[type] = (first.inventory[type] || 0) + difference;
      else if (difference < -1e-8) remove(type, -difference);
    }
    aggregate();
  }

  function cells(store) {
    if (store.kind === "nest") return [[0, 0], [store.width - 1, 0], [0, store.height - 1], [store.width - 1, store.height - 1]]
      .map(([x, y]) => ({ x: store.x + x, y: store.y + y }));
    const cells = [];
    for (let x = store.x; x < store.x + store.width; x++) {
      cells.push({ x, y: store.y - 1 }, { x, y: store.y + store.height });
    }
    for (let y = store.y; y < store.y + store.height; y++) {
      cells.push({ x: store.x - 1, y }, { x: store.x + store.width, y });
    }
    if (store.kind === "remains") cells.push({ x: store.x, y: store.y });
    return cells;
  }

  function at(x, y) {
    return refresh().find(store => store.kind !== "remains" && cells(store).some(cell => cell.x === x && cell.y === y));
  }

  function space(store) {
    return store && store.kind !== "remains" ? Math.max(0, store.capacity - total(store.inventory)) : 0;
  }

  function deposit(store, type, amount) {
    const stored = Math.min(quantity(amount), space(store));
    if (stored > 0) store.inventory[type] = (store.inventory[type] || 0) + stored;
    aggregate();
    return stored;
  }

  function withdraw(store, type, amount) {
    const taken = Math.min(quantity(amount), quantity(store?.inventory[type]));
    if (taken > 0) store.inventory[type] -= taken;
    aggregate();
    return taken;
  }

  function remove(type, amount) {
    let remaining = quantity(amount);
    for (const store of state.resourceStores || []) if (store.kind !== "remains") remaining -= withdraw(store, type, remaining);
    return amount - remaining;
  }

  function spend(materials) {
    refresh();
    if (!Object.entries(materials).every(([type, amount]) => quantity(state.resourceInventory[type]) + 1e-8 >= amount)) return false;
    for (const [type, amount] of Object.entries(materials)) remove(type, amount);
    return true;
  }

  function abandon(position, inventory) {
    if (total(inventory) <= 1e-8) return;
    refresh();
    state.resourceStores.push({ id: "remains:" + colony.id + ":" + state.simSeconds + ":" + state.resourceStores.length + ":" + ++sequence,
      kind: "remains", x: position.x, y: position.y, width: 1, height: 1, capacity: 0, inventory: { ...inventory } });
  }

  return { refresh, restore, cells, at, space, deposit, withdraw, remove, spend, abandon };
}

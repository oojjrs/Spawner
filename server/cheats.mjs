export function commandCheat(action, environment, state, removeDeadAgents, checkEnding) {
  if (action.type !== "cheat-extinction") return null;
  if (environment.cheats !== true) throw new Error("이 방에서는 치트를 사용할 수 없습니다.");
  for (const agent of state.agents) agent.health = 0;
  removeDeadAgents();
  state.evolutionPoints = 0;
  checkEnding();
  return {};
}

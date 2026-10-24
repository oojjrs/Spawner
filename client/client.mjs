export function createClient(onState, onError, onSaved, workerSource) {
  let workerUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
  const worker = new Worker(workerUrl);
  const requests = new Map();
  let nextId = 0;
  let fatalError = null;
  worker.onmessage = event => {
    if (workerUrl) { URL.revokeObjectURL(workerUrl); workerUrl = null; }
    const message = event.data;
    if (message.type === "state") { onState(message.packet); return; }
    if (message.type === "error") { onError(message.error, message.storageError === true); return; }
    if (message.type === "saved") { onSaved(message); return; }
    const request = requests.get(message.id);
    if (!request) return;
    requests.delete(message.id);
    if (message.error) request.reject(new Error(message.error));
    else request.resolve(message.result);
  };
  worker.onerror = event => {
    if (workerUrl) { URL.revokeObjectURL(workerUrl); workerUrl = null; }
    event.preventDefault();
    fatalError = new Error("게임 실행을 중단했습니다. 페이지를 새로고침해 저장된 월드를 다시 열어 주세요.");
    for (const request of requests.values()) request.reject(fatalError);
    requests.clear();
    onError(fatalError.message);
  };
  return {
    call(type, data) {
      if (fatalError) return Promise.reject(fatalError);
      return new Promise((resolve, reject) => {
        const id = ++nextId;
        requests.set(id, { resolve, reject });
        worker.postMessage({ id, type, data });
      });
    }
  };
}

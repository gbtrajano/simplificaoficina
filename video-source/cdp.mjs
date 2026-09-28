export async function connect() {
  const pages = await (await fetch('http://127.0.0.1:9327/json')).json();
  const ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data), task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id); clearTimeout(task.timer);
    if (message.error) task.reject(new Error(JSON.stringify(message.error)));
    else task.resolve(message.result);
  };
  const send = (method, params = {}, timeout = 20000) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Timeout: ' + method)); }, timeout);
    pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression, timeout) => {
    const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, timeout);
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  return { send, evaluate, close: () => ws.close() };
}
export const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Teste local: bun landing-page/check-browser.mjs (Edge de teste na porta 9327).
import fs from 'node:fs';
import assert from 'node:assert/strict';
const pages = await (await fetch('http://127.0.0.1:9327/json')).json();
const page = pages.find(item => item.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
let nextId = 0;
const pending = new Map();
ws.onmessage = event => {
  const message = JSON.parse(event.data);
  const task = pending.get(message.id);
  if (!task) return;
  pending.delete(message.id);
  clearTimeout(task.timeout);
  if (message.error) task.reject(new Error(JSON.stringify(message.error)));
  else task.resolve(message.result);
};
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error('Timeout: ' + method)); }, 15000);
    pending.set(id, { resolve, reject, timeout });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
}
try {
  await send('Page.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Page.navigate', { url: 'file:///C:/Users/gabriel/Documents/Projetos/simplificaoficina/landing-page/index.html' });
  for (let attempt = 0; attempt < 30; attempt++) {
    if (await evaluate('document.readyState === "complete"')) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const reports = [];
  for (const width of [320, 390, 768, 1024, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: false });
    const sizes = await evaluate(`({viewport: innerWidth, document: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll('main *')].filter(el => el.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(el).position !== 'absolute').slice(0,12).map(el => ({tag:el.tagName,cls:el.className,width:el.getBoundingClientRect().width}))})`);
    reports.push({ width, ...sizes });
    if (width === 390 || width === 1440) {
      const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(`landing-page/preview-${width === 390 ? 'mobile' : 'desktop'}.png`, Buffer.from(shot.data, 'base64'));
    }
  }
  console.log(JSON.stringify(reports, null, 2));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 900, deviceScaleFactor: 1, mobile: false });
  assert.equal(await evaluate(`document.getElementById('menuButton').click(); document.getElementById('menuButton').getAttribute('aria-expanded')`), 'true');
  assert.equal(await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})); document.getElementById('menuButton').getAttribute('aria-expanded')`), 'false');
  assert.equal(await evaluate(`document.getElementById('tab-orcamento').click(); !document.getElementById('panel-orcamento').hidden && document.getElementById('panel-os').hidden`), true);
  assert.equal(await evaluate(`document.getElementById('tab-orcamento').dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowRight', bubbles:true})); document.getElementById('tab-financeiro').getAttribute('aria-selected')`), 'true');
  assert.equal(await evaluate(`document.querySelector('#faq details').open = true; document.querySelector('#faq details').open`), true);
  assert.equal(await evaluate(`document.getElementById('mainDownload').getAttribute('href')`), 'download.html');
  for (const width of [320, 390, 768, 1440]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: false });
    for (const id of ['os', 'orcamento', 'financeiro']) {
      assert.equal(await evaluate(`document.getElementById('tab-${id}').click(); document.documentElement.scrollWidth <= innerWidth`), true);
    }
  }
  for (const [width, section, name] of [[390, 'demonstracao', 'demo-mobile'], [1440, 'planos', 'plano-desktop']]) {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: false });
    await evaluate(`document.getElementById('${section}').scrollIntoView({behavior:'instant'})`);
    await new Promise(resolve => setTimeout(resolve, 300));
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(`landing-page/preview-${name}.png`, Buffer.from(shot.data, 'base64'));
  }
  console.log('PASS: menu mobile, Escape, abas, teclado, FAQ e CTA de download.');
  for (const report of reports) assert.ok(report.document <= report.viewport, `Overflow em ${report.width}px`);
  console.log('PASS: sem rolagem horizontal em 320, 390, 768, 1024 e 1440px.');
} finally {
  ws.close();
}

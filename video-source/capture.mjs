import fs from 'node:fs';
import { connect, pause } from './cdp.mjs';
const browser = await connect();
fs.mkdirSync('video-source/frames', {recursive:true});
try {
  await browser.send('Page.enable');
  await browser.send('Emulation.setDeviceMetricsOverride', {width:1440,height:800,deviceScaleFactor:1,mobile:false});
  await browser.send('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await browser.send('Page.navigate',{url:'http://127.0.0.1:1428/video-source/app.html'});
  for(let i=0;i<100;i++) {
    if(await browser.evaluate(`!!document.querySelector('.metric-grid')`)) break;
    await pause(200);
  }
  await browser.evaluate('document.fonts.ready');
  const shoot = async name => {
    await pause(650);
    const text = await browser.evaluate('document.body.innerText');
    if(/Operação bloqueada|Não foi possível carregar|invoke.*undefined/.test(text)) throw new Error('Falha ao preparar tela: '+name);
    const screenshot = await browser.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
    fs.writeFileSync(`video-source/frames/${name}.png`,Buffer.from(screenshot.data,'base64'));
    console.log('Capturada: '+name);
  };
  const go = async hash => { await browser.evaluate(`location.hash=${JSON.stringify(hash)}`); await pause(450); };
  await shoot('01-painel');
  await go('/ordens'); await shoot('02-ordens');
  await go('/ordens?editar=101'); await shoot('03-editar-os');
  await go('/veiculos'); await shoot('04-veiculos');
  await go('/orcamentos');
  await browser.evaluate(`(() => {
    const set=(el,value)=>{Object.getOwnPropertyDescriptor(el instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));};
    set(document.querySelector('.budget-fields select'),'1');
    set(document.querySelector('input[placeholder^="Ex.: Honda"]'),'Volkswagen Polo 2022 • DEM0A01');
    set(document.querySelector('.budget-catalog-picker select'),'service:1');
  })()`);
  await pause(200);
  await browser.evaluate(`document.querySelector('.budget-catalog-picker button').click()`);
  await pause(200);
  await browser.evaluate(`(() => {const el=document.querySelector('.budget-catalog-picker select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'product:2');el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await pause(200);
  await browser.evaluate(`document.querySelector('.budget-catalog-picker button').click()`);
  await shoot('05-orcamento');
  await go('/pecas'); await shoot('06-estoque');
  await go('/financeiro'); await shoot('07-financeiro');
  await browser.evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('Contas a Receber')).click()`);
  await shoot('08-receber');
} finally { browser.close(); }

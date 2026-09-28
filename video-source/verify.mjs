import fs from 'node:fs';
import assert from 'node:assert/strict';
import {connect,pause} from './cdp.mjs';
const browser=await connect();
try{
  await browser.send('Page.enable');
  await browser.send('Page.navigate',{url:'http://127.0.0.1:1428/landing-page/index.html'});
  for(let i=0;i<100;i++){if(await browser.evaluate('!!document.getElementById("productVideo")'))break;await pause(100)}
  const metadata=await browser.evaluate(`new Promise((resolve,reject)=>{const v=document.getElementById('productVideo');const timeout=setTimeout(()=>reject(new Error('Timeout metadata')),15000);v.onloadedmetadata=()=>{clearTimeout(timeout);resolve({duration:v.duration,width:v.videoWidth,height:v.videoHeight})};v.onerror=()=>{clearTimeout(timeout);reject(new Error(v.error?.message||'Video error'))};v.load()})`);
  console.log(JSON.stringify(metadata));
  assert.equal(metadata.width,1920);assert.equal(metadata.height,1080);
  assert.ok(metadata.duration>=44&&metadata.duration<=47,'Invalid duration');
  for(const second of [2,12,24,41]){
    const frame=await browser.evaluate(`new Promise((resolve,reject)=>{const v=document.getElementById('productVideo');const timeout=setTimeout(()=>reject(new Error('Timeout seek')),12000);v.onseeked=()=>{clearTimeout(timeout);const c=document.createElement('canvas');c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d').drawImage(v,0,0);resolve(c.toDataURL('image/jpeg',.9).split(',')[1])};v.currentTime=${second}})`);
    fs.writeFileSync(`video-source/frames/decoded-${second}.jpg`,Buffer.from(frame,'base64'));
  }
  const playback=await browser.send('Runtime.evaluate',{expression:`document.getElementById('productVideo').play()`,awaitPromise:true,userGesture:true});
  if(playback.exceptionDetails)throw new Error(JSON.stringify(playback.exceptionDetails));
  await pause(1200);
  const playing=await browser.evaluate(`({time:document.getElementById('productVideo').currentTime,paused:document.getElementById('productVideo').paused})`);
  assert.ok(!playing.paused&&playing.time>41);await browser.evaluate(`document.getElementById('productVideo').pause()`);
  for(const width of [390,1440]){
    await browser.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    const result=await browser.evaluate(`document.getElementById('productVideo').scrollIntoView({behavior:'instant'});({viewport:innerWidth,page:document.documentElement.scrollWidth,videoWidth:document.getElementById('productVideo').getBoundingClientRect().width})`);
    assert.ok(result.page<=result.viewport);console.log(JSON.stringify(result));
  }
  console.log('PASS: H.264 Full HD, duration, seek at 2/12/24/41s, playback and responsive player.');
}finally{browser.close()}

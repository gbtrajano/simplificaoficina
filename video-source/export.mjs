import fs from 'node:fs';
import {connect,pause} from './cdp.mjs';
const browser=await connect();
try{
  await browser.send('Page.enable');
  await browser.send('Emulation.setDeviceMetricsOverride',{width:1920,height:1080,deviceScaleFactor:1,mobile:false});
  await browser.send('Page.navigate',{url:'http://127.0.0.1:1428/video-source/render.html'});
  for(let i=0;i<100;i++){if(await browser.evaluate('typeof window.ready !== "undefined"'))break;await pause(100)}
  await browser.evaluate('window.ready');
  await browser.evaluate('renderAt(2.5)');
  const poster=await browser.evaluate('document.getElementById("film").toDataURL("image/jpeg",.92).split(",")[1]');
  fs.writeFileSync('landing-page/video-poster.jpg',Buffer.from(poster,'base64'));
  for(const t of [6,12,24,40]){
    await browser.evaluate(`renderAt(${t})`);
    const frame=await browser.evaluate('document.getElementById("film").toDataURL("image/jpeg",.9).split(",")[1]');
    fs.writeFileSync(`video-source/frames/video-${t}.jpg`,Buffer.from(frame,'base64'));
  }
  await browser.evaluate('startExport()');
  let state;
  for(let i=0;i<75;i++){
    await pause(1000);state=await browser.evaluate('window.exportState');
    if(i%10===0||state.status!=='recording')console.log(JSON.stringify(state));
    if(state.status==='error')throw new Error(state.message);
    if(state.status==='done')break;
  }
  if(state.status!=='done')throw new Error('Exportação não concluída');
  const chunks=[];
  for(let offset=0;offset<state.size;offset+=1024*1024)chunks.push(Buffer.from(await browser.evaluate(`getVideoChunk(${offset},1048576)`),'base64'));
  const video=Buffer.concat(chunks);
  fs.writeFileSync('landing-page/video-sistema.mp4',video);
  console.log(JSON.stringify({saved:'landing-page/video-sistema.mp4',bytes:video.length}));
}finally{browser.close()}

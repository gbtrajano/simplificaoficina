// Composição de vídeo a partir de capturas das telas reais com dados fictícios.
const canvas = document.getElementById('film');
const ctx = canvas.getContext('2d', {alpha:false});
const WIDTH=1920, HEIGHT=1080, DURATION=45;
const scenes=[
  {start:0,end:4,kind:'intro'},
  {start:4,end:10,image:'01-painel',tag:'01 / VISÃO GERAL',title:'Toda a oficina. Uma visão organizada.',focus:[275,183,1135,115]},
  {start:10,end:15,image:'02-ordens',tag:'02 / ORDENS DE SERVIÇO',title:'Acompanhe cada serviço, da entrada à entrega.',focus:[841,313,142,264]},
  {start:15,end:18,image:'03-editar-os',tag:'02 / ORDENS DE SERVIÇO',title:'Edite informações e organize a execução.'},
  {start:18,end:22,image:'04-veiculos',tag:'03 / CLIENTES E VEÍCULOS',title:'Cadastros à mão para o próximo atendimento.'},
  {start:22,end:29,image:'05-orcamento',tag:'04 / ORÇAMENTOS PARA WHATSAPP',title:'Monte o orçamento. Copie a mensagem. Envie.',focus:[1025,187,380,523]},
  {start:29,end:33,image:'06-estoque',tag:'05 / PEÇAS E ESTOQUE',title:'Saiba quais materiais estão disponíveis.'},
  {start:33,end:35.5,image:'07-financeiro',tag:'06 / FINANCEIRO',title:'Contas a pagar e a receber no mesmo sistema.'},
  {start:35.5,end:38,image:'08-receber',tag:'06 / FINANCEIRO',title:'Contas a pagar e a receber no mesmo sistema.'},
  {start:38,end:45,kind:'outro'},
];
const shots={};
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
const ease=n=>1-Math.pow(1-clamp(n),3);
function rounded(context,x,y,w,h,r,fill,stroke){context.beginPath();context.roundRect(x,y,w,h,r);if(fill){context.fillStyle=fill;context.fill()}if(stroke){context.strokeStyle=stroke;context.stroke()}}
function text(context,value,x,y,size=32,color='#fff',weight=600){context.fillStyle=color;context.font=`${weight} ${size}px Manrope, Arial, sans-serif`;context.fillText(value,x,y)}
function background(context,t){
  context.fillStyle='#101b31';context.fillRect(0,0,WIDTH,HEIGHT);
  const glow=context.createRadialGradient(1650+Math.sin(t/8)*30,160,20,1500,200,850);glow.addColorStop(0,'#523120');glow.addColorStop(1,'#101b31');context.fillStyle=glow;context.fillRect(0,0,WIDTH,HEIGHT);
  context.lineWidth=1;context.strokeStyle='rgba(255,255,255,.035)';context.beginPath();for(let x=0;x<WIDTH;x+=64){context.moveTo(x,0);context.lineTo(x,HEIGHT)}for(let y=0;y<HEIGHT;y+=64){context.moveTo(0,y);context.lineTo(WIDTH,y)}context.stroke();
}
function logo(context,x,y,scale=1){
  context.save();context.translate(x,y);context.scale(scale,scale);
  rounded(context,0,0,70,70,19,'#f97316');
  context.save();context.translate(17,15);context.scale(1.65,1.65);context.strokeStyle='white';context.lineWidth=2;context.lineJoin='round';context.lineCap='round';
  const path=new Path2D('M14.7 6.3a4 4 0 0 0-5 5L3 18v3h3l6.7-6.7a4 4 0 0 0 5-5l-2.4 2.4-3-3 2.4-2.4Z');context.stroke(path);context.restore();
  text(context,'Simplifica',90,34,36,'#fff',800);text(context,'O F I C I N A',92,61,16,'#fb923c',700);context.restore();
}
function frame(context,image,x,y,w,h){
  context.save();context.shadowColor='rgba(0,0,0,.3)';context.shadowBlur=45;context.shadowOffsetY=20;rounded(context,x-6,y-6,w+12,h+12,18,'#344054');context.restore();
  context.save();context.beginPath();context.roundRect(x,y,w,h,12);context.clip();context.drawImage(image,x,y,w,h);context.restore();
}
function pill(context,value,x,y,w){rounded(context,x,y,w,46,23,'rgba(249,115,22,.13)','#874223');text(context,value,x+21,y+30,18,'#fdba74',800)}
function footer(context,t){
  text(context,'Telas reais do sistema • Dados fictícios para demonstração',100,1045,20,'#b6c3d6',500);
  context.textAlign='right';text(context,'SIMPLIFICA OFICINA',1820,1045,18,'#b6c3d6',700);context.textAlign='left';
  context.fillStyle='#263349';context.fillRect(0,1074,WIDTH,6);context.fillStyle='#f97316';context.fillRect(0,1074,WIDTH*clamp(t/DURATION),6);
}
function drawScene(context,scene,t){
  background(context,t);
  const local=t-scene.start,p=clamp(local/(scene.end-scene.start));
  if(scene.kind==='intro'){
    logo(context,120,115,1.15);
    context.save();context.globalAlpha=ease(local/.6);context.translate(0,22*(1-ease(local/.8)));
    pill(context,'GESTÃO PARA OFICINAS',120,277,315);
    text(context,'Menos papelada.',120,440,76,'#fff',800);
    text(context,'Mais oficina',120,540,76,'#fb923c',800);
    text(context,'rodando.',120,640,76,'#fb923c',800);
    text(context,'Conheça o Simplifica Oficina.',120,729,31,'#c4cfdd',500);
    context.restore();
    const scale=1+.02*ease(p),w=790*scale,h=w*800/1440;
    frame(context,shots['01-painel'],1000-(w-790)/2,315-(h-439)/2,w,h);
    text(context,'Um só lugar para organizar sua rotina.',1040,821,25,'#c4cfdd',600);
    footer(context,t);return;
  }
  if(scene.kind==='outro'){
    logo(context,120,105,1.15);
    context.save();context.globalAlpha=ease(local/.5);
    pill(context,'UM ÚNICO PLANO',120,272,263);
    text(context,'Sua oficina completa.',120,438,78,'#fff',800);
    text(context,'Mais simples de organizar.',120,543,59,'#fb923c',800);
    text(context,'OSs ilimitadas  •  Até 10 contas para a equipe',120,645,30,'#c4cfdd',500);
    rounded(context,120,722,515,81,18,'#f97316');text(context,'Baixe para Windows',160,775,34,'#fff',800);
    text(context,'Confira o guia de instalação nesta página.',120,865,27,'#c4cfdd',500);
    rounded(context,1250,285,540,530,28,'#19263e','#31405a');
    text(context,'ASSINATURA MENSAL',1290,356,24,'#fdba74',800);
    text(context,'Um plano.',1290,440,50,'#fff',800);
    text(context,'Toda a equipe.',1290,510,50,'#fff',800);
    text(context,'Licença por mensalidade.',1290,598,25,'#c4cfdd',500);
    text(context,'É necessário manter',1290,660,25,'#c4cfdd',500);
    text(context,'a assinatura ativa.',1290,700,25,'#c4cfdd',500);
    text(context,'Não é uma licença vitalícia.',1290,765,23,'#fdba74',700);
    context.restore();footer(context,t);return;
  }
  context.save();context.globalAlpha=ease(local/.35);
  text(context,scene.tag,188,57,19,'#fb923c',800);
  text(context,scene.title,188,111,38,'#fff',800);
  context.restore();
  const w=1530,h=850,x=195,y=159;
  frame(context,shots[scene.image],x,y,w,h);
  if(scene.focus&&local>1.2){
    const [fx,fy,fw,fh]=scene.focus,s=w/1440;
    context.save();context.globalAlpha=.72*clamp((local-1.2)/.5)*clamp((scene.end-t)/.6);context.lineWidth=3;rounded(context,x+fx*s-4,y+fy*s-4,fw*s+8,fh*s+8,14,null,'#fb923c');context.restore();
  }
  footer(context,t);
}
const layer=document.createElement('canvas');layer.width=WIDTH;layer.height=HEIGHT;const layerCtx=layer.getContext('2d',{alpha:false});
window.renderAt=function(t){
  t=clamp(t,0,DURATION-.001);
  const index=scenes.findIndex(s=>t>=s.start&&t<s.end),scene=scenes[index];
  drawScene(ctx,scene,t);
  if(index>0&&t-scene.start<.4){
    drawScene(layerCtx,scenes[index-1],scene.start-.001);
    ctx.save();ctx.globalAlpha=1-(t-scene.start)/.4;ctx.drawImage(layer,0,0);ctx.restore();
  }
};
window.ready=(async()=>{
  await document.fonts.load('800 40px Manrope');await document.fonts.ready;
  await Promise.all([...new Set(scenes.filter(s=>s.image).map(s=>s.image))].map(async name=>{const img=new Image();img.src=`./frames/${name}.png`;await img.decode();shots[name]=img}));
  renderAt(2.5);return true;
})();
window.startExport=async function(seconds=DURATION){
  await window.ready;
  const mime='video/mp4;codecs=avc1.420028';
  if(!MediaRecorder.isTypeSupported(mime))throw new Error('H.264 indisponível');
  const stream=canvas.captureStream(0),track=stream.getVideoTracks()[0];
  const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6500000});
  const chunks=[];window.exportState={status:'recording',seconds:0,mime};
  recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data)};
  recorder.onerror=event=>{window.exportState={status:'error',message:event.error?.message||'Erro ao codificar'}};
  recorder.onstop=async()=>{const blob=new Blob(chunks,{type:'video/mp4'});window.videoBytes=new Uint8Array(await blob.arrayBuffer());window.exportState={status:'done',size:blob.size,seconds,mime};stream.getTracks().forEach(t=>t.stop())};
  renderAt(0);recorder.start(1000);track.requestFrame();const start=performance.now();
  const interval=setInterval(()=>{
    const t=(performance.now()-start)/1000;renderAt(Math.min(t,seconds-.001));track.requestFrame();window.exportState.seconds=Math.min(t,seconds);
    if(t>=seconds){clearInterval(interval);recorder.stop()}
  },1000/30);
  return true;
};
window.getVideoChunk=function(offset,size){const bytes=window.videoBytes.slice(offset,offset+size);let text='';for(let i=0;i<bytes.length;i+=16384)text+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(text)};

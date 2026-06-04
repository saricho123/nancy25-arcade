(function(){
'use strict';

const OPPS    = ['assets/opp1.png','assets/opp2.png','assets/opp3.png'];
const FRIENDS = Array.from({length:13},(_,i)=>`assets/friend_${i+1}.png`);

const CW=480, CH=480;
const HR=60; // hole radius
const HOLES=(()=>{
  const xs=[100,240,380], ys=[110,250,390], out=[];
  ys.forEach(y=>xs.forEach(x=>out.push({x,y,r:HR})));
  return out;
})();

const TOTAL=60;

let canvas, ctx;
const imgs={opps:[],friends:[]};
let audioCtx=null;

const state={
  lives:3, score:0, phase:'start',
  active:[], startTime:0, nextSpawn:0, rafId:0
};

function diff(e){
  if(e<20000) return {si:1400,sd:1600,max:2};
  if(e<40000) return {si:1000,sd:1100,max:3};
  return {si:700,sd:750,max:4};
}

function preload(srcs){
  return Promise.all(srcs.map(src=>new Promise(res=>{
    const img=new Image();
    img.onload=()=>res(img);
    img.onerror=()=>res(null);
    img.src=src;
  })));
}

function initAudio(){
  if(audioCtx) return;
  audioCtx=new(window.AudioContext||window.webkitAudioContext)();
}
function beep(freq1,freq2,dur,type,vol){
  if(!audioCtx) return;
  const o=audioCtx.createOscillator(), g=audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  o.type=type||'square';
  o.frequency.setValueAtTime(freq1,audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(freq2,audioCtx.currentTime+dur);
  g.gain.setValueAtTime(vol||0.25,audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+dur);
  o.start(); o.stop(audioCtx.currentTime+dur);
}
const playBonk=()=>beep(660,1100,0.18,'square',0.28);
const playSad=()=>beep(440,200,0.45,'sine',0.18);

function easeOut(t){return 1-(1-t)*(1-t);}
function easeIn(t){return t*t;}

function drawBg(){
  const bg=ctx.createLinearGradient(0,0,0,CH);
  bg.addColorStop(0,'#070e07');
  bg.addColorStop(1,'#0a140a');
  ctx.fillStyle=bg; ctx.fillRect(0,0,CW,CH);
  ctx.save();
  ctx.fillStyle='rgba(0,180,80,0.055)';
  ctx.font='30px serif';
  [[18,52],[150,38],[308,46],[440,34],[50,188],[448,175],[18,322],[450,308],[135,458],[338,452],[420,96],[78,415]].forEach(([x,y],i)=>{
    ctx.fillText(['♩','♪','♫','♬','𝄞','♭'][i%6],x,y);
  });
  ctx.restore();
}

function drawBands(){
  [110,250,390].forEach(ry=>{
    const by=ry-22, bh=44;
    const gr=ctx.createLinearGradient(0,by,0,by+bh);
    gr.addColorStop(0,'#a0a8a0');
    gr.addColorStop(0.3,'#dce0dc');
    gr.addColorStop(0.65,'#c0c8c0');
    gr.addColorStop(1,'#707870');
    ctx.fillStyle=gr; ctx.fillRect(0,by,CW,bh);
    ctx.strokeStyle='rgba(60,80,60,0.22)'; ctx.lineWidth=0.6;
    for(let y=by+7;y<by+bh;y+=7){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(CW,y);ctx.stroke();}
  });
}

function drawHoleBg(){
  HOLES.forEach(h=>{
    const hg=ctx.createRadialGradient(h.x,h.y-8,0,h.x,h.y,h.r);
    hg.addColorStop(0,'#141414'); hg.addColorStop(1,'#040404');
    ctx.beginPath(); ctx.arc(h.x,h.y,h.r,0,Math.PI*2);
    ctx.fillStyle=hg; ctx.fill();
  });
}

function drawHoleRims(){
  HOLES.forEach(h=>{
    ctx.save();
    ctx.beginPath();
    ctx.arc(h.x,h.y,h.r+10,0,Math.PI*2);
    ctx.arc(h.x,h.y,h.r,0,Math.PI*2,true);
    const rim=ctx.createLinearGradient(h.x-h.r-10,h.y,h.x+h.r+10,h.y);
    rim.addColorStop(0,'#6a6a6a'); rim.addColorStop(0.3,'#d8d8d8');
    rim.addColorStop(0.7,'#c0c0c0'); rim.addColorStop(1,'#5a5a5a');
    ctx.fillStyle=rim; ctx.fill('evenodd');
    ctx.beginPath(); ctx.arc(h.x,h.y,h.r,0,Math.PI*2);
    ctx.strokeStyle='rgba(0,0,0,0.7)'; ctx.lineWidth=2.5; ctx.stroke();
    ctx.restore();
  });
}

function drawFaceSlot(slot,now){
  const h=HOLES[slot.holeIdx], r=h.r;
  const RISE=200, SINK=180;

  if(slot.state==='active'){
    const age=now-slot.spawnTime;
    const tl=slot.showDuration-age;
    let yOff=0;
    if(age<RISE) yOff=r*2*(1-easeOut(age/RISE));
    else if(tl<SINK){ slot.state='sinking'; slot.sinkStart=now; return; }
    clipFace(slot,h,yOff);

  } else if(slot.state==='sinking'){
    const t=(now-slot.sinkStart)/SINK;
    if(t>=1){ slot.state='done'; return; }
    clipFace(slot,h,r*2*easeIn(t));

  } else if(slot.state==='hit-opp'){
    const t=(now-slot.hitTime)/260;
    if(t>=1){ slot.state='done'; return; }
    ctx.save();
    ctx.globalAlpha=1-t;
    ctx.translate(h.x,h.y); ctx.scale(1+t*0.35,1-t*0.45); ctx.translate(-h.x,-h.y);
    clipFace(slot,h,0);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha=(1-t)*0.65;
    ctx.beginPath(); ctx.arc(h.x,h.y,r,0,Math.PI*2);
    ctx.fillStyle='#ffd700'; ctx.fill();
    ctx.restore();

  } else if(slot.state==='hit-friend'){
    const t=(now-slot.hitTime)/360;
    if(t>=1){ slot.state='done'; return; }
    const shake=Math.sin(t*Math.PI*14)*7*(1-t);
    ctx.save();
    ctx.globalAlpha=1-t;
    ctx.translate(shake,0);
    clipFace(slot,h,0);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha=(1-t)*0.55;
    ctx.beginPath(); ctx.arc(h.x,h.y,r,0,Math.PI*2);
    ctx.fillStyle='#ff2020'; ctx.fill();
    ctx.restore();
  }
}

function clipFace(slot,h,yOff){
  if(!slot.img) return;
  const r=h.r, iw=slot.img.naturalWidth, ih=slot.img.naturalHeight;
  const scale=(r*2.3)/iw;
  const dw=iw*scale, dh=ih*scale;
  const dx=h.x-dw/2;
  const dy=h.y-dh*0.42+yOff;
  ctx.save();
  ctx.beginPath(); ctx.arc(h.x,h.y,r,0,Math.PI*2); ctx.clip();
  ctx.drawImage(slot.img,dx,dy,dw,dh);
  ctx.restore();
}

function drawHUD(elapsed){
  const secs=Math.max(0,TOTAL-Math.floor(elapsed/1000));
  ctx.save();
  ctx.shadowBlur=10;
  ctx.font='13px "Press Start 2P",monospace';
  ctx.shadowColor='#00ff88'; ctx.fillStyle='#00ff88';
  ctx.textAlign='left'; ctx.fillText('SCORE '+state.score,10,28);
  ctx.textAlign='right';
  ctx.fillStyle=secs<=10?'#ff4444':'#00ff88';
  ctx.shadowColor=ctx.fillStyle;
  ctx.fillText(secs+'s',CW-10,28);
  ctx.textAlign='center'; ctx.fillStyle='#00ff88'; ctx.shadowColor='#00ff88';
  ctx.font='20px serif';
  let lv='';
  for(let i=0;i<3;i++) lv+=(i<state.lives?'♩':'◦')+' ';
  ctx.fillText(lv.trim(),CW/2,28);
  ctx.restore();
}

function spawnFace(now,d){
  const used=new Set(state.active.filter(s=>s.state==='active'||s.state==='sinking').map(s=>s.holeIdx));
  const avail=HOLES.map((_,i)=>i).filter(i=>!used.has(i));
  if(!avail.length) return;
  const hi=avail[Math.floor(Math.random()*avail.length)];
  const isOpp=Math.random()<0.3;
  const pool=(isOpp?imgs.opps:imgs.friends).filter(Boolean);
  if(!pool.length) return;
  const img=pool[Math.floor(Math.random()*pool.length)];
  state.active.push({holeIdx:hi,img,isOpp,spawnTime:now,showDuration:d.sd,state:'active',hitTime:0,sinkStart:0});
}

function loop(now){
  if(state.phase!=='playing') return;
  const elapsed=now-state.startTime;
  if(TOTAL*1000-elapsed<=0){ endGame(true); return; }
  const d=diff(elapsed);
  if(now>=state.nextSpawn){
    if(state.active.filter(s=>s.state==='active').length<d.max) spawnFace(now,d);
    state.nextSpawn=now+d.si;
  }
  state.active=state.active.filter(s=>s.state!=='done');
  drawBg(); drawBands(); drawHoleBg();
  state.active.forEach(s=>drawFaceSlot(s,now));
  drawHoleRims(); drawHUD(elapsed);
  state.rafId=requestAnimationFrame(loop);
}

function handleClick(e){
  if(state.phase!=='playing') return;
  initAudio();
  const rect=canvas.getBoundingClientRect();
  const cx=(e.clientX-rect.left)*(CW/rect.width);
  const cy=(e.clientY-rect.top)*(CH/rect.height);
  for(let i=state.active.length-1;i>=0;i--){
    const s=state.active[i];
    if(s.state!=='active') continue;
    const h=HOLES[s.holeIdx];
    if(Math.hypot(cx-h.x,cy-h.y)<=h.r){
      if(s.isOpp){
        state.score++;
        s.state='hit-opp'; s.hitTime=performance.now();
        playBonk();
      } else {
        state.lives--;
        s.state='hit-friend'; s.hitTime=performance.now();
        playSad();
        if(state.lives<=0) setTimeout(()=>endGame(false),420);
      }
      break;
    }
  }
}

function startGame(){
  initAudio();
  state.lives=3; state.score=0; state.phase='playing';
  state.active=[]; state.startTime=performance.now();
  state.nextSpawn=state.startTime+600;
  document.getElementById('start-overlay').classList.add('hidden');
  document.getElementById('end-overlay').classList.add('hidden');
  requestAnimationFrame(loop);
}

function endGame(won){
  if(state.phase==='gameover'||state.phase==='win') return;
  state.phase=won?'win':'gameover';
  cancelAnimationFrame(state.rafId);
  const sc=state.score;
  document.getElementById('end-title').textContent=won?'TIME\'S UP!':'GAME OVER';
  document.getElementById('end-score').textContent=sc+' opp'+(sc!==1?'s':'')+' whacked';
  document.getElementById('end-msg').textContent=won
    ?(sc>=25?'NANKY IS UNSTOPPABLE!':sc>=15?'Nankicho delivers!':sc>=8?'Not bad, Nanky!':'Keep practicing!')
    :'Hands off the friends! Watch who you whack!';
  document.getElementById('end-overlay').classList.remove('hidden');
}

function resetGame(){
  cancelAnimationFrame(state.rafId);
  state.phase='start'; state.active=[];
  drawBg(); drawBands(); drawHoleBg(); drawHoleRims();
  document.getElementById('start-overlay').classList.remove('hidden');
  document.getElementById('end-overlay').classList.add('hidden');
}

window.addEventListener('load',async()=>{
  canvas=document.getElementById('canvas');
  canvas.width=CW; canvas.height=CH;
  ctx=canvas.getContext('2d');
  canvas.addEventListener('pointerdown',handleClick);
  const [o,f]=await Promise.all([preload(OPPS),preload(FRIENDS)]);
  imgs.opps=o; imgs.friends=f;
  drawBg(); drawBands(); drawHoleBg(); drawHoleRims();
  document.getElementById('play-btn').addEventListener('click',startGame);
  document.getElementById('replay-btn').addEventListener('click',startGame);
  document.getElementById('menu-btn').addEventListener('click',resetGame);
  document.getElementById('back-btn').addEventListener('click',()=>window.location.href='../index.html');
  document.getElementById('back-btn2').addEventListener('click',()=>window.location.href='../index.html');
});
})();

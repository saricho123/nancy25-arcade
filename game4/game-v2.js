(function(){
'use strict';

const OPPS    = ['assets/opp1.png','assets/opp2.png','assets/opp3.png'];
const FRIENDS = Array.from({length:13},(_,i)=>`assets/friend_${i+1}.png`);

const CW=480, CH=480;

// Single horizontal flute — 6 holes in one row
const FLUTE_Y1 = 238;   // flute top edge
const FLUTE_Y2 = 340;   // flute bottom edge
const HOLE_Y   = 289;   // hole center (slightly above flute centerline)
const HR       = 30;    // hole radius

const HOLES = (() => {
  const xs = [37, 118, 199, 280, 361, 443];
  return xs.map(x => ({ x, y: HOLE_Y, r: HR }));
})();

const TOTAL = 60;

let canvas, ctx;
const imgs = { opps: [], friends: [] };
let audioCtx = null;

const state = {
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
    img.onload=()=>res(img); img.onerror=()=>res(null); img.src=src;
  })));
}

function initAudio(){
  if(audioCtx) return;
  audioCtx=new(window.AudioContext||window.webkitAudioContext)();
}
function beep(f1,f2,dur,type,vol){
  if(!audioCtx) return;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.connect(g); g.connect(audioCtx.destination);
  o.type=type||'square';
  o.frequency.setValueAtTime(f1,audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(f2,audioCtx.currentTime+dur);
  g.gain.setValueAtTime(vol||0.25,audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+dur);
  o.start(); o.stop(audioCtx.currentTime+dur);
}
const playBonk=()=>beep(660,1100,0.18,'square',0.28);
const playSad =()=>beep(440,200, 0.45,'sine',  0.18);

function easeOut(t){return 1-(1-t)*(1-t);}
function easeIn(t){return t*t;}

function drawBg(){
  // Above flute: dark stage
  const bg=ctx.createLinearGradient(0,0,0,FLUTE_Y1);
  bg.addColorStop(0,'#060d06'); bg.addColorStop(1,'#091409');
  ctx.fillStyle=bg; ctx.fillRect(0,0,CW,FLUTE_Y1);
  // Below flute: dark floor
  ctx.fillStyle='#040804'; ctx.fillRect(0,FLUTE_Y2,CW,CH-FLUTE_Y2);
  // Musical notes
  ctx.save();
  ctx.fillStyle='rgba(0,180,80,0.055)'; ctx.font='26px serif';
  [[18,50],[95,40],[190,48],[295,42],[390,50],[450,36],
   [30,140],[140,155],[250,145],[370,152],[445,138]].forEach(([x,y],i)=>{
    ctx.fillText(['♩','♪','♫','♬','𝄞','♭'][i%6],x,y);
  });
  ctx.restore();
}

function drawFlute(){
  const W=CW, y1=FLUTE_Y1, y2=FLUTE_Y2, h=y2-y1;

  // Main tube body — silver metallic cylinder gradient
  const body=ctx.createLinearGradient(0,y1,0,y2);
  body.addColorStop(0,   '#c8cec8');
  body.addColorStop(0.06,'#eaecea');
  body.addColorStop(0.18,'#f5f6f5');
  body.addColorStop(0.40,'#dcdedd');
  body.addColorStop(0.62,'#b8bcb8');
  body.addColorStop(0.82,'#9aa09a');
  body.addColorStop(1,   '#787e78');
  ctx.fillStyle=body; ctx.fillRect(0,y1,W,h);

  // Top highlight edge
  const hi=ctx.createLinearGradient(0,y1,0,y1+14);
  hi.addColorStop(0,'rgba(255,255,255,0.6)');
  hi.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=hi; ctx.fillRect(0,y1,W,14);

  // Bottom shadow edge
  const sh=ctx.createLinearGradient(0,y2-10,0,y2);
  sh.addColorStop(0,'rgba(0,0,0,0)');
  sh.addColorStop(1,'rgba(0,0,0,0.35)');
  ctx.fillStyle=sh; ctx.fillRect(0,y2-10,W,10);

  // Fine engraved horizontal lines
  ctx.strokeStyle='rgba(50,70,50,0.15)'; ctx.lineWidth=0.5;
  for(let y=y1+20;y<y2-10;y+=10){
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }

  // Embouchure / mouthpiece block (left end) — cork-colored
  const mb=ctx.createLinearGradient(0,y1,0,y2);
  mb.addColorStop(0,'#a08060'); mb.addColorStop(0.5,'#c8a878'); mb.addColorStop(1,'#7a5a38');
  ctx.fillStyle=mb; ctx.fillRect(0,y1,38,h);
  // mouthpiece lip-plate
  const lp=ctx.createLinearGradient(0,y1,0,y1+h*0.55);
  lp.addColorStop(0,'#d8d0b0'); lp.addColorStop(1,'#a89870');
  ctx.fillStyle=lp;
  ctx.beginPath(); ctx.roundRect(3,y1+6,30,h*0.55,3); ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.roundRect(3,y1+6,30,h*0.55,3); ctx.stroke();

  // End joint / bell (right end)
  const ec=ctx.createLinearGradient(0,y1,0,y2);
  ec.addColorStop(0,'#c0c8c0'); ec.addColorStop(0.5,'#e0e4e0'); ec.addColorStop(1,'#8a908a');
  ctx.fillStyle=ec; ctx.fillRect(W-26,y1,26,h);
  ctx.strokeStyle='rgba(60,60,60,0.3)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(W-26,y1); ctx.lineTo(W-26,y2); ctx.stroke();
  // Decorative rings at right
  [W-22,W-18].forEach(rx=>{
    ctx.strokeStyle='rgba(80,80,80,0.4)'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(rx,y1+2); ctx.lineTo(rx,y2-2); ctx.stroke();
  });

  // Decorative key mechanism (between holes, purely visual)
  const midX=(HOLES[2].x+HOLES[3].x)/2;
  ctx.save();
  // Key cup (between holes 3&4)
  const kx=midX, ky=y1+h*0.85;
  const kg=ctx.createRadialGradient(kx-2,ky-2,2,kx,ky,10);
  kg.addColorStop(0,'#e0e0e0'); kg.addColorStop(1,'#888');
  ctx.beginPath(); ctx.arc(kx,ky,10,0,Math.PI*2); ctx.fillStyle=kg; ctx.fill();
  ctx.strokeStyle='rgba(0,0,0,0.3)'; ctx.lineWidth=1; ctx.stroke();
  // Key rod along bottom
  ctx.strokeStyle='rgba(150,150,150,0.6)'; ctx.lineWidth=3;
  ctx.beginPath(); ctx.moveTo(50,y2-14); ctx.lineTo(W-30,y2-14); ctx.stroke();
  ctx.restore();
}

function drawHoleBg(){
  HOLES.forEach(h=>{
    const hg=ctx.createRadialGradient(h.x,h.y-6,0,h.x,h.y,h.r);
    hg.addColorStop(0,'#141414'); hg.addColorStop(1,'#040404');
    ctx.beginPath(); ctx.arc(h.x,h.y,h.r,0,Math.PI*2);
    ctx.fillStyle=hg; ctx.fill();
  });
}

function drawHoleRims(){
  HOLES.forEach(h=>{
    ctx.save();
    ctx.beginPath();
    ctx.arc(h.x,h.y,h.r+9,0,Math.PI*2);
    ctx.arc(h.x,h.y,h.r,  0,Math.PI*2,true);
    const rim=ctx.createLinearGradient(h.x-h.r-9,h.y,h.x+h.r+9,h.y);
    rim.addColorStop(0,'#606060'); rim.addColorStop(0.3,'#d0d0d0');
    rim.addColorStop(0.7,'#b8b8b8'); rim.addColorStop(1,'#505050');
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
    const age=now-slot.spawnTime, tl=slot.showDuration-age;
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
    ctx.save(); ctx.globalAlpha=(1-t)*0.65;
    ctx.beginPath(); ctx.arc(h.x,h.y,r,0,Math.PI*2);
    ctx.fillStyle='#ffd700'; ctx.fill(); ctx.restore();

  } else if(slot.state==='hit-friend'){
    const t=(now-slot.hitTime)/360;
    if(t>=1){ slot.state='done'; return; }
    const shake=Math.sin(t*Math.PI*14)*7*(1-t);
    ctx.save(); ctx.globalAlpha=1-t; ctx.translate(shake,0);
    clipFace(slot,h,0); ctx.restore();
    ctx.save(); ctx.globalAlpha=(1-t)*0.55;
    ctx.beginPath(); ctx.arc(h.x,h.y,r,0,Math.PI*2);
    ctx.fillStyle='#ff2020'; ctx.fill(); ctx.restore();
  }
}

function clipFace(slot,h,yOff){
  if(!slot.img) return;
  const r=h.r, iw=slot.img.naturalWidth, ih=slot.img.naturalHeight;
  const scale=(r*2.3)/iw;
  const dw=iw*scale, dh=ih*scale;
  ctx.save();
  ctx.beginPath(); ctx.arc(h.x,h.y,r,0,Math.PI*2); ctx.clip();
  ctx.drawImage(slot.img, h.x-dw/2, h.y-dh*0.42+yOff, dw, dh);
  ctx.restore();
}

function drawHUD(elapsed){
  const secs=Math.max(0,TOTAL-Math.floor(elapsed/1000));
  ctx.save(); ctx.shadowBlur=10;
  ctx.font='13px "Press Start 2P",monospace';
  ctx.shadowColor='#00ff88'; ctx.fillStyle='#00ff88';
  ctx.textAlign='left'; ctx.fillText('SCORE '+state.score,10,28);
  ctx.textAlign='right';
  ctx.fillStyle=secs<=10?'#ff4444':'#00ff88'; ctx.shadowColor=ctx.fillStyle;
  ctx.fillText(secs+'s',CW-10,28);
  ctx.textAlign='center'; ctx.fillStyle='#00ff88'; ctx.shadowColor='#00ff88';
  ctx.font='20px serif';
  let lv=''; for(let i=0;i<3;i++) lv+=(i<state.lives?'♩':'◦')+' ';
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
  drawBg(); drawFlute(); drawHoleBg();
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
        state.score++; s.state='hit-opp'; s.hitTime=performance.now(); playBonk();
      } else {
        state.lives--; s.state='hit-friend'; s.hitTime=performance.now(); playSad();
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
    :'Hands off the friends!';
  document.getElementById('end-overlay').classList.remove('hidden');
}

function resetGame(){
  cancelAnimationFrame(state.rafId);
  state.phase='start'; state.active=[];
  drawBg(); drawFlute(); drawHoleBg(); drawHoleRims();
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
  drawBg(); drawFlute(); drawHoleBg(); drawHoleRims();
  document.getElementById('play-btn').addEventListener('click',startGame);
  document.getElementById('replay-btn').addEventListener('click',startGame);
  document.getElementById('menu-btn').addEventListener('click',resetGame);
  document.getElementById('back-btn').addEventListener('click',()=>window.location.href='../index.html');
  document.getElementById('back-btn2').addEventListener('click',()=>window.location.href='../index.html');
  if (window.self !== window.top) {
    const btn = document.getElementById('play-btn');
    if (btn) btn.style.display = 'none';
    setTimeout(() => { if (btn) btn.style.display = ''; }, 5000);
  }
});
})();

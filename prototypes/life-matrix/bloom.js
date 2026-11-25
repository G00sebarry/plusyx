// Only explicit click/tap/keyboard actions change the expanded direction.
const bloom={area:null,pinned:false,observer:null,layoutId:null,layoutArea:null};
let enlargedArea=null;
function showDirectionScale(pop,large){
 const grid=$('matrix'),center=pop.querySelector('.bloomCenter');
 pop.classList.toggle('enlarged',large);
 grid.classList.toggle('directionBehind',large);grid.inert=large;
 center.title=large?'Вернуться к главной сетке':'Развернуть направление';
 center.setAttribute('aria-label',center.textContent+' — '+center.title);
}
function toggleDirectionScale(){
 const pop=document.querySelector('.bloom:not([inert])');if(!pop)return;
 enlargedArea=enlargedArea===bloom.area?null:bloom.area;
 showDirectionScale(pop,enlargedArea!==null);
}
function bloomMotion(){return visualOptions.motion&&!matchMedia('(prefers-reduced-motion: reduce)').matches;}
function nextMosaicLayout(){
 const candidates=Array.from({length:8},(_,i)=>i).filter(i=>i!==bloom.layoutId);
 return candidates[Math.floor(Math.random()*candidates.length)];
}
function closeBloom(focus=false,animate=true){
 enlargedArea=null;
 const grid=$('matrix');if(grid){grid.inert=false;grid.classList.remove('directionBehind');}
 const a=bloom.area,pop=document.querySelector('.bloom');bloom.area=null;bloom.pinned=false;
 document.querySelector('#matrix')?.classList.remove('bloomActive');
 document.querySelector('#matrix')?.classList.remove('morphMap');
 document.querySelectorAll('#matrix>.directionTile').forEach(n=>{
  n.style.transform='';n.style.width='var(--base-cell)';n.style.height='var(--base-cell)';n.style.clipPath='';
  n.classList.remove('morphSource','mosaicPiece','mosaicCorner');n.querySelector('.mosaicOutline')?.remove();
 });
 document.querySelectorAll('#matrix [data-area]').forEach(b=>b.setAttribute('aria-expanded','false'));
 if(pop){pop.style.pointerEvents='none';pop.inert=true;if(animate&&bloomMotion()){const animation=pop.animate([{opacity:1,transform:'none'},{opacity:0,transform:pop.dataset.origin||'scale(.4)'}],{duration:620,easing:'cubic-bezier(.4,0,.2,1)'});animation.finished.then(()=>pop.remove()).catch(()=>pop.remove());}else pop.remove();}
 if(focus)document.querySelector(`#matrix [data-area="${a}"]`)?.focus({preventScroll:true});
}
function placeBloom(pop,anchor){
 const canvas=pop.parentElement,base=canvas.getBoundingClientRect(),grid=$('matrix'),g=grid.getBoundingClientRect();
 const size=g.width*.55;pop.style.width=size+'px';pop.style.height=size+'px';
 pop.style.setProperty('--full-side',g.width+'px');pop.style.setProperty('--expand-offset',(size-g.width)/2+'px');
 const x=g.x-base.x+(g.width-size)/2,y=g.y-base.y+(g.height-size)/2;
 pop.style.left=x+'px';pop.style.top=y+'px';
 pop.style.transformOrigin='center';
 const gap=parseFloat(getComputedStyle(grid).columnGap),cell=(g.width-gap*2)/3,a=Number(anchor.dataset.area),slot=slots[a];
 pop.dataset.origin=`translate(${g.x-base.x+(slot%3)*(cell+gap)+cell/2-x-size/2}px,${g.y-base.y+Math.floor(slot/3)*(cell+gap)+cell/2-y-size/2}px) scale(${cell/size*.65})`;
 const neighbors=[...grid.querySelectorAll(':scope>.directionTile')],others=neighbors.filter(n=>Number(n.querySelector('[data-area]').dataset.area)!==a);
 grid.style.setProperty('--base-cell',cell+'px');
 const unit=g.width,outer=4,seam=8,band=(unit-size)/2;
 // Seven pieces fill a frame: one rounded L, two right-side segments,
 // the upper-right corner and three bottom pieces. Areas encode no progress.
 let shapes=[
  {x:outer,y:outer,w:unit-band-seam/2-outer,h:unit-band-seam/2-outer,corner:true,labelY:(band-seam/2-outer)/2},
  {x:unit-band+seam/2,y:outer,w:band-seam/2-outer,h:band-seam/2-outer},
  {x:unit-band+seam/2,y:band+seam/2,w:band-seam/2-outer,h:size/2-seam},
  {x:unit-band+seam/2,y:unit/2+seam/2,w:band-seam/2-outer,h:size/2-seam},
  {x:unit-band+seam/2,y:unit-band+seam/2,w:band-seam/2-outer,h:band-seam/2-outer},
  {x:band+seam/2,y:unit-band+seam/2,w:size-seam,h:band-seam/2-outer},
  {x:outer,y:unit-band+seam/2,w:band-seam/2-outer,h:band-seam/2-outer}
 ];
 const turn=bloom.layoutId%4;
 if(bloom.layoutId>=4){
  const arm=band-seam/2-outer,cut=unit*.44;
  shapes=[
   {x:outer,y:outer,w:cut-seam/2-outer,h:arm},
   {x:cut+seam/2,y:outer,w:unit-outer-cut-seam/2,h:arm},
   {x:unit-band+seam/2,y:band+seam/2,w:arm,h:size-seam},
   {x:unit-band+seam/2,y:unit-band+seam/2,w:arm,h:arm},
   {x:band+seam/2,y:unit-band+seam/2,w:size-seam,h:arm},
   {x:outer,y:unit-band+seam/2,w:arm,h:arm},
   {x:outer,y:band+seam/2,w:arm,h:size-seam}
  ];
 }
 shapes=shapes.map(original=>{
  const shape={...original,turn};
  if(shape.corner){shape.labelX=shape.w/2;shape.labelY=(band-seam/2-outer)/2;}
  for(let t=0;t<turn;t++){
   const {x,y,w,h,labelX,labelY}=shape;
   Object.assign(shape,{x:unit-y-h,y:x,w:h,h:w});
   if(shape.corner){shape.labelX=h-labelY;shape.labelY=labelX;}
  }
  return shape;
 });
 // Direction identities keep their clockwise order even as the frame changes.
 const angle=shape=>Math.atan2(shape.y+(shape.corner?shape.labelY:shape.h/2)-unit/2,shape.x+(shape.corner?shape.labelX:shape.w/2)-unit/2);
 shapes.sort((a,b)=>angle(a)-angle(b));
 pop.dataset.layout=bloom.layoutId;
 // Read neighbors clockwise, keeping their cyclic order around the goal.
 const clockwise=[0,1,2,4,7,6,5,3];others.sort((u,v)=>clockwise.indexOf(Number(u.querySelector('[data-area]').dataset.area))-clockwise.indexOf(Number(v.querySelector('[data-area]').dataset.area)));
 canvas.querySelector('.mosaicDefs')?.remove();
 const ns='http://www.w3.org/2000/svg',defsSvg=document.createElementNS(ns,'svg');defsSvg.classList.add('mosaicDefs');defsSvg.setAttribute('width','0');defsSvg.setAttribute('height','0');defsSvg.setAttribute('aria-hidden','true');canvas.append(defsSvg);
 neighbors.forEach(n=>{
  const id=Number(n.querySelector('[data-area]').dataset.area),s=slots[id],oldX=(s%3)*(cell+gap),oldY=Math.floor(s/3)*(cell+gap);
  const index=others.indexOf(n);n.classList.toggle('morphSource',id===a);
  n.querySelector('.mosaicOutline')?.remove();n.style.clipPath='';n.classList.remove('mosaicCorner');
  if(id===a){n._mosaicShape=null;n.classList.remove('mosaicPiece');n.style.width=cell+'px';n.style.height=cell+'px';n.style.transform=`translate(${g.width/2-oldX-cell/2}px,${g.height/2-oldY-cell/2}px) scale(.6)`;return;}
  const shape=shapes[index];n._mosaicShape={...shape,arm:band-seam/2-outer};n.classList.add('mosaicPiece');n.style.width=shape.w+'px';n.style.height=shape.h+'px';
  n.style.setProperty('--drift-x',(shape.x+shape.w/2-unit/2)*.15+'px');
  n.style.setProperty('--drift-y',(shape.y+shape.h/2-unit/2)*.15+'px');
  n.style.transformOrigin='0 0';n.style.transform=`translate(${shape.x-oldX}px,${shape.y-oldY}px)`;
  if(shape.corner){
   n.classList.add('mosaicCorner');n.style.setProperty('--label-y',shape.labelY+'px');n.style.setProperty('--label-x',shape.labelX+'px');n.style.setProperty('--label-width',(shape.turn%2?band-seam-20:shape.w-24)+'px');
   const arm=band-seam/2-outer,r=Math.min(18,arm/4),w=shape.w,h=shape.h;
   const d=`M ${r} 0 H ${w-r} Q ${w} 0 ${w} ${r} V ${arm-r} Q ${w} ${arm} ${w-r} ${arm} H ${arm+r} Q ${arm} ${arm} ${arm} ${arm+r} V ${h-r} Q ${arm} ${h} ${arm-r} ${h} H ${r} Q 0 ${h} 0 ${h-r} V ${r} Q 0 0 ${r} 0 Z`;
   const clip=document.createElementNS(ns,'clipPath');clip.id='mosaic-corner';clip.setAttribute('clipPathUnits','objectBoundingBox');const path=document.createElementNS(ns,'path');path.setAttribute('d',d);path.setAttribute('transform',`scale(${1/w} ${1/h}) rotate(${shape.turn*90} ${w/2} ${h/2})`);clip.append(path);defsSvg.append(clip);n.style.clipPath='url(#mosaic-corner)';
   const outline=document.createElementNS(ns,'svg');outline.classList.add('mosaicOutline');outline.setAttribute('viewBox',`0 0 ${w} ${h}`);outline.setAttribute('preserveAspectRatio','none');const stroke=document.createElementNS(ns,'path');stroke.setAttribute('d',d);stroke.setAttribute('transform',`rotate(${shape.turn*90} ${w/2} ${h/2})`);outline.append(stroke);n.append(outline);
  }
 });
 grid.classList.add('morphMap');grid.style.setProperty('--backdrop-scale',String(g.width/cell));
}
function openBloom(a,pinned=true,animate=true,restore=false){
 const anchor=document.querySelector(`#matrix [data-area="${a}"]`);if(!anchor||!state.areas[a]?.title)return;
 if(bloom.area===a&&document.querySelector('.bloom:not([inert])')){bloom.pinned ||= pinned;return;}
 const sourceRect=anchor.getBoundingClientRect();
 if(!restore||bloom.layoutId===null||bloom.layoutArea!==a)bloom.layoutId=nextMosaicLayout();
 bloom.layoutArea=a;
 const large=restore&&enlargedArea===a;
 closeBloom(false,false);bloom.area=a;bloom.pinned=true;if(large)enlargedArea=a;
 const d=state.areas[a],canvas=document.querySelector('.canvas'),pop=el('section',undefined,'bloom');pop.setAttribute('aria-label','Карточки направления '+d.title);
 pop.style.setProperty('--accent',d.color);
 for(let j=0;j<9;j++){
  const k=slots.indexOf(j);
  if(j===4){const center=tile(d.title,'center bloomCenter',()=>enlargedArea===a?closeBloom(true):toggleDirectionScale(),d.color);paint(center,appearance(d));pop.append(center);}
  else{const c=d.cards[k];const b=tile(c.title,(c.title?'':'empty')+(c.status==='done'?' done':''),()=>{
   if(selected.kind==='card'&&selected.a===a&&selected.k===k)return;
   bloom.pinned=true;syncSelectionPanel({kind:'card',a,k});b.classList.add('selected');
  },d.color,c.title?cardSummary(c):'');b.dataset.card=k;
  if(visualOptions.scope==='all')paint(b,appearance(c));if(selected.kind==='card'&&selected.a===a&&selected.k===k)b.classList.add('selected');pop.append(b);}
 }
 pop.onfocusin=()=>{bloom.pinned=true;};
 showDirectionScale(pop,large);
 canvas.append(pop);placeBloom(pop,anchor);document.querySelector('#matrix').classList.add('bloomActive');anchor.setAttribute('aria-expanded','true');
 if(animate&&bloomMotion()&&window.gsap){
  const r=pop.getBoundingClientRect();
  const dx=sourceRect.x+sourceRect.width/2-r.x-r.width/2,dy=sourceRect.y+sourceRect.height/2-r.y-r.height/2;
  gsap.timeline({defaults:{ease:'power3.inOut'}})
   .fromTo(pop,{x:dx,y:dy,scale:sourceRect.width/r.width*.65,opacity:0,borderRadius:'48px'},{x:0,y:0,scale:1,opacity:1,borderRadius:'24px',duration:.78,clearProps:'transform,opacity,borderRadius'})
   .fromTo([...pop.querySelectorAll('[data-card]')],{scale:.82,opacity:0,borderRadius:'30px'},{scale:1,opacity:1,borderRadius:'15px',duration:.5,stagger:.018,ease:'power3.out',clearProps:'transform,opacity,borderRadius'},.18);
  animate=false;
 }
 if(animate&&bloomMotion()){
  const destination=pop.getBoundingClientRect(),start=`translate(${sourceRect.x+sourceRect.width/2-destination.x-destination.width/2}px,${sourceRect.y+sourceRect.height/2-destination.y-destination.height/2}px) scale(${sourceRect.width/destination.width*.65})`;
  pop.animate([{opacity:0,transform:start,borderRadius:'38px'},{opacity:1,transform:'scale(1.018)',offset:.84,borderRadius:'25px'},{opacity:1,transform:'none',borderRadius:'28px'}],{duration:760,easing:'cubic-bezier(.22,.7,.23,1)'});
  [...pop.querySelectorAll('[data-card]')].forEach((n,i)=>{const rect=n.getBoundingClientRect(),r=pop.getBoundingClientRect();n.animate([{opacity:0,transform:`translate(${r.x+r.width/2-rect.x-rect.width/2}px,${r.y+r.height/2-rect.y-rect.height/2}px) scale(.5)`},{opacity:1,transform:'none'}],{duration:480,delay:i*14,easing:'cubic-bezier(.16,.8,.25,1)',fill:'backwards'});});
 }
}
function attachBloom(){
 bloom.observer?.disconnect();
 const canvas=document.querySelector('.canvas');if(!canvas)return;
 const controls=canvas.querySelector('.mapControls'),random=button('',suggestAction,'randomAction');
 random.title='Выбрать дело';random.setAttribute('aria-label','Выбрать дело');
 random.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r=".8"/><circle cx="16" cy="8" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="8" cy="16" r=".8"/><circle cx="16" cy="16" r=".8"/></svg>';
 controls.append(random);
 if(view!=='home'){closeBloom(false,false);return;}
 canvas.classList.add('bloomCanvas');
 for(const b of document.querySelectorAll('#matrix [data-area]')){
  const a=Number(b.dataset.area);if(!state.areas[a].title)continue;
  b.onclick=()=>{if(bloom.area===a&&bloom.pinned)closeBloom(true);else openBloom(a,true);};
  b.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();openBloom(a,true);document.querySelector('.bloom button')?.focus();}};
 }
 if(bloom.area!==null){canvas.classList.add('morphRestoring');openBloom(bloom.area,true,false,true);requestAnimationFrame(()=>requestAnimationFrame(()=>canvas.classList.remove('morphRestoring')));}
 bloom.observer=new ResizeObserver(()=>{const pop=document.querySelector('.bloom:not([inert])'),anchor=document.querySelector(`#matrix [data-area="${bloom.area}"]`);if(pop&&anchor)placeBloom(pop,anchor);else if(typeof refreshLiquidClosed==='function')refreshLiquidClosed();});bloom.observer.observe(canvas);
}
document.addEventListener('pointerdown',e=>{if(bloom.area!==null&&!e.target.closest('.bloom, #matrix [data-area], aside, #crumb, .mapControls, .tabs'))closeBloom();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&bloom.area!==null&&!document.querySelector('dialog[open]')){e.preventDefault();if(enlargedArea!==null){toggleDirectionScale();document.querySelector('.bloomCenter')?.focus({preventScroll:true});}else closeBloom(true);}});
function actionCandidates(){
 const found=[],seen=new Set();state.areas.forEach((a,ai)=>a.cards.forEach((c,k)=>{
  if(!a.title||!c.title||['done','pause'].includes(c.status))return;
  c.checklist.filter(s=>!s.done).forEach(s=>found.push({a:ai,k,title:s.text,type:'Шаг',id:s.id}));
  c.taskIds.forEach(id=>{const t=state.tasks.find(t=>t.id===id);if(t&&t.status!=='done'&&!seen.has(id)){seen.add(id);found.push({a:ai,k,title:t.title,type:'Задача',id});}});
 }));return found;
}
let lastSuggestion=null;
function suggestAction(){
 let options=actionCandidates();if(!options.length){notice('Пока нечего предложить: добавь незавершённый шаг или свяжи задачу с карточкой.');return;}
 if(options.length>1)options=options.filter(o=>o.id!==lastSuggestion);
 const pick=options[Math.floor(Math.random()*options.length)];lastSuggestion=pick.id;
 document.querySelector('.suggestion')?.remove();const box=el('dialog',undefined,'suggestion');
 box.append(el('p','МОЖНО ПОПРОБОВАТЬ','eyebrow'),el('h2',pick.title),el('p',`${state.areas[pick.a].title} → ${state.areas[pick.a].cards[pick.k].title} · ${pick.type}`));
 const actions=el('div',undefined,'buttons');
 actions.append(button('Открыть карточку',()=>{box.close();box.remove();view='home';bloom.area=pick.a;bloom.pinned=true;selected={kind:'card',a:pick.a,k:pick.k};render();},'primary'),button('Другой вариант',()=>{box.close();box.remove();suggestAction();}),button('Не сейчас',()=>{box.close();box.remove();}));box.append(actions);document.body.append(box);box.addEventListener('close',()=>box.remove());box.showModal();
}

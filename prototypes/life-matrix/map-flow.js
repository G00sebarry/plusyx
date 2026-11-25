// Map overview: each group expands from / contracts into its own direction.
let overviewTween=null,overviewLayer=null,overviewTargets=[],overviewDetails=[];
function clearOverviewFlow(){
 overviewTween?.kill();overviewTween=null;overviewLayer?.remove();overviewLayer=null;
 if(window.gsap)gsap.set(overviewTargets,{clearProps:'transform,opacity,transformOrigin'});
 if(window.gsap&&overviewDetails.length)gsap.set(overviewDetails,{clearProps:'transform,opacity'});
 overviewDetails=[];
 overviewTargets=[];
}
function mapRepresentatives(){
 const grid=$('matrix');if(!grid)return [];
 if(view==='all')return [...grid.querySelectorAll(':scope > .group')];
 if(view==='home')return [...grid.children].filter(n=>n.matches('.directionTile,.center'));
 return [];
}
const previousTravel=travel;
let overviewReturn=null;
travel=function(next,a){
 if(next==='area'){
  overviewReturn=null;
  clearOverviewFlow();liquidStop();
  view='home';areaIndex=a??areaIndex;selected={kind:'area',a:areaIndex};bloom.area=null;
  render();openBloom(areaIndex,true);return;
 }
 if(!['all','home'].includes(next)||!['all','home'].includes(view)||next===view)return previousTravel(next,a);
 clearOverviewFlow();liquidTimeline?.progress(1);liquidStop();
 const enteringLarge=next==='all'&&enlargedArea!==null;
 if(next==='all'&&!enteringLarge)overviewReturn=null;
 const returningLarge=next==='home'&&overviewReturn!==null;
 if(enteringLarge||returningLarge){
  if(enteringLarge)overviewReturn={area:enlargedArea,layout:bloom.layoutId,selection:{...selected}};
  const saved=overviewReturn,groupIndex=slots[saved.area];
  const group=()=>$('matrix').querySelectorAll(':scope > .group')[groupIndex];
  const start=(enteringLarge?document.querySelector('.bloom'):group()).getBoundingClientRect();
  view=next;
  if(enteringLarge){bloom.area=enlargedArea=null;selected={kind:'goal'};}
  else{bloom.area=enlargedArea=bloom.layoutArea=saved.area;bloom.layoutId=saved.layout;selected=saved.selection;overviewReturn=null;}
  render();
  const target=enteringLarge?group():document.querySelector('.bloom');
  if(bloomMotion()&&target){
   const end=target.getBoundingClientRect();
   target.animate([{transformOrigin:'0 0',transform:`translate(${start.x-end.x}px,${start.y-end.y}px) scale(${start.width/end.width})`},{transformOrigin:'0 0',transform:'none'}],{duration:620,easing:'cubic-bezier(.4,0,.2,1)'});
  }
  return;
 }
 const fromView=view,source=mapRepresentatives().map(n=>({rect:n.getBoundingClientRect(),clone:n.cloneNode(true)}));
 view=next;selected={kind:'goal'};bloom.area=null;render();
 if(!bloomMotion()||!window.gsap||source.length!==9)return;
 const targets=overviewTargets=mapRepresentatives();
 const layer=overviewLayer=el('div',undefined,'mapFlightLayer '+(fromView==='all'?'overview':''));layer.setAttribute('aria-hidden','true');layer.inert=true;document.body.append(layer);
 const tl=overviewTween=gsap.timeline({defaults:{duration:1.3,ease:'power2.inOut'},onComplete:clearOverviewFlow});
 targets.forEach((target,i)=>{
  const end=target.getBoundingClientRect(),start=source[i].rect;
  const delay=.18+i*.018;
  const targetLabels=[...target.querySelectorAll('.cell > span,.cell > small'),...(target.matches('.cell')?[...target.querySelectorAll(':scope > span,:scope > small')]:[])];
  overviewDetails.push(...targetLabels,...target.querySelectorAll('.cell'));
  tl.fromTo(targetLabels,{opacity:0},{opacity:1,duration:.24,ease:'power1.out'},delay+1.08);
  if(next==='all'){
   const cells=[...target.querySelectorAll('.cell')],center=cells[4].getBoundingClientRect();
   cells.forEach((cell,j)=>{if(j===4)return;const r=cell.getBoundingClientRect();tl.fromTo(cell,{x:center.x+center.width/2-r.x-r.width/2,y:center.y+center.height/2-r.y-r.height/2,scale:.08},{x:0,y:0,scale:1,duration:.48,ease:'power3.out',clearProps:'transform'},delay+.18+Math.abs(j-4)*.012);});
  }
  // Child grids grow as a unit around their corresponding main tile.
  tl.fromTo(target,{x:start.x-end.x,y:start.y-end.y,scaleX:start.width/end.width,scaleY:start.height/end.height,transformOrigin:'0 0',opacity:0},
   {x:0,y:0,scaleX:1,scaleY:1,opacity:1,clearProps:'transform,opacity,transformOrigin'},delay);
  const proxy=el('div',undefined,'mapFlight');Object.assign(proxy.style,{left:start.x+'px',top:start.y+'px',width:start.width+'px',height:start.height+'px'});
  const clone=source[i].clone;clone.querySelectorAll('svg').forEach(n=>n.remove());
  [clone,...clone.querySelectorAll('*')].forEach(n=>{n.removeAttribute('id');n.removeAttribute('tabindex');});
  for(const prop of ['transform','clipPath','opacity','width','height'])clone.style[prop]='';
  clone.querySelectorAll('.cell > span').forEach(n=>{n.style.left='';n.style.top='';n.style.width='';});
  clone.classList.remove('morphSource','mosaicCorner','mosaicPiece');proxy.append(clone);layer.append(proxy);
  tl.to(clone.querySelectorAll('.cell > span,.cell > small'),{opacity:0,duration:.16,ease:'power1.out'},0);
  if(next==='home'){const cells=[...clone.querySelectorAll('.cell')],center=cells[4]?.getBoundingClientRect();if(center)cells.forEach((cell,j)=>{if(j===4)return;const r=cell.getBoundingClientRect();tl.to(cell,{x:center.x+center.width/2-r.x-r.width/2,y:center.y+center.height/2-r.y-r.height/2,scale:.04,duration:.85,ease:'power2.inOut'},delay);});}
  codiumFlow(proxy,tl,delay,next==='all',i);
  tl.to(proxy,{x:end.x-start.x,y:end.y-start.y,scaleX:end.width/start.width,scaleY:end.height/start.height,transformOrigin:'0 0'},delay);
  tl.to(proxy,{opacity:0,duration:.25,ease:'power1.inOut'},delay+1.05);
 });
};
window.addEventListener('resize',()=>{if(overviewTween)overviewTween.progress(1);});
// An interrupted navigation must never leave a visual proxy over the app.
const beforeFlowRender=render;
render=function(){
 clearOverviewFlow();liquidStop();
 // Breadcrumbs and board links also use the same modern direction view.
 if(view==='area'){view='home';bloom.area=areaIndex;bloom.pinned=true;}
 return beforeFlowRender();
};

// A quiet bidirectional glow, inspired by Magic UI Animated Beam's opposing flow.
// Decorative only: it does not represent task completion or data transfer.
let energyObserver=null;
function attachEnergy(){
 energyObserver?.disconnect();
 const layout=document.querySelector('.functionalLayout'),grid=$('matrix'),panel=layout?.querySelector('aside');if(!layout||!grid||!panel)return;
 layout.querySelector('.energyBridge')?.remove();
 const bridge=el('div',undefined,'energyBridge');bridge.setAttribute('aria-hidden','true');
 const field=el('div',undefined,'lavaField');
 for(let i=0;i<4;i++){const blob=el('i',undefined,'lavaBlob');blob.style.setProperty('--blob-index',i);field.append(blob);}
 bridge.append(field);layout.append(bridge);
 const fit=()=>{
  const base=layout.getBoundingClientRect(),g=grid.getBoundingClientRect(),p=panel.getBoundingClientRect();
  const mobile=matchMedia('(max-width:800px)').matches;
  bridge.classList.toggle('vertical',mobile);
  const color=state.areas[selected.a??bloom.area]?.color||'#b89edb';bridge.style.setProperty('--energy-a',color);bridge.style.setProperty('--energy-b','#83b7de');
  // Confine paint to the actual gap. A soft mask fades before either panel edge.
  const panelLeft=panel.offsetLeft,panelTop=panel.offsetTop;
  Object.assign(bridge.style,mobile?{left:g.x-base.x+g.width*.1+'px',top:g.bottom-base.y+2+'px',width:g.width*.8+'px',height:Math.max(0,panelTop-(g.bottom-base.y)-4)+'px'}:{left:g.right-base.x+2+'px',top:g.top-base.y+g.height*.06+'px',width:Math.max(0,panelLeft-(g.right-base.x)-4)+'px',height:g.height*.88+'px'});
 };
 energyObserver=new ResizeObserver(fit);energyObserver.observe(layout);energyObserver.observe(panel);requestAnimationFrame(fit);
}
const beforeEnergyDecorate=decorateMatrix;
decorateMatrix=function(){beforeEnergyDecorate();attachEnergy();};

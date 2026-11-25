// One geometry timeline, sampled from the current frame on every interruption.
// SVG paths share six rounded vertices, allowing real contour interpolation.
const liquidLegacy={open:openBloom,close:closeBloom,place:placeBloom,attach:attachBloom};
let liquidTimeline=null,liquidInternal=false,liquidWidth=0;
const liquidNS='http://www.w3.org/2000/svg';
function liquidPath(w,h,shape){
 let points=shape?.corner?[[0,0],[w,0],[w,shape.arm],[shape.arm,shape.arm],[shape.arm,h],[0,h]]:[[0,0],[w,0],[w,h/2],[w,h],[w/2,h],[0,h]];
 if(shape?.corner)for(let i=0;i<shape.turn;i++)points=points.map(([x,y])=>[w-y,x]);
 // Keep the same clockwise starting corner across rotations.
 const start=points.reduce((best,p,i)=>p[0]+p[1]<points[best][0]+points[best][1]?i:best,0);
 points=[...points.slice(start),...points.slice(0,start)];
 const rounded=points.map((p,i)=>{
  const prev=points[(i+5)%6],next=points[(i+1)%6];
  const before=Math.hypot(prev[0]-p[0],prev[1]-p[1]),after=Math.hypot(next[0]-p[0],next[1]-p[1]);
  const r=Math.min(18,before/2,after/2);
  const toward=(q,length)=>[p[0]+(q[0]-p[0])*r/(length||1),p[1]+(q[1]-p[1])*r/(length||1)];
  return [toward(prev,before),p,toward(next,after)];
 });
 const xy=p=>`${(p[0]/w).toFixed(6)} ${(p[1]/h).toFixed(6)}`;
 return `M ${xy(rounded[0][0])} `+rounded.map(([a,b,c])=>`L ${xy(a)} Q ${xy(b)} ${xy(c)}`).join(' ')+' Z';
}
function liquidClip(n,shape){
 const canvas=n.closest('.canvas');let defs=canvas.querySelector('.liquidDefs');
 if(!defs){defs=document.createElementNS(liquidNS,'svg');defs.classList.add('liquidDefs');defs.setAttribute('width',0);defs.setAttribute('height',0);defs.setAttribute('aria-hidden','true');canvas.append(defs);}
 const id='liquid-clip-'+n.querySelector('[data-area]').dataset.area;
 let clip=defs.querySelector('#'+id);
 if(!clip){clip=document.createElementNS(liquidNS,'clipPath');clip.id=id;clip.setAttribute('clipPathUnits','objectBoundingBox');clip.append(document.createElementNS(liquidNS,'path'));defs.append(clip);}
 let outline=n.querySelector('.liquidOutline');
 if(!outline){outline=document.createElementNS(liquidNS,'svg');outline.classList.add('liquidOutline');outline.setAttribute('viewBox','0 0 1 1');outline.setAttribute('preserveAspectRatio','none');outline.setAttribute('aria-hidden','true');outline.append(document.createElementNS(liquidNS,'path'));n.append(outline);}
 const w=parseFloat(getComputedStyle(n).width),h=parseFloat(getComputedStyle(n).height),d=liquidPath(w,h,shape);
 clip.firstChild.setAttribute('d',d);outline.firstChild.setAttribute('d',d);n.style.clipPath=`url(#${id})`;
 n._liquidPaths=[clip.firstChild,outline.firstChild];
 n.querySelector('.mosaicOutline')?.remove();
 const label=n.querySelector('.cell > span');
 label.style.left=(shape?.corner?shape.labelX:w/2)+'px';label.style.top=(shape?.corner?shape.labelY:h/2)+'px';
 label.style.width=(shape?.corner?(shape.turn%2?shape.arm-16:w-24):w-16)+'px';
}
function liquidSnapshot(){
 return [...document.querySelectorAll('#matrix > .directionTile, #matrix > .center')].map(n=>{
  const s=getComputedStyle(n),label=n.querySelector('.cell > span'),ls=label&&getComputedStyle(label);
  return {n,transform:s.transform,width:s.width,height:s.height,opacity:s.opacity,path:n._liquidPaths?.[0].getAttribute('d'),label:label&&{left:ls.left,top:ls.top,width:ls.width}};
 });
}
function liquidStop(){liquidTimeline?.kill();liquidTimeline=null;}
function liquidReset(){
 document.querySelectorAll('#matrix > .directionTile').forEach(n=>{n.style.opacity='';});
 const center=document.querySelector('#matrix > .center');if(center)for(const p of ['transform','width','height','opacity'])center.style[p]='';
}
function liquidAnimate(before,opening,pop){
 if(!bloomMotion()||!window.gsap)return;
 const tl=liquidTimeline=gsap.timeline({defaults:{duration:.95,ease:'power2.inOut'},onComplete:()=>{if(!opening)refreshLiquidClosed(true);}});
 for(const old of before){
  const n=old.n;if(!n.isConnected)continue;
  const s=getComputedStyle(n),target={transform:s.transform,width:s.width,height:s.height,opacity:s.opacity};
  if(n.classList.contains('directionTile'))tl.fromTo(n,{transform:old.transform,width:old.width,height:old.height,opacity:old.opacity},{...target,overwrite:true},0);
  else tl.fromTo(n,{transform:old.transform,opacity:old.opacity},{transform:target.transform,opacity:target.opacity,overwrite:true},0);
  if(n._liquidPaths){
   const end=n._liquidPaths[0].getAttribute('d');
   for(const p of n._liquidPaths)tl.fromTo(p,{attr:{d:old.path||liquidPath(parseFloat(old.width),parseFloat(old.height))}},{attr:{d:end}},0);
   const label=n.querySelector('.cell > span');
   if(old.label)tl.fromTo(label,old.label,{left:label.style.left,top:label.style.top,width:label.style.width},0);
  }
 }
 if(pop){
  // The central space opens in place, not from an arbitrary edge of the screen.
  if(!opening&&pop.classList.contains('enlarged')){
   const rect=pop.getBoundingClientRect(),grid=$('matrix').getBoundingClientRect();
   const slot=slots[bloom.layoutArea],gap=parseFloat(getComputedStyle($('matrix')).columnGap),side=(grid.width-2*gap)/3;
   tl.to(pop,{x:grid.left+(slot%3)*(side+gap)+side/2-rect.left-rect.width/2,y:grid.top+Math.floor(slot/3)*(side+gap)+side/2-rect.top-rect.height/2,scale:side/rect.width,duration:.86},0);
   tl.to(pop,{opacity:0,duration:.36,onComplete:()=>pop.remove()},.5);
  }else tl.fromTo(pop,{scale:opening?.94:1,opacity:opening?0:1},{scale:opening?1:.94,opacity:opening?1:0,duration:.5,clearProps:opening?'transform,opacity':'',onComplete:()=>{if(!opening)pop.remove();}},opening?.22:0);
  if(opening)tl.fromTo([...pop.children],{opacity:0,scale:.96},{opacity:1,scale:1,duration:.42,stagger:.012,clearProps:'transform,opacity'},.3);
 }

}
placeBloom=function(pop,anchor){
 const width=$('matrix').getBoundingClientRect().width;
 if(!liquidInternal&&liquidTimeline?.isActive()){
  if(Math.abs(width-liquidWidth)<.5)return;
  liquidTimeline.progress(1);liquidStop();
 }
 liquidWidth=width;liquidLegacy.place(pop,anchor);
 document.querySelectorAll('#matrix > .directionTile').forEach(n=>liquidClip(n,n._mosaicShape));
};
openBloom=function(a,pinned=true,animate=true,restore=false){
 if(bloom.area===a&&document.querySelector('.bloom:not([inert])'))return;
 if(!state.areas[a]?.title)return;
 const before=liquidSnapshot();liquidStop();liquidInternal=true;
 try{liquidLegacy.open(a,pinned,false,restore);}finally{liquidInternal=false;}
 if(animate)liquidAnimate(before,true,document.querySelector('.bloom:not([inert])'));
 if(!restore&&typeof syncSelectionPanel==='function')syncSelectionPanel({kind:'area',a});
};
closeBloom=function(focus=false,animate=true){
 if(liquidInternal){liquidLegacy.close(focus,false);liquidReset();return;}
 const before=liquidSnapshot(),pop=document.querySelector('.bloom:not([inert])');liquidStop();
 // Detach only while legacy resets layout, then let the old content dissolve in place.
 if(pop)pop.remove();liquidLegacy.close(focus,false);liquidReset();
 document.querySelectorAll('#matrix > .directionTile').forEach(n=>liquidClip(n,null));
 if(pop&&animate&&bloomMotion()){pop.inert=true;pop.style.pointerEvents='none';document.querySelector('.canvas')?.append(pop);}
 if(animate)liquidAnimate(before,false,pop?.isConnected?pop:null);
 if(animate&&typeof syncSelectionPanel==='function')syncSelectionPanel({kind:'goal'});
};
attachBloom=function(){
 if(view==='home')document.querySelectorAll('#matrix > .directionTile').forEach(n=>liquidClip(n,null));
 liquidLegacy.attach();
};
function refreshLiquidClosed(force=false){
 if(bloom.area!==null||(!force&&liquidTimeline?.isActive()))return;
 document.querySelectorAll('#matrix > .directionTile').forEach(n=>{for(const p of ['width','height','transform','opacity'])n.style[p]='';liquidClip(n,null);});
}
document.documentElement.classList.add('liquidMatrix');

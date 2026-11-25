// Adapted from Codrops OrganicShapeAnimations, first specimen (2017).
// Original paths/timing; GSAP replaces Anime.js to share our interruption lifecycle.
function codiumVariant(path,index){
 // Stable direction-specific deformation of Codium's cubic control points.
 const angles=[-14,8,-7,16,0,-11,12,-18,5],angle=angles[index]*Math.PI/180;
 const sx=[.94,1.03,.9,1,.96,1.04,.92,1.02,.95][index],sy=[1.02,.92,1.04,.94,1,.9,1.03,.94,1.02][index];
 let x;
 return path.replace(/-?\d*\.?\d+/g,(number,offset)=>{
  if(x===undefined){x=Number(number);return '@';}
  const y=Number(number),dx=(x-250)*sx,dy=(y-250)*sy;
  const pair=`${(250+dx*Math.cos(angle)-dy*Math.sin(angle)).toFixed(3)},${(250+dx*Math.sin(angle)+dy*Math.cos(angle)).toFixed(3)}`;
  x=undefined;return pair;
 }).replace(/@[, ]*/g,'');
}
function codiumFlow(proxy,tl,delay,opening,index){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 svg.setAttribute('width','0');svg.setAttribute('height','0');svg.style.position='absolute';
 const clip=document.createElementNS(ns,'clipPath');clip.id='codium-flow-'+index;clip.setAttribute('clipPathUnits','objectBoundingBox');
 const path=document.createElementNS(ns,'path');path.setAttribute('transform','scale(.002)');
 // Seven cubic segments, matching Codium's topology, begin as a full tile.
 const square='M 0,0 C 166,0 333,0 500,0 C 500,83 500,166 500,250 C 500,333 500,416 500,500 C 416,500 333,500 250,500 C 166,500 83,500 0,500 C 0,416 0,333 0,250 C 0,166 0,83 0,0 Z';
 path.setAttribute('d',square);clip.append(path);svg.append(clip);proxy.append(svg);proxy.style.clipPath=`url(#${clip.id})`;
 const first=codiumVariant(opening?codiumPaths.start:codiumPaths.end,index),last=codiumVariant(opening?codiumPaths.end:codiumPaths.start,index);
 const morphDuration=.72+(index%5)*.035;
 tl.to(path,{attr:{d:first},duration:.2,ease:'power1.out'},delay)
   .to(path,{attr:{d:last},duration:morphDuration,ease:'power2.inOut'},delay+.2)
   .to(path,{attr:{d:square},duration:1.1-morphDuration,ease:'power2.out'},delay+.2+morphDuration);
 // Counter-motion of the artwork preserves the reference's independent image layer.
 const images=proxy.querySelectorAll('.coverImage');
 images.forEach(img=>{
  const initial=getComputedStyle(img).transform;
  tl.to(img,{scale:1.2,rotation:opening?-5:5,x:opening?-4:4,y:opening?-9:9,duration:.8,ease:'power3.inOut'},delay+.2)
    .to(img,{transform:initial,duration:.3,ease:'power2.out'},delay+1);
 });
}

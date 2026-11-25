// Local development UI. All edits remain in the prototype's in-memory model.
// Appearance entrance adapts Magic UI Blur Fade's offset/opacity/blur pattern.
const legacyCompactEditor=compactEditor, legacyDecorate=decorateMatrix;
let studioObserver, panelTween, lastPanelKey=null;
function studioObject(){return selected.kind==='card'?current():selected.kind==='area'?state.areas[selected.a]:state;}
function syncSelectionPanel(selection){
 selected=selection;
 const old=document.querySelector('.studioPanel');if(!old)return;
 document.querySelectorAll('#matrix .selected,.bloom .selected').forEach(n=>n.classList.remove('selected'));
 old.replaceWith(compactEditor(renderEditor()));
 renderCrumbs();decorateMatrix();
}
function syncStudioMap(){
 const update=(node,obj,parent)=>{if(!node||!obj)return;node.querySelector(':scope > span').textContent=obj.title||'+';node.title=obj.title||'Добавить';node.setAttribute('aria-label',obj.title||'Добавить');paint(node,appearance(obj,parent));};
 const groups=view==='all'?[...$('matrix').querySelectorAll('.group')]:[$('matrix')];
 groups.forEach((group,idx)=>{const a=view==='all'?(idx===4?null:slots.indexOf(idx)):view==='home'?null:areaIndex;
  [...group.querySelectorAll('.cell')].forEach((node,j)=>{const k=slots.indexOf(j),d=a===null?state.areas[k]:state.areas[a];update(node,a===null?(j===4?state:d):(j===4?d:d.cards[k]),a===null?null:d);});
 });
 const d=state.areas[bloom.area];if(d){update(document.querySelector('.bloomCenter'),d);document.querySelectorAll('.bloom [data-card]').forEach(n=>update(n,d.cards[Number(n.dataset.card)],d));}
 $('heading').textContent=state.title;
}
compactEditor=function(aside){
 const object=studioObject(),key=draftKey();
 openingSettings=false;if(panelViews.get(key)==='settings')panelViews.set(key,'items');
 // Reuse task/checklist interactions; replace only the settings presentation.
 if(selected.kind==='card')aside=legacyCompactEditor(aside);
 else aside.querySelector('.cardBody').replaceChildren();
 const body=aside.querySelector('.cardBody');
 body.querySelector('.panelHeader')?.remove();
 const title=input(object.title||'','Название');title.dataset.test='title';title.className='studioTitle';title.setAttribute('aria-label','Название');
 const description=el('textarea');description.value=object.description||'';description.placeholder='Добавить описание…';description.maxLength=2000;description.rows=2;description.setAttribute('aria-label','Описание');description.className='studioDescription';
 const save=()=>{object.title=title.value;object.description=description.value;syncStudioMap();};
 title.addEventListener('input',save);description.addEventListener('input',save);
 title.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();description.focus();}});
 const intro=el('div',undefined,'studioIntro');intro.append(title,description);body.prepend(intro);
 renderFocusContent(body,object);
 aside.classList.add('studioPanel');aside.dataset.object=key;
 return aside;
};
decorateMatrix=function(){
 legacyDecorate();
 const aside=document.querySelector('.studioPanel');if(!aside)return;
 const object=studioObject(),parent=selected.kind==='card'?state.areas[selected.a]:null;
 let cover=aside.querySelector(':scope > .cover');if(!cover){cover=el('div',undefined,'cover');aside.prepend(cover);}
 cover.replaceChildren();paint(cover,appearance(object,parent));
 const file=el('input');file.type='file';file.accept='image/jpeg,image/png,image/webp,image/gif,image/avif';file.hidden=true;
 const pick=button('Заменить обложку',()=>file.click(),'coverPick');pick.setAttribute('aria-label','Заменить обложку');
 const adjust=button('☷',()=>{controls.hidden=!controls.hidden;adjust.setAttribute('aria-expanded',String(!controls.hidden));},'coverAdjust');adjust.title='Настроить обложку';adjust.setAttribute('aria-label','Настроить обложку');adjust.setAttribute('aria-expanded','false');
 const badge=hintIcon('','Автосохранение','studioSaved');paintSaveFeedback(badge);
 cover.append(pick,adjust,badge,file);
 const controls=el('section',undefined,'studioCoverControls');controls.hidden=true;controls.setAttribute('aria-label','Регулировка обложки');
 const status=$('notice');
 const apply=look=>{object.appearance={...look};paint(cover,look);syncStudioMap();status.textContent='';};
 const presets=el('div',undefined,'textureChoices');
 for(const [id,label] of [['soft','Свет'],['weave','Ткань'],['contour','Рельеф'],['plain','Без фона']])presets.append(button(label,()=>{const look={...appearance(object,parent),texture:id};delete look.image;apply(look);}));
 controls.append(presets);
 for(const [id,label,min,max] of [['x','По горизонтали',0,100],['y','По вертикали',0,100],['scale','Масштаб',100,200],['dim','Затемнение',0,85]]){
  const slider=el('input');slider.type='range';slider.min=min;slider.max=max;slider.value=appearance(object,parent)[id];slider.setAttribute('aria-label',label);slider.oninput=()=>apply({...appearance(object,parent),[id]:Number(slider.value)});controls.append(field(label,slider));
 }
 let ticket=0;
 file.onchange=async()=>{
  const f=file.files[0];if(!f)return;const request=++ticket;
  if(f.size>5*1024*1024||!/^image\/(jpeg|png|webp|gif|avif)$/.test(f.type)){status.textContent='Нужна картинка JPG, PNG, WebP, GIF или AVIF до 5 МБ';return;}
  status.textContent='Открываю картинку…';
  try{const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(f);});const img=new Image();img.src=data;await img.decode();
   if(!aside.isConnected||request!==ticket)return;
   apply({...appearance(object,parent),image:data});
  }catch{if(aside.isConnected&&request===ticket)status.textContent='Не удалось открыть картинку. Попробуй другой файл.';}
  finally{file.value='';}
 };
 aside.querySelector('.studioIntro').after(controls);
 studioObserver?.disconnect();
 const toolbar=document.querySelector('.mapControls');
 if(toolbar){toolbar.classList.add('iconControls');toolbar.querySelectorAll('button').forEach(b=>{
  const zoom=b.classList.contains('mapZoom'),label=zoom?(view==='all'?'Крупнее':'Вся карта'):'Выбрать дело';
  b.title=label;b.setAttribute('aria-label',label);
  b.innerHTML=zoom?'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r=".8"/><circle cx="16" cy="8" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="8" cy="16" r=".8"/><circle cx="16" cy="16" r=".8"/></svg>';
 });}
 const fit=()=>{const grid=$('matrix');if(!grid)return;const rect=grid.getBoundingClientRect(),layout=aside.parentElement.getBoundingClientRect();aside.style.setProperty('--panel-size',rect.width+'px');aside.style.setProperty('--panel-offset',Math.max(0,rect.top-layout.top)+'px');
  const gap=parseFloat(getComputedStyle(grid).columnGap)||8;
  aside.style.setProperty('--cover-height',(bloom.area!==null&&view!=='all'?rect.width*.225-4:(rect.width-gap*2)/3)+'px');
  if(toolbar){const canvas=toolbar.parentElement.getBoundingClientRect();toolbar.style.setProperty('--controls-x',((rect.right+layout.left+aside.offsetLeft)/2-canvas.left)+'px');toolbar.style.setProperty('--controls-y',(rect.top-canvas.top-44)+'px');}
 };
 fit();studioObserver=new ResizeObserver(fit);studioObserver.observe($('matrix'));studioObserver.observe($('matrix').parentElement);
 const key=draftKey();panelTween?.kill();
 if(lastPanelKey!==key&&bloomMotion()&&window.gsap){
  panelTween=gsap.timeline({defaults:{ease:'power3.out'}})
   .fromTo(aside.querySelector('.cardBody'),{opacity:.75},{opacity:1,duration:.24,clearProps:'opacity'});
 }
 lastPanelKey=key;
};
bootPrototype();

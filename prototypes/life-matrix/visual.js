const appearanceDrafts=new Map();
const visualOptions={motion:true,scope:'all'};
const textures={
 soft:'radial-gradient(ellipse at 15% 0%, var(--accent), transparent 75%)',
 weave:'repeating-linear-gradient(35deg, #ffffff12 0 1px, transparent 1px 7px),radial-gradient(ellipse at top left,var(--accent),transparent)',
 contour:'repeating-radial-gradient(ellipse at 0% 100%,transparent 0 12px,#ffffff18 13px 14px,transparent 15px 24px),linear-gradient(135deg,var(--accent),#222)',
 plain:'none'
};
function appearance(object){return object.appearance||{texture:Array.isArray(object.checklist)?'plain':'soft',x:50,y:50,scale:100,dim:55};}
function paint(node,look){
 node.classList.add('painted');
 node.style.setProperty('--art',look.image?'none':textures[look.texture]||textures.soft);
 let image=node.querySelector(':scope > .coverImage');
 if(look.image){
  if(!image){image=document.createElement('img');image.className='coverImage';image.alt='';image.draggable=false;node.prepend(image);}
  if(image.getAttribute('src')!==look.image)image.src=look.image;
 }else image?.remove();
 node.style.setProperty('--art-position',`${look.x}% ${look.y}%`);
 node.style.setProperty('--art-size','cover');
 node.style.setProperty('--art-zoom',String(look.scale/100));
 node.style.setProperty('--art-dim',String(look.dim/100));
}
function decorateMatrix(){
 const grid=$('matrix');if(!grid)return;
 const nodes=[...grid.querySelectorAll('.cell')];
 function decorateGroup(group,a){group.forEach((node,j)=>{
  const k=slots.indexOf(j),d=a===null?state.areas[k]:state.areas[a];
  const object=a===null?(j===4?state:d):(j===4?d:d.cards[k]);
  if(!object)return;
  if(a===null||j===4||visualOptions.scope==='all')paint(node,appearance(object,a===null?null:d));
  if(node.classList.contains('center'))node.classList.add('living');
  if((selected.kind==='card'&&a===selected.a&&k===selected.k)||(selected.kind==='area'&&((a===null&&k===selected.a)||(a===selected.a&&j===4))))node.classList.add('selected');
 });}
 if(view==='all')for(let j=0;j<9;j++)decorateGroup(nodes.slice(j*9,j*9+9),j===4?null:slots.indexOf(j));
 else decorateGroup(nodes,view==='home'?null:areaIndex);
 document.body.classList.toggle('motionOff',!visualOptions.motion);
 const aside=document.querySelector('.functionalLayout aside');
 const d=state.areas[selected.a],object=selected.kind==='card'?current():d||state;
 if(!object.title)return;
 const look=appearance(object,selected.kind==='card'?d:null);
 let cover=aside.querySelector('.cover');if(!cover){cover=el('div',undefined,'cover');aside.prepend(cover);}paint(cover,look);
 if(panelViews.get(draftKey())!=='settings')return;
 const form=aside.querySelector('form');if(!form)return;
 // The previous two-option cover selector is replaced by the visual editor.
 const old=[...form.querySelectorAll('select')].find(s=>s.querySelector('option[value=soft]'));if(old)old.closest('label').hidden=true;
 const key=draftKey();let draft=appearanceDrafts.get(key);
 if(!draft){draft={...look};appearanceDrafts.set(key,draft);}
 const section=el('section',undefined,'appearanceEditor');section.append(el('h3','Обложка'));
 const preview=el('div',object.title,'coverPreview');paint(preview,draft);
 // Preview is outside the scrolling form; all controls stay below it.
 aside.classList.add('editingAppearance');
 const panel=aside.querySelector('.panelContent');panel.before(preview);
 const refresh=()=>paint(preview,draft);
 const presets=el('div',undefined,'textureChoices');
 for(const [id,name] of [['soft','Свет'],['weave','Ткань'],['contour','Рельеф'],['plain','Без фона']]){
  const b=button(name,()=>{draft.texture=id;delete draft.image;refresh();mark();});b.dataset.texture=id;presets.append(b);
 }
 const mark=()=>[...presets.children].forEach(b=>b.setAttribute('aria-pressed',String(!draft.image&&draft.texture===b.dataset.texture)));mark();section.append(presets);
 const upload=el('input');upload.type='file';upload.accept='.jpg,.jpeg,.png,.webp,.gif,.avif';
 const feedback=el('p','Картинка остаётся в этом прототипе. До 5 МБ.','compactHint');feedback.setAttribute('role','status');
 const save=form.querySelector('button[type=submit]');let loading=false,request=0;
 const report=(message,error=false)=>{feedback.textContent=message;feedback.classList.toggle('uploadError',error);notice(message);};
 upload.onchange=async()=>{
  const file=upload.files[0];if(!file)return;
  const ticket=++request;
  if(!/\.(jpe?g|png|webp|gif|avif)$/i.test(file.name)||file.size>5*1024*1024){loading=false;save.disabled=false;report('Выбери JPG, PNG, WebP, GIF или AVIF размером до 5 МБ.',true);upload.value='';return;}
  loading=true;save.disabled=true;report('Загружаю обложку…');
  try{
   const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file);});
   const img=new Image();img.src=data;await img.decode();
   // Scope async completion to this editor; never apply to another selected card.
   if(!section.isConnected||ticket!==request)return;
   draft.image=data;refresh();mark();report('Картинка готова. Нажми «Сохранить», чтобы применить.');
   preview.scrollIntoView({block:'nearest',behavior:'instant'});
  }catch{if(section.isConnected&&ticket===request)report('Не удалось открыть изображение. Выбери другой файл.',true);}
  finally{if(ticket===request){loading=false;save.disabled=false;}}
 };
 section.append(field('Своя картинка',upload),feedback);
 for(const [id,label,min,max] of [['x','Положение по горизонтали',0,100],['y','Положение по вертикали',0,100],['scale','Масштаб',100,200],['dim','Затемнение',0,85]]){
  const slider=el('input');slider.type='range';slider.min=min;slider.max=max;slider.value=draft[id];
  slider.oninput=()=>{draft[id]=Number(slider.value);refresh();};section.append(field(label,slider));
 }
 const scope=select([['all','Обложки на всех карточках'],['main','Только цель и направления']],visualOptions.scope);
 // Scope comparison uses a rerender; form drafts and appearance draft survive it.
 scope.onchange=()=>{visualOptions.scope=scope.value;render();};section.append(field('Сравнить плотность оформления',scope));
 if(selected.kind==='card')section.append(button('Взять оформление направления',()=>{Object.assign(draft,appearance(d));delete draft.image;if(appearance(d).image)draft.image=appearance(d).image;refresh();mark();}));
 form.insertBefore(section,form.querySelector('.formActions'));
 form.addEventListener('submit',event=>{
  if(loading){event.preventDefault();event.stopImmediatePropagation();report('Подожди, обложка ещё загружается.');return;}
  if(!form.checkValidity()||!form.querySelector('[data-test=title]').value.trim())return;
  const stat=[...form.querySelectorAll('select')].find(s=>s.querySelector('option[value=focus]'));
  if(stat?.value==='focus'&&object.status!=='focus'&&state.areas.flatMap(a=>a.cards).filter(c=>c.status==='focus').length>=3)return;
  object.appearance={...draft};appearanceDrafts.delete(key);
 },true);
}

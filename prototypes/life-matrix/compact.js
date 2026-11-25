// Presentation-only layer: tasks, habits and checklist items keep their existing identity.
const panelViews=new Map(),panelScroll=new Map();
const addViews=new Map();
const openNotes=new Set();
const boardAccount=window.parent!==window && new URLSearchParams(location.search).get('account');
let boardTasks=[];
let trackerHabits=[];
window.addEventListener('message',event=>{
 if(!boardAccount||event.source!==window.parent||event.origin!==location.origin||event.data?.type!=='plusyx:board'||event.data.account!==boardAccount||!Array.isArray(event.data.tasks))return;
 boardTasks=event.data.tasks;
 trackerHabits=event.data.habits||[];
 document.querySelectorAll('.boardLinks').forEach(node=>node.refreshLinks());
});
function boardLinks(card,kind='task'){
 const habit=kind==='habit',key=habit?'trackerHabitIds':'boardTaskIds';
 const section=el('section',undefined,'boardLinks block');
 section.refreshLinks=()=>{
  section.replaceChildren(el('h3',habit?'Привычки из трекера':'Задачи с доски'));
  const items=habit?trackerHabits:boardTasks,ids=card[key]||[];
  for(const id of ids){
   const item=items.find(entry=>entry.id===id),row=el('div',undefined,'row');
   const entry=item?button('',()=>window.parent.postMessage({
    type:'plusyx:open-card',account:boardAccount,kind,id
   },location.origin),'linkedEntry'):el('div',undefined,'linkedEntry');
   if(item)entry.title=habit?'Открыть привычку':'Открыть задачу';
   if(item?.cover){
    const image=document.createElement('img');image.className='linkedThumbnail';image.alt='';
    image.style.objectPosition='50% '+(item.coverPosition??50)+'%';
    image.style.filter='brightness('+(1-(item.coverIntensity??60)/100)+')';
    image.onerror=()=>image.remove();image.src=item.cover;entry.append(image);
   }
   const info=el('span',undefined,'boardTaskInfo');info.append(el('strong',item?.title||(habit?'Привычка недоступна':'Задача недоступна')));
   if(item&&!habit)info.append(el('small',[({todo:'Запланировано','in-progress':'В работе',done:'Готово'})[item.status],item.date?item.date.split('-').reverse().join('.'):'Без даты'].filter(Boolean).join(' · ')));
   const unlink=button('×',()=>{card[key]=ids.filter(value=>value!==id);render();schedulePrototypeSave();});unlink.title=habit?'Отвязать привычку':'Отвязать задачу';unlink.setAttribute('aria-label','Отвязать '+(item?.title||(habit?'привычку':'задачу')));
   entry.append(info);row.append(entry,unlink);section.append(row);
  }
  const available=items.filter(item=>!ids.includes(item.id));
  section.hidden=!items.length&&!ids.length;
  if(!available.length)return;
  const picker=select([['',habit?'Выбрать привычку':'Выбрать задачу'],...available.map(item=>[item.id,item.title])],'');picker.setAttribute('aria-label',habit?'Привычка из трекера':'Задача с доски');
  const link=button('Привязать',()=>{if(!available.some(item=>item.id===picker.value))return;card[key]=[...ids,picker.value];render();schedulePrototypeSave();});
  link.disabled=true;picker.onchange=()=>{link.disabled=!picker.value;};
  const add=el('details');add.append(el('summary',habit?'Привязать привычку':'Привязать задачу'),picker,link);section.append(add);
 };
 section.refreshLinks();return section;
}
let nextInputFocus=null;
let openingSettings=false;
function rememberPanel(){const panel=document.querySelector('.panelContent');if(panel)panelScroll.set(panel.dataset.key,panel.scrollTop);}
function panelMode(mode){rememberPanel();panelViews.set(draftKey(),mode);render();}
function travel(next,a){
 const old=document.querySelector('#matrix');
 const origin=old?.querySelector(`[data-area="${a}"]`)?.getBoundingClientRect();
 view=next;areaIndex=a??areaIndex;selected=next==='area'?{kind:'area',a:areaIndex}:{kind:'goal'};
 render();
 const grid=$('matrix');
 if(grid&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
  const bounds=grid.getBoundingClientRect();
  grid.style.transformOrigin='0 0';
  const start=origin&&next==='area'?`translate(${origin.x-bounds.x}px,${origin.y-bounds.y}px) scale(${origin.width/bounds.width},${origin.height/bounds.height})`:'scale(.94)';
  grid.animate([{opacity:.35,transform:start},{opacity:1,transform:'none'}],{duration:280,easing:'cubic-bezier(.2,.7,.2,1)'});
 }
 document.querySelector('#matrix .center')?.focus({preventScroll:true});
}
function editSelection(kind,a){selected={kind,a};openingSettings=true;render();document.querySelector('aside [data-test=title]')?.focus();}
function compactEditor(aside){
 const body=aside.querySelector('.cardBody'),c=selected.kind==='card'?current():null;
 const key=draftKey(),existingTitle=c?(c.title||'Новая карточка'):state.areas[selected.a]?.title||(selected.kind==='goal'?state.title:'');
 const settings=body.querySelector('details'),form=settings?.querySelector('form')||body.querySelector('form');
 const save=form?.querySelector('button[type=submit]');
 if(save){
  const actions=el('div',undefined,'formActions');actions.append(save);form.append(actions);
  const hint=el('small','Изменения применяются по кнопке сохранения.','saveHint');actions.prepend(hint);
 }
 if(!existingTitle){
  openingSettings=false;
  body.querySelector('h2').textContent=c?'Новая карточка':'Новое направление';
  // Keep default values in the form, but postpone secondary choices until settings.
  for(const label of form.querySelectorAll(':scope > label'))if(label.querySelector('select,input[type=color]'))label.hidden=true;
  if(save)save.textContent=c?'Создать карточку':'Создать направление';
  form.querySelector('.saveHint').textContent='Добавь название и нажми «Создать». Описание необязательно.';
  return aside;
 }
 const mode=openingSettings?'settings':panelViews.get(key)||'items';openingSettings=false;
 panelViews.set(key,mode);
 const head=el('div',undefined,'panelHeader');
 const name=body.querySelector('h2');name.textContent=existingTitle;
 head.append(name);
 const edit=button('✎',()=>panelMode('settings'),'editControl');edit.setAttribute('aria-label','Редактировать карточку');edit.title='Название и оформление';head.append(edit);
 body.prepend(head);
 body.querySelector('.eyebrow')?.remove();body.querySelector('.saved')?.remove();
 const content=el('div',undefined,'panelContent');content.dataset.key=key+':'+mode;
 if(mode==='settings'){
  content.append(button('← '+(c?'К делам':'Назад'),()=>panelMode('items'),'panelBack'),form);
 }else if(!c){
  if(state.areas[selected.a]?.description)content.append(el('p',state.areas[selected.a].description,'noteText'));
  content.append(el('p',selected.kind==='area'?'Выбери карточку вокруг центра. Клик по центру свернёт направление.':'Нажми на направление, чтобы раскрыть его.','compactHint'));
 }else{
  const blocks=[...body.querySelectorAll('.block')];
  {
   const list=el('div',undefined,'unifiedList'),done=el('details',undefined,'completedItems');
   const completed=[];
   blocks.slice(0,3).forEach((block,i)=>{
    if(boardAccount&&i===1)return;
    const rows=[...block.querySelectorAll(':scope > .row')];
    rows.forEach((row,index)=>{
     if(boardAccount&&i===0)row.querySelector('button')?.remove();
     if(i!==0)row.prepend(el('small',i===1?'Задача':'Сегодня','itemType'));
     const finished=i===0?c.checklist[index]?.done:i===1?state.tasks.find(t=>t.id===c.taskIds[index])?.status==='done':state.habits.find(h=>h.id===c.habitIds[index])?.history[today];
     if(i===0){const check=row.querySelector('input');const original=check.onchange;check.onchange=()=>{original();render();};}
     if(finished)completed.push(row);
     if(!finished){
      if(i===0&&!list.children.length)list.append(el('h3','Шаги','stepsHeading'));
      list.append(row);
     }
    });
   });
   if(!list.children.length&&!(boardAccount&&(c.boardTaskIds?.length||c.trackerHabitIds?.length)))list.append(el('p',completed.length?'На сейчас всё выполнено.':'С чего начнём? Добавь первое дело.','compactHint'));
   content.append(list);
   if(completed.length){done.append(el('summary',`Выполнено · ${completed.length}`),...completed);content.append(done);}
   const addState=addViews.get(key)||{open:false,type:0};addViews.set(key,addState);
   const add=el('details',undefined,'addItems');add.open=addState.open;add.append(el('summary','+ Добавить'));
   add.addEventListener('toggle',()=>{if(add.isConnected)addState.open=add.open;});
   const choices=el('div',undefined,'addChoices'),forms=el('div');
   // Retain form nodes when switching add type, so drafts and listeners survive.
   const groups=blocks.slice(0,3).map(b=>[...b.querySelectorAll(':scope > form')]);
   ['Шаг','Задача','Привычка'].forEach((label,i)=>choices.append(button(label,()=>{
    addState.type=i;
    forms.replaceChildren(...groups[i]);[...choices.children].forEach((b,n)=>b.setAttribute('aria-pressed',String(n===i)));
   })));
   if(boardAccount){choices.hidden=true;addState.type=0;}
   groups.forEach((group,i)=>group.forEach(f=>f.addEventListener('submit',()=>{
    addState.open=true;addState.type=i;
    const n=f.querySelector('input,textarea');
    if(n)nextInputFocus={key,placeholder:n.placeholder};
   },true)));
   forms.append(...groups[addState.type]);choices.children[addState.type].setAttribute('aria-pressed','true');
   add.append(choices,forms);content.append(add);
   if(boardAccount)content.append(boardLinks(c),boardLinks(c,'habit'));
   const notes=el('details',undefined,'inlineNotes');notes.open=openNotes.has(key);
   notes.append(el('summary',c.notes.length?'Заметки · '+c.notes.length:'Заметки'));
   notes.addEventListener('toggle',()=>{if(notes.isConnected){if(notes.open)openNotes.add(key);else openNotes.delete(key);}});
   const noteForm=blocks[3].querySelector('form'),field=noteForm.querySelector('textarea'),submit=noteForm.querySelector('button');
   field.rows=1;field.setAttribute('aria-label','Текст заметки');submit.textContent='+';submit.title='Добавить заметку';submit.setAttribute('aria-label',submit.title);
   const updateComposer=()=>{submit.disabled=!field.value.trim();};
   field.addEventListener('input',updateComposer);updateComposer();
   noteForm.onsubmit=event=>{
    event.preventDefault();const text=field.value.trim();if(!text)return;
    c.notes.push({id:uid(),text});field.value='';field.dispatchEvent(new Event('input'));drafts.delete(key+':'+field.placeholder);
    refreshNotes();schedulePrototypeSave();field.focus();
   };
   field.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();noteForm.requestSubmit();}});
   const entries=el('div');
   const noteBatch=10;
   let visibleNotes=noteBatch;
   const more=button('',()=>{const offset=visibleNotes;visibleNotes+=noteBatch;refreshNotes(offset);},'moreNotes');
   function refreshNotes(offset=0){
    notes.querySelector('summary').textContent=c.notes.length?'Заметки · '+c.notes.length:'Заметки';
    if(!offset)entries.replaceChildren();
    for(let index=c.notes.length-1-offset;index>=Math.max(0,c.notes.length-visibleNotes);index--){
     const note=c.notes[index];
     const row=el('div',undefined,'matrixNote'),copy=el('p',note.text,'noteText'),actions=el('div',undefined,'noteActions');
     function icon(label,path,action){
      const control=button('',action);control.title=label;control.setAttribute('aria-label',label);
      control.innerHTML='<svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+path+'"/></svg>';return control;
     }
     const edit=icon('Редактировать заметку','M4 20l4-1 12-12-3-3L5 16z M14 7l3 3',()=>{
      const editor=el('textarea');editor.rows=1;editor.maxLength=2000;editor.value=note.text;editor.setAttribute('aria-label','Изменить текст заметки');
      const finish=save=>{if(save){if(!editor.value.trim())return;note.text=editor.value.trim();copy.textContent=note.text;schedulePrototypeSave();}editor.replaceWith(copy);actions.replaceChildren(edit,remove);row.classList.remove('editing');edit.focus();};
      row.classList.add('editing');copy.replaceWith(editor);actions.replaceChildren(icon('Сохранить заметку','M4 12l5 5L20 6',()=>finish(true)),icon('Отменить','M6 6l12 12 M18 6L6 18',()=>finish(false)));editor.focus();
      editor.onkeydown=e=>{if(e.isComposing)return;if(e.key==='Escape'||(e.key==='Enter'&&!e.shiftKey)){e.preventDefault();finish(e.key==='Enter');}};
     });
     const remove=icon('Удалить заметку','M3 6h18 M9 6V3h6v3 M6 6l1 15h10l1-15 M10 10v7 M14 10v7',()=>{c.notes=c.notes.filter(item=>item.id!==note.id);refreshNotes();schedulePrototypeSave();field.focus();});
     actions.append(edit,remove);row.append(copy,actions);entries.append(row);
    }
    const remaining=c.notes.length-visibleNotes;more.hidden=remaining<=0;
    more.textContent='Показать ещё '+Math.min(noteBatch,Math.max(0,remaining));
   }
   notes.append(noteForm,entries,more);refreshNotes();content.append(notes);
  }
 }
 // Keep only header, pane navigation and the active content; no duplicate hidden forms.
 for(const child of [...body.children])if(child!==head&&!child.classList.contains('panelTabs'))child.remove();
 body.append(content);
 requestAnimationFrame(()=>{if(content.isConnected)content.scrollTop=panelScroll.get(content.dataset.key)||0;});
 if(nextInputFocus?.key===key){const target=nextInputFocus;nextInputFocus=null;requestAnimationFrame(()=>{
  if(content.isConnected)[...content.querySelectorAll('input,textarea')].find(n=>n.placeholder===target.placeholder)?.focus();
 });}
 return aside;
}

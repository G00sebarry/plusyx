// Focus stores a reference to an existing card, never a duplicate task.
function focusCards(){return state.areas.flatMap((area,a)=>[...area.cards.map((card,k)=>({card,area,a,k})),...(area.storedCards||[]).map(card=>({card,area,a,stored:true}))]).filter(x=>x.card.title.trim());}
function openFocusCard(entry){view='home';bloom.area=entry.a;selected=entry.stored?{kind:'card',a:entry.a,archiveId:entry.card.id}:{kind:'card',a:entry.a,k:entry.k};render();}
function vacantMatrixCard(c){return !c.title.trim()&&!c.description&&!c.appearance&&!c.boardTaskIds?.length&&!c.trackerHabitIds?.length&&['checklist','notes','taskIds','habitIds'].every(key=>!c[key].length);}
function restoreMatrixCard(area,card,k){
 const index=(area.storedCards||[]).findIndex(c=>c.id===card.id);if(index<0||!area.cards[k])return;
 const displaced=area.cards[k];area.storedCards.splice(index,1);
 if(!vacantMatrixCard(displaced))area.storedCards.push(displaced);
 area.cards[k]=card;selected={kind:'card',a:state.areas.indexOf(area),k};render();schedulePrototypeSave();
}
function focusCube(entry,action,chosen=false){
 const cube=button('',action,'focusCube');cube.dataset.cardId=entry.card.id;cube.title=entry.area.title+' · '+entry.card.title;cube.setAttribute('aria-label',cube.title);
 paint(cube,appearance(entry.card));cube.style.setProperty('--accent',entry.area.color);
 cube.append(el('span',entry.card.title,'cubeTitle'),el('small',entry.area.title,'cubeArea'));
 if(chosen){cube.classList.add('chosen');cube.setAttribute('aria-pressed','true');}
 return cube;
}
function focusCarousel(label){const rail=el('div',undefined,'focusCarousel');rail.setAttribute('role','group');rail.setAttribute('aria-label',label);return rail;}
function renderFocusContent(body,object){
 const section=el('section',undefined,'focusContent');
 const save=()=>{render();schedulePrototypeSave();};
 if(selected.kind==='card'){
  const controls=el('div',undefined,'resultActions'),done=object.status==='done';
  const area=state.areas[selected.a],stored=!!selected.archiveId;
  if(stored){
   controls.append(button('Вернуть в сетку',()=>{
    const free=area.cards.findIndex(vacantMatrixCard);
    if(free>=0){restoreMatrixCard(area,object,free);return;}
    if(controls.querySelector('.restorePicker'))return;
    const picker=el('div',undefined,'restorePicker');picker.append(el('p','Все места заняты. Выбери карточку для замены: она сохранится в «Отложено», а завершённая — в «Достигнуто».','compactHint'));
    const rail=focusCarousel('Выбрать место для возврата');area.cards.forEach((card,k)=>rail.append(focusCube({card,area},()=>restoreMatrixCard(area,object,k))));
    picker.append(rail,button('Отменить возврат',()=>picker.remove()));controls.append(picker);
   }));
  }else if(done){controls.append(button('Освободить место',()=>{
   (area.storedCards ||= []).push(object);area.cards[selected.k]=makeCard();selected={kind:'area',a:selected.a};save();
  }));}
  controls.append(button(done?'Вернуть в работу':'Завершить результат',()=>{
   if(done){object.status='doing';delete object.completedAt;}
   else{object.status='done';object.completedAt=new Date().toISOString();}
   save();
  }));
  controls.append(hintIcon('ⓘ',done?'Результат сохранён в истории направления.':'Завершение подтверждаешь ты; отметки шагов не закрывают цель автоматически.','resultHint'));
  body.append(controls);return;
 }
 const all=focusCards(),entries=selected.kind==='area'?all.filter(x=>x.a===selected.a):all;
 const active=entries.filter(x=>!x.stored&&!['done','pause'].includes(x.card.status));
 const focus=active.find(x=>x.card.id===object.focusId);
 const heading=el('div',undefined,'focusHeading');heading.append(el('h3','Сейчас в фокусе'));section.append(heading);
 if(focus){
  const link=button(focus.card.title,()=>openFocusCard(focus),'focusLink');section.append(link);
  if(selected.kind==='goal')section.append(el('small',focus.area.title,'focusContext'));
  const next=focus.card.checklist.find(s=>!s.done);
  if(next)section.append(el('p','Следующий шаг: '+next.text,'focusNext'));
  else {const task=state.tasks.find(t=>focus.card.taskIds.includes(t.id)&&t.status!=='done');if(task)section.append(el('p','Следующая задача: '+task.title,'focusNext'));}
  if(focus.card.checklist.length){const count=focus.card.checklist.filter(s=>s.done).length;section.append(el('small',`${count} из ${focus.card.checklist.length} шагов`,'focusProgress'));}
 }else section.append(el('p',object.focusId?'Предыдущий фокус завершён, приостановлен или недоступен. Можно выбрать следующий.':'Выбери одну карточку, которой сейчас хочешь уделить внимание.','compactHint'));
 const picker=el('details',undefined,'focusPicker');picker.append(el('summary',focus?'Сменить фокус':'Выбрать фокус'));
 if(active.length){const rail=focusCarousel('Выбрать фокус');active.forEach(entry=>rail.append(focusCube(entry,()=>{object.focusId=entry.card.id;save();},entry.card.id===focus?.card.id)));picker.append(rail);if(object.focusId)picker.append(button('Убрать фокус',()=>{object.focusId=null;save();},'clearFocus'));}
 else picker.append(el('p','Добавь карточку в одном из направлений — она появится здесь.','compactHint'));
 section.append(picker);
 const done=entries.filter(x=>x.card.status==='done').sort((a,b)=>(b.card.completedAt||'').localeCompare(a.card.completedAt||''));
 if(done.length){const history=el('details',undefined,'focusHistory');history.append(el('summary',`Достигнуто · ${done.length}`));
  const rail=focusCarousel('Достигнутые результаты');done.forEach(entry=>{const cube=focusCube(entry,()=>openFocusCard(entry));cube.classList.add('resultLink');const date=entry.card.completedAt?new Date(entry.card.completedAt):null;if(date&&!isNaN(date))cube.title+=' · '+date.toLocaleDateString('ru-RU');rail.append(cube);});history.append(rail);section.append(history);
 }
 const deferred=entries.filter(x=>x.stored&&x.card.status!=='done');
 if(deferred.length){const shelf=el('details',undefined,'focusHistory deferredHistory');shelf.append(el('summary',`Отложено · ${deferred.length}`));const rail=focusCarousel('Отложенные карточки');deferred.forEach(entry=>rail.append(focusCube(entry,()=>openFocusCard(entry))));shelf.append(rail);section.append(shelf);}
 body.append(section);
 section.querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>{const cubes=[...d.querySelectorAll('.focusCube')];if(window.gsap){gsap.killTweensOf(cubes);gsap.set(cubes,{clearProps:'transform,opacity'});}if(d.open&&bloomMotion()&&window.gsap)gsap.fromTo(cubes,{y:10,scale:.95,opacity:0},{y:0,scale:1,opacity:1,duration:.38,stagger:{each:.045,from:'start'},clearProps:'transform,opacity',overwrite:true});}));
}

// Standalone prototype storage; never shares the production application's database.
let prototypeDB,localSaveReady=false,localSaveTimer,saveRevision=0;
let saveFeedback={message:'Автосохранение в этом браузере',phase:'pending'};
function hintIcon(symbol,message,className){
 const hint=el('details',undefined,'matrixHint '+className),trigger=el('summary',symbol),tip=el('span',message);
 trigger.setAttribute('aria-label',message);trigger.title=message;hint.append(trigger,tip);
 hint.onkeydown=event=>{if(event.key==='Escape'){hint.open=false;trigger.focus();}};return hint;
}
function paintSaveFeedback(hint){
 const {message,phase}=saveFeedback,trigger=hint.firstElementChild;
 trigger.title=message;trigger.setAttribute('aria-label',message);hint.lastElementChild.textContent=message;
 if(hint.dataset.phase===phase)return;
 hint.dataset.phase=phase;
 trigger.innerHTML='<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 3h12l4 4v14H4z M8 3v5h8V3"/>'+({saved:'<path d="m8 15 3 3 5-6"/>',error:'<path d="M12 11v4m0 3h.01"/>',pending:'<circle class="saveSpin" cx="12" cy="15" r="3" stroke-dasharray="13 6"/>'})[phase]+'</svg>';
}
function localSaveMessage(message,error=false,phase='saved'){
 saveFeedback={message,phase:error?'error':phase};document.querySelectorAll('.studioSaved').forEach(paintSaveFeedback);
 if(error)$('notice').textContent=message;
}
function openPrototypeDB(){return new Promise((resolve,reject)=>{
 const account=new URLSearchParams(location.search).get('account');
 if(account && window.parent!==window) document.body.classList.add('inPlusyx');
 const database=account?'plusyx-life-matrix-preview:'+account:'plusyx-life-matrix-prototype';
 const request=indexedDB.open(database,1);
 request.onupgradeneeded=()=>request.result.createObjectStore('snapshots');
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 request.onblocked=()=>reject(new Error('Storage blocked'));
});}
function readPrototype(){return new Promise((resolve,reject)=>{
 const request=prototypeDB.transaction('snapshots').objectStore('snapshots').get('current');
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});}
function validPrototype(s){return s&&s.version===2&&typeof s.title==='string'&&Array.isArray(s.areas)&&s.areas.length===8&&s.areas.every(a=>typeof a.title==='string'&&Array.isArray(a.cards)&&a.cards.length===8&&(a.storedCards===undefined||Array.isArray(a.storedCards))&&[...a.cards,...(a.storedCards||[])].every(c=>typeof c.title==='string'&&['checklist','notes','taskIds','habitIds'].every(k=>Array.isArray(c[k]))))&&Array.isArray(s.tasks)&&Array.isArray(s.habits);}
function savePrototype(){
 clearTimeout(localSaveTimer);if(!localSaveReady||!state.areas.length)return;
 const revision=++saveRevision;
 try{const transaction=prototypeDB.transaction('snapshots','readwrite');transaction.objectStore('snapshots').put(structuredClone(state),'current');
  transaction.oncomplete=()=>{if(revision===saveRevision)localSaveMessage('Сохранено в этом браузере');};
  transaction.onabort=transaction.onerror=()=>localSaveMessage('Не удалось сохранить локально. Скачай снимок демо.',true);
 }catch{localSaveMessage('Не удалось сохранить локально. Скачай снимок демо.',true);}
}
function schedulePrototypeSave(){if(!localSaveReady)return;++saveRevision;localSaveMessage('Сохраняю в этом браузере…',false,'pending');clearTimeout(localSaveTimer);localSaveTimer=setTimeout(savePrototype,250);}
async function bootPrototype(){
 if(new URLSearchParams(location.search).get('cloud')==='account' && window.parent!==window){
  await bootCloudMatrix();
  return;
 }
 document.querySelector('footer p').textContent='Локальный прототип. Данные и обложки сохраняются в этом браузере, без отправки на сервер Plusyx. Очистка данных браузера удалит сохранение; снимок JSON можно скачать отдельно.';
 try{
  prototypeDB=await openPrototypeDB();const saved=await readPrototype();
  if(saved!==undefined&&!validPrototype(saved))throw new Error('Invalid saved prototype');
  if(saved){Object.assign(state,saved);$('onboarding').hidden=true;$('app').hidden=false;render();}
  else if(!new URLSearchParams(location.search).has('onboarding')){document.querySelector('[data-mode=life]').click();$('setup').requestSubmit();}
  localSaveReady=true;localSaveMessage(saved?'Восстановлено из этого браузера':'Автосохранение в этом браузере',false,saved?'saved':'pending');
  // Render covers checklist mutations; input/change cover direct model edits.
  const originalRender=render;render=function(){const result=originalRender();schedulePrototypeSave();return result;};
  const originalSync=syncStudioMap;syncStudioMap=function(){originalSync();schedulePrototypeSave();};
  document.addEventListener('input',schedulePrototypeSave);document.addEventListener('change',schedulePrototypeSave);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)savePrototype();});
  window.addEventListener('pagehide',savePrototype);
  $('restart').onclick=()=>{
   if(!confirm('Удалить сохранённую демку из этого браузера и начать заново?'))return;
   clearTimeout(localSaveTimer);localSaveReady=false;
   const t=prototypeDB.transaction('snapshots','readwrite');t.objectStore('snapshots').delete('current');
   t.oncomplete=()=>location.reload();t.onabort=t.onerror=()=>{localSaveReady=true;localSaveMessage('Сброс не выполнен. Данные сохранены.',true);};
  };
  if(!saved)savePrototype();
 }catch{
  localSaveReady=false;
  if(!state.areas.length){document.querySelector('[data-mode=life]').click();$('setup').requestSubmit();}
  localSaveMessage('Локальное хранилище недоступно или снимок повреждён. Автосохранение отключено; скачай снимок перед закрытием.',true);
 }
}

async function bootCloudMatrix(){
 const store=window.frameElement.matrixStore;
 document.body.classList.add('inPlusyx');
 $('onboarding').hidden=true;
 $('restart').hidden=true;
 const notice=$('notice');
 const status=(text,error=false,phase='saved')=>localSaveMessage(text,error,phase);
 let revision=0,lastSaved='',timer,busy=false,conflict=false;
 const serialize=()=>JSON.stringify(state);
 async function flush(){
  if(busy||conflict)return;
  busy=true;
  try{
   let draft=serialize();
   while(draft!==lastSaved){
    status('Сохраняю в аккаунте…',false,'pending');
    revision=await store.save(JSON.parse(draft),revision);
    lastSaved=draft;
    draft=serialize();
   }
   status('Сохранено в аккаунте');
   if(notice.querySelector('button'))notice.replaceChildren();
  }catch(error){
   conflict=error.message==='matrix-conflict';
   status(conflict?'Карта изменена в другом окне. Скачай свою копию перед обновлением.':'Не удалось сохранить карту. Повтори сохранение или скачай копию.',true);
   const backup=button('Скачать копию',()=>$('download').click());
   notice.append(' ',backup);
   if(!conflict)notice.append(' ',button('Повторить',flush));
  }finally{busy=false;}
 }
 function schedule(){
  clearTimeout(timer);
  if(conflict||serialize()===lastSaved)return;
  status('Сохраняю в аккаунте…',false,'pending');
  timer=setTimeout(flush,350);
 }
 try{
  const row=await store.load();
  if(row){
   if(!validPrototype(row.snapshot))throw new Error('Invalid snapshot');
   Object.assign(state,row.snapshot);
   revision=row.revision;
   $('onboarding').hidden=true;$('app').hidden=false;render();
   lastSaved=serialize();
   status('Загружено из аккаунта');
  }else{
   state.tasks=[];state.habits=[];
   document.querySelector('[data-mode=life]').click();$('setup').requestSubmit();
  }
  schedulePrototypeSave=schedule;
  const originalRender=render;
  render=function(){const result=originalRender();schedule();return result;};
  const originalSync=syncStudioMap;
  syncStudioMap=function(){originalSync();schedule();};
  document.addEventListener('input',schedule);
  document.addEventListener('change',schedule);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
  window.addEventListener('pagehide',flush);
  if(!row)await flush();
 }catch{
  $('onboarding').hidden=true;$('app').hidden=true;
  notice.textContent='Не удалось загрузить карту из аккаунта. ';
  notice.append(button('Повторить',()=>location.reload()));
 }
}

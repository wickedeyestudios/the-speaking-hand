/* The Speaking Hand by DM Wicked — embedded GM service, Foundry VTT v14.
   This is part of the module. No GM macro is required. */
let running=null;
export async function startGM(){
 if(!game.user?.isGM) return;
 if(running) return running;
 running=(async()=>{

'use strict';
if(!game.user.isGM) return ui.notifications.error('Speaking Circle GM only.');
const KEY='guildSpeakingCircleV1', CHANNEL='system.dnd5e', TAG='guildSpeakingCircleV1';
const AUTO_MODULE='guild-speaking-circle-autohud';
const autoReady=()=>!!game.modules.get(AUTO_MODULE)?.active;
const autoEnabled=()=>{
 try{return autoReady() && !!game.settings.get(AUTO_MODULE,'enabled');}catch{return false;}
};
async function toggleAllHud(){
 if(!autoReady()){
  ui.notifications.error('Install and activate the Guild Speaking Circle — Automatic HUD module first. A macro alone cannot start the HUD in other browsers.');
  return;
 }
 const next=!autoEnabled();
 await game.settings.set(AUTO_MODULE,'enabled',next);
 game.socket.emit(CHANNEL,{tag:TAG,op:'hudVisibility',enabled:next});
 ui.notifications.info(next?'Speaking Circle hands enabled for all connected players.':'Speaking Circle hands hidden for all connected players.');
 draw();
}

const esc=x=>foundry.utils.escapeHTML(String(x??''));
const copy=x=>foundry.utils.deepClone(x);
const clean=()=>({version:1,people:[],queue:[],current:null,priority:[],revision:0});
if(!game.settings.settings.has('world.'+KEY)) game.settings.register('world',KEY,{scope:'world',config:false,type:Object,default:clean()});
const read=()=>{const x=game.settings.get('world',KEY)||{};return {...clean(),...copy(x),people:Array.isArray(x.people)?copy(x.people):[],queue:Array.isArray(x.queue)?copy(x.queue):[],priority:Array.isArray(x.priority)?copy(x.priority):[]};};
const unique=()=>foundry.utils.randomID();
const actors=()=>game.actors.filter(a=>a.type==='character').sort((a,b)=>a.name.localeCompare(b.name));
const users=()=>game.users.contents.sort((a,b)=>a.name.localeCompare(b.name));
const USERID=game.user.id;
// Discord voice bridge configuration remains only in THIS GM browser's localStorage.
// Never put bridge access keys or bot tokens into Foundry world settings.
const VOICE_KEY='guildSpeakingCircle.discordVoice.v1.'+(game.world?.id||'world')+'.'+USERID;
const defaultVoice=()=>({enabled:false,url:'',key:'',gmIds:'',people:{}});
let voiceCfg=defaultVoice();
try{voiceCfg={...defaultVoice(),...JSON.parse(localStorage.getItem(VOICE_KEY)||'{}')};}catch{}
let voiceInFlight=Promise.resolve(),voiceTimer=null,lastVoiceFeedback='Not connected';
function saveVoiceCfg(){localStorage.setItem(VOICE_KEY,JSON.stringify(voiceCfg));}
const splitDiscordIds=(raw)=>[...new Set(String(raw||'').split(/[\s,;]+/).map(x=>x.trim()).filter(x=>/^\d{16,25}$/.test(x)))];
function voiceFeedback(text,isError=false){
 lastVoiceFeedback=text;
 const slot=dash?.querySelector('[data-voice-feedback]');
 if(slot){slot.textContent=text;slot.style.color=isError?'#ffb5a8':'#b9e9b3';}
}
function voicePayload(){
 const gmDiscordIds=splitDiscordIds(voiceCfg.gmIds);
 const participantDiscordIds=[...new Set(Object.values(voiceCfg.people||{}).filter(x=>/^\d{16,25}$/.test(x)))];
 const chosen=(db.priority||[])[0]||db.current||null;
 const person=db.people.find(p=>p.id===chosen);
 // A GM priority hand supersedes the current player's Discord speaking privilege.
 let currentSpeakerDiscordId=person?String(voiceCfg.people?.[person.id]||''):null;
 if(person&&game.users.get(person.userId)?.isGM&&!currentSpeakerDiscordId)currentSpeakerDiscordId=gmDiscordIds[0]||null;
 return {enabled:!!voiceCfg.enabled&&!!chosen,
  currentSpeakerDiscordId,gmDiscordIds,participantDiscordIds};
}
async function voiceRequest(route,payload,method='POST'){
 if(!voiceCfg.url||!voiceCfg.key)throw Error('Set the HTTPS bridge URL and access key first.');
 const base=String(voiceCfg.url).replace(/\/+$/,'');
 if(!/^https:\/\//i.test(base))throw Error('Bridge URL must start with https://.');
 const resp=await fetch(base+route,{method,mode:'cors',cache:'no-store',
  headers:{Authorization:'Bearer '+voiceCfg.key,'Content-Type':'application/json'},
  ...(method==='POST'?{body:JSON.stringify(payload||{})}:{})});
 const result=await resp.json().catch(()=>({}));
 if(!resp.ok)throw Error(result.error||'Discord bridge returned HTTP '+resp.status);
 return result;
}
async function syncVoice(){
 if(!voiceCfg.enabled)return;
 const payload=voicePayload();
 // A misconfigured current speaker must NEVER cause the bot to mute everybody.
 if(payload.enabled&&!/^\d{16,25}$/.test(payload.currentSpeakerDiscordId||'')){
   voiceFeedback('Voice not applied: link the current speaker to their Discord ID. Existing mutes will be released.',true);
   await voiceRequest('/api/release',{});return;
 }
 const response=await voiceRequest('/api/sync',payload);
 const errors=Array.isArray(response.failures)?response.failures:[];
 voiceFeedback(errors.length?`Voice updated with ${errors.length} Discord permission error(s): ${errors.map(e=>e.error).join('; ')}`:
    payload.enabled?'Voice live: only the current speaker and GM(s) are unmuted.':'No active speaker: Discord voice released.',errors.length>0);
}
function scheduleVoiceSync(){
 if(!voiceCfg.enabled)return;
 clearTimeout(voiceTimer);
 voiceTimer=setTimeout(()=>{
  voiceInFlight=voiceInFlight.catch(()=>{}).then(syncVoice).catch(e=>voiceFeedback('Discord sync failed: '+e.message,true));
 },220);
}

const handlerKey='__guildSpeakingGMHandler';
const stateRef='__guildSpeakingGmState';
const existing=globalThis[stateRef];
if(existing?.ui) existing.ui.remove();
if(existing?.dashboard) existing.dashboard.remove();
document.getElementById('guild-speaking-forge-browser')?.remove();
if(existing?.handler) game.socket.off(CHANNEL,existing.handler);
if(existing?.hook) Hooks.off('updateSetting',existing.hook);
if(existing?.docClick)document.removeEventListener('click',existing.docClick);
if(existing?.docSubmit)document.removeEventListener('submit',existing.docSubmit,true);
if(existing?.docSubmitLegacy)document.removeEventListener('submit',existing.docSubmitLegacy);
if(existing?.docChange)document.removeEventListener('change',existing.docChange);
if(existing?.docInput)document.removeEventListener('input',existing.docInput);
for(const [name,fn] of Object.entries(existing?.dragListeners||{}))document.removeEventListener(name,fn);
document.getElementById('guild-speaking-circle-gm-dash')?.remove();
let db=read(),busy=false;
const groupId=(userId,actorId)=>`${userId}:${actorId||'gm'}`;
// One record per character; multiple authorized accounts share its speaking identity and queue slot.
const authorized=(p,userId)=>p.userId===userId||(Array.isArray(p.surrogateUserIds)&&p.surrogateUserIds.includes(userId));
const requiresToken=p=>p.requireToken!==undefined?!!p.requireToken:!!p.actorId&&!game.users.get(p.userId)?.isGM;
const getPerson=(userId,actorId)=>db.people.find(p=>p.actorId===(actorId||'')&&authorized(p,userId));
const noTokenPerson=userId=>db.people.find(p=>!requiresToken(p)&&authorized(p,userId));
const surrogateChoices=(selected=[],primary='')=>{
 const options=users().filter(u=>u.id!==primary&&!u.isGM);
 return `<div class="surrogate-picker"><div data-surrogate-tags class="tags">${options.filter(u=>selected.includes(u.id)).map(u=>`<button type="button" data-remove-surrogate="${esc(u.id)}">${esc(u.name)} ×</button>`).join('')||'<span class="small">No surrogates assigned</span>'}</div><details><summary>Manage surrogates (${selected.length})</summary><input type="search" data-surrogate-search placeholder="Find a Foundry account..." aria-label="Search surrogate accounts"><div class="surrogate-list">${options.map(u=>`<label data-surrogate-name="${esc(u.name.toLowerCase())}"><input type="checkbox" data-surrogate value="${esc(u.id)}" ${selected.includes(u.id)?'checked':''}> ${esc(u.name)}</label>`).join('')||'<span class="small">No available accounts</span>'}</div></details></div>`;
};
function updateSurrogateTags(picker){
 if(!picker)return;const selected=[...picker.querySelectorAll('[data-surrogate]:checked')];
 picker.querySelector('[data-surrogate-tags]').innerHTML=selected.map(input=>`<button type="button" data-remove-surrogate="${esc(input.value)}">${esc(game.users.get(input.value)?.name||input.value)} ×</button>`).join('')||'<span class="small">No surrogates assigned</span>';
 picker.querySelector('summary').textContent=`Manage surrogates (${selected.length})`;
}
const checkedSurrogates=el=>[...el.querySelectorAll('input[data-surrogate]:checked')].map(x=>x.value);
const validateSurrogates=(ids,primary,actorId,exceptId='')=>{
 const values=[...new Set(ids)].filter(id=>id!==primary);
 for(const id of values){
   const u=game.users.get(id);if(!u||u.isGM)throw Error('A surrogate account no longer exists or is a GM.');
   const duplicate=db.people.find(p=>p.id!==exceptId&&p.actorId===actorId&&authorized(p,id));
   if(duplicate)throw Error(`${u.name} is already registered for this character on another entry.`);
 }
 return values;
};
const queueUndo=[];
function rememberQueue(){queueUndo.push({current:db.current,queue:[...db.queue],priority:[...db.priority]});if(queueUndo.length>30)queueUndo.shift();}
async function undoQueue(){const before=queueUndo.pop();if(!before)return ui.notifications.info('Nothing to undo this session.');const valid=new Set(db.people.map(p=>p.id));db.current=valid.has(before.current)?before.current:null;db.queue=before.queue.filter(id=>valid.has(id)&&id!==db.current);db.priority=before.priority.filter(id=>valid.has(id));await persist();ui.notifications.info('Speaking queue restored.');}
const state=()=>({tag:TAG,op:'state',state:db});
function broadcast(){game.socket.emit(CHANNEL,state());globalThis.GUILD_SPEAKING_CIRCLE_REFRESH?.(db);}
async function persist(){db.revision=(Number(db.revision)||0)+1;await game.settings.set('world',KEY,copy(db));broadcast();draw();scheduleVoiceSync();}
function validateRequest(msg){
 const user=game.users.get(msg.sender);if(!user||!user.active)return null;
 const actorId=String(msg.actorId||'');
 // The sender may explicitly identify a speaker; we STILL validate authorization here.
 // This prevents a non-token account from impersonating another actor or speaking entry.
 const requested=msg.personId?db.people.find(p=>p.id===msg.personId):null;
 if(msg.personId&&!requested)return null;
 const person=requested||getPerson(msg.sender,actorId)||(!actorId?noTokenPerson(msg.sender):null);
 if(!person||!authorized(person,msg.sender))return null;
 if(!requiresToken(person)){
   // When no token is required, the linked actor is metadata for the name/hand only.
   return person;
 }
 if(!actorId||actorId!==person.actorId)return null;
 const a=game.actors.get(actorId);
 if(!a||a.type!=='character'||(!user.isGM&&!a.testUserPermission(user,'OWNER')))return null;
 return person;
}
async function process(msg){
 if(!msg||msg.tag!==TAG||!msg.sender)return;
 if(msg.op==='sync'){game.socket.emit(CHANNEL,state());return;}
 if(!['raise','lower','finish'].includes(msg.op))return;
 const person=validateRequest(msg);if(!person){game.socket.emit(CHANNEL,{tag:TAG,op:'error',forUser:msg.sender,message:'Select the owned token required for this speaker, or ask the GM to disable Require Selected Token for your account.'});return;}
 const id=person.id;
 rememberQueue();
 if(msg.op==='raise'){
   if(game.users.get(msg.sender)?.isGM){if(!db.priority.includes(id))db.priority.push(id);}
   else if(db.current!==id&&!db.queue.includes(id))db.queue.push(id);
 }else if(msg.op==='lower'){
   db.queue=db.queue.filter(p=>p!==id);db.priority=db.priority.filter(p=>p!==id);if(db.current===id)db.current=null;
 }else if(msg.op==='finish'){
   if(db.current===id)db.current=null;
   else db.queue=db.queue.filter(p=>p!==id);
   db.priority=db.priority.filter(p=>p!==id);
 }
 await persist();
}
const handle=async msg=>{if(!msg||msg.tag!==TAG||msg.op==='state'||msg.op==='error')return;if(busy)return;busy=true;try{await process(msg);}catch(e){console.error('[Speaking Circle GM]',e);}finally{busy=false;}};
game.socket.on(CHANNEL,handle);
const SID='guild-speaking-circle-gm';
let css=document.getElementById(SID+'-css');css?.remove();css=document.createElement('style');css.id=SID+'-css';css.textContent=`
#${SID}-hud{position:fixed;right:18px;bottom:135px;z-index:100050;display:flex;flex-direction:column;gap:6px;align-items:center;pointer-events:none}
#${SID}-hud [data-drag-handle]{pointer-events:auto;cursor:grab;touch-action:none;user-select:none;background:transparent;color:#f8e3af;text-shadow:0 2px 5px black;font-size:22px;line-height:1;padding:6px 12px;border:0}
#${SID}-hud [data-drag-handle]:active{cursor:grabbing}
#${SID}-hud button{pointer-events:auto;min-width:76px;padding:9px 10px;background:#2e2922;border:1px solid #c6a263;color:#f8e3af;border-radius:11px;cursor:pointer;font:12px Georgia,serif;box-shadow:0 2px 12px #0009}
#${SID}-hud button:hover{background:#59432d}
#${SID}-hud .manual-panel{pointer-events:auto;width:205px;padding:9px;background:transparent;display:flex;flex-direction:column;gap:5px;color:#f8e3af;font:12px Georgia,serif;text-shadow:0 1px 2px #000}
#${SID}-hud .manual-panel select{width:100%;min-width:0;background:#292b26;border:1px solid #ac8d55;color:#f7e6c4;border-radius:6px;padding:6px;font:12px Georgia,serif;pointer-events:auto}
#${SID}-hud .manual-panel button{padding:6px 7px;min-width:0}
#${SID}-hud .manual-panel .queue-row{display:grid;grid-template-columns:minmax(0,1fr) repeat(4,25px);gap:3px;align-items:center}
#${SID}-hud .manual-panel .queue-row button{padding:3px;min-width:0;font:12px Arial}
#${SID}-hud .manual-panel .queue-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-shadow:0 1px 3px #000}
#${SID}-hud .manual-panel .queue-list{max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:4px}
#${SID}-hud .hud-header{display:flex;gap:4px;justify-content:center;align-items:center;pointer-events:auto}
#${SID}-hud .hud-header button{min-width:32px;padding:5px 8px;font-size:14px}
#${SID}-hud.is-minimized{gap:0}
#${SID}-hud.is-minimized [data-drag-handle]{font-size:19px;padding:4px 8px}
#${SID}-dash{position:fixed;inset:6% 14%;z-index:100075;background:#162720;border:2px solid #af945c;color:#f3ddae;border-radius:13px;display:flex;flex-direction:column;box-shadow:0 18px 65px #000c;font:13px Georgia,serif}
#${SID}-dash *{box-sizing:border-box}#${SID}-dash header{padding:18px;background:#24372c;border-bottom:1px solid #a38c5e}#${SID}-dash main{padding:16px;overflow:auto;flex:1}
#${SID}-dash input,#${SID}-dash select{width:100%;background:#10241d;color:#ffe6b6;border:1px solid #8f805b;border-radius:5px;padding:8px}
#${SID}-dash button{background:#395346;color:#fff0cc;border:1px solid #a28d62;border-radius:6px;padding:8px 11px;cursor:pointer}
#${SID}-dash .grid{display:grid;grid-template-columns:1fr 1fr 2fr auto;align-items:end;gap:8px}
#${SID}-dash .person{border-bottom:1px solid #576c59;padding:9px 0}#${SID}-dash label{display:block;color:#dec78e;font:12px Arial;margin:5px 0}
#${SID}-dash .actions{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}#${SID}-dash .small{color:#c3b59b;font:12px/1.5 Arial}
#${SID}-dash{inset:5% 12%;min-width:580px;min-height:320px;resize:both;overflow:hidden}
#${SID}-dash header{padding:12px 16px}#${SID}-dash main{padding:12px 16px}
#${SID}-dash .tabs{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}
#${SID}-dash .tabs button{padding:7px 11px;background:#24382d}
#${SID}-dash .tabs button.active{background:#bb9857;color:#1a251d;font-weight:bold}
#${SID}-dash [data-panel]{display:none}#${SID}-dash [data-panel].active{display:block}
#${SID}-dash .status-bar{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 12px}
#${SID}-dash .status-bar span{padding:6px;border:1px solid #657e61;border-radius:7px;background:#263f32}
#${SID}-dash .toolbar{display:flex;gap:7px;flex-wrap:wrap;align-items:center;margin:8px 0}
#${SID}-dash .toolbar input[type=search]{flex:1;min-width:170px}
#${SID}-dash .roster{max-height:53vh;overflow:auto;display:flex;flex-direction:column;gap:6px}
#${SID}-dash .person-card{padding:8px;border:1px solid #576e5b;border-radius:8px;background:#1c3026}
#${SID}-dash .person-head{display:flex;align-items:center;flex-wrap:wrap;gap:8px}
#${SID}-dash .person-head .info{flex:1;min-width:110px}
#${SID}-dash .person-head small{display:block;font:11px Arial;color:#bbccb9;margin-top:3px}
#${SID}-dash .person-head button{padding:6px}
#${SID}-dash .person-edit{border-top:1px solid #536956;padding-top:8px;margin-top:8px}
#${SID}-dash .person-edit .grid{grid-template-columns:1fr 1fr;align-items:start}
#${SID}-dash .queue-entry{display:flex;align-items:center;gap:8px;margin:5px 0;padding:8px;border:1px solid #536a55;background:#1d382b;border-radius:7px}
#${SID}-dash .queue-entry[draggable=true]{cursor:grab}
#${SID}-dash .queue-entry.drag-target{outline:2px solid #e9c06f}
#${SID}-dash .queue-entry .info{flex:1;min-width:50px}
#${SID}-dash .queue-entry button{padding:5px}
#${SID}-dash .surrogate-picker{padding:8px;border:1px solid #516b56;border-radius:6px}
#${SID}-dash .surrogate-picker summary{cursor:pointer;color:#f0d69d}
#${SID}-dash .surrogate-picker .tags{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px}
#${SID}-dash .surrogate-picker .tags button{padding:4px 6px}
#${SID}-dash .surrogate-list{max-height:130px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
#${SID}-dash .surrogate-list label{display:flex;align-items:center;gap:5px}
#${SID}-dash .surrogate-list label[hidden]{display:none}
#${SID}-dash .voice-panel{border:1px solid #a38c59;background:#1d3225;padding:12px;border-radius:7px}
#${SID}-dash .help details{border:1px solid #536c59;border-radius:7px;padding:8px;margin:7px 0}
#${SID}-dash .help summary{cursor:pointer;color:#f1d59a;font-weight:bold}
#${SID}-dash input[type=checkbox]{width:auto;accent-color:#b89a60}
@media(max-width:780px){#${SID}-dash{inset:2%;min-width:0}#${SID}-dash .grid{grid-template-columns:1fr 1fr}}
`;document.head.append(css);
let hud=document.createElement('div');hud.id=SID+'-hud';document.body.append(hud);
let dash=null;
let hudQueueOpen=true, hudPersonSelection='', hudQueuePlacement='end';
// Local display preference. Minimizing never changes the shared speaking queue.
const GM_MIN_KEY='guildSpeakingCircle.gmHud.minimized.v1.'+USERID;
let hudMinimized=false;
try{hudMinimized=localStorage.getItem(GM_MIN_KEY)==='1';}catch(e){console.warn('[Speaking Circle GM] Could not load collapsed state',e);}

// GM controls are movable without creating a popup or affecting anyone else's screen.
const GM_POS_KEY='guildSpeakingCircle.gmHud.position.v1.'+USERID;
function restoreGMHud(){
 try{const pos=JSON.parse(localStorage.getItem(GM_POS_KEY)||'null');if(!pos)return;
 const w=hud.getBoundingClientRect().width,h=hud.getBoundingClientRect().height;
 hud.style.left=Math.min(Math.max(0,Number(pos.x)||0),Math.max(0,window.innerWidth-w))+'px';
 hud.style.top=Math.min(Math.max(0,Number(pos.y)||0),Math.max(0,window.innerHeight-h))+'px';
 hud.style.right='auto';hud.style.bottom='auto';
 }catch(e){console.warn('[Speaking Circle GM] HUD position could not be restored',e);}
}
let gmDrag=null;
hud.addEventListener('pointerdown',e=>{
 const grip=e.target.closest('[data-drag-handle]');if(!grip||e.button!==0)return;
 e.preventDefault();const rect=hud.getBoundingClientRect();
 gmDrag={id:e.pointerId,dx:e.clientX-rect.left,dy:e.clientY-rect.top};
 hud.style.left=rect.left+'px';hud.style.top=rect.top+'px';hud.style.right='auto';hud.style.bottom='auto';
 grip.setPointerCapture?.(e.pointerId);
});
hud.addEventListener('pointermove',e=>{
 if(!gmDrag||gmDrag.id!==e.pointerId)return;
 hud.style.left=Math.min(Math.max(0,e.clientX-gmDrag.dx),Math.max(0,window.innerWidth-hud.offsetWidth))+'px';
 hud.style.top=Math.min(Math.max(0,e.clientY-gmDrag.dy),Math.max(0,window.innerHeight-hud.offsetHeight))+'px';
});
const finishGmDrag=e=>{
 if(!gmDrag||gmDrag.id!==e.pointerId)return;gmDrag=null;
 try{localStorage.setItem(GM_POS_KEY,JSON.stringify({x:parseFloat(hud.style.left),y:parseFloat(hud.style.top)}));}
 catch(error){console.warn('[Speaking Circle GM] HUD position not saved',error);}
};
hud.addEventListener('pointerup',finishGmDrag);hud.addEventListener('pointercancel',finishGmDrag);
function imageMarkup(p){return p.image?`<img src="${esc(p.image)}" style="width:40px;height:40px;object-fit:contain" onerror="this.style.display='none'">`:'✋';}
function optionsPeople(){return db.people.map(p=>`<option value="${esc(p.id)}">${esc(p.label)}</option>`).join('');}
function draw(){
 const cur=db.people.find(p=>p.id===db.current),queue=db.queue.map(id=>db.people.find(p=>p.id===id)).filter(Boolean);
 const prio=db.priority.map(id=>db.people.find(p=>p.id===id)).filter(Boolean);
 const hudEntry=(id,tag)=>{const p=db.people.find(x=>x.id===id);if(!p)return '';
  const isCurrent=db.current===id;
  return `<div class="queue-row"><span title="${esc(p.label)}">${tag} ${esc(p.label)}</span><button data-manual-move="${esc(id)}" data-direction="up" title="Move earlier" ${isCurrent?'disabled':''}>▲</button><button data-manual-move="${esc(id)}" data-direction="down" title="Move later" ${isCurrent?'disabled':''}>▼</button><button data-manual-current="${esc(id)}" title="Make current" ${isCurrent?'disabled':''}>★</button><button data-manual-remove="${esc(id)}" title="Remove">✕</button></div>`;};
 if(!db.people.some(p=>p.id===hudPersonSelection))hudPersonSelection=db.people[0]?.id||'';
 const hudQueueMarkup=hudQueueOpen?`<div class="manual-panel">
  <label for="${SID}-person">Raise hand for:</label>
  <select id="${SID}-person" data-hud-person>${db.people.map(p=>`<option value="${esc(p.id)}" ${p.id===hudPersonSelection?'selected':''}>${esc(p.label)}</option>`).join('')}</select>
  <select data-hud-position><option value="end" ${hudQueuePlacement==='end'?'selected':''}>End of Queue</option><option value="front" ${hudQueuePlacement==='front'?'selected':''}>Next in Queue</option><option value="current" ${hudQueuePlacement==='current'?'selected':''}>Current Speaker</option></select>
  <button data-manual-add>✋ Raise Selected Hand</button>
  <div style="font-weight:bold">Speaking Order (${db.queue.length+(db.current?1:0)})</div>
  <div class="queue-list">${db.priority.map(id=>hudEntry(id,'DM')).join('')}${db.current?hudEntry(db.current,'★'):''}${db.queue.map((id,i)=>hudEntry(id,String(i+1)+'.')).join('')}${!db.current&&!db.queue.length&&!db.priority.length?'<span>Queue is empty</span>':''}</div>
  <button data-gm-act="dashboard">⚙ Full Dashboard</button>
  </div>`:'';
 hud.classList.toggle('is-minimized',hudMinimized);
 const gmHeader=`<div class="hud-header"><div data-drag-handle title="Drag GM controls" aria-label="Drag GM controls">⠿</div><button type="button" data-hud-minimize title="${hudMinimized?'Restore':'Minimize'} GM controls" aria-label="${hudMinimized?'Restore':'Minimize'} GM controls">${hudMinimized?'▣':'−'}</button></div>`;
 hud.innerHTML=gmHeader+(hudMinimized?'':`<button data-gm-act="priority">✋ DM Priority ${prio.some(p=>p.userId===USERID)?'✓':''}</button><button data-gm-act="current">Current</button><button data-gm-act="next">Next ▶</button><button data-gm-act="undo" title="Undo last queue action">↶ Undo</button><button data-auto-hud="toggle">${autoEnabled()?'✋ Hide Hands for Everyone':'✋ Show Hands for Everyone'}</button><button data-hud-queue-toggle>${hudQueueOpen?'▴ Hide Queue Controls':'☷ Manage Queue'}</button>${hudQueueMarkup}<button data-gm-act="dashboard">⚙ Configure</button><button data-gm-act="clear">Clear</button>`);
 renderManualQueue();
 if(dash){const status=dash.querySelector('[data-status]');if(status)status.innerHTML=`<b>Priority:</b> ${esc(prio.map(p=>p.label).join(', ')||'None')} &nbsp; <b>Current:</b> ${esc(cur?.label||'None')} &nbsp; <b>Waiting:</b> ${esc(queue.map(p=>p.label).join(' → ')||'Nobody')}`;}
}
function renderManualQueue(){
 if(!dash)return;
 const sel=dash.querySelector('[data-manual-person]');if(sel){const old=sel.value;sel.innerHTML=optionsPeople();if(db.people.some(p=>p.id===old))sel.value=old;}
 const container=dash.querySelector('[data-manual-queue]');if(!container)return;
 const row=(id,label,waiting)=>{const p=db.people.find(p=>p.id===id);if(!p)return '';
 return `<div class="queue-entry" data-queue-id="${esc(id)}" ${waiting?'draggable="true"':''}><span title="${waiting?'Drag to reorder':'Current speaker'}">${waiting?'⠿':'★'}</span>${imageMarkup(p)}<span class="info">${esc(label)} <strong>${esc(p.label)}</strong> <small>${game.users.get(p.userId)?.active?'● Online':'○ Offline'}</small></span><button data-manual-move="${esc(id)}" data-direction="up" title="Move earlier" ${!waiting?'disabled':''}>▲</button><button data-manual-move="${esc(id)}" data-direction="down" title="Move later" ${!waiting?'disabled':''}>▼</button><button data-manual-current="${esc(id)}" title="Make current">★</button><button data-manual-remove="${esc(id)}" title="Remove from queue">✕</button></div>`;};
 container.innerHTML=`<div class="small">DM Priority: ${esc(db.priority.map(id=>db.people.find(p=>p.id===id)?.label).filter(Boolean).join(', ')||'None')}</div>`+(db.current?row(db.current,'Current:',false):'<p class="small">No current speaker</p>')+db.queue.map((id,i)=>row(id,'#'+(i+1),true)).join('')+(!db.queue.length?'<p class="small">No waiting speakers</p>':'');
 updateSummary();
}
function updateSummary(){const target=dash?.querySelector('[data-dashboard-summary]');if(!target)return;
 const online=db.people.filter(p=>game.users.get(p.userId)?.active).length;
 target.innerHTML=`<span>${db.people.length} speakers</span><span>${online} online</span><span>${db.queue.length} waiting</span><span>Current: ${esc(db.people.find(p=>p.id===db.current)?.label||'None')}</span><span>Discord: ${voiceCfg.enabled?'Enabled':'Off'}</span>`;
}
function moveQueuePerson(id,direction){
 // Reorder waiting speakers without overriding DM priority.
 const i=db.queue.indexOf(id);if(i<0)return false;
 const next=i+(direction==='up'?-1:1);if(next<0||next>=db.queue.length)return false;
 [db.queue[i],db.queue[next]]=[db.queue[next],db.queue[i]];return true;
}
const TAB_KEY='guildSpeakingCircle.dashboard.tab.'+(game.world?.id||'world')+'.'+USERID;
const SIZE_KEY='guildSpeakingCircle.dashboard.size.'+(game.world?.id||'world')+'.'+USERID;
let selectedTab='queue';try{selectedTab=localStorage.getItem(TAB_KEY)||'queue';}catch{}
let rosterSearch='';
function setTab(tab){if(!dash)return;selectedTab=tab;try{localStorage.setItem(TAB_KEY,tab);}catch{};dash.querySelectorAll('[data-panel]').forEach(x=>x.classList.toggle('active',x.dataset.panel===tab));dash.querySelectorAll('.tabs [data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));}
function dashboard(){
 dash?.remove();dash=document.createElement('section');dash.id=SID+'-dash';dash.setAttribute('role','dialog');dash.setAttribute('aria-label','The Speaking Hand GM Dashboard');
 dash.innerHTML=`<header><button style="float:right" data-close>✕ Close</button><h2 style="margin:0;color:#f0d799">✋ The Speaking Hand <span class="small">by DM Wicked · v1.14.0</span></h2>
 <nav class="tabs">${[['queue','Queue'],['speakers','Speakers'],['add','Add Speaker'],['discord','Discord'],['settings','Settings & Backup'],['help','Help']].map(([id,name])=>`<button type="button" data-tab="${id}">${name}</button>`).join('')}</nav></header><main>
 <div class="status-bar" data-dashboard-summary aria-live="polite"></div>
 <section data-panel="queue"><h3>Speaking Queue</h3><p class="small">Drag waiting speakers into the desired order, or use ▲ ▼. Players' own hand requests can also be reordered.</p>
 <div class="toolbar"><button data-gm-act="current">Current</button><button data-gm-act="next">Next ▶</button><button data-gm-act="undo">↶ Undo</button><button data-gm-act="clear">Clear</button><button data-auto-hud="toggle">${autoEnabled()?'Hide Hands for Everyone':'Show Hands for Everyone'}</button></div><p data-status class="small"></p>
 <div class="toolbar"><select data-manual-person style="flex:2;min-width:160px">${optionsPeople()}</select><select data-manual-position style="flex:1;min-width:120px"><option value="end">End of Queue</option><option value="front">Next</option><option value="current">Current</option></select><button data-manual-add>✋ Raise Hand</button></div><div data-manual-queue></div></section>
 <section data-panel="speakers"><h3>Registered Speakers</h3><div class="toolbar"><input type="search" data-speaker-search placeholder="Search speakers, players, surrogates..." value="${esc(rosterSearch)}"><button data-tab="add">+ Add Speaker</button><button data-export>Export</button></div>
 <div class="toolbar"><label><input type="checkbox" data-batch-all> Select all visible</label><select style="width:auto" data-batch-action><option value="">Batch action...</option><option value="require">Require Token</option><option value="optional">No Token Required</option><option value="withdraw">Remove from Queue</option><option value="delete">Delete Speakers</option></select><button data-batch-apply>Apply Selected</button></div>
 <p data-people-count class="small"></p><div data-people class="roster"></div></section>
 <section data-panel="add"><h3>Add New Speaker</h3><form data-add><div class="grid">
 <div><label>Foundry Account</label><select name="userId" required>${users().map(u=>`<option value="${esc(u.id)}">${esc(u.name)}${u.isGM?' (GM)':''}</option>`).join('')}</select></div>
 <div><label>Character / Token Actor</label><select name="actorId"><option value="">None (account-only)</option>${actors().map(a=>`<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</select></div>
 <div><label>Hand Image — Forge Assets</label><input name="image" placeholder="Select or upload from Forge Assets"/><div class="actions"><button type="button" data-browse-new>Browse Forge Assets</button><button type="button" data-upload-new>⬆ Upload Hand Image</button></div><div data-new-preview class="small">No image selected</div></div>
 <button type="submit" data-add-submit>Add Person</button></div>
 <div style="margin:9px 0;padding:9px;border:1px solid #667a64;border-radius:7px"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" name="requireToken" style="width:auto" ${!game.users.get(users()[0]?.id)?.isGM?'checked':''}> <b>Require Selected Token to Raise Hand</b></label><p class="small">Uncheck for the Dungeon Master, a narrator, or someone without token access. The linked character (if any) still supplies the hand/name. Checked accounts need to select an owned character token.</p></div>
 <div style="margin:12px 0;border:1px solid #667a64;padding:9px;border-radius:7px"><label><b>Surrogate Foundry Accounts (optional; select any number)</b></label><div data-add-surrogates style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:3px">${surrogateChoices([],users()[0]?.id||'')}</div><p class="small">Each surrogate shares this character's hand and one speaking-queue position. To select/control the token, grant that surrogate Owner permission on its Actor in Foundry.</p></div><div data-add-feedback role="status" aria-live="polite" style="margin-top:9px;color:#f5d491;font:13px/1.5 Arial;min-height:20px">Ready to add another person.</div></form>
</section>
 <section data-panel="discord"> <section class="voice-panel">
 <h3 style="color:#f4d799">Discord Voice Control (Optional)</h3>
 <p class="small">Connect a separately hosted Discord bot/bridge. Foundry never receives the Discord bot token. Only this GM browser stores the access key and Discord account links. Enable only after the bot is online and your players have agreed to voice moderation.</p>
 <label>Bridge URL (public HTTPS address)</label><input name="voice-url" placeholder="https://your-discord-bot.example.com" value="${esc(voiceCfg.url)}">
 <label>Bridge access key (keep private)</label><input type="password" name="voice-key" autocomplete="off" placeholder="Long secret from your bot host" value="${esc(voiceCfg.key)}">
 <label>Always-unmuted GM Discord account IDs (comma separated)</label><input name="voice-gms" placeholder="123456789012345678" value="${esc(voiceCfg.gmIds)}">
 <h4 style="margin:12px 0 5px;color:#e5cf9a">Character → Discord Account</h4>
 <div data-voice-rows style="max-height:220px;overflow:auto;border:1px solid #526c59;padding:7px"></div>
 <div class="actions"><button type="button" data-voice-save>Save Discord Configuration</button><button type="button" data-voice-test>Test Bot Connection</button><button type="button" data-voice-members>List Users in Voice Channel</button></div>
 <div class="actions"><button type="button" data-voice-enable>Enable Automatic Voice Muting</button><button type="button" data-voice-disable>Disable &amp; Release Mutes</button><button type="button" data-voice-emergency style="background:#733838">Emergency Unmute Everyone Managed</button></div>
 <p class="small" data-voice-feedback aria-live="polite">${esc(lastVoiceFeedback)}</p>
 <p class="small">Only mapped voice participants are affected. When no speaker is designated, the bot releases its mutes. If this GM client stops sending a heartbeat, the bot releases them after its configured timeout. It cannot override users' own self-mute.</p>
 </section>
</section>
 <section data-panel="settings"><h3>Assignment Backup & Restore</h3><p class="small">Exports assignments, hand image paths, token permissions and surrogates. No Discord credentials are included.</p><div class="actions"><button data-export>Export Assignments JSON</button><button data-import>Import Assignments JSON</button><input type="file" data-import-file accept=".json,application/json" hidden></div>
 <p class="small">Import merges by registration ID, preserving unmatched speakers and current speaking order. Confirm replacements before applying.</p>
 <h3>Notifications and Display</h3><p class="small">Players can enable sounds individually. Browser restrictions may prevent playback until they interact with Foundry.</p>
 <div class="toolbar"><label><input type="checkbox" data-audio-toggle ${game.settings.get(AUTO_MODULE,'audioCues')?'checked':''}> Play sound on this device</label><label>Volume <input style="width:120px" type="range" data-audio-volume min="0" max="1" step=".05" value="${game.settings.get(AUTO_MODULE,'audioVolume')}"></label></div>
 <p class="small">Other client display preferences are in Game Settings → Configure Settings → Module Settings → The Speaking Hand.</p><div class="actions"><button data-auto-hud="toggle">${autoEnabled()?'Hide Hands for Everyone':'Show Hands for Everyone'}</button></div></section>
 <section data-panel="help" class="help"><h3>Speaking Hand Help</h3><details open><summary>Raising and lowering hands</summary><p>Players click once to raise their hand and again to withdraw. Token selection is required only when enabled for that speaker.</p></details>
 <details><summary>Queue order, Current and DM Priority</summary><p>GM can reorder anyone waiting; the Current speaker is granted the floor. DM Priority overrides the current speaker until withdrawn. Undo restores a recent speaking queue change for the current GM session.</p></details>
 <details><summary>Surrogates</summary><p>Open Edit on a registered speaker, expand Manage Surrogates and search the accounts. Token-required entries still require Actor OWNER permission for surrogate accounts.</p></details>
 <details><summary>Backup</summary><p>Export JSON before upgrades. Imports require the same Foundry user and actor IDs. Discord secrets stay in the GM browser and are never exported.</p></details>
 <details><summary>Discord</summary><p>The separately hosted Discord bot is required. Emergency Unmute remains under Discord and disables automation. Bot connection messages reflect actual feedback.</p></details></section></main>`;
 document.body.append(dash);try{const r=JSON.parse(localStorage.getItem(SIZE_KEY)||'null');if(r){dash.style.width=Math.max(580,Math.min(innerWidth-30,r.w))+'px';dash.style.height=Math.max(320,Math.min(innerHeight-30,r.h))+'px';dash.style.inset='auto';dash.style.left='max(10px, calc((100vw - '+dash.style.width+') / 2))';dash.style.top='max(10px, calc((100vh - '+dash.style.height+') / 2))';}}catch{}
 renderPeople();renderVoiceRows();renderManualQueue();setTab(selectedTab);draw();
}
function renderPeople(){if(!dash)return;
 const counter=dash.querySelector('[data-people-count]');if(counter)counter.textContent=db.people.length+' registered speaker(s)';
 const open=new Set([...dash.querySelectorAll('[data-person] .person-edit:not([hidden])')].map(e=>e.closest('[data-person]').dataset.person));
 const checked=new Set([...dash.querySelectorAll('[data-batch-id]:checked')].map(e=>e.dataset.batchId));
 const shown=db.people.filter(p=>[p.label,game.users.get(p.userId)?.name,game.actors.get(p.actorId)?.name,...(p.surrogateUserIds||[]).map(id=>game.users.get(id)?.name)].some(v=>String(v||'').toLowerCase().includes(rosterSearch.toLowerCase())));
 const area=dash.querySelector('[data-people]');if(!area)return;
 area.innerHTML=shown.map(p=>`<div class="person-card" data-person="${esc(p.id)}"><div class="person-head"><input type="checkbox" data-batch-id="${esc(p.id)}" ${checked.has(p.id)?'checked':''} title="Select speaker">${imageMarkup(p)}<div class="info"><b>${esc(p.label)}</b><small>${esc(game.users.get(p.userId)?.name||'Missing account')} · ${requiresToken(p)?'Token required':'Token optional'} · ${(p.surrogateUserIds||[]).length} surrogate(s) · ${game.users.get(p.userId)?.active?'● Online':'○ Offline'}</small></div>
 <button data-roster-raise="${esc(p.id)}" title="Raise hand at end of queue">✋</button><button data-manual-current="${esc(p.id)}" title="Set current speaker">★</button><button data-person-edit="${esc(p.id)}">${open.has(p.id)?'Close':'Edit'}</button></div>
 <div class="person-edit" ${open.has(p.id)?'':'hidden'}><div class="grid"><div><label>Display Name</label><input data-field="label" value="${esc(p.label)}"></div><div><label>Account / Character</label><p class="small">${esc(game.users.get(p.userId)?.name||'Missing user')} / ${esc(game.actors.get(p.actorId)?.name||(p.actorId?'Missing character':'Account-only'))}</p></div>
 <div><label>Hand Image</label><input data-field="image" value="${esc(p.image||'')}"><div class="actions"><button data-browse="${esc(p.id)}">Browse Forge Assets</button><button data-upload-person="${esc(p.id)}">Upload Image</button></div></div>
 <div><label><input type="checkbox" data-field="requireToken" ${requiresToken(p)?'checked':''}> Require selected token</label></div></div>
 <label>Surrogate Foundry Accounts</label><div data-surrogate-list>${surrogateChoices(p.surrogateUserIds||[],p.userId)}</div><div class="actions"><button data-save-person="${esc(p.id)}">Save Changes</button><button data-delete-person="${esc(p.id)}" style="background:#633536">Delete Speaker</button></div></div></div>`).join('')||'<p class="small">No speakers match that search.</p>';
}
function renderVoiceRows(){
 if(!dash)return;
 const area=dash.querySelector('[data-voice-rows]');if(!area)return;
 area.innerHTML=db.people.map(p=>`<div style="display:flex;gap:9px;align-items:center;margin:5px 0">
 <label style="flex:1;min-width:120px">${esc(p.label)} <small>(${esc(game.users.get(p.userId)?.name||'Deleted user')})</small></label>
 <input style="flex:1" data-voice-person="${esc(p.id)}" placeholder="Discord user ID" value="${esc(voiceCfg.people?.[p.id]||'')}"></div>`).join('')||'<span class="small">Add Foundry characters before linking Discord users.</span>';
}
function captureVoiceForm(){
 if(!dash)throw Error('Open the GM dashboard first.');
 const url=dash.querySelector('[name="voice-url"]').value.trim();
 const key=dash.querySelector('[name="voice-key"]').value.trim();
 const gmIds=dash.querySelector('[name="voice-gms"]').value.trim();
 const people={...voiceCfg.people};
 for(const input of dash.querySelectorAll('[data-voice-person]')){
  const id=input.value.trim();if(id&&!/^\d{16,25}$/.test(id))throw Error('Discord ID for '+(db.people.find(p=>p.id===input.dataset.voicePerson)?.label||'character')+' must be a 16–25 digit number.');
  if(id)people[input.dataset.voicePerson]=id;else delete people[input.dataset.voicePerson];
 }
 if(gmIds&&splitDiscordIds(gmIds).length!==gmIds.split(/[\s,;]+/).filter(Boolean).length)throw Error('GM Discord IDs must be numeric IDs separated by commas.');
 voiceCfg={...voiceCfg,url,key,gmIds,people};saveVoiceCfg();
 voiceFeedback('Discord configuration saved in this GM browser.');
}
async function handleVoiceControl(action){
 try{
  if(action==='save'){captureVoiceForm();return;}
  captureVoiceForm();
  if(action==='test'){
   const x=await voiceRequest('/api/status',null,'GET');
   voiceFeedback(`Discord bot: ${x.online?'online':'offline'}; voice control ${x.enabled?'active':'inactive'}; bot-muted accounts: ${(x.botMuted||[]).length}.`);return;
  }
  if(action==='members'){
   const x=await voiceRequest('/api/voice-members',null,'GET');
   voiceFeedback('Voice members: '+(x.members||[]).map(m=>`${m.name} (${m.id})`).join(' · '));return;
  }
  if(action==='enable'){
   if(!splitDiscordIds(voiceCfg.gmIds).length)throw Error('Enter at least one DM Discord user ID.');
   if(!Object.values(voiceCfg.people).some(id=>/^\d{16,25}$/.test(id)))throw Error('Map at least one character to a Discord user ID.');
   if(!voiceCfg.url||!voiceCfg.key)throw Error('Bridge URL and access key are required.');
   await voiceRequest('/api/status',null,'GET');
   voiceCfg.enabled=true;saveVoiceCfg();scheduleVoiceSync();
   voiceFeedback('Discord voice control enabled. It will take effect when you designate a current speaker.');return;
  }
  if(action==='disable'||action==='emergency'){
   // Disable local automation BEFORE releasing mutes to avoid re-muting in the next heartbeat.
   voiceCfg.enabled=false;saveVoiceCfg();clearTimeout(voiceTimer);
   await voiceRequest('/api/release',{});
   voiceFeedback('Discord Speaking Circle mutes released. Automatic muting disabled.');return;
  }
 }catch(e){voiceFeedback('Discord: '+e.message,true);ui.notifications.warn(e.message);}
}
// Built-in Forge Assets browser. Never silently upload to Foundry Core/Data.
// A native Forge file-source is required for direct upload from the game.
const ForgePicker=()=>foundry.applications?.apps?.FilePicker||globalThis.FilePicker;
const FORGE_SOURCE='forgevtt';
const HAND_FOLDER='guild-hall/speaking-circle';
const browserID='guild-speaking-forge-browser';
const imageType=path=>/\.(png|jpg|jpeg|webp|gif|avif|svg)(?:[?#].*)?$/i.test(String(path||''));
let imageBrowser=null;
function setChosenImage(target,url){
 if(target==='new'){
   const field=dash?.querySelector('form[data-add] [name="image"]');
   if(field){field.value=url;field.dispatchEvent(new Event('input',{bubbles:true}));const preview=dash?.querySelector('[data-new-preview]');if(preview)preview.innerHTML=`<img src="${esc(url)}" alt="Selected hand" style="width:85px;height:85px;object-fit:contain;vertical-align:middle"> <span>Ready to assign when you click Add</span>`;}
 }else{
   const p=db.people.find(x=>x.id===target);
   if(p){p.image=url;persist().then(renderPeople).catch(e=>ui.notifications.error(e.message));}
 }
}
async function openForgeBrowser(target,uploadMode=false){
 imageBrowser?.remove();
 let folder=HAND_FOLDER,files=[],dirs=[],busy=false;
 const Picker=ForgePicker();
 const modal=document.createElement('section');modal.id=browserID;
 modal.style.cssText='position:fixed;inset:6% 15%;z-index:2147483000;background:#13261e;color:#f6e7bf;border:2px solid #c5a368;border-radius:12px;box-shadow:0 25px 80px #000e;display:flex;flex-direction:column;font:13px Georgia,serif;overflow:hidden';
 modal.innerHTML=`<header style="padding:12px 18px;background:#2b3d2f;display:flex;align-items:center;gap:12px"><b style="flex:1;font-size:19px">Forge Assets — Hand Image</b><button type="button" data-forge-close>✕ Close</button></header><div style="padding:12px;display:flex;flex-wrap:wrap;gap:8px;align-items:center"><button type="button" data-forge-up>⬆ Up</button><b data-forge-path style="flex:1;overflow-wrap:anywhere">/</b><button type="button" data-forge-refresh>Refresh</button><button type="button" data-forge-root>Library Root</button><button type="button" data-forge-folder>Hand Folder</button><button type="button" data-forge-upload>⬆ Upload Image Here</button></div><div style="padding:8px 12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><input type="file" data-forge-file accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/svg+xml" style="color:#f4dfaa"><button type="button" data-forge-choose-upload>Upload Selected File</button></div><div data-forge-status style="padding:8px 12px;color:#ecd1a0"></div><main data-forge-list style="flex:1;overflow:auto;padding:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));align-content:start;gap:10px"></main><footer style="padding:10px;border-top:1px solid #725d39">Only The Forge Assets Library is used. Select any thumbnail to assign it immediately.</footer>`;
 document.body.append(modal);imageBrowser=modal;
 const get=(sel)=>modal.querySelector(sel);
 const status=(t)=>{get('[data-forge-status]').textContent=t;};
 const buttonStyle='background:#395346;border:1px solid #b69a65;color:#f5dfad;border-radius:6px;padding:9px;cursor:pointer;';
 for(const btn of modal.querySelectorAll('button'))btn.style.cssText=buttonStyle;
 const imageCard=(url)=>{const el=document.createElement('button');el.type='button';el.style.cssText=buttonStyle+'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;min-height:120px;overflow:hidden;';
   const img=document.createElement('img');img.src=url;img.style.cssText='width:100%;height:95px;object-fit:contain;';img.loading='lazy';
   const label=document.createElement('span');label.textContent=decodeURIComponent(String(url).split('/').pop().split('?')[0]);label.style.cssText='font-size:11px;overflow-wrap:anywhere;';
   el.append(img,label);el.addEventListener('click',()=>{setChosenImage(target,url);modal.remove();imageBrowser=null;ui.notifications.info('Hand image assigned.');});return el;};
 async function refresh(){
   if(!Picker?.browse){status('Foundry FilePicker is unavailable. Open your Forge Assets website and upload there.');return;}
   busy=true;get('[data-forge-list]').replaceChildren();get('[data-forge-path]').textContent=folder;status('Loading Forge Assets Library…');
   try{
     const data=await Picker.browse(FORGE_SOURCE,folder==='/'?'/':folder,{type:'image'});
     dirs=Array.isArray(data?.dirs)?data.dirs:[];files=Array.isArray(data?.files)?data.files:[];
     for(const dir of dirs){const path=typeof dir==='string'?dir:dir?.path||dir?.name||'';const b=document.createElement('button');b.type='button';b.style.cssText=buttonStyle+'min-height:65px';b.textContent='📁 '+String(path).replace(/\/$/,'').split('/').pop();b.addEventListener('click',()=>{folder=path;refresh();});get('[data-forge-list]').append(b);}
     let images=files.map(f=>typeof f==='string'?f:f.path||f.url||'').filter(imageType);
     for(const url of images)get('[data-forge-list]').append(imageCard(url));
     status(`${dirs.length} folders · ${images.length} images. Upload or select an image.`);
   }catch(e){
     status('Forge Assets browsing is not available in this Foundry session: '+e.message);
     const box=document.createElement('div');box.style.cssText='grid-column:1/-1;line-height:1.6';
     box.textContent='Forge has not exposed its Assets Library as a Foundry file source. Upload through The Forge website, then use the image URL in the dashboard. No upload will be attempted to Core Data or User Data.';
     const link=document.createElement('a');link.href='https://forge-vtt.com/assets/';link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open The Forge Assets Library';link.style.cssText='display:block;margin:10px 0;color:#f8d38a;text-decoration:underline';box.append(link);
     get('[data-forge-list]').append(box);
   }finally{busy=false;}
 }
 modal.addEventListener('click',async ev=>{
   if(ev.target.closest('[data-forge-close]')){modal.remove();imageBrowser=null;return;}
   if(ev.target.closest('[data-forge-refresh]')){await refresh();return;}
   if(ev.target.closest('[data-forge-root]')){folder='/';await refresh();return;}
   if(ev.target.closest('[data-forge-folder]')){folder=HAND_FOLDER;await refresh();return;}
   if(ev.target.closest('[data-forge-up]')){if(folder!=='/'){const parts=String(folder).replace(/\/$/,'').split('/').filter(Boolean);parts.pop();folder=parts.length?'/'+parts.join('/'):'/';await refresh();}return;}
   if(ev.target.closest('[data-forge-upload]')){get('[data-forge-file]').click();return;}
   if(ev.target.closest('[data-forge-choose-upload]')){
     const file=get('[data-forge-file]').files?.[0];
     if(!file)return status('Choose a hand image from your computer first.');
     if(!file.type.startsWith('image/')&&!imageType(file.name))return status('Choose a valid image file.');
     if(!Picker?.upload)return status('Forge file upload is unavailable in this Foundry session.');
     const uploadFolder=folder==='/'?HAND_FOLDER:String(folder).replace(/^\/+|\/+$/g,'');
     status('Uploading '+file.name+' into the Forge Assets Library…');
     const uploadButton=get('[data-forge-choose-upload]');uploadButton.disabled=true;
     try{
       const result=await Picker.upload(FORGE_SOURCE,uploadFolder,file);
       const url=typeof result?.path==='string'?result.path:typeof result?.url==='string'?result.url:null;
       if(!url)throw Error('Forge did not return a usable image path.');
       await setChosenImage(target,url);
       modal.remove();imageBrowser=null;
       ui.notifications.info('Hand image uploaded and assigned: '+file.name);
     }catch(e){status('Forge upload failed: '+e.message+' — no image assignment was changed.');console.warn('[Speaking Circle Forge upload]',e);}
     finally{uploadButton.disabled=false;}
     return;
   }
 });
 await refresh();
 get('[data-forge-file]').addEventListener('change',()=>{if(get('[data-forge-file]').files?.length)get('[data-forge-choose-upload]').click();});
 if(uploadMode)get('[data-forge-file]')?.click();
}
async function applyCommand(action){
 if(action==='dashboard'){dashboard();return;}
 if(action==='undo'){await undoQueue();return;}
 rememberQueue();
 if(action==='priority'){
   const gm=db.people.find(p=>p.userId===USERID&&!p.actorId)||db.people.find(p=>p.userId===USERID);
   if(!gm)return ui.notifications.warn('Add a GM speaker entry in the dashboard first.');
   if(db.priority.includes(gm.id))db.priority=db.priority.filter(id=>id!==gm.id);else db.priority.unshift(gm.id);
 }else if(action==='current'){
   if(db.current)return ui.notifications.info('A speaker is already current. Use Next to advance.');
   db.current=db.queue.shift()||null;
 }else if(action==='next'){
   db.current=db.queue.shift()||null;
 }else if(action==='clear'){
   const yes=await foundry.applications.api.DialogV2.confirm({window:{title:'Clear Speaking Queue?'},content:'Remove current speaker and everyone waiting?'});if(!yes)return;
   db.current=null;db.queue=[];db.priority=[];
 }else return;
 await persist();
}
async function onClick(ev){
 const b=ev.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-close')){if(dash)try{localStorage.setItem(SIZE_KEY,JSON.stringify({w:dash.offsetWidth,h:dash.offsetHeight}));}catch{};dash?.remove();dash=null;return;}
 if(b.dataset.voiceSave!==undefined){await handleVoiceControl('save');return;}
 if(b.dataset.voiceTest!==undefined){await handleVoiceControl('test');return;}
 if(b.dataset.voiceMembers!==undefined){await handleVoiceControl('members');return;}
 if(b.dataset.voiceEnable!==undefined){await handleVoiceControl('enable');return;}
 if(b.dataset.voiceDisable!==undefined){await handleVoiceControl('disable');return;}
 if(b.dataset.voiceEmergency!==undefined){await handleVoiceControl('emergency');return;}
 if(b.hasAttribute('data-auto-hud')){await toggleAllHud();return;}
 if(b.dataset.tab){setTab(b.dataset.tab);return;}
 if(b.dataset.personEdit){const row=dash?.querySelector(`[data-person="${b.dataset.personEdit}"]`);const editor=row?.querySelector('.person-edit');if(editor){editor.hidden=!editor.hidden;b.textContent=editor.hidden?'Edit':'Close';}return;}
 if(b.dataset.rosterRaise){const id=b.dataset.rosterRaise;if(!db.people.some(p=>p.id===id))return;rememberQueue();db.queue=db.queue.filter(x=>x!==id);db.priority=db.priority.filter(x=>x!==id);if(db.current===id)db.current=null;db.queue.push(id);await persist();return;}
 if(b.dataset.removeSurrogate){const picker=b.closest('.surrogate-picker'),check=[...(picker?.querySelectorAll('[data-surrogate]')||[])].find(x=>x.value===b.dataset.removeSurrogate);if(check){check.checked=false;updateSurrogateTags(picker);}return;}
 if(b.dataset.export!==undefined){exportAssignments();return;}
 if(b.dataset.import!==undefined){dash?.querySelector('[data-import-file]')?.click();return;}
 if(b.dataset.batchApply!==undefined){await applyBatch();return;}
 if(b.dataset.gmAct){await applyCommand(b.dataset.gmAct);return;}
 if(b.hasAttribute('data-hud-minimize')){
  const rect=hud.getBoundingClientRect();
  const hadCustom=!!hud.style.left;
  hudMinimized=!hudMinimized;
  try{localStorage.setItem(GM_MIN_KEY,hudMinimized?'1':'0');}catch(e){console.warn('[Speaking Circle GM] Could not save collapsed state',e);}
  draw();
  if(hadCustom){
    hud.style.left=Math.max(0,Math.min(rect.left,window.innerWidth-hud.offsetWidth))+'px';
    hud.style.top=Math.max(0,Math.min(rect.top,window.innerHeight-hud.offsetHeight))+'px';
    try{localStorage.setItem(GM_POS_KEY,JSON.stringify({x:parseFloat(hud.style.left),y:parseFloat(hud.style.top)}));}catch(e){}
  }
  return;
 }
 if(b.hasAttribute('data-hud-queue-toggle')){hudQueueOpen=!hudQueueOpen;draw();return;}
 if(b.hasAttribute('data-manual-add')){
  const fromHud=!!b.closest('#'+SID+'-hud');
  const id=fromHud?hud.querySelector('[data-hud-person]')?.value:dash?.querySelector('[data-manual-person]')?.value;
  const place=fromHud?hud.querySelector('[data-hud-position]')?.value:dash?.querySelector('[data-manual-position]')?.value;
  if(!db.people.some(p=>p.id===id))return ui.notifications.warn('Choose a registered speaker first.');
  rememberQueue();db.queue=db.queue.filter(x=>x!==id);db.priority=db.priority.filter(x=>x!==id);
  if(db.current===id)db.current=null;
  if(place==='current'){
   if(db.current&&db.current!==id)db.queue.unshift(db.current);
   db.current=id;
  }else if(place==='front')db.queue.unshift(id);
  else db.queue.push(id);
  await persist();return;
 }
 if(b.dataset.manualMove){if(db.queue.includes(b.dataset.manualMove)){rememberQueue();if(moveQueuePerson(b.dataset.manualMove,b.dataset.direction))await persist();else queueUndo.pop();}return;}
 if(b.dataset.manualCurrent){
  const id=b.dataset.manualCurrent;if(!db.people.some(p=>p.id===id))return;
  rememberQueue();db.queue=db.queue.filter(x=>x!==id);db.priority=db.priority.filter(x=>x!==id);
  if(db.current&&db.current!==id)db.queue.unshift(db.current);
  db.current=id;await persist();return;
 }
 if(b.dataset.manualRemove){
  const id=b.dataset.manualRemove;rememberQueue();db.queue=db.queue.filter(x=>x!==id);db.priority=db.priority.filter(x=>x!==id);
  if(db.current===id)db.current=null;await persist();return;
 }
 if(b.dataset.deletePerson){const p=db.people.find(x=>x.id===b.dataset.deletePerson);if(!p)return;const yes=await foundry.applications.api.DialogV2.confirm({window:{title:'Delete Speaker?'},content:`Remove ${esc(p.label)} from the Speaking Circle?`});if(!yes)return;db.people=db.people.filter(x=>x.id!==p.id);db.queue=db.queue.filter(x=>x!==p.id);db.priority=db.priority.filter(x=>x!==p.id);if(db.current===p.id)db.current=null;await persist();renderPeople();renderVoiceRows();return;}
 if(b.dataset.savePerson){
  const row=dash?.querySelector(`[data-person="${b.dataset.savePerson}"]`),p=db.people.find(x=>x.id===b.dataset.savePerson);if(!row||!p)return;
  try{
    const requested=checkedSurrogates(row);
    const allowed=validateSurrogates(requested,p.userId,p.actorId,p.id);
    // Recheck latest world data before mutating, preserving additions by other GM clients.
    const fresh=read(),saved=fresh.people.find(x=>x.id===p.id);if(!saved)throw Error('Speaker no longer exists. Reopen dashboard.');
    db=fresh;
    const requireToken=!!row.querySelector('[data-field="requireToken"]')?.checked;
    if(requireToken&&!saved.actorId)throw Error('A character must be assigned when Require Selected Token is ON.');
    if(!requireToken&&fresh.people.some(x=>x.id!==saved.id&&!requiresToken(x)&&[saved.userId,...allowed].some(id=>authorized(x,id))))throw Error('A primary or surrogate account already has another token-free speaking entry.');
    saved.requireToken=requireToken;
    saved.surrogateUserIds=allowed;
    saved.label=row.querySelector('[data-field="label"]').value.trim()||saved.label;
    saved.image=row.querySelector('[data-field="image"]').value.trim();
    await persist();renderPeople();renderVoiceRows();ui.notifications.info(`Saved ${saved.label} with ${allowed.length} surrogate(s).`);
  }catch(e){ui.notifications.error('Could not save speaker: '+e.message);}
  return;
 }
 if(b.dataset.browse){await openForgeBrowser(b.dataset.browse);return;}
 if(b.dataset.uploadPerson){await openForgeBrowser(b.dataset.uploadPerson,true);return;}
 if(b.hasAttribute('data-browse-new')){await openForgeBrowser('new');return;}
 if(b.hasAttribute('data-upload-new')){await openForgeBrowser('new',true);return;}
}
function exportAssignments(){const data={format:'the-speaking-hand-assignments',schema:1,exportedAt:new Date().toISOString(),people:copy(db.people)};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='speaking-hand-assignments-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);ui.notifications.info('Speaker assignments exported (no Discord secrets).');}
async function importAssignments(file){if(!file)return;if(file.size>2000000)throw Error('File exceeds the 2 MB limit.');const data=JSON.parse(await file.text());
 if(data?.format!=='the-speaking-hand-assignments'||data.schema!==1||!Array.isArray(data.people)||data.people.length>500)throw Error('Invalid assignment backup.');
 const records=[],seen=new Set();for(const raw of data.people){
  if(!raw||typeof raw.id!=='string'||!raw.id||raw.id.length>128||seen.has(raw.id))throw Error('Invalid or duplicate speaker ID.');seen.add(raw.id);
  if(!game.users.get(raw.userId))throw Error('Missing Foundry account: '+raw.label);
  if(raw.actorId&&!game.actors.get(raw.actorId))throw Error('Missing character Actor: '+raw.label);
  if(String(raw.image||'').length>2048||String(raw.label||'').length>200)throw Error('Oversized field for '+raw.id);
  const surrogateUserIds=Array.isArray(raw.surrogateUserIds)?[...new Set(raw.surrogateUserIds)].filter(id=>id!==raw.userId):[];
  for(const id of surrogateUserIds)if(!game.users.get(id)||game.users.get(id).isGM)throw Error('Invalid surrogate account: '+id);
  const requireToken=raw.requireToken===undefined?!!raw.actorId&&!game.users.get(raw.userId)?.isGM:!!raw.requireToken;
  if(requireToken&&!raw.actorId)throw Error('Token required but Actor missing: '+raw.label);
  records.push({id:raw.id,userId:raw.userId,actorId:raw.actorId||'',label:String(raw.label||'Speaker'),image:String(raw.image||''),requireToken,surrogateUserIds});
 }
 const matches=records.filter(p=>db.people.some(x=>x.id===p.id)).length;
 const yes=await foundry.applications.api.DialogV2.confirm({window:{title:'Import Speaking Hand Assignments?'},content:`Import ${records.length} registrations? ${matches} matching entries will be replaced. Existing queue order stays unchanged.`});if(!yes)return;
 const previous=copy(db);try{db=read();const entries=new Map(db.people.map(p=>[p.id,p]));records.forEach(p=>entries.set(p.id,p));
  const merged=[...entries.values()],optional=new Set();for(const p of merged){if(!requiresToken(p)){for(const uid of [p.userId,...(p.surrogateUserIds||[])]){if(optional.has(uid))throw Error('Conflicting token-free entries for one Foundry account.');optional.add(uid);}}}
  db.people=merged;await persist();renderPeople();renderVoiceRows();ui.notifications.info('Imported '+records.length+' speaker assignments.');
 }catch(e){db=previous;throw e;}
}
async function applyBatch(){const ids=[...dash.querySelectorAll('[data-batch-id]:checked')].map(e=>e.dataset.batchId),action=dash.querySelector('[data-batch-action]').value;
 if(!ids.length||!action)return ui.notifications.warn('Select a batch action and at least one speaker.');
 if(action==='delete'||action==='optional'){const yes=await foundry.applications.api.DialogV2.confirm({window:{title:'Confirm Batch Action'},content:`Apply ${esc(action)} to ${ids.length} selected speaker(s)?`});if(!yes)return;}
 const previous=copy(db);try{db=read();const selected=db.people.filter(p=>ids.includes(p.id));
  if(action==='require'){if(selected.some(p=>!p.actorId))throw Error('Some speakers have no character Actor.');selected.forEach(p=>p.requireToken=true);}
  else if(action==='optional'){const optional=new Set();for(const p of db.people){if(ids.includes(p.id)||!requiresToken(p)){for(const uid of [p.userId,...(p.surrogateUserIds||[])]){if(optional.has(uid))throw Error('Conflicting token-free accounts.');optional.add(uid);}}}selected.forEach(p=>p.requireToken=false);}
  else if(action==='withdraw'){rememberQueue();db.current=ids.includes(db.current)?null:db.current;db.queue=db.queue.filter(id=>!ids.includes(id));db.priority=db.priority.filter(id=>!ids.includes(id));}
  else if(action==='delete'){rememberQueue();db.people=db.people.filter(p=>!ids.includes(p.id));db.current=ids.includes(db.current)?null:db.current;db.queue=db.queue.filter(id=>!ids.includes(id));db.priority=db.priority.filter(id=>!ids.includes(id));}
  await persist();renderPeople();renderVoiceRows();ui.notifications.info('Updated '+ids.length+' speakers.');
 }catch(e){db=previous;ui.notifications.error('Batch action failed: '+e.message);}
}
let dragId=null;
const dragStart=e=>{const row=e.target.closest?.('#'+SID+'-dash [data-queue-id][draggable]');if(!row)return;dragId=row.dataset.queueId;e.dataTransfer?.setData('text/plain',dragId);if(e.dataTransfer)e.dataTransfer.effectAllowed='move';};
const dragOver=e=>{const row=e.target.closest?.('#'+SID+'-dash [data-queue-id][draggable]');if(row&&dragId){e.preventDefault();row.classList.add('drag-target');}};
const dragLeave=e=>{e.target.closest?.('#'+SID+'-dash .drag-target')?.classList.remove('drag-target');};
const drop=async e=>{const row=e.target.closest?.('#'+SID+'-dash [data-queue-id][draggable]');if(!row||!dragId)return;e.preventDefault();const from=db.queue.indexOf(dragId),to=db.queue.indexOf(row.dataset.queueId);dragId=null;if(from<0||to<0||from===to)return;rememberQueue();const [item]=db.queue.splice(from,1);db.queue.splice(to,0,item);await persist();};
const dragEnd=()=>{dragId=null;dash?.querySelectorAll('.drag-target').forEach(x=>x.classList.remove('drag-target'));};
for(const [name,fn] of Object.entries({dragstart:dragStart,dragover:dragOver,dragleave:dragLeave,drop,dragend:dragEnd}))document.addEventListener(name,fn);
hud.addEventListener('change',e=>{
 if(e.target.matches('[data-hud-person]'))hudPersonSelection=e.target.value;
 if(e.target.matches('[data-hud-position]'))hudQueuePlacement=e.target.value;
});
hud.addEventListener('click',onClick);
const docClick=async ev=>{if(dash?.contains(ev.target))await onClick(ev);};
document.addEventListener('click',docClick);
// Capture-phase submit handling prevents Foundry UI handlers from swallowing the form event.
// Always give visible feedback instead of failing silently (especially on the 11th+ entry).
let addInProgress=false;
const docSubmit=async ev=>{
 const form=ev.target;
 if(!dash?.contains(form)||!form.matches('form[data-add]'))return;
 ev.preventDefault();ev.stopPropagation();
 const feedback=form.querySelector('[data-add-feedback]');
 const button=form.querySelector('[data-add-submit]');
 const report=(message,error=false)=>{
   if(feedback){feedback.textContent=message;feedback.style.color=error?'#ffb5a8':'#d2f2b1';}
   if(error)ui.notifications.warn(message);
 };
 if(addInProgress)return report('Already saving this person. Please avoid pressing Add again.');
 addInProgress=true;if(button){button.disabled=true;button.textContent='Saving…';}
 try{
   const f=new FormData(form);
   const userId=String(f.get('userId')||'');
   const actorId=String(f.get('actorId')||'');
   const image=String(f.get('image')||'').trim();
   const requireToken=f.get('requireToken')==='on';
   const user=game.users.get(userId),actor=actorId?game.actors.get(actorId):null;
   if(!user)return report('Please select a valid Foundry account.',true);
   if(requireToken&&!actor)return report('Select a character Actor or uncheck Require Selected Token.',true);
   if(actor&&actor.type!=='character')return report('Selected Actor is not a character.',true);
   if(requireToken&&!user.isGM&&!actor.testUserPermission(user,'OWNER'))return report(`${user.name} needs Owner permission for ${actor.name}; otherwise disable Require Selected Token.`,true);
   if(!requireToken&&db.people.some(p=>!requiresToken(p)&&authorized(p,userId)))return report(`${user.name} already has a no-token speaking entry. Edit that assignment instead.`,true);
   if(getPerson(userId,actorId))return report(`Already registered: ${user.name} / ${actor?.name||'GM'}. Select a different account or character, or edit the existing entry above.`,true);
   // Re-read current database before appending so the new entry cannot clobber
   // another recent edit made in a separate GM browser.
   const fresh=read();
   if(fresh.people.some(p=>p.userId===userId&&p.actorId===actorId)||(!requireToken&&fresh.people.some(p=>!requiresToken(p)&&authorized(p,userId))))return report('This account/character or token-free assignment already exists. Reopen the dashboard.',true);
   const requested=checkedSurrogates(form);
   const surrogateUserIds=validateSurrogates(requested,userId,actorId);
   if(!requireToken&&fresh.people.some(p=>!requiresToken(p)&&[userId,...surrogateUserIds].some(id=>authorized(p,id))))return report('A selected account or surrogate already has a token-free speaker. Edit that entry first.',true);
   const label=actor?.name||user.name;
   const entry={id:unique(),userId,actorId,image,label,requireToken,surrogateUserIds};
   const previous=copy(db);
   db=fresh;
   db.people.push(entry);
   try{await persist();}
   catch(e){db=previous;throw e;}
   // Confirm the record survived an actual world-setting round trip.
   const saved=read().people.some(p=>p.id===entry.id);
   if(!saved)throw Error('The entry did not appear in the saved Foundry world settings.');
   renderPeople();renderVoiceRows();form.reset();
   const preview=form.querySelector('[data-new-preview]');if(preview)preview.textContent='No image selected';
   report(`Saved ${label} for ${user.name}, with ${surrogateUserIds.length} surrogate(s). ${read().people.length} registered speakers.`);
   ui.notifications.info(`Speaking Circle: ${label} added successfully.`);
 }catch(e){console.error('[Speaking Circle Add Person]',e);report('Could not save person: '+(e?.message||String(e)),true);}
 finally{addInProgress=false;if(button){button.disabled=false;button.textContent='Add Person';}}
};
document.addEventListener('submit',docSubmit,true);
const docChange=ev=>{
 if(ev.target.matches('#'+SID+'-dash [data-surrogate]')){updateSurrogateTags(ev.target.closest('.surrogate-picker'));return;}
 if(ev.target.matches('#'+SID+'-dash [data-batch-all]')){dash?.querySelectorAll('[data-batch-id]').forEach(x=>x.checked=ev.target.checked);return;}
 if(ev.target.matches('#'+SID+'-dash [data-audio-toggle]')){void game.settings.set(AUTO_MODULE,'audioCues',ev.target.checked);return;}
 if(ev.target.matches('#'+SID+'-dash [data-audio-volume]')){void game.settings.set(AUTO_MODULE,'audioVolume',Number(ev.target.value));return;}
 if(ev.target.matches('#'+SID+'-dash [data-import-file]')){const f=ev.target.files?.[0];if(f)void importAssignments(f).catch(error=>ui.notifications.error('Import failed: '+error.message));ev.target.value='';return;}
 if(!ev.target.matches('#'+SID+'-dash form[data-add] select[name="userId"]'))return;
 const area=dash?.querySelector('[data-add-surrogates]');if(!area)return;
 const prior=checkedSurrogates(area);
 area.innerHTML=surrogateChoices(prior,ev.target.value);
 const check=dash?.querySelector('form[data-add] [name="requireToken"]');
 if(check)check.checked=!game.users.get(ev.target.value)?.isGM;
};
document.addEventListener('change',docChange);
const docInput=e=>{
 if(e.target.matches('#'+SID+'-dash [data-speaker-search]')){rosterSearch=e.target.value;renderPeople();return;}
 if(e.target.matches('#'+SID+'-dash [data-surrogate-search]')){const query=e.target.value.trim().toLowerCase();e.target.closest('.surrogate-picker').querySelectorAll('[data-surrogate-name]').forEach(row=>row.hidden=!row.dataset.surrogateName.includes(query));}
};document.addEventListener('input',docInput);
// The default for a new speaker is tokenless for a GM, token-required for players.

const onUpdate=setting=>{if(setting?.key===KEY||setting?.key==='world.'+KEY){const old=JSON.stringify(db.people);db=read();draw();if(JSON.stringify(db.people)!==old){renderPeople();renderVoiceRows();}}else if(setting?.key===AUTO_MODULE+'.enabled'){draw();}};
Hooks.on('updateSetting',onUpdate);
globalThis[stateRef]={ui:hud,dashboard:dash,handler:handle,hook:onUpdate,docClick,docSubmit,docChange,docInput,dragListeners:{dragstart:dragStart,dragover:dragOver,dragleave:dragLeave,drop,dragend:dragEnd}};
globalThis.GUILD_SPEAKING_GM={getState:()=>copy(db),openDashboard:dashboard,discordSync:()=>scheduleVoiceSync(),discordRelease:()=>handleVoiceControl('emergency')};
draw();restoreGMHud();broadcast();
if(globalThis.__guildSpeakingVoiceHeartbeat)clearInterval(globalThis.__guildSpeakingVoiceHeartbeat);
globalThis.__guildSpeakingVoiceHeartbeat=setInterval(()=>{if(voiceCfg.enabled)scheduleVoiceSync();},25000);
if(voiceCfg.enabled)scheduleVoiceSync();
console.info('[The Speaking Hand] GM dashboard and queue service started.');

})();
 try { await running; } catch(error){
  running=null;
  console.error('[The Speaking Hand] GM startup failed',error);
  ui.notifications.error('The Speaking Hand GM service failed to start: '+(error?.message||error));
  throw error;
 }
}
export async function openGMDashboard(){
 if(!game.user?.isGM) return;
 await startGM();
 if(!globalThis.GUILD_SPEAKING_GM?.openDashboard){
  ui.notifications.warn('The Speaking Hand DM Dashboard is not available.');return;
 }
 return globalThis.GUILD_SPEAKING_GM.openDashboard();
}

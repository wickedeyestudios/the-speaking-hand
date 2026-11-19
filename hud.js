/* THE SPEAKING HAND v1.14 — auto-start HUD, accessible queue move/scale */
export async function startHud(){
'use strict';
const KEY='guildSpeakingCircleV1',CHANNEL='system.dnd5e',TAG='guildSpeakingCircleV1';
const ID='guild-speaking-circle-player';
const esc=x=>foundry.utils.escapeHTML(String(x??''));
const defaults=()=>({version:1,people:[],queue:[],current:null,priority:[],revision:0});
if(!game.settings.settings.has('world.'+KEY))game.settings.register('world',KEY,{scope:'world',config:false,type:Object,default:defaults()});
const previous=globalThis.__guildSpeakingPlayer;
if(previous?.handler)game.socket.off(CHANNEL,previous.handler);
if(previous?.hook)Hooks.off('updateSetting',previous.hook);
previous?.top?.remove();previous?.button?.remove();document.getElementById(ID+'-style')?.remove();
let db=foundry.utils.deepClone(game.settings.get('world',KEY)||defaults());
const me=game.user.id;
const get=(id)=>db.people?.find(p=>p.id===id);
const findToken=()=>{
 const tokens=canvas?.tokens?.controlled||[];
 if(tokens.length!==1)return null;
 const token=tokens[0];if(!token?.actor||token.actor.type!=='character')return null;
 if(!game.user.isGM&&!token.actor.testUserPermission(game.user,'OWNER'))return null;
 return token;
};
const authorized=p=>p.userId===me||(Array.isArray(p.surrogateUserIds)&&p.surrogateUserIds.includes(me));
const requiresToken=p=>p.requireToken!==undefined?!!p.requireToken:!!p.actorId&&!game.users.get(p.userId)?.isGM;
function myPerson(){
 const token=findToken();
 // Selected owned token takes priority for people playing multiple characters.
 if(token){const match=db.people?.find(p=>p.actorId===token.actor.id&&authorized(p));if(match)return match;}
 // Account-only speakers have a hand even if no token is selected.
 return db.people?.find(p=>!requiresToken(p)&&authorized(p))||null;
}
const style=document.createElement('style');style.id=ID+'-style';style.textContent=`
#${ID}-top{position:fixed;top:50px;left:50%;transform:translateX(-50%);z-index:100032;display:flex;justify-content:center;align-items:flex-start;gap:7px;max-width:95vw;pointer-events:none;overflow:visible;font-family:Georgia,serif}
#${ID}-top .queue-tools{position:relative;left:auto;top:auto;transform:none;display:flex;gap:4px;align-items:center;pointer-events:auto;opacity:.75;transition:opacity .15s;white-space:nowrap}
#${ID}-top:hover .queue-tools,#${ID}-top .queue-tools:focus-within{opacity:1}
#${ID}-top .queue-tools button{cursor:pointer;color:#f8dfaa;border:0;background:transparent;text-shadow:0 2px 4px #000;font:16px Arial;padding:5px;pointer-events:auto}
#${ID}-top .queue-tools [data-queue-grip]{cursor:grab;touch-action:none;user-select:none;color:#f8dfaa;font:22px Arial;text-shadow:0 2px 5px black;pointer-events:auto;padding:3px 5px}
#${ID}-top .hand{width:80px;height:97px;flex:0 0 auto;position:relative;background-size:contain;background-repeat:no-repeat;background-position:center;display:grid;place-items:center;filter:drop-shadow(0 4px 5px #000a);transition:transform .18s}
#${ID}-top .hand.current{width:224px;height:252px;filter:drop-shadow(0 0 9px #d1aa5e) drop-shadow(0 5px 7px #000b)}
#${ID}-top .hand.priority{width:248px;height:264px;filter:drop-shadow(0 0 12px gold) drop-shadow(0 5px 7px #000b)}
#${ID}-top .hand .name{max-width:85%;text-align:center;overflow-wrap:anywhere;text-shadow:0 2px 3px #000,0 0 5px #000;line-height:1.08;font-weight:800;font-size:11px;color:#fff5cf;padding:2px 4px;background:transparent;transform:translateY(10px)}
#${ID}-top .hand.current .name,#${ID}-top .hand.priority .name{font-size:22px}
#${ID}-top .fallback{font-size:54px;line-height:1;position:absolute;inset:0;display:grid;place-items:center;color:#b99858}
#${ID}-top .hand.current .fallback,#${ID}-top .hand.priority .fallback{font-size:166px}
#${ID}-top .name{position:relative;z-index:1}
#${ID}-bottom{position:fixed;bottom:28px;right:20px;z-index:100033;display:flex;align-items:center;gap:5px;font-family:Georgia,serif;pointer-events:none}
#${ID}-bottom button{pointer-events:auto;border:2px solid #b99b5e;background:linear-gradient(#50432f,#242a25);color:#ffe1a4;border-radius:50%;width:60px;height:60px;display:grid;place-items:center;cursor:pointer;font-size:31px;box-shadow:0 3px 14px #000a}
#${ID}-bottom button.active{background:linear-gradient(#b8a16a,#77562c);color:#251900;box-shadow:0 0 13px #e6bc71}
#${ID}-bottom [data-drag-handle]{pointer-events:auto;cursor:grab;touch-action:none;user-select:none;font-size:23px;color:#ffe3a9;text-shadow:0 2px 4px #000b;padding:7px 4px;background:transparent;border:0;border-radius:0}
#${ID}-bottom [data-drag-handle]:active{cursor:grabbing}
#${ID}-bottom span{font-size:11px;color:#f4d99a;text-shadow:0 1px 4px black;background:#1e261fc7;padding:4px 7px;border-radius:6px}
@media(max-width:700px){#${ID}-top .queue-tools{position:relative;left:auto;top:auto;transform:none;display:flex;gap:4px;align-items:center;pointer-events:auto;opacity:.75;transition:opacity .15s;white-space:nowrap}
#${ID}-top:hover .queue-tools,#${ID}-top .queue-tools:focus-within{opacity:1}
#${ID}-top .queue-tools button{cursor:pointer;color:#f8dfaa;border:0;background:transparent;text-shadow:0 2px 4px #000;font:16px Arial;padding:5px;pointer-events:auto}
#${ID}-top .queue-tools [data-queue-grip]{cursor:grab;touch-action:none;user-select:none;color:#f8dfaa;font:22px Arial;text-shadow:0 2px 5px black;pointer-events:auto;padding:3px 5px}
#${ID}-top .hand{width:55px;height:70px}#${ID}-top .hand.current{width:160px;height:200px}#${ID}-top .hand.priority{width:176px;height:210px}#${ID}-top .hand .name{font-size:9px}}
`;document.head.append(style);
const top=document.createElement('div');top.id=ID+'-top';document.body.append(top);
// Queue placement and size are LOCAL to this Foundry account/browser, not global.
const QUEUE_KEY='guildSpeakingCircle.queueView.v1.'+(game.world?.id||'world')+'.'+me;
let queuePrefs={x:null,y:null,scale:Number(game.settings.get('guild-speaking-circle-autohud','defaultQueueScale'))||1};
try{queuePrefs={...queuePrefs,...JSON.parse(localStorage.getItem(QUEUE_KEY)||'{}')};}catch{}
queuePrefs.scale=Math.min(1.6,Math.max(.35,Number(queuePrefs.scale)||1));
const tools=document.createElement('div');tools.className='queue-tools';
tools.innerHTML='<span data-queue-grip title="Drag the hand queue" role="button" aria-label="Drag the hand queue">⠿</span><button type="button" data-queue-small title="Shrink hand queue">−</button><button type="button" data-queue-big title="Enlarge hand queue">+</button><button type="button" data-queue-reset title="Reset hand queue position and size">⟲</button>';
function applyQueuePrefs(){
 top.style.zoom=String(queuePrefs.scale);
 if(Number.isFinite(queuePrefs.x)&&Number.isFinite(queuePrefs.y)){
  top.style.left=Math.max(0,Math.min(queuePrefs.x,window.innerWidth-top.getBoundingClientRect().width))+'px';
  top.style.top=Math.max(0,queuePrefs.y)+'px';top.style.transform='none';
 }else {top.style.left='50%';top.style.top='50px';top.style.transform='translateX(-50%)';}
}
function saveQueuePrefs(){try{localStorage.setItem(QUEUE_KEY,JSON.stringify(queuePrefs));}catch(e){console.warn('[Speaking Circle] Queue layout save failed',e);}}
let queueDragging=null;
tools.addEventListener('pointerdown',e=>{
 const grip=e.target.closest('[data-queue-grip]');if(!grip||e.button!==0)return;
 e.preventDefault();const rect=top.getBoundingClientRect();
 queueDragging={id:e.pointerId,dx:e.clientX-rect.left,dy:e.clientY-rect.top};
 queuePrefs.x=rect.left;queuePrefs.y=rect.top;top.style.transform='none';top.style.left=rect.left+'px';top.style.top=rect.top+'px';
 grip.setPointerCapture?.(e.pointerId);
});
tools.addEventListener('pointermove',e=>{
 if(!queueDragging||queueDragging.id!==e.pointerId)return;
 const rect=top.getBoundingClientRect();
 queuePrefs.x=Math.max(0,Math.min(window.innerWidth-rect.width,e.clientX-queueDragging.dx));
 queuePrefs.y=Math.max(0,Math.min(window.innerHeight-rect.height,e.clientY-queueDragging.dy));
 top.style.left=queuePrefs.x+'px';top.style.top=queuePrefs.y+'px';
});
const endQueueDrag=e=>{if(!queueDragging||queueDragging.id!==e.pointerId)return;queueDragging=null;saveQueuePrefs();};
tools.addEventListener('pointerup',endQueueDrag);tools.addEventListener('pointercancel',endQueueDrag);
tools.addEventListener('click',e=>{
 if(e.target.closest('[data-queue-small]'))queuePrefs.scale=Math.max(.35,Math.round((queuePrefs.scale-.1)*100)/100);
 else if(e.target.closest('[data-queue-big]'))queuePrefs.scale=Math.min(1.6,Math.round((queuePrefs.scale+.1)*100)/100);
 else if(e.target.closest('[data-queue-reset]'))queuePrefs={x:null,y:null,scale:Number(game.settings.get('guild-speaking-circle-autohud','defaultQueueScale'))||1};else return;
 applyQueuePrefs();saveQueuePrefs();
});
applyQueuePrefs();
const bottom=document.createElement('div');bottom.id=ID+'-bottom';bottom.innerHTML=`<span data-drag-handle title="Drag to move the Speaking Circle button" aria-label="Drag controls">⠿</span><span data-hint>Select your token</span><button title="Raise / lower hand" data-raise>✋</button>`;document.body.append(bottom);
// Each Foundry user's screen position is independent. Moving it does not change other players' layouts.
const POS_KEY='guildSpeakingCircle.playerHud.position.v1.'+me;
function positionFromStorage(el,key){
 try{const pos=JSON.parse(localStorage.getItem(key)||'null');if(!pos)return;
 const w=el.getBoundingClientRect().width,h=el.getBoundingClientRect().height;
 el.style.left=Math.min(Math.max(0,Number(pos.x)||0),Math.max(0,window.innerWidth-w))+'px';
 el.style.top=Math.min(Math.max(0,Number(pos.y)||0),Math.max(0,window.innerHeight-h))+'px';
 el.style.right='auto';el.style.bottom='auto';
 }catch(error){console.warn('[Speaking Circle] Could not restore HUD position',error);}
}
function enableDrag(el,key){
 let drag=null;
 el.addEventListener('pointerdown',e=>{
  const grip=e.target.closest('[data-drag-handle]');if(!grip||e.button!==0)return;
  e.preventDefault();const rect=el.getBoundingClientRect();
  drag={id:e.pointerId,dx:e.clientX-rect.left,dy:e.clientY-rect.top};
  el.style.left=rect.left+'px';el.style.top=rect.top+'px';el.style.right='auto';el.style.bottom='auto';
  grip.setPointerCapture?.(e.pointerId);
 });
 el.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const x=Math.min(Math.max(0,e.clientX-drag.dx),Math.max(0,window.innerWidth-el.offsetWidth));
  const y=Math.min(Math.max(0,e.clientY-drag.dy),Math.max(0,window.innerHeight-el.offsetHeight));
  el.style.left=x+'px';el.style.top=y+'px';
 });
 const end=e=>{if(!drag||drag.id!==e.pointerId)return;drag=null;
  try{localStorage.setItem(key,JSON.stringify({x:parseFloat(el.style.left),y:parseFloat(el.style.top)}));}
  catch(error){console.warn('[Speaking Circle] HUD position not saved',error);}
 };
 el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
}
positionFromStorage(bottom,POS_KEY);
enableDrag(bottom,POS_KEY);
function hand(p,kind){
 const img=String(p.image||'');
 // Avoid injecting arbitrary CSS URL text; DOM image element is used.
 const text=esc(p.label||'Speaker');
 const label = !img ? `<span class="name">${text}</span>` : '';
 return `<div class="hand ${kind}" data-id="${esc(p.id)}" title="${text}">${img?`<img src="${esc(img)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain" onerror="this.style.display='none'">`:'<div class="fallback">✋</div>'}${label}</div>`;
}
let lastSpeaker=db.current,renderedOnce=false;
function notificationTone(){
 if(!renderedOnce){renderedOnce=true;lastSpeaker=db.current;return;}
 if(lastSpeaker===db.current)return;lastSpeaker=db.current;if(!db.current)return;
 try{if(!game.settings.get('guild-speaking-circle-autohud','audioCues'))return;
 const vol=Number(game.settings.get('guild-speaking-circle-autohud','audioVolume'));if(!(vol>0))return;
 const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ctx=new AC();if(ctx.state==='suspended'){void ctx.close();return;}
 const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=660;
 g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.linearRampToValueAtTime(Math.min(.12,vol*.12),ctx.currentTime+.03);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+.32);
 o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+.33);o.onended=()=>{void ctx.close();};
 }catch(e){console.debug('[The Speaking Hand] Sound unavailable',e);}
}
function render(){
 notificationTone();
 const priority=(db.priority||[]).map(get).filter(Boolean);
 const current=get(db.current);
 const waiting=(db.queue||[]).map(get).filter(Boolean);
 top.innerHTML=[...priority.map(p=>hand(p,'priority')),...(current&&!priority.some(p=>p.id===current.id)?[hand(current,'current')]:[]),...waiting.filter(p=>!priority.some(q=>q.id===p.id)).map(p=>hand(p,'waiting'))].join('');top.appendChild(tools);
 const p=myPerson();const active=!!(p&&(db.current===p.id||(db.queue||[]).includes(p.id)||(db.priority||[]).includes(p.id)));
 const button=bottom.querySelector('button');button.classList.toggle('active',active);
 bottom.querySelector('[data-hint]').textContent=!p?'Select assigned token / ask GM for account-only access':active?((db.priority||[]).includes(p.id)?'GM Priority':db.current===p.id?'Speaking':'Hand Raised'):'Raise Hand';
}
function request(op,p){game.socket.emit(CHANNEL,{tag:TAG,op,sender:me,actorId:requiresToken(p)?(findToken()?.actor?.id||''):'',personId:p?.id||'',requestId:foundry.utils.randomID()});}
bottom.addEventListener('click',e=>{
 const b=e.target.closest('[data-raise]');if(!b)return;
 const p=myPerson();if(!p){ui.notifications.warn('Select the assigned character token, or ask the GM to disable Require Selected Token for your speaking entry.');return;}
 const active=db.current===p.id||(db.queue||[]).includes(p.id)||(db.priority||[]).includes(p.id);
 request(active?'lower':'raise',p);
});
const handler=msg=>{
 if(!msg||msg.tag!==TAG)return;
 if(msg.op==='error'&&msg.forUser===me){ui.notifications.warn(msg.message);return;}
 if(msg.op==='state'&&msg.state&&Number(msg.state.revision)>=Number(db.revision||0)){db=foundry.utils.deepClone(msg.state);render();}
};
game.socket.on(CHANNEL,handler);
const hook=setting=>{if(setting?.key===KEY||setting?.key==='world.'+KEY){db=foundry.utils.deepClone(game.settings.get('world',KEY)||defaults());render();}};
Hooks.on('updateSetting',hook);
// Refresh the hint when the user selects a different controlled token.
const selectionHook=()=>render();
Hooks.on('controlToken',selectionHook);
if(previous?.selectionHook)Hooks.off('controlToken',previous.selectionHook);
globalThis.__guildSpeakingPlayer={handler,hook,selectionHook,top,button:bottom};
globalThis.GUILD_SPEAKING_CIRCLE_REFRESH=next=>{db=foundry.utils.deepClone(next);render();};
render();request('sync',{actorId:''});
// The auto-loader starts this silently for each client.
}

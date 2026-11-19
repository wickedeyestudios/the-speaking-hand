/* The Speaking Hand — Foundry v14 automatic HUD and scene controls */
import {startHud} from './hud.js';
import {startGM,openGMDashboard} from './gm.js';
const MODULE='guild-speaking-circle-autohud'; // Stable legacy ID: preserves installed settings.
const CHANNEL='system.dnd5e',TAG='guildSpeakingCircleV1';
let loading=null;
function worldEnabled(){try{return !!game.settings.get(MODULE,'enabled');}catch{return false;}}
function localEnabled(){try{return !!game.settings.get(MODULE,'localVisible');}catch{return true;}}
function teardown(){
 const old=globalThis.__guildSpeakingPlayer;
 if(old?.handler)game.socket.off(CHANNEL,old.handler);
 if(old?.hook)Hooks.off('updateSetting',old.hook);
 if(old?.selectionHook)Hooks.off('controlToken',old.selectionHook);
 old?.top?.remove();old?.button?.remove();
 document.getElementById('guild-speaking-circle-player-top')?.remove();
 document.getElementById('guild-speaking-circle-player-bottom')?.remove();
 document.getElementById('guild-speaking-circle-player-style')?.remove();
 globalThis.__guildSpeakingPlayer=null;
 delete globalThis.GUILD_SPEAKING_CIRCLE_REFRESH;
}
async function sync(){
 if(!worldEnabled()||!localEnabled()){teardown();return;}
 if(globalThis.__guildSpeakingPlayer?.top?.isConnected&&globalThis.__guildSpeakingPlayer?.button?.isConnected)return;
 if(loading)return loading;
 loading=(async()=>{
  try{await startHud();if(!worldEnabled()||!localEnabled())teardown();}
  catch(err){console.error('[The Speaking Hand]',err);ui.notifications.error('The Speaking Hand could not start: '+(err?.message||err));}
  finally{loading=null;}
 })();
 return loading;
}
async function toggleLocal(){
 if(!worldEnabled())return ui.notifications.warn('The DM has disabled the Speaking Hand for this world.');
 const next=!localEnabled();
 await game.settings.set(MODULE,'localVisible',next);
 ui.notifications.info(next?'Your floating Speaking Hand is visible.':'Your floating Speaking Hand is hidden.');
}
async function openGM(){
 if(!game.user.isGM)return;
 return openGMDashboard();
}
Hooks.once('init',()=>{
 if(!game.settings.settings.has('world.guildSpeakingCircleV1'))game.settings.register('world','guildSpeakingCircleV1',{
  scope:'world',config:false,type:Object,default:{version:1,people:[],queue:[],current:null,priority:[],revision:0}
 });
 game.settings.register(MODULE,'enabled',{
  name:'Enable the Speaking Hand for Everyone',
  hint:'World-wide GM-controlled master switch. The Speaking Circle GM dashboard also controls this setting.',
  scope:'world',config:true,restricted:true,type:Boolean,default:false,onChange:()=>{void sync();}
 });
 game.settings.register(MODULE,'localVisible',{
  name:'Show My Floating Speaking Hand',
  hint:'Each player can hide their own floating hand controls without changing the speaking queue or anybody else’s screen.',
  scope:'client',config:true,type:Boolean,default:true,onChange:()=>{void sync();}
 });
 game.settings.register(MODULE,'audioCues',{name:'Speaker Turn Sound',hint:'Play a quiet sound when a new current speaker is announced. Browser audio may require interaction.',scope:'client',config:true,type:Boolean,default:false});
 game.settings.register(MODULE,'audioVolume',{name:'Speaker Sound Volume',hint:'Volume of the optional speaker-turn sound.',scope:'client',config:true,type:Number,range:{min:0,max:1,step:.05},default:.3});
 game.settings.register(MODULE,'defaultQueueScale',{
  name:'Default Queue Size',hint:'Default scale for new HUD layouts. You can adjust the queue later with its on-screen buttons.',
  scope:'client',config:true,type:Number,range:{min:0.35,max:1.6,step:0.05},default:1
 });
});
Hooks.on('getSceneControlButtons',controls=>{
 if(!controls)return;
 controls.speakingHand={
  name:'speakingHand',title:'The Speaking Hand',icon:'fa-solid fa-hand',
  order:70,visible:true,activeTool:'select',
  tools:{
   localToggle:{name:'localToggle',title:'Show / Hide Floating Hands',icon:'fa-solid fa-hand-point-up',order:0,button:true,visible:true,onChange:()=>{void toggleLocal();}},
   dmDashboard:{name:'dmDashboard',title:'DM Dashboard',icon:'fa-solid fa-sliders',order:1,button:true,visible:game.user.isGM,onChange:()=>{void openGM();}}
  }
 };
});
Hooks.once('ready',()=>{
 if(game.user.isGM)void startGM().catch(error=>console.error('[The Speaking Hand] GM startup',error));
 globalThis.THE_SPEAKING_HAND={toggleLocal,openGM,sync};
 game.socket.on(CHANNEL,msg=>{if(msg?.tag===TAG&&msg?.op==='hudVisibility')void sync();});
 Hooks.on('updateSetting',setting=>{
  if([`${MODULE}.enabled`,`${MODULE}.localVisible`,'enabled','localVisible'].includes(setting?.key))void sync();
 });
 void sync();
});

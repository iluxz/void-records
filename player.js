var audio=new Audio();
audio.preload='metadata';
audio.volume=.7;
window.audioEl=audio;
// try to build the Web Audio graph immediately while the element has no src.
// the context starts suspended and resumes on the first user gesture.
// defer AudioContext creation to first user gesture to avoid browser autoplay warnings
function vrBootAudio(){try{if(!audioCtx&&typeof initVisualizer==='function')initVisualizer(audio)}catch(e){}try{if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume().catch(function(){})}catch(e){}}
['pointerdown','keydown','touchstart'].forEach(function(ev){document.addEventListener(ev,vrBootAudio,{passive:true})});

var order=[];
var pos=-1;
var playing=false;
var shuffle=false;
var loopOne=false;
var curBlobUrl=null;
var loadGen=0;
var durCache={};
var volBase=.7,fadeInt=null,fadeInNext=false;
// the element stays at 1 once the web audio graph exists; volume is a gain
// node after the analyser so the engine always hears the track's own level.
function setVol(v){
  v=Math.max(0,Math.min(1,v));
  if(typeof setPlaybackVolume==='function')setPlaybackVolume(v);else audio.volume=v;
}
function getVol(){return typeof getPlaybackVolume==='function'?getPlaybackVolume():audio.volume}
if(audioCtx){audio.volume=1;setVol(volBase)}
function fadeVol(to,dur,done){
  if(fadeInt){clearInterval(fadeInt);fadeInt=null}
  var from=getVol(),steps=Math.max(2,Math.round(dur/30)),n=0;
  if(Math.abs(from-to)<.001){setVol(to);if(done)done();return}
  fadeInt=setInterval(function(){
    n++;
    setVol(Math.max(0,Math.min(1,from+(to-from)*(n/steps))));
    if(n>=steps){clearInterval(fadeInt);fadeInt=null;if(done)done()}
  },30);
}
var vrFavs=[],vrPlays={},vrLast={},ST={};
try{vrFavs=JSON.parse(localStorage.getItem('vr_favs')||'[]')||[]}catch(e){}
try{vrPlays=JSON.parse(localStorage.getItem('vr_plays')||'{}')||{}}catch(e){}
try{vrLast=JSON.parse(localStorage.getItem('vr_last')||'{}')||{}}catch(e){}
try{ST=JSON.parse(localStorage.getItem('vr_settings')||'{}')||{}}catch(e){}
function saveSetting(k,v){ST[k]=v;try{localStorage.setItem('vr_settings',JSON.stringify(ST))}catch(e){}}
var vrPinned=[];
try{vrPinned=JSON.parse(localStorage.getItem('vr_pinned')||'[]')||[]}catch(e){vrPinned=[]}
function savePinned(){try{localStorage.setItem('vr_pinned',JSON.stringify(vrPinned))}catch(e){}}
function isPinned(f){return vrPinned.indexOf(f)>=0}
function setPinned(f,on){
  var i=vrPinned.indexOf(f);
  if(on&&i<0)vrPinned.push(f);
  if(!on&&i>=0)vrPinned.splice(i,1);
  savePinned();
}
async function pinTrack(f,on){
  if(!f)return;
  if(!('caches' in window)){showSrcMsg('offline cache not available in this browser','err');return}
  try{
    var cache=await caches.open('vr-audio');
    var url=new URL(f,location.href).toString();
    if(on){
      showSrcMsg('pinning for offline...','ok');
      var tr=TRACKS.find(function(x){return x.f===f});
      var bust=tr&&tr.v?('?v='+encodeURIComponent(tr.v)):'';
      var res=await fetch(url+bust,{cache:'reload'});
      if(!res.ok)throw new Error('http '+res.status);
      await cache.put(url,res.clone());
      setPinned(f,true);
      showSrcMsg('pinned for offline: '+f,'ok');
    }else{
      await cache.delete(url);
      setPinned(f,false);
      showSrcMsg('removed offline pin: '+f,'ok');
    }
  }catch(e){showSrcMsg('offline pin failed: '+(e&&e.message?e.message:e),'err');}
  buildList(document.getElementById('filter').value);
  if(pos>=0&&TRACKS[pos]&&TRACKS[pos].f===f)renderInfo(pos);
}
var resumeTimer=null;
function saveResume(force){
  if(externalMode||pos<0||!TRACKS[pos])return;
  var t=audio.currentTime||0;
  var d=audio.duration||0;
  if(!force && t<1) return;
  ST.resume={f:TRACKS[pos].f,pos:pos,t:t,d:isFinite(d)?d:0,at:Date.now(),playing:!!playing};
  try{localStorage.setItem('vr_settings',JSON.stringify(ST))}catch(e){}
}
function clearResume(){if(ST.resume){delete ST.resume;try{localStorage.setItem('vr_settings',JSON.stringify(ST))}catch(e){}}}
function startResumeTimer(){if(resumeTimer)clearInterval(resumeTimer);resumeTimer=setInterval(function(){if(playing&&!externalMode)saveResume(false)},5000)}
startResumeTimer();
window.addEventListener('beforeunload',function(){saveResume(true)});
document.addEventListener('visibilitychange',function(){if(document.hidden)saveResume(true)});

// clean-listen ledger: a record only counts when it runs start to finish at
// normal speed with no seeking/skipping and the tab in focus the whole time.
var vrClean={},cleanRun=false,cleanFile='',cleanDead=false,cleanStarted=false;
try{vrClean=JSON.parse(localStorage.getItem('vr_clean')||'{}')||{}}catch(e){}
function cleanSave(){try{localStorage.setItem('vr_clean',JSON.stringify(vrClean))}catch(e){}}

// opt-in bridge to the local void records server. everything above this line
// stays fully offline when the switch is off (the default).
var SERVER_CLIENT='void-records',serverPushTimer=null;
function serverBase(){return (ST.serverUrl||'http://127.0.0.1:8787').replace(/\/+$/,'')}
function serverOn(){return !!ST.server}
function serverPush(){
  if(!serverOn())return;
  if(serverPushTimer)clearTimeout(serverPushTimer);
  serverPushTimer=setTimeout(function(){serverPushTimer=null;serverPushNow()},900);
}
function backupKeys(){
  return ['vr_favs','vr_plays','vr_last','vr_clean','vr_ach','vr_settings','vr_sfx','vr_discover','vr_queue','tutorialCompleted'];
}
function backupMsg(text,kind){
  var el=document.getElementById('backupMsg');
  if(!el)return;
  el.textContent=text||'';
  el.className='setMsg'+(kind?' '+kind:'');
}
function exportBackup(){
  var data={app:'void-records',version:1,exportedAt:new Date().toISOString(),tracks:TRACKS.length,keys:{}};
  backupKeys().forEach(function(k){
    var raw=localStorage.getItem(k);
    if(raw===null)return;
    try{data.keys[k]=JSON.parse(raw)}catch(e){data.keys[k]=raw}
  });
  var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  var a=document.createElement('a');
  var stamp=new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  a.href=URL.createObjectURL(blob);
  a.download='void-records-backup-'+stamp+'.json';
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href)},1000);
  backupMsg('exported backup with '+Object.keys(data.keys).length+' keys','ok');
}
function validBackupShape(v,k){
  if(k==='vr_favs'||k==='vr_ach'||k==='vr_queue')return Array.isArray(v);
  if(k==='vr_sfx'||k==='tutorialCompleted')return typeof v==='string';
  return v&&typeof v==='object'&&!Array.isArray(v);
}
function importBackupFile(file){
  if(!file)return;
  var reader=new FileReader();
  reader.onload=function(){
    try{
      var j=JSON.parse(String(reader.result||''));
      var src=(j&&j.keys&&typeof j.keys==='object')?j.keys:j;
      var keys=backupKeys().filter(function(k){return Object.prototype.hasOwnProperty.call(src,k)&&validBackupShape(src[k],k)});
      if(!keys.length){backupMsg('no valid void records keys found in that file','err');return}
      if(!confirm('import backup? this replaces '+keys.length+' local keys ('+keys.join(', ')+').'))return;
      keys.forEach(function(k){
        var v=src[k];
        localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));
      });
      backupMsg('imported '+keys.length+' keys - reloading...','ok');
      setTimeout(function(){location.reload()},450);
    }catch(e){
      backupMsg('import failed: '+((e&&e.message)||'bad json'),'err');
    }
  };
  reader.readAsText(file);
}
function serverPushNow(){
  if(!serverOn())return;
  var payload={};
  try{
    payload.vr_clean=JSON.parse(localStorage.getItem('vr_clean')||'{}');
    payload.vr_ach=JSON.parse(localStorage.getItem('vr_ach')||'[]');
    payload.vr_settings=JSON.parse(localStorage.getItem('vr_settings')||'{}');
    payload.vr_sfx=localStorage.getItem('vr_sfx')||'on';
    payload.vr_favs=JSON.parse(localStorage.getItem('vr_favs')||'[]');
  }catch(e){}
  fetch(serverBase()+'/api/v1/state/'+SERVER_CLIENT,{
    method:'PATCH',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload),keepalive:true
  }).catch(function(){});
}
function serverPull(done){
  if(!serverOn()){if(done)done(false);return}
  fetch(serverBase()+'/api/v1/state/'+SERVER_CLIENT).then(function(r){return r.json()}).then(function(j){
    var s=j.state||{},changed=false,mergedClean=null;
    try{
      var lc=JSON.parse(localStorage.getItem('vr_clean')||'{}')||{},rc=s.vr_clean||{};
      for(var f in rc)if(rc[f]&&!lc[f]){lc[f]=true;changed=true}
      if(changed){localStorage.setItem('vr_clean',JSON.stringify(lc));mergedClean=lc}
      var la=JSON.parse(localStorage.getItem('vr_ach')||'[]')||[],ra=s.vr_ach||[];
      var extra=ra.filter(function(id){return la.indexOf(id)<0});
      if(extra.length){localStorage.setItem('vr_ach',JSON.stringify(la.concat(extra)));changed=true}
    }catch(e){}
    if(mergedClean)vrClean=mergedClean;
    if(changed&&typeof osWin!=='undefined'&&!osWin.hidden){
      if(pos>=0&&!document.getElementById('paneInfo').hidden)infoRender(pos);
      if(!document.getElementById('paneStats').hidden)statsRender();
    }
    if(done)done(changed);
  }).catch(function(){if(done)done(false)});
}
function serverPing(){
  var el=document.getElementById('setServerV');
  if(!el)return;
  if(!serverOn()){el.textContent='off';return}
  el.textContent='linking…';
  fetch(serverBase()+'/health').then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){
    el.textContent='linked '+j.tracks;
    serverPull(function(changed){if(changed&&typeof vrAchRefresh==='function')vrAchRefresh()});
  }).catch(function(){el.textContent='no link'});
}
var _saveSetting=saveSetting;
saveSetting=function(k,v){_saveSetting(k,v);serverPush()};
var _cleanSave=cleanSave;
cleanSave=function(){_cleanSave();serverPush()};
if(typeof vrAchSave==='function'){
  var _vrAchSave=vrAchSave;
  vrAchSave=function(s){_vrAchSave(s);serverPush()};
}
function cleanBreak(){if(cleanRun||cleanFile){cleanRun=false;cleanDead=true}}
function cleanFocused(){try{return document.visibilityState==='visible'&&document.hasFocus()}catch(e){return true}}
function cleanMark(){
  if(!cleanRun||!cleanFile)return;
  vrClean[cleanFile]=true;cleanSave();
  cleanRun=false;cleanFile='';
  if(typeof vrAch==='function')vrAchScan();
}

var listEl=document.getElementById('list');
var nowTitle=document.getElementById('nowTitle');
var nowMeta=document.getElementById('nowMeta');
var labelTitle=document.getElementById('labelTitle');
var disc=document.getElementById('disc');
var btnPlay=document.getElementById('btnPlay');
var btnShuffle=document.getElementById('btnShuffle');
var btnLoop=document.getElementById('btnLoop');
var seek=document.getElementById('seek');
var tCur=document.getElementById('tCur');
var tDur=document.getElementById('tDur');

function fmt(t){
  if(!isFinite(t)||t<0)return'--:--';
  var m=Math.floor(t/60),s=Math.floor(t%60);
  return m+':'+(s<10?'0':'')+s;
}
function rebuildOrder(start){
  order=[];
  for(var i=0;i<TRACKS.length;i++)order.push(i);
  if(shuffle){
    for(var i=order.length-1;i>0;i--){
      var j=Math.floor(Math.random()*(i+1));
      var t=order[i];order[i]=order[j];order[j]=t;
    }
  }
  if(typeof start==='number'){
    var at=order.indexOf(start);
    if(at>0){order.splice(at,1);order.unshift(start);}
  }
}

var hxTimer=null;
function havexyEgg(f){
  var el=document.getElementById('havexyEgg');
  if(!el)return;
  if(!/^hv-|^havexy-|^m12-/.test(f))return;
  el.hidden=false;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
  if(hxTimer)clearTimeout(hxTimer);
  hxTimer=setTimeout(function(){el.hidden=true;el.classList.remove('pop')},4300);
  if(typeof vrAch==='function')vrAch('havexy_egg');
}
function loadTrack(i,autoplay){
  if(i<0||i>=TRACKS.length)return;
  pos=i;
  if(typeof vrRadioStop==='function')vrRadioStop();
  externalMode=false;localQueue=[];
  cleanRun=false;cleanDead=false;cleanStarted=false;cleanFile=TRACKS[i].f;
  var tr=TRACKS[i];
  havexyEgg(tr.f);
  if(typeof skelMaybe==='function')skelMaybe();
  fadeInNext=true;
  if(!audio.paused)fadeVol(0,450);
  else setVol(0);
  try{
    vrPlays[tr.f]=(vrPlays[tr.f]||0)+1;
    vrLast[tr.f]=Date.now();
    localStorage.setItem('vr_plays',JSON.stringify(vrPlays));
    localStorage.setItem('vr_last',JSON.stringify(vrLast));
  }catch(e){}
  if(typeof vrAchScan==='function')vrAchScan();
  msUpdate();
  if(typeof osWin!=='undefined'&&!osWin.hidden){
    osPos=i;
    document.getElementById('osWinTitle').textContent=tr.n;
    if(!document.getElementById('paneInfo').hidden)infoRender(i);
    if(!document.getElementById('paneLyrics').hidden)lyLoad(i);
    if(!document.getElementById('paneStats').hidden)statsRender();
  }
  nowTitle.textContent=tr.n;
  nowMeta.textContent=(tr.a.length?'aka '+tr.a.join(', ')+' &middot; ':'')+'void records';
  nowMeta.innerHTML=nowMeta.textContent;
  labelTitle.textContent=tr.n;
  var gen=++loadGen;
  var bust=tr.v?('?v='+encodeURIComponent(tr.v)):'';
  var localUrl='tracks/'+tr.f+bust;
  var srcUrl=serverOn()?serverBase()+'/audio/'+encodeURIComponent(tr.f)+bust:localUrl;
  try{
    fetch(srcUrl,{cache:'reload'}).then(function(r){if(!r.ok)throw 0;return r.blob()}).then(function(b){
      if(gen!==loadGen)return;
      if(curBlobUrl){try{URL.revokeObjectURL(curBlobUrl)}catch(e){}}
      var ext=(tr.f.split('.').pop()||'').toLowerCase();
      var mime=ext==='mp3'?'audio/mpeg':ext==='wav'?'audio/wav':ext==='ogg'?'audio/ogg':ext==='webm'?'video/webm':ext==='mp4'?'video/mp4':'';
      curBlobUrl=URL.createObjectURL(mime?new Blob([b],{type:mime}):b);
      audio.src=curBlobUrl;
      vrVideoBgSet(tr,curBlobUrl);
      if(autoplay!==false)tryPlay();
    }).catch(function(){
      if(gen!==loadGen)return;
      audio.src=localUrl;
      vrVideoBgSet(tr,localUrl);
      if(autoplay!==false)tryPlay();
    });
  }catch(e){
    audio.src=localUrl;
    vrVideoBgSet(tr,localUrl);
    if(autoplay!==false)tryPlay();
  }
  markPlaying();
}
function tryPlay(){
  if(!audioCtx&&window.audioEl)try{initVisualizer(window.audioEl)}catch(e){}
  if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume().catch(function(){});
  var p=audio.play();
  if(p&&p.catch)p.catch(function(){
    // fresh tab: unmuted autoplay is blocked. start muted, unmute on first gesture.
    if(audio.muted)return;
    audio.muted=true;
    var un=function(){
      audio.muted=false;
      window.removeEventListener('pointerdown',un,true);
      window.removeEventListener('keydown',un,true);
    };
    window.addEventListener('pointerdown',un,true);
    window.addEventListener('keydown',un,true);
    var q=audio.play();
    if(q&&q.catch)q.catch(function(){});
  });
}
function markPlaying(){
  var lis=listEl.children;
  for(var i=0;i<lis.length;i++)lis[i].classList.toggle('playing',+lis[i].dataset.pos===pos);
}
function setPlayingUI(on){
  playing=on;
  disc.classList.toggle('playing',on);
  btnPlay.innerHTML=on?'&#10074;&#10074;':'&#9654;';
  updateTitle();
  msUpdate();
}
function updateTitle(){
  document.title=(playing?'\u25B6 ':'')+(pos>=0?TRACKS[pos].n:'void records')+' \u00b7 void records';
}
function msUpdate(){
  try{
    if(!('mediaSession' in navigator))return;
    var n=pos>=0?TRACKS[pos].n:'void records';
    navigator.mediaSession.metadata=new MediaMetadata({
      title:n,artist:'void records',album:'void records',
      artwork:[{src:'favicon.svg',sizes:'any',type:'image/svg+xml'}]
    });
    navigator.mediaSession.playbackState=playing?'playing':'paused';
  }catch(e){}
}
try{
  if('mediaSession' in navigator){
    navigator.mediaSession.setActionHandler('play',function(){if(audio.paused)playPause()});
    navigator.mediaSession.setActionHandler('pause',function(){if(!audio.paused)playPause()});
    navigator.mediaSession.setActionHandler('previoustrack',function(){prevTrack()});
    navigator.mediaSession.setActionHandler('nexttrack',function(){nextTrack()});
  }
}catch(e){}

function playPause(){
  if(pos<0&&!(typeof vrRadioOn==='function'&&vrRadioOn())){loadTrack(order[0]!==undefined?order[0]:0,true);return}
  if(audio.paused){if(window.vrSfx)vrSfx('play');tryPlay()}else{if(window.vrSfx)vrSfx('pause');audio.pause()}
}
function nextTrack(){
  if(window.vrSfx)vrSfx('next');
  if(queueNext())return;
  if(pos<0)return loadTrack(0,true);
  var at=order.indexOf(pos);
  if(at<order.length-1)loadTrack(order[at+1],true);
  else if(loopOne)loadTrack(pos,true);
  else loadTrack(order[0],true);
}
function prevTrack(){
  if(window.vrSfx)vrSfx('prev');
  if(pos<0)return loadTrack(0,true);
  if(audio.currentTime>3){cleanBreak();audio.currentTime=0;return}
  var at=order.indexOf(pos);
  loadTrack(at>0?order[at-1]:order[order.length-1],true);
}

document.getElementById('btnPlay').addEventListener('click',playPause);
document.getElementById('btnNext').addEventListener('click',nextTrack);
document.getElementById('btnPrev').addEventListener('click',prevTrack);
btnShuffle.addEventListener('click',function(){
  if(window.vrSfx)vrSfx('shuffle');
  shuffle=!shuffle;
  btnShuffle.classList.toggle('on',shuffle);
  rebuildOrder(pos>=0?pos:undefined);
  if(shuffle&&typeof vrAch==='function')vrAch('shuffle_on');
});
btnLoop.addEventListener('click',function(){
  cleanBreak();
  if(window.vrSfx)vrSfx('loop');
  loopOne=!loopOne;
  btnLoop.classList.toggle('on',loopOne);
  audio.loop=loopOne;
  if(loopOne&&typeof vrAch==='function')vrAch('loop_on');
});
var volRedlineFired=false;
document.getElementById('vol').addEventListener('input',function(){
  volBase=this.value/100;
  if(!fadeInt)setVol(volBase);
  saveSetting('volume',parseInt(this.value,10));
});
document.getElementById('vol').addEventListener('change',function(){
  if(this.value>=100&&!volRedlineFired&&typeof vrAch==='function'){volRedlineFired=true;vrAch('redline');}
});
seek.addEventListener('input',function(){
  cleanBreak();
  if(audio.duration){
    audio.currentTime=(this.value/1000)*audio.duration;
    bgVideoSync(true);
  }
});
audio.addEventListener('play',function(){
  if(!audioCtx&&window.audioEl)initVisualizer(window.audioEl);
  if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume().catch(function(){});
  if(fadeInNext){fadeInNext=false;fadeVol(volBase,600)}
  setPlayingUI(true);markPlaying();if(window.setCrackleLevel&&crackleWanted)setCrackleLevel(1);
  bgVideoSync(true);
});
audio.addEventListener('pause',function(){setPlayingUI(false);if(window.setCrackleLevel)setCrackleLevel(0);bgVideoSync()});
// a resolved stream can expire or be refused after it was handed to the player.
// surface that instead of leaving a stale "playing" message on screen.
audio.addEventListener('error',function(){
  if(typeof vrRadioError==='function'&&vrRadioError())return;
  if(typeof externalMode!=='undefined'&&externalMode&&audio.getAttribute('src')){
    showSrcMsg('playback failed - the stream may have expired or been refused. try loading the link again.','err');
  }
});
audio.addEventListener('ended',function(){
  cleanMark();
  clearResume();
  if(sleepEndOfTrack){clearSleep();setPlayingUI(false);nowMeta.textContent='sleep timer ended at track end. goodnight.';fadeVol(0,1800,function(){audio.pause();setVol(volBase)});return}
  if(typeof externalMode!=='undefined'&&externalMode){
    if(typeof vrRadioNext==='function'&&vrRadioNext())return;
    if(queueNext())return;
    if(localQueue.length){loadLocalFile(localQueue.shift());return}
    setPlayingUI(false);
    showSrcMsg('finished - outside the collection','ok');
    return;
  }
  if(queueNext())return;
  if(!loopOne)nextTrack()
});
// a clean listen can only begin from the top of a freshly loaded record, at 1x,
// with the tab actually in front. anything that breaks that state is permanent.
audio.addEventListener('playing',function(){
  if(cleanStarted)return; // buffering resume, not a fresh start
  cleanStarted=true;
  if(cleanDead||!cleanFile||loopOne||audio.playbackRate!==1||!cleanFocused()){cleanRun=false;return}
  cleanRun=true;
});
audio.addEventListener('seeking',function(){if(cleanStarted)cleanBreak()});
audio.addEventListener('ratechange',function(){if(audio.playbackRate!==1)cleanBreak()});
document.addEventListener('visibilitychange',function(){if(cleanRun&&!cleanFocused())cleanBreak()});
window.addEventListener('blur',function(){if(cleanRun)cleanBreak()});
audio.addEventListener('timeupdate',function(){
  tCur.textContent=fmt(audio.currentTime);
  if(audio.duration){
    tDur.textContent=fmt(audio.duration);
    seek.value=Math.round((audio.currentTime/audio.duration)*1000);
  }
  if(cleanRun&&(audio.playbackRate!==1||!cleanFocused()))cleanBreak();
  bgVideoSync();
  lyTick();
});
audio.addEventListener('loadedmetadata',function(){
  if(pos>=0&&audio.duration){
    try{durCache[TRACKS[pos].f]=fmt(audio.duration)}catch(e){}
    var li=listEl.querySelector('[data-pos="'+pos+'"] .du');
    if(li&&li.textContent==='--:--')li.textContent=fmt(audio.duration);
  }
});
audio.addEventListener('error',function(){
  if(pos>=0)nowMeta.textContent='could not load '+TRACKS[pos].f+' (try ctrl+shift+r)';
});

function trackArtist(tr){var n=(tr&&tr.n)||'';var i=n.indexOf(' - ');return i>0?n.slice(0,i):''}
function sortTracks(idxs){
  var s=curSort||'shelf';
  if(s==='shelf')return idxs;
  idxs.sort(function(a,b){
    var ta=TRACKS[a],tb=TRACKS[b];
    if(s==='az')return ta.n.localeCompare(tb.n);
    if(s==='artist'){var aa=trackArtist(ta),ab=trackArtist(tb);return aa.localeCompare(ab)||ta.n.localeCompare(tb.n)}
    if(s==='plays')return (vrPlays[tb.f]||0)-(vrPlays[ta.f]||0)||ta.n.localeCompare(tb.n);
    if(s==='recent')return (vrLast[tb.f]||0)-(vrLast[ta.f]||0)||ta.n.localeCompare(tb.n);
    if(s==='duration')return (durCache[tb.f]||0)-(durCache[ta.f]||0)||ta.n.localeCompare(tb.n);
    if(s==='unheard')return ((vrPlays[ta.f]||0)?1:0)-((vrPlays[tb.f]||0)?1:0)||ta.n.localeCompare(tb.n);
    return a-b;
  });
  return idxs;
}
var LYR_META={"m12-BGSgMILPOeg.webm":{"w":false,"s":false,"p":true},"m3-too_late_already_died.webm":{"w":false,"s":true,"p":true},"m3-if_you_see_me_use_ubuntu.webm":{"w":false,"s":false,"p":true},"m4-5VsyzvvbXLQ.webm":{"w":false,"s":true,"p":true},"m45-0-pbkPm8oAg.webm":{"w":true,"s":true,"p":true},"m45-0VKY7Moy4so.webm":{"w":true,"s":true,"p":true},"sinister-02.webm":{"w":true,"s":true,"p":true},"sinister-03.mp3":{"w":false,"s":true,"p":true},"m5-ri1SiiTeUis.webm":{"w":false,"s":true,"p":true},"m5-J1DAmmROUX8.webm":{"w":true,"s":true,"p":true},"m5-fHEQc0oVlZc.webm":{"w":true,"s":true,"p":true},"m7-J7Xzgcu6vVk.webm":{"w":true,"s":true,"p":true},"m7-K3xJH7DqE7c.webm":{"w":false,"s":true,"p":true},"m45-HsZQOXZbWkQ.webm":{"w":true,"s":true,"p":true},"m45--eDYT_20YhM.webm":{"w":true,"s":true,"p":true},"m45-hbuNxmAXdNk.webm":{"w":true,"s":true,"p":true},"m45-cF91xil98Mc.webm":{"w":false,"s":true,"p":true},"tally-rulerofeverything.mp3":{"w":true,"s":true,"p":true},"tally-bananaman.mp3":{"w":false,"s":true,"p":true},"m12-nebNhtYSlFw.webm":{"w":true,"s":true,"p":true},"hskunx-heyitsme.mp3":{"w":true,"s":true,"p":true},"sinister-04.mp3":{"w":false,"s":true,"p":true},"sinister-05.mp3":{"w":false,"s":true,"p":true},"sinister-06.mp3":{"w":false,"s":true,"p":true},"sinister-07.mp3":{"w":false,"s":true,"p":true},"sinister-08.mp3":{"w":false,"s":true,"p":true},"sinister-09.mp3":{"w":true,"s":true,"p":true},"sinister-12.mp3":{"w":false,"s":true,"p":true},"sinister-13.mp3":{"w":false,"s":true,"p":true},"sinister-14.mp3":{"w":false,"s":true,"p":true},"sinister-15.mp3":{"w":true,"s":true,"p":true},"sinister-16.mp3":{"w":false,"s":false,"p":true},"sinister-17.mp3":{"w":false,"s":true,"p":true},"random-gleeco.mp3":{"w":false,"s":true,"p":true},"hskunx-lordverity.mp3":{"w":false,"s":true,"p":true},"sinister-11.mp3":{"w":false,"s":true,"p":true}};
function hasLyrics(f){return !!(LYR_PRESETS[f]||(LYR_META[f]&&LYR_META[f].p)||(lyCache[f]&&lyCache[f].p));}
function hasSynced(f){return !!((LYR_META[f]&&LYR_META[f].s)||(lyCache[f]&&lyCache[f].s));}
function hasWordSynced(f){return !!((LYR_META[f]&&LYR_META[f].w)||(lyCache[f]&&lyCache[f].w));}

function buildList(filter){
  var q=(filter||'').toLowerCase().trim();
  var qn=q.replace(/[^a-z0-9]/g,'');
  var favMode=qn==='favorites'||qn==='favs'||qn==='favourites'||qn==='starred';
  var recMode=qn==='recent'||qn==='recents'||qn==='history'||qn==='lastplayed';
  var lyrMode=qn==='lyrics'||qn==='haslyrics'||qn==='withlyrics';
  var synMode=qn==='synced'||qn==='syncedlyrics'||qn==='lrc';
  var wordMode=qn==='wordsynced'||qn==='wordsync'||qn==='word'||qn==='karaoke'||qn==='wordlyrics';
  if(recMode&&typeof vrAch==='function')vrAch('filter_recent');
  var idxs=[];
  if(recMode){
    for(var r=0;r<TRACKS.length;r++)if(vrLast[TRACKS[r].f])idxs.push(r);
    idxs.sort(function(a,b){return vrLast[TRACKS[b].f]-vrLast[TRACKS[a].f]});
  }else{
    for(var s2=0;s2<TRACKS.length;s2++)idxs.push(s2);
    sortTracks(idxs);
  }
  listEl.innerHTML='';
  for(var k=0;k<idxs.length;k++){
    var i=idxs[k];
    var tr=TRACKS[i];
    if(!tr||!tr.f)continue;
    if(favMode){if(vrFavs.indexOf(tr.f)<0)continue}
    else if(lyrMode){if(!hasLyrics(tr.f))continue}
    else if(synMode){if(!hasSynced(tr.f))continue}
    else if(wordMode){if(!hasWordSynced(tr.f))continue}
    else if(!recMode){
      var hay=(tr.n+' '+tr.a.join(' ')+' '+tr.f).toLowerCase();
      if(q&&hay.indexOf(q)<0)continue;
    }
    if(curMood!=='all'&&!matchesMood(tr,curMood))continue;
    var li=document.createElement('li');
    li.dataset.pos=i;
    if(i===pos)li.className='playing';
    var pinned=isPinned(tr.f);
    li.innerHTML='<span class="idx">'+(i+1)+'</span>'+
      '<span class="nm"></span>'+
      '<span class="al"></span>'+
      '<button class="qBtnAdd" title="add to queue">+</button>'+
      '<button class="favBtn'+(vrFavs.indexOf(tr.f)>=0?' on':'')+'" title="favorite">&#9733;</button>'+
      '<button class="lyBtn" title="lyrics">&#9834;</button>'+
      '<span class="pc"></span>'+
      '<span class="du"></span>';
    if(pinned)li.classList.add('pinned');
    li.querySelector('.nm').textContent=tr.n;
    // keep the row readable: pack tag inline, every alias in the hover tooltip
    var packTag=tr.a.filter(function(a){return /^m\d+$/.test(a)})[0]||'';
    li.querySelector('.al').textContent=packTag;
    li.title=tr.n+(tr.a.length?'\n'+tr.a.join(' · '):'');
    var pcEl=li.querySelector('.pc');
    var pcN=vrPlays[tr.f]||0;
    if(pcN)pcEl.textContent='\u00d7'+pcN;
    li.querySelector('.du').textContent=durCache[tr.f]||'--:--';
    li.querySelector('.qBtnAdd').addEventListener('click',function(e){
      e.stopPropagation();
      queuePushShelf(+this.parentNode.dataset.pos,false);
    });
    li.querySelector('.favBtn').addEventListener('click',function(e){
      e.stopPropagation();
      var f=TRACKS[+this.parentNode.dataset.pos].f;
      var at=vrFavs.indexOf(f);
      if(at>=0)vrFavs.splice(at,1);else vrFavs.push(f);
      try{localStorage.setItem('vr_favs',JSON.stringify(vrFavs))}catch(err){}
      this.classList.toggle('on',vrFavs.indexOf(f)>=0);
      if(typeof vrAchScan==='function')vrAchScan();
      var fq=document.getElementById('filter');
      if(fq&&(fq.value.toLowerCase().replace(/[^a-z0-9]/g,'')==='favorites'||fq.value.toLowerCase().replace(/[^a-z0-9]/g,'')==='favs'))buildList(fq.value);
    });
    li.querySelector('.lyBtn').addEventListener('click',function(e){
      if(typeof tutActive!=='undefined'&&tutActive)return;
      e.stopPropagation();
      openOsWin(+this.parentNode.dataset.pos,'lyrics');
    });
    li.addEventListener('click',function(){if(window.vrSfx)vrSfx('needle');loadTrack(+this.dataset.pos,true)});
    listEl.appendChild(li);
  }
  if(!listEl.children.length){
    var note=document.createElement('li');
    note.className='emptyNote';
    note.textContent=favMode?'no favorites yet - star some rows.':(recMode?'no spins yet - play something and it shows up here.':'nothing matches.');
    listEl.appendChild(note);
  }
}
document.getElementById('filter').addEventListener('input',function(){var v=(this.value||'').toLowerCase().trim();curLyFilter=(['lyrics','synced','word synced','wordsynced'].indexOf(v)>=0)?v:'';moodBtns.forEach(function(b){b.classList.toggle('on',b.dataset.filter?b.dataset.filter===curLyFilter:(b.dataset.mood===curMood&&!curLyFilter));});buildList(this.value)});

var crackleWanted=false;
var sleepMins=0,sleepTimer=null;

rebuildOrder();
queueLoad();
if(typeof ST.sort==='string')curSort=ST.sort;
if(typeof ST.lyFollow==='boolean')lyFollow=ST.lyFollow;
if(typeof ST.lyOffset==='number'&&isFinite(ST.lyOffset))lyOffset=ST.lyOffset;
if(typeof ST.lyLinger==='boolean')lyLinger=ST.lyLinger;
buildList('');
queueRender();
var sortSel=document.getElementById('sortSel');
if(sortSel){sortSel.value=curSort||'shelf';sortSel.addEventListener('change',function(){curSort=this.value||'shelf';saveSetting('sort',curSort);filterRender()})}
function applyViewMode(m){
  document.body.classList.toggle('theater',m==='theater');
  document.body.classList.toggle('mini',m==='mini');
  var bt=document.getElementById('btnTheater'),bm=document.getElementById('btnMini');
  if(bt)bt.classList.toggle('on',m==='theater');
  if(bm)bm.classList.toggle('on',m==='mini');
  saveSetting('viewMode',m||'normal');
}
var btnTheater=document.getElementById('btnTheater');
var btnMini=document.getElementById('btnMini');
if(btnTheater)btnTheater.addEventListener('click',function(){applyViewMode(document.body.classList.contains('theater')?'normal':'theater')});
if(btnMini)btnMini.addEventListener('click',function(){applyViewMode(document.body.classList.contains('mini')?'normal':'mini')});
if(ST.viewMode==='theater'||ST.viewMode==='mini')applyViewMode(ST.viewMode);

var btnCrackle=document.getElementById('btnCrackle');
var btnSleep=document.getElementById('btnSleep');
var sleepEndOfTrack=false;
function clearSleep(){if(sleepTimer){clearInterval(sleepTimer);sleepTimer=null}sleepMins=0;sleepEndOfTrack=false;btnSleep.textContent='\u23F1';btnSleep.classList.remove('on');btnSleep.title='sleep timer'}
function armSleepMinutes(mins){
  clearSleep();sleepMins=mins;btnSleep.classList.add('on');btnSleep.textContent=mins+'m';btnSleep.title='sleep timer: '+mins+' min';
  if(typeof vrAch==='function')vrAch('sleep_armed');
  sleepTimer=setInterval(function(){
    sleepMins--;
    if(sleepMins<=0){clearSleep();nowMeta.textContent='sleep timer ended. goodnight.';fadeVol(0,2500,function(){audio.pause();setVol(volBase)})}
    else{btnSleep.textContent=sleepMins+'m';btnSleep.title='sleep timer: '+sleepMins+' min left'}
  },60000);
}
function armSleepEndOfTrack(){clearSleep();sleepEndOfTrack=true;btnSleep.classList.add('on');btnSleep.textContent='end';btnSleep.title='sleep timer: end of track';if(typeof vrAch==='function')vrAch('sleep_armed')}
btnCrackle.addEventListener('click',function(){
  crackleWanted=!crackleWanted;
  btnCrackle.classList.toggle('on',crackleWanted);
  saveSetting('crackle',crackleWanted);
  if(window.setCrackleLevel)setCrackleLevel(crackleWanted&&!audio.paused?1:0);
  if(typeof vrAchScan==='function')vrAchScan();
});
btnSleep.addEventListener('click',function(){
  if(!sleepMins&&!sleepEndOfTrack)armSleepMinutes(15);
  else if(sleepMins===15)armSleepMinutes(30);
  else if(sleepMins===30)armSleepMinutes(60);
  else if(sleepMins===60)armSleepEndOfTrack();
  else clearSleep();
});

document.addEventListener('keydown',function(e){
  var tag=(e.target&&e.target.tagName)||'';
  if(tag==='INPUT'||tag==='TEXTAREA')return;
  if(!audioCtx&&window.audioEl)initVisualizer(window.audioEl);
  if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume().catch(function(){});
  if(e.code==='Space'){e.preventDefault();playPause()}
  else if(e.code==='ArrowRight'){e.preventDefault();nextTrack()}
  else if(e.code==='ArrowLeft'){e.preventDefault();prevTrack()}
  else if(e.key==='s'||e.key==='S'){btnShuffle.click()}
  else if(e.key==='l'||e.key==='L'){btnLoop.click()}
  else if(e.key==='c'||e.key==='C'){btnCrackle.click()}
});

// --- external sources -------------------------------------------------------
// dropped files and pasted youtube links live outside the shelf, so
// they can never count toward "the right way". blob urls get revoked on replace.
var externalMode=false,externalVideoSrc=null,localQueue=[],externalBlob=null;
var playQueue=[];
function queueSave(){try{localStorage.setItem('vr_queue',JSON.stringify(playQueue.filter(function(q){return q&&q.type==='shelf'&&Number.isInteger(q.pos)&&q.pos>=0&&q.pos<TRACKS.length}).map(function(q){return q.pos})))}catch(e){}}
function queueLoad(){try{var a=JSON.parse(localStorage.getItem('vr_queue')||'[]')||[];playQueue=a.filter(function(n){return Number.isInteger(n)&&n>=0&&n<TRACKS.length}).map(function(n){return {type:'shelf',pos:n}})}catch(e){playQueue=[]}}
function queueCountChip(){var chip=document.getElementById('qCountChip');if(chip)chip.textContent=String(playQueue.length)}
function queuePushShelf(i,front){if(!(i>=0&&i<TRACKS.length))return;var item={type:'shelf',pos:i};if(front)playQueue.unshift(item);else playQueue.push(item);queueSave();queueRender();showSrcMsg((front?'playing next: ':'queued: ')+TRACKS[i].n,'ok')}
function queuePushLocal(file,front){if(!file)return;var item={type:'local',file:file,title:file.name||'local file',video:isVideoName(file.name)||/^video\//.test(file.type)};if(front)playQueue.unshift(item);else playQueue.push(item);queueRender();showSrcMsg((front?'playing next: ':'queued: ')+(file.name||'local file'),'ok')}
function queueRemove(idx){if(idx<0||idx>=playQueue.length)return;playQueue.splice(idx,1);queueSave();queueRender()}
function queueClear(){playQueue=[];queueSave();queueRender();showSrcMsg('queue cleared','ok')}
function queuePlayNow(idx){if(idx<0||idx>=playQueue.length)return;var it=playQueue.splice(idx,1)[0];queueSave();queueRender();playQueueItem(it)}
function playQueueItem(it){
  if(!it)return false;
  if(it.type==='shelf'){loadTrack(it.pos,true);return true}
  if(it.type==='local'&&it.file){loadLocalFile(it.file);return true}
  if(it.type==='external'&&it.src){playExternal(it.src,it);return true}
  return false;
}
function queueNext(){
  while(playQueue.length){
    var it=playQueue.shift();
    queueSave();queueRender();
    if(playQueueItem(it))return true;
  }
  return false;
}
function queueRender(){
  var pane=document.getElementById('paneQueue');
  var meta=document.getElementById('nowMeta');
  if(pane&&!pane.hidden){
    pane.innerHTML='';
    var h=document.createElement('div');h.className='stHead';h.textContent='play queue ('+playQueue.length+')';pane.appendChild(h);
    var ctrls=document.createElement('div');ctrls.className='qCtrls';
    var clr=document.createElement('button');clr.className='qBtn';clr.textContent='clear queue';clr.addEventListener('click',queueClear);ctrls.appendChild(clr);
    pane.appendChild(ctrls);
    if(!playQueue.length){var e=document.createElement('div');e.className='stEmpty';e.textContent='queue is empty - use + on a track, or open the track menu for play next / add to queue.';pane.appendChild(e)}
    for(var i=0;i<playQueue.length;i++)(function(i){
      var it=playQueue[i];
      var row=document.createElement('div');row.className='qRow';
      var nm=document.createElement('div');nm.className='qNm';nm.textContent=it.type==='shelf'&&TRACKS[it.pos]?TRACKS[it.pos].n:(it.title||it.file&&it.file.name||'queued item');
      var acts=document.createElement('div');acts.className='qActs';
      var play=document.createElement('button');play.className='qBtn';play.textContent='play';play.addEventListener('click',function(){queuePlayNow(i)});
      var up=document.createElement('button');up.className='qBtn';up.textContent='up';up.disabled=i===0;up.addEventListener('click',function(){var t=playQueue[i-1];playQueue[i-1]=playQueue[i];playQueue[i]=t;queueSave();queueRender()});
      var dn=document.createElement('button');dn.className='qBtn';dn.textContent='down';dn.disabled=i===playQueue.length-1;dn.addEventListener('click',function(){var t=playQueue[i+1];playQueue[i+1]=playQueue[i];playQueue[i]=t;queueSave();queueRender()});
      var rm=document.createElement('button');rm.className='qBtn danger';rm.textContent='remove';rm.addEventListener('click',function(){queueRemove(i)});
      acts.appendChild(play);acts.appendChild(up);acts.appendChild(dn);acts.appendChild(rm);
      row.appendChild(nm);row.appendChild(acts);pane.appendChild(row);
    })(i);
  }
  var qn=playQueue.length;
  var chip=document.getElementById('qCountChip');
  if(chip)chip.textContent=qn?qn+' queued':'queue empty';
}
function showSrcMsg(text,kind){
  var el=document.getElementById('srcMsg');
  if(!el)return;
  el.textContent=text||'';
  el.className=kind||'';
}
function clearExternalVideo(){
  var vid=document.getElementById('bgVideo');
  if(!vid)return;
  try{vid.pause()}catch(e){}
  vid.hidden=true;vid.classList.remove('on');
  vid.removeAttribute('src');
  externalVideoSrc=null;
}
function setExternalVideo(src){
  var vid=document.getElementById('bgVideo');
  if(!vid||!src)return;
  externalVideoSrc=src;
  if(vid.getAttribute('src')!==src){vid.src=src;try{vid.load()}catch(e){}}
  vid.hidden=false;vid.classList.add('on');
  bgVideoSync(true);
}
function playExternal(src,opts){
  opts=opts||{};
  cleanBreak();cleanFile='';cleanStarted=false;
  pos=-1;externalMode=true;
  markPlaying();
  ++loadGen;
  if(externalBlob){try{URL.revokeObjectURL(externalBlob)}catch(e){}externalBlob=null}
  if(src.indexOf('blob:')===0)externalBlob=src;
  if(opts.video)setExternalVideo(src);else clearExternalVideo();
  audio.src=src;
  nowTitle.textContent=opts.title||'external source';
  nowMeta.textContent=opts.meta||'outside the collection';
  labelTitle.textContent=(opts.title||'external').slice(0,18);
  document.title='\u25b6 '+(opts.title||'external source')+' \u00b7 void records';
  tDur.textContent='--:--';
  if(opts.autoplay!==false)tryPlay();
}
function isVideoName(n){return /\.(webm|mp4|m4v|ogv|mov)$/i.test(n||'')}
function loadLocalFile(f){
  if(typeof vrRadioStop==='function')vrRadioStop();
  if(!f)return false;
  var okType=/^(audio|video)\//.test(f.type)||/\.(mp3|wav|ogg|oga|m4a|aac|flac|webm|mp4|m4v|ogv)$/i.test(f.name||'');
  if(!okType){
    showSrcMsg('unsupported file: '+(f.name||'unknown')+' - try mp3, wav, ogg, m4a, webm or mp4','err');
    return false;
  }
  var video=isVideoName(f.name)||/^video\//.test(f.type);
  var blob=URL.createObjectURL(f);
  playExternal(blob,{
    title:(f.name||'local file').replace(/\.[^.]+$/,''),
    meta:'local file - not in the collection'+(video?' - video bg on':''),
    video:video
  });
  showSrcMsg('loaded '+f.name+(localQueue.length?' + '+localQueue.length+' queued':''),'ok');
  if(typeof vrAch==='function')vrAch('local_file');
  return true;
}

// youtube links resolve through the opt-in local server: the browser cannot do
// this itself (cors + signed streams), so a missing server is a real error.
var YT_RE=/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/|music\.youtube\.com\/(?:watch\?(?:.*&)?v=))([a-zA-Z0-9_-]{11})/i;
function parseYouTube(raw){var m=String(raw||'').match(YT_RE);return m?m[1]:null}
function loadYouTube(){
  if(typeof vrRadioStop==='function')vrRadioStop();
  var raw=(document.getElementById('srcInput')||{}).value||'';
  raw=raw.trim();
  if(!raw){showSrcMsg('paste a youtube link first','err');return}
  var id=parseYouTube(raw);
  if(!id){showSrcMsg('that is not a youtube link - try a youtube.com/watch, shorts or youtu.be url','err');return}
  if(!serverOn()){
    showSrcMsg('youtube needs the local void records server - turn it on in settings (use an https tunnel url if this page is https)','err');
    return;
  }
  var btn=document.getElementById('srcLoad');
  if(btn)btn.disabled=true;
  showSrcMsg('resolving '+id+' ...','wait');
  var gen=++loadGen;
  fetch(serverBase()+'/api/v1/resolve?url='+encodeURIComponent(raw)).then(function(r){
    return r.json().catch(function(){return {}}).then(function(j){return {status:r.status,j:j}});
  }).then(function(res){
    if(btn)btn.disabled=false;
    if(gen!==loadGen)return;
    var j=res.j||{};
    if(res.status!==200||!j.url){
      showSrcMsg('cannot play this video: '+(j.error||('server returned '+res.status)),'err');
      return;
    }
    playExternal(j.url,{
      title:j.title||('youtube '+id),
      meta:(j.channel?j.channel+' - ':'')+'youtube - not in the collection',
      video:true
    });
    showSrcMsg('playing '+id+(j.expires?' - stream link is temporary':''),'ok');
  }).catch(function(err){
    if(btn)btn.disabled=false;
    if(gen!==loadGen)return;
    showSrcMsg('cannot reach the void records server: '+((err&&err.message)||'unknown error'),'err');
  });
}
var srcLoadBtn=document.getElementById('srcLoad');
if(srcLoadBtn)srcLoadBtn.addEventListener('click',loadYouTube);
var srcInputEl=document.getElementById('srcInput');
if(srcInputEl)srcInputEl.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();loadYouTube()}});

var turntable=document.getElementById('turntable');
document.addEventListener('dragover',function(e){e.preventDefault();turntable.classList.add('drop')});
document.addEventListener('dragleave',function(e){if(!e.relatedTarget)turntable.classList.remove('drop')});
document.addEventListener('drop',function(e){
  e.preventDefault();
  turntable.classList.remove('drop');
  var dt=e.dataTransfer;
  var files=dt&&dt.files?Array.prototype.slice.call(dt.files):[];
  if(files.length){
    localQueue=files.slice(1);
    loadLocalFile(files[0]);
    return;
  }
  var dropped=dt&&(dt.getData('text/uri-list')||dt.getData('text/plain'));
  if(dropped&&/^https?:\/\//i.test(dropped.trim())){
    if(srcInputEl)srcInputEl.value=dropped.trim();
    loadYouTube();
  }
});

function showResumePrompt(){
  var r=ST.resume;
  var bar=document.getElementById('resumeBar');
  var txt=document.getElementById('resumeText');
  var go=document.getElementById('resumeGo');
  var dis=document.getElementById('resumeDismiss');
  if(!bar||!txt||!go||!dis||!r||!r.f)return;
  var idx=-1;for(var i=0;i<TRACKS.length;i++){if(TRACKS[i].f===r.f){idx=i;break}}
  if(idx<0||r.t<2)return;
  if(r.d && r.t>=r.d-15)return;
  txt.textContent='resume '+TRACKS[idx].n+' at '+fmt(r.t)+'?';
  bar.hidden=false;
  go.onclick=function(){
    bar.hidden=true;loadTrack(idx,false);var t=r.t;var want=r.playing;
    audio.addEventListener('loadedmetadata',function once(){audio.removeEventListener('loadedmetadata',once);try{audio.currentTime=Math.min(t,Math.max(0,(audio.duration||t+1)-1))}catch(e){} if(want)tryPlay();},false);
  };
  dis.onclick=function(){bar.hidden=true;clearResume();};
}

var qTrack=new URLSearchParams(location.search).get('track');
if(qTrack){
  var qq=qTrack.toLowerCase().replace(/[^a-z0-9]/g,'');
  for(var qi=0;qi<TRACKS.length;qi++){
    var hay=(TRACKS[qi].n+' '+TRACKS[qi].a.join(' ')+' '+TRACKS[qi].f).toLowerCase().replace(/[^a-z0-9]/g,'');
    if(qq&&hay.indexOf(qq)>=0){loadTrack(qi,true);if(typeof vrAch==='function')vrAch('deep_link');break}
  }
}else{
  showResumePrompt();
}

var setPanel=document.getElementById('setPanel');
document.getElementById('btnSet').addEventListener('click',function(){
  setPanel.classList.toggle('open');
  this.classList.toggle('on',setPanel.classList.contains('open'));
});
var overdriveFired=false;
document.getElementById('setSpeed').addEventListener('input',function(){
  cleanBreak();
  var v=parseFloat(this.value);
  audio.playbackRate=v;
  document.getElementById('setSpeedV').textContent=v.toFixed(2)+'\u00d7';
  saveSetting('speed',v);
  bgVideoSync();
});
document.getElementById('setSpeed').addEventListener('change',function(){
  var v=parseFloat(this.value);
  if(v>=2&&!overdriveFired&&typeof vrAch==='function'){overdriveFired=true;vrAch('overdrive');}
});
var pitchExtremeFired=false;
document.getElementById('setPitch').addEventListener('input',function(){
  var v=parseInt(this.value,10);
  if(window.setPitchRatio)setPitchRatio(Math.pow(2,v/12));
  document.getElementById('setPitchV').textContent=(v>0?'+':'')+v+' st';
  saveSetting('pitch',v);
});
document.getElementById('setPitch').addEventListener('change',function(){
  var v=parseInt(this.value,10);
  if(Math.abs(v)===12&&!pitchExtremeFired&&typeof vrAch==='function'){pitchExtremeFired=true;vrAch('pitch_extreme');}
});
function fmtTone(hz){return hz>=15500?'open':(hz>=1000?(hz/1000).toFixed(1)+'k':hz+'hz');}
var toneDarkFired=false;
document.getElementById('setToneS').addEventListener('input',function(){
  var hz=parseInt(this.value,10);
  if(window.setTone)setTone(hz);
  document.getElementById('setToneV').textContent=fmtTone(hz);
  saveSetting('tone',hz);
});
document.getElementById('setToneS').addEventListener('change',function(){
  var hz=parseInt(this.value,10);
  if(window.setTone)setTone(hz);
  document.getElementById('setToneV').textContent=fmtTone(hz);
  saveSetting('tone',hz);
  if(hz<=900&&!toneDarkFired&&typeof vrAch==='function'){toneDarkFired=true;vrAch('tone_dark');}
});
function fmtDb(v){return (v>0?'+':'')+v+' db';}
function fmtVerb(p){return p===0?'dry':(p>=100?'wash':p+'%');}
function fmtWow(p){return p===0?'off':p+'%';}
function wowHz(r){return .2+(r/100)*1.8;}
function markPreset(name){
  var bs=document.querySelectorAll('.setPresets button');
  for(var i=0;i<bs.length;i++)bs[i].classList.toggle('on',bs[i].getAttribute('data-eq')===name);
}
var setBassEl=document.getElementById('setBass');
setBassEl.addEventListener('input',function(){
  var v=parseInt(this.value,10);
  if(window.setBass)setBass(v);
  document.getElementById('setBassV').textContent=fmtDb(v);
  saveSetting('bass',v);markPreset(null);
});
var setTrebleEl=document.getElementById('setTreble');
setTrebleEl.addEventListener('input',function(){
  var v=parseInt(this.value,10);
  if(window.setTreble)setTreble(v);
  document.getElementById('setTrebleV').textContent=fmtDb(v);
  saveSetting('treble',v);markPreset(null);
});
var setVerbEl=document.getElementById('setVerb');
setVerbEl.addEventListener('input',function(){
  var v=parseInt(this.value,10);
  if(window.setVerb)setVerb(v/100,parseFloat(document.getElementById('setVerbSize').value));
  document.getElementById('setVerbV').textContent=fmtVerb(v);
  saveSetting('verb',v);markPreset(null);
});
var setVerbSizeEl=document.getElementById('setVerbSize');
setVerbSizeEl.addEventListener('change',function(){
  var v=parseFloat(this.value);
  if(window.setVerb)setVerb(parseInt(setVerbEl.value,10)/100,v);
  saveSetting('verbSize',v);markPreset(null);
});
var setWowEl=document.getElementById('setWow');
setWowEl.addEventListener('input',function(){
  var v=parseInt(this.value,10);
  if(window.setWow)setWow(v/100,parseInt(document.getElementById('setWowRate').value,10));
  document.getElementById('setWowV').textContent=fmtWow(v);
  saveSetting('wow',v);markPreset(null);
});
var setWowRateEl=document.getElementById('setWowRate');
setWowRateEl.addEventListener('input',function(){
  var v=parseInt(this.value,10);
  if(window.setWow)setWow(parseInt(setWowEl.value,10)/100,v);
  document.getElementById('setWowRateV').textContent=wowHz(v).toFixed(1)+' hz';
  saveSetting('wowRate',v);markPreset(null);
});
var EQ_PRESETS={
  flat:{bass:0,treble:0,tone:16000,verb:0,verbSize:1.4,wow:0,wowRate:40},
  night:{bass:-2,treble:-8,tone:3800,verb:0,verbSize:.6,wow:0,wowRate:40},
  radio:{bass:3,treble:4,tone:6800,verb:12,verbSize:.6,wow:8,wowRate:55},
  void:{bass:6,treble:-4,tone:9000,verb:65,verbSize:2.6,wow:14,wowRate:25},
  warped:{bass:2,treble:2,tone:16000,verb:20,verbSize:1.4,wow:70,wowRate:70}
};
function applyPreset(name){
  var p=EQ_PRESETS[name];if(!p)return;
  document.getElementById('setBass').value=p.bass;
  document.getElementById('setTreble').value=p.treble;
  document.getElementById('setToneS').value=p.tone;
  setVerbEl.value=p.verb;
  setVerbSizeEl.value=String(p.verbSize);
  setWowEl.value=p.wow;
  setWowRateEl.value=p.wowRate;
  if(window.setBass)setBass(p.bass);
  if(window.setTreble)setTreble(p.treble);
  if(window.setTone)setTone(p.tone);
  if(window.setVerb)setVerb(p.verb/100,p.verbSize);
  if(window.setWow)setWow(p.wow/100,p.wowRate);
  document.getElementById('setBassV').textContent=fmtDb(p.bass);
  document.getElementById('setTrebleV').textContent=fmtDb(p.treble);
  document.getElementById('setToneV').textContent=fmtTone(p.tone);
  document.getElementById('setVerbV').textContent=fmtVerb(p.verb);
  document.getElementById('setWowV').textContent=fmtWow(p.wow);
  document.getElementById('setWowRateV').textContent=wowHz(p.wowRate).toFixed(1)+' hz';
  ['bass','treble','tone','verb','verbSize','wow','wowRate'].forEach(function(k){saveSetting(k,p[k])});
  markPreset(name);
  if(window.vrSfx)vrSfx('toggle');
}
var presetBtns=document.querySelectorAll('.setPresets button');
for(var pi=0;pi<presetBtns.length;pi++){
  presetBtns[pi].addEventListener('click',function(){applyPreset(this.getAttribute('data-eq'))});
}
var setVideoBgEl=document.getElementById('setVideoBg');
if(setVideoBgEl)setVideoBgEl.addEventListener('change',function(){
  var on=!!this.checked;
  saveSetting('videoBg',on);
  var v=document.getElementById('setVideoBgV');
  if(v)v.textContent=on?'on':'off';
  if(typeof vrVideoBgApply==='function')vrVideoBgApply();
});
var setServerEl=document.getElementById('setServer');
var setServerUrlEl=document.getElementById('setServerUrl');
var setServerUrlRow=document.getElementById('setServerUrlRow');
if(setServerUrlEl){
  setServerUrlEl.value=ST.serverUrl||'http://127.0.0.1:8787';
  setServerUrlEl.addEventListener('change',function(){
    saveSetting('serverUrl',this.value.trim()||'http://127.0.0.1:8787');
    this.value=ST.serverUrl;
    if(serverOn())serverPing();
  });
}
if(setServerUrlRow)setServerUrlRow.classList.toggle('on',serverOn());
if(setServerEl){
  setServerEl.checked=serverOn();
  setServerEl.addEventListener('change',function(){
    var on=!!this.checked;
    saveSetting('server',on);
    if(setServerUrlRow)setServerUrlRow.classList.toggle('on',on);
    if(on){serverPing();serverPushNow()}
    else{var v=document.getElementById('setServerV');if(v)v.textContent='off'}
  });
}
if(serverOn())serverPing();
window.addEventListener('beforeunload',function(){if(serverOn())serverPushNow()});
// keep the video locked to the audio clock. toggling the bg off only hides/pauses it,
// so re-enabling resumes from the song position instead of restarting from zero.
function bgVideoSync(force){
  var vid=document.getElementById('bgVideo');
  if(!vid||vid.hidden||!audio||!isFinite(audio.currentTime)||audio.currentTime<0)return;
  var t=audio.currentTime;
  if(isFinite(vid.duration)&&vid.duration>0)t=Math.min(t,Math.max(0,vid.duration-0.05));
  if(force||!isFinite(vid.currentTime)||Math.abs(vid.currentTime-t)>0.35){
    try{vid.currentTime=t}catch(e){}
  }
  vid.playbackRate=audio.playbackRate||1;
  if(audio.paused){if(!vid.paused)try{vid.pause()}catch(e){}}
  else if(vid.paused){var p=vid.play();if(p&&p.catch)p.catch(function(){})}
}
function vrVideoBgSet(tr, src){
  var vid=document.getElementById('bgVideo');
  if(!vid||!tr)return;
  var on=!!ST.videoBg && /\.(webm|mp4)$/i.test(tr.f);
  if(!on){
    try{vid.pause()}catch(e){}
    vid.classList.remove('on');
    vid.hidden=true;
    return;
  }
  var next=src||('tracks/'+tr.f);
  if(vid.getAttribute('src')!==next){
    vid.src=next;
    try{vid.load()}catch(e){}
  }
  vid.hidden=false;
  vid.classList.add('on');
  bgVideoSync(true);
}
function vrVideoBgApply(){ if(pos>=0&&pos<TRACKS.length) vrVideoBgSet(TRACKS[pos], curBlobUrl||('tracks/'+TRACKS[pos].f)) }

if(typeof ST.volume==='number'){document.getElementById('vol').value=ST.volume;volBase=ST.volume/100;setVol(volBase)}
if(typeof ST.speed==='number'){audio.playbackRate=ST.speed;document.getElementById('setSpeed').value=ST.speed;document.getElementById('setSpeedV').textContent=ST.speed.toFixed(2)+'\u00d7'}
if(typeof ST.pitch==='number'){document.getElementById('setPitch').value=ST.pitch;if(window.setPitchRatio)setPitchRatio(Math.pow(2,ST.pitch/12));document.getElementById('setPitchV').textContent=(ST.pitch>0?'+':'')+ST.pitch+' st'}
if(typeof ST.tone==='number'){document.getElementById('setToneS').value=ST.tone;if(window.setTone)setTone(ST.tone);document.getElementById('setToneV').textContent=fmtTone(ST.tone)}
if(typeof ST.bass==='number'){document.getElementById('setBass').value=ST.bass;if(window.setBass)setBass(ST.bass);document.getElementById('setBassV').textContent=fmtDb(ST.bass)}
if(typeof ST.treble==='number'){document.getElementById('setTreble').value=ST.treble;if(window.setTreble)setTreble(ST.treble);document.getElementById('setTrebleV').textContent=fmtDb(ST.treble)}
if(typeof ST.verb==='number'){
  var savedVerbSize=typeof ST.verbSize==='number'?ST.verbSize:1.4;
  setVerbEl.value=ST.verb;setVerbSizeEl.value=String(savedVerbSize);
  if(window.setVerb)setVerb(ST.verb/100,savedVerbSize);
  document.getElementById('setVerbV').textContent=fmtVerb(ST.verb);
}
if(typeof ST.wow==='number'){
  var savedWowRate=typeof ST.wowRate==='number'?ST.wowRate:40;
  setWowEl.value=ST.wow;setWowRateEl.value=savedWowRate;
  if(window.setWow)setWow(ST.wow/100,savedWowRate);
  document.getElementById('setWowV').textContent=fmtWow(ST.wow);
  document.getElementById('setWowRateV').textContent=wowHz(savedWowRate).toFixed(1)+' hz';
}
(function detectPreset(){
  var keys=['bass','treble','tone','verb','wow'];
  for(var n in EQ_PRESETS){
    var p=EQ_PRESETS[n],ok=true;
    for(var i=0;i<keys.length;i++)if(ST[keys[i]]!==p[keys[i]]){ok=false;break}
    if(ok){markPreset(n);return}
  }
  markPreset(null);
})();
if('crackle' in ST){crackleWanted=!!ST.crackle;btnCrackle.classList.toggle('on',crackleWanted)}
if('videoBg' in ST){document.getElementById('setVideoBg').checked=!!ST.videoBg;document.getElementById('setVideoBgV').textContent=ST.videoBg?'on':'off'}

var THEMES=['default','halloween','ocean','forest','sunset'];
var btnHalloween=document.getElementById('btnHalloween');
function setTheme(name){
  name=THEMES.indexOf(name)>=0?name:'default';
  if(name==='default')document.body.removeAttribute('data-theme');
  else document.body.setAttribute('data-theme',name);
  if(btnHalloween)btnHalloween.textContent=name==='halloween'?'🎃 normal':'🎃 halloween';
  saveSetting('theme',name);
}
if(btnHalloween)btnHalloween.addEventListener('click',function(){
  setTheme(document.body.getAttribute('data-theme')==='halloween'?'default':'halloween');
});
if(ST.theme)setTheme(ST.theme);
else if(ST.halloween)setTheme('halloween');

var themePick=document.getElementById('themePick');
if(themePick){
  themePick.value=document.body.getAttribute('data-theme')||'default';
  themePick.addEventListener('change',function(){setTheme(this.value)});
}

var curMood='all';
var curSort='shelf';
var MOOD_KEYS={
  chill:['chill','coffee','ambient','drone','grotto','soft','calm','quiet'],
  hype:['hype','fast','fight','battle','boss','heavy','metal','dokuro'],
  weird:['weird','wacky','cactus','horror','sinister','lord','verity','foxy'],
  sleep:['sleep','dream','night','moon','slow','low','napcast','drone'],
  sad:['sad','miss','remember','downfall','employment','terrible','meltdown']
};
function matchesMood(tr,mood){
  try {
    if(!tr||!mood||mood==='all')return true;
    var keys=MOOD_KEYS[mood]||[];
    var n=(tr&&tr.n)?tr.n:'';
    var a=(tr&&tr.a&&tr.a.join)?tr.a.join(' '):'';
    var f=(tr&&tr.f)?tr.f:'';
    var hay=(n+' '+a+' '+f).toLowerCase();
    for(var i=0;i<keys.length;i++)if(hay.indexOf(keys[i])>=0)return true;
    return false;
  } catch(e){ console.error('matchesMood err', e, tr, mood); return true; }
}
var moodBtns=document.querySelectorAll('#moods button');
function filterRender(){
  var fq=document.getElementById('filter');
  buildList(fq?fq.value:'');
}
var curLyFilter='';
function setMood(mood){
  curMood=mood;
  curLyFilter='';
  var fq=document.getElementById('filter');
  if(fq && ['lyrics','synced','word synced'].indexOf((fq.value||'').toLowerCase().trim())>=0) fq.value='';
  moodBtns.forEach(function(b){b.classList.toggle('on',b.dataset.mood===mood)});
  filterRender();
}
moodBtns.forEach(function(b){
  b.addEventListener('click',function(){
    if(this.dataset.filter){
      var f=this.dataset.filter;
      var fq=document.getElementById('filter');
      curLyFilter=(curLyFilter===f)?'':f;
      if(fq) fq.value=curLyFilter;
      moodBtns.forEach(function(x){x.classList.toggle('on', x.dataset.filter ? x.dataset.filter===curLyFilter : x.dataset.mood===curMood && !curLyFilter)});
      filterRender();
      return;
    }
    setMood(this.dataset.mood);
  });
});

var tutSpot=document.getElementById('tutSpot');
var tutTip=document.getElementById('tutTip');
var tutSkip=document.getElementById('tutSkip');
var tutTitle=tutTip.querySelector('.tutTitle');
var tutBody=tutTip.querySelector('.tutBody');
var tutBtn=tutTip.querySelector('.tutBtn');
var tutActive=false,tutI=0,tutTimer=null;

var tutSteps=[
  {center:true,btn:'start',title:'void records',
   text:'498 records, one deck. quick tour - ten clicks, then you are free. you can replay it any time from the footer.'},
  {el:'#list li',title:'the shelf',
   text:'every record in the collection. click one and it loads straight onto the deck. the amber row is what is spinning.'},
  {el:'#turntable',title:'the deck',
   text:'the disc only spins while music plays - needle sits on the groove when it is live, rests on the rim when it is not.'},
  {el:'#controls',title:'transport',
   text:'prev / play / next. shuffle rearranges the order (S), loop-one repeats (L). space = play or pause.'},
  {el:'#seek',title:'the groove marker',
   text:'drag to scrub through the record. elapsed time on the left, total duration on the right.'},
  {el:'#volWrap',title:'volume',
   text:'as it says. louder than wisdom recommends.'},
  {el:'#chips',title:'odds and ends',
   text:'the wavy chip is vinyl crackle - needle hiss and pops over the music (C). the clock is a sleep timer: 15 / 30 / 60 minutes, then it pauses the deck and lets you go.'},
  {el:'#btnSet',title:'music settings',
   text:'the gear opens speed, independent pitch, tone, bass/treble, space (reverb) and wow. pitch is real DSP - it does not touch the speed. presets do the whole stack in one click. server is an opt-in bridge to a local void records server for shared audio and state.'},
  {el:'#filter',title:'the filter',
   text:'type to narrow the shelf. names, aliases and filenames all match - try "employment", "sm07", or "recent" to see what you played last.'},
  {center:true,btn:'done',title:"you're free",
   text:'keys: space, arrows, S, L, C. drag any mp3 onto the deck for local files. deep links: ?track=employment. replay from the footer whenever.'}
];

function tutSpotAt(r,pad){
  tutSpot.style.left=(r.left-pad)+'px';
  tutSpot.style.top=(r.top-pad)+'px';
  tutSpot.style.width=(r.width+pad*2)+'px';
  tutSpot.style.height=(r.height+pad*2)+'px';
}
function tutPlaceTip(r){
  tutTip.style.transform='';
  var tr=tutTip.getBoundingClientRect();
  var top=r.bottom+20;
  var above=false;
  if(top+tr.height>window.innerHeight-12){top=r.top-tr.height-20;above=true}
  if(top<12){top=Math.min(r.bottom+20,window.innerHeight-tr.height-12);above=false}
  if(top<12){top=12;above=true}
  tutTip.classList.toggle('noArrow',above);
  var left=r.left+r.width/2-tr.width/2;
  left=Math.max(12,Math.min(left,window.innerWidth-tr.width-12));
  tutTip.style.left=left+'px';
  tutTip.style.top=Math.max(12,top)+'px';
}
function tutShow(){
  var s=tutSteps[tutI];
  if(!s){tutDone();return}
  var hi=document.querySelector('.tutHi');
  if(hi)hi.classList.remove('tutHi');
  tutSpot.hidden=false;tutTip.hidden=false;tutSkip.hidden=false;
  tutTitle.textContent=s.title;
  tutBody.textContent=s.text;
  if(s.center){
    tutTip.classList.add('noArrow');
    tutBtn.hidden=false;tutBtn.textContent=s.btn;
    requestAnimationFrame(function(){
      tutTip.style.left='0px';tutTip.style.top='0px';
      var tr=tutTip.getBoundingClientRect();
      tutTip.style.left=Math.round((window.innerWidth-tr.width)/2)+'px';
      tutTip.style.top=Math.round((window.innerHeight-tr.height)/2)+'px';
      requestAnimationFrame(function(){tutSpotAt(tutTip.getBoundingClientRect(),12)});
    });
    return;
  }
  tutTip.classList.remove('noArrow');
  tutBtn.hidden=true;
  var el=document.querySelector(s.el);
  if(!el){tutAdvance();return}
  el.classList.add('tutHi');
  try{el.scrollIntoView({block:'center'})}catch(e){}
  clearTimeout(tutTimer);
  tutTimer=setTimeout(function(){
    var r=el.getBoundingClientRect();
    tutSpotAt(r,14);
    tutPlaceTip(r);
  },380);
}
function tutAdvance(){
  tutI++;
  if(tutI>=tutSteps.length){tutDone();return}
  tutShow();
}
function tutFinish(){
  try{localStorage.setItem('tutorialCompleted','1')}catch(e){}
}
function tutDone(){
  tutFinish();
  tutActive=false;
  clearTimeout(tutTimer);
  var hi=document.querySelector('.tutHi');
  if(hi)hi.classList.remove('tutHi');
  tutSpot.hidden=true;tutTip.hidden=true;tutSkip.hidden=true;
}
function tutStart(){
  tutActive=true;
  tutI=0;
  tutShow();
}
tutBtn.addEventListener('click',function(){tutAdvance()});
tutSkip.addEventListener('click',function(){tutDone()});
document.addEventListener('click',function(e){
  if(!tutActive)return;
  var s=tutSteps[tutI];
  if(!s||s.center)return;
  var el=document.querySelector(s.el);
  if(el&&el.contains(e.target))tutAdvance();
},true);
window.addEventListener('resize',function(){if(tutActive)tutShow()});
document.getElementById('btnTutorial').addEventListener('click',tutStart);
var btnExport=document.getElementById('btnExport');
var btnImport=document.getElementById('btnImport');
var importFile=document.getElementById('importFile');
if(btnExport)btnExport.addEventListener('click',exportBackup);
if(btnImport&&importFile){
  btnImport.addEventListener('click',function(){importFile.value='';importFile.click()});
  importFile.addEventListener('change',function(){if(this.files&&this.files[0])importBackupFile(this.files[0])});
}
var btnQueue=document.getElementById('btnQueue');
if(btnQueue)btnQueue.addEventListener('click',function(){openOsWin(Math.max(0,pos),'queue')});

try{
  if(!localStorage.getItem('tutorialCompleted'))setTimeout(tutStart,700);
}catch(e){setTimeout(tutStart,700)}

var osWin=document.getElementById('osWin');
var osPos=-1;
var lyCache={};
var lyLines=[],lyLineEls=[],lyNow=-1,lyWordEls=[],lyWordNow=-1,lyFollow=true,lyOffset=0,lyLinger=true;

function osShow(){
  osWin.hidden=false;
  osWin.classList.remove('out','anim');
  void osWin.offsetWidth;
  osWin.classList.add('anim');
  window.__zN=(window.__zN||0)+1;
  osWin.style.zIndex=String(72+window.__zN);
  if(typeof vrAch==='function')vrAch('window_open');
}
function osHide(){
  osWin.classList.add('out');
  setTimeout(function(){osWin.hidden=true;osWin.classList.remove('out','anim')},170);
}
document.getElementById('winClose').addEventListener('click',osHide);
document.getElementById('winMin').addEventListener('click',osHide);
document.getElementById('winMax').addEventListener('click',function(){
  osWin.classList.toggle('max');
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'&&!osWin.hidden&&!tutActive)osHide();
});

function osTab(name){
  var tabs=document.querySelectorAll('.osTab');
  for(var i=0;i<tabs.length;i++)tabs[i].classList.toggle('on',tabs[i].dataset.tab===name);
  var paneId='pane'+name.charAt(0).toUpperCase()+name.slice(1);
  var panes=document.querySelectorAll('.osPane');
  for(var p=0;p<panes.length;p++)panes[p].hidden=panes[p].id!==paneId;
  var vis=document.getElementById(paneId);
  if(!vis)return;
  vis.classList.remove('tabIn');
  void vis.offsetWidth;
  vis.classList.add('tabIn');
  if(name==='lyrics'&&osPos>=0&&vis.dataset.f!==TRACKS[osPos].f)lyLoad(osPos);
  if(name==='queue')queueRender();
  if(name==='info'&&osPos>=0)infoRender(osPos);
  if(name==='stats'){statsRender();if(typeof vrAch==='function')vrAch('tab_stats')}
  if(name==='credits'&&typeof vrAch==='function')vrAch('tab_credits');
  if(name==='awards')awardsRender();
}
var osTabBtns=document.querySelectorAll('.osTab');
for(var oi=0;oi<osTabBtns.length;oi++){
  (function(b){b.addEventListener('click',function(){osTab(b.dataset.tab)})})(osTabBtns[oi]);
}

function openOsWin(pos,tab){
  var global=(tab==='awards'||tab==='stats'||tab==='credits');
  var tr=TRACKS[pos];
  if(!tr&&!global)return;
  if(tr){
    osPos=pos;
    document.getElementById('osWinTitle').textContent=tr.n;
  }else{
    document.getElementById('osWinTitle').textContent='void records';
  }
  osShow();
  osTab(tab||'lyrics');
}
document.getElementById('btnAch').addEventListener('click',function(){openOsWin(osPos,'awards')});

/* ── vinyl scratch ── */
var discEl=document.getElementById('disc');
var scratch=false,scratchWas=false,scratchLastA=0,scratchBase=0;
function discCenter(){
  if(!discEl||!discEl.getBoundingClientRect)return {x:0,y:0};
  var r=discEl.getBoundingClientRect();
  return {x:r.left+r.width/2,y:r.top+r.height/2};
}
function angleFrom(e){
  var c=discCenter();
  var p=e.touches&&e.touches.length?e.touches[0]:e;
  return Math.atan2(p.clientY-c.y,p.clientX-c.x);
}
function normDelta(a){
  while(a>Math.PI)a-=Math.PI*2;
  while(a<-Math.PI)a+=Math.PI*2;
  return a;
}
if(discEl){
  discEl.addEventListener('mousedown',function(e){
    scratch=true;scratchWas=!audio.paused;scratchLastA=angleFrom(e);scratchBase=audio.currentTime;
    audio.pause();
  });
  discEl.addEventListener('touchstart',function(e){
    scratch=true;scratchWas=!audio.paused;scratchLastA=angleFrom(e);scratchBase=audio.currentTime;
    audio.pause();
    e.preventDefault();
  },{passive:false});
}
document.addEventListener('mousemove',function(e){
  if(!scratch||!audio.duration)return;
  var a=angleFrom(e);
  var d=normDelta(a-scratchLastA);
  scratchLastA=a;
  scratchBase+=d*audio.duration/(Math.PI*2);
  scratchBase=Math.max(0,Math.min(audio.duration,scratchBase));
  audio.currentTime=scratchBase;
});
document.addEventListener('touchmove',function(e){
  if(!scratch||!audio.duration)return;
  var a=angleFrom(e);
  var d=normDelta(a-scratchLastA);
  scratchLastA=a;
  scratchBase+=d*audio.duration/(Math.PI*2);
  scratchBase=Math.max(0,Math.min(audio.duration,scratchBase));
  audio.currentTime=scratchBase;
},{passive:false});
function endScratch(){
  if(!scratch)return;
  scratch=false;
  if(scratchWas)tryPlay();
}
document.addEventListener('mouseup',endScratch);
document.addEventListener('touchend',endScratch);

function lyNorm(s){
  return String(s||'').toLowerCase().replace(/\[[^\]]*\]/g,'').replace(/[^a-z0-9]/g,'');
}
var LYR_PRESETS={
  'friday.mp3':{
    head:'Windows96 - Landscaping',
    body:'[instrumental]\n\nfrom the album "Reflections" (2017), track 12.\npure vaporwave - no vocals, nothing to sing along to.\n\n(lrclib thinks you meant "Landscaping" by Shordie.\nlrclib is wrong.)'
  }
};
var LYR_IDS={
  'm12-BGSgMILPOeg.webm':36014973,
  'm3-too_late_already_died.webm':36118285,
  'm3-if_you_see_me_use_ubuntu.webm':36896646,
  'm4-5VsyzvvbXLQ.webm':37262336,
  'm45-0-pbkPm8oAg.webm':10586817,
  'm45-0VKY7Moy4so.webm':28780317,
  'sinister-02.webm':17202052,
  'sinister-03.mp3':26401682,
  'sinister-04.mp3':34123146,
  'sinister-05.mp3':16160040,
  'sinister-06.mp3':30109986,
  'sinister-07.mp3':30116975,
  'sinister-08.mp3':30116669,
  'sinister-09.mp3':30116359,
  'sinister-11.mp3':30262774,
  'bang-bang-bang-chainsaw-man.webm':32488447,
  'bang-bang-bang-lilyappa-remix.webm':39005350,
  'sinister-12.mp3':30111875,
  'sinister-13.mp3':30110574,
  'sinister-14.mp3':32700570,
  'sinister-15.mp3':27764751,
  'sinister-16.mp3':35947637,
  'sinister-17.mp3':24453346,
  'random-gleeco.mp3':30117486,
  'm5-ri1SiiTeUis.webm':26401682,
  'm5-J1DAmmROUX8.webm':10479079,
  'm5-fHEQc0oVlZc.webm':22825767,
  'm7-J7Xzgcu6vVk.webm':17998314,
  'm7-K3xJH7DqE7c.webm':10352028,
  'm45-HsZQOXZbWkQ.webm':12735293,
  'm45--eDYT_20YhM.webm':20807221,
  'm45-hbuNxmAXdNk.webm':27082810,
  'm45-cF91xil98Mc.webm':30728657,
  'tally-rulerofeverything.mp3':14601874,
  'tally-bananaman.mp3':9401367,
  'hskunx-heyitsme.mp3':37357262,
  'hskunx-lordverity.mp3':39990526,
  'm12-nebNhtYSlFw.webm':29416080
};


function parseLRC(txt){
  var out=[],lines=String(txt).split(/\r?\n/);
  for(var i=0;i<lines.length;i++){
    var rest=lines[i],times=[],mm;
    while((mm=rest.match(/^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/))){
      times.push(parseInt(mm[1],10)*60+parseInt(mm[2],10)+parseFloat('0.'+(mm[3]||'0')));
      rest=rest.slice(mm[0].length);
    }
    if(!times.length)continue;
    var text=rest.trim();
    for(var k=0;k<times.length;k++)out.push({t:times[k],x:text});
  }
  out.sort(function(a,b){return a.t-b.t});
  return out;
}
// lrclib's word-synced "lyricsfile" is yaml-ish: line - text/start_ms/end_ms,
// then a words: list with per-word text + start_ms. no yaml parser needed.
function unquoteYaml(s){
  s=String(s==null?'':s).trim();
  if(s.length>1&&((s[0]==="'"&&s[s.length-1]==="'")||(s[0]==='"'&&s[s.length-1]==='"'))){
    return s.slice(1,-1).replace(/''/g,"'");
  }
  return s;
}
function parseWordLyrics(txt){
  if(!txt)return [];
  var raw=String(txt).split(/\r?\n/),lines=[],cur=null,inWords=false;
  for(var i=0;i<raw.length;i++){
    var line=raw[i];
    var m=line.match(/^- text:\s*(.*)$/);
    if(m){
      if(cur)lines.push(cur);
      cur={t:0,e:0,x:unquoteYaml(m[1]),words:[]};
      inWords=false;
      continue;
    }
    if(!cur)continue;
    var sm=line.match(/^  start_ms:\s*(\d+)/);
    if(sm&&!inWords){cur.t=parseInt(sm[1],10)/1000;continue}
    var em=line.match(/^  end_ms:\s*(\d+)/);
    if(em&&!inWords){cur.e=parseInt(em[1],10)/1000;continue}
    if(/^  words:\s*$/.test(line)){inWords=true;continue}
    var wm=line.match(/^  - text:\s*(.*)$/);
    if(wm&&inWords){cur.words.push({t:0,e:0,x:unquoteYaml(wm[1])});continue}
    var ws=line.match(/^    start_ms:\s*(\d+)/);
    if(ws&&inWords&&cur.words.length){cur.words[cur.words.length-1].t=parseInt(ws[1],10)/1000;continue}
  }
  if(cur)lines.push(cur);
  for(var l=0;l<lines.length;l++){
    var ls=lines[l];
    for(var w=0;w<ls.words.length;w++){
      ls.words[w].e=(w+1<ls.words.length)?ls.words[w+1].t:ls.e;
    }
  }
  return lines.filter(function(l){return l.words.length&&isFinite(l.t)});
}
function lyTick(){
  if(typeof lyLines==='undefined'||!lyLines||!lyLines.length)return;
  var pane=document.getElementById('paneLyrics');
  if(!pane||pane.hidden)return;
  if(pos<0||!TRACKS[pos]||TRACKS[pos].f!==pane.dataset.f)return;
  var t=audio.currentTime+lyOffset,idx=-1;
  for(var i=0;i<lyLines.length;i++){
    if(lyLines[i].t<=t)idx=i;else break;
  }
  if(idx!==lyNow){
    // clear previous line's active word; optionally linger last sung word as a feature
    if(lyNow>=0){
      var oldArr=lyWordEls[lyNow];
      if(oldArr&&lyWordNow>=0&&oldArr[lyWordNow]){
        oldArr[lyWordNow].classList.remove('now');
        if(lyLinger) oldArr[lyWordNow].classList.add('linger');
      }
      if(lyLineEls[lyNow])lyLineEls[lyNow].classList.remove('now');
    }
    // if user jumped back, clear stale linger marks ahead
    if(idx<lyNow){
      for(var li=(idx<0?0:idx);li<lyLineEls.length;li++){
        var larr=lyWordEls[li];
        if(larr)for(var lk=0;lk<larr.length;lk++)larr[lk].classList.remove('linger','now');
      }
    }
    lyNow=idx;
    lyWordNow=-1;
    if(idx>=0&&lyLineEls[idx]){
      lyLineEls[idx].classList.add('now');
      // entering a line fresh: clear linger inside it so replay reads clean
      var curArr=lyWordEls[idx];
      if(curArr)for(var ck=0;ck<curArr.length;ck++)curArr[ck].classList.remove('linger');
      if(lyFollow)try{pane.scrollTop=lyLineEls[idx].offsetTop-pane.clientHeight/2+lyLineEls[idx].offsetHeight/2}catch(e){}
      if(typeof vrAch==='function')vrAch('karaoke_watch');
    }
  }
  // word-level karaoke: advance the highlighted word inside the current line.
  var wi=-1;
  if(idx>=0&&lyLines[idx].words){
    var ws=lyLines[idx].words;
    for(var j=0;j<ws.length;j++){
      if(ws[j].t<=t)wi=j;else break;
    }
  }
  if(wi!==lyWordNow){
    var arr=idx>=0?lyWordEls[idx]:null;
    if(arr&&lyWordNow>=0&&arr[lyWordNow]){
      arr[lyWordNow].classList.remove('now');
      if(lyLinger) arr[lyWordNow].classList.add('linger');
    }
    lyWordNow=wi;
    if(arr&&wi>=0&&arr[wi]){arr[wi].classList.remove('linger');arr[wi].classList.add('now');}
  }
}
function lyRender(tr,txt,meta,head,preset,synced,words){
  var pane=document.getElementById('paneLyrics');
  if(pane.dataset.f!==tr.f)return;
  lyLines=[];lyLineEls=[];lyWordEls=[];lyNow=-1;lyWordNow=-1;
  pane.innerHTML='';
  var wordLines=parseWordLyrics(words);
  var lines=wordLines.length?wordLines:(synced?parseLRC(synced):[]);
  var top=document.createElement('div');top.className='lyTop';
  var hit=document.createElement('div');
  hit.className='lyHit';
  hit.textContent=head||(meta?((meta.artistName?meta.artistName+' - ':'')+(meta.trackName||'')):tr.n);
  top.appendChild(hit);
  var ctrls=document.createElement('div');ctrls.className='lyCtrls';
  var copyBtn=document.createElement('button');copyBtn.className='qBtn';copyBtn.textContent='copy';copyBtn.type='button';
  copyBtn.addEventListener('click',function(){var t=txt||(lines.map(function(l){return l.x}).join('\n'));if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).catch(function(){});});
  var followBtn=document.createElement('button');followBtn.className='qBtn';followBtn.type='button';
  followBtn.textContent=lyFollow?'follow':'free scroll';
  followBtn.addEventListener('click',function(){lyFollow=!lyFollow;followBtn.textContent=lyFollow?'follow':'free scroll';saveSetting('lyFollow',lyFollow);if(lyFollow)lyNow=-1;});
  var lingerBtn=document.createElement('button');lingerBtn.className='qBtn';lingerBtn.type='button';
  lingerBtn.textContent=lyLinger?'linger':'no linger';
  lingerBtn.title='keep last sung word highlighted after its line';
  lingerBtn.addEventListener('click',function(){lyLinger=!lyLinger;lingerBtn.textContent=lyLinger?'linger':'no linger';saveSetting('lyLinger',lyLinger);if(!lyLinger){var ls=pane.querySelectorAll('.lyWord.linger');for(var i=0;i<ls.length;i++)ls[i].classList.remove('linger')}});
  ctrls.appendChild(copyBtn);ctrls.appendChild(followBtn);ctrls.appendChild(lingerBtn);top.appendChild(ctrls);pane.appendChild(top);
  if(lines.length){
    var off=document.createElement('div');off.className='lyOffset';
    var offLab=document.createElement('span');offLab.textContent='offset';
    var offR=document.createElement('input');offR.type='range';offR.min='-5000';offR.max='5000';offR.step='100';offR.value=String(Math.round(lyOffset*1000));
    var offV=document.createElement('span');offV.textContent=(lyOffset>=0?'+':'')+lyOffset.toFixed(1)+'s';
    offR.addEventListener('input',function(){lyOffset=(+this.value||0)/1000;offV.textContent=(lyOffset>=0?'+':'')+lyOffset.toFixed(1)+'s';saveSetting('lyOffset',lyOffset);lyNow=-1;lyWordNow=-1;});
    off.appendChild(offLab);off.appendChild(offR);off.appendChild(offV);pane.appendChild(off);
  }
  if(!txt&&!lines.length){
    var s=document.createElement('div');
    s.className='lyState';
    s.textContent='no lyrics in the database for this one. try open in lrclib or wait a moment and reopen.';
    pane.appendChild(s);
  }else{
    if(lines.length){
      for(var i=0;i<lines.length;i++){
        var d=document.createElement('div');
        d.className='lyLine';
        (function(li,ln){
          d.addEventListener('click',function(ev){
            if(ev.target&&ev.target.classList&&ev.target.classList.contains('lyWord'))return;
            if(!audio.duration)return;
            var t=Math.max(0,ln.t-lyOffset+0.04);
            try{audio.currentTime=Math.min(t,audio.duration-0.2)}catch(e){}
          });
        })(i,lines[i]);
        if(lines[i].words&&lines[i].words.length){
          var spans=[];
          for(var k=0;k<lines[i].words.length;k++){
            (function(wi,wobj){
              var sp=document.createElement('span');
              sp.className='lyWord';
              sp.textContent=wobj.x||'\u00a0';
              sp.addEventListener('click',function(ev){
                ev.stopPropagation();
                if(!audio.duration)return;
                var t=Math.max(0,(wobj.t||0)-lyOffset+0.04);
                try{audio.currentTime=Math.min(t,audio.duration-0.2)}catch(e){}
              });
              d.appendChild(sp);
              spans.push(sp);
            })(k,lines[i].words[k]);
          }
          lyWordEls.push(spans);
        }else{
          d.textContent=lines[i].x||'\u00a0';
          lyWordEls.push(null);
        }
        pane.appendChild(d);
        lyLineEls.push(d);
      }
      lyLines=lines;
      lyTick();
    }else{
      var body=document.createElement('div');
      body.textContent=txt;
      pane.appendChild(body);
    }
  }
  var foot=document.createElement('div');
  foot.className='lyMeta';
  if(preset){
    foot.textContent='void records preset';
  }else if(lines.length){
    foot.textContent=(wordLines.length?'word-synced lyrics via ':'synced lyrics via ');
    var a=document.createElement('a');
    a.href='https://lrclib.net';a.target='_blank';a.rel='noopener';
    a.textContent='lrclib.net';
    foot.appendChild(a);
  }else{
    foot.textContent='via ';
    var a2=document.createElement('a');
    a2.href='https://lrclib.net';a2.target='_blank';a2.rel='noopener';
    a2.textContent='lrclib.net';
    foot.appendChild(a2);
  }
  pane.appendChild(foot);
}
function lyParseN(n){
  var t=String(n||'').replace(/\[[^\]]*\]/g,'').replace(/\s+/g,' ').trim();
  var artist='';
  var m=t.match(/^(.*)\s+\(([^()]+)\)$/);
  if(m){
    var inner=m[2].trim();
    var looksArtist=inner.split(' ').length<=4&&
      /^[a-z0-9 .&'!-]+$/i.test(inner)&&
      inner.indexOf(' x ')<0&&
      !/remix|reverb|hour|theme|instrumental|version|slowed|night|edit|mix|mashup|edition|live|acoustic|demo|cover|ost|original/i.test(inner);
    if(looksArtist){artist=inner;t=m[1].trim()}
  }
  if(!artist){
    var dm=t.match(/^(.{2,45}?)\s+-\s+(.+)$/);
    if(dm){artist=dm[1].trim();t=dm[2].trim()}
  }
  return {title:t,artist:artist};
}
var lyFail={},lyBusy='';
function lyStateMsg(tr,msg){
  var pane=document.getElementById('paneLyrics');
  if(pane.dataset.f!==tr.f)return;
  pane.innerHTML='<div class="lyState">'+msg+'</div>';
}
function lyLoad(pos){
  var tr=TRACKS[pos];
  var pane=document.getElementById('paneLyrics');
  pane.dataset.f=tr.f;
  var pre=LYR_PRESETS[tr.f];
  if(pre){lyRender(tr,pre.body,null,pre.head,true);return}
  if(lyCache[tr.f]!==undefined){lyRender(tr,lyCache[tr.f].p,null,null,false,lyCache[tr.f].s,lyCache[tr.f].w);return}
  if(lyBusy===tr.f)return;
  if(lyFail[tr.f]&&Date.now()-lyFail[tr.f]<20000){
    lyStateMsg(tr,'lrclib is having a moment - wait a few seconds, then click the note again.');
    return;
  }
  lyBusy=tr.f;
  pane.innerHTML='<div class="lyState">searching lrclib&hellip;</div>';
  var directId=LYR_IDS[tr.f];
  if(directId){
    fetch('https://lrclib.net/api/get/'+directId)
    .then(function(r){
      if(r.ok)return r.json();
      if(r.status===429||r.status===403||r.status===502||r.status===503||r.status===504)throw{tired:true};
      throw{http:r.status||0};
    })
    .then(renderHit)
    .catch(failState);
    return;
  }
  var P=lyParseN(tr.n);
  var apiGet=(P.artist&&P.title)?('https://lrclib.net/api/get?artist_name='+encodeURIComponent(P.artist)+'&track_name='+encodeURIComponent(P.title)):null;

  function statusErr(r){
    if(r.status===429||r.status===403||r.status===502||r.status===503||r.status===504)throw{tired:true};
    throw{http:r.status||0};
  }
  function renderHit(best){
    if(pane.dataset.f!==tr.f){lyBusy='';return}
    delete lyFail[tr.f];
    lyBusy='';
    var txt=best.instrumental&&!best.plainLyrics&&!best.syncedLyrics?'[instrumental - no lyrics to show]':(best.plainLyrics||'');
    lyCache[tr.f]={p:txt,s:best.syncedLyrics||null,w:best.lyricsfile||null};
    lyRender(tr,txt,best,null,false,lyCache[tr.f].s,lyCache[tr.f].w);
  }
  function failState(err){
    lyBusy='';
    lyFail[tr.f]=Date.now();
    if(pane.dataset.f!==tr.f)return;
    if(err&&err.tired){
      lyStateMsg(tr,'lrclib is having a moment - wait a few seconds, then click the note again.');
    }else if(err&&err.http){
      lyStateMsg(tr,'lrclib said no (http '+err.http+') - try again in a bit.');
    }else{
      lyStateMsg(tr,'could not reach lrclib - try again in a bit.');
    }
  }
  function doSearch(){
    fetch('https://lrclib.net/api/search?q='+encodeURIComponent([P.artist,P.title].filter(Boolean).join(' ')||tr.n))
    .then(function(r){
      if(!r.ok)return statusErr(r);
      return r.json();
    })
    .then(function(arr){
      var best=null,bestScore=-1,rawHit=false;
      var rawTitle=(P.title||'').trim();
      var nTitle=lyNorm(P.title);
      var nArtist=lyNorm(P.artist);
      for(var i=0;i<(arr||[]).length;i++){
        var a=arr[i];
        if(!a.plainLyrics&&!a.syncedLyrics&&!a.instrumental)continue;
        var rT=(a.trackName||'').trim();
        var rA=lyNorm(a.artistName||'');
        var score=1;
        if(a.plainLyrics)score+=2;
        if(a.syncedLyrics)score+=2;
        if(rawTitle){
          if(rT===rawTitle||rT.replace(/\s*\(.*\)$/,'')===rawTitle){score+=8;rawHit=true}
          else if(nTitle&&lyNorm(rT)===nTitle){score+=6;rawHit=true}
          else if(nTitle&&lyNorm(rT).indexOf(nTitle)>=0)score+=3;
          else if(rawTitle.length<=2)score-=6;
        }
        if(nArtist){
          if(rA===nArtist)score+=6;
          else if(rA.indexOf(nArtist)>=0)score+=3;
          else score-=3;
        }
        if(score>bestScore){bestScore=score;best=a}
      }
      if(!best||(rawTitle&&(rawTitle.length<=2||!rawHit))){
        lyBusy='';
        delete lyFail[tr.f];
        lyCache[tr.f]={p:'',s:null};
        lyRender(tr,'',null);
        return;
      }
      renderHit(best);
    })
    .catch(failState);
  }
  if(apiGet){
    fetch(apiGet)
    .then(function(r){
      if(r.ok)return r.json();
      if(r.status===429||r.status===403||r.status===502||r.status===503||r.status===504)throw{tired:true};
      throw{miss:true};
    })
    .then(function(j){renderHit(j)})
    .catch(function(err){
      if(err&&err.miss)return doSearch();
      if(err&&err.tired)return failState(err);
      // network failure on get: search gets a second chance
      doSearch();
    });
  }else{
    doSearch();
  }
}
function fmtSize(b){
  if(!b&&b!==0)return'-';
  return b>=1048576?(b/1048576).toFixed(1)+' MB':Math.round(b/1024)+' KB';
}
function fileSize(f,cb){
  if(sizeCache[f]!==undefined){cb(sizeCache[f]);return}
  fetch('tracks/'+f,{method:'HEAD'}).then(function(r){
    var l=r.headers.get('content-length');
    sizeCache[f]=l?fmtSize(+l):null;
    cb(sizeCache[f]);
  }).catch(function(){sizeCache[f]=null;cb(null)});
}
var sizeCache={};
function infoRender(pos){
  var tr=TRACKS[pos];
  var pane=document.getElementById('paneInfo');
  pane.innerHTML='';
  var link=location.origin+location.pathname+'?track='+encodeURIComponent(tr.a[0]||tr.f);
  var dash=tr.n.indexOf(' - ');
  var artist=dash>0?tr.n.slice(0,dash):'';
  var song=dash>0?tr.n.slice(dash+3):tr.n;
  var ext=(tr.f.split('.').pop()||'').toUpperCase();
  var dur=durCache[tr.f]||'';
  if(!dur&&osPos===pos&&audio.duration&&isFinite(audio.duration))dur=fmt(audio.duration);
  var last=vrLast[tr.f]?new Date(vrLast[tr.f]).toLocaleString():'-';
  var rows=[
    ['artist',artist||'-',null],
    ['track',song,null],
    ['file',tr.f,null],
    ['format',ext,null],
    ['size','\u2026',null],
    ['length',dur||'loads on first play',null],
    ['aliases',tr.a.length?tr.a.join(', '):'-',null],
    ['shelf',String(pos+1)+' of '+TRACKS.length,null],
    ['plays',String(vrPlays[tr.f]||0),null],
    ['clean listen',vrClean[tr.f]?'done':'not yet',null],
    ['last played',last,null],
    ['favorite',vrFavs.indexOf(tr.f)>=0?'starred on your shelf':'not starred',null],
    ['offline', isPinned(tr.f)?'pinned (cached)':'not pinned', null, 'pin'],
    ['deep link',link,link]
  ];
  var sizeEl=null;
  for(var i=0;i<rows.length;i++){
    var row=document.createElement('div');
    row.className='infoRow';
    var k=document.createElement('div');
    k.className='infoKey';k.textContent=rows[i][0];
    var v=document.createElement('div');
    v.className='infoVal';
    if(rows[i][3]==='pin'){
      var pa=document.createElement('a');pa.href='#';pa.textContent=isPinned(tr.f)?'unpin':'pin for offline';
      pa.addEventListener('click',function(ev){ev.preventDefault();pinTrack(tr.f,!isPinned(tr.f));});
      v.textContent=rows[i][1]+' ';
      v.appendChild(pa);
    }else if(rows[i][2]){
      var a=document.createElement('a');
      a.href=rows[i][2];a.textContent=rows[i][1];
      v.appendChild(a);
    }else v.textContent=rows[i][1];
    row.appendChild(k);row.appendChild(v);
    pane.appendChild(row);
    if(rows[i][0]==='size')sizeEl=v;
  }
  fileSize(tr.f,function(s){if(sizeEl&&sizeEl.isConnected)sizeEl.textContent=s||'-'});
}

function ago(ts){
  var s=(Date.now()-ts)/1000;
  if(s<60)return'just now';
  if(s<3600)return Math.floor(s/60)+' min ago';
  if(s<86400)return Math.floor(s/3600)+' hr ago';
  if(s<2592000)return Math.floor(s/86400)+' d ago';
  return new Date(ts).toLocaleDateString();
}
function statsRender(){
  var pane=document.getElementById('paneStats');
  pane.innerHTML='';
  var total=0,touched=0,max=0;
  var spun=[],recent=[];
  for(var i=0;i<TRACKS.length;i++){
    var f=TRACKS[i].f,c=vrPlays[f]||0;
    total+=c;
    if(c>0){touched++;spun.push({n:TRACKS[i].n,c:c});if(c>max)max=c}
    if(vrLast[f])recent.push({n:TRACKS[i].n,last:vrLast[f]});
  }
  spun.sort(function(a,b){return b.c-a.c});
  recent.sort(function(a,b){return b.last-a.last});
  function block(title){
    var h=document.createElement('div');
    h.className='stHead';h.textContent=title;
    pane.appendChild(h);
  }
  function infoRow(k,v){
    var row=document.createElement('div');
    row.className='infoRow';
    var kd=document.createElement('div');kd.className='infoKey';kd.textContent=k;
    var vd=document.createElement('div');vd.className='infoVal';vd.textContent=v;
    row.appendChild(kd);row.appendChild(vd);
    pane.appendChild(row);
    return vd;
  }
  block('listening stats');
  infoRow('total spins',String(total));
  infoRow('tracks spun',touched+' of '+TRACKS.length);
  infoRow('clean listens',vrCleanCount()+' of '+TRACKS.length);
  infoRow('favorites',String(vrFavs.length));
  infoRow('top track',spun.length?spun[0].n+' \u00d7'+spun[0].c:'-');
  block('most spun');
  if(!spun.length){
    var e=document.createElement('div');
    e.className='stEmpty';e.textContent='nothing played yet - drop the needle and the numbers show up here.';
    pane.appendChild(e);
  }else{
    for(var i=0;i<Math.min(10,spun.length);i++){
      var line=document.createElement('div');
      line.className='stRow';
      var nm=document.createElement('span');nm.className='stNm';nm.textContent=spun[i].n;
      var bar=document.createElement('span');bar.className='stBarWrap';
      var fill=document.createElement('span');fill.className='stBar';
      fill.style.width=Math.max(4,Math.round(spun[i].c/max*100))+'%';
      bar.appendChild(fill);
      var ct=document.createElement('span');ct.className='stCt';ct.textContent='\u00d7'+spun[i].c;
      line.appendChild(nm);line.appendChild(bar);line.appendChild(ct);
      pane.appendChild(line);
    }
  }
  block('recently spun');
  if(!recent.length){
    var e2=document.createElement('div');
    e2.className='stEmpty';e2.textContent='no history yet.';
    pane.appendChild(e2);
  }else{
    for(var j=0;j<Math.min(6,recent.length);j++)infoRow(ago(recent[j].last),recent[j].n);
  }
  var foot=document.createElement('div');
  foot.className='lyMeta';
  foot.textContent='numbers live in this browser only - localStorage, never uploaded.';
  pane.appendChild(foot);
}

var osBar=document.getElementById('osWinBar');
var osDrag=null;
osBar.addEventListener('pointerdown',function(e){
  if(e.target&&e.target.closest&&e.target.closest('.dot'))return;
  if(osWin.classList.contains('max'))return;
  var r=osWin.getBoundingClientRect();
  osWin.style.right='auto';
  osWin.style.left=r.left+'px';
  osWin.style.top=r.top+'px';
  osDrag={dx:e.clientX-r.left,dy:e.clientY-r.top};
  try{osBar.setPointerCapture(e.pointerId)}catch(err){}
});
osBar.addEventListener('pointermove',function(e){
  if(!osDrag)return;
  var x=e.clientX-osDrag.dx,y=e.clientY-osDrag.dy;
  x=Math.max(-osWin.offsetWidth+90,Math.min(x,window.innerWidth-90));
  y=Math.max(0,Math.min(y,window.innerHeight-44));
  osWin.style.left=x+'px';
  osWin.style.top=y+'px';
});
osBar.addEventListener('pointerup',function(){osDrag=null});
osBar.addEventListener('pointercancel',function(){osDrag=null});

if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol)){
  window.addEventListener('load',function(){navigator.serviceWorker.register('sw.js').catch(function(){})});
}

// shelf milestone celebration: confetti rain, auto-once per session + footer button.
(function(){
  var cv=document.getElementById('confetti');
  if(!cv||!cv.getContext)return;
  var ctx=cv.getContext('2d'),bits=[],raf=0;
  var COLORS=['#ff5c8a','#ffd166','#5ce1e6','#a78bfa','#7cfc00','#ffffff'];
  var reduced=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function size(){
    var dpr=Math.min(window.devicePixelRatio||1,2);
    cv.width=Math.floor(window.innerWidth*dpr);
    cv.height=Math.floor(window.innerHeight*dpr);
    cv.style.width=window.innerWidth+'px';
    cv.style.height=window.innerHeight+'px';
    ctx.setTransform(dpr,0,0,dpr,0,0);
  }
  function frame(){
    ctx.clearRect(0,0,window.innerWidth,window.innerHeight);
    var keep=[];
    for(var i=0;i<bits.length;i++){
      var b=bits[i];
      b.life++;
      b.x+=b.vx+Math.sin(b.life*.045)*.5;
      b.y+=b.vy;
      b.rot+=b.vr;
      b.vy+=.012;
      if(b.y<window.innerHeight+30&&b.life<b.max){
        ctx.save();
        ctx.translate(b.x,b.y);
        ctx.rotate(b.rot);
        ctx.globalAlpha=Math.min(1,(b.max-b.life)/60);
        ctx.fillStyle=b.col;
        ctx.fillRect(-b.w/2,-b.h/2,b.w,b.h);
        ctx.restore();
        keep.push(b);
      }
    }
    bits=keep;
    if(bits.length)raf=requestAnimationFrame(frame);
    else{raf=0;ctx.clearRect(0,0,window.innerWidth,window.innerHeight)}
  }
  window.vrConfetti=function(){
    if(reduced)return;
    size();
    for(var i=0;i<140;i++)bits.push({
      x:Math.random()*window.innerWidth,
      y:-20-Math.random()*window.innerHeight*.5,
      w:5+Math.random()*7,
      h:8+Math.random()*10,
      vx:(Math.random()-.5)*1.6,
      vy:1.6+Math.random()*2.6,
      rot:Math.random()*Math.PI*2,
      vr:(Math.random()-.5)*.24,
      col:COLORS[(Math.random()*COLORS.length)|0],
      life:0,
      max:240+Math.random()*180
    });
    if(!raf)raf=requestAnimationFrame(frame);
  };
  window.addEventListener('resize',function(){if(raf)size()});
  var btn=document.getElementById('btnConfetti');
  if(btn)btn.addEventListener('click',window.vrConfetti);
  if(typeof TRACKS!=='undefined'&&TRACKS.length>=490){
    var seen=false;
    try{seen=!!sessionStorage.getItem('vrConfetti490');sessionStorage.setItem('vrConfetti490','1')}catch(e){}
    if(!seen)setTimeout(window.vrConfetti,900);
  }
})();

// UI sound effects - tiny Web Audio blips, no files, no network. toggle with the speaker chip or M.
(function(){
  var ctx=null,enabled=true;
  try{enabled=localStorage.getItem('vr_sfx')!=='off'}catch(e){}
  function ac(){
    if(!ctx){
      var C=window.AudioContext||window.webkitAudioContext;
      if(!C)return null;
      try{ctx=new C()}catch(e){return null}
    }
    if(ctx.state==='suspended'&&ctx.resume)ctx.resume().catch(function(){});
    return ctx;
  }
  function tone(f,d,type,vol,delay){
    var c=ac();if(!c)return;
    var t=c.currentTime+(delay||0);
    var o=c.createOscillator(),g=c.createGain();
    o.type=type||'triangle';o.frequency.setValueAtTime(f,t);
    g.gain.setValueAtTime(0.0001,t);
    g.gain.linearRampToValueAtTime(vol||0.05,t+0.008);
    g.gain.exponentialRampToValueAtTime(0.0001,t+d);
    o.connect(g);g.connect(c.destination);o.start(t);o.stop(t+d+0.02);
  }
  function hiss(d,vol){
    var c=ac();if(!c)return;
    var n=Math.floor(c.sampleRate*d),buf=c.createBuffer(1,n,c.sampleRate),dat=buf.getChannelData(0);
    for(var i=0;i<n;i++)dat[i]=(Math.random()*2-1)*(1-i/n);
    var s=c.createBufferSource(),g=c.createGain(),f=c.createBiquadFilter();
    s.buffer=buf;f.type='lowpass';f.frequency.value=1800;
    g.gain.value=vol||0.03;
    s.connect(f);f.connect(g);g.connect(c.destination);s.start();
  }
  window.vrSfx=function(kind){
    if(!enabled)return;
    try{
      if(kind==='play'){tone(220,0.09,'sine',0.05);tone(440,0.12,'triangle',0.045,0.03)}
      else if(kind==='pause'){tone(330,0.08,'sine',0.045);tone(180,0.12,'triangle',0.04,0.03)}
      else if(kind==='needle'){hiss(0.16,0.03);tone(120,0.18,'sine',0.05)}
      else if(kind==='next'){tone(440,0.06,'triangle',0.05);tone(660,0.08,'triangle',0.045,0.06)}
      else if(kind==='prev'){tone(660,0.06,'triangle',0.05);tone(440,0.08,'triangle',0.045,0.06)}
      else if(kind==='shuffle'){tone(523,0.05,'square',0.03);tone(659,0.05,'square',0.03,0.05);tone(784,0.07,'square',0.03,0.1)}
      else if(kind==='loop'){tone(784,0.05,'triangle',0.045);tone(523,0.09,'triangle',0.045,0.05)}
      else if(kind==='confetti'){tone(523,0.06,'triangle',0.045);tone(659,0.06,'triangle',0.045,0.06);tone(784,0.06,'triangle',0.045,0.12);tone(1047,0.13,'triangle',0.045,0.18)}
      else tone(520,0.045,'triangle',0.035);
    }catch(e){}
  };
  function paint(){
    var b=document.getElementById('btnSfx');
    if(!b)return;
    b.textContent=enabled?'🔊':'🔇';
    b.classList.toggle('off',!enabled);
    b.title=enabled?'ui sounds on (m)':'ui sounds off (m)';
  }
  window.vrSfxToggle=function(){
    window.vrSfx('toggle');
    enabled=!enabled;
    try{localStorage.setItem('vr_sfx',enabled?'on':'off')}catch(e){}
    paint();
  };
  document.addEventListener('click',function(e){
    var b=e.target&&e.target.closest?e.target.closest('[data-sfx]'):null;
    if(b)window.vrSfx(b.getAttribute('data-sfx'));
  });
  document.addEventListener('keydown',function(e){
    var tag=(e.target&&e.target.tagName)||'';
    if((e.key==='m'||e.key==='M')&&tag!=='INPUT'&&tag!=='TEXTAREA'&&tag!=='SELECT')window.vrSfxToggle();
  });
  var sfxBtn=document.getElementById('btnSfx');
  if(sfxBtn)sfxBtn.addEventListener('click',window.vrSfxToggle);
  paint();
})();

// ---- track row right-click menu ----
(function(){
  var menu=document.getElementById('ctxMenu');
  var toast=document.getElementById('ctxToast');
  if(!menu||!toast||!listEl)return;
  var ctxPos=-1,toastTimer=null;
  function hide(){menu.hidden=true;ctxPos=-1}
  function flash(msg){
    toast.textContent=msg;toast.hidden=false;
    if(toastTimer)clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){toast.hidden=true},1600);
  }
  function copy(text,msg){
    function fallback(){
      var ta=document.createElement('textarea');
      ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
      document.body.appendChild(ta);ta.select();
      try{document.execCommand('copy');flash(msg)}catch(e){flash('copy failed')}
      document.body.removeChild(ta);
    }
    if(navigator.clipboard&&navigator.clipboard.writeText)
      navigator.clipboard.writeText(text).then(function(){flash(msg)},fallback);
    else fallback();
  }
  listEl.addEventListener('contextmenu',function(e){
    var li=e.target&&e.target.closest?e.target.closest('li[data-pos]'):null;
    if(!li||!listEl.contains(li))return;
    e.preventDefault();
    var t=TRACKS[+li.dataset.pos];
    if(!t)return;
    ctxPos=+li.dataset.pos;
    menu.querySelector('.ctxTitle').textContent=t.n;
    var pinBtn=menu.querySelector('[data-act="pin"]');
    if(pinBtn)pinBtn.textContent=isPinned(t.f)?'unpin offline':'pin for offline';
    menu.hidden=false;
    var x=Math.min(e.clientX,window.innerWidth-menu.offsetWidth-8);
    var y=Math.min(e.clientY,window.innerHeight-menu.offsetHeight-8);
    menu.style.left=Math.max(6,x)+'px';
    menu.style.top=Math.max(6,y)+'px';
  });
  menu.addEventListener('click',function(e){
    var b=e.target&&e.target.closest?e.target.closest('button[data-act]'):null;
    if(!b||ctxPos<0)return;
    var t=TRACKS[ctxPos],p=ctxPos;hide();
    if(!t)return;
    var link=location.origin+location.pathname+'?track='+encodeURIComponent(t.n);
    if(b.dataset.act==='next'){if(typeof queuePushShelf==='function')queuePushShelf(p,true)}
    else if(b.dataset.act==='queue'){if(typeof queuePushShelf==='function')queuePushShelf(p,false)}
    else if(b.dataset.act==='pin'){pinTrack(t.f,!isPinned(t.f))}
    else if(b.dataset.act==='link')copy(link,'deep link copied');
    else if(b.dataset.act==='file')copy(t.f,'file name copied');
    else if(b.dataset.act==='open')window.open(link,'_blank','noopener');
  });
  document.addEventListener('pointerdown',function(e){
    if(!menu.hidden&&!menu.contains(e.target))hide();
  },true);
  document.addEventListener('keydown',function(e){if(e.key==='Escape')hide()});
  window.addEventListener('scroll',hide,true);
  window.addEventListener('resize',hide);
})();

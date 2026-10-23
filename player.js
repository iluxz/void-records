var audio=new Audio();
audio.preload='metadata';
audio.volume=.7;

var order=[];
var pos=-1;
var playing=false;
var shuffle=false;
var loopOne=false;
var curBlobUrl=null;
var loadGen=0;
var durCache={};
var volBase=.7,fadeInt=null,fadeInNext=false;
function fadeVol(to,dur,done){
  if(fadeInt){clearInterval(fadeInt);fadeInt=null}
  var from=audio.volume,steps=Math.max(2,Math.round(dur/30)),n=0;
  if(Math.abs(from-to)<.001){audio.volume=to;if(done)done();return}
  fadeInt=setInterval(function(){
    n++;
    audio.volume=Math.max(0,Math.min(1,from+(to-from)*(n/steps)));
    if(n>=steps){clearInterval(fadeInt);fadeInt=null;if(done)done()}
  },30);
}
var vrFavs=[],vrPlays={},vrLast={},ST={};
try{vrFavs=JSON.parse(localStorage.getItem('vr_favs')||'[]')||[]}catch(e){}
try{vrPlays=JSON.parse(localStorage.getItem('vr_plays')||'{}')||{}}catch(e){}
try{vrLast=JSON.parse(localStorage.getItem('vr_last')||'{}')||{}}catch(e){}
try{ST=JSON.parse(localStorage.getItem('vr_settings')||'{}')||{}}catch(e){}
function saveSetting(k,v){ST[k]=v;try{localStorage.setItem('vr_settings',JSON.stringify(ST))}catch(e){}}

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
  if(!/^hv-|^havexy-/.test(f))return;
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
  var tr=TRACKS[i];
  havexyEgg(tr.f);
  if(typeof skelMaybe==='function')skelMaybe();
  fadeInNext=true;
  if(!audio.paused)fadeVol(0,450);
  else audio.volume=0;
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
  try{
    fetch(tr.f).then(function(r){if(!r.ok)throw 0;return r.blob()}).then(function(b){
      if(gen!==loadGen)return;
      if(curBlobUrl){try{URL.revokeObjectURL(curBlobUrl)}catch(e){}}
      var ext=(tr.f.split('.').pop()||'').toLowerCase();
      var mime=ext==='mp3'?'audio/mpeg':ext==='wav'?'audio/wav':ext==='ogg'?'audio/ogg':ext==='webm'?'audio/webm':'';
      curBlobUrl=URL.createObjectURL(mime?new Blob([b],{type:mime}):b);
      audio.src=curBlobUrl;
      if(autoplay!==false)tryPlay();
    }).catch(function(){
      if(gen!==loadGen)return;
      audio.src=tr.f;
      if(autoplay!==false)tryPlay();
    });
  }catch(e){
    audio.src=tr.f;
    if(autoplay!==false)tryPlay();
  }
  markPlaying();
}
function tryPlay(){
  var p=audio.play();
  if(p&&p.catch)p.catch(function(){});
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
  if(pos<0){loadTrack(order[0]!==undefined?order[0]:0,true);return}
  if(audio.paused)tryPlay();else audio.pause();
}
function nextTrack(){
  if(pos<0)return loadTrack(0,true);
  var at=order.indexOf(pos);
  if(at<order.length-1)loadTrack(order[at+1],true);
  else if(loopOne)loadTrack(pos,true);
  else loadTrack(order[0],true);
}
function prevTrack(){
  if(pos<0)return loadTrack(0,true);
  if(audio.currentTime>3){audio.currentTime=0;return}
  var at=order.indexOf(pos);
  loadTrack(at>0?order[at-1]:order[order.length-1],true);
}

document.getElementById('btnPlay').addEventListener('click',playPause);
document.getElementById('btnNext').addEventListener('click',nextTrack);
document.getElementById('btnPrev').addEventListener('click',prevTrack);
btnShuffle.addEventListener('click',function(){
  shuffle=!shuffle;
  btnShuffle.classList.toggle('on',shuffle);
  rebuildOrder(pos>=0?pos:undefined);
  if(shuffle&&typeof vrAch==='function')vrAch('shuffle_on');
});
btnLoop.addEventListener('click',function(){
  loopOne=!loopOne;
  btnLoop.classList.toggle('on',loopOne);
  audio.loop=loopOne;
  if(loopOne&&typeof vrAch==='function')vrAch('loop_on');
});
document.getElementById('vol').addEventListener('input',function(){
  volBase=this.value/100;
  if(!fadeInt)audio.volume=volBase;
  saveSetting('volume',parseInt(this.value,10));
  if(this.value>=100&&typeof vrAch==='function')vrAch('redline');
});
seek.addEventListener('input',function(){
  if(audio.duration)audio.currentTime=(this.value/1000)*audio.duration;
});
audio.addEventListener('play',function(){
  if(!audioCtx&&audioEl)initVisualizer(audioEl);
  if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume().catch(function(){});
  if(fadeInNext){fadeInNext=false;fadeVol(volBase,600)}
  setPlayingUI(true);markPlaying();if(window.setCrackleLevel&&crackleWanted)setCrackleLevel(1);
});
audio.addEventListener('pause',function(){setPlayingUI(false);if(window.setCrackleLevel)setCrackleLevel(0)});
audio.addEventListener('ended',function(){if(!loopOne)nextTrack()});
audio.addEventListener('timeupdate',function(){
  tCur.textContent=fmt(audio.currentTime);
  if(audio.duration){
    tDur.textContent=fmt(audio.duration);
    seek.value=Math.round((audio.currentTime/audio.duration)*1000);
  }
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

function buildList(filter){
  var q=(filter||'').toLowerCase().trim();
  var qn=q.replace(/[^a-z0-9]/g,'');
  var favMode=qn==='favorites'||qn==='favs'||qn==='favourites'||qn==='starred';
  var recMode=qn==='recent'||qn==='recents'||qn==='history'||qn==='lastplayed';
  if(recMode&&typeof vrAch==='function')vrAch('filter_recent');
  var idxs=[];
  if(recMode){
    for(var r=0;r<TRACKS.length;r++)if(vrLast[TRACKS[r].f])idxs.push(r);
    idxs.sort(function(a,b){return vrLast[TRACKS[b].f]-vrLast[TRACKS[a].f]});
  }else{
    for(var s=0;s<TRACKS.length;s++)idxs.push(s);
  }
  listEl.innerHTML='';
  for(var k=0;k<idxs.length;k++){
    var i=idxs[k];
    var tr=TRACKS[i];
    if(favMode){if(vrFavs.indexOf(tr.f)<0)continue}
    else if(!recMode){
      var hay=(tr.n+' '+tr.a.join(' ')+' '+tr.f).toLowerCase();
      if(q&&hay.indexOf(q)<0)continue;
    }
    var li=document.createElement('li');
    li.dataset.pos=i;
    if(i===pos)li.className='playing';
    li.innerHTML='<span class="idx">'+(i+1)+'</span>'+
      '<span class="nm"></span>'+
      '<span class="al"></span>'+
      '<button class="favBtn'+(vrFavs.indexOf(tr.f)>=0?' on':'')+'" title="favorite">&#9733;</button>'+
      '<button class="lyBtn" title="lyrics">&#9834;</button>'+
      '<span class="pc"></span>'+
      '<span class="du"></span>';
    li.querySelector('.nm').textContent=tr.n;
    li.querySelector('.al').textContent=tr.a.length?tr.a.join(' '):'';
    var pcEl=li.querySelector('.pc');
    var pcN=vrPlays[tr.f]||0;
    if(pcN)pcEl.textContent='\u00d7'+pcN;
    li.querySelector('.du').textContent=durCache[tr.f]||'--:--';
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
    li.addEventListener('click',function(){loadTrack(+this.dataset.pos,true)});
    listEl.appendChild(li);
  }
  if(!listEl.children.length){
    var note=document.createElement('li');
    note.className='emptyNote';
    note.textContent=favMode?'no favorites yet - star some rows.':(recMode?'no spins yet - play something and it shows up here.':'nothing matches.');
    listEl.appendChild(note);
  }
}
document.getElementById('filter').addEventListener('input',function(){buildList(this.value)});

var crackleWanted=false;
var sleepMins=0,sleepTimer=null;

audioEl=audio;
rebuildOrder();
buildList('');

var btnCrackle=document.getElementById('btnCrackle');
var btnSleep=document.getElementById('btnSleep');
btnCrackle.addEventListener('click',function(){
  crackleWanted=!crackleWanted;
  btnCrackle.classList.toggle('on',crackleWanted);
  saveSetting('crackle',crackleWanted);
  if(window.setCrackleLevel)setCrackleLevel(crackleWanted&&!audio.paused?1:0);
  if(typeof vrAchScan==='function')vrAchScan();
});
btnSleep.addEventListener('click',function(){
  sleepMins=sleepMins===0?15:sleepMins===15?30:sleepMins===30?60:0;
  if(sleepTimer){clearInterval(sleepTimer);sleepTimer=null}
  if(sleepMins===0){btnSleep.textContent='\u23F1';btnSleep.classList.remove('on');return}
  btnSleep.classList.add('on');
  btnSleep.textContent=sleepMins+'m';
  if(typeof vrAch==='function')vrAch('sleep_armed');
  sleepTimer=setInterval(function(){
    sleepMins--;
    if(sleepMins<=0){
      clearInterval(sleepTimer);sleepTimer=null;
      btnSleep.textContent='\u23F1';btnSleep.classList.remove('on');
      nowMeta.textContent='sleep timer ended. goodnight.';
      fadeVol(0,2500,function(){audio.pause();audio.volume=volBase});
    }else{btnSleep.textContent=sleepMins+'m'}
  },60000);
});

document.addEventListener('keydown',function(e){
  var tag=(e.target&&e.target.tagName)||'';
  if(tag==='INPUT'||tag==='TEXTAREA')return;
  if(!audioCtx&&audioEl)initVisualizer(audioEl);
  if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume().catch(function(){});
  if(e.code==='Space'){e.preventDefault();playPause()}
  else if(e.code==='ArrowRight'){e.preventDefault();nextTrack()}
  else if(e.code==='ArrowLeft'){e.preventDefault();prevTrack()}
  else if(e.key==='s'||e.key==='S'){btnShuffle.click()}
  else if(e.key==='l'||e.key==='L'){btnLoop.click()}
  else if(e.key==='c'||e.key==='C'){btnCrackle.click()}
});

var turntable=document.getElementById('turntable');
document.addEventListener('dragover',function(e){e.preventDefault();turntable.classList.add('drop')});
document.addEventListener('dragleave',function(e){if(!e.relatedTarget)turntable.classList.remove('drop')});
document.addEventListener('drop',function(e){
  e.preventDefault();
  turntable.classList.remove('drop');
  var f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
  if(!f)return;
  if(!/^audio\//.test(f.type)&&!/\.(mp3|wav|ogg|webm|m4a|mp4)$/i.test(f.name))return;
  pos=-1;
  markPlaying();
  audio.src=URL.createObjectURL(f);
  nowTitle.textContent=f.name;
  nowMeta.textContent='local file - not in the collection';
  labelTitle.textContent=f.name;
  tDur.textContent='--:--';
  if(typeof vrAch==='function')vrAch('local_file');
  tryPlay();
});

var qTrack=new URLSearchParams(location.search).get('track');
if(qTrack){
  var qq=qTrack.toLowerCase().replace(/[^a-z0-9]/g,'');
  for(var qi=0;qi<TRACKS.length;qi++){
    var hay=(TRACKS[qi].n+' '+TRACKS[qi].a.join(' ')+' '+TRACKS[qi].f).toLowerCase().replace(/[^a-z0-9]/g,'');
    if(qq&&hay.indexOf(qq)>=0){loadTrack(qi,false);if(typeof vrAch==='function')vrAch('deep_link');break}
  }
}

var setPanel=document.getElementById('setPanel');
document.getElementById('btnSet').addEventListener('click',function(){
  setPanel.classList.toggle('open');
  this.classList.toggle('on',setPanel.classList.contains('open'));
});
document.getElementById('setSpeed').addEventListener('input',function(){
  audio.playbackRate=parseFloat(this.value);
  document.getElementById('setSpeedV').textContent=parseFloat(this.value).toFixed(2)+'\u00d7';
  saveSetting('speed',parseFloat(this.value));
  if(parseFloat(this.value)>=2&&typeof vrAch==='function')vrAch('overdrive');
});
document.getElementById('setPitch').addEventListener('input',function(){
  var v=parseInt(this.value,10);
  if(window.setPitchRatio)setPitchRatio(Math.pow(2,v/12));
  document.getElementById('setPitchV').textContent=(v>0?'+':'')+v+' st';
  saveSetting('pitch',v);
  if(Math.abs(v)===12&&typeof vrAch==='function')vrAch('pitch_extreme');
});
document.getElementById('setToneS').addEventListener('input',function(){
  var hz=parseInt(this.value,10);
  if(window.setTone)setTone(hz);
  document.getElementById('setToneV').textContent=hz>=15500?'open':(hz>=1000?(hz/1000).toFixed(1)+'k':hz+'hz');
  saveSetting('tone',hz);
  if(hz<=900&&typeof vrAch==='function')vrAch('tone_dark');
});

if(typeof ST.volume==='number'){document.getElementById('vol').value=ST.volume;volBase=ST.volume/100;audio.volume=volBase}
if(typeof ST.speed==='number'){audio.playbackRate=ST.speed;document.getElementById('setSpeed').value=ST.speed;document.getElementById('setSpeedV').textContent=ST.speed.toFixed(2)+'\u00d7'}
if(typeof ST.pitch==='number'){document.getElementById('setPitch').value=ST.pitch;if(window.setPitchRatio)setPitchRatio(Math.pow(2,ST.pitch/12));document.getElementById('setPitchV').textContent=(ST.pitch>0?'+':'')+ST.pitch+' st'}
if(typeof ST.tone==='number'){document.getElementById('setToneS').value=ST.tone;if(window.setTone)setTone(ST.tone);document.getElementById('setToneV').textContent=ST.tone>=15500?'open':(ST.tone>=1000?(ST.tone/1000).toFixed(1)+'k':ST.tone+'hz')}
if('crackle' in ST){crackleWanted=!!ST.crackle;btnCrackle.classList.toggle('on',crackleWanted)}

var tutSpot=document.getElementById('tutSpot');
var tutTip=document.getElementById('tutTip');
var tutSkip=document.getElementById('tutSkip');
var tutTitle=tutTip.querySelector('.tutTitle');
var tutBody=tutTip.querySelector('.tutBody');
var tutBtn=tutTip.querySelector('.tutBtn');
var tutActive=false,tutI=0,tutTimer=null;

var tutSteps=[
  {center:true,btn:'start',title:'void records',
   text:'114 records, one deck. quick tour - ten clicks, then you are free. you can replay it any time from the footer.'},
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
   text:'the gear opens speed (0.5-2x), independent pitch (-12 to +12 semitones) and tone. pitch is real DSP - it does not touch the speed.'},
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

try{
  if(!localStorage.getItem('tutorialCompleted'))setTimeout(tutStart,700);
}catch(e){setTimeout(tutStart,700)}

var osWin=document.getElementById('osWin');
var osPos=-1;
var lyCache={};
var lyLines=[],lyLineEls=[],lyNow=-1;

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

function lyNorm(s){
  return String(s||'').toLowerCase().replace(/\[[^\]]*\]/g,'').replace(/[^a-z0-9]/g,'');
}
var LYR_PRESETS={
  'friday.mp3':{
    head:'Windows96 - Landscaping',
    body:'[instrumental]\n\nfrom the album "Reflections" (2017), track 12.\npure vaporwave - no vocals, nothing to sing along to.\n\n(lrclib thinks you meant "Landscaping" by Shordie.\nlrclib is wrong.)'
  },
  'havexy-hyperbaiter.mp3':{
    head:'Havexy - Who? Hyperbaiter!',
    body:`[Verse 1]
You mess with Vexy, what's the deal?
You think you're so slick but your content's unreal
Hyperbait king but we all see through
You just a wannabe, can't compete with the crew
Your views are inflated but your talent's deflated
Tryna' ride the trend but you know you're outdated
You fell off hard, gotta stop the grind
I will surpass you and leave you falling behind

[Chorus]
Who diddles children like a violator?
Yeah, that's right, Hyperbaiter
Who was the Diddy blud on the calculator?
Yeah, that's right, Hyperbaiter
Who is worse than the german dictator?
Yeah, that's right, Hyperbaiter
Who fights old ladies in the elevator?
Yeah, that's right, Hyperbaiter

[Verse 2]
You scare us when you cook, you make the onion cry
You dress like shit, why do you even try?
Remember that BBC friend Nicholas?
Now he will fill your mouth with his gas
You're fishing for likes but it's a desperate scheme
While I'm out here grinding, living the dream
I forgot to mention that your shoes look vile
What the hell are those, bro? They look like crocodile (Oooh)

[Chorus]
Who diddles children like a violator?
Yeah, that's right, Hyperbaiter
Who was the Diddy blud on the calculator?
Yeah, that's right, Hyperbaiter
Who is worse than the german dictator?
Yeah, that's right, Hyperbaiter
Who fights old ladies in the elevator?
Yeah, that's right, Hyperbaiter

[Verse 3]
All of your songs must be about goon
Because that's your life, you pathetic buffoon
You tried to come at me for stealing your lyrics
But you're the one who actually makes song mimics
You're hiding behind screens, fantasizing about ass
But in real life, you're a virgin who doesn't touch grass
You think you're famous but you're a one hit wonder
And in reality, your songs belong in a dumpster (Oooh)

[Chorus]
Who diddles children like a violator?
Yeah, that's right, Hyperbaiter
Who was the Diddy blud on the calculator?
Yeah, that's right, Hyperbaiter
Who is worse than the german dictator?
Yeah, that's right, Hyperbaiter
Who fights old ladies in the elevator?
Yeah, that's right, Hyperbaiter`
  }
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
function lyTick(){
  if(!lyLines.length)return;
  var pane=document.getElementById('paneLyrics');
  if(pane.hidden)return;
  if(pos<0||!TRACKS[pos]||TRACKS[pos].f!==pane.dataset.f)return;
  var t=audio.currentTime,idx=-1;
  for(var i=0;i<lyLines.length;i++){
    if(lyLines[i].t<=t)idx=i;else break;
  }
  if(idx===lyNow)return;
  if(lyNow>=0&&lyLineEls[lyNow])lyLineEls[lyNow].classList.remove('now');
  lyNow=idx;
  if(idx>=0&&lyLineEls[idx]){
    lyLineEls[idx].classList.add('now');
    try{pane.scrollTop=lyLineEls[idx].offsetTop-pane.clientHeight/2+lyLineEls[idx].offsetHeight/2}catch(e){}
    if(typeof vrAch==='function')vrAch('karaoke_watch');
  }
}
function lyRender(tr,txt,meta,head,preset,synced){
  var pane=document.getElementById('paneLyrics');
  if(pane.dataset.f!==tr.f)return;
  lyLines=[];lyLineEls=[];lyNow=-1;
  pane.innerHTML='';
  var lines=synced?parseLRC(synced):[];
  if(!txt&&!lines.length){
    var s=document.createElement('div');
    s.className='lyState';
    s.textContent='no lyrics in the database for this one.';
    pane.appendChild(s);
  }else{
    var hit=document.createElement('div');
    hit.className='lyHit';
    hit.textContent=head||(meta?((meta.artistName?meta.artistName+' - ':'')+(meta.trackName||'')):tr.n);
    pane.appendChild(hit);
    if(lines.length){
      for(var i=0;i<lines.length;i++){
        var d=document.createElement('div');
        d.className='lyLine';
        d.textContent=lines[i].x||'\u00a0';
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
    foot.textContent='synced lyrics via ';
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
function lyLoad(pos){
  var tr=TRACKS[pos];
  var pane=document.getElementById('paneLyrics');
  pane.dataset.f=tr.f;
  var pre=LYR_PRESETS[tr.f];
  if(pre){lyRender(tr,pre.body,null,pre.head,true);return}
  if(lyCache[tr.f]!==undefined){lyRender(tr,lyCache[tr.f].p,null,null,false,lyCache[tr.f].s);return}
  pane.innerHTML='<div class="lyState">searching lrclib&hellip;</div>';
  var q=tr.n.replace(/\[[^\]]*\]/g,'').trim();
  var title=lyNorm(q.split(' - ').pop());
  fetch('https://lrclib.net/api/search?q='+encodeURIComponent(q))
  .then(function(r){
    if(r.status===429)throw{tired:true};
    if(!r.ok)throw{tired:false};
    return r.json();
  })
  .then(function(arr){
    var best=null,bestScore=-1;
    for(var i=0;i<(arr||[]).length;i++){
      var a=arr[i];
      if(!a.plainLyrics&&!a.syncedLyrics&&!a.instrumental)continue;
      var hay=lyNorm((a.trackName||'')+' '+(a.artistName||'')+' '+(a.name||''));
      var score=1;
      if(a.plainLyrics)score+=2;
      if(a.syncedLyrics)score+=2;
      if(title&&hay.indexOf(title)>=0)score+=3;
      if(score>bestScore){bestScore=score;best=a}
    }
    if(!best){lyCache[tr.f]={p:'',s:null};lyRender(tr,'',null);return}
    var txt=best.instrumental&&!best.plainLyrics&&!best.syncedLyrics?'[instrumental - no lyrics to show]':(best.plainLyrics||'');
    lyCache[tr.f]={p:txt,s:best.syncedLyrics||null};
    lyRender(tr,txt,best,null,false,lyCache[tr.f].s);
  })
  .catch(function(err){
    if(pane.dataset.f!==tr.f)return;
    if(err&&err.tired){
      pane.innerHTML='<div class="lyState">lrclib is tired - give it a minute, then click the note again.</div>';
    }else{
      pane.innerHTML='<div class="lyState">lrclib unreachable - network or filter in the way</div>';
    }
  });
}
function fmtSize(b){
  if(!b&&b!==0)return'-';
  return b>=1048576?(b/1048576).toFixed(1)+' MB':Math.round(b/1024)+' KB';
}
function fileSize(f,cb){
  if(sizeCache[f]!==undefined){cb(sizeCache[f]);return}
  fetch(f,{method:'HEAD'}).then(function(r){
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
    ['last played',last,null],
    ['favorite',vrFavs.indexOf(tr.f)>=0?'starred on your shelf':'not starred',null],
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
    if(rows[i][2]){
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

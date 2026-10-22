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

function loadTrack(i,autoplay){
  if(i<0||i>=TRACKS.length)return;
  pos=i;
  var tr=TRACKS[i];
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
}

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
});
btnLoop.addEventListener('click',function(){
  loopOne=!loopOne;
  btnLoop.classList.toggle('on',loopOne);
  audio.loop=loopOne;
});
document.getElementById('vol').addEventListener('input',function(){
  audio.volume=this.value/100;
});
seek.addEventListener('input',function(){
  if(audio.duration)audio.currentTime=(this.value/1000)*audio.duration;
});
audio.addEventListener('play',function(){setPlayingUI(true);markPlaying();if(window.setCrackleLevel&&crackleWanted)setCrackleLevel(1)});
audio.addEventListener('pause',function(){setPlayingUI(false);if(window.setCrackleLevel)setCrackleLevel(0)});
audio.addEventListener('ended',function(){if(!loopOne)nextTrack()});
audio.addEventListener('timeupdate',function(){
  tCur.textContent=fmt(audio.currentTime);
  if(audio.duration){
    tDur.textContent=fmt(audio.duration);
    seek.value=Math.round((audio.currentTime/audio.duration)*1000);
  }
});
audio.addEventListener('loadedmetadata',function(){
  if(pos>=0&&audio.duration){
    var li=listEl.querySelector('[data-pos="'+pos+'"] .du');
    if(li&&li.textContent==='--:--')li.textContent=fmt(audio.duration);
  }
});
audio.addEventListener('error',function(){
  if(pos>=0)nowMeta.textContent='could not load '+TRACKS[pos].f+' (try ctrl+shift+r)';
});

function buildList(filter){
  var q=(filter||'').toLowerCase().trim();
  listEl.innerHTML='';
  for(var i=0;i<TRACKS.length;i++){
    var tr=TRACKS[i];
    var hay=(tr.n+' '+tr.a.join(' ')+' '+tr.f).toLowerCase();
    if(q&&hay.indexOf(q)<0)continue;
    var li=document.createElement('li');
    li.dataset.pos=i;
    if(i===pos)li.className='playing';
    li.innerHTML='<span class="idx">'+(i+1)+'</span>'+
      '<span class="nm"></span>'+
      '<span class="al"></span>'+
      '<button class="lyBtn" title="lyrics">&#9834;</button>'+
      '<span class="du">--:--</span>';
    li.querySelector('.nm').textContent=tr.n;
    li.querySelector('.al').textContent=tr.a.length?tr.a.join(' '):'';
    li.querySelector('.lyBtn').addEventListener('click',function(e){
      if(typeof tutActive!=='undefined'&&tutActive)return;
      e.stopPropagation();
      openOsWin(+this.parentNode.dataset.pos,'lyrics');
    });
    li.addEventListener('click',function(){loadTrack(+this.dataset.pos,true)});
    listEl.appendChild(li);
  }
}
document.getElementById('filter').addEventListener('input',function(){buildList(this.value)});

var crackleWanted=false;
var sleepMins=0,sleepTimer=null;

initVisualizer(audio);
rebuildOrder();
buildList('');

var btnCrackle=document.getElementById('btnCrackle');
var btnSleep=document.getElementById('btnSleep');
btnCrackle.addEventListener('click',function(){
  crackleWanted=!crackleWanted;
  btnCrackle.classList.toggle('on',crackleWanted);
  if(window.setCrackleLevel)setCrackleLevel(crackleWanted&&!audio.paused?1:0);
});
btnSleep.addEventListener('click',function(){
  sleepMins=sleepMins===0?15:sleepMins===15?30:sleepMins===30?60:0;
  if(sleepTimer){clearInterval(sleepTimer);sleepTimer=null}
  if(sleepMins===0){btnSleep.textContent='\u23F1';btnSleep.classList.remove('on');return}
  btnSleep.classList.add('on');
  btnSleep.textContent=sleepMins+'m';
  sleepTimer=setInterval(function(){
    sleepMins--;
    if(sleepMins<=0){
      clearInterval(sleepTimer);sleepTimer=null;
      btnSleep.textContent='\u23F1';btnSleep.classList.remove('on');
      audio.pause();
      nowMeta.textContent='sleep timer ended. goodnight.';
    }else{btnSleep.textContent=sleepMins+'m'}
  },60000);
});

document.addEventListener('keydown',function(e){
  var tag=(e.target&&e.target.tagName)||'';
  if(tag==='INPUT'||tag==='TEXTAREA')return;
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
  tryPlay();
});

var qTrack=new URLSearchParams(location.search).get('track');
if(qTrack){
  var qq=qTrack.toLowerCase().replace(/[^a-z0-9]/g,'');
  for(var qi=0;qi<TRACKS.length;qi++){
    var hay=(TRACKS[qi].n+' '+TRACKS[qi].a.join(' ')+' '+TRACKS[qi].f).toLowerCase().replace(/[^a-z0-9]/g,'');
    if(qq&&hay.indexOf(qq)>=0){loadTrack(qi,false);break}
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
});
document.getElementById('setPitch').addEventListener('input',function(){
  var v=parseInt(this.value,10);
  if(window.setPitchRatio)setPitchRatio(Math.pow(2,v/12));
  document.getElementById('setPitchV').textContent=(v>0?'+':'')+v+' st';
});
document.getElementById('setToneS').addEventListener('input',function(){
  var hz=parseInt(this.value,10);
  if(window.setTone)setTone(hz);
  document.getElementById('setToneV').textContent=hz>=15500?'open':(hz>=1000?(hz/1000).toFixed(1)+'k':hz+'hz');
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
   text:'68 records, one deck. quick tour - ten clicks, then you are free. you can replay it any time from the footer.'},
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
   text:'type to narrow the shelf. names, aliases and filenames all match - try "employment" or "sm07".'},
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

function osShow(){
  osWin.hidden=false;
  osWin.classList.remove('out','anim');
  void osWin.offsetWidth;
  osWin.classList.add('anim');
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
  var pL=document.getElementById('paneLyrics');
  var pI=document.getElementById('paneInfo');
  pL.hidden=name!=='lyrics';
  pI.hidden=name!=='info';
  var vis=name==='lyrics'?pL:pI;
  vis.classList.remove('tabIn');
  void vis.offsetWidth;
  vis.classList.add('tabIn');
  if(name==='lyrics'&&osPos>=0&&pL.dataset.f!==TRACKS[osPos].f)lyLoad(osPos);
}
var osTabBtns=document.querySelectorAll('.osTab');
for(var oi=0;oi<osTabBtns.length;oi++){
  (function(b){b.addEventListener('click',function(){osTab(b.dataset.tab)})})(osTabBtns[oi]);
}

function openOsWin(pos,tab){
  var tr=TRACKS[pos];
  if(!tr)return;
  osPos=pos;
  document.getElementById('osWinTitle').textContent=tr.n;
  osShow();
  osTab(tab||'lyrics');
}

function lyNorm(s){
  return String(s||'').toLowerCase().replace(/\[[^\]]*\]/g,'').replace(/[^a-z0-9]/g,'');
}
function lyRender(tr,txt,meta){
  var pane=document.getElementById('paneLyrics');
  if(pane.dataset.f!==tr.f)return;
  pane.innerHTML='';
  if(!txt){
    var s=document.createElement('div');
    s.className='lyState';
    s.textContent='no lyrics in the database for this one.';
    pane.appendChild(s);
  }else{
    var hit=document.createElement('div');
    hit.className='lyHit';
    hit.textContent=meta?((meta.artistName?meta.artistName+' - ':'')+(meta.trackName||'')):tr.n;
    pane.appendChild(hit);
    var body=document.createElement('div');
    body.textContent=txt;
    pane.appendChild(body);
  }
  var foot=document.createElement('div');
  foot.className='lyMeta';
  foot.textContent='via ';
  var a=document.createElement('a');
  a.href='https://lrclib.net';a.target='_blank';a.rel='noopener';
  a.textContent='lrclib.net';
  foot.appendChild(a);
  pane.appendChild(foot);
}
function lyLoad(pos){
  var tr=TRACKS[pos];
  var pane=document.getElementById('paneLyrics');
  pane.dataset.f=tr.f;
  if(lyCache[tr.f]!==undefined){lyRender(tr,lyCache[tr.f],null);return}
  pane.innerHTML='<div class="lyState">searching lrclib&hellip;</div>';
  var q=tr.n.replace(/\[[^\]]*\]/g,'').trim();
  var title=lyNorm(q.split(' - ').pop());
  fetch('https://lrclib.net/api/search?q='+encodeURIComponent(q))
  .then(function(r){if(!r.ok)throw 0;return r.json()})
  .then(function(arr){
    var best=null,bestScore=-1;
    for(var i=0;i<(arr||[]).length;i++){
      var a=arr[i];
      if(!a.plainLyrics&&!a.instrumental)continue;
      var hay=lyNorm((a.trackName||'')+' '+(a.artistName||'')+' '+(a.name||''));
      var score=1;
      if(a.plainLyrics)score+=2;
      if(title&&hay.indexOf(title)>=0)score+=3;
      if(score>bestScore){bestScore=score;best=a}
    }
    if(!best){lyCache[tr.f]='';lyRender(tr,'',null);return}
    var txt=best.instrumental&&!best.plainLyrics?'[instrumental - no lyrics to show]':best.plainLyrics;
    lyCache[tr.f]=txt;
    lyRender(tr,txt,best);
  })
  .catch(function(){
    if(pane.dataset.f!==tr.f)return;
    pane.innerHTML='<div class="lyState">lrclib unreachable - network or filter in the way</div>';
  });
}
function infoRender(pos){
  var tr=TRACKS[pos];
  var pane=document.getElementById('paneInfo');
  pane.innerHTML='';
  var link=location.origin+location.pathname+'?track='+encodeURIComponent(tr.a[0]||tr.f);
  var rows=[
    ['name',tr.n,null],
    ['file',tr.f,null],
    ['aliases',tr.a.length?tr.a.join(', '):'-',null],
    ['shelf',String(pos+1)+' of '+TRACKS.length,null],
    ['deep link',link,link]
  ];
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
  }
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

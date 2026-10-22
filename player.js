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
      '<span class="du">--:--</span>';
    li.querySelector('.nm').textContent=tr.n;
    li.querySelector('.al').textContent=tr.a.length?tr.a.join(' '):'';
    li.addEventListener('click',function(){loadTrack(+this.dataset.pos,true)});
    listEl.appendChild(li);
  }
}
document.getElementById('filter').addEventListener('input',function(){buildList(this.value)});

var crackleWanted=true;
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

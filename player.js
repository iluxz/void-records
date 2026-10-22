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
audio.addEventListener('play',function(){setPlayingUI(true);markPlaying()});
audio.addEventListener('pause',function(){setPlayingUI(false)});
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

initVisualizer(audio);
rebuildOrder();
buildList('');

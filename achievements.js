var ACH_VR=[
{sec:'THE DECK'},
{id:'first_spin',h:'drop the needle. any needle.',n:'first spin',d:'load a track onto the deck. the record is live.',c:function(){return vrTotPlays()>=1}},
{id:'spins_10',h:'ten of them.',n:'needle in a groove',d:'10 spins across the whole shelf.',c:function(){return vrTotPlays()>=10}},
{id:'spins_100',h:'a hundred now.',n:'hundred club',d:'100 spins. the shelf knows your name.',c:function(){return vrTotPlays()>=100}},
{id:'shelf_all',h:'every single one. all 114.',n:'the whole shelf',d:'play every track in the collection at least once.',c:function(){return vrTouched()>=TRACKS.length}},
{id:'deep_link',h:'someone sent you a link.',n:'link in bio',d:'arrive through a ?track= deep link.',c:false},
{sec:'THE KNOBS'},
{id:'shuffle_on',h:'let the deck decide.',n:'shuffle soul',d:'turn shuffle on and let the deck pick for you.',c:false},
{id:'loop_on',h:'again. again.',n:'groundhog day',d:'turn loop-one on. this track, forever-ish.',c:false},
{id:'pitch_extreme',h:'all the way. either way.',n:'out of tune',d:'push the pitch to +12 or -12 semitones.',c:false},
{id:'redline',h:'no wisdom left in here.',n:'redline',d:'volume at 100. neighbors notified.',c:false},
{id:'overdrive',h:'twice as fast.',n:'overdrive',d:'playback speed at 2.0x. it is not the same song anymore.',c:false},
{id:'tone_dark',h:'turn the lights down.',n:'late night radio',d:'tone under 1 kHz - muffled on purpose.',c:false},
{id:'crackle_on',h:'the needle hisses back.',n:'crackle and pop',d:'vinyl crackle on while a track is playing.',c:function(){try{return crackleWanted&&!audio.paused}catch(e){return false}}},
{id:'sleep_armed',h:'set it. forget it.',n:'lights out',d:'arm the sleep timer - it fades the music out when time is up.',c:false},
{sec:'THE WINDOW'},
{id:'window_open',h:'open the little window.',n:'window shopper',d:'open the record window (lyrics, info, stats...).',c:false},
{id:'tab_stats',h:'numbers about your listening.',n:'on the meter',d:'open the stats tab.',c:false},
{id:'tab_credits',h:'who made all this.',n:'credits where due',d:'open the credits tab.',c:false},
{id:'karaoke_watch',h:'the words follow the song.',n:'karaoke bar',d:'watch a synced lyric line light up while the music plays.',c:false},
{id:'log_end',h:'read to the very last page.',n:'read to the end',d:'flip through the update log all the way to the last entry.',c:false},
{id:'tutorial_done',h:'ten clicks and you are free.',n:'class dismissed',d:'finish the tutorial tour.',c:function(){try{return localStorage.getItem('tutorialCompleted')==='1'}catch(e){return false}}},
{id:'install_app',h:'put it on your desktop.',n:'there is an app for that',d:'install void records as a desktop app.',c:false},
{sec:'THE SHELF'},
{id:'fav_first',h:'one star.',n:'star gazer',d:'favorite your first track.',c:function(){try{return vrFavs.length>=1}catch(e){return false}}},
{id:'fav_10',h:'ten stars.',n:'star material',d:'10 favorites on your shelf.',c:function(){try{return vrFavs.length>=10}catch(e){return false}}},
{id:'filter_recent',h:'sort by memory.',n:'time traveler',d:'use the "recent" filter to sort by what you played last.',c:false},
{id:'local_file',h:'bring one in from outside.',n:'outsider media',d:'drag a local audio file onto the deck.',c:false},
{id:'havexy_egg',h:'he visits when he feels like it.',n:'havexy sighting',d:'play any havexy track and see who shows up.',c:false},
{id:'skeleton_run',h:'rare. extremely rare. keep your eyes on the screen.',n:'he ran across',d:'witness the skeleton sprint across the entire screen and vanish.',c:false}
];

function vrAchSet(){
  try{var v=JSON.parse(localStorage.getItem('vr_ach')||'[]');return v instanceof Array?v:[]}catch(e){return[]}
}
function vrAchSave(s){try{localStorage.setItem('vr_ach',JSON.stringify(s))}catch(e){}}
function vrAchHas(id){return vrAchSet().indexOf(id)>=0}
function vrTotPlays(){var t=0;try{for(var k in vrPlays)t+=(vrPlays[k]||0)}catch(e){}return t}
function vrTouched(){var t=0;try{for(var k in vrPlays)if(vrPlays[k]>0)t++}catch(e){}return t}

function vrAchToast(def){
  var box=document.getElementById('achToasts');
  if(!box){box=document.createElement('div');box.id='achToasts';document.body.appendChild(box)}
  var t=document.createElement('div');t.className='achToast';
  var bar=document.createElement('div');bar.className='achToastBar';
  var dot=document.createElement('i');dot.className='dot';
  var lbl=document.createElement('span');lbl.className='achToastLbl';lbl.textContent='achievement';
  bar.appendChild(dot);bar.appendChild(lbl);
  var nm=document.createElement('div');nm.className='achToastN';nm.textContent=def.n;
  var ds=document.createElement('div');ds.className='achToastD';ds.textContent=def.d;
  t.appendChild(bar);t.appendChild(nm);t.appendChild(ds);
  box.appendChild(t);
  setTimeout(function(){
    try{t.classList.add('out')}catch(e){}
    setTimeout(function(){try{t.parentNode&&t.parentNode.removeChild(t)}catch(e){}},400);
  },4200);
}

function vrAch(id){
  var def=null;
  for(var i=0;i<ACH_VR.length;i++)if(ACH_VR[i].id===id)def=ACH_VR[i];
  if(!def)return false;
  var s=vrAchSet();
  if(s.indexOf(id)>=0)return false;
  s.push(id);vrAchSave(s);
  try{vrAchToast(def)}catch(e){}
  try{vrAchRefresh()}catch(e){}
  return true;
}
function vrAchScan(){
  var s=vrAchSet();
  for(var i=0;i<ACH_VR.length;i++){
    var d=ACH_VR[i];
    if(!d||!d.c||s.indexOf(d.id)>=0)continue;
    try{if(d.c())vrAch(d.id)}catch(e){}
  }
}
function vrAchRefresh(){
  try{
    var p=document.getElementById('paneAwards');
    if(p&&!p.hidden)awardsRender();
  }catch(e){}
}

var vrAchFilter='ALL';
function vrAchSections(){
  var out=[],cur=null;
  for(var i=0;i<ACH_VR.length;i++){
    var d=ACH_VR[i];
    if(d.sec){cur={name:d.sec,total:0,got:0,items:[]};out.push(cur)}
    else if(d.id){
      if(!cur){cur={name:'MISC',total:0,got:0,items:[]};out.push(cur)}
      cur.total++;cur.items.push(d);
    }
  }
  return out;
}
function awardsRender(){
  var pane=document.getElementById('paneAwards');
  if(!pane)return;
  var s=vrAchSet();
  pane.innerHTML='';
  var secs=vrAchSections(),tot=0;
  for(var i=0;i<secs.length;i++){
    secs[i].got=0;
    for(var j=0;j<secs[i].items.length;j++)if(s.indexOf(secs[i].items[j].id)>=0)secs[i].got++;
    tot+=secs[i].total;
  }
  var got=0;
  for(var g=0;g<ACH_VR.length;g++)if(ACH_VR[g].id&&s.indexOf(ACH_VR[g].id)>=0)got++;
  var pct=Math.round(got/Math.max(1,tot)*100);

  var head=document.createElement('div');
  head.className='awHead';
  var cnt=document.createElement('span');cnt.className='awCount';cnt.textContent=got+' / '+tot;
  var pc=document.createElement('span');pc.className='awPct';pc.textContent=pct+'%';
  var sub=document.createElement('span');sub.className='awSub';sub.textContent='unlocked';
  head.appendChild(cnt);head.appendChild(pc);head.appendChild(sub);
  pane.appendChild(head);

  var bar=document.createElement('div');bar.className='awBar';
  var fill=document.createElement('div');fill.className='awFill';fill.style.width=pct+'%';
  bar.appendChild(fill);pane.appendChild(bar);

  var chips=document.createElement('div');chips.className='awChips';
  function mkChip(label,val){
    var c=document.createElement('button');
    c.className='awChip'+(vrAchFilter===val?' on':'');
    c.textContent=label;
    c.addEventListener('click',function(){vrAchFilter=val;awardsRender()});
    chips.appendChild(c);
  }
  mkChip('ALL '+got+'/'+tot,'ALL');
  for(var c=0;c<secs.length;c++)mkChip(secs[c].name+' '+secs[c].got+'/'+secs[c].total,secs[c].name);
  pane.appendChild(chips);

  if(vrDeferredPrompt&&!vrAchHas('install_app')){
    var inst=document.createElement('button');
    inst.className='awInstall';
    inst.textContent='+ add void records to your desktop';
    inst.addEventListener('click',function(){
      var dp=vrDeferredPrompt;vrDeferredPrompt=null;
      if(!dp)return;
      try{dp.prompt()}catch(e){}
      try{
        dp.userChoice.then(function(res){
          if(res&&res.outcome==='accepted')vrAch('install_app');
          else awardsRender();
        });
      }catch(e){}
      inst.disabled=true;inst.textContent='check your browser menu';
    });
    pane.appendChild(inst);
  }

  var list=document.createElement('div');
  for(var si=0;si<secs.length;si++){
    var sc=secs[si];
    if(vrAchFilter!=='ALL'&&vrAchFilter!==sc.name)continue;
    var sh=document.createElement('div');
    sh.className='awSecRow';
    var shN=document.createElement('span');shN.textContent=sc.name;
    var shC=document.createElement('span');shC.textContent=sc.got+'/'+sc.total;
    sh.appendChild(shN);sh.appendChild(shC);
    list.appendChild(sh);
    for(var k=0;k<sc.items.length;k++){
      var d=sc.items[k];
      if(!d||!d.id)continue;
      var has=s.indexOf(d.id)>=0;
      var row=document.createElement('div');
      row.className='awRow'+(has?' got':'');
      var nm=document.createElement('div');nm.className='awName';
      nm.textContent=(has?'\u2713 ':'\u25cb ')+d.n;
      var ds=document.createElement('div');ds.className='awDesc';
      ds.textContent=d.d;
      row.appendChild(nm);row.appendChild(ds);
      list.appendChild(row);
    }
  }
  pane.appendChild(list);

  var foot=document.createElement('div');
  foot.className='lyMeta';
  foot.textContent='earned in this browser only - localStorage, never uploaded.';
  pane.appendChild(foot);
}

var vrDeferredPrompt=null;
window.addEventListener('beforeinstallprompt',function(e){
  e.preventDefault();
  vrDeferredPrompt=e;
  try{vrAchRefresh()}catch(err){}
});

var skelBusy=false;
function runSkeleton(){
  if(skelBusy)return false;
  var el=document.getElementById('skelRun');
  if(!el)return false;
  skelBusy=true;
  el.hidden=false;
  el.classList.remove('go');
  void el.offsetWidth;
  el.classList.add('go');
  var done=function(){
    el.hidden=true;
    el.classList.remove('go');
    skelBusy=false;
    try{el.removeEventListener('animationend',done)}catch(e){}
    vrAch('skeleton_run');
  };
  el.addEventListener('animationend',done);
  return true;
}
function skelMaybe(){
  if(skelBusy)return;
  if(Math.random()<0.02)runSkeleton();
}
window.skelNow=runSkeleton;

setTimeout(function(){try{vrAchScan()}catch(e){}},1500);
setInterval(function(){try{vrAchScan()}catch(e){}},8000);

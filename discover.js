// discovery queue + sandbox radio. everything here is non-canon: candidates
// are metadata only, approved picks live in their own pool, and nothing in
// this file can write vr_clean, vr_plays or a shelf achievement.

var DISC={source:'',scanned:[],approved:[],radio:false,radioOrder:[],radioPos:-1,currentId:null};
var discGen=0,radioSkips=0,radioTimer=null,radioGen=0;

function discLoad(){
  try{
    var j=JSON.parse(localStorage.getItem('vr_discover')||'{}')||{};
    DISC.source=j.source||'';
    DISC.scanned=Array.isArray(j.scanned)?j.scanned:[];
    DISC.approved=Array.isArray(j.approved)?j.approved:[];
  }catch(e){}
}
function discSave(){
  try{localStorage.setItem('vr_discover',JSON.stringify({source:DISC.source,scanned:DISC.scanned,approved:DISC.approved}))}catch(e){}
}
function discEl(id){return document.getElementById(id)}
function short(s,n){s=String(s||'');n=n||62;return s.length>n?s.slice(0,n-1)+'\u2026':s}
function node(tag,cls,text){
  var e=document.createElement(tag);
  if(cls)e.className=cls;
  if(text!=null)e.textContent=text;
  return e;
}
function discMsg(text,kind){
  var el=discEl('discMsg');
  if(!el)return;
  el.textContent=text||'';
  el.className=kind||'';
  if(typeof showSrcMsg==='function')showSrcMsg(text||'',kind||'');
}
function discOpen(tab){
  var w=discEl('discWin');
  if(!w)return;
  w.hidden=false;
  w.classList.remove('out');
  void w.offsetWidth;
  w.classList.add('anim');
  discTab(tab||'scan');
}
function discClose(){
  var w=discEl('discWin');
  if(!w||w.hidden)return;
  w.classList.remove('anim');
  w.classList.add('out');
  setTimeout(function(){w.hidden=true;w.classList.remove('out')},180);
}
function discTab(name){
  var tabs=document.querySelectorAll('[data-disc-tab]');
  for(var i=0;i<tabs.length;i++)tabs[i].classList.toggle('on',tabs[i].getAttribute('data-disc-tab')===name);
  var scan=discEl('discPaneScan'),kept=discEl('discPaneApproved');
  if(scan)scan.hidden=name!=='scan';
  if(kept)kept.hidden=name!=='kept';
}
function findItem(id,approvedOnly){
  var pool=approvedOnly?DISC.approved:DISC.scanned;
  for(var i=0;i<pool.length;i++)if(String(pool[i].id||pool[i].url)===String(id))return pool[i];
  return null;
}
function isKept(item){
  for(var i=0;i<DISC.approved.length;i++)if(DISC.approved[i].url===item.url)return true;
  return false;
}
function discRender(){
  var cnt=discEl('discCount');
  if(cnt)cnt.textContent=DISC.scanned.length+' scanned / '+DISC.approved.length+' kept';
  renderQueue(discEl('discList'),DISC.scanned,false);
  renderQueue(discEl('discApprovedList'),DISC.approved,true);
  var src=discEl('discSource');
  if(src)src.textContent=DISC.source?('source: '+short(DISC.source,90)):'no source scanned yet';
  radioUI();
}
function renderQueue(host,items,approved){
  if(!host)return;
  host.textContent='';
  if(!items.length){
    host.appendChild(node('div','discEmpty',approved?'nothing kept yet - approve a candidate from the scan tab':'scan a youtube playlist, a ytsearch: query, or paste a single video link'));
    return;
  }
  for(var i=0;i<items.length;i++){
    var it=items[i],id=String(it.id||it.url);
    var row=node('div','discRow');
    row.setAttribute('data-id',id);
    if(DISC.currentId&&String(DISC.currentId)===id)row.classList.add('on');
    var main=node('div','discMain');
    main.appendChild(node('div','discTitle',it.title||'untitled'));
    var meta=(it.channel?it.channel+' \u00b7 ':'')+(it.duration>0?fmtDisc(it.duration)+' \u00b7 ':'')+(approved?'kept':'metadata only');
    main.appendChild(node('div','discMeta',meta));
    row.appendChild(main);
    var acts=node('div','discActs');
    var a=node('button','discBtn',approved?'play':(isKept(it)?'kept':'preview'));
    a.setAttribute('data-act',approved?'play':'preview');
    if(!approved&&isKept(it))a.disabled=true;
    acts.appendChild(a);
    var b=node('button','discBtn '+(approved?'danger':''),approved?'drop':'keep');
    b.setAttribute('data-act',approved?'drop':'keep');
    acts.appendChild(b);
    row.appendChild(acts);
    host.appendChild(row);
  }
}
function fmtDisc(sec){
  sec=Math.max(0,Math.round(Number(sec)||0));
  var h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
  return (h?h+':':'')+(h?String(m).padStart(2,'0'):m)+':'+String(s).padStart(2,'0');
}

function discScan(){
  var raw=(discEl('discUrl')||{}).value||'';
  raw=String(raw).trim();
  if(!raw){discMsg('paste a playlist link or a ytsearch: query first','err');return}
  if(typeof serverOn!=='function'||!serverOn()){
    discMsg('discovery needs the local void records server - turn it on in settings (use an https tunnel url if this page is https)','err');
    return;
  }
  var btn=discEl('discScan');
  if(btn)btn.disabled=true;
  discMsg('scanning metadata only - no audio is downloaded...','wait');
  var gen=++discGen;
  fetch(serverBase()+'/api/v1/discover?url='+encodeURIComponent(raw)).then(function(r){
    return r.json().catch(function(){return {}}).then(function(j){return {status:r.status,j:j}});
  }).then(function(res){
    if(btn)btn.disabled=false;
    if(gen!==discGen)return;
    var j=res.j||{};
    if(res.status!==200||!j.ok||!Array.isArray(j.items)){
      discMsg('scan failed: '+(j.error||('server returned '+res.status)),'err');
      return;
    }
    DISC.source=raw;
    DISC.scanned=j.items;
    discSave();discRender();
    discMsg('found '+j.count+' candidates - metadata only, nothing joined the 418','ok');
  }).catch(function(err){
    if(btn)btn.disabled=false;
    if(gen!==discGen)return;
    discMsg('cannot reach the void records server: '+((err&&err.message)||'unknown error'),'err');
  });
}
function discKeep(id){
  var it=findItem(id,false);
  if(!it)return;
  if(!isKept(it))DISC.approved.push(it);
  discSave();discRender();
  discMsg('kept "'+short(it.title,48)+'" - sandbox only, never in the shelf','ok');
}
function discDrop(id){
  DISC.approved=DISC.approved.filter(function(x){return String(x.id||x.url)!==String(id)});
  discSave();discRender();
  discMsg('removed from the kept pool','ok');
}
function resolveItem(item,okCb,errCb){
  if(typeof serverOn!=='function'||!serverOn()){errCb('the local void records server is off');return}
  fetch(serverBase()+'/api/v1/resolve?url='+encodeURIComponent(item.url)).then(function(r){
    return r.json().catch(function(){return {}}).then(function(j){return {status:r.status,j:j}});
  }).then(function(res){
    var j=res.j||{};
    if(res.status!==200||!j.url){errCb(j.error||('server returned '+res.status));return}
    okCb(j,item);
  }).catch(function(err){errCb((err&&err.message)||'network error')});
}
function playResolved(j,item,label){
  if(typeof playExternal!=='function')return false;
  playExternal(j.url,{
    title:j.title||item.title||'sandbox signal',
    meta:((j.channel||item.channel)?(j.channel||item.channel)+' \u00b7 ':'')+(label||'discovery')+' - not in the collection',
    video:!!j.video,
    autoplay:true
  });
  DISC.currentId=item.id||item.url;
  discRender();
  return true;
}
function discPreview(id){
  var it=findItem(id,false);
  if(!it)return;
  if(typeof vrRadioStop==='function')vrRadioStop();
  discMsg('resolving "'+short(it.title,48)+'"...','wait');
  resolveItem(it,function(j){
    playResolved(j,it,'preview');
    discMsg('preview playing - outside the collection','ok');
  },function(err){discMsg('cannot play this candidate: '+err,'err')});
}
function discPlayKept(id){
  var it=findItem(id,true);
  if(!it)return;
  if(typeof vrRadioStop==='function')vrRadioStop();
  discMsg('resolving "'+short(it.title,48)+'"...','wait');
  resolveItem(it,function(j){
    playResolved(j,it,'sandbox');
    discMsg('playing from the kept pool - outside the collection','ok');
  },function(err){discMsg('cannot play this candidate: '+err,'err')});
}

// sandbox radio: shuffles the kept pool (or the last scan if nothing is kept),
// resolves each item on demand and repeats forever. never writes progress.
function vrRadioOn(){return DISC.radio}
function shuffled(n){
  var a=[];
  for(var i=0;i<n;i++)a.push(i);
  for(var j=a.length-1;j>0;j--){var k=Math.floor(Math.random()*(j+1));var t=a[j];a[j]=a[k];a[k]=t}
  return a;
}
function radioUI(){
  var b=discEl('btnRadio');
  if(b){b.textContent='radio: '+(DISC.radio?'on':'off');b.classList.toggle('on',DISC.radio)}
  var b2=discEl('discRadioBtn');
  if(b2){b2.textContent=DISC.radio?'stop radio':'start radio';b2.classList.toggle('on',DISC.radio)}
  var hint=discEl('discRadioHint');
  if(hint)hint.textContent=DISC.radio
    ? 'on air - shuffling '+(DISC.approved.length||DISC.scanned.length)+' non-canon signals forever'
    : 'infinite, non-canon, shuffled from your kept pool (or the last scan). no achievements, no vr_clean.';
}
function vrRadioStop(silent){
  if(!DISC.radio)return false;
  radioGen++;
  DISC.radio=false;
  if(radioTimer){clearTimeout(radioTimer);radioTimer=null}
  radioUI();discRender();
  if(!silent&&typeof showSrcMsg==='function')showSrcMsg('sandbox radio off','ok');
  return true;
}
function radioPool(){return DISC.approved.length?DISC.approved:DISC.scanned}
function radioStart(){
  if(DISC.radio){vrRadioStop();return}
  if(typeof serverOn!=='function'||!serverOn()){
    if(typeof showSrcMsg==='function')showSrcMsg('sandbox radio needs the local void records server - turn it on in settings','err');
    return;
  }
  var pool=radioPool();
  if(!pool.length){
    if(typeof showSrcMsg==='function')showSrcMsg('sandbox radio needs candidates - scan a playlist first','err');
    discOpen('scan');
    return;
  }
  DISC.radio=true;
  radioGen++;
  DISC.radioOrder=shuffled(pool.length);
  DISC.radioPos=-1;
  radioSkips=0;
  radioUI();discRender();
  if(typeof showSrcMsg==='function')showSrcMsg('sandbox radio on - '+pool.length+' signals, none of them count toward the right way','ok');
  radioNext(radioGen);
}
function radioNext(gen){
  if(!DISC.radio)return false;
  if(gen==null)gen=radioGen;
  if(gen!==radioGen)return false;
  var pool=radioPool();
  if(!pool.length){vrRadioStop();return false}
  if(DISC.radioPos>=pool.length-1){DISC.radioOrder=shuffled(pool.length);DISC.radioPos=-1}
  var item=pool[DISC.radioOrder[++DISC.radioPos]];
  if(!item)return false;
  if(typeof showSrcMsg==='function')showSrcMsg('sandbox radio: finding "'+short(item.title,46)+'"...','wait');
  resolveItem(item,function(j){
    if(!DISC.radio||gen!==radioGen)return;
    radioSkips=0;
    playResolved(j,item,'sandbox radio');
    if(typeof showSrcMsg==='function')showSrcMsg('sandbox radio: '+(j.title||item.title)+' - not in the collection','ok');
  },function(err){
    if(!DISC.radio||gen!==radioGen)return;
    radioSkips++;
    if(radioSkips>=pool.length){
      vrRadioStop();
      if(typeof showSrcMsg==='function')showSrcMsg('radio stopped - nothing in this station could be resolved','err');
      return;
    }
    if(typeof showSrcMsg==='function')showSrcMsg('radio skipped "'+short(item.title,40)+'": '+err+' - tuning another signal','err');
    radioTimer=setTimeout(function(){radioNext(gen)},900);
  });
  return true;
}
function vrRadioNext(){
  if(!DISC.radio)return false;
  radioSkips=0;
  return radioNext(radioGen);
}
function vrRadioError(){
  if(!DISC.radio)return false;
  var gen=radioGen;
  if(typeof showSrcMsg==='function')showSrcMsg('signal dropped - tuning another record...','wait');
  if(radioTimer)clearTimeout(radioTimer);
  radioTimer=setTimeout(function(){radioNext(gen)},700);
  return true;
}

var btnDiscEl=discEl('btnDisc');
if(btnDiscEl)btnDiscEl.addEventListener('click',function(){discOpen()});
var btnRadioEl=discEl('btnRadio');
if(btnRadioEl)btnRadioEl.addEventListener('click',radioStart);
var discCloseEl=discEl('discClose');
if(discCloseEl)discCloseEl.addEventListener('click',discClose);
var discClearEl=discEl('discClear');
if(discClearEl)discClearEl.addEventListener('click',function(){
  if(!window.confirm('clear the discovery queue and kept pool?'))return;
  vrRadioStop(true);
  DISC.scanned=[];DISC.approved=[];DISC.source='';DISC.currentId=null;
  discSave();discRender();discMsg('queue cleared','ok');
});
var discScanEl=discEl('discScan');
if(discScanEl)discScanEl.addEventListener('click',discScan);
var discUrlEl=discEl('discUrl');
if(discUrlEl)discUrlEl.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();discScan()}});
var discTabs=document.querySelectorAll('[data-disc-tab]');
for(var _t=0;_t<discTabs.length;_t++)discTabs[_t].addEventListener('click',function(){discTab(this.getAttribute('data-disc-tab'))});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    var w=discEl('discWin');
    if(w&&!w.hidden)discClose();
  }
});
['discList','discApprovedList'].forEach(function(hostId){
  var host=discEl(hostId);
  if(!host)return;
  host.addEventListener('click',function(e){
    var b=e.target&&e.target.closest?e.target.closest('button[data-act]'):null;
    if(!b||b.disabled)return;
    var row=b.closest('[data-id]');
    if(!row)return;
    var id=row.getAttribute('data-id'),act=b.getAttribute('data-act');
    if(act==='preview')discPreview(id);
    else if(act==='keep')discKeep(id);
    else if(act==='play')discPlayKept(id);
    else if(act==='drop')discDrop(id);
  });
});

discLoad();
discRender();

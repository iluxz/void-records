var PATCH_LOG=[
{date:"2026-10-21",type:"feature",title:"void records goes live",notes:[
  "the shelf hit 68 tracks and the tonearm actually learned where to land. one deck, one very long list of records."
]},
{date:"2026-10-21",type:"feature",title:"v2: knobs and shortcuts",notes:[
  "music settings, now playing everywhere, favorites, the lyrics window and lyrics presets.",
  "polish pass, real haydee zone names, and housekeeping underneath it all."
]},
{date:"2026-10-22",type:"feature",title:"karaoke mode and 26 achievements",notes:[
  "karaoke mode went live and the first 26 achievements gave people something to chase.",
  "this update log showed up so you can see how it got here."
]},
{date:"2026-10-22",type:"music pack",title:"the big haul: 68 to 114 tracks",notes:[
  "slime rancher and grim fandango soundtracks added, plus five new rooms to put them in."
]},
{date:"2026-11-21",type:"music pack",title:"music packs 2 to 4: geometry dash, memes and ultrakill",notes:[
  "music pack 2 added geometry dash and the meme shelf, pack 3 brought twelve more videos and pack 3.5 the other whole-server cuts.",
  "music pack 4 brought the entire ultrakill ost and the pizza place shelf. search \"ultrakill\" for the ost or \"wapp\" for the pizza place tracks.",
  "credits went where they belonged along the way."
]},
{date:"2026-11-21",type:"music pack",title:"music pack 5: weird youtube shelf",notes:[
  "the odd corners of youtube, filed properly, with five more pack 4.5 singles.",
  "music pack 4.5 brought in the flavor foley vocal shelf."
]},
{date:"2026-11-21",type:"music pack",title:"music pack 6: the 400th record",notes:[
  "music pack 6 crossed 400 tracks and the confetti button grew with the shelf.",
  "word-synced karaoke arrived - live word highlighting in the lyrics window, with per-song presets for tracks the public database cannot match.",
  "lyrics stay offline-only. the server reads a prebuilt file and never makes a live LRCLIB call."
]},
{date:"2026-11-21",type:"music pack",title:"music pack 7: fifteen more records",notes:[
  "fifteen new videos from the meme shelf, plus the deck and shelf rework and the gear panel glow-up.",
  "ui sound effects landed, preset lyrics arrived for its me its verity, and i miss the quiet finally got its video background."
]},
{date:"2026-11-21",type:"feature",title:"outside the shelf",notes:[
  "music pack 8 added two more records and the shelf reached 415 with all systems synced.",
  "discover button scans youtube playlists, ytsearch: queries and single video links as metadata only, with a preview and a separate kept pool that never joins the shelf.",
  "sandbox radio shuffles the kept pool, resolves each record on demand and plays forever. non-canon on purpose - no achievements, no shelf stats.",
  "local server bridge at 127.0.0.1:8787 for manifest, resolve, lyrics and tunnel config. https pages need an https tunnel url."
]},
{date:"2026-11-21",type:"music pack",title:"music pack 9: one record, cut to the chase",notes:[
  "one new record on the shelf, plus the fix that taught the deck where the needle actually lands."
]},
{date:"2026-11-21",type:"music pack",title:"music pack 10: thirteen more records",notes:[
  "13 new records - 419 to 431. anonymous hacking music, gotham chess edit, bad piggies x everything, both join us for a bite cuts, proud to be expendable, kwik flip, chronoshift (regretevator edition), the whole-server song and cant killean the zilean (the real one).",
  "eleven are 720p webm with video backgrounds, two came down as mp4 and are stored as proper .mp4.",
  "catalog rows now wrap long names instead of clipping them - only the pack tag shows inline, full aliases live in the hover tooltip."
]},
{date:"2026-11-21",type:"music pack",title:"music pack 11: men's music",notes:[
  "59 new records from men, a friend of lux, pulled from all 7 of his playlists. names always start with \"men - \" and every record carries the men alias.",
  "attachment, inadequate pursuit, the ### ## ###### OSTs, buttersaken, tgwyktgotr, midnight pizza delivery, MFGR and calm mode on.",
  "shelf is now 490. search \"men\", \"m11\", \"pack 11\" or \"music pack 11\" for the whole set."
]},
{date:"2026-11-21",type:"music pack",title:"music pack 12: the havexy video era",notes:[
  "all 23 havexy audio-only records were replaced by their official music videos - gypsy verity, folk valley, both hyperbaiters and every disstrack now has a real video background.",
  "eight new records joined the shelf: master baiter, big d randy, gooners, tom pearl, roblox ceo, chainsfr, keys commenters and corn bot.",
  "ui panels went translucent again so the video reads through while it stays behind the text. shelf is now 498 - search \"m12\", \"pack 12\" or \"music pack 12\"."
]}
];
var TYPE_COLOR={'patch':'#78b4ff','feature':'#64ffa0','update':'#c878ff','music pack':'#ffb43a'};
(function(){
  var win=document.getElementById('updWin');
  if(!win)return;
  var idx=0;
  var pageNo=document.getElementById('updPageNo');
  var titleEl=document.getElementById('updEntryTitle');
  var typeEl=document.getElementById('updType');
  var notesEl=document.getElementById('updNotes');
  var btnPrev=document.getElementById('updPrev');
  var btnNext=document.getElementById('updNext');
  function render(){
    var p=PATCH_LOG[idx];
    pageNo.textContent='entry '+(idx+1)+' of '+PATCH_LOG.length+'  \u00b7  '+p.date;
    titleEl.textContent=p.title;
    typeEl.textContent='['+p.type+']';
    typeEl.style.color=TYPE_COLOR[p.type]||'#8f87b8';
    var lines=[];
    for(var i=0;i<p.notes.length;i++)lines.push('\u2022  '+p.notes[i]);
    notesEl.textContent=lines.join('\n');
    notesEl.scrollTop=0;
    btnPrev.style.visibility=idx>0?'visible':'hidden';
    if(idx===PATCH_LOG.length-1){
      btnNext.textContent='close  \u2715';
      btnNext.classList.add('close');
    }else{
      btnNext.textContent='next  \u25b6';
      btnNext.classList.remove('close');
    }
  }
  function show(){
    idx=0;
    win.hidden=false;
    win.classList.remove('out','anim');
    void win.offsetWidth;
    win.classList.add('anim');
    window.__zN=(window.__zN||0)+1;
    win.style.zIndex=String(72+window.__zN);
    render();
  }
  function hide(){
    win.classList.add('out');
    setTimeout(function(){win.hidden=true;win.classList.remove('out','anim')},170);
  }
  document.getElementById('btnLog').addEventListener('click',show);
  document.getElementById('updClose').addEventListener('click',hide);
  document.getElementById('updMin').addEventListener('click',hide);
  document.getElementById('updMax').addEventListener('click',function(){win.classList.toggle('max')});
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&!win.hidden){
      if(typeof tutActive!=='undefined'&&tutActive)return;
      hide();
      e.stopPropagation();
    }
  },true);
  btnPrev.addEventListener('click',function(){if(idx>0){idx--;render()}});
  btnNext.addEventListener('click',function(){
    if(idx<PATCH_LOG.length-1){idx++;render();if(idx===PATCH_LOG.length-1&&window.vrAch)vrAch('log_end')}else hide();
  });
  var bar=document.getElementById('updBar');
  var dg=null;
  bar.addEventListener('pointerdown',function(e){
    if(e.target&&e.target.closest&&e.target.closest('.dot'))return;
    if(win.classList.contains('max'))return;
    var r=win.getBoundingClientRect();
    win.style.right='auto';
    win.style.left=r.left+'px';
    win.style.top=r.top+'px';
    dg={dx:e.clientX-r.left,dy:e.clientY-r.top};
    try{bar.setPointerCapture(e.pointerId)}catch(err){}
  });
  bar.addEventListener('pointermove',function(e){
    if(!dg)return;
    var x=e.clientX-dg.dx,y=e.clientY-dg.dy;
    x=Math.max(-win.offsetWidth+90,Math.min(x,window.innerWidth-90));
    y=Math.max(0,Math.min(y,window.innerHeight-44));
    win.style.left=x+'px';
    win.style.top=y+'px';
  });
  bar.addEventListener('pointerup',function(){dg=null});
  bar.addEventListener('pointercancel',function(){dg=null});
})();

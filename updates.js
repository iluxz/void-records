var PATCH_LOG=[
{date:'2026-10-22',type:'patch',title:'lyrics that are actually right',notes:[
'hyperbaiter now pulls live from lrclib instead of a hardcoded copy.',
'lyrics search is stricter now: a track only shows lyrics when the title really matches, so homonyms and wrong matches (like "&" showing "Welcome to Tally Hall") no longer slip through.',
'failed lookups are cached for 20 seconds and the player stops hammering lrclib under load.',
'lrclib hiccups show an honest message instead of "unreachable".'
]},
{date:'2026-10-21',type:'feature',title:'void records goes live',notes:[
'the cube chapter moved out of this repo. void records is now a side project: spinning vinyl deck, tonearm, spectrum bars, waveform background.',
'seek bar, volume, shuffle, loop, and a filterable track list - click a row to drop the needle.',
'58 tracks on the shelf to start.',
'works offline too: open index.html straight from a folder, no server needed.'
]},
{date:'2026-10-21',type:'music pack',title:'the shelf hits 68 tracks',notes:[
'ten more tracks added: employment, science\'s downfall, wake up stanley, moon rotation, bro is in a box, folk theme, something bad x2, grotto x2.',
'the haydee zone tracks (credits, water, gg ez, ...) keep their old names as aliases, so old links still work.',
'fixed the "espa ol" typo - now español.'
]},
{date:'2026-10-21',type:'patch',title:'the tonearm actually lands on the record',notes:[
'the arm was pointing at the wrong part of the vinyl.',
'three geometry fixes later: parked at +35, playing at +46, needle always sitting on the grooves.'
]},
{date:'2026-10-21',type:'feature',title:'v2: knobs and shortcuts',notes:[
'vinyl crackle layer (off by default), sleep timer (15/30/60 min), and drag & drop any local mp3 onto the deck.',
'keyboard: space = play/pause, arrows = prev/next, S = shuffle, L = loop, C = crackle.',
'?track=employment style deep links open straight to a song.'
]},
{date:'2026-10-21',type:'feature',title:'music settings',notes:[
'gear panel with three knobs: speed (0.5x-2x), pitch (-12 to +12 semitones), tone (lowpass, for muffled late-night listening).',
'pitch runs through a granular shifter, so changing it doesn\'t force the speed to change with it.'
]},
{date:'2026-10-21',type:'update',title:'polish pass',notes:[
'favicon: a little vinyl with an amber play triangle.',
'first-time tutorial with spotlight steps, replayable from the footer.',
'header trimmed to just the name + track count.',
'the audio context now starts on your first click instead of page load - no more browser warnings in the console.',
'lrclib rate limits now say "lrclib is tired, give it a minute" instead of failing weirdly.'
]},
{date:'2026-10-21',type:'update',title:'real haydee zone names',notes:[
'zone tracks renamed to Green Zone, Dark Zone, Yellow Zone, Red Zone, Blue Zone, White Zone and Main Menu.',
'credits stays credits, old names kept as aliases.'
]},
{date:'2026-10-21',type:'feature',title:'lyrics window',notes:[
'every row in the list has a note button: opens a window with traffic-light controls that you can drag around.',
'lyrics tab pulls from lrclib (timed lyrics when the song has them), info tab shows the deep link.',
'the window follows the player - switch tracks while it\'s open and it updates.'
]},
{date:'2026-10-21',type:'feature',title:'now playing everywhere + favorites',notes:[
'the browser tab title shows the current track, and media keys / lock screen controls work.',
'settings (volume, speed, pitch, tone, crackle) are saved and survive a refresh.',
'star any track to favorite it. type "favorites" in the filter to see only those.',
'the info tab now shows the full sheet: artist, track, file, format, size, length, aliases, play count, last played and favorite status.'
]},
{date:'2026-10-21',type:'feature',title:'lyrics presets',notes:[
'some songs get hard-coded lyrics instead of trusting the API.',
'landscaping by windows96 no longer shows up as a "shordie shordie" song. it\'s instrumental and it says so.'
]},
{date:'2026-10-21',type:'patch',title:'housekeeping',notes:[
'the info tab used to open completely empty on every song - it was never being called. fixed.',
'removed seven leftover voice blip files from the cube days (1.mp3 - 7.mp3), nobody was using them.'
]},
{date:'2026-10-22',type:'feature',title:'this update log',notes:[
'footer button, this book. entries are typed: patch, feature, update, music pack.',
'new entries land here every time the site changes.'
]},
{date:'2026-10-22',type:'music pack',title:'the big haul: 68 -> 114 tracks',notes:[
'forty-six new songs on the shelf.',
'tally hall & miracle musical: &, the mind electric, murders, the bidding.',
'havexy pack 2: thirteen tracks, tiktok ranters to hentai virus (yes, thats hantavirus, hes just like that).',
'the entire Bad Things OST - all 22 songs, roblox psychological horror included.',
'horror skunx: hey its me its verity + the OFFICIAL lord verity. the old lordverity file was a mashup and is now labeled "i miss the players" so nobody confuses them again.',
"also new: who? hyperbaiter! (havexy), meltdown, terrible things, outcast of the sulphurous seas, i'm talking to you!"
]},
{date:'2026-10-22',type:'patch',title:'credits where they belong',notes:[
'the nine vexy-era tracks (gypsy verity, folk valley, and all seven disstracks) now say (havexy) in the title - they were his all along.',
'the lyrics for who? hyperbaiter! are hardcoded now, the full disstrack shows every time without asking lrclib.'
]},
{date:'2026-10-22',type:'feature',title:'five new rooms',notes:[
'stats tab - total spins, top 10 tracks with bars, and recently spun history, all read straight from this browser (never uploaded).',
'credits tab - who made what, the mirror links, and a shoutout to xul and men.',
'the list now shows a spin count on every played row (×3 next to the duration), and the filter takes "recent" to sort everything by last played.',
'smooth fades - switching records dips the old one and fades the new one in instead of a hard cut, and the sleep timer fades out over a couple seconds before it pauses.',
'installable - void records can be added to your desktop as an app now, and the shell works offline once you have visited it once.'
]},
{date:'2026-10-22',type:'feature',title:'karaoke mode',notes:[
'when lrclib has timed lyrics for a song, the lyrics tab now lines up with the music - the current line lights amber and follows along as it plays.',
'same lrclib search as before, it just prefers the timed version now. songs without timing fall back to the plain text like always.',
'try it on ruler of everything or the mind electric.'
]},
{date:'2026-10-22',type:'feature',title:'achievements! 26 of them',notes:[
'a new awards tab in the record window (plus an achievements button in the footer) - progress bar, section filters, hints for the locked ones. all brand new, built for void records only.',
'four sections: the deck (spins, the whole-shelf challenge), the knobs (shuffle, loop, pitch, redline, overdrive, tone, crackle, sleep), the window (tabs, karaoke, this log, install), the shelf (favorites, recent filter, local files, havexy).',
'one of them is watching for something extremely rare crossing the screen. no hints. it sprints, it vanishes, you either saw it or you did not.',
'unlocks pop an os-style toast in the corner. everything lives in this browser, same as your stats.'
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

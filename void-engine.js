/* void engine - audio-reactive visual engine for void records
 * listens through visualizer.js's existing analyser (never creates a second
 * MediaElementSource), extracts bands/flux/centroid, detects beats + bpm,
 * emits events, and drives visual bindings through CSS custom properties.
 */
(function(){
  'use strict';

  var VE={
    version:'1.1.0',
    enabled:true,
    state:{bass:0,mid:0,high:0,energy:0,flux:0,beat:0,bpm:0,bpmConf:0,centroid:0,rate:1,pitch:1,playing:false,overdrive:0,rainbow:false,rainbowLevel:0,rainbowHue:0,loudFor:0},
    _h:{},
    on:function(ev,fn){(VE._h[ev]||(VE._h[ev]=[])).push(fn);return VE},
    off:function(ev,fn){var a=VE._h[ev];if(!a)return VE;VE._h[ev]=a.filter(function(f){return f!==fn});return VE},
    emit:function(ev,d){(VE._h[ev]||[]).forEach(function(f){try{f(d)}catch(e){}})},
    bands:function(){var s=VE.state;return{bass:s.bass,mid:s.mid,high:s.high,energy:s.energy,flux:s.flux,bpm:s.bpm,beat:s.beat,overdrive:s.overdrive,rainbow:s.rainbow,rainbowLevel:s.rainbowLevel,loudFor:s.loudFor}},
    status:function(){return{version:VE.version,enabled:VE.enabled,state:VE.state}},
    toggle:function(){VE.enabled=!VE.enabled;if(!VE.enabled)reset();VE.emit('toggle',{enabled:VE.enabled});return VE.enabled}
  };
  window.VoidEngine=VE;

  var root=document.documentElement;
  var hud=null,raf=0,last=0,applyAcc=0,prev=null,lastBeat=0,beatPulse=0;
  var energyHist=[],levelHist=[],intervals=[],silenced=false;
  var loudSince=0,quietSince=0,rainbowHue=0,ringEl=null,lastSrc='';

  function spectrum(){return typeof window.vrSpectrum==='function'?window.vrSpectrum():null}
  function pitchRatio(){return typeof window.vrPitchRatio==='function'?window.vrPitchRatio():1}

  function reset(){
    VE.state.bass=VE.state.mid=VE.state.high=VE.state.energy=0;
    VE.state.flux=VE.state.beat=VE.state.centroid=0;
    VE.state.bpm=0;VE.state.bpmConf=0;VE.state.overdrive=0;
    VE.state.rainbow=false;VE.state.rainbowLevel=0;VE.state.loudFor=0;
    beatPulse=0;loudSince=0;quietSince=0;
    document.body.classList.remove('ve-rainbow');
    ['--ve-bass','--ve-mid','--ve-high','--ve-energy','--ve-flux','--ve-beat','--ve-aura','--ve-scan',
     '--ve-hue','--ve-spin','--ve-over','--ve-rainbow','--ve-rainbow-hue']
      .forEach(function(k){root.style.setProperty(k,'0')});
    root.style.setProperty('--ve-rainbow-hue','0deg');
    root.style.setProperty('--ve-hue','0');
  }

  function ensureFx(){
    if(document.querySelector('.veAura'))return;
    var a=document.createElement('div');a.className='veAura';a.setAttribute('aria-hidden','true');
    var s=document.createElement('div');s.className='veScan';s.setAttribute('aria-hidden','true');
    ringEl=document.createElement('div');ringEl.className='veRing';ringEl.setAttribute('aria-hidden','true');
    var r=document.createElement('div');r.className='veRainbow';r.setAttribute('aria-hidden','true');
    document.body.appendChild(a);document.body.appendChild(s);
    document.body.appendChild(ringEl);document.body.appendChild(r);
    hud=document.getElementById('veHud');
  }

  function ring(){
    if(!ringEl)return;
    ringEl.style.animation='none';
    void ringEl.offsetWidth;
    ringEl.style.animation='';
    ringEl.classList.remove('go');
    void ringEl.offsetWidth;
    ringEl.classList.add('go');
  }

  function band(d,a,b){
    if(b>d.length)b=d.length;
    if(a>=b)return 0;
    var s=0;for(var i=a;i<b;i++)s+=d[i];
    return s/((b-a)*255);
  }

  function spectralCentroid(d){
    var s=0,w=0;
    for(var i=0;i<d.length;i++){s+=d[i];w+=i*d[i]}
    return s?Math.min(1,(w/s)/d.length):0;
  }

  function smooth(cur,target,dt,tau){
    var k=1-Math.exp(-dt/tau);
    return cur+(target-cur)*k;
  }

  function median(a){
    var b=a.slice().sort(function(x,y){return x-y});
    return b[Math.floor(b.length/2)];
  }

  function detectBeat(e,now){
    energyHist.push(e);
    if(energyHist.length>60)energyHist.shift();
    if(energyHist.length<18)return false;
    var avg=0,i;
    for(i=0;i<energyHist.length-1;i++)avg+=energyHist[i];
    avg/=(energyHist.length-1);
    var variance=0;
    for(i=0;i<energyHist.length-1;i++)variance+=(energyHist[i]-avg)*(energyHist[i]-avg);
    var sd=Math.sqrt(variance/(energyHist.length-1));
    var threshold=avg+Math.max(.045,sd*1.35);
    if(e>threshold&&e>avg*1.12&&now-lastBeat>320){
      var prev=lastBeat;
      lastBeat=now;
      if(prev&&now-prev<2000){
        var iv=now-prev;
        intervals.push(iv);
        if(intervals.length>14)intervals.shift();
        // short clips and sparse transients have no reliable tempo - need a
        // long, tight run of onsets before claiming a bpm at all.
        if(intervals.length>=8){
          var med=median(intervals);
          var consistent=intervals.filter(function(x){return Math.abs(x-med)<med*.12}).length;
          var conf=consistent/intervals.length;
          VE.state.bpmConf=conf;
          if(conf>=.8&&med>=330&&med<=1100){
            var bpm=60000/med;
            // real tracks sit at 60-70 bpm too - don't invent double-time.
            while(bpm<45)bpm*=2;
            VE.state.bpm=Math.round(bpm);
            VE.emit('bpm',{bpm:VE.state.bpm,confidence:conf});
          }else VE.state.bpm=0;
        }
      }
      return true;
    }
    return false;
  }

  function mix(a,b,t){return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]}

  function apply(){
    var s=VE.state;
    var m=Math.min(1,s.mid*2.4),h=Math.min(1,s.high*3.2);
    var c=mix([139,92,246],[94,230,255],m);
    c=mix(c,[255,180,58],h*.7);
    var hue=Math.max(-40,Math.min(90,Math.round((s.centroid-.18)*160+Math.log2(s.pitch||1)*22+rainbowHue*s.rainbowLevel)));
    var live=VE.enabled&&s.playing;
    root.style.setProperty('--ve-rgb',c.map(function(x){return Math.round(x)}).join(','));
    root.style.setProperty('--ve-bass',s.bass.toFixed(3));
    root.style.setProperty('--ve-mid',s.mid.toFixed(3));
    root.style.setProperty('--ve-high',s.high.toFixed(3));
    root.style.setProperty('--ve-energy',s.energy.toFixed(3));
    root.style.setProperty('--ve-flux',s.flux.toFixed(3));
    root.style.setProperty('--ve-beat',beatPulse.toFixed(3));
    root.style.setProperty('--ve-hue',String(hue));
    root.style.setProperty('--ve-aura',live?(0.05+s.energy*.38+beatPulse*.12+s.rainbowLevel*.25).toFixed(3):'0');
    root.style.setProperty('--ve-scan',live?(s.high*.28+beatPulse*.10+s.rainbowLevel*.12).toFixed(3):'0');
    root.style.setProperty('--ve-spin',live?(s.rate*8+s.centroid*14+s.rainbowLevel*30).toFixed(2):'0');
    root.style.setProperty('--ve-over',live?s.overdrive.toFixed(3):'0');
    root.style.setProperty('--ve-rainbow',live?Math.min(.88,s.rainbowLevel*(.35+s.energy*.55)).toFixed(3):'0');
    root.style.setProperty('--ve-rainbow-hue',Math.round(rainbowHue)+'deg');
    if(hud){
      hud.textContent=!VE.enabled?'void engine · off':
        (!s.playing?'void engine · idle':
          'void engine · '+(s.rainbow?'RAINBOW · ':'')+(s.bpm?s.bpm+' bpm':'listening')+' · '+Math.round(s.energy*100)+'%');
    }
  }

  function tick(now){
    raf=requestAnimationFrame(tick);
    var dt=last?Math.min(.1,(now-last)/1000):.016;
    last=now;
    if(document.hidden)return;

    var a=window.audioEl||null;
    var d=spectrum();
    var s=VE.state;
    var src=a?(a.currentSrc||a.src):'';
    if(src&&src!==lastSrc){lastSrc=src;reset();silenced=false;energyHist=[];levelHist=[];intervals=[];prev=null}
    s.playing=!!(a&&!a.paused&&!a.ended);
    s.rate=a?(a.playbackRate||1):1;
    s.pitch=pitchRatio();

    if(!VE.enabled||!d||!s.playing){
      if(VE.enabled&&!s.playing&&silenced===false){reset();silenced=true}
      applyAcc+=dt;if(applyAcc>=.05){applyAcc=0;apply()}
      return;
    }
    silenced=false;

    var bass=band(d,1,9),mid=band(d,9,34),high=band(d,34,Math.min(96,d.length));
    var flux=0,i;
    if(prev){
      for(i=0;i<d.length;i++){var diff=d[i]-prev[i];if(diff>0)flux+=diff}
      flux/=d.length*255;
    }
    prev=d.slice();

    s.bass=smooth(s.bass,bass,dt,.035);
    s.mid=smooth(s.mid,mid,dt,.07);
    s.high=smooth(s.high,high,dt,.05);
    s.flux=smooth(s.flux,flux,dt,.05);
    s.centroid=smooth(s.centroid,spectralCentroid(d),dt,.2);
    s.energy=Math.min(1,(s.bass*1.25+s.mid+s.high*.85)/3.1);
    beatPulse=Math.max(0,beatPulse-dt*4.2);
    s.beat=beatPulse;

    if(detectBeat(bass,now)){
      beatPulse=1;s.beat=1;ring();
      VE.emit('beat',{bass:bass,energy:s.energy,bpm:s.bpm});
    }

    // sustained loudness -> rainbow overdrive. baseline adapts slowly and is
    // capped, so a long loud drop can't raise the bar up to its own level.
    // intensity also counts, but only when it's actually loud - quiet intros
    // must not trip it. tuned so sinister-02 "I miss the quiet" @ ~0:54 hits.
    levelHist.push(s.energy);
    if(levelHist.length>300)levelHist.shift();
    var lavg=0;
    for(i=0;i<levelHist.length;i++)lavg+=levelHist[i];
    lavg/=(levelHist.length||1);
    var loudThreshold=Math.min(.76,Math.max(.62,lavg*.90));
    var loud=s.energy>loudThreshold || (s.energy>.30 && s.energy>lavg*1.18);
    if(loud){
      if(!loudSince)loudSince=now;
      quietSince=0;
    }else if(loudSince){
      quietSince=quietSince||now;
      loudSince=0;
    }
    s.loudFor=loudSince?(now-loudSince)/1000:0;
    if(!s.rainbow&&s.loudFor>=.12){
      s.rainbow=true;
      document.body.classList.add('ve-rainbow');
      VE.emit('rainbow',{on:true,energy:s.energy,loudFor:s.loudFor});
    }else if(s.rainbow&&quietSince&&now-quietSince>=700){
      s.rainbow=false;
      document.body.classList.remove('ve-rainbow');
      VE.emit('rainbow',{on:false,energy:s.energy});
    }
    var intensity=Math.max(0,Math.min(1,(s.energy-.40)/.45));
    var overTarget=loud?intensity:0;
    s.overdrive=smooth(s.overdrive,overTarget,dt,loud?.35:.55);
    var rainbowTarget=s.rainbow?Math.max(.40,intensity):0;
    s.rainbowLevel=smooth(s.rainbowLevel,rainbowTarget,dt,s.rainbow?.12:.55);
    if(s.rainbowLevel>.01)rainbowHue=(rainbowHue+dt*(90+s.energy*300))%360;
    s.rainbowHue=rainbowHue;

    applyAcc+=dt;
    if(applyAcc>=.033){applyAcc=0;apply()}
  }

  function boot(){
    ensureFx();
    reset();
    raf=requestAnimationFrame(tick);
  }

  document.addEventListener('keydown',function(e){
    var tag=(e.target&&e.target.tagName)||'';
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
    if(e.key==='v'||e.key==='V')VE.toggle();
  });

  if(document.body)boot();
  else document.addEventListener('DOMContentLoaded',boot);
})();

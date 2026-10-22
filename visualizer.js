var audioEl=null;
var audioCtx=null,analyser=null,freqData=null;

function initVisualizer(el){
  if(audioCtx)return;
  if(location.protocol==='file:')return;
  try{
    audioEl=el;
    audioCtx=new(window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==='suspended')audioCtx.resume().catch(function(){});
    var src=audioCtx.createMediaElementSource(el);
    analyser=audioCtx.createAnalyser();
    analyser.fftSize=256;
    analyser.smoothingTimeConstant=.82;
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
    freqData=new Uint8Array(analyser.frequencyBinCount);
    makeCrackle();
  }catch(e){}
}

var crackleGain=null;
function makeCrackle(){
  try{
    var sr=audioCtx.sampleRate;
    var buf=audioCtx.createBuffer(1,sr*3,sr);
    var d=buf.getChannelData(0);
    for(var i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*.045;
    var t=0;
    while(t<d.length){
      t+=Math.floor(Math.random()*sr*.3)+300;
      if(t>=d.length)break;
      var amp=.12+Math.random()*.32;
      var dur=Math.floor(Math.random()*350)+180;
      for(var j=0;j<dur&&t+j<d.length;j++)d[t+j]+=(Math.random()*2-1)*amp*(1-j/dur);
    }
    var s=audioCtx.createBufferSource();s.buffer=buf;s.loop=true;
    var hp=audioCtx.createBiquadFilter();hp.type='highpass';hp.frequency.value=180;
    var lp=audioCtx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=6800;
    crackleGain=audioCtx.createGain();crackleGain.gain.value=0;
    s.connect(hp);hp.connect(lp);lp.connect(crackleGain);crackleGain.connect(audioCtx.destination);
    s.start(0);
  }catch(e){}
}
window.setCrackleLevel=function(v){try{if(crackleGain)crackleGain.gain.value=v}catch(e){}};
document.addEventListener('click',function(){
  if(audioCtx&&audioCtx.state==='suspended')audioCtx.resume().catch(function(){});
  else if(!audioCtx&&audioEl)initVisualizer(audioEl);
});

function audioBands(){
  var r={bass:0,mid:0,high:0};
  if(!analyser)return r;
  analyser.getByteFrequencyData(freqData);
  var b=0,m=0,h=0;
  for(var i=0;i<10;i++)b+=freqData[i];b/=10*255;
  for(var i=10;i<40;i++)m+=freqData[i];m/=30*255;
  for(var i=40;i<64;i++)h+=freqData[i];h/=24*255;
  return{bass:b,mid:m,high:h};
}

var barsCv=document.getElementById('bars');
var barsCtx=barsCv.getContext('2d');
var wavesCv=document.getElementById('waves');
var wavesCtx=wavesCv.getContext('2d');

function fitCanvases(){
  var dpr=Math.min(window.devicePixelRatio||1,2);
  barsCv.width=barsCv.clientWidth*dpr;
  barsCv.height=barsCv.clientHeight*dpr;
  wavesCv.width=window.innerWidth*dpr;
  wavesCv.height=window.innerHeight*dpr;
  barsCtx.setTransform(dpr,0,0,dpr,0,0);
  wavesCtx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener('resize',fitCanvases);
fitCanvases();

var wavePhase=0;
var waveDefs=[
  {col:'139,92,246',  amp:34,sp:.006,ph:0,  a:.30,off:.50},
  {col:'94,230,255',  amp:26,sp:.009,ph:2.1,a:.22,off:.56},
  {col:'255,180,58',  amp:20,sp:.013,ph:4.2,a:.16,off:.44},
  {col:'139,92,246',  amp:44,sp:.004,ph:1.2,a:.24,off:.64},
  {col:'94,230,255',  amp:18,sp:.017,ph:3.3,a:.14,off:.38},
  {col:'255,180,58',  amp:30,sp:.008,ph:5.5,a:.20,off:.72}
];

function drawWaves(){
  var w=wavesCv.clientWidth,h=wavesCv.clientHeight;
  wavesCtx.clearRect(0,0,w,h);
  var bands=audioBands();
  wavePhase+=1;
  for(var k=0;k<waveDefs.length;k++){
    var d=waveDefs[k];
    wavesCtx.beginPath();
    var bandBoost=[bands.bass,bands.mid,bands.high,bands.bass,bands.high,bands.mid][k];
    var amp=d.amp+bandBoost*110;
    for(var x=0;x<=w;x+=8){
      var y=h*d.off
        +Math.sin(x*d.sp+wavePhase*d.sp*22+d.ph)*amp
        +Math.sin(x*d.sp*2.7+wavePhase*d.sp*9+d.ph*2)*amp*.35;
      if(x===0)wavesCtx.moveTo(x,y);else wavesCtx.lineTo(x,y);
    }
    wavesCtx.strokeStyle='rgba('+d.col+','+d.a+')';
    wavesCtx.lineWidth=2;
    wavesCtx.shadowBlur=14;
    wavesCtx.shadowColor='rgba('+d.col+',.6)';
    wavesCtx.stroke();
  }
  wavesCtx.shadowBlur=0;
}

function drawBars(){
  var w=barsCv.clientWidth,h=barsCv.clientHeight;
  barsCtx.clearRect(0,0,w,h);
  if(!analyser){return}
  analyser.getByteFrequencyData(freqData);
  var n=48,gap=3;
  var bw=(w-(n-1)*gap)/n;
  for(var i=0;i<n;i++){
    var v=freqData[i*2]/255;
    var bh=Math.max(2,v*h);
    var hue=i<16?'139,92,246':(i<32?'94,230,255':'255,180,58');
    barsCtx.fillStyle='rgba('+hue+','+(0.35+v*.65)+')';
    barsCtx.fillRect(i*(bw+gap),h-bh,bw,bh);
    barsCtx.fillStyle='rgba(255,255,255,.08)';
    barsCtx.fillRect(i*(bw+gap),h-bh,bw,2);
  }
}

function visualLoop(){
  drawWaves();
  drawBars();
  requestAnimationFrame(visualLoop);
}
requestAnimationFrame(visualLoop);

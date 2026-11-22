var CACHE='vr-shell-v92';
var SHELL=[
  './',
  'index.html',
  'style.css?v=17',
  'player.js?v=49',
  'discover.js?v=3',
  'visualizer.js?v=6',
  'void-engine.js?v=23',
  'tracks.js?v=2',
  'updates.js?v=5',
  'achievements.js?v=9',
  'favicon.svg',
  'havexy.svg',
  'skeleton.png',
  'manifest.json'
];

self.addEventListener('install',function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){return c.addAll(SHELL)}).then(function(){return self.skipWaiting()})
  );
});
self.addEventListener('activate',function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){return (k===CACHE||k===AUDIO_CACHE)?null:caches.delete(k)}));
    }).then(function(){return self.clients.claim()})
  );
});
var AUDIO_CACHE='vr-audio';
self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  var url=new URL(req.url);
  if(url.origin!==location.origin)return;
  var isAudio=req.destination==='audio'||/\.(mp3|wav|ogg|webm|m4a|mp4)$/i.test(url.pathname);
  if(isAudio){
    e.respondWith(caches.open(AUDIO_CACHE).then(function(ac){
      return ac.match(req).then(function(hit){
        if(hit && req.cache !== 'reload') return hit;
        return fetch(req).then(function(res){
          if(hit && res && res.ok){ ac.put(req, res.clone()); }
          return res;
        }).catch(function(){ return hit || Response.error(); });
      });
    }));
    return;
  }
  if(req.mode==='navigate'){
    e.respondWith(
      fetch(req).then(function(res){
        var copy=res.clone();
        caches.open(CACHE).then(function(c){c.put('index.html',copy)});
        return res;
      }).catch(function(){
        return caches.match('index.html');
      })
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(function(hit){
      var net=fetch(req).then(function(res){
        if(res&&res.ok){
          var copy=res.clone();
          caches.open(CACHE).then(function(c){c.put(req,copy)});
        }
        return res;
      });
      if(hit)return net.catch(function(){return hit});
      return net;
    })
  );
});


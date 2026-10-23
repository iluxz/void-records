var CACHE='vr-shell-v1';
var SHELL=[
  './',
  'index.html',
  'style.css',
  'player.js',
  'visualizer.js',
  'tracks.js',
  'updates.js',
  'favicon.svg',
  'havexy.svg',
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
      return Promise.all(keys.map(function(k){return k===CACHE?null:caches.delete(k)}));
    }).then(function(){return self.clients.claim()})
  );
});
self.addEventListener('fetch',function(e){
  var req=e.request;
  if(req.method!=='GET')return;
  var url=new URL(req.url);
  if(url.origin!==location.origin)return;
  if(req.destination==='audio')return;
  if(/\.(mp3|wav|ogg|webm|m4a|mp4)$/i.test(url.pathname))return;
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


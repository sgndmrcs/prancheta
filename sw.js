// Service worker do Prancheta publicado (modelo: o build troca ecdf80875399 pelo hash do index.html e copia este arquivo
// para a raiz do site, ao lado do index.html). Caminhos relativos ao próprio sw.js, então vale em /prancheta/.
//  - casca (index.html, manifesto e ícones) num cache por versão; versões antigas saem ao ativar
//  - página: rede primeiro (a versão nova chega), cache sem rede
//  - escudos, bandeiras e ícones (assets/): cache primeiro, gravados na primeira vez
//  - fontes do Google: cache primeiro num cache à parte, que não depende da versão
const VERSAO = 'ecdf80875399';
const PREFIXO = 'prancheta-';
const CACHE = `${PREFIXO}${VERSAO}`;
const FONTES = `${PREFIXO}fontes`;
const CASCA = ['./', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
const HOSTS_FONTES = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (e) => {
  // um por um: se um arquivo falhar (servidor que não responde a pasta com a página, por exemplo), o resto fica
  // guardado e a instalação segue; com addAll, uma falha descartava o service worker inteiro
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(CASCA.map((u) => c.add(u).catch(() => null)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIXO) && k !== CACHE && k !== FONTES).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

async function redePrimeiro(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put('./', res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req, { ignoreSearch: true })) || (await cache.match('./')) || (await cache.match('index.html')) || Promise.reject(err);
  }
}

async function cachePrimeiro(req, nome) {
  const cache = await caches.open(nome);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') await cache.put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (HOSTS_FONTES.includes(url.hostname)) { e.respondWith(cachePrimeiro(req, FONTES)); return; }
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  if (!url.pathname.startsWith(scope.pathname)) return;
  const pagina = req.mode === 'navigate' || url.pathname === scope.pathname || url.pathname.endsWith('/index.html');
  if (pagina) { e.respondWith(redePrimeiro(req)); return; }
  // versao.txt e o próprio sw.js sempre da rede
  if (url.pathname.endsWith('/versao.txt') || url.pathname.endsWith('/sw.js')) return;
  e.respondWith(cachePrimeiro(req, CACHE));
});

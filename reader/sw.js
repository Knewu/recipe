// txt리더기 오프라인 캐시 (저장소 이름의 hanjang은 예전 이름, 넣은 책을 지키려고 그대로 둠)
const VERSION = 'hanjang-v3';
const FONTS = 'hanjang-fonts';
const LIBS = 'hanjang-libs';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

const LIB_URLS = [
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
  'https://cdn.jsdelivr.net/npm/cfb@1.2.2/dist/cfb.min.js',
  'https://cdn.jsdelivr.net/npm/pako@2.1.0/dist/pako_inflate.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(Promise.all([
    caches.open(VERSION).then(c => c.addAll(CORE)),
    // 워드·한글·PDF 읽기 도구도 미리 받아 둔다 (실패해도 설치는 계속)
    caches.open(LIBS).then(c => Promise.allSettled(LIB_URLS.map(u => c.match(u).then(hit => hit || c.add(u)))))
  ]).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('hanjang-') && ![VERSION, FONTS, LIBS].includes(k)).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 글꼴과 문서 읽기 도구(워드·한글·PDF): 한 번 받으면 계속 재사용
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (isFont || url.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.open(isFont ? FONTS : LIBS).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      try { const res = await fetch(req); if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }
      catch (err) { return hit || Response.error(); }
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // 앱 파일: 캐시로 바로 열고, 인터넷이 되면 뒤에서 새 버전 받아 두기
  e.respondWith(caches.open(VERSION).then(async c => {
    const key = req.mode === 'navigate' ? './index.html' : req;
    const hit = await c.match(key);
    const net = fetch(req).then(res => { if (res.ok) c.put(key, res.clone()); return res; }).catch(() => null);
    return hit || (await net) || Response.error();
  }));
});

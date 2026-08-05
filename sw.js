/* 차트 노래방 서비스워커 — 앱 셸(정적자산) 캐시 + 설치 가능(PWA) 지원
   2026-07-31 신설: 버전 올릴 때는 VER만 바꾸면 구버전 캐시가 activate에서 자동 삭제됨
   (회사 반복 교훈: 구버전 캐시 사고 방지 — 캐시명에 버전 박아서 상시 무효화 가능하게).
   HTML/chart.json은 network-first(항상 최신 시도, 실패시만 캐시 폴백) — 차트 데이터가
   낡은 채로 굳는 사고를 막는다. YouTube/Google API는 SW가 손대지 않음(BYPASS). */
const VER = "2026.08.05a";
const CACHE = "ck-" + VER;

const BYPASS_HOSTS = ["youtube.com", "www.youtube.com", "youtube-nocookie.com", "ytimg.com",
                       "googlevideo.com", "googleapis.com", "google.com", "gstatic.com"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (BYPASS_HOSTS.some(h => u.hostname === h || u.hostname.endsWith("." + h))) return; // YT/Google API는 SW 미개입

  const isPage = u.origin === self.location.origin && (u.pathname.endsWith("/") || u.pathname.endsWith(".html"));
  const isChart = u.origin === self.location.origin && u.pathname.endsWith("chart.json");

  /* 페이지(index)·chart.json = network-first — 항상 최신 우선, 오프라인일 때만 캐시 폴백 */
  if (req.mode === "navigate" || isPage || isChart) {
    e.respondWith(
      fetch(req).then(r => {
        const c = r.clone();
        caches.open(CACHE).then(x => x.put(req, c));
        return r;
      }).catch(() => caches.match(req).then(hit => hit || (isPage ? caches.match("./") : undefined)))
    );
    return;
  }

  /* 그 외 동일 오리진 정적 자산(manifest·아이콘)은 cache-first */
  if (u.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(r => {
        if (r && r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); }
        return r;
      }))
    );
  }
});

const KITSU = "https://kitsu.io/api/edge";
const WL_KEY = "lumierezone_watchlist";
let activeGenre = null;
const GENRES = ["Action","Comedy","Drama","Fantasy","Romance","Sci-Fi","Slice of Life","Horror"];
const NAV_GENRES = ["Action","Adventure","Comedy","Drama","Fantasy","Horror","Mahou Shoujo","Mecha","Music","Mystery","Psychological","Romance","Sci-Fi","Slice of Life","Sports","Supernatural","Thriller"];
const ITEMS = {};   // every title shown on the page, by uid ("k" + Kitsu id)

/* ---------- helpers ---------- */
function scrollToId(id){ document.getElementById(id).scrollIntoView({behavior:"smooth"}); }
function getWatchlist(){
  try{
    const raw = JSON.parse(localStorage.getItem(WL_KEY)) || {};
    const out = {};
    // keep only titles saved from Kitsu (older test saves from another source are ignored)
    Object.keys(raw).forEach(k=>{ if(k.charAt(0)==="k") out[k] = raw[k]; });
    return out;
  }catch(e){ return {}; }
}
function saveWatchlist(wl){ localStorage.setItem(WL_KEY, JSON.stringify(wl)); renderWatchlist(); updateWlCount(); }
function updateWlCount(){ const n = Object.keys(getWatchlist()).length; document.getElementById("wl-count").textContent = n+" tracked"; }
function truncate(str,n){ if(!str) return ""; return str.length>n? str.slice(0,n)+"…" : str; }

/* ---------- Kitsu requests ---------- */
/* Responses are cached for 10 minutes (per browser tab) and identical requests
   that are already in flight are shared, so reloading the page does not
   spend the API's rate limit. */
const CACHE_MS = 10*60*1000;
const inflight = {};
function cacheGet(key){
  try{
    const raw = sessionStorage.getItem(key);
    if(!raw) return null;
    const obj = JSON.parse(raw);
    return (Date.now()-obj.t < CACHE_MS) ? obj.d : null;
  }catch(e){ return null; }
}
function cacheSet(key, data){
  try{ sessionStorage.setItem(key, JSON.stringify({t:Date.now(), d:data})); }catch(e){}
}

async function kitsuRequest(path, attempt=1){
  let res;
  try{
    res = await fetch(KITSU + path, { headers:{ "Accept":"application/vnd.api+json" } });
  }catch(e){
    if(attempt<2){ await new Promise(r=>setTimeout(r, 1500)); return kitsuRequest(path, attempt+1); }
    throw e;
  }
  if(!res.ok){
    if((res.status===429 || res.status===502 || res.status===503 || res.status===504) && attempt<2){
      await new Promise(r=>setTimeout(r, 1500));
      return kitsuRequest(path, attempt+1);
    }
    throw new Error("Kitsu error "+res.status);
  }
  return res.json();
}

// Returns the whole JSON:API response ({data, included}).
function kitsuJson(path){
  const key = "lz:kitsu:" + path;
  const cached = cacheGet(key);
  if(cached) return Promise.resolve(cached);
  if(inflight[key]) return inflight[key];
  inflight[key] = kitsuRequest(path).then(j=>{ cacheSet(key, j); return j; })
                                    .finally(()=>{ delete inflight[key]; });
  return inflight[key];
}
function kitsuFetch(path){ return kitsuJson(path).then(j=>j.data); }

const KITSU_STATUS = { current:"Airing", finished:"Finished", tba:"To be announced", unreleased:"Unreleased", upcoming:"Upcoming" };

function normalizeKitsu(d){
  const a = d.attributes || {};
  const t = a.titles || {};
  const pi = a.posterImage || {};
  return {
    id: d.id,
    uid: "k"+d.id,
    title: t.en || a.canonicalTitle || "Untitled",
    titleNative: t.ja_jp || "",
    image: pi.medium || pi.small || pi.large || "",
    imageLarge: pi.large || pi.original || pi.medium || "",
    score: a.averageRating ? (parseFloat(a.averageRating)/10).toFixed(1) : null,
    episodes: a.episodeCount || null,
    genres: a.subtype ? [String(a.subtype).toUpperCase()] : [],
    synopsis: a.synopsis || "",
    trailerId: a.youtubeVideoId || null,
    status: KITSU_STATUS[a.status] || a.status || null
  };
}

function register(list){ list.forEach(a=>{ ITEMS[a.uid] = a; }); return list; }

// Kitsu category slugs look like "slice-of-life" and "sci-fi".
function genreList(genre, limit){
  const slug = genre.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
  return kitsuFetch(`/anime?filter[categories]=${encodeURIComponent(slug)}&sort=-userCount&page[limit]=${limit}`)
    .then(d=>register(d.map(normalizeKitsu)));
}
function trendingList(limit){
  return kitsuFetch(`/trending/anime?limit=${limit}`).then(d=>register(d.map(normalizeKitsu)));
}
// One shared request feeds both the featured banner and the main grid.
function getList(genre){ return genre ? genreList(genre, 12) : trendingList(12); }

/* ---------- hero ---------- */
async function loadHero(){
  try{
    const list = await getList(null);
    const a = list[0];
    if(!a) throw new Error("empty");
    const hero = document.getElementById("hero");
    hero.style.backgroundImage = `url(${a.imageLarge})`;
    hero.innerHTML = `<div class="hero-inner">
      <div class="hero-eyebrow">Trending Now · ★ ${a.score ?? "—"}</div>
      <h1>${a.title}</h1>
      <div class="hero-tags">${a.genres.slice(0,3).map(g=>`<span class="tag">${g}</span>`).join("")}</div>
      <div class="hero-synopsis">${a.synopsis ? truncate(a.synopsis,220) : "No synopsis available."}</div>
      <div class="hero-actions">
        <button class="btn btn-gold" onclick="openItem('${a.uid}')">View Details</button>
        ${a.trailerId ? `<button class="btn btn-outline" onclick="openTrailer('${a.trailerId}')">▶ Watch Trailer</button>` : ""}
      </div></div>`;
  }catch(e){
    document.getElementById("hero").innerHTML = `<div class="hero-inner"><div class="error-box">Couldn't load the featured title. <button class="btn btn-outline" onclick="loadHero()">Retry</button></div></div>`;
  }
}

/* ---------- genre chips ---------- */
function loadGenres(){
  const box = document.getElementById("genre-chips");
  box.innerHTML = `<span class="chip active" data-g="" onclick="filterGenre(null,this)">All</span>` +
    GENRES.map(g=>`<span class="chip" data-g="${g}" onclick="filterGenre('${g}',this)">${g}</span>`).join("");
}
function filterGenre(genre, el){
  activeGenre = genre;
  [...document.getElementById("genre-chips").children].forEach(c=>c.classList.remove("active"));
  el.classList.add("active");
  loadSeasonal();
}

/* ---------- main grid ---------- */
async function loadSeasonal(){
  const grid = document.getElementById("seasonal-grid");
  grid.innerHTML = `<div class="skel"></div><div class="skel"></div><div class="skel"></div><div class="skel"></div>`;
  try{
    const list = await getList(activeGenre);
    renderCards(grid, list, activeGenre ? "No titles found for this genre right now." : "Nothing to show right now.");
  }catch(e){
    grid.innerHTML = `<div class="error-box">Couldn't reach the anime database. Check your connection and try again.<br><button class="btn btn-outline" onclick="loadSeasonal()">Retry</button></div>`;
  }
}

function renderCards(container, list, emptyMsg){
  if(!list.length){ container.innerHTML = `<div class="empty">${emptyMsg}</div>`; return; }
  register(list);
  container.innerHTML = list.map(a=>`
    <div class="card" onclick="openItem('${a.uid}')">
      <img loading="lazy" src="${a.image}" alt="${a.title}">
      <div class="card-body">
        <div class="card-title">${a.title}</div>
        <div class="card-meta">★ ${a.score ?? "—"} · ${a.episodes ?? "?"} ep</div>
      </div>
    </div>`).join("");
}

/* ---------- search ---------- */
let searchTimer;
document.getElementById("search-form").addEventListener("submit", e=>{ e.preventDefault(); runSearch(); });
document.getElementById("search-input").addEventListener("input", ()=>{
  clearTimeout(searchTimer);
  const q = document.getElementById("search-input").value.trim();
  if(!q){ clearSearch(); return; }
  searchTimer = setTimeout(runSearch, 500);
});
function clearSearch(){
  document.getElementById("search-input").value = "";
  document.getElementById("results-section").style.display = "none";
}
async function runSearch(){
  const q = document.getElementById("search-input").value.trim();
  if(!q) return;
  const section = document.getElementById("results-section");
  const grid = document.getElementById("results-grid");
  section.style.display = "block";
  document.getElementById("results-title").textContent = `Results for “${q}”`;
  grid.innerHTML = `<div class="skel"></div><div class="skel"></div>`;
  try{
    const d = await kitsuFetch(`/anime?filter[text]=${encodeURIComponent(q)}&page[limit]=12`);
    renderCards(grid, d.map(normalizeKitsu), `No anime found for “${q}”. Try a different title.`);
  }catch(e){
    grid.innerHTML = `<div class="error-box">Search failed — the API may be busy. <button class="btn btn-outline" onclick="runSearch()">Retry</button></div>`;
  }
  section.scrollIntoView({behavior:"smooth"});
}

/* ---------- genre dropdown (top-left nav) ---------- */
function buildGenreMenu(){
  document.getElementById("genre-menu").innerHTML =
    NAV_GENRES.map(g=>`<button onclick="browseGenre('${g}')">${g}</button>`).join("");
}
function toggleGenreMenu(e){
  e.stopPropagation();
  document.getElementById("genre-menu").classList.toggle("open");
}
document.addEventListener("click", e=>{
  if(!e.target.closest("#genre-dropdown")) document.getElementById("genre-menu").classList.remove("open");
});

async function browseGenre(genre){
  document.getElementById("genre-menu").classList.remove("open");
  document.getElementById("search-input").value = "";
  const section = document.getElementById("results-section");
  const grid = document.getElementById("results-grid");
  section.style.display = "block";
  document.getElementById("results-title").textContent = `Top ${genre} Anime`;
  grid.innerHTML = `<div class="skel"></div><div class="skel"></div><div class="skel"></div><div class="skel"></div>`;
  section.scrollIntoView({behavior:"smooth"});
  try{
    const list = await genreList(genre, 12);
    renderCards(grid, list, `No ${genre} anime found.`);
  }catch(e){
    grid.innerHTML = `<div class="error-box">Couldn't load ${genre} anime. <button class="btn btn-outline" onclick="browseGenre('${genre}')">Retry</button></div>`;
  }
}

/* ---------- detail window ---------- */
// Opens a title (also used by My List after a page reload).
async function openItem(uid){
  const item = ITEMS[uid];
  if(item) return openKitsu(item);
  document.getElementById("modal-backdrop").classList.add("open");
  document.getElementById("modal-title").textContent = "Loading…";
  try{
    const d = await kitsuFetch("/anime/"+uid.slice(1));
    const a = normalizeKitsu(d);
    ITEMS[a.uid] = a;
    openKitsu(a);
  }catch(e){
    document.getElementById("modal-title").textContent = "Couldn't load this title";
    document.getElementById("modal-synopsis").innerHTML = `Something went wrong reaching the API.<br><button class="btn btn-outline" onclick="openItem('${uid}')">Retry</button>`;
  }
}

function fillModal(a){
  document.getElementById("modal-backdrop").classList.add("open");
  document.getElementById("modal-img").src = a.imageLarge;
  document.getElementById("modal-title").textContent = a.title;
  document.getElementById("modal-jp").textContent = a.titleNative || "";
  document.getElementById("modal-tags").innerHTML = a.genres.map(g=>`<span class="tag">${g}</span>`).join("");
  document.getElementById("modal-meta").textContent = `★ ${a.score ?? "—"}  ·  ${a.episodes ?? "?"} episodes  ·  ${a.status ?? "—"}`;
  document.getElementById("modal-synopsis").textContent = a.synopsis || "No synopsis available.";
  renderModalActions(a);
}

async function openKitsu(a){
  fillModal(a);
  // Genres are not in Kitsu's list responses, so fetch them for this title (best effort).
  if(a.genresLoaded) return;
  try{
    const j = await kitsuJson(`/anime/${a.id}?include=categories`);
    const cats = (j.included || []).filter(x=>x.type==="categories").map(x=>x.attributes && x.attributes.title).filter(Boolean);
    a.genresLoaded = true;
    if(cats.length){
      a.genres = cats.slice(0,6);
      if(document.getElementById("modal-title").textContent === a.title){
        document.getElementById("modal-tags").innerHTML = a.genres.map(g=>`<span class="tag">${g}</span>`).join("");
      }
    }
  }catch(e){ /* genres are optional */ }
}
function closeModal(){ document.getElementById("modal-backdrop").classList.remove("open"); }

/* ---------- trailer lightbox ---------- */
function openTrailer(videoId){
  const backdrop = document.getElementById("trailer-backdrop");
  document.getElementById("trailer-iframe").src = `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`;
  backdrop.classList.add("open");
}
function closeTrailer(){
  document.getElementById("trailer-iframe").src = "";
  document.getElementById("trailer-backdrop").classList.remove("open");
}

/* ---------- My List ---------- */
function renderModalActions(a){
  const wl = getWatchlist();
  const inList = wl[a.uid];
  const box = document.getElementById("modal-actions");
  let html = "";
  if(a.trailerId) html += `<button class="btn btn-outline" onclick="openTrailer('${a.trailerId}')">▶ Watch Trailer</button>`;
  if(inList){
    html += `<div class="wl-progress">Progress:
      <button class="step-btn" onclick="stepProgress('${a.uid}',-1)">−</button>
      <span id="prog-${a.uid}">${inList.progress}</span> / ${inList.episodes ?? "?"}
      <button class="step-btn" onclick="stepProgress('${a.uid}',1)">+</button></div>
      <button class="btn btn-outline" onclick="removeFromList('${a.uid}')">Remove from My List</button>`;
  } else {
    html += `<button class="btn btn-gold" onclick="addToList('${a.uid}')">+ Add to My List</button>`;
  }
  html += `<span class="section-sub">Data from Kitsu</span>`;
  box.innerHTML = html;
}

function addToList(uid){
  const a = ITEMS[uid];
  if(!a) return;
  const wl = getWatchlist();
  wl[uid] = {title:a.title, image:a.image, episodes:a.episodes, progress:0};
  saveWatchlist(wl);
  renderModalActions(a);
}
function removeFromList(uid){
  const wl = getWatchlist(); delete wl[uid]; saveWatchlist(wl);
  const backdrop = document.getElementById("modal-backdrop");
  if(backdrop.classList.contains("open")) closeModal();
}
function stepProgress(uid, delta){
  const wl = getWatchlist();
  if(!wl[uid]) return;
  let p = wl[uid].progress + delta;
  if(p < 0) p = 0;
  if(wl[uid].episodes) p = Math.min(p, wl[uid].episodes);
  wl[uid].progress = p;
  saveWatchlist(wl);
  const el = document.getElementById("prog-"+uid);
  if(el) el.textContent = p;
}

function renderWatchlist(){
  const wl = getWatchlist();
  const ids = Object.keys(wl);
  const grid = document.getElementById("watchlist-grid");
  document.getElementById("wl-sub").textContent = ids.length ? `${ids.length} title${ids.length>1?"s":""} tracked` : "";
  if(!ids.length){ grid.innerHTML = `<div class="empty">Nothing here yet — search or browse above and add a title to start tracking it.</div>`; return; }
  grid.innerHTML = ids.map(id=>{
    const w = wl[id];
    return `<div class="wl-card">
      <img src="${w.image}" alt="${w.title}" onclick="openItem('${id}')" style="cursor:pointer">
      <div class="wl-info">
        <div class="card-title">${w.title}</div>
        <div class="wl-progress">
          <button class="step-btn" onclick="stepProgress('${id}',-1)">−</button>
          <span id="prog-${id}">${w.progress}</span> / ${w.episodes ?? "?"}
          <button class="step-btn" onclick="stepProgress('${id}',1)">+</button>
        </div>
      </div>
      <button class="wl-remove" onclick="removeFromList('${id}')">Remove</button>
    </div>`;
  }).join("");
}

/* ---------- init ---------- */
loadHero();
buildGenreMenu();
loadGenres();
loadSeasonal();
renderWatchlist();
updateWlCount();

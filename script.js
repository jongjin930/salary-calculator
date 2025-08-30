/* ===== 유틸 ===== */
const HEADER_OFFSET = 84;
const tagLabel = (t)=>({move:"🚐 이동",stay:"🏨 숙소",food:"🍴 식사",sight:"📍 관광",free:"🧭 자유"}[t]||t);
const pinColor = (c)=>({move:"#60a5fa",stay:"#f59e0b",food:"#ef4444",sight:"#10b981",free:"#a78bfa"}[c]||"#8b5cf6");
const gmapsSearch = (q)=>`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
function gmapsDayRoute(points){
  const P = points.map(p=>p.g).filter(Boolean);
  if(P.length===0) return '';
  if(P.length===1) return gmapsSearch(P[0]);
  const origin = encodeURIComponent(P[0]);
  const destination = encodeURIComponent(P[P.length-1]);
  const way = P.slice(1,-1).map(encodeURIComponent).join('%7C');
  const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
  const mode = `&travelmode=driving`;
  return way ? `${base}&waypoints=${way}${mode}` : `${base}${mode}`;
}

/* ===== 전역 DOM ===== */
const daysEl = document.getElementById('days');
const linksEl = document.getElementById('dayLinks');

/* ===== 상태 ===== */
let PLAN = [];                 // schedule.json으로부터 로드
const mapCache = {};           // dayId -> L.Map
const layerCache = {};         // dayId -> { groups, poly, bounds }

/* ===== 렌더 ===== */
function makeItemHTML(it, day){
  let q = it.poi || '';
  if(!q){
    const m = it.text.match(/\(([^)]+)\)/);
    if(m) q = m[1];
  }
  if(!q && day.map && day.map.length){
    const itText = (it.text||'').toLowerCase();
    const hit = day.map.find(p =>
      itText.includes((p.name||'').toLowerCase()) ||
      itText.includes((p.g||'').toLowerCase())
    );
    if(hit) q = hit.g || hit.name;
  }
  const btn = q ? ` <a class="gmaps-btn" href="${gmapsSearch(q)}" target="_blank" rel="noopener">📍 지도</a>` : '';
  return `
    <div class="item ${it.type}">
      <div class="time">${it.time||""}</div>
      <div class="desc">${it.text}${btn}</div>
      <div class="tag">${tagLabel(it.type)}</div>
    </div>`;
}

function makeDayCard(d, idx){
  const el = document.createElement('section');
  el.className = 'day'; el.id = d.id;

  // 오늘 하이라이트(브라우저 날짜 기준) — 원본 로직 준용
  const t = new Date();
  if(t.getFullYear()===2025 && (t.getMonth()+1)===10 && t.getDate()===(4+idx)) el.classList.add('is-today');

  const itemsHTML = (d.items||[]).map(it=>makeItemHTML(it, d)).join('');

  const mapSection = `
    <div class="mapwrap">
      <div class="map-toolbar">
        <button class="map-btn" data-map-toggle="${d.id}">🗺️ 오늘 지도 보기</button>
        ${(d.map && d.map.length) ? `
          <a class="map-btn" target="_blank" rel="noopener" href="${gmapsDayRoute(d.map)}">🧭 Google 지도에서 오늘 일정 보기</a>
          <button class="map-btn" data-fit="${d.id}">🔎 루트 맞춰 보기</button>
          <span style="flex:1"></span>
          <button class="map-btn" data-map-filter="${d.id}" data-cat="sight">📍 관광</button>
          <button class="map-btn" data-map-filter="${d.id}" data-cat="food">🍴 식사</button>
          <button class="map-btn" data-map-filter="${d.id}" data-cat="stay">🏨 숙소</button>
          <button class="map-btn" data-map-filter="${d.id}" data-cat="move">🚐 이동</button>
        ` : "" }
      </div>
      <div class="map" id="map-${d.id}" style="display:none"></div>
    </div>`;

  el.innerHTML = `
    <div class="dayheader">
      <div>
        <div class="daytitle">${d.date}</div>
        <div class="subtitle">${d.title}</div>
      </div>
      <span class="today-badge">오늘 일정</span>
    </div>
    <div class="items">${itemsHTML}</div>
    ${mapSection}
    <div class="notes">
      <div class="point"><b>✨ 포인트:</b> ${d.point||""}</div>
      <div class="prep"><b>🔖 준비:</b> ${d.prep||""}</div>
    </div>
  `;
  return el;
}

function renderAll(){
  daysEl.innerHTML = '';
  PLAN.forEach((d,idx)=> daysEl.appendChild(makeDayCard(d, idx)));

  linksEl.innerHTML = '';
  PLAN.forEach((d)=>{
    const a = document.createElement('a');
    a.href = `#${d.id}`;
    a.className = 'daylink';
    const [d1, d2] = (d.date||'').split(' ');
    a.innerHTML = `<span>${d1||''} <small>${d2||""}</small></span>
                   <span class="chip">${(d.title||'').includes('→')?'이동일':'일정'}</span>`;
    linksEl.appendChild(a);
  });
}

/* ===== 지도 ===== */
function initMap(dayId){
  if(mapCache[dayId]) return; // 1회 생성
  const day = PLAN.find(d=>d.id===dayId);
  const mapEl = document.getElementById('map-'+dayId);
  const map = L.map(mapEl,{zoomControl:true});
  mapCache[dayId] = map;

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19, attribution:'&copy; OpenStreetMap'
  }).addTo(map);

  const groups = {
    sight:L.layerGroup().addTo(map),
    food:L.layerGroup().addTo(map),
    stay:L.layerGroup().addTo(map),
    move:L.layerGroup().addTo(map),
    free:L.layerGroup().addTo(map)
  };
  const latlngs = [];
  const bounds = [];
  (day.map||[]).forEach(p=>{
    if(!(Number.isFinite(p.lat)&&Number.isFinite(p.lng))) return;
    const m = L.circleMarker([p.lat,p.lng], {
      radius:8, fillColor:pinColor(p.cat), color:'#111', weight:1, opacity:1, fillOpacity:.9
    }).bindPopup(`
      <b>${p.name||''}</b><br/>
      <small>${(p.cat||'').toUpperCase()}</small><br/>
      ${p.g ? `<a href="${gmapsSearch(p.g)}" target="_blank" rel="noopener">📍 Google 지도 열기</a>` : ''}
    `);
    (groups[p.cat]||groups.free).addLayer(m);
    latlngs.push([p.lat,p.lng]); bounds.push([p.lat,p.lng]);
  });

  let poly=null;
  if(latlngs.length>=2){
    poly = L.polyline(latlngs, {color:'#8b5cf6', weight:3, opacity:.7, dashArray:'6 8'}).addTo(map);
  }
  if(bounds.length) map.fitBounds(bounds,{padding:[20,20]}); else map.setView([10.775,106.7],12);
  setTimeout(()=>map.invalidateSize(),0);

  layerCache[dayId] = {groups, poly, bounds};
}

/* ===== 이벤트 위임 ===== */
document.addEventListener('click', (e)=>{
  // 지도 토글
  const t1 = e.target.closest('[data-map-toggle]');
  if(t1){
    const id = t1.getAttribute('data-map-toggle');
    const box = document.getElementById('map-'+id);
    const isOpen = box.style.display !== 'none';
    box.style.display = isOpen ? 'none' : 'block';
    if(!isOpen) initMap(id);
    return;
  }
  // 루트 맞춰 보기(경로 bounds로 맞춤)
  const t2 = e.target.closest('[data-fit]');
  if(t2){
    const id = t2.getAttribute('data-fit');
    const box = document.getElementById('map-'+id);
    if(box.style.display==='none'){ box.style.display='block'; initMap(id); }
    const map = mapCache[id]; const Ls = layerCache[id];
    if(map && Ls && Ls.bounds && Ls.bounds.length){ map.fitBounds(Ls.bounds, {padding:[20,20]}); }
    return;
  }
  // 카테고리 토글(지도 마커 on/off)
  const t3 = e.target.closest('[data-map-filter]');
  if(t3){
    const id = t3.getAttribute('data-map-filter');
    const cat = t3.getAttribute('data-cat');
    initMap(id);
    const map = mapCache[id]; const Ls = layerCache[id];
    const grp = Ls?.groups?.[cat];
    if(map && grp){
      if(map.hasLayer(grp)){ map.removeLayer(grp); t3.style.opacity=.5; }
      else{ grp.addTo(map); t3.style.opacity=1; }
    }
    return;
  }
});

/* ===== 상단 리스트 필터(텍스트 섹션) ===== */
document.addEventListener('change', (e)=>{
  const cb = e.target.closest('[data-filter]'); if(!cb) return;
  const on={}; document.querySelectorAll('[data-filter]').forEach(c=> on[c.dataset.filter]=c.checked);
  document.querySelectorAll('.item').forEach(it=>{
    const type=[...it.classList].find(c=>['move','stay','food','sight','free'].includes(c));
    it.style.display = on[type]? '' : 'none';
  });
});

/* ===== 네비 활성화 정확도 개선 ===== */
function setActiveById(id){
  [...document.querySelectorAll('#dayLinks .daylink')]
    .forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#'+id));
}
function updateActive(){
  const sections = PLAN.map(d => document.getElementById(d.id)).filter(Boolean);
  if(!sections.length) return;

  const scrollBottom = window.scrollY + window.innerHeight;
  const docBottom = document.documentElement.scrollHeight;
  if (scrollBottom >= docBottom - 2){ setActiveById(sections.at(-1).id); return; }

  const anchorY = window.scrollY + HEADER_OFFSET + (window.innerHeight * 0.30);
  let current = sections[0].id;
  for (const sec of sections){ if (sec.offsetTop <= anchorY) current = sec.id; else break; }
  setActiveById(current);
}
function setupNav(){
  document.querySelectorAll('#dayLinks .daylink').forEach(a=>{
    a.addEventListener('click', (e)=>{
      const id = a.getAttribute('href').slice(1);
      const target = document.getElementById(id); if(!target) return;
      e.preventDefault();
      setActiveById(id);
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET, behavior:'smooth' });
    });
  });
}

/* ===== 부팅: schedule.json 로드 후 렌더 ===== */
async function boot(){
  try{
    const res = await fetch('./schedule.json', {cache:'no-store'});
    if(!res.ok) throw new Error('schedule.json 불러오기 실패');
    const data = await res.json();
    PLAN = Array.isArray(data) ? data : (data.days || []);
  }catch(err){
    console.warn('schedule.json 로드 실패 → 빈 계획으로 진행', err);
    PLAN = []; // 안전모드
  }

  // 렌더
  renderAll();

  // 네비 & 스크롤 스파이
  setupNav(); updateActive();
  let ticking=false;
  window.addEventListener('scroll',()=>{ if(!ticking){ requestAnimationFrame(()=>{ updateActive(); ticking=false; }); ticking=true; }},{passive:true});
  window.addEventListener('resize', updateActive);
}
boot();

// Asia/Seoul 기준 오늘 날짜 문자열 만들기 (YYYY-MM-DD)
function todayKST() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset()*60000);
  // Asia/Seoul = UTC+9
  const kst = new Date(utc + 9*60*60000);
  return kst.toISOString().slice(0,10);
}

// 상태
let DATA = null;
let activeTypes = new Set(["이동","숙소","식사","관광","기타"]);
let today = todayKST();

// 초기화
window.addEventListener('DOMContentLoaded', async () => {
  await loadJSON();
  buildDates();
  buildDays();
  bindFilters();
  bindTodayBtn();
  updateTripDates();
  // 최초 활성화: 오늘 or 1일차
  scrollToTodayOrFirst();
  // 스크롤스파이
  window.addEventListener('scroll', onScrollSpy, {passive:true});
  window.addEventListener('resize', onScrollSpy);
});

// JSON 로드
async function loadJSON(){
  const res = await fetch('schedule.json', {cache:'no-store'});
  DATA = await res.json();
  // 안전장치
  if(!Array.isArray(DATA.days)) DATA.days = [];
  // 아이템 정렬(시간 오름차순)
  for(const d of DATA.days){
    d.items?.sort((a,b) => (a.time||'').localeCompare(b.time||''));
  }
}

// 날짜 네비 생성
function buildDates(){
  const nav = document.getElementById('dayNav');
  nav.innerHTML = '';
  DATA.days.forEach((d, idx) => {
    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.dataset.target = `day-${idx+1}`;
    btn.innerHTML = `
      <strong>D${idx+1}. ${d.label || d.date || '무제'}</strong>
      <span class="small">${d.date || ''}${d.city ? ' · '+d.city : ''}</span>
    `;
    btn.addEventListener('click', () => {
      document.getElementById(`day-${idx+1}`)?.scrollIntoView({behavior:'smooth', block:'start'});
    });
    nav.appendChild(btn);
  });
}

// 메인 카드 렌더
function buildDays(){
  const app = document.getElementById('app');
  app.innerHTML = '';
  DATA.days.forEach((d, idx) => {
    const sec = document.createElement('section');
    sec.className = 'day-card';
    sec.id = `day-${idx+1}`;
    if(d.date === today) sec.classList.add('today');
    sec.innerHTML = `
      <div class="day-head">
        <div class="day-title">D${idx+1}. ${d.label || d.date || '무제'}</div>
        <div class="day-meta">${[d.date, d.city].filter(Boolean).join(' · ')}</div>
      </div>
      <div class="items"></div>
    `;
    const wrap = sec.querySelector('.items');
    (d.items||[]).forEach(item => {
      const visible = activeTypes.has(item.type||'기타');
      const el = document.createElement('article');
      el.className = 'item';
      el.dataset.type = item.type || '기타';
      el.style.display = visible ? '' : 'none';
      el.innerHTML = `
        <div class="time">${item.time || ''}</div>
        <div class="content">
          <div class="row">
            <span class="badge" data-type="${item.type||'기타'}">${item.type||'기타'}</span>
            <span class="title">${item.title || ''}</span>
          </div>
          <div class="meta">
            ${item.location ? `📍 ${item.location}` : ''}
            ${item.duration ? ` · ⏱ ${item.duration}` : ''}
            ${item.cost ? ` · 💵 ${item.cost}` : ''}
            ${item.kidFriendly ? ` · 👶 어린이 무리없음` : ''}
          </div>
          <div class="row">
            ${item.mapLink ? `<a class="map" href="${item.mapLink}" target="_blank" rel="noreferrer">지도 열기</a>` : ''}
            ${item.note ? `<span class="meta"> · ${item.note}</span>` : ''}
          </div>
        </div>
      `;
      wrap.appendChild(el);
    });

    app.appendChild(sec);
  });
}

// 필터 바인딩
function bindFilters(){
  document.querySelectorAll('.filters input[type="checkbox"]').forEach(cb=>{
    cb.addEventListener('change', ()=>{
      const t = cb.dataset.type;
      if(cb.checked) activeTypes.add(t); else activeTypes.delete(t);
      // 표시 갱신
      document.querySelectorAll('.item').forEach(it=>{
        const show = activeTypes.has(it.dataset.type);
        it.style.display = show ? '' : 'none';
      });
    });
  });
}

// 오늘 버튼
function bindTodayBtn(){
  document.getElementById('todayBtn')?.addEventListener('click', scrollToTodayOrFirst);
}

function scrollToTodayOrFirst(){
  const todayEl = [...document.querySelectorAll('.day-card')].find(sec=>sec.classList.contains('today'));
  (todayEl || document.querySelector('.day-card'))?.scrollIntoView({behavior:'smooth', block:'start'});
}

// 상단 날짜 표시
function updateTripDates(){
  const el = document.getElementById('tripDates');
  const dates = DATA.days.map(d=>d.date).filter(Boolean);
  if(dates.length){
    el.textContent = `${dates[0]} ~ ${dates[dates.length-1]} (${DATA.days.length}일)`;
  }else{
    el.textContent = '날짜 미정';
  }
}

// 스크롤 스파이로 좌측 활성화 갱신
let ticking=false;
function onScrollSpy(){
  if(ticking) return;
  window.requestAnimationFrame(()=>{
    const cards = [...document.querySelectorAll('.day-card')];
    let activeId = '';
    const y = window.scrollY + 110; // 상단바 여유
    for(const c of cards){
      if(c.offsetTop <= y) activeId = c.id;
    }
    document.querySelectorAll('.nav-btn').forEach(btn=>{
      btn.classList.toggle('active', btn.dataset.target === activeId);
    });
    ticking=false;
  });
  ticking=true;
}

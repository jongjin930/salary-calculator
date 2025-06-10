document.addEventListener('DOMContentLoaded', () => {
  // 모드 전환
  document.getElementById('btn-simple').addEventListener('click', () => switchMode('simple'));
  document.getElementById('btn-detailed').addEventListener('click', () => switchMode('detailed'));

  // 계산 버튼
  document.getElementById('calc-simple').addEventListener('click', () => {
    clearErrors();
    const inc = parseNumber('simple-income');
    if (!validateIncome(inc, 'error-simple-income')) return;
    const fam = parseIntOr('simple-family', 1);
    const chi = parseIntOr('simple-children', 0);
    calculate(inc, 0, fam, chi);
  });
  document.getElementById('calc-detailed').addEventListener('click', () => {
    clearErrors();
    const inc = parseNumber('detailed-income');
    if (!validateIncome(inc, 'error-detailed-income')) return;
    const nox = parseNumber('detailed-nontax');
    const fam = parseIntOr('detailed-family', 1);
    const chi = parseIntOr('detailed-children', 0);
    calculate(inc, nox, fam, chi);
  });

  // 천 단위 콤마 처리
  document.querySelectorAll('input.thousands').forEach(input => {
    input.addEventListener('input', e => {
      let v = e.target.value.replace(/,/g, '').replace(/[^\d]/g, '');
      e.target.value = v ? parseInt(v, 10).toLocaleString() : '';
    });
  });
});

// 모드 전환 함수
function switchMode(mode) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.getElementById(`section-${mode}`).classList.add('active');
  document.querySelectorAll('.mode-switch button').forEach(b => b.classList.remove('active'));
  document.getElementById(`btn-${mode}`).classList.add('active');
  document.getElementById('result').classList.add('hidden');
}

// 숫자 파싱
function parseNumber(id) {
  const v = document.getElementById(id).value.replace(/,/g, '');
  return v ? parseInt(v, 10) : 0;
}
function parseIntOr(id, def) {
  const v = parseInt(document.getElementById(id).value, 10);
  return isNaN(v) ? def : v;
}

// 입력 검증
function validateIncome(val, errId) {
  if (val <= 0) {
    document.getElementById(errId).innerText = '월 총급여를 올바르게 입력하세요.';
    return false;
  }
  return true;
}
function clearErrors() {
  document.querySelectorAll('.error').forEach(e => e.innerText = '');
}

// 계산 함수
function calculate(income, nonTax, family, children) {
  // 체크박스/선택값
  const chkP = document.getElementById('chk-pension').checked;
  const chkH = document.getElementById('chk-health').checked;
  const chkC = document.getElementById('chk-care').checked;
  const chkE = document.getElementById('chk-emp').checked;
  const isDisabled = document.getElementById('chk-disabled').checked;
  const region = document.getElementById('sel-region').value;

  const taxable = Math.max(0, income - nonTax);

  // 4대 보험
  let pension = chkP && !isDisabled && region==='직장가입자'
    ? Math.floor(Math.min(Math.max(taxable, 390000), 6170000) * 0.045)
    : 0;
  let health = chkH ? Math.floor(taxable * 0.03545) : 0;
  let care   = chkC ? Math.floor(health * 0.1295) : 0;
  let emp    = (chkE && region==='직장가입자') ? Math.floor(taxable * 0.009) : 0;

  // 소득세 계산 (연간 → 월)
  const annIn = taxable * 12;
  let ded = 0;
  if (annIn <= 5000000) ded = annIn * 0.7;
  else if (annIn <= 15000000) ded = 3500000 + (annIn - 5000000) * 0.4;
  else if (annIn <= 45000000) ded = 7500000 + (annIn - 15000000) * 0.15;
  else if (annIn <= 100000000) ded = 12000000 + (annIn - 45000000) * 0.05;
  else ded = 14750000 + (annIn - 100000000) * 0.02;

  const pers = (family + 1) * 1500000;
  const baseTax = Math.max(0, annIn - Math.floor(ded) - pers);

  function bracket(b) {
    if (b <= 14000000) return b * 0.06;
    if (b <= 50000000) return b * 0.15 - 1260000;
    if (b <= 88000000) return b * 0.24 - 5760000;
    if (b <= 150000000) return b * 0.35 - 15440000;
    if (b <= 300000000) return b * 0.38 - 19940000;
    if (b <= 500000000) return b * 0.40 - 25940000;
    if (b <= 1000000000) return b * 0.42 - 35940000;
    return b * 0.45 - 65940000;
  }

  let annTax = bracket(baseTax);

  // 자녀 세액공제 (연간)
  let credit = 0;
  if (children === 1) credit = 250000;
  else if (children === 2) credit = 250000 + 300000;
  else if (children >= 3) credit = 250000 + 300000 + (children - 2) * 400000;
  annTax = Math.max(0, annTax - credit);

  const incTax = Math.floor(annTax / 12);
  const locTax = Math.floor(incTax * 0.1);

  // 실수령액
  const totalDed = pension + health + care + emp + incTax + locTax;
  const net = income - totalDed;

  // 결과 표시
  document.getElementById('result').classList.remove('hidden');
  document.getElementById('resPension').innerText    = pension.toLocaleString();
  document.getElementById('resHealth').innerText     = health.toLocaleString();
  document.getElementById('resCare').innerText       = care.toLocaleString();
  document.getElementById('resEmp').innerText        = emp.toLocaleString();
  document.getElementById('resIncomeTax').innerText  = incTax.toLocaleString();
  document.getElementById('resLocalTax').innerText   = locTax.toLocaleString();
  document.getElementById('resChildCredit').innerText= Math.floor(credit/12).toLocaleString();
  document.getElementById('resNet').innerText        = net.toLocaleString();
}

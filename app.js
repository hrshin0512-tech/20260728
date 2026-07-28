const drawButton = document.getElementById("drawButton");
const resetButton = document.getElementById("resetButton");
const historyList = document.getElementById("historyList");
const statusText = document.getElementById("statusText");
const ballStage = document.getElementById("ballStage");

const stageBalls = Array.from(ballStage.querySelectorAll(".ball"));
const numberBalls = stageBalls.slice(0, 6);
const bonusBall = stageBalls[6];

const history = [];
let isDrawing = false;

function sampleUniqueNumbers(count, max) {
  const pool = Array.from({ length: max }, (_, index) => index + 1);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function updateStage(numbers, bonus) {
  numberBalls.forEach((ball, index) => {
    ball.classList.remove("ball--active", "ball--ring", "ball--bonus");
    const val = numbers[index] ?? "?";
    ball.textContent = val;
    if (val === "?") {
      ball.classList.add("ball--ghost");
    } else {
      ball.classList.remove("ball--ghost");
    }
  });

  bonusBall.classList.remove("ball--active", "ball--ring");
  bonusBall.textContent = bonus;
  if (bonus === "B" || bonus === "?") {
    bonusBall.classList.add("ball--ghost");
    bonusBall.classList.remove("ball--bonus");
  } else {
    bonusBall.classList.remove("ball--ghost");
    bonusBall.classList.add("ball--bonus");
  }
}

function renderHistory() {
  historyList.innerHTML = "";

  if (history.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "아직 추첨 기록이 없습니다.";
    historyList.appendChild(empty);
    return;
  }

  history.forEach((entry, index) => {
    const card = document.createElement("div");
    card.className = "history-card";

    const img = document.createElement("img");
    img.className = "poster";
    // use a seed based on numbers so the image varies per draw
    const seed = entry.numbers.join("-") + `-${entry.bonus}`;
    img.src = `https://picsum.photos/seed/${encodeURIComponent(seed)}/400/600`;
    img.alt = `Draw ${index + 1}`;

    const footer = document.createElement("div");
    footer.className = "card-footer";

    const label = document.createElement("div");
    label.className = "draw-label";
    label.textContent = `${index + 1}회차`;

    const chips = document.createElement("div");
    chips.className = "chips";

    entry.numbers.forEach((number) => {
      const chip = document.createElement("span");
      chip.className = "chip-small";
      chip.textContent = number;
      chips.appendChild(chip);
    });

    const bonus = document.createElement("span");
    bonus.className = "chip-small";
    bonus.textContent = `B ${entry.bonus}`;
    chips.appendChild(bonus);

    footer.append(label, chips);
    card.append(img, footer);
    historyList.appendChild(card);
  });
}

async function drawLottery() {
  if (isDrawing) return;
  isDrawing = true;
  drawButton.disabled = true;
  resetButton.disabled = true;

  const finalNumbers = sampleUniqueNumbers(6, 45);
  const availableForBonus = Array.from({ length: 45 }, (_, i) => i + 1).filter(
    (number) => !finalNumbers.includes(number),
  );
  const bonus = availableForBonus[
    Math.floor(Math.random() * availableForBonus.length)
  ];

  statusText.textContent = "번호를 섞는 중...";

  for (let step = 0; step < finalNumbers.length; step += 1) {
    const reveal = finalNumbers.slice(0, step + 1);
    const placeholders = Array(6 - reveal.length).fill("?");
    const preview = [...reveal, ...placeholders];
    updateStage(preview, "B");

    numberBalls[step].classList.add("ball--active");
    statusText.textContent = `${step + 1}번째 번호 공개 중...`;
    await sleep(320);
    numberBalls[step].classList.remove("ball--active");
  }

  updateStage(finalNumbers, bonus);
  bonusBall.classList.add("ball--active");
  statusText.textContent = `당첨 번호: ${finalNumbers.join(", ")} / 보너스: ${bonus}`;

  history.unshift({ numbers: finalNumbers, bonus });
  history.splice(5);
  renderHistory();

  await sleep(250);
  bonusBall.classList.remove("ball--active");
  drawButton.disabled = false;
  resetButton.disabled = false;
  isDrawing = false;
}

function resetApp() {
  if (isDrawing) return;
  statusText.textContent = "추첨 버튼을 눌러 시작하세요.";
  updateStage(["?", "?", "?", "?", "?", "?"], "B");
  history.length = 0;
  renderHistory();
}

drawButton.addEventListener("click", drawLottery);
resetButton.addEventListener("click", resetApp);

renderHistory();

// --- Chatbot: 생년월일 입력 → 별자리 기반 번호 추첨 + 설명 ---
const chatForm = document.getElementById('chatForm');
const dobInput = document.getElementById('dob');
const chatDraw = document.getElementById('chatDraw');
const botResponse = document.getElementById('botResponse');
const botTitle = document.getElementById('botTitle');
const botExplanation = document.getElementById('botExplanation');

function getZodiac(month, day) {
  // month: 1-12, day: 1-31
  const z = [
    { name: '염소자리', start: [12,22], end: [1,19] },
    { name: '물병자리', start: [1,20], end: [2,18] },
    { name: '물고기자리', start: [2,19], end: [3,20] },
    { name: '양자리', start: [3,21], end: [4,19] },
    { name: '황소자리', start: [4,20], end: [5,20] },
    { name: '쌍둥이자리', start: [5,21], end: [6,21] },
    { name: '게자리', start: [6,22], end: [7,22] },
    { name: '사자자리', start: [7,23], end: [8,22] },
    { name: '처녀자리', start: [8,23], end: [9,22] },
    { name: '천칭자리', start: [9,23], end: [10,23] },
    { name: '전갈자리', start: [10,24], end: [11,22] },
    { name: '사수자리', start: [11,23], end: [12,21] }
  ];

  for (const sign of z) {
    const [sM, sD] = sign.start;
    const [eM, eD] = sign.end;
    if (sM === eM) {
      if (month === sM && day >= sD && day <= eD) return sign.name;
    } else if (sM < eM) {
      if ((month === sM && day >= sD) || (month === eM && day <= eD) || (month > sM && month < eM)) return sign.name;
    } else {
      // wraps year end, e.g., Capricorn
      if ((month === sM && day >= sD) || (month === eM && day <= eD) || month > sM || month < eM) return sign.name;
    }
  }
  return '알 수 없음';
}

function mulberry32(a) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

function sampleUniqueNumbersSeeded(count, max, seed) {
  const rnd = mulberry32(seed);
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  // Fisher-Yates shuffle using seeded RNG
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a,b) => a - b);
}

const zodiacTraits = {
  '양자리': '열정적이고 모험을 즐김',
  '황소자리': '안정적이고 실용적',
  '쌍둥이자리': '호기심 많고 소통을 즐김',
  '게자리': '감성적이고 가족 중심',
  '사자자리': '자신감 있고 극적임',
  '처녀자리': '분석적이고 꼼꼼함',
  '천칭자리': '균형감 있고 사교적',
  '전갈자리': '집중력 있고 열정적',
  '사수자리': '낙천적이고 자유로움',
  '염소자리': '야망 있고 책임감 있음',
  '물병자리': '혁신적이고 독립적',
  '물고기자리': '직관적이고 예민함'
};

function explainSelection(zodiac, numbers, dob) {
  const traits = zodiacTraits[zodiac] || '';
  // simple narrative: include birth day/month digits and trait-based note
  const [year, month, day] = dob.split('-').map(Number);
  const fromDob = [day, month];
  const overlaps = numbers.filter(n => fromDob.includes(n));
  let explanation = `${zodiac} (${traits}) 특성을 반영해 번호를 추첨했습니다.`;
  if (overlaps.length) {
    explanation += ` 생일에서 따온 숫자 ${overlaps.join(', ')} 가 포함되어 개인성을 더했습니다.`;
  } else {
    explanation += ` 생일과는 다른 조합을 선택하여 다양성을 주었습니다.`;
  }
  explanation += ` (선택 근거: 별자리 특성 → 전략적 분포 및 무작위 시드 기반)`;
  return explanation;
}

function generateByDOB(dobValue) {
  if (!dobValue) return null;
  // dobValue: yyyy-mm-dd
  const [y,m,d] = dobValue.split('-').map(Number);
  const zodiac = getZodiac(m, d);
  // derive seed from dob and zodiac string
  const seedStr = `${dobValue}-${zodiac}`;
  // simple hash to 32-bit int
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = ((seed << 5) - seed) + seedStr.charCodeAt(i);
  seed = seed >>> 0;
  const numbers = sampleUniqueNumbersSeeded(6, 45, seed + 13);
  const availableForBonus = Array.from({ length: 45 }, (_, i) => i + 1).filter(n => !numbers.includes(n));
  const rnd = mulberry32(seed + 97);
  const bonus = availableForBonus[Math.floor(rnd() * availableForBonus.length)];
  const explanation = explainSelection(zodiac, numbers, dobValue);
  return { numbers, bonus, zodiac, explanation };
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const dobValue = dobInput.value;
  if (!dobValue) return;

  // Try server-side OpenAI generation first
  try {
    const resp = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dob: dobValue })
    });
    if (resp.ok) {
      const data = await resp.json();
      updateStage(data.numbers, data.bonus);
      statusText.textContent = `당신의 별자리(${data.zodiac}) 기반 추천: ${data.numbers.join(', ')} / 보너스 ${data.bonus}`;
      history.unshift({ numbers: data.numbers, bonus: data.bonus });
      history.splice(5);
      renderHistory();
      botTitle.textContent = `${data.zodiac} 추천 결과`;
      botExplanation.textContent = data.explanation;
      botResponse.hidden = false;
      return;
    }
  } catch (err) {
    // server not available or error — fall back to local generator
    console.warn('AI endpoint failed, falling back to local generator', err);
  }

  // Fallback: local deterministic generation
  const result = generateByDOB(dobValue);
  if (!result) return;
  updateStage(result.numbers, result.bonus);
  statusText.textContent = `당신의 별자리(${result.zodiac}) 기반 추천: ${result.numbers.join(', ')} / 보너스 ${result.bonus}`;
  history.unshift({ numbers: result.numbers, bonus: result.bonus });
  history.splice(5);
  renderHistory();
  botTitle.textContent = `${result.zodiac} 추천 결과`;
  botExplanation.textContent = result.explanation;
  botResponse.hidden = false;
});

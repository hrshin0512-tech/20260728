const drawButton = document.getElementById("drawButton");
const resetButton = document.getElementById("resetButton");
const historyList = document.getElementById("historyList");
const statusText = document.getElementById("statusText");
const ballStage = document.getElementById("ballStage");
const oracleForm = document.getElementById("oracleForm");
const birthdateInput = document.getElementById("birthdateInput");
const oracleButton = document.getElementById("oracleButton");
const oracleChat = document.getElementById("oracleChat");

const stageBalls = Array.from(ballStage.querySelectorAll(".ball"));
const numberBalls = stageBalls.slice(0, 6);
const bonusBall = stageBalls[6];

const API_URL = "/api/draws";
const MAX_HISTORY = 5;

let history = [];
let isBusy = false;
let storageReady = false;

function sampleUniqueNumbers(count, max) {
  const pool = Array.from({ length: max }, (_, index) => index + 1);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

function hashString(value) {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleWithRandom(values, random) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function parseBirthdate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day, iso: value };
}

function getZodiacSign(month, day) {
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "물병자리";
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return "물고기자리";
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "양자리";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "황소자리";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 21)) return "쌍둥이자리";
  if ((month === 6 && day >= 22) || (month === 7 && day <= 22)) return "게자리";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "사자자리";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return "처녀자리";
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return "천칭자리";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 22)) return "전갈자리";
  if ((month === 11 && day >= 23) || (month === 12 && day <= 21)) return "사수자리";
  return "염소자리";
}

function formatBirthdate(value) {
  const parsed = parseBirthdate(value);
  if (!parsed) return value || "";

  return `${String(parsed.year).padStart(4, "0")}.${String(parsed.month).padStart(2, "0")}.${String(parsed.day).padStart(2, "0")}`;
}

function buildDigitSum(value) {
  return value
    .replace(/-/g, "")
    .split("")
    .reduce((sum, digit) => sum + Number(digit), 0);
}

function buildBirthdayDraw(birthdateValue) {
  const parsed = parseBirthdate(birthdateValue);
  if (!parsed) return null;

  const digitSum = buildDigitSum(parsed.iso);
  const zodiac = getZodiacSign(parsed.month, parsed.day);
  const seed = hashString(`${parsed.iso}|${digitSum}|${zodiac}`);
  const random = createSeededRandom(seed);

  const low = shuffleWithRandom(
    Array.from({ length: 15 }, (_, index) => index + 1),
    random,
  ).slice(0, 2);
  const middle = shuffleWithRandom(
    Array.from({ length: 15 }, (_, index) => index + 16),
    random,
  ).slice(0, 2);
  const high = shuffleWithRandom(
    Array.from({ length: 15 }, (_, index) => index + 31),
    random,
  ).slice(0, 2);

  const numbers = [...low, ...middle, ...high].sort((a, b) => a - b);
  const remaining = Array.from({ length: 45 }, (_, index) => index + 1).filter(
    (number) => !numbers.includes(number),
  );
  const bonus = remaining[Math.floor(random() * remaining.length)];

  return {
    mode: "birthdate",
    birthdate: parsed.iso,
    numbers,
    bonus,
    explanation: `${formatBirthdate(parsed.iso)}의 자릿수 합 ${digitSum}과 ${zodiac}의 균형감을 기준으로, 낮은 구간 ${low.join(", ")}, 중간 구간 ${middle.join(", ")}, 높은 구간 ${high.join(", ")}를 2개씩 골랐어요. 그래서 1~15, 16~30, 31~45가 고르게 섞였습니다.`,
  };
}

function formatDrawTime(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeDraw(draw = {}) {
  if (!draw || typeof draw !== "object") {
    return {
      id: null,
      numbers: [],
      bonus: NaN,
      created_at: new Date().toISOString(),
      mode: "random",
      birthdate: null,
      explanation: null,
    };
  }

  return {
    id: draw.id ?? null,
    numbers: Array.isArray(draw.numbers) ? [...draw.numbers] : [],
    bonus: Number(draw.bonus),
    created_at: draw.created_at ?? draw.createdAt ?? new Date().toISOString(),
    mode: draw.mode === "birthdate" ? "birthdate" : "random",
    birthdate: typeof draw.birthdate === "string" && draw.birthdate ? draw.birthdate : null,
    explanation:
      typeof draw.explanation === "string" && draw.explanation.trim()
        ? draw.explanation.trim()
        : null,
  };
}

async function readErrorMessage(response) {
  const text = await response.text();

  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") {
      const message = parsed.error || parsed.message || "Unknown error";
      const details = parsed.details ? `: ${parsed.details}` : "";
      return `${message}${details}`;
    }
  } catch {
    // Fall through to plain text response.
  }

  return text || `HTTP ${response.status}`;
}

function updateStage(numbers, bonus) {
  numberBalls.forEach((ball, index) => {
    ball.classList.remove("ball--ghost", "ball--active", "ball--ring");
    ball.textContent = numbers[index] ?? "?";
    ball.style.background = "linear-gradient(180deg, #f8fbff, #dce5ff)";
    ball.style.color = "#08111f";
  });

  bonusBall.classList.remove("ball--ghost", "ball--active", "ball--ring");
  bonusBall.textContent = bonus;
  bonusBall.classList.add("ball--bonus");
}

function setBusy(value) {
  isBusy = value;
  drawButton.disabled = value;
  resetButton.disabled = value;
  oracleButton.disabled = value;
  birthdateInput.disabled = value;
}

function createMessageElement(role, text) {
  const message = document.createElement("div");
  message.className = `chat-message chat-message--${role}`;

  const label = document.createElement("span");
  label.className = "chat-role";
  label.textContent = role === "user" ? "나" : "챗봇";

  const body = document.createElement("p");
  body.textContent = text;

  message.append(label, body);
  return message;
}

function appendChatMessage(role, text, meta = {}) {
  const message = createMessageElement(role, text);

  if (meta.numbers || typeof meta.bonus === "number") {
    const chips = document.createElement("div");
    chips.className = "chat-chips";

    (meta.numbers || []).forEach((number) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = number;
      chips.appendChild(chip);
    });

    if (typeof meta.bonus === "number") {
      const chip = document.createElement("span");
      chip.className = "chip chip--bonus";
      chip.textContent = `B ${meta.bonus}`;
      chips.appendChild(chip);
    }

    message.appendChild(chips);
  }

  if (meta.detail) {
    const detail = document.createElement("p");
    detail.className = "chat-detail";
    detail.textContent = meta.detail;
    message.appendChild(detail);
  }

  oracleChat.appendChild(message);
  oracleChat.scrollTop = oracleChat.scrollHeight;

  return message;
}

function renderHistory() {
  historyList.innerHTML = "";

  if (history.length === 0) {
    const empty = document.createElement("li");
    empty.className = "history-empty";
    empty.textContent = "아직 추첨 기록이 없습니다.";
    historyList.appendChild(empty);
    return;
  }

  history.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "history-entry";

    const content = document.createElement("div");
    content.className = "history-content";

    const topRow = document.createElement("div");
    topRow.className = "history-top";

    const label = document.createElement("div");
    label.className = "draw-label";
    const timestamp = formatDrawTime(entry.created_at);
    label.textContent = timestamp
      ? `${index + 1}회차 · ${timestamp}`
      : `${index + 1}회차`;

    const mode = document.createElement("span");
    mode.className = `history-mode ${
      entry.mode === "birthdate" ? "history-mode--oracle" : "history-mode--random"
    }`;
    mode.textContent = entry.mode === "birthdate" ? "생년월일 추천" : "랜덤 추첨";

    topRow.append(label, mode);

    const meta = document.createElement("div");
    meta.className = "history-meta";

    if (entry.birthdate) {
      const birthdate = document.createElement("span");
      birthdate.className = "history-badge";
      birthdate.textContent = `생년월일 ${formatBirthdate(entry.birthdate)}`;
      meta.appendChild(birthdate);
    }

    if (entry.explanation) {
      const explanation = document.createElement("p");
      explanation.className = "history-explanation";
      explanation.textContent = entry.explanation;
      meta.appendChild(explanation);
    }

    const chips = document.createElement("div");
    chips.className = "chips";

    entry.numbers.forEach((number) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = number;
      chips.appendChild(chip);
    });

    const bonus = document.createElement("span");
    bonus.className = "chip chip--bonus";
    bonus.textContent = entry.bonus;
    chips.appendChild(bonus);

    content.append(topRow, meta);
    item.append(content, chips);
    historyList.appendChild(item);
  });
}

async function fetchHistory() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const data = await response.json();
    const rows = Array.isArray(data.draws) ? data.draws.filter(Boolean) : [];
    history = rows.map(normalizeDraw).slice(0, MAX_HISTORY);
    storageReady = true;
    renderHistory();

    if (history.length > 0) {
      statusText.textContent = "Supabase 기록을 불러왔습니다.";
    } else {
      statusText.textContent = "추첨 버튼을 눌러 시작하세요.";
    }

    return true;
  } catch (error) {
    console.warn("Supabase history fetch failed:", error);
    storageReady = false;
    statusText.textContent = `Supabase 연결 실패: ${error.message}`;
    return false;
  }
}

async function saveDraw(draw) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(draw),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const data = await response.json();
  if (!data || typeof data.draw !== "object") {
    throw new Error("Supabase did not return a saved draw.");
  }

  return normalizeDraw(data.draw);
}

function buildSavedEntry(draw, savedDraw) {
  const fallbackCreatedAt = new Date().toISOString();
  return normalizeDraw({
    ...draw,
    ...savedDraw,
    created_at: savedDraw?.created_at ?? draw.created_at ?? fallbackCreatedAt,
  });
}

function formatDrawSummary(draw) {
  return `당첨 번호: ${draw.numbers.join(", ")} / 보너스: ${draw.bonus}`;
}

async function animateReveal(numbers, bonus, introText, progressPrefix) {
  statusText.textContent = introText;

  for (let step = 0; step < numbers.length; step += 1) {
    const reveal = numbers.slice(0, step + 1);
    const placeholders = Array(6 - reveal.length).fill("?");
    const preview = [...reveal, ...placeholders];
    updateStage(preview, "B");

    numberBalls[step].classList.add("ball--active");
    statusText.textContent = `${progressPrefix}${step + 1}번째 번호 공개 중...`;
    await sleep(320);
    numberBalls[step].classList.remove("ball--active");
  }

  updateStage(numbers, bonus);
  bonusBall.classList.add("ball--active");
  await sleep(250);
  bonusBall.classList.remove("ball--active");
}

async function recordDraw(draw, savedMessage, failedMessage) {
  try {
    const savedDraw = await saveDraw(draw);
    const normalized = buildSavedEntry(draw, savedDraw);
    history.unshift(normalized);
    history = history.slice(0, MAX_HISTORY);
    renderHistory();
    statusText.textContent = `${savedMessage} · 저장 완료`;
    storageReady = true;
    return { draw: normalized, saved: true };
  } catch (error) {
    console.error("Failed to save draw:", error);
    const fallback = buildSavedEntry(draw, draw);
    history.unshift(fallback);
    history = history.slice(0, MAX_HISTORY);
    renderHistory();
    statusText.textContent = `${failedMessage} · 저장 실패: ${error.message}`;
    return { draw: fallback, saved: false, error };
  }
}

async function drawLottery() {
  if (isBusy) return;
  setBusy(true);
  try {
    const finalNumbers = sampleUniqueNumbers(6, 45);
    const availableForBonus = Array.from({ length: 45 }, (_, i) => i + 1).filter(
      (number) => !finalNumbers.includes(number),
    );
    const bonus = availableForBonus[
      Math.floor(Math.random() * availableForBonus.length)
    ];

    const drawEntry = {
      mode: "random",
      numbers: finalNumbers,
      bonus,
      explanation: null,
      birthdate: null,
      created_at: new Date().toISOString(),
    };

    await animateReveal(
      finalNumbers,
      bonus,
      "번호를 섞는 중...",
      "랜덤 추첨 중... ",
    );

    await recordDraw(
      drawEntry,
      formatDrawSummary(drawEntry),
      formatDrawSummary(drawEntry),
    );
  } finally {
    setBusy(false);
  }
}

async function handleOracleSubmit(event) {
  event.preventDefault();
  if (isBusy) return;

  const recommendation = buildBirthdayDraw(birthdateInput.value);
  if (!recommendation) {
    appendChatMessage(
      "assistant",
      "생년월일 형식이 올바르지 않아요. 달력에서 다시 선택해 주세요.",
    );
    statusText.textContent = "올바른 생년월일을 선택해 주세요.";
    return;
  }

  setBusy(true);
  try {
    appendChatMessage("user", `생년월일 ${formatBirthdate(recommendation.birthdate)}`);

    await animateReveal(
      recommendation.numbers,
      recommendation.bonus,
      "생년월일을 해석하는 중...",
      "생년월일 추천 중... ",
    );

    const recordResult = await recordDraw(
      recommendation,
      `${formatDrawSummary(recommendation)} · 생년월일 추천`,
      `${formatDrawSummary(recommendation)} · 생년월일 추천`,
    );
    const savedDraw = recordResult.draw;

    appendChatMessage(
      "assistant",
      `생년월일 ${formatBirthdate(savedDraw.birthdate || recommendation.birthdate)}를 기준으로 추천했어요. ${savedDraw.explanation || recommendation.explanation}`,
      {
        numbers: savedDraw.numbers,
        bonus: savedDraw.bonus,
        detail: recordResult.saved
          ? "이 결과는 Supabase에 저장되었습니다."
          : "저장은 실패했지만, 결과는 화면에 남겼습니다.",
      },
    );
  } finally {
    setBusy(false);
  }
}

function resetApp() {
  if (isBusy) return;
  statusText.textContent = "추첨 버튼을 눌러 시작하세요.";
  updateStage(["?", "?", "?", "?", "?", "?"], "B");
}

drawButton.addEventListener("click", drawLottery);
resetButton.addEventListener("click", resetApp);
oracleForm.addEventListener("submit", handleOracleSubmit);

updateStage(["?", "?", "?", "?", "?", "?"], "B");
renderHistory();
fetchHistory();

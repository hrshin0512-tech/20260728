const drawButton = document.getElementById("drawButton");
const resetButton = document.getElementById("resetButton");
const historyList = document.getElementById("historyList");
const statusText = document.getElementById("statusText");
const ballStage = document.getElementById("ballStage");

const stageBalls = Array.from(ballStage.querySelectorAll(".ball"));
const numberBalls = stageBalls.slice(0, 6);
const bonusBall = stageBalls[6];

const API_URL = "/api/draws";
const MAX_HISTORY = 5;

let history = [];
let isDrawing = false;
let storageReady = false;

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

function formatDrawTime(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalizeDraw(draw) {
  return {
    id: draw.id ?? null,
    numbers: Array.isArray(draw.numbers) ? [...draw.numbers] : [],
    bonus: Number(draw.bonus),
    created_at: draw.created_at ?? draw.createdAt ?? new Date().toISOString(),
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

    const label = document.createElement("div");
    label.className = "draw-label";
    const timestamp = formatDrawTime(entry.created_at);
    label.textContent = timestamp
      ? `${index + 1}회차 · ${timestamp}`
      : `${index + 1}회차`;

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

    item.append(label, chips);
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
    const rows = Array.isArray(data.draws) ? data.draws : [];
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
  return normalizeDraw(data.draw);
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
  statusText.textContent = storageReady
    ? "Supabase에 저장 중..."
    : "저장 서버를 찾는 중...";

  const drawEntry = {
    numbers: finalNumbers,
    bonus,
    created_at: new Date().toISOString(),
  };

  try {
    const savedDraw = await saveDraw(drawEntry);
    history.unshift(savedDraw);
    history = history.slice(0, MAX_HISTORY);
    renderHistory();
    statusText.textContent = `당첨 번호: ${finalNumbers.join(", ")} / 보너스: ${bonus} · 저장 완료`;
    storageReady = true;
  } catch (error) {
    console.error("Failed to save draw:", error);
    history.unshift(drawEntry);
    history = history.slice(0, MAX_HISTORY);
    renderHistory();
    statusText.textContent = `당첨 번호: ${finalNumbers.join(", ")} / 보너스: ${bonus} · 저장 실패: ${error.message}`;
  }

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
}

drawButton.addEventListener("click", drawLottery);
resetButton.addEventListener("click", resetApp);

updateStage(["?", "?", "?", "?", "?", "?"], "B");
renderHistory();
fetchHistory();

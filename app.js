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
    label.textContent = `${index + 1}회차`;

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

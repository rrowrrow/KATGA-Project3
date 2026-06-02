let answer = "";
let current = "";
let attempts = 0;
let maxAttempts = 6;
let gameLocked = false;

const STORAGE_KEY = "k3wordle_simple_v1";

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("guessInput");
  const submitBtn = document.getElementById("submitGuessBtn");
  const shareBtn = document.getElementById("shareBtn");

  input.addEventListener("input", (e) => {
    if (gameLocked) return;
    current = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, answer.length || 12);
    e.target.value = current;
    updateBoard();
  });

  submitBtn.addEventListener("click", submitGuess);
  shareBtn.addEventListener("click", shareResult);

  init();
});

async function init() {
  try {
    const res = await fetch("/data/daily-k3.json", { cache: "no-store" });

    if (!res.ok) {
      throw new Error("JSON gagal dimuat. Cek /data/daily-k3.json");
    }

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error("RESPON RAW BUKAN JSON VALID:", text);
      throw new Error("Isi /data/daily-k3.json bukan JSON valid");
    }

    maxAttempts = data.maxGuesses || 6;

    const now = new Date();
    const today =
      now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, "0") + "-" +
      String(now.getDate()).padStart(2, "0");

    let todayData = null;

    if (Array.isArray(data.manualWords)) {
      todayData = data.manualWords.find(item => item.date === today);
    }

    if (!todayData) {
      if (Array.isArray(data.fallbackWords) && data.fallbackWords.length > 0) {
        const index = now.getDate() % data.fallbackWords.length;
        todayData = data.fallbackWords[index];
      } else {
        throw new Error("Tidak ada kata harian maupun fallback");
      }
    }

    if (!todayData.word) {
      throw new Error("Format word pada JSON tidak ditemukan");
    }

    answer = String(todayData.word).toUpperCase().replace(/[^A-Z]/g, "");

    if (!answer) {
      throw new Error("Word harian kosong / tidak valid");
    }

    document.getElementById("dailyTitle").textContent = `K3 Wordle (${answer.length} huruf)`;
    document.getElementById("subTitle").textContent =
      todayData.clue || todayData.message || "Tebak kata K3 hari ini.";

    document.getElementById("statusLabel").textContent = "Main";

    restoreStats();
    createBoard();
    createKeyboard();

  } catch (err) {
    console.error("INIT ERROR:", err);
    document.getElementById("dailyTitle").textContent = "ERROR";
    document.getElementById("subTitle").textContent = err.message;
    setFeedback(err.message, true);
  }
}

function createBoard() {
  const board = document.getElementById("board");
  board.innerHTML = "";

  for (let i = 0; i < maxAttempts; i++) {
    const row = document.createElement("div");
    row.className = "board-row";
    row.style.gridTemplateColumns = `repeat(${answer.length}, 1fr)`;

    for (let j = 0; j < answer.length; j++) {
      const tile = document.createElement("div");
      tile.className = "tile";
      row.appendChild(tile);
    }

    board.appendChild(row);
  }
}

function createKeyboard() {
  const keyboard = document.getElementById("keyboard");
  keyboard.innerHTML = "";

  const layouts = [
    ["Q","W","E","R","T","Y","U","I","O","P"],
    ["A","S","D","F","G","H","J","K","L"],
    ["Z","X","C","V","B","N","M"]
  ];

  layouts.forEach(keys => {
    const row = document.createElement("div");
    row.className = "keyboard-row";

    keys.forEach(k => {
      const btn = document.createElement("button");
      btn.textContent = k;
      btn.className = "key";
      btn.type = "button";
      btn.addEventListener("click", () => pressKey(k));
      row.appendChild(btn);
    });

    keyboard.appendChild(row);
  });
}

function pressKey(letter) {
  if (gameLocked) return;
  if (current.length < answer.length) {
    current += letter;
    document.getElementById("guessInput").value = current;
    updateBoard();
  }
}

function updateBoard() {
  const rows = document.querySelectorAll(".board-row");
  if (!rows[attempts]) return;

  const tiles = rows[attempts].children;

  for (let i = 0; i < answer.length; i++) {
    tiles[i].textContent = current[i] || "";
    tiles[i].className = "tile";
  }
}

function submitGuess() {
  if (gameLocked) return;

  if (current.length !== answer.length) {
    setFeedback(`Jumlah huruf harus ${answer.length}`, true);
    return;
  }

  const rows = document.querySelectorAll(".board-row");
  const tiles = rows[attempts].children;

  const used = Array(answer.length).fill(false);

  for (let i = 0; i < answer.length; i++) {
    if (current[i] === answer[i]) {
      tiles[i].classList.add("correct");
      used[i] = true;
    }
  }

  for (let i = 0; i < answer.length; i++) {
    if (tiles[i].classList.contains("correct")) continue;

    let found = false;
    for (let j = 0; j < answer.length; j++) {
      if (!used[j] && current[i] === answer[j]) {
        found = true;
        used[j] = true;
        break;
      }
    }

    if (found) {
      tiles[i].classList.add("present");
    } else {
      tiles[i].classList.add("absent");
    }
  }

  colorKeyboard(current, tiles);

  if (current === answer) {
    setFeedback("✅ BENAR!", false);
    showToast("Mantap!");
    document.getElementById("statusLabel").textContent = "Menang";
    saveStats(true);
    lockGame();
    return;
  }

  attempts++;
  current = "";
  document.getElementById("guessInput").value = "";

  if (attempts >= maxAttempts) {
    setFeedback("❌ Jawaban: " + answer, true);
    showToast("Game Over");
    document.getElementById("statusLabel").textContent = "Kalah";
    saveStats(false);
    lockGame();
  } else {
    setFeedback("Lanjut tebak...", false);
  }
}

function colorKeyboard(word, tiles) {
  const buttons = [...document.querySelectorAll(".key")];
  for (let i = 0; i < word.length; i++) {
    const btn = buttons.find(b => b.textContent === word[i]);
    if (!btn) continue;

    if (tiles[i].classList.contains("correct")) {
      btn.classList.remove("present", "absent");
      btn.classList.add("correct");
    } else if (tiles[i].classList.contains("present") && !btn.classList.contains("correct")) {
      btn.classList.remove("absent");
      btn.classList.add("present");
    } else if (
      tiles[i].classList.contains("absent") &&
      !btn.classList.contains("correct") &&
      !btn.classList.contains("present")
    ) {
      btn.classList.add("absent");
    }
  }
}

function lockGame() {
  gameLocked = true;
  document.getElementById("guessInput").disabled = true;
  document.getElementById("submitGuessBtn").disabled = true;
}

function setFeedback(msg, error = false) {
  const el = document.getElementById("feedback");
  el.textContent = msg;
  el.className = "feedback " + (error ? "error" : "good");
}

function showToast(text) {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

function saveStats(win) {
  const raw = localStorage.getItem(STORAGE_KEY);
  const stats = raw ? JSON.parse(raw) : { streak: 0, best: 0 };

  if (win) {
    stats.streak += 1;
    stats.best = Math.max(stats.best, stats.streak);
  } else {
    stats.streak = 0;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  restoreStats();
}

function restoreStats() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const stats = raw ? JSON.parse(raw) : { streak: 0, best: 0 };

  document.getElementById("streakCount").textContent = stats.streak || 0;
  document.getElementById("bestStreakCount").textContent = stats.best || 0;
}

function shareResult() {
  if (!answer) {
    showToast("Game belum siap");
    return;
  }

  const rows = [...document.querySelectorAll(".board-row")];
  const playedRows = rows.slice(0, attempts + (gameLocked ? 0 : 0));

  const lines = playedRows
    .map(row => {
      const tiles = [...row.children];
      if (!tiles.some(t => t.textContent)) return null;

      return tiles.map(tile => {
        if (tile.classList.contains("correct")) return "🟩";
        if (tile.classList.contains("present")) return "🟨";
        if (tile.classList.contains("absent")) return "⬛";
        return "⬜";
      }).join("");
    })
    .filter(Boolean);

  const text = [
    `K3 Wordle`,
    `${gameLocked && document.getElementById("statusLabel").textContent === "Menang" ? attempts : "X"}/${maxAttempts}`,
    ...lines
  ].join("\n");

  navigator.clipboard.writeText(text)
    .then(() => showToast("Hasil disalin"))
    .catch(() => showToast("Copy gagal"));
}
``
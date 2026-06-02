const STORAGE_KEY = "k3wordle_daily_v5";const STORAGE_KEY = ": "",
  answer: "",
  clue: "",
  message: "",
  category: "",
  meaning: "",
  k3Education: "",
  dailySafetyMessage: "",
  maxAttempts: 6,
  attempts: [],
  current: "",
  gameLocked: false,
  result: "playing", // playing | win | lose
  hasSharedToday: false,
  popupQueue: [],
  popupOpen: false,
  validGuessSet: new Set(),
};

const els = {};
let toastTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  collectElements();
  bindEvents();
  init();
});

function collectElements() {
  els.title = document.getElementById("dailyTitle");
  els.subTitle = document.getElementById("subTitle");
  els.statusLabel = document.getElementById("statusLabel");
  els.dateLabel = document.getElementById("dateLabel");
  els.streakCount = document.getElementById("streakCount");
  els.bestStreakCount = document.getElementById("bestStreakCount");
  els.feedback = document.getElementById("feedback");
  els.board = document.getElementById("board");
  els.keyboard = document.getElementById("keyboard");
  els.guessInput = document.getElementById("guessInput");
  els.hintLabel = document.getElementById("hintLabel");
  els.submitGuessBtn = document.getElementById("submitGuessBtn");
  els.backspaceBtn = document.getElementById("backspaceBtn");
  els.shareBtn = document.getElementById("shareBtn");
  els.helpBtn = document.getElementById("helpBtn");
  els.toast = document.getElementById("toast");

  els.modalOverlay = document.getElementById("modalOverlay");
  els.modalEyebrow = document.getElementById("modalEyebrow");
  els.modalTitle = document.getElementById("modalTitle");
  els.modalBody = document.getElementById("modalBody");
  els.modalActions = document.getElementById("modalActions");
  els.modalCloseBtn = document.getElementById("modalCloseBtn");
}

function bindEvents() {
  els.guessInput.addEventListener("input", handleInputChange);
  els.guessInput.addEventListener("keydown", handleInputKeydown);
  els.submitGuessBtn.addEventListener("click", submitGuess);
  els.backspaceBtn.addEventListener("click", removeLastChar);
  els.shareBtn.addEventListener("click", () => shareResult(false));
  els.helpBtn.addEventListener("click", openHelpModal);
  els.modalCloseBtn.addEventListener("click", closeModalAndContinue);

  els.modalOverlay.addEventListener("click", (event) => {
    if (event.target === els.modalOverlay) {
      closeModalAndContinue();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (state.popupOpen || state.gameLocked) return;

    if (event.key === "Enter") {
      submitGuess();
      return;
    }

    if (event.key === "Backspace") {
      removeLastChar();
      return;
    }

    if (/^[a-zA-Z]$/.test(event.key)) {
      if (state.current.length >= state.answer.length) return;
      state.current += event.key.toUpperCase();
      els.guessInput.value = state.current;
      renderCurrentRow();
    }
  });
}

async function init() {
  try {
    const config = await loadConfig();
    state.config = config;
    setupPuzzle(config);

    const storage = readStorage();
    ensureTodayStorage(storage);
    syncStateFromStorage(storage);

    renderStats(storage.stats);
    createBoard();
    createKeyboard();
    renderAttempts();
    syncControlState();

    queueStartupPopups();
    processPopupQueue();
  } catch (error) {
    console.error("INIT_ERROR", error);
    els.title.textContent = "Gagal memuat permainan";
    els.subTitle.textContent = error.message || "Terjadi error saat membaca data harian.";
    setFeedback(error.message || "Gagal memuat data.", true);
    els.statusLabel.textContent = "Error";
  }
}

async function loadConfig() {
  const response = await fetch(DATA_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("File daily-k3.json tidak bisa dibuka. Pastikan file ada di root repository.");
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error("Isi daily-k3.json bukan JSON yang valid.");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Format daily-k3.json tidak valid.");
  }

  return data;
}

function setupPuzzle(config) {
  const now = new Date();
  state.dateKey = formatDateKey(now);
  state.dateLabel = now.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  state.maxAttempts =
    Number.isInteger(config.maxGuesses) && config.maxGuesses > 0
      ? config.maxGuesses
      : 6;

  const todayData = getTodayWord(config, state.dateKey, now);

  if (!todayData || !todayData.word) {
    throw new Error("Kata harian tidak ditemukan. Isi manualWords atau fallbackWords terlebih dahulu.");
  }

  state.answer = normalizeWord(todayData.word);

  if (!state.answer) {
    throw new Error("Word harian kosong atau berisi karakter yang tidak valid.");
  }

  state.clue = todayData.clue || "Tebak kata K3 hari ini.";
  state.message = todayData.message || "Selalu utamakan keselamatan kerja.";
  state.category = todayData.category || "K3";
  state.meaning = todayData.meaning || "Makna kata belum diisi.";
  state.k3Education = todayData.k3Education || "Edukasi K3 belum diisi.";
  state.dailySafetyMessage =
    todayData.dailySafetyMessage ||
    todayData.message ||
    "Utamakan keselamatan dalam setiap aktivitas kerja.";

  const byLength = config.validGuessesByLength || {};
  const candidateList = byLength[String(state.answer.length)] || [];

  state.validGuessSet = new Set(
    candidateList.map(normalizeWord).filter(Boolean)
  );
  state.validGuessSet.add(state.answer);

  document.title = `K3 Wordle Harian - ${state.dateLabel}`;
  els.title.textContent = `K3 Wordle (${state.answer.length} huruf)`;
  els.subTitle.textContent = state.message;
  els.hintLabel.textContent = `Kategori: ${state.category}. Petunjuk: ${state.clue}`;
  els.dateLabel.textContent = state.dateLabel;
  els.statusLabel.textContent = "Main";
  els.guessInput.maxLength = state.answer.length;
}

function getTodayWord(config, dateKey, now) {
  if (Array.isArray(config.manualWords)) {
    const exact = config.manualWords.find((item) => item && item.date === dateKey);
    if (exact) return exact;
  }

  if (Array.isArray(config.fallbackWords) && config.fallbackWords.length > 0) {
    const index = dayOfYear(now) % config.fallbackWords.length;
    return config.fallbackWords[index];
  }

  return null;
}

function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

function createBoard() {
  els.board.innerHTML = "";

  for (let rowIndex = 0; rowIndex < state.maxAttempts; rowIndex += 1) {
    const row = document.createElement("div");
    row.className = "board-row";
    row.dataset.row = String(rowIndex);
    row.style.gridTemplateColumns = `repeat(${state.answer.length}, minmax(0, 1fr))`;

    for (let colIndex = 0; colIndex < state.answer.length; colIndex += 1) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.dataset.row = String(rowIndex);
      tile.dataset.col = String(colIndex);
      row.appendChild(tile);
    }

    els.board.appendChild(row);
  }
}

function createKeyboard() {
  const layouts = [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "⌫"],
  ];

  els.keyboard.innerHTML = "";

  layouts.forEach((layout) => {
    const row = document.createElement("div");
    row.className = "keyboard-row";

    layout.forEach((keyValue) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "key";
      button.textContent = keyValue;
      button.dataset.key = keyValue;

      if (keyValue === "ENTER" || keyValue === "⌫") {
        button.classList.add("wide");
      }

      button.addEventListener("click", () => handleVirtualKey(keyValue));
      row.appendChild(button);
    });

    els.keyboard.appendChild(row);
  });
}

function handleVirtualKey(keyValue) {
  if (state.popupOpen || state.gameLocked) return;

  if (keyValue === "ENTER") {
    submitGuess();
    return;
  }

  if (keyValue === "⌫") {
    removeLastChar();
    return;
  }

  if (state.current.length >= state.answer.length) return;

  state.current += keyValue;
  els.guessInput.value = state.current;
  renderCurrentRow();
}

function handleInputChange(event) {
  if (state.gameLocked) return;
  state.current = normalizeWord(event.target.value).slice(0, state.answer.length);
  event.target.value = state.current;
  renderCurrentRow();
}

function handleInputKeydown(event) {
  if (state.popupOpen) return;

  if (event.key === "Enter") {
    event.preventDefault();
    submitGuess();
  }
}

function removeLastChar() {
  if (state.gameLocked) return;
  state.current = state.current.slice(0, -1);
  els.guessInput.value = state.current;
  renderCurrentRow();
}

function renderAttempts() {
  state.attempts.forEach((attempt, index) => {
    paintRow(index, attempt.word, attempt.evaluation, false);
  });

  colorKeyboardFromAttempts();

  if (!state.gameLocked) {
    renderCurrentRow();
  }
}

function renderCurrentRow() {
  const nextRowIndex = state.attempts.length;
  const row = getRow(nextRowIndex);
  if (!row) return;

  [...row.children].forEach((tile, index) => {
    const char = state.current[index] || "";
    tile.textContent = char;
    tile.className = "tile";
    if (char) tile.classList.add("filled");
  });
}

function submitGuess() {
  if (state.gameLocked) {
    showToast("Puzzle hari ini sudah terkunci.");
    return;
  }

  const guess = normalizeWord(state.current);

  if (guess.length !== state.answer.length) {
    setFeedback(`Jumlah huruf harus ${state.answer.length}.`, true);
    return;
  }

  if (state.validGuessSet.size > 0 && !state.validGuessSet.has(guess)) {
    setFeedback("Kata tidak ada dalam daftar valid yang kamu masukkan.", true);
    showToast("Kata tidak valid.");
    return;
  }

  const evaluation = evaluateGuess(guess, state.answer);
  const attempt = { word: guess, evaluation };
  state.attempts.push(attempt);

  paintRow(state.attempts.length - 1, guess, evaluation, true);
  colorKeyboardFromAttempts();

  state.current = "";
  els.guessInput.value = "";

  const storage = readStorage();
  ensureTodayStorage(storage);

  storage.daily[state.dateKey] = {
    date: state.dateKey,
    result: "playing",
    locked: false,
    attempts: state.attempts,
    hasShared: state.hasSharedToday,
    hasShownEducationPopup: false,
  };

  if (guess === state.answer) {
    finishGame("win", storage);
    return;
  }

  if (state.attempts.length >= state.maxAttempts) {
    finishGame("lose", storage);
    return;
  }

  saveStorage(storage);
  setFeedback("Lanjut, cek petunjuk warna dan tebak lagi.", false);
}

function evaluateGuess(guess, answer) {
  const result = Array.from({ length: answer.length }, () => "absent");
  const used = Array(answer.length).fill(false);

  for (let i = 0; i < guess.length; i += 1) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
      used[i] = true;
    }
  }

  for (let i = 0; i < guess.length; i += 1) {
    if (result[i] === "correct") continue;

    for (let j = 0; j < answer.length; j += 1) {
      if (!used[j] && guess[i] === answer[j]) {
        result[i] = "present";
        used[j] = true;
        break;
      }
    }
  }

  return result;
}

function paintRow(rowIndex, word, evaluation, animate = true) {
  const row = getRow(rowIndex);
  if (!row) return;

  [...row.children].forEach((tile, colIndex) => {
    tile.textContent = word[colIndex] || "";
    tile.className = "tile";

    if (word[colIndex]) tile.classList.add("filled");
    if (evaluation[colIndex]) tile.classList.add(evaluation[colIndex]);

    if (animate) {
      tile.classList.remove("reveal");
      void tile.offsetWidth;
      tile.classList.add("reveal");
    }
  });
}

function colorKeyboardFromAttempts() {
  const priority = { absent: 1, present: 2, correct: 3 };
  const bestByLetter = {};

  state.attempts.forEach((attempt) => {
    attempt.word.split("").forEach((char, index) => {
      const status = attempt.evaluation[index];
      const currentPriority = bestByLetter[char] ? priority[bestByLetter[char]] : 0;
      if (priority[status] > currentPriority) {
        bestByLetter[char] = status;
      }
    });
  });

  document.querySelectorAll(".key").forEach((button) => {
    const key = button.dataset.key || "";
    if (key.length !== 1) return;

    button.classList.remove("correct", "present", "absent");
    const status = bestByLetter[key];
    if (status) button.classList.add(status);
  });
}

function finishGame(type, storage) {
  state.result = type;
  state.gameLocked = true;

  const isWin = type === "win";

  const previousTodayData = storage.daily[state.dateKey] || {};
  storage.daily[state.dateKey] = {
    date: state.dateKey,
    result: type,
    locked: true,
    attempts: state.attempts,
    completedAt: new Date().toISOString(),
    hasShared: state.hasSharedToday,
    hasShownEducationPopup: previousTodayData.hasShownEducationPopup || false,
  };

  storage.stats = updateStats(storage.stats, state.dateKey, isWin);
  saveStorage(storage);

  renderStats(storage.stats);
  syncControlState();
  colorKeyboardFromAttempts();

  if (isWin) {
    els.statusLabel.textContent = "Menang";
    setFeedback(`Benar! Kata hari ini adalah ${state.answer}.`, false);
    showToast("Mantap, tebakan benar!");

    // Popup edukasi setelah jawaban benar
    enqueueWinEducationPopup();
    storage.daily[state.dateKey].hasShownEducationPopup = true;
    saveStorage(storage);
  } else {
    els.statusLabel.textContent = "Kalah";
    setFeedback(`Kesempatan habis. Jawaban hari ini: ${state.answer}.`, true);
    showToast("Kesempatan habis.");
  }

  enqueueResultPopup(isWin);
  processPopupQueue();
}

function enqueueWinEducationPopup() {
  state.popupQueue.push({
    eyebrow: "Edukasi Hari Ini",
    title: `Makna Kata: ${state.answer}`,
    body: `
      <p><strong>Makna kata:</strong><br>${escapeHtml(state.meaning)}</p>
      <p><strong>Edukasi K3 terkait:</strong><br>${escapeHtml(state.k3Education)}</p>
      <p><strong>Pesan keselamatan harian:</strong><br>${escapeHtml(state.dailySafetyMessage)}</p>
    `,
    actions: [
      { label: "Lanjut", variant: "primary", onClick: closeModalAndContinue }
    ],
  });
}

function updateStats(stats = defaultStats(), dateKey, win) {
  const nextStats = {
    streak: Number(stats.streak || 0),
    best: Number(stats.best || 0),
    lastWinDate: stats.lastWinDate || null,
  };

  if (!win) {
    nextStats.streak = 0;
    return nextStats;
  }

  if (nextStats.lastWinDate === dateKey) {
    return nextStats;
  }

  const previousDate = subtractDays(dateKey, 1);

  if (nextStats.lastWinDate === previousDate) {
    nextStats.streak += 1;
  } else {
    nextStats.streak = 1;
  }

  nextStats.lastWinDate = dateKey;
  nextStats.best = Math.max(nextStats.best, nextStats.streak);

  return nextStats;
}

function renderStats(stats) {
  els.streakCount.textContent = String(stats.streak || 0);
  els.bestStreakCount.textContent = String(stats.best || 0);
}

function syncControlState() {
  els.guessInput.disabled = state.gameLocked;
  els.submitGuessBtn.disabled = state.gameLocked;
  els.backspaceBtn.disabled = state.gameLocked;

  if (state.gameLocked && state.result === "win") {
    els.statusLabel.textContent = "Menang";
  } else if (state.gameLocked && state.result === "lose") {
    els.statusLabel.textContent = "Kalah";
  } else if (state.gameLocked) {
    els.statusLabel.textContent = "Terkunci";
  } else {
    els.statusLabel.textContent = "Main";
  }
}

function queueStartupPopups() {
  const introKey = `k3wordle_intro_seen_${state.dateKey}`;
  const introSeen = sessionStorage.getItem(introKey) === "1";

  if (!introSeen) {
    state.popupQueue.push({
      eyebrow: "Panduan",
      title: "Cara main K3 Wordle",
      body: `
        <p>Tebak kata K3 harian dalam maksimal <strong>${state.maxAttempts}</strong> percobaan.</p>
        <ul>
          <li><strong>Hijau</strong>: huruf benar dan posisi benar.</li>
          <li><strong>Kuning</strong>: huruf ada, tapi posisi belum tepat.</li>
          <li><strong>Abu</strong>: huruf tidak ada di jawaban.</li>
          <li><strong>Validasi kata</strong>: tebakan harus ada di daftar kata valid yang kamu isi manual di <code>daily-k3.json</code>.</li>
        </ul>
        <p>Jika berhasil, akan muncul popup edukasi tentang makna kata dan pesan K3 hari ini.</p>
      `,
      actions: [
        {
          label: "Siap main",
          variant: "primary",
          onClick: () => {
            sessionStorage.setItem(introKey, "1");
            closeModalAndContinue();
          },
        },
      ],
    });
  }

  if (state.config && state.config.showDailyMessageOnLoad) {
    state.popupQueue.push({
      eyebrow: "Pesan Harian",
      title: state.category,
      body: `
        <p><strong>Petunjuk:</strong> ${escapeHtml(state.clue)}</p>
        <p>${escapeHtml(state.message)}</p>
      `,
      actions: [{ label: "Lanjut", variant: "primary", onClick: closeModalAndContinue }],
    });
  }

  if (state.gameLocked) {
    const storage = readStorage();
    const todayData = storage.daily[state.dateKey];

    if (
      todayData &&
      todayData.result === "win" &&
      !todayData.hasShownEducationPopup
    ) {
      enqueueWinEducationPopup();
      todayData.hasShownEducationPopup = true;
      saveStorage(storage);
    }

    enqueueResultPopup(state.result === "win", true);
  }
}

function enqueueResultPopup(isWin, fromRestore = false) {
  const sharePreview = buildShareText();

  state.popupQueue.push({
    eyebrow: isWin ? "Hasil Hari Ini" : "Puzzle Selesai",
    title: isWin ? "Selamat, jawaban benar!" : "Puzzle hari ini selesai",
    body: `
      <p>${
        isWin
          ? "Kerja bagus, kamu berhasil menyelesaikan puzzle K3 hari ini."
          : "Kesempatan hari ini sudah habis. Tidak apa, lanjut lagi besok!"
      }</p>
      <p><strong>Daily lock aktif</strong> sampai puzzle berikutnya tersedia.</p>
      <div class="share-preview">${escapeHtml(buildShareText())}</div>
      <p>${
        fromRestore
          ? "Status ini dipulihkan dari progress yang tersimpan di browser."
          : "Hasil ini sudah siap dibagikan ke grup atau dicopy ke clipboard."
      }</p>
    `,
    actions: [
      { label: "Copy hasil", variant: "secondary", onClick: () => shareResult(true) },
      { label: "Tutup", variant: "primary", onClick: closeModalAndContinue },
    ],
  });
}

function openHelpModal() {
  showModal({
    eyebrow: "Bantuan",
    title: "Fitur yang sudah didukung",
    body: `
      <ul>
        <li>Kata harian manual dari <code>manualWords</code>.</li>
        <li>Validasi tebakan manual dari <code>validGuessesByLength</code>.</li>
        <li>Popup berurutan (panduan → pesan harian → edukasi kemenangan → hasil akhir).</li>
        <li>Daily lock setelah menang atau kalah.</li>
        <li>Share harian dalam format emoji.</li>
        <li>Streak dan best streak berbasis tanggal menang.</li>
      </ul>
    `,
    actions: [{ label: "Tutup", variant: "primary", onClick: closeModalAndContinue }],
    skipQueue: true,
  });
}

function processPopupQueue() {
  if (state.popupOpen || state.popupQueue.length === 0) return;
  const nextPopup = state.popupQueue.shift();
  showModal(nextPopup);
}

function showModal({ eyebrow, title, body, actions = [], skipQueue = false }) {
  if (state.popupOpen && !skipQueue) return;

  state.popupOpen = true;
  els.modalEyebrow.textContent = eyebrow || "Info";
  els.modalTitle.textContent = title || "Informasi";
  els.modalBody.innerHTML = body || "";
  els.modalActions.innerHTML = "";

  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `modal-btn ${action.variant === "secondary" ? "secondary" : "primary"}`;
    button.textContent = action.label;
    button.addEventListener("click", action.onClick);
    els.modalActions.appendChild(button);
  });

  if (!actions.length) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "modal-btn primary";
    button.textContent = "Tutup";
    button.addEventListener("click", closeModalAndContinue);
    els.modalActions.appendChild(button);
  }

  els.modalOverlay.classList.remove("hidden");
  els.modalOverlay.setAttribute("aria-hidden", "false");
}

function closeModalAndContinue() {
  els.modalOverlay.classList.add("hidden");
  els.modalOverlay.setAttribute("aria-hidden", "true");
  state.popupOpen = false;
  processPopupQueue();
}

async function shareResult(fromModalButton = false) {
  if (!state.answer) {
    showToast("Game belum siap.");
    return;
  }

  if (state.attempts.length === 0) {
    showToast("Mainkan dulu minimal satu tebakan.");
    return;
  }

  const text = buildShareText();

  try {
    if (navigator.share && !fromModalButton) {
      await navigator.share({
        title: `K3 Wordle ${state.dateLabel}`,
        text,
      });
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      fallbackCopyText(text);
    }

    state.hasSharedToday = true;

    const storage = readStorage();
    ensureTodayStorage(storage);

    if (storage.daily[state.dateKey]) {
      storage.daily[state.dateKey].hasShared = true;
      saveStorage(storage);
    }

    showToast("Hasil harian berhasil disalin.");
  } catch (error) {
    console.error("SHARE_ERROR", error);
    showToast("Gagal membagikan hasil.");
  }
}

function buildShareText() {
  let score = state.attempts.length;

  if (state.gameLocked && state.result === "win") {
    score = state.attempts.length;
  } else if (state.gameLocked && state.result === "lose") {
    score = "X";
  }

  const lines = state.attempts.map((attempt) =>
    attempt.evaluation.map(mapEmoji).join("")
  );

  return [
    `K3 Wordle | ${state.dateKey}`,
    `${score}/${state.maxAttempts}`,
    ...lines,
    `Streak: ${els.streakCount.textContent}`,
  ].join("\n");
}

function mapEmoji(status) {
  if (status === "correct") return "🟩";
  if (status === "present") return "🟨";
  return "⬛";
}

function fallbackCopyText(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultStorage();

    const parsed = JSON.parse(raw);

    return {
      stats: { ...defaultStats(), ...(parsed.stats || {}) },
      daily: typeof parsed.daily === "object" && parsed.daily ? parsed.daily : {},
    };
  } catch (error) {
    console.warn("STORAGE_READ_ERROR", error);
    return defaultStorage();
  }
}

function saveStorage(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function defaultStorage() {
  return {
    stats: defaultStats(),
    daily: {},
  };
}

function defaultStats() {
  return {
    streak: 0,
    best: 0,
    lastWinDate: null,
  };
}

function ensureTodayStorage(storage) {
  if (!storage.daily[state.dateKey]) {
    storage.daily[state.dateKey] = {
      date: state.dateKey,
      result: "playing",
      locked: false,
      attempts: [],
      hasShared: false,
      hasShownEducationPopup: false,
    };
    saveStorage(storage);
  }
}

function syncStateFromStorage(storage) {
  const today = storage.daily[state.dateKey] || {
    attempts: [],
    result: "playing",
    locked: false,
    hasShared: false,
    hasShownEducationPopup: false,
  };

  state.attempts = Array.isArray(today.attempts) ? today.attempts : [];
  state.result = today.result || "playing";
  state.gameLocked = Boolean(today.locked);
  state.hasSharedToday = Boolean(today.hasShared);
  state.current = "";

  if (state.gameLocked && state.result === "win") {
    setFeedback(`Puzzle hari ini sudah selesai. Kata: ${state.answer}.`, false);
  } else if (state.gameLocked && state.result === "lose") {
    setFeedback(`Puzzle hari ini terkunci. Jawaban: ${state.answer}.`, true);
  } else if (state.attempts.length > 0) {
    setFeedback("Progress harian dipulihkan.", false);
  } else {
    setFeedback("Mulai tebak kata K3 hari ini.", false);
  }
}

function getRow(rowIndex) {
  return els.board.querySelector(`.board-row[data-row="${rowIndex}"]`);
}

function setFeedback(message, error = false) {
  els.feedback.textContent = message;
  els.feedback.className = `feedback ${error ? "error" : "good"}`;
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2200);
}

function normalizeWord(value) {
  return String(value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z]/g, "");
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function subtractDays(dateKey, days) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() - days);
  return formatDateKey(date);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
const DATA_URL = "./daily-k3.json";

const state = {
  config: null,
  dateKey: "",

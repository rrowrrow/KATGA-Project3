const DATA_URL = "./daily-k3.json";

let answer = "";
let attempts = [];
let current = "";
let max = 6;
let locked = false;

let state = JSON.parse(localStorage.getItem("k3")) || {
  streak: 0,
  best: 0,
  lastWin: null,
  daily: {}
};

const today = new Date().toISOString().slice(0,10);

init();

async function init() {
  const res = await fetch(DATA_URL);
  const data = await res.json();

  let todayData = data.manualWords.find(x => x.date === today) ||
                  data.fallbackWords[new Date().getDate() % data.fallbackWords.length];

  answer = todayData.word.toUpperCase();

  if (!state.daily[today]) {
    state.daily[today] = {
      attempts: [],
      locked: false,
      win: false
    };
  }

  attempts = state.daily[today].attempts;
  locked = state.daily[today].locked;

  render();
  showIntro(todayData);
}

function render() {
  document.getElementById("streak").textContent = state.streak;
  document.getElementById("best").textContent = state.best;

  const board = document.getElementById("board");
  board.innerHTML = "";

  attempts.forEach(a => {
    const row = document.createElement("div");
    row.className = "row";

    a.eval.forEach(e => {
      const t = document.createElement("div");
      t.className = "tile " + e;
      t.textContent = e.letter;
      row.appendChild(t);
    });

    board.appendChild(row);
  });
}

document.getElementById("submit").onclick = () => {
  if (locked) return;

  const input = document.getElementById("input");
  const word = input.value.toUpperCase();

  if (word.length !== answer.length) return;

  const evals = [];

  for (let i=0;i<word.length;i++) {
    let status = "absent";
    if (word[i] === answer[i]) status = "correct";
    else if (answer.includes(word[i])) status = "present";

    evals.push({letter: word[i], type:status});
  }

  attempts.push({word, eval: evals});

  if (word === answer) finish(true);
  else if (attempts.length >= max) finish(false);

  save();
  render();
  input.value = "";
};

function finish(win) {
  locked = true;
  state.daily[today].locked = true;
  state.daily[today].win = win;

  if (win) {
    state.streak++;
    state.best = Math.max(state.best, state.streak);
    showModal("Menang!", "Kamu berhasil 🎉");
  } else {
    state.streak = 0;
    showModal("Kalah", "Jawaban: " + answer);
  }
}

function save() {
  state.daily[today].attempts = attempts;
  localStorage.setItem("k3", JSON.stringify(state));
}

document.getElementById("shareBtn").onclick = () => {
  let text = "K3 Wordle\n";

  attempts.forEach(a=>{
    let line = "";
    a.eval.forEach(e=>{
      if (e.type=="correct") line+="🟩";
      else if (e.type=="present") line+="🟨";
      else line+="⬛";
    });
    text += line+"\n";
  });

  navigator.clipboard.writeText(text);
  alert("Copied ✅");
};

function showModal(title,text) {
  const modal = document.getElementById("modal");
  modal.classList.remove("hidden");

  document.getElementById("modalTitle").textContent = title;
  document.getElementById("modalText").textContent = text;

  document.getElementById("modalBtn").onclick=()=>{
    modal.classList.add("hidden");
  };
}

function showIntro(data) {
  showModal("Petunjuk", data.clue + "\n\n" + data.message);
}

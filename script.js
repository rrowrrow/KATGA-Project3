let data;
async function loadData() {let answer;
  const res = await fetch("data.json");
  data = await res.json();

  const today = data.manualWords[0]; // beta: ambil 1 saja

  document.getElementById("messageText").innerText = today.message;
  document.getElementById("hintText").innerText = "Hint: " + today.hint;

  answer = today.word.toUpperCase();
}

loadData();

// tombol checkbox
document.getElementById("confirmRead").addEventListener("change", function() {
  document.getElementById("startBtn").disabled = !this.checked;
});

// mulai game
document.getElementById("startBtn").onclick = function() {
  document.getElementById("messageBox").classList.add("hidden");
  document.getElementById("gameBox").classList.remove("hidden");
};

function submitGuess() {
  const input = document.getElementById("guessInput").value.toUpperCase();

  if (input.length !== answer.length) {
    document.getElementById("feedback").innerText = "Jumlah huruf salah";
    return;
  }

  if (input !== answer) {
    document.getElementById("feedback").innerText = "Belum tepat, coba lagi";
    return;
  }

  showPopup();
}

function showPopup() {
  const today = data.manualWords[0];

  document.getElementById("popupTitle").innerText = "✅ Benar: " + today.word;
  document.getElementById("popupBody").innerHTML =
    "<b>Makna:</b> " + today.meaning + "<br><br>" +
    "<b>Edukasi:</b> " + today.k3Education + "<br><br>" +
    "<b>Pesan:</b> " + today.dailySafetyMessage;

  document.getElementById("popup").classList.remove("hidden");
}

function closePopup() {
  document.getElementById("popup").classList.add("hidden");
}

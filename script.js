function generateJSON() {
  const data = {
    date: document.getElementById("date").value,
    word: document.getElementById("word").value.toUpperCase(),
    category: document.getElementById("category").value,
    hint: document.getElementById("hint").value,
    message: document.getElementById("message").value,
    fullMessage: document.getElementById("fullMessage").value,
    meaning: document.getElementById("meaning").value,
    k3Education: document.getElementById("k3Education").value,
    dailySafetyMessage: document.getElementById("dailyMessage").value
  };

  const json = JSON.stringify(data, null, 2);

  document.getElementById("output").value = json;
}

function copyJSON() {
  const output = document.getElementById("output");
  output.select();
  document.execCommand("copy");
  alert("Copied!");
}

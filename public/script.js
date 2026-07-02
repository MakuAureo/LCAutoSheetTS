// ── Chart setup ──────────────────────────────────────────

//Chart.defaults.font.family = 'Share Tech Mono';
//Chart.defaults.font.size = 14;

/*const topChart = new Chart(document.getElementById("top-chart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Last 10 days",
        data: [],
        borderColor: "#79c0ff",
        backgroundColor: "rgba(121,192,255,0.1)",
        cubicInterpolationMode: 'monotone',
        tension: 0.3,
        fill: true
      },
      {
        label: "Life-Time Average",
        data: [],
        borderColor: "rgba(255,255,255,0.4)",
        borderDash: [6, 4],
        pointRadius: 0.1,
        fill: false
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
        labels: { color: "rgba(255,255,255,0.5)" }
      }
    },
    scales: {
      x: {
        ticks: { color: "rgba(255,255,255,0.4)" }
      },
      y: {
        suggestedMin: 1000,
        suggestedMax: 2000,
        ticks: { color: "rgba(255,255,255,0.4)" }
      }
    }
  }
});

const bottomChart = new Chart(document.getElementById("bottom-chart"), {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Last 10 days played",
        data: [],
        borderColor: "#4ade80",
        backgroundColor: "rgba(74,222,128,0.1)",
        cubicInterpolationMode: 'monotone',
        tension: 0.3,
        fill: true
      },
      {
        label: "Life-Time Average",
        data: [],
        borderColor: "rgba(255,255,255,0.4)",
        borderDash: [6, 4],
        fill: false
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
        labels: { color: "rgba(255,255,255,0.5)" }
      }
    },
    scales: {
      x: {
        ticks: { color: "rgba(255,255,255,0.4)" }
      },
      y: {
        suggestedMin: 1000,
        suggestedMax: 2000,
        ticks: { color: "rgba(255,255,255,0.4)" }
      }
    }
  }
});
*/
async function loadFilterAndRefreshTopChart() {
  const res = await fetch("/stats/filters");
  const { players, versions, moons } = await res.json();

  const prev = {
    players: document.getElementById("filter-players").value,
    version: document.getElementById("filter-version").value,
    moon:    document.getElementById("filter-moon").value,
  };

  populate("filter-players", players);
  populate("filter-version", versions);
  populate("filter-moon",    moons);

  // Restore previous selections if they still exist in the new options
  if (prev.players) document.getElementById("filter-players").value = prev.players;
  if (prev.version) document.getElementById("filter-version").value = prev.version;
  if (prev.moon)    document.getElementById("filter-moon").value    = prev.moon;

  await refreshTopChart();
}

function populate(id, values) {
  const el = document.getElementById(id);
  el.innerHTML = values.map(v => `<option value="${v}">${v}</option>`).join("");
}

async function refreshTopChart() {
  const players = document.getElementById("filter-players").value;
  const version = document.getElementById("filter-version").value;
  const moon    = document.getElementById("filter-moon").value;
  if (!players || !version || !moon) return;

  const res = await fetch(`/stats/history?players=${players}&moon='${moon}'&version=${version}`);
  const { labels, recent, average } = await res.json();

  topChart.data.labels           = labels;
  topChart.data.datasets[0].data = recent;
  topChart.data.datasets[1].data = new Array(labels.length).fill(average);
  topChart.update();
}

function updateBottomChart(labels, recent, average) {
  bottomChart.data.labels                  = labels;
  bottomChart.data.datasets[0].data        = recent;
  bottomChart.data.datasets[1].data        = new Array(labels.length).fill(average);
  bottomChart.update();
}

async function refreshBottomChart() {
  if (!lastStats) return;
  const res = await fetch(`/stats/history?players=${Object.keys(lastStats.Players).length}&moon='${lastStats.MoonInfo.Name}'&version=${lastStats.Version}`);
  const { labels, recent, average } = await res.json();
  updateBottomChart(labels, recent, average);
}

// ── JSON display ─────────────────────────────────────────

function highlight(obj) {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (m) => {
      if (/^"/.test(m) && /:$/.test(m)) return `<span class="jk">${m}</span>`;
        if (/^"/.test(m))                 return `<span class="js">${m}</span>`;
          if (/true|false/.test(m))         return `<span class="jb">${m}</span>`;
          if (/null/.test(m))               return `<span class="jz">${m}</span>`;
          return `<span class="jn">${m}</span>`;
        }
        );
}

function showJson(obj) {
  const el = document.getElementById("json-content");
  el.innerHTML = highlight(obj);
}

function downloadJSON() {
  const json = document.getElementById("json-content").innerText;
  const blob = new Blob([json], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'day.json';
  link.click();
  URL.revokeObjectURL(url);
}

function showLastStats(stats) {
  document.getElementById("moon-info").classList.remove("hide-item");
  document.getElementById("weather").textContent = stats.MoonInfo.Weather;
  document.getElementById("moon-name").textContent = stats.MoonInfo.Name;
  document.getElementById("seed").textContent = stats.Seed;
  document.getElementById("interior").textContent = stats.DungeonInfo.Interior;
  document.getElementById("items").textContent = stats.DungeonInfo.ItemCount;
  document.getElementById("bees-collected").textContent = stats.BeeInfo.Collected.length;
  document.getElementById("bees-available").textContent = stats.BeeInfo.Available.length;
  document.getElementById("bees-collected-value").textContent = stats.BeeInfo.Collected.reduce((acc, cur) => acc + cur, 0);
  document.getElementById("bees-available-value").textContent = stats.BeeInfo.Available.reduce((acc, cur) => acc + cur, 0);
  document.getElementById("eggs-collected").textContent = stats.EggInfo.Collected.length;
  document.getElementById("eggs-available").textContent = stats.EggInfo.Available.length;
  document.getElementById("eggs-collected-value").textContent = stats.EggInfo.Collected.reduce((acc, cur) => acc + cur, 0);
  document.getElementById("eggs-available-value").textContent = stats.EggInfo.Available.reduce((acc, cur) => acc + cur, 0);
  document.getElementById("nuts-collected").textContent = stats.ShotgunInfo.Collected.length;
  document.getElementById("nuts-available").textContent = stats.ShotgunInfo.Available.length;
  document.getElementById("nuts-collected-value").textContent = stats.ShotgunInfo.Collected.reduce((acc, cur) => acc + cur, 0),
  document.getElementById("nuts-available-value").textContent = stats.ShotgunInfo.Available.reduce((acc, cur) => acc + cur, 0);
  document.getElementById("buts-collected").textContent = stats.KnifeInfo.Collected.length;
  document.getElementById("buts-available").textContent = stats.KnifeInfo.Available.length;
  document.getElementById("buts-collected-value").textContent = stats.KnifeInfo.Collected.reduce((acc, cur) => acc + cur, 0),
  document.getElementById("buts-available-value").textContent = stats.KnifeInfo.Available.reduce((acc, cur) => acc + cur, 0);
  document.getElementById("scrap-value-collected").textContent = stats.PerformanceInfo.CollectedNoExtra;
  document.getElementById("scrap-value-available").textContent = stats.PerformanceInfo.InitialAvailableValue;
  document.getElementById("total-collected").textContent = stats.PerformanceInfo.CollectedTotal;
  document.getElementById("total-available").textContent = stats.PerformanceInfo.TotalAvailableValue;
  document.getElementById("missed").textContent = stats.MissedItems.reduce((acc, cur) => (cur.CollectedOnPreviousDay) ? acc : acc + 1, 0);
  document.getElementById("lost-scrap").textContent = stats.MissedItems.reduce((acc, cur) => (cur.CollectedOnPreviousDay) ? acc + cur.Value : acc, 0);

  const playerListHtml = document.querySelector("#player-content > ul");
  playerListHtml.innerHTML = '';
  const playersSorted = Object.keys(stats.Players).sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0));
  for (const key of playersSorted) {
    const value = stats.Players[key];
    if (value.Alive)
      playerListHtml.innerHTML += 
      `<li>
        <h3>${value.Name}</h3>
        <p>Alive</p>
      </li>`;
    else
      playerListHtml.innerHTML += 
      `<li>
        <h3>${value.Name}</h3>
        <p>Time Of Death: ${value.TimeOfDeath}</p>
        <p>Cause Of Death: ${value.CauseOfDeath}</p>
      </li>`;
  }
}

// ── SSE ──────────────────────────────────────────────────

let eventSource = null;
let lastStats = null;

function connect() {
  if (eventSource) { eventSource.close(); eventSource = null; }

  eventSource = new EventSource("/live");

  eventSource.onmessage = async (e) => {
    lastStats = JSON.parse(e.data);
    showJson(lastStats);
    if (lastStats.DungeonInfo != null) {
      showLastStats(lastStats);
    //await refreshBottomChart();
    //await loadFilterAndRefreshTopChart();
    }
  };
}

//loadFilterAndRefreshTopChart();
connect();

document.querySelectorAll('.info-box').forEach(box => {
  let timeout;

  box.addEventListener('scroll', () => {
    box.classList.add('scrolling');

    clearTimeout(timeout);
    timeout = setTimeout(() => {
      box.classList.remove('scrolling');
    }, 1200);
  });
});


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

// ── Map ──────────────────────────────────────────────────

const MAP_MESSAGES = { none: "No map yet", building: "Building map...", failed: "Failed to build the map" };

const MAP_ZOOM_STEP = 1.25;
const MAP_ZOOM_MIN = 0.05;
const MAP_ZOOM_MAX = 16;

let currentMap = null;
let mapZoom = 1;
let mapX = 0;
let mapY = 0;
let mapRotation = 0;
let mapNeedsFit = false;
let nextFireExit = 0;
let highlightedItem = null;
let currentMapFloor = 0;

function applyMapView() {
  const stage = document.getElementById("map-stage");
  stage.style.transform = `translate(${mapX}px, ${mapY}px) scale(${mapZoom}) rotate(${mapRotation}deg)`;
  // Markers stay upright when the map turns
  stage.style.setProperty("--map-rotation", `${mapRotation}deg`);
  document.getElementById("map-rotation-level").textContent = `${mapRotation}\u00b0`;
  // Items stay visible and hoverable when zoomed out
  stage.style.setProperty("--item-scale", Math.max(1, 1 / mapZoom));
  document.getElementById("map-zoom-level").textContent = `${Math.round(mapZoom * 100)}%`;
}

function fitMap() {
  const view = document.getElementById("map-view");
  // The tab isn't on screen, it gets fitted when it opens
  if (!currentMap || view.clientWidth === 0) {
    mapNeedsFit = true;
    return;
  }
  mapNeedsFit = false;
  const { width, height } = currentMap.floors[currentMapFloor];
  const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => rotateMapPoint(x, y));
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  mapZoom = Math.min(view.clientWidth / (maxX - minX), view.clientHeight / (maxY - minY));
  mapX = (view.clientWidth - (minX + maxX) * mapZoom) / 2;
  mapY = (view.clientHeight - (minY + maxY) * mapZoom) / 2;
  applyMapView();
}

// Where a map pixel ends up after the rotation, clockwise with y going down
function rotateMapPoint(x, y) {
  return { 0: [x, y], 90: [-y, x], 180: [-x, -y], 270: [y, -x] }[mapRotation];
}

function centerMapOn(x, y) {
  const view = document.getElementById("map-view");
  const [rotatedX, rotatedY] = rotateMapPoint(x, y);
  mapX = view.clientWidth / 2 - rotatedX * mapZoom;
  mapY = view.clientHeight / 2 - rotatedY * mapZoom;
  applyMapView();
}

function rotateMapBy(degrees) {
  const view = document.getElementById("map-view");
  // Stays on what's in the middle of the view: undo the current rotation to get the map pixel there
  const viewX = (view.clientWidth / 2 - mapX) / mapZoom;
  const viewY = (view.clientHeight / 2 - mapY) / mapZoom;
  const [x, y] = { 0: [viewX, viewY], 90: [viewY, -viewX], 180: [-viewX, -viewY], 270: [-viewY, viewX] }[mapRotation];
  mapRotation = (mapRotation + degrees + 360) % 360;
  centerMapOn(x, y);
}

function goToEntrance(entrance) {
  showMapFloor(entrance.floor);
  centerMapOn(entrance.tileX, entrance.tileY);
}

function goToMainEntrance() {
  const main = currentMap.entrances.find((entrance) => entrance.main);
  if (main) goToEntrance(main);
}

// There can be several fire exits, each click goes to the next one
function goToNextFireExit() {
  const fires = currentMap.entrances.filter((entrance) => !entrance.main);
  if (fires.length === 0) return;
  const index = nextFireExit % fires.length;
  nextFireExit = index + 1;
  document.getElementById("map-goto-fire").textContent = fires.length > 1 ? `Fire ${index + 1}/${fires.length}` : "Fire";
  goToEntrance(fires[index]);
}

// Keeps the map point under (viewX, viewY) in place
function zoomMapAt(factor, viewX, viewY) {
  const zoom = Math.min(MAP_ZOOM_MAX, Math.max(MAP_ZOOM_MIN, mapZoom * factor));
  mapX = viewX - (viewX - mapX) * (zoom / mapZoom);
  mapY = viewY - (viewY - mapY) * (zoom / mapZoom);
  mapZoom = zoom;
  applyMapView();
}

function zoomMapBy(factor) {
  const view = document.getElementById("map-view");
  zoomMapAt(factor, view.clientWidth / 2, view.clientHeight / 2);
}

function showTooltip(title, lines, event) {
  const tooltip = document.getElementById("map-tooltip");
  const view = document.getElementById("map-view");
  tooltip.replaceChildren();
  for (const [tag, text] of [["h4", title], ...lines.map((line) => ["p", line])]) {
    const line = document.createElement(tag);
    line.textContent = text;
    tooltip.appendChild(line);
  }
  tooltip.classList.remove("hide-item");

  const bounds = view.getBoundingClientRect();
  const x = event.clientX - bounds.left + 12;
  const y = event.clientY - bounds.top + 12;
  tooltip.style.left = `${Math.min(x, view.clientWidth - tooltip.offsetWidth)}px`;
  tooltip.style.top = `${Math.min(y, view.clientHeight - tooltip.offsetHeight)}px`;
}

function hideTooltip() {
  document.getElementById("map-tooltip").classList.add("hide-item");
}

function toggleMapMarkers(button, hideClass) {
  const hidden = document.getElementById("map-items").classList.toggle(hideClass);
  button.classList.toggle("selected", !hidden);
  hideTooltip();
}

// Dragging would capture the pointer and the click would never get to the marker
function makeClickable(element, onClick) {
  element.onpointerdown = (e) => e.stopPropagation();
  element.onclick = onClick;
}

function isOnScreen(x, y) {
  const view = document.getElementById("map-view");
  const [rotatedX, rotatedY] = rotateMapPoint(x, y);
  const viewX = mapX + rotatedX * mapZoom;
  const viewY = mapY + rotatedY * mapZoom;
  return viewX >= 0 && viewY >= 0 && viewX <= view.clientWidth && viewY <= view.clientHeight;
}

// Goes to the other end of an item: where it spawned from a missed item, where it was missed from a spawned one
function highlightItem(id, target) {
  highlightedItem = id;
  showMapFloor(target.floor);
  if (!isOnScreen(target.x, target.y)) centerMapOn(target.x, target.y);
}

function clearItemHighlight() {
  if (highlightedItem === null) return;
  highlightedItem = null;
  document.querySelectorAll("#map-items .highlighted").forEach((marker) => marker.classList.remove("highlighted"));
}

function addItemMarker(className, item, lines, target, noTargetLine) {
  const marker = addMapMarker(className, item.x, item.y, item.name, target ? [...lines, "Click to find it"] : lines);
  if (item.id !== undefined && item.id === highlightedItem) marker.classList.add("highlighted");
  makeClickable(marker, (e) => {
    if (target) highlightItem(item.id, target);
    else showTooltip(item.name, [...lines, noTargetLine], e);
  });
}

function addMapMarker(className, x, y, title, lines, label = "") {
  const marker = document.createElement("div");
  marker.className = className;
  marker.textContent = label;
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
  marker.onmouseenter = (e) => showTooltip(title, lines, e);
  marker.onmousemove = (e) => showTooltip(title, lines, e);
  marker.onmouseleave = hideTooltip;
  document.getElementById("map-items").appendChild(marker);
  return marker;
}

// The tile's other floors are the same spot on the map, so only the floor changes
function addFloorLinks(link) {
  const links = document.createElement("div");
  links.className = "map-floor-link";
  links.style.left = `${link.x}px`;
  links.style.top = `${link.y}px`;
  for (const [symbol, floor, direction] of [["\u25b2", link.up, "up"], ["\u25bc", link.down, "down"]]) {
    if (floor === null) continue;
    const button = document.createElement("button");
    const title = `Go ${direction} to Floor ${currentMap.floors[floor].number}`;
    button.textContent = symbol;
    button.setAttribute("aria-label", title);
    button.onmouseenter = (e) => showTooltip(title, [], e);
    button.onmousemove = (e) => showTooltip(title, [], e);
    button.onmouseleave = hideTooltip;
    makeClickable(button, () => showMapFloor(floor));
    links.appendChild(button);
  }
  document.getElementById("map-items").appendChild(links);
}

function showMapFloor(index) {
  // The dungeon's floors share a canvas, the moon's map is a different one
  const floor = currentMap.floors[index];
  const changedCanvas = floor.outside !== currentMap.floors[currentMapFloor].outside;
  currentMapFloor = index;
  const stage = document.getElementById("map-stage");
  stage.style.width = `${floor.width}px`;
  stage.style.height = `${floor.height}px`;
  document.getElementById("map-image").src = floor.url;
  document.querySelectorAll("#map-floors button").forEach((button, i) => {
    button.classList.toggle("selected", i === index);
  });

  hideTooltip();
  document.getElementById("map-items").replaceChildren();
  for (const link of currentMap.floorLinks.filter((link) => link.floor === index)) {
    addFloorLinks(link);
  }
  for (const door of currentMap.doors.filter((door) => door.floor === index)) {
    const state = !door.startedLocked ? "" : door.unlockTime ? "unlocked" : "locked";
    const lines = [`Started locked: ${door.startedLocked ? "Yes" : "No"}`];
    if (door.startedLocked) lines.push(door.unlockTime ? `Unlocked at: ${door.unlockTime}` : "Never unlocked");
    addMapMarker(`map-door ${state}`, door.x, door.y, "Door", lines);
  }
  for (const door of currentMap.bigDoors.filter((door) => door.floor === index)) {
    addMapMarker("map-code big-door", door.x, door.y, "Big Door", [`Code: ${door.code}`, `Started open: ${door.startedOpen ? "Yes" : "No"}`], door.code);
  }
  for (const hazard of currentMap.hazards.filter((hazard) => hazard.floor === index)) {
    addMapMarker("map-code hazard", hazard.x, hazard.y, hazard.kind, [`Code: ${hazard.code}`], hazard.code);
  }
  for (const enemy of currentMap.spawnedEnemies.filter((enemy) => enemy.floor === index)) {
    const ended = currentMap.endedEnemies.find((other) => other.id === enemy.id);
    addItemMarker("map-enemy-spawn", enemy, [`Spawned at: ${enemy.spawnTime}`, "Spawned here"], ended, "It didn't die or despawn in the dungeon");
  }
  for (const enemy of currentMap.endedEnemies.filter((enemy) => enemy.floor === index)) {
    const spawned = currentMap.spawnedEnemies.find((other) => other.id === enemy.id);
    addItemMarker("map-enemy-end", enemy, [enemy.timeOfDeath ? `Died at: ${enemy.timeOfDeath}` : "Despawned at the end of the day"], spawned, "It didn't spawn in the dungeon");
  }
  for (const item of currentMap.spawnedItems.filter((item) => item.floor === index)) {
    const missed = item.id === undefined ? null : currentMap.items.find((other) => other.id === item.id);
    addItemMarker("map-spawned-item", item, [`Value: $${item.value}`, "Spawned here"], missed, "It wasn't missed in the dungeon");
  }
  for (const item of currentMap.items.filter((item) => item.floor === index)) {
    const spawned = item.id === undefined ? null : currentMap.spawnedItems.find((other) => other.id === item.id);
    // Items from earlier days never spawned today, so they have no spawn to go to
    addItemMarker("map-item", item, [`Value: $${item.value}`, `From a previous day: ${item.fromPreviousDay ? "Yes" : "No"}`], spawned,
      item.fromPreviousDay ? "No spawn position, it's from a previous day" : "It didn't spawn in the dungeon");
  }
  for (const object of currentMap.outsideObjects.filter((object) => object.floor === index)) {
    addMapMarker("map-outside-object", object.x, object.y, object.name, ["Placed here today"]);
  }
  for (const tree of currentMap.removedTrees.filter((tree) => tree.floor === index)) {
    addMapMarker("map-removed-tree", tree.x, tree.y, "Removed Tree", ["This tree wasn't there today"]);
  }
  for (const entrance of [...currentMap.entrances, ...currentMap.outsideEntrances].filter((entrance) => entrance.floor === index)) {
    addMapMarker(`map-entrance ${entrance.main ? "main" : "fire"}`, entrance.x, entrance.y, entrance.main ? "Main Entrance" : "Fire Exit", []);
  }
  if (changedCanvas) fitMap();
}

function showMap(state) {
  const title = document.getElementById("map-title");

  if (state.status !== "ready") {
    title.textContent = MAP_MESSAGES[state.status];
    // Nothing new to show yet, the previous map stays up
    return;
  }

  currentMap = state.map;
  highlightedItem = null;
  title.textContent = `${currentMap.moon} / ${currentMap.interior} / ${currentMap.seed}`;
  document.getElementById("map-controls").classList.remove("hide-item");
  document.getElementById("map-view").classList.remove("hide-item");

  const floors = document.getElementById("map-floors");
  floors.replaceChildren();
  currentMap.floors.forEach((floor, i) => {
    const button = document.createElement("button");
    button.className = "glow";
    button.textContent = floor.outside ? "Outside" : `Floor ${floor.number}`;
    button.classList.toggle("outside", floor.outside);
    button.onclick = () => showMapFloor(i);
    floors.appendChild(button);
  });

  nextFireExit = 0;
  const fires = currentMap.entrances.filter((entrance) => !entrance.main).length;
  document.getElementById("map-goto-fire").textContent = fires > 1 ? `Fire (${fires})` : "Fire";
  document.getElementById("map-goto-fire").disabled = fires === 0;
  currentMapFloor = currentMap.floors.findIndex((floor) => floor.number === 0);
  document.getElementById("map-goto-main").disabled = !currentMap.entrances.some((entrance) => entrance.main);

  showMapFloor(currentMap.floors.findIndex((floor) => floor.number === 0));
  fitMap();
}

function setupMapControls() {
  const view = document.getElementById("map-view");

  view.addEventListener("wheel", (e) => {
    e.preventDefault();
    const bounds = view.getBoundingClientRect();
    zoomMapAt(e.deltaY < 0 ? MAP_ZOOM_STEP : 1 / MAP_ZOOM_STEP, e.clientX - bounds.left, e.clientY - bounds.top);
  }, { passive: false });

  let dragging = false;
  let dragged = false;
  view.addEventListener("pointerdown", (e) => {
    dragging = true;
    dragged = false;
    view.setPointerCapture(e.pointerId);
    view.classList.add("dragging");
  });
  view.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    dragged = true;
    mapX += e.movementX;
    mapY += e.movementY;
    applyMapView();
  });
  const stopDragging = () => {
    dragging = false;
    view.classList.remove("dragging");
  };
  view.addEventListener("pointerup", () => {
    // A click on the map itself lets go of the highlighted item
    if (dragging && !dragged) clearItemHighlight();
    stopDragging();
  });
  view.addEventListener("pointercancel", stopDragging);

  document.getElementById("tab3").addEventListener("change", () => {
    if (mapNeedsFit) fitMap();
  });
  window.addEventListener("resize", () => {
    if (mapNeedsFit) fitMap();
  });
}

async function uploadMapJson(input) {
  const file = input.files[0];
  input.value = "";
  if (!file) return;

  const title = document.getElementById("map-title");
  let body;
  try {
    body = JSON.stringify(JSON.parse(await file.text()));
  } catch {
    title.textContent = "That file isn't valid JSON";
    return;
  }
  const res = await fetch("/map/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body });
  // A good upload shows up through the map event like any other map
  if (!res.ok) title.textContent = await res.text();
}

async function downloadMap() {
  if (!currentMap) return;
  for (const floor of currentMap.floors) {
    const link = document.createElement('a');
    link.href = floor.url;
    link.download = `${currentMap.id}_${floor.outside ? "outside" : `floor${floor.number}`}.png`;
    link.click();
    // Browsers drop downloads started all at once
    await new Promise(resolve => setTimeout(resolve, 300));
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

  eventSource.addEventListener("map", (e) => showMap(JSON.parse(e.data)));
}

//loadFilterAndRefreshTopChart();
setupMapControls();
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


const API_BASE = "https://pokeapi.co/api/v2";
const PAGE_LIMIT = 24;

function $(id) {
  return document.getElementById(id);
}

function capitalize(s = "") {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

// Fetch the todos los pokemons
async function fetchAllPokemonList() {
  const cacheKey = "pokeapi_all_pokemon_list_v1";
  const cached = safeJsonParse(sessionStorage.getItem(cacheKey), null);
  if (cached?.results?.length) return cached.results;

  const data = await fetchJson(`${API_BASE}/pokemon?limit=100000&offset=0`);
  sessionStorage.setItem(cacheKey, JSON.stringify({ results: data.results }));
  return data.results;
}

// Guardar datos de pokemon y sus movimientos escogidos aleatoreamente
const detailCache = new Map();
const moveCache = new Map();

async function fetchPokemonDetailByUrl(url) {
  if (detailCache.has(url)) return detailCache.get(url);

  const data = await fetchJson(url);
  detailCache.set(url, data);
  return data;
}

async function fetchMoveDetail(url) {
  if (moveCache.has(url)) return moveCache.get(url);

  const data = await fetchJson(url);
  moveCache.set(url, data);
  return data;
}

// Estado de batalla
const battleState = {
  pokemon1: null,
  pokemon2: null,
  fighter1: null,
  fighter2: null,
  started: false,
  turn: 0,
  maxTurns: 20,
  winner: null,
  isRunning: false,
  firstAttacker: 1,
  activeMove1: null,
  activeMove2: null
};


//Funciones ayudadoras para las tarjetas
function getPokemonSprite(p) {
  return (
    p?.sprites?.other?.["official-artwork"]?.front_default ||
    p?.sprites?.front_default ||
    ""
  );
}

function getPokemonBattleStats(p) {
  return {
    hp: p.stats?.find((s) => s.stat.name === "hp")?.base_stat ?? 50,
    atk: p.stats?.find((s) => s.stat.name === "attack")?.base_stat ?? 50,
    def: p.stats?.find((s) => s.stat.name === "defense")?.base_stat ?? 50,
    spd: p.stats?.find((s) => s.stat.name === "speed")?.base_stat ?? 50
  };
}

function pickRandomItems(arr, count) {
  const copy = [...arr];

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy.slice(0, Math.min(count, copy.length));
}

function isPokemon1(id) {
  return battleState.pokemon1?.id === id;
}

function isPokemon2(id) {
  return battleState.pokemon2?.id === id;
}

function isSelectedAnywhere(id) {
  return isPokemon1(id) || isPokemon2(id);
}

function hasReachedTurnLimit() {
  return battleState.turn >= battleState.maxTurns;
}


//Log de Movimientos de Batalla
function addLog(message) {
  const log = $("battleLog");
  if (!log) return;

  const line = document.createElement("div");
  line.className = "log-line";
  line.textContent = message;
  log.prepend(line);
}

function clearLog() {
  const log = $("battleLog");
  if (log) log.innerHTML = "";
}

function updateHealthBar(barEl, textEl, currentHp, maxHp) {
  if (!barEl || !textEl) return;

  const percent = Math.max(0, (currentHp / maxHp) * 100);
  barEl.style.width = `${percent}%`;
  textEl.textContent = `HP: ${currentHp} / ${maxHp}`;

  if (percent > 50) {
    barEl.style.background = "#28a745";
  } else if (percent > 20) {
    barEl.style.background = "#ffc107";
  } else {
    barEl.style.background = "#dc3545";
  }
}

function renderBattleSelection() {
  const slot1 = $("pokemon1");
  const slot2 = $("pokemon2");
  const startBtn = $("empezarPelea");

  if (!slot1 || !slot2 || !startBtn) return;

  const p1 = battleState.pokemon1;
  const p2 = battleState.pokemon2;

  slot1.innerHTML = p1
    ? `
      <div>
        <img src="${getPokemonSprite(p1)}" alt="${p1.name}" style="max-width:100px;">
        <p><strong>${capitalize(p1.name)}</strong></p>
      </div>
    `
    : `
      <div>
        <img
          class="placeholder-ball"
          src="https://upload.wikimedia.org/wikipedia/commons/5/53/Pok%C3%A9_Ball_icon.svg"
          alt="Pokeball placeholder"
        >
        <p>Escoge Pokémon 1</p>
      </div>
    `;

  slot2.innerHTML = p2
    ? `
      <div>
        <img src="${getPokemonSprite(p2)}" alt="${p2.name}" style="max-width:100px;">
        <p><strong>${capitalize(p2.name)}</strong></p>
      </div>
    `
    : `
      <div>
        <img
          class="placeholder-ball"
          src="https://upload.wikimedia.org/wikipedia/commons/5/53/Pok%C3%A9_Ball_icon.svg"
          alt="Pokeball placeholder"
        >
        <p>Escoge Pokémon 2</p>
      </div>
    `;

  slot1.classList.toggle("selected", !!p1);
  slot2.classList.toggle("selected", !!p2);

  startBtn.disabled = !battleState.pokemon1 || !battleState.pokemon2 || battleState.isRunning;
}

function renderBattleArena() {
  const arena = $("Arena");
  if (!arena) return;

  const PLACEHOLDER_BALL = "https://upload.wikimedia.org/wikipedia/commons/5/53/Pok%C3%A9_Ball_icon.svg";

  if (!battleState.fighter1 || !battleState.fighter2) {
    $("pokemon1Nombre").textContent = "Pokémon 1";
    $("fighter1Sprite").src = PLACEHOLDER_BALL;
    $("fighter1Sprite").alt = "Pokeball placeholder";
    $("pokemon1Hp").textContent = "HP: -- / --";
    $("pokemon1HpBar").style.width = "0%";
    $("movesPokemon1").innerHTML = "";

    $("pokemon2Nombre").textContent = "Pokémon 2";
    $("fighter2Sprite").src = PLACEHOLDER_BALL;
    $("fighter2Sprite").alt = "Pokeball placeholder";
    $("pokemon2Hp").textContent = "HP: -- / --";
    $("pokemon2HpBar").style.width = "0%";
    $("movesPokemon2").innerHTML = "";

    $("turnCounter").textContent = "Turn: 0";
    arena.hidden = true;
    return;
  }

  arena.hidden = false;

  $("pokemon1Nombre").textContent = battleState.fighter1.name;
  $("fighter1Sprite").src = battleState.fighter1.sprite;
  $("fighter1Sprite").alt = battleState.fighter1.name;

  $("pokemon2Nombre").textContent = battleState.fighter2.name;
  $("fighter2Sprite").src = battleState.fighter2.sprite;
  $("fighter2Sprite").alt = battleState.fighter2.name;

  updateHealthBar(
    $("pokemon1HpBar"),
    $("pokemon1Hp"),
    battleState.fighter1.currentHp,
    battleState.fighter1.maxHp
  );

  updateHealthBar(
    $("pokemon2HpBar"),
    $("pokemon2Hp"),
    battleState.fighter2.currentHp,
    battleState.fighter2.maxHp
  );

  $("movesPokemon1").innerHTML = battleState.fighter1.moves
  .map((m) => `
    <div class="move-chip ${battleState.activeMove1 === m.name ? "move-chip-active" : ""}">
      ${capitalize(m.name)} (${m.power})
    </div>
  `)
  .join("");

$("movesPokemon2").innerHTML = battleState.fighter2.moves
  .map((m) => `
    <div class="move-chip ${battleState.activeMove2 === m.name ? "move-chip-active" : ""}">
      ${capitalize(m.name)} (${m.power})
    </div>
  `)
  .join("");

  $("turnCounter").textContent = `Turn: ${battleState.turn}`;
}

function resetBattleOnly() {
  battleState.fighter1 = null;
  battleState.fighter2 = null;
  battleState.started = false;
  battleState.turn = 0;
  battleState.winner = null;
  battleState.isRunning = false;
  battleState.firstAttacker = 1;
  battleState.activeMove1 = null;
  battleState.activeMove2 = null;

  const input = $("limiteTurnos");
  battleState.maxTurns = Math.max(0, Number(input?.value) || 20);

  clearLog();
  renderBattleArena();
  renderBattleSelection();
}

function clearBattleSelectionAndState(renderCardsFn) {
  if (battleState.isRunning) return;

  battleState.pokemon1 = null;
  battleState.pokemon2 = null;
  resetBattleOnly();
  renderCardsFn();
}

function assignPokemonToSlot(slot, pokemon, renderCardsFn) {
  if (battleState.isRunning) return;

  if (slot === 1) {
    if (battleState.pokemon2?.id === pokemon.id) {
      battleState.pokemon2 = null;
    }
    battleState.pokemon1 = pokemon;
  } else {
    if (battleState.pokemon1?.id === pokemon.id) {
      battleState.pokemon1 = null;
    }
    battleState.pokemon2 = pokemon;
  }

  resetBattleOnly();
  renderCardsFn();
}

function removePokemonFromSlot(slot, renderCardsFn) {
  if (battleState.isRunning) return;

  if (slot === 1) {
    battleState.pokemon1 = null;
  } else {
    battleState.pokemon2 = null;
  }

  resetBattleOnly();
  renderCardsFn();
}

// Funciones de Batalla
async function buildBattlePokemon(p) {
  const stats = getPokemonBattleStats(p);
  const chosenMoves = pickRandomItems(p.moves || [], 4);

  const detailedMoves = await Promise.all(
    chosenMoves.map(async (moveEntry) => {
      try {
        const moveData = await fetchMoveDetail(moveEntry.move.url);
        return {
          name: moveEntry.move.name,
          power: moveData.power ?? 0,
          accuracy: moveData.accuracy ?? 100,
          type: moveData.type?.name ?? "normal"
        };
      } catch {
        return {
          name: moveEntry.move.name,
          power: 0,
          accuracy: 100,
          type: "normal"
        };
      }
    })
  );

  return {
    id: p.id,
    name: capitalize(p.name),
    sprite: getPokemonSprite(p),
    maxHp: stats.hp,
    currentHp: stats.hp,
    attack: stats.atk,
    defense: stats.def,
    speed: stats.spd,
    moves: detailedMoves
  };
}

function calculateDamage(attacker, defender, move) {
  if (!move.power || move.power <= 0) return 0;

  const rawDamage = Math.floor(
    (attacker.attack / Math.max(defender.defense, 1)) * move.power * 0.35
  );
  return Math.max(1, rawDamage);
}

function endBattleByTurnLimit() {
  battleState.started = false;

  if (battleState.fighter1.currentHp > battleState.fighter2.currentHp) {
    battleState.winner = battleState.fighter1.name;
  } else if (battleState.fighter2.currentHp > battleState.fighter1.currentHp) {
    battleState.winner = battleState.fighter2.name;
  } else {
    battleState.winner = "Draw";
  }

  if (battleState.winner === "Draw") {
    addLog(`Turn limit reached (${battleState.maxTurns}). La pelea terminó en empate.`);
  } else {
    addLog(`Turn limit reached (${battleState.maxTurns}). Ganador por HP restante: ${battleState.winner}.`);
  }
}

function getTurnAttackerAndDefender() {
  const isEvenTurn = battleState.turn % 2 === 0;

  if (battleState.firstAttacker === 1) {
    return isEvenTurn
      ? { attacker: battleState.fighter1, defender: battleState.fighter2 }
      : { attacker: battleState.fighter2, defender: battleState.fighter1 };
  }

  return isEvenTurn
    ? { attacker: battleState.fighter2, defender: battleState.fighter1 }
    : { attacker: battleState.fighter1, defender: battleState.fighter2 };
}

async function runAutoBattle() {
  if (!battleState.started || battleState.isRunning) return;

  battleState.isRunning = true;
  renderBattleSelection();

  while (battleState.started && !battleState.winner) {
    if (hasReachedTurnLimit()) {
      endBattleByTurnLimit();
      renderBattleArena();
      break;
    }

    const { attacker, defender } = getTurnAttackerAndDefender();

    if (!attacker || !defender) break;
    if (attacker.currentHp <= 0 || defender.currentHp <= 0) break;

    const move = attacker.moves[Math.floor(Math.random() * attacker.moves.length)];
    battleState.turn += 1;

    battleState.activeMove1 = null;
    battleState.activeMove2 = null;

    if (attacker.id === battleState.fighter1.id) {
      battleState.activeMove1 = move.name;
    } else {
      battleState.activeMove2 = move.name;
    }

    renderBattleArena();
    await sleep(500);

    const hitRoll = Math.random() * 100;

    if (hitRoll > move.accuracy) {
      addLog(`Turn ${battleState.turn}: ${attacker.name} usó ${move.name}, pero falló.`);
    } else {
      const damage = calculateDamage(attacker, defender, move);
      defender.currentHp = Math.max(0, defender.currentHp - damage);
      addLog(`Turn ${battleState.turn}: ${attacker.name} usó ${move.name} e hizo ${damage} de daño.`);
    }

    renderBattleArena();

    if (defender.currentHp <= 0) {
      battleState.winner = attacker.name;
      battleState.started = false;
      addLog(`${defender.name} se debilitó. ¡${attacker.name} gana!`);
      battleState.activeMove1 = null;
      battleState.activeMove2 = null;
      renderBattleArena();
      break;
    }

    await sleep(700);
    battleState.activeMove1 = null;
    battleState.activeMove2 = null;
    renderBattleArena();

    await sleep(200);
  }

  battleState.isRunning = false;
  renderBattleSelection();
}

/* =========================
   Cards
========================= */
function pokemonCardHtml(p) {
  const sprite = getPokemonSprite(p);

  const types = (p.types || [])
    .map((t) => `<span class="type">${capitalize(t.type.name)}</span>`)
    .join("");

  const hp = p.stats?.find((s) => s.stat.name === "hp")?.base_stat ?? "-";
  const atk = p.stats?.find((s) => s.stat.name === "attack")?.base_stat ?? "-";
  const def = p.stats?.find((s) => s.stat.name === "defense")?.base_stat ?? "-";
  const spd = p.stats?.find((s) => s.stat.name === "speed")?.base_stat ?? "-";

  const selected1 = isPokemon1(p.id);
  const selected2 = isPokemon2(p.id);

  return `
    <article class="poke-card" title="${capitalize(p.name)}">
      <div class="poke-card-top">
        <span class="poke-id">#${String(p.id).padStart(4, "0")}</span>
      </div>

      <div class="poke-img-wrap">
        ${
          sprite
            ? `<img class="poke-img" src="${sprite}" alt="${p.name}" loading="lazy" />`
            : `<div class="poke-img placeholder"></div>`
        }
      </div>

      <h3 class="poke-name">${capitalize(p.name)}</h3>

      <div class="poke-types">${types}</div>

      <div class="poke-stats">
        <div><b>HP</b> ${hp}</div>
        <div><b>ATK</b> ${atk}</div>
        <div><b>DEF</b> ${def}</div>
        <div><b>SPD</b> ${spd}</div>
      </div>

      <div class="card-actions two-buttons">
        <button
          class="${selected1 ? "remove-btn" : "select-btn"}"
          data-pokemon-id="${p.id}"
          data-slot="1"
        >
          ${selected1 ? "Remove P1" : "Set as Pokémon 1"}
        </button>

        <button
          class="${selected2 ? "remove-btn" : "select-btn"}"
          data-pokemon-id="${p.id}"
          data-slot="2"
        >
          ${selected2 ? "Remove P2" : "Set as Pokémon 2"}
        </button>
      </div>
    </article>
  `;
}

/* =========================
   Init page
========================= */
async function initPokeFightPage() {
  const grid = $("pokeGrid");
  const searchInput = $("pokeSearch");

  if (!grid || !searchInput) return;

  const clearBtn = $("clearSearch");
  const resultCount = $("resultCount");
  const pageInfo = $("pageInfo");
  const prevBtn = $("prevPage");
  const nextBtn = $("nextPage");

  const startBattleBtn = $("empezarPelea");
  const turnLimitInput = $("limiteTurnos");

  grid.innerHTML = `<div class="loading">Loading Pokémon list…</div>`;

  let allList = [];
  try {
    allList = await fetchAllPokemonList();
  } catch (e) {
    grid.innerHTML = `<div class="error">Failed to load Pokémon list: ${e.message}</div>`;
    return;
  }

  let query = "";
  let page = 1;

  function getFilteredList() {
    const q = query.trim().toLowerCase();
    if (!q) return allList;

    return allList.filter((p) => {
      const pokemonId = p.url.split("/").at(-2);
      return p.name.includes(q) || pokemonId.includes(q);
    });
  }

  async function render() {
    const filtered = getFilteredList();

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
    page = Math.min(Math.max(1, page), totalPages);

    const start = (page - 1) * PAGE_LIMIT;
    const items = filtered.slice(start, start + PAGE_LIMIT);

    if (resultCount) resultCount.textContent = `${total.toLocaleString()} result(s)`;
    if (pageInfo) pageInfo.textContent = `Page ${page} / ${totalPages}`;

    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = page >= totalPages;

    grid.innerHTML = `<div class="loading">Loading details…</div>`;

    try {
      const details = await Promise.all(items.map((it) => fetchPokemonDetailByUrl(it.url)));
      grid.innerHTML = details.map(pokemonCardHtml).join("");

      grid.querySelectorAll("[data-pokemon-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = Number(btn.dataset.pokemonId);
          const slot = Number(btn.dataset.slot);
          const selectedPokemon = details.find((p) => p.id === id);

          if (!selectedPokemon) return;

          if (slot === 1) {
            if (isPokemon1(id)) {
              removePokemonFromSlot(1, render);
            } else {
              assignPokemonToSlot(1, selectedPokemon, render);
            }
          } else {
            if (isPokemon2(id)) {
              removePokemonFromSlot(2, render);
            } else {
              assignPokemonToSlot(2, selectedPokemon, render);
            }
          }
        });
      });
    } catch (e) {
      grid.innerHTML = `<div class="error">Failed to load Pokémon details: ${e.message}</div>`;
    }
  }

  searchInput.addEventListener("input", async (e) => {
    query = e.target.value;
    page = 1;
    await render();
  });

  clearBtn?.addEventListener("click", async () => {
  if (battleState.isRunning) return;

  query = "";
  searchInput.value = "";
  page = 1;

  battleState.pokemon1 = null;
  battleState.pokemon2 = null;

  resetBattleOnly();
  await render();
});

  prevBtn?.addEventListener("click", async () => {
    page -= 1;
    await render();
  });

  nextBtn?.addEventListener("click", async () => {
    page += 1;
    await render();
  });

  searchInput.addEventListener("keydown", async (e) => {
    if (e.key !== "Enter") return;

    const name = searchInput.value.trim().toLowerCase();
    if (!name) return;

    const exact = allList.find((p) => p.name === name);
    if (!exact) return;

    grid.innerHTML = `<div class="loading">Loading ${name}…</div>`;

    try {
      const p = await fetchPokemonDetailByUrl(exact.url);

      if (resultCount) resultCount.textContent = `1 result (exact match)`;
      if (pageInfo) pageInfo.textContent = `—`;
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;

      grid.innerHTML = pokemonCardHtml(p);

      grid.querySelectorAll("[data-pokemon-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const slot = Number(btn.dataset.slot);

          if (slot === 1) {
            if (isPokemon1(p.id)) {
              removePokemonFromSlot(1, render);
            } else {
              assignPokemonToSlot(1, p, render);
            }
          } else {
            if (isPokemon2(p.id)) {
              removePokemonFromSlot(2, render);
            } else {
              assignPokemonToSlot(2, p, render);
            }
          }
        });
      });
    } catch {
      await render();
    }
  });

  turnLimitInput?.addEventListener("input", () => {
    const value = Number(turnLimitInput.value);

    if (!Number.isFinite(value) || value < 0) {
      turnLimitInput.value = "0";
      battleState.maxTurns = 0;
      return;
    }

    battleState.maxTurns = value;
  });

  startBattleBtn?.addEventListener("click", async () => {
    if (!battleState.pokemon1 || !battleState.pokemon2 || battleState.isRunning) return;

    const inputTurns = Number(turnLimitInput?.value) || 20;
    battleState.maxTurns = Math.max(1, inputTurns);

    const fighter1 = await buildBattlePokemon(battleState.pokemon1);
    const fighter2 = await buildBattlePokemon(battleState.pokemon2);

    battleState.fighter1 = fighter1;
    battleState.fighter2 = fighter2;
    battleState.started = true;
    battleState.turn = 0;
    battleState.winner = null;
    battleState.firstAttacker = fighter1.speed >= fighter2.speed ? 1 : 2;

    clearLog();
    addLog(`Battle started: ${fighter1.name} vs ${fighter2.name}`);
    addLog(`Max turns: ${battleState.maxTurns}`);
    addLog(`${battleState.firstAttacker === 1 ? fighter1.name : fighter2.name} attacks first.`);

    renderBattleArena();
    await runAutoBattle();
  });

  battleState.maxTurns = Math.max(1, Number(turnLimitInput?.value) || 20);

  renderBattleSelection();
  renderBattleArena();
  await render();
}

document.addEventListener("DOMContentLoaded", initPokeFightPage);
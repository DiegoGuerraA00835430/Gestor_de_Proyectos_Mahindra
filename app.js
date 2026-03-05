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

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

//Trae los datos basicos de todos los pokemons para luego poder buscar los datos especificos
async function fetchAllPokemonList() {
  const cacheKey = "pokeapi_all_pokemon_list_v1";
  const cached = safeJsonParse(sessionStorage.getItem(cacheKey), null);
  if (cached?.results?.length) return cached.results;

  const data = await fetchJson(`${API_BASE}/pokemon?limit=100000&offset=0`);
  sessionStorage.setItem(cacheKey, JSON.stringify({ results: data.results }));
  return data.results;
}


// fetch de los datos especificos de un pokemon
const detailCache = new Map();

async function fetchPokemonDetailByUrl(url) {
  if (detailCache.has(url)) return detailCache.get(url);

  const data = await fetchJson(url);
  detailCache.set(url, data);
  return data;
}

//Datos de la tarjeta del pokemon

function pokemonCardHtml(p) {
  const sprite =
    p?.sprites?.other?.["official-artwork"]?.front_default ||
    p?.sprites?.front_default ||
    "";

  const types = (p.types || [])
    .map((t) => `<span class="type">${capitalize(t.type.name)}</span>`)
    .join("");

  const hp = p.stats?.find((s) => s.stat.name === "hp")?.base_stat ?? "-";
  const atk = p.stats?.find((s) => s.stat.name === "attack")?.base_stat ?? "-";
  const def = p.stats?.find((s) => s.stat.name === "defense")?.base_stat ?? "-";
  const spd = p.stats?.find((s) => s.stat.name === "speed")?.base_stat ?? "-";

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
    </article>
  `;
}


async function initPokeFightPage() {
  const grid = $("pokeGrid");
  const searchInput = $("pokeSearch");
  if (!grid || !searchInput) return;

  const clearBtn = $("clearSearch");
  const resultCount = $("resultCount");
  const pageInfo = $("pageInfo");
  const prevBtn = $("prevPage");
  const nextBtn = $("nextPage");

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

    return allList.filter((p) => p.name.includes(q));
  }

  async function render() {
    const filtered = getFilteredList();

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));
    page = Math.min(Math.max(1, page), totalPages);

    const start = (page - 1) * PAGE_LIMIT;
    const items = filtered.slice(start, start + PAGE_LIMIT);

    resultCount.textContent = `${total.toLocaleString()} result(s)`;
    pageInfo.textContent = `Page ${page} / ${totalPages}`;

    prevBtn.disabled = page <= 1;
    nextBtn.disabled = page >= totalPages;

    
    grid.innerHTML = `<div class="loading">Loading details…</div>`;

    try {
      const details = await Promise.all(items.map((it) => fetchPokemonDetailByUrl(it.url)));
      grid.innerHTML = details.map(pokemonCardHtml).join("");
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
    query = "";
    searchInput.value = "";
    page = 1;
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
      resultCount.textContent = `1 result (exact match)`;
      pageInfo.textContent = `—`;
      prevBtn.disabled = true;
      nextBtn.disabled = true;
      grid.innerHTML = pokemonCardHtml(p);
    } catch {
      await render();
    }
  });

  await render();
}

document.addEventListener("DOMContentLoaded", initPokeFightPage);
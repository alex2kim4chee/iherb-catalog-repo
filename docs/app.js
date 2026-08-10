import { expandQuery } from "./search-ru.js";

const DATA_URL = "./data/products.json";
// Размер порции подобран так, чтобы первый экран заполнялся с запасом
// на широком мониторе, но страница не вырастала на сотни экранов.
const PAGE_SIZE = 60;

const state = {
  products: [],
  query: "",
  queryTerms: [],
  brand: "all",
  category: "all",
  priceMin: "",
  priceMax: "",
  sort: "default",
  filtered: [],
  rendered: 0,
};

const el = {
  search: document.getElementById("search"),
  brand: document.getElementById("brand"),
  category: document.getElementById("category"),
  priceMin: document.getElementById("price-min"),
  priceMax: document.getElementById("price-max"),
  sort: document.getElementById("sort"),
  catalog: document.getElementById("catalog"),
  stats: document.getElementById("stats"),
  reset: document.getElementById("reset"),
  empty: document.getElementById("empty"),
  openContact: document.getElementById("open-contact"),
  closeContact: document.getElementById("close-contact"),
  contactDialog: document.getElementById("contact-dialog"),
  sentinel: null,
};

// rootMargin даёт фору: следующая порция готовится до того, как покупатель
// доскроллит до конца, поэтому подгрузка не бросается в глаза.
const observer = new IntersectionObserver(
  (entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      appendBatch();
    }
  },
  { rootMargin: "600px 0px" }
);

function createSentinel() {
  const node = document.createElement("button");
  node.type = "button";
  node.className = "load-more";
  node.hidden = true;
  // Клик — запасной путь: если наблюдатель почему-то не сработает, покупатель
  // всё равно сможет открыть следующую порцию.
  node.addEventListener("click", () => appendBatch());
  el.catalog.insertAdjacentElement("afterend", node);
  return node;
}

// Наблюдатель — основной механизм, но полагаться только на него нельзя:
// в части окружений он не срабатывает. Прокрутка страхует его напрямую.
function sentinelIsNear() {
  if (!el.sentinel || el.sentinel.hidden) {
    return false;
  }
  return el.sentinel.getBoundingClientRect().top <= window.innerHeight + 600;
}

function maybeLoadMore() {
  let guard = 0;
  while (sentinelIsNear() && state.rendered < state.filtered.length && guard < 5) {
    appendBatch();
    guard += 1;
  }
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function formatPrice(value) {
  return `$${Math.round(value * 100) / 100}`;
}

function fillSelect(select, values, allLabel) {
  const frag = document.createDocumentFragment();
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = allLabel;
  frag.appendChild(all);

  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    frag.appendChild(option);
  }

  select.innerHTML = "";
  select.appendChild(frag);
}

// Категории двухуровневые: «Supplements → Vitamins». Плоский список из сотен
// значений неудобен, поэтому подкатегории группируются по разделам в optgroup.
function fillCategorySelect(products) {
  const groups = new Map();
  for (const product of products) {
    if (!product.category) {
      continue;
    }
    const top = product.categoryTop || "Прочее";
    if (!groups.has(top)) {
      groups.set(top, new Set());
    }
    groups.get(top).add(product.category);
  }

  const frag = document.createDocumentFragment();
  const all = document.createElement("option");
  all.value = "all";
  all.textContent = "Все категории";
  frag.appendChild(all);

  for (const top of [...groups.keys()].sort((a, b) => a.localeCompare(b, "ru"))) {
    const group = document.createElement("optgroup");
    group.label = top;
    for (const category of [...groups.get(top)].sort((a, b) => a.localeCompare(b, "ru"))) {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      group.appendChild(option);
    }
    frag.appendChild(group);
  }

  el.category.innerHTML = "";
  el.category.appendChild(frag);
}

function renderFilterOptions(products) {
  const brands = [...new Set(products.map((p) => p.brand).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ru")
  );
  fillSelect(el.brand, brands, "Все бренды");
  fillCategorySelect(products);
}

function productMatches(product) {
  const query = normalize(state.query);
  if (query) {
    // Ищем по названию, бренду и категории — и по-русски, и по-английски.
    // Русский запрос дополнительно расширяется английскими терминами, иначе
    // «магний» не нашёл бы ни один Magnesium Glycinate.
    const haystack = normalize(
      `${product.name} ${product.brand} ${product.category} ${product.categoryEn || ""}`
    );
    if (!state.queryTerms.some((term) => haystack.includes(term))) {
      return false;
    }
  }

  if (state.brand !== "all" && product.brand !== state.brand) {
    return false;
  }

  if (state.category !== "all" && product.category !== state.category) {
    return false;
  }

  if (state.priceMin !== "" && product.priceMax < Number(state.priceMin)) {
    return false;
  }

  if (state.priceMax !== "" && product.priceMin > Number(state.priceMax)) {
    return false;
  }

  return true;
}

function sortProducts(products) {
  const sorted = [...products];

  if (state.sort === "price-asc") {
    sorted.sort((a, b) => a.priceMin - b.priceMin);
    return sorted;
  }

  if (state.sort === "price-desc") {
    sorted.sort((a, b) => b.priceMin - a.priceMin);
    return sorted;
  }

  sorted.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  return sorted;
}

function buildCard(product, indexInBatch) {
    const card = document.createElement("article");
    card.className = "card";
    card.style.animationDelay = `${Math.min(indexInBatch * 16, 220)}ms`;

    const variants = product.offers.slice(0, 4).map((o) => o.size).join(", ");
    const more = product.offers.length > 4 ? "…" : "";

    // Значения из данных вставляются как текст, а не как разметка.
    const imageWrap = document.createElement("div");
    imageWrap.className = "card-image-wrap";
    const img = document.createElement("img");
    img.className = "card-image";
    img.src = product.imageUrl;
    img.alt = product.name;
    img.loading = "lazy";
    imageWrap.appendChild(img);

    const body = document.createElement("div");
    body.className = "card-body";

    const brand = document.createElement("p");
    brand.className = "card-brand";
    brand.textContent = product.brand;

    const name = document.createElement("h3");
    name.className = "card-name";
    name.textContent = product.name;

    const category = document.createElement("p");
    category.className = "card-category";
    category.textContent = product.category;

    const meta = document.createElement("p");
    meta.className = "card-meta";
    meta.textContent =
      product.priceMin === product.priceMax
        ? `Цена: ${formatPrice(product.priceMin)}`
        : `Цена: ${formatPrice(product.priceMin)} — ${formatPrice(product.priceMax)}`;

    const sizes = document.createElement("p");
    sizes.className = "card-sizes";
    sizes.textContent = `Фасовки: ${variants}${more}`;

    const link = document.createElement("a");
    link.className = "btn btn-primary card-link";
    link.href = `./p/${product.slug}.html`;
    link.textContent = "ВЫБРАТЬ ФАСОВКУ";

    body.append(brand, name, category, meta, sizes, link);
    card.append(imageWrap, body);
    return card;
}

// Рисуем каталог порциями. Раньше в DOM попадали все карточки сразу: страница
// вырастала на сотни экранов, и браузер начинал грузить сотни картинок далеко
// за пределами вьюпорта, хотя `loading="lazy"` формально стоял.
function appendBatch() {
  if (state.rendered >= state.filtered.length) {
    return;
  }

  const batch = state.filtered.slice(state.rendered, state.rendered + PAGE_SIZE);
  const frag = document.createDocumentFragment();
  batch.forEach((product, index) => frag.appendChild(buildCard(product, index)));

  el.catalog.appendChild(frag);
  state.rendered += batch.length;
  updateSentinel();
}

function updateSentinel() {
  const more = state.filtered.length - state.rendered;
  if (more <= 0) {
    el.sentinel.hidden = true;
    observer.unobserve(el.sentinel);
    return;
  }

  el.sentinel.hidden = false;
  el.sentinel.textContent = `Показать ещё — осталось ${more}`;
  observer.observe(el.sentinel);
}

function renderCatalog() {
  state.filtered = sortProducts(state.products.filter(productMatches));
  state.rendered = 0;
  el.catalog.innerHTML = "";
  el.stats.textContent = `Показано ${state.filtered.length} из ${state.products.length}`;

  if (state.filtered.length === 0) {
    el.empty.classList.remove("hidden");
    el.sentinel.hidden = true;
    return;
  }

  el.empty.classList.add("hidden");
  appendBatch();
  maybeLoadMore();
}

function bindEvents() {
  const bind = (node, event, handler) => node && node.addEventListener(event, handler);

  bind(el.search, "input", (e) => {
    state.query = e.target.value;
    state.queryTerms = expandQuery(e.target.value);
    renderCatalog();
  });
  bind(el.brand, "change", (e) => { state.brand = e.target.value; renderCatalog(); });
  bind(el.category, "change", (e) => { state.category = e.target.value; renderCatalog(); });
  bind(el.priceMin, "input", (e) => { state.priceMin = e.target.value; renderCatalog(); });
  bind(el.priceMax, "input", (e) => { state.priceMax = e.target.value; renderCatalog(); });
  bind(el.sort, "change", (e) => { state.sort = e.target.value; renderCatalog(); });

  bind(el.reset, "click", () => {
    Object.assign(state, {
      query: "", queryTerms: [], brand: "all", category: "all",
      priceMin: "", priceMax: "", sort: "default",
    });
    el.search.value = "";
    el.brand.value = "all";
    el.category.value = "all";
    el.priceMin.value = "";
    el.priceMax.value = "";
    el.sort.value = "default";
    renderCatalog();
  });
}

function bindContactDialog() {
  if (!el.openContact || !el.contactDialog || !el.closeContact) {
    return;
  }
  el.openContact.addEventListener("click", () => el.contactDialog.showModal());
  el.closeContact.addEventListener("click", () => el.contactDialog.close());
  el.contactDialog.addEventListener("click", (event) => {
    const rect = el.contactDialog.getBoundingClientRect();
    const inside =
      event.clientX >= rect.left && event.clientX <= rect.right &&
      event.clientY >= rect.top && event.clientY <= rect.bottom;
    if (!inside) {
      el.contactDialog.close();
    }
  });
}

async function init() {
  el.sentinel = createSentinel();
  window.addEventListener("scroll", maybeLoadMore, { passive: true });
  window.addEventListener("resize", maybeLoadMore, { passive: true });
  bindEvents();
  bindContactDialog();

  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Ошибка загрузки данных: ${response.status}`);
    }
    const payload = await response.json();
    state.products = payload.products || [];
    renderFilterOptions(state.products);
    renderCatalog();
  } catch (error) {
    el.stats.textContent = "Не удалось загрузить каталог. Проверь data/products.json.";
    el.catalog.innerHTML = "";
    el.empty.classList.add("hidden");
    console.error(error);
  }
}

init();

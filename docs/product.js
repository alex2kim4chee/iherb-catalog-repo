const TELEGRAM_USERNAME = "alex_kim_chi";
const WHATSAPP_PHONE = "16463226000";
const FX_URL = "../fx.json";

const dataNode = document.getElementById("product-data");
const product = JSON.parse(dataNode.textContent || "{}");

const state = {
  selected: null,
  fx: null,
  fxStatus: "loading",
};

const el = {
  sizesList: document.getElementById("sizes-list"),
  selectionSize: document.getElementById("selection-size"),
  selectionPrice: document.getElementById("selection-price"),
  selectionPriceRub: document.getElementById("selection-price-rub"),
  selectionShipping: document.getElementById("selection-shipping"),
  shippingNote: document.getElementById("shipping-note"),
  fxNote: document.getElementById("fx-note"),
  ctaTelegram: document.getElementById("cta-telegram"),
  ctaWhatsapp: document.getElementById("cta-whatsapp"),
};

function formatPrice(value, currency = "USD") {
  const rounded = Math.round(value * 100) / 100;
  return currency === "USD" ? `$${rounded}` : `${rounded} ${currency}`;
}

function formatRub(value) {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

function formatRate(rate) {
  return rate.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRateDate(isoDate) {
  const parts = String(isoDate || "").split("-");
  return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : "";
}

// Курс применим только к долларовым ценам.
function rubPrice(offer) {
  if (!state.fx || !offer || offer.currency !== "USD") {
    return null;
  }
  return offer.price * state.fx.rate;
}

function describeRate() {
  const date = formatRateDate(state.fx.rateDate);
  return `по курсу ЦБ ${formatRate(state.fx.rate)} ₽/$${date ? ` на ${date}` : ""}`;
}

function updateRubView() {
  const rub = rubPrice(state.selected);

  if (rub !== null) {
    el.selectionPriceRub.textContent = formatRub(rub);
    el.fxNote.textContent = `${describeRate()}, ориентировочно`;
    return;
  }

  el.selectionPriceRub.textContent = "—";
  if (state.fxStatus === "loading") {
    el.fxNote.textContent = "курс загружается…";
  } else if (state.fxStatus === "failed") {
    el.fxNote.textContent = "курс недоступен";
  } else {
    el.fxNote.textContent = "";
  }
}

function updateShippingView() {
  if (!state.selected) {
    el.selectionShipping.textContent = "—";
    el.shippingNote.textContent = "";
    return;
  }

  if (state.selected.shippingRub == null) {
    el.selectionShipping.textContent = "—";
    el.shippingNote.textContent = "тариф недоступен";
    return;
  }

  el.selectionShipping.textContent = formatRub(state.selected.shippingRub);
  const weight = state.selected.weightKg;
  const weightText = weight
    ? `вес ${weight.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} кг`
    : "вес не указан";
  el.shippingNote.textContent = `${weightText}, Зона 1, до двери`;
}

function buildInquiryText() {
  if (!state.selected) {
    return `Здравствуйте! Интересует ${product.name}.`;
  }

  const lines = [
    "Здравствуйте! Хочу заказать:",
    `${product.brand} ${product.name}`,
    `Фасовка: ${state.selected.size}`,
    `Цена: ${formatPrice(state.selected.price, state.selected.currency)}`,
  ];

  // Курс фиксируется в тексте: к моменту ответа он уже может измениться.
  const rub = rubPrice(state.selected);
  if (rub !== null) {
    lines.push(`Цена в рублях: ${formatRub(rub)} (${describeRate()})`);
  }

  if (state.selected.shippingRub != null) {
    lines.push(`Доставка от: ${formatRub(state.selected.shippingRub)} (Зона 1, до двери)`);
  }
  if (rub !== null && state.selected.shippingRub != null) {
    lines.push(`Итого от: ${formatRub(rub + state.selected.shippingRub)}`);
  }
  lines.push(`Ссылка: ${window.location.href}`);

  return lines.join("\n");
}

function updateContactLinks() {
  const encoded = encodeURIComponent(buildInquiryText());
  el.ctaTelegram.href = `https://t.me/${TELEGRAM_USERNAME}?text=${encoded}`;
  el.ctaWhatsapp.href = `https://wa.me/${WHATSAPP_PHONE}?text=${encoded}`;
}

function updateSelectionView() {
  if (!state.selected) {
    el.selectionSize.textContent = "—";
    el.selectionPrice.textContent = "—";
  } else {
    el.selectionSize.textContent = state.selected.size;
    el.selectionPrice.textContent = formatPrice(
      state.selected.price,
      state.selected.currency
    );
  }

  updateRubView();
  updateShippingView();
  updateContactLinks();
}

function renderVariants() {
  el.sizesList.innerHTML = "";

  if (!product.offers || product.offers.length === 0) {
    el.sizesList.textContent = "Нет доступных фасовок.";
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const offer of product.offers) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "size-btn";
    if (state.selected && state.selected.productId === offer.productId) {
      btn.classList.add("is-selected");
    }

    const main = document.createElement("div");
    main.className = "size-main";
    main.textContent = offer.size;

    const price = document.createElement("div");
    price.className = "size-price";
    price.textContent = formatPrice(offer.price, offer.currency);

    btn.append(main, price);
    btn.addEventListener("click", () => {
      state.selected = offer;
      renderVariants();
      updateSelectionView();
    });

    fragment.appendChild(btn);
  }

  el.sizesList.appendChild(fragment);
}

function pickDefaultSelection() {
  if (!product.offers || product.offers.length === 0) {
    return null;
  }
  return product.offers.reduce((best, o) => (o.price < best.price ? o : best), product.offers[0]);
}

// fx.json обновляется отдельным ежедневным воркфлоу и лежит на своём домене.
async function loadFxRate() {
  try {
    const response = await fetch(FX_URL, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Не удалось загрузить курс: ${response.status}`);
    }
    const payload = await response.json();
    const rate = Number(payload.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error(`Некорректный курс в ${FX_URL}: ${payload.rate}`);
    }
    state.fx = { rate, rateDate: String(payload.rateDate || "") };
    state.fxStatus = "ready";
  } catch (error) {
    state.fx = null;
    state.fxStatus = "failed";
    console.error(error);
  }
  updateSelectionView();
}

function init() {
  state.selected = pickDefaultSelection();
  renderVariants();
  updateSelectionView();
  loadFxRate();
}

init();

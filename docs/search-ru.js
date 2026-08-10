// Названия товаров у iHerb английские, поэтому запрос «магний» без словаря
// не находит ничего, хотя таких товаров в каталоге десятки. Здесь русский
// запрос расширяется английскими терминами: ищется и то, и другое.
//
// Словарь собран по реальному содержимому каталога — по самым частым словам
// в названиях. Новые строки добавляются сюда, пересобирать каталог не нужно.

const SEARCH_SYNONYMS = {
  // витамины и минералы
  "витамин": ["vitamin"],
  "витамины": ["vitamin"],
  "мультивитамин": ["multivitamin"],
  "магний": ["magnesium"],
  "глицинат": ["glycinate"],
  "цитрат": ["citrate"],
  "кальций": ["calcium"],
  "цинк": ["zinc"],
  "железо": ["iron"],
  "селен": ["selenium"],
  "калий": ["potassium"],
  "йод": ["iodine", "kelp"],
  "хром": ["chromium"],
  "медь": ["copper"],
  "марганец": ["manganese"],
  "биотин": ["biotin"],
  "фолиевая": ["folate", "folic"],
  "ниацин": ["niacin"],
  "рибофлавин": ["riboflavin"],
  "тиамин": ["thiamine"],

  // жиры и кислоты
  "омега": ["omega"],
  "рыбий жир": ["fish oil", "omega"],
  "жир": ["oil"],
  "масло": ["oil", "butter"],
  "льняное": ["flax"],
  "криль": ["krill"],
  "лецитин": ["lecithin"],
  "кислота": ["acid"],
  "гиалуроновая": ["hyaluronic"],
  "аминокислоты": ["amino"],
  "креатин": ["creatine"],
  "глютамин": ["glutamine"],
  "аргинин": ["arginine"],
  "карнитин": ["carnitine"],
  "таурин": ["taurine"],
  "триптофан": ["tryptophan"],
  "теанин": ["theanine"],

  // популярные добавки
  "коллаген": ["collagen"],
  "пробиотик": ["probiotic"],
  "пробиотики": ["probiotic"],
  "пребиотик": ["prebiotic"],
  "клетчатка": ["fiber", "psyllium"],
  "куркума": ["turmeric", "curcumin"],
  "куркумин": ["curcumin"],
  "имбирь": ["ginger"],
  "чеснок": ["garlic"],
  "женьшень": ["ginseng"],
  "гинкго": ["ginkgo"],
  "эхинацея": ["echinacea"],
  "расторопша": ["milk thistle"],
  "спирулина": ["spirulina"],
  "хлорелла": ["chlorella"],
  "грибы": ["mushroom", "reishi", "chaga"],
  "рейши": ["reishi"],
  "кофермент": ["coq", "coenzyme"],
  "коэнзим": ["coq", "coenzyme"],
  "мелатонин": ["melatonin"],
  "глюкозамин": ["glucosamine"],
  "хондроитин": ["chondroitin"],
  "лютеин": ["lutein"],
  "ресвератрол": ["resveratrol"],
  "кверцетин": ["quercetin"],
  "астаксантин": ["astaxanthin"],
  "антиоксидант": ["antioxidant"],
  "электролиты": ["electrolyte"],
  "протеин": ["protein", "whey"],
  "белок": ["protein"],
  "сыворотка": ["whey", "serum"],
  "кофеин": ["caffeine"],

  // уход и красота
  "кожа": ["skin"],
  "лицо": ["face", "facial"],
  "крем": ["cream"],
  "сыворотка для лица": ["serum"],
  "шампунь": ["shampoo"],
  "кондиционер": ["conditioner"],
  "волосы": ["hair"],
  "ногти": ["nail"],
  "мыло": ["soap"],
  "гель": ["gel"],
  "зубная паста": ["toothpaste"],
  "зубная щетка": ["toothbrush"],
  "зубная щётка": ["toothbrush"],
  "дезодорант": ["deodorant"],
  "солнцезащитный": ["sunscreen", "spf"],
  "маска": ["mask"],
  "губы": ["lip"],
  "бальзам": ["balm"],
  "лосьон": ["lotion"],
  "скраб": ["scrub"],
  "тело": ["body"],

  // еда и напитки
  "чай": ["tea"],
  "кофе": ["coffee"],
  "мед": ["honey"],
  "мёд": ["honey"],
  "шоколад": ["chocolate", "cacao", "cocoa"],
  "какао": ["cacao", "cocoa"],
  "батончик": ["bar"],
  "орехи": ["nut", "almond", "cashew"],
  "миндаль": ["almond"],
  "кокос": ["coconut"],
  "семена": ["seed"],
  "соль": ["salt"],
  "сахар": ["sugar"],
  "стевия": ["stevia"],
  "мука": ["flour"],
  "каша": ["cereal", "oat", "grain"],
  "овсянка": ["oat"],
  "ягоды": ["berry"],
  "клубника": ["strawberry"],
  "лимон": ["lemon"],
  "мята": ["mint"],
  "ваниль": ["vanilla"],

  // формы и аудитория
  "капсулы": ["capsule", "softgel"],
  "таблетки": ["tablet"],
  "жевательные": ["gummies", "chewable"],
  "порошок": ["powder"],
  "детский": ["kids", "children", "baby"],
  "детям": ["kids", "children", "baby"],
  "дети": ["kids", "children", "baby"],
  "беременность": ["prenatal"],
  "сон": ["sleep"],
  "иммунитет": ["immune"],
  "суставы": ["joint"],
  "сердце": ["heart", "cardio"],
  "печень": ["liver"],
  "мозг": ["brain", "cognitive"],
  "зрение": ["eye", "vision"],
  "энергия": ["energy"],
  "спорт": ["sport"],
};

/**
 * Расширяет запрос английскими терминами.
 * Совпадение двустороннее: «магни» находит ключ «магний», а «магний глицинат»
 * тоже его находит — покупатель редко набирает слово целиком и в одиночку.
 */
export function expandQuery(query) {
  const needle = String(query || "").toLowerCase().trim();
  if (!needle) {
    return [];
  }

  const matched = Object.keys(SEARCH_SYNONYMS).filter(
    (ru) => ru.includes(needle) || needle.includes(ru)
  );

  // «рыбий жир» совпадает и с ключом «жир», из-за чего в выдачу попадали все
  // масла подряд. Если один ключ вложен в другой, берём только длинный.
  const specific = matched.filter(
    (ru) => !matched.some((other) => other !== ru && other.includes(ru))
  );

  const terms = new Set([needle]);
  for (const ru of specific) {
    for (const term of SEARCH_SYNONYMS[ru]) {
      terms.add(term);
    }
  }
  return [...terms];
}

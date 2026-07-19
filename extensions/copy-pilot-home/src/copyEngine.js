/**
 * CopyPilot copy engine — rich, emotional, sales-first AIDA.
 *
 * Style goals (matches merchant's reference copy):
 *  - Emoji-rich, attention-grabbing headline with a hook question.
 *  - Immersive intro that speaks TO the shopper and paints a scene.
 *  - "Why it's different" block with 3 bold feature names + vivid benefits.
 *  - "Imagine…" sensory paragraph that builds desire.
 *  - Urgency + strong CTA.
 *  - SEO keyword woven in naturally (title, intro, meta).
 *
 * Hard rules:
 *  - Never describe the copy itself, never leak admin notes.
 *  - Never invent shipping / Google / awards / guarantees.
 *  - Short scannable blocks — never one long paragraph.
 */

import { marketFor } from "./markets.js";

const BAN =
  /free shipping|ücretsiz kargo|ucretsiz kargo|\bgoogle\b|award[- ]winning|money[- ]back|env[ií]o gratis|kostenloser versand|livraison gratuite/i;

function clean(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function clamp(s, n) {
  const t = clean(s);
  return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, "").trim() + "…";
}
function cap(s) {
  const t = clean(s);
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}
function slugify(s) {
  return (
    String(s || "")
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
      .replace(/ı/g, "i").replace(/ö/g, "o").replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "product"
  );
}
function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

/* ---------- Title case + tokens (visually clean, brand-aware) ---------- */

const SMALL_WORDS = new Set([
  "the", "a", "an", "of", "and", "or", "for", "to", "in", "on", "with", "at", "by",
  "ve", "ile", "için", "de", "da", "the",
  "de", "la", "el", "y", "en", "del",
  "le", "les", "du", "des", "et", "au", "aux",
]);

function locUpper(s, lang) {
  try { return String(s).toLocaleUpperCase(lang === "tr" ? "tr-TR" : undefined); } catch (e) { return String(s).toUpperCase(); }
}
function locLower(s, lang) {
  try { return String(s).toLocaleLowerCase(lang === "tr" ? "tr-TR" : undefined); } catch (e) { return String(s).toLowerCase(); }
}

/** Visually harmonious Title Case: capitalizes the first letter of EVERY word
 *  (including "The", "Of"…), handles hyphenated words (Multi-Managed) and
 *  preserves short ALL-CAPS acronyms (XL, 3D, USB). */
function titleCase(str, lang) {
  const words = clean(str).split(/\s+/).filter(Boolean);
  return words
    .map((w) => {
      if (/^[A-Z0-9]{2,4}$/.test(w)) return w; // keep acronyms as-is
      return w
        .split("-")
        .map((part) => {
          const lower = locLower(part, lang);
          if (!lower) return lower;
          return locUpper(lower.charAt(0), lang) + lower.slice(1);
        })
        .join("-");
    })
    .join(" ");
}

function tokenize(s) {
  return locLower(clean(s), "en")
    .split(/[^a-z0-9çğıöşü]+/i)
    .filter((t) => t && t.length > 1);
}

/* ---------- Category detection ---------- */

const CATEGORY_RULES = [
  { key: "snowboard", re: /snowboard|kayak|\bski\b|board/i },
  { key: "shoes", re: /shoe|sneaker|boot|ayakkab|trainer/i },
  { key: "apparel", re: /shirt|tee|hoodie|jacket|dress|elbise|gömlek|pant|jean|coat|sweater|kazak|mont/i },
  { key: "bag", re: /bag|backpack|çanta|wallet|cüzdan|purse|sırt/i },
  { key: "beauty", re: /cream|serum|lotion|makeup|kozmetik|cilt|skin|parf[üu]m|perfume|shampoo|krem/i },
  { key: "electronics", re: /phone|laptop|headphone|kulaklık|speaker|watch|saat|camera|kamera|charger|tv|monitor|telefon/i },
  { key: "home", re: /lamp|chair|table|sofa|mug|pillow|yastık|masa|sandalye|decor|kitchen|mutfak|lamba|koltuk/i },
  { key: "jewelry", re: /ring|necklace|bracelet|yüzük|kolye|bileklik|earring|küpe|takı/i },
];
function detectCategory(product) {
  const hay = [product.productType, product.title, (product.tags || []).join(" ")].filter(Boolean).join(" ");
  const hit = CATEGORY_RULES.find((r) => r.re.test(hay));
  return hit ? hit.key : "generic";
}

/* ---------- Rich localized content ---------- */
/* CONTENT[lang] = { frame, categories: { <cat>: pack } }                  */
/* pack: { emoji, hook, intro(title,vendor,kw), typeWord, features[3],     */
/*         imagine(title), urgency, cta }                                  */

function mkPack(o) { return o; }

const CONTENT = {
  tr: {
    frame: {
      differ: (t) => `Peki, bu ${t} neden diğerlerinden farklı? 🤔`,
      imagineLabel: "Hayal edin…",
      metaLead: (title, kw) => `${title} — ${kw ? cap(kw) + " için " : ""}performans, tasarım ve his bir arada. Farkı ilk kullanımda yaşa.`,
    },
    categories: {
      snowboard: mkPack({
        emoji: "🏂", typeWord: "snowboard",
        hook: "Sınırları Yeniden Çizmeye Hazır mısın?",
        intro: (title) =>
          `Dağların zirvesinde sıradan bir sürüşle yetinmek istemeyenler buraya! 🏔️✨ Karşınızda en zorlu pistleri, en yumuşak toz karı ve sınır tanımayan parkurları tek bir tahtada domine etmeniz için tasarlanan ${title}. Göz alıcı duruşuyla daha telesiyej sırasındayken tüm bakışları üzerinize çekecek. 😎🔥`,
        features: [
          { icon: "⚙️", name: "Çok Yönlü Sürüş Profili", desc: "Farklı kar koşullarına ve sürüş stillerine anında uyum sağlayan dengeli hibrit yapı." },
          { icon: "🛡️", name: "Dayanıklı ve Esnek Çekirdek", desc: "Hafifliğiyle yüksek hızlarda sarsıntısız kontrol, sağlamlığıyla en sert atlayışlarda güven verir." },
          { icon: "🛹", name: "Hassas Kenar Tutuşu", desc: "Buzlu zeminlerde bile ray üzerinde gidiyormuş hissi veren keskin kenar kesimiyle maksimum güvenlik." },
        ],
        imagine: (title) =>
          `Sabahın ilk ışıklarında, el değmemiş bembeyaz bir pistin tepesindesiniz. Rüzgar yüzünüze çarparken altınızdaki güce tamamen güveniyorsunuz. 💨 Her dönüşte kusursuz bir akış, her rampada havada süzülme hissi… ${title} sadece bir ekipman değil; dağdaki potansiyelinizi sonuna kadar açığa çıkaran en yakın yol arkadaşınız. 🏆🏂`,
        urgency: "Zirvenin hakimi olmak için daha fazla bekleme! ⏳ Kış sezonu tüm hızıyla sürerken yerini şimdiden al.",
        cta: 'Hemen "Sepete Ekle" butonuna tıkla, benzersiz bir kış macerasına ilk adımını at! 📦💨',
      }),
      shoes: mkPack({
        emoji: "👟", typeWord: "ayakkabı",
        hook: "Her Adımda Fark Yaratmaya Hazır mısın?",
        intro: (title) =>
          `Gün boyu ayakta olanlar, konfordan ödün vermek istemeyenler buraya! ✨ ${title} ile her adım hem şık hem de inanılmaz rahat. Sokakta, işte, yolda… nereye gidersen git tarzını konuştur. 😎`,
        features: [
          { icon: "☁️", name: "Bulut Gibi Taban", desc: "Her adımda darbeyi emen yastıklama ile saatlerce yürüsen bile ayakların yorulmaz." },
          { icon: "🌬️", name: "Nefes Alan Yapı", desc: "Hava akışını artıran iç tasarım sayesinde gün boyu ferah ve kuru bir his." },
          { icon: "🛡️", name: "Güvenli Tutuş", desc: "Kaymayı azaltan dış taban ile ıslak zeminde bile emin adımlar." },
        ],
        imagine: (title) =>
          `Sabah kapıdan çıkıyorsun, ayağında hiç yokmuş gibi hafif ama seni saran bir destek. 🌆 Kaldırımlar, merdivenler, uzun yürüyüşler… hiçbiri artık bir yük değil. ${title} sadece bir ayakkabı değil; güne rahat ve özgüvenli başlamanın yolu. 🔥`,
        urgency: "Rahatlığı ertelemek için bir sebep yok! ⏳ Favori numaralar hızla tükeniyor.",
        cta: 'Hemen "Sepete Ekle" de, ayaklarına hak ettiği konforu armağan et! 📦',
      }),
      apparel: mkPack({
        emoji: "✨", typeWord: "parça",
        hook: "Gardırobunun Yeni Favorisi Burada!",
        intro: (title) =>
          `Sıradanlıktan sıkılanlar, tarzıyla fark yaratmak isteyenler buraya! 🔥 ${title} ile hem rahat hem de her ortama yakışan bir duruş yakala. Sabah giy, akşama kadar üzerinden çıkarmak istemeyeceksin. 😍`,
        features: [
          { icon: "🧵", name: "Tene Yumuşak Kumaş", desc: "İlk dokunuşta hissedilen premium doku; gün boyu tahriş etmeyen nazik bir his." },
          { icon: "💧", name: "Formunu Koruyan Yapı", desc: "Onlarca yıkamadan sonra bile solmayan renk ve bozulmayan kesim." },
          { icon: "🎯", name: "Çok Yönlü Kombin", desc: "Günlük de, özel de… tek parçayla onlarca farklı stil oluştur." },
        ],
        imagine: (title) =>
          `Aynanın karşısına geçiyorsun ve gülümsüyorsun. 😊 Üzerine tam oturan, seni yansıtan bir duruş. Sokakta bakışlar, kombinini soran arkadaşlar… ${title} sadece bir kıyafet değil; kendini en iyi hissettiğin hâlin. 💫`,
        urgency: "Bu tarzı kaçırma! ⏳ Sezonun en sevilen bedenleri hızla azalıyor.",
        cta: 'Hemen "Sepete Ekle" ve gardırobunu bir üst seviyeye taşı! 🛍️',
      }),
      bag: mkPack({
        emoji: "🎒", typeWord: "çanta",
        hook: "Her Şeyini Şıkça Taşımaya Hazır mısın?",
        intro: (title) =>
          `Düzeni ve tarzı bir arada isteyenler buraya! ✨ ${title} ile eşyaların hem güvende hem de her an el altında. Şehirde, yolda, işte… yanından ayırmak istemeyeceksin. 😎`,
        features: [
          { icon: "🗂️", name: "Akıllı Bölmeler", desc: "Telefonundan dizüstüne her şeye özel, düzenini bozmayan pratik gözler." },
          { icon: "💪", name: "Konforlu Taşıma", desc: "Omuzlarını yormayan ergonomik askılar ile gün boyu rahat kullanım." },
          { icon: "🛡️", name: "Dayanıklı Malzeme", desc: "Aşınmaya ve günlük yıpranmaya karşı uzun ömürlü, sağlam yapı." },
        ],
        imagine: (title) =>
          `Sabah aceleyle çıkıyorsun ama her şey yerli yerinde. 🌆 Aradığını saniyede buluyor, kalabalıkta tarzınla öne çıkıyorsun. ${title} sadece bir çanta değil; gününü toparlayan sessiz kahraman. 🔥`,
        urgency: "Düzenli ve şık bir güne başlamak için bekleme! ⏳ Popüler renkler hızla tükeniyor.",
        cta: 'Hemen "Sepete Ekle" ve yükünü hafiflet! 📦',
      }),
      beauty: mkPack({
        emoji: "✨", typeWord: "ürün",
        hook: "Cildinle Barışmaya Hazır mısın?",
        intro: (title) =>
          `Aynaya baktığında ışıldamak isteyenler buraya! 💛 ${title} ile bakım rutinin hem keyifli hem de etkili. Az miktarla büyük fark; her kullanımda kendini daha iyi hissedeceksin. 😊`,
        features: [
          { icon: "💧", name: "Hafif ve Hızlı Emilim", desc: "Cilde anında yayılan, yağlı his bırakmayan ferah dokunuş." },
          { icon: "🌿", name: "Özenli Formül Hissi", desc: "Günlük kullanıma uygun, dengeli ve nazik bir bakım deneyimi." },
          { icon: "⏳", name: "Verimli Kullanım", desc: "Küçük bir miktar bile uzun süre yeter; her damla değerli." },
        ],
        imagine: (title) =>
          `Sabah rutininin ortasındasın, cildin taze ve canlı. ✨ Aynada yakaladığın o ışıltı bütün güne yansıyor. ${title} sadece bir ürün değil; kendine ayırdığın o küçük ama güçlü an. 💫`,
        urgency: "Cildine iyi bakmayı ertelemek için sebep yok! ⏳ Favori ürünler hızla tükeniyor.",
        cta: 'Hemen "Sepete Ekle" ve parlamaya başla! 🛍️',
      }),
      electronics: mkPack({
        emoji: "⚡", typeWord: "cihaz",
        hook: "Teknolojiyle Aranı Bir Üst Seviyeye Taşımaya Hazır mısın?",
        intro: (title) =>
          `Takılmalardan, yavaşlıktan sıkılanlar buraya! 🔥 ${title} ile her şey daha hızlı, daha akıcı ve daha keyifli. Kur, bağlan ve farkın tadını çıkar. 😎`,
        features: [
          { icon: "🚀", name: "Akıcı Performans", desc: "Günlük kullanımda takılmadan, güven veren pürüzsüz bir deneyim." },
          { icon: "🔌", name: "Kolay Kurulum", desc: "Dakikalar içinde hazır; teknik bilgi gerektirmeyen sade kullanım." },
          { icon: "🛡️", name: "Dayanıklı Yapı", desc: "Uzun ömürlü tasarımıyla her gün yanında, yıllarca güvenle." },
        ],
        imagine: (title) =>
          `Bir düğmeye basıyorsun ve her şey tam istediğin gibi çalışıyor. ⚡ Ne bekleme ne de baş ağrısı; sadece keyif. ${title} sadece bir cihaz değil; gününü kolaylaştıran akıllı bir ortak. 💡`,
        urgency: "Daha akıllı bir güne başlamak için bekleme! ⏳ İlgi yüksek, stoklar hızla eriyor.",
        cta: 'Hemen "Sepete Ekle" ve farkı hisset! 📦',
      }),
      home: mkPack({
        emoji: "🏡", typeWord: "parça",
        hook: "Evine Ruh Katmaya Hazır mısın?",
        intro: (title) =>
          `Yaşam alanını kişiselleştirmek isteyenler buraya! ✨ ${title} ile evin hem daha şık hem de daha sıcak. Her köşe, her misafir bu detayı konuşacak. 😍`,
        features: [
          { icon: "🎨", name: "Şık Tasarım", desc: "Her dekora uyum sağlayan zamansız ve modern bir görünüm." },
          { icon: "💪", name: "Sağlam Yapı", desc: "Günlük kullanıma dayanan, uzun ömürlü ve güvenilir malzeme." },
          { icon: "🧼", name: "Pratik Kullanım", desc: "Kolay temizlenen, bakımı zahmetsiz akıllı tasarım." },
        ],
        imagine: (title) =>
          `Akşam eve geliyorsun, ışığı açıyorsun ve gülümsüyorsun. 🌙 Her şey tam yerinde, sıcacık ve seni yansıtıyor. ${title} sadece bir eşya değil; evini 'senin' yapan detay. 💫`,
        urgency: "Evini yenilemeyi ertelemek için sebep yok! ⏳ Sevilen modeller hızla tükeniyor.",
        cta: 'Hemen "Sepete Ekle" ve evine dokun! 🛋️',
      }),
      jewelry: mkPack({
        emoji: "💎", typeWord: "parça",
        hook: "Işıltını Tamamlamaya Hazır mısın?",
        intro: (title) =>
          `Zarafeti detaylarda arayanlar buraya! ✨ ${title} ile her kombine incelikli bir dokunuş kat. Sade ama akılda kalan; seni sen yapan o özel parça. 😍`,
        features: [
          { icon: "✨", name: "Zarif Detay", desc: "Her kıyafeti tamamlayan, gözden kaçmayan incelikli tasarım." },
          { icon: "🪶", name: "Rahat Kullanım", desc: "Cilde nazik, gün boyu takılabilen hafif ve konforlu his." },
          { icon: "⏳", name: "Kalıcı Parlaklık", desc: "Özenli işçilikle uzun süre ilk günkü gibi ışıldayan görünüm." },
        ],
        imagine: (title) =>
          `Aynaya son bir kez bakıyorsun ve o küçük parıltı her şeyi tamamlıyor. 💫 Bakışlar sana dönüyor, kendini özel hissediyorsun. ${title} sadece bir aksesuar değil; tarzının imzası. 💎`,
        urgency: "Işıltını ertelemek için sebep yok! ⏳ En sevilen tasarımlar hızla tükeniyor.",
        cta: 'Hemen "Sepete Ekle" ve zarafetini tamamla! 🛍️',
      }),
      generic: mkPack({
        emoji: "✨", typeWord: "ürün",
        hook: "Farkı Yaşamaya Hazır mısın?",
        intro: (title) =>
          `Kaliteden ve iyi bir deneyimden ödün vermek istemeyenler buraya! 🔥 ${title} ile günlük kullanımda gerçek bir fark hissedeceksin. İşlevi ve tarzı bir arada sunar. 😎`,
        features: [
          { icon: "⭐", name: "Özenli İşçilik", desc: "Detaylara gösterilen özenle uzun ömürlü ve güvenilir bir kalite." },
          { icon: "🎯", name: "Günlük Konfor", desc: "Hayatına zahmetsizce uyum sağlayan pratik ve rahat kullanım." },
          { icon: "🎨", name: "Şık Tasarım", desc: "Her ortama yakışan sade ve modern bir görünüm." },
        ],
        imagine: (title) =>
          `Kullanmaya başladığın an farkı hissediyorsun. ✨ İşini kolaylaştırıyor, gününe değer katıyor. ${title} sadece bir ürün değil; doğru seçim yapmanın verdiği o güzel his. 💫`,
        urgency: "Doğru seçimi ertelemek için sebep yok! ⏳ İlgi yüksek, hızlı davran.",
        cta: 'Hemen "Sepete Ekle" ve farkı kendin gör! 📦',
      }),
    },
  },

  en: {
    frame: {
      differ: (t) => `So, what makes this ${t} different? 🤔`,
      imagineLabel: "Just imagine…",
      metaLead: (title, kw) => `${title} — ${kw ? cap(kw) + ": " : ""}performance, design and feel in one. Discover the difference from day one.`,
    },
    categories: {
      snowboard: mkPack({
        emoji: "🏂", typeWord: "snowboard",
        hook: "Ready to Redraw Your Limits?",
        intro: (title) =>
          `For riders who refuse an ordinary run at the top of the mountain! 🏔️✨ Meet ${title}, built to help you dominate the toughest slopes, the softest powder and boundary-pushing lines on a single board. Its striking looks turn heads before you even leave the lift. 😎🔥`,
        features: [
          { icon: "⚙️", name: "Versatile Ride Profile", desc: "A balanced hybrid shape that adapts instantly to different snow conditions and riding styles." },
          { icon: "🛡️", name: "Durable, Flexible Core", desc: "Light enough for smooth control at speed, tough enough to absorb the hardest landings." },
          { icon: "🛹", name: "Precise Edge Grip", desc: "A razor-sharp edge that feels like riding on rails, even on icy terrain — maximum confidence." },
        ],
        imagine: (title) =>
          `First light, and you're standing on top of an untouched, all-white slope. The wind hits your face and you trust the power beneath you completely. 💨 A perfect flow through every turn, a floating feeling off every jump… ${title} isn't just gear; it's the partner that unlocks your full potential on the mountain. 🏆🏂`,
        urgency: "Don't wait to own the summit! ⏳ Winter is in full swing — claim your spot now.",
        cta: 'Tap "Add to Cart" now and take your first step into an unforgettable winter adventure! 📦💨',
      }),
      shoes: mkPack({
        emoji: "👟", typeWord: "pair",
        hook: "Ready to Make Every Step Count?",
        intro: (title) =>
          `For anyone on their feet all day who won't compromise on comfort! ✨ With ${title}, every step is both stylish and incredibly comfortable. Wherever you go, let your style do the talking. 😎`,
        features: [
          { icon: "☁️", name: "Cloud-Like Sole", desc: "Impact-absorbing cushioning that keeps your feet fresh even after hours of walking." },
          { icon: "🌬️", name: "Breathable Build", desc: "Airflow-focused interior for an all-day cool, dry feel." },
          { icon: "🛡️", name: "Secure Grip", desc: "A slip-resistant outsole for sure steps, even on wet ground." },
        ],
        imagine: (title) =>
          `You step out in the morning with support so light it feels like nothing at all. 🌆 Sidewalks, stairs, long walks — none of it slows you down. ${title} isn't just a shoe; it's how you start the day comfortable and confident. 🔥`,
        urgency: "No reason to delay comfort! ⏳ Popular sizes are selling fast.",
        cta: 'Tap "Add to Cart" and give your feet the comfort they deserve! 📦',
      }),
      apparel: mkPack({
        emoji: "✨", typeWord: "piece",
        hook: "Your Wardrobe's New Favorite Is Here!",
        intro: (title) =>
          `For anyone tired of ordinary who wants their style to stand out! 🔥 With ${title}, you get a look that's comfortable and works everywhere. Put it on in the morning and you won't want to take it off. 😍`,
        features: [
          { icon: "🧵", name: "Skin-Soft Fabric", desc: "A premium feel from the first touch — gentle and non-irritating all day long." },
          { icon: "💧", name: "Shape-Keeping Build", desc: "Colors that don't fade and a cut that holds up wash after wash." },
          { icon: "🎯", name: "Endlessly Versatile", desc: "Dress it up or down — dozens of looks from a single piece." },
        ],
        imagine: (title) =>
          `You catch yourself smiling in the mirror. 😊 A fit that's truly yours. Glances on the street, friends asking where you got it… ${title} isn't just clothing; it's you at your most confident. 💫`,
        urgency: "Don't miss this look! ⏳ The season's favorite sizes are going fast.",
        cta: 'Tap "Add to Cart" and level up your wardrobe! 🛍️',
      }),
      bag: mkPack({
        emoji: "🎒", typeWord: "bag",
        hook: "Ready to Carry It All in Style?",
        intro: (title) =>
          `For those who want order and style together! ✨ With ${title}, your essentials stay safe and always within reach. City, road, work — you won't want to put it down. 😎`,
        features: [
          { icon: "🗂️", name: "Smart Compartments", desc: "Dedicated pockets for everything from phone to laptop, keeping you organized." },
          { icon: "💪", name: "Comfortable Carry", desc: "Ergonomic straps that stay easy on your shoulders all day." },
          { icon: "🛡️", name: "Durable Materials", desc: "Built to resist wear and daily use for the long haul." },
        ],
        imagine: (title) =>
          `You rush out in the morning, yet everything is in its place. 🌆 You find what you need in seconds and stand out in the crowd. ${title} isn't just a bag; it's the quiet hero of your day. 🔥`,
        urgency: "Don't wait for an organized, stylish day! ⏳ Popular colors sell out fast.",
        cta: 'Tap "Add to Cart" and lighten your load! 📦',
      }),
      beauty: mkPack({
        emoji: "✨", typeWord: "product",
        hook: "Ready to Glow?",
        intro: (title) =>
          `For everyone who wants to shine when they look in the mirror! 💛 With ${title}, your routine is both enjoyable and effective. A little goes a long way — you'll feel better with every use. 😊`,
        features: [
          { icon: "💧", name: "Light, Fast Absorption", desc: "Spreads instantly with a fresh, non-greasy finish." },
          { icon: "🌿", name: "Thoughtful Formula Feel", desc: "A balanced, gentle experience made for daily use." },
          { icon: "⏳", name: "Goes a Long Way", desc: "A small amount lasts — every drop counts." },
        ],
        imagine: (title) =>
          `Mid-routine, your skin feels fresh and alive. ✨ That glow in the mirror follows you all day. ${title} isn't just a product; it's the small but powerful moment you give yourself. 💫`,
        urgency: "No reason to delay great skin! ⏳ Favorites are selling fast.",
        cta: 'Tap "Add to Cart" and start glowing! 🛍️',
      }),
      electronics: mkPack({
        emoji: "⚡", typeWord: "device",
        hook: "Ready to Upgrade How You Do Everything?",
        intro: (title) =>
          `For anyone done with lag and slowdowns! 🔥 With ${title}, everything is faster, smoother and more enjoyable. Set it up, connect, and enjoy the difference. 😎`,
        features: [
          { icon: "🚀", name: "Smooth Performance", desc: "A seamless, reliable experience for everyday use." },
          { icon: "🔌", name: "Easy Setup", desc: "Ready in minutes — simple to use, no tech skills required." },
          { icon: "🛡️", name: "Durable Build", desc: "Designed to stay by your side reliably for years." },
        ],
        imagine: (title) =>
          `You press one button and everything works exactly the way you want. ⚡ No waiting, no headaches — just enjoyment. ${title} isn't just a device; it's a smart partner that makes your day easier. 💡`,
        urgency: "Don't wait for a smarter day! ⏳ Interest is high and stock moves fast.",
        cta: 'Tap "Add to Cart" and feel the difference! 📦',
      }),
      home: mkPack({
        emoji: "🏡", typeWord: "piece",
        hook: "Ready to Give Your Home Some Soul?",
        intro: (title) =>
          `For anyone who wants to personalize their space! ✨ With ${title}, your home feels more stylish and warm. Every corner — and every guest — will notice this detail. 😍`,
        features: [
          { icon: "🎨", name: "Stylish Design", desc: "A timeless, modern look that fits any decor." },
          { icon: "💪", name: "Sturdy Build", desc: "Reliable, long-lasting materials made for everyday use." },
          { icon: "🧼", name: "Practical to Use", desc: "Smart design that's easy to clean and effortless to maintain." },
        ],
        imagine: (title) =>
          `You come home in the evening, turn on the light, and smile. 🌙 Everything is in its place, warm and truly yours. ${title} isn't just an object; it's the detail that makes your home feel like home. 💫`,
        urgency: "No reason to delay a refreshed home! ⏳ Loved styles sell out fast.",
        cta: 'Tap "Add to Cart" and add a touch to your home! 🛋️',
      }),
      jewelry: mkPack({
        emoji: "💎", typeWord: "piece",
        hook: "Ready to Complete Your Sparkle?",
        intro: (title) =>
          `For those who find elegance in the details! ✨ With ${title}, add a refined touch to any look. Simple yet unforgettable — the special piece that makes you, you. 😍`,
        features: [
          { icon: "✨", name: "Elegant Detail", desc: "A refined design that completes every outfit without shouting." },
          { icon: "🪶", name: "Comfortable Wear", desc: "Gentle on the skin and light enough to wear all day." },
          { icon: "⏳", name: "Lasting Shine", desc: "Careful craftsmanship that keeps its glow like day one." },
        ],
        imagine: (title) =>
          `One last look in the mirror, and that little sparkle ties it all together. 💫 Eyes turn your way and you feel special. ${title} isn't just an accessory; it's the signature of your style. 💎`,
        urgency: "No reason to delay your shine! ⏳ The most-loved designs sell out fast.",
        cta: 'Tap "Add to Cart" and complete your elegance! 🛍️',
      }),
      generic: mkPack({
        emoji: "✨", typeWord: "product",
        hook: "Ready to Experience the Difference?",
        intro: (title) =>
          `For anyone who won't compromise on quality and a great experience! 🔥 With ${title}, you'll feel a real difference in everyday use — function and style in one. 😎`,
        features: [
          { icon: "⭐", name: "Careful Craftsmanship", desc: "Attention to detail for reliable, long-lasting quality." },
          { icon: "🎯", name: "Everyday Comfort", desc: "Practical, easy use that fits effortlessly into your life." },
          { icon: "🎨", name: "Clean Design", desc: "A simple, modern look that fits anywhere." },
        ],
        imagine: (title) =>
          `You feel the difference the moment you start using it. ✨ It makes things easier and adds value to your day. ${title} isn't just a product; it's the good feeling of making the right choice. 💫`,
        urgency: "No reason to delay the right choice! ⏳ Interest is high — act fast.",
        cta: 'Tap "Add to Cart" and see the difference yourself! 📦',
      }),
    },
  },
};

/* Generic rich packs for ES / FR / AR / ZH (structure identical). */
CONTENT.es = {
  frame: {
    differ: (t) => `Entonces, ¿qué hace diferente a este ${t}? 🤔`,
    imagineLabel: "Imagina…",
    metaLead: (title, kw) => `${title} — ${kw ? cap(kw) + ": " : ""}rendimiento, diseño y sensación en uno. Descubre la diferencia desde el primer día.`,
  },
  categories: {
    generic: mkPack({
      emoji: "✨", typeWord: "producto",
      hook: "¿Listo para vivir la diferencia?",
      intro: (title) =>
        `¡Para quienes no renuncian a la calidad ni a una gran experiencia! 🔥 Con ${title} notarás una diferencia real en el uso diario: función y estilo en uno solo. 😎`,
      features: [
        { icon: "⭐", name: "Fabricación cuidada", desc: "Atención al detalle para una calidad fiable y duradera." },
        { icon: "🎯", name: "Comodidad diaria", desc: "Un uso práctico y cómodo que se adapta a tu vida." },
        { icon: "🎨", name: "Diseño limpio", desc: "Un aspecto sencillo y moderno que combina con todo." },
      ],
      imagine: (title) =>
        `Notas la diferencia desde el primer momento. ✨ Te facilita el día y le suma valor. ${title} no es solo un producto; es la buena sensación de acertar. 💫`,
      urgency: "¡No hay razón para esperar! ⏳ Mucho interés, actúa rápido.",
      cta: 'Toca "Añadir al carrito" y compruébalo tú mismo. 📦',
    }),
  },
};
CONTENT.fr = {
  frame: {
    differ: (t) => `Alors, qu'est-ce qui rend ce(t) ${t} différent ? 🤔`,
    imagineLabel: "Imaginez…",
    metaLead: (title, kw) => `${title} — ${kw ? cap(kw) + " : " : ""}performance, design et ressenti réunis. Découvrez la différence dès le premier jour.`,
  },
  categories: {
    generic: mkPack({
      emoji: "✨", typeWord: "produit",
      hook: "Prêt à vivre la différence ?",
      intro: (title) =>
        `Pour celles et ceux qui ne transigent ni sur la qualité ni sur l'expérience ! 🔥 Avec ${title}, vous ressentirez une vraie différence au quotidien : fonction et style réunis. 😎`,
      features: [
        { icon: "⭐", name: "Fabrication soignée", desc: "Le souci du détail pour une qualité fiable et durable." },
        { icon: "🎯", name: "Confort au quotidien", desc: "Un usage pratique et agréable qui s'intègre à votre vie." },
        { icon: "🎨", name: "Design épuré", desc: "Un look simple et moderne qui va avec tout." },
      ],
      imagine: (title) =>
        `Vous sentez la différence dès la première utilisation. ✨ Il vous facilite la journée et lui ajoute de la valeur. ${title} n'est pas qu'un produit ; c'est la satisfaction du bon choix. 💫`,
      urgency: "Aucune raison d'attendre ! ⏳ Beaucoup d'intérêt, agissez vite.",
      cta: 'Touchez "Ajouter au panier" et jugez par vous-même. 📦',
    }),
  },
};
CONTENT.ar = {
  frame: {
    differ: (t) => `إذًا، ما الذي يجعل هذا ${t} مختلفًا؟ 🤔`,
    imagineLabel: "تخيّل…",
    metaLead: (title, kw) => `${title} — ${kw ? cap(kw) + ": " : ""}أداء وتصميم وإحساس في منتج واحد. اكتشف الفرق من أول يوم.`,
  },
  categories: {
    generic: mkPack({
      emoji: "✨", typeWord: "المنتج",
      hook: "هل أنت مستعد لتعيش الفرق؟",
      intro: (title) =>
        `لكل من لا يتنازل عن الجودة والتجربة الرائعة! 🔥 مع ${title} ستشعر بفرق حقيقي في الاستخدام اليومي: وظيفة وأناقة في آنٍ واحد. 😎`,
      features: [
        { icon: "⭐", name: "حرفية متقنة", desc: "اهتمام بالتفاصيل لجودة موثوقة تدوم طويلًا." },
        { icon: "🎯", name: "راحة يومية", desc: "استخدام عملي ومريح يناسب حياتك." },
        { icon: "🎨", name: "تصميم أنيق", desc: "مظهر بسيط وعصري يناسب كل مكان." },
      ],
      imagine: (title) =>
        `تشعر بالفرق من أول استخدام. ✨ يسهّل يومك ويضيف له قيمة. ${title} ليس مجرد منتج؛ بل شعور جميل بأنك اخترت الصواب. 💫`,
      urgency: "لا داعي للانتظار! ⏳ الإقبال كبير، بادر بسرعة.",
      cta: 'اضغط "أضف إلى السلة" واكتشف الفرق بنفسك. 📦',
    }),
  },
};
CONTENT.zh = {
  frame: {
    differ: (t) => `那么，这款${t}到底有何不同？🤔`,
    imagineLabel: "试想一下……",
    metaLead: (title, kw) => `${title} —— ${kw ? cap(kw) + "：" : ""}性能、设计与质感合而为一。第一天就感受不同。`,
  },
  categories: {
    generic: mkPack({
      emoji: "✨", typeWord: "产品",
      hook: "准备好感受不同了吗？",
      intro: (title) =>
        `献给不愿在品质与体验上妥协的你！🔥 有了 ${title}，你会在日常使用中感受到真正的不同——实用与格调兼具。😎`,
      features: [
        { icon: "⭐", name: "精细做工", desc: "对细节的用心，带来可靠而耐用的品质。" },
        { icon: "🎯", name: "日常舒适", desc: "实用又舒适，轻松融入你的生活。" },
        { icon: "🎨", name: "简洁设计", desc: "简约现代，百搭任何场景。" },
      ],
      imagine: (title) =>
        `从使用的第一刻起，你就能感受到不同。✨ 它让你的一天更轻松，也更有价值。${title} 不只是一件产品，更是做出正确选择的那份美好。💫`,
      urgency: "没有理由再等！⏳ 关注度很高，尽快行动。",
      cta: '点击"加入购物车"，亲自感受不同。📦',
    }),
  },
};

/* ---------- Dynamic pack: works for ANY product / category ---------- */
/* Builds product-specific copy from the product's own data (type, tags,   */
/* description, vendor) so unlisted categories still get relevant, SEO copy. */

function extractSentences(html) {
  return clean(html)
    .split(/[.!?•\n]+/)
    .map((s) => clean(s))
    .filter((s) => s.length >= 18 && s.length <= 110 && !BAN.test(s));
}

/** Extract concrete feature lines from the product's OWN description.
 *  Prefers real <li> bullets; falls back to sentences. */
function extractFeatureList(html) {
  const raw = String(html || "");
  let items = [];
  const li = raw.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);
  if (li && li.length) {
    items = li.map((x) => clean(x));
  } else {
    items = extractSentences(raw);
  }
  const seen = new Set();
  const out = [];
  items.forEach((s) => {
    const t = clean(s);
    const k = t.toLowerCase();
    if (t.length >= 6 && t.length <= 120 && !BAN.test(t) && !seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  });
  return out.slice(0, 6);
}

const FEATURE_HEADING = {
  tr: "📌 Ürün Özellikleri",
  en: "📌 Product Features",
  es: "📌 Características del producto",
  fr: "📌 Caractéristiques du produit",
  ar: "📌 مواصفات المنتج",
  zh: "📌 产品特性",
};
const FEATURE_EMOJIS = ["✅", "⚡", "💎", "🎯", "🌟", "🔹"];

function pickEmoji(product) {
  const hay = `${product.productType || ""} ${product.title || ""} ${(product.tags || []).join(" ")}`.toLowerCase();
  const map = [
    ["🏂", /snow|ski|board/], ["👟", /shoe|sneaker|boot|ayakkab|trainer/],
    ["👕", /shirt|tee|hoodie|dress|apparel|giy|elbise|gömlek|kazak|mont/],
    ["🎒", /bag|çanta|backpack|sırt|purse|wallet|cüzdan/],
    ["💄", /beauty|cosmet|makyaj|kozmetik|krem|serum|parf|perfume|lotion|shampoo/],
    ["🎧", /head|kulaklık|audio|speaker|hoparl/], ["⌚", /watch|saat/],
    ["📱", /phone|telefon|tablet/], ["💻", /laptop|computer|bilgisayar|monitor/],
    ["📷", /camera|kamera/], ["🏡", /home|\bev\b|furniture|mobil|decor|lamba|masa|koltuk|sandalye|mutfak|kitchen/],
    ["💎", /ring|necklace|jewel|takı|yüzük|kolye|bileklik|küpe|earring/],
    ["🧸", /toy|oyuncak|kids|bebek|child/], ["🍫", /food|snack|çikolata|kahve|coffee|tea|çay|gıda/],
    ["💊", /supplement|vitamin|takviye|protein/], ["🌿", /plant|bitki|garden|bahçe|organic|doğal/],
    ["⚽", /sport|spor|fitness|gym|yoga|outdoor|kamp/], ["🐾", /pet|köpek|kedi|evcil|dog|cat/],
    ["📚", /book|kitap|dergi/], ["🚲", /bike|bisiklet|scooter|cycle/],
    ["🧴", /clean|temizlik|deterjan|hijyen/], ["🕯️", /candle|mum|koku|aroma/],
  ];
  for (const [e, re] of map) if (re.test(hay)) return e;
  return "✨";
}

const DYN = {
  tr: {
    hook: (t) => `En İyi ${cap(t)} Deneyimine Hazır mısın?`,
    intro: (title, t, vendor) =>
      `${vendor ? vendor + " imzasıyla " : ""}${title}, kaliteli bir ${t.toLowerCase()} arayan herkes için tasarlandı. 🔥 Hem günlük kullanımda hem de ilk bakışta fark yaratır; işlevi ve tarzı bir arada sunar. 😎`,
    imagine: (title, t) =>
      `Kullanmaya başladığın an farkı hissediyorsun. ✨ ${title}, sıradan bir ${t.toLowerCase()} olmanın ötesine geçiyor; gününe gerçek bir değer katan, güvenle tercih edeceğin bir seçim oluyor. 💫`,
  },
  en: {
    hook: (t) => `Ready for the Best ${cap(t)} Experience?`,
    intro: (title, t, vendor) =>
      `${vendor ? "by " + vendor + ", " : ""}${title} is made for anyone looking for a great ${t.toLowerCase()}. 🔥 It stands out at first glance and in daily use — function and style in one. 😎`,
    imagine: (title, t) =>
      `You feel the difference the moment you start using it. ✨ ${title} goes beyond being just another ${t.toLowerCase()}; it adds real value to your day and becomes a choice you trust. 💫`,
  },
  es: {
    hook: (t) => `¿Listo para la mejor experiencia en ${t.toLowerCase()}?`,
    intro: (title, t, vendor) =>
      `${vendor ? vendor + " presenta " : ""}${title}, pensado para quienes buscan un gran ${t.toLowerCase()}. 🔥 Destaca a primera vista y en el uso diario: función y estilo en uno. 😎`,
    imagine: (title, t) =>
      `Notas la diferencia desde el primer momento. ✨ ${title} va más allá de un ${t.toLowerCase()} cualquiera; aporta valor real a tu día y se convierte en una elección de confianza. 💫`,
  },
  fr: {
    hook: (t) => `Prêt pour la meilleure expérience ${t.toLowerCase()} ?`,
    intro: (title, t, vendor) =>
      `${vendor ? "signé " + vendor + ", " : ""}${title} est pensé pour qui cherche un excellent ${t.toLowerCase()}. 🔥 Il se distingue au premier regard comme à l'usage : fonction et style réunis. 😎`,
    imagine: (title, t) =>
      `Vous sentez la différence dès la première utilisation. ✨ ${title} dépasse le simple ${t.toLowerCase()} ; il apporte une vraie valeur à votre journée et devient un choix de confiance. 💫`,
  },
  ar: {
    hook: (t) => `هل أنت مستعد لأفضل تجربة ${t}؟`,
    intro: (title, t, vendor) =>
      `${vendor ? "من " + vendor + "، " : ""}${title} مصمم لكل من يبحث عن ${t} رائع. 🔥 يلفت الأنظار من أول نظرة وفي الاستخدام اليومي: وظيفة وأناقة معًا. 😎`,
    imagine: (title, t) =>
      `تشعر بالفرق من أول استخدام. ✨ ${title} يتجاوز كونه مجرد ${t}؛ يضيف قيمة حقيقية ليومك ويصبح خيارًا تثق به. 💫`,
  },
  zh: {
    hook: (t) => `准备好体验最好的${t}了吗？`,
    intro: (title, t, vendor) =>
      `${vendor ? vendor + " 出品的" : ""}${title}，专为寻找出色${t}的你而打造。🔥 无论第一眼还是日常使用都出众——实用与格调兼具。😎`,
    imagine: (title, t) =>
      `从使用的第一刻起，你就能感受到不同。✨ ${title} 不只是一件普通的${t}；它为你的一天带来真正的价值，成为值得信赖的选择。💫`,
  },
};

function dynamicPack(product, lang) {
  const gen = (CONTENT[lang] || CONTENT.en).categories.generic;
  const dyn = DYN[lang] || DYN.en;
  const type = clean(product.productType) || gen.typeWord;

  const descBits = extractSentences(product.descriptionHtml || product.description);
  const tags = (product.tags || [])
    .map((t) => clean(t))
    .filter((t) => t.length > 2 && !BAN.test(t) && !/^\d+$/.test(t));

  const features = [0, 1, 2].map((i) => ({
    icon: gen.features[i].icon,
    // Real product tag as the feature name when available → specificity.
    name: tags[i] ? titleCase(tags[i], lang) : gen.features[i].name,
    // Prefer a real sentence from the product's own description.
    desc: descBits[i] || gen.features[i].desc,
  }));

  return {
    emoji: pickEmoji(product),
    typeWord: type,
    hook: dyn.hook(type),
    intro: (title) => dyn.intro(title, type, clean(product.vendor)),
    features,
    imagine: (title) => dyn.imagine(title, type),
    urgency: gen.urgency,
    cta: gen.cta,
  };
}

function pickContent(lang, category, product) {
  const langBlock = CONTENT[lang] || CONTENT.en;
  const cats = langBlock.categories || {};
  const frame = langBlock.frame || CONTENT.en.frame;
  // Curated pack for known categories; dynamic (product-specific) for the rest.
  if (category && category !== "generic" && cats[category]) {
    return { frame, pack: cats[category] };
  }
  return { frame, pack: dynamicPack(product || {}, lang) };
}

/* ---------- Title / meta / image SEO ---------- */

export function buildSalesTitle(product, keyword, lang) {
  let base = clean(product.title) || "Product";
  const vendor = clean(product.vendor);

  // Keep the brand up front for SEO, unless the title already contains the
  // full vendor phrase (avoids exact duplication).
  if (vendor && !locLower(base, lang).includes(locLower(vendor, lang))) {
    base = `${vendor} ${base}`;
  }

  // Harmonious casing — every word capitalized, no ugly "| keyword" tail.
  return clamp(titleCase(base, lang), 70);
}

export function buildMetaTitle(salesTitle, keyword, lang) {
  const kw = clean(keyword);
  let out = clean(salesTitle) || "Product";
  // Add keyword to the META title only (SEO), and only if it fits cleanly.
  if (kw && !locLower(out, lang).includes(locLower(kw, lang))) {
    const candidate = `${out} – ${titleCase(kw, lang)}`;
    if (candidate.length <= 60) out = candidate;
  }
  return clamp(out, 60);
}
export function buildMetaDescription(product, keyword, lang, country) {
  const { frame } = pickContent(lang, "generic");
  const market = marketFor(country);
  const intent = (market.intent || [])[0] || "";
  const title = clean(product.title);
  const kw = clean(keyword);
  let base = frame.metaLead(title, kw);
  if (intent && !base.toLowerCase().includes(intent.toLowerCase())) base += ` (${intent})`;
  return clamp(base, 160);
}

export function buildImageSeo(product, media, keyword, lang) {
  const title = clean(product.title) || "product";
  const vendor = clean(product.vendor);
  const kw = clean(keyword) || title.split(" ").slice(0, 2).join(" ");
  const slugBase = slugify([vendor, kw || title].filter(Boolean).join("-"));
  const map = {
    tr: ["ana görsel", "detay", "yandan", "kullanımda"],
    en: ["main", "detail", "side view", "in use"],
    es: ["principal", "detalle", "vista lateral", "en uso"],
    fr: ["principale", "détail", "vue de côté", "en situation"],
    ar: ["الرئيسية", "تفاصيل", "من الجانب", "أثناء الاستخدام"],
    zh: ["主图", "细节", "侧面", "使用中"],
  };
  const roles = map[lang] || map.en;
  return (media || []).map((m, i) => {
    const role = roles[i] || roles[roles.length - 1];
    const alt =
      lang === "ar"
        ? clamp(`${title}${vendor ? ` — ${vendor}` : ""} · ${role}`, 120)
        : clamp(`${cap(title)}${vendor ? ` — ${vendor}` : ""} · ${role}`, 120);
    return { id: m.id, url: m.url || "", currentAlt: m.alt || "", alt, filenameSuggestion: `${slugBase}-${i + 1}-${slugify(role)}.jpg` };
  });
}

/* ---------- Rich AIDA HTML ---------- */

export function buildAidaHtml(product, opts) {
  opts = opts || {};
  const lang = opts.language || "tr";
  const keyword = clean(opts.keyword) || "";
  const keywords = (opts.keywords && opts.keywords.length ? opts.keywords : keyword ? [keyword] : [])
    .map((k) => clean(k))
    .filter(Boolean);
  const salesTitle = opts.salesTitle || buildSalesTitle(product, keyword, lang);
  // Headline uses full SEO title; narrative uses product name only (avoids "Vendor … Vendor …").
  const productName = titleCase(clean(product.title) || "Product", lang);
  const category = detectCategory(product);
  const { frame, pack } = pickContent(lang, category, product);
  const typeWord = clean(product.productType) || pack.typeWord;
  const media = (opts.images || []).filter((m) => m.url).slice(0, 3);
  const dir = lang === "ar" ? ' dir="rtl"' : "";

  const img = (m) =>
    m ? `<p><img src="${escapeAttr(m.url)}" alt="${escapeAttr(m.alt || salesTitle)}" style="max-width:100%;height:auto;border-radius:10px;" /></p>` : "";

  let intro = pack.intro(productName);
  const introHay = (intro + " " + productName + " " + salesTitle).toLowerCase();
  const missingKw = keywords.filter((k) => !introHay.includes(k.toLowerCase())).slice(0, 3);
  if (missingKw.length) {
    const list = missingKw.join(", ");
    const kwLine = {
      tr: ` En iyi ${list} arayanlar için tam isabet. ✅`,
      en: ` A perfect match for anyone searching for the best ${list}. ✅`,
      es: ` Ideal para quienes buscan lo mejor en ${list}. ✅`,
      fr: ` Le choix idéal pour qui cherche le meilleur : ${list}. ✅`,
      ar: ` الخيار الأمثل لمن يبحث عن الأفضل: ${list}. ✅`,
      zh: ` 正是寻找最佳${list}的你所需。✅`,
    };
    intro += kwLine[lang] || kwLine.en;
  }

  const featureList = extractFeatureList(product.descriptionHtml || product.description);

  const parts = [];
  parts.push(`<div${dir}>`);
  parts.push(`<p><strong>${pack.emoji} ${escapeHtml(salesTitle)}: ${escapeHtml(pack.hook)}</strong></p>`);
  parts.push(`<p>${escapeHtml(intro)}</p>`);
  parts.push(img(media[0]));
  parts.push(`<p><strong>${escapeHtml(frame.differ(typeWord))}</strong></p>`);
  pack.features.forEach((f) => {
    parts.push(`<p>${f.icon} <strong>${escapeHtml(f.name)}:</strong> ${escapeHtml(f.desc)}</p>`);
  });
  parts.push(img(media[1]));
  parts.push(`<p><strong>${escapeHtml(frame.imagineLabel)}</strong> ${escapeHtml(pack.imagine(productName))}</p>`);
  parts.push(img(media[2]));
  parts.push(`<p>${escapeHtml(pack.urgency)}</p>`);
  parts.push(`<p><strong>👇 ${escapeHtml(pack.cta)}</strong></p>`);

  if (featureList.length) {
    parts.push(`<p><strong>${escapeHtml(FEATURE_HEADING[lang] || FEATURE_HEADING.en)}</strong></p>`);
    parts.push("<ul>");
    featureList.forEach((f, i) => {
      parts.push(`<li>${FEATURE_EMOJIS[i % FEATURE_EMOJIS.length]} ${escapeHtml(f)}</li>`);
    });
    parts.push("</ul>");
  }

  // GEO: short FAQ for AI Overviews / generative search citation
  const faqHeading = {
    tr: "Sıkça sorulanlar",
    en: "FAQ",
    es: "Preguntas frecuentes",
    fr: "FAQ",
    ar: "الأسئلة الشائعة",
    zh: "常见问题",
  };
  const faqs = buildGeoFaqs(productName, keyword || keywords[0] || typeWord, lang);
  parts.push(`<p><strong>${escapeHtml(faqHeading[lang] || faqHeading.en)}</strong></p>`);
  faqs.forEach((f) => {
    parts.push(`<p><strong>${escapeHtml(f.q)}</strong><br/>${escapeHtml(f.a)}</p>`);
  });

  parts.push(`</div>`);
  return parts.filter(Boolean).join("\n");
}

function buildGeoFaqs(productName, focus, lang) {
  const name = productName || "Product";
  const topic = focus || name;
  const packs = {
    tr: [
      { q: `${name} kimler için uygun?`, a: `${name}, günlük kullanımda kalite ve konfor arayanlar için tasarlandı.` },
      { q: `${topic} seçerken nelere bakmalıyım?`, a: `Malzeme, kullanım amacı ve ihtiyacınıza uygun ölçüleri kontrol edin; ${name} bu dengede öne çıkar.` },
    ],
    en: [
      { q: `Who is ${name} for?`, a: `${name} is built for shoppers who want everyday quality and comfort.` },
      { q: `What should I check when buying ${topic}?`, a: `Look at materials, intended use, and fit. ${name} is designed around those essentials.` },
    ],
    es: [
      { q: `¿Para quién es ${name}?`, a: `${name} está pensado para quien busca calidad y comodidad a diario.` },
      { q: `¿Qué revisar al comprar ${topic}?`, a: `Materiales, uso previsto y talla. ${name} equilibra esos puntos.` },
    ],
    fr: [
      { q: `Pour qui est ${name} ?`, a: `${name} convient à ceux qui veulent qualité et confort au quotidien.` },
      { q: `Que vérifier pour ${topic} ?`, a: `Matières, usage et taille. ${name} est conçu autour de ces bases.` },
    ],
    ar: [
      { q: `لمن يناسب ${name}؟`, a: `${name} مناسب لمن يبحث عن جودة وراحة للاستخدام اليومي.` },
      { q: `ماذا أتحقق عند شراء ${topic}؟`, a: `الخامات والغرض والقياس. ${name} يركز على هذه الأساسيات.` },
    ],
    zh: [
      { q: `${name}适合谁？`, a: `${name}适合追求日常品质与舒适的买家。` },
      { q: `选购${topic}要注意什么？`, a: `关注材质、用途和尺码；${name}围绕这些要点设计。` },
    ],
  };
  return packs[lang] || packs.en;
}

/* ---------- Keyword suggestions (country + product aware) ---------- */

const CAT_SYN = {
  en: {
    snowboard: ["snowboard", "all-mountain snowboard", "freestyle board"],
    shoes: ["sneakers", "running shoes", "everyday shoes"],
    apparel: ["clothing", "outfit essentials", "everyday style"],
    bag: ["backpack", "everyday bag", "travel bag"],
    beauty: ["skincare", "daily care", "beauty essential"],
    electronics: ["gadget", "smart device", "tech essential"],
    home: ["home decor", "living essentials", "modern decor"],
    jewelry: ["jewelry", "accessory", "everyday jewelry"],
    generic: ["quality product", "everyday essential", "best value"],
  },
  tr: {
    snowboard: ["snowboard", "all-mountain snowboard", "freestyle tahta"],
    shoes: ["spor ayakkabı", "günlük ayakkabı", "rahat ayakkabı"],
    apparel: ["giyim", "günlük kombin", "şık parça"],
    bag: ["sırt çantası", "günlük çanta", "seyahat çantası"],
    beauty: ["cilt bakımı", "günlük bakım", "bakım ürünü"],
    electronics: ["teknoloji", "akıllı cihaz", "elektronik"],
    home: ["ev dekorasyon", "yaşam ürünleri", "modern dekor"],
    jewelry: ["takı", "aksesuar", "günlük takı"],
    generic: ["kaliteli ürün", "günlük ihtiyaç", "en iyi fiyat"],
  },
};

/** Suggest 2–3 SEO keywords tuned to product + country/language. */
export function suggestKeywords(product, country, lang) {
  const cat = detectCategory(product);
  const l = CAT_SYN[lang] ? lang : "en";
  const out = [];
  const push = (v) => {
    const t = clean(v).toLowerCase();
    if (t && t.length > 2 && !BAN.test(t) && !out.includes(t)) out.push(t);
  };

  const type = clean(product.productType).toLowerCase();
  if (type) push(type);
  (CAT_SYN[l][cat] || CAT_SYN[l].generic).forEach(push);

  // A product-specific 2-word phrase from the title.
  const tt = tokenize(product.title);
  if (tt.length >= 2) push(tt.slice(-2).join(" "));
  else if (tt.length) push(tt[tt.length - 1]);

  // Light market flavor from the target country.
  const market = marketFor(country);
  const intent = (market.intent || [])[0];
  if (intent && out[0]) push(`${out[0]} ${intent}`);

  return out.slice(0, 3);
}

/* ---------- Media kind detection (optional uploads) ---------- */

export function detectMediaKind(url) {
  const u = String(url || "").trim();
  if (/youtube\.com|youtu\.be|vimeo\.com/i.test(u)) return "external_video";
  if (/\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(u)) return "video"; // hosted — needs Shopify upload
  return "image"; // jpg/png/gif/webp and most else
}

const MEDIA_CONTENT_TYPE = { image: "IMAGE", external_video: "EXTERNAL_VIDEO", video: "VIDEO" };

/* ---------- Package + SEO analysis ---------- */

export function buildListingPackage(product, opts) {
  opts = opts || {};
  const lang = opts.language || "tr";
  const country = opts.country || "TR";

  // Keyword resolution: use provided list; if empty, treat all 3 suggestions
  // as selected. Primary keyword drives title/meta; all drive body/coverage.
  let keywords = (opts.keywords && opts.keywords.length ? opts.keywords : opts.keyword ? [opts.keyword] : [])
    .map((k) => clean(k))
    .filter(Boolean);
  if (!keywords.length) keywords = suggestKeywords(product, country, lang);
  if (!keywords.length && clean(product.productType)) keywords = [clean(product.productType)];
  keywords = Array.from(new Set(keywords.map((k) => k.toLowerCase())));
  const keyword = keywords[0] || "";

  const mediaNodes = (product.media?.nodes || []).map((n) => ({
    id: n.id,
    alt: n.alt || "",
    url: n.preview?.image?.url || n.image?.url || "",
  }));

  const imageSeo = buildImageSeo(product, mediaNodes, keyword, lang);
  const salesTitle = buildSalesTitle(product, keyword, lang);

  // Merchant-provided media (optional). Images can appear inline; images +
  // external videos can be attached to the product on publish.
  const custom = (opts.media || [])
    .map((m) => ({ url: clean(m.url), kind: m.kind || detectMediaKind(m.url), alt: clean(m.alt) }))
    .filter((m) => m.url);

  const uploadedImages = custom.filter((m) => m.kind === "image");
  const uploadedImageSeo = uploadedImages.map((m, i) => ({
    url: m.url,
    alt: m.alt || buildImageSeo(product, [{ id: null, url: m.url }], keyword, lang)[0].alt,
  }));

  // Inline description images: prefer merchant uploads, then existing media.
  const bodyImages = uploadedImageSeo.length
    ? uploadedImageSeo.concat(imageSeo)
    : imageSeo;

  const bodyHtml = buildAidaHtml(product, { language: lang, keyword, keywords, salesTitle, images: bodyImages });
  const metaTitle = buildMetaTitle(salesTitle, keyword, lang);
  const metaDescription = buildMetaDescription(product, keyword, lang, country);

  // New media to attach on publish (only when merchant opts in).
  const newMedia = opts.attachMedia
    ? custom
        .filter((m) => m.kind === "image" || m.kind === "external_video")
        .map((m) => ({
          originalSource: m.url,
          alt: m.alt || salesTitle,
          mediaContentType: MEDIA_CONTENT_TYPE[m.kind] || "IMAGE",
        }))
    : [];

  const unsupportedVideos = custom.filter((m) => m.kind === "video").length;

  return {
    productId: product.id,
    keyword, keywords, language: lang, country,
    salesTitle, bodyHtml, metaTitle, metaDescription, imageSeo,
    newMedia, unsupportedVideos,
    seo: analyzeSeo({ salesTitle, metaTitle, metaDescription, bodyHtml, keyword, keywords, imageSeo, language: lang }),
    geo: analyzeGeo({ salesTitle, metaTitle, metaDescription, bodyHtml, keyword, keywords, language: lang }),
  };
}

function tipLang(pkg) {
  return String(pkg.language || "en").toLowerCase().startsWith("tr") ? "tr" : "en";
}

const SEO_TIPS = {
  en: {
    metaTitleLong: "Meta title exceeds 60 characters.",
    metaDescLong: "Meta description exceeds 160 characters.",
    metaDescShort: "Meta description is a bit short (70–160 is ideal).",
    kwMissingTitle: "Primary keyword is missing from the meta title.",
    kwMissingBody: (list) => `Keywords missing from the description: ${list}.`,
    missingAlt: (n) => `${n} image(s) missing alt text.`,
    noImages: "No product images — image SEO cannot be applied.",
    ok: "Basic SEO checks passed.",
  },
  tr: {
    metaTitleLong: "Meta title 60 karakteri aşıyor.",
    metaDescLong: "Meta description 160 karakteri aşıyor.",
    metaDescShort: "Meta description biraz kısa (70–160 ideal).",
    kwMissingTitle: "Birincil anahtar kelime meta title'da yok.",
    kwMissingBody: (list) => `Açıklamada geçmeyen kelime: ${list}.`,
    missingAlt: (n) => `${n} görselde alt metni eksik.`,
    noImages: "Üründe görsel yok — görsel SEO uygulanamaz.",
    ok: "Temel SEO kontrolleri geçti.",
  },
};

const GEO_TIPS = {
  en: {
    bodyShort: "Make the description 120+ characters for AI citation.",
    metaShort: "Add a richer meta description (80+ characters) — AI summaries use it.",
    faq: "Add at least 2 FAQ / Q&A blocks for AI Overviews.",
    specs: "Add measurable specs (size, weight, capacity) — AI prefers citable facts.",
    sentences: "Write at least 4 clear informational sentences.",
    titleLen: "Keep the title between 10–70 characters (ideal for AI snippets).",
    keywords: "Include keywords naturally in the description (GEO + SEO).",
    ok: "GEO checks passed — ready for AI search.",
  },
  tr: {
    bodyShort: "AI citation için açıklamayı 120+ karaktere çıkarın.",
    metaShort: "Zengin bir meta description ekleyin (80+ karakter) — AI özetleri bunu kullanır.",
    faq: "AI Overviews için en az 2 soru-cevap (FAQ) bloğu ekleyin.",
    specs: "Ölçülebilir özellikler ekleyin (ölçü, ağırlık, kapasite) — AI kaynak göstermeyi sever.",
    sentences: "Açık, kısa cümlelerle en az 4 bilgi cümlesi yazın.",
    titleLen: "Başlığı 10–70 karakter arasında tutun (AI snippet için ideal).",
    keywords: "Anahtar kelimeleri doğal şekilde açıklamada geçirin (GEO + SEO).",
    ok: "GEO kontrolleri geçti — AI arama için hazır.",
  },
};

export function analyzeSeo(pkg) {
  const tips = [];
  let score = 100;
  const t = SEO_TIPS[tipLang(pkg)];
  const kw = clean(pkg.keyword).toLowerCase();
  const kws = (pkg.keywords && pkg.keywords.length ? pkg.keywords : kw ? [kw] : []).map((k) => k.toLowerCase());
  const body = clean(pkg.bodyHtml).toLowerCase();

  if (pkg.metaTitle.length > 60) { tips.push(t.metaTitleLong); score -= 10; }
  if (pkg.metaDescription.length > 160) { tips.push(t.metaDescLong); score -= 10; }
  if (pkg.metaDescription.length < 70) { tips.push(t.metaDescShort); score -= 5; }
  if (kw && !pkg.metaTitle.toLowerCase().includes(kw)) { tips.push(t.kwMissingTitle); score -= 10; }

  const matched = kws.filter((k) => body.includes(k));
  const missing = kws.filter((k) => !body.includes(k));
  if (missing.length) { tips.push(t.kwMissingBody(missing.join(", "))); score -= missing.length * 5; }

  const missingAlt = (pkg.imageSeo || []).filter((i) => !i.alt).length;
  if (missingAlt) { tips.push(t.missingAlt(missingAlt)); score -= missingAlt * 5; }
  if ((pkg.imageSeo || []).length === 0) { tips.push(t.noImages); score -= 10; }

  return {
    score: Math.max(0, Math.min(100, score)),
    tips: tips.length ? tips : [t.ok],
    keywordCoverage: kws.length ? Math.round((matched.length / kws.length) * 100) : 0,
  };
}

/**
 * GEO = Generative Engine Optimization (AI Overviews, ChatGPT, Perplexity readiness).
 * Complements classic SEO with citation-friendly structure checks.
 */
export function analyzeGeo(pkg) {
  const tips = [];
  let score = 0;
  const t = GEO_TIPS[tipLang(pkg)];
  const title = clean(pkg.salesTitle || pkg.metaTitle);
  const meta = clean(pkg.metaDescription);
  const bodyHtml = String(pkg.bodyHtml || "");
  const plain = clean(bodyHtml);
  const lower = plain.toLowerCase();

  if (plain.length >= 120) score += 15;
  else tips.push(t.bodyShort);

  if (meta.length >= 80) score += 15;
  else tips.push(t.metaShort);

  const faqHits = (bodyHtml.match(/faq|sss|sıkça sorulan|\?\s*</gi) || []).length
    + (plain.match(/\?/g) || []).length;
  if (faqHits >= 2) score += 20;
  else tips.push(t.faq);

  const hasSpecs = /\d/.test(plain) && /(cm|mm|kg|g|ml|oz|inch|%|ölç|size|weight|boyut)/i.test(plain);
  if (hasSpecs) score += 15;
  else tips.push(t.specs);

  const sentences = plain.split(/[.!?]+/).filter((s) => s.trim().length > 12);
  if (sentences.length >= 4) score += 10;
  else tips.push(t.sentences);

  if (title.length >= 10 && title.length <= 70) score += 15;
  else tips.push(t.titleLen);

  const kws = (pkg.keywords && pkg.keywords.length
    ? pkg.keywords
    : pkg.keyword ? [pkg.keyword] : []
  ).map((k) => String(k).toLowerCase()).filter(Boolean);
  const covered = kws.filter((k) => lower.includes(k)).length;
  if (kws.length && covered === kws.length) score += 10;
  else if (kws.length && covered > 0) score += 5;
  else if (kws.length) tips.push(t.keywords);

  score = Math.max(0, Math.min(100, score));
  const label = score >= 80 ? "AI Search Ready" : score >= 50 ? "Partially Ready" : "Needs GEO Work";

  return {
    score,
    label,
    tips: tips.length ? tips : [t.ok],
  };
}

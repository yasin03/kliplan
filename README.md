# Kliplan

Kliplan, emlak ilanı bilgilerinden (`ilan.json`) ve yerel fotoğraflardan 20-30 saniyelik dikey tanıtım videosu (MP4) üretir.

> Durum: **Faz 3 (yapay zeka ile sahne metni) tamamlandı.** Faz 2 render doğrulaması kullanıcının terminalinde bekleniyor. Dış ses ve altyazı Faz 4'te eklenecek.

## Gereksinimler

- Node.js 22.12 veya üstü (Node 24 ile geliştirildi)
- npm

## Kurulum

```bash
npm install
cp .env.example .env   # API anahtarları yalnızca .env içine yazılır
```

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm test` | Vitest testlerini çalıştırır |
| `npm run lint` | ESLint ve TypeScript tip kontrolü |
| `npm run typecheck` | Yalnızca tip kontrolü |
| `npm run dogrula -- ilanlar/temurlar` | İlan klasörünü doğrular, hata ve uyarıları listeler |
| `npm run dogrula -- ilanlar/temurlar --ornek-gorsel` | Eksik fotoğraflar için "ÖRNEK" yazılı yer tutucu üretip doğrular |
| `npm run studio -- ilanlar/temurlar` | Remotion Studio'da örnek sahnelerle önizleme açar |
| `npm run render:ornek -- ilanlar/temurlar` | Elle yazılmış `ornek-sahneler.json` dosyasından `cikti/temurlar/ornek.mp4` üretir |
| `npm run render:ornek -- ilanlar/temurlar --kareler 30,150,450,son` | Videoya ek olarak bu kareleri JPEG olarak kaydeder (`son` = kapanış sahnesinin ortası) |
| `npm run render:ornek -- ilanlar/temurlar --senaryo tests/veri/uzun-baslik-sahneler.json --cikti cikti/uzun-baslik/test.mp4 --kareler 60,170` | Uzun başlık ve altyazı taşma testi |

| `npm run senaryo -- ilanlar/temurlar` | Claude ile sahne metni üretir, doğrular, `cikti/temurlar/senaryo.json` olarak kaydeder |
| `npm run senaryo -- ilanlar/temurlar --mock` | Aynısını API kullanmadan sahte sağlayıcıyla yapar |
| `npm run senaryo -- ilanlar/temurlar --force` | Önbelleği yok sayıp yeniden üretir |
| `npm run render:ornek -- ilanlar/temurlar --senaryo cikti/temurlar/senaryo.json` | Üretilen senaryodan sessiz video üretir |

İlk render'da Remotion, Chrome Headless Shell'i (~460 MB) `node_modules/.remotion/` altına indirir.

## İlan klasörü

```text
ilanlar/<ilan-adi>/
  ilan.json
  fotograflar/
    01-bina.jpg ...
```

- Şema: [src/schema/ilan.ts](src/schema/ilan.ts). Bilinmeyen alanlar yazım hatası olarak reddedilir.
- Kritik bilgiler (`yetkiBelgeNo`, `telefon`, `fiyatTl`, `konum`, `kiraDurumu`) bir `onayli` alanı taşır. `onayli: false` olan bilgi videoda kullanılmaz ve kontrol raporunda uyarı olarak görünür.
- `fotograflar` listesindeki her dosya `fotograflar/` klasöründe bulunmalıdır. Dosya adı uzantısıyla birlikte birebir eşleşmelidir (`.jpg` ≠ `.png`).
- Fotoğraf türleri: `bina`, `salon`, `mutfak`, `yatak_odasi`, `banyo`, `koridor`, `balkon`, `cocuk_odasi`, `dis_mekan`, `manzara`, `diger`.
- İsteğe bağlı `logo`: ilan klasörüne göre dosya yolu, ör. `"logo.png"`.

Doğrulamanın raporladıkları:

| Durum | Seviye |
|---|---|
| Şema hatası, bozuk JSON, eksik veya açılamayan fotoğraf, eksik logo | Hata (işlem durur) |
| Onaysız bilgi, net m² > brüt m², kat > kat sayısı | Uyarı |
| Uzun kenarı 1280 pikselden kısa fotoğraf | Uyarı |
| ÖRNEK yer tutucu görsel | Uyarı |

Yer tutucuların listesi ve içerik özetleri `fotograflar/ORNEK-GORSELLER.json` dosyasında tutulur. Bir örneğin yerine aynı adla gerçek fotoğraf koyduğunuzda içerik değiştiği için uyarı kendiliğinden kalkar.

## Klasör yapısı

```text
src/          kaynak kod (remotion, pipeline, providers, cli, schema alt klasörleri fazlarla eklenecek)
tests/        testler
ilanlar/      ilan klasörleri (ilan.json + fotograflar/)
cikti/        üretilen videolar ve raporlar (git'e eklenmez)
docs/         görev tanımı ve notlar
```

## Alınan teknik kararlar

- **Sürümler sabit (`--save-exact`):** Remotion paketlerinin hepsi aynı sürümde olmalı. Şu an `4.0.540` kullanılıyor. 5.0 sürümünde lisans değişeceği için yükseltme bilinçli yapılmalı (bkz. [docs/faz0-notlar.md](docs/faz0-notlar.md)).
- **TypeScript 6.0:** TypeScript 7 yayımlandı, ama `typescript-eslint` şimdilik yalnızca `<6.1` sürümleri destekliyor. Bu yüzden 6.0.3 seçildi.
- **ESM projesi** (`"type": "module"`), katı tip kontrolü (`strict`, `noUncheckedIndexedAccess`).
- **`npm audit` uyarısı:** ESLint'in bağımlılığı `minimatch` için orta seviye bir uyarı var. Yalnızca geliştirme aracını etkiliyor, üretilen videoya ve çalışma zamanına etkisi yok. Önerilen `--force` düzeltmesi ESLint'i çok eski bir sürüme düşürdüğü için uygulanmadı.
- **Gerçek ilan fotoğrafları git'e eklenmez** (`.gitignore`).
- **Metinden ses:** Varsayılan Azure AI Speech. Sağlayıcı `TtsProvider` arayüzüyle değiştirilebilir kalacak. Kesin karar, Faz 4'ten önce Azure ile ElevenLabs'in aynı Temurlar metnini seslendirdiği dosyalar dinlendikten sonra verilecek.
- **Hata mesajları:** Zod'un hazır Türkçe çevirisi yerine kendi Türkçe biçimlendiricimiz kullanılıyor ([src/schema/hatalar.ts](src/schema/hatalar.ts)). Mesajlar alan adlarını Türkçe gösteriyor, ör. `Konum → Mahalle: boş bırakılamaz`.

## Video şablonu (Faz 2)

- 1080x1920, 30 fps, H.264 MP4. Sahneler arası 0,5 sn yumuşak geçiş; toplam süre = sahne süreleri − geçişler.
- Renkler, font, güvenli kenar boşlukları ve hareket ayarları tek dosyada: [src/remotion/tema.ts](src/remotion/tema.ts).
- **Font:** Inter (değişken), SIL Open Font License 1.1, ticari kullanım serbest. Google Fonts deposundan indirildi: `public/fontlar/` (lisans metni `Inter-OFL.txt`). Tüm Türkçe karakterlerin fontta olduğu doğrulandı.
- **Güvenli alan:** Üstten 190 px, alttan 420 px, yanlardan 64 px. Altyazı kutusu, sağdaki beğen/yorum butonları için sağdan 150 px boşluk bırakır.
- **Fotoğraf yerleşimi:** 9:16'ya yakın (en/boy < 0,65) fotoğraflar ekranı kaplar. 3:4 dikey dahil diğerleri kırpılmadan ortada durur, arkası aynı fotoğrafın bulanık hali ile dolar.
- **Uzun metin:** Başlık uzunluğa göre 92 px'ten 58 px'e küçülür ve en fazla 3 satır gösterilir; altyazı en fazla 4 satır. Fazlası "…" ile kesilir, ekran dışına taşmaz. Faz 3'teki metin kuralları başlıkları bu sınırların altında tutacak.
- **Kapanış sahnesi:** Son sahnede fiyat, onaylıysa konum, telefon, ofis adı/logosu ve yetki belge numarası gösterilir. Değerler `ilan.json`'dan kod tarafından biçimlendirilir. Onaysız fiyat, telefon veya yetki belgesiyle video üretilmez.
- **Logo:** `ilan.json`'a `"logo": "logo.png"` eklenirse ofis adının yanında gösterilir. Verilmezse yerine vurgu renginde bir çizgi çıkar.
- Kliplan markası videoda yer almaz.
- Fotoğraflar render öncesinde `.cache/<ilan>/public/` altına EXIF yönü düzeltilmiş, en fazla 2160 px JPEG olarak hazırlanır.
- Importlar NodeNext gereği `.js` uzantılı. Webpack'in bunları `.ts/.tsx` olarak çözmesi için [src/remotion/webpack.ts](src/remotion/webpack.ts) içinde `extensionAlias` ayarı var; Studio ve render bu ayarı kullanır.

## Sahne metni (Faz 3)

**Akış:** `ilan.json` → yapay zekaya yalnızca onaylı ve kritik olmayan bilgiler gider → yapılandırılmış JSON çıktı → kod tarafında doğrulama. Hata varsa hatalar modele bildirilir ve en fazla 2 kez yeniden denenir. Yine olmazsa işlem nedenleriyle durur. Son olarak yer tutuculara değerler yerleştirilir.

- **Sağlayıcılar:** `ScriptProvider` arayüzü ([src/providers/ScriptProvider.ts](src/providers/ScriptProvider.ts)). Sahte sağlayıcı (`MockScriptProvider`) ilan verisinden kalıp cümlelerle senaryo kurar. Gerçek sağlayıcı Claude'dur (`AnthropicScriptProvider`).
  - Varsayılan model `claude-opus-5-5`, effort `medium`. `.env` içinde `SCRIPT_MODEL` ve `SCRIPT_EFFORT` ile değiştirilebilir.
  - Model bir isteği güvenlik nedeniyle reddederse sunucu tarafında yedek modele geçilir (`fallbacks: "default"`).
- **Kritik bilgiler yapay zekaya hiç gönderilmez:** fiyat, telefon, metrekare, konum, kira ve yetki belgesi. Yapay zeka `{{fiyat}}`, `{{telefon}}`, `{{netM2}}` ve `{{konum}}` yer tutucularını kullanır. `{{telefon}}` dış seste yasak; dış ses telefon yerine ofisin aranmasını söyler.
- **Sayı biçimleri** ([src/pipeline/bicim.ts](src/pipeline/bicim.ts)): ekranda `4.500.000 TL`, `65 m²`; dış seste `4 milyon 500 bin lira`, `65 metrekare`. Sahnedeki `disSes` alanı seslendirilecek metni, `altyazi` alanı ekran metnini taşır.
- **Doğrulama** ([src/pipeline/senaryoDogrulama.ts](src/pipeline/senaryoDogrulama.ts)) şunları kontrol eder:
  - Şema, sahne sayısı (4-8), fotoğrafın listede olması, başlık uzunluğu (≤ 32 karakter) ve toplam 55-70 kelime.
  - Rakam, bilinmeyen veya onaysız yer tutucu, yer tutucuya ek getirilmesi ("{{konum}}'da").
  - Abartılı ifadeler ("fırsat", "kaçırılmaz", "garanti", "geniş", "ferah" vb.).
  - İlanda olmayan özellikler ("havuz", "deniz", "manzara" vb.).
  - İlandakinden farklı oda sayısı, ilanda karşılığı olmayan yazıyla sayı, konum adının doğrudan yazılması.
  - Onaysız bilgiye ait kelimeler (Temurlar'da "kira", "kiracı").
  - Son sahnede fiyat ve ofis adının geçmesi.
- **Önbellek:** Geçerli çıktı `.cache/<ilan>/senaryo-<özet>.json` dosyasına kaydedilir. Özet; sağlayıcı, model, effort, sistem metni ve ilan girdisinden hesaplanır, biri değişince yeniden üretilir. Önbellekteki çıktı da her seferinde güncel kurallarla yeniden doğrulanır.
- **Sahne süreleri** şimdilik kelime sayısından tahmin ediliyor (2,5 kelime/sn, kapanışa +2 sn, toplam 20-29,5 sn). Faz 4'te gerçek ses süresiyle değişecek.
- **Maliyet tahmini:** Token kullanımı ve Anthropic fiyat listesi (Ekim 2026) üzerinden hesaplanır, `senaryo.json` içine yazılır.

## Lisans ve ses aracı

Remotion lisans durumu ve Türkçe metinden ses seçeneklerinin karşılaştırması: [docs/faz0-notlar.md](docs/faz0-notlar.md)

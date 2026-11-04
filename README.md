# Kliplan

Kliplan, emlak ilanı bilgilerinden (`ilan.json`) ve yerel fotoğraflardan 20-30 saniyelik dikey tanıtım videosu (MP4) üretir.

> Durum: **Faz 5 (tek komutla uçtan uca üretim) tamamlandı.** 1. aşama bitti. Web uygulaması (Faz 6) ancak talep doğrulandıktan sonra yapılacak.

## Gereksinimler

- Node.js 22.12 veya üstü (Node 24 ile geliştirildi)
- npm

## Kurulum

```bash
npm install
cp .env.example .env   # API anahtarları yalnızca .env içine yazılır
```

`.env` içinde doldurulması gerekenler:

| Değişken | Ne için | Nereden |
|---|---|---|
| `GEMINI_API_KEY` | Sahne metni (varsayılan sağlayıcı) | [Google AI Studio](https://aistudio.google.com/apikey) |
| `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Dış ses | Azure Portal → Speech kaynağı → Keys and Endpoint |

Anahtar olmadan denemek için her komuta `--mock` eklenebilir.

## Hızlı başlangıç

```bash
npm run video -- ilanlar/temurlar          # gerçek üretim
npm run video -- ilanlar/temurlar --mock   # API'siz test üretimi (sessiz, kalıp metin)
```

Çıktılar `cikti/<ilan>/` klasörüne yazılır:

| Dosya | İçerik |
|---|---|
| `video.mp4` | 1080x1920, 30 fps, H.264 + AAC dikey video |
| `kapak.jpg` | İlk sahneden kapak görseli (1. saniye) |
| `senaryo.json` | Yapay zeka çıktısı, doğrulama denemeleri, son sahneler, maliyet |
| `kontrol-raporu.md` | Kritik bilgiler ve kaynakları, uyarılar, süre/boyut/maliyet, sahne tablosu, kontrol listesi |

Video göndermeden önce **mutlaka izlenmeli ve kontrol raporundaki liste tamamlanmalıdır**. Sistem hiçbir yere otomatik gönderim yapmaz.

## Yeni bir ilan hazırlama

1. Klasörü oluşturun: `ilanlar/<kısa-ad>/` ve içinde `fotograflar/`. Klasör adı çıktı klasörünün adı olur.
2. Fotoğrafları `fotograflar/` içine koyun. Sıralı ve türünü anlatan adlar önerilir (`01-bina.jpg`, `02-salon.jpg` …). Uzun kenarı en az 1280 piksel olmalı.
3. `ilan.json` yazın. En kolayı `ilanlar/temurlar/ilan.json` dosyasını kopyalayıp değiştirmektir. Alanların açıklaması aşağıdaki "İlan klasörü" bölümünde.
   - Fiyat, telefon ve yetki belge numarasını emlakçıyla doğrulayıp `"onayli": true` yapın. Bunlar onaysızsa video üretilmez.
   - Emin olmadığınız bilgiyi (ör. kira) `"onayli": false` bırakın; videoya girmez, raporda uyarı olarak görünür.
   - Her fotoğrafa doğru `tur` verin (`bina`, `salon`, `mutfak` …). Yapay zeka sahneye uygun fotoğrafı buna göre seçer.
4. Doğrulayın: `npm run dogrula -- ilanlar/<kısa-ad>`. Hataları düzeltin.
   - Fotoğraflar henüz yoksa `--ornek-gorsel` ile "ÖRNEK" yazılı yer tutucular üretip akışı deneyebilirsiniz. Bunlarla üretilen video müşteriye gönderilmez.
5. Gerekirse telaffuz ekleyin: ofis, mahalle veya kişi adı yanlış okunuyorsa `ilan.json`'a `"telaffuz": { "Kazımdirik": "Kazım dirik" }` gibi bir girdi ekleyin (bkz. "Dış ses ve altyazı").
6. İsteğe bağlı: `"logo": "logo.png"` ve ticari kullanım izni olan müzik için `"muzik": { "dosya": "muzik.mp3", "lisans": "…" }`.
7. Üretin: `npm run video -- ilanlar/<kısa-ad>`. Videoyu izleyin, `kontrol-raporu.md` listesini tamamlayın.

Örnek: `ilanlar/ornek-bornova/` kurgusal bir ilandır (Defne Emlak, İzmir). Gerçek fotoğrafı yoktur; ÖRNEK görsellerle uçtan uca akışı göstermek içindir.

## Tek komutla üretim (Faz 5)

Adımlar: 1 doğrulama → 2 fotoğraflar → 3 senaryo → 4 dış ses → 5 render + kapak → 6 senaryo.json ve kontrol raporu.

- **Yeniden çalıştırma:** Her adım öncekinin sonucunu önbellekten alır. Aynı ilanla ikinci çalıştırma ücretli API'ye gitmez. Girdiler değişmediyse video yeniden render edilmez.
  - Render özeti; video verisi, kullanılan fotoğraf/ses/logo/müzik dosyaları ve `src/remotion/` kodundan hesaplanır.
  - `--force` senaryo, ses ve render önbelleklerinin hepsini yok sayar.
- **Yarıda kalma:** Video ve kapak önce `*.yarim.*` adıyla yazılıp sonra yeniden adlandırılır. Yarıda kalan render eski videoyu bozmaz. Komutu tekrar çalıştırmak, senaryo ve ses önbellekten geldiği için para harcamaz.
- **Hatalar** adım adıyla ve çözüm önerisiyle yazılır, ör. `✗ Adım 3/6 Senaryo başarısız … Çözüm: …`.
- **Para harcamadan durma:** Fiyat, telefon veya yetki belgesi onaysızsa ilk adımda durur; API çağrısı yapılmaz.
- **Gemini 503/429:** Ücretsiz katmanda geçici yoğunluk sık görülür. Sağlayıcı artan aralıklarla 5 kez dener. Yine olmazsa birkaç dakika sonra tekrar çalıştırın.

## Komutlar

| Komut | Açıklama |
|---|---|
| `npm test` | Vitest testlerini çalıştırır |
| `npm run lint` | ESLint ve TypeScript tip kontrolü |
| `npm run typecheck` | Yalnızca tip kontrolü |
| `npm run video -- ilanlar/temurlar` | Uçtan uca üretim: video, kapak, senaryo, kontrol raporu (`--mock`, `--force`) |
| `npm run dogrula -- ilanlar/temurlar` | İlan klasörünü doğrular, hata ve uyarıları listeler |
| `npm run dogrula -- ilanlar/temurlar --ornek-gorsel` | Eksik fotoğraflar için "ÖRNEK" yazılı yer tutucu üretip doğrular |
| `npm run studio -- ilanlar/temurlar` | Remotion Studio'da örnek sahnelerle önizleme açar |
| `npm run studio -- ilanlar/temurlar --senaryo cikti/temurlar/sesli-senaryo.json` | Studio'da sesli senaryoyu açar (önce `npm run ses`) |
| `npm run render:ornek -- ilanlar/temurlar` | Elle yazılmış `ornek-sahneler.json` dosyasından `cikti/temurlar/ornek.mp4` üretir |
| `npm run render:ornek -- ilanlar/temurlar --kareler 30,150,450,son` | Videoya ek olarak bu kareleri JPEG olarak kaydeder (`son` = kapanış sahnesinin ortası) |
| `npm run render:ornek -- ilanlar/temurlar --senaryo tests/veri/uzun-baslik-sahneler.json --cikti cikti/uzun-baslik/test.mp4 --kareler 60,170` | Uzun başlık ve altyazı taşma testi |

| `npm run senaryo -- ilanlar/temurlar` | Yapay zeka (varsayılan Gemini) ile sahne metni üretir, doğrular, `cikti/temurlar/senaryo.json` olarak kaydeder |
| `npm run senaryo -- ilanlar/temurlar --mock` | Aynısını API kullanmadan sahte sağlayıcıyla yapar |
| `npm run senaryo -- ilanlar/temurlar --force` | Önbelleği yok sayıp yeniden üretir |
| `npm run render:ornek -- ilanlar/temurlar --senaryo cikti/temurlar/senaryo.json` | Üretilen senaryodan sessiz video üretir |
| `npm run ses -- ilanlar/temurlar` | Senaryoyu Azure ile seslendirir, süreleri sesten hesaplar, `cikti/temurlar/sesli-senaryo.json` yazar |
| `npm run ses -- ilanlar/temurlar --mock` | Aynısını API kullanmadan sessiz sahte sesle yapar |
| `npm run ses -- ilanlar/temurlar --force` | Ses önbelleğini yok sayıp yeniden üretir |
| `npm run render:ornek -- ilanlar/temurlar --senaryo cikti/temurlar/sesli-senaryo.json --cikti cikti/temurlar/sesli.mp4` | Dış sesli ve zamanlı altyazılı video üretir |

İlk render'da Remotion, Chrome for Testing'i (~190 MB) `node_modules/.remotion/` altına indirir. Varsayılan "headless shell" kullanılmıyor, çünkü macOS 26'da GPU süreci açılırken çöküyor (`Target closed` hatası). Ayar: [src/pipeline/render.ts](src/pipeline/render.ts).

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
- **Metinden ses:** Azure AI Speech, `tr-TR-EmelNeural` sesi. Karar 4 Kasım 2026'da Azure ve ElevenLabs karşılaştırması dinlendikten sonra verildi. Sağlayıcı `TtsProvider` arayüzüyle değiştirilebilir. ElevenLabs henüz bağlanmadı.
- **Video süresi sese göre:** Metin kısaltılmıyor, konuşma hızlandırılmıyor. 30 saniye aşılırsa yalnızca uyarı verilir.
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

- **Sağlayıcılar:** `ScriptProvider` arayüzü ([src/providers/ScriptProvider.ts](src/providers/ScriptProvider.ts)). Sahte sağlayıcı (`MockScriptProvider`) ilan verisinden kalıp cümlelerle senaryo kurar. Gerçek sağlayıcı `.env` içindeki `SCRIPT_PROVIDER` ile seçilir:
  - `gemini` (varsayılan, `GeminiScriptProvider`): Ücretsiz katman sınırları içinde kullanılıyor. Varsayılan model `gemini-3.8-flash`. Ücretsiz katmanda gönderilen veri Google tarafından ürün geliştirme için kullanılabilir. İlan metni zaten açık bilgi olduğu için kabul edildi.
  - `anthropic` (`AnthropicScriptProvider`): Varsayılan model `claude-opus-5-5`. Model bir isteği güvenlik nedeniyle reddederse sunucu tarafında yedek modele geçilir (`fallbacks: "default"`).
  - İkisinde de `SCRIPT_MODEL` ve `SCRIPT_EFFORT` (varsayılan `medium`) ile model ve düşünme seviyesi değiştirilebilir.
- **Kritik bilgiler yapay zekaya hiç gönderilmez:** fiyat, telefon, metrekare, konum, kira ve yetki belgesi. Yapay zeka `{{fiyat}}`, `{{telefon}}`, `{{netM2}}` ve `{{konum}}` yer tutucularını kullanır. `{{telefon}}` dış seste yasak; dış ses telefon yerine ofisin aranmasını söyler.
- **Sayı biçimleri** ([src/pipeline/bicim.ts](src/pipeline/bicim.ts)): ekranda `4.500.000 TL`, `65 m²`; dış seste `4 milyon 500 bin lira`, `65 metrekare`. Sahnedeki `disSes` alanı seslendirilecek metni, `altyazi` alanı altta duran kısa ekran metnini taşır.
- **Doğrulama** ([src/pipeline/senaryoDogrulama.ts](src/pipeline/senaryoDogrulama.ts)) şunları kontrol eder:
  - Şema, sahne sayısı (4-8), fotoğrafın listede olması, başlık uzunluğu (≤ 32 karakter) ve toplam 55-70 kelime.
  - Ekran metni: başlıkla aynı içerik kuralları (telefon serbest), en fazla 40 karakter, başlığı veya dış sesi birebir tekrar etmemeli.
  - Rakam, bilinmeyen veya onaysız yer tutucu, yer tutucuya ek getirilmesi ("{{konum}}'da").
  - Abartılı ifadeler ("fırsat", "kaçırılmaz", "garanti", "geniş", "ferah" vb.).
  - İlanda olmayan özellikler ("havuz", "deniz", "manzara" vb.).
  - İlandakinden farklı oda sayısı, ilanda karşılığı olmayan yazıyla sayı, konum adının doğrudan yazılması.
  - Onaysız bilgiye ait kelimeler (Temurlar'da "kira", "kiracı").
  - Son sahnede fiyat ve ofis adının geçmesi.
- **Önbellek:** Geçerli çıktı `.cache/<ilan>/senaryo-<özet>.json` dosyasına kaydedilir. Özet; sağlayıcı, model, effort, sistem metni ve ilan girdisinden hesaplanır, biri değişince yeniden üretilir. Önbellekteki çıktı da her seferinde güncel kurallarla yeniden doğrulanır.
- **Sahne süreleri** `senaryo.json`'da kelime sayısından tahmin edilir. Sesli videoda bunların yerine gerçek ses süresi kullanılır (Faz 4).
- **Maliyet tahmini:** Anthropic için token kullanımı ve fiyat listesi (Ekim 2026) üzerinden hesaplanır. Gemini ücretsiz katmanda olduğu için `$0` yazılır. Sonuç `senaryo.json` içine yazılır.

## Dış ses ve altyazı (Faz 4)

**Akış:** `senaryo.json` → güncel kurallarla yeniden doğrulanır → her sahne ayrı seslendirilir → kelime zamanları altyazıya aktarılır → `sesli-senaryo.json`.

- **Sağlayıcılar:** `TtsProvider` arayüzü ([src/providers/TtsProvider.ts](src/providers/TtsProvider.ts)).
  - `AzureTtsProvider`: Speech SDK ile SSML gönderir; MP3, 48 kHz. Ses `.env` içindeki `TTS_VOICE` ile değiştirilir (varsayılan `tr-TR-EmelNeural`).
  - `MockTtsProvider`: API kullanmadan sessiz WAV ve kelime başına 0,4 sn'lik zamanlar üretir.
- **Sahne süresi** sesin gerçek süresinden hesaplanır: 0,25 sn bekleme + ses + 0,3 sn boşluk + geçiş payı (0,5 sn). Kapanış sahnesine kartın okunması için +2 sn eklenir. Süre kareye yukarı yuvarlanır, böylece ses kesilmez.
- **Alttaki metin sesi yazıya dökmez** (kullanıcı kararı, 4 Kasım 2026). Yapay zeka her sahne için dış sesten ayrı, kısa bir `ekranMetni` yazar ve bu metin sahne boyunca altta sabit durur. Örneğin ses "Net kullanım alanı altmış beş metrekare" derken altta "Eşyalı · Net 65 m²" görünür. Metin her ilanın kendi verisinden üretilir.
  - Azure'un kelime zamanları ses önbelleğinde saklanıyor ama şu an videoda kullanılmıyor.
- **Telaffuz sözlüğü:** Projedeki [telaffuz.json](telaffuz.json) ile ilan.json'daki isteğe bağlı `telaffuz` alanı birleştirilir; aynı kelimede ilandaki geçerli olur.
  - Değer metin ise `<sub>` ile o şekilde okunur.
  - `{ "ipa": "..." }` ise `<phoneme>` ile IPA okunuşu kullanılır.
  - Yalnızca tam kelime eşleşir ("Erkmen'de" içindeki "Erkmen" eşleşir, "Temurlarca" eşleşmez).
  - `Temurlar` ve `Erkmen` için girilen IPA okunuşları vurgu işareti içermiyor. Dinleyerek doğrulanmalı.
- **Müzik (isteğe bağlı):** ilan.json'a `"muzik": { "dosya": "muzik.mp3", "lisans": "<izin kaynağı>" }` eklenir.
  - `lisans` alanı zorunludur ve kontrol raporuna "elle doğrulanmalı" uyarısı olarak yazılır.
  - Müzik dış sesin altında %10 seviyede çalar; başta açılır, sonda kısılır. Seviye [tema.ts](src/remotion/tema.ts) dosyasından değiştirilir.
- **Önbellek:** Sesler `.cache/<ilan>/public/ses/<özet>.mp3` olarak, zamanlarıyla birlikte saklanır. Özet; sağlayıcı, ses, okunan metin ve telaffuz sözlüğünden hesaplanır. Aynı içerik ikinci kez ücretli API'ye gönderilmez.
- **Maliyet:** Karakter sayısı × $15 / 1M karakter (Azure Neural, Kasım 2026). Senaryo maliyetiyle birlikte komut sonunda raporlanır. Azure F0 ücretsiz kotası (ayda 0,5M karakter) içindeyseniz ödeme yapılmaz.

## Lisans ve ses aracı

Remotion lisans durumu ve Türkçe metinden ses seçeneklerinin karşılaştırması: [docs/faz0-notlar.md](docs/faz0-notlar.md)

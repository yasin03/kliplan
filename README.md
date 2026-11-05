# Kliplan

Kliplan, emlak ilanı bilgilerinden (`ilan.json`) ve yerel fotoğraflardan 20-30 saniyelik dikey tanıtım videosu (MP4) üretir.

> Durum: **Faz 6 (web uygulaması) tamamlandı.** Plan ve barındırma kararları: `docs/faz6-plan.md`. Sunucu kurulumu, yedekleme, saklama ve KVKK: [belgeler/](belgeler/). Tamamlanan adımlar: 6.1 çekirdek ayrımı, 6.2 altyapı ve giriş, 6.3 müşteri ayrımı, 6.4 ilan formu ve fotoğraf yükleme, 6.5 kuyruk ve worker, 6.6 önizleme, onay ve indirme, 6.7 ofis ayarları, tema ve müzik, 6.8 işletim ve belgeler.

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
| `npm run tema:onizleme` | Her tema için bir sahne ve kapanış karesi render eder; paneldeki tema seçimi bu görselleri (`web/public/temalar/`) gösterir. `--vurgu #2BB673` ile bir rengi her temada dener |
| `npm run temizlik` | Saklama süresi dolan verileri listeler; `-- --uygula` ile siler (belgeler/isletim.md) |
| `npm run ofis-sil -- --ofis "<ad>"` | Ofisi bütün verisiyle silmeden önce listeler; `--uygula` ile siler |
| `npm run kullanici-sil -- --eposta <e-posta>` | Hesabı ve oturumlarını siler |
| `npm run yedek -- listele` / `yukle <dosya>` / `indir <anahtar> <hedef>` | Veritabanı yedekleri (yedek bucket'ı, `YEDEK_S3_*`) |

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
- İsteğe bağlı `vurguRengi`: ofise özel vurgu rengi, ör. `"#4FD1C5"`. Başlık çizgisinde, altyazı kutusunda ve kapanış kartındaki fiyatta kullanılır. Lacivert zemine karşı kontrastı 3:1'den düşükse doğrulama hata verir. Verilmezse temadaki amber kullanılır.

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

## Web uygulaması (Faz 6)

### 6.1 Çekirdek ayrımı

Web uygulamasında senaryo, video üretilmeden önce kullanıcıya gösterilip düzenlenebilecek. Bunun için [src/pipeline/uretim.ts](src/pipeline/uretim.ts) üç aşamaya bölündü. `videoUret` (CLI) bu üç aşamayı art arda çağırır; davranışı değişmedi.

| Fonksiyon | Adımlar | API |
|---|---|---|
| `ilanHazirla` | 1 doğrulama, 2 fotoğraflar | yok |
| `senaryoAsamasi` | 3 senaryo | yapay zeka (önbellekte yoksa) |
| `videoAsamasi` | 4 dış ses, 5 render, 6 rapor | ses (önbellekte yoksa) |

- **Düzenlenen senaryo:** Önce `duzenlenenSenaryo` ([src/pipeline/senaryoUretimi.ts](src/pipeline/senaryoUretimi.ts)) ile yapay zeka çıktısıyla aynı kurallardan geçirilir. Rakam, abartılı ifade, konum adı, onaysız bilgi veya listede olmayan fotoğraf varsa `SenaryoHatasi` fırlatır. Veritabanından geri okunan senaryo da her seferinde bu kontrolden geçer.
- Senaryo elle değiştirildiyse `senaryo.json`'a `"duzenlendi": true` yazılır, kontrol raporunda da belirtilir.
- **Vurgu rengi** Remotion'a `VideoProps.vurguRengi` ile gelir. Bileşenler rengi `useVurgu()` ([src/remotion/vurgu.ts](src/remotion/vurgu.ts)) ile okur. Lacivert ve beyaz zemin bilerek sabit tutuldu.

### 6.2 Altyapı ve giriş

**Geliştirme ortamını kurma:**

```bash
# OrbStack kurulu ve açık olmalı (ticari kullanımda Pro lisansı gerekir)
docker compose up -d          # PostgreSQL 18 + Redis 8 (compose.yaml)
npm run db:uygula             # migration'ları uygular
npm run kullanici-ekle -- --eposta admin@ornek.com --ad "Ad Soyad" --admin
npm run kullanici-ekle -- --eposta emlakci@ornek.com --ad "Ad Soyad" --ofis "Temurlar Grup"
npm run web                   # http://localhost:3100
```

`.env` içinde `DATABASE_URL`, `REDIS_URL`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) ve `BETTER_AUTH_URL` dolu olmalı (bkz. `.env.example`).

| Komut | Açıklama |
|---|---|
| `npm run web` | Web panelini geliştirme modunda açar (port 3100) |
| `npm run kullanici-ekle -- --eposta … --ad … --ofis …` | Hesap açar. Ofis yoksa oluşturur. `--sifre` verilmezse rastgele şifre üretir ve bir kez gösterir. `--admin` ile yönetici hesabı açılır. |
| `npm run db:uret -- --name <ad>` | `src/db/sema.ts` değişince yeni migration üretir (`src/db/gocler/`) |
| `npm run db:uygula` | Migration'ları veritabanına uygular |

- **Yapı:** npm workspaces. Çekirdek kod kökte (`src/`), Next.js uygulaması `web/` içinde. Web, çekirdeği `@cekirdek/*` yoluyla import eder ([web/tsconfig.json](web/tsconfig.json)).
- **Webpack modu:** Çekirdek kod NodeNext gereği `.js` uzantılı import ediyor. Next.js 16'nın varsayılan derleyicisi Turbopack bunu `.ts` dosyasına çözmüyor, bu yüzden `next dev/build --webpack` ve `extensionAlias` kullanılıyor ([web/next.config.ts](web/next.config.ts)). Turbopack desteği gelirse bayrak kaldırılabilir.
- **Ortam değişkenleri:** Web uygulaması kökteki `.env` dosyasını okur; ayrı bir `web/.env` yok.
- **Veritabanı:** PostgreSQL + Drizzle ORM. Şema: [src/db/sema.ts](src/db/sema.ts). Kodda camelCase, veritabanında snake_case. Ofise bağlı her tabloda `ofisId` var (müşteri ayrımı, 6.3).
- **Giriş:** Better Auth, e-posta + şifre ([src/kimlik/auth.ts](src/kimlik/auth.ts)).
  - Açık kayıt kapalı (`disableSignUp`); dışarıdan kayıt isteği reddedilir.
  - Şifre en az 10 karakter.
  - Admin (`rol: "admin"`) ofise bağlı değildir.
  - `proxy.ts` yalnızca çerez var mı diye hızlı bakar. Asıl oturum doğrulaması her sayfada `girisGerekli()` ile yapılır ([web/lib/oturum.ts](web/lib/oturum.ts)).
- **Arayüz:** Tailwind CSS 4 + shadcn/ui (`base-nova`). Font, videodaki Inter'in yerel kopyası; shadcn'in varsayılan Geist fontunun Latin alt kümesi ğ, ş, ı karakterlerini içermiyordu. `web/components/ui/` shadcn'in ürettiği kod olduğu için lint dışında.
- **Testler:** Veritabanı testleri aynı sunucuda ayrı bir `kliplan_test` veritabanı kullanır, geliştirme verisine dokunmaz. PostgreSQL kapalıysa uyarıyla atlanır.
- **`npm audit`:** `drizzle-kit` (yalnızca geliştirme aracı) eski bir esbuild sürümü getiriyor. Bu sürümdeki açık esbuild'in geliştirme sunucusunu etkiliyor; Kliplan o sunucuyu kullanmıyor ve uygulamanın çalışmasına etkisi yok.
- **Port 3100:** Bu makinede 3000 numaralı port başka bir projede kullanıldığı için seçildi.

### 6.3 Müşteri ayrımı ve dosya erişimi

- **Veri katmanı** ([src/veri/depo.ts](src/veri/depo.ts)): Web kodu ofise bağlı verilere yalnızca `girisGerekli()` ile gelen `depo` üzerinden erişir. Her sorgu oturumdaki ofisle filtrelenir. Başka bir ofisin kaydı, hiç yokmuş gibi "İlan bulunamadı" hatası verir; böylece kaydın varlığı da sızmaz.
  - Admin (`rol: "admin"`) bütün ofisleri görür. Admin ilan oluştururken ofis seçmek zorundadır.
  - Ofise bağlı olmayan bir üye hiçbir şey göremez.
  - Kural lint ile zorunlu: `web/` içinde `@cekirdek/db/*` ve `drizzle-orm` import edilemez. Tek istisna `web/lib/auth.ts`.
- **Dosya deposu** ([src/depolama/](src/depolama/)): `Depolama` arayüzü.
  - Anahtarlar `ofis/<ofisId>/ilan/<ilanId>/...` biçiminde. Klasör dışına çıkan (`..`), mutlak veya beklenmeyen karakter içeren anahtarlar reddedilir.
  - İlan silinince depodaki bütün dosyaları da silinir.
  - Geliştirmede `YerelDepolama` kullanılır: dosyalar `.depolama/` altında, git'e eklenmez. S3/R2 sağlayıcısı sunucu kurulumunda (6.8) eklenecek.
- **İmzalı bağlantılar:** Fotoğraf ve videolar 10 dakika geçerli bağlantılarla açılır.
  - Bağlantı yalnızca kullanıcının kendi ofisinin dosyası için üretilir.
  - Yerelde `/dosya/...` yolu HMAC imzasını ve süreyi doğrular. Süresi dolmuş, değiştirilmiş veya imzasız bağlantı 403 verir.
  - Sunucuda R2'nin kendi imzalı bağlantıları kullanılacak.
- **Testler:** İki ofisle okuma, güncelleme, silme, fotoğraf ekleme, video listeleme ve dosya bağlantısı denemeleri ([tests/erisim.test.ts](tests/erisim.test.ts)). Her veritabanı test dosyası kendi `kliplan_test_<ad>` veritabanını kullanır, paralel çalışırken birbirini etkilemez.

### 6.4 İlan formu ve fotoğraf yükleme

Panelde akış: **İlanlar → Yeni ilan → Bilgiler → Fotoğraflar → İlan sayfası**. Senaryo ve video adımları 6.5'te eklenecek.

- **Form** ([src/veri/ilanFormu.ts](src/veri/ilanFormu.ts)): `ilan.json` ile aynı Zod şemasından geçer. Hatalar Türkçe ve ilgili alanın altında gösterilir; hata olunca girilen değerler kaybolmaz.
  - Esnek giriş: fiyat `4.500.000` veya `4500000 TL`, telefon `05057094488` veya `+90 505…` yazılabilir; kod `0505 709 44 88` biçimine çevirir. Metrekarede virgül kabul edilir.
  - Fiyat, konum, telefon ve yetki belgesinin yanında "Bu bilgiyi doğruladım" kutusu var (`onayli`). İşaretlenmeyen bilgi videoda kullanılmaz; ilan sayfasında uyarı olarak görünür.
  - Emlak ofisi adı formda sorulmaz, ofis kaydından gelir. Logo, vurgu rengi ve müzik ofis ayarlarında (6.7). Telaffuz sözlüğü şimdilik yalnızca CLI'da.
  - `ilanNo` zorunlu kaldı (şema değişmedi). Yalnızca kontrol raporunun başlığında kullanılıyor.
  - Bilgi veya fotoğraf değişince ilan **taslağa** döner ve kayıtlı senaryo silinir; çünkü eski senaryo eski bilgilere göre yazılmıştı. Video üretilirken değişikliğe izin verilmez.
  - İlan sayfası, pipeline'ın göreceği `ilan.json`'u (`ilanJsonuOlustur`) ve CLI'daki tutarlılık kontrolünü çalıştırıp eksikleri ve uyarıları gösterir.
- **Fotoğraflar** ([src/veri/fotografIsleme.ts](src/veri/fotografIsleme.ts)): Sürükle-bırak veya dosya seçerek yüklenir. Her fotoğrafın türü seçilir, oklarla sıralanır, silinebilir.
  - İçeriğe bakılarak doğrulanır, uzantıya güvenilmez. JPEG, PNG ve WebP kabul edilir; HEIC için telefonda JPEG'e geçme yolu anlatılır.
  - Dosya başına en fazla 20 MB, ilan başına en fazla 20 fotoğraf.
  - Sunucuda EXIF yönüne göre döndürülür, uzun kenarı 2160 px'e küçültülür (pipeline da bu boyutu kullanıyor) ve JPEG olarak saklanır.
  - **EXIF bilgisi silinir.** Telefon fotoğraflarındaki GPS konumu ve cihaz bilgisi saklanmaz. Dosya adı rastgele üretilir; kullanıcının dosya adı (kişisel bilgi içerebilir) kullanılmaz.
  - Uzun kenarı 1280 px'ten kısa fotoğrafta "düşük çözünürlük" uyarısı çıkar.
  - Yükleme bir route ile yapılır (`POST /api/ilan/<id>/fotograf`), çünkü sunucu eylemlerinin gövde sınırı 1 MB. `/api` yolları proxy'den geçmez, çünkü proxy istek gövdesini 10 MB'ta kesiyor. Route oturumu kendisi doğrular ve başka siteden gelen istekleri reddeder.
  - Sıralama oklarla yapılıyor. Sürükleyerek sıralama, telefonda da çalışması için ek kütüphane gerektirdiği için eklenmedi.
- **Veritabanı:** `fotograf` tablosuna `genislik` ve `yukseklik` eklendi (migration `0001`). Uygulamak için: `npm run db:uygula`.
- **Testler:** Form dönüşümü ve doğrulaması ([tests/ilanFormu.test.ts](tests/ilanFormu.test.ts)), fotoğraf işleme ve EXIF silme ([tests/fotografIsleme.test.ts](tests/fotografIsleme.test.ts)), başka ofisin fotoğrafını değiştirme, silme ve sıralama denemeleri ([tests/erisim.test.ts](tests/erisim.test.ts)).

### 6.5 Kuyruk, worker ve senaryo düzenleme

Panelde akış: **Bilgiler → Fotoğraflar → Senaryoyu üret → senaryoyu kontrol et/düzenle → Videoyu üret**. Üretim arka planda sürer; sayfa birkaç saniyede bir kendini yeniler.

**Çalıştırma** (web panelinin yanında ikinci bir terminalde):

```bash
npm run worker            # gerçek sağlayıcılar (.env'deki Gemini/Azure)
npm run worker -- --mock  # API kullanmadan test üretimi; raporda "TEST ÜRETİMİ" yazar
```

- **Kuyruk** ([src/worker/kuyruk.ts](src/worker/kuyruk.ts)): BullMQ 6.4.2 + ioredis 6.0.0.
  - BullMQ 6 Redis istemcisini kendisi getirmiyor. ESM projelerde bağlantı ayarından istemci kuramadığı için hazır bir ioredis istemcisi veriliyor.
  - İş verisi yalnızca `uretim_isi` kaydının kimliği; ilan her seferinde veritabanından okunur. Kuyruktaki iş kimliği de aynı, bu yüzden aynı iş iki kez eklenemez.
  - Aynı ilanda aynı anda tek iş çalışabilir. Kilit tek sorguda alınır; iki sekmeden aynı anda basılsa da tek iş açılır.
  - Otomatik yeniden deneme yok. Hata panelde gösterilir, kullanıcı "Yeniden dene"ye basar. Tamamlanan adımlar önbellekten gelir, tekrar ücret oluşmaz.
  - Redis'e 5 saniyede ulaşılamazsa iş hata olarak kapatılır ve kullanıcıya söylenir; sayfa takılmaz.
- **Worker** ([src/worker/isler.ts](src/worker/isler.ts)): Aynı anda tek iş çalıştırır (render CPU'yu dolduruyor).
  - İlanı ve fotoğrafları geçici bir klasöre `ilan.json` + `fotograflar/` olarak yazar ve mevcut pipeline fonksiyonlarını o klasörle çalıştırır (6.1'deki `ilanHazirla`, `senaryoAsamasi`, `videoAsamasi`).
  - Senaryo/ses önbelleği `.cache/web/<ilanId>/` altında.
  - **Senaryo işi** senaryoyu ilana yazar, ilan taslakta kalır.
  - **Video işi** çıktıları `ofis/<ofisId>/ilan/<ilanId>/video/<sürüm>/` altına yükler (video, kapak, rapor, senaryo.json). Her üretim yeni bir sürüm açar ve ilan "kontrol bekliyor" olur.
  - Worker çöküp iş yarıda kalırsa BullMQ işi başarısız sayar; worker bunu da hata olarak kaydeder.
- **Durumlar:** Senaryo ve video üretilirken ilan "üretiliyor" durumundadır. Bu sırada bilgiler, fotoğraflar ve senaryo değiştirilemez, ilan silinemez. Plan senaryo üretimini "taslak içinde" sayıyordu. Üretim sürerken bilgilerin değişip senaryonun eskimesini önlemek için iki iş de bu kilidi kullanıyor.
- **Hata gösterimi:** Panelde adım ("3/6 Senaryo"), ne yapılacağı ve açılır "Ayrıntı" içinde teknik mesaj gösterilir. Pipeline'ın kendi çözüm metinleri CLI içindir (".env", "--mock"); panelde emlakçıya uygun metinler kullanılır.
- **Senaryo düzenleme** (`/ilan/<id>/senaryo`): Her sahnenin fotoğrafı, başlığı, dış sesi ve ekran metni düzenlenebilir.
  - Kurallar yazarken canlı kontrol edilir (rakam, abartılı ifade, konum adı, onaysız bilgi, uzunluk, toplam 55-70 kelime). Kaydederken sunucu `duzenlenenSenaryo` ile aynı kontrolü tekrar yapar.
  - Kritik bilgiler `{{fiyat}}` gibi yer tutucularla kalır; ekranda değerleri ve okunuşları önizlenir.
  - Kaydedilen senaryo video işinde bir kez daha doğrulanır.
  - Senaryo değişince ilan taslağa döner; eski video yeni sürümle değiştirilmelidir.
  - "Yeni senaryo yazdır" önbelleği yok sayar ve yapay zekaya yeniden yazdırır (ücretli; onay sorar).
- **Düzeltme:** Rakam içeren ofis adları ("Emlak 360") senaryo kuralına takılıyordu. Son sahnede ofis adı zorunlu olduğu için bu ofisler hiç video üretemezdi. Ofis adı rakam kontrolünden muaf tutuldu ([src/pipeline/senaryoDogrulama.ts](src/pipeline/senaryoDogrulama.ts)).
- **Veritabanı:** `uretim_isi` tablosuna `asama`, `ilerleme` ve `zorla` eklendi (migration `0002`). Uygulamak için: `npm run db:uygula`.
- **Testler** ([tests/worker.test.ts](tests/worker.test.ts)):
  - Senaryo ve video işleri, sürümler, depoya yükleme.
  - Çift başlatma kilidi ve başka ofisin ilanında iş başlatma.
  - Doğrulama ve render hatalarının kaydı.
  - Tekrar denemede sesin önbellekten gelmesi.
  - Kurala aykırı kayıtlı senaryonun reddedilmesi.

### 6.6 Önizleme, onay ve indirme

İlan sayfasında son video sürümü oynatılır. Altında kontrol listesi, indirme bağlantıları ve önceki sürümler bulunur.

- **Kontrol listesi** ([src/pipeline/kontrolListesi.ts](src/pipeline/kontrolListesi.ts)): CLI'daki kontrol raporu ve paneldeki onay ekranı aynı maddeleri kullanır. Maddeler fiyat, telefon ve yetki belgesinin doğruluğu, ifadeler, okunuş, ses, fotoğraflar ve uyarılardır; müzik varsa lisans maddesi eklenir. Son madde "baştan sona izlendi".
- **Onay** (`videoOnayla`): Bütün maddeler işaretlenmeden onaylanamaz. Maddeler sunucuda ilanın güncel bilgilerinden yeniden hesaplanır.
  - Yalnızca en son sürüm ve ilan "kontrol bekliyor" durumundayken onaylanabilir.
  - Onaylayan kullanıcı, zaman ve işaretlenen maddelerin metni `video` kaydında saklanır.
  - Onaydan sonra bilgi, fotoğraf veya senaryo değişirse ilan taslağa döner; panel onaylı videonun eski bilgilerle üretildiğini söyler.
- **Test üretimi onaylanamaz.** Sahte sağlayıcıyla üretilen video `video.test` ile işaretlenir; kaynağı `--mock` veya `.env`'de `SCRIPT_PROVIDER=mock`/`TTS_PROVIDER=mock` olabilir. Daha önce yalnızca `--mock` bayrağı test sayılıyordu; `.env`'de mock seçiliyse CLI raporuna da "TEST ÜRETİMİ" yazılmıyordu, bu da düzeltildi.
- **İndirme:** Video ve kapak yalnızca onaydan sonra indirilebilir; kontrol raporu her zaman.
  - İndirme bağlantıları dosyayı `kliplan-video-s<sürüm>.mp4` gibi bir adla indirir. Ad imzaya dahil, değiştirilirse bağlantı 403 verir.
  - Önizleme bağlantısından dosya yine kaydedilebilir. Bu kural bir güvenlik önlemi değil; onaysız videonun yanlışlıkla gönderilmesini önlemek için.
- **Yeniden üretme:** "Videoyu yeniden üret" yeni bir sürüm açar ve ilanı tekrar "kontrol bekliyor" yapar. Eski sürümler listede kalır.
- **Kapanış kartı bilgileri:** Fiyat, telefon ve yetki belgesi doğrulanmadan senaryo ve video üretimi başlamaz. Bu bilgiler kapanış kartında gösteriliyor. Daha önce bu durum ancak worker'da, CLI diliyle bir hata olarak çıkıyordu.
- **Video oynatma (yerel):** `/dosya/...` yolu `Range` isteklerini destekliyor (206), çünkü Safari videoyu parça parça ister.
  - Next.js geliştirme sunucusu yanıttan `Content-Length`'i kaldırıp chunked gönderiyor. Safari'de yerel oynatma denenmedi.
  - Yerel depoda her parça isteği dosyanın tamamını okur; sunucuda R2'nin kendi bağlantıları kullanılacak.
- **Geliştirme notu:** Web sunucusu bağlantı havuzunu tek örnek tutuyor, Drizzle'ı her kod yüklemesinde güncel şemayla yeniden kuruyor. `src/db/sema.ts` değişince yeniden başlatmak gerekmez (6.7'de eklenen `muzik` tablosu eski örnekte görünmediği için düzeltildi). Yeni migration'ı yine `npm run db:uygula` ile uygulayın.
- **Veritabanı:** `video.test` eklendi (migration `0003`). Uygulamak için: `npm run db:uygula`.
- **Testler:**
  - Onay, eksik madde, eski sürüm, test videosu ve başka ofis denemeleri; bilgiler değişince onayın engellenmesi; yeniden üretim ([tests/worker.test.ts](tests/worker.test.ts)).
  - İndirme adının imzası ve `Range` çözümü ([tests/depolama.test.ts](tests/depolama.test.ts)).

### 6.7 Ofis ayarları, tema ve müzik

Panelde üst menüye **Ofis ayarları** ve **Müzik** eklendi; ilan sayfasında **Görünüm ve müzik** kartı var.

- **Ofis ayarları** (`/ayarlar`): logo, vurgu rengi, varsayılan tema, varsayılan müzik, telefon ve yetki belgesi (yeni ilan formu bunlarla başlar).
  - Ayarlar yalnızca bundan sonra üretilen videolara uygulanır. Üretilmiş videolar ve onaylar değişmez; ilanların durumu da değişmez.
  - Ofis adı panelden değiştirilemez (videoda ve `kullanici-ekle --ofis` eşleşmesinde kullanılıyor).
  - Admin hangi ofisi düzenleyeceğini seçer (`/ayarlar?ofis=<id>`).
- **Temalar** ([src/remotion/temalar.ts](src/remotion/temalar.ts)): Koyu (önceki görünüm), Açık (krem zemin, koyu yazı), Sade (siyah zemin, ince köşeler). İlan, ofisin temasını geçersiz kılabilir. `ilan.json`'da da `"tema": "acik"` yazılabilir.
  - Renkler temadan gelir, yerleşim ve hareket ortak (`tema.ts`). Bileşenler `useGorunum()` ile okur.
  - Ekran görüntüleriyle kontrol edildi (`npm run tema:onizleme`). Önizlemeler kurgusal ÖRNEK ilandan üretilir, gerçek müşteri fotoğrafı içermez.
- **Vurgu rengi ve kontrast:** Fiyat kapanış kartında vurgu renginde yazıldığı için renk her temanın kart zeminine göre kontrol edilir (en az 3:1).
  - Ayarlarda her tema için sonuç canlı gösterilir. Varsayılan temada okunmayan renk kaydedilmez.
  - Başka bir temada okunmuyorsa uyarı verilir; o temayı seçen ilanda video üretimi başlamaz ve neden söylenir. CLI'da aynı kural doğrulama hatasıdır.
  - Örnek: amber (#F2A541) koyu temada okunur, açık temada okunmaz; açık temanın kendi rengi #C2410C.
- **Logo** ([src/veri/gorunumIsleme.ts](src/veri/gorunumIsleme.ts)): PNG, JPEG veya WebP, en fazla 5 MB.
  - İçeriğe bakılarak doğrulanır. Saydamlık korunarak PNG'ye çevrilir, en fazla 1200x600'e küçültülür, üst veriler silinir.
  - SVG kabul edilmez, çünkü içinde betik ve dış bağlantı olabilir.
  - Saydam zeminli logo çok açıksa (açık temada kaybolur) veya çok koyuysa (koyu/sade temada kaybolur) uyarı verilir. Ayarlarda logo hem koyu hem beyaz zeminde gösterilir.
- **Müzik** (`/muzik`): Hazır kütüphane ve ofisin kendi yüklemeleri. Her ilanda "ofis varsayılanı", "müziksiz" veya belirli bir müzik seçilebilir.
  - **Kütüphane:** Yalnızca admin ekler ve siler; bütün ofisler görür. Lisans bilgisi zorunlu. Dosyalar `kutuphane/muzik/` altında (ofis önekinin dışında), bütün girişli kullanıcılar dinleyebilir.
  - **Ofis yüklemesi:** Yükleyen, beyan kutusunu işaretlemeden yükleyemez. Beyan metni, beyan eden kullanıcının adı ve zamanı saklanır. Başka ofis bu müziği göremez ve seçemez.
  - Beyan metni [src/veri/gorunum.ts](src/veri/gorunum.ts) içinde (`MUZIK_BEYANI`). Hukuki danışmanla gözden geçirilmeli (6.8 KVKK notuna eklenecek).
  - **Doğrulama:** MP3, M4A (AAC) veya WAV, en fazla 15 MB, 5 sn - 10 dk. Uzantıya güvenilmez; Mediabunny dosyayı açıp süresini ölçer. Görüntü içeren dosya reddedilir. Dosya adı rastgele üretilir.
  - **Kontrol raporu:** Yeni "Görünüm ve müzik" bölümü tema, vurgu rengi ve logoyu yazar. Müzik varsa lisans ve beyan da yazılır. Onay listesine "müziğin ticari kullanım izni doğrulandı" maddesi eklenir.
  - **Silme:** Silinen müziği seçmiş ilanlar ofisin varsayılan müziğine, onu varsayılan yapmış ofisler müziksize döner. Üretilmiş videolar etkilenmez.
- **İlanın görünümü değişince** (tema veya müzik) ilan taslağa döner, senaryo korunur. Video yeniden üretilmelidir.
- **Worker:** Ofisin logosu ve ilanın müziği iş klasörüne `logo.png` ve `muzik.<uzantı>` olarak yazılır. `ilan.json`'a tema, vurgu rengi, logo ve müzik (lisans ve beyan dahil) eklenir. Senaryo önbelleği bu alanlara bakmaz; görünüm değişince senaryo yeniden ücretlendirilmez, yalnızca video yeniden render edilir.
- **Bağımlılık:** `mediabunny` 1.64.0 (MPL-2.0) doğrudan eklendi. Remotion zaten bu sürümü kullanıyor ve medya bilgisi için bunu öneriyor (`getVideoMetadata` kullanımdan kalktı).
- **Veritabanı:** Bu sürümde `muzik` tablosu eklendi. `ofis` tablosuna `varsayilan_muzik_id`, `ilan` tablosuna `tema`, `muzik_secimi` ve `muzik_id` eklendi (migration `0004`). Uygulamak için `npm run db:uygula` çalıştırın.
- **Testler:**
  - Tema kontrastı, şema ve rapor: [tests/temalar.test.ts](tests/temalar.test.ts).
  - Logo/müzik işleme, görünüm çözümü ve ayar formu: [tests/gorunum.test.ts](tests/gorunum.test.ts).
  - Ofisler arası müzik/logo/ayar erişimi, kütüphane yetkisi, silme davranışı ve worker'ın logo, müzik ve temayı videoya taşıması: [tests/gorunumVeri.test.ts](tests/gorunumVeri.test.ts).

### 6.8 İşletim ve belgeler

Belgeler `belgeler/` klasöründe. `docs/` gitignore'da olduğu için sunucuda gereken belgeler buraya kondu.

- [belgeler/kurulum.md](belgeler/kurulum.md): Hetzner, Cloudflare R2 (AB yetki alanı), DNS, `.env`, ilk başlatma ve güncelleme. Ayrıca gerçek sunucuda yapılacak **ilk kurulum kontrol listesi**.
- [belgeler/isletim.md](belgeler/isletim.md): Nerede ne tutulduğu, gece yedeği, geri yükleme ve geri yükleme denemesi. Ayrıca saklama süreleri, her veri için silme akışı ve rutin bakım.
- [belgeler/kvkk.md](belgeler/kvkk.md): Kişisel veri envanteri (ne, kimin, nerede, neden, ne kadar), yurt dışına aktarım ve alt işleyenler, **hukuki danışmanla kontrol edilecek 10 nokta**.

Kod:

- **R2 depolama** ([src/depolama/S3Depolama.ts](src/depolama/S3Depolama.ts)): `DEPOLAMA=s3` ile açılır. Bağımlılık: AWS SDK v3, `@aws-sdk/client-s3` ve `@aws-sdk/s3-request-presigner` 3.1155.0, Apache-2.0. Son sürüm bir gün önce çıktığı için en az iki haftalık bu sürüm seçildi.
  - SDK yalnızca zorunlu checksum'ları gönderir (`WHEN_REQUIRED`), çünkü R2 bazı checksum başlıklarını desteklemiyor.
  - Önekle silme dosyaları tek tek siler; toplu silme zorunlu checksum istiyor.
  - İndirme adı imzalı bağlantıya `response-content-disposition` olarak eklenir. R2'nin bunu desteklediği resmi belgede yazmıyor; kurulum listesinde denenecek.
  - S3 uyumlu SeaweedFS ile test edildi: yazma, okuma, önekle silme, imzalı bağlantı, Range, indirme adı. MinIO imajı Docker Hub'dan kaldırılmış.
- **Yedek** (`npm run yedek`, `deploy/yedekle.sh`):
  - `pg_dump -Fc` dökümü ayrı bir R2 bucket'ına yüklenir ve yalnızca o bucket'a yetkili ayrı anahtarla erişilir.
  - Yedekler 30 gün tutulur; en yeni 3 yedek her zaman kalır.
- **Saklama** (`npm run temizlik`, `deploy/bakim.sh`, [src/veri/bakim.ts](src/veri/bakim.ts)):
  - İlan son güncellemeden 365 gün sonra silinir; eski onaysız video sürümü 30 gün sonra.
  - Worker önbelleği 30 gün sonra, süresi dolan oturumlar her gece silinir.
  - Varsayılan çalışma yalnızca listeler; silmek için `--uygula` gerekir.
- **Silme:**
  - `ofis-sil`: müşteri ayrılınca ofisin bütün verisini siler. Önce listeler; üretim sürerken durur.
  - `kullanici-sil`: hesabı siler. İlanlar ofiste kalır, müzik beyanında ad kayıt olarak kalır.
- **Düzeltme:** Yerel depoda ofisin tamamını önekle silmek (`ofis/<id>/`) anahtar doğrulamasına takılıyordu; düzeltildi.
- **Sunucu:**
  - `Dockerfile`: Remotion'ın önerdiği Debian imajı ve Chrome kütüphaneleri; uygulama root olmadan çalışır.
  - `compose.sunucu.yaml`: PostgreSQL, Redis, tek seferlik migration, web, worker ve Caddy (otomatik HTTPS). Günlükler servis başına 50 MB ile sınırlı.
  - `deploy/Caddyfile`: istek gövdesi en fazla 25 MB, güvenlik başlıkları; erişim günlüğü yok.
- **Chrome:** Linux'ta Remotion'ın önerdiği headless shell ve çok süreçli kip, macOS'ta Chrome for Testing ([src/pipeline/render.ts](src/pipeline/render.ts)).
- **Sağlık kontrolü:** `GET /api/saglik` veritabanına ulaşılıyorsa 200, ulaşılamıyorsa 503 döner. Compose sağlık kontrolü ve dış izleme bunu kullanır.
- **Doğrulama:**
  - İmaj yerelde (arm64) derlendi. İçinde `--mock` ile 32,9 saniyelik video render edildi.
  - Konteynerde migration uygulandı; web, S3 depolamayla başladı ve sağlık kontrolü 200 döndü.
  - **Gerçek Hetzner ve R2 ile denenmedi.** `deploy/yedekle.sh` ve `deploy/bakim.sh` sunucu compose'u içinde çalıştırılmadı; yedek ve temizlik modülleri testlerde denendi.
- **Testler:**
  - Saklama, temizlik, ofis ve kullanıcı silme, yedek yükleme ve saklama: [tests/bakim.test.ts](tests/bakim.test.ts).
  - S3 depolama: [tests/s3Depolama.test.ts](tests/s3Depolama.test.ts). S3 testleri `TEST_S3_ENDPOINT` yoksa atlanır; çalıştırma komutu dosyanın başında.

### Şirket ayarları ve şirket resimleri

"Ofis ayarları" sayfasının adı **Şirket ayarları** oldu. Panelde "ofis" yerine "şirket" yazıyor; koddaki adlar (`ofis` tablosu, `/ayarlar`) aynı kaldı.

- **Şirket bilgileri:** Şirket adı, adres, il, ilçe, sabit telefon, cep telefonu, yetki belge no, e-posta, web ve yetkilinin adı soyadı. Logo ayrı bölümde.
  - Telefonlar `0505 709 44 88` biçimine çevrilir. Web adresi protokolsüz saklanır (`https://www.ornek.com/` → `ornek.com`).
  - Yeni ilan formunda telefon önce cep telefonuyla, yoksa sabit telefonla dolu gelir.
- **Şirket adı değiştirilebilir:** Ad benzersizdir, başka bir şirketin adı alınamaz (`kullanici-ekle --ofis` şirketi adıyla buluyor; ad değişince yeni adı kullanın).
  - Son sahnenin dış sesi şirket adını içerdiği için, eski adla yazılmış senaryolar artık geçersiz. Ad değişince ayarlar sayfası bunu söyler.
  - Video üretimi de kuyruğa girmeden önce senaryoyu kontrol eder: "Senaryo güncel değil … senaryoyu düzenleyin veya yeniden üretin".
- **Kapanış kartında göster:** Web, adres (`adres, ilçe/il`), yetkili ve e-postadan hangilerinin videonun son kartında görüneceğini şirket seçer. Boş bir bilgi seçilemez.
  - Dördü birden seçilse de kart üç temada taşmıyor (`npm run tema:onizleme` en kalabalık haliyle render eder).
  - Uzun satır "…" ile kısalır. Gösterilen bilgiler kontrol raporundaki kritik bilgiler tablosuna ve onay listesine de girer.
- **Şirket resimleri** (en fazla 12): Ofis içi, dış cephe, ekip gibi resimler.
  - Seçilen resim videonun **kapanış sahnesinde arka plan** olur, ilan fotoğrafının yerini alır. Süre, dış ses ve senaryo değişmez.
  - İlan fotoğraflarıyla aynı işlemden geçer: EXIF silinir, 2160 px'e küçültülür, JPEG yapılır.
  - Silinen resmi seçmiş ilanlar şirketin varsayılanına, onu varsayılan yapmış şirket "ilan fotoğrafı"na döner. Üretilmiş videolar değişmez.
- **Seçim yerleri:** Tema, müzik ve kapanış resmi için Şirket ayarları'nda varsayılan seçilir.
  - İlan formundaki yeni **Görünüm** bölümünden ve ilan sayfasındaki kartta ilana özel seçim yapılır.
  - Admin yeni ilan açarken şirket henüz belli olmadığı için bölüm görünmez; ilan şirketin varsayılanlarıyla açılır.
- **Senaryo korunuyor:** İlan bilgileri formu artık yalnızca bilgiler gerçekten değiştiyse senaryoyu siler; yalnızca görünüm değiştiyse senaryo kalır.
  - PostgreSQL `jsonb` anahtar sırasını değiştirdiği için karşılaştırma sıradan bağımsız.
- **CLI:** `ilan.json`'a `kapanisResmi` (dosya) ve `sirketBilgileri` (`web`, `adres`, `yetkili`, `eposta`) yazılabilir.
- **Veritabanı:**
  - `ofis` tablosuna yeni bilgi alanları, `kapanis_alanlari` ve `varsayilan_resim_id` eklendi; `ad` artık benzersiz.
  - Yeni `sirket_resmi` tablosu eklendi; `ilan` tablosuna `resim_secimi` ve `resim_id` eklendi (migration `0005`).
  - Uygulamak için: `npm run db:uygula`.
- **Testler:**
  - Form doğrulaması, seçim kuralları ve kapanış satırları: [tests/gorunum.test.ts](tests/gorunum.test.ts).
  - Şirketler arası resim erişimi, 12 resim sınırı, silme davranışı, ad benzersizliği, senaryonun korunması: [tests/gorunumVeri.test.ts](tests/gorunumVeri.test.ts).
  - Worker'ın kapanış resmini ve şirket satırlarını videoya ve rapora taşıması da aynı dosyada.

## Lisans ve ses aracı

Remotion lisans durumu ve Türkçe metinden ses seçeneklerinin karşılaştırması: [docs/faz0-notlar.md](docs/faz0-notlar.md)

# Sunucu kurulumu

Tek sunucu: Hetzner Cloud CPX32 (4 vCPU, 8 GB) üzerinde Docker Compose. Web paneli, worker, PostgreSQL, Redis ve Caddy (HTTPS) aynı makinede çalışır. Dosyalar Cloudflare R2'de tutulur. Maliyet ve kararlar: `docs/faz6-plan.md`.

Bu rehber kurulumu sıfırdan anlatır. Yedekleme, saklama ve silme için: [isletim.md](isletim.md). KVKK için: [kvkk.md](kvkk.md).

> **Durum:** Docker imajı yerelde (arm64) derlenip içinde test render'ı alındı. Gerçek bir Hetzner sunucusu ve R2 hesabıyla henüz denenmedi. İlk kurulumda en alttaki kontrol listesini eksiksiz uygulayın.

## 1. Hazırlık

Gerekenler:

- Alan adı (ör. `kliplan.com`). Panel için bir alt alan adı seçin (ör. `panel.kliplan.com`).
- Hetzner Cloud hesabı.
- Cloudflare hesabı. R2 için ödeme yöntemi tanımlı olmalıdır; 10 GB'a kadar ücretsizdir.
- Gemini ve Azure Speech anahtarları. Bunlar geliştirmedekiyle aynıdır.

## 2. Cloudflare R2

1. **Dosya bucket'ı:** R2 → Create bucket.
   - Ad: `kliplan-dosyalar`.
   - Location → **Specify jurisdiction → eu**. Bu seçenek verinin AB'de tutulmasını garanti eder. Konum ipucu (location hint) bu garantiyi vermez.
   - Yetki alanı sonradan değiştirilemez.
2. **Yedek bucket'ı:** Aynı yöntemle `kliplan-yedekler` adıyla, yine **eu** seçerek açın.
3. **Erişimi kontrol edin:** İki bucket da herkese kapalı kalmalı.
   - Settings → Public access: "Public Development URL" ve "Custom Domains" kapalı olmalı.
   - Uygulama dosyaları yalnızca 10 dakikalık imzalı bağlantıyla açar.
4. **API anahtarları:** R2 → Manage API tokens → Create API token. İki ayrı anahtar oluşturun:
   - Dosyalar için: **Object Read & Write**, yalnızca `kliplan-dosyalar` bucket'ı.
   - Yedekler için: **Object Read & Write**, yalnızca `kliplan-yedekler` bucket'ı.
   - Her anahtarın Access Key ID ve Secret Access Key değerlerini kaydedin. Bu değerler bir daha gösterilmez.
5. **Endpoint:** AB yetki alanında `https://<hesap-kimliği>.eu.r2.cloudflarestorage.com`. Hesap kimliği R2 ana sayfasında yazar.

## 3. Hetzner sunucusu

1. **Sunucuyu açın:** Cloud Console → Add Server.
   - Konum: Falkenstein veya Nürnberg (Almanya) ya da Helsinki (Finlandiya).
   - İmaj: **Ubuntu 24.04**. Tür: **CPX32**.
   - SSH anahtarınızı ekleyin. Şifreyle giriş kullanmayın.
   - **Backups** seçeneğini açın (ek ücretli, yaklaşık %20). Bu, sunucunun tamamının günlük kopyasıdır. Veritabanının asıl yedeği R2'ye ayrıca alınır.
2. **Güvenlik duvarı:** Firewalls → Create Firewall.
   - Gelen bağlantılarda yalnızca 22 (SSH), 80 ve 443 (TCP) açık olsun. Duvarı sunucuya uygulayın.
   - PostgreSQL ve Redis zaten dışarıya port açmaz.
3. **DNS:** `panel.kliplan.com` için sunucunun IPv4 adresine bir **A** kaydı ekleyin (IPv6 varsa **AAAA** kaydı da).
   - Cloudflare DNS kullanıyorsanız proxy'yi (turuncu bulut) **kapalı** tutun. Caddy sertifikayı kendisi alır.
   - Proxy açık olursa Cloudflare'ın yükleme sınırı ve önbelleği devreye girer. Bu ayrıca denenmeli.
4. **Sunucuya bağlanın:** Önce temel güncellemeleri yapın ve Docker'ı kurun ([resmi yöntem](https://docs.docker.com/engine/install/ubuntu/)):

   ```bash
   ssh root@<sunucu-ip>
   apt update && apt upgrade -y
   apt install -y unattended-upgrades git
   curl -fsSL https://get.docker.com | sh
   ```

   `unattended-upgrades` güvenlik güncellemelerini otomatik kurar.

## 4. Uygulama

1. **Depoyu indirin:**

   ```bash
   git clone <depo-adresi> /opt/kliplan
   cd /opt/kliplan
   cp .env.example .env
   chmod 600 .env
   ```

2. **`.env` dosyasını doldurun.** Değerleri aşağıdaki tabloya göre girin, sonra tablonun altındaki komutlarla gizli değerleri üretin.

| Değişken | Değer |
|---|---|
| `ALAN_ADI` | `panel.kliplan.com` |
| `BETTER_AUTH_URL` | `https://panel.kliplan.com` |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` çıktısı. Değişirse bütün oturumlar kapanır. |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` çıktısı |
| `DATABASE_URL` | `postgres://kliplan:<POSTGRES_PASSWORD>@postgres:5432/kliplan` |
| `REDIS_URL` | `redis://redis:6379` |
| `DEPOLAMA` | `s3` |
| `S3_ENDPOINT` | `https://<hesap-kimliği>.eu.r2.cloudflarestorage.com` |
| `S3_BUCKET` | `kliplan-dosyalar` |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Dosyalar anahtarı |
| `YEDEK_S3_ENDPOINT` | `S3_ENDPOINT` ile aynı |
| `YEDEK_S3_BUCKET` | `kliplan-yedekler` |
| `YEDEK_S3_ACCESS_KEY_ID`, `YEDEK_S3_SECRET_ACCESS_KEY` | Yedekler anahtarı |
| `SCRIPT_PROVIDER`, `GEMINI_API_KEY`, `TTS_PROVIDER`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Geliştirmedekiyle aynı. Müşteri verisi için Gemini'nin **ücretli katmanı** önerilir (bkz. kvkk.md). |
| `YEDEK_SAKLAMA_GUN`, `SAKLAMA_*` | Varsayılanlar `.env.example` dosyasında (bkz. isletim.md) |

   ```bash
   openssl rand -base64 32   # BETTER_AUTH_SECRET
   openssl rand -hex 24      # POSTGRES_PASSWORD
   ```

3. **Başlatın:** İlk derleme 5-10 dakika sürer. Chrome ve bağımlılıklar imaja kurulur.

   ```bash
   docker compose -f compose.sunucu.yaml up -d --build
   docker compose -f compose.sunucu.yaml ps
   ```

   - `migration` servisi migration'ları uygulayıp `exited (0)` durumuna geçer.
   - `web` servisi `healthy` olmalıdır.
   - Caddy ilk istekte sertifikayı alır.

4. **Admin hesabı ve ilk ofis:**

   ```bash
   docker compose -f compose.sunucu.yaml run --rm --no-deps worker npm run kullanici-ekle -- --eposta siz@ornek.com --ad "Ad Soyad" --admin
   docker compose -f compose.sunucu.yaml run --rm --no-deps worker npm run kullanici-ekle -- --eposta emlakci@ornek.com --ad "Ad Soyad" --ofis "Temurlar Grup"
   ```

   Üretilen şifre bir kez gösterilir. Kullanıcıya güvenli bir kanaldan iletin.

5. **Zamanlanmış görevler:** Gece yedeği ve bakım için `crontab -e` ile şu satırları ekleyin:

   ```cron
   30 3 * * * /opt/kliplan/deploy/yedekle.sh >> /var/log/kliplan-yedek.log 2>&1
   0 4 * * *  /opt/kliplan/deploy/bakim.sh --uygula >> /var/log/kliplan-bakim.log 2>&1
   ```

6. **İzleme:**
   - Hetzner Console → Server → Graphs bölümünden CPU ve disk takibi yapılabilir.
   - Dışarıdan `https://panel.kliplan.com/api/saglik` adresini 5 dakikada bir yoklayan ücretsiz bir servis kurun (ör. UptimeRobot). Adres veritabanına ulaşamazsa 503 döner.

## 5. İlk kurulum kontrol listesi

Bu maddeler gerçek R2 ve sunucuyla denenmedi. Hepsini sırayla deneyin.

- [ ] `https://panel.kliplan.com` geçerli sertifikayla açılıyor. `http://` adresi `https://` adresine yönleniyor.
- [ ] Giriş yapılıyor. Yanlış şifre reddediliyor.
- [ ] Yeni ilan açılıyor, 10 MB'tan büyük bir fotoğraf yüklenebiliyor (Caddy sınırı 25 MB).
- [ ] Ofis ayarlarında logo yükleniyor. Müzik sayfasında müzik yüklenip dinlenebiliyor (R2 imzalı bağlantısı çalışıyor).
- [ ] Senaryo ve video üretiliyor. Worker günlüğünde Chrome hatası yok: `docker compose -f compose.sunucu.yaml logs -f worker`.
- [ ] Video panelde oynuyor ve ileri sarılabiliyor. Safari'de de deneyin (R2 `Range` isteklerini destekliyor).
- [ ] Onaydan sonra "Videoyu indir" dosyayı `kliplan-video-s1.mp4` adıyla indiriyor.
  - R2'nin imzalı bağlantıda `response-content-disposition` desteğini resmi belgelerde teyit edemedim. Ad farklı çıkarsa dosya yine iner, yalnızca adı değişir.
- [ ] Bucket herkese kapalı: imzalı bağlantının `?` sonrasını silip açın. **400/403 vermeli**, dosyayı göstermemeli.
- [ ] `./deploy/yedekle.sh` çalışıyor ve `npm run yedek -- listele` yedeği gösteriyor. Ardından [isletim.md](isletim.md) içindeki **geri yükleme denemesini** bir kez yapın.
- [ ] `./deploy/bakim.sh` komutu, `--uygula` olmadan çalıştırıldığında silinecekleri listeliyor ve hiçbir şey silmiyor.
- [ ] Sunucuyu yeniden başlatın (`reboot`). Bütün servisler kendiliğinden ayağa kalkmalı.

## 6. Güncelleme

```bash
cd /opt/kliplan
git pull
docker compose -f compose.sunucu.yaml up -d --build
```

- Yeni migration varsa `migration` servisi önce onu uygular.
- Süren bir render varsa worker işi bitirip kapanır (en fazla 5 dakika bekler). Yarıda kalan iş panelde hata olarak görünür ve "Yeniden dene" ile tamamlanır.
- Kod güncellemesinden önce elle yedek alın: `./deploy/yedekle.sh`.

## Notlar

- **Kaynak:** Worker aynı anda tek render yapar.
  - Render sırasında CPU dolar. Panel yavaşlarsa worker ayrı bir sunucuya taşınabilir (plan: CPX42).
  - Chrome için `shm_size: 1gb` ayarlandı.
- **Chrome:** Linux'ta Remotion'ın önerdiği headless shell ve çok süreçli kip kullanılır (`src/pipeline/render.ts`). macOS'ta Chrome for Testing kullanılır.
- **Günlükler:** `docker compose -f compose.sunucu.yaml logs --tail 200 web worker`.
  - Caddy erişim günlüğü tutmaz (Caddyfile'da `log` yok), dolayısıyla IP adresleri diske yazılmaz.
  - Docker günlükleri servis başına en fazla 5 x 10 MB tutulur, eskisi silinir.

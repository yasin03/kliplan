# İşletim: yedekleme, saklama ve silme

Sunucu kurulumu için [kurulum.md](kurulum.md), kişisel veriler için [kvkk.md](kvkk.md) belgelerine bakın. Komutlar sunucuda `/opt/kliplan` klasöründe çalıştırılır. Kısaltma:

```bash
alias kc="docker compose -f compose.sunucu.yaml"
```

## Nerede ne tutuluyor

| Veri | Yer | Yedek |
|---|---|---|
| Hesaplar, ofisler, ilan bilgileri, senaryolar, onay kayıtları, müzik lisans ve beyanları, iş geçmişi | PostgreSQL (sunucu diski, `postgres-veri` birimi) | Her gece R2 yedek bucket'ı, 30 gün; ayrıca Hetzner sunucu yedeği |
| Fotoğraflar, logolar, müzikler, videolar, kapaklar, kontrol raporları | Cloudflare R2 `kliplan-dosyalar` (AB) | **Ayrı yedek yok** (bkz. aşağıdaki karar) |
| Kuyruk (bekleyen işler) | Redis (`redis-veri` birimi) | Yok; kaybolursa yalnızca bekleyen işler hata olarak yeniden denenir |
| Worker önbelleği: senaryo/ses sonuçları, hazırlanmış fotoğraflar | Sunucu diski (`onbellek` birimi) | Yok; kaybolursa tekrar üretimde API yeniden çağrılır (para), veri kaybı olmaz |
| Yerel yedek kopyaları | `deploy/yedekler/`, 7 gün | — |

## Yedekleme

### Veritabanı (her gece 03:30)

`deploy/yedekle.sh`:

1. Komut çalışan PostgreSQL'den `pg_dump -Fc` dökümü alır. Döküm sıkıştırılmıştır ve `pg_restore` ile seçerek geri yüklenebilir.
2. Dökümü yedek bucket'ına `postgres/kliplan-<zaman>.dump` adıyla yükler (`npm run yedek -- yukle`).
3. `YEDEK_SAKLAMA_GUN` (varsayılan **30**) günden eski yedekleri siler. En yeni 3 yedek, yedekleme bir süre çalışmamış olsa bile her zaman kalır.
4. Sunucuda yalnızca son 7 günün kopyasını tutar.

Yedek bucket'ı ayrı bir API anahtarıyla erişilir. Dosya bucket'ının anahtarı ele geçirilse bile yedeklere ulaşılamaz. R2 nesneleri depolamada şifreli tutar. Dökümler ayrıca şifrelenmez (bkz. kvkk.md, danışmana sorulacaklar).

Kontrol:

```bash
tail /var/log/kliplan-yedek.log
kc run --rm --no-deps worker npm run --silent yedek -- listele
```

### Dosyalar (R2): karar gerekiyor

R2 dosyaları yüksek dayanıklılıkla saklar, ama silme hatalarına (kod hatası, yanlış komut, sızan anahtar) karşı koruma vermez. İki seçenek var:

- **A) Şimdilik ayrı yedek yok (şu anki durum).** Silinen dosyalar geri gelmez.
  - Videolar fotoğraflardan ve kayıtlı senaryodan yeniden üretilebilir; ancak senaryo yeniden yazdırılmazsa API ücreti çıkmaz.
  - Fotoğraflar, logolar ve yüklenen müzikler emlakçıdan yeniden istenir.
- **B) Gece eşitleme:** Dosyalar ikinci bir R2 bucket'ına veya Hetzner Storage Box'a kopyalanır, kopyada 30 gün silinmeden tutulur.
  - Depolama maliyeti yaklaşık ikiye katlanır (ilk ~250 ilan ücretsiz katmanda).
  - Silinen müşteri verisi kopyadan da 30 gün sonra düşer.

## Geri yükleme

### Veritabanını yedekten geri yükleme

1. Yedekleri listeleyin, istediğiniz yedeği indirin:

   ```bash
   kc run --rm --no-deps -v "$(pwd)/deploy/yedekler:/yedekler" worker npm run --silent yedek -- listele
   kc run --rm --no-deps -v "$(pwd)/deploy/yedekler:/yedekler" worker npm run --silent yedek -- indir postgres/kliplan-<zaman>.dump /yedekler/geri.dump
   ```

2. Paneli ve worker'ı durdurun. Yeni iş gelmesin:

   ```bash
   kc stop web worker
   ```

3. Mevcut veritabanının son hâlini ayrıca saklayın. Geri yüklemeden vazgeçerseniz buna dönersiniz:

   ```bash
   kc exec -T postgres pg_dump -U kliplan -d kliplan -Fc > deploy/yedekler/geri-yukleme-oncesi.dump
   ```

4. Yedeği geri yükleyin. `--clean` mevcut tabloları silip yedektekileri kurar:

   ```bash
   kc exec -T postgres pg_restore -U kliplan -d kliplan --clean --if-exists --no-owner < deploy/yedekler/geri.dump
   kc up -d
   ```

Geri yüklenen veritabanı, yedek alındıktan sonra silinmiş dosyalara işaret edebilir. Bu ilanlarda fotoğraf veya video açılmaz. Fotoğrafı yeniden yükleyip videoyu yeniden üretin.

### Geri yükleme denemesi (kurulumda bir kez, sonra üç ayda bir)

Yedeğin gerçekten açıldığını canlı veritabanına dokunmadan kontrol edin. Komut, yedeği geçici bir veritabanına yükler, tabloları sayar ve geçici veritabanını siler:

```bash
kc exec -T postgres createdb -U kliplan kliplan_deneme
kc exec -T postgres pg_restore -U kliplan -d kliplan_deneme --no-owner < deploy/yedekler/geri.dump
kc exec -T postgres psql -U kliplan -d kliplan_deneme -c "select (select count(*) from ofis) ofis, (select count(*) from ilan) ilan, (select count(*) from video) video"
kc exec -T postgres dropdb -U kliplan kliplan_deneme
```

### Sunucu tamamen kaybolursa

1. Yeni sunucuyu [kurulum.md](kurulum.md) ile kurun. `.env` dosyasını parola yöneticisindeki kopyasından geri koyun (`.env` hiçbir yerde yedeklenmiyor, ayrıca saklayın).
2. Uygulamayı başlatmadan önce yalnızca veritabanını ayağa kaldırın, son yedeği indirip geri yükleyin:

   ```bash
   kc up -d postgres
   ```

3. Ardından `kc up -d` ile her şeyi başlatın. Dosyalar R2'de durduğu için kaybolmaz.

Alternatif: Hetzner'in sunucu yedeğinden (Backups) sunucuyu geri yükleyin. Bu yedek en fazla 24 saat eskidir.

## Saklama süreleri

Her gece 04:00'te `deploy/bakim.sh --uygula` (`npm run temizlik`) çalışır. Süreler `.env` dosyasından değiştirilebilir. `--uygula` olmadan çalıştırılırsa yalnızca silinecekleri listeler.

| Veri | Süre | Değişken | Not |
|---|---|---|---|
| İlan (bilgiler, fotoğraflar, senaryo, bütün video sürümleri, raporlar, onay kaydı) | Son güncellemeden **365 gün** sonra | `SAKLAMA_ILAN_GUN` | Üretimi süren ilan atlanır. İlan sayfasında bir değişiklik süreyi yeniden başlatır. |
| Eski video sürümü | **30 gün** | `SAKLAMA_ESKI_SURUM_GUN` | Yalnızca en son sürüm **olmayan** ve **onaylanmamış** sürümler. Onaylı sürümler onay kaydı olduğu için ilanla birlikte kalır. |
| Worker önbelleği | **30 gün** dokunulmazsa veya ilan silinmişse | `SAKLAMA_ONBELLEK_GUN` | Önbellekte fotoğraf ve ses kopyaları var. |
| Oturumlar | Süresi dolunca (giriş 7 gün geçerli) | — | IP adresi ve tarayıcı bilgisi oturumla silinir. |
| Kuyruk kayıtları (Redis) | Tamamlanan 7, başarısız 30 gün | `src/worker/kuyruk.ts` | Asıl iş geçmişi veritabanında, ilanla birlikte silinir. |
| Veritabanı yedekleri | **30 gün** | `YEDEK_SAKLAMA_GUN` | Silinen veri yedeklerden en geç bu sürede düşer. |
| Sunucu yedeği (Hetzner) | Hetzner'in döngüsü (son 7 yedek) | Hetzner paneli | |
| Hesaplar, ofis ayarları, müzikler | Silinene kadar | — | Müşteri ayrılınca: "Ofisi silme". |

Varsayılan süreler (365 / 30 / 30 gün) benim önerimdir; hukuki danışmanla netleştirin (kvkk.md). Örneğin emlakçı sözleşmesindeki saklama süresine göre `SAKLAMA_ILAN_GUN` kısaltılabilir.

## Silme akışları

| Ne | Kim | Nasıl | Ne silinir | Ne kalır |
|---|---|---|---|---|
| İlan | Emlakçı veya admin | Panel → ilan → **İlanı sil** | Kayıt, fotoğraflar, bütün video sürümleri, raporlar, iş geçmişi. Önbellek gece bakımında silinir. | Veritabanı yedeklerinde 30 gün |
| Fotoğraf | Emlakçı | Panel → Fotoğraflar → çöp kutusu | Dosya ve kayıt; ilan taslağa döner | Üretilmiş videolarda görünmeye devam eder; videoyu yeniden üretin veya eski sürüm 30 gün sonra silinir |
| Logo | Emlakçı | Ofis ayarları → Logo → Sil | Dosya | Üretilmiş videolarda |
| Müzik | Emlakçı (kendi yüklemesi), admin (kütüphane) | Müzik → Sil | Dosya ve kayıt (lisans, beyan) | Üretilmiş videolarda ve onların kontrol raporunda (lisans/beyan metni) |
| Kullanıcı | Admin | `kc run --rm --no-deps worker npm run kullanici-sil -- --eposta <e-posta>` | Hesap, şifre, oturumlar | Açtığı ilanlar ofiste kalır. Onay ve müzik beyanı kayıtlarında kullanıcı bağlantısı boşalır, **beyan edenin adı** kayıt olarak kalır. |
| Ofis (müşteri ayrıldı) | Admin | Önce listele: `kc run --rm --no-deps worker npm run ofis-sil -- --ofis "<ad>"`; sonra aynısı `--uygula` ile | Ofisin bütün kullanıcıları, ilanları, fotoğrafları, videoları, müzikleri, logosu, önbelleği | Veritabanı yedeklerinde 30 gün. Üretimi süren ilan varsa komut durur. |
| Kişinin kendi verisi (ör. ilgili kişi başvurusu) | Admin | İlgili ilan(lar)ı panelden silin; kullanıcıysa `kullanici-sil` | Yukarıdaki gibi | Yedeklerde 30 gün. Başvuruya verilecek cevap için kvkk.md. |

Silme işlemleri geri alınamaz. Yanlışlıkla silinen veritabanı kaydı yedekten geri yüklenebilir (bkz. "Geri yükleme"). R2'deki dosya ise "Dosyalar (R2)" kararına bağlıdır; A seçeneğinde geri gelmez.

### Silmeden önce

- **Ofis silme:** Emlakçıya kendi videolarını panelden indirmesi için süre verin. Onaylı videolar indirilebilir.
- **İlgili kişi başvurusu:** Başvuruyu ve yapılan silmeyi tarihiyle not edin. KVKK başvurularına 30 gün içinde cevap verilmesi gerekir; ayrıntı danışmanla netleşmeli.

## Rutin

| Ne zaman | Ne |
|---|---|
| Her gün (otomatik) | 03:30 yedek, 04:00 bakım. Güvenlik güncellemelerini `unattended-upgrades` kurar. |
| Haftada bir | `tail /var/log/kliplan-yedek.log /var/log/kliplan-bakim.log`, disk doluluğu (`df -h`), `kc ps` |
| Ayda bir | `git pull` ve güncelleme (kurulum.md → Güncelleme), Docker imajlarını tazeleme: `kc pull && kc up -d --build` |
| Üç ayda bir | Geri yükleme denemesi |

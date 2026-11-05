# KVKK: işlenen kişisel veriler ve danışmana sorulacaklar

Bu belge teknik bir envanterdir, hukuki yorum değildir. Kliplan'ın hangi kişisel veriyi nerede, ne kadar süre ve kimlerle işlediğini listeler. Hukuki danışmanla birlikte gözden geçirilmesi gereken noktalar en altta.

Saklama ve silme ayrıntıları: [isletim.md](isletim.md). Sunucu ve depolama konumları: [kurulum.md](kurulum.md).

## Roller (danışmanla netleşmeli)

- **Emlak ofisi:** İlan, fotoğraf ve danışman bilgilerini sisteme girer, videoyu kendi müşterilerine gönderir. Büyük olasılıkla **veri sorumlusu**.
- **Kliplan (siz):** Ofis adına videoyu üretir ve verileri barındırır. Büyük olasılıkla **veri işleyen**. Panel kullanıcılarının hesap verileri için ayrıca veri sorumlusu olabilir.
- **Alt işleyenler:** Hetzner, Cloudflare, Google (Gemini), Microsoft (Azure).

## Kişisel veri envanteri

| # | Veri | Kimin | Örnek | Nerede | Neden | Saklama |
|---|---|---|---|---|---|---|
| 1 | Hesap | Panel kullanıcısı (emlakçı, çalışan) | Ad soyad, e-posta, şifre özeti (scrypt), rol, ofis | PostgreSQL (Hetzner) | Giriş, yetki | Hesap silinene kadar |
| 2 | Oturum | Panel kullanıcısı | IP adresi, tarayıcı bilgisi (user agent), oturum anahtarı | PostgreSQL | Oturum güvenliği | 7 gün; süresi dolunca gece silinir |
| 3 | Ofis iletişim | Emlakçı (şahıs ofisinde kişisel veri) | Ofis adı, telefon, yetki belge numarası, logo | PostgreSQL, R2 (logo) | Video kapanış kartı | Ofis silinene kadar |
| 4 | İlan bilgileri | Mülk sahibi, kiracı (dolaylı), danışman | Fiyat, il/ilçe/mahalle, kat, metrekare, kullanım durumu (kiracılı/boş), aylık kira, serbest not, danışman telefonu, yetki belge no | PostgreSQL | Senaryo ve video | Son güncellemeden 365 gün |
| 5 | Fotoğraflar | Mülk sahibi, kiracı, üçüncü kişiler | Daire içi; fotoğrafta görünebilen **kişiler, aile fotoğrafları, araç plakaları, belgeler, dini veya siyasi semboller** | R2, worker önbelleği (Hetzner) | Video | İlanla birlikte; önbellek 30 gün |
| 6 | Videolar, kapak, kontrol raporu | 4 ve 5'tekiler | Fiyat, telefon, konum, fotoğraflar, dış ses | R2 | Teslim, onay | İlanla birlikte; eski onaysız sürümler 30 gün |
| 7 | Dış ses | — | Sentetik ses (Azure "Emel"); kimsenin sesi klonlanmaz | R2 (video içinde), önbellek | Video | İlanla birlikte |
| 8 | Onay kaydı | Panel kullanıcısı | Onaylayan kullanıcı, zaman, işaretlenen maddeler | PostgreSQL | İnsan onayının kanıtı | İlanla birlikte |
| 9 | Müzik beyanı | Panel kullanıcısı | Beyan edenin adı, zaman, beyan metni, lisans açıklaması | PostgreSQL, kontrol raporu | Ticari kullanım izninin kaydı | Müzik silinene kadar; raporda ilanla birlikte. **Kullanıcı silinse de ad kalır.** |
| 10 | Yedekler | Yukarıdakilerin hepsi (dosyalar hariç) | Veritabanı dökümü | R2 yedek bucket'ı (AB), Hetzner sunucu yedeği | Felaket kurtarma | 30 gün |
| 11 | Günlükler | Panel kullanıcısı (dolaylı) | İş kimlikleri, hata mesajları; IP tutulmaz | Docker günlükleri (Hetzner) | Hata ayıklama | Servis başına en fazla 50 MB, döner |

Alınan teknik önlemler:

- **Fotoğraflar:** EXIF bilgisi (GPS konumu, cihaz) silinir. Kullanıcının dosya adı saklanmaz.
- **Erişim:** Her ofis yalnızca kendi verisini görür (erişim testleri var). Dosyalar herkese kapalı bucket'ta tutulur, 10 dakikalık imzalı bağlantıyla açılır.
- **Aktarım ve şifreler:** Bağlantılar HTTPS. Şifreler özet olarak saklanır.
- **Yetkiler:** Yedekler ayrı anahtarla tutulur. Açık kayıt yok; hesapları admin açar.

## Yurt dışına aktarım ve alt işleyenler

| Hizmet | Ne gider | Konum | Not |
|---|---|---|---|
| Hetzner Online GmbH | Veritabanı, önbellek, sunucu yedeği (1, 2, 3, 4, 5, 8, 9, 10, 11) | Almanya veya Finlandiya (kurulumda seçilir) | AB şirketi |
| Cloudflare R2 | Fotoğraflar, logolar, müzikler, videolar, raporlar, veritabanı yedekleri (3, 5, 6, 10) | Bucket'lar **AB yetki alanında** açılır (Cloudflare bunu garanti ediyor) | ABD merkezli şirket |
| Google Gemini API | Senaryo için: ofis adı, oda sayısı, bina ve daire özellikleri, özellik listesi, fotoğraf türleri. **Fiyat, telefon, konum ve fotoğrafların kendisi gönderilmez** (yer tutucuyla çalışır). | Google'ın işleme konumu (sabit değil) | **Ücretsiz katmanda gönderilen veri Google tarafından ürün geliştirmede kullanılabiliyor.** Müşteri verisi için ücretli katman önerilir. |
| Microsoft Azure Speech | Dış ses metni: ofis adı, fiyat ve konumun okunuşu, daire özellikleri. Telefon seslendirilmez. | `northeurope` (İrlanda), `.env` ile seçilir | |

## Hukuki danışmanla kontrol edilecek noktalar

1. **Roller ve sözleşme:**
   - Kliplan veri işleyen mi?
   - Emlak ofisleriyle veri işleme sözleşmesi gerekiyor mu, içeriği ne olmalı?
   - Alt işleyenlerin (Hetzner, Cloudflare, Google, Microsoft) bu sözleşmede sayılması gerekiyor mu?
2. **Yurt dışına aktarım (KVKK md. 9):**
   - Hetzner (AB), Cloudflare (ABD şirketi, AB depolama), Google ve Microsoft için hangi aktarım aracı kullanılmalı (yeterlilik, standart sözleşme, bağlayıcı şirket kuralları)?
   - Standart sözleşme kullanılırsa Kurum'a bildirim gerekiyor mu, süresi ne? (2024 değişikliğiyle geldiğini biliyorum; güncel hâlini teyit edin.)
   - Verilerin Türkiye'de tutulması gerekiyorsa yerli sağlayıcı araştırılır, maliyet değişir.
3. **Aydınlatma ve rıza:**
   - Panel kullanıcıları için aydınlatma metni gerekiyor. Giriş sayfasına bağlantı eklenebilir.
   - Emlakçının mülk sahibini ve kiracıyı fotoğrafların ve bilgilerin video için işlendiği konusunda bilgilendirmesi gerekiyor mu? Bunu emlakçıya hatırlatan bir metin veya onay kutusu eklenmeli mi?
   - Fotoğraflarda görünen üçüncü kişiler (kiracı, aile fotoğrafı) ve olası **özel nitelikli** veriler (dini semboller, sağlık ekipmanı) için ne yapılmalı? Şu an kontrol listesinde yalnızca "fotoğraflar doğru ilana ait, bulanık değil" maddesi var. "Fotoğraflarda kişi, plaka veya kişisel eşya görünmüyor" maddesi eklenebilir.
4. **VERBİS:** Kliplan veya emlak ofisleri için VERBİS kaydı yükümlülüğü var mı?
5. **Saklama ve imha politikası:**
   - Varsayılan süreler uygun mu? İlan 365 gün, eski sürüm 30 gün, yedek 30 gün.
   - Kişisel veri saklama ve imha politikası yazılı olarak hazırlanmalı mı? Bu belge ve isletim.md taslak olarak kullanılabilir.
6. **İlgili kişi başvuruları:**
   - Mülk sahibi, kiracı veya kullanıcı verisinin silinmesini isterse süreç ne olmalı?
   - Yedeklerde 30 gün kalması kabul edilebilir mi?
   - Başvuru kime yapılmalı: Kliplan'a mı, ofise mi?
7. **Müzik beyanı:**
   - Beyan metni (`src/veri/gorunum.ts` → `MUZIK_BEYANI`) yeterli mi?
   - Sorumluluğun emlakçıda olduğu ayrıca sözleşmeye yazılmalı mı?
   - Kullanıcı silinince beyan edenin adının kayıtta kalması uygun mu?
8. **Yapay zeka hizmetleri:**
   - Gemini'nin ücretsiz katmanında verinin eğitimde kullanılması kabul edilebilir mi? Önerim ücretli katman.
   - Azure ve Google'ın veri işleme koşulları (DPA) yeterli mi?
9. **Yedeklerin şifrelenmesi:** R2 veriyi depolamada şifreliyor. Veritabanı dökümlerinin ayrıca bizim anahtarımızla şifrelenmesi gerekli mi? Gerekirse `age` veya `gpg` ile eklenir.
10. **Veri ihlali:**
    - İhlal durumunda Kurul'a ve ilgili kişilere bildirim süresi ve yöntemi ne?
    - Kim kime haber verecek: ofis mi, Kliplan mı?

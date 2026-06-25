# AMH Öğrenci Portalı

Temiz sürüm. GitHub Pages + Firebase Firestore + Firebase Cloud Messaging + GitHub Actions ile çalışır.

## Yönetici

Varsayılan yönetici şifresi:

```text
135746
```

Yönetici panelinden `Ayarlar` sekmesinde değiştirilebilir.

## Özellikler

- Öğrenci başvurusu: isim, soyisim, okul no, sınıf, 4 haneli şifre
- Sekmeli yönetici paneli
- Öğrenciler sekmesi: onay bekleyen, onaylı ve pasif öğrenciler
- Duyurular sekmesi: oluşturma, düzenleme, silme, okunma takibi
- Mesajlar sekmesi: yeni mesaj rozeti, konuşma kutusu, devam eden yazışma
- Raporlar sekmesi: duyuru okunma istatistiği, işlem kayıtları, Word raporu
- Ayarlar sekmesi: yönetici şifresi, şifre sıfırlama talepleri
- Push bildirim token kaydı ve GitHub Actions ile gönderim

## GitHub'a yüklenecek dosyalar

Bu klasördeki tüm dosyaları ve klasörleri repo köküne yükle:

```text
.github/
scripts/
index.html
styles.css
app.js
firebase-config.js
sw.js
manifest.webmanifest
icon.svg
package.json
README.md
firestore-test.rules
```

## Yeni repo linki değişirse

`.github/workflows/send-notifications.yml` içindeki `SITE_URL` satırını yeni GitHub Pages linkinle değiştir:

```yaml
SITE_URL: https://kullanici-adin.github.io/repo-adi/
```

## GitHub Secret

Repo ayarlarında secret adı aynen şöyle olmalı:

```text
FIREBASE_SERVICE_ACCOUNT
```

İçeriğine Firebase service account JSON dosyasının tamamı yapıştırılmalı.

## Firestore test kuralı

İlk test için `firestore-test.rules` içeriğini Firestore Rules ekranına yapıştırabilirsin.

Bu kural sadece test içindir. Canlı kullanımda güvenlik kurallarını sıkılaştırmak gerekir.

## Bildirim testi

1. Öğrenci hesabıyla giriş yap.
2. `Bildirimleri Aç` butonuna bas ve izin ver.
3. Firestore'da `notificationTokens` koleksiyonu oluşmalı.
4. Yönetici yeni duyuru yayınlasın.
5. GitHub > Actions > Send push notifications > Run workflow çalıştır.
6. Workflow logunda `basarili` sayısı görünmeli.

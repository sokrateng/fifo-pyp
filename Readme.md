Stok Yaşlandırma ve Analiz Süiti (v5.0)

Bu proje, Excel/CSV veri setleri üzerinden FIFO (First-In-First-Out) mantığıyla stok yaşlandırma analizi yapan, React tabanlı gelişmiş bir web uygulamasıdır.

Sürüm v5.0 ile birlikte proje bazlı (PYP) stok takibi ve dinamik hareket türü filtreleme özellikleri eklenmiştir.

🚀 Özellikler

1. Çoklu Modül Yapısı

Yönetim & Ayarlar: CSV ayırıcıları, kolon eşleştirmeleri ve analiz parametrelerini yapılandırma.

Simülasyon: Belirli bir tarih, malzeme ve tesis için anlık detaylı analiz. Hangi giriş hareketinin (101, 561 vb.) ne kadarının tüketildiğini gösteren FIFO tablosu.

Toplu Raporlama: Yüklenen tüm veri setini tarayarak her satır için stok ve yaş bilgisini hesaplama ve CSV olarak dışa aktarma.

2. Hibrit Analiz (Genel vs. Proje)

Genel Stok: Tesis bazlı standart stok ve yaş hesabı.

Proje (PYP) Stoğu: Proje numarasına (PSPNR) özgü giriş ve çıkış kolonları üzerinden ayrıştırılmış stok ve yaş hesabı.

3. Esnek FIFO Motoru

Sadece "101" (Satınalma) değil, kullanıcı tarafından belirlenen çoklu hareket türleri (Örn: 101, 102, 561) üzerinden yaşlandırma yapabilme.

İade ve devir hareketlerini analize dahil edebilme yeteneği.

🛠️ Kurulum ve Çalıştırma

Bu proje modern bir React bileşenidir. Çalıştırmak için halihazırda bir React ortamına ihtiyacınız vardır.

Bağımlılıklar

Proje ikon seti için lucide-react ve stil işlemleri için Tailwind CSS kullanır.

npm install lucide-react


Bileşeni Kullanma

StockAgingSuiteV5.jsx dosyasını projenizin src/components klasörüne atın ve ana sayfanızda çağırın:

import StockAgingSuiteV5 from './components/StockAgingSuiteV5';

function App() {
  return (
    <div className="App">
      <StockAgingSuiteV5 />
    </div>
  );
}


📊 CSV Dosya Formatı

Uygulama esnek kolon yapısına sahiptir ancak varsayılan olarak aşağıdaki yapıyı bekler (Ayarlardan değiştirilebilir):

Kolon

Açıklama

SPTAG

İşlem Tarihi (Gün.Ay.Yıl veya Yıl-Ay-Gün)

MATNR

Malzeme Kodu

WERKS

Üretim Yeri / Tesis

PSPNR

Proje Numarası (PYP)

BWART

Hareket Türü (101, 601 vb.)

MZUBB

Genel Giriş Miktarı

MAGBB

Genel Çıkış Miktarı

MZUPR

Proje Giriş Miktarı

MAGPR

Proje Çıkış Miktarı

📜 Lisans

Bu proje MIT lisansı altında sunulmaktadır.
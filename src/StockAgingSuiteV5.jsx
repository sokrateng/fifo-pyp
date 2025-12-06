import React, { useState, useMemo } from 'react';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  Settings, 
  Upload, 
  PlayCircle, 
  Calculator, 
  AlertCircle, 
  Loader2,
  Download,
  Package,
  Calendar,
  Factory,
  Briefcase,
  ListFilter // Filtre ikonu
} from 'lucide-react';

// --- YARDIMCI FONKSİYONLAR ---

const parseDate = (dateStr) => {
  if (!dateStr) return null;
  let cleanDate = dateStr.trim();
  
  if (cleanDate.includes('.')) {
    const parts = cleanDate.split('.');
    if (parts.length === 3) {
      // DD.MM.YYYY -> YYYY-MM-DD
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return cleanDate;
};

export default function StockAgingSuiteV5() {
  const [activeTab, setActiveTab] = useState('settings'); 
  const [isProcessing, setIsProcessing] = useState(false);

  // --- 1. AYARLAR STATE'İ (Genişletildi) ---
  const [config, setConfig] = useState({
    separator: ';', 
    fifoMoveTypes: '101', // YENİ: Varsayılan olarak sadece 101, ama değiştirilebilir
    colMap: {
      date: 'SPTAG',
      material: 'MATNR',
      plant: 'WERKS',
      project: 'PSPNR',
      moveType: 'BWART',
      qtyIn: 'MZUBB',       
      qtyOut: 'MAGBB',      
      qtyInPrj: 'MZUPR',    
      qtyOutPrj: 'MAGPR'    
    }
  });

  // --- 2. VERİ STATE'İ ---
  const [rawCsvData, setRawCsvData] = useState([]); 
  const [processedData, setProcessedData] = useState([]); 
  const [headers, setHeaders] = useState([]);
  const [fileName, setFileName] = useState("");

  // --- 3. SİMÜLASYON STATE'İ ---
  const [simDate, setSimDate] = useState(new Date().toISOString().split('T')[0]);
  const [simMatnr, setSimMatnr] = useState("");
  const [simWerks, setSimWerks] = useState("");
  const [simPspnr, setSimPspnr] = useState(""); 
  const [simResult, setSimResult] = useState(null);

  // --- DOSYA YÜKLEME ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setProcessedData([]); 
    setSimResult(null); 
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = text.split('\n');
      
      if (rows.length < 2) return;

      const fileHeaders = rows[0].split(config.separator).map(h => h.trim());
      setHeaders(fileHeaders);

      const parsed = rows.slice(1).map((rowStr, index) => {
        const cells = rowStr.split(config.separator);
        if (cells.length < fileHeaders.length) return null;
        
        const rowObj = { _id: index }; 
        fileHeaders.forEach((header, i) => {
          rowObj[header] = cells[i] ? cells[i].trim() : "";
        });
        return rowObj;
      }).filter(row => row && row[config.colMap.material] && row[config.colMap.date]);

      setRawCsvData(parsed);
    };

    reader.readAsText(file);
  };

  // --- UNIQUE SEÇENEKLER ---
  const uniqueOptions = useMemo(() => {
    const materials = new Set();
    const plants = new Set();
    const projects = new Set();

    rawCsvData.forEach(row => {
      if (row[config.colMap.material]) materials.add(row[config.colMap.material]);
      if (row[config.colMap.plant]) plants.add(row[config.colMap.plant]);
      if (row[config.colMap.project]) projects.add(row[config.colMap.project]);
    });

    return {
      materials: Array.from(materials).sort(),
      plants: Array.from(plants).sort(),
      projects: Array.from(projects).sort()
    };
  }, [rawCsvData, config.colMap]);

  // --- CORE ALGORİTMA: HİBRİT HESAPLAMA ---
  const calculateRowStats = (targetRow, allData, mode = 'STANDARD', returnDetails = false) => {
    const targetDateStr = parseDate(targetRow[config.colMap.date]);
    const matnr = targetRow[config.colMap.material];
    const werks = targetRow[config.colMap.plant];
    const pspnr = targetRow[config.colMap.project]; 

    if (!targetDateStr || !matnr || !werks) return { stock: 0, age: 0, breakdown: [] };
    
    if (mode === 'PROJECT' && !pspnr) return { stock: null, age: null, breakdown: [] };

    // YENİ: İzin verilen hareket türlerini array'e çevir (Örn: "101, 102" -> ["101", "102"])
    const allowedMoveTypes = config.fifoMoveTypes.split(',').map(t => t.trim());

    // 1. VERİ FİLTRELEME
    const relevantData = allData.filter(row => {
      const rowDate = parseDate(row[config.colMap.date]);
      
      const baseCondition = (
        row[config.colMap.material] === matnr &&
        row[config.colMap.plant] === werks &&
        rowDate <= targetDateStr
      );

      if (mode === 'PROJECT') {
        return baseCondition && row[config.colMap.project] === pspnr;
      } else {
        return baseCondition;
      }
    });

    const colIn = mode === 'PROJECT' ? config.colMap.qtyInPrj : config.colMap.qtyIn;
    const colOut = mode === 'PROJECT' ? config.colMap.qtyOutPrj : config.colMap.qtyOut;

    // 2. NET STOK HESABI
    let totalIn = 0;
    let totalOut = 0;
    relevantData.forEach(row => {
      totalIn += parseFloat(row[colIn]) || 0;
      totalOut += parseFloat(row[colOut]) || 0;
    });
    
    let currentStock = totalIn - totalOut;
    
    if (currentStock <= 0) return { stock: currentStock, age: 0, breakdown: [], message: "Stok <= 0" };

    // 3. FIFO YAŞ HESABI (Dinamik Hareket Türleri ile)
    const inflows = relevantData
      .filter(row => {
        const moveType = row[config.colMap.moveType];
        const qty = parseFloat(row[colIn]) || 0;
        // YENİ: Sadece '101' değil, kullanıcının girdiği tiplere bak
        return allowedMoveTypes.includes(moveType) && qty > 0;
      })
      .sort((a, b) => new Date(parseDate(b[config.colMap.date])) - new Date(parseDate(a[config.colMap.date])));

    let remainingStockToFind = currentStock;
    let weightedAgeSum = 0;
    const targetDateObj = new Date(targetDateStr);
    const breakdown = [];

    for (let inflow of inflows) {
      if (remainingStockToFind <= 0) break;

      const inflowQty = parseFloat(inflow[colIn]) || 0;
      const inflowDateObj = new Date(parseDate(inflow[config.colMap.date]));
      
      const diffTime = Math.abs(targetDateObj - inflowDateObj);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const usedQty = Math.min(remainingStockToFind, inflowQty);
      
      weightedAgeSum += (usedQty * diffDays);
      remainingStockToFind -= usedQty;

      if (returnDetails) {
        breakdown.push({
          date: inflow[config.colMap.date],
          moveType: inflow[config.colMap.moveType], // Hareket türünü de gösterelim
          originalQty: inflowQty,
          usedQty: usedQty,
          ageDays: diffDays,
          contribution: (usedQty * diffDays)
        });
      }
    }
    
    let uncoveredStock = remainingStockToFind > 0 ? remainingStockToFind : 0;
    const calculatedPart = currentStock - uncoveredStock;
    const avgAge = calculatedPart > 0 ? (weightedAgeSum / calculatedPart) : 0;

    return { 
      stock: currentStock, 
      age: avgAge.toFixed(1),
      breakdown: breakdown,
      uncoveredStock: uncoveredStock
    };
  };

  // --- SİMÜLASYON TETİKLEYİCİ ---
  const runSimulation = () => {
    if(!simMatnr || !simWerks || !simDate) return;

    const dummyRow = {
      [config.colMap.date]: simDate,
      [config.colMap.material]: simMatnr,
      [config.colMap.plant]: simWerks,
      [config.colMap.project]: simPspnr 
    };

    const mode = simPspnr ? 'PROJECT' : 'STANDARD';
    const result = calculateRowStats(dummyRow, rawCsvData, mode, true);
    
    setSimResult({ ...result, targetDate: simDate, mode: mode });
  };

  // --- TOPLU ANALİZ İŞLEMİ ---
  const runFullAnalysis = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const results = rawCsvData.map(row => {
        const stdStats = calculateRowStats(row, rawCsvData, 'STANDARD', false);
        const prjStats = calculateRowStats(row, rawCsvData, 'PROJECT', false);

        return {
          ...row,
          _stdStock: stdStats.stock,
          _stdAge: stdStats.age,
          _prjStock: prjStats.stock, 
          _prjAge: prjStats.age
        };
      });
      setProcessedData(results);
      setIsProcessing(false);
    }, 100);
  };

  const handleExport = () => {
     if (processedData.length === 0) return;
     const exportHeaders = [...headers, "GENEL_STOK", "GENEL_YAS", "PROJE_STOK", "PROJE_YAS"];
     const csvContent = [
       exportHeaders.join(config.separator),
       ...processedData.map(row => {
         return exportHeaders.map(header => {
           if (header === "GENEL_STOK") return row._stdStock;
           if (header === "GENEL_YAS") return row._stdAge;
           if (header === "PROJE_STOK") return row._prjStock !== null ? row._prjStock : "";
           if (header === "PROJE_YAS") return row._prjAge !== null ? row._prjAge : "";
           return row[header];
         }).join(config.separator);
       })
     ].join("\n");

     const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
     const url = URL.createObjectURL(blob);
     const link = document.createElement("a");
     link.setAttribute("href", url);
     link.setAttribute("download", `Proje_Analiz_Sonucu_${fileName}`);
     document.body.appendChild(link);
     link.click();
  };

  return (
    <div className="flex h-screen bg-gray-100 font-sans text-gray-800 overflow-hidden">
      
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl flex-shrink-0">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <LayoutDashboard className="w-6 h-6 text-indigo-400" />
            Stok Analitik
          </h1>
          <p className="text-xs text-slate-500 mt-1">v5.0 Multi-Move Type</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}
          >
            <Settings className="w-5 h-5" />
            <span>Ayarlar</span>
          </button>
          <button 
            onClick={() => setActiveTab('simulation')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'simulation' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}
          >
            <Calculator className="w-5 h-5" />
            <span>Simülasyon</span>
          </button>
          <button 
            onClick={() => setActiveTab('report')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${activeTab === 'report' ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span>Toplu Raporlama</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <label className="flex items-center gap-2 cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-3 rounded-lg transition-colors text-sm w-full justify-center border border-dashed border-slate-600">
            <Upload className="w-4 h-4" />
            {fileName ? 'Dosya Güncelle' : 'CSV Yükle'}
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>
          {fileName && <p className="text-xs text-center mt-2 text-slate-500 truncate">{fileName}</p>}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-auto p-8 relative">
        
        {/* BOŞ STATE */}
        {rawCsvData.length === 0 && activeTab !== 'settings' && (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100/90 z-50">
             <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md">
                <Upload className="w-16 h-16 mx-auto text-indigo-200 mb-4" />
                <h2 className="text-xl font-bold text-gray-800 mb-2">Veri Dosyası Bekleniyor</h2>
                <p className="text-gray-500 mb-6">Analiz veya simülasyon yapabilmek için önce sol menüden CSV dosyanızı yükleyin.</p>
                <div className="animate-pulse text-indigo-600 font-medium">Sol alttaki butonu kullanın</div>
             </div>
           </div>
        )}

        {/* --- 1. AYARLAR SAYFASI --- */}
        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right-4 duration-300">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" /> Sistem Konfigürasyonu
              </h2>
              <div className="space-y-6">
                
                {/* Genel Ayarlar */}
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
                   <h3 className="font-semibold text-slate-700 flex items-center gap-2 border-b pb-2 mb-4 border-slate-200">
                      <ListFilter className="w-4 h-4" /> Genel Analiz Parametreleri
                   </h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">CSV Ayırıcı (Separator)</label>
                        <select 
                          value={config.separator}
                          onChange={(e) => setConfig({...config, separator: e.target.value})}
                          className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                        >
                          <option value=";">Noktalı Virgül (;)</option>
                          <option value=",">Virgül (,)</option>
                        </select>
                      </div>
                      
                      {/* YENİ: HAREKET TÜRÜ GİRİŞİ */}
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                          FIFO Hesabına Katılacak Hareket Türleri
                        </label>
                        <input 
                          type="text" 
                          value={config.fifoMoveTypes}
                          onChange={(e) => setConfig({...config, fifoMoveTypes: e.target.value})}
                          placeholder="Örn: 101, 102, 561"
                          className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-mono"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Birden fazla hareket türü için virgül ile ayırın (Örn: 101, 561).
                        </p>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Sol: Temel Alanlar */}
                  <div>
                    <h3 className="font-semibold text-indigo-600 mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" /> Temel & Genel Stok Alanları
                    </h3>
                    <div className="space-y-3">
                      {['date', 'material', 'plant', 'moveType', 'qtyIn', 'qtyOut'].map((key) => (
                        <div key={key}>
                          <label className="text-xs font-semibold text-gray-500 uppercase">{key}</label>
                          <input 
                            type="text" 
                            value={config.colMap[key]}
                            onChange={(e) => setConfig({...config, colMap: {...config.colMap, [key]: e.target.value}})}
                            className="w-full border p-2 rounded mt-1 font-mono text-sm focus:border-indigo-500 outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sağ: Proje Alanları */}
                  <div>
                    <h3 className="font-semibold text-orange-600 mb-3 flex items-center gap-2">
                      <Briefcase className="w-4 h-4" /> Proje (PYP) Stok Alanları
                    </h3>
                    <div className="space-y-3 bg-orange-50 p-4 rounded-lg border border-orange-100">
                      {['project', 'qtyInPrj', 'qtyOutPrj'].map((key) => (
                        <div key={key}>
                          <label className="text-xs font-semibold text-gray-500 uppercase">{key}</label>
                          <input 
                            type="text" 
                            value={config.colMap[key]}
                            onChange={(e) => setConfig({...config, colMap: {...config.colMap, [key]: e.target.value}})}
                            className="w-full border p-2 rounded mt-1 font-mono text-sm focus:border-orange-500 outline-none"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      * Proje giriş/çıkış miktarları için Excel'deki ilgili (MZUPR/MAGPR) kolon adlarını giriniz.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* --- 2. SİMÜLASYON SAYFASI --- */}
        {activeTab === 'simulation' && (
          <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right-4 duration-300">
             <header className="mb-6">
               <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                 <Calculator className="w-7 h-7 text-indigo-600" /> Simülasyon
               </h2>
               <p className="text-gray-500">
                 Ayarlarda belirtilen hareket türlerine göre (Şu an: <strong>{config.fifoMoveTypes}</strong>) FIFO hesaplaması yapar.
               </p>
             </header>

             {/* Filtreler */}
             <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 flex items-center gap-1"><Calendar className="w-3 h-3"/> Tarih</label>
                  <input type="date" value={simDate} onChange={(e) => setSimDate(e.target.value)} className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 flex items-center gap-1"><Package className="w-3 h-3"/> Malzeme</label>
                  <select value={simMatnr} onChange={(e) => setSimMatnr(e.target.value)} className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Seçiniz</option>
                    {uniqueOptions.materials.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-gray-500 flex items-center gap-1"><Factory className="w-3 h-3"/> Tesis</label>
                  <select value={simWerks} onChange={(e) => setSimWerks(e.target.value)} className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Seçiniz</option>
                    {uniqueOptions.plants.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-orange-600 flex items-center gap-1"><Briefcase className="w-3 h-3"/> Proje (Opsiyonel)</label>
                  <select value={simPspnr} onChange={(e) => setSimPspnr(e.target.value)} className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-orange-500 border-orange-200 bg-orange-50">
                    <option value="">Genel (Projesiz)</option>
                    {uniqueOptions.projects.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <button 
                  onClick={runSimulation}
                  disabled={!simMatnr || !simWerks || rawCsvData.length === 0}
                  className="bg-indigo-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-300 transition-colors h-[42px]"
                >
                  Analiz Et
                </button>
             </div>

             {/* Sonuç Alanı */}
             {simResult && (
               <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className={`p-2 rounded text-center text-sm font-bold ${simResult.mode === 'PROJECT' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
                    {simResult.mode === 'PROJECT' ? `PROJE BAZLI HESAPLAMA (${simPspnr})` : 'GENEL STOK HESAPLAMASI'}
                  </div>

                  {/* KPI Kartları */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
                      <div className="text-sm opacity-90 mb-1">Hesaplanan Stok</div>
                      <div className="text-4xl font-bold">{simResult.stock !== null ? simResult.stock.toLocaleString() : 'N/A'} <span className="text-lg font-normal">Adet</span></div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                      <div className="text-sm opacity-90 mb-1">Ortalama Stok Yaşı</div>
                      <div className="text-4xl font-bold">{simResult.age !== null ? simResult.age : 'N/A'} <span className="text-lg font-normal">Gün</span></div>
                    </div>
                  </div>
                  
                  {/* FIFO Detay Tablosu */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 font-semibold text-gray-700">
                      FIFO Kaynak Detayı (Hareketler: {config.fifoMoveTypes})
                    </div>
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
                        <tr>
                          <th className="px-6 py-3">Giriş Tarihi</th>
                          <th className="px-6 py-3">Hareket</th>
                          <th className="px-6 py-3">Orijinal Giriş</th>
                          <th className="px-6 py-3">Stoktan Düşülen</th>
                          <th className="px-6 py-3">Gün Farkı</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {simResult.breakdown.map((row, i) => (
                          <tr key={i}>
                            <td className="px-6 py-3 font-mono text-gray-600">{row.date}</td>
                            <td className="px-6 py-3 font-bold text-gray-700">{row.moveType}</td>
                            <td className="px-6 py-3 text-gray-400">{row.originalQty}</td>
                            <td className="px-6 py-3 font-bold text-indigo-700">{row.usedQty}</td>
                            <td className="px-6 py-3"><span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">{row.ageDays} Gün</span></td>
                          </tr>
                        ))}
                        {simResult.breakdown.length === 0 && (
                          <tr><td colSpan="5" className="text-center py-6 text-gray-400">Veri bulunamadı veya stok sıfır.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
               </div>
             )}
          </div>
        )}

        {/* --- 3. RAPOR SAYFASI --- */}
        {activeTab === 'report' && (
          <div className="space-y-6 h-full flex flex-col animate-in slide-in-from-right-4 duration-300">
            
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                 <h2 className="font-bold text-lg text-gray-700">Toplu Rapor</h2>
                 {fileName && <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">{rawCsvData.length} Satır</span>}
              </div>

              <div className="flex items-center gap-2">
                 <button 
                  onClick={runFullAnalysis}
                  disabled={rawCsvData.length === 0 || isProcessing}
                  className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-white transition-all ${
                    rawCsvData.length === 0 
                      ? 'bg-gray-300 cursor-not-allowed' 
                      : 'bg-green-600 hover:bg-green-700 shadow-md hover:shadow-lg'
                  }`}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                  {isProcessing ? 'Tümünü Hesapla' : 'Hesaplamayı Başlat'}
                </button>

                {processedData.length > 0 && (
                   <button 
                     onClick={handleExport}
                     className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm"
                   >
                     <Download className="w-4 h-4" /> İndir
                   </button>
                )}
              </div>
            </div>

            <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
                    <tr>
                      {headers.map((h, i) => <th key={i} className="px-4 py-3 border-b border-gray-200 min-w-[100px]">{h}</th>)}
                      {/* GENEL STOK KOLONLARI */}
                      <th className="px-4 py-3 border-b border-gray-200 bg-green-50 text-green-800 border-l border-green-200 min-w-[100px]">Genel Stok</th>
                      <th className="px-4 py-3 border-b border-gray-200 bg-green-50 text-green-800 min-w-[100px]">Genel Yaş</th>
                      {/* PROJE STOK KOLONLARI */}
                      <th className="px-4 py-3 border-b border-gray-200 bg-orange-50 text-orange-800 border-l border-orange-200 min-w-[100px]">Proje Stok</th>
                      <th className="px-4 py-3 border-b border-gray-200 bg-orange-50 text-orange-800 min-w-[100px]">Proje Yaş</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(processedData.length > 0 ? processedData : rawCsvData).slice(0, 100).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {headers.map((h, j) => <td key={j} className="px-4 py-2 whitespace-nowrap text-gray-600">{row[h]}</td>)}
                        {processedData.length > 0 ? (
                          <>
                            <td className="px-4 py-2 font-bold text-green-700 bg-green-50/30 border-l border-green-100">{row._stdStock}</td>
                            <td className="px-4 py-2 font-bold text-green-700 bg-green-50/30">{row._stdAge}</td>
                            
                            <td className="px-4 py-2 font-bold text-orange-700 bg-orange-50/30 border-l border-orange-100">
                              {row._prjStock !== null ? row._prjStock : '-'}
                            </td>
                            <td className="px-4 py-2 font-bold text-orange-700 bg-orange-50/30">
                              {row._prjAge !== null ? row._prjAge : '-'}
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2 border-l">-</td>
                            <td className="px-4 py-2">-</td>
                            <td className="px-4 py-2 border-l">-</td>
                            <td className="px-4 py-2">-</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
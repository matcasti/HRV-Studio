
// =============================================
// HRV STUDIO — Complete Analysis Application
// =============================================

// ===== GLOBAL STATE =====
const state = {
  theme: 'dark',
  currentView: 'library',
  currentRecording: null,
  recordings: [],
  folders: [],
  tags: [],
  libraryView: 'grid',
  filters: { search: '', folderId: null, tags: [], sortBy: 'date-desc' },
  cleanMode: 'view',
  cleanHistory: [],
  importBuffer: null,
  charts: {},
  settings: {
    rrUnit: 'ms', fsResample: 4,
    vlfMin: 0.003, vlfMax: 0.04,
    lfMin: 0.04, lfMax: 0.15,
    hfMin: 0.15, hfMax: 0.4,
    sampEnM: 2, sampEnR: 0.2,
    slidingWinBeats: 300, slidingStepBeats: 60
  },
  // Analysis windows per recording
  windows: [],          // [{id, label, color, startBeat, endBeat, analysis}]
  activeWindowId: null,
  windowMode: false,    // true = user is drawing a new window
  windowDraft: null,    // {startBeat, endBeat} during drag
  dynamicTab: 'sliding' // active tab in non-stationary panel
};

// ===== METRIC INFO DEFINITIONS =====
const METRIC_INFO = {
  // Time domain
  meanRR:     { n:'Media RR', d:'Promedio de todos los intervalos entre latidos consecutivos. Inversamente proporcional a la FC media.', c:'Σ RR / N', r:'600–1000 ms (FC 60–100 bpm)', a:'< 600 ms: taquicardia; > 1000 ms: bradicardia' },
  sdnn:       { n:'SDNN', d:'Desviación estándar de todos los intervalos NN. Refleja la variabilidad global de la FC e integra todas las fuentes autonómicas cíclicas.', c:'σ de la serie RR completa', r:'50–100 ms (grabación 5 min)', a:'< 50 ms: VFC muy reducida, riesgo CV aumentado; > 150 ms: atletas / alta actividad vagal' },
  rmssd:      { n:'RMSSD', d:'Raíz cuadrática media de diferencias sucesivas de NN. Principal índice de modulación parasimpática a corto plazo. Robusto a tendencias lentas.', c:'√(media de (RRᵢ₊₁ − RRᵢ)²)', r:'20–50 ms', a:'< 20 ms: baja actividad vagal; correlaciona con mayor morbimortalidad cardiovascular' },
  pnn50:      { n:'pNN50', d:'Porcentaje de pares de intervalos NN consecutivos con diferencia > 50 ms. Marcador de actividad vagal, especialmente en grabaciones cortas.', c:'(NN50 / N total) × 100', r:'> 5–15% adultos en reposo', a:'< 5%: reducción significativa de actividad parasimpática' },
  nn50:       { n:'NN50', d:'Número absoluto de pares de intervalos NN consecutivos que difieren más de 50 ms.', c:'Conteo de |RRᵢ₊₁ − RRᵢ| > 50 ms', r:'Depende de duración del registro', a:'Bajo: reducción de variabilidad a corto plazo; debe interpretarse junto a pNN50' },
  pnn20:      { n:'pNN20', d:'Porcentaje de intervalos NN con diferencia > 20 ms. Más sensible que pNN50 en grabaciones cortas (< 2 min).', c:'(NN20 / N total) × 100', r:'> 30% aprox.', a:'Bajo: reducción de actividad parasimpática; útil en registros cortos' },
  cv:         { n:'CV (Coeficiente de Variación)', d:'Variabilidad relativa independiente de la FC media. Permite comparación entre sujetos con distinta FC basal.', c:'(SDNN / Media RR) × 100', r:'3–10%', a:'< 3%: rigidez autonómica; > 12%: alta variabilidad, posibles ectopias' },
  triIndex:   { n:'Índice Triangular HRV', d:'Razón entre el total de intervalos NN y el modo del histograma. Refleja la distribución geométrica de la VFC; robusto a ectopias ocasionales.', c:'N total / pico del histograma RR (bin 8 ms)', r:'> 15 (grabaciones largas)', a:'< 15: VFC reducida; < 8: VFC muy deteriorada (p.ej. IC avanzada)' },
  sdann:      { n:'SDANN', d:'Desviación estándar de las medias de intervalos NN en segmentos de 5 min. Refleja variabilidad circadiana y ultradiana. Solo fiable en grabaciones ≥ 2 segmentos de 5 min.', c:'σ de las medias de cada segmento de 5 min', r:'> 40 ms (registros 24 h)', a:'Reducido en IC, neuropatía autonómica, diabetes con compromiso vagal' },
  sdnni:      { n:'SDNNi', d:'Media de las desviaciones estándar por segmentos de 5 min. Refleja variabilidad intrasegmento (componentes de alta frecuencia). Complementa SDANN.', c:'Media de σ dentro de cada segmento de 5 min', r:'> 25 ms', a:'Reducida: pérdida de variabilidad a corto plazo sostenida en el tiempo' },
  // Frequency domain
  vlf:        { n:'VLF (Very Low Frequency)', d:'Potencia espectral 0.003–0.04 Hz. Relacionada con termorregulación, vasomotricidad y eje renina-angiotensina. Poco fiable en grabaciones < 5 min.', c:'∫ PSD en 0.003–0.04 Hz (Lomb-Scargle)', r:'< 1500 ms² (5 min)', a:'Reducida: IC, sepsis; muy aumentada: apnea del sueño, fallo autonómico' },
  lf:         { n:'LF (Low Frequency)', d:'Potencia espectral 0.04–0.15 Hz. Refleja tanto actividad simpática como parasimpática; marcado componente del reflejo barorreceptor.', c:'∫ PSD en 0.04–0.15 Hz', r:'500–1500 ms² aprox. (5 min, reposo)', a:'Aumentada: estrés, hipertensión; reducida: neuropatía autonómica, IC' },
  hf:         { n:'HF (High Frequency)', d:'Potencia espectral 0.15–0.4 Hz. Reflejo directo de la modulación vagal respiratoria (arritmia sinusal respiratoria). Marcador parasimpático.', c:'∫ PSD en 0.15–0.4 Hz', r:'200–800 ms² aprox. (5 min, reposo)', a:'Reducida: baja actividad vagal, ansiedad, estrés, DM, IC; aumentada: atletas' },
  lfNorm:     { n:'LF normalizada', d:'Potencia LF como fracción de (LF+HF). Minimiza el efecto de la potencia total y permite comparaciones entre sujetos con distinta VFC basal.', c:'LF / (LF+HF) × 100 n.u.', r:'54 ± 4 n.u. (reposo, adultos)', a:'> 60 n.u.: predominio simpático o actividad barorreceptora aumentada' },
  hfNorm:     { n:'HF normalizada', d:'Potencia HF como fracción de (LF+HF). Índice relativo de modulación vagal. Complementa HF norm en el análisis del balance autonómico.', c:'HF / (LF+HF) × 100 n.u.', r:'29 ± 3 n.u. (reposo)', a:'< 20 n.u.: reducción importante de modulación vagal relativa' },
  lfhf:       { n:'Ratio LF/HF', d:'Cociente entre potencias LF y HF. Usado clásicamente como proxy del balance simpato-vagal, aunque su interpretación aislada es controversia en la literatura.', c:'LF / HF', r:'1.5–2.0 (reposo, adultos)', a:'> 2.5: predominio simpático o estrés; < 0.8: predominio vagal (ejercicio intenso, relajación)' },
  lfPeakF:    { n:'Frecuencia pico LF', d:'Frecuencia de mayor potencia dentro de la banda LF. Corresponde aproximadamente a la oscilación del barorreflepto (onda de Mayer).', c:'argmax PSD en 0.04–0.15 Hz', r:'~0.1 Hz', a:'Desplazado o ausente: alteración barorreceptora; varía con respiración y postura' },
  hfPeakF:    { n:'Frecuencia pico HF', d:'Frecuencia de mayor potencia en la banda HF. Corresponde directamente a la frecuencia respiratoria. Útil para verificar correcta atribución del componente vagal.', c:'argmax PSD en 0.15–0.4 Hz', r:'~0.25 Hz (15 rpm)', a:'< 0.15 Hz o > 0.4 Hz: respiración lenta/rápida fuera de banda; revisar protocolo' },
  // Non-linear
  sd1:        { n:'SD1 (Poincaré)', d:'Desviación estándar perpendicular al eje de identidad. Refleja variabilidad a corto plazo (latido a latido), principalmente de origen vagal. Matemáticamente equivalente a RMSSD/√2.', c:'√(½·var(RRᵢ₊₁ − RRᵢ))', r:'15–40 ms (reposo)', a:'Reducida: baja modulación parasimpática; correlaciona directamente con RMSSD' },
  sd2:        { n:'SD2 (Poincaré)', d:'Desviación estándar a lo largo del eje de identidad. Refleja variabilidad a largo plazo (tendencias lentas). Engloba tanto simpático como parasimpático.', c:'√(2·SDNN² − SD1²/2)', r:'50–130 ms (reposo)', a:'Reducida junto con SD1: deterioro global de la VFC; predomina en IC y neuropatía' },
  sd1sd2:     { n:'SD1/SD2', d:'Razón entre variabilidad corto y largo plazo. Índice de balance autonómico temporal. Valores más altos indican proporcionalmente mayor componente vagal a corto plazo.', c:'SD1 / SD2', r:'0.25–0.50', a:'< 0.20: predominio de variabilidad lenta sobre rápida; frecuente en estrés crónico y fatiga' },
  sampen:     { n:'SampEn (Entropía Muestral)', d:'Cuantifica la irregularidad y complejidad de la señal RR. Sin auto-comparación (más robusto que ApEn). Mayor valor = mayor complejidad y adaptabilidad del sistema.', c:'−ln(A/B); A=matches m+1, B=matches m, tolerancia r=factor×SDNN', r:'1.0–2.0 (adultos sanos)', a:'< 0.8: pérdida de complejidad; asociado a IC, DM, estrés severo, envejecimiento patológico' },
  apen:       { n:'ApEn (Entropía Aproximada)', d:'Medida de irregularidad de la señal RR. Precursor de SampEn, sesgado en series cortas por incluir auto-comparación. Útil como referencia histórica.', c:'φ(m) − φ(m+1); φ=media de log-probabilidades de coincidencia', r:'0.7–1.5', a:'< 0.5: regularidad excesiva; asociado a enfermedades sistémicas graves' },
  alpha1:     { n:'DFA α1 (escala corta)', d:'Exponente de fluctuación sin tendencia, escala 4–16 latidos. Cuantifica correlaciones de ley de potencia a corto plazo en la serie RR.', c:'Pendiente log-log de F(n) vs n, n=4–16 (DFA de Peng et al.)', r:'0.75–1.25 (adultos sanos, reposo)', a:'< 0.75: anticorrelación (patológico, IC severa); > 1.25: correlaciones excesivas (fibrilación); ~1.0: óptimo fractal' },
  alpha2:     { n:'DFA α2 (escala larga)', d:'Exponente de fluctuación sin tendencia, escala 16–64 latidos. Refleja correlaciones a largo plazo; menos estudiado clínicamente que α1.', c:'Pendiente log-log de F(n) vs n, n=16–64', r:'0.85–1.35', a:'Valores extremos: pérdida de complejidad fractal a largo plazo; sensible a cambios circadianos' },
  corrDim:    { n:'Dimensión de Correlación (D2)', d:'Estimación de la dimensionalidad del atractor del sistema cardiovascular. A mayor D2, mayor complejidad dinámica. Requiere series largas para ser fiable.', c:'Pendiente log-log de C(r) vs r (Grassberger-Procaccia)', r:'Variable; mayor = más complejo', a:'Reducida en enfermedades crónicas y envejecimiento; debe interpretarse con cautela en series cortas' },
  // Composite
  cvi:        { n:'CVI (Cardiac Vagal Index)', d:'Índice logarítmico de actividad vagal cardíaca basado en el área del diagrama de Poincaré. Combina SD1 y SD2 en una única métrica de actividad vagal.', c:'log₁₀(4π · SD1 · SD2)', r:'3.5–5.0', a:'< 3.5: reducción de actividad vagal cardíaca; útil en monitorización longitudinal' },
  csi:        { n:'CSI (Cardiac Sympathetic Index)', d:'Índice de actividad simpática basado en la forma alargada del diagrama de Poincaré. Aumenta cuando hay predominio simpático relativo.', c:'SD2 / SD1', r:'2.0–5.0', a:'> 5: predominio simpático marcado; usado en evaluación de neuropatía autonómica diabética' },
  gsi:        { n:'GSI (Índice Simpato-vagal Geométrico)', d:'Media geométrica de SD1 y SD2. Proxy del balance global simpato-vagal que penaliza desequilibrios extremos entre ambos índices.', c:'√(SD1 × SD2)', r:'30–80 ms', a:'Reducido: deterioro global de VFC; útil para comparación entre sesiones' },
  stressIndex: { n:'Índice de Estrés (Baevsky)', d:'Índice de tensión regulatoria del SNA. Cuantifica la carga sobre los mecanismos de regulación cardíaca. Aumenta con estrés físico y psicológico.', c:'Moda / (2 · Rango RR · Moda RR)', r:'< 150 u.a. (reposo)', a:'150–500: estrés autonómico moderado; > 500: sobrecarga regulatoria severa' },
  vagusPower: { n:'Potencia Vagal (%)', d:'Fracción de la potencia espectral total representada por la banda HF. Indica qué porcentaje de la VFC es de origen parasimpático.', c:'(HF / Potencia Total) × 100', r:'30–50% (reposo)', a:'< 20%: reducción significativa de tono vagal; > 60%: alta dominancia vagal' },
  symPower:   { n:'Potencia Simpática (%)', d:'Fracción de la potencia espectral total representada por LF. Indicador relativo de influencia simpática/barorreceptora.', c:'(LF / Potencia Total) × 100', r:'20–45% (reposo)', a:'> 50%: predominio simpático o estrés marcado' },
  dc:         { n:'DC (Deceleration Capacity)', d:'Capacidad de desaceleración cardíaca medida por Phase-Rectified Signal Averaging. Potente predictor de mortalidad post-infarto (Bauer et al. 2006). Refleja tono vagal.', c:'[PRSA(0)+PRSA(1)−PRSA(−1)−PRSA(−2)] / 4 sobre anclas de desaceleración', r:'> 4.5 ms', a:'< 2.5 ms: riesgo de muerte cardíaca súbita ×5.6; 2.5–4.5 ms: riesgo intermedio' },
  ac:         { n:'AC (Acceleration Capacity)', d:'Capacidad de aceleración cardíaca por PRSA. Refleja reserva simpática y reducción del tono vagal. Complementa DC en la evaluación del balance autonómico.', c:'[PRSA(0)+PRSA(1)−PRSA(−1)−PRSA(−2)] / 4 sobre anclas de aceleración', r:'Negativo, |AC| > 2 ms', a:'Valor absoluto pequeño: reducción de reserva simpática o incapacidad de aceleración' },
};

/** Renders a small ⓘ icon that triggers the floating info tooltip */
function _miInfo(key) {
  if (!METRIC_INFO[key]) return '';
  return `<span class="mi-info" data-metric="${key}">i</span>`;
}

// ===== INDEXEDDB MODULE =====
const DB = (() => {
  const DB_NAME = 'HRVStudio', DB_VERSION = 1;
  let db;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('recordings')) {
          const rs = d.createObjectStore('recordings', { keyPath: 'id' });
          rs.createIndex('folderId', 'folderId'); rs.createIndex('created', 'created');
        }
        if (!d.objectStoreNames.contains('folders')) d.createObjectStore('folders', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('tags')) d.createObjectStore('tags', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror = () => reject(req.error);
    });
  }

  function tx(store, mode = 'readonly') { return db.transaction(store, mode).objectStore(store); }

  function getAll(store) {
    return new Promise((resolve, reject) => {
      const req = tx(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function get(store, key) {
    return new Promise((resolve, reject) => {
      const req = tx(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function put(store, obj) {
    return new Promise((resolve, reject) => {
      const req = tx(store, 'readwrite').put(obj);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function del(store, key) {
    return new Promise((resolve, reject) => {
      const req = tx(store, 'readwrite').delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function clearStore(store) {
    return new Promise((resolve, reject) => {
      const req = tx(store, 'readwrite').clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  return { open, getAll, get, put, del, clearStore };
})();

// ===== MATH UTILITIES =====
const MathUtils = {
  mean: arr => arr.reduce((a, b) => a + b, 0) / arr.length,
  sum: arr => arr.reduce((a, b) => a + b, 0),
  variance: arr => {
    const m = MathUtils.mean(arr);
    return arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
  },
  stdDev: arr => Math.sqrt(MathUtils.variance(arr)),
  median: arr => {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  },
  linReg: (xs, ys) => {
    const n = xs.length, mx = MathUtils.mean(xs), my = MathUtils.mean(ys);
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
    const slope = den ? num / den : 0;
    return { slope, intercept: my - slope * mx };
  },
  nextPow2: n => Math.pow(2, Math.ceil(Math.log2(n))),
  clamp: (v, lo, hi) => Math.min(Math.max(v, lo), hi),
  fmt: (v, d = 2) => v == null || isNaN(v) ? '—' : v.toFixed(d),
  fmtHz: v => v == null ? '—' : (v < 0.01 ? (v * 1000).toFixed(2) + ' mHz' : v.toFixed(4) + ' Hz')
};

// ===== FFT =====
const FFT = {
  transform(signal) {
    const n = signal.length;
    const size = MathUtils.nextPow2(n);
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < n; i++) {
      re[i] = signal[i] * (0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)))); // Hann
    }
    // Cooley-Tukey
    for (let i = 1, j = 0; i < size; i++) {
      let bit = size >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= size; len <<= 1) {
      const ang = -2 * Math.PI / len;
      const wRe = Math.cos(ang), wIm = Math.sin(ang);
      for (let i = 0; i < size; i += len) {
        let cRe = 1, cIm = 0;
        for (let j = 0; j < len >> 1; j++) {
          const uR = re[i+j], uI = im[i+j];
          const vR = re[i+j+(len>>1)] * cRe - im[i+j+(len>>1)] * cIm;
          const vI = re[i+j+(len>>1)] * cIm + im[i+j+(len>>1)] * cRe;
          re[i+j] = uR + vR; im[i+j] = uI + vI;
          re[i+j+(len>>1)] = uR - vR; im[i+j+(len>>1)] = uI - vI;
          const nr = cRe * wRe - cIm * wIm;
          cIm = cRe * wIm + cIm * wRe; cRe = nr;
        }
      }
    }
    const power = new Array(size >> 1);
    for (let i = 0; i <= size >> 1; i++) power[i] = (re[i] ** 2 + im[i] ** 2) / (n * n);
    return { power, size };
  },

  resample(rrMs, fs = 4) {
    const times = [0];
    for (const r of rrMs) times.push(times[times.length - 1] + r);
    const total = times[times.length - 1];
    const dt = 1000 / fs;
    const out = [];
    for (let t = 0; t < total - dt; t += dt) {
      let j = 0;
      while (j < times.length - 2 && times[j + 1] <= t) j++;
      const alpha = (t - times[j]) / (times[j + 1] - times[j]);
      out.push(rrMs[j] + alpha * (rrMs[j + 1] - rrMs[j]));
    }
    return out;
  }
};

// ===== LOMB-SCARGLE PERIODOGRAM =====
// Works directly on unevenly-sampled RR intervals — no resampling required.
const LombScargle = {
  /**
   * One-sided PSD in ms²/Hz, Parseval-normalized (∑PSD·df ≈ variance).
   * @param {number[]} rrMs  RR intervals in ms
   * @param {object}   s     settings (vlfMin, hfMax, …)
   */
  compute(rrMs, s = state.settings) {
    const n = rrMs.length;
    if (n < 30) return null;

    // Cumulative time axis in seconds
    const t = new Float64Array(n);
    for (let i = 1; i < n; i++) t[i] = t[i - 1] + rrMs[i - 1] / 1000;

    const mean = MathUtils.mean(rrMs);
    const y    = rrMs.map(v => v - mean);
    const variance = MathUtils.variance(rrMs);
    if (variance < 0.1) return null;

    const freqMin = s.vlfMin  || 0.003;
    const freqMax = (s.hfMax  || 0.4) + 0.06;
    const nFreqs  = 800;                       // resolution vs speed balance
    const df      = (freqMax - freqMin) / (nFreqs - 1);

    const freqs = new Array(nFreqs);
    const raw   = new Float64Array(nFreqs);

    for (let fi = 0; fi < nFreqs; fi++) {
      const f     = freqMin + fi * df;
      const omega = 2 * Math.PI * f;
      freqs[fi]   = f;
      let re = 0, im = 0;
      for (let i = 0; i < n; i++) {
        const phi = omega * t[i];
        re +=  y[i] * Math.cos(phi);
        im -=  y[i] * Math.sin(phi);
      }
      raw[fi] = re * re + im * im;             // |NDFT(f)|²
    }

    // Parseval normalization: scale so ∑psd·df = variance
    let rawSum = 0;
    for (let fi = 0; fi < nFreqs; fi++) rawSum += raw[fi];
    const scale = rawSum > 0 ? variance / (rawSum * df) : 1;
    const psd   = Array.from(raw, v => v * scale);

    return { freqs, psd, df };
  },

  bandPower(freqs, psd, fLo, fHi) {
    const df = freqs.length > 1 ? freqs[1] - freqs[0] : 0.001;
    let sum = 0;
    for (let i = 0; i < freqs.length; i++) {
      if (freqs[i] >= fLo && freqs[i] < fHi) sum += psd[i];
    }
    return sum * df;
  },

  peakFreq(freqs, psd, fLo, fHi) {
    let maxP = -Infinity, peak = 0;
    for (let i = 0; i < freqs.length; i++) {
      if (freqs[i] >= fLo && freqs[i] < fHi && psd[i] > maxP) {
        maxP = psd[i]; peak = freqs[i];
      }
    }
    return peak;
  }
};

// ===== HRV ENGINE =====
const HRV = {
  // Convert raw data to ms
  normalize(rr) {
    if (!rr || rr.length < 10) return null;
    const arr = rr.filter(v => isFinite(v) && v > 0);
    const median = MathUtils.median(arr);
    // Auto-detect unit: if median < 5, it's in seconds
    const factor = median < 5 ? 1000 : 1;
    return arr.map(v => v * factor);
  },

  timeDomain(rrMs) {
    const n = rrMs.length;
    if (n < 5) return null;
    const mean = MathUtils.mean(rrMs);
    const sdnn = MathUtils.stdDev(rrMs);
    const diffs = [];
    for (let i = 1; i < n; i++) diffs.push(Math.abs(rrMs[i] - rrMs[i - 1]));
    const rmssd = Math.sqrt(MathUtils.mean(diffs.map(d => d * d)));
    const nn50 = diffs.filter(d => d > 50).length;
    const pnn50 = (nn50 / diffs.length) * 100;
    const nn20 = diffs.filter(d => d > 20).length;
    const pnn20 = (nn20 / diffs.length) * 100;
    const meanHR = 60000 / mean;
    const hr = rrMs.map(r => 60000 / r);
    const sdHR = MathUtils.stdDev(hr);
    const minHR = Math.min(...hr), maxHR = Math.max(...hr);
    const cv = (sdnn / mean) * 100;

    // Geometric
    const binW = 8; // ms bin width
    const minR = Math.min(...rrMs), maxR = Math.max(...rrMs);
    const bins = {};
    for (const r of rrMs) {
      const b = Math.floor((r - minR) / binW);
      bins[b] = (bins[b] || 0) + 1;
    }
    const peak = Math.max(...Object.values(bins));
    const triIndex = n / peak;
    const rrRange = maxR - minR;

    // SDANN / SDNNi (approximate for short recordings)
    let sdann = null, sdnni = null;
    const segLen = 5 * 60 * 1000; // 5 min in ms
    const totalTime = MathUtils.sum(rrMs);
    if (totalTime >= segLen * 2) {
      const segs = [];
      let t = 0, segStart = 0;
      let seg = [];
      for (let i = 0; i < n; i++) {
        t += rrMs[i];
        seg.push(rrMs[i]);
        if (t - segStart >= segLen) {
          segs.push(seg); seg = []; segStart = t;
        }
      }
      if (segs.length >= 2) {
        const segMeans = segs.map(s => MathUtils.mean(s));
        const segSDs = segs.map(s => MathUtils.stdDev(s));
        sdann = MathUtils.stdDev(segMeans);
        sdnni = MathUtils.mean(segSDs);
      }
    }

    // Min/Max RR
    const minRR = Math.min(...rrMs), maxRR = Math.max(...rrMs);
    const medianRR = MathUtils.median(rrMs);

    return {
      n, mean: Math.round(mean * 10) / 10,
      sdnn: Math.round(sdnn * 10) / 10,
      rmssd: Math.round(rmssd * 10) / 10,
      nn50, pnn50: Math.round(pnn50 * 10) / 10,
      nn20, pnn20: Math.round(pnn20 * 10) / 10,
      meanHR: Math.round(meanHR * 10) / 10,
      sdHR: Math.round(sdHR * 10) / 10,
      minHR: Math.round(minHR * 10) / 10,
      maxHR: Math.round(maxHR * 10) / 10,
      cv: Math.round(cv * 100) / 100,
      triIndex: Math.round(triIndex * 10) / 10,
      minRR: Math.round(minRR), maxRR: Math.round(maxRR),
      medianRR: Math.round(medianRR),
      rrRange: Math.round(rrRange),
      sdann: sdann ? Math.round(sdann * 10) / 10 : null,
      sdnni: sdnni ? Math.round(sdnni * 10) / 10 : null,
      totalDuration: Math.round(totalTime / 1000)
    };
  },

  // REEMPLAZAR todo el método frequencyDomain por este:
  frequencyDomain(rrMs, settings = state.settings) {
    const { vlfMin, vlfMax, lfMin, lfMax, hfMin, hfMax } = settings;
    if (!rrMs || rrMs.length < 30) return null;
    try {
      const ls = LombScargle.compute(rrMs, settings);
      if (!ls) return null;
      const { freqs, psd } = ls;
  
      const vlf   = LombScargle.bandPower(freqs, psd, vlfMin, vlfMax);
      const lf    = LombScargle.bandPower(freqs, psd, lfMin,  lfMax);
      const hf    = LombScargle.bandPower(freqs, psd, hfMin,  hfMax);
      const total = vlf + lf + hf;
  
      const lfNorm  = (lf + hf) > 0 ? lf / (lf + hf) * 100 : 0;
      const hfNorm  = (lf + hf) > 0 ? hf / (lf + hf) * 100 : 0;
      const lfhf    = hf > 0 ? lf / hf : null;
      const lfPeakF = LombScargle.peakFreq(freqs, psd, lfMin, lfMax);
      const hfPeakF = LombScargle.peakFreq(freqs, psd, hfMin, hfMax);
  
      return {
        vlf: Math.round(vlf), lf: Math.round(lf), hf: Math.round(hf),
        total: Math.round(total),
        lfNorm: Math.round(lfNorm * 10) / 10,
        hfNorm: Math.round(hfNorm * 10) / 10,
        lfhf:   lfhf != null ? Math.round(lfhf * 100) / 100 : null,
        lfPeakF: Math.round(lfPeakF * 1000) / 1000,
        hfPeakF: Math.round(hfPeakF * 1000) / 1000,
        psdFreqs: freqs, psdPow: psd   // field names kept for chart compatibility
      };
    } catch(e) { console.warn('FreqDomain LS error:', e); return null; }
  },

  nonLinear(rrMs) {
    const n = rrMs.length;
    if (n < 20) return null;

    // Poincaré (SD1, SD2)
    const sd1sq = [], sd2sq = [];
    for (let i = 0; i < n - 1; i++) {
      const x = rrMs[i], y = rrMs[i + 1];
      sd1sq.push(((y - x) ** 2) / 2);
      sd2sq.push(((y + x - 2 * MathUtils.mean(rrMs)) ** 2) / 2);
    }
    const sd1 = Math.sqrt(MathUtils.mean(sd1sq));
    const sd2 = Math.sqrt(MathUtils.mean(sd2sq));

    // ApEn (fast approximation, m=2)
    const sampN = Math.min(n, 500);
    const subRR = rrMs.slice(0, sampN);
    const m = state.settings.sampEnM;
    const r = state.settings.sampEnR * MathUtils.stdDev(subRR);
    const sampen = this._sampleEntropy(subRR, m, r);
    const apen = this._approxEntropy(subRR.slice(0, Math.min(300, sampN)), m, r);

    // DFA
    let alpha1 = null, alpha2 = null;
    if (n >= 30) {
      const dfaRes = this._dfa(rrMs);
      alpha1 = dfaRes.alpha1; alpha2 = dfaRes.alpha2;
    }

    // Return map (2nd order Poincaré)
    const poincare = [];
    for (let i = 0; i < Math.min(n - 1, 1000); i++) poincare.push([rrMs[i], rrMs[i + 1]]);

    // Recurrence Rate (approx)
    const corrDim = this._corrDim(subRR.slice(0, 200), r);

    return {
      sd1: Math.round(sd1 * 10) / 10,
      sd2: Math.round(sd2 * 10) / 10,
      sd1sd2: Math.round((sd1 / sd2) * 1000) / 1000,
      sampen: sampen != null ? Math.round(sampen * 1000) / 1000 : null,
      apen: apen != null ? Math.round(apen * 1000) / 1000 : null,
      alpha1: alpha1 ? Math.round(alpha1 * 1000) / 1000 : null,
      alpha2: alpha2 ? Math.round(alpha2 * 1000) / 1000 : null,
      corrDim: corrDim ? Math.round(corrDim * 100) / 100 : null,
      poincare
    };
  },

  composite(td, fd, nl) {
    if (!td) return null;
    const res = {};
    // Stress index (Baevsky) — simplified
    if (td) {
      const amo = td.n / (td.rrRange || 1) * 100; // approximation
      res.stressIndex = Math.round((amo / (2 * (td.rrRange || 1) * (td.medianRR / 1000))) * 100) / 100;
    }
    // CVI, CSI (Vagal/Sympathetic indices) from SD1/SD2
    if (nl && nl.sd1 > 0 && nl.sd2 > 0) {
      res.cvi = Math.round(Math.log10(4 * Math.PI * nl.sd1 * nl.sd2) * 1000) / 1000;
      res.csi = Math.round((nl.sd2 / nl.sd1) * 100) / 100;
      res.gsi = Math.round(Math.sqrt(nl.sd1 * nl.sd2) * 10) / 10;
    }
    // Autonomic Balance (LF/HF proxy)
    if (fd) {
      res.lfhf = fd.lfhf;
      res.vagusPower = Math.round(fd.hf / (fd.total || 1) * 100 * 10) / 10;
      res.symPower = Math.round(fd.lf / (fd.total || 1) * 100 * 10) / 10;
    }
    // PRSA-like (simplified: mean acceleration and deceleration)
    if (td) {
      const accel = [], decel = [];
      for (let i = 1; i < (state.currentRecording?.cleanRR?.length || 0); i++) {
        const rr = state.currentRecording.cleanRR;
        if (rr[i] < rr[i-1]) accel.push(rr[i]);
        else if (rr[i] > rr[i-1]) decel.push(rr[i]);
      }
      if (accel.length > 5 && decel.length > 5) {
        res.dc = Math.round(MathUtils.mean(decel) * 10) / 10;
        res.ac = Math.round(MathUtils.mean(accel) * 10) / 10;
      }
    }
    return res;
  },

  _sampleEntropy(data, m, r) {
    const n = data.length;
    if (n < m + 2) return null;
    let A = 0, B = 0;
    for (let i = 0; i < n - m - 1; i++) {
      for (let j = i + 1; j < n - m; j++) {
        let matchM = true;
        for (let k = 0; k < m; k++) if (Math.abs(data[i+k] - data[j+k]) > r) { matchM = false; break; }
        if (matchM) { B++; if (Math.abs(data[i+m] - data[j+m]) <= r) A++; }
      }
    }
    return B === 0 ? NaN : -Math.log(A / B);
  },

  _approxEntropy(data, m, r) {
    const n = data.length;
    if (n < m + 1) return null;
    function phi(m) {
      let sum = 0;
      for (let i = 0; i < n - m + 1; i++) {
        let cnt = 0;
        for (let j = 0; j < n - m + 1; j++) {
          let match = true;
          for (let k = 0; k < m; k++) if (Math.abs(data[i+k] - data[j+k]) > r) { match = false; break; }
          if (match) cnt++;
        }
        sum += Math.log(cnt / (n - m + 1));
      }
      return sum / (n - m + 1);
    }
    try { return phi(m) - phi(m + 1); } catch { return null; }
  },

  _dfa(data) {
    const n = data.length;
    const mean = MathUtils.mean(data);
    const y = new Array(n);
    let cs = 0;
    for (let i = 0; i < n; i++) { cs += data[i] - mean; y[i] = cs; }

    const getAlpha = (minN, maxN) => {
      const scales = [], flucs = [];
      for (let ns = minN; ns <= maxN; ns = Math.round(ns * 1.25) || ns + 1) {
        if (ns < 4 || ns > n - 1) continue;
        const segs = Math.floor(n / ns);
        if (segs < 2) continue;
        let F2 = 0;
        for (let s = 0; s < segs; s++) {
          const ys = y.slice(s * ns, (s + 1) * ns);
          const xs = Array.from({ length: ns }, (_, i) => i);
          const { slope, intercept } = MathUtils.linReg(xs, ys);
          for (let i = 0; i < ns; i++) F2 += (ys[i] - (slope * i + intercept)) ** 2;
        }
        const F = Math.sqrt(F2 / (segs * ns));
        if (F > 0) { scales.push(Math.log10(ns)); flucs.push(Math.log10(F)); }
      }
      if (scales.length < 3) return null;
      return MathUtils.linReg(scales, flucs).slope;
    };

    return {
      alpha1: getAlpha(4, Math.min(16, Math.floor(n / 4))),
      alpha2: n >= 64 ? getAlpha(16, Math.min(64, Math.floor(n / 4))) : null
    };
  },

  _corrDim(data, r) {
    const n = data.length;
    let C = 0;
    const pairs = n * (n - 1) / 2;
    if (pairs === 0) return null;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (Math.abs(data[i] - data[j]) < r) C++;
    const cr = C / pairs;
    if (cr <= 0 || cr >= 1) return null;
    return -Math.log(cr) / Math.log(r);
  },

  fullAnalysis(rrRaw) {
    const rrMs = this.normalize(rrRaw);
    if (!rrMs) return null;
    const td = this.timeDomain(rrMs);
    const fd = this.frequencyDomain(rrMs);
    const nl = this.nonLinear(rrMs);
    const comp = this.composite(td, fd, nl);
    return { rrMs, td, fd, nl, comp };
  }
};

// ===== PARSER =====
const Parse = {
  detect(text) {
    const lines = text.trim().split('\n').filter(l => l.trim());
    if (!lines.length) return null;

    // Detect CSV with headers
    const first = lines[0].trim();
    const hasComma = first.includes(',') || first.includes(';') || first.includes('\t');

    if (hasComma) {
      const sep = first.includes('\t') ? '\t' : (first.includes(';') ? ';' : ',');
      const header = first.toLowerCase().split(sep).map(h => h.trim().replace(/"/g, ''));
      const isHeader = isNaN(parseFloat(header[0]));

      if (isHeader) {
        // Find RR column
        const rrIdx = header.findIndex(h => h.includes('rr') || h.includes('r-r') || h.includes('nn') || h.includes('ibi') || h.includes('interval'));
        const timeIdx = header.findIndex(h => h.includes('time') || h.includes('t') || h === 'ms' || h === 's');
        return { format: 'csv-header', sep, rrIdx: rrIdx >= 0 ? rrIdx : 0, timeIdx, header };
      } else {
        return { format: 'csv-noheader', sep };
      }
    } else {
      return { format: 'txt-plain' };
    }
  },

  parse(text, detected) {
    const lines = text.trim().split('\n').filter(l => l.trim());
    const values = [];

    if (detected.format === 'csv-header') {
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(detected.sep).map(c => c.trim().replace(/"/g, ''));
        const v = parseFloat(cols[detected.rrIdx]);
        if (!isNaN(v) && v > 0) values.push(v);
      }
    } else if (detected.format === 'csv-noheader') {
      for (const line of lines) {
        const cols = line.split(detected.sep);
        // Try last column, then first
        const candidates = cols.map(c => parseFloat(c.trim())).filter(v => !isNaN(v) && v > 0);
        if (candidates.length) values.push(candidates[candidates.length - 1]);
      }
    } else {
      for (const line of lines) {
        const v = parseFloat(line.trim().replace(',', '.'));
        if (!isNaN(v) && v > 0) values.push(v);
      }
    }
    return values;
  }
};

// ===== CHARTS MODULE =====
const Charts = {
  destroyAll() {
    for (const key in state.charts) {
      try { state.charts[key].destroy(); } catch {}
    }
    state.charts = {};
  },

  destroyChart(id) {
    if (state.charts[id]) { try { state.charts[id].destroy(); } catch {} delete state.charts[id]; }
  },

  getCtx(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    return canvas.getContext('2d');
  },

  accent: () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#00C2D4',
  secondary: () => getComputedStyle(document.documentElement).getPropertyValue('--secondary').trim() || '#FFA020',
  textDim: () => getComputedStyle(document.documentElement).getPropertyValue('--text-dim').trim() || '#7A8FAE',
  border: () => getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#1C2840',

  baseOptions() {
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: true,
        backgroundColor: '#0C0F1C', borderColor: '#1C2840', borderWidth: 1,
        titleColor: '#DCE6F5', bodyColor: '#7A8FAE', padding: 8,
        titleFont: { family: 'Outfit', size: 12 },
        bodyFont: { family: 'JetBrains Mono', size: 11 }
      }},
      scales: {
        x: { grid: { color: this.border(), lineWidth: 0.5 }, ticks: { color: this.textDim(), font: { family: 'JetBrains Mono', size: 10 } } },
        y: { grid: { color: this.border(), lineWidth: 0.5 }, ticks: { color: this.textDim(), font: { family: 'JetBrains Mono', size: 10 } } }
      }
    };
  },

  renderTachogram(rrMs) {
    this.destroyChart('tachogramChart');
    const ctx = this.getCtx('tachogramChart');
    if (!ctx) return;
    const display = rrMs.slice(0, 2000);
    const labels = display.map((_, i) => i + 1);
    state.charts.tachogramChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data: display, borderColor: this.accent(), borderWidth: 1.2,
          pointRadius: 0, fill: false, tension: 0
        }]
      },
      options: {
        ...this.baseOptions(),
        plugins: { ...this.baseOptions().plugins,
          tooltip: { ...this.baseOptions().plugins.tooltip,
            callbacks: {
              title: ([{dataIndex}]) => `Latido #${dataIndex + 1}`,
              label: ({raw}) => `RR: ${Math.round(raw)} ms (${(60000/raw).toFixed(1)} bpm)`
            }
          }
        },
        scales: {
          x: { ...this.baseOptions().scales.x, title: { display: true, text: 'Latido #', color: this.textDim(), font: { size: 10 } } },
          y: { ...this.baseOptions().scales.y, title: { display: true, text: 'RR (ms)', color: this.textDim(), font: { size: 10 } } }
        }
      }
    });
  },

  renderPoincare(rrMs, td) {
    const canvas = document.getElementById('poincareCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.offsetWidth || 280, H = canvas.offsetHeight || 280;
    canvas.width = W; canvas.height = H;
    ctx.clearRect(0, 0, W, H);
    const pad = 32;
    const minV = Math.min(...rrMs) * 0.97, maxV = Math.max(...rrMs) * 1.03;
    const scale = v => pad + ((v - minV) / (maxV - minV)) * (W - 2 * pad);
    const scaleY = v => H - pad - ((v - minV) / (maxV - minV)) * (H - 2 * pad);
    // Background
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--card').trim();
    ctx.fillRect(0, 0, W, H);
    // Axes
    ctx.strokeStyle = this.border(); ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(pad, pad); ctx.lineTo(pad, H - pad); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad, H - pad); ctx.lineTo(W - pad, H - pad); ctx.stroke();
    // Identity line
    ctx.strokeStyle = 'rgba(255,160,32,0.3)'; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(scale(minV), scaleY(minV)); ctx.lineTo(scale(maxV), scaleY(maxV)); ctx.stroke();
    ctx.setLineDash([]);
    // Ellipses from SD1/SD2
    if (td) {
      const cx = scale(MathUtils.mean(rrMs)), cy = scaleY(MathUtils.mean(rrMs));
      const pixPerMs = (W - 2 * pad) / (maxV - minV);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-Math.PI / 4);
      // SD1 ellipse
      ctx.strokeStyle = 'rgba(0,194,212,0.3)'; ctx.lineWidth = 1;
      const r1 = td ? td.sdnn * pixPerMs * 0.5 : 20;
      const r2 = td ? MathUtils.stdDev(rrMs.slice(0, -1)) * pixPerMs * 0.8 : 30;
      ctx.beginPath(); ctx.ellipse(0, 0, r1, r2, 0, 0, 2 * Math.PI); ctx.stroke();
      ctx.restore();
    }
    // Points
    const pts = Math.min(rrMs.length - 1, 1000);
    ctx.fillStyle = this.accent() + '88';
    for (let i = 0; i < pts; i++) {
      const x = scale(rrMs[i]), y = scaleY(rrMs[i + 1]);
      ctx.beginPath(); ctx.arc(x, y, 2, 0, 2 * Math.PI); ctx.fill();
    }
    // Labels
    ctx.fillStyle = this.textDim(); ctx.font = '10px JetBrains Mono';
    ctx.fillText('RR(n)', W / 2, H - 4);
    ctx.save(); ctx.translate(10, H / 2); ctx.rotate(-Math.PI / 2);
    ctx.fillText('RR(n+1)', 0, 0); ctx.restore();
  },

  renderPSD(fd, rrMs) {
    this.destroyChart('psdChart');
    const ctx = this.getCtx('psdChart');
    if (!ctx) return;
    // Always compute fresh (avoids stale/missing stored arrays; fixes full-recording spectral issue)
    const src = rrMs || state.currentRecording?.cleanRR || state.currentRecording?.rrMs;
    if (!src || src.length < 30) return;
    const ls = LombScargle.compute(src, state.settings);
    if (!ls) return;
    const { freqs, psd: power } = ls;
    const bgColors = freqs.map(f => {
      if (f >= state.settings.vlfMin && f < state.settings.vlfMax) return 'rgba(100,136,255,0.3)';
      if (f >= state.settings.lfMin && f < state.settings.lfMax) return 'rgba(255,160,32,0.35)';
      if (f >= state.settings.hfMin && f < state.settings.hfMax) return 'rgba(0,194,212,0.35)';
      return 'rgba(60,80,100,0.1)';
    });
    state.charts.psdChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: freqs.map(f => f.toFixed(3)),
        datasets: [{
          data: power, backgroundColor: bgColors,
          borderColor: 'transparent', borderWidth: 0, barPercentage: 1.2, categoryPercentage: 1
        }]
      },
      options: {
        ...this.baseOptions(),
        plugins: { ...this.baseOptions().plugins,
          tooltip: { callbacks: {
            title: ([{dataIndex}]) => `${freqs[dataIndex].toFixed(4)} Hz`,
            label: ({raw}) => `${raw.toFixed(4)} ms²/Hz`
          }}
        },
        scales: {
          x: { ...this.baseOptions().scales.x, title: { display: true, text: 'Frecuencia (Hz)', color: this.textDim(), font: { size: 10 } },
            ticks: { maxTicksLimit: 8, ...this.baseOptions().scales.x.ticks } },
          y: { ...this.baseOptions().scales.y, title: { display: true, text: 'Potencia (ms²/Hz)', color: this.textDim(), font: { size: 10 } } }
        }
      }
    });
  },

  renderHistogram(rrMs) {
    this.destroyChart('histChart');
    const ctx = this.getCtx('histChart');
    if (!ctx) return;
    const binW = 20;
    const min = Math.floor(Math.min(...rrMs) / binW) * binW;
    const max = Math.ceil(Math.max(...rrMs) / binW) * binW;
    const bins = {};
    for (let b = min; b <= max; b += binW) bins[b] = 0;
    for (const r of rrMs) { const b = Math.floor(r / binW) * binW; if (bins[b] !== undefined) bins[b]++; }
    const labels = Object.keys(bins).map(Number);
    const data = Object.values(bins);
    const accent = this.accent();
    state.charts.histChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.map(l => l + ''),
        datasets: [{ data, backgroundColor: accent + 'AA', borderColor: accent, borderWidth: 1, barPercentage: 0.95, categoryPercentage: 1 }]
      },
      options: {
        ...this.baseOptions(),
        scales: {
          x: { ...this.baseOptions().scales.x, title: { display: true, text: 'RR (ms)', color: this.textDim(), font: { size: 10 } },
            ticks: { maxTicksLimit: 10, ...this.baseOptions().scales.x.ticks } },
          y: { ...this.baseOptions().scales.y, title: { display: true, text: 'Frecuencia', color: this.textDim(), font: { size: 10 } } }
        }
      }
    });
  },

  renderDiffHist(rrMs) {
    this.destroyChart('diffHistChart');
    const ctx = this.getCtx('diffHistChart');
    if (!ctx) return;
    const diffs = [];
    for (let i = 1; i < rrMs.length; i++) diffs.push(rrMs[i] - rrMs[i - 1]);
    const binW = 10;
    const min = Math.floor(Math.min(...diffs) / binW) * binW;
    const max = Math.ceil(Math.max(...diffs) / binW) * binW;
    const bins = {};
    for (let b = min; b <= max; b += binW) bins[b] = 0;
    for (const d of diffs) { const b = Math.floor(d / binW) * binW; if (bins[b] !== undefined) bins[b]++; }
    const labels = Object.keys(bins).map(Number);
    const sec = this.secondary();
    state.charts.diffHistChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels.map(l => l + ''),
        datasets: [{ data: Object.values(bins), backgroundColor: sec + 'AA', borderColor: sec, borderWidth: 1, barPercentage: 0.95, categoryPercentage: 1 }]
      },
      options: {
        ...this.baseOptions(),
        scales: {
          x: { ...this.baseOptions().scales.x, title: { display: true, text: 'ΔRR (ms)', color: this.textDim(), font: { size: 10 } },
            ticks: { maxTicksLimit: 10, ...this.baseOptions().scales.x.ticks } },
          y: { ...this.baseOptions().scales.y, title: { display: true, text: 'Frecuencia', color: this.textDim(), font: { size: 10 } } }
        }
      }
    });
  },

  renderCleanChart(rrMs, removed = new Set()) {
    this.destroyChart('cleanChartInst');
    const canvas = document.getElementById('cleanChart');
    if (!canvas) return;
    const parent = canvas.parentElement;
    canvas.width = parent.offsetWidth || 800;
    canvas.height = parent.offsetHeight || 340;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pad = { t: 20, r: 20, b: 36, l: 50 };
    const plotW = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
    const n = rrMs.length;
    const minV = Math.min(...rrMs) * 0.97, maxV = Math.max(...rrMs) * 1.03;
    const toX = i => pad.l + (i / (n - 1)) * plotW;
    const toY = v => pad.t + (1 - (v - minV) / (maxV - minV)) * plotH;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--card').trim();
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = this.border(); ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = pad.t + (i / 5) * plotH;
      const v = maxV - (i / 5) * (maxV - minV);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = this.textDim(); ctx.font = '9px JetBrains Mono';
      ctx.fillText(Math.round(v), 2, y + 3);
    }

    // Lines
    ctx.strokeStyle = this.accent(); ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (removed.has(i)) continue;
      if (i === 0 || removed.has(i - 1)) ctx.moveTo(toX(i), toY(rrMs[i]));
      else ctx.lineTo(toX(i), toY(rrMs[i]));
    }
    ctx.stroke();

    // Removed points
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--error').trim();
    for (const idx of removed) {
      ctx.beginPath(); ctx.arc(toX(idx), toY(rrMs[idx]), 4, 0, 2 * Math.PI); ctx.fill();
    }

    // Normal points
    ctx.fillStyle = this.accent() + 'AA';
    for (let i = 0; i < Math.min(n, 500); i++) {
      if (!removed.has(i)) {
        ctx.beginPath(); ctx.arc(toX(i), toY(rrMs[i]), 1.5, 0, 2 * Math.PI); ctx.fill();
      }
    }

    // X axis label
    ctx.fillStyle = this.textDim(); ctx.font = '10px JetBrains Mono';
    ctx.fillText('Latido #', W / 2, H - 4);

    // Store params for click detection
    canvas._chartParams = { pad, plotW, plotH, n, minV, maxV, rrMs };
  },
  
  // ── Interactive tachogram with draggable analysis windows ──
  renderInteractiveTachogram(rrMs, windows = [], draft = null) {
    const canvas = document.getElementById('tachogramInteractive');
    if (!canvas) return;
    const par = canvas.parentElement;
    const W = canvas.width  = par.offsetWidth  || 800;
    const H = canvas.height = par.offsetHeight || 160;
    const ctx = canvas.getContext('2d');
    const pad = { t: 12, r: 12, b: 28, l: 46 };
    const pW  = W - pad.l - pad.r, pH = H - pad.t - pad.b;
    const n   = rrMs.length;
    if (n < 2) return;

    const minV = Math.min(...rrMs) * 0.97, maxV = Math.max(...rrMs) * 1.03;
    const toX  = i => pad.l + (i / (n - 1)) * pW;
    const toY  = v => pad.t + (1 - (v - minV) / (maxV - minV)) * pH;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = getComputedStyle(document.documentElement)
                    .getPropertyValue('--card').trim() || '#10151F';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = this.border(); ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + i / 4 * pH;
      const v = maxV - i / 4 * (maxV - minV);
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
      ctx.fillStyle = this.textDim(); ctx.font = '9px JetBrains Mono';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(v), pad.l - 2, y + 3);
    }
    ctx.textAlign = 'left';

    // Existing windows
    for (const win of windows) {
      const x1 = toX(win.startBeat), x2 = toX(win.endBeat);
      const isActive = win.id === state.activeWindowId;
      ctx.fillStyle = win.color + (isActive ? '30' : '18');
      ctx.fillRect(x1, pad.t, x2 - x1, pH);
      ctx.strokeStyle = win.color + (isActive ? 'EE' : '70');
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.strokeRect(x1, pad.t, x2 - x1, pH);
      // Label
      ctx.font = `${isActive ? 'bold ' : ''}10px Outfit`;
      ctx.fillStyle = win.color;
      ctx.fillText(win.label, Math.min(Math.max(x1 + 3, pad.l), W - pad.r - 60), pad.t + 11);
    }

    // Draft window (being drawn)
    if (draft) {
      const x1 = toX(Math.min(draft.startBeat, draft.endBeat));
      const x2 = toX(Math.max(draft.startBeat, draft.endBeat));
      ctx.fillStyle = 'rgba(0,194,212,0.12)';
      ctx.fillRect(x1, pad.t, x2 - x1, pH);
      ctx.strokeStyle = 'rgba(0,194,212,0.9)'; ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(x1, pad.t, x2 - x1, pH);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(0,194,212,0.9)'; ctx.font = 'bold 10px JetBrains Mono';
      ctx.fillText(`${Math.abs(draft.endBeat - draft.startBeat)}L`, x1 + 4, pad.t + 11);
    }

    // RR signal (decimate if large)
    const step = Math.max(1, Math.ceil(n / 2000));
    ctx.strokeStyle = this.accent(); ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < n; i += step) {
      const x = toX(i), y = toY(rrMs[i]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // X-axis tick labels
    ctx.fillStyle = this.textDim(); ctx.font = '9px JetBrains Mono'; ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
      const b = Math.round(i / 5 * (n - 1));
      ctx.fillText(b, toX(b), H - 4);
    }
    ctx.fillText('latido #', W / 2, H - 4);
    ctx.textAlign = 'left';

    // Store params for mouse events
    canvas._p = { pad, pW, pH, n, rrMs, toX,
      toBeat: x => Math.round(Math.max(0, Math.min(n - 1, (x - pad.l) / pW * (n - 1)))) };
  },

  // ── Sliding-window time series ──
  renderSlidingLine(canvasId, data, yKey, yLabel, color) {
    this.destroyChart(canvasId);
    const ctx = this.getCtx(canvasId);
    if (!ctx || !data.length) return;
    state.charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.map(d => d.t_center.toFixed(1)),
        datasets: [{ data: data.map(d => d[yKey] ?? null),
          borderColor: color || this.accent(), borderWidth: 1.5,
          pointRadius: 0, fill: false, tension: 0.25, spanGaps: true }]
      },
      options: {
        ...this.baseOptions(), animation: false,
        scales: {
          x: { ...this.baseOptions().scales.x,
            title: { display: true, text: 'Tiempo (min)', color: this.textDim(), font: { size: 9 } },
            ticks: { maxTicksLimit: 7, ...this.baseOptions().scales.x.ticks }},
          y: { ...this.baseOptions().scales.y,
            title: { display: true, text: yLabel, color: this.textDim(), font: { size: 9 } }}
        }
      }
    });
  },

  // ── PRSA curves ──
  renderPRSACurves(prsa) {
    ['prsaDecChart','prsaAccChart'].forEach(id => this.destroyChart(id));
    if (!prsa) return;
    const L = prsa.L, labels = Array.from({ length: 2 * L }, (_, i) => i - L);
    [['prsaDecChart', prsa.prsa_d, this.secondary(), 'DC (desaceleración)'],
     ['prsaAccChart', prsa.prsa_a, this.accent(),    'AC (aceleración)']
    ].forEach(([id, data, color, title]) => {
      const ctx = this.getCtx(id); if (!ctx) return;
      state.charts[id] = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [{ data, borderColor: color, borderWidth: 1.5, pointRadius: 0, fill: false }] },
        options: {
          ...this.baseOptions(), animation: false,
          plugins: { ...this.baseOptions().plugins,
            title: { display: true, text: title, color: this.textDim(), font: { size: 11 } }},
          scales: {
            x: { ...this.baseOptions().scales.x,
              title: { display: true, text: 'k (latidos desde ancla)', color: this.textDim(), font: { size: 9 } },
              ticks: { maxTicksLimit: 7, ...this.baseOptions().scales.x.ticks }},
            y: { ...this.baseOptions().scales.y,
              title: { display: true, text: 'RR (ms)', color: this.textDim(), font: { size: 9 } }}
          }
        }
      });
    });
  },
};

// ===== DATA CLEANING =====
const Clean = {
  init() {
    const rec = state.currentRecording;
    if (!rec) { UI.notify('Selecciona una grabación primero', 'error'); App.switchView('library'); return; }
    if (!rec.cleanRR) rec.cleanRR = [...rec.rrMs];
    state.cleanHistory = [];
    state.removedBeats = new Set(rec.removedBeats || []);
    this.updateStats();
    this.redraw();
  },

  updateStats() {
    const rec = state.currentRecording;
    if (!rec || !rec.cleanRR) return;
    const total = rec.cleanRR.length;
    const removed = state.removedBeats ? state.removedBeats.size : 0;
    const valid = total - removed;
    document.getElementById('cleanTotal').textContent = total;
    document.getElementById('cleanRemoved').textContent = removed;
    document.getElementById('cleanPct').textContent = ((valid / total) * 100).toFixed(1) + '%';
  },

  redraw() {
    const rec = state.currentRecording;
    if (!rec || !rec.cleanRR) return;
    Charts.renderCleanChart(rec.cleanRR, state.removedBeats || new Set());
  },

  setMode(mode) {
    state.cleanMode = mode;
    ['view', 'select', 'range'].forEach(m => {
      const btn = document.getElementById(`cleanMode${m.charAt(0).toUpperCase() + m.slice(1)}`);
      if (btn) { btn.style.borderColor = ''; btn.style.color = ''; }
    });
    const active = document.getElementById(`cleanMode${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
    if (active) { active.style.borderColor = 'var(--accent)'; active.style.color = 'var(--accent)'; }
    const helps = { view: 'Navega el tachograma', select: 'Haz clic en puntos para eliminarlos', range: 'Dibuja un rectángulo para seleccionar un rango' };
    document.getElementById('cleanModeHelp').textContent = helps[mode] || '';
  },

  applyThreshold() {
    const rec = state.currentRecording;
    if (!rec?.cleanRR) return;
    const min = parseFloat(document.getElementById('threshMin').value);
    const max = parseFloat(document.getElementById('threshMax').value);
    state.cleanHistory.push(new Set(state.removedBeats));
    let cnt = 0;
    rec.cleanRR.forEach((v, i) => { if (v < min || v > max) { state.removedBeats.add(i); cnt++; } });
    this.updateStats(); this.redraw();
    UI.notify(`${cnt} latidos marcados como removidos`, 'success');
  },

  applySDFilter() {
    const rec = state.currentRecording;
    if (!rec?.cleanRR) return;
    const sds = parseFloat(document.getElementById('sdFilter').value);
    state.cleanHistory.push(new Set(state.removedBeats));
    const active = rec.cleanRR.filter((_, i) => !state.removedBeats.has(i));
    const mean = MathUtils.mean(active), sd = MathUtils.stdDev(active);
    const lo = mean - sds * sd, hi = mean + sds * sd;
    let cnt = 0;
    rec.cleanRR.forEach((v, i) => { if (!state.removedBeats.has(i) && (v < lo || v > hi)) { state.removedBeats.add(i); cnt++; } });
    this.updateStats(); this.redraw();
    UI.notify(`${cnt} latidos fuera de ${sds}σ marcados`, 'success');
  },

  applyDiffFilter() {
    const rec = state.currentRecording;
    if (!rec?.cleanRR) return;
    const thresh = parseFloat(document.getElementById('diffThresh').value);
    state.cleanHistory.push(new Set(state.removedBeats));
    let cnt = 0;
    for (let i = 1; i < rec.cleanRR.length; i++) {
      if (Math.abs(rec.cleanRR[i] - rec.cleanRR[i-1]) > thresh) { state.removedBeats.add(i); cnt++; }
    }
    this.updateStats(); this.redraw();
    UI.notify(`${cnt} latidos con ΔRR > ${thresh}ms marcados`, 'success');
  },

  interpolateRemoved() {
    const rec = state.currentRecording;
    if (!rec?.cleanRR || !state.removedBeats.size) return;
    const method = document.getElementById('interpMethod').value;
    const rr = [...rec.cleanRR];
    for (const idx of [...state.removedBeats].sort((a, b) => a - b)) {
      const prev = [...Array(idx).keys()].reverse().find(i => !state.removedBeats.has(i));
      const next = [...Array.from({length: rr.length - idx - 1}, (_, i) => idx + i + 1)].find(i => !state.removedBeats.has(i));
      if (prev != null && next != null) {
        if (method === 'linear') rr[idx] = rr[prev] + (rr[next] - rr[prev]) * ((idx - prev) / (next - prev));
        else if (method === 'mean') rr[idx] = (rr[prev] + rr[next]) / 2;
        else rr[idx] = (rr[prev] + rr[next]) / 2; // fallback
      }
    }
    state.cleanHistory.push(new Set(state.removedBeats));
    rec.cleanRR = rr;
    state.removedBeats.clear();
    this.updateStats(); this.redraw();
    UI.notify('Interpolación completada', 'success');
  },

  undoLast() {
    if (!state.cleanHistory.length) { UI.notify('Sin historial para deshacer', 'error'); return; }
    state.removedBeats = state.cleanHistory.pop();
    this.updateStats(); this.redraw();
  },

  resetAll() {
    if (!confirm('¿Resetear todos los cambios de limpieza?')) return;
    state.removedBeats = new Set();
    const rec = state.currentRecording;
    if (rec) rec.cleanRR = [...rec.rrMs];
    state.cleanHistory = [];
    this.updateStats(); this.redraw();
    UI.notify('Datos reseteados', 'success');
  },

  async saveClean() {
    const rec = state.currentRecording;
    if (!rec) return;
    rec.removedBeats = [...state.removedBeats];
    rec.cleanRR = rec.cleanRR.filter((_, i) => !state.removedBeats.has(i));
    state.removedBeats = new Set();
    const analysis = HRV.fullAnalysis(rec.cleanRR);
    if (analysis) Object.assign(rec, analysis);
    rec.modified = Date.now();
    await DB.put('recordings', rec);
    await App.loadRecordings();
    UI.notify('Datos limpios guardados', 'success');
    App.switchView('analyze');
  },

  handleCleanClick(e) {
    if (state.cleanMode !== 'select') return;
    const canvas = document.getElementById('cleanChart');
    if (!canvas?._chartParams) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const { pad, plotW, plotH, n, minV, maxV, rrMs } = canvas._chartParams;
    if (mx < pad.l || mx > canvas.width - pad.r) return;
    const relX = (mx - pad.l) / plotW;
    const beatIdx = Math.round(relX * (n - 1));
    if (beatIdx < 0 || beatIdx >= n) return;
    // Find nearest visible beat
    let nearest = beatIdx;
    for (let d = 0; d <= 10; d++) {
      for (const idx of [beatIdx - d, beatIdx + d]) {
        if (idx >= 0 && idx < n && !state.removedBeats.has(idx)) { nearest = idx; break; }
      }
      if (nearest !== beatIdx || !state.removedBeats.has(beatIdx)) break;
    }
    if (state.removedBeats.has(nearest)) state.removedBeats.delete(nearest);
    else state.removedBeats.add(nearest);
    this.updateStats(); this.redraw();
  }
};

// ===== ANALYSIS WINDOW MANAGER =====
const WindowMgr = {
  COLORS: ['#00C2D4','#FFA020','#00C896','#6488FF','#FF6B6B','#C084FC','#34D399','#FBBF24'],

  _nextColor() {
    const used = new Set((state.currentRecording?.windows || []).map(w => w.color));
    return this.COLORS.find(c => !used.has(c)) || this.COLORS[state.windows.length % this.COLORS.length];
  },

  getAll()    { return state.currentRecording?.windows || []; },
  getActive() { return this.getAll().find(w => w.id === state.activeWindowId) || null; },

  create(startBeat, endBeat) {
    if (!state.currentRecording) return null;
    if (!state.currentRecording.windows) state.currentRecording.windows = [];
    const sb = Math.min(startBeat, endBeat);
    const eb = Math.max(startBeat, endBeat);
    if (eb - sb < 9) return null;           // need ≥10 beats

    const win = {
      id:         Date.now() + '',
      label:      `Ventana ${state.currentRecording.windows.length + 1}`,
      color:      this._nextColor(),
      startBeat:  sb,
      endBeat:    eb,
      analysis:   null
    };
    win.analysis = this._analyze(win);
    state.currentRecording.windows.push(win);
    state.activeWindowId = win.id;
    return win;
  },

  rename(id, label) {
    const win = this.getAll().find(w => w.id === id);
    if (win && label.trim()) { win.label = label.trim(); this._refresh(); }
  },

  resize(id, startBeat, endBeat) {
    const win = this.getAll().find(w => w.id === id);
    if (!win) return;
    win.startBeat = Math.min(startBeat, endBeat);
    win.endBeat   = Math.max(startBeat, endBeat);
    win.analysis  = this._analyze(win);
    this._refresh();
  },

  delete(id) {
    if (!state.currentRecording?.windows) return;
    state.currentRecording.windows = state.currentRecording.windows.filter(w => w.id !== id);
    if (state.activeWindowId === id) {
      state.activeWindowId = state.currentRecording.windows[0]?.id || null;
    }
    this._refresh();
  },

  clearAll() {
    if (!confirm('¿Eliminar todas las ventanas de análisis?')) return;
    if (state.currentRecording) state.currentRecording.windows = [];
    state.activeWindowId = null;
    this._refresh();
  },

  setActive(id) {
    state.activeWindowId = id;
    this._refresh();
    const win = this.getActive();
    if (win?.analysis) UI.renderWindowMetrics(win);
    else UI.renderAnalysisMetrics(state.currentRecording);
    // Redraw tachogram to highlight selected window
    const rr = state.currentRecording?.cleanRR || state.currentRecording?.rrMs;
    if (rr) Charts.renderInteractiveTachogram(rr, this.getAll(), null);
  },

  toggleAddMode() {
    state.windowMode = !state.windowMode;
    state.windowDraft = null;
    const canvas = document.getElementById('tachogramInteractive');
    if (canvas) {
      canvas.className = state.windowMode ? 'mode-add' : '';
    }
    UI.renderWindowsPanel();
  },

  async save() {
    if (state.currentRecording) await DB.put('recordings', state.currentRecording);
  },

  _analyze(win) {
    const rr = state.currentRecording?.cleanRR || state.currentRecording?.rrMs;
    if (!rr) return null;
    const slice = rr.slice(win.startBeat, win.endBeat + 1);
    if (slice.length < 10) return null;
    const td = HRV.timeDomain(slice);
    const fd = HRV.frequencyDomain(slice);
    const nl = HRV.nonLinear(slice);
    const comp = HRV.composite(td, fd, nl);
    return { td, fd, nl, comp, beatCount: slice.length, durationMin: MathUtils.sum(slice) / 60000 };
  },

  _refresh() {
    UI.renderWindowsPanel();
    const rr = state.currentRecording?.cleanRR || state.currentRecording?.rrMs;
    if (rr) Charts.renderInteractiveTachogram(rr, this.getAll(), null);
  }
};

// ===== NON-STATIONARY / TIME-VARYING HRV =====
const NonStationary = {
  /**
   * Sliding-window time-domain metrics.
   * Returns [{t_center (min), sdnn, rmssd, meanHR, pnn50, start, end}]
   */
  sliding(rrMs, winBeats, stepBeats) {
    const n = rrMs.length;
    winBeats  = Math.min(winBeats  || state.settings.slidingWinBeats,  n);
    stepBeats = Math.min(stepBeats || state.settings.slidingStepBeats, winBeats);
    if (winBeats < 30) return [];

    const cumT = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) cumT[i + 1] = cumT[i] + rrMs[i];

    const results = [];
    for (let s = 0; s + winBeats <= n; s += stepBeats) {
      const seg = rrMs.slice(s, s + winBeats);
      const td  = HRV.timeDomain(seg);
      if (!td) continue;
      const t_center = (cumT[s] + cumT[s + winBeats]) / 2 / 60000;
      results.push({ t_center, start: s, end: s + winBeats,
        sdnn: td.sdnn, rmssd: td.rmssd, meanHR: td.meanHR,
        pnn50: td.pnn50, lf: null, hf: null, lfhf: null });
    }
    return results;
  },

  /**
   * Sliding-window frequency metrics (slower — uses LS on each window).
   * Only run if fewer than 500 windows.
   */
  slidingFreq(rrMs, winBeats, stepBeats) {
    const sliding = this.sliding(rrMs, winBeats, stepBeats);
    if (sliding.length > 400) return sliding; // skip if too many steps
    for (const w of sliding) {
      const seg = rrMs.slice(w.start, w.end);
      const fd  = HRV.frequencyDomain(seg);
      if (fd) { w.lf = fd.lf; w.hf = fd.hf; w.lfhf = fd.lfhf; }
    }
    return sliding;
  },

  /**
   * Phase-Rectified Signal Averaging (PRSA).
   * Deceleration Capacity (DC) and Acceleration Capacity (AC).
   * Ref: Bauer et al. (2006).
   */
  prsa(rrMs, L = 30) {
    const n = rrMs.length;
    if (n < L * 4) return null;

    const accum = (condition) => {
      let cnt = 0;
      const buf = new Float64Array(2 * L);
      for (let a = L; a < n - L; a++) {
        if (!condition(a)) continue;
        for (let k = -L; k < L; k++) buf[k + L] += rrMs[a + k];
        cnt++;
      }
      return cnt > 4 ? Array.from(buf, v => v / cnt) : null;
    };

    const prsa_d = accum(a => rrMs[a] >= rrMs[a - 1]);  // deceleration anchors
    const prsa_a = accum(a => rrMs[a] <  rrMs[a - 1]);  // acceleration anchors
    if (!prsa_d || !prsa_a) return null;

    // DC = capacity of heart rate deceleration (should be positive)
    const DC = (prsa_d[L] + prsa_d[L + 1] - prsa_d[L - 1] - prsa_d[L - 2]) / 4;
    const AC = (prsa_a[L] + prsa_a[L + 1] - prsa_a[L - 1] - prsa_a[L - 2]) / 4;
    return { DC: Math.round(DC * 10) / 10, AC: Math.round(AC * 10) / 10, prsa_d, prsa_a, L };
  },

  /**
   * Auto-segment the recording into N equal parts.
   * Useful for rest-exercise-rest protocols when segment boundaries are unknown.
   */
  autoSegment(rrMs, nSeg = 3) {
    const n  = rrMs.length;
    const sz = Math.floor(n / nSeg);
    return Array.from({ length: nSeg }, (_, i) => {
      const start = i * sz, end = (i === nSeg - 1) ? n : start + sz;
      const seg   = rrMs.slice(start, end);
      const td    = HRV.timeDomain(seg);
      const fd    = HRV.frequencyDomain(seg);
      const nl    = HRV.nonLinear(seg);
      return { i, start, end, label: `Segmento ${i + 1}`,
               durationMin: MathUtils.sum(seg) / 60000, td, fd, nl };
    });
  },

  /**
   * Running RMSSD (beat-by-beat, window of winBeats beats).
   * Very fast — useful for real-time trend lines.
   */
  runningRMSSD(rrMs, winBeats = 100) {
    const result = [];
    for (let i = winBeats; i <= rrMs.length; i++) {
      const seg   = rrMs.slice(i - winBeats, i);
      const diffs = seg.slice(1).map((v, j) => (v - seg[j]) ** 2);
      result.push({ idx: i, rmssd: Math.sqrt(MathUtils.mean(diffs)) });
    }
    return result;
  }
};

// ===== IMPORT/EXPORT =====
const IO = {
  dragover(e) { e.preventDefault(); document.getElementById('importDrop').classList.add('dragover'); },
  drop(e) {
    e.preventDefault(); document.getElementById('importDrop').classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) this.handleFile(file);
  },

  async handleFile(file) {
    if (!file) return;
    const text = await file.text();
    const detected = Parse.detect(text);
    if (!detected) { UI.notify('Formato no reconocido', 'error'); return; }
    const values = Parse.parse(text, detected);
    if (!values || values.length < 5) { UI.notify('No se encontraron valores RR válidos', 'error'); return; }

    state.importBuffer = { text, detected, values, filename: file.name };

    const median = MathUtils.median(values);
    const unit = median < 5 ? 's' : 'ms';
    const unitLabel = unit === 's' ? 'segundos' : 'milisegundos';

    document.getElementById('importDetected').style.display = 'block';
    document.getElementById('importDetected').innerHTML = `✓ Detectado: <strong>${values.length} valores RR</strong> en formato ${detected.format} · Unidad estimada: <strong>${unitLabel}</strong>`;
    document.getElementById('importPreview').style.display = 'block';
    document.getElementById('importPreviewData').textContent = values.slice(0, 10).map(v => v.toFixed(unit === 's' ? 4 : 1)).join('  ');
    document.getElementById('importSettings').style.display = 'grid';
    document.getElementById('importName').value = file.name.replace(/\.(csv|txt)$/i, '');
    document.getElementById('importUnit').value = 'auto';
    document.getElementById('importConfirmBtn').style.display = 'flex';

    // Populate folders
    const sel = document.getElementById('importFolder');
    sel.innerHTML = '<option value="">Sin carpeta</option>';
    for (const f of state.folders) sel.innerHTML += `<option value="${f.id}">${f.name}</option>`;
  },

  async confirmImport() {
    const buf = state.importBuffer;
    if (!buf) return;
    const name = document.getElementById('importName').value || 'Grabación sin nombre';
    const folderId = document.getElementById('importFolder').value || null;
    const tagsRaw = document.getElementById('importTags').value;
    const tagNames = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

    // Normalize
    const rrMs = HRV.normalize(buf.values);
    if (!rrMs || rrMs.length < 5) { UI.notify('Datos insuficientes para análisis', 'error'); return; }

    // Compute analysis
    const analysis = HRV.fullAnalysis(rrMs);

    // Process tags
    const tagIds = [];
    for (const tn of tagNames) {
      let tag = state.tags.find(t => t.name.toLowerCase() === tn.toLowerCase());
      if (!tag) { tag = { id: Date.now() + Math.random(), name: tn, color: '#00C2D4' }; state.tags.push(tag); await DB.put('tags', tag); }
      tagIds.push(tag.id);
    }

    const recording = {
      id: Date.now() + '',
      name, folderId, tagIds, created: Date.now(), modified: Date.now(),
      rawData: buf.values, rrMs, cleanRR: [...rrMs],
      metadata: {}, removedBeats: [],
      ...analysis
    };

    await DB.put('recordings', recording);
    await App.loadRecordings();
    UI.closeModal('importModal');
    UI.notify(`"${name}" importado · ${rrMs.length} latidos`, 'success');
    state.currentRecording = recording;
    App.switchView('analyze');
    UI.renderAnalysis(recording);
    state.importBuffer = null;
  },

  async exportCSV(recording) {
    const rr = recording.cleanRR || recording.rrMs;
    let csv = 'beat,rr_ms,hr_bpm,cumulative_s\n';
    let t = 0;
    rr.forEach((v, i) => { t += v / 1000; csv += `${i+1},${v.toFixed(2)},${(60000/v).toFixed(2)},${t.toFixed(3)}\n`; });
    this._download(csv, `${recording.name}_RR.csv`, 'text/csv');
  },

  async exportMetricsCSV(recording) {
    const { td, fd, nl, comp } = recording;
    const rows = [];
    if (td) {
      rows.push(['DOMINIO TIEMPO','','']);
      const tdRows = [['Mean RR','ms',td.mean],['SDNN','ms',td.sdnn],['RMSSD','ms',td.rmssd],['NN50','',td.nn50],['pNN50','%',td.pnn50],['Mean HR','bpm',td.meanHR],['SD HR','bpm',td.sdHR],['Min HR','bpm',td.minHR],['Max HR','bpm',td.maxHR],['CV','%',td.cv],['Triangular Index','',td.triIndex]];
      rows.push(...tdRows);
    }
    if (fd) {
      rows.push(['DOMINIO FRECUENCIA','','']);
      rows.push(['VLF','ms²',fd.vlf],['LF','ms²',fd.lf],['HF','ms²',fd.hf],['Total Power','ms²',fd.total],['LF norm','nu',fd.lfNorm],['HF norm','nu',fd.hfNorm],['LF/HF ratio','',fd.lfhf]);
    }
    if (nl) {
      rows.push(['NO LINEAL','','']);
      rows.push(['SD1','ms',nl.sd1],['SD2','ms',nl.sd2],['SD1/SD2','',nl.sd1sd2],['SampEn','',nl.sampen],['ApEn','',nl.apen],['DFA α1','',nl.alpha1],['DFA α2','',nl.alpha2]);
    }
    let csv = 'Métrica,Unidad,Valor\n';
    rows.forEach(r => { csv += r.map(v => `"${v ?? ''}"`).join(',') + '\n'; });
    this._download(csv, `${recording.name}_metrics.csv`, 'text/csv');
  },

  exportJSON(recording) {
    const data = { ...recording, rawData: undefined };
    delete data.rawData;
    this._download(JSON.stringify(data, null, 2), `${recording.name}.json`, 'application/json');
  },

  async exportBackup() {
    const recordings = await DB.getAll('recordings');
    const folders = await DB.getAll('folders');
    const tags = await DB.getAll('tags');
    const settings = await DB.getAll('settings');
    const backup = { version: 1, date: new Date().toISOString(), recordings, folders, tags, settings };
    this._download(JSON.stringify(backup, null, 2), `HRVStudio_backup_${new Date().toISOString().slice(0,10)}.json`, 'application/json');
    UI.notify('Backup exportado correctamente', 'success');
  },

  async importBackup() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.version || !data.recordings) { UI.notify('Archivo de backup inválido', 'error'); return; }
        if (!confirm(`¿Restaurar backup de ${data.date}? Esto reemplazará todos los datos actuales.`)) return;
        await DB.clearStore('recordings');
        await DB.clearStore('folders');
        await DB.clearStore('tags');
        for (const r of data.recordings) await DB.put('recordings', r);
        for (const f of data.folders || []) await DB.put('folders', f);
        for (const t of data.tags || []) await DB.put('tags', t);
        await App.loadAll();
        UI.notify(`Backup restaurado: ${data.recordings.length} grabaciones`, 'success');
      } catch(err) { UI.notify('Error al restaurar backup: ' + err.message, 'error'); }
    };
    input.click();
  },

  async exportBatch() {
    const format = document.getElementById('batchFormat').value;
    const recs = state.recordings;
    if (!recs.length) { UI.notify('No hay grabaciones para exportar', 'error'); return; }

    if (format === 'csv') {
      const headers = ['name','patient','date','beats','meanRR','sdnn','rmssd','pnn50','meanHR','sdHR','vlf','lf','hf','lfhf','sd1','sd2','sampen','alpha1'];
      let csv = headers.join(',') + '\n';
      for (const r of recs) {
        const meta = r.metadata || {};
        const td = r.td || {}, fd = r.fd || {}, nl = r.nl || {};
        csv += [r.name, meta.name||'', new Date(r.created).toLocaleDateString(),
          r.rrMs?.length||0, td.mean, td.sdnn, td.rmssd, td.pnn50, td.meanHR, td.sdHR,
          fd.vlf, fd.lf, fd.hf, fd.lfhf, nl.sd1, nl.sd2, nl.sampen, nl.alpha1
        ].map(v => `"${v ?? ''}"`).join(',') + '\n';
      }
      this._download(csv, 'HRVStudio_batch.csv', 'text/csv');
    } else if (format === 'json') {
      const data = recs.map(r => ({ ...r, rawData: undefined }));
      this._download(JSON.stringify(data, null, 2), 'HRVStudio_batch.json', 'application/json');
    }
    UI.notify(`Lote exportado (${recs.length} grabaciones)`, 'success');
  },

  exportReportHTML() {
    const body = document.getElementById('reportBody');
    if (!body) return;
    const rec = state.currentRecording;
    if (!rec) return;
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte HRV - ${rec.name}</title>
    <style>body{font-family:sans-serif;max-width:900px;margin:40px auto;color:#111}h1{color:#007A8F}h2{color:#005E70;border-bottom:2px solid #007A8F;padding-bottom:4px}table{width:100%;border-collapse:collapse;margin-bottom:20px}th,td{padding:7px 10px;border:1px solid #ddd;text-align:left}th{background:#f0f4f8;font-size:12px}td.val{font-family:monospace;color:#007A8F;font-weight:600}.section{margin-bottom:24px}</style>
    </head><body>${body.innerHTML}</body></html>`;
    this._download(html, `${rec.name}_reporte.html`, 'text/html');
    UI.notify('Reporte HTML exportado', 'success');
  },

  _download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
};

// ===== UI MODULE =====
const UI = {
  notify(msg, type = 'success') {
    const el = document.getElementById('notification');
    const icon = document.getElementById('notifIcon');
    const msgEl = document.getElementById('notifMsg');
    el.className = `notification ${type}`;
    icon.textContent = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    msgEl.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timeout);
    el._timeout = setTimeout(() => el.classList.remove('show'), 3000);
  },

  openModal(id) { document.getElementById(id)?.classList.add('open'); },
  closeModal(id) { document.getElementById(id)?.classList.remove('open'); },

  openImport() {
    document.getElementById('importDetected').style.display = 'none';
    document.getElementById('importPreview').style.display = 'none';
    document.getElementById('importSettings').style.display = 'none';
    document.getElementById('importConfirmBtn').style.display = 'none';
    document.getElementById('fileInput').value = '';
    this.openModal('importModal');
  },

  openMetadataModal() {
    const rec = state.currentRecording;
    if (!rec) { this.notify('Selecciona una grabación primero', 'error'); return; }
    const m = rec.metadata || {};
    ['Name','DOB','Sex','Age','Weight','Height','Id','Condition','Duration','Meds','Notes','Institution'].forEach(k => {
      const el = document.getElementById(`meta${k}`);
      if (el) el.value = m[k.toLowerCase()] || '';
    });
    const dt = document.getElementById('metaDatetime');
    if (dt && m.datetime) dt.value = m.datetime;
    this.openModal('metadataModal');
  },

  async saveMetadata() {
    const rec = state.currentRecording;
    if (!rec) return;
    rec.metadata = {};
    ['Name','DOB','Sex','Age','Weight','Height','Id','Condition','Duration','Meds','Notes','Institution'].forEach(k => {
      const el = document.getElementById(`meta${k}`);
      if (el?.value) rec.metadata[k.toLowerCase()] = el.value;
    });
    const dt = document.getElementById('metaDatetime');
    if (dt?.value) rec.metadata.datetime = dt.value;
    rec.modified = Date.now();
    await DB.put('recordings', rec);
    await App.loadRecordings();
    this.renderAnalysisHeader(rec);
    this.closeModal('metadataModal');
    this.notify('Metadatos guardados', 'success');
  },

  openFolderManager() {
    this.renderFolderList();
    this.openModal('folderModal');
  },

  openTagManager() {
    this.renderTagList();
    this.openModal('tagModal');
  },

  renderFolderList() {
    const el = document.getElementById('folderList');
    if (!el) return;
    el.innerHTML = state.folders.map(f => `
      <div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--border)">
        <span>📁</span><span style="flex:1;font-size:13px">${f.name}</span>
        <button class="btn btn-danger btn-sm" onclick="App.deleteFolder('${f.id}')">✕</button>
      </div>`).join('') || '<div style="color:var(--text-muted);font-size:12px">Sin carpetas</div>';
  },

  renderTagList() {
    const el = document.getElementById('tagList');
    if (!el) return;
    el.innerHTML = state.tags.map(t => `
      <div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid var(--border)">
        <span style="width:12px;height:12px;border-radius:50%;background:${t.color};flex-shrink:0"></span>
        <span style="flex:1;font-size:13px">${t.name}</span>
        <button class="btn btn-danger btn-sm" onclick="App.deleteTag('${t.id}')">✕</button>
      </div>`).join('') || '<div style="color:var(--text-muted);font-size:12px">Sin etiquetas</div>';
  },

  renderFolderTree() {
    const el = document.getElementById('folderTree');
    if (!el) return;
    el.innerHTML = `
      <div class="folder-item ${!state.filters.folderId ? 'active' : ''}" onclick="App.filterByFolder(null)">
        <span class="fi-icon">🏠</span><span>Todas</span>
        <span class="fi-count">${state.recordings.length}</span>
      </div>` +
      state.folders.map(f => {
        const cnt = state.recordings.filter(r => r.folderId === f.id).length;
        return `<div class="folder-item ${state.filters.folderId === f.id ? 'active' : ''}" onclick="App.filterByFolder('${f.id}')">
          <span class="fi-icon">📁</span><span>${f.name}</span>
          <span class="fi-count">${cnt}</span>
        </div>`;
      }).join('');
  },

  renderSidebarTags() {
    const el = document.getElementById('sidebarTags');
    if (!el) return;
    el.innerHTML = state.tags.map(t => `
      <span class="tag-chip ${state.filters.tags.includes(t.id) ? 'active' : ''}"
        onclick="App.toggleTagFilter('${t.id}')"
        style="${state.filters.tags.includes(t.id) ? `border-color:${t.color};color:${t.color};background:${t.color}22` : ''}">
        ${t.name}
      </span>`).join('');
  },

  renderLibrary() {
    let recs = [...state.recordings];

    // Filter
    if (state.filters.search) {
      const q = state.filters.search.toLowerCase();
      recs = recs.filter(r => r.name.toLowerCase().includes(q) ||
        (r.metadata?.name || '').toLowerCase().includes(q));
    }
    if (state.filters.folderId) recs = recs.filter(r => r.folderId === state.filters.folderId);
    if (state.filters.tags.length) recs = recs.filter(r => state.filters.tags.some(t => (r.tagIds || []).includes(t)));

    // Sort
    const sort = state.filters.sortBy;
    if (sort === 'date-desc') recs.sort((a, b) => b.created - a.created);
    else if (sort === 'date-asc') recs.sort((a, b) => a.created - b.created);
    else if (sort === 'name-asc') recs.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'sdnn-desc') recs.sort((a, b) => (b.td?.sdnn || 0) - (a.td?.sdnn || 0));

    // Tag filter bar
    const tfBar = document.getElementById('tagFilterBar');
    if (tfBar) tfBar.innerHTML = state.tags.slice(0, 6).map(t => `
      <span class="tag-chip ${state.filters.tags.includes(t.id) ? 'active' : ''}"
        onclick="App.toggleTagFilter('${t.id}')">
        ${t.name}
      </span>`).join('');

    if (state.libraryView === 'grid') {
      const grid = document.getElementById('libraryGrid');
      if (!grid) return;
      if (!recs.length) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">🫀</div>
          <div class="empty-state-title">Sin grabaciones</div>
          <div class="empty-state-sub">Importa archivos RR para comenzar</div>
          <button class="btn btn-primary" onclick="UI.openImport()">+ Importar</button>
        </div>`;
        return;
      }
      grid.innerHTML = recs.map(r => this._recordingCard(r)).join('');
    } else {
      const body = document.getElementById('libraryListBody');
      if (!body) return;
      body.innerHTML = recs.map(r => {
        const td = r.td || {};
        return `<div class="recording-row ${state.currentRecording?.id === r.id ? 'selected' : ''}" onclick="App.selectRecording('${r.id}')">
          <span class="rr-name">${r.name}</span>
          <span class="rr-patient">${r.metadata?.name || '—'}</span>
          <span class="rr-date">${new Date(r.created).toLocaleDateString('es')}</span>
          <span class="rr-beats">${r.rrMs?.length || 0}</span>
          <span class="rr-sdnn">${td.sdnn ?? '—'}</span>
        </div>`;
      }).join('');
    }
  },

  _recordingCard(r) {
    const td = r.td || {}, fd = r.fd || {}, nl = r.nl || {};
    const meta = r.metadata || {};
    const tags = (r.tagIds || []).map(id => state.tags.find(t => t.id === id)).filter(Boolean);
    return `<div class="recording-card ${state.currentRecording?.id === r.id ? 'selected' : ''}" onclick="App.selectRecording('${r.id}')">
      <div class="rc-header">
        <div>
          <div class="rc-name">${r.name}</div>
          <div class="rc-date">${new Date(r.created).toLocaleDateString('es')} ${new Date(r.created).toLocaleTimeString('es', {hour:'2-digit',minute:'2-digit'})}</div>
        </div>
      </div>
      ${meta.name ? `<div class="rc-patient">👤 ${meta.name}</div>` : ''}
      <div class="rc-metrics">
        <div class="rc-metric"><div class="rcm-label">SDNN</div><div class="rcm-value">${td.sdnn ?? '—'} ms</div></div>
        <div class="rc-metric"><div class="rcm-label">RMSSD</div><div class="rcm-value">${td.rmssd ?? '—'} ms</div></div>
        <div class="rc-metric"><div class="rcm-label">HR</div><div class="rcm-value">${td.meanHR ?? '—'} bpm</div></div>
        <div class="rc-metric"><div class="rcm-label">LF/HF</div><div class="rcm-value">${fd.lfhf ?? '—'}</div></div>
      </div>
      ${tags.length ? `<div class="rc-tags">${tags.map(t => `<span class="rc-tag" style="border-color:${t.color}20;color:${t.color}">${t.name}</span>`).join('')}</div>` : ''}
      <div class="rc-actions">
        <div class="rc-action-btn" onclick="event.stopPropagation();App.deleteRecording('${r.id}')" title="Eliminar">🗑</div>
        <div class="rc-action-btn" onclick="event.stopPropagation();IO.exportCSV(state.recordings.find(x=>x.id==='${r.id}'))" title="Exportar CSV">⬇</div>
      </div>
    </div>`;
  },

  renderAnalysisHeader(rec) {
    const m = rec.metadata || {};
    const td = rec.td || {};
    document.getElementById('analyzeTitle').textContent = rec.name;
    document.getElementById('analyzeSub').textContent = [
      m.name ? `👤 ${m.name}` : null,
      m.condition ? m.condition : null,
      `${rec.rrMs?.length || 0} latidos`,
      td.totalDuration ? `${Math.round(td.totalDuration/60)} min` : null,
      new Date(rec.created).toLocaleDateString('es')
    ].filter(Boolean).join(' · ');
  },

  renderAnalysis(rec) {
    if (!rec) return;
    this.renderAnalysisHeader(rec);
  
    // Ensure windows array exists
    if (!rec.windows) rec.windows = [];
    if (!state.activeWindowId && rec.windows.length)
      state.activeWindowId = rec.windows[0].id;
  
    const rr = rec.cleanRR || rec.rrMs;
    this.renderAnalysisMetrics(rec);   // left panel
    this.renderAnalysisCenter(rec, rr); // center panel
  },
  
  renderAnalysisMetrics(rec) {
    const { td, fd, nl, comp } = rec;
    const leftEl = document.getElementById('analyzeLeft');
    leftEl.innerHTML = `
      <div id="windowsPanelContainer"></div>
      <div id="mainMetricsContainer">${this._buildMetricsPanel(td, fd, nl, comp)}</div>
    `;
    this.renderWindowsPanel();
  },
  
  renderWindowsPanel() {
    const el = document.getElementById('windowsPanelContainer');
    if (!el) return;
    const wins    = WindowMgr.getAll();
    const isAdding = state.windowMode;
    const activeId = state.activeWindowId;
  
    el.innerHTML = `
      <div class="metric-panel">
        <div class="mp-header open" onclick="this.classList.toggle('open');this.nextElementSibling.style.display=this.classList.contains('open')?'block':'none'">
          <span>🔲</span>
          <span class="mp-title">Ventanas de análisis</span>
          <span style="font-size:10px;color:var(--text-muted);margin-right:4px">${wins.length ? wins.length : ''}</span>
          <span class="mp-toggle">▼</span>
        </div>
        <div class="mp-body">
          <div style="display:flex;gap:4px;margin-bottom:8px">
            <button class="btn btn-sm ${isAdding ? 'btn-primary' : 'btn-secondary'}" style="flex:1"
              onclick="WindowMgr.toggleAddMode()">
              ${isAdding ? '✕ Cancelar' : '+ Nueva ventana'}
            </button>
            ${wins.length ? `<button class="btn btn-danger btn-sm" onclick="WindowMgr.clearAll()" title="Eliminar todas">🗑</button>` : ''}
            ${wins.length ? `<button class="btn btn-secondary btn-sm" onclick="WindowMgr.save();UI.notify('Ventanas guardadas','success')" title="Guardar">💾</button>` : ''}
          </div>
          ${isAdding ? `<div class="window-add-hint">Arrastra en el tacograma para seleccionar</div>` : ''}
          <div id="windowChipsList">
            ${wins.length
              ? wins.map(w => {
                  const isAct = w.id === activeId;
                  const dur   = w.analysis?.durationMin?.toFixed(1) ?? '?';
                  const beats = w.analysis?.beatCount ?? (w.endBeat - w.startBeat + 1);
                  return `<div class="window-chip ${isAct ? 'active' : ''}"
                      style="${isAct ? `border-color:${w.color};background:${w.color}18` : ''}"
                      onclick="WindowMgr.setActive('${w.id}')">
                    <span class="window-chip-dot" style="background:${w.color}"></span>
                    <span class="window-chip-label" title="${w.label}">${w.label}</span>
                    <span class="window-chip-meta">${beats}L·${dur}m</span>
                    <button class="btn btn-danger btn-icon-only" style="width:18px;height:18px;font-size:9px;flex-shrink:0"
                      onclick="event.stopPropagation();WindowMgr.delete('${w.id}')">✕</button>
                  </div>`;
                }).join('')
              : `<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:8px 0">
                  Sin ventanas. ${isAdding ? 'Arrastra en el tacograma.' : ''}
                 </div>`}
          </div>
        </div>
      </div>`;
  },
  
  renderWindowMetrics(win) {
    const el = document.getElementById('mainMetricsContainer');
    if (!el || !win?.analysis) return;
    const { td, fd, nl, comp } = win.analysis;
    const hdr = `<div class="win-metrics-header">
      <span class="window-chip-dot" style="background:${win.color}"></span>
      <span>${win.label}</span>
      <span style="font-size:10px;color:var(--text-muted)">${win.analysis.beatCount}L · ${win.analysis.durationMin?.toFixed(1)}min</span>
      <button class="btn btn-secondary btn-sm" style="margin-left:auto;font-size:10px"
        onclick="UI.renderAnalysisMetrics(state.currentRecording)">← Completo</button>
    </div>`;
    el.innerHTML = hdr + this._buildMetricsPanel(td, fd, nl, comp);
  },
  
  renderAnalysisCenter(rec, rr) {
    const center = document.getElementById('analyzeCenter');
    if (!center) return;
    const td = rec.td || {};
  
    center.innerHTML = `
      <!-- Interactive tachogram -->
      <div style="margin-bottom:12px" class="chart-card">
        <div class="chart-card-header" style="justify-content:space-between">
          <span class="chart-card-title">Tacograma RR</span>
          <span class="chart-card-sub">${rr?.length ?? 0} latidos · ${td.totalDuration ? (td.totalDuration/60).toFixed(1) : '?'} min</span>
        </div>
        <div class="chart-body" style="padding:8px">
          <div style="position:relative;height:160px;width:100%">
            <canvas id="tachogramInteractive" style="width:100%;height:160px"></canvas>
          </div>
        </div>
      </div>
  
      <!-- Standard charts grid -->
      <div class="charts-grid">
        <div class="chart-card"><div class="chart-card-header"><span class="chart-card-title">Histograma RR</span></div>
          <div class="chart-body"><div class="chart-container" style="height:140px"><canvas id="histChart"></canvas></div></div></div>
        <div class="chart-card"><div class="chart-card-header"><span class="chart-card-title">Histograma ΔRR</span></div>
          <div class="chart-body"><div class="chart-container" style="height:140px"><canvas id="diffHistChart"></canvas></div></div></div>
      </div>
      <div class="chart-row" style="margin-bottom:12px">
        <div class="chart-card"><div class="chart-card-header">
            <span class="chart-card-title">PSD — Lomb-Scargle</span>
            <div style="display:flex;gap:8px;font-size:10px">
              <span style="color:rgba(100,136,255,0.9)">■ VLF</span>
              <span style="color:rgba(255,160,32,0.9)">■ LF</span>
              <span style="color:var(--accent)">■ HF</span>
            </div>
          </div>
          <div class="chart-body"><div class="chart-container" style="height:170px"><canvas id="psdChart"></canvas></div></div></div>
        <div class="chart-card"><div class="chart-card-header"><span class="chart-card-title">Diagrama de Poincaré</span></div>
          <div class="chart-body" style="display:flex;align-items:center;justify-content:center">
            <canvas id="poincareCanvas" style="width:100%;height:200px"></canvas>
          </div></div>
      </div>
  
      <!-- Non-stationary / Dynamic analysis -->
      <div class="chart-card" style="margin-bottom:16px">
        <div class="chart-card-header"><span class="chart-card-title">Análisis de No Estacionariedad</span></div>
        <div class="dynamic-tabs" id="dynamicTabBar">
          ${[['sliding','📈 Deslizante'],['segments','📊 Segmentos'],['prsa','🫀 PRSA']].map(([k,l]) =>
            `<button class="dtab-btn ${state.dynamicTab===k?'active':''}"
              onclick="UI.switchDynamicTab('${k}')">${l}</button>`).join('')}
        </div>
        <div id="dynamicTabContent" style="min-height:220px"></div>
      </div>
    `;
  
    // Render all charts after DOM is ready
    requestAnimationFrame(() => {
      if (rr) {
        Charts.renderInteractiveTachogram(rr, WindowMgr.getAll(), null);
        Charts.renderHistogram(rr);
        Charts.renderDiffHist(rr);
        Charts.renderPSD(rec.fd, rr);
        Charts.renderPoincare(rr, rec.td);
        // Bind tachogram mouse events
        App._bindTachogramEvents(rr);
      }
      UI.switchDynamicTab(state.dynamicTab, true);
    });
  },
  
  switchDynamicTab(tab, forceRender = false) {
    state.dynamicTab = tab;
    document.querySelectorAll('.dtab-btn').forEach(b =>
      b.classList.toggle('active', b.textContent.includes(
        tab === 'sliding' ? '📈' : tab === 'segments' ? '📊' : '🫀'
      ))
    );
    if (forceRender || true) this._renderDynamicTab(tab);
  },
  
  _renderDynamicTab(tab) {
    const el = document.getElementById('dynamicTabContent');
    if (!el) return;
    const rec = state.currentRecording;
    if (!rec) { el.innerHTML = '<div style="padding:16px;color:var(--text-muted)">Sin grabación</div>'; return; }
    const rr = rec.cleanRR || rec.rrMs;
    if (!rr?.length) return;
  
    if (tab === 'sliding') {
      const data = NonStationary.sliding(rr);
      if (!data.length) { el.innerHTML = '<div style="padding:14px;font-size:12px;color:var(--text-muted)">Grabación demasiado corta para análisis deslizante</div>'; return; }
      el.innerHTML = `
        <div style="padding:10px 14px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">
            Ventana: ${state.settings.slidingWinBeats} latidos · Paso: ${state.settings.slidingStepBeats} latidos
          </div>
          <div class="sliding-grid">
            <div><div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">SDNN (ms)</div>
                 <div class="chart-container" style="height:100px"><canvas id="slidSDNN"></canvas></div></div>
            <div><div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">RMSSD (ms)</div>
                 <div class="chart-container" style="height:100px"><canvas id="slidRMSSD"></canvas></div></div>
            <div><div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">FC media (bpm)</div>
                 <div class="chart-container" style="height:100px"><canvas id="slidHR"></canvas></div></div>
            <div><div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">pNN50 (%)</div>
                 <div class="chart-container" style="height:100px"><canvas id="slidPNN50"></canvas></div></div>
          </div>
        </div>`;
      requestAnimationFrame(() => {
        Charts.renderSlidingLine('slidSDNN',  data, 'sdnn',   'ms',  Charts.accent());
        Charts.renderSlidingLine('slidRMSSD', data, 'rmssd',  'ms',  Charts.accent());
        Charts.renderSlidingLine('slidHR',    data, 'meanHR', 'bpm', Charts.secondary());
        Charts.renderSlidingLine('slidPNN50', data, 'pnn50',  '%',   '#6488FF');
      });
  
    } else if (tab === 'segments') {
      const segs = NonStationary.autoSegment(rr, 3);
      const fmt  = MathUtils.fmt;
      el.innerHTML = `
        <div style="padding:10px 14px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">División automática en 3 segmentos iguales (ideal para protocolos reposo-ejercicio-reposo)</div>
          <div style="overflow-x:auto">
            <table class="segment-table">
              <tr><th>Segmento</th><th>Latidos</th><th>Duración</th>
                  <th>SDNN</th><th>RMSSD</th><th>FC media</th>
                  <th>LF (ms²)</th><th>HF (ms²)</th><th>LF/HF</th>
                  <th>SD1</th><th>SD2</th></tr>
              ${segs.map(s => `<tr>
                <td class="label">${s.label}</td>
                <td>${s.end - s.start}</td>
                <td>${fmt(s.durationMin, 1)} min</td>
                <td>${fmt(s.td?.sdnn, 1)}</td><td>${fmt(s.td?.rmssd, 1)}</td>
                <td>${fmt(s.td?.meanHR, 1)}</td>
                <td>${s.fd?.lf ?? '—'}</td><td>${s.fd?.hf ?? '—'}</td>
                <td>${fmt(s.fd?.lfhf, 2)}</td>
                <td>${fmt(s.nl?.sd1, 1)}</td><td>${fmt(s.nl?.sd2, 1)}</td>
              </tr>`).join('')}
            </table>
          </div>
        </div>`;
  
    } else if (tab === 'prsa') {
      const prsa = NonStationary.prsa(rr);
      const fmt  = MathUtils.fmt;
      el.innerHTML = prsa ? `
        <div style="padding:10px 14px">
          <div style="display:flex;gap:10px;margin-bottom:12px">
            <div class="prsa-metric">
              <div class="pm-val" style="color:var(--secondary)">${fmt(prsa.DC, 2)} ms</div>
              <div class="pm-label">DC — Capacidad de desaceleración ${_miInfo('dc')}</div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:3px">Marcador vagal/parasimpático</div>
            </div>
            <div class="prsa-metric">
              <div class="pm-val">${fmt(prsa.AC, 2)} ms</div>
              <div class="pm-label">AC — Capacidad de aceleración ${_miInfo('ac')}</div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:3px">Marcador simpático</div>
            </div>
          </div>
          <div class="prsa-grid">
            <div><div class="chart-container" style="height:120px"><canvas id="prsaDecChart"></canvas></div></div>
            <div><div class="chart-container" style="height:120px"><canvas id="prsaAccChart"></canvas></div></div>
          </div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:8px">
            PRSA (Bauer et al. 2006). L = ${prsa.L} latidos. DC normal (&gt;2.5 ms) indica actividad vagal preservada.
          </div>
        </div>`
        : `<div style="padding:14px;font-size:12px;color:var(--text-muted)">Se necesitan al menos ${4*30} latidos para PRSA</div>`;
      if (prsa) requestAnimationFrame(() => Charts.renderPRSACurves(prsa));
    }
  },

  _buildMetricsPanel(td, fd, nl, comp) {
    const m = MathUtils.fmt;
    let html = '';

    // Time domain
    if (td) {
      html += `<div class="metric-panel">
        <div class="mp-header open" onclick="this.classList.toggle('open')">
          <span>⏱</span><span class="mp-title">Dominio del Tiempo</span><span class="mp-toggle">▼</span>
        </div>
        <div class="mp-body">
          <div class="metric-grid">
            <div class="metric-item accent-bg mi-full">
              <div class="mi-label">Mean RR ${_miInfo('meanRR')}</div>
              <div class="mi-value">${m(td.mean, 1)}</div>
              <div class="mi-unit">ms · ${m(td.meanHR, 1)} bpm</div>
            </div>
            <div class="metric-item"><div class="mi-label">SDNN ${_miInfo('sdnn')}</div><div class="mi-value">${m(td.sdnn, 1)}</div><div class="mi-unit">ms</div><div class="mi-ref">Norm: 50–100</div></div>
            <div class="metric-item"><div class="mi-label">RMSSD ${_miInfo('rmssd')}</div><div class="mi-value">${m(td.rmssd, 1)}</div><div class="mi-unit">ms</div><div class="mi-ref">Norm: 20–50</div></div>
            <div class="metric-item"><div class="mi-label">pNN50 ${_miInfo('pnn50')}</div><div class="mi-value">${m(td.pnn50, 1)}</div><div class="mi-unit">%</div></div>
            <div class="metric-item"><div class="mi-label">NN50 ${_miInfo('nn50')}</div><div class="mi-value">${td.nn50}</div><div class="mi-unit">latidos</div></div>
            <div class="metric-item"><div class="mi-label">pNN20 ${_miInfo('pnn20')}</div><div class="mi-value">${m(td.pnn20, 1)}</div><div class="mi-unit">%</div></div>
            <div class="metric-item"><div class="mi-label">SD HR</div><div class="mi-value">${m(td.sdHR, 1)}</div><div class="mi-unit">bpm</div></div>
            <div class="metric-item"><div class="mi-label">CV ${_miInfo('cv')}</div><div class="mi-value">${m(td.cv, 2)}</div><div class="mi-unit">%</div></div>
            <div class="metric-item"><div class="mi-label">Min HR</div><div class="mi-value">${m(td.minHR, 1)}</div><div class="mi-unit">bpm</div></div>
            <div class="metric-item"><div class="mi-label">Max HR</div><div class="mi-value">${m(td.maxHR, 1)}</div><div class="mi-unit">bpm</div></div>
            <div class="metric-item"><div class="mi-label">Min RR</div><div class="mi-value">${td.minRR}</div><div class="mi-unit">ms</div></div>
            <div class="metric-item"><div class="mi-label">Max RR</div><div class="mi-value">${td.maxRR}</div><div class="mi-unit">ms</div></div>
            <div class="metric-item"><div class="mi-label">Tri. Index ${_miInfo('triIndex')}</div><div class="mi-value">${m(td.triIndex, 1)}</div><div class="mi-unit">u.a.</div></div>
            <div class="metric-item"><div class="mi-label">N beats</div><div class="mi-value">${td.n}</div><div class="mi-unit">latidos</div></div>
            ${td.sdann != null ? `<div class="metric-item"><div class="mi-label">SDANN ${_miInfo('sdann')}</div><div class="mi-value">${m(td.sdann, 1)}</div><div class="mi-unit">ms</div></div>` : ''}
            ${td.sdnni != null ? `<div class="metric-item"><div class="mi-label">SDNNi ${_miInfo('sdnni')}</div><div class="mi-value">${m(td.sdnni, 1)}</div><div class="mi-unit">ms</div></div>` : ''}
          </div>
        </div>
      </div>`;
    }
    
    // Frequency domain
    if (fd) {
      html += `<div class="metric-panel">
        <div class="mp-header open" onclick="this.classList.toggle('open')">
          <span>📡</span><span class="mp-title">Dominio de Frecuencia</span><span class="mp-toggle">▼</span>
        </div>
        <div class="mp-body">
          <div class="metric-grid">
            <div class="metric-item mi-full" style="background:rgba(100,136,255,0.08);border-color:rgba(100,136,255,0.2)">
              <div class="mi-label">VLF (0.003–0.04 Hz) ${_miInfo('vlf')}</div>
              <div class="mi-value" style="color:var(--info)">${fd.vlf}</div><div class="mi-unit">ms²</div>
            </div>
            <div class="metric-item" style="background:rgba(255,160,32,0.08);border-color:rgba(255,160,32,0.2)">
              <div class="mi-label">LF (0.04–0.15 Hz) ${_miInfo('lf')}</div>
              <div class="mi-value" style="color:var(--secondary)">${fd.lf}</div><div class="mi-unit">ms²</div>
            </div>
            <div class="metric-item accent-bg">
              <div class="mi-label">HF (0.15–0.4 Hz) ${_miInfo('hf')}</div>
              <div class="mi-value">${fd.hf}</div><div class="mi-unit">ms²</div>
            </div>
            <div class="metric-item"><div class="mi-label">Total Power</div><div class="mi-value">${fd.total}</div><div class="mi-unit">ms²</div></div>
            <div class="metric-item"><div class="mi-label">LF norm ${_miInfo('lfNorm')}</div><div class="mi-value" style="color:var(--secondary)">${m(fd.lfNorm, 1)}</div><div class="mi-unit">n.u.</div></div>
            <div class="metric-item"><div class="mi-label">HF norm ${_miInfo('hfNorm')}</div><div class="mi-value">${m(fd.hfNorm, 1)}</div><div class="mi-unit">n.u.</div></div>
            <div class="metric-item"><div class="mi-label">LF/HF ${_miInfo('lfhf')}</div><div class="mi-value" style="color:${fd.lfhf > 2 ? 'var(--warning)' : 'var(--accent)'}">${m(fd.lfhf, 3)}</div><div class="mi-unit">ratio</div></div>
            <div class="metric-item"><div class="mi-label">LF peak ${_miInfo('lfPeakF')}</div><div class="mi-value" style="color:var(--secondary)">${fd.lfPeakF}</div><div class="mi-unit">Hz</div></div>
            <div class="metric-item"><div class="mi-label">HF peak ${_miInfo('hfPeakF')}</div><div class="mi-value">${fd.hfPeakF}</div><div class="mi-unit">Hz</div></div>
          </div>
        </div>
      </div>`;
    }
    
    // Non-linear
    if (nl) {
      html += `<div class="metric-panel">
        <div class="mp-header open" onclick="this.classList.toggle('open')">
          <span>🌀</span><span class="mp-title">Análisis No Lineal</span><span class="mp-toggle">▼</span>
        </div>
        <div class="mp-body">
          <div class="metric-grid">
            <div class="metric-item accent-bg">
              <div class="mi-label">SD1 (Poincaré) ${_miInfo('sd1')}</div>
              <div class="mi-value">${m(nl.sd1, 1)}</div><div class="mi-unit">ms · vagal</div>
            </div>
            <div class="metric-item" style="background:rgba(255,160,32,0.08);border-color:rgba(255,160,32,0.2)">
              <div class="mi-label">SD2 (Poincaré) ${_miInfo('sd2')}</div>
              <div class="mi-value" style="color:var(--secondary)">${m(nl.sd2, 1)}</div><div class="mi-unit">ms</div>
            </div>
            <div class="metric-item"><div class="mi-label">SD1/SD2 ${_miInfo('sd1sd2')}</div><div class="mi-value">${m(nl.sd1sd2, 3)}</div><div class="mi-unit">ratio</div></div>
            <div class="metric-item"><div class="mi-label">SampEn ${_miInfo('sampen')}</div><div class="mi-value">${m(nl.sampen, 3)}</div><div class="mi-unit">bits</div></div>
            <div class="metric-item"><div class="mi-label">ApEn ${_miInfo('apen')}</div><div class="mi-value">${m(nl.apen, 3)}</div><div class="mi-unit">bits</div></div>
            ${nl.alpha1 != null ? `<div class="metric-item"><div class="mi-label">DFA α1 ${_miInfo('alpha1')}</div><div class="mi-value">${m(nl.alpha1, 3)}</div><div class="mi-unit">corto plazo</div><div class="mi-ref">Norm: 0.75–1.25</div></div>` : ''}
            ${nl.alpha2 != null ? `<div class="metric-item"><div class="mi-label">DFA α2 ${_miInfo('alpha2')}</div><div class="mi-value">${m(nl.alpha2, 3)}</div><div class="mi-unit">largo plazo</div></div>` : ''}
            ${nl.corrDim != null ? `<div class="metric-item"><div class="mi-label">Dim. Correlación ${_miInfo('corrDim')}</div><div class="mi-value">${m(nl.corrDim, 2)}</div><div class="mi-unit">D2</div></div>` : ''}
          </div>
        </div>
      </div>`;
    }

    // Composite / Autonomic
    if (comp) {
      html += `<div class="metric-panel">
        <div class="mp-header" onclick="this.classList.toggle('open')">
          <span>⚖️</span><span class="mp-title">Índices Compuestos</span><span class="mp-toggle">▼</span>
        </div>
        <div class="mp-body">
          <div class="metric-grid">
            ${comp.cvi != null ? `<div class="metric-item accent-bg"><div class="mi-label">CVI ${_miInfo('cvi')}</div><div class="mi-value">${m(comp.cvi, 3)}</div><div class="mi-unit">índice vagal</div></div>` : ''}
            ${comp.csi != null ? `<div class="metric-item"><div class="mi-label">CSI ${_miInfo('csi')}</div><div class="mi-value" style="color:var(--secondary)">${m(comp.csi, 2)}</div><div class="mi-unit">índice simpático</div></div>` : ''}
            ${comp.gsi != null ? `<div class="metric-item"><div class="mi-label">GSI ${_miInfo('gsi')}</div><div class="mi-value">${m(comp.gsi, 1)}</div><div class="mi-unit">ms</div></div>` : ''}
            ${comp.stressIndex != null ? `<div class="metric-item"><div class="mi-label">Índice de Estrés ${_miInfo('stressIndex')}</div><div class="mi-value" style="color:var(--warning)">${m(comp.stressIndex, 2)}</div><div class="mi-unit">Baevsky</div></div>` : ''}
            ${comp.vagusPower != null ? `<div class="metric-item"><div class="mi-label">Potencia Vagal ${_miInfo('vagusPower')}</div><div class="mi-value">${m(comp.vagusPower, 1)}</div><div class="mi-unit">% total</div></div>` : ''}
            ${comp.symPower != null ? `<div class="metric-item"><div class="mi-label">Potencia Simpática ${_miInfo('symPower')}</div><div class="mi-value" style="color:var(--secondary)">${m(comp.symPower, 1)}</div><div class="mi-unit">% total</div></div>` : ''}
            ${comp.dc != null ? `<div class="metric-item"><div class="mi-label">DC (desaceleración) ${_miInfo('dc')}</div><div class="mi-value">${m(comp.dc, 1)}</div><div class="mi-unit">ms</div></div>` : ''}
            ${comp.ac != null ? `<div class="metric-item"><div class="mi-label">AC (aceleración) ${_miInfo('ac')}</div><div class="mi-value">${m(comp.ac, 1)}</div><div class="mi-unit">ms</div></div>` : ''}
          </div>
        </div>
      </div>`;
    }

    return html || '<div class="empty-state" style="padding:20px"><div class="empty-state-title">Sin métricas disponibles</div></div>';
  },

  openReportModal() {
    const rec = state.currentRecording;
    if (!rec) { this.notify('Selecciona una grabación primero', 'error'); return; }
    document.getElementById('reportBody').innerHTML = this._buildReportHTML(rec);
    this.openModal('reportModal');
  },

  _buildReportHTML(rec) {
    const m = MathUtils.fmt;
    const meta = rec.metadata || {};
    const { td, fd, nl, comp } = rec;
    const rr   = rec.cleanRR || rec.rrMs;
    const prsa = rr && rr.length >= 120 ? NonStationary.prsa(rr) : null;
    const now     = new Date().toLocaleString('es');
    const recDate = new Date(rec.created).toLocaleString('es');
    const MI = METRIC_INFO; // shorthand

    const row = (label, val, unit, normal, interp) =>
      `<tr><td>${label}</td><td class="mono">${val}</td><td>${unit}</td><td>${normal}</td><td>${interp}</td></tr>`;

    return `
    <div style="font-family:'Outfit',sans-serif">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid var(--accent)">
        <div>
          <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--accent);margin-bottom:4px">Reporte de Análisis HRV</div>
          <div style="font-size:13px;color:var(--text-dim)">${rec.name}</div>
        </div>
        <div style="text-align:right;font-size:11px;color:var(--text-muted)">
          <div>Generado: ${now}</div>
          <div>Grabación: ${recDate}</div>
          <div>N = ${rr?.length ?? '—'} latidos · ${td?.totalDuration ? (td.totalDuration/60).toFixed(1) + ' min' : '—'}</div>
          <div style="font-weight:600;color:var(--text)">HRV Studio v1.0</div>
        </div>
      </div>

      <div class="report-section">
        <div class="report-section-title">INFORMACIÓN DEL SUJETO / PROTOCOLO</div>
        <table class="report-table">
          <tr><th>Paciente / ID</th><td>${meta.name || '—'}</td><th>Código</th><td>${meta.id || '—'}</td></tr>
          <tr><th>Fecha de nac.</th><td>${meta.dob || '—'}</td><th>Sexo</th><td>${meta.sex || '—'}</td></tr>
          <tr><th>Edad</th><td>${meta.age ? meta.age + ' años' : '—'}</td><th>Peso / Altura</th><td>${meta.weight ? meta.weight + ' kg' : '—'} / ${meta.height ? meta.height + ' cm' : '—'}</td></tr>
          <tr><th>Condición / Protocolo</th><td>${meta.condition || '—'}</td><th>Duración grabación</th><td>${meta.duration || (td?.totalDuration ? (td.totalDuration/60).toFixed(1) + ' min' : '—')}</td></tr>
          <tr><th>Medicamentos</th><td colspan="3">${meta.meds || '—'}</td></tr>
          <tr><th>Institución</th><td colspan="3">${meta.institution || '—'}</td></tr>
          ${meta.notes ? `<tr><th>Notas clínicas</th><td colspan="3">${meta.notes}</td></tr>` : ''}
        </table>
      </div>

      ${td ? `<div class="report-section">
        <div class="report-section-title">DOMINIO TEMPORAL</div>
        <table class="report-table">
          <tr><th>Métrica</th><th>Valor</th><th>Unidad</th><th>Rango normal</th><th>Significado clínico si alterado</th></tr>
          ${row('Media RR', m(td.mean,1), 'ms', MI.meanRR.r, MI.meanRR.a)}
          ${row('FC media', m(td.meanHR,1), 'bpm', '60–100 bpm', 'Taquicardia > 100 bpm o bradicardia < 60 bpm pueden alterar interpretación de VFC')}
          ${row('FC mín / FC máx', m(td.minHR,1)+' / '+m(td.maxHR,1), 'bpm', '—', 'Rango estrecho: rigidez autonómica; rango amplio: buena reserva')}
          ${row('SDNN', m(td.sdnn,1), 'ms', MI.sdnn.r, MI.sdnn.a)}
          ${row('RMSSD', m(td.rmssd,1), 'ms', MI.rmssd.r, MI.rmssd.a)}
          ${row('pNN50', m(td.pnn50,1), '%', MI.pnn50.r, MI.pnn50.a)}
          ${row('NN50', td.nn50, 'latidos', 'Depende de duración', 'Interpretar como porcentaje (pNN50); valor absoluto depende del N total')}
          ${row('pNN20', m(td.pnn20,1), '%', MI.pnn20.r, MI.pnn20.a)}
          ${row('CV', m(td.cv,2), '%', MI.cv.r, MI.cv.a)}
          ${row('Índice Triangular', m(td.triIndex,1), 'u.a.', MI.triIndex.r, MI.triIndex.a)}
          ${row('RR mínimo / máximo', td.minRR+' / '+td.maxRR, 'ms', '—', 'Valores extremos: posibles ectopias o artefactos; revisar tachograma')}
          ${row('SD HR', m(td.sdHR,1), 'bpm', '5–20 bpm', 'Alto: gran variabilidad de FC; bajo: FC rígida')}
          ${td.sdann != null ? row('SDANN', m(td.sdann,1), 'ms', MI.sdann.r, MI.sdann.a) : ''}
          ${td.sdnni != null ? row('SDNNi', m(td.sdnni,1), 'ms', MI.sdnni.r, MI.sdnni.a) : ''}
          ${row('N latidos', td.n, 'latidos', '≥ 300 (5 min)', 'Grabaciones muy cortas reducen fiabilidad de todos los índices')}
        </table>
      </div>` : ''}

      ${fd ? `<div class="report-section">
        <div class="report-section-title">DOMINIO FRECUENCIAL — Lomb-Scargle (no paramétrico)</div>
        <table class="report-table">
          <tr><th>Banda / Métrica</th><th>Valor</th><th>Unidad</th><th>Rango normal</th><th>Significado clínico si alterado</th></tr>
          ${row('VLF (0.003–0.04 Hz)', fd.vlf, 'ms²', MI.vlf.r, MI.vlf.a)}
          ${row('LF (0.04–0.15 Hz)', fd.lf, 'ms²', MI.lf.r, MI.lf.a)}
          ${row('HF (0.15–0.4 Hz)', fd.hf, 'ms²', MI.hf.r, MI.hf.a)}
          ${row('Potencia Total', fd.total, 'ms²', '—', 'Suma VLF+LF+HF; correlaciona con SDNN²')}
          ${row('LF norm', m(fd.lfNorm,1), 'n.u.', MI.lfNorm.r, MI.lfNorm.a)}
          ${row('HF norm', m(fd.hfNorm,1), 'n.u.', MI.hfNorm.r, MI.hfNorm.a)}
          ${row('LF/HF ratio', m(fd.lfhf,3), '—', MI.lfhf.r, MI.lfhf.a)}
          ${row('Pico LF', fd.lfPeakF, 'Hz', MI.lfPeakF.r, MI.lfPeakF.a)}
          ${row('Pico HF', fd.hfPeakF, 'Hz', MI.hfPeakF.r, MI.hfPeakF.a)}
        </table>
      </div>` : ''}

      ${nl ? `<div class="report-section">
        <div class="report-section-title">ANÁLISIS NO LINEAL</div>
        <table class="report-table">
          <tr><th>Métrica</th><th>Valor</th><th>Unidad</th><th>Rango normal</th><th>Significado clínico si alterado</th></tr>
          ${row('SD1 (Poincaré)', m(nl.sd1,1), 'ms', MI.sd1.r, MI.sd1.a)}
          ${row('SD2 (Poincaré)', m(nl.sd2,1), 'ms', MI.sd2.r, MI.sd2.a)}
          ${row('SD1/SD2', m(nl.sd1sd2,3), '—', MI.sd1sd2.r, MI.sd1sd2.a)}
          ${row('SampEn', nl.sampen != null ? m(nl.sampen,4) : '—', 'bits', MI.sampen.r, MI.sampen.a)}
          ${row('ApEn', nl.apen != null ? m(nl.apen,4) : '—', 'bits', MI.apen.r, MI.apen.a)}
          ${nl.alpha1 != null ? row('DFA α1 (corto plazo)', m(nl.alpha1,4), '—', MI.alpha1.r, MI.alpha1.a) : ''}
          ${nl.alpha2 != null ? row('DFA α2 (largo plazo)', m(nl.alpha2,4), '—', MI.alpha2.r, MI.alpha2.a) : ''}
          ${nl.corrDim != null ? row('Dim. de Correlación D2', m(nl.corrDim,3), '—', MI.corrDim.r, MI.corrDim.a) : ''}
        </table>
        <div style="font-size:10px;color:var(--text-muted);margin-top:6px">SampEn/ApEn: m=${state.settings.sampEnM}, r=${state.settings.sampEnR}×SDNN</div>
      </div>` : ''}

      ${comp ? `<div class="report-section">
        <div class="report-section-title">ÍNDICES COMPUESTOS Y BALANCE AUTONÓMICO</div>
        <table class="report-table">
          <tr><th>Índice</th><th>Valor</th><th>Unidad</th><th>Rango normal</th><th>Significado clínico si alterado</th></tr>
          ${comp.cvi != null ? row('CVI (Cardiac Vagal Index)', m(comp.cvi,3), '—', MI.cvi.r, MI.cvi.a) : ''}
          ${comp.csi != null ? row('CSI (Cardiac Sympathetic Index)', m(comp.csi,2), '—', MI.csi.r, MI.csi.a) : ''}
          ${comp.gsi != null ? row('GSI (Índice Geométrico SV)', m(comp.gsi,1), 'ms', MI.gsi.r, MI.gsi.a) : ''}
          ${comp.stressIndex != null ? row('Índice de Estrés (Baevsky)', m(comp.stressIndex,2), 'u.a.', MI.stressIndex.r, MI.stressIndex.a) : ''}
          ${comp.vagusPower != null ? row('Potencia Vagal (% espectral)', m(comp.vagusPower,1), '%', MI.vagusPower.r, MI.vagusPower.a) : ''}
          ${comp.symPower != null ? row('Potencia Simpática (% espectral)', m(comp.symPower,1), '%', MI.symPower.r, MI.symPower.a) : ''}
          ${comp.dc != null ? row('DC — Capacidad de Desaceleración', m(comp.dc,2), 'ms', MI.dc.r, MI.dc.a) : ''}
          ${comp.ac != null ? row('AC — Capacidad de Aceleración', m(comp.ac,2), 'ms', MI.ac.r, MI.ac.a) : ''}
        </table>
      </div>` : ''}

      ${prsa ? `<div class="report-section">
        <div class="report-section-title">PRSA — PHASE-RECTIFIED SIGNAL AVERAGING (Bauer et al. 2006)</div>
        <table class="report-table">
          <tr><th>Índice</th><th>Valor</th><th>Unidad</th><th>Rango normal</th><th>Significado clínico si alterado</th></tr>
          ${row('DC — Capacidad de Desaceleración', m(prsa.DC,2), 'ms', MI.dc.r, MI.dc.a)}
          ${row('AC — Capacidad de Aceleración', m(prsa.AC,2), 'ms', MI.ac.r, MI.ac.a)}
        </table>
        <div style="font-size:10px;color:var(--text-muted);margin-top:6px">L = ${prsa.L} latidos. DC > 4.5 ms indica actividad vagal preservada. Predictor independiente de mortalidad cardíaca.</div>
      </div>` : ''}

      <div style="margin-top:24px;padding-top:12px;border-top:1px solid var(--border);font-size:10px;color:var(--text-muted)">
        <strong>Referencias:</strong> Task Force ESC/NASPE (1996) Eur Heart J 17:354-381 · Peng et al. (1995) Chaos 5:82 · Bauer et al. (2006) Lancet 367:1674 · Richman & Moorman (2000) AJP 278:H2039.<br>
        <strong>Nota:</strong> Este reporte es generado automáticamente para fines informativos/investigación. Los rangos de referencia son orientativos; su interpretación clínica debe considerar el protocolo, la duración del registro, la edad, el sexo y el contexto del sujeto.
      </div>
    </div>`;
  },

  switchExportTab(name, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(`exportTab${name.charAt(0).toUpperCase() + name.slice(1)}`)?.classList.add('active');
    if (name === 'single') this.renderExportCards();
  },

  renderExportCards() {
    const rec = state.currentRecording;
    const container = document.getElementById('exportCards');
    if (!container) return;
    if (!rec) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Selecciona una grabación en la biblioteca primero</div>';
      return;
    }
    container.innerHTML = `
      <div class="export-card" onclick="IO.exportCSV(state.currentRecording)">
        <div class="export-card-icon">📊</div>
        <div class="export-card-title">CSV de intervalos RR</div>
        <div class="export-card-sub">Beat, RR(ms), HR(bpm), tiempo acumulado</div>
      </div>
      <div class="export-card" onclick="IO.exportMetricsCSV(state.currentRecording)">
        <div class="export-card-icon">📋</div>
        <div class="export-card-title">CSV de métricas HRV</div>
        <div class="export-card-sub">Todas las métricas calculadas</div>
      </div>
      <div class="export-card" onclick="IO.exportJSON(state.currentRecording)">
        <div class="export-card-icon">📦</div>
        <div class="export-card-title">JSON completo</div>
        <div class="export-card-sub">Datos crudos + métricas + metadatos</div>
      </div>
      <div class="export-card" onclick="UI.openReportModal()">
        <div class="export-card-icon">📄</div>
        <div class="export-card-title">Reporte HTML</div>
        <div class="export-card-sub">Informe clínico/investigación detallado</div>
      </div>
    `;
  },

  updateStorageInfo() {
    const n = state.recordings.length;
    document.getElementById('storageInfo').textContent = `${n} grabación${n !== 1 ? 'es' : ''}`;
    const pct = Math.min(n / 100 * 100, 100);
    document.getElementById('storageBar').style.width = pct + '%';
  }
};

// ===== MAIN APP =====
const App = {
  async init() {
    try {
      await DB.open();
      await this.loadAll();
      this.bindEvents();
      UI.notify('HRV Studio listo', 'success');
    } catch(e) {
      console.error('Init error:', e);
      UI.notify('Error inicializando base de datos', 'error');
    }
  },

  async loadAll() {
    await this.loadRecordings();
    await this.loadFolders();
    await this.loadTags();
    await this.loadSettings();
  },

  async loadRecordings() {
    state.recordings = await DB.getAll('recordings');
    UI.renderLibrary();
    UI.updateStorageInfo();
  },

  async loadFolders() {
    state.folders = await DB.getAll('folders');
    UI.renderFolderTree();
  },

  async loadTags() {
    state.tags = await DB.getAll('tags');
    UI.renderSidebarTags();
  },

  async loadSettings() {
    const settings = await DB.getAll('settings');
    for (const s of settings) {
      if (s.key in state.settings) state.settings[s.key] = s.value;
    }
    // Apply theme
    const themeVal = settings.find(s => s.key === 'theme');
    if (themeVal) this.applyTheme(themeVal.value);
  },

  async saveSetting(key, value) {
    state.settings[key] = value;
    await DB.put('settings', { key, value });
  },

  switchView(view) {
    state.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`view-${view}`)?.classList.add('active');
    document.querySelector(`.nav-btn[data-view="${view}"]`)?.classList.add('active');

    if (view === 'clean') {
      Clean.init();
    }
    if (view === 'analyze' && state.currentRecording) {
      requestAnimationFrame(() => UI.renderAnalysis(state.currentRecording));
    }
    if (view === 'export') {
      const rec = state.currentRecording;
      if (rec) document.getElementById('exportRecordingName').textContent = `Grabación activa: ${rec.name}`;
      UI.renderExportCards();
    }
  },

  goHome() { this.switchView('library'); },

  selectRecording(id) {
    const rec = state.recordings.find(r => r.id === id);
    if (!rec) return;
    state.currentRecording = rec;
    state.activeWindowId   = rec.windows?.[0]?.id || null;
    state.windowMode       = false;
    state.windowDraft      = null;
    this.switchView('analyze');
    UI.renderAnalysis(rec);
    UI.renderLibrary();
  },

  filterRecordings() {
    state.filters.search = document.getElementById('searchInput').value;
    UI.renderLibrary();
  },

  filterByFolder(folderId) {
    state.filters.folderId = folderId;
    UI.renderFolderTree();
    UI.renderLibrary();
  },

  toggleTagFilter(tagId) {
    const idx = state.filters.tags.indexOf(tagId);
    if (idx >= 0) state.filters.tags.splice(idx, 1);
    else state.filters.tags.push(tagId);
    UI.renderSidebarTags();
    UI.renderLibrary();
  },

  sortRecordings(val) {
    state.filters.sortBy = val;
    UI.renderLibrary();
  },

  setLibraryView(view) {
    state.libraryView = view;
    document.getElementById('libraryGrid').style.display = view === 'grid' ? 'grid' : 'none';
    document.getElementById('libraryList').style.display = view === 'list' ? 'flex' : 'none';
    document.getElementById('libraryList').style.flexDirection = view === 'list' ? 'column' : '';
    document.getElementById('gridViewBtn').classList.toggle('active', view === 'grid');
    document.getElementById('listViewBtn').classList.toggle('active', view === 'list');
    UI.renderLibrary();
  },

  async createFolder() {
    const name = document.getElementById('newFolderName').value.trim();
    if (!name) return;
    const folder = { id: Date.now() + '', name, created: Date.now() };
    await DB.put('folders', folder);
    document.getElementById('newFolderName').value = '';
    await this.loadFolders();
    UI.renderFolderList();
    UI.notify(`Carpeta "${name}" creada`, 'success');
  },

  async deleteFolder(id) {
    if (!confirm('¿Eliminar esta carpeta? Las grabaciones en ella no se eliminarán.')) return;
    await DB.del('folders', id);
    await this.loadFolders();
    UI.renderFolderList();
  },

  async createTag() {
    const name = document.getElementById('newTagName').value.trim();
    const color = document.getElementById('newTagColor').value;
    if (!name) return;
    const tag = { id: Date.now() + '', name, color, created: Date.now() };
    await DB.put('tags', tag);
    document.getElementById('newTagName').value = '';
    await this.loadTags();
    UI.renderTagList();
    UI.notify(`Etiqueta "${name}" creada`, 'success');
  },

  async deleteTag(id) {
    if (!confirm('¿Eliminar esta etiqueta?')) return;
    await DB.del('tags', id);
    await this.loadTags();
    UI.renderTagList();
  },

  async deleteRecording(id) {
    if (!confirm('¿Eliminar esta grabación permanentemente?')) return;
    await DB.del('recordings', id);
    if (state.currentRecording?.id === id) state.currentRecording = null;
    await this.loadRecordings();
    UI.notify('Grabación eliminada', 'success');
  },

  toggleTheme() {
    const curr = document.documentElement.getAttribute('data-theme');
    const next = curr === 'dark' ? 'light' : 'dark';
    this.applyTheme(next);
    this.saveSetting('theme', next);
  },

  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    state.theme = theme;
    const toggle = document.getElementById('themeToggle');
    if (toggle) toggle.classList.toggle('on', theme === 'dark');
    const themeBtn = document.querySelector('.icon-btn[data-tip="Modo claro/oscuro"]');
    if (themeBtn) themeBtn.textContent = theme === 'dark' ? '🌙' : '☀️';
    // Re-render charts with new colors
    if (state.currentRecording) {
      requestAnimationFrame(() => {
        if (state.currentView === 'analyze') UI.renderAnalysis(state.currentRecording);
        if (state.currentView === 'clean') Clean.redraw();
      });
    }
  },

  async clearAll() {
    if (!confirm('⚠️ Esta acción eliminará TODAS las grabaciones, carpetas y etiquetas. ¿Continuar?')) return;
    if (!confirm('Confirmación final: ¿eliminar todos los datos?')) return;
    await DB.clearStore('recordings');
    await DB.clearStore('folders');
    await DB.clearStore('tags');
    state.recordings = []; state.folders = []; state.tags = [];
    state.currentRecording = null;
    await this.loadAll();
    this.switchView('library');
    UI.notify('Todos los datos eliminados', 'success');
  },

  bindEvents() {
    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });

    // Clean chart click handler
    document.getElementById('cleanChart')?.addEventListener('click', e => Clean.handleCleanClick(e));

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      if (e.ctrlKey && e.key === 'i') { e.preventDefault(); UI.openImport(); }
    });

    // Window resize - redraw charts
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (state.currentView === 'clean') Clean.redraw();
        if (state.currentView === 'analyze' && state.currentRecording) {
          const rr = state.currentRecording.cleanRR || state.currentRecording.rrMs;
          if (rr) Charts.renderPoincare(rr, state.currentRecording.td);
        }
      }, 200);
    });
    
    // Tachogram interactive mouse events (delegated)
    document.getElementById('content').addEventListener('mousedown', e => {
      if (e.target.id !== 'tachogramInteractive') return;
      App._tachoMouseDown(e);
    });
    document.addEventListener('mousemove', e => App._tachoMouseMove(e));
    document.addEventListener('mouseup',   e => App._tachoMouseUp(e));
    
    // ── Info tooltip handler ──
    const _infoTip = document.getElementById('infoTooltip');
    document.addEventListener('mouseover', e => {
      const icon = e.target.closest?.('.mi-info');
      if (!icon || !_infoTip) return;
      const info = METRIC_INFO[icon.dataset.metric];
      if (!info) return;
      _infoTip.innerHTML =
        `<strong style="font-size:12px;color:var(--accent)">${info.n}</strong>` +
        `<div style="color:var(--text-dim);margin:4px 0;line-height:1.4">${info.d}</div>` +
        `<hr style="border:none;border-top:1px solid var(--border);margin:5px 0">` +
        `<div style="color:var(--text-muted);font-size:10px">📐 ${info.c}</div>` +
        `<div style="color:var(--success);font-size:10px">✓ Normal: ${info.r}</div>` +
        `<div style="color:var(--warning);font-size:10px">⚠ Alterado: ${info.a}</div>`;
      _infoTip.hidden = false;
      const rc = icon.getBoundingClientRect();
      const tW = 256, tH = _infoTip.offsetHeight || 130;
      let left = rc.left + rc.width / 2 - tW / 2;
      let top  = rc.top - tH - 8;
      if (left + tW > window.innerWidth - 10) left = window.innerWidth - tW - 10;
      if (left < 10) left = 10;
      if (top  < 10) top  = rc.bottom + 8;
      _infoTip.style.left = left + 'px';
      _infoTip.style.top  = top  + 'px';
    });
    document.addEventListener('mouseout', e => {
      if (e.target.closest?.('.mi-info') && _infoTip) _infoTip.hidden = true;
    });
  },
  
  _bindTachogramEvents(rrMs) {
    // Ensures the stored rrMs reference is current (called after render)
    const canvas = document.getElementById('tachogramInteractive');
    if (canvas) canvas._rrMs = rrMs;
  },

  _tachoMouseDown(e) {
    if (!state.windowMode) return;
    const canvas = e.target;
    if (!canvas._p) return;
    const rect  = canvas.getBoundingClientRect();
    const beat  = canvas._p.toBeat(e.clientX - rect.left);
    state.windowDraft = { startBeat: beat, endBeat: beat };
    e.preventDefault();
  },

  _tachoMouseMove(e) {
    if (!state.windowDraft) return;
    const canvas = document.getElementById('tachogramInteractive');
    if (!canvas?._p) return;
    const rect = canvas.getBoundingClientRect();
    const beat = canvas._p.toBeat(e.clientX - rect.left);
    state.windowDraft.endBeat = beat;
    // Live redraw with draft
    const rr = state.currentRecording?.cleanRR || state.currentRecording?.rrMs;
    if (rr) Charts.renderInteractiveTachogram(rr, WindowMgr.getAll(), state.windowDraft);
  },

  _tachoMouseUp(e) {
    if (!state.windowDraft || !state.windowMode) return;
    const { startBeat, endBeat } = state.windowDraft;
    state.windowDraft = null;
    const win = WindowMgr.create(startBeat, endBeat);
    if (win) {
      state.windowMode = false;
      document.getElementById('tachogramInteractive')?.classList.remove('mode-add');
      UI.renderWindowsPanel();
      UI.renderWindowMetrics(win);
      const rr = state.currentRecording.cleanRR || state.currentRecording.rrMs;
      Charts.renderInteractiveTachogram(rr, WindowMgr.getAll(), null);
      // Optionally auto-save
      WindowMgr.save();
    }
  },
};

// ===== BOOT =====
window.addEventListener('DOMContentLoaded', () => App.init());

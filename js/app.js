
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

// ===== CLEANING METHOD INFO =====
const CLEAN_INFO = {
  threshold: {
    n: 'Filtro por umbral fijo',
    d: 'Descarta todo intervalo RR fuera de los límites [mín, máx] definidos. Detecta artefactos obvios independientemente de la variabilidad del sujeto.',
    r: 'Límites habituales: 300–2000 ms en adultos en reposo (Taquicardia severa: >150 bpm → 400 ms mín).',
    pros: 'Rápido, explícito e interpretable. Ideal como primer paso.',
    cons: 'No adaptativo: puede eliminar latidos legítimos en bradi/taquicardia extremas.'
  },
  sdFilter: {
    n: 'Filtro estadístico por desviación estándar',
    d: 'Elimina intervalos que se alejan más de N desviaciones estándar de la media activa. Adaptativo: el umbral depende de la distribución del sujeto.',
    r: '±2.0σ conservador · ±2.5σ estándar (Task Force) · ±3.0σ permisivo.',
    pros: 'Se adapta a cada sujeto. Conserva la variabilidad fisiológica real.',
    cons: 'Sesgado si hay muchos artefactos que inflan la SD. Aplicar después del umbral fijo.'
  },
  diffFilter: {
    n: 'Filtro por diferencias sucesivas absolutas (ΔRR)',
    d: 'Marca un latido si su diferencia absoluta con el intervalo anterior supera el umbral. Detecta cambios bruscos latido-a-latido (ectopias ventriculares, dropout).',
    r: 'Umbral habitual: 150–300 ms. La Task Force sugiere el 20% del RR previo (véase Malik).',
    pros: 'Detecta transiciones rápidas que superan el filtro de umbral.',
    cons: 'Puede marcar VFC fisiológica alta. Ajustar según actividad del sujeto.'
  },
  malik: {
    n: 'Filtro Malik (relativo al RR previo)',
    d: 'Marca el latido si |RRᵢ − RRᵢ₋₁| / RRᵢ₋₁ > umbral. Versión relativa y adaptativa a la FC: el mismo cambio absoluto es más tolerable a FC baja.',
    r: '20% es el umbral recomendado por Malik et al. (1993). Usado por Kubios y Polar.',
    pros: 'Adaptativo a la FC. Equivalente al criterio 20% del estándar ESC.',
    cons: 'Asimétrico: más estricto para desaceleraciones que aceleraciones en bradicardia.'
  },
  quotient: {
    n: 'Filtro Cociente — Karlsson (2001)',
    d: 'Descarta el latido si el cociente RRᵢ/RRᵢ₋₁ ∉ [1−q, 1+q]. Matemáticamente equivalente al filtro Malik pero más estable numéricamente con FC altas.',
    r: 'Karlsson et al. (2001) recomiendan q = 0.20 (±20%).',
    pros: 'Más estable que el filtro de diferencias en taquicardia. Simétrico en términos de cociente.',
    cons: 'Mismos límites de interpretación que el filtro Malik.'
  },
  interpolation: {
    n: 'Interpolación de latidos removidos',
    d: 'Sustituye los latidos marcados por valores estimados. Preserva la longitud de la serie y evita discontinuidades en el espectro de frecuencias.\n\n• Lineal: recta entre vecinos — estándar Task Force.\n• Cúbica (Catmull-Rom): suaviza la transición — mejor para HF.\n• Media local: promedio de vecinos inmediatos.',
    r: 'Usar solo si <5% de latidos removidos. Task Force (1996) recomienda interpolación lineal.',
    pros: 'Mantiene la continuidad temporal y mejora el análisis espectral.',
    cons: 'Introduce datos sintéticos. No usar si los artefactos forman grupos (burst).'
  },
  detrend: {
    n: 'Detrend lineal',
    d: 'Resta la recta de regresión de la serie RR y añade la media original. Elimina la deriva lenta (postura, temperatura, fatiga) mejorando la estacionariedad requerida por el análisis espectral.',
    r: 'Recomendado en grabaciones >5 min con deriva visible. Tarvainen et al. (2002) proponen detrend suavizado (smoothness priors) para series largas.',
    pros: 'Mejora la estacionariedad. Aumenta la calidad del espectro LF/VLF.',
    cons: 'Elimina información real sobre tendencias lentas. No aplicar si la deriva es clínicamente relevante.'
  },
  smooth: {
    n: 'Suavizado por media móvil',
    d: 'Reemplaza cada latido por la media de los ±k latidos vecinos. Atenúa el ruido de alta frecuencia y la cuantización de dispositivos de baja resolución.',
    r: 'Ventana ±1–2 latidos como máximo para preservar VFC. Ventanas >±4 atenúan drásticamente RMSSD y HF.',
    pros: 'Útil para señales con cuantización gruesa (ej. 1ms vs 1/1024s).',
    cons: 'Reduce artificialmente RMSSD, pNN50 y potencia HF. Usar solo si hay ruido de cuantización evidente.'
  }
};

function _cleanInfo(key) {
  if (!CLEAN_INFO[key]) return '';
  return `<span class="mi-info" data-clean="${key}">i</span>`;
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

  composite(td, fd, nl, rrMs = null) {
    if (!td) return null;
    const res = {};

    // ── Stress Index (Baevsky) — proper formula ──────────────────────────────
    // SI = AMo / (2 × MxDMn × Mo)
    // AMo: % of beats in the modal 50ms class
    // Mo : center of that class in seconds (mode)
    // MxDMn: (maxRR − minRR) in seconds (variation range)
    if (rrMs && rrMs.length > 10) {
      const SI_BW  = 50; // 50 ms bin width (Baevsky standard)
      const si_bins = {};
      for (const r of rrMs) {
        const b = Math.floor(r / SI_BW) * SI_BW;
        si_bins[b] = (si_bins[b] || 0) + 1;
      }
      const si_top = Object.entries(si_bins).sort(([, a], [, b]) => b - a)[0];
      if (si_top) {
        const Mo     = (parseInt(si_top[0]) + SI_BW / 2) / 1000;   // seconds
        const AMo    = (si_top[1] / rrMs.length) * 100;             // %
        const MxDMn  = (Math.max(...rrMs) - Math.min(...rrMs)) / 1000; // seconds
        res.stressIndex = (MxDMn > 0.001 && Mo > 0)
          ? Math.round(AMo / (2 * MxDMn * Mo) * 100) / 100
          : null;
      }
    }

    // ── Poincaré-based indices (CVI, CSI, GSI) ───────────────────────────────
    if (nl && nl.sd1 > 0 && nl.sd2 > 0) {
      res.cvi = Math.round(Math.log10(4 * Math.PI * nl.sd1 * nl.sd2) * 1000) / 1000;
      res.csi = Math.round((nl.sd2 / nl.sd1) * 100) / 100;
      res.gsi = Math.round(Math.sqrt(nl.sd1 * nl.sd2) * 10) / 10;
    }

    // ── Spectral autonomic balance ────────────────────────────────────────────
    if (fd && fd.total > 0) {
      res.vagusPower = Math.round(fd.hf / fd.total * 100 * 10) / 10;
      res.symPower   = Math.round(fd.lf  / fd.total * 100 * 10) / 10;
    }

    // ── DC / AC via PRSA (proper Phase-Rectified Signal Averaging) ───────────
    // Bauer et al. 2006 — requires ≥ 120 beats
    if (rrMs && rrMs.length >= 120) {
      const prsa = NonStationary.prsa(rrMs);
      if (prsa) { res.dc = prsa.DC; res.ac = prsa.AC; }
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

  /**
   * Correlation Dimension D2 — Grassberger & Procaccia (1983).
   * Computes C(r) at 5 scales from 0.1σ to 2σ, then fits log C(r) vs log r.
   * D2 = slope of the scaling region (linear regime of the log-log plot).
   */
  _corrDim(data, _unused) {
    const n  = data.length;
    if (n < 20) return null;
    const sd = MathUtils.stdDev(data) || 1;
    // Five scales spanning the typical scaling region of HRV data
    const scales = [0.1, 0.3, 0.6, 1.0, 1.5, 2.0].map(k => k * sd);
    const logR = [], logC = [];
    for (const r of scales) {
      let C = 0;
      const N2 = n * (n - 1);        // total ordered pairs (i≠j)
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++)
          if (i !== j && Math.abs(data[i] - data[j]) < r) C++;
      const cr = C / N2;
      if (cr > 0 && cr < 1) { logR.push(Math.log(r)); logC.push(Math.log(cr)); }
    }
    if (logR.length < 3) return null;
    return Math.max(0, MathUtils.linReg(logR, logC).slope);
  },

  fullAnalysis(rrRaw) {
    const rrMs = this.normalize(rrRaw);
    if (!rrMs) return null;
    const td = this.timeDomain(rrMs);
    const fd = this.frequencyDomain(rrMs);
    const nl = this.nonLinear(rrMs);
    const comp = this.composite(td, fd, nl, rrMs);
    return { rrMs, td, fd, nl, comp };
  }
};

// ===== PARSER =====
const Parse = {
  detect(text) {
    const allLines = text.split('\n');
    // Separate comment metadata from data lines
    const commentMeta = {};
    const lines = [];
    for (const l of allLines) {
      const t = l.trim();
      if (!t) continue;
      if (t.startsWith('#')) {
        const body = t.slice(1).trim();
        const ci   = body.indexOf(':');
        if (ci > 0) commentMeta[body.slice(0, ci).trim()] = body.slice(ci + 1).trim();
      } else {
        lines.push(t);
      }
    }
    if (!lines.length) return null;

    const first  = lines[0];
    const hasDelim = first.includes(',') || first.includes(';') || first.includes('\t');

    if (hasDelim) {
      const sep  = first.includes('\t') ? '\t' : first.includes(';') ? ';' : ',';
      const cols = first.split(sep).map(h => h.trim().replace(/^"|"$/g, ''));
      // Header if ANY cell is non-numeric
      const isHeader = cols.some(c => isNaN(parseFloat(c)));

      if (isHeader) {
        const rrIdx = cols.findIndex(h => {
          const hl = h.toLowerCase();
          return hl.includes('rr') || hl.includes('r-r') || hl.includes('nn') ||
                 hl.includes('ibi') || hl.includes('interval');
        });
        const timeIdx = cols.findIndex(h => {
          const hl = h.toLowerCase();
          return hl.includes('time') || hl.includes('stamp') ||
                 hl === 'ms' || hl === 's';
        });
        return {
          format: 'csv-header', sep,
          rrIdx:   rrIdx   >= 0 ? rrIdx   : 0,
          timeIdx: timeIdx >= 0 ? timeIdx : -1,
          header:  cols, commentMeta, lines
        };
      }
      return { format: 'csv-noheader', sep, lines };
    }
    return { format: 'txt-plain', lines };
  },

  parse(text, detected, rrColIdx = null) {
    const lines  = detected.lines || text.trim().split('\n')
                     .filter(l => l.trim() && !l.trim().startsWith('#'));
    const values = [];
    const useIdx = rrColIdx !== null ? rrColIdx : (detected.rrIdx ?? 0);

    if (detected.format === 'csv-header') {
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(detected.sep).map(c => c.trim().replace(/^"|"$/g, ''));
        const v    = parseFloat(cols[useIdx]);
        if (!isNaN(v) && v > 0) values.push(v);
      }
    } else if (detected.format === 'csv-noheader') {
      for (const line of lines) {
        const cols = line.split(detected.sep)
                        .map(c => parseFloat(c.trim()))
                        .filter(v => !isNaN(v) && v > 0);
        if (cols.length) values.push(cols[Math.min(useIdx, cols.length - 1)]);
      }
    } else {
      for (const line of lines) {
        const v = parseFloat(line.replace(',', '.'));
        if (!isNaN(v) && v > 0) values.push(v);
      }
    }
    return values;
  },

  /** Returns first nRows data rows as arrays of strings (for column preview). */
  getPreviewRows(detected, nRows = 6) {
    if (!detected.lines) return [];
    const start = detected.format === 'csv-header' ? 1 : 0;
    return detected.lines
      .slice(start, start + nRows)
      .map(l => l.split(detected.sep).map(c => c.trim().replace(/^"|"$/g, '') || '—'));
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
        else if (method === 'cubic') {
          // Catmull-Rom cubic spline (tension 0.5)
          const t  = (idx - prev) / (next - prev);
          const rr_ = rec.cleanRR;
          // Find outer control points (skip removed)
          let pp = prev - 1;
          while (pp >= 0 && state.removedBeats.has(pp)) pp--;
          let nn = next + 1;
          while (nn < rr_.length && state.removedBeats.has(nn)) nn++;
          const p0 = pp >= 0          ? rr_[pp]        : rr_[prev];
          const p1 = rr_[prev];
          const p2 = rr_[next];
          const p3 = nn < rr_.length  ? rr_[nn]        : rr_[next];
          rr[idx] = 0.5 * (
            (2 * p1) +
            (-p0 + p2) * t +
            (2*p0 - 5*p1 + 4*p2 - p3) * t * t +
            (-p0 + 3*p1 - 3*p2 + p3) * t * t * t
          );
        } else {
          rr[idx] = (rr[prev] + rr[next]) / 2; // mean fallback
        }
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
    const prev = state.cleanHistory.pop();
    if (prev instanceof Set) {
      // Marker-type operation: restore removed-beats set
      state.removedBeats = prev;
    } else if (prev?.type === 'values') {
      // Value-modifying operation (detrend, smooth): restore full rr array
      if (state.currentRecording) state.currentRecording.cleanRR = prev.rr;
    }
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

  /** Click handler — only activates in 'select' mode; range mode uses mouse drag. */
  handleCleanClick(e) {
    if (state.cleanMode !== 'select') return;
    const canvas = document.getElementById('cleanChart');
    if (!canvas?._chartParams) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const { pad, plotW, n } = canvas._chartParams;
    if (mx < pad.l || mx > canvas.width - pad.r) return;
    const beatIdx = Math.round((mx - pad.l) / plotW * (n - 1));
    let nearest = beatIdx;
    for (let d = 0; d <= 10; d++) {
      for (const idx of [beatIdx - d, beatIdx + d]) {
        if (idx >= 0 && idx < n && !state.removedBeats.has(idx)) { nearest = idx; break; }
      }
      if (!state.removedBeats.has(nearest)) break;
    }
    if (state.removedBeats.has(nearest)) state.removedBeats.delete(nearest);
    else state.removedBeats.add(nearest);
    this.updateStats(); this.redraw();
  },

  // ── Range-mode drag handlers ─────────────────────────────────────────────
  _rangeStart: null,

  handleCleanMouseDown(e) {
    if (state.cleanMode !== 'range') return;
    const canvas = document.getElementById('cleanChart');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    this._rangeStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    e.preventDefault();
  },

  handleCleanMouseMove(e) {
    if (state.cleanMode !== 'range' || !this._rangeStart) return;
    const canvas = document.getElementById('cleanChart');
    if (!canvas?._chartParams) return;
    this.redraw();                                  // repaint clean base first
    const ctx  = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const cx = MathUtils.clamp(e.clientX - rect.left, 0, canvas.width);
    const cy = MathUtils.clamp(e.clientY - rect.top,  0, canvas.height);
    const x  = Math.min(this._rangeStart.x, cx);
    const y  = Math.min(this._rangeStart.y, cy);
    const w  = Math.abs(cx - this._rangeStart.x);
    const h  = Math.abs(cy - this._rangeStart.y);
    ctx.fillStyle   = 'rgba(0,194,212,0.10)';
    ctx.strokeStyle = 'rgba(0,194,212,0.85)';
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
    // Show beat count hint
    const { pad, plotW, n } = canvas._chartParams;
    const bMin = Math.round((Math.max(x, pad.l) - pad.l) / plotW * (n - 1));
    const bMax = Math.round((Math.min(x + w, canvas.width - pad.r) - pad.l) / plotW * (n - 1));
    const cnt  = Math.max(0, bMax - bMin + 1);
    ctx.fillStyle = 'rgba(0,194,212,0.95)';
    ctx.font      = 'bold 10px JetBrains Mono';
    ctx.fillText(`${cnt} lat.`, x + 4, y > 20 ? y + h - 6 : y + h + 14);
  },

  handleCleanMouseUp(e) {
    if (state.cleanMode !== 'range' || !this._rangeStart) return;
    const canvas = document.getElementById('cleanChart');
    if (!canvas?._chartParams) { this._rangeStart = null; return; }
    const rect = canvas.getBoundingClientRect();
    const x1   = e.clientX - rect.left, y1 = e.clientY - rect.top;
    const x0   = this._rangeStart.x,    y0 = this._rangeStart.y;
    this._rangeStart = null;

    const { pad, plotW, plotH, n, minV, maxV, rrMs } = canvas._chartParams;
    const xMin = Math.max(pad.l, Math.min(x0, x1));
    const xMax = Math.min(canvas.width - pad.r, Math.max(x0, x1));
    const yMin = Math.max(pad.t, Math.min(y0, y1));
    const yMax = Math.min(canvas.height - pad.b, Math.max(y0, y1));
    const bMin = Math.max(0, Math.round((xMin - pad.l) / plotW * (n - 1)));
    const bMax = Math.min(n - 1, Math.round((xMax - pad.l) / plotW * (n - 1)));
    const rrHi = maxV - (yMin - pad.t) / plotH * (maxV - minV);
    const rrLo = maxV - (yMax - pad.t) / plotH * (maxV - minV);

    if (bMax <= bMin && Math.abs(x1 - x0) < 6) { this.redraw(); return; }

    state.cleanHistory.push(new Set(state.removedBeats));
    let cnt = 0;
    for (let i = bMin; i <= bMax; i++) {
      if (!state.removedBeats.has(i) && rrMs[i] >= rrLo && rrMs[i] <= rrHi) {
        state.removedBeats.add(i); cnt++;
      }
    }
    this.updateStats(); this.redraw();
    if (cnt > 0) UI.notify(`${cnt} latidos marcados en rango`, 'success');
  },

  // ── Additional cleaning tools ────────────────────────────────────────────

  /** Linear detrend: removes slow drift, preserves mean RR. */
  detrendLinear() {
    const rec = state.currentRecording;
    if (!rec?.cleanRR) return;
    const rr     = rec.cleanRR;
    const active = rr.map((v, i) => ({ v, i })).filter(({ i }) => !state.removedBeats.has(i));
    if (active.length < 4) { UI.notify('Muy pocos latidos activos para detrend', 'error'); return; }
    const xs   = active.map(a => a.i);
    const ys   = active.map(a => a.v);
    const { slope, intercept } = MathUtils.linReg(xs, ys);
    const mean_y = MathUtils.mean(ys);
    state.cleanHistory.push({ type: 'values', rr: [...rr] });
    for (let i = 0; i < rr.length; i++) {
      if (!state.removedBeats.has(i)) rr[i] = rr[i] - (slope * i + intercept) + mean_y;
    }
    this.redraw();
    UI.notify(`Detrend lineal aplicado (pendiente: ${slope.toFixed(3)} ms/latido)`, 'success');
  },

  /** Malik filter: marks beats where |RRi − RRprev| / RRprev > threshold. */
  applyMalikFilter() {
    const rec = state.currentRecording;
    if (!rec?.cleanRR) return;
    const thresh = parseFloat(document.getElementById('malikThresh')?.value ?? 20) / 100;
    state.cleanHistory.push(new Set(state.removedBeats));
    let cnt = 0;
    const rr = rec.cleanRR;
    for (let i = 1; i < rr.length; i++) {
      if (state.removedBeats.has(i)) continue;
      let prev = i - 1;
      while (prev >= 0 && state.removedBeats.has(prev)) prev--;
      if (prev < 0) continue;
      if (Math.abs(rr[i] - rr[prev]) / rr[prev] > thresh) { state.removedBeats.add(i); cnt++; }
    }
    this.updateStats(); this.redraw();
    UI.notify(`Filtro Malik (${(thresh * 100).toFixed(0)}%): ${cnt} latidos marcados`, 'success');
  },

  /** Quotient filter (Karlsson 2001): marks beats where RRi/RRprev ∉ [1−q, 1+q]. */
  applyQuotientFilter() {
    const rec = state.currentRecording;
    if (!rec?.cleanRR) return;
    const q  = parseFloat(document.getElementById('quotientThresh')?.value ?? 20) / 100;
    const rr = rec.cleanRR;
    state.cleanHistory.push(new Set(state.removedBeats));
    let cnt = 0;
    for (let i = 1; i < rr.length; i++) {
      if (state.removedBeats.has(i)) continue;
      let prev = i - 1;
      while (prev >= 0 && state.removedBeats.has(prev)) prev--;
      if (prev < 0) continue;
      const ratio = rr[i] / rr[prev];
      if (ratio < (1 - q) || ratio > (1 + q)) { state.removedBeats.add(i); cnt++; }
    }
    this.updateStats(); this.redraw();
    UI.notify(`Filtro cociente (±${(q * 100).toFixed(0)}%): ${cnt} latidos marcados`, 'success');
  },

  /** Moving-average smoothing: replaces each active beat with local weighted mean. */
  applyMovingAvgSmooth() {
    const rec = state.currentRecording;
    if (!rec?.cleanRR) return;
    const hw = parseInt(document.getElementById('smoothWin')?.value ?? 2);
    const rr = rec.cleanRR;
    state.cleanHistory.push({ type: 'values', rr: [...rr] });
    const out = [...rr];
    for (let i = 0; i < rr.length; i++) {
      if (state.removedBeats.has(i)) continue;
      const nb = [];
      for (let k = Math.max(0, i - hw); k <= Math.min(rr.length - 1, i + hw); k++) {
        if (!state.removedBeats.has(k)) nb.push(rr[k]);
      }
      if (nb.length > 1) out[i] = MathUtils.mean(nb);
    }
    rec.cleanRR = out;
    this.redraw();
    UI.notify(`Suavizado ventana ±${hw} latidos aplicado`, 'success');
  },
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
    this.save(); // persist deletion immediately
  },
  
  /** Prompts the user to rename a window; persists if confirmed. */
  startRename(id, evt) {
    evt?.stopPropagation();
    const win = this.getAll().find(w => w.id === id);
    if (!win) return;
    // Inline rename via a small inline input inside the chip
    const labelEl = document.querySelector(`.window-chip[data-wid="${id}"] .window-chip-label`);
    if (!labelEl) {
      const newName = prompt('Nuevo nombre de ventana:', win.label);
      if (newName?.trim()) { win.label = newName.trim(); this._refresh(); this.save(); }
      return;
    }
    const prev = win.label;
    labelEl.contentEditable = 'true';
    labelEl.style.background = 'var(--card2)';
    labelEl.style.borderRadius = '3px';
    labelEl.style.padding = '0 3px';
    labelEl.focus();
    const sel = window.getSelection(); sel.selectAllChildren(labelEl);
    const finish = () => {
      labelEl.contentEditable = 'false';
      labelEl.style.background = '';
      labelEl.style.padding = '';
      const newName = labelEl.textContent.trim();
      if (newName && newName !== prev) {
        win.label = newName; this._refresh(); this.save();
        UI.notify(`Ventana renombrada a "${newName}"`, 'success');
      } else {
        labelEl.textContent = prev;
      }
    };
    labelEl.onblur = finish;
    labelEl.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); labelEl.blur(); } };
  },

  clearAll() {
    if (!confirm('¿Eliminar todas las ventanas de análisis?')) return;
    if (state.currentRecording) state.currentRecording.windows = [];
    state.activeWindowId = null;
    this._refresh();
    this.save(); // persist immediately
  },

  setActive(id) {
    state.activeWindowId = id;
    this._refresh();
    const win = this.getActive();
    const rr  = state.currentRecording?.cleanRR || state.currentRecording?.rrMs;
    if (win?.analysis) {
      UI.renderWindowMetrics(win);
      // Update all signal charts with the windowed RR slice
      if (rr) {
        const slice = rr.slice(win.startBeat, win.endBeat + 1);
        requestAnimationFrame(() => {
          Charts.renderHistogram(slice);
          Charts.renderDiffHist(slice);
          Charts.renderPSD(null, slice);
          Charts.renderPoincare(slice, win.analysis.td);
        });
      }
    } else {
      UI.renderAnalysisMetrics(state.currentRecording);
      if (rr) {
        requestAnimationFrame(() => {
          Charts.renderHistogram(rr);
          Charts.renderDiffHist(rr);
          Charts.renderPSD(null, rr);
          Charts.renderPoincare(rr, state.currentRecording.td);
        });
      }
    }
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
    const comp = HRV.composite(td, fd, nl, slice);
    return { td, fd, nl, comp, beatCount: slice.length, durationMin: MathUtils.sum(slice) / 60000 };
  },

  _refresh() {
    UI.renderWindowsPanel();
    const rr = state.currentRecording?.cleanRR || state.currentRecording?.rrMs;
    if (rr) Charts.renderInteractiveTachogram(rr, this.getAll(), null);
    // Immediately update the segments tab so renamed/added/deleted windows reflect there
    if (state.currentView === 'analyze' && state.dynamicTab === 'segments') {
      UI._renderDynamicTab('segments');
    }
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
    const text     = await file.text();
    const detected = Parse.detect(text);
    if (!detected) { UI.notify('Formato no reconocido', 'error'); return; }

    state.importBuffer = { text, detected, values: null, filename: file.name };

    const meta = detected.commentMeta || {};

    // ── Autofill name/tags from embedded metadata ──────────────────────────
    const nameVal = meta['Filename'] || file.name.replace(/\.(csv|txt)$/i, '');
    document.getElementById('importName').value = nameVal;
    if (meta['Tags']) document.getElementById('importTags').value = meta['Tags'];

    // ── CSV with column headers: show column selector ──────────────────────
    const colSel = document.getElementById('importColSelector');
    if (detected.format === 'csv-header' && detected.header?.length > 1) {
      const hdr   = detected.header;
      const rows  = Parse.getPreviewRows(detected);

      // Build preview table with clickable headers
      const thStyle = `padding:5px 10px;border:1px solid var(--border);cursor:pointer;
                       background:var(--card2);font-size:11px;white-space:nowrap;
                       font-family:'JetBrains Mono',monospace;color:var(--accent)`;
      const tdStyle = `padding:3px 10px;border:1px solid var(--border);font-size:11px;
                       font-family:'JetBrains Mono',monospace;color:var(--text-dim)`;

      document.getElementById('importColPreview').innerHTML =
        `<table style="width:100%;border-collapse:collapse">
           <thead><tr>${hdr.map((h, i) =>
             `<th style="${thStyle}" onclick="IO._setRRCol(${i})"
                  title="Usar columna ${i} como intervalos RR">▼ ${h}</th>`
           ).join('')}</tr></thead>
           <tbody>${rows.map(r =>
             `<tr>${r.map(c => `<td style="${tdStyle}">${c}</td>`).join('')}</tr>`
           ).join('')}</tbody>
         </table>`;

      // Populate column selects
      const optHTML = hdr.map((h, i) => `<option value="${i}">${i}: ${h}</option>`).join('');
      const rrSel   = document.getElementById('importRRCol');
      const tsSel   = document.getElementById('importTimeCol');
      if (rrSel) { rrSel.innerHTML = optHTML; rrSel.value = String(Math.max(0, detected.rrIdx)); }
      if (tsSel) {
        tsSel.innerHTML = '<option value="">Ninguna</option>' + optHTML;
        tsSel.value = detected.timeIdx >= 0 ? String(detected.timeIdx) : '';
      }
      // Set unit from column name heuristic
      const rrColName = (hdr[detected.rrIdx] || '').toLowerCase();
      const unitSel = document.getElementById('importUnit');
      if (unitSel) {
        if (rrColName.includes('(ms)') || rrColName.includes('ms'))       unitSel.value = 'ms';
        else if (rrColName.includes('(s)') || rrColName.endsWith(' s'))   unitSel.value = 's';
        else                                                                unitSel.value = 'auto';
      }

      if (colSel) colSel.style.display = 'block';
      document.getElementById('importPreview').style.display = 'none';
      document.getElementById('importUnitFallback').style.display = 'none';
      document.getElementById('importDetected').style.display  = 'block';
      document.getElementById('importDetected').innerHTML =
        `✓ CSV con encabezados detectado · <strong>${hdr.length} columnas</strong> · ` +
        `<strong>${detected.lines.length - 1} filas</strong> · Haz clic en ▼ para seleccionar columna RR`;
      this._updateImportPreview();

    } else {
      // ── Plain text / no-header CSV: simple flow ────────────────────────────
      const values = Parse.parse(text, detected);
      if (!values || values.length < 5) { UI.notify('No se encontraron valores RR válidos', 'error'); return; }
      state.importBuffer.values = values;
      const unit = MathUtils.median(values) < 5 ? 's' : 'ms';
      document.getElementById('importDetected').style.display = 'block';
      document.getElementById('importDetected').innerHTML =
        `✓ Detectado: <strong>${values.length} valores RR</strong> · ` +
        `Formato: ${detected.format} · Unidad estimada: <strong>${unit === 's' ? 'segundos' : 'ms'}</strong>`;
      document.getElementById('importPreview').style.display = 'block';
      document.getElementById('importPreviewData').textContent =
        values.slice(0, 10).map(v => v.toFixed(unit === 's' ? 4 : 1)).join('  ');
      if (colSel)  colSel.style.display = 'none';
      document.getElementById('importUnitFallback').style.display = '';
    }

    document.getElementById('importSettings').style.display = 'grid';
    document.getElementById('importConfirmBtn').style.display = 'flex';

    const sel = document.getElementById('importFolder');
    sel.innerHTML = '<option value="">Sin carpeta</option>';
    for (const f of state.folders) sel.innerHTML += `<option value="${f.id}">${f.name}</option>`;
  },

  /** Called when user clicks a column header in the preview table. */
  _setRRCol(idx) {
    const sel = document.getElementById('importRRCol');
    if (sel) { sel.value = String(idx); this._updateImportPreview(); }
  },

  /** Parses with the currently selected RR column and updates the simple preview. */
  _updateImportPreview() {
    const buf = state.importBuffer;
    if (!buf?.detected) return;
    const rrIdx  = parseInt(document.getElementById('importRRCol')?.value ?? '0');
    const values = Parse.parse(buf.text, buf.detected, rrIdx);
    buf.values   = values;
    if (!values.length) return;
    const unit = MathUtils.median(values) < 5 ? 's' : 'ms';
    document.getElementById('importPreview').style.display = 'block';
    document.getElementById('importPreviewData').textContent =
      values.slice(0, 10).map(v => v.toFixed(unit === 's' ? 4 : 1)).join('  ');
    const hdrName = buf.detected.header?.[rrIdx] ?? `Col. ${rrIdx}`;
    document.getElementById('importDetected').innerHTML =
      `✓ Columna seleccionada: <strong>${hdrName}</strong> · ` +
      `<strong>${values.length} valores RR válidos</strong> · ` +
      `Unidad estimada: <strong>${unit === 's' ? 'segundos' : 'ms'}</strong>`;
  },

  async confirmImport() {
    const buf = state.importBuffer;
    if (!buf) return;

    // Resolve values: for CSV-header use the selected column
    if (buf.detected.format === 'csv-header') {
      const rrIdx = parseInt(document.getElementById('importRRCol')?.value
                             ?? buf.detected.rrIdx ?? 0);
      buf.values  = Parse.parse(buf.text, buf.detected, rrIdx);
    }
    // Unit override from selector
    const unitOverride = document.getElementById('importUnit')?.value
                      || document.getElementById('importUnitTxt')?.value
                      || 'auto';

    const name = document.getElementById('importName').value || 'Grabación sin nombre';
    const folderId = document.getElementById('importFolder').value || null;
    const tagsRaw = document.getElementById('importTags').value;
    const tagNames = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

    // Apply unit override before normalisation
    let rawVals = buf.values;
    if (unitOverride === 's')   rawVals = rawVals.map(v => v * 1000);
    else if (unitOverride === 'ms') rawVals = rawVals; // already ms
    // Normalize
    const rrMs = HRV.normalize(rawVals);
    
    if (!rrMs || rrMs.length < 5) { UI.notify('Datos insuficientes para análisis', 'error'); return; }

    // Compute analysis
    const analysis = HRV.fullAnalysis(rrMs);

    // Process tags
    const tagIds = [];
    for (const tn of tagNames) {
      let tag = state.tags.find(t => t.name.toLowerCase() === tn.toLowerCase());
      if (!tag) {
        tag = { id: String(Date.now()) + '_' + String(Math.floor(Math.random() * 1e6)),
                name: tn, color: '#00C2D4', created: Date.now() };
        state.tags.push(tag);
        await DB.put('tags', tag);
      }
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
    const rr   = recording.cleanRR || recording.rrMs;
    const meta = recording.metadata || {};
    const prsa = rr && rr.length >= 120 ? NonStationary.prsa(rr) : null;

    const rows = [['Categoría', 'Métrica', 'Valor', 'Unidad', 'Rango Normal']];
    const add  = (cat, label, val, unit = '', ref = '') =>
      rows.push([cat, label, val ?? '', unit, ref]);

    // Metadatos
    add('Metadatos', 'Nombre grabación',    recording.name);
    add('Metadatos', 'Paciente / ID',       meta.name       || '');
    add('Metadatos', 'Código estudio',      meta.id         || '');
    add('Metadatos', 'Fecha grabación',     new Date(recording.created).toLocaleString('es'));
    add('Metadatos', 'Sexo biológico',      meta.sex        || '');
    add('Metadatos', 'Edad',               meta.age         || '', 'años');
    add('Metadatos', 'Condición/Protocolo', meta.condition  || '');
    add('Metadatos', 'Institución',         meta.institution|| '');
    add('Metadatos', 'Medicamentos',        meta.meds       || '');

    // Dominio temporal
    if (td) {
      add('Tiempo', 'N latidos',         td.n,          'latidos', '≥300 (5 min)');
      add('Tiempo', 'Duración',          td.totalDuration ? (td.totalDuration/60).toFixed(2) : '', 'min');
      add('Tiempo', 'Mean RR',           td.mean,       'ms',   '600–1000');
      add('Tiempo', 'Median RR',         td.medianRR,   'ms');
      add('Tiempo', 'Min RR',            td.minRR,      'ms');
      add('Tiempo', 'Max RR',            td.maxRR,      'ms');
      add('Tiempo', 'RR Range',          td.rrRange,    'ms');
      add('Tiempo', 'SDNN',              td.sdnn,       'ms',   '50–100');
      add('Tiempo', 'RMSSD',             td.rmssd,      'ms',   '20–50');
      add('Tiempo', 'NN50',              td.nn50,       'latidos');
      add('Tiempo', 'pNN50',             td.pnn50,      '%',    '>5–15');
      add('Tiempo', 'NN20',              td.nn20,       'latidos');
      add('Tiempo', 'pNN20',             td.pnn20,      '%',    '>30');
      add('Tiempo', 'CV',                td.cv,         '%',    '3–10');
      add('Tiempo', 'Índice Triangular', td.triIndex,   'u.a.', '≥15');
      add('Tiempo', 'FC media',          td.meanHR,     'bpm',  '60–100');
      add('Tiempo', 'SD FC',             td.sdHR,       'bpm',  '5–20');
      add('Tiempo', 'FC mínima',         td.minHR,      'bpm');
      add('Tiempo', 'FC máxima',         td.maxHR,      'bpm');
      if (td.sdann != null) add('Tiempo', 'SDANN', td.sdann, 'ms', '>40');
      if (td.sdnni != null) add('Tiempo', 'SDNNi', td.sdnni, 'ms', '>25');
    }

    // Dominio frecuencial
    if (fd) {
      add('Frecuencia', 'VLF',           fd.vlf,      'ms²', '<1500');
      add('Frecuencia', 'LF',            fd.lf,       'ms²', '500–1500');
      add('Frecuencia', 'HF',            fd.hf,       'ms²', '200–800');
      add('Frecuencia', 'Potencia Total',fd.total,    'ms²');
      add('Frecuencia', 'LF norm',       fd.lfNorm,   'n.u.','54±4');
      add('Frecuencia', 'HF norm',       fd.hfNorm,   'n.u.','29±3');
      add('Frecuencia', 'LF/HF',         fd.lfhf,     '',    '1.5–2.0');
      add('Frecuencia', 'Pico LF',       fd.lfPeakF,  'Hz',  '~0.10');
      add('Frecuencia', 'Pico HF',       fd.hfPeakF,  'Hz',  '~0.25');
    }

    // No lineal
    if (nl) {
      add('No Lineal', 'SD1',               nl.sd1,    'ms',  '15–40');
      add('No Lineal', 'SD2',               nl.sd2,    'ms',  '50–130');
      add('No Lineal', 'SD1/SD2',           nl.sd1sd2, '',    '0.25–0.50');
      add('No Lineal', 'SampEn',            nl.sampen, 'bits','1.0–2.0');
      add('No Lineal', 'ApEn',              nl.apen,   'bits','0.7–1.5');
      add('No Lineal', 'DFA α1',            nl.alpha1, '',    '0.75–1.25');
      add('No Lineal', 'DFA α2',            nl.alpha2, '',    '0.85–1.35');
      add('No Lineal', 'Dim. Correlación D2',nl.corrDim,'',  '');
    }

    // Índices compuestos
    if (comp) {
      add('Compuestos', 'CVI',                       comp.cvi,         '',    '3.5–5.0');
      add('Compuestos', 'CSI',                       comp.csi,         '',    '2.0–5.0');
      add('Compuestos', 'GSI',                       comp.gsi,         'ms',  '30–80');
      add('Compuestos', 'Índice de Estrés (Baevsky)',comp.stressIndex, 'u.a.','<150');
      add('Compuestos', 'Potencia Vagal',            comp.vagusPower,  '%',   '30–50');
      add('Compuestos', 'Potencia Simpática',        comp.symPower,    '%',   '20–45');
      add('Compuestos', 'DC',                        comp.dc,          'ms',  '>4.5');
      add('Compuestos', 'AC',                        comp.ac,          'ms',  '');
    }

    // PRSA
    if (prsa) {
      add('PRSA', 'DC (Deceleration Capacity)', prsa.DC, 'ms', '>4.5');
      add('PRSA', 'AC (Acceleration Capacity)', prsa.AC, 'ms', '');
    }

    // Ventanas de análisis — todos los índices
    for (const w of (recording.windows || [])) {
      if (!w.analysis) continue;
      const { td: wt, fd: wf, nl: wn, comp: wc } = w.analysis;
      const p = `Ventana "${w.label}"`;
      const b = `${w.analysis.beatCount ?? '?'} lat. · ${(w.analysis.durationMin ?? 0).toFixed(2)} min`;
      add(p, 'Latidos / Duración', b);
      if (wt) {
        add(p,'Mean RR',     wt.mean,     'ms'); add(p,'Mediana RR', wt.medianRR, 'ms');
        add(p,'Min RR',      wt.minRR,    'ms'); add(p,'Max RR',     wt.maxRR,    'ms');
        add(p,'SDNN',        wt.sdnn,     'ms'); add(p,'RMSSD',      wt.rmssd,    'ms');
        add(p,'NN50',        wt.nn50,  'lat.'); add(p,'pNN50',       wt.pnn50,    '%');
        add(p,'NN20',        wt.nn20,  'lat.'); add(p,'pNN20',       wt.pnn20,    '%');
        add(p,'CV',          wt.cv,       '%'); add(p,'Índice Triang.',wt.triIndex,'u.a.');
        add(p,'FC media',    wt.meanHR, 'bpm'); add(p,'FC SD',       wt.sdHR,   'bpm');
        add(p,'FC mínima',   wt.minHR,  'bpm'); add(p,'FC máxima',   wt.maxHR,  'bpm');
      }
      if (wf) {
        add(p,'VLF',         wf.vlf,   'ms²'); add(p,'LF',          wf.lf,    'ms²');
        add(p,'HF',          wf.hf,    'ms²'); add(p,'Pot. Total',   wf.total, 'ms²');
        add(p,'LF norm',     wf.lfNorm,'n.u.'); add(p,'HF norm',    wf.hfNorm,'n.u.');
        add(p,'LF/HF',       wf.lfhf,     ''); add(p,'Pico LF',    wf.lfPeakF,'Hz');
        add(p,'Pico HF',     wf.hfPeakF, 'Hz');
      }
      if (wn) {
        add(p,'SD1',         wn.sd1,   'ms'); add(p,'SD2',          wn.sd2,   'ms');
        add(p,'SD1/SD2',     wn.sd1sd2,  ''); add(p,'SampEn',       wn.sampen,'bits');
        add(p,'ApEn',        wn.apen, 'bits'); add(p,'DFA α1',       wn.alpha1,   '');
        add(p,'DFA α2',      wn.alpha2,   ''); add(p,'CorrDim D2',  wn.corrDim,  '');
      }
      if (wc) {
        add(p,'CVI',         wc.cvi,      ''); add(p,'CSI',          wc.csi,      '');
        add(p,'GSI',         wc.gsi,    'ms'); add(p,'Stress Index', wc.stressIndex,'u.a.');
        add(p,'Pot. Vagal',  wc.vagusPower,'%'); add(p,'Pot. Simpática',wc.symPower,'%');
        add(p,'DC',          wc.dc,     'ms'); add(p,'AC',            wc.ac,    'ms');
      }
    }

    const csv = rows.map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    this._download(csv, `${recording.name}_metricas_completas.csv`, 'text/csv');
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
    const format = document.getElementById('batchFormat')?.value || 'csv';
    const recs   = this._getBatchRecordings();
    if (!recs.length) { UI.notify('Sin grabaciones que coincidan', 'error'); return; }

    // Shared helper: one row object per recording or per window
    const makeRow = (r, win = null) => {
      const meta  = r.metadata || {};
      const folder= state.folders.find(f => f.id === r.folderId);
      const tags  = (r.tagIds || []).map(id => state.tags.find(t => t.id === id)?.name).filter(Boolean).join(';');
      const td    = win ? win.analysis?.td  : r.td  || {};
      const fd    = win ? win.analysis?.fd  : r.fd  || {};
      const nl    = win ? win.analysis?.nl  : r.nl  || {};
      const comp  = win ? win.analysis?.comp: r.comp || {};
      return {
        Nombre:        r.name,
        Ventana:       win ? win.label : '— Completo',
        Paciente:      meta.name || '',
        Sexo:          meta.sex  || '',
        Edad:          meta.age  || '',
        Fecha:         new Date(r.created).toLocaleDateString('es'),
        Condicion:     meta.condition || '',
        Carpeta:       folder?.name  || '',
        Etiquetas:     tags,
        N_latidos:     win ? (win.analysis?.beatCount ?? '') : (r.rrMs?.length || ''),
        Duracion_min:  td?.totalDuration ? (td.totalDuration / 60).toFixed(2) : (win?.analysis?.durationMin?.toFixed(2) ?? ''),
        MeanRR:        td?.mean,    SDNN:  td?.sdnn,  RMSSD: td?.rmssd,
        pNN50:         td?.pnn50,   pNN20: td?.pnn20, CV:    td?.cv,
        TriIndex:      td?.triIndex,FC_media: td?.meanHR,
        SD_FC:         td?.sdHR,    FC_min: td?.minHR, FC_max: td?.maxHR,
        SDANN:         td?.sdann,   SDNNi: td?.sdnni,
        VLF:           fd?.vlf,     LF:    fd?.lf,    HF:    fd?.hf,
        PotTotal:      fd?.total,   LF_norm: fd?.lfNorm, HF_norm: fd?.hfNorm,
        LF_HF:         fd?.lfhf,   Pico_LF: fd?.lfPeakF, Pico_HF: fd?.hfPeakF,
        SD1:           nl?.sd1,    SD2:    nl?.sd2,  SD1_SD2: nl?.sd1sd2,
        SampEn:        nl?.sampen, ApEn:   nl?.apen, DFA_a1: nl?.alpha1, DFA_a2: nl?.alpha2,
        CVI:           comp?.cvi,  CSI:    comp?.csi, GSI:    comp?.gsi,
        Stress_Index:  comp?.stressIndex,
        Vagus_Power:   comp?.vagusPower,  Sym_Power: comp?.symPower,
        DC:            comp?.dc,   AC:     comp?.ac
      };
    };

    // Collect all rows (recording + its windows)
    const allRows = [];
    for (const r of recs) {
      allRows.push(makeRow(r, null));
      for (const w of (r.windows || [])) {
        if (w.analysis) allRows.push(makeRow(r, w));
      }
    }

    if (format === 'csv' || format === 'csv_full') {
      const headers = Object.keys(allRows[0]);
      const csv = [headers.join(','),
        ...allRows.map(row =>
          headers.map(h => `"${row[h] ?? ''}"`).join(','))
      ].join('\n');
      const suffix = format === 'csv_full' ? '_completo' : '_resumen';
      this._download(csv, `HRVStudio_lote${suffix}.csv`, 'text/csv');

    } else if (format === 'json') {
      const data = recs.map(r => { const d = { ...r }; delete d.rawData; return d; });
      this._download(JSON.stringify(data, null, 2), 'HRVStudio_lote.json', 'application/json');
    }

    UI.notify(`Lote exportado: ${recs.length} grabación${recs.length !== 1 ? 'es' : ''} · ${allRows.length} filas`, 'success');
  },

  /** Devuelve las grabaciones que coinciden con los filtros activos en el panel de lote. */
  _getBatchRecordings() {
    const mode = document.getElementById('batchMode')?.value || 'all';
    let recs = [...state.recordings];

    if (mode === 'folder') {
      const fid = document.getElementById('batchFolder')?.value;
      if (fid) recs = recs.filter(r => r.folderId === fid);

    } else if (mode === 'individual') {
      const selected = [...document.querySelectorAll('#batchRecordingList [data-rid].selected')]
        .map(el => el.dataset.rid);
      if (selected.length) recs = recs.filter(r => selected.includes(r.id));

    } else if (mode === 'filter') {
      const sex      = document.getElementById('batchSex')?.value;
      const tagId    = document.getElementById('batchTagFilter')?.value;
      const filtFid  = document.getElementById('batchFilterFolder')?.value;
      const dateFrom = document.getElementById('batchDateFrom')?.value;
      const dateTo   = document.getElementById('batchDateTo')?.value;
      const sdnnMin  = parseFloat(document.getElementById('batchSdnnMin')?.value);
      const sdnnMax  = parseFloat(document.getElementById('batchSdnnMax')?.value);
      const beatsMin = parseFloat(document.getElementById('batchBeatsMin')?.value);

      if (sex)             recs = recs.filter(r => (r.metadata?.sex || '') === sex);
      if (tagId)           recs = recs.filter(r => (r.tagIds || []).includes(tagId));
      if (filtFid)         recs = recs.filter(r => r.folderId === filtFid);
      if (dateFrom)        recs = recs.filter(r => r.created >= new Date(dateFrom).getTime());
      if (dateTo)          recs = recs.filter(r => r.created <= new Date(dateTo).getTime() + 86399999);
      if (!isNaN(sdnnMin)) recs = recs.filter(r => (r.td?.sdnn  ?? 0)        >= sdnnMin);
      if (!isNaN(sdnnMax)) recs = recs.filter(r => (r.td?.sdnn  ?? Infinity)  <= sdnnMax);
      if (!isNaN(beatsMin))recs = recs.filter(r => (r.rrMs?.length ?? 0)      >= beatsMin);
    }
    return recs;
  },

  exportReportHTML() {
    const rec = state.currentRecording;
    if (!rec) { UI.notify('Selecciona una grabación primero', 'error'); return; }
    const html = this._buildStandaloneReportHTML(rec);
    this._download(html, `${rec.name}_reporte.html`, 'text/html');
    UI.notify('Reporte HTML exportado', 'success');
  },
  
  _buildStandaloneReportHTML(rec) {
    const m    = MathUtils.fmt;
    const meta = rec.metadata || {};
    const { td, fd, nl, comp } = rec;
    const rr   = rec.cleanRR || rec.rrMs;
    const prsa = rr && rr.length >= 120 ? NonStationary.prsa(rr) : null;
    const ls     = rr && rr.length >= 30  ? LombScargle.compute(rr, state.settings) : null;
    const wins   = rec.windows || [];
    const MI     = METRIC_INFO;
    // Precompute per-window PSD for embedded charts
    const winChartData = wins.filter(w => w.analysis).map(w => {
        const slice  = rr ? Array.from(rr.slice(w.startBeat, w.endBeat + 1)) : [];
        const wLs    = slice.length >= 30 ? LombScargle.compute(slice, state.settings) : null;
        const wt     = w.analysis.td;
        const wf     = w.analysis.fd;
        const wn     = w.analysis.nl;
        const wc     = w.analysis.comp;
        return {
          label:  w.label,  color:  w.color || '#00C2D4',
          rr:     slice.slice(0, 1000),
          psdF:   wLs ? wLs.freqs : null,
          psdP:   wLs ? wLs.psd   : null,
          vlfMin: state.settings.vlfMin, vlfMax: state.settings.vlfMax,
          lfMin:  state.settings.lfMin,  lfMax:  state.settings.lfMax,
          hfMin:  state.settings.hfMin,  hfMax:  state.settings.hfMax,
          // Metrics for the bar
          beats:  w.analysis.beatCount ?? slice.length,
          dur:    w.analysis.durationMin,
          sdnn:   wt?.sdnn,   rmssd:  wt?.rmssd,  pnn50:  wt?.pnn50,
          meanHR: wt?.meanHR, lfhf:   wf?.lfhf,   sd1:    wn?.sd1,
          sd2:    wn?.sd2,    sampen: wn?.sampen,  dc:     wc?.dc,
          lf:     wf?.lf,    hf:     wf?.hf,      lfNorm: wf?.lfNorm,
          hfNorm: wf?.hfNorm
        };
      });
    const now     = new Date().toLocaleString('es');
    const recDate = new Date(rec.created).toLocaleString('es');

    const row  = (label, val, unit, normal, interp) =>
      `<tr><td class="lc">${label}</td><td class="vc">${val ?? '—'}</td><td class="uc">${unit}</td><td class="nc">${normal}</td><td class="ic">${interp}</td></tr>`;
    const mrow = (label, val) =>
      `<tr><th>${label}</th><td ${!val ? 'class="nd"' : ''}>${val || '—'}</td></tr>`;

    return `<!DOCTYPE html>
      <html lang="es">
      <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Reporte HRV — ${rec.name}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js"></script>
      <style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Inter',system-ui,sans-serif;font-size:13px;color:#1a2535;background:#eaeff7;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      .page{max-width:980px;margin:28px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 6px 40px rgba(0,0,0,.12)}
      /* HEADER */
      .rh{background:linear-gradient(135deg,#09253f 0%,#0d3a5a 55%,#1558a0 100%);padding:32px 44px;color:#fff}
      .rh-brand{font-size:10px;font-weight:600;letter-spacing:2.8px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:10px}
      .rh-title{font-size:26px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px}
      .rh-sub{font-size:14px;color:rgba(255,255,255,.6);margin-bottom:22px;font-weight:300}
      .rh-pills{display:flex;gap:28px;flex-wrap:wrap;padding-top:16px;border-top:1px solid rgba(255,255,255,.12)}
      .rh-pill{font-size:10.5px;color:rgba(255,255,255,.5);line-height:1.8}
      .rh-pill strong{display:block;font-size:12.5px;font-weight:600;color:#fff}
      /* BODY */
      .rb{padding:36px 44px}
      /* SECTION */
      .sec{margin-bottom:32px}
      .sec-title{display:flex;align-items:center;gap:9px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#09253f;padding-bottom:8px;margin-bottom:16px;border-bottom:2px solid #d0dae9}
      .sec-title-bar{width:4px;height:15px;background:linear-gradient(180deg,#1558a0,#0d3a5a);border-radius:2px;flex-shrink:0}
      /* PATIENT GRID */
      .pt-table{width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden}
      .pt-table th{background:#f1f5fb;padding:8px 14px;font-size:11px;font-weight:600;color:#4a5e78;
        text-align:left;border:1px solid #d8e2f0;width:21%}
      .pt-table td{padding:8px 14px;font-size:12px;border:1px solid #d8e2f0;width:29%}
      .pt-table td.nd{color:#b0baca}
      /* METRICS TABLE */
      .mt{width:100%;border-collapse:collapse;font-size:12px;border:1px solid #d8e2f0;border-radius:8px;overflow:hidden}
      .mt thead tr{background:linear-gradient(90deg,#09253f,#1558a0)}
      .mt thead th{padding:10px 14px;font-size:10.5px;font-weight:600;color:#fff;text-align:left;letter-spacing:.5px}
      .mt tbody tr:nth-child(even){background:#f7fafd}
      .mt tbody tr:hover{background:#ebf2fc}
      .mt td{padding:8px 14px;border-bottom:1px solid #e8eef6;vertical-align:top;line-height:1.45}
      .mt td.lc{font-weight:500;color:#2d3f55;min-width:190px}
      .mt td.vc{font-family:'JetBrains Mono',monospace;font-weight:600;color:#1457b8;font-size:12.5px;min-width:80px}
      .mt td.uc{color:#8a9bb8;min-width:55px;font-size:11px}
      .mt td.nc{color:#257339;font-size:11px;min-width:150px}
      .mt td.ic{color:#8a5200;font-size:11px}
      .mt tbody tr:last-child td{border-bottom:none}
      /* NOTE */
      .note{background:#f0f5fc;border-left:3px solid #1558a0;padding:9px 14px;font-size:11px;color:#4a5e78;margin-top:10px;border-radius:0 6px 6px 0;line-height:1.55}
      /* FOOTER */
      .rf{background:#f1f5fb;padding:18px 44px;border-top:1px solid #d8e2f0;font-size:10.5px;color:#6a7d96;line-height:1.8}
      .rf strong{color:#4a5e78}
      /* PRINT */
      @media print{
        body{background:#fff}
        .page{box-shadow:none;border-radius:0;max-width:100%;margin:0}
        .rh,.mt thead tr{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .mt tbody tr:nth-child(even){-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .sec,.mt,.chart-wrap{break-inside:avoid}
      }
      .chart-wrap{background:#f7fafd;border:1px solid #d8e2f0;border-radius:8px;padding:14px}
      .chart-label{font-size:9.5px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#4a5e78;margin-bottom:8px}
      .ch2col{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
      .ch2col-big{display:grid;grid-template-columns:3fr 2fr;gap:14px}
      .chart-legend{font-size:9px;color:#8a9bb8;margin-bottom:6px;display:flex;gap:10px;flex-wrap:wrap}
        /* ── Section dividers ── */
        .sec-divider{margin:28px 0 20px;padding:14px 22px;
          background:linear-gradient(135deg,#09253f 0%,#0d3a5a 50%,#1558a0 100%);
          border-radius:10px;color:#fff}
        .sec-divider-title{font-size:18px;font-weight:700;letter-spacing:-.3px;margin-bottom:3px}
        .sec-divider-sub{font-size:11px;opacity:.6}
        /* ── Per-window chart cards ── */
        .win-card{margin-bottom:28px;border:1px solid #d0dae9;border-radius:12px;
          overflow:hidden;break-inside:avoid;page-break-inside:avoid;background:#fff;
          box-shadow:0 2px 10px rgba(0,0,0,.06)}
        .win-card-hdr{padding:12px 20px;display:flex;align-items:center;gap:10px;color:#fff;font-size:14px;font-weight:600}
        .win-card-hdr-dot{width:11px;height:11px;border-radius:50%;
          border:2px solid rgba(255,255,255,.5);flex-shrink:0}
        .win-card-hdr-meta{margin-left:auto;font-size:10px;font-weight:400;opacity:.65}
        .win-chart-block{padding:14px 18px;border-bottom:1px solid #eef2f8}
        .win-chart-label{font-size:8px;font-weight:700;letter-spacing:2px;
          text-transform:uppercase;color:#6a7d96;margin-bottom:8px}
        .win-chart-pair{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid #eef2f8}
        .win-chart-pair-item{padding:14px 18px}
        .win-chart-pair-item:first-child{border-right:1px solid #eef2f8}
        .win-metrics-bar{display:flex;flex-wrap:wrap;background:#f7fafd}
        .wm-item{flex:1;min-width:90px;text-align:center;padding:11px 8px;
          border-right:1px solid #eef2f8}
        .wm-item:last-child{border-right:none}
        .wm-label{font-size:8px;font-weight:700;letter-spacing:1.2px;
          text-transform:uppercase;color:#8a9bb8;margin-bottom:4px}
        .wm-val{font-family:'JetBrains Mono',monospace;font-size:18px;
          font-weight:700;color:#1457b8;line-height:1}
        .wm-unit{font-size:9px;color:#b0baca;margin-top:3px}
        .wm-nd{color:#c0cad8 !important}
        @media print{
          .win-card{break-inside:avoid;page-break-inside:avoid}
          .sec-divider{background:linear-gradient(135deg,#09253f,#1558a0)!important;
            -webkit-print-color-adjust:exact;print-color-adjust:exact}
          #sec-ii{break-before:page;page-break-before:always}
        }
        </style>
      </head>
      <body>
      <div class="page">
      
      <div class="rh">
        <div class="rh-brand">HRV Studio · Análisis de Variabilidad de la Frecuencia Cardíaca</div>
        <div class="rh-title">Reporte de Análisis HRV</div>
        <div class="rh-sub">${rec.name}</div>
        <div class="rh-pills">
          <div class="rh-pill">Generado<strong>${now}</strong></div>
          <div class="rh-pill">Grabación<strong>${recDate}</strong></div>
          <div class="rh-pill">N latidos<strong>${rr?.length ?? '—'}</strong></div>
          <div class="rh-pill">Duración<strong>${td?.totalDuration ? (td.totalDuration/60).toFixed(1)+' min' : '—'}</strong></div>
          <div class="rh-pill">Software<strong>HRV Studio v1.0</strong></div>
        </div>
      </div>
      
      <div class="rb">
      
      <div class="sec">
        <div class="sec-title"><span class="sec-title-bar"></span>Información del Sujeto / Protocolo</div>
        <table class="pt-table">
          <tbody>
            <tr>
              <th>Paciente / ID</th><td ${!meta.name?'class="nd"':''}>${meta.name||'—'}</td>
              <th>Código de estudio</th><td ${!meta.id?'class="nd"':''}>${meta.id||'—'}</td>
            </tr>
            <tr>
              <th>Fecha de nacimiento</th><td ${!meta.dob?'class="nd"':''}>${meta.dob||'—'}</td>
              <th>Sexo biológico</th><td ${!meta.sex?'class="nd"':''}>${meta.sex||'—'}</td>
            </tr>
            <tr>
              <th>Edad</th><td ${!meta.age?'class="nd"':''}>${meta.age ? meta.age+' años' : '—'}</td>
              <th>Peso / Altura</th>
              <td ${(!meta.weight&&!meta.height)?'class="nd"':''}>${meta.weight ? meta.weight+' kg' : '—'} / ${meta.height ? meta.height+' cm' : '—'}</td>
            </tr>
            <tr>
              <th>Condición / Protocolo</th><td ${!meta.condition?'class="nd"':''}>${meta.condition||'—'}</td>
              <th>Duración grabación</th>
              <td ${(!meta.duration&&!td?.totalDuration)?'class="nd"':''}>${meta.duration || (td?.totalDuration ? (td.totalDuration/60).toFixed(1)+' min' : '—')}</td>
            </tr>
            <tr>
              <th>Medicamentos</th><td colspan="3" ${!meta.meds?'class="nd"':''}>${meta.meds||'—'}</td>
            </tr>
            <tr>
              <th>Institución / Estudio</th><td colspan="3" ${!meta.institution?'class="nd"':''}>${meta.institution||'—'}</td>
            </tr>
            ${meta.notes ? `<tr><th>Notas clínicas</th><td colspan="3">${meta.notes}</td></tr>` : ''}
          </tbody>
        </table>
      </div>
      
      <div class="sec">
        <div class="sec-title"><span class="sec-title-bar"></span>Representaciones Gráficas del Análisis</div>
        <div class="ch2col">
          <div class="chart-wrap">
            <div class="chart-label">Tacograma de Intervalos RR${rr && rr.length > 2000 ? ' (primeros 2\u2009000 latidos)' : ''}</div>
            <div style="height:155px;position:relative"><canvas id="rpt-tacho"></canvas></div>
          </div>
          <div class="chart-wrap">
            <div class="chart-label">Histograma de Intervalos RR</div>
            <div style="height:155px;position:relative"><canvas id="rpt-hist"></canvas></div>
          </div>
        </div>
        <div class="ch2col-big">
          <div class="chart-wrap">
            <div class="chart-label">Densidad Espectral de Potencia — Lomb-Scargle</div>
            <div class="chart-legend">
              <span><span style="color:rgba(21,88,160,.9)">■</span> VLF (${state.settings.vlfMin}–${state.settings.vlfMax} Hz)</span>
              <span><span style="color:rgba(192,120,0,.85)">■</span> LF (${state.settings.lfMin}–${state.settings.lfMax} Hz)</span>
              <span><span style="color:rgba(20,87,184,.8)">■</span> HF (${state.settings.hfMin}–${state.settings.hfMax} Hz)</span>
            </div>
            <div style="height:170px;position:relative"><canvas id="rpt-psd"></canvas></div>
          </div>
          <div class="chart-wrap">
            <div class="chart-label">Diagrama de Poincaré — RR(n) vs RR(n+1)</div>
            <canvas id="rpt-poincare" style="display:block;width:100%;height:200px"></canvas>
          </div>
        </div>
      </div>

      ${winChartData.length ? `
      <div class="sec-divider">
        <div class="sec-divider-title">§ I — Registro Completo</div>
        <div class="sec-divider-sub">${rr?.length ?? '?'} lat. · ${td?.totalDuration ? (td.totalDuration/60).toFixed(1) : '?'} min · Análisis HRV de la grabación íntegra</div>
      </div>` : ''}

      ${td ? `<div class="sec">
        <div class="sec-title"><span class="sec-title-bar"></span>Dominio Temporal</div>
        <table class="mt">
          <thead><tr><th>Métrica</th><th>Valor</th><th>Unidad</th><th>Rango normal</th><th>Significado clínico si alterado</th></tr></thead>
          <tbody>
            ${row('Media RR', m(td.mean,1), 'ms', MI.meanRR.r, MI.meanRR.a)}
            ${row('FC media', m(td.meanHR,1), 'bpm', '60–100 bpm', 'Taquicardia >100 bpm o bradicardia <60 bpm pueden alterar interpretación de VFC')}
            ${row('FC mínima / FC máxima', m(td.minHR,1)+' / '+m(td.maxHR,1), 'bpm', '—', 'Rango estrecho: rigidez autonómica; amplio: buena reserva cronotrópica')}
            ${row('SDNN', m(td.sdnn,1), 'ms', MI.sdnn.r, MI.sdnn.a)}
            ${row('RMSSD', m(td.rmssd,1), 'ms', MI.rmssd.r, MI.rmssd.a)}
            ${row('pNN50', m(td.pnn50,1), '%', MI.pnn50.r, MI.pnn50.a)}
            ${row('NN50', td.nn50, 'latidos', 'Depende de duración', 'Interpretar como % (pNN50); valor absoluto depende de N total')}
            ${row('pNN20', m(td.pnn20,1), '%', MI.pnn20.r, MI.pnn20.a)}
            ${row('CV (Coef. de variación)', m(td.cv,2), '%', MI.cv.r, MI.cv.a)}
            ${row('Índice Triangular HRV', m(td.triIndex,1), 'u.a.', MI.triIndex.r, MI.triIndex.a)}
            ${row('RR mínimo / RR máximo', td.minRR+' / '+td.maxRR, 'ms', '—', 'Valores extremos: posibles ectopias o artefactos; revisar tachograma')}
            ${row('SD de FC', m(td.sdHR,1), 'bpm', '5–20 bpm', 'Alto: gran variabilidad; bajo: FC rígida')}
            ${td.sdann != null ? row('SDANN', m(td.sdann,1), 'ms', MI.sdann.r, MI.sdann.a) : ''}
            ${td.sdnni != null ? row('SDNNi', m(td.sdnni,1), 'ms', MI.sdnni.r, MI.sdnni.a) : ''}
            ${row('N latidos total', td.n, 'latidos', '≥ 300 (5 min)', 'Grabaciones cortas reducen fiabilidad de todos los índices')}
          </tbody>
        </table>
      </div>` : ''}
      
      ${fd ? `<div class="sec">
        <div class="sec-title"><span class="sec-title-bar"></span>Dominio Frecuencial — Periodograma de Lomb-Scargle (no paramétrico)</div>
        <table class="mt">
          <thead><tr><th>Banda / Métrica</th><th>Valor</th><th>Unidad</th><th>Rango normal</th><th>Significado clínico si alterado</th></tr></thead>
          <tbody>
            ${row('VLF (0.003–0.04 Hz)', fd.vlf, 'ms²', MI.vlf.r, MI.vlf.a)}
            ${row('LF (0.04–0.15 Hz)', fd.lf, 'ms²', MI.lf.r, MI.lf.a)}
            ${row('HF (0.15–0.4 Hz)', fd.hf, 'ms²', MI.hf.r, MI.hf.a)}
            ${row('Potencia Total (VLF+LF+HF)', fd.total, 'ms²', '—', 'Correlaciona con SDNN²; representa variabilidad global')}
            ${row('LF normalizada', m(fd.lfNorm,1), 'n.u.', MI.lfNorm.r, MI.lfNorm.a)}
            ${row('HF normalizada', m(fd.hfNorm,1), 'n.u.', MI.hfNorm.r, MI.hfNorm.a)}
            ${row('Ratio LF/HF', m(fd.lfhf,3), '—', MI.lfhf.r, MI.lfhf.a)}
            ${row('Frecuencia pico LF', fd.lfPeakF, 'Hz', MI.lfPeakF.r, MI.lfPeakF.a)}
            ${row('Frecuencia pico HF', fd.hfPeakF, 'Hz', MI.hfPeakF.r, MI.hfPeakF.a)}
          </tbody>
        </table>
      </div>` : ''}
      
      ${nl ? `<div class="sec">
        <div class="sec-title"><span class="sec-title-bar"></span>Análisis No Lineal</div>
        <table class="mt">
          <thead><tr><th>Métrica</th><th>Valor</th><th>Unidad</th><th>Rango normal</th><th>Significado clínico si alterado</th></tr></thead>
          <tbody>
            ${row('SD1 — Poincaré (corto plazo)', m(nl.sd1,1), 'ms', MI.sd1.r, MI.sd1.a)}
            ${row('SD2 — Poincaré (largo plazo)', m(nl.sd2,1), 'ms', MI.sd2.r, MI.sd2.a)}
            ${row('SD1/SD2', m(nl.sd1sd2,3), '—', MI.sd1sd2.r, MI.sd1sd2.a)}
            ${row('SampEn (Entropía Muestral)', nl.sampen != null ? m(nl.sampen,4) : '—', 'bits', MI.sampen.r, MI.sampen.a)}
            ${row('ApEn (Entropía Aproximada)', nl.apen != null ? m(nl.apen,4) : '—', 'bits', MI.apen.r, MI.apen.a)}
            ${nl.alpha1 != null ? row('DFA α1 (escala corta, 4–16 lat.)', m(nl.alpha1,4), '—', MI.alpha1.r, MI.alpha1.a) : ''}
            ${nl.alpha2 != null ? row('DFA α2 (escala larga, 16–64 lat.)', m(nl.alpha2,4), '—', MI.alpha2.r, MI.alpha2.a) : ''}
            ${nl.corrDim != null ? row('Dimensión de Correlación D2', m(nl.corrDim,3), '—', MI.corrDim.r, MI.corrDim.a) : ''}
          </tbody>
        </table>
        <div class="note">Parámetros: SampEn/ApEn m=${state.settings.sampEnM}, r=${state.settings.sampEnR}×SDNN. DFA calculado según Peng et al. (1995). Correlation Dimension por método de Grassberger-Procaccia.</div>
      </div>` : ''}
      
      ${comp ? `<div class="sec">
        <div class="sec-title"><span class="sec-title-bar"></span>Índices Compuestos y Balance Autonómico</div>
        <table class="mt">
          <thead><tr><th>Índice</th><th>Valor</th><th>Unidad</th><th>Rango normal</th><th>Significado clínico si alterado</th></tr></thead>
          <tbody>
            ${comp.cvi != null ? row('CVI — Cardiac Vagal Index', m(comp.cvi,3), '—', MI.cvi.r, MI.cvi.a) : ''}
            ${comp.csi != null ? row('CSI — Cardiac Sympathetic Index', m(comp.csi,2), '—', MI.csi.r, MI.csi.a) : ''}
            ${comp.gsi != null ? row('GSI — Índice Geométrico Simpato-Vagal', m(comp.gsi,1), 'ms', MI.gsi.r, MI.gsi.a) : ''}
            ${comp.stressIndex != null ? row('Índice de Estrés (Baevsky)', m(comp.stressIndex,2), 'u.a.', MI.stressIndex.r, MI.stressIndex.a) : ''}
            ${comp.vagusPower != null ? row('Potencia Vagal (% espectral)', m(comp.vagusPower,1), '%', MI.vagusPower.r, MI.vagusPower.a) : ''}
            ${comp.symPower != null ? row('Potencia Simpática (% espectral)', m(comp.symPower,1), '%', MI.symPower.r, MI.symPower.a) : ''}
            ${comp.dc != null ? row('DC — Capacidad de Desaceleración', m(comp.dc,2), 'ms', MI.dc.r, MI.dc.a) : ''}
            ${comp.ac != null ? row('AC — Capacidad de Aceleración', m(comp.ac,2), 'ms', MI.ac.r, MI.ac.a) : ''}
          </tbody>
        </table>
      </div>` : ''}
      
      ${prsa ? `<div class="sec">
        <div class="sec-title"><span class="sec-title-bar"></span>PRSA — Phase-Rectified Signal Averaging (Bauer et al. 2006)</div>
        <table class="mt">
          <thead><tr><th>Índice</th><th>Valor</th><th>Unidad</th><th>Rango normal</th><th>Significado clínico si alterado</th></tr></thead>
          <tbody>
            ${row('DC — Capacidad de Desaceleración', m(prsa.DC,2), 'ms', MI.dc.r, MI.dc.a)}
            ${row('AC — Capacidad de Aceleración', m(prsa.AC,2), 'ms', MI.ac.r, MI.ac.a)}
          </tbody>
        </table>
        <div class="note">L = ${prsa.L} latidos. DC &gt; 4.5 ms indica actividad vagal preservada. Predictor independiente de mortalidad cardíaca súbita (HR 5.6× si DC &lt; 2.5 ms, Bauer et al. Lancet 2006).</div>
      </div>` : ''}

      ${winChartData.length ? `
      <div id="sec-ii" class="sec-divider">
        <div class="sec-divider-title">§ II — Análisis por Ventanas</div>
        <div class="sec-divider-sub">${winChartData.length} ventana${winChartData.length!==1?'s':''} · Tacograma · Poincaré · PSD y estadísticos por segmento</div>
      </div>
      <div id="win-charts-container"></div>` : ''}

      ${IO._buildWindowsReportSection(wins, true)}
      
      </div>
      
      <div class="rf">
        <strong>Referencias:</strong>
        Task Force ESC/NASPE (1996) <em>Eur Heart J</em> 17:354–381 ·
        Peng CK et al. (1995) <em>Chaos</em> 5:82 ·
        Bauer A et al. (2006) <em>Lancet</em> 367:1674–1681 ·
        Richman JS &amp; Moorman JR (2000) <em>Am J Physiol</em> 278:H2039.<br>
        <strong>Aviso:</strong> Reporte generado automáticamente por HRV Studio v1.0 para fines informativos e investigación.
        Los rangos de referencia son orientativos; la interpretación clínica debe considerar protocolo, duración del registro, edad, sexo y contexto del sujeto. No substituye criterio médico profesional.
      </div>
      
      </div>
      <script id="hrv-chart-data" type="application/json">${JSON.stringify({
        rr:       rr ? Array.from(rr.slice(0, 2000)) : [],
        psdF:     ls ? ls.freqs : null,
        psdP:     ls ? ls.psd   : null,
        vlfMin:   state.settings.vlfMin, vlfMax: state.settings.vlfMax,
        lfMin:    state.settings.lfMin,  lfMax:  state.settings.lfMax,
        hfMin:    state.settings.hfMin,  hfMax:  state.settings.hfMax,
        winData:  winChartData
      })}</script>
      <script>
      (function(){
        var D;
        try { D=JSON.parse(document.getElementById('hrv-chart-data').textContent); } catch(e){ return; }
        var C={a:'#1457b8',s:'#c07800',g:'#e8eef6',t:'#8a9bb8'};
        var BF={family:'JetBrains Mono,monospace',size:9};
        function ax(sx,sy){
          return {responsive:true,maintainAspectRatio:false,animation:false,
            plugins:{legend:{display:false},tooltip:{enabled:false}},
            scales:{
              x:Object.assign({grid:{color:C.g,lineWidth:.5},ticks:{color:C.t,font:BF,maxTicksLimit:8}},sx||{}),
              y:Object.assign({grid:{color:C.g,lineWidth:.5},ticks:{color:C.t,font:BF}},sy||{})
            }};
        }
        document.addEventListener('DOMContentLoaded',function(){
          try{rTacho();}   catch(e){}
          try{rHist();}    catch(e){}
          try{rPSD();}     catch(e){}
          try{rPoincare();}catch(e){}
        });
        function rTacho(){
          var el=document.getElementById('rpt-tacho');
          if(!el||!D.rr.length||typeof Chart==='undefined') return;
          new Chart(el,{type:'line',
            data:{labels:D.rr.map(function(_,i){return i+1;}),
              datasets:[{data:D.rr,borderColor:C.a,borderWidth:1.2,pointRadius:0,fill:false,tension:0}]},
            options:ax(
              {title:{display:true,text:'Latido #',color:C.t,font:{size:9}}},
              {title:{display:true,text:'RR (ms)',color:C.t,font:{size:9}}})});
        }
        function rHist(){
          var el=document.getElementById('rpt-hist');
          if(!el||!D.rr.length||typeof Chart==='undefined') return;
          var bW=20,mn=Math.floor(Math.min.apply(null,D.rr)/bW)*bW;
          var mx=Math.ceil(Math.max.apply(null,D.rr)/bW)*bW;
          var bins={};
          for(var b=mn;b<=mx;b+=bW) bins[b]=0;
          D.rr.forEach(function(v){ var b=Math.floor(v/bW)*bW; if(bins[b]!==undefined)bins[b]++; });
          new Chart(el,{type:'bar',
            data:{labels:Object.keys(bins),
              datasets:[{data:Object.values(bins),backgroundColor:C.a+'AA',borderColor:C.a,borderWidth:1,barPercentage:1,categoryPercentage:1}]},
            options:ax(
              {title:{display:true,text:'RR (ms)',color:C.t,font:{size:9}},ticks:{color:C.t,font:BF,maxTicksLimit:10}},
              {title:{display:true,text:'N',color:C.t,font:{size:9}}})});
        }
        function rPSD(){
          var el=document.getElementById('rpt-psd');
          if(!el||!D.psdF||!D.psdP||typeof Chart==='undefined') return;
          var bg=D.psdF.map(function(f){
            if(f>=D.vlfMin&&f<D.vlfMax) return'rgba(21,88,160,.55)';
            if(f>=D.lfMin &&f<D.lfMax)  return'rgba(192,120,0,.55)';
            if(f>=D.hfMin &&f<D.hfMax)  return'rgba(20,87,184,.45)';
            return'rgba(100,120,150,.1)';
          });
          new Chart(el,{type:'bar',
            data:{labels:D.psdF.map(function(f){return f.toFixed(3);}),
              datasets:[{data:D.psdP,backgroundColor:bg,borderColor:'transparent',borderWidth:0,barPercentage:1.2,categoryPercentage:1}]},
            options:ax(
              {title:{display:true,text:'Frecuencia (Hz)',color:C.t,font:{size:9}},ticks:{color:C.t,font:BF,maxTicksLimit:8}},
              {title:{display:true,text:'ms\u00B2/Hz',color:C.t,font:{size:9}}})});
        }
        function rPoincare(){
          var cv=document.getElementById('rpt-poincare');
          if(!cv||!D.rr.length) return;
          var W=cv.offsetWidth||250,H=cv.offsetHeight||200;
          cv.width=W; cv.height=H;
          var ctx=cv.getContext('2d'),pad=26;
          var mn=Math.min.apply(null,D.rr)*.97,mx=Math.max.apply(null,D.rr)*1.03;
          var sX=function(v){return pad+(v-mn)/(mx-mn)*(W-2*pad);};
          var sY=function(v){return H-pad-(v-mn)/(mx-mn)*(H-2*pad);};
          ctx.fillStyle='#f7fafd'; ctx.fillRect(0,0,W,H);
          ctx.strokeStyle='#d8e2f0'; ctx.lineWidth=.5;
          ctx.beginPath(); ctx.moveTo(pad,pad); ctx.lineTo(pad,H-pad);
          ctx.moveTo(pad,H-pad); ctx.lineTo(W-pad,H-pad); ctx.stroke();
          ctx.strokeStyle='rgba(192,120,0,.3)'; ctx.setLineDash([4,4]); ctx.lineWidth=.8;
          ctx.beginPath(); ctx.moveTo(sX(mn),sY(mn)); ctx.lineTo(sX(mx),sY(mx)); ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle='rgba(20,87,184,.42)';
          var pts=Math.min(D.rr.length-1,900);
          for(var i=0;i<pts;i++){ctx.beginPath();ctx.arc(sX(D.rr[i]),sY(D.rr[i+1]),1.8,0,6.283);ctx.fill();}
          ctx.fillStyle=C.t; ctx.font='9px JetBrains Mono,monospace'; ctx.textAlign='center';
          ctx.fillText('RR(n)',W/2,H-3);
          ctx.save(); ctx.translate(10,H/2); ctx.rotate(-1.5708); ctx.fillText('RR(n+1)',0,0); ctx.restore();
        }
        // ── Per-window chart rendering ──────────────────────────────────────
        function fmtN(v, d) { return (v == null || isNaN(v)) ? '—' : (+v).toFixed(d || 1); }

        function buildWinCharts() {
          var container = document.getElementById('win-charts-container');
          if (!container || !D.winData || !D.winData.length || typeof Chart === 'undefined') return;

          D.winData.forEach(function(w, wi) {
            if (!w.rr || !w.rr.length) return;
            var hasPSD = !!(w.psdF && w.psdF.length);

            // ── Metrics bar definition ─────────────────────────────────────
            var kMetrics = [
              { label:'SDNN',     val: fmtN(w.sdnn,  1), unit:'ms'   },
              { label:'RMSSD',    val: fmtN(w.rmssd, 1), unit:'ms'   },
              { label:'pNN50',    val: fmtN(w.pnn50, 1), unit:'%'    },
              { label:'LF/HF',    val: fmtN(w.lfhf,  2), unit:'ratio'},
              { label:'SD1',      val: fmtN(w.sd1,   1), unit:'ms'   },
              { label:'SampEn',   val: fmtN(w.sampen,2), unit:'bits' }
            ];

            // ── Build card HTML ────────────────────────────────────────────
            var card = document.createElement('div');
            card.className = 'win-card';

            // Header
            var hdr = document.createElement('div');
            hdr.className = 'win-card-hdr';
            hdr.style.background = 'linear-gradient(135deg,#09253f 0%,' + w.color + ' 100%)';
            hdr.innerHTML =
              '<span class="win-card-hdr-dot" style="background:' + w.color + '"></span>' +
              '<span>' + w.label + '</span>' +
              '<span class="win-card-hdr-meta">' +
                (w.beats || w.rr.length) + ' lat. · ' +
                fmtN(w.dur, 2) + ' min' +
              '</span>';
            card.appendChild(hdr);

            // Row 1: full-width tacogram
            var tacBlock = document.createElement('div');
            tacBlock.className = 'win-chart-block';
            tacBlock.innerHTML =
              '<div class="win-chart-label">Tacograma de Intervalos RR</div>' +
              '<div style="position:relative;height:175px"><canvas id="rwt-' + wi + '"></canvas></div>';
            card.appendChild(tacBlock);

            // Row 2: Poincaré + PSD side by side
            var pair = document.createElement('div');
            pair.className = 'win-chart-pair';
            pair.innerHTML =
              '<div class="win-chart-pair-item">' +
                '<div class="win-chart-label">Diagrama de Poincaré — RR(n) vs RR(n+1)</div>' +
                '<canvas id="rwp-' + wi + '" style="display:block;width:100%;height:220px"></canvas>' +
              '</div>' +
              '<div class="win-chart-pair-item">' +
                '<div class="win-chart-label">Densidad Espectral de Potencia (Lomb-Scargle)' +
                  (hasPSD ? '' : ' — datos insuficientes') + '</div>' +
                (hasPSD
                  ? '<div style="position:relative;height:220px"><canvas id="rwf-' + wi + '"></canvas></div>'
                  : '<div style="height:220px;display:flex;align-items:center;justify-content:center;' +
                      'font-size:11px;color:#b0baca">&lt; 30 latidos requeridos para PSD</div>'
                ) +
              '</div>';
            card.appendChild(pair);

            // Row 3: metrics bar
            var mBar = document.createElement('div');
            mBar.className = 'win-metrics-bar';
            mBar.innerHTML = kMetrics.map(function(m) {
              var isNd = m.val === '—';
              return '<div class="wm-item">' +
                '<div class="wm-label">' + m.label + '</div>' +
                '<div class="wm-val' + (isNd ? ' wm-nd' : '') + '">' + m.val + '</div>' +
                '<div class="wm-unit">' + (isNd ? '—' : m.unit) + '</div>' +
              '</div>';
            }).join('');
            card.appendChild(mBar);

            container.appendChild(card);
          });

          // Render all charts after DOM elements exist
          requestAnimationFrame(function() {
            D.winData.forEach(function(w, wi) {
              if (!w.rr || !w.rr.length) return;
              try { rWinTacho(wi, w); }    catch(e) { console.warn('win tacho', e); }
              try { rWinPoincare(wi, w); } catch(e) { console.warn('win poincaré', e); }
              if (w.psdF && w.psdF.length)
                try { rWinPSD(wi, w); }    catch(e) { console.warn('win psd', e); }
            });
          });
        }
        buildWinCharts();

        function rWinTacho(wi, w) {
          var el = document.getElementById('rwt-' + wi);
          if (!el) return;
          new Chart(el, {
            type: 'line',
            data: {
              labels: w.rr.map(function(_, i) { return i + 1; }),
              datasets: [{
                data: w.rr, borderColor: w.color, borderWidth: 1.3,
                pointRadius: 0, fill: false, tension: 0
              }]
            },
            options: Object.assign({}, ax(
              { title: { display: true, text: 'Latido #', color: C.t, font: { size: 9 } } },
              { title: { display: true, text: 'RR (ms)', color: C.t, font: { size: 9 } } }
            ), {
              plugins: { legend: { display: false }, tooltip: {
                enabled: true, backgroundColor: '#fff',
                borderColor: '#d8e2f0', borderWidth: 1,
                titleColor: '#1a2535', bodyColor: '#4a5e78', padding: 6,
                callbacks: {
                  title: function(ctx) { return 'Latido #' + ctx[0].dataIndex; },
                  label: function(ctx) { return 'RR: ' + Math.round(ctx.raw) + ' ms'; }
                }
              }}
            })
          });
        }

        function rWinPoincare(wi, w) {
          var cv = document.getElementById('rwp-' + wi);
          if (!cv) return;
          // Use physical pixel dimensions for crisp rendering
          var W = cv.parentElement.offsetWidth || 320;
          var H = 220;
          var dpr = window.devicePixelRatio || 1;
          cv.width  = W * dpr;
          cv.height = H * dpr;
          cv.style.width  = W + 'px';
          cv.style.height = H + 'px';
          var ctx2 = cv.getContext('2d');
          ctx2.scale(dpr, dpr);

          var pad = 28;
          var pW  = W - 2 * pad, pH = H - 2 * pad;
          var mn  = Math.min.apply(null, w.rr) * 0.97;
          var mx  = Math.max.apply(null, w.rr) * 1.03;
          var sX  = function(v) { return pad + (v - mn) / (mx - mn) * pW; };
          var sY  = function(v) { return H - pad - (v - mn) / (mx - mn) * pH; };

          ctx2.fillStyle = '#f7fafd';
          ctx2.fillRect(0, 0, W, H);

          // Grid
          ctx2.strokeStyle = '#e8eef6'; ctx2.lineWidth = 0.5;
          for (var gi = 0; gi <= 4; gi++) {
            var gx = pad + gi / 4 * pW;
            var gy = pad + gi / 4 * pH;
            ctx2.beginPath(); ctx2.moveTo(gx, pad); ctx2.lineTo(gx, H - pad); ctx2.stroke();
            ctx2.beginPath(); ctx2.moveTo(pad, gy); ctx2.lineTo(W - pad, gy); ctx2.stroke();
          }

          // Identity line (RR(n) = RR(n+1))
          ctx2.strokeStyle = 'rgba(192,120,0,.25)'; ctx2.lineWidth = 1; ctx2.setLineDash([4, 4]);
          ctx2.beginPath(); ctx2.moveTo(sX(mn), sY(mn)); ctx2.lineTo(sX(mx), sY(mx)); ctx2.stroke();
          ctx2.setLineDash([]);

          // Points
          var pts = Math.min(w.rr.length - 1, 700);
          ctx2.fillStyle = (w.color || '#1457b8') + '60';
          for (var pi = 0; pi < pts; pi++) {
            ctx2.beginPath();
            ctx2.arc(sX(w.rr[pi]), sY(w.rr[pi + 1]), 2.2, 0, 6.2832);
            ctx2.fill();
          }

          // Axis labels
          ctx2.fillStyle = '#8a9bb8'; ctx2.font = '9px JetBrains Mono,monospace';
          ctx2.textAlign = 'center';
          ctx2.fillText('RR(n) — ms', W / 2, H - 4);
          ctx2.save(); ctx2.translate(10, H / 2); ctx2.rotate(-Math.PI / 2);
          ctx2.fillText('RR(n+1) — ms', 0, 0); ctx2.restore();

          // Tick labels
          ctx2.fillStyle = '#b0baca'; ctx2.font = '8px JetBrains Mono,monospace';
          ctx2.textAlign = 'right';
          for (var ti = 0; ti <= 4; ti++) {
            var tv = mn + ti / 4 * (mx - mn);
            ctx2.fillText(Math.round(tv), pad - 3, sY(tv) + 3);
          }
          ctx2.textAlign = 'center';
          for (var ti2 = 0; ti2 <= 4; ti2++) {
            var tv2 = mn + ti2 / 4 * (mx - mn);
            ctx2.fillText(Math.round(tv2), sX(tv2), H - pad + 11);
          }
        }

        function rWinPSD(wi, w) {
          var el = document.getElementById('rwf-' + wi);
          if (!el) return;
          var bg = w.psdF.map(function(f) {
            if (f >= w.vlfMin && f < w.vlfMax) return 'rgba(21,88,160,.60)';
            if (f >= w.lfMin  && f < w.lfMax)  return 'rgba(192,120,0,.60)';
            if (f >= w.hfMin  && f < w.hfMax)  return 'rgba(20,87,184,.50)';
            return 'rgba(100,120,150,.12)';
          });
          new Chart(el, {
            type: 'bar',
            data: {
              labels: w.psdF.map(function(f) { return f.toFixed(3); }),
              datasets: [{
                data: w.psdP, backgroundColor: bg,
                borderColor: 'transparent', borderWidth: 0,
                barPercentage: 1.2, categoryPercentage: 1
              }]
            },
            options: Object.assign({}, ax(
              { title: { display: true, text: 'Frecuencia (Hz)', color: C.t, font: { size: 9 } },
                ticks: { color: C.t, font: BF, maxTicksLimit: 6 } },
              { title: { display: true, text: 'ms²/Hz', color: C.t, font: { size: 9 } } }
            ), { plugins: { legend: { display: false }, tooltip: {
              enabled: true, backgroundColor: '#fff',
              borderColor: '#d8e2f0', borderWidth: 1, padding: 5,
              titleColor: '#1a2535', bodyColor: '#4a5e78',
              callbacks: {
                title: function(ctx) { return w.psdF[ctx[0].dataIndex].toFixed(4) + ' Hz'; },
                label: function(ctx) { return ctx.raw.toFixed(4) + ' ms²/Hz'; }
              }
            }}})
          });
        }
      })();
      </script>
      </body>
      </html>`;
  },
  
  /** Genera la sección HTML de comparativa por ventanas de análisis.
   *  @param {object[]} wins      – recording.windows
   *  @param {boolean}  standalone – true → clases CSS del reporte exportado
   */
  _buildWindowsReportSection(wins, standalone = true) {
    const valid = (wins || []).filter(w => w.analysis);
    if (!valid.length) return '';
    const m = MathUtils.fmt;
    const s = standalone;

    const thS  = s ? `style="padding:8px 12px;background:linear-gradient(90deg,#09253f,#1558a0);color:#fff;font-size:10.5px;font-weight:600;text-align:left;border:1px solid #c0cfe0"` : `style="background:var(--card2);padding:7px 10px;font-size:11px;color:var(--text-dim);text-align:left;border:1px solid var(--border)"`;
    const tdS  = s ? `style="padding:7px 12px;border:1px solid #d8e2f0;font-size:11px;color:#2d3f55;font-weight:500;white-space:nowrap"` : `style="padding:6px 10px;border:1px solid var(--border);font-size:11px;color:var(--text)"`;
    const unitS= s ? `style="padding:7px 12px;border:1px solid #d8e2f0;font-size:10px;color:#8a9bb8"` : `style="padding:6px 10px;border:1px solid var(--border);font-size:10px;color:var(--text-muted)"`;
    const vcS  = s ? `style="padding:7px 12px;border:1px solid #d8e2f0;font-family:'JetBrains Mono',monospace;font-size:11.5px;color:#1457b8;font-weight:600;text-align:right"` : `style="padding:6px 10px;border:1px solid var(--border);font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--accent);text-align:right"`;
    const dotS = c => `display:inline-block;width:9px;height:9px;border-radius:50%;background:${c};margin-right:5px;vertical-align:middle`;

    const secClass   = s ? 'class="sec"' : 'class="report-section"';
    const titleClass = s ? 'class="sec-title"' : 'class="report-section-title"';
    const titleBar   = s ? '<span class="sec-title-bar"></span>' : '';
    const noteStyle  = s ? `style="background:#f0f5fc;border-left:3px solid #1558a0;padding:8px 12px;font-size:10.5px;color:#4a5e78;margin-top:10px;border-radius:0 6px 6px 0"` : `style="font-size:10px;color:var(--text-muted);margin-top:8px"`;

    // Metric rows: [label, unit, getter(w)]
    const metrics = [
      // Time domain
      ['N latidos',       'lat.',  w => w.analysis.beatCount ?? (w.endBeat - w.startBeat)],
      ['Duración',        'min',   w => m(w.analysis.durationMin, 2)],
      ['Mean RR',         'ms',    w => m(w.analysis.td?.mean, 1)],
      ['Mediana RR',      'ms',    w => w.analysis.td?.medianRR ?? '—'],
      ['Min RR',          'ms',    w => w.analysis.td?.minRR ?? '—'],
      ['Max RR',          'ms',    w => w.analysis.td?.maxRR ?? '—'],
      ['SDNN',            'ms',    w => m(w.analysis.td?.sdnn, 1)],
      ['RMSSD',           'ms',    w => m(w.analysis.td?.rmssd, 1)],
      ['pNN50',           '%',     w => m(w.analysis.td?.pnn50, 1)],
      ['pNN20',           '%',     w => m(w.analysis.td?.pnn20, 1)],
      ['NN50',            'lat.',  w => w.analysis.td?.nn50 ?? '—'],
      ['CV',              '%',     w => m(w.analysis.td?.cv, 2)],
      ['Índice Triang.',  'u.a.',  w => m(w.analysis.td?.triIndex, 1)],
      ['FC media',        'bpm',   w => m(w.analysis.td?.meanHR, 1)],
      ['FC SD',           'bpm',   w => m(w.analysis.td?.sdHR, 1)],
      ['FC mínima',       'bpm',   w => m(w.analysis.td?.minHR, 1)],
      ['FC máxima',       'bpm',   w => m(w.analysis.td?.maxHR, 1)],
      // Frequency
      ['VLF (ms²)',       'ms²',   w => w.analysis.fd?.vlf    ?? '—'],
      ['LF (ms²)',        'ms²',   w => w.analysis.fd?.lf     ?? '—'],
      ['HF (ms²)',        'ms²',   w => w.analysis.fd?.hf     ?? '—'],
      ['Pot. Total',      'ms²',   w => w.analysis.fd?.total  ?? '—'],
      ['LF norm',         'n.u.',  w => m(w.analysis.fd?.lfNorm, 1)],
      ['HF norm',         'n.u.',  w => m(w.analysis.fd?.hfNorm, 1)],
      ['LF/HF',           '',      w => m(w.analysis.fd?.lfhf, 3)],
      ['Pico LF',         'Hz',    w => w.analysis.fd?.lfPeakF ?? '—'],
      ['Pico HF',         'Hz',    w => w.analysis.fd?.hfPeakF ?? '—'],
      // Non-linear
      ['SD1 (Poincaré)',  'ms',    w => m(w.analysis.nl?.sd1, 1)],
      ['SD2 (Poincaré)',  'ms',    w => m(w.analysis.nl?.sd2, 1)],
      ['SD1/SD2',         '',      w => m(w.analysis.nl?.sd1sd2, 3)],
      ['SampEn',          'bits',  w => m(w.analysis.nl?.sampen, 3)],
      ['ApEn',            'bits',  w => m(w.analysis.nl?.apen, 3)],
      ['DFA α1',          '',      w => m(w.analysis.nl?.alpha1, 3)],
      ['DFA α2',          '',      w => m(w.analysis.nl?.alpha2, 3)],
      ['CorrDim D2',      '',      w => m(w.analysis.nl?.corrDim, 2)],
      // Composite
      ['CVI',             '',      w => m(w.analysis.comp?.cvi, 3)],
      ['CSI',             '',      w => m(w.analysis.comp?.csi, 2)],
      ['GSI',             'ms',    w => m(w.analysis.comp?.gsi, 1)],
      ['Stress Index',    'u.a.',  w => m(w.analysis.comp?.stressIndex, 2)],
      ['Pot. Vagal',      '%',     w => m(w.analysis.comp?.vagusPower, 1)],
      ['Pot. Simpática',  '%',     w => m(w.analysis.comp?.symPower, 1)],
      ['DC',              'ms',    w => m(w.analysis.comp?.dc, 2)],
      ['AC',              'ms',    w => m(w.analysis.comp?.ac, 2)],
    ];

    const headerRow = `<tr>
      <th ${thS}>Métrica</th><th ${thS}>Unidad</th>
      ${valid.map(w => `<th ${thS}>
        ${w.color ? `<span style="${dotS(w.color)}"></span>` : ''}${w.label}
        <span style="font-size:9px;font-weight:400;opacity:.65;display:block">
          ${w.analysis.beatCount ?? '?'} lat. · ${m(w.analysis.durationMin, 1)} min
        </span>
      </th>`).join('')}
    </tr>`;

    const dataRows = metrics.map(([label, unit, getter], ri) =>
      `<tr ${ri % 2 === 0 ? `style="background:${s ? '#f7fafd' : 'var(--card2)'}"` : ''}>
        <td ${tdS}>${label}</td>
        <td ${unitS}>${unit}</td>
        ${valid.map(w => `<td ${vcS}>${getter(w) ?? '—'}</td>`).join('')}
      </tr>`
    ).join('');

    return `
      <div ${secClass}>
        <div ${titleClass}>${titleBar}ANÁLISIS COMPARATIVO POR VENTANAS TEMPORALES</div>
        <p ${noteStyle}>
          ${valid.length} ventana${valid.length!==1?'s':''} definida${valid.length!==1?'s':''}.
          Comparativa completa de todos los índices calculados entre segmentos del registro.
        </p>
        <div style="overflow-x:auto;margin-top:10px">
          <table style="width:100%;border-collapse:collapse;min-width:${300 + valid.length * 100}px">
            <thead>${headerRow}</thead>
            <tbody>${dataRows}</tbody>
          </table>
        </div>
      </div>`;
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
    el.innerHTML = state.tags.map(t => {
      const isActive = state.filters.tags.some(f => String(f) === String(t.id));
      return `<span class="tag-chip ${isActive ? 'active' : ''}"
        onclick="App.toggleTagFilter('${t.id}')"
        style="${isActive ? `border-color:${t.color};color:${t.color};background:${t.color}22` : ''}">
        ${t.name}
      </span>`;
    }).join('');
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
    if (state.filters.tags.length) {
      const activeTagStrs = state.filters.tags.map(t => String(t));
      recs = recs.filter(r =>
        activeTagStrs.some(tid => (r.tagIds || []).some(rid => String(rid) === tid))
      );
    }

    // Sort
    const sort = state.filters.sortBy;
    if (sort === 'date-desc') recs.sort((a, b) => b.created - a.created);
    else if (sort === 'date-asc') recs.sort((a, b) => a.created - b.created);
    else if (sort === 'name-asc') recs.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'sdnn-desc') recs.sort((a, b) => (b.td?.sdnn || 0) - (a.td?.sdnn || 0));

    // Tag filter bar
    const tfBar = document.getElementById('tagFilterBar');
    if (tfBar) tfBar.innerHTML = state.tags.slice(0, 6).map(t => {
      const isActive = state.filters.tags.some(f => String(f) === String(t.id));
      return `<span class="tag-chip ${isActive ? 'active' : ''}"
        onclick="App.toggleTagFilter('${t.id}')">
        ${t.name}
      </span>`;
    }).join('');

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
                  return `<div class="window-chip ${isAct ? 'active' : ''}" data-wid="${w.id}"
                      style="${isAct ? `border-color:${w.color};background:${w.color}18` : ''}"
                      onclick="WindowMgr.setActive('${w.id}')">
                    <span class="window-chip-dot" style="background:${w.color}"></span>
                    <span class="window-chip-label" title="Doble clic para renombrar"
                      ondblclick="event.stopPropagation();WindowMgr.startRename('${w.id}')">${w.label}</span>
                    <span class="window-chip-meta">${beats}L·${dur}m</span>
                    <button class="btn btn-secondary btn-icon-only"
                      style="width:18px;height:18px;font-size:9px;flex-shrink:0;margin-right:2px"
                      onclick="event.stopPropagation();WindowMgr.startRename('${w.id}',event)"
                      title="Renombrar">✏</button>
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
        onclick="UI.restoreFullRecording()">← Completo</button>
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
      const wins = WindowMgr.getAll();
      const fmt  = MathUtils.fmt;

      // Build unified segment list: windows if defined, else auto-split
      let segs;
      if (wins.length) {
        segs = wins.map(w => {
          const seg  = rr.slice(w.startBeat, w.endBeat + 1);
          const td   = w.analysis?.td   || HRV.timeDomain(seg);
          const fd   = w.analysis?.fd   || HRV.frequencyDomain(seg);
          const nl   = w.analysis?.nl   || HRV.nonLinear(seg);
          const comp = w.analysis?.comp || HRV.composite(td, fd, nl, seg);
          return {
            label: w.label, color: w.color,
            beatCount:   w.analysis?.beatCount   ?? seg.length,
            durationMin: w.analysis?.durationMin ?? MathUtils.sum(seg) / 60000,
            td, fd, nl, comp
          };
        });
      } else {
        segs = NonStationary.autoSegment(rr, 3).map(s => ({
          ...s, color: null,
          beatCount: s.end - s.start,
          comp: HRV.composite(s.td, s.fd, s.nl, rr.slice(s.start, s.end))
        }));
      }

      // Metric rows definition: [label, unit, getter]
      const metricRows = [
        // Time domain
        ['N latidos',       'lat.',  s => s.beatCount ?? '—'],
        ['Duración',        'min',   s => fmt(s.durationMin, 2)],
        ['Mean RR',         'ms',    s => fmt(s.td?.mean, 1)],
        ['Mediana RR',      'ms',    s => s.td?.medianRR ?? '—'],
        ['Min RR',          'ms',    s => s.td?.minRR ?? '—'],
        ['Max RR',          'ms',    s => s.td?.maxRR ?? '—'],
        ['SDNN',            'ms',    s => fmt(s.td?.sdnn, 1)],
        ['RMSSD',           'ms',    s => fmt(s.td?.rmssd, 1)],
        ['pNN50',           '%',     s => fmt(s.td?.pnn50, 1)],
        ['pNN20',           '%',     s => fmt(s.td?.pnn20, 1)],
        ['NN50',            'lat.',  s => s.td?.nn50 ?? '—'],
        ['CV',              '%',     s => fmt(s.td?.cv, 2)],
        ['Índice Triang.',  'u.a.',  s => fmt(s.td?.triIndex, 1)],
        ['FC media',        'bpm',   s => fmt(s.td?.meanHR, 1)],
        ['FC SD',           'bpm',   s => fmt(s.td?.sdHR, 1)],
        ['FC mínima',       'bpm',   s => fmt(s.td?.minHR, 1)],
        ['FC máxima',       'bpm',   s => fmt(s.td?.maxHR, 1)],
        // Frequency
        ['VLF',             'ms²',   s => s.fd?.vlf   ?? '—'],
        ['LF',              'ms²',   s => s.fd?.lf    ?? '—'],
        ['HF',              'ms²',   s => s.fd?.hf    ?? '—'],
        ['Pot. Total',      'ms²',   s => s.fd?.total ?? '—'],
        ['LF norm',         'n.u.',  s => fmt(s.fd?.lfNorm, 1)],
        ['HF norm',         'n.u.',  s => fmt(s.fd?.hfNorm, 1)],
        ['LF/HF',           '',      s => fmt(s.fd?.lfhf, 3)],
        ['Pico LF',         'Hz',    s => s.fd?.lfPeakF ?? '—'],
        ['Pico HF',         'Hz',    s => s.fd?.hfPeakF ?? '—'],
        // Non-linear
        ['SD1',             'ms',    s => fmt(s.nl?.sd1, 1)],
        ['SD2',             'ms',    s => fmt(s.nl?.sd2, 1)],
        ['SD1/SD2',         '',      s => fmt(s.nl?.sd1sd2, 3)],
        ['SampEn',          'bits',  s => fmt(s.nl?.sampen, 3)],
        ['ApEn',            'bits',  s => fmt(s.nl?.apen, 3)],
        ['DFA α1',          '',      s => fmt(s.nl?.alpha1, 3)],
        ['DFA α2',          '',      s => fmt(s.nl?.alpha2, 3)],
        // Composite
        ['CVI',             '',      s => fmt(s.comp?.cvi, 3)],
        ['CSI',             '',      s => fmt(s.comp?.csi, 2)],
        ['GSI',             'ms',    s => fmt(s.comp?.gsi, 1)],
        ['Stress Index',    'u.a.',  s => fmt(s.comp?.stressIndex, 2)],
        ['Pot. Vagal',      '%',     s => fmt(s.comp?.vagusPower, 1)],
        ['Pot. Simpática',  '%',     s => fmt(s.comp?.symPower, 1)],
        ['DC',              'ms',    s => fmt(s.comp?.dc, 2)],
        ['AC',              'ms',    s => fmt(s.comp?.ac, 2)],
      ];

      const dotH = s => s.color
        ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;
            background:${s.color};margin-right:5px;vertical-align:middle"></span>`
        : '';

      el.innerHTML = `
        <div style="padding:10px 14px">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:10px">
            ${wins.length
              ? `Usando <strong>${wins.length} ventana${wins.length!==1?'s':''}</strong> definidas en el tacograma — todos los índices`
              : 'División automática en 3 segmentos iguales (define ventanas para personalizar)'}
          </div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:320px">
              <thead>
                <tr>
                  <th style="padding:5px 10px;background:var(--card2);border:1px solid var(--border);
                    font-weight:600;color:var(--text-dim);text-align:left;position:sticky;left:0;
                    white-space:nowrap;min-width:120px">Métrica</th>
                  <th style="padding:5px 8px;background:var(--card2);border:1px solid var(--border);
                    color:var(--text-muted);font-size:10px;white-space:nowrap">Unidad</th>
                  ${segs.map(s =>
                    `<th style="padding:5px 10px;background:var(--card2);border:1px solid var(--border);
                      color:${s.color || 'var(--text-dim)'};font-weight:600;text-align:right;white-space:nowrap">
                      ${dotH(s)}${s.label}</th>`
                  ).join('')}
                </tr>
              </thead>
              <tbody>
                ${metricRows.map(([label, unit, getter], ri) =>
                  `<tr style="${ri % 2 === 0 ? 'background:var(--card2)' : ''}">
                    <td style="padding:4px 10px;border:1px solid var(--border);font-weight:500;
                      color:var(--text);position:sticky;left:0;
                      background:${ri % 2 === 0 ? 'var(--card2)' : 'var(--card)'};">${label}</td>
                    <td style="padding:4px 8px;border:1px solid var(--border);
                      color:var(--text-muted);font-size:10px">${unit}</td>
                    ${segs.map(s =>
                      `<td style="padding:4px 10px;border:1px solid var(--border);
                        font-family:'JetBrains Mono',monospace;color:var(--accent);
                        text-align:right">${getter(s) ?? '—'}</td>`
                    ).join('')}
                  </tr>`
                ).join('')}
              </tbody>
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
        <div class="mp-header open" onclick="this.classList.toggle('open')">
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
  
  restoreFullRecording() {
    state.activeWindowId = null;
    this.renderAnalysisMetrics(state.currentRecording);
    this.renderWindowsPanel(); // clear chip highlight
    const rr = state.currentRecording?.cleanRR || state.currentRecording?.rrMs;
    if (rr) {
      requestAnimationFrame(() => {
        Charts.renderHistogram(rr);
        Charts.renderDiffHist(rr);
        Charts.renderPSD(null, rr);
        Charts.renderPoincare(rr, state.currentRecording.td);
        Charts.renderInteractiveTachogram(rr, WindowMgr.getAll(), null);
      });
    }
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

      ${IO._buildWindowsReportSection(rec.windows || [], false)}

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
  
  updateBatchFilters() {
    const mode = document.getElementById('batchMode')?.value || 'all';
    const show = (id, v) => { const el = document.getElementById(id); if (el) el.style.display = v ? '' : 'none'; };
    show('batchFolderGroup',     mode === 'folder');
    show('batchIndividualGroup', mode === 'individual');
    show('batchFilterGroup',     mode === 'filter');

    if (mode === 'folder') {
      const sel = document.getElementById('batchFolder');
      if (sel) sel.innerHTML = state.folders.length
        ? state.folders.map(f =>
            `<option value="${f.id}">${f.name} (${state.recordings.filter(r => r.folderId === f.id).length})</option>`
          ).join('')
        : '<option value="">Sin carpetas definidas</option>';
    }
    if (mode === 'individual') {
      const list = document.getElementById('batchRecordingList');
      if (list) list.innerHTML = state.recordings.length
        ? state.recordings.map(r =>
            `<div style="padding:6px 10px;cursor:pointer;border-bottom:1px solid var(--border);font-size:12px;transition:background 0.1s"
              data-rid="${r.id}" onclick="UI._toggleBatchRec(this)">
              📋 ${r.name}
              <span style="color:var(--text-muted)"> · ${r.td?.sdnn ?? '?'} ms SDNN · ${r.rrMs?.length ?? '?'} lat.</span>
            </div>`).join('')
        : '<div style="padding:10px;color:var(--text-muted);font-size:12px">Sin grabaciones</div>';
    }
    if (mode === 'filter') {
      const tagSel = document.getElementById('batchTagFilter');
      if (tagSel) tagSel.innerHTML = '<option value="">Cualquier etiqueta</option>' +
        state.tags.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
      const foldSel = document.getElementById('batchFilterFolder');
      if (foldSel) foldSel.innerHTML = '<option value="">Todas las carpetas</option>' +
        state.folders.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    }
    this._updateBatchPreview();
  },

  _toggleBatchRec(el) {
    el.classList.toggle('selected');
    el.style.background = el.classList.contains('selected') ? 'var(--accent-glow)' : '';
    el.style.color      = el.classList.contains('selected') ? 'var(--accent)' : '';
    this._updateBatchPreview();
  },

  _updateBatchPreview() {
    const el = document.getElementById('batchPreview');
    if (!el) return;
    const recs = IO._getBatchRecordings();
    el.textContent = recs.length
      ? `${recs.length} grabación${recs.length !== 1 ? 'es' : ''} seleccionada${recs.length !== 1 ? 's' : ''} para exportar`
      : 'Sin grabaciones que coincidan con los filtros actuales';
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
      // Show welcome popup for first-time users
      try {
        if (!localStorage.getItem('hrv_welcomed')) {
          setTimeout(() => UI.openModal('welcomeModal'), 600);
        }
      } catch {}
    } catch(e) {
      console.error('Init error:', e);
      UI.notify('Error inicializando base de datos', 'error');
    }
  },

  async loadAll() {
    await this.loadFolders();    // must precede renderLibrary
    await this.loadTags();       // must precede renderLibrary (tag filter bar)
    await this.loadRecordings(); // renderLibrary now has full state.tags + state.folders
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
      UI.updateBatchFilters(); // Rellena listas y preview con el estado actual
    }
  },

  goHome() { this.switchView('library'); },

  selectRecording(id) {
    const rec = state.recordings.find(r => r.id === id);
    if (!rec) return;
    // Always recompute fd and comp fresh — prevents NaN from DB-stored stale spectral data
    const rr = rec.cleanRR || rec.rrMs;
    if (rr) {
      rec.fd   = HRV.frequencyDomain(rr);
      rec.comp = HRV.composite(rec.td, rec.fd, rec.nl);
    }
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
    const tid = String(tagId);
    const idx = state.filters.tags.findIndex(t => String(t) === tid);
    if (idx >= 0) state.filters.tags.splice(idx, 1);
    else state.filters.tags.push(tid);
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
  
  closeWelcome() {
    if (document.getElementById('welcomeDontShow')?.checked) {
      try { localStorage.setItem('hrv_welcomed', '1'); } catch {}
    }
    UI.closeModal('welcomeModal');
  },

  bindEvents() {
    // Close modals on overlay click
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });

    // Clean chart events — delegated on #content because canvas is re-created on view switch
    document.getElementById('content').addEventListener('click', e => {
      if (e.target.id === 'cleanChart') Clean.handleCleanClick(e);
    });
    document.getElementById('content').addEventListener('mousedown', e => {
      if (e.target.id === 'cleanChart') Clean.handleCleanMouseDown(e);
    });
    // mousemove / mouseup must be on document to capture drag outside canvas bounds
    document.addEventListener('mousemove', e => {
      if (state.cleanMode === 'range' && Clean._rangeStart) Clean.handleCleanMouseMove(e);
    });
    document.addEventListener('mouseup', e => {
      if (state.cleanMode === 'range') Clean.handleCleanMouseUp(e);
    });
    
    // ── Global drag-drop anywhere on the window ──────────────────────────────
    let _dragCnt = 0;
    const _ov    = document.getElementById('dropOverlay');
    window.addEventListener('dragenter', e => {
      if (![...( e.dataTransfer?.items || [])].some(i => i.kind === 'file')) return;
      if (++_dragCnt === 1 && _ov) _ov.style.display = 'flex';
    });
    window.addEventListener('dragleave', () => {
      if (--_dragCnt <= 0) { _dragCnt = 0; if (_ov) _ov.style.display = 'none'; }
    });
    window.addEventListener('dragover', e => e.preventDefault());
    window.addEventListener('drop', e => {
      e.preventDefault();
      _dragCnt = 0;
      if (_ov) _ov.style.display = 'none';
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      // Don't re-open if already inside the import drop zone (handled by IO.drop)
      if (e.target.closest?.('#importDrop')) return;
      UI.openImport();
      requestAnimationFrame(() => IO.handleFile(file));
    });

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
      let html = '';
      if (icon.dataset.metric) {
        const info = METRIC_INFO[icon.dataset.metric];
        if (!info) return;
        html =
          `<strong style="font-size:12px;color:var(--accent)">${info.n}</strong>` +
          `<div style="color:var(--text-dim);margin:4px 0;line-height:1.4">${info.d}</div>` +
          `<hr style="border:none;border-top:1px solid var(--border);margin:5px 0">` +
          `<div style="color:var(--text-muted);font-size:10px">📐 ${info.c}</div>` +
          `<div style="color:var(--success);font-size:10px">✓ Normal: ${info.r}</div>` +
          `<div style="color:var(--warning);font-size:10px">⚠ Alterado: ${info.a}</div>`;
      } else if (icon.dataset.clean) {
        const info = CLEAN_INFO[icon.dataset.clean];
        if (!info) return;
        html =
          `<strong style="font-size:12px;color:var(--secondary)">${info.n}</strong>` +
          `<div style="color:var(--text-dim);margin:4px 0;line-height:1.4;white-space:pre-line">${info.d}</div>` +
          `<hr style="border:none;border-top:1px solid var(--border);margin:5px 0">` +
          `<div style="color:var(--success);font-size:10px">✓ ${info.r}</div>` +
          `<div style="color:var(--info);font-size:10px">✅ ${info.pros}</div>` +
          `<div style="color:var(--warning);font-size:10px">⚠ ${info.cons}</div>`;
      } else { return; }
      _infoTip.innerHTML = html;
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

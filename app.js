'use strict';
/* =========================================================
   CÁLCULO INTEGRAL 3D — CYBER DASHBOARD
   El motor matemático está en calculo.js (window.Calculo) y el conteo de dedos en gestos.js
   (window.Gestos); así se pueden probar sin navegador (ver tests/).
   ========================================================= */

const $ = (id) => document.getElementById(id);

// ==========================================
// 0. ESTADO GLOBAL
// ==========================================
let modoActual = 'exploracion';     // 'exploracion' | 'arcade'
let racha = 0;
let puntos = 0;
let preguntaActual = null;
let indicePregunta = -1;
let respondido = false;
let timeoutPregunta = null;
let juegoPausado = false;           // Arcade en pausa por inactividad

let gestoActual = 1;                // último cálculo proyectado (null = pantalla limpia)
let prevGestoHablado = 1;           // evita repetir la voz (y hablar al cargar la página)

const TIEMPO_CONFIRMACION = 1000;   // ms que hay que sostener un gesto para confirmarlo
const TIEMPO_INACTIVIDAD = 12000;   // ms sin mano ni mouse/teclado para limpiar (o pausar el Arcade)
const TIEMPO_AVISO = 3000;          // cuenta regresiva visible antes de limpiar
const TAM_BUFFER = 6;
let bufferDedos = [];
let gestoCandidato = null;
let inicioCandidato = 0;
let bloqueoHasta = 0;               // en Arcade: ignora gestos justo después de una pregunta
let ultimaActividad = performance.now();
let dedosPrevios = null;            // estado de cada dedo en el cuadro anterior (histéresis)
const memoriaManos = { voto: 0 };   // suaviza la etiqueta derecha/izquierda de MediaPipe

const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Mover el mouse, hacer clic o escribir también cuenta como actividad
['pointermove', 'pointerdown', 'keydown'].forEach((ev) => {
  window.addEventListener(ev, () => { ultimaActividad = performance.now(); }, { passive: true });
});

// ==========================================
// 1. ORBE HOLOGRÁFICO DORADO (reutilizable: fondo y cámara)
// ==========================================
class Orbe {
  constructor({ marco = true, vineta = false, chispasMax = 60 } = {}) {
    this.marco = marco;
    this.vineta = vineta;
    this.chispasMax = chispasMax;
  }

  redimensionar(w, h, nPuntos) {
    this.w = w;
    this.h = h;
    this.cx = w / 2;
    this.cy = h / 2;
    this.R = Math.min(w, h) * 0.38;
    this.escala = this.R / 250;

    this.puntos = Array.from({ length: nPuntos }, () => {
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      return { x: s * Math.cos(t), y: u, z: s * Math.sin(t), tam: Math.random() * 1.6 + 0.4 };
    });
    this.anillos = Array.from({ length: 9 }, (_, i) => ({
      radio: 0.7 + i * 0.055 + Math.random() * 0.02,
      inicio: Math.random() * Math.PI * 2,
      largo: Math.PI * (0.3 + Math.random() * 1.2),
      vel: (Math.random() * 0.004 + 0.001) * (i % 2 ? 1 : -1),
      grosor: (Math.random() * 2.5 + 0.5) * Math.max(this.escala, 0.5),
      alpha: Math.random() * 0.4 + 0.4,
      punteado: Math.random() < 0.35
    }));
    this.chispas = [];
  }

  dibujar(ctx, t, alpha = 1) {
    const { cx, cy, R } = this;
    const k = Math.max(this.escala, 0.4);
    const animar = !reducirMovimiento;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';

    const pulso = 1 + 0.06 * Math.sin(t * 0.002);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.9 * pulso);
    g.addColorStop(0, 'rgba(255, 210, 110, 0.8)');
    g.addColorStop(0.25, 'rgba(255, 140, 20, 0.35)');
    g.addColorStop(1, 'rgba(255, 90, 0, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R * pulso, 0, Math.PI * 2);
    ctx.fill();

    const ay = t * 0.00025, ax = 0.35;
    const cA = Math.cos(ay), sA = Math.sin(ay), cB = Math.cos(ax), sB = Math.sin(ax);
    const rEsfera = R * 0.62;
    for (const p of this.puntos) {
      const x = p.x * cA + p.z * sA;
      let z = -p.x * sA + p.z * cA;
      const y = p.y * cB - z * sB;
      z = p.y * sB + z * cB;
      const prof = (z + 1) / 2;
      ctx.fillStyle = `rgba(255, ${(150 + prof * 80) | 0}, 60, ${0.15 + prof * 0.75})`;
      ctx.beginPath();
      ctx.arc(cx + x * rEsfera, cy + y * rEsfera, p.tam * (0.5 + prof) * Math.max(k, 0.6), 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(255, 140, 20, 0.9)';
    ctx.shadowBlur = 10 * k;
    for (const a of this.anillos) {
      if (animar) a.inicio += a.vel;
      ctx.strokeStyle = `rgba(255, 170, 60, ${a.alpha})`;
      ctx.lineWidth = a.grosor;
      ctx.setLineDash(a.punteado ? [2 * k, 6 * k] : []);
      ctx.beginPath();
      ctx.arc(cx, cy, R * a.radio, a.inicio, a.inicio + a.largo);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;

    const nTicks = 120, rt = R * 1.22;
    ctx.strokeStyle = 'rgba(255, 170, 60, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < nTicks; i++) {
      const ang = (i / nTicks) * Math.PI * 2 - t * 0.00005;
      const largo = (i % 10 === 0 ? 12 : 5) * k;
      ctx.moveTo(cx + Math.cos(ang) * rt, cy + Math.sin(ang) * rt);
      ctx.lineTo(cx + Math.cos(ang) * (rt + largo), cy + Math.sin(ang) * (rt + largo));
    }
    ctx.stroke();

    if (animar) {
      if (this.chispas.length < this.chispasMax && Math.random() < 0.4) {
        const ang = Math.random() * Math.PI * 2;
        const v = (0.3 + Math.random()) * k;
        this.chispas.push({ x: cx + Math.cos(ang) * rEsfera, y: cy + Math.sin(ang) * rEsfera,
                            vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, vida: 1 });
      }
      for (const c of this.chispas) {
        c.x += c.vx;
        c.y += c.vy;
        c.vida -= 0.012;
      }
      this.chispas = this.chispas.filter((c) => c.vida > 0);
    }
    for (const c of this.chispas) {
      ctx.fillStyle = `rgba(255, 190, 90, ${c.vida * 0.8})`;
      ctx.fillRect(c.x, c.y, 2 * k, 2 * k);
    }

    if (this.marco) {
      ctx.strokeStyle = 'rgba(255, 170, 60, 0.3)';
      ctx.lineWidth = 1.5;
      const m = R * 1.28, l = R * 0.15;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.moveTo(cx + sx * m, cy + sy * (m - l));
        ctx.lineTo(cx + sx * m, cy + sy * m);
        ctx.lineTo(cx + sx * (m - l), cy + sy * m);
        ctx.stroke();
      }
    }
    ctx.restore();

    if (this.vineta) {
      const v = ctx.createRadialGradient(cx, cy, R * 0.8, cx, cy, Math.max(this.w, this.h) * 0.75);
      v.addColorStop(0, 'rgba(13, 14, 18, 0)');
      v.addColorStop(1, 'rgba(13, 14, 18, 0.85)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, this.w, this.h);
    }
  }
}

// ---------- Orbe de fondo ----------
const pCanvas = $('particles-canvas');
const pCtx = pCanvas.getContext('2d');
const ALPHA_FONDO = 0.5;
const orbeFondo = new Orbe({ marco: true, vineta: true, chispasMax: 60 });

function resizePCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  pCanvas.width = w * dpr;
  pCanvas.height = h * dpr;
  pCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  orbeFondo.redimensionar(w, h, w < 700 ? 300 : 600);
}

function animarFondo(t) {
  pCtx.clearRect(0, 0, orbeFondo.w, orbeFondo.h);
  orbeFondo.dibujar(pCtx, reducirMovimiento ? 0 : t, ALPHA_FONDO);
  if (!reducirMovimiento) requestAnimationFrame(animarFondo);
}

window.addEventListener('resize', () => {
  resizePCanvas();
  if (reducirMovimiento) animarFondo(0);
});
resizePCanvas();
requestAnimationFrame(animarFondo);

// ==========================================
// 2. SINTETIZADOR DE VOZ
// ==========================================
let finHabla = 0;                   // cuándo terminó de hablar la app (el micrófono ignora ese lapso)

function hablar(texto) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(texto);
  const vozEs = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('es'));
  if (vozEs) utterance.voice = vozEs;
  utterance.lang = vozEs ? vozEs.lang : 'es-ES';
  utterance.rate = 1.0;
  utterance.onend = utterance.onerror = () => { finHabla = performance.now(); };
  window.speechSynthesis.speak(utterance);
}

// ==========================================
// 3. MOTOR MATEMÁTICO (calculo.js) Y ANÁLISIS NUMÉRICO
// ==========================================
const METODOS = Calculo.METODOS;
const linspace = Calculo.linspace;
const fmt = Calculo.formatear;
const aNull = (v) => (Number.isFinite(v) ? v : null);   // Plotly deja un hueco donde hay null

function formatoError(e) {
  if (!Number.isFinite(e)) return '—';
  return e === 0 ? '0' : e.toExponential(1);
}

function sumaPorTramos(g, a, b, cortes, regla) {
  const pts = Calculo.puntosTramos(a, b, cortes);
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) s += regla(pts[i], pts[i + 1]);
  return s;
}

// Tabla comparativa de métodos y gráfica de convergencia. "referencia" es el valor verificado con el
// método adaptativo (o tanh-sinh si la integral es impropia).
function renderAnalisis(g, lo, hi, cortes, metodoUsado, referencia) {
  const card = $('analisis-card');
  if (!Number.isFinite(referencia) || typeof Plotly === 'undefined') { card.hidden = true; return; }

  const tbody = $('tabla-metodos').querySelector('tbody');
  tbody.innerHTML = '';
  for (const [clave, m] of Object.entries(METODOS)) {
    // sin respaldo: si un método no puede con la integral (impropia), se ve "—" en vez de copiar otro
    const r = Calculo.integrar(g, lo, hi, clave, cortes, { respaldo: false });
    const tr = document.createElement('tr');
    if (clave === metodoUsado) tr.className = 'activo';
    [m.corto, Number.isFinite(r.valor) ? r.valor.toFixed(6) : '—', formatoError(r.error)]
      .forEach((txt) => { const td = document.createElement('td'); td.textContent = txt; tr.appendChild(td); });
    tbody.appendChild(tr);
  }

  // Convergencia: error real vs n, en escala log-log (con el integrando "seguro" para que una
  // singularidad removible en un extremo, como en la esfera, no deje la gráfica vacía)
  const gs = Calculo.integrandoSeguro(g, hi - lo).g;
  const ns = [4, 8, 16, 32, 64, 128, 256, 512];
  const errTrap = ns.map((n) => Math.abs(sumaPorTramos(gs, lo, hi, cortes, (x0, x1) => Calculo.trapecio(gs, x0, x1, n)) - referencia));
  const errSimp = ns.map((n) => Math.abs(sumaPorTramos(gs, lo, hi, cortes, (x0, x1) => Calculo.simpson(gs, x0, x1, n)) - referencia));
  const sinCero = (arr) => arr.map((e) => (Number.isFinite(e) ? Math.max(e, 1e-16) : null));
  const lay = layout2D();
  lay.showlegend = true;
  lay.legend = { orientation: 'h', y: 1.25, font: { size: 9 } };
  lay.height = 150;
  lay.font = { ...lay.font, size: 10 };
  lay.margin = { l: 45, r: 10, t: 18, b: 30 };
  lay.xaxis = { ...lay.xaxis, title: { text: 'n' }, type: 'log' };
  lay.yaxis = { ...lay.yaxis, title: { text: 'error' }, type: 'log', exponentformat: 'power' };
  // Si los dos métodos ya son exactos (p. ej. f constante), la gráfica solo mostraría ruido de redondeo
  const maxErr = Math.max(0, ...[...errTrap, ...errSimp].filter(Number.isFinite));
  if (maxErr < 1e-12 * Math.max(1, Math.abs(referencia))) {
    lay.yaxis.range = [-17, -10];
    lay.annotations = [{ text: 'Error al nivel del redondeo:<br>ambas reglas son exactas aquí', x: 0.5, y: 0.5,
                         xref: 'paper', yref: 'paper', showarrow: false, font: { color: '#ffb703', size: 10 } }];
  }
  Plotly.react('convergencia-holder', [
    { x: ns, y: sinCero(errTrap), name: 'Trapecio', mode: 'lines+markers', line: { color: '#ff0055' } },
    { x: ns, y: sinCero(errSimp), name: 'Simpson', mode: 'lines+markers', line: { color: '#00adb5' } }
  ], lay, PLOT_CONFIG);
  card.hidden = false;
}

// ==========================================
// 4. RENDERIZADO PLOTLY 2D / 3D NEÓN
// ==========================================
const PLOT_CONFIG = { responsive: true, displaylogo: false };

// Cada gráfica se ajusta sola cuando cambia el tamaño de su contenedor (p. ej. al aparecer la tarjeta)
if (typeof ResizeObserver !== 'undefined') {
  const ajustar = (id) => {
    const el = $(id);
    if (!el) return;
    new ResizeObserver(() => {
      if (el.data && typeof Plotly !== 'undefined') Plotly.Plots.resize(el);
    }).observe(el);
  };
  ['plot-holder', 'convergencia-holder', 'lab-plot', 'lab-convergencia'].forEach(ajustar);
}

const INFO = {
  1: { titulo: 'Área Bajo la Curva', unidad: 'u²', voz: 'unidades cuadradas',
       formula: '∫[a,b] f(x) dx (con signo) · A = ∫[a,b] |f(x)| dx (área)', uso: 'Producción total acumulada en planta.' },
  2: { titulo: 'Volumen Sólido Eje X (Discos)', unidad: 'u³', voz: 'unidades cúbicas',
       formula: 'V = π ∫[a,b] [f(x)]² dx', uso: 'Capacidad de tanques y depósitos.' },
  3: { titulo: 'Volumen Sólido Eje Y (Capas)', unidad: 'u³', voz: 'unidades cúbicas',
       formula: 'V = 2π ∫ r · h(r) dr  (si a ≥ 0: 2π ∫[a,b] x · |f(x)| dx)', uso: 'Capacidad de silos verticales.' },
  4: { titulo: 'Área Superficial 3D', unidad: 'u²', voz: 'unidades cuadradas',
       formula: 'S = 2π ∫[a,b] |f(x)| √(1 + [f′(x)]²) dx', uso: 'Material de recubrimiento y pintura.' },
  5: { titulo: 'Longitud de Arco', unidad: 'u', voz: 'unidades',
       formula: 'L = ∫[a,b] √(1 + [f′(x)]²) dx', uso: 'Longitud de bandas transportadoras.' }
};

const CONTEXTOS = {
  prod: {
    nombre: 'Tasa de producción',
    recomendado: 1,
    sugerencia: '☝️ 1 dedo (producción total)',
    pista: 'f(x) = piezas por hora, x = horas del turno. Muestra ☝️ 1 dedo: el área bajo la curva es el total de piezas producidas en 8 horas.',
    gestos: {
      1: { titulo: 'Producción total del turno', unidad: 'piezas', voz: 'piezas', decimales: 0,
           uso: 'Piezas fabricadas en el turno de 8 horas (integral de la tasa de producción).',
           extra: (v, a, b) => ` Promedio: ${(v / (b - a)).toFixed(1)} piezas por hora.` }
    }
  },
  cilindro: {
    nombre: 'Tanque cilíndrico',
    recomendado: 2,
    sugerencia: '✌️ 2 dedos (capacidad) o 4 dedos (material del costado)',
    pista: 'Tanque de radio 2 m y largo 5 m acostado sobre el eje x. Muestra ✌️ 2 dedos para su capacidad o 4 dedos para el material del costado.',
    gestos: {
      2: { titulo: 'Capacidad del tanque', unidad: 'm³', voz: 'metros cúbicos', decimales: 2,
           uso: 'Volumen del tanque cilíndrico.',
           extra: (v) => ` Comprobación con V = πr²h = π·2²·5 = ${(Math.PI * 20).toFixed(2)} m³ ✔ (${(v * 1000).toFixed(0)} litros).` },
      4: { titulo: 'Lámina del costado del tanque', unidad: 'm²', voz: 'metros cuadrados', decimales: 2,
           uso: 'Material para el costado curvo del tanque, sin contar las dos tapas.',
           extra: () => ` Comprobación con A = 2πrh = 2π·2·5 = ${(Math.PI * 20).toFixed(2)} m² ✔. Con tapas: ${(Math.PI * 28).toFixed(2)} m².` }
    }
  },
  tanque: {
    nombre: 'Depósito parabólico',
    recomendado: 2,
    sugerencia: '✌️ 2 dedos (capacidad) o 4 dedos (material)',
    pista: 'Depósito con forma de paraboloide: radio 2 m en la boca y 4 m de largo. Muestra ✌️ 2 dedos para su capacidad o 4 dedos para el material de su pared.',
    gestos: {
      2: { titulo: 'Capacidad del depósito', unidad: 'm³', voz: 'metros cúbicos', decimales: 2,
           uso: 'Volumen del depósito parabólico.',
           extra: (v) => ` Equivale a ${(v * 1000).toFixed(0)} litros; es la mitad de un cilindro del mismo radio y largo.` },
      4: { titulo: 'Material de la pared del depósito', unidad: 'm²', voz: 'metros cuadrados', decimales: 2,
           uso: 'Superficie curva del depósito (lámina necesaria, sin la tapa de la boca).' }
    }
  },
  banda: {
    nombre: 'Banda transportadora curva',
    recomendado: 5,
    sugerencia: '🖐️ 5 dedos (longitud de la banda)',
    pista: 'Banda que sube y baja entre 1 m y 3 m de altura a lo largo de 6.28 m horizontales. Muestra 🖐️ 5 dedos para saber cuánta banda se necesita.',
    gestos: {
      5: { titulo: 'Longitud de la banda', unidad: 'm', voz: 'metros', decimales: 2,
           uso: 'Banda necesaria para seguir la ondulación del recorrido.',
           extra: (v, a, b) => ` En línea recta serían ${(b - a).toFixed(2)} m: la curva exige ${(v - (b - a)).toFixed(2)} m más (${((v / (b - a) - 1) * 100).toFixed(0)} %).` }
    }
  }
};

const PISTA_PERSONALIZADO = 'Función libre: los cinco gestos calculan en unidades genéricas (u).';

function actualizarPistaPreset() {
  const c = CONTEXTOS[$('preset-select').value];
  $('preset-hint').textContent = c ? c.pista : PISTA_PERSONALIZADO;
}

function layout2D() {
  const eje = (t) => ({ title: { text: t }, gridcolor: 'rgba(46, 50, 64, 0.6)', zerolinecolor: '#00adb5' });
  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#ffffff', family: 'Segoe UI, sans-serif' },
    margin: { l: 50, r: 20, t: 20, b: 45 },
    showlegend: false,
    xaxis: eje('x'),
    yaxis: eje('f(x)')
  };
}

// Rango vertical a partir de los valores dentro de [a, b] (más el 0): una asíntota fuera del intervalo
// ya no aplasta la gráfica
function rangoVertical(valores, margen = 0.15) {
  const finitos = valores.filter(Number.isFinite);
  if (!finitos.length) return undefined;
  let lo = Math.min(0, ...finitos), hi = Math.max(0, ...finitos);
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * margen;
  return [lo - pad, hi + pad];
}

function lineasLimites(a, b) {
  const linea = (x) => ({ type: 'line', xref: 'x', yref: 'paper', x0: x, x1: x, y0: 0, y1: 1,
                          line: { color: 'rgba(255, 183, 3, 0.55)', width: 1, dash: 'dot' } });
  const etiqueta = (x, t) => ({ x, y: 1, xref: 'x', yref: 'paper', text: t, showarrow: false,
                                font: { color: '#ffb703', size: 13 }, yanchor: 'top', xanchor: 'left', xshift: 4 });
  return { shapes: [linea(a), linea(b)], annotations: [etiqueta(a, 'a'), etiqueta(b, 'b')] };
}

// Cámara 3D controlada por la mano de rotación (coordenadas esféricas)
const RADIO_CAM = Math.hypot(1.6, 1.6, 1.0);
let camAzimut = Math.atan2(1.6, 1.6);
let camElevacion = Math.asin(1.0 / RADIO_CAM);

function ojoCamara() {
  const c = Math.cos(camElevacion);
  return {
    x: RADIO_CAM * c * Math.cos(camAzimut),
    y: RADIO_CAM * c * Math.sin(camAzimut),
    z: RADIO_CAM * Math.sin(camElevacion)
  };
}

// Si el usuario gira con el mouse, guardamos ese ángulo para que la mano continúe desde ahí
function sincronizarCamara(ev) {
  const eye = ev && ev['scene.camera'] && ev['scene.camera'].eye;
  if (!eye) return;
  const r = Math.hypot(eye.x, eye.y, eye.z);
  if (!r) return;
  camAzimut = Math.atan2(eye.y, eye.x);
  camElevacion = Math.asin(eye.z / r);
}

// Proporciones reales para que los círculos del sólido se vean redondos (con un mínimo, para que un
// sólido muy largo no quede como una línea)
function proporciones(trazas) {
  const rango = { x: [Infinity, -Infinity], y: [Infinity, -Infinity], z: [Infinity, -Infinity] };
  for (const t of trazas) {
    for (const eje of ['x', 'y', 'z']) {
      const datos = (t[eje] || []).flat();
      for (const v of datos) {
        if (v === null || !Number.isFinite(v)) continue;
        if (v < rango[eje][0]) rango[eje][0] = v;
        if (v > rango[eje][1]) rango[eje][1] = v;
      }
    }
  }
  const largo = (eje) => Math.max(rango[eje][1] - rango[eje][0], 1e-9);
  const m = Math.max(largo('x'), largo('y'), largo('z'));
  const r = (eje) => Math.max(0.45, largo(eje) / m);
  // Se agranda la caja para que ocupe un volumen parecido al cubo por defecto de Plotly; si no, un
  // sólido alargado se ve diminuto con la cámara a la misma distancia
  const k = Math.min(1.6, 1 / Math.cbrt(r('x') * r('y') * r('z')));
  return { x: k * r('x'), y: k * r('y'), z: k * r('z') };
}

function layout3D(trazas, etqX = 'x', etqY = 'y', etqZ = 'z') {
  const eje = (t) => ({
    title: { text: t },
    gridcolor: 'rgba(0, 173, 181, 0.2)',
    zerolinecolor: '#00adb5',
    showbackground: false,
    color: '#ffffff'
  });
  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#ffffff', family: 'Segoe UI, sans-serif' },
    margin: { l: 0, r: 0, t: 0, b: 0 },
    showlegend: true,
    legend: { orientation: 'h', x: 0, y: 1, font: { size: 11 }, bgcolor: 'rgba(13, 14, 18, 0.5)' },
    scene: {
      xaxis: eje(etqX),
      yaxis: eje(etqY),
      zaxis: eje(etqZ),
      aspectmode: 'manual',
      aspectratio: proporciones(trazas),
      camera: { eye: ojoCamara() }
    }
  };
}

const ESCALA_FIJA = (color) => [[0, color], [1, color]];

function superficie(X, Y, Z, opciones = {}) {
  return {
    type: 'surface', x: X, y: Y, z: Z, showscale: false, hoverinfo: 'skip',
    opacity: 0.95, colorscale: 'Viridis', showlegend: false,
    lighting: { ambient: 0.65, diffuse: 0.7, specular: 0.25, roughness: 0.6 },
    ...opciones
  };
}

// Líneas 3D (varios trazos separados por null en una sola traza: es mucho más liviano)
function lineas3D(segmentos, nombre, color, ancho = 3, extra = {}) {
  const x = [], y = [], z = [];
  for (const seg of segmentos) {
    for (const [px, py, pz] of seg) { x.push(aNull(px)); y.push(aNull(py)); z.push(aNull(pz)); }
    x.push(null); y.push(null); z.push(null);
  }
  return { type: 'scatter3d', mode: 'lines', x, y, z, name: nombre, hoverinfo: 'skip',
           line: { color, width: ancho }, showlegend: !!nombre, ...extra };
}

const N_ANG = 48;      // resolución angular de las superficies de revolución
const N_LARGO = 60;    // resolución a lo largo del eje

// Sólido al girar la región entre f y el eje X alrededor del eje X: pared curva + tapas planas
function solidoEjeX(f, a, b, { tapas = true, colorscale = 'Viridis', opacidad = 0.92 } = {}) {
  const thetas = linspace(0, 2 * Math.PI, N_ANG);
  const xs = linspace(a, b, N_LARGO);
  const radios = xs.map((x) => { const y = f(x); return Number.isFinite(y) ? Math.abs(y) : null; });
  const X = [], Y = [], Z = [], C = [];
  xs.forEach((x, i) => {
    const r = radios[i];
    X.push(thetas.map(() => x));
    Y.push(thetas.map((t) => (r === null ? null : r * Math.cos(t))));
    Z.push(thetas.map((t) => (r === null ? null : r * Math.sin(t))));
    C.push(thetas.map(() => r));
  });
  const rMax = Math.max(1e-9, ...radios.filter((r) => r !== null));
  const trazas = [superficie(X, Y, Z, { surfacecolor: C, cmin: 0, cmax: rMax, colorscale, opacity: opacidad })];

  if (tapas) {
    for (const [x, r] of [[a, radios[0]], [b, radios[radios.length - 1]]]) {
      if (!r) continue;
      trazas.push(superficie(
        [thetas.map(() => x), thetas.map(() => x)],
        [thetas.map(() => 0), thetas.map((t) => r * Math.cos(t))],
        [thetas.map(() => 0), thetas.map((t) => r * Math.sin(t))],
        { colorscale: ESCALA_FIJA('rgba(0, 173, 181, 0.9)'), opacity: 0.55 }
      ));
    }
  }
  return { trazas, radios, xs, rMax };
}

// Curva generatriz y eje de giro (ayudan a entender qué se está girando)
function curvaGeneratriz3D(f, a, b, plano) {
  const xs = linspace(a, b, 200);
  const pts = xs.map((x) => (plano === 'xz' ? [x, 0, f(x)] : [x, f(x), 0]));
  return lineas3D([pts], 'Curva y = f(x)', '#ff0055', 6);
}

function graficaArea(f, a, b, res) {
  const pad = 0.12 * (b - a);
  const xs = linspace(a - pad, b + pad, 400);
  // malla del relleno con las raíces incluidas, para que el sombreado cambie de color justo en el cruce
  const xf = [...linspace(a, b, 300), ...res.raices].sort((p, q) => p - q);
  const yf = xf.map((x) => aNull(f(x)));
  const hayNegativa = res.negativa < 0;
  const hayPositiva = res.positiva > 0;

  const trazas = [
    { x: xf, y: yf.map((y) => (y === null ? null : Math.max(y, 0))), type: 'scatter', mode: 'lines',
      fill: 'tozeroy', fillcolor: 'rgba(0, 173, 181, 0.38)', line: { color: 'rgba(0,0,0,0)' },
      name: 'f > 0: suma', hoverinfo: 'skip', showlegend: hayPositiva },
    { x: xf, y: yf.map((y) => (y === null ? null : Math.min(y, 0))), type: 'scatter', mode: 'lines',
      fill: 'tozeroy', fillcolor: 'rgba(255, 0, 85, 0.38)', line: { color: 'rgba(0,0,0,0)' },
      name: 'f < 0: resta en ∫, suma en el área', hoverinfo: 'skip', showlegend: hayNegativa },
    { x: xs, y: xs.map((x) => aNull(f(x))), type: 'scatter', mode: 'lines', name: 'f(x)',
      line: { color: '#00adb5', width: 3 }, showlegend: false }
  ];
  if (res.raices.length) {
    trazas.push({ x: res.raices, y: res.raices.map(() => 0), type: 'scatter', mode: 'markers', name: 'Raíces',
                  marker: { color: '#ffb703', size: 9, symbol: 'x' } });
  }
  const layout = layout2D();
  const lim = lineasLimites(a, b);
  Object.assign(layout, lim, { showlegend: true, legend: { orientation: 'h', y: 1.1, font: { size: 11 } } });
  layout.margin = { ...layout.margin, t: 40 };
  layout.yaxis.range = rangoVertical(yf);
  return { trazas, layout };
}

function graficaArco(f, a, b, res) {
  const pad = 0.12 * (b - a);
  const xs = linspace(a - pad, b + pad, 400);
  const xArc = linspace(a, b, 300);
  const yArc = xArc.map((x) => aNull(f(x)));
  const fa = f(a), fb = f(b);
  const trazas = [
    { x: xs, y: xs.map((x) => aNull(f(x))), type: 'scatter', mode: 'lines', name: 'f(x)',
      line: { color: 'rgba(0, 173, 181, 0.6)', width: 2 }, showlegend: false },
    { x: xArc, y: yArc, type: 'scatter', mode: 'lines', hoverinfo: 'skip', showlegend: false,
      line: { color: 'rgba(255, 0, 85, 0.25)', width: 12 } },
    { x: xArc, y: yArc, type: 'scatter', mode: 'lines', name: `Arco medido: L = ${fmt(res.valor)}`,
      line: { color: '#ff0055', width: 4 } }
  ];
  if (Number.isFinite(fa) && Number.isFinite(fb)) {
    trazas.push(
      { x: [a, b], y: [fa, fb], type: 'scatter', mode: 'lines', name: `Cuerda (recta): ${fmt(res.cuerda)}`,
        line: { color: 'rgba(255, 255, 255, 0.55)', width: 2, dash: 'dash' } },
      { x: [a, b], y: [fa, fb], type: 'scatter', mode: 'markers+text', text: ['A', 'B'],
        textposition: 'top center', textfont: { color: '#ffb703', size: 14 }, showlegend: false,
        marker: { color: '#ffb703', size: 10 }, hoverinfo: 'x+y' }
    );
  }
  const layout = layout2D();
  Object.assign(layout, { showlegend: true, legend: { orientation: 'h', y: 1.1, font: { size: 11 } } });
  layout.margin = { ...layout.margin, t: 40 };
  layout.yaxis.range = rangoVertical(yArc);
  return { trazas, layout };
}

// Discos (eje X): el sólido con tapas y algunos discos de muestra, que son la idea del método
function graficaVolumenX(f, a, b) {
  const s = solidoEjeX(f, a, b, { tapas: true, colorscale: 'Viridis', opacidad: 0.85 });
  const thetas = linspace(0, 2 * Math.PI, N_ANG);
  const discos = linspace(a, b, 9).slice(1, -1).map((x) => {
    const r = Math.abs(f(x));
    return Number.isFinite(r) ? thetas.map((t) => [x, r * Math.cos(t), r * Math.sin(t)]) : [];
  });
  const pad = 0.08 * (b - a);
  const trazas = [
    ...s.trazas,
    lineas3D(discos, 'Discos de radio |f(x)|', '#ffb703', 4),
    curvaGeneratriz3D(f, a, b, 'xy'),
    lineas3D([[[a - pad, 0, 0], [b + pad, 0, 0]]], 'Eje de giro (eje X)', 'rgba(255,255,255,0.8)', 3, { line: { color: 'rgba(255,255,255,0.8)', width: 3, dash: 'dash' } })
  ];
  return { trazas, layout: layout3D(trazas, 'x', 'y', 'z') };
}

// Capas (eje Y). En Plotly el eje vertical es z, así que el eje de giro (el eje Y del plano) se dibuja
// vertical: (x, y del plano) → (x, z, y). El sólido se arma con el perfil h(r) de calculo.js, que ya
// resuelve la superposición cuando el intervalo cruza x = 0.
function graficaVolumenY(f, a, b, res) {
  const { rMin, rMax, alturas } = res.perfil;
  const thetas = linspace(0, 2 * Math.PI, N_ANG);
  const rs = linspace(rMin, rMax, N_LARGO);
  const hs = rs.map(alturas);
  const anillo = (r, z) => thetas.map((t) => [r * Math.cos(t), r * Math.sin(t), z]);
  const malla = (zDe) => ({
    X: rs.map((r) => thetas.map((t) => r * Math.cos(t))),
    Y: rs.map((r) => thetas.map((t) => r * Math.sin(t))),
    Z: rs.map((r, i) => thetas.map(() => aNull(zDe(hs[i]))))
  });
  const arriba = malla((h) => h.arriba), abajo = malla((h) => h.abajo);
  const zMax = Math.max(1e-9, ...hs.map((h) => Math.abs(h.arriba)).filter(Number.isFinite),
                        ...hs.map((h) => Math.abs(h.abajo)).filter(Number.isFinite));
  const escala = 'YlOrRd';
  const trazas = [
    superficie(arriba.X, arriba.Y, arriba.Z, { colorscale: escala, surfacecolor: arriba.Z, cmin: -zMax, cmax: zMax, opacity: 0.9 }),
    superficie(abajo.X, abajo.Y, abajo.Z, { colorscale: escala, surfacecolor: abajo.Z, cmin: -zMax, cmax: zMax, opacity: 0.9 })
  ];
  // Paredes cilíndricas exterior (r = rMax) e interior (r = rMin, si el sólido tiene hueco)
  const pared = (r, h) => superficie(
    [thetas.map((t) => r * Math.cos(t)), thetas.map((t) => r * Math.cos(t))],
    [thetas.map((t) => r * Math.sin(t)), thetas.map((t) => r * Math.sin(t))],
    [thetas.map(() => h.abajo), thetas.map(() => h.arriba)],
    { colorscale: ESCALA_FIJA('rgba(255, 140, 20, 0.9)'), opacity: 0.6 }
  );
  const hExt = hs[hs.length - 1], hInt = hs[0];
  if (Number.isFinite(hExt.arriba) && hExt.arriba - hExt.abajo > 1e-12) trazas.push(pared(rMax, hExt));
  if (rMin > 0 && Number.isFinite(hInt.arriba) && hInt.arriba - hInt.abajo > 1e-12) trazas.push(pared(rMin, hInt));

  // Una capa típica resaltada: radio r, altura h(r)
  const rCapa = rMin + 0.62 * (rMax - rMin);
  const hCapa = alturas(rCapa);
  if (Number.isFinite(hCapa.arriba) && hCapa.arriba - hCapa.abajo > 1e-12) {
    trazas.push(lineas3D([anillo(rCapa, hCapa.abajo), anillo(rCapa, hCapa.arriba),
      ...[0, 0.25, 0.5, 0.75].map((k) => {
        const t = k * 2 * Math.PI;
        return [[rCapa * Math.cos(t), rCapa * Math.sin(t), hCapa.abajo], [rCapa * Math.cos(t), rCapa * Math.sin(t), hCapa.arriba]];
      })], `Capa típica: 2π·r·h(r)·dr (r = ${fmt(rCapa, 2)})`, '#00ffcc', 5));
  }
  const zs = hs.flatMap((h) => [h.arriba, h.abajo]).filter(Number.isFinite);
  const zLo = Math.min(0, ...zs), zHi = Math.max(0, ...zs), pad = 0.12 * (zHi - zLo || 1);
  trazas.push(
    curvaGeneratriz3D(f, a, b, 'xz'),
    lineas3D([[[0, 0, zLo - pad], [0, 0, zHi + pad]]], 'Eje de giro (eje Y)', 'rgba(255,255,255,0.8)', 3,
             { line: { color: 'rgba(255,255,255,0.8)', width: 3, dash: 'dash' } })
  );
  return { trazas, layout: layout3D(trazas, 'x', 'z', 'y = f(x)') };
}

// Superficie (eje X): solo la pared curva (sin tapas) con una malla de anillos y generatrices
function graficaSuperficie(f, a, b) {
  const s = solidoEjeX(f, a, b, { tapas: false, colorscale: 'YlOrRd', opacidad: 0.8 });
  const thetas = linspace(0, 2 * Math.PI, N_ANG);
  const anillos = linspace(a, b, 13).map((x) => {
    const r = Math.abs(f(x));
    return Number.isFinite(r) ? thetas.map((t) => [x, r * Math.cos(t), r * Math.sin(t)]) : [];
  });
  const meridianos = linspace(0, 2 * Math.PI, 13).slice(0, -1).map((t) =>
    s.xs.map((x, i) => (s.radios[i] === null ? [null, null, null] : [x, s.radios[i] * Math.cos(t), s.radios[i] * Math.sin(t)])));
  const trazas = [
    ...s.trazas,
    lineas3D([...anillos, ...meridianos], 'Malla de la superficie lateral', 'rgba(255, 255, 255, 0.45)', 2),
    curvaGeneratriz3D(f, a, b, 'xy')
  ];
  return { trazas, layout: layout3D(trazas, 'x', 'y', 'z') };
}

function mostrarError(msg) {
  const r = $('result-val');
  r.classList.add('error');
  r.textContent = '⚠️ Revisa los datos';
  $('result-desc').textContent = msg;
  $('result-detalle').replaceChildren();
  $('analisis-card').hidden = true;
  $('pasos-card').hidden = true;
  return false;
}

// Chips con los valores clave del resultado
function mostrarDetalle(datos) {
  const cont = $('result-detalle');
  cont.replaceChildren();
  for (const [etiqueta, valor, clase] of datos) {
    const div = document.createElement('div');
    div.className = `dato${clase ? ' ' + clase : ''}`;
    const e = document.createElement('span');
    e.className = 'dato-etq';
    e.textContent = etiqueta;
    const v = document.createElement('span');
    v.className = 'dato-val';
    v.textContent = valor;
    div.append(e, v);
    cont.appendChild(div);
  }
}

// Lista de pasos: cada paso es [título, texto]
function mostrarPasos(pasos) {
  const ol = $('pasos-lista');
  ol.replaceChildren();
  for (const [titulo, texto] of pasos) {
    const li = document.createElement('li');
    const s = document.createElement('strong');
    s.textContent = titulo;
    li.append(s, ' ', texto);
    ol.appendChild(li);
  }
  $('pasos-card').hidden = false;
}

function marcarBotonGesto(g) {
  document.querySelectorAll('.gesto-btn').forEach((btn) => {
    btn.classList.toggle('active', Number(btn.dataset.gesto) === g);
  });
}

function listaNumeros(xs, dec = 3) {
  if (!xs.length) return 'ninguna';
  const txt = xs.slice(0, 6).map((x) => fmt(x, dec)).join(', ');
  return xs.length > 6 ? `${txt}, …` : txt;
}

// Pasos del cálculo, explicados para la clase (el texto de la voz se arma aparte)
function construirPasos(gesto, { fStr, a, b, res, der, unidad, decimales }) {
  const u = unidad;
  const v = (x) => fmt(x, decimales);
  const pasos = [['Datos:', `f(x) = ${fStr}, intervalo [a, b] = [${fmt(a, 3)}, ${fmt(b, 3)}].`]];

  switch (gesto) {
    case 1: {
      pasos.push(['Raíces en [a, b]:', `${listaNumeros(res.raices)}. Dividen el intervalo en ${res.tramos.length} tramo(s) donde f no cambia de signo.`]);
      const muestra = res.tramos.slice(0, 4).map((t) => `∫[${fmt(t.desde, 2)}, ${fmt(t.hasta, 2)}] f dx = ${v(t.valor)}`).join(' · ');
      pasos.push(['Integral de cada tramo:', muestra + (res.tramos.length > 4 ? ' · …' : '')]);
      pasos.push(['Integral definida (con signo):', `∫[a,b] f(x) dx = Σ Iₖ = ${v(res.integral)} ${u}. Las partes bajo el eje restan.`]);
      pasos.push(['Área geométrica:', `A = ∫[a,b] |f(x)| dx = Σ |Iₖ| = ${v(res.area)} ${u}. Todas las partes suman.`]);
      if (res.negativa === 0) pasos.push(['Conclusión:', 'f ≥ 0 en todo [a, b], así que la integral y el área coinciden.']);
      else if (res.positiva === 0) pasos.push(['Conclusión:', 'f ≤ 0 en todo [a, b]: la integral es negativa y el área es su valor absoluto.']);
      else pasos.push(['Conclusión:', `La parte bajo el eje vale ${v(res.negativa)}: la integral la resta y el área la suma, por eso difieren en 2·${v(Math.abs(res.negativa))} = ${v(2 * Math.abs(res.negativa))}.`]);
      break;
    }
    case 2:
      pasos.push(['Corte transversal:', 'cada corte perpendicular al eje X es un disco de radio R(x) = |f(x)|.']);
      pasos.push(['Elemento de volumen:', 'A(x) = π·[f(x)]², así que un disco delgado mide dV = π·[f(x)]²·dx.']);
      pasos.push(['Suma de discos:', `V = π ∫[a,b] [f(x)]² dx = ${v(res.valor)} ${u}.`]);
      pasos.push(['Observación:', 'el signo de f no importa: al elevar al cuadrado el radio siempre es positivo.']);
      break;
    case 3: {
      pasos.push(['Capa cilíndrica:', 'una franja vertical a distancia r del eje Y forma, al girar, un tubo de radio r, altura h(r) y grosor dr.']);
      pasos.push(['Elemento de volumen:', 'dV = (circunferencia)·(altura)·(grosor) = 2π·r·h(r)·dr.']);
      if (res.cruzaEje) {
        pasos.push(['¡Cuidado, superposición!', `el intervalo cruza el eje de giro (x = 0). Las capas de x < 0 y x > 0 con el mismo radio ocupan el mismo espacio; sumarlas contaría ese volumen dos veces (${v(res.sinCorregir)} ${u}).`]);
        pasos.push(['Corrección:', `se toma la unión de ambos lados: h(r) es la altura combinada de x = r y x = −r, con r de 0 a max(|a|, |b|) = ${fmt(res.perfil.rMax, 3)}.`]);
        pasos.push(['Resultado:', `V = 2π ∫[0, ${fmt(res.perfil.rMax, 3)}] r·h(r) dr = ${v(res.valor)} ${u}.`]);
      } else if (b <= 0) {
        pasos.push(['Resultado:', `el intervalo está a la izquierda del eje, así que r = |x| y h = |f(x)|: V = 2π ∫[a,b] |x|·|f(x)| dx = ${v(res.valor)} ${u}.`]);
      } else {
        pasos.push(['Resultado:', `aquí r = x y h(r) = |f(x)|: V = 2π ∫[a,b] x·|f(x)| dx = ${v(res.valor)} ${u}.`]);
      }
      break;
    }
    case 4:
      pasos.push(['Derivada:', `f′(x) = ${der.texto}${der.simbolica ? ' (exacta, con math.js)' : ''}.`]);
      pasos.push(['Elemento de arco:', 'ds = √(1 + [f′(x)]²) dx.']);
      pasos.push(['Elemento de superficie:', 'cada anillo tiene circunferencia 2π·|f(x)|, así que dS = 2π·|f(x)|·ds.']);
      pasos.push(['Superficie lateral:', `S = 2π ∫[a,b] |f(x)| √(1 + [f′(x)]²) dx = ${v(res.valor)} ${u}.`]);
      pasos.push(['Con tapas:', `si se agregan los discos de los extremos, π·f(a)² + π·f(b)² = ${v(res.tapas)} ${u}; total ${v(res.valor + res.tapas)} ${u}.`]);
      break;
    case 5:
      pasos.push(['Derivada:', `f′(x) = ${der.texto}${der.simbolica ? ' (exacta, con math.js)' : ''}.`]);
      pasos.push(['Elemento de arco:', 'por Pitágoras, un tramo pequeño de la curva mide ds = √(dx² + dy²) = √(1 + [f′(x)]²) dx.']);
      pasos.push(['Longitud:', `L = ∫[a,b] √(1 + [f′(x)]²) dx = ${v(res.valor)} ${u}.`]);
      if (Number.isFinite(res.cuerda)) {
        pasos.push(['Comprobación:', `la cuerda AB mide √((b − a)² + (f(b) − f(a))²) = ${v(res.cuerda)} ${u}. Una curva nunca es más corta que la recta entre sus extremos: L − cuerda = ${v(res.valor - res.cuerda)} ${u} ≥ 0 ✔.`]);
      }
      break;
  }

  let metodoTxt = `${res.metodo}, error estimado ≈ ${formatoError(res.error)}.`;
  if (res.removibles.length) metodoTxt += ` El integrando no está definido en x = ${listaNumeros(res.removibles)}, pero su límite sí existe: se usó el límite (singularidad removible).`;
  if (res.impropia) metodoTxt += ' El integrando no está acotado en un extremo: es una integral impropia convergente y se usó la cuadratura tanh-sinh.';
  pasos.push(['Método numérico:', metodoTxt]);
  mostrarPasos(pasos);
}

function renderCalculo(gesto) {
  const fStr = $('input-func').value.trim();
  const a = parseFloat($('input-a').value);
  const b = parseFloat($('input-b').value);

  if (typeof Plotly === 'undefined' || typeof math === 'undefined') {
    return mostrarError('No se cargaron las librerías (Plotly / math.js). Revisa tu conexión a internet y recarga la página.');
  }
  if (!fStr) return mostrarError('Escribe una función f(x).');
  if (!Number.isFinite(a) || !Number.isFinite(b)) return mostrarError('Los límites a y b deben ser números.');
  if (a >= b) return mostrarError('El límite a debe ser menor que el límite b.');

  const f = Calculo.compilarFuncion(fStr);
  if (!f) {
    return mostrarError(`No se pudo interpretar "${fStr}". Usa x como variable. Ejemplos válidos: x^2, -x^2 + 4, 2x + 1, sin(x), exp(-x), sqrt(4 - x).`);
  }

  const info = INFO[gesto];
  if (!info) return false;

  const metodo = $('metodo-select').value;
  const der = (gesto === 4 || gesto === 5) ? Calculo.compilarDerivada(fStr, f, a, b) : null;
  let res;
  switch (gesto) {
    case 1: res = Calculo.calcularArea(f, a, b, metodo); break;
    case 2: res = Calculo.calcularVolumenX(f, a, b, metodo); break;
    case 3: res = Calculo.calcularVolumenY(f, a, b, metodo); break;
    case 4: res = Calculo.calcularSuperficie(f, der.df, a, b, metodo); break;
    case 5: res = Calculo.calcularLongitudArco(f, der.df, a, b, metodo); break;
  }

  // Verificación con el método adaptativo: con otro método, una asíntota dentro del intervalo podría
  // pasar desapercibida y dar un número enorme sin sentido
  const [lo, hi] = res.dominio;
  const ref = metodo === 'adaptativo' ? res : Calculo.integrar(res.integrando, lo, hi, 'adaptativo', res.cortes);
  if (res.diverge || ref.diverge) {
    return mostrarError('La integral diverge (vale ∞): la función tiene una asíntota vertical en [a, b] que no encierra un área finita. Ajusta los límites para evitarla.');
  }
  if (!Number.isFinite(res.valor) || !Number.isFinite(ref.valor)) {
    return mostrarError('La función no está definida (o no es derivable) en todo el intervalo [a, b]. Revisa la función o ajusta los límites.');
  }

  let vis;
  switch (gesto) {
    case 1: vis = graficaArea(f, a, b, res); break;
    case 2: vis = graficaVolumenX(f, a, b); break;
    case 3: vis = graficaVolumenY(f, a, b, res); break;
    case 4: vis = graficaSuperficie(f, a, b); break;
    case 5: vis = graficaArco(f, a, b, res); break;
  }
  Plotly.react('plot-holder', vis.trazas, vis.layout, PLOT_CONFIG);
  const holder = $('plot-holder');
  if (holder.removeAllListeners) holder.removeAllListeners('plotly_relayout');
  if (holder.on) holder.on('plotly_relayout', sincronizarCamara);

  renderAnalisis(res.integrando, lo, hi, res.cortes, metodo, ref.valor);
  construirExplicacion(gesto, metodo, res);

  // Notas del resultado
  let nota = '';
  if (gesto === 1 && res.negativa < 0 && res.positiva > 0) {
    nota += ` La función cambia de signo: la integral con signo vale ${fmt(res.integral)} y el área geométrica ${fmt(res.area)}.`;
  } else if (gesto === 1 && res.positiva === 0) {
    nota += ` f ≤ 0 en [a, b]: la integral con signo es ${fmt(res.integral)} y el área es su valor absoluto.`;
  }
  if (gesto === 3 && res.cruzaEje) {
    nota += ` ⚠️ El intervalo cruza el eje de giro (x = 0): las capas de ambos lados ocupan el mismo espacio, así que se tomó su unión (sumarlas daría ${fmt(res.sinCorregir)}).`;
  }
  if (res.removibles.length) nota += ` ℹ️ Singularidad removible en x = ${listaNumeros(res.removibles)}: se usó el límite.`;
  if (res.impropia) nota += ' ℹ️ Integral impropia convergente: se aproximó con cuadratura tanh-sinh.';
  nota += ` Método: ${res.metodo}, error estimado ≈ ${formatoError(res.error)}.`;

  const caso = CONTEXTOS[$('preset-select').value];
  const esp = caso && caso.gestos[gesto];
  let titulo = info.titulo, unidad = info.unidad, voz = info.voz, uso = info.uso, decimales = 4;
  if (esp) {
    ({ titulo, unidad, voz, uso, decimales } = esp);
    if (esp.extra) nota += esp.extra(res.valor, a, b);
  } else if (caso) {
    uso = `Este gesto no tiene interpretación física para "${caso.nombre}".`;
    nota += ` ⚠️ El cálculo matemático es correcto, pero no representa nada real en este caso. Para este caso muestra ${caso.sugerencia}.`;
  }

  const r = $('result-val');
  r.classList.remove('error');
  r.textContent = `${titulo}: ${fmt(res.valor, decimales)} ${unidad}`;
  $('result-desc').textContent = `Fórmula: ${info.formula} — ${uso}${nota}`;

  const v = (x) => `${fmt(x, decimales)} ${unidad}`;
  const datos = [];
  switch (gesto) {
    case 1:
      datos.push(['∫ f(x) dx (con signo)', v(res.integral), res.integral < 0 ? 'neg' : '']);
      datos.push(['Área geométrica ∫|f|', v(res.area), 'principal']);
      if (res.positiva > 0 && res.negativa < 0) {
        datos.push(['Parte sobre el eje', v(res.positiva)]);
        datos.push(['Parte bajo el eje', v(res.negativa), 'neg']);
      }
      break;
    case 2:
      datos.push(['Volumen (discos)', v(res.valor), 'principal']);
      break;
    case 3:
      datos.push(['Volumen (capas)', v(res.valor), 'principal']);
      if (res.cruzaEje) datos.push(['Sumando ambos lados (doble conteo)', v(res.sinCorregir), 'tachado']);
      break;
    case 4:
      datos.push(['Superficie lateral', v(res.valor), 'principal']);
      datos.push(['Tapas π·f(a)² + π·f(b)²', v(res.tapas)]);
      datos.push(['Total con tapas', v(res.valor + res.tapas)]);
      break;
    case 5:
      datos.push(['Longitud del arco', v(res.valor), 'principal']);
      if (Number.isFinite(res.cuerda)) {
        datos.push(['Cuerda (recta AB)', v(res.cuerda)]);
        datos.push(['Exceso sobre la recta', v(res.valor - res.cuerda)]);
      }
      break;
  }
  datos.push(['Error estimado', formatoError(res.error)]);
  mostrarDetalle(datos);
  construirPasos(gesto, { fStr, a, b, res, der, unidad, decimales });

  gestoActual = gesto;
  marcarBotonGesto(gesto);
  if (modoActual === 'exploracion' && gesto !== prevGestoHablado) {
    prevGestoHablado = gesto;
    hablar(`${titulo}. ${fmt(res.valor, Math.min(decimales, 2))} ${voz}. ${textoExplicacion}`);
  }
  return true;
}

// ==========================================
// 4.1 SISTEMA ARCADE / QUIZ
// ==========================================
const bancoPreguntas = [
  { reto: 'Muestra con tus dedos la fórmula del ÁREA BAJO LA CURVA 2D', gestoCorrecto: 1 },
  { reto: 'Muestra la técnica de DISCOS para VOLUMEN alrededor del EJE X', gestoCorrecto: 2 },
  { reto: 'Muestra la técnica de CAPAS CILÍNDRICAS para VOLUMEN en EJE Y', gestoCorrecto: 3 },
  { reto: 'Muestra la fórmula para calcular el ÁREA SUPERFICIAL 3D', gestoCorrecto: 4 },
  { reto: 'Muestra la fórmula de LONGITUD DE ARCO para la banda transportadora', gestoCorrecto: 5 }
];

function actualizarBarra(progreso, borrar = false) {
  const barra = $('progress-bar');
  barra.style.width = `${Math.round(progreso * 100)}%`;
  barra.classList.toggle('borrar', borrar);
}

function animarPop(el) {
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}

function actualizarMarcador() {
  $('streak-lbl').textContent = `🔥 RACHA: x${racha}`;
  $('points-lbl').textContent = `🏆 PUNTOS: ${puntos}`;
  animarPop($('streak-lbl'));
  animarPop($('points-lbl'));
}

function reiniciarDeteccion() {
  bufferDedos = [];
  gestoCandidato = null;
  dedosPrevios = null;
  actualizarBarra(0);
}

function limpiarProyeccion(motivo) {
  if (typeof Plotly !== 'undefined') Plotly.purge('plot-holder');
  $('analisis-card').hidden = true;
  $('pasos-card').hidden = true;
  $('result-detalle').replaceChildren();
  gestoActual = null;
  prevGestoHablado = -1;
  marcarBotonGesto(null);
  const r = $('result-val');
  r.classList.remove('error');
  r.textContent = '✨ Pantalla limpia';
  $('result-desc').textContent = motivo === 'inactividad'
    ? 'Se limpió por inactividad. Muestra de 1 a 5 dedos (o usa los botones) para proyectar un cálculo.'
    : 'Muestra de 1 a 5 dedos (o usa los botones) para proyectar un nuevo cálculo.';
  hablar(motivo === 'inactividad' ? 'Pantalla limpia por inactividad' : 'Pantalla limpia');
}

function nuevaPreguntaArcade() {
  if (modoActual !== 'arcade' || juegoPausado) return;
  respondido = false;

  let idx;
  do {
    idx = Math.floor(Math.random() * bancoPreguntas.length);
  } while (idx === indicePregunta && bancoPreguntas.length > 1);
  indicePregunta = idx;
  preguntaActual = bancoPreguntas[idx];

  reiniciarDeteccion();
  bloqueoHasta = performance.now() + 1500;

  $('mode-title').textContent = `⚡ RETO ARCADE: ${preguntaActual.reto}`;
  $('result-val').classList.remove('error');
  $('result-val').textContent = 'Esperando tu gesto...';
  $('result-desc').textContent = 'Muestra el número de dedos correcto y mantenlo 1 segundo (o responde con los botones de gesto o las teclas 1 a 5).';
  $('result-detalle').replaceChildren();
  hablar(preguntaActual.reto);
}

function verificarRespuestaArcade(gesto) {
  if (modoActual !== 'arcade' || juegoPausado || respondido || !preguntaActual) return;
  if (gesto < 1 || gesto > 5) return;
  respondido = true;
  const correcto = preguntaActual.gestoCorrecto;

  if (gesto === correcto) {
    racha++;
    const ganados = 100 * racha;
    puntos += ganados;
    renderCalculo(gesto);
    $('mode-title').textContent = `✅ ¡CORRECTO! +${ganados} PUNTOS`;
    hablar(`¡Correcto! Más ${ganados} puntos`);
  } else {
    racha = 0;
    const palabra = correcto === 1 ? 'dedo' : 'dedos';
    $('mode-title').textContent = `❌ INCORRECTO: mostraste ${gesto}, eran ${correcto} ${palabra}`;
    $('result-val').classList.add('error');
    $('result-val').textContent = `Respuesta correcta: ${correcto} ${palabra} — ${INFO[correcto].titulo}`;
    $('result-desc').textContent = 'La racha se reinicia. Siguiente reto en 3 segundos.';
    hablar(`Incorrecto. La respuesta era ${correcto} ${palabra}`);
  }

  actualizarMarcador();
  clearTimeout(timeoutPregunta);
  timeoutPregunta = setTimeout(nuevaPreguntaArcade, 3000);
}

function pausarArcade() {
  juegoPausado = true;
  clearTimeout(timeoutPregunta);
  preguntaActual = null;
  reiniciarDeteccion();
  $('mode-title').textContent = '⏸ JUEGO EN PAUSA';
  $('result-val').classList.remove('error');
  $('result-val').textContent = 'Muestra tu mano para continuar';
  $('result-desc').textContent = `Tu racha (x${racha}) y tus puntos (${puntos}) se conservan.`;
  hablar('Juego en pausa');
}

function reanudarArcade() {
  juegoPausado = false;
  ultimaActividad = performance.now();
  nuevaPreguntaArcade();
}

function cambiarModo(modo) {
  modoActual = modo;
  juegoPausado = false;
  clearTimeout(timeoutPregunta);
  reiniciarDeteccion();
  ultimaActividad = performance.now();

  $('btn-mode-explore').classList.toggle('active', modo === 'exploracion');
  $('btn-mode-arcade').classList.toggle('active-arcade', modo === 'arcade');

  if (modo === 'exploracion') {
    preguntaActual = null;
    $('btn-recalc').textContent = 'Recalcular';
    $('mode-title').textContent = 'MODO LIBRE: MUESTRA DE 1 A 5 DEDOS';
    prevGestoHablado = -1;
    if (gestoActual !== null) renderCalculo(gestoActual);
    else limpiarProyeccion('manual');
  } else {
    racha = 0;
    puntos = 0;
    indicePregunta = -1;
    actualizarMarcador();
    $('btn-recalc').textContent = '✔ Responder con control manual';
    nuevaPreguntaArcade();
  }
}

// ==========================================
// 4.2 EVENTOS DE LA INTERFAZ
// ==========================================
$('btn-mode-explore').addEventListener('click', () => cambiarModo('exploracion'));
$('btn-mode-arcade').addEventListener('click', () => cambiarModo('arcade'));
$('btn-ir-lab').addEventListener('click', () => {
  $('laboratorio').scrollIntoView({ behavior: reducirMovimiento ? 'auto' : 'smooth', block: 'start' });
});

$('btn-recalc').addEventListener('click', () => {
  const man = $('manual-gesto').value;
  if (modoActual === 'arcade') {
    if (juegoPausado) { reanudarArcade(); return; }
    if (man === 'cam' || man === '0') {
      $('gesture-text').textContent = 'Elige de 1 a 5 dedos en "Control manual" (o usa los botones de gesto) para responder sin cámara.';
      return;
    }
    verificarRespuestaArcade(parseInt(man, 10));
    return;
  }
  if (man === '0') { limpiarProyeccion('manual'); return; }
  renderCalculo(man === 'cam' ? (gestoActual || 1) : parseInt(man, 10));
});

// Botones de gesto: funcionan siempre, haya o no cámara (también con las teclas 1–5 y 0)
function elegirGestoBoton(g) {
  ultimaActividad = performance.now();
  if (modoActual === 'arcade') {
    if (juegoPausado) { reanudarArcade(); return; }
    if (g === 0) {
      $('gesture-text').textContent = 'En Arcade no se limpia la pantalla: responde de 1 a 5.';
      return;
    }
    $('gesture-text').textContent = `Respuesta por botón: ${g}`;
    verificarRespuestaArcade(g);
    return;
  }
  if (g === 0) {
    $('gesture-text').textContent = 'Botón: limpiar pantalla';
    limpiarProyeccion('manual');
    return;
  }
  $('gesture-text').textContent = `Botón: ${g} — ${INFO[g].titulo}`;
  renderCalculo(g);
}

document.querySelectorAll('.gesto-btn').forEach((btn) => {
  btn.addEventListener('click', () => elegirGestoBoton(Number(btn.dataset.gesto)));
});

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  if (/^[0-5]$/.test(e.key)) {
    e.preventDefault();
    elegirGestoBoton(Number(e.key));
  }
});

['input-func', 'input-a', 'input-b'].forEach((id) => {
  $(id).addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && modoActual === 'exploracion') $('btn-recalc').click();
  });
});

const PRESETS = {
  prod:     { f: '100 + 15*x - 2*x^2', a: 0, b: 8 },
  cilindro: { f: '2',                  a: 0, b: 5 },
  tanque:   { f: 'sqrt(4 - x)',        a: 0, b: 4 },
  banda:    { f: 'sin(x) + 2',         a: 0, b: 6.2832 }
};

$('preset-select').addEventListener('change', (e) => {
  const p = PRESETS[e.target.value];
  if (!p) { actualizarPistaPreset(); return; }
  $('input-func').value = p.f;
  $('input-a').value = p.a;
  $('input-b').value = p.b;
  actualizarPistaPreset();
  if (modoActual === 'exploracion') renderCalculo(CONTEXTOS[e.target.value].recomendado);
});

['input-func', 'input-a', 'input-b'].forEach((id) => {
  $(id).addEventListener('input', () => {
    $('preset-select').value = 'custom';
    actualizarPistaPreset();
  });
});

$('metodo-select').addEventListener('change', () => {
  if (modoActual !== 'exploracion' || gestoActual === null) return;
  renderCalculo(gestoActual);
  hablar(textoExplicacion);
});

$('manual-gesto').addEventListener('change', (e) => {
  const v = e.target.value;
  reiniciarDeteccion();
  manoActual = null;
  if (v === 'cam') {
    mensajeCamara = '';
    ultimaActividad = performance.now();
    $('gesture-text').textContent = 'Modo cámara activo: muestra tu mano';
    return;
  }
  if (camaraDisponible) mensajeCamara = 'Control manual activo';
  const g = parseInt(v, 10);
  if (g === 0) {
    if (modoActual === 'exploracion') {
      $('gesture-text').textContent = 'Control manual: limpiar pantalla';
      limpiarProyeccion('manual');
    } else {
      $('gesture-text').textContent = 'En Arcade no se limpia la pantalla: responde de 1 a 5 dedos.';
    }
    return;
  }
  $('gesture-text').textContent = `Control manual: ${g} dedo(s)`;
  if (modoActual === 'exploracion') renderCalculo(g);
  else verificarRespuestaArcade(g);
});

// ==========================================
// 5. CÁMARA, DETECCIÓN DE DEDOS Y FILTRO ANTIRRUIDO
// ==========================================
const videoElement = $('webcam-video');
const outCanvas = $('output-canvas');
const outCtx = outCanvas.getContext('2d');
const CW = 280, CH = 210;
const dprCam = Math.min(window.devicePixelRatio || 1, 2);
outCanvas.width = CW * dprCam;
outCanvas.height = CH * dprCam;
outCtx.setTransform(dprCam, 0, 0, dprCam, 0, 0);

// Versión fija de MediaPipe Hands: el script y sus archivos (modelo, wasm) deben ser de la misma versión
const VERSION_HANDS = '0.4.1675469240';
// Resolución de captura: con 280×210 la mano quedaba muy chica para el modelo y los puntos temblaban.
// El visor sigue dibujándose a 280×210.
const CAPTURA_W = 640, CAPTURA_H = 480;

let camaraLista = false;
let camaraDisponible = true;
let manoActual = null;              // mano de funciones (derecha)
let manoRotar = null;               // mano de rotación (izquierda)
let mensajeCamara = 'Iniciando cámara…';

const orbeCamara = new Orbe({ marco: true, vineta: false, chispasMax: 25 });
orbeCamara.redimensionar(CW, CH, 260);

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [9, 10], [10, 11], [11, 12], [5, 9],
  [13, 14], [14, 15], [15, 16], [9, 13],
  [17, 18], [18, 19], [19, 20], [13, 17], [0, 17]
];
const PUNTAS = [4, 8, 12, 16, 20];

function setBadge(estado, texto) {
  const b = $('status-badge');
  b.className = `badge ${estado}`;
  b.textContent = texto;
}

// Dibuja la mano; las puntas de los dedos que cuentan como extendidos se ven doradas
function dibujarEsqueleto(lm, color = '#00adb5', extendidos = null) {
  outCtx.strokeStyle = color;
  outCtx.lineWidth = 2;
  for (const [i, j] of HAND_CONNECTIONS) {
    outCtx.beginPath();
    outCtx.moveTo((1 - lm[i].x) * CW, lm[i].y * CH);
    outCtx.lineTo((1 - lm[j].x) * CW, lm[j].y * CH);
    outCtx.stroke();
  }
  lm.forEach((p, i) => {
    const dedo = PUNTAS.indexOf(i);
    const esPunta = dedo >= 0;
    const activa = esPunta && (!extendidos || extendidos[dedo]);
    outCtx.beginPath();
    outCtx.arc((1 - p.x) * CW, p.y * CH, esPunta ? 5 : 3, 0, Math.PI * 2);
    outCtx.fillStyle = activa ? '#ffb703' : (esPunta ? '#555a6b' : color);
    outCtx.fill();
  });
}

// Bucle del visor — OPTIMIZADO: limitado a 30 fps
let _ultimoFrameCam = 0;
function loopCamara(t) {
  requestAnimationFrame(loopCamara);
  if (t - _ultimoFrameCam < 33) return; // ~30 fps
  _ultimoFrameCam = t;
  outCtx.fillStyle = '#121318';
  outCtx.fillRect(0, 0, CW, CH);
  orbeCamara.dibujar(outCtx, reducirMovimiento ? 0 : t, manoActual || manoRotar ? 0.3 : 1);
  if (manoActual) dibujarEsqueleto(manoActual, '#00adb5', dedosPrevios);
  if (manoRotar) dibujarEsqueleto(manoRotar, '#ff0055');
  if (mensajeCamara) {
    outCtx.fillStyle = 'rgba(13, 14, 18, 0.7)';
    outCtx.fillRect(0, CH - 26, CW, 26);
    outCtx.fillStyle = '#ffffff';
    outCtx.font = '13px Segoe UI, sans-serif';
    outCtx.textAlign = 'center';
    outCtx.fillText(mensajeCamara, CW / 2, CH - 9);
  }
}
requestAnimationFrame(loopCamara);

function revisarInactividad(ahora) {
  const inactivo = ahora - ultimaActividad;
  const restante = Math.max(1, Math.ceil((TIEMPO_INACTIVIDAD - inactivo) / 1000));
  const texto = $('gesture-text');

  if (modoActual === 'exploracion') {
    if (gestoActual === null) { texto.textContent = 'Muestra tu mano a la cámara'; return; }
    if (inactivo >= TIEMPO_INACTIVIDAD) limpiarProyeccion('inactividad');
    else if (inactivo >= TIEMPO_INACTIVIDAD - TIEMPO_AVISO) texto.textContent = `Sin actividad: la pantalla se limpia en ${restante} s`;
    else texto.textContent = 'Muestra tu mano a la cámara';
  } else {
    if (juegoPausado) { texto.textContent = 'Juego en pausa: muestra tu mano para continuar'; return; }
    if (inactivo >= TIEMPO_INACTIVIDAD) pausarArcade();
    else if (inactivo >= TIEMPO_INACTIVIDAD - TIEMPO_AVISO) texto.textContent = `Sin actividad: el juego se pausa en ${restante} s`;
    else texto.textContent = 'Muestra tu mano a la cámara';
  }
}

// La cámara no se voltea antes de enviarla a MediaPipe, así que su etiqueta sale invertida:
// "Left" corresponde a la mano DERECHA real del usuario. Si en tu equipo salen al revés, cambia este valor.
const ETIQUETA_FUNCIONES = 'Left';

let _rotPrev = null;
let _ultimoRelayout = 0;
const SENS_AZIMUT = 5;
const SENS_ELEVACION = 3;

function rotarGrafica(lm, ahora) {
  if (!lm) { _rotPrev = null; return; }
  // Centro de la palma, en coordenadas espejo (como lo ve el usuario)
  const p = { x: 1 - lm[9].x, y: lm[9].y };
  if (_rotPrev) {
    camAzimut -= (p.x - _rotPrev.x) * SENS_AZIMUT;
    camElevacion = Math.max(-1.45, Math.min(1.45, camElevacion + (p.y - _rotPrev.y) * SENS_ELEVACION));
  }
  _rotPrev = p;

  const es3D = gestoActual >= 2 && gestoActual <= 4;
  if (!es3D || typeof Plotly === 'undefined' || ahora - _ultimoRelayout < 40) return;
  _ultimoRelayout = ahora;
  Plotly.relayout('plot-holder', { 'scene.camera.eye': ojoCamara() });
}

function aspectoVideo() {
  const w = videoElement.videoWidth, h = videoElement.videoHeight;
  return w && h ? w / h : CAPTURA_W / CAPTURA_H;
}

function procesarResultados(results) {
  if ($('manual-gesto').value !== 'cam') {
    manoActual = null;
    manoRotar = null;
    return;
  }

  const ahora = performance.now();
  if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
    manoActual = null;
    manoRotar = null;
    memoriaManos.voto = 0;
    rotarGrafica(null, ahora);
    reiniciarDeteccion();
    revisarInactividad(ahora);
    return;
  }

  ({ funciones: manoActual, rotar: manoRotar } =
    Gestos.asignarManos(results.multiHandLandmarks, results.multiHandedness, ETIQUETA_FUNCIONES, memoriaManos));
  ultimaActividad = ahora;
  if (juegoPausado) reanudarArcade();

  rotarGrafica(manoRotar, ahora);
  if (!manoActual) {
    reiniciarDeteccion();
    $('gesture-text').textContent = gestoActual >= 2 && gestoActual <= 4
      ? '🔄 Rotando la gráfica (muestra la mano derecha para cambiar de función)'
      : 'Muestra la mano derecha para elegir la función';
    return;
  }

  const conteo = Gestos.contarDedos(manoActual, dedosPrevios, aspectoVideo());
  dedosPrevios = conteo.extendidos;
  bufferDedos.push(conteo.cuenta);
  if (bufferDedos.length > TAM_BUFFER) bufferDedos.shift();
  const gesto = Gestos.calcularModa(bufferDedos);
  const esPuno = gesto === 0;
  const texto = $('gesture-text');

  // Antifluctuación: el mismo número debe dominar casi todo el buffer; si el pulgar o el meñique
  // hacen saltar el conteo (3 ↔ 2 ↔ 4), se ignora y la gráfica actual no cambia.
  const concordantes = bufferDedos.filter((n) => n === gesto).length;
  if (bufferDedos.length < TAM_BUFFER || concordantes < TAM_BUFFER - 1) {
    gestoCandidato = null;
    actualizarBarra(0);
    texto.textContent = 'Detectando… mantén la mano firme';
    return;
  }

  if (gesto !== gestoCandidato) {
    gestoCandidato = gesto;
    inicioCandidato = ahora;
  }
  const progreso = Math.min((ahora - inicioCandidato) / TIEMPO_CONFIRMACION, 1);

  if (esPuno) {
    if (modoActual === 'arcade') {
      texto.textContent = '✊ En Arcade el puño no borra: muestra de 1 a 5 dedos';
      actualizarBarra(0);
      return;
    }
    if (gestoActual === null) {
      texto.textContent = '✊ La pantalla ya está limpia';
      actualizarBarra(0);
      return;
    }
    actualizarBarra(progreso, true);
    if (progreso < 1) {
      texto.textContent = '✊ Mantén el puño para limpiar la pantalla…';
      return;
    }
    texto.textContent = '✊ Pantalla limpia';
    limpiarProyeccion('puno');
    return;
  }

  actualizarBarra(progreso);
  if (progreso < 1) {
    texto.textContent = `Detectando ${gesto} dedo(s)… mantén la mano`;
    return;
  }
  texto.textContent = `Gesto confirmado: ${gesto} dedo(s)`;

  if (modoActual === 'exploracion') {
    if (gesto !== gestoActual) renderCalculo(gesto);
  } else if (ahora > bloqueoHasta && !respondido) {
    verificarRespuestaArcade(gesto);
  }
}

function activarRespaldo(textoBadge, mensaje) {
  camaraDisponible = false;
  manoActual = null;
  setBadge('off', textoBadge);
  const sel = $('manual-gesto');
  sel.querySelector('option[value="cam"]').disabled = true;
  if (sel.value === 'cam') sel.value = String(gestoActual || 1);
  $('gesture-text').textContent = mensaje;
  mensajeCamara = '📷 Usa los botones de gesto';
  document.querySelector('.gesto-panel').classList.add('destacado');
}

// La cámara se pide directamente con getUserMedia. Antes se usaba Camera de @mediapipe/camera_utils,
// que ante un permiso denegado (o sin webcam) lanzaba un alert() en inglés que bloqueaba la página
// antes de llegar a los botones de respaldo.
async function iniciarCamara() {
  if (typeof Hands === 'undefined') {
    activarRespaldo('🔴 Sin sensor', 'No se cargó MediaPipe (¿sin internet?). Usa los botones de gesto o las teclas 1 a 5.');
    return;
  }
  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    activarRespaldo('🔴 Sin cámara', 'Abre el proyecto desde localhost o https para usar la cámara. Mientras tanto, usa los botones de gesto o las teclas 1 a 5.');
    return;
  }

  setBadge('warn', '🟡 Iniciando sensor…');

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: CAPTURA_W }, height: { ideal: CAPTURA_H }, facingMode: 'user' },
      audio: false
    });
    videoElement.srcObject = stream;
    await videoElement.play();
  } catch (err) {
    console.warn('Cámara no disponible:', err && err.name);
    const motivo = err && err.name === 'NotAllowedError' ? 'permiso denegado' : 'no se encontró una cámara';
    activarRespaldo('🔴 Cámara no disponible', `No se pudo usar la cámara (${motivo}). Usa los botones de gesto o las teclas 1 a 5.`);
    return;
  }
  const pista = stream.getVideoTracks()[0];
  if (pista) {
    pista.addEventListener('ended', () => activarRespaldo('🔴 Cámara desconectada', 'Se desconectó la cámara. Usa los botones de gesto o las teclas 1 a 5.'));
  }

  let hands;
  try {
    hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${VERSION_HANDS}/${file}`
    });
  } catch (err) {
    console.error('Error al iniciar MediaPipe:', err);
    activarRespaldo('🔴 Sin sensor', 'No se pudo iniciar la detección de manos. Usa los botones de gesto o las teclas 1 a 5.');
    return;
  }
  // Modelo completo (más preciso que el "lite"); si el equipo no da abasto se baja al lite
  let complejidad = 1;
  hands.setOptions({
    maxNumHands: 2,
    modelComplexity: complejidad,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.6
  });
  hands.onResults((results) => {
    if (!camaraDisponible) return;   // llegó un cuadro que estaba en proceso cuando se cortó la cámara
    if (!camaraLista) {
      camaraLista = true;
      mensajeCamara = '';
      ultimaActividad = performance.now();
      setBadge('ok', '🟢 Sensor activo');
    }
    procesarResultados(results);
  });

  // Un cuadro por vez: no se envía el siguiente hasta que MediaPipe termine con el anterior
  const tiempos = [];
  const procesarCuadro = async () => {
    if (!camaraDisponible) return;
    if ($('manual-gesto').value === 'cam' && videoElement.readyState >= 2) {
      const t0 = performance.now();
      try {
        await hands.send({ image: videoElement });
      } catch (err) {
        console.error('Error en la detección de manos:', err);
        stream.getTracks().forEach((t) => t.stop());   // libera la cámara
        activarRespaldo('🔴 Sin sensor', 'Falló la detección de manos (¿se cortó internet al cargar el modelo?). Usa los botones de gesto o las teclas 1 a 5.');
        return;
      }
      tiempos.push(performance.now() - t0);
      if (tiempos.length === 30) {
        const promedio = tiempos.reduce((s, v) => s + v, 0) / tiempos.length;
        tiempos.length = 0;
        if (complejidad === 1 && promedio > 70) {
          complejidad = 0;
          hands.setOptions({ modelComplexity: 0 });
          console.info(`Detección lenta (${promedio.toFixed(0)} ms por cuadro): se usa el modelo lite.`);
        }
      }
    }
    requestAnimationFrame(procesarCuadro);
  };
  requestAnimationFrame(procesarCuadro);
}

// ==========================================
// 5.1 EXPLICACIÓN EN VOZ (qué hace y cómo se calcula)
// ==========================================
function errorHablado(e) {
  if (!Number.isFinite(e)) return 'no disponible';
  if (e === 0) return 'prácticamente cero';
  return `del orden de diez a la menos ${Math.abs(Math.floor(Math.log10(e)))}`;
}

const DESC_METODO = {
  adaptativo: 'reemplaza la curva por pequeñas parábolas y subdivide más solo donde la curva cambia rápido, hasta alcanzar una tolerancia relativa de una diezmilmillonésima',
  simpson: 'reemplaza la curva por pequeñas parábolas en cuatrocientos subintervalos iguales; su error baja con la cuarta potencia del paso',
  romberg: 'aplica la regla del trapecio con cada vez más subintervalos y luego extrapola con el método de Richardson para eliminar el error',
  gauss: 'evalúa la función en puntos elegidos de forma óptima y los pondera; es muy preciso con pocos puntos',
  trapecio: 'une los puntos de la curva con rectas y suma trapecios; es el más simple, pero el menos preciso'
};

const DESC_GESTO = {
  1: 'la integral definida con signo, donde las partes bajo el eje restan, y el área geométrica, que es la integral del valor absoluto de f',
  2: 'el volumen por discos, pi por la integral de f al cuadrado',
  3: 'el volumen por capas cilíndricas, dos pi por la integral del radio por la altura de cada capa',
  4: 'el área superficial, dos pi por la integral de f por la raíz de uno más la derivada al cuadrado',
  5: 'la longitud de arco, la integral de la raíz de uno más la derivada al cuadrado'
};

let textoExplicacion = '';

function construirExplicacion(gesto, clave, res) {
  let t = `Se calcula ${DESC_GESTO[gesto]}. La aplicación no busca la antiderivada: aproxima la integral con el método ${res.metodo.replace(/\(.*\)/, '').trim()}, que ${DESC_METODO[clave]}. `;
  if (gesto === 1 && res.raices.length) t += `Como f cambia de signo, el intervalo se partió en ${res.raices.length + 1} tramos en sus raíces. `;
  if (gesto === 3 && res.cruzaEje) t += 'Como el intervalo cruza el eje de giro, se toma la unión de las capas de ambos lados para no contar dos veces el mismo volumen. ';
  if (gesto === 4 || gesto === 5) t += 'La derivada de f se obtiene de forma exacta con math punto js. ';
  if (res.removibles.length) t += 'En algún punto el integrando no está definido pero su límite sí, así que se usa el límite. ';
  if (res.impropia) t += 'Es una integral impropia convergente, así que se usó la cuadratura tanh-sinh, que no evalúa los extremos. ';
  t += `El error estimado es ${errorHablado(res.error)}, y se calcula comparando con el doble de subintervalos. `;
  t += 'Cuando una integral no tiene solución exacta, como e a la menos x al cuadrado, estos métodos numéricos son justamente la forma de aproximarla.';
  textoExplicacion = t;
  $('explicacion-texto').textContent = t.replace('math punto js', 'math.js');
}

// ==========================================
// 6. INICIO
// ==========================================
actualizarPistaPreset();
renderCalculo(1);
iniciarCamara();

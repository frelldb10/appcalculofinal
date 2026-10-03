'use strict';
/* =========================================================
   CÁLCULO INTEGRAL 3D — CYBER DASHBOARD  (app.js corregido)
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
// 3. MOTOR MATEMÁTICO INTEGRAL
// ==========================================
function compilarFuncion(fStr) {
  if (typeof math === 'undefined') return null;
  try {
    const expr = math.compile(fStr);
    const f = (x) => {
      try {
        const y = expr.evaluate({ x });
        return typeof y === 'number' ? y : NaN;
      } catch (e) {
        return NaN;
      }
    };
    expr.evaluate({ x: 0.5 });
    return f;
  } catch (e) {
    return null;
  }
}

function derivada(f, x, h = 1e-5) {
  return (f(x + h) - f(x - h)) / (2 * h);
}

function simpson(g, a, b, n = 200) {
  const h = (b - a) / n;
  let sum = g(a) + g(b);
  for (let i = 1; i < n; i += 2) sum += 4 * g(a + i * h);
  for (let i = 2; i < n; i += 2) sum += 2 * g(a + i * h);
  return (h / 3) * sum;
}

function gaussLegendre(g, a, b, m = 2000) {
  const nodos = [-Math.sqrt(0.6), 0, Math.sqrt(0.6)];
  const pesos = [5 / 9, 8 / 9, 5 / 9];
  const h = (b - a) / m;
  let s = 0;
  for (let i = 0; i < m; i++) {
    const c = a + (i + 0.5) * h;
    for (let k = 0; k < 3; k++) s += pesos[k] * g(c + nodos[k] * h / 2);
  }
  return (s * h) / 2;
}

// Derivada exacta con math.js; si no se puede derivar simbólicamente, diferencias centrales
function compilarDerivada(fStr, f) {
  try {
    const d = math.compile(math.derivative(fStr, 'x').toString());
    const df = (x) => {
      try {
        const y = d.evaluate({ x });
        return typeof y === 'number' ? y : NaN;
      } catch (e) {
        return NaN;
      }
    };
    if (Number.isFinite(df(0.5))) return df;
  } catch (e) { /* sin derivada simbólica */ }
  return (x) => derivada(f, x);
}

function trapecio(g, a, b, n) {
  const h = (b - a) / n;
  let s = (g(a) + g(b)) / 2;
  for (let i = 1; i < n; i++) s += g(a + i * h);
  return s * h;
}

// Cada método devuelve { valor, error }; el error se estima comparando n con 2n (Richardson)
function trapecioConError(g, a, b, n = 400) {
  const t1 = trapecio(g, a, b, n / 2), t2 = trapecio(g, a, b, n);
  return { valor: t2, error: Math.abs(t2 - t1) / 3 };
}

function simpsonConError(g, a, b, n = 400) {
  const s1 = simpson(g, a, b, n / 2), s2 = simpson(g, a, b, n);
  return { valor: s2, error: Math.abs(s2 - s1) / 15 };
}

function gaussConError(g, a, b, m = 200) {
  const g1 = gaussLegendre(g, a, b, m / 2), g2 = gaussLegendre(g, a, b, m);
  return { valor: g2, error: Math.abs(g2 - g1) };
}

function romberg(g, a, b, maxK = 14, tol = 1e-11) {
  let prev = [(b - a) * (g(a) + g(b)) / 2];
  let error = Infinity;
  for (let k = 1; k <= maxK; k++) {
    const h = (b - a) / 2 ** (k - 1);
    let s = 0;
    for (let i = 0; i < 2 ** (k - 1); i++) s += g(a + (i + 0.5) * h);
    const fila = [prev[0] / 2 + (h * s) / 2];
    for (let j = 1; j <= k; j++) fila.push(fila[j - 1] + (fila[j - 1] - prev[j - 1]) / (4 ** j - 1));
    error = Math.abs(fila[k] - prev[k - 1]);
    prev = fila;
    if (!Number.isFinite(fila[k])) break;
    if (k >= 4 && error <= tol * Math.max(1, Math.abs(fila[k]))) break;
  }
  return { valor: prev[prev.length - 1], error };
}

// Simpson adaptativo: subdivide solo donde la función lo necesita. Parte de 8 tramos para no
// confundir una zona plana con convergencia.
function simpsonAdaptativo(g, a, b, tol = 1e-9) {
  let error = 0, evaluaciones = 0;
  const LIMITE = 200000;
  const simp = (fa, fm, fb, x0, x1) => ((x1 - x0) / 6) * (fa + 4 * fm + fb);

  function rec(x0, x1, fa, fm, fb, S, t, prof) {
    const m = (x0 + x1) / 2;
    const flm = g((x0 + m) / 2), frm = g((m + x1) / 2);
    evaluaciones += 2;
    const Si = simp(fa, flm, fm, x0, m), Sd = simp(fm, frm, fb, m, x1);
    const d = Si + Sd - S;
    if (!Number.isFinite(d)) return NaN;
    if (prof <= 0 || evaluaciones > LIMITE || Math.abs(d) <= 15 * t) {
      error += Math.abs(d) / 15;
      return Si + Sd + d / 15;
    }
    return rec(x0, m, fa, flm, fm, Si, t / 2, prof - 1) + rec(m, x1, fm, frm, fb, Sd, t / 2, prof - 1);
  }

  const N = 8, h = (b - a) / N;
  let total = 0;
  for (let i = 0; i < N; i++) {
    const x0 = a + i * h, x1 = x0 + h, xm = (x0 + x1) / 2;
    const fa = g(x0), fm = g(xm), fb = g(x1);
    total += rec(x0, x1, fa, fm, fb, simp(fa, fm, fb, x0, x1), tol / N, 20);
  }
  return { valor: total, error };
}

const METODOS = {
  adaptativo: { nombre: 'Simpson adaptativo', corto: 'Adaptativo', fn: simpsonAdaptativo },
  simpson:    { nombre: 'Simpson compuesto (n=400)', corto: 'Simpson', fn: simpsonConError },
  romberg:    { nombre: 'Romberg', corto: 'Romberg', fn: romberg },
  gauss:      { nombre: 'Gauss-Legendre', corto: 'Gauss', fn: gaussConError },
  trapecio:   { nombre: 'Trapecio (n=400)', corto: 'Trapecio', fn: trapecioConError }
};

// Puntos donde f cambia de signo (para partir la integral de |f| y evitar picos en los cruces)
function raicesEn(f, a, b, muestras = 400) {
  const raices = [];
  let xPrev = a, yPrev = f(a);
  for (let i = 1; i <= muestras; i++) {
    const x = a + ((b - a) * i) / muestras, y = f(x);
    if (Number.isFinite(yPrev) && Number.isFinite(y) && yPrev * y < 0) {
      let lo = xPrev, hi = x;
      for (let k = 0; k < 60; k++) {
        const mid = (lo + hi) / 2;
        if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid;
      }
      raices.push((lo + hi) / 2);
    }
    xPrev = x;
    yPrev = y;
  }
  return raices;
}

function integrar(g, a, b, metodo = 'adaptativo', cortes = []) {
  const m = METODOS[metodo] || METODOS.adaptativo;
  const pts = [a, ...cortes.filter((c) => c > a && c < b), b];
  let valor = 0, error = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const r = m.fn(g, pts[i], pts[i + 1]);
    valor += r.valor;
    error += r.error;
  }
  if (Number.isFinite(valor)) return { valor, error, impropia: false, metodo: m.nombre };

  // Integral impropia (la función explota en un extremo): Gauss no evalúa en los bordes
  const gl = gaussConError(g, a, b, 2000);
  return { valor: gl.valor, error: gl.error, impropia: Number.isFinite(gl.valor), metodo: 'Gauss-Legendre (impropia)' };
}

// ---------- Análisis: comparación de métodos y convergencia ----------
function formatoError(e) {
  if (!Number.isFinite(e)) return '—';
  return e === 0 ? '0' : e.toExponential(1);
}

function renderAnalisis(g, a, b, cortes, metodoUsado) {
  const card = $('analisis-card');
  const ref = integrar(g, a, b, 'romberg', cortes).valor;
  const refAd = integrar(g, a, b, 'adaptativo', cortes).valor;
  const referencia = Number.isFinite(refAd) ? refAd : ref;
  if (!Number.isFinite(referencia) || typeof Plotly === 'undefined') { card.hidden = true; return; }

  const filas = [];
  for (const [clave, m] of Object.entries(METODOS)) {
    let evals = 0;
    const gc = (x) => { evals++; return g(x); };
    const r = integrar(gc, a, b, clave, cortes);
    filas.push({ clave, nombre: m.nombre, valor: r.valor, error: r.error, evals });
  }

  const tbody = $('tabla-metodos').querySelector('tbody');
  tbody.innerHTML = '';
  for (const f of filas) {
    const tr = document.createElement('tr');
    if (f.clave === metodoUsado) tr.className = 'activo';
    [METODOS[f.clave].corto, Number.isFinite(f.valor) ? f.valor.toFixed(6) : '—', formatoError(f.error)]
      .forEach((txt) => { const td = document.createElement('td'); td.textContent = txt; tr.appendChild(td); });
    tbody.appendChild(tr);
  }

  // Convergencia: error real vs n, en escala log-log
  const ns = [4, 8, 16, 32, 64, 128, 256, 512];
  const errTrap = ns.map((n) => Math.abs(sumaPorTramos(g, a, b, cortes, (x0, x1) => trapecio(g, x0, x1, n)) - referencia));
  const errSimp = ns.map((n) => Math.abs(sumaPorTramos(g, a, b, cortes, (x0, x1) => simpson(g, x0, x1, n)) - referencia));
  const sinCero = (arr) => arr.map((e) => Math.max(e, 1e-16));
  const lay = layout2D();
  lay.showlegend = true;
  lay.legend = { orientation: 'h', y: 1.25, font: { size: 9 } };
  lay.height = 150;
  lay.font = { ...lay.font, size: 10 };
  lay.margin = { l: 45, r: 10, t: 18, b: 30 };
  lay.xaxis = { ...lay.xaxis, title: { text: 'n' }, type: 'log' };
  lay.yaxis = { ...lay.yaxis, title: { text: 'error' }, type: 'log' };
  Plotly.react('convergencia-holder', [
    { x: ns, y: sinCero(errTrap), name: 'Trapecio', mode: 'lines+markers', line: { color: '#ff0055' } },
    { x: ns, y: sinCero(errSimp), name: 'Simpson', mode: 'lines+markers', line: { color: '#00adb5' } }
  ], lay, PLOT_CONFIG);
  card.hidden = false;
}

function sumaPorTramos(g, a, b, cortes, regla) {
  const pts = [a, ...cortes.filter((c) => c > a && c < b), b];
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) s += regla(pts[i], pts[i + 1]);
  return s;
}

function linspace(a, b, n) {
  return Array.from({ length: n }, (_, i) => a + (i * (b - a)) / (n - 1));
}

// ==========================================
// 4. RENDERIZADO PLOTLY 2D / 3D NEÓN
// ==========================================
const PLOT_CONFIG = { responsive: true, displaylogo: false };

// Cada gráfica se ajusta sola cuando cambia el tamaño de su contenedor (p. ej. al aparecer la tarjeta)
if (typeof ResizeObserver !== 'undefined') {
  const ajustar = (id) => new ResizeObserver(() => {
    const el = $(id);
    if (el && el.data && typeof Plotly !== 'undefined') Plotly.Plots.resize(el);
  }).observe($(id));
  ['plot-holder', 'convergencia-holder'].forEach(ajustar);
}

const INFO = {
  1: { titulo: 'Área Bajo la Curva', unidad: 'u²', voz: 'unidades cuadradas',
       formula: 'A = ∫[a,b] |f(x)| dx', uso: 'Producción total acumulada en planta.' },
  2: { titulo: 'Volumen Sólido Eje X (Discos)', unidad: 'u³', voz: 'unidades cúbicas',
       formula: 'V = π ∫[a,b] [f(x)]² dx', uso: 'Capacidad de tanques y depósitos.' },
  3: { titulo: 'Volumen Sólido Eje Y (Capas)', unidad: 'u³', voz: 'unidades cúbicas',
       formula: 'V = 2π ∫[a,b] |x| · |f(x)| dx', uso: 'Capacidad de silos verticales.' },
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

function layout3D(etqY = 'y', etqZ = 'z') {
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
    showlegend: false,
    scene: {
      xaxis: eje('x'),
      yaxis: eje(etqY),
      zaxis: eje(etqZ),
      camera: { eye: ojoCamara() }
    }
  };
}

// Superficie de revolución alrededor del eje X — OPTIMIZADO: 22×22 puntos
function mallaRevolucionX(f, a, b, nS = 22, nR = 22) {
  const X = [], Y = [], Z = [];
  const thetas = linspace(0, 2 * Math.PI, nR);
  for (const x of linspace(a, b, nS)) {
    const r = f(x);
    X.push(thetas.map(() => x));
    Y.push(thetas.map((t) => r * Math.cos(t)));
    Z.push(thetas.map((t) => r * Math.sin(t)));
  }
  return { X, Y, Z };
}

// Superficie de revolución alrededor del eje Y — OPTIMIZADO: 22×22 puntos
function mallaRevolucionY(f, a, b, nS = 22, nR = 22) {
  const X = [], Y = [], Z = [];
  const thetas = linspace(0, 2 * Math.PI, nR);
  for (const x of linspace(a, b, nS)) {
    const h = f(x);
    X.push(thetas.map((t) => x * Math.cos(t)));
    Y.push(thetas.map((t) => x * Math.sin(t)));
    Z.push(thetas.map(() => h));
  }
  return { X, Y, Z };
}

function superficie(m, colorscale) {
  return { type: 'surface', x: m.X, y: m.Y, z: m.Z, colorscale, showscale: false, opacity: 0.95 };
}

function mostrarError(msg) {
  const r = $('result-val');
  r.classList.add('error');
  r.textContent = '⚠️ Revisa los datos';
  $('result-desc').textContent = msg;
  $('analisis-card').hidden = true;
  return false;
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

  const f = compilarFuncion(fStr);
  if (!f) {
    return mostrarError(`No se pudo interpretar "${fStr}". Usa x como variable. Ejemplos válidos: x^2, -x^2 + 4, 2x + 1, sin(x), exp(-x), sqrt(4 - x).`);
  }

  const info = INFO[gesto];
  if (!info) return false;

  let res, trazas, layout, nota = '';
  const metodo = $('metodo-select').value;
  const df = (gesto === 4 || gesto === 5) ? compilarDerivada(fStr, f) : null;
  let integrando, cortes = [];

  switch (gesto) {
    case 1: {
      integrando = (x) => Math.abs(f(x));
      cortes = raicesEn(f, a, b);
      res = integrar(integrando, a, b, metodo, cortes);
      const neta = integrar(f, a, b, metodo).valor;
      if (Number.isFinite(neta) && Math.abs(neta - res.valor) > 1e-6) {
        nota += ` La función cambia de signo: área neta (con signo) = ${neta.toFixed(4)} u².`;
      }
      const xs = linspace(a - 0.5, b + 0.5, 300);
      const xf = linspace(a, b, 200);
      trazas = [
        { x: xf, y: xf.map(f), type: 'scatter', mode: 'lines', fill: 'tozeroy',
          fillcolor: 'rgba(0,173,181,0.35)', line: { color: 'rgba(0,0,0,0)' }, hoverinfo: 'skip' },
        { x: xs, y: xs.map(f), type: 'scatter', mode: 'lines', line: { color: '#00adb5', width: 3 } }
      ];
      layout = layout2D();
      break;
    }
    case 2: {
      integrando = (x) => Math.PI * f(x) ** 2;
      res = integrar(integrando, a, b, metodo);
      trazas = [superficie(mallaRevolucionX(f, a, b), 'Viridis')];
      layout = layout3D();
      break;
    }
    case 3: {
      integrando = (x) => 2 * Math.PI * Math.abs(x) * Math.abs(f(x));
      cortes = raicesEn(f, a, b);
      res = integrar(integrando, a, b, metodo, cortes);
      if (a < 0 && b > 0) {
        nota += ' ⚠️ El intervalo cruza x = 0: las capas de ambos lados se superponen. Usa a ≥ 0 para un sólido real.';
      }
      trazas = [superficie(mallaRevolucionY(f, a, b), 'YlOrRd')];
      layout = layout3D('y', 'f(x)');
      break;
    }
    case 4: {
      integrando = (x) => 2 * Math.PI * Math.abs(f(x)) * Math.sqrt(1 + df(x) ** 2);
      cortes = raicesEn(f, a, b);
      res = integrar(integrando, a, b, metodo, cortes);
      trazas = [superficie(mallaRevolucionX(f, a, b), 'YlOrRd')];
      layout = layout3D();
      break;
    }
    case 5: {
      integrando = (x) => Math.sqrt(1 + df(x) ** 2);
      res = integrar(integrando, a, b, metodo);
      const xs = linspace(a - 0.5, b + 0.5, 300);
      const xArc = linspace(a, b, 200);
      trazas = [
        { x: xs, y: xs.map(f), type: 'scatter', mode: 'lines', line: { color: '#00adb5', width: 2 } },
        { x: xArc, y: xArc.map(f), type: 'scatter', mode: 'lines', line: { color: '#ff0055', width: 4 } }
      ];
      layout = layout2D();
      break;
    }
  }

  if (!Number.isFinite(res.valor)) {
    return mostrarError('La función no está definida (o no es derivable) en todo el intervalo [a, b]. Revisa la función o ajusta los límites.');
  }
  if (res.impropia) {
    nota += ' ℹ️ Integral impropia en un extremo: valor aproximado con cuadratura de Gauss.';
  }
  nota += ` Método: ${res.metodo}, error estimado ≈ ${formatoError(res.error)}.`;

  Plotly.react('plot-holder', trazas, layout, PLOT_CONFIG);
  const holder = $('plot-holder');
  if (holder.removeAllListeners) holder.removeAllListeners('plotly_relayout');
  if (holder.on) holder.on('plotly_relayout', sincronizarCamara);

  renderAnalisis(integrando, a, b, cortes, metodo);
  construirExplicacion(gesto, metodo, res, cortes);

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
  r.textContent = `${titulo}: ${res.valor.toFixed(decimales)} ${unidad}`;
  $('result-desc').textContent = `Fórmula: ${info.formula} — ${uso}${nota}`;

  gestoActual = gesto;
  if (modoActual === 'exploracion' && gesto !== prevGestoHablado) {
    prevGestoHablado = gesto;
    hablar(`${titulo}. ${res.valor.toFixed(Math.min(decimales, 2))} ${voz}. ${textoExplicacion}`);
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
  actualizarBarra(0);
}

function limpiarProyeccion(motivo) {
  if (typeof Plotly !== 'undefined') Plotly.purge('plot-holder');
  $('analisis-card').hidden = true;
  gestoActual = null;
  prevGestoHablado = -1;
  const r = $('result-val');
  r.classList.remove('error');
  r.textContent = '✨ Pantalla limpia';
  $('result-desc').textContent = motivo === 'inactividad'
    ? 'Se limpió por inactividad. Muestra de 1 a 5 dedos para proyectar un cálculo.'
    : 'Muestra de 1 a 5 dedos para proyectar un nuevo cálculo.';
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
  $('result-desc').textContent = 'Muestra el número de dedos correcto y mantenlo 1 segundo (o responde con el control manual).';
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

$('btn-recalc').addEventListener('click', () => {
  const man = $('manual-gesto').value;
  if (modoActual === 'arcade') {
    if (juegoPausado) { reanudarArcade(); return; }
    if (man === 'cam' || man === '0') {
      $('gesture-text').textContent = 'Elige de 1 a 5 dedos en "Control manual" para responder sin cámara.';
      return;
    }
    verificarRespuestaArcade(parseInt(man, 10));
    return;
  }
  if (man === '0') { limpiarProyeccion('manual'); return; }
  renderCalculo(man === 'cam' ? (gestoActual || 1) : parseInt(man, 10));
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

function dibujarEsqueleto(lm, color = '#00adb5') {
  outCtx.strokeStyle = color;
  outCtx.lineWidth = 2;
  for (const [i, j] of HAND_CONNECTIONS) {
    outCtx.beginPath();
    outCtx.moveTo((1 - lm[i].x) * CW, lm[i].y * CH);
    outCtx.lineTo((1 - lm[j].x) * CW, lm[j].y * CH);
    outCtx.stroke();
  }
  lm.forEach((p, i) => {
    const esPunta = PUNTAS.includes(i);
    outCtx.beginPath();
    outCtx.arc((1 - p.x) * CW, p.y * CH, esPunta ? 5 : 3, 0, Math.PI * 2);
    outCtx.fillStyle = esPunta ? '#ffb703' : color;
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
  if (manoActual) dibujarEsqueleto(manoActual);
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

function calcularModa(arr) {
  const conteo = {};
  let maxCount = 0;
  let moda = arr[0];
  for (const num of arr) {
    conteo[num] = (conteo[num] || 0) + 1;
    if (conteo[num] > maxCount) {
      maxCount = conteo[num];
      moda = num;
    }
  }
  return moda;
}

const distancia = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

function countFingers(lm) {
  let count = 0;
  for (const tip of [8, 12, 16, 20]) {
    if (distancia(lm[tip], lm[0]) > distancia(lm[tip - 2], lm[0])) count++;
  }
  if (distancia(lm[4], lm[17]) > distancia(lm[3], lm[17])) count++;
  return count;
}

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

// Derecha = funciones (dedos), izquierda = rotar la gráfica
function asignarManos(results) {
  const lados = results.multiHandedness || [];
  let funciones = null, rotar = null;
  results.multiHandLandmarks.forEach((lm, i) => {
    const etiqueta = lados[i] && lados[i].label;
    if (etiqueta === ETIQUETA_FUNCIONES && !funciones) funciones = lm;
    else if (!rotar) rotar = lm;
    else if (!funciones) funciones = lm;
  });
  return { funciones, rotar };
}

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
    rotarGrafica(null, ahora);
    reiniciarDeteccion();
    revisarInactividad(ahora);
    return;
  }

  ({ funciones: manoActual, rotar: manoRotar } = asignarManos(results));
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

  bufferDedos.push(countFingers(manoActual));
  if (bufferDedos.length > TAM_BUFFER) bufferDedos.shift();
  const gesto = calcularModa(bufferDedos);
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
  mensajeCamara = '📷 Cámara no disponible';
}

function iniciarCamara() {
  if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
    activarRespaldo('🔴 Sin sensor', 'No se cargó MediaPipe (¿sin internet?). Usa el control manual.');
    return;
  }
  if (!window.isSecureContext || !navigator.mediaDevices) {
    activarRespaldo('🔴 Sin cámara', 'Abre el proyecto desde localhost o https para usar la cámara. Mientras tanto, usa el control manual.');
    return;
  }

  setBadge('warn', '🟡 Iniciando sensor…');

  try {
    const hands = new Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });
    hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 0,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5
    });
    hands.onResults((results) => {
      if (!camaraLista) {
        camaraLista = true;
        mensajeCamara = '';
        ultimaActividad = performance.now();
        setBadge('ok', '🟢 Sensor activo');
      }
      procesarResultados(results);
    });

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        if ($('manual-gesto').value === 'cam') await hands.send({ image: videoElement });
      },
      width: CW,
      height: CH
    });

    Promise.resolve(camera.start()).catch((err) => {
      console.error('Error de cámara:', err);
      activarRespaldo('🔴 Cámara no disponible', 'No se pudo acceder a la cámara (permiso denegado o sin dispositivo). Usa el control manual.');
    });
  } catch (err) {
    console.error('Error al iniciar MediaPipe:', err);
    activarRespaldo('🔴 Sin sensor', 'No se pudo iniciar la detección de manos. Usa el control manual.');
  }
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
  adaptativo: 'reemplaza la curva por pequeñas parábolas y subdivide más solo donde la curva cambia rápido, hasta alcanzar una tolerancia de una milmillonésima',
  simpson: 'reemplaza la curva por pequeñas parábolas en cuatrocientos subintervalos iguales; su error baja con la cuarta potencia del paso',
  romberg: 'aplica la regla del trapecio con cada vez más subintervalos y luego extrapola con el método de Richardson para eliminar el error',
  gauss: 'evalúa la función en puntos elegidos de forma óptima y los pondera; es muy preciso con pocos puntos',
  trapecio: 'une los puntos de la curva con rectas y suma trapecios; es el más simple, pero el menos preciso'
};

const DESC_GESTO = {
  1: 'el área bajo la curva, la integral del valor absoluto de f',
  2: 'el volumen por discos, pi por la integral de f al cuadrado',
  3: 'el volumen por capas cilíndricas, dos pi por la integral de x por f',
  4: 'el área superficial, dos pi por la integral de f por la raíz de uno más la derivada al cuadrado',
  5: 'la longitud de arco, la integral de la raíz de uno más la derivada al cuadrado'
};

let textoExplicacion = '';

function construirExplicacion(gesto, clave, res, cortes) {
  let t = `Se calcula ${DESC_GESTO[gesto]}. La aplicación no busca la antiderivada: aproxima la integral con el método ${res.metodo.replace(/\(.*\)/, '').trim()}, que ${DESC_METODO[clave]}. `;
  if (cortes.length) t += `Como f cambia de signo, el intervalo se partió en ${cortes.length + 1} tramos en sus raíces. `;
  if (gesto === 4 || gesto === 5) t += 'La derivada de f se obtiene de forma exacta con math punto js. ';
  if (res.impropia) t += 'Es una integral impropia, así que se usó cuadratura de Gauss. ';
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
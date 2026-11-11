/* =========================================================
   MOTOR DE CÁLCULO INTEGRAL (sin DOM)
   Lo usa la app en el navegador (window.Calculo) y las pruebas en Node (require).
   ========================================================= */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.Calculo = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ==========================================
  // 1. UTILIDADES
  // ==========================================
  function linspace(a, b, n) {
    if (n < 2) return [a];
    const paso = (b - a) / (n - 1);
    // el último punto se fija en b para no salirse del intervalo por redondeo
    return Array.from({ length: n }, (_, i) => (i === n - 1 ? b : a + i * paso));
  }

  function formatear(v, decimales = 4) {
    if (!Number.isFinite(v)) return '—';
    const abs = Math.abs(v);
    if (abs < 0.5 * Math.pow(10, -decimales)) return (0).toFixed(decimales);
    if (abs >= 1e7) return v.toExponential(3);
    return v.toFixed(decimales);
  }

  function derivadaNumerica(f, x) {
    const h = 1e-5 * Math.max(1, Math.abs(x));
    return (f(x + h) - f(x - h)) / (2 * h);
  }

  // ==========================================
  // 2. INTERPRETAR f(x) CON math.js
  // ==========================================
  // Acepta la escritura de clase: sen(x), tg(x), ln(x), √x, π, x², "y =" o "f(x) =" al inicio
  function normalizarExpresion(texto) {
    return String(texto || '')
      .trim()
      .replace(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, '')
      .replace(/\bsen\s*\(/gi, 'sin(')
      .replace(/\btg\s*\(/gi, 'tan(')
      .replace(/\bln\s*\(/gi, 'log(')
      .replace(/√\s*\(/g, 'sqrt(')
      .replace(/√\s*([a-z0-9.]+)/gi, 'sqrt($1)')
      .replace(/π/g, 'pi')
      .replace(/²/g, '^2')
      .replace(/³/g, '^3')
      .replace(/[·×]/g, '*')
      .replace(/−/g, '-');
  }

  function envolver(compilada) {
    return (x) => {
      try {
        const y = compilada.evaluate({ x });
        return typeof y === 'number' ? y : NaN;   // números complejos (sqrt de negativo) => NaN
      } catch (e) {
        return NaN;
      }
    };
  }

  // Símbolos permitidos además de las funciones: la variable x y las constantes de math.js
  const CONSTANTES = new Set(['x', 'e', 'E', 'pi', 'PI', 'tau', 'phi', 'Infinity',
                              'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT1_2', 'SQRT2']);

  // Variables que no son x. Hay que revisarlas a mano: en math.js letras como t, m, g, s, h o b son
  // UNIDADES (tonelada, metro, gramo…), así que "m*x + b" no daba error sino NaN en todo el intervalo.
  function simbolosDesconocidos(nodo) {
    const libres = new Set();
    nodo.traverse((n, ruta, padre) => {
      const esNombreDeFuncion = padre && padre.isFunctionNode && ruta === 'fn';
      if (n.isSymbolNode && !esNombreDeFuncion && !CONSTANTES.has(n.name)) libres.add(n.name);
    });
    return [...libres];
  }

  function compilarFuncion(texto, mathLib) {
    const m = mathLib || (typeof math !== 'undefined' ? math : null);
    const limpio = normalizarExpresion(texto);
    if (!m || !limpio) return null;
    try {
      const nodo = m.parse(limpio);
      if (simbolosDesconocidos(nodo).length) return null;
      const expr = nodo.compile();
      expr.evaluate({ x: 0.5 });              // lanza error si la expresión no se puede evaluar
      const f = envolver(expr);
      f.texto = limpio;
      return f;
    } catch (e) {
      return null;
    }
  }

  // Derivada exacta con math.js. Antes se comprobaba solo en x = 0.5, lo que descartaba la derivada
  // simbólica de funciones como sqrt(x - 1) en [1, 3]; ahora se comprueba dentro de [a, b].
  function compilarDerivada(texto, f, a, b, mathLib) {
    const m = mathLib || (typeof math !== 'undefined' ? math : null);
    if (m) {
      try {
        const nodo = m.derivative(normalizarExpresion(texto), 'x');
        const df = envolver(nodo.compile());
        if (linspace(a, b, 9).some((x) => Number.isFinite(df(x)))) {
          return { df, texto: nodo.toString(), simbolica: true };
        }
      } catch (e) { /* sin derivada simbólica */ }
    }
    return { df: (x) => derivadaNumerica(f, x), texto: 'aproximada con diferencias centrales', simbolica: false };
  }

  // ==========================================
  // 3. REGLAS DE INTEGRACIÓN NUMÉRICA
  // ==========================================
  function trapecio(g, a, b, n) {
    const h = (b - a) / n;
    let s = (g(a) + g(b)) / 2;
    for (let i = 1; i < n; i++) s += g(a + i * h);
    return s * h;
  }

  function simpson(g, a, b, n = 200) {
    if (n % 2) n++;
    const h = (b - a) / n;
    let sum = g(a) + g(b);
    for (let i = 1; i < n; i += 2) sum += 4 * g(a + i * h);
    for (let i = 2; i < n; i += 2) sum += 2 * g(a + i * h);
    return (h / 3) * sum;
  }

  const NODOS_GAUSS = [-Math.sqrt(0.6), 0, Math.sqrt(0.6)];
  const PESOS_GAUSS = [5 / 9, 8 / 9, 5 / 9];

  function gaussLegendre(g, a, b, m = 200) {
    const h = (b - a) / m;
    let s = 0;
    for (let i = 0; i < m; i++) {
      const c = a + (i + 0.5) * h;
      for (let k = 0; k < 3; k++) s += PESOS_GAUSS[k] * g(c + NODOS_GAUSS[k] * h / 2);
    }
    return (s * h) / 2;
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

  // Gauss de 3 puntos tiene orden 6: el error de g2 es |g2 - g1| / (2^6 - 1)
  function gaussConError(g, a, b, m = 200) {
    const g1 = gaussLegendre(g, a, b, m / 2), g2 = gaussLegendre(g, a, b, m);
    return { valor: g2, error: Math.abs(g2 - g1) / 63 };
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

  // Simpson adaptativo con tolerancia RELATIVA. Con la tolerancia absoluta anterior (1e-9), funciones
  // grandes como exp(x) en [0, 20] pedían ~150 000 evaluaciones y congelaban la página.
  function simpsonAdaptativo(g, a, b, tol = 1e-10) {
    let error = 0, evaluaciones = 0, agotado = false;
    const LIMITE = 100000;
    const simp = (fa, fm, fb, x0, x1) => ((x1 - x0) / 6) * (fa + 4 * fm + fb);

    function rec(x0, x1, fa, fm, fb, S, t, prof) {
      const m = (x0 + x1) / 2;
      const flm = g((x0 + m) / 2), frm = g((m + x1) / 2);
      evaluaciones += 2;
      const Si = simp(fa, flm, fm, x0, m), Sd = simp(fm, frm, fb, m, x1);
      const d = Si + Sd - S;
      if (!Number.isFinite(d)) return NaN;
      const cumple = Math.abs(d) <= 15 * t;
      if (cumple || prof <= 0 || evaluaciones > LIMITE) {
        // sin alcanzar la tolerancia (p. ej. tan(x) cerca de π/2, que en coma flotante no es ∞)
        if (!cumple) agotado = true;
        error += Math.abs(d) / 15;
        return Si + Sd + d / 15;
      }
      return rec(x0, m, fa, flm, fm, Si, t / 2, prof - 1) + rec(m, x1, fm, frm, fb, Sd, t / 2, prof - 1);
    }

    // Parte de 8 tramos para no confundir una zona plana con convergencia
    const N = 8, h = (b - a) / N;
    const xs = Array.from({ length: N + 1 }, (_, i) => (i === N ? b : a + i * h));
    const ys = xs.map(g);
    const ms = xs.slice(0, N).map((x, i) => g((x + xs[i + 1]) / 2));
    const S0 = ms.map((fm, i) => simp(ys[i], fm, ys[i + 1], xs[i], xs[i + 1]));
    const escala = S0.reduce((s, v) => s + Math.abs(v), 0);
    if (!Number.isFinite(escala)) return { valor: NaN, error: NaN };
    const tolAbs = Math.max(tol * escala, 1e-14);

    let total = 0;
    for (let i = 0; i < N; i++) total += rec(xs[i], xs[i + 1], ys[i], ms[i], ys[i + 1], S0[i], tolAbs / N, 25);
    return { valor: total, error, agotado };
  }

  // Cuadratura tanh-sinh (doble exponencial): nunca evalúa los extremos y concentra los nodos cerca de
  // ellos, así que integra bien singularidades como 1/√(1 - x²). Reemplaza al respaldo con Gauss, que
  // daba 3.1305 en vez de π para el arco de una semicircunferencia.
  function tanhSinh(g, a, b, tol = 1e-12) {
    const c = (a + b) / 2, d = (b - a) / 2;
    const TMAX = 3.2;
    const nodo = (t) => {
      const u = (Math.PI / 2) * Math.sinh(t);
      const ch = Math.cosh(u);
      const w = (d * (Math.PI / 2) * Math.cosh(t)) / (ch * ch);
      const delta = (2 * d) / (Math.exp(2 * Math.abs(u)) + 1);   // distancia al extremo más cercano
      return { x: t >= 0 ? b - delta : a + delta, w };
    };
    let cola = 0;                     // aporte de los nodos más extremos (sirve para detectar divergencia)
    const termino = (t) => {
      const { x, w } = nodo(t);
      if (!(w > 0) || !Number.isFinite(w) || x <= a || x >= b) return 0;
      const y = g(x);
      if (!Number.isFinite(y)) return NaN;
      if (Math.abs(t) >= TMAX - 0.25) cola = Math.max(cola, Math.abs(w * y));
      return w * y;
    };

    let h = 1;
    let suma = termino(0);
    for (let j = 1; j * h <= TMAX; j++) suma += termino(j * h) + termino(-j * h);
    let valor = suma * h, anterior = NaN, error = Infinity;

    for (let nivel = 1; nivel <= 7 && Number.isFinite(valor); nivel++) {
      h /= 2;
      for (let j = 1; j * h <= TMAX; j += 2) suma += termino(j * h) + termino(-j * h);
      anterior = valor;
      valor = suma * h;
      error = Math.abs(valor - anterior);
      if (nivel >= 3 && error <= tol * Math.max(1, Math.abs(valor))) break;
    }
    // En una integral convergente los nodos más pegados al extremo aportan casi nada (decaen de forma
    // doblemente exponencial). Si todavía pesan (1/x) o los niveles no se ponen de acuerdo (un polo
    // dentro del intervalo), la integral impropia diverge.
    const escala = Math.max(1, Math.abs(valor));
    const diverge = Number.isFinite(valor) && (cola / escala > 0.05 || error / escala > 1e-2);
    return { valor: diverge ? Infinity : valor, error: error + cola * h, diverge };
  }

  const METODOS = {
    adaptativo: { nombre: 'Simpson adaptativo', corto: 'Adaptativo', fn: simpsonAdaptativo },
    simpson:    { nombre: 'Simpson compuesto (n=400)', corto: 'Simpson', fn: simpsonConError },
    romberg:    { nombre: 'Romberg', corto: 'Romberg', fn: romberg },
    gauss:      { nombre: 'Gauss-Legendre', corto: 'Gauss', fn: gaussConError },
    trapecio:   { nombre: 'Trapecio (n=400)', corto: 'Trapecio', fn: trapecioConError }
  };

  // ==========================================
  // 4. INTEGRAR CON SEGURIDAD (raíces, singularidades)
  // ==========================================
  // Puntos donde f cambia de signo (para partir la integral de |f| y no promediar los picos de los cruces)
  function raicesEn(f, a, b, muestras = 1000) {
    const raices = [];
    if (!(b > a)) return raices;
    let xUlt = a, yUlt = f(a);          // última muestra finita y distinta de cero
    for (let i = 1; i <= muestras; i++) {
      const x = i === muestras ? b : a + ((b - a) * i) / muestras;
      const y = f(x);
      if (!Number.isFinite(y)) { yUlt = NaN; continue; }
      if (y === 0) continue;
      if (Number.isFinite(yUlt) && yUlt !== 0 && yUlt * y < 0) {
        let lo = xUlt, hi = x, flo = yUlt;
        for (let k = 0; k < 60; k++) {
          const mid = (lo + hi) / 2, fm = f(mid);
          if (!Number.isFinite(fm)) break;
          if (fm === 0) { lo = hi = mid; break; }
          if (flo * fm < 0) hi = mid; else { lo = mid; flo = fm; }
        }
        raices.push((lo + hi) / 2);
      }
      xUlt = x;
      yUlt = y;
    }
    return raices;
  }

  function puntosTramos(a, b, cortes = []) {
    const eps = 1e-12 * (b - a);
    const internos = cortes.filter((c) => Number.isFinite(c) && c > a + eps && c < b - eps).sort((p, q) => p - q);
    const pts = [a];
    for (const c of internos) if (c - pts[pts.length - 1] > eps) pts.push(c);
    pts.push(b);
    return pts;
  }

  // Límite lateral: si g(x ± 1e-6) y g(x ± 1e-9) coinciden, el límite existe y es finito
  function limiteLateral(g, x, dir, escala) {
    const v1 = g(x + dir * 1e-6 * escala);
    const v2 = g(x + dir * 1e-9 * escala);
    if (!Number.isFinite(v1) || !Number.isFinite(v2)) return NaN;
    return Math.abs(v1 - v2) <= 1e-4 * Math.max(1, Math.abs(v1), Math.abs(v2)) ? v2 : NaN;
  }

  // Si g no está definida en un punto aislado pero sus límites laterales sí (0·∞ en la esfera, 0/0 en
  // sin(x)/x, el salto de |x|/x), se usa el límite. Un punto aislado no cambia el valor de la integral.
  function integrandoSeguro(g, escala) {
    const parches = [];
    const seguro = (x) => {
      const y = g(x);
      if (Number.isFinite(y)) return y;
      const izq = limiteLateral(g, x, -1, escala), der = limiteLateral(g, x, 1, escala);
      let L;
      if (Number.isFinite(izq) && Number.isFinite(der)) L = (izq + der) / 2;
      else if (Number.isFinite(izq)) L = izq;
      else if (Number.isFinite(der)) L = der;
      else return NaN;
      if (parches.length < 10 && !parches.some((p) => Math.abs(p - x) < 1e-9 * escala)) parches.push(x);
      return L;
    };
    return { g: seguro, parches };
  }

  // opciones.respaldo = false: no usar tanh-sinh si el método elegido falla (para la tabla comparativa)
  function integrar(g, a, b, metodo = 'adaptativo', cortes = [], opciones = {}) {
    const m = METODOS[metodo] || METODOS.adaptativo;
    if (a === b) return { valor: 0, error: 0, metodo: m.nombre, impropia: false, diverge: false, removibles: [] };
    const seguro = integrandoSeguro(g, Math.abs(b - a));
    const pts = puntosTramos(a, b, cortes);

    let valor = 0, error = 0, agotado = false;
    for (let i = 0; i < pts.length - 1; i++) {
      const r = m.fn(seguro.g, pts[i], pts[i + 1]);
      valor += r.valor;
      error += r.error;
      agotado = agotado || !!r.agotado;
    }
    const base = { metodo: m.nombre, impropia: false, diverge: false, removibles: seguro.parches };
    if (Number.isFinite(valor) && !agotado) return { ...base, valor, error };
    if (opciones.respaldo === false) {
      return Number.isFinite(valor) ? { ...base, valor, error } : { ...base, valor: NaN, error: NaN };
    }

    // Integral impropia (la función explota en un extremo o en un corte) o el adaptativo no convergió
    let v2 = 0, e2 = 0, diverge = false;
    for (let i = 0; i < pts.length - 1; i++) {
      const r = tanhSinh(seguro.g, pts[i], pts[i + 1]);
      v2 += r.valor;
      e2 += r.error;
      diverge = diverge || r.diverge;
    }
    if (diverge) return { ...base, valor: NaN, error: NaN, metodo: 'Tanh-sinh (doble exponencial)', diverge: true };
    if (!Number.isFinite(v2)) {
      // tanh-sinh cayó justo en un punto no definido: si el adaptativo dio un valor, se conserva
      return Number.isFinite(valor) ? { ...base, valor, error } : { ...base, valor: NaN, error: NaN };
    }
    return {
      ...base,
      valor: v2,
      error: e2,
      metodo: 'Tanh-sinh (doble exponencial)',
      impropia: !Number.isFinite(valor)
    };
  }

  // Une los resultados de varios tramos en uno solo
  function combinar(resultados) {
    const salida = { valor: 0, error: 0, impropia: false, diverge: false, removibles: [], metodo: '' };
    for (const r of resultados) {
      salida.valor += r.valor;
      salida.error += r.error;
      salida.impropia = salida.impropia || r.impropia;
      salida.diverge = salida.diverge || r.diverge;
      salida.removibles.push(...r.removibles);
      if (!salida.metodo || r.impropia) salida.metodo = r.metodo;
    }
    return salida;
  }

  // ==========================================
  // 5. LAS CINCO MAGNITUDES DE LA APP
  // ==========================================
  // 1) Integral con signo y área geométrica. Se integra cada tramo entre raíces por separado:
  //    integral = Σ Iₖ  (las partes bajo el eje restan)   ·   área = Σ |Iₖ|  (todas suman)
  function calcularArea(f, a, b, metodo) {
    const raices = raicesEn(f, a, b);
    const pts = puntosTramos(a, b, raices);
    const tramos = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const r = integrar(f, pts[i], pts[i + 1], metodo);
      tramos.push({ desde: pts[i], hasta: pts[i + 1], valor: r.valor, r });
    }
    const total = combinar(tramos.map((t) => t.r));
    let area = 0, positiva = 0, negativa = 0;
    for (const t of tramos) {
      area += Math.abs(t.valor);
      if (t.valor >= 0) positiva += t.valor; else negativa += t.valor;
    }
    return {
      ...total,
      valor: Number.isFinite(total.valor) ? area : NaN,
      integral: total.valor,
      area, positiva, negativa, raices,
      tramos: tramos.map(({ desde, hasta, valor }) => ({ desde, hasta, valor })),
      integrando: (x) => Math.abs(f(x)),
      cortes: raices,
      dominio: [a, b]
    };
  }

  // 2) Discos alrededor del eje X: V = π ∫ [f(x)]² dx
  function calcularVolumenX(f, a, b, metodo) {
    const integrando = (x) => Math.PI * f(x) ** 2;
    const r = integrar(integrando, a, b, metodo);
    return { ...r, integrando, cortes: [], dominio: [a, b] };
  }

  // Sección del sólido que se forma al girar la región entre f y el eje X alrededor del eje Y.
  // A distancia r del eje pueden aportar dos lados: x = r (si r ∈ [a, b]) y x = -r (si -r ∈ [a, b]).
  // Cada lado aporta el segmento vertical entre 0 y f; la sección es la UNIÓN de esos segmentos.
  function perfilEjeY(f, a, b) {
    const rMin = a >= 0 ? a : (b <= 0 ? -b : 0);
    const rMax = Math.max(Math.abs(a), Math.abs(b));
    const alturas = (r) => {
      let arriba = 0, abajo = 0;
      for (const x of [r, -r]) {
        if (x < a || x > b) continue;
        const y = f(x);
        if (!Number.isFinite(y)) return { arriba: NaN, abajo: NaN };
        arriba = Math.max(arriba, y);
        abajo = Math.min(abajo, y);
      }
      return { arriba, abajo };
    };
    return { rMin, rMax, alturas, cruzaEje: a < 0 && b > 0 };
  }

  // 3) Capas cilíndricas alrededor del eje Y: V = 2π ∫ r · h(r) dr, con h(r) = altura de la sección.
  //    Si a ≥ 0 coincide con la fórmula de clase 2π ∫ x |f(x)| dx. Si el intervalo cruza x = 0, la
  //    versión anterior sumaba las capas de ambos lados aunque ocupan el mismo espacio (doble conteo).
  function calcularVolumenY(f, a, b, metodo) {
    const p = perfilEjeY(f, a, b);
    const integrando = (r) => {
      const h = p.alturas(r);
      return 2 * Math.PI * r * (h.arriba - h.abajo);
    };
    const cortes = [];
    if (b > 0) {
      const lo = Math.max(a, 0);
      cortes.push(lo, b, ...raicesEn(f, lo, b));
    }
    if (a < 0) {
      const lo = Math.max(-b, 0);
      cortes.push(lo, -a, ...raicesEn((r) => f(-r), lo, -a));
    }
    if (p.cruzaEje) cortes.push(...raicesEn((r) => f(r) - f(-r), 0, Math.min(-a, b)));

    const r = integrar(integrando, p.rMin, p.rMax, metodo, cortes);
    let sinCorregir = null;
    if (p.cruzaEje) {
      sinCorregir = integrar((x) => 2 * Math.PI * Math.abs(x) * Math.abs(f(x)), a, b, metodo, [0, ...raicesEn(f, a, b)]).valor;
    }
    return { ...r, integrando, cortes, dominio: [p.rMin, p.rMax], perfil: p, cruzaEje: p.cruzaEje, sinCorregir };
  }

  // 4) Área de la superficie lateral al girar alrededor del eje X: S = 2π ∫ |f| √(1 + f'²) dx
  function calcularSuperficie(f, df, a, b, metodo) {
    const integrando = (x) => 2 * Math.PI * Math.abs(f(x)) * Math.hypot(1, df(x));
    const cortes = raicesEn(f, a, b);
    const r = integrar(integrando, a, b, metodo, cortes);
    const fa = f(a), fb = f(b);
    const tapas = Math.PI * ((Number.isFinite(fa) ? fa * fa : 0) + (Number.isFinite(fb) ? fb * fb : 0));
    return { ...r, integrando, cortes, dominio: [a, b], tapas };
  }

  // 5) Longitud de arco: L = ∫ √(1 + f'²) dx. La cuerda (recta entre los extremos) es una cota inferior.
  function calcularLongitudArco(f, df, a, b, metodo) {
    const integrando = (x) => Math.hypot(1, df(x));
    const r = integrar(integrando, a, b, metodo);
    const cuerda = Math.hypot(b - a, f(b) - f(a));
    return { ...r, integrando, cortes: [], dominio: [a, b], cuerda };
  }

  // ==========================================
  // 6. SUMAS DE RIEMANN (laboratorio)
  // ==========================================
  const TIPOS_RIEMANN = ['izquierda', 'medio', 'derecha', 'trapecio'];

  // Funciona también con a > b: Δx sale negativo y la suma cambia de signo, igual que la integral
  function sumaRiemann(f, a, b, n, tipo = 'izquierda') {
    n = Math.max(1, Math.floor(n));
    const dx = (b - a) / n;
    const piezas = [];
    let suma = 0;
    for (let k = 0; k < n; k++) {
      const x0 = a + k * dx;
      const x1 = k === n - 1 ? b : a + (k + 1) * dx;
      let pieza;
      if (tipo === 'trapecio') {
        const y0 = f(x0), y1 = f(x1);
        pieza = { x0, x1, y0, y1, xm: null, altura: (y0 + y1) / 2 };
      } else {
        const xm = tipo === 'derecha' ? x1 : tipo === 'medio' ? (x0 + x1) / 2 : x0;
        const y = f(xm);
        pieza = { x0, x1, y0: y, y1: y, xm, altura: y };
      }
      pieza.aporte = pieza.altura * dx;
      suma += pieza.aporte;
      piezas.push(pieza);
    }
    return { suma, dx, n, tipo, piezas };
  }

  // Monotonía y concavidad muestreadas: sirven para explicar si una suma sobreestima o subestima
  function analizarForma(f, a, b, muestras = 80) {
    const lo = Math.min(a, b), hi = Math.max(a, b);
    if (!(hi > lo)) return null;
    const xs = linspace(lo, hi, muestras + 1), ys = xs.map(f);
    if (ys.some((y) => !Number.isFinite(y))) return null;
    const eps = 1e-9 * Math.max(1e-12, ...ys.map(Math.abs));
    let crece = true, decrece = true, convexa = true, concava = true;
    for (let i = 0; i < muestras; i++) {
      const d = ys[i + 1] - ys[i];
      if (d < -eps) crece = false;
      if (d > eps) decrece = false;
    }
    for (let i = 1; i < muestras; i++) {
      const d2 = ys[i + 1] - 2 * ys[i] + ys[i - 1];
      if (d2 < -eps) convexa = false;
      if (d2 > eps) concava = false;
    }
    return {
      creciente: crece && !decrece,
      decreciente: decrece && !crece,
      constante: crece && decrece,
      convexa: convexa && !concava,
      concava: concava && !convexa,
      lineal: convexa && concava
    };
  }

  return {
    linspace, formatear, derivadaNumerica,
    normalizarExpresion, compilarFuncion, compilarDerivada,
    trapecio, simpson, gaussLegendre, romberg, simpsonAdaptativo, tanhSinh,
    trapecioConError, simpsonConError, gaussConError,
    METODOS, raicesEn, puntosTramos, integrandoSeguro, integrar,
    calcularArea, calcularVolumenX, perfilEjeY, calcularVolumenY, calcularSuperficie, calcularLongitudArco,
    TIPOS_RIEMANN, sumaRiemann, analizarForma
  };
});

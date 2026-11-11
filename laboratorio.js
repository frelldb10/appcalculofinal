'use strict';
/* =========================================================
   LABORATORIO MATEMÁTICO INTERACTIVO
   Sumas de Riemann en tiempo real: límites de integración, número de subintervalos y tipo de suma.
   Usa Calculo (calculo.js) y, de app.js: $, layout2D, PLOT_CONFIG, renderCalculo, modoActual,
   actualizarPistaPreset y reducirMovimiento.
   ========================================================= */
(function () {
  const C = Calculo;
  const fmt = C.formatear;

  const NOMBRE_TIPO = { izquierda: 'izquierda', medio: 'de punto medio', derecha: 'derecha', trapecio: 'de trapecios' };
  const REGLA_TIPO = {
    izquierda: 'se evalúa f en el extremo izquierdo de cada subintervalo: xₖ* = a + (k − 1)·Δx.',
    medio: 'se evalúa f en el centro de cada subintervalo: xₖ* = a + (k − ½)·Δx.',
    derecha: 'se evalúa f en el extremo derecho de cada subintervalo: xₖ* = a + k·Δx.',
    trapecio: 'cada franja es un trapecio que usa los dos extremos: [f(xₖ₋₁) + f(xₖ)] / 2 · Δx.'
  };
  // Orden del error: izquierda/derecha ~ 1/n, punto medio/trapecios ~ 1/n²
  const ORDEN = { izquierda: 1, derecha: 1, medio: 2, trapecio: 2 };
  const COLOR_TIPO = { izquierda: '#ff0055', medio: '#00ffcc', derecha: '#ffb703', trapecio: '#a78bfa' };
  const N_CONVERGENCIA = [1, 2, 4, 8, 16, 32, 64, 128, 256];
  const SECUENCIA_ANIMACION = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50, 64, 80, 100];

  const estado = {
    tipo: 'izquierda',
    texto: null, f: null,           // función compilada (se recompila solo si cambia el texto)
    clave: '', base: null,          // integral, área, forma y convergencia (dependen de f, a y b)
    pendiente: false,
    animacion: null
  };

  // ---------- utilidades ----------
  const subindice = (n) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);
  const leerNumero = (id) => parseFloat($(id).value);

  function mensaje(texto) {
    const p = $('lab-mensaje');
    p.hidden = !texto;
    p.textContent = texto || '';
  }

  function programar() {
    if (estado.pendiente) return;
    estado.pendiente = true;
    requestAnimationFrame(() => {
      estado.pendiente = false;
      render();
    });
  }

  // El deslizador y el campo numérico de cada límite se mantienen sincronizados
  function sincronizar(idRango, idNumero) {
    const rango = $(idRango), numero = $(idNumero);
    rango.addEventListener('input', () => { numero.value = rango.value; programar(); });
    numero.addEventListener('input', () => {
      const v = parseFloat(numero.value);
      if (Number.isFinite(v)) {
        // si el valor se sale del deslizador, se amplía su recorrido
        if (v < parseFloat(rango.min)) rango.min = Math.floor(v);
        if (v > parseFloat(rango.max)) rango.max = Math.ceil(v);
        rango.value = v;
      }
      programar();
    });
  }

  function fijarLimites(a, b) {
    for (const [id, v] of [['lab-a', a], ['lab-b', b]]) {
      const rango = $(id);
      if (v < parseFloat(rango.min)) rango.min = Math.floor(v);
      if (v > parseFloat(rango.max)) rango.max = Math.ceil(v);
      rango.value = v;
      $(`${id}-num`).value = v;
    }
  }

  // ---------- cálculos que solo dependen de f, a y b (se guardan para no repetirlos al mover n) ----------
  function calcularBase(f, a, b) {
    const lo = Math.min(a, b), hi = Math.max(a, b), signo = a < b ? 1 : -1;
    const area = C.calcularArea(f, lo, hi, 'adaptativo');
    const integral = signo * area.integral;
    const convergencia = {};
    for (const tipo of C.TIPOS_RIEMANN) {
      convergencia[tipo] = N_CONVERGENCIA.map((n) => Math.abs(C.sumaRiemann(f, a, b, n, tipo).suma - integral));
    }
    return {
      lo, hi, signo, integral,
      area: area.area,
      cruzaEje: area.positiva > 0 && area.negativa < 0,
      errorRef: area.error,
      diverge: area.diverge || !Number.isFinite(area.integral),
      forma: C.analizarForma(f, a, b),
      convergencia
    };
  }

  // ---------- gráfica principal ----------
  function graficar(f, suma, base) {
    const { lo, hi } = base;
    const pad = 0.12 * (hi - lo);
    const xs = C.linspace(lo - pad, hi + pad, 400);
    const xr = C.linspace(lo, hi, 300);
    const yr = xr.map((x) => { const y = f(x); return Number.isFinite(y) ? y : null; });

    // Todas las franjas en dos trazas (positivas y negativas), separadas por null: rápido aun con n = 200
    const pos = { x: [], y: [] }, neg = { x: [], y: [] };
    for (const p of suma.piezas) {
      const destino = p.altura >= 0 ? pos : neg;
      destino.x.push(p.x0, p.x0, p.x1, p.x1, p.x0, null);
      destino.y.push(0, p.y0, p.y1, 0, 0, null);
    }
    const borde = suma.n > 120 ? 0.5 : 1;
    const trazas = [
      { x: xr, y: yr, type: 'scatter', mode: 'lines', fill: 'tozeroy', fillcolor: 'rgba(255, 255, 255, 0.05)',
        line: { color: 'rgba(0,0,0,0)' }, hoverinfo: 'skip', showlegend: false },
      { ...pos, type: 'scatter', mode: 'lines', fill: 'toself', fillcolor: 'rgba(0, 173, 181, 0.35)',
        line: { color: '#00adb5', width: borde }, name: 'Aporte positivo', hoverinfo: 'skip' },
      { ...neg, type: 'scatter', mode: 'lines', fill: 'toself', fillcolor: 'rgba(255, 0, 85, 0.35)',
        line: { color: '#ff0055', width: borde }, name: 'Aporte negativo', hoverinfo: 'skip' },
      { x: xs, y: xs.map((x) => { const y = f(x); return Number.isFinite(y) ? y : null; }), type: 'scatter',
        mode: 'lines', name: 'f(x)', line: { color: '#ffffff', width: 2.5 } }
    ];
    if (suma.n <= 60) {
      const muestras = suma.tipo === 'trapecio'
        ? suma.piezas.flatMap((p, k) => (k === 0 ? [[p.x0, p.y0], [p.x1, p.y1]] : [[p.x1, p.y1]]))
        : suma.piezas.map((p) => [p.xm, p.altura]);
      trazas.push({ x: muestras.map((m) => m[0]), y: muestras.map((m) => m[1]), type: 'scatter', mode: 'markers',
                    name: 'Puntos de muestra', marker: { color: '#ffb703', size: suma.n <= 20 ? 8 : 5 } });
    }

    const valores = [...yr, ...suma.piezas.map((p) => p.altura)].filter(Number.isFinite);
    let yMin = Math.min(0, ...valores), yMax = Math.max(0, ...valores);
    if (yMax - yMin < 1e-9) { yMin -= 1; yMax += 1; }
    const m = 0.12 * (yMax - yMin);

    const layout = layout2D();
    layout.showlegend = true;
    layout.legend = { orientation: 'h', y: 1.12, font: { size: 11 } };
    layout.margin = { l: 50, r: 15, t: 40, b: 45 };
    layout.yaxis.range = [yMin - m, yMax + m];
    layout.xaxis.range = [lo - pad, hi + pad];
    Plotly.react('lab-plot', trazas, layout, PLOT_CONFIG);
  }

  function graficarConvergencia(base, n, errorActual) {
    const trazas = C.TIPOS_RIEMANN.map((tipo) => ({
      x: N_CONVERGENCIA,
      y: base.convergencia[tipo].map((e) => (Number.isFinite(e) ? Math.max(e, 1e-16) : null)),
      type: 'scatter', mode: 'lines+markers', name: NOMBRE_TIPO[tipo].replace('de ', ''),
      line: { color: COLOR_TIPO[tipo], width: tipo === estado.tipo ? 3 : 1.2 },
      marker: { size: tipo === estado.tipo ? 6 : 3 },
      opacity: tipo === estado.tipo ? 1 : 0.55
    }));
    if (Number.isFinite(errorActual)) {
      trazas.push({ x: [n], y: [Math.max(errorActual, 1e-16)], type: 'scatter', mode: 'markers', name: `n = ${n}`,
                    marker: { color: '#ffffff', size: 11, symbol: 'diamond', line: { color: COLOR_TIPO[estado.tipo], width: 2 } } });
    }
    const layout = layout2D();
    layout.showlegend = true;
    layout.legend = { orientation: 'h', y: -0.35, font: { size: 9 } };
    layout.height = 230;
    layout.font = { ...layout.font, size: 10 };
    layout.margin = { l: 45, r: 10, t: 22, b: 70 };
    layout.title = { text: 'Error vs n (escala log)', font: { size: 11, color: '#00adb5' }, x: 0.02, y: 0.98 };
    layout.xaxis = { ...layout.xaxis, title: { text: 'n' }, type: 'log' };
    layout.yaxis = { ...layout.yaxis, title: { text: 'error' }, type: 'log', exponentformat: 'power' };
    Plotly.react('lab-convergencia', trazas, layout, PLOT_CONFIG);
  }

  // ---------- explicación paso a paso ----------
  function porQue(base, tipo, diferencia) {
    const { forma } = base;
    if (!forma || base.signo < 0 || Math.abs(diferencia) < 1e-12) return '';
    let sobre = null, razon = '';
    if (tipo === 'izquierda' || tipo === 'derecha') {
      if (forma.constante) return ' Como f es constante, todos los rectángulos coinciden con la región: la suma es exacta.';
      if (forma.creciente || forma.decreciente) {
        const usaBaja = (tipo === 'izquierda') === forma.creciente;
        sobre = !usaBaja;
        razon = `Como f es ${forma.creciente ? 'creciente' : 'decreciente'} en el intervalo, la suma ${tipo} toma en cada subintervalo la altura más ${usaBaja ? 'baja' : 'alta'}`;
      }
    } else {
      if (forma.lineal) return ' Como f es lineal, esta regla es exacta: el error que queda es solo de redondeo.';
      if (forma.convexa || forma.concava) {
        sobre = (tipo === 'trapecio') === forma.convexa;
        razon = tipo === 'trapecio'
          ? `Como f es cóncava hacia ${forma.convexa ? 'arriba' : 'abajo'}, el lado recto de cada trapecio queda por ${forma.convexa ? 'encima' : 'debajo'} de la curva`
          : `Como f es cóncava hacia ${forma.convexa ? 'arriba' : 'abajo'}, en cada subintervalo la curva queda por ${forma.convexa ? 'encima' : 'debajo'} de su recta tangente en el punto medio, y el rectángulo tiene la misma área que el trapecio bajo esa tangente`;
      }
    }
    // Solo se explica si la razón coincide con lo que realmente pasó
    if (sobre === null || sobre !== diferencia > 0) return '';
    return ` ${razon}: por eso ${sobre ? 'sobreestima' : 'subestima'} la integral.`;
  }

  function construirPasos(f, a, b, n, suma, base) {
    const tipo = estado.tipo;
    const I = base.integral, R = suma.suma, err = Math.abs(R - I);
    const pasos = [];

    let particion = `Δx = (b − a)/n = (${fmt(b, 3)} − ${fmt(a, 3)})/${n} = ${fmt(suma.dx, 5)}. La partición es xₖ = a + k·Δx, con k = 0, 1, …, ${n}.`;
    if (base.signo < 0) particion += ' Como a > b, Δx es negativo: por eso ∫ₐᵇ f dx = −∫ᵇₐ f dx.';
    pasos.push(['Partición:', particion]);
    pasos.push([`Suma ${NOMBRE_TIPO[tipo]}:`, REGLA_TIPO[tipo]]);

    const termino = (p, k) => (tipo === 'trapecio'
      ? `k = ${k}: [f(${fmt(p.x0, 3)}) + f(${fmt(p.x1, 3)})]/2 · ${fmt(suma.dx, 4)} = ${fmt(p.aporte, 5)}`
      : `k = ${k}: f(${fmt(p.xm, 3)}) · ${fmt(suma.dx, 4)} = ${fmt(p.altura, 4)} · ${fmt(suma.dx, 4)} = ${fmt(p.aporte, 5)}`);
    const primeros = suma.piezas.slice(0, 3).map((p, i) => termino(p, i + 1));
    if (n > 4) primeros.push('…', termino(suma.piezas[n - 1], n));
    else if (n === 4) primeros.push(termino(suma.piezas[3], 4));
    pasos.push(['Términos:', primeros.join(' · ')]);

    pasos.push(['Suma:', `R${subindice(n)} = Σ ${tipo === 'trapecio' ? 'trapecios' : 'f(xₖ*)·Δx'} = ${fmt(R, 6)}.`]);
    pasos.push(['Integral (referencia):', `∫ₐᵇ f(x) dx = ${fmt(I, 6)}, calculada con Simpson adaptativo (error ≈ ${base.errorRef ? base.errorRef.toExponential(1) : '0'}).`]);

    const relativo = Math.abs(I) > 1e-12 ? ` (${(100 * err / Math.abs(I)).toFixed(err / Math.abs(I) < 0.001 ? 4 : 2)} %)` : '';
    pasos.push(['Error:', `|R${subindice(n)} − ∫| = ${fmt(err, 6)}${relativo}.${porQue(base, tipo, R - I)}`]);

    // Convergencia medida: qué pasa al duplicar n
    const e2 = Math.abs(C.sumaRiemann(f, a, b, 2 * n, tipo).suma - I);
    const esperado = ORDEN[tipo] === 2 ? 4 : 2;
    let conv;
    if (err < 1e-10 * Math.max(1, Math.abs(I))) {
      const forma = base.forma || {};
      if (forma.constante) {
        conv = 'el error está al nivel del redondeo de la computadora: f es constante, así que cualquier suma de Riemann es exacta.';
      } else if (forma.lineal && (tipo === 'medio' || tipo === 'trapecio')) {
        conv = 'el error está al nivel del redondeo de la computadora: esta regla es exacta para funciones lineales.';
      } else {
        conv = 'el error está al nivel del redondeo de la computadora: aquí los errores de las franjas se cancelan entre sí (por ejemplo, por simetría), así que la suma coincide con la integral. Prueba otro intervalo para ver cómo converge.';
      }
    } else {
      conv = `al duplicar n (${n} → ${2 * n}) el error pasa de ${fmt(err, 6)} a ${fmt(e2, 6)}: se divide entre ≈ ${(err / e2).toFixed(2)}. Para la suma ${NOMBRE_TIPO[tipo]} el error es proporcional a 1/n${ORDEN[tipo] === 2 ? '²' : ''}, así que se espera ≈ ${esperado}.`;
    }
    pasos.push(['Convergencia:', conv]);

    if (base.cruzaEje) {
      pasos.push(['Signo:', `f cruza el eje: las franjas de abajo (rosadas) aportan valores negativos. La suma aproxima la integral con signo (${fmt(I, 4)}), no el área geométrica (${fmt(base.area, 4)}).`]);
    }
    pasos.push(['Idea clave:', '∫ₐᵇ f(x) dx = lím (n → ∞) Σ f(xₖ*)·Δx. Sube n con el deslizador o pulsa ▶ Animar para verlo.']);

    const ol = $('lab-pasos-lista');
    ol.replaceChildren();
    for (const [titulo, texto] of pasos) {
      const li = document.createElement('li');
      const s = document.createElement('strong');
      s.textContent = titulo;
      li.append(s, ' ', texto);
      ol.appendChild(li);
    }
  }

  function limpiarResultados() {
    for (const id of ['lab-suma', 'lab-integral', 'lab-error', 'lab-area']) $(id).textContent = '—';
    $('lab-pasos-lista').replaceChildren();
  }

  // ---------- render ----------
  function render() {
    if (typeof Plotly === 'undefined' || typeof math === 'undefined') {
      mensaje('No se cargaron las librerías (Plotly / math.js). Revisa tu conexión a internet.');
      return;
    }
    const texto = $('lab-func').value.trim();
    if (texto !== estado.texto) {
      estado.texto = texto;
      estado.f = C.compilarFuncion(texto);
      estado.clave = '';
    }
    const f = estado.f;
    const a = leerNumero('lab-a-num'), b = leerNumero('lab-b-num');
    const n = parseInt($('lab-n').value, 10);
    $('lab-n-val').textContent = n;
    $('lab-suma-etq').textContent = `Suma R${subindice(n)}`;

    if (!f) { limpiarResultados(); return mensaje(`No se pudo interpretar "${texto}". Usa x como variable, por ejemplo x^2 o sin(x) + 2.`); }
    if (!Number.isFinite(a) || !Number.isFinite(b)) { limpiarResultados(); return mensaje('Los límites a y b deben ser números.'); }
    if (a === b) { limpiarResultados(); return mensaje('a = b: el intervalo tiene ancho cero y la integral vale 0. Separa los límites.'); }

    const clave = `${a}|${b}`;
    if (clave !== estado.clave) {
      estado.base = calcularBase(f, a, b);
      estado.clave = clave;
    }
    const base = estado.base;
    const suma = C.sumaRiemann(f, a, b, n, estado.tipo);
    if (base.diverge || !Number.isFinite(suma.suma)) {
      limpiarResultados();
      return mensaje('f(x) no está definida (o tiene una asíntota) en algún punto de [a, b]. Cambia los límites.');
    }
    mensaje('');

    const err = Math.abs(suma.suma - base.integral);
    $('lab-suma').textContent = fmt(suma.suma, 6);
    $('lab-integral').textContent = fmt(base.integral, 6);
    $('lab-error').textContent = Math.abs(base.integral) > 1e-12
      ? `${fmt(err, 6)} (${(100 * err / Math.abs(base.integral)).toFixed(2)} %)`
      : fmt(err, 6);
    $('lab-area').textContent = fmt(base.area, 6);

    graficar(f, suma, base);
    graficarConvergencia(base, n, err);
    construirPasos(f, a, b, n, suma, base);
  }

  // ---------- animación de n ----------
  function detenerAnimacion() {
    if (estado.animacion) clearTimeout(estado.animacion);
    estado.animacion = null;
    $('lab-animar').textContent = '▶ Animar n';
  }

  function animar() {
    if (estado.animacion) { detenerAnimacion(); return; }
    $('lab-animar').textContent = '⏸ Detener';
    let i = 0;
    const paso = () => {
      $('lab-n').value = SECUENCIA_ANIMACION[i];
      render();
      i++;
      if (i < SECUENCIA_ANIMACION.length) estado.animacion = setTimeout(paso, reducirMovimiento ? 600 : 260);
      else detenerAnimacion();
    };
    paso();
  }

  // ---------- eventos ----------
  sincronizar('lab-a', 'lab-a-num');
  sincronizar('lab-b', 'lab-b-num');
  $('lab-n').addEventListener('input', () => { detenerAnimacion(); programar(); });
  $('lab-func').addEventListener('input', programar);
  $('lab-animar').addEventListener('click', animar);

  document.querySelectorAll('.lab-tipo').forEach((btn) => {
    btn.addEventListener('click', () => {
      estado.tipo = btn.dataset.tipo;
      document.querySelectorAll('.lab-tipo').forEach((b) => {
        const activo = b === btn;
        b.classList.toggle('active', activo);
        b.setAttribute('aria-pressed', String(activo));
      });
      programar();
    });
  });

  $('lab-copiar').addEventListener('click', () => {
    $('lab-func').value = $('input-func').value;
    const a = parseFloat($('input-a').value), b = parseFloat($('input-b').value);
    if (Number.isFinite(a) && Number.isFinite(b)) fijarLimites(a, b);
    programar();
  });

  // Lleva la función y los límites al panel principal y calcula el área (1 dedo)
  $('lab-aplicar').addEventListener('click', () => {
    const a = leerNumero('lab-a-num'), b = leerNumero('lab-b-num');
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return;
    $('input-func').value = $('lab-func').value;
    $('input-a').value = Math.min(a, b);
    $('input-b').value = Math.max(a, b);
    $('preset-select').value = 'custom';
    actualizarPistaPreset();
    if (modoActual === 'exploracion') renderCalculo(1);
    document.querySelector('.hero-card').scrollIntoView({ behavior: reducirMovimiento ? 'auto' : 'smooth', block: 'start' });
  });

  render();
})();

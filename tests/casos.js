/* =========================================================
   CASOS DE PRUEBA
   Cada caso compara el resultado de la app con un valor conocido (fórmula cerrada o geometría).
   Los ejecutan tests/pruebas.test.js (Node: npm test) y tests/pruebas.html (navegador).
   ========================================================= */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrica(require('../calculo.js'), require('../gestos.js'), require('./mano-sintetica.js'));
  } else {
    raiz.CasosDePrueba = fabrica(raiz.Calculo, raiz.Gestos, raiz.ManoSintetica);
  }
})(typeof self !== 'undefined' ? self : this, function (C, G, M) {
  'use strict';

  const casos = [];
  const prueba = (grupo, nombre, fn, opciones = {}) => casos.push({ grupo, nombre, fn, ...opciones });

  // ---------- comprobaciones ----------
  function cerca(obtenido, esperado, tol = 1e-8, msg = '') {
    const ok = Number.isFinite(obtenido) && Math.abs(obtenido - esperado) <= tol * Math.max(1, Math.abs(esperado));
    if (!ok) throw new Error(`${msg}obtenido ${obtenido}, esperado ${esperado} (tolerancia ${tol})`);
  }
  function igual(obtenido, esperado, msg = '') {
    if (obtenido !== esperado) throw new Error(`${msg}obtenido ${obtenido}, esperado ${esperado}`);
  }
  function verdadero(condicion, msg) {
    if (!condicion) throw new Error(msg);
  }

  const PI = Math.PI;
  const T = true, F = false;

  // ==========================================
  // 1. ÁREA BAJO LA CURVA: integral con signo vs área geométrica
  // ==========================================
  prueba('Área bajo la curva', 'x² en [0, 2]: integral = área = 8/3', () => {
    const r = C.calcularArea((x) => x * x, 0, 2);
    cerca(r.integral, 8 / 3);
    cerca(r.area, 8 / 3);
    igual(r.raices.length, 0, 'raíces: ');
  });

  prueba('Área bajo la curva', 'x en [-1, 2]: integral 1.5, área 2.5', () => {
    const r = C.calcularArea((x) => x, -1, 2);
    cerca(r.integral, 1.5);
    cerca(r.area, 2.5);
    cerca(r.positiva, 2);
    cerca(r.negativa, -0.5);
  });

  prueba('Área bajo la curva', 'sin x en [0, 2π]: integral 0, área 4, raíz en π', () => {
    const r = C.calcularArea(Math.sin, 0, 2 * PI);
    verdadero(Math.abs(r.integral) < 1e-10, `integral debería ser 0 y es ${r.integral}`);
    cerca(r.area, 4);
    igual(r.raices.length, 1, 'cantidad de raíces: ');
    cerca(r.raices[0], PI, 1e-12);
  });

  prueba('Área bajo la curva', 'x² − 1 en [-2, 2]: integral 4/3, área 4', () => {
    const r = C.calcularArea((x) => x * x - 1, -2, 2);
    cerca(r.integral, 4 / 3);
    cerca(r.area, 4);
    igual(r.raices.length, 2, 'cantidad de raíces: ');
  });

  prueba('Área bajo la curva', '−x² en [0, 3]: integral −9, área +9', () => {
    const r = C.calcularArea((x) => -x * x, 0, 3);
    cerca(r.integral, -9);
    cerca(r.area, 9);
    cerca(r.valor, 9, 1e-8, 'el resultado principal es el área: ');
  });

  prueba('Área bajo la curva', 'caso industrial: 100 + 15x − 2x² en [0, 8] = 938.67 piezas', () => {
    cerca(C.calcularArea((x) => 100 + 15 * x - 2 * x * x, 0, 8).area, 800 + 480 - 1024 / 3);
  });

  prueba('Área bajo la curva', 'siempre: integral = positiva + negativa y área = positiva − negativa', () => {
    for (const f of [Math.sin, Math.cos, (x) => x * x * x - x, (x) => Math.exp(-x) - 0.5]) {
      const r = C.calcularArea(f, -2, 3);
      cerca(r.integral, r.positiva + r.negativa, 1e-12);
      cerca(r.area, r.positiva - r.negativa, 1e-12);
      verdadero(r.area >= Math.abs(r.integral) - 1e-12, 'el área nunca es menor que |integral|');
    }
  });

  // ==========================================
  // 2. VOLUMEN ALREDEDOR DEL EJE X (discos)
  // ==========================================
  prueba('Volumen eje X', 'cilindro: f = 2 en [0, 5] → 20π', () => {
    cerca(C.calcularVolumenX(() => 2, 0, 5).valor, 20 * PI);
  });
  prueba('Volumen eje X', 'cono: f = x en [0, 1] → π/3', () => {
    cerca(C.calcularVolumenX((x) => x, 0, 1).valor, PI / 3);
  });
  prueba('Volumen eje X', 'paraboloide: f = √x en [0, 4] → 8π', () => {
    cerca(C.calcularVolumenX(Math.sqrt, 0, 4).valor, 8 * PI);
  });
  prueba('Volumen eje X', 'depósito parabólico: f = √(4 − x) en [0, 4] → 8π', () => {
    cerca(C.calcularVolumenX((x) => Math.sqrt(4 - x), 0, 4).valor, 8 * PI);
  });
  prueba('Volumen eje X', 'esfera: f = √(1 − x²) en [-1, 1] → 4π/3', () => {
    cerca(C.calcularVolumenX((x) => Math.sqrt(1 - x * x), -1, 1).valor, 4 * PI / 3);
  });
  prueba('Volumen eje X', 'el signo de f no importa: f = −x en [0, 1] → π/3', () => {
    cerca(C.calcularVolumenX((x) => -x, 0, 1).valor, PI / 3);
  });

  // ==========================================
  // 3. VOLUMEN ALREDEDOR DEL EJE Y (capas cilíndricas)
  // ==========================================
  prueba('Volumen eje Y', 'x² en [0, 2] → 2π∫x³ dx = 8π', () => {
    const r = C.calcularVolumenY((x) => x * x, 0, 2);
    cerca(r.valor, 8 * PI);
    igual(r.cruzaEje, false, 'cruzaEje: ');
  });
  prueba('Volumen eje Y', 'sin x en [0, π] → 2π²', () => {
    cerca(C.calcularVolumenY(Math.sin, 0, PI).valor, 2 * PI * PI);
  });
  prueba('Volumen eje Y', 'cilindro hueco: f = 1 en [1, 2] → 3π', () => {
    cerca(C.calcularVolumenY(() => 1, 1, 2).valor, 3 * PI);
  });
  prueba('Volumen eje Y', 'intervalo a la izquierda: x² en [-2, -1] → 7.5π', () => {
    cerca(C.calcularVolumenY((x) => x * x, -2, -1).valor, 7.5 * PI);
  });
  prueba('Volumen eje Y', 'superposición: f = 1 en [-1, 1] es UN cilindro → π (antes daba 2π)', () => {
    const r = C.calcularVolumenY(() => 1, -1, 1);
    cerca(r.valor, PI);
    igual(r.cruzaEje, true, 'cruzaEje: ');
    cerca(r.sinCorregir, 2 * PI, 1e-8, 'la suma sin corregir cuenta el volumen dos veces: ');
  });
  prueba('Volumen eje Y', 'superposición asimétrica: f = 1 en [-2, 1] → 4π (antes 5π)', () => {
    cerca(C.calcularVolumenY(() => 1, -2, 1).valor, 4 * PI);
  });
  prueba('Volumen eje Y', 'lados de distinto signo: f = x en [-1, 1] → 4π/3', () => {
    // a la derecha queda un cilindro sin cono (2π/3) y a la izquierda su reflejo bajo el eje (2π/3)
    cerca(C.calcularVolumenY((x) => x, -1, 1).valor, 4 * PI / 3);
  });
  prueba('Volumen eje Y', 'x² en [-1, 2]: el lado izquierdo queda dentro del derecho → 8π', () => {
    cerca(C.calcularVolumenY((x) => x * x, -1, 2).valor, 8 * PI);
  });
  prueba('Volumen eje Y', 'función par 1 − x² en [-1, 1] → π/2 (igual que en [0, 1])', () => {
    cerca(C.calcularVolumenY((x) => 1 - x * x, -1, 1).valor, PI / 2);
  });

  // ==========================================
  // 4. ÁREA SUPERFICIAL (giro alrededor del eje X)
  // ==========================================
  prueba('Área superficial', 'cilindro: f = 2 en [0, 5] → 20π lateral + 8π de tapas', () => {
    const r = C.calcularSuperficie(() => 2, () => 0, 0, 5);
    cerca(r.valor, 20 * PI);
    cerca(r.tapas, 8 * PI);
  });
  prueba('Área superficial', 'cono: f = x en [0, 1] → π√2', () => {
    cerca(C.calcularSuperficie((x) => x, () => 1, 0, 1).valor, PI * Math.SQRT2);
  });
  prueba('Área superficial', 'esfera: √(1 − x²) en [-1, 1] → 4π (0·∞ en los extremos: límite)', () => {
    const r = C.calcularSuperficie((x) => Math.sqrt(1 - x * x), (x) => -x / Math.sqrt(1 - x * x), -1, 1);
    cerca(r.valor, 4 * PI, 1e-9);
    verdadero(r.removibles.length >= 1, 'debería detectar la singularidad removible en los extremos');
    igual(r.impropia, false, 'no es una integral impropia: ');
  });
  prueba('Área superficial', 'depósito: √(4 − x) en [0, 4] → (4π/3)(4.25^1.5 − 0.25^1.5)', () => {
    const r = C.calcularSuperficie((x) => Math.sqrt(4 - x), (x) => -1 / (2 * Math.sqrt(4 - x)), 0, 4);
    cerca(r.valor, (4 * PI / 3) * (4.25 ** 1.5 - 0.25 ** 1.5), 1e-9);
  });
  prueba('Área superficial', 'catenoide: cosh x en [-1, 1] → π(2 + sinh 2)', () => {
    cerca(C.calcularSuperficie(Math.cosh, Math.sinh, -1, 1).valor, PI * (2 + Math.sinh(2)));
  });
  prueba('Área superficial', 'f cambia de signo: f = x en [-1, 1] → dos conos, 2π√2', () => {
    cerca(C.calcularSuperficie((x) => x, () => 1, -1, 1).valor, 2 * PI * Math.SQRT2);
  });

  // ==========================================
  // 5. LONGITUD DE ARCO
  // ==========================================
  prueba('Longitud de arco', 'recta 2x + 1 en [0, 3] → 3√5', () => {
    cerca(C.calcularLongitudArco((x) => 2 * x + 1, () => 2, 0, 3).valor, 3 * Math.sqrt(5));
  });
  prueba('Longitud de arco', 'constante f = 2 en [0, 5] → 5', () => {
    cerca(C.calcularLongitudArco(() => 2, () => 0, 0, 5).valor, 5);
  });
  prueba('Longitud de arco', '(2/3)x^(3/2) en [0, 3] → 14/3', () => {
    cerca(C.calcularLongitudArco((x) => (2 / 3) * x ** 1.5, (x) => Math.sqrt(x), 0, 3).valor, 14 / 3);
  });
  prueba('Longitud de arco', 'catenaria cosh x en [0, 1] → sinh 1', () => {
    cerca(C.calcularLongitudArco(Math.cosh, Math.sinh, 0, 1).valor, Math.sinh(1));
  });
  prueba('Longitud de arco', 'semicircunferencia → π (impropia; antes daba 3.1305)', () => {
    const r = C.calcularLongitudArco((x) => Math.sqrt(1 - x * x), (x) => -x / Math.sqrt(1 - x * x), -1, 1);
    cerca(r.valor, PI, 1e-7);
    igual(r.impropia, true, 'impropia: ');
  });
  prueba('Longitud de arco', 'banda sin x + 2 en [0, 2π] → 4√2·E(1/2) = 7.6403955780', () => {
    cerca(C.calcularLongitudArco((x) => Math.sin(x) + 2, Math.cos, 0, 2 * PI).valor, 7.640395578055424, 1e-9);
  });
  prueba('Longitud de arco', '|x| en [-1, 1] (punto anguloso) → 2√2', () => {
    cerca(C.calcularLongitudArco(Math.abs, (x) => Math.abs(x) / x, -1, 1).valor, 2 * Math.SQRT2);
  });
  prueba('Longitud de arco', 'la curva nunca mide menos que la cuerda', () => {
    const funciones = [[Math.sin, Math.cos], [(x) => x * x, (x) => 2 * x], [Math.exp, Math.exp]];
    for (const [f, df] of funciones) {
      const r = C.calcularLongitudArco(f, df, -1, 2);
      verdadero(r.valor >= r.cuerda - 1e-12, `L = ${r.valor} < cuerda = ${r.cuerda}`);
    }
  });

  // ==========================================
  // 6. MOTOR NUMÉRICO
  // ==========================================
  prueba('Motor numérico', 'los cinco métodos integran sin x en [0, π] = 2', () => {
    for (const [clave, tol] of [['adaptativo', 1e-10], ['simpson', 1e-9], ['romberg', 1e-10], ['gauss', 1e-10], ['trapecio', 1e-5]]) {
      cerca(C.integrar(Math.sin, 0, PI, clave).valor, 2, tol, `${clave}: `);
    }
  });
  prueba('Motor numérico', 'Simpson es exacto para cúbicas: x³ en [0, 2] con n = 2', () => {
    cerca(C.simpson((x) => x ** 3, 0, 2, 2), 4, 1e-14);
  });
  prueba('Motor numérico', 'exp(x) en [0, 20] con pocas evaluaciones (antes ~150 000)', () => {
    let evaluaciones = 0;
    const r = C.integrar((x) => { evaluaciones++; return Math.exp(x); }, 0, 20);
    cerca(r.valor, Math.exp(20) - 1, 1e-10);
    verdadero(evaluaciones < 5000, `usó ${evaluaciones} evaluaciones`);
  });
  prueba('Motor numérico', 'e^(−x²) en [-3, 3] = √π·erf(3)', () => {
    cerca(C.integrar((x) => Math.exp(-x * x), -3, 3).valor, 1.7724146965190366, 1e-10);
  });
  prueba('Motor numérico', 'impropia convergente: 1/√x en [0, 1] = 2', () => {
    const r = C.integrar((x) => 1 / Math.sqrt(x), 0, 1);
    cerca(r.valor, 2, 1e-7);
    igual(r.impropia, true, 'impropia: ');
  });
  prueba('Motor numérico', 'impropia convergente: ln x en [0, 1] = −1', () => {
    cerca(C.integrar(Math.log, 0, 1).valor, -1, 1e-10);
  });
  prueba('Motor numérico', 'singularidad removible: sin(x)/x en [0, 1] = Si(1)', () => {
    const r = C.integrar((x) => Math.sin(x) / x, 0, 1);
    cerca(r.valor, 0.946083070367183, 1e-12);
    verdadero(r.removibles.includes(0), 'debería usar el límite en x = 0');
  });
  prueba('Motor numérico', 'divergentes: 1/x en [0, 1], tan x en [0, π/2], 1/(x − 1) en [0, 2.1]', () => {
    for (const [f, a, b] of [[(x) => 1 / x, 0, 1], [Math.tan, 0, PI / 2], [(x) => 1 / (x - 1), 0, 2.1]]) {
      const r = C.integrar(f, a, b);
      igual(r.diverge, true, `diverge en [${a}, ${b}]: `);
      verdadero(Number.isNaN(r.valor), 'el valor de una integral divergente debe ser NaN');
    }
  });
  prueba('Motor numérico', 'función no definida en parte del intervalo: √x en [-1, 1] → NaN', () => {
    verdadero(Number.isNaN(C.integrar(Math.sqrt, -1, 1).valor), 'no debería inventar un valor');
  });
  prueba('Motor numérico', 'raíces: x² − 2 en [-3, 3] → ±√2; f ≡ 0 no genera raíces falsas', () => {
    const r = C.raicesEn((x) => x * x - 2, -3, 3);
    igual(r.length, 2, 'cantidad: ');
    cerca(r[0], -Math.SQRT2, 1e-12);
    cerca(r[1], Math.SQRT2, 1e-12);
    igual(C.raicesEn(() => 0, -1, 1).length, 0, 'f ≡ 0: ');
  });

  // ==========================================
  // 7. SUMAS DE RIEMANN (laboratorio)
  // ==========================================
  prueba('Sumas de Riemann', 'f = x en [0, 1] con n = 4: izq 0.375, der 0.625, medio y trapecio 0.5', () => {
    const f = (x) => x;
    cerca(C.sumaRiemann(f, 0, 1, 4, 'izquierda').suma, 0.375, 1e-14);
    cerca(C.sumaRiemann(f, 0, 1, 4, 'derecha').suma, 0.625, 1e-14);
    cerca(C.sumaRiemann(f, 0, 1, 4, 'medio').suma, 0.5, 1e-14);
    cerca(C.sumaRiemann(f, 0, 1, 4, 'trapecio').suma, 0.5, 1e-14);
  });
  prueba('Sumas de Riemann', 'x² en [0, 1] con n = 2, punto medio = 0.3125', () => {
    cerca(C.sumaRiemann((x) => x * x, 0, 1, 2, 'medio').suma, 0.3125, 1e-14);
  });
  prueba('Sumas de Riemann', 'trapecio = promedio de izquierda y derecha', () => {
    const f = (x) => Math.exp(x) * Math.sin(3 * x);
    const izq = C.sumaRiemann(f, -1, 2, 17, 'izquierda').suma, der = C.sumaRiemann(f, -1, 2, 17, 'derecha').suma;
    cerca(C.sumaRiemann(f, -1, 2, 17, 'trapecio').suma, (izq + der) / 2, 1e-12);
  });
  prueba('Sumas de Riemann', 'orden del error: izquierda ~1/n (÷2), punto medio ~1/n² (÷4)', () => {
    const f = (x) => x * x, I = 1 / 3;
    const e = (n, tipo) => Math.abs(C.sumaRiemann(f, 0, 1, n, tipo).suma - I);
    cerca(e(100, 'izquierda') / e(200, 'izquierda'), 2, 0.01);
    cerca(e(100, 'medio') / e(200, 'medio'), 4, 0.01);
    cerca(e(100, 'trapecio') / e(200, 'trapecio'), 4, 0.01);
  });
  prueba('Sumas de Riemann', 'con a > b la suma cambia de signo: izq(2 → 0) = −der(0 → 2)', () => {
    const f = (x) => x * x;
    cerca(C.sumaRiemann(f, 2, 0, 10, 'izquierda').suma, -C.sumaRiemann(f, 0, 2, 10, 'derecha').suma, 1e-12);
  });
  prueba('Sumas de Riemann', 'la suma converge a la integral al crecer n', () => {
    cerca(C.sumaRiemann(Math.cos, 0, 1, 20000, 'izquierda').suma, Math.sin(1), 1e-4);
  });
  prueba('Sumas de Riemann', 'forma de f: monotonía y concavidad', () => {
    const p = C.analizarForma((x) => x * x, 0, 2);
    verdadero(p.creciente && p.convexa, 'x² en [0, 2] es creciente y cóncava hacia arriba');
    const q = C.analizarForma((x) => -x * x, 0, 2);
    verdadero(q.decreciente && q.concava, '−x² en [0, 2] es decreciente y cóncava hacia abajo');
    verdadero(C.analizarForma((x) => 2 * x + 1, 0, 2).lineal, '2x + 1 es lineal');
  });

  // ==========================================
  // 8. INTERPRETACIÓN DE f(x)
  // ==========================================
  prueba('Interpretación de f(x)', 'normaliza la escritura de clase', () => {
    igual(C.normalizarExpresion('sen(x) + ln(x)'), 'sin(x) + log(x)');
    igual(C.normalizarExpresion('y = x²'), 'x^2');
    igual(C.normalizarExpresion('f(x) = 2·x'), '2*x');
    igual(C.normalizarExpresion('√(4 − x)'), 'sqrt(4 - x)');
    igual(C.normalizarExpresion('π·x'), 'pi*x');
  });
  prueba('Interpretación de f(x)', 'math.js evalúa x^2, 2x + 1, sen(x), ln(x), y = …', ({ math }) => {
    cerca(C.compilarFuncion('x^2', math)(3), 9);
    cerca(C.compilarFuncion('2x + 1', math)(2), 5);
    cerca(C.compilarFuncion('sen(x)', math)(PI / 2), 1);
    cerca(C.compilarFuncion('ln(x)', math)(Math.E), 1);
    cerca(C.compilarFuncion('y = x^2', math)(3), 9);
    // t, m y b son unidades en math.js (tonelada, metro, byte): deben rechazarse como variables
    igual(C.compilarFuncion('t^2', math), null, 'variable desconocida t: ');
    igual(C.compilarFuncion('m*x + b', math), null, 'variables desconocidas m y b: ');
    verdadero(C.compilarFuncion('exp(-x) + pi*sqrt(x) + e', math) !== null, 'funciones y constantes sí se aceptan');
    verdadero(Number.isNaN(C.compilarFuncion('sqrt(x - 1)', math)(0)), 'fuera del dominio debe dar NaN');
  }, { requiereMath: true });
  prueba('Interpretación de f(x)', 'derivada exacta, comprobada dentro de [a, b] (antes solo en x = 0.5)', ({ math }) => {
    const f = C.compilarFuncion('x^3', math);
    const d = C.compilarDerivada('x^3', f, 0, 2, math);
    igual(d.simbolica, true, 'simbólica: ');
    cerca(d.df(2), 12);
    const g = C.compilarFuncion('sqrt(x - 1)', math);
    const dg = C.compilarDerivada('sqrt(x - 1)', g, 1, 3, math);
    igual(dg.simbolica, true, 'sqrt(x − 1) en [1, 3] tiene derivada simbólica: ');
    cerca(dg.df(2), 0.5);
  }, { requiereMath: true });
  prueba('Interpretación de f(x)', 'de punta a punta: superficie de la esfera escrita como texto', ({ math }) => {
    const f = C.compilarFuncion('sqrt(1 - x^2)', math);
    const d = C.compilarDerivada('sqrt(1 - x^2)', f, -1, 1, math);
    cerca(C.calcularSuperficie(f, d.df, -1, 1).valor, 4 * PI, 1e-9);
  }, { requiereMath: true });

  // ==========================================
  // 9. RECONOCIMIENTO DE GESTOS (manos sintéticas)
  // ==========================================
  const POSES = [
    ['puño', [F, F, F, F, F], 'cruzado'],
    ['1 dedo (índice)', [F, T, F, F, F], 'cruzado'],
    ['2 dedos (V)', [F, T, T, F, F], 'cruzado'],
    ['3 dedos sin pulgar', [F, T, T, T, F], 'palma'],
    ['3 dedos con pulgar', [T, T, T, F, F], 'cruzado'],
    ['4 dedos, pulgar sobre la palma', [F, T, T, T, T], 'palma'],
    ['4 dedos, pulgar pegado al índice', [F, T, T, T, T], 'pegado'],
    ['5 dedos', [T, T, T, T, T], 'cruzado'],
    ['2 dedos (L)', [T, T, F, F, F], 'cruzado'],
    ['1 dedo (pulgar arriba)', [T, F, F, F, F], 'cruzado']
  ];

  for (const [nombre, dedos, pulgarDoblado] of POSES) {
    prueba('Gestos', `${nombre} → ${dedos.filter(Boolean).length}, girada, inclinada, ambas manos y con ruido`, () => {
      const esperado = dedos.filter(Boolean).length;
      let semilla = 1;
      for (const roll of [-30, 0, 30]) for (const yaw of [-45, 0, 45]) for (const pitch of [-30, 0, 30]) {
        for (const espejo of [F, T]) {
          const lm = M.crearMano({ dedos, pulgarDoblado, roll, yaw, pitch, espejo, ruido: 0.02, compresionZ: 0.5, semilla: semilla++ });
          const r = G.contarDedos(lm);
          igual(r.cuenta, esperado, `roll ${roll}°, yaw ${yaw}°, pitch ${pitch}°, ${espejo ? 'izquierda' : 'derecha'}: `);
        }
      }
    });
  }

  prueba('Gestos', 'no depende del tamaño de la mano en la imagen', () => {
    for (const escala of [0.12, 0.3, 0.5]) {
      igual(G.contarDedos(M.crearMano({ dedos: [F, T, T, T, F], escala })).cuenta, 3, `escala ${escala}: `);
    }
  });

  prueba('Gestos', 'dedos doblados "sueltos" (sin apretar el puño) no cuentan', () => {
    const lm = M.crearMano({ dedos: [F, T, T, F, F], curvaDoblado: 0.6, compresionZ: 0.5 });
    igual(G.contarDedos(lm).cuenta, 2);
  });

  prueba('Gestos', 'histéresis: un dedo a medio doblar conserva su estado anterior', () => {
    // se busca una pose donde el índice quede dentro de la banda de histéresis
    let lm = null, puntaje = null;
    for (let curva = 0.05; curva <= 1 && !lm; curva += 0.01) {
      const intento = M.crearMano({ dedos: [F, F, F, F, F], curvaDoblado: curva, compresionZ: 0.5 });
      const p = G.puntajesDedos(intento)[1];
      if (p > G.UMBRAL_BAJA + 0.02 && p < G.UMBRAL_SUBE - 0.02) { lm = intento; puntaje = p; }
    }
    verdadero(lm, 'no se encontró una pose dentro de la banda de histéresis');
    const nuevo = G.contarDedos(lm, null);
    const venia = G.contarDedos(lm, [F, T, F, F, F]);
    igual(nuevo.extendidos[1], false, `sin historia (puntaje ${puntaje.toFixed(2)}) el índice cuenta como doblado: `);
    igual(venia.extendidos[1], true, 'si venía extendido, sigue extendido: ');
  });

  prueba('Gestos', 'asignación de manos: por etiqueta, por posición si coinciden, y voto con una mano', () => {
    const derecha = M.crearMano({ dedos: [F, T, F, F, F] });        // x ≈ 0.5
    const izquierda = derecha.map((p) => ({ ...p, x: p.x + 0.3 }));  // más a la derecha en la imagen
    const lado = (label) => ({ label, score: 0.9 });

    let r = G.asignarManos([izquierda, derecha], [lado('Right'), lado('Left')], 'Left', {});
    igual(r.funciones, derecha, 'por etiqueta: ');

    // MediaPipe a veces etiqueta las dos igual: decide la posición (sin espejo, la derecha real tiene x menor)
    r = G.asignarManos([izquierda, derecha], [lado('Left'), lado('Left')], 'Left', {});
    igual(r.funciones, derecha, 'por posición: ');
    igual(r.rotar, izquierda, 'por posición (rotar): ');

    // Una sola mano: un cuadro mal etiquetado no la convierte en la mano de rotación
    const memoria = {};
    for (let i = 0; i < 4; i++) G.asignarManos([derecha], [lado('Left')], 'Left', memoria);
    r = G.asignarManos([derecha], [lado('Right')], 'Left', memoria);
    igual(r.funciones, derecha, 'tras un cuadro mal etiquetado: ');
  });

  prueba('Gestos', 'moda del buffer', () => {
    igual(G.calcularModa([3, 3, 4, 3, 2, 3]), 3);
    igual(G.calcularModa([5]), 5);
  });

  return { casos, cerca, igual, verdadero };
});

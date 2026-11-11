/* =========================================================
   RECONOCIMIENTO DE GESTOS (sin DOM)
   Cuenta dedos a partir de los 21 puntos de MediaPipe Hands.
   Lo usa la app (window.Gestos) y las pruebas en Node (require).
   ========================================================= */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.Gestos = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // [nudillo (MCP), articulación media (PIP), articulación final (DIP), punta]
  const DEDOS_LARGOS = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];
  const NOMBRES = ['pulgar', 'índice', 'medio', 'anular', 'meñique'];

  // Umbrales con histéresis: un dedo se marca extendido con puntaje > 0.62 y solo vuelve a doblado con
  // puntaje < 0.45. Así un dedo a medio camino no hace saltar el conteo 3 ↔ 4 en cada cuadro.
  // (Con poses sintéticas giradas y con ruido, los extendidos puntúan ≥ 0.80 y los doblados ≤ 0.45.)
  const UMBRAL_SUBE = 0.62;
  const UMBRAL_BAJA = 0.45;

  // MediaPipe entrega x e y normalizadas al ancho y al alto de la imagen. Se pasa todo a la misma escala
  // (multiplicando x y z por ancho/alto) para que las distancias y los ángulos no se deformen.
  function aEspacio(p, aspecto) {
    return { x: p.x * aspecto, y: p.y, z: (p.z || 0) * aspecto };
  }
  const resta = (p, q) => ({ x: p.x - q.x, y: p.y - q.y, z: p.z - q.z });
  const norma = (v) => Math.hypot(v.x, v.y, v.z);
  const dist = (p, q) => norma(resta(p, q));
  const recortar = (v) => Math.max(0, Math.min(1, v));

  function cosEntre(u, v) {
    const nu = norma(u), nv = norma(v);
    if (!nu || !nv) return 1;
    return (u.x * v.x + u.y * v.y + u.z * v.z) / (nu * nv);
  }

  // Puntaje de 0 (doblado) a 1 (extendido) para [pulgar, índice, medio, anular, meñique].
  // Todo se basa en distancias relativas y ángulos, así que no depende del tamaño de la mano, de su
  // distancia a la cámara, de si es la derecha o la izquierda, ni de si está inclinada.
  function puntajesDedos(lmCrudo, aspecto = 4 / 3) {
    const lm = lmCrudo.map((p) => aEspacio(p, aspecto));
    const palma = Math.max(dist(lm[0], lm[9]), 1e-6);          // muñeca → nudillo del medio
    const puntajes = [];

    // Pulgar: la versión anterior comparaba la punta con la articulación IP respecto al meñique, y un
    // pulgar doblado sobre la palma o pegado al índice pasaba por extendido (4 dedos se leía como 5).
    //  · lateral: posición de la punta sobre el eje meñique → índice de la palma, medida desde el
    //    nudillo del índice (0) en unidades del ancho de la palma. Extendido ≈ +0.8, pegado al índice
    //    ≈ -0.1, cruzado sobre la palma ≈ -0.6. Como numerador y denominador se acortan igual cuando la
    //    mano gira, no se deforma con la perspectiva.
    //  · alejado: la punta está más lejos del nudillo del meñique que la base del pulgar
    //  · recto:   las falanges del pulgar están alineadas
    const ejePalma = resta(lm[5], lm[17]);
    const anchoPalma2 = Math.max(norma(ejePalma) ** 2, 1e-12);
    const v = resta(lm[4], lm[5]);
    const lateral = (v.x * ejePalma.x + v.y * ejePalma.y + v.z * ejePalma.z) / anchoPalma2;
    const alejado = dist(lm[4], lm[17]) / Math.max(dist(lm[2], lm[17]), 1e-6);
    const recto = cosEntre(resta(lm[3], lm[2]), resta(lm[4], lm[3]));
    puntajes.push(
      0.6 * recortar(lateral / 0.5) +
      0.25 * recortar((alejado - 0.9) / 0.35) +
      0.15 * recortar((recto - 0.5) / 0.4)
    );

    // Dedos largos: la versión anterior solo miraba si la punta estaba más lejos de la muñeca que la
    // articulación PIP, y fallaba con la mano girada. Ahora se combinan:
    //  · forma:   el dedo es recto (MCP→PIP alineado con PIP→punta) Y apunta hacia afuera de la muñeca.
    //             Lo segundo evita que un dedo doblado, visto con la mano inclinada, parezca una línea
    //             recta que apunta hacia la muñeca.
    //  · alcance: la punta está claramente más lejos de la muñeca que la articulación PIP
    for (const [mcp, pip, , tip] of DEDOS_LARGOS) {
      const rectitud = cosEntre(resta(lm[pip], lm[mcp]), resta(lm[tip], lm[pip]));
      const direccion = cosEntre(resta(lm[mcp], lm[0]), resta(lm[tip], lm[mcp]));
      const forma = Math.min(recortar((rectitud - 0.1) / 0.7), recortar((direccion - 0.2) / 0.6));
      const alcance = dist(lm[tip], lm[0]) / Math.max(dist(lm[pip], lm[0]), 1e-6);
      puntajes.push(0.5 * forma + 0.5 * recortar((alcance - 0.95) / 0.35));
    }
    return puntajes;
  }

  // previo: arreglo de 5 booleanos del cuadro anterior (para la histéresis); null si la mano es nueva
  function contarDedos(lm, previo = null, aspecto = 4 / 3) {
    const puntajes = puntajesDedos(lm, aspecto);
    const extendidos = puntajes.map((s, i) => (previo && previo[i] ? s > UMBRAL_BAJA : s > UMBRAL_SUBE));
    return { cuenta: extendidos.filter(Boolean).length, extendidos, puntajes };
  }

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

  // Decide qué mano elige la función y cuál gira la gráfica 3D.
  // MediaPipe etiqueta la mano suponiendo una imagen espejada; como la cámara no se voltea antes de
  // enviarla, "Left" es la mano DERECHA real del usuario (por eso etiquetaFunciones = 'Left' en app.js).
  //  · Dos manos con etiquetas distintas: se usa la etiqueta.
  //  · Dos manos con la MISMA etiqueta (error frecuente de MediaPipe): se usa la posición en la imagen.
  //  · Una sola mano: la etiqueta se suaviza con un voto acumulado, para que un cuadro mal etiquetado
  //    no convierta la mano de funciones en la de rotación y reinicie la detección.
  function asignarManos(listaLm, lados, etiquetaFunciones, memoria = {}) {
    const manos = (listaLm || []).map((lm, i) => ({ lm, etiqueta: lados && lados[i] ? lados[i].label : null }));
    if (manos.length === 0) {
      memoria.voto = 0;
      return { funciones: null, rotar: null };
    }

    if (manos.length === 1) {
      const m = manos[0];
      const paso = m.etiqueta === etiquetaFunciones ? 1 : -1;
      memoria.voto = Math.max(-4, Math.min(4, (memoria.voto || 0) + paso));
      const esFunciones = memoria.voto === 0 ? paso > 0 : memoria.voto > 0;
      return esFunciones ? { funciones: m.lm, rotar: null } : { funciones: null, rotar: m.lm };
    }

    const [m1, m2] = manos;
    let funciones, rotar;
    if (m1.etiqueta !== m2.etiqueta) {
      [funciones, rotar] = m1.etiqueta === etiquetaFunciones ? [m1, m2] : [m2, m1];
    } else {
      // Sin espejo, la mano derecha real aparece a la izquierda de la imagen (x menor)
      const derechaConXMenor = etiquetaFunciones === 'Left';
      const m1EsDerecha = derechaConXMenor ? m1.lm[0].x < m2.lm[0].x : m1.lm[0].x > m2.lm[0].x;
      [funciones, rotar] = m1EsDerecha ? [m1, m2] : [m2, m1];
    }
    memoria.voto = 0;   // si luego queda una sola mano, su etiqueta decide desde el primer cuadro
    return { funciones: funciones.lm, rotar: rotar.lm };
  }

  return { NOMBRES, UMBRAL_SUBE, UMBRAL_BAJA, puntajesDedos, contarDedos, calcularModa, asignarManos };
});

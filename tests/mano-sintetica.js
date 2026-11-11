/* =========================================================
   MANO SINTÉTICA PARA LAS PRUEBAS
   Genera los 21 puntos de MediaPipe a partir de un modelo cinemático simple: palma fija, dedos con
   ángulos de flexión, y luego gira, escala, refleja y agrega ruido. Permite probar el conteo de dedos
   sin cámara.
   ========================================================= */
(function (raiz, fabrica) {
  const api = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else raiz.ManoSintetica = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Marco local (unidades = largo de la palma): x hacia el lado del pulgar, y hacia los dedos,
  // z saliendo de la palma (hacia la cámara cuando la palma la mira).
  const NUDILLOS = [[0.30, 0.92], [0.09, 1.0], [-0.12, 0.95], [-0.31, 0.84]];
  const ABANICO = [0.12, 0.02, -0.08, -0.2];               // ángulo de cada dedo respecto al eje y
  const LARGOS = [[0.40, 0.24, 0.19], [0.45, 0.28, 0.20], [0.42, 0.26, 0.19], [0.32, 0.19, 0.17]];
  const FLEXION_EXTENDIDO = [0.08, 0.10, 0.06];
  const FLEXION_DOBLADO = [1.45, 1.75, 1.0];

  // Posiciones del pulgar (CMC, MCP, IP, punta)
  const PULGAR = {
    extendido: [[0.22, 0.17, 0.02], [0.44, 0.40, 0.08], [0.63, 0.58, 0.12], [0.81, 0.70, 0.15]],
    cruzado:   [[0.22, 0.17, 0.02], [0.36, 0.42, 0.10], [0.18, 0.60, 0.24], [-0.02, 0.66, 0.30]],
    palma:     [[0.22, 0.17, 0.02], [0.35, 0.38, 0.10], [0.15, 0.60, 0.18], [-0.15, 0.75, 0.15]],
    pegado:    [[0.22, 0.17, 0.02], [0.36, 0.42, 0.08], [0.33, 0.62, 0.16], [0.24, 0.78, 0.22]]
  };

  function dedoLargo(i, doblado, curvaDoblado, curvaExtendido) {
    const [mx, my] = NUDILLOS[i];
    const d = [Math.sin(ABANICO[i]), Math.cos(ABANICO[i]), 0];
    const n = [0, 0, 1];
    const flex = doblado
      ? FLEXION_DOBLADO.map((v) => v * curvaDoblado)
      : FLEXION_EXTENDIDO.map((v) => v * curvaExtendido);
    const puntos = [[mx, my, 0]];
    let phi = 0;
    let p = puntos[0];
    for (let k = 0; k < 3; k++) {
      phi += flex[k];
      const dir = [0, 1, 2].map((j) => Math.cos(phi) * d[j] + Math.sin(phi) * n[j]);
      p = p.map((v, j) => v + LARGOS[i][k] * dir[j]);
      puntos.push(p);
    }
    return puntos;
  }

  function rotar([x, y, z], roll, yaw, pitch) {
    // pitch (eje x), yaw (eje y), roll (eje z), en ese orden
    let c = Math.cos(pitch), s = Math.sin(pitch);
    [y, z] = [c * y - s * z, s * y + c * z];
    c = Math.cos(yaw); s = Math.sin(yaw);
    [x, z] = [c * x + s * z, -s * x + c * z];
    c = Math.cos(roll); s = Math.sin(roll);
    [x, y] = [c * x - s * y, s * x + c * y];
    return [x, y, z];
  }

  // Generador pseudoaleatorio con semilla (las pruebas deben dar siempre lo mismo)
  function azar(semilla) {
    let s = semilla >>> 0 || 1;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /**
   * dedos: [pulgar, índice, medio, anular, meñique] con true = extendido
   * pulgarDoblado: 'cruzado' | 'palma' | 'pegado' (pose del pulgar cuando no está extendido)
   * roll / yaw / pitch en grados, escala = largo de la palma en fracción del alto de la imagen
   * espejo = mano izquierda, ruido = desviación en fracción de la palma, compresionZ = MediaPipe
   * suele estimar mal la profundidad (z más chica de lo real)
   * curvaDoblado < 1 = dedos doblados "sueltos" (no apretados contra la palma)
   * curvaExtendido > 1 = dedos extendidos pero algo curvados
   */
  function crearMano({
    dedos = [true, true, true, true, true], pulgarDoblado = 'cruzado',
    roll = 0, yaw = 0, pitch = 0, escala = 0.3, espejo = false,
    ruido = 0, compresionZ = 1, semilla = 7, aspecto = 4 / 3,
    curvaDoblado = 1, curvaExtendido = 1
  } = {}) {
    const local = new Array(21);
    local[0] = [0, 0, 0];
    const pulgar = dedos[0] ? PULGAR.extendido : PULGAR[pulgarDoblado];
    for (let k = 0; k < 4; k++) local[1 + k] = pulgar[k];
    for (let i = 0; i < 4; i++) {
      const pts = dedoLargo(i, !dedos[i + 1], curvaDoblado, curvaExtendido);
      for (let k = 0; k < 4; k++) local[5 + 4 * i + k] = pts[k];
    }

    const rad = Math.PI / 180;
    const rnd = azar(semilla);
    const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.4;   // aproximadamente normal
    return local.map((p) => {
      let [x, y, z] = rotar(p, roll * rad, yaw * rad, pitch * rad);
      if (espejo) x = -x;
      x += ruido * gauss(); y += ruido * gauss(); z += ruido * gauss();
      // a la imagen: y hacia abajo, z negativa = más cerca de la cámara; unidades del alto de la imagen
      const X = 0.5 * aspecto + escala * x;
      const Y = 0.6 - escala * y;
      const Z = -escala * z * compresionZ;
      return { x: X / aspecto, y: Y, z: Z / aspecto };
    });
  }

  return { crearMano };
});

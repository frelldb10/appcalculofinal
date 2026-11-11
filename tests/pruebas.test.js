// Ejecutor de pruebas para Node (sin dependencias): npm test  o  node --test
const { test } = require('node:test');
const { casos } = require('./casos.js');

// math.js es opcional: si está instalado (npm install) también se prueba la interpretación de f(x).
// En tests/pruebas.html esas pruebas siempre corren, porque math.js se carga desde el CDN.
let mathLib = null;
try {
  mathLib = require('mathjs');
} catch (e) {
  mathLib = null;
}

for (const caso of casos) {
  const omitir = caso.requiereMath && !mathLib ? 'requiere mathjs: ejecuta npm install o abre tests/pruebas.html' : false;
  test(`${caso.grupo} › ${caso.nombre}`, { skip: omitir }, () => caso.fn({ math: mathLib }));
}

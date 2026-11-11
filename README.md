# Cálculo Integral en Movimiento

Aplicación web interactiva para visualizar y calcular conceptos de cálculo integral usando una interfaz moderna, gráficos 3D y reconocimiento de gestos con cámara.

## Descripción general

Este proyecto consiste en una dashboard tipo cyberpunk donde el usuario puede:

- ingresar una función f(x)
- seleccionar límites a y b
- elegir un caso de uso industrial
- calcular distintos conceptos de cálculo integral
- observar resultados en gráficos 2D y 3D
- interactuar mediante gestos de la mano con la cámara
- jugar un modo arcade de retos matemáticos

La aplicación combina:

- JavaScript puro
- Plotly para gráficos interactivos
- math.js para evaluar funciones matemáticas
- MediaPipe Hands para detección de gestos con webcam

## Funcionalidades principales

### 1. Modo exploración
Permite calcular automáticamente varios tipos de integrales según el número de dedos mostrado:

- 1 dedo: área bajo la curva (integral con signo y área geométrica)
- 2 dedos: volumen por discos alrededor del eje X
- 3 dedos: volumen por capas alrededor del eje Y
- 4 dedos: área superficial 3D
- 5 dedos: longitud de arco

Cada resultado muestra la gráfica (2D o sólido 3D), los valores clave con sus unidades, el **paso a paso** del cálculo, la comparación entre métodos numéricos y la gráfica de convergencia.

### Uso sin cámara
La app funciona completa sin cámara:

- **Botones de gesto** (1 · Área, 2 · Vol. eje X, 3 · Vol. eje Y, 4 · Superficie, 5 · Arco, 0 · Limpiar).
- **Teclado**: teclas `1` a `5` y `0`.
- El selector "Control manual de respaldo" sigue disponible.

Si no hay cámara, se niega el permiso o no carga MediaPipe, la app lo indica en el encabezado y resalta los botones.

### 2. Modo arcade
El programa presenta retos matemáticos con preguntas como:

- mostrar la fórmula del área bajo la curva
- mostrar la técnica de discos
- mostrar la técnica de capas
- mostrar la fórmula de área superficial
- mostrar la longitud de arco

Si el gesto del usuario coincide con la respuesta correcta, gana puntos y aumenta la racha.

### 3. Casos de uso industrial predefinidos
La app incluye escenarios prácticos:

- Producción industrial
- Tanque cilíndrico
- Depósito parabólico
- Banda transportadora curva

Cada preset adapta la interpretación física del cálculo y recomienda un gesto adecuado.

### 4. Visualización gráfica
Se renderizan gráficas en:

- 2D: curvas y áreas. En el área, lo que está sobre el eje se sombrea en cian y lo que está bajo el eje en rosado; se marcan las raíces y los límites a y b. En la longitud de arco se resalta el arco y se dibuja la cuerda AB para comparar.
- 3D: sólidos de revolución con proporciones reales (los círculos se ven redondos), curva generatriz y eje de giro. Los discos (eje X) incluyen tapas y discos de muestra; las capas (eje Y) muestran una capa cilíndrica típica; la superficie se dibuja con su malla y sin tapas.

La interfaz usa un estilo neón “cyber dashboard” con fondo animado, paneles glassmorphism y elementos HUD.

### 5. Laboratorio matemático interactivo (innovación)
Sección debajo del panel principal (botón "🧪 Laboratorio matemático"):

- Deslizadores y campos para los **límites a y b** y para el número de subintervalos **n** (1 a 200).
- **Sumas de Riemann** por la izquierda, por la derecha, de punto medio y de trapecios, dibujadas en tiempo real (en rosado las franjas que restan).
- Indicadores: suma Rₙ, integral de referencia, error absoluto y relativo, y área geométrica.
- Gráfica **error vs n** (log-log) de las cuatro sumas, donde se ve que izquierda/derecha bajan como 1/n y punto medio/trapecios como 1/n².
- **Explicación paso a paso**: partición, regla de muestreo, primeros términos, suma, error, *por qué* la suma sobreestima o subestima (monotonía y concavidad), cuánto baja el error al duplicar n, y qué pasa si f cruza el eje o si a > b.
- **▶ Animar n** para ver cómo la suma se acerca a la integral, y botones para traer f(x), a y b del panel o llevarlos al panel.

## Estructura del proyecto

```text
appcalculointegral/
├── index.html
├── app.js
├── calculo.js
├── gestos.js
├── laboratorio.js
├── styles.css
├── package.json
├── README.md
└── tests/
    ├── casos.js
    ├── mano-sintetica.js
    ├── pruebas.test.js
    └── pruebas.html
```

### Archivos

- `index.html`: estructura principal de la interfaz
- `app.js`: interfaz, renderizado 2D/3D, paso a paso, arcade, cámara y voz
- `calculo.js`: motor matemático sin DOM (métodos numéricos y las cinco magnitudes); se usa en el navegador y en las pruebas
- `gestos.js`: conteo de dedos y asignación de manos, sin DOM
- `laboratorio.js`: laboratorio de sumas de Riemann
- `styles.css`: estilos visuales y diseño neón
- `tests/`: pruebas automáticas (ver más abajo)
- `README.md`: documentación del proyecto

## Tecnologías utilizadas

- HTML5
- CSS3
- JavaScript ES6+
- Plotly.js
- math.js
- MediaPipe Hands

## Requisitos

Para ejecutar correctamente la aplicación se recomienda:

- navegador moderno
- cámara web (para uso con gestos)
- conexión a internet para cargar las librerías CDN
- acceso a localhost o HTTPS para permitir el uso de la cámara en algunos navegadores

## Instalación y ejecución

### Opción 1: abrir directamente el archivo HTML

Puedes abrir `index.html` en el navegador, pero algunos navegadores pueden restringir la cámara si el proyecto no se ejecuta desde un servidor local.

### Opción recomendada: servidor local

Desde la carpeta del proyecto ejecuta:

```bash
python -m http.server 8000
```

Luego abre en el navegador:

```text
http://localhost:8000
```

También puedes usar Visual Studio Code con una extensión como Live Server.

> Importante: si la cámara no funciona, usa el control manual de respaldo desde el selector “Control manual de respaldo”.

## Cómo usar la aplicación

### Controles principales

1. Selecciona un caso de uso o deja “Personalizado”.
2. Escribe la función `f(x)`.
3. Define los límites `a` y `b`.
4. Elige el modo:
   - Exploración
   - Arcade
5. Si la cámara está disponible, muestra una mano con 1 a 5 dedos para generar el cálculo.
6. Mantén el gesto alrededor de 1 segundo para confirmarlo.
7. Si cierras el puño durante 1 segundo, se limpia la pantalla.

### Gesto a cálculo

| Gesto | Cálculo |
|---|---|
| 1 dedo | Área bajo la curva |
| 2 dedos | Volumen por discos (eje X) |
| 3 dedos | Volumen por capas (eje Y) |
| 4 dedos | Área superficial 3D |
| 5 dedos | Longitud de arco |
| Puño | Limpiar pantalla |

## Fórmulas implementadas

La aplicación calcula y visualiza estas cantidades:

### Área bajo la curva

La app distingue las dos cantidades:

$$
\text{Integral con signo: } \int_a^b f(x)\,dx \qquad \text{Área geométrica: } A = \int_a^b |f(x)|\,dx
$$

Se buscan las raíces de f en [a, b] y se integra cada tramo por separado: la integral es la suma de los tramos (los de abajo restan) y el área es la suma de sus valores absolutos.

### Volumen por discos (eje X)

$$
V = \pi \int_a^b [f(x)]^2\,dx
$$

### Volumen por capas (eje Y)

$$
V = 2\pi \int r\cdot h(r)\,dr
$$

Si a ≥ 0, h(r) = |f(r)| y queda la fórmula de clase $V = 2\pi \int_a^b x\,|f(x)|\,dx$.
Si el intervalo **cruza el eje de giro** (a < 0 < b), las capas de x = r y x = −r ocupan el mismo espacio: sumarlas cuenta ese volumen dos veces. La app toma la **unión** de ambos lados (h(r) es la altura combinada) e integra r de 0 a max(|a|, |b|). Ejemplo: f = 1 en [−1, 1] es un cilindro de volumen π (la suma con superposición daba 2π).

### Área superficial de revolución

$$
S = 2\pi \int_a^b |f(x)|\sqrt{1 + [f'(x)]^2}\,dx
$$

### Longitud de arco

$$
L = \int_a^b \sqrt{1 + [f'(x)]^2}\,dx
$$

## Casos de uso incluidos

### Producción industrial

Función de producción por hora, integrando para obtener piezas totales.

### Tanque cilíndrico

Se usa la fórmula del volumen de un cilindro y la superficie lateral.

### Depósito parabólico

Se aproxima con una forma de revolución parabólica y se calcula capa/volumen según la geometría.

### Banda transportadora curva

Se usa la longitud de arco para determinar la longitud de material necesario.

## Consideraciones importantes

- La app usa aproximaciones numéricas: Simpson adaptativo (por defecto), Simpson compuesto, Romberg, Gauss-Legendre y trapecio.
- **Integrales impropias**: si el integrando no está acotado en un extremo (por ejemplo, la longitud de arco de una semicircunferencia), se usa la cuadratura tanh-sinh. Si la integral diverge (1/x en [0, 1]), la app lo indica en vez de mostrar un número sin sentido.
- **Singularidades removibles**: si el integrando no está definido en un punto pero su límite sí (0·∞ en los polos de la esfera, sin(x)/x en 0), se usa el límite.
- La función debe estar escrita con la variable `x`. También se acepta la escritura de clase: `sen(x)`, `tg(x)`, `ln(x)`, `√x`, `π`, `x²`, `y = …` o `f(x) = …`.
- Ejemplos válidos:
  - `x^2`
  - `-x^2 + 4`
  - `2x + 1`
  - `sin(x) + 2`
  - `exp(-x)`
  - `sqrt(4 - x)`
- Si la función no está definida en el intervalo o usa otra variable (por ejemplo `m*x + b`), la aplicación muestra un error.

## Reconocimiento de gestos

- Se cuentan los dedos con ángulos y distancias relativas entre los 21 puntos de MediaPipe, así que el conteo no depende del tamaño de la mano, de si es la derecha o la izquierda, ni de si está girada o inclinada.
- El pulgar se evalúa por su posición sobre el eje transversal de la palma; antes, un pulgar doblado o pegado al índice se contaba como extendido (4 dedos se leía como 5).
- Cada dedo tiene **histéresis**: un dedo a medio doblar no hace saltar el conteo entre 3 y 4. Además se exige que el gesto domine el buffer de cuadros y se mantenga 1 segundo.
- La captura es de 640×480 con el modelo completo de MediaPipe; si el equipo tarda más de 70 ms por cuadro, la app cambia sola al modelo lite.
- En el visor, las puntas doradas son los dedos que se están contando.

## Pruebas automáticas

Hay 72 pruebas que comparan los resultados con valores exactos (cilindro, cono, esfera, catenoide, semicircunferencia, sumas de Riemann, etc.) y comprueban el conteo de dedos con manos sintéticas giradas, inclinadas, reflejadas y con ruido.

- **En el navegador**: abre `tests/pruebas.html` con el servidor local (`http://localhost:8000/tests/pruebas.html`).
- **En Node** (18 o superior):

```bash
npm install   # solo instala math.js para las pruebas de interpretación de f(x)
npm test
```

Sin `npm install` también corren todas, salvo las 3 que necesitan math.js.

## Solución de problemas

### La cámara no funciona

- Asegúrate de abrir la app desde `localhost` o `https`
- acepta el permiso de cámara del navegador
- verifica que tu dispositivo tenga cámara disponible
- usa los botones de gesto o las teclas 1 a 5 (todo funciona sin cámara)
- si las manos se confunden (la izquierda elige funciones), cambia `ETIQUETA_FUNCIONES` en `app.js`

### La función no se interpreta

- revisa la sintaxis
- usa `x` como variable
- evita expresiones ambiguas o no soportadas por math.js

### El gráfico no se visualiza

- verifica que la conexión a internet esté activa para cargar Plotly y otros CDNs
- recarga la página

## Objetivo educativo

Este proyecto está pensado como una herramienta visual para comprender el cálculo integral de forma interactiva, combinando:

- teoría matemática
- aplicaciones industriales
- visualización gráfica
- interacción con gestos
- aprendizaje lúdico mediante un sistema arcade

## Licencia

Este proyecto se entrega como una aplicación educativa y de demostración. Si lo reutilizas o lo adaptas, procura citar la fuente original y mantener los créditos a las librerías externas utilizadas.

## Autor / contribución

Proyecto desarrollado como aplicación web para visualización de cálculo integral con enfoque interactivo y educativo.

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

- 1 dedo: área bajo la curva
- 2 dedos: volumen por discos alrededor del eje X
- 3 dedos: volumen por capas alrededor del eje Y
- 4 dedos: área superficial 3D
- 5 dedos: longitud de arco

También se puede usar el selector manual para forzar un cálculo sin cámara.

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

- 2D: curvas y áreas
- 3D: superficies de revolución

La interfaz usa un estilo neón “cyber dashboard” con fondo animado, paneles glassmorphism y elementos HUD.

## Estructura del proyecto

```text
appcalculointegral/
├── index.html
├── app.js
├── styles.css
├── README.md
└── .git/
```

### Archivos

- `index.html`: estructura principal de la interfaz
- `app.js`: lógica matemática, detección de gestos, renderizado, arcade y cámara
- `styles.css`: estilos visuales y diseño neón
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

$$
A = \int_a^b |f(x)|\,dx
$$

### Volumen por discos (eje X)

$$
V = \pi \int_a^b [f(x)]^2\,dx
$$

### Volumen por capas (eje Y)

$$
V = 2\pi \int_a^b |x|\cdot|f(x)|\,dx
$$

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

- La app usa aproximaciones numéricas con integrales y la regla de Simpson/gaussiana.
- La función debe estar escrita con la variable `x`.
- Ejemplos válidos:
  - `x^2`
  - `-x^2 + 4`
  - `2x + 1`
  - `sin(x) + 2`
  - `exp(-x)`
  - `sqrt(4 - x)`
- Si la función no está definida en el intervalo, la aplicación muestra un error.

## Solución de problemas

### La cámara no funciona

- Asegúrate de abrir la app desde `localhost` o `https`
- acepta el permiso de cámara del navegador
- verifica que tu dispositivo tenga cámara disponible
- usa el modo manual de respaldo

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

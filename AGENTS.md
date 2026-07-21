# AGENTS.md - Guía para agentes de código

Este documento describe la arquitectura, convenciones y consideraciones importantes para trabajar en el proyecto **Cuentas FINCA**. Está dirigido a agentes de IA que no conocen el proyecto.

---

## 1. Visión general del proyecto

**Cuentas FINCA** es una aplicación web sencilla para llevar el control de adelantos de dinero del personal de una finca.

Funcionalidades principales:

- Un único administrador accede con una contraseña fija.
- El administrador registra trabajadores (nombre, celular, notas).
- Cada trabajador tiene un enlace único para consultar su saldo y historial de adelantos.
- El administrador puede registrar adelantos por fecha, valor y concepto.
- Existen botones para enviar notificaciones por WhatsApp (registro del trabajador o un adelanto recién guardado).
- El panel de administración incluye un reporte de adelantos filtrable por trabajador y rango de fechas, con tabla de detalle y suma total.

La app está pensada para uso interno y simplificado. No implementa autenticación real de Firebase ni reglas de seguridad restrictivas.

---

## 2. Stack tecnológico

- **Frontend:** HTML5, CSS3 y JavaScript vanilla (ES modules).
- **Base de datos:** Firebase Firestore (proyecto `cuentas-finca-sl`, configurado en `js/firebase-config.js`).
- **Autenticación:** Contraseña fija en `js/auth.js` (`Mirador1`) + `sessionStorage` del navegador.
- **Notificaciones:** Enlaces a `https://wa.me/`.
- **Hosting:** El repositorio incluye configuración de Firebase Hosting (`firebase.json`). El README también menciona la posibilidad de usar GitHub Pages.
- **Firebase CLI:** Puede usarse para desplegar índices de Firestore (`firebase deploy --only firestore:indexes`). No es obligatoria para ejecutar la app localmente.
- **Sin empaquetador ni gestor de dependencias:** No hay `package.json`, `pyproject.toml`, `Cargo.toml` ni similar. Los módulos de Firebase se cargan directamente desde CDN (`https://www.gstatic.com/firebasejs/10.12.2/`).

---

## 3. Estructura del proyecto

```
Cuentas_FINCA/
├── index.html              # Pantalla de login del administrador
├── admin.html              # Panel de administración
├── worker.html             # Vista pública del trabajador (lee ?id=WORKER_ID)
├── css/
│   └── styles.css          # Estilos globales, responsive y componentes
├── js/
│   ├── firebase-config.js  # Inicialización de Firebase y export de Firestore
│   ├── utils.js            # Utilidades compartidas (formato, escape, spinner, theme)
│   ├── auth.js             # Login con contraseña fija y gestión de sesión
│   ├── admin.js            # Lógica del panel de administración
│   └── worker.js           # Lógica de la vista del trabajador
├── firestore.rules         # Reglas de Firestore (acceso abierto)
├── firestore.indexes.json  # Índice compuesto requerido para adelantos
├── firebase.json           # Configuración de Firebase Hosting
├── README.md               # Documentación para humanos
├── LICENSE                 # Apache License 2.0
└── .gitattributes          # Normalización de finales de línea
```

### Páginas HTML

| Archivo | Rol | Script principal |
|---|---|---|
| `index.html` | Login del administrador | `js/auth.js` |
| `admin.html` | Gestión de trabajadores y adelantos | `js/admin.js` |
| `worker.html` | Consulta pública de saldo por trabajador | `js/worker.js` |

### Módulos JavaScript

- **`firebase-config.js`**: Inicializa Firebase y exporta `db` (instancia de Firestore). Aquí se deben actualizar las credenciales si el proyecto Firebase cambia.
- **`utils.js`**: Utilidades compartidas y reutilizadas por `admin.js` y `worker.js`. Exporta `formatMoney`, `formatDate`, `escapeHtml`, `showMessage`, `hideMessage`, `validatePhone`, `debounce`, `withLoading` (spinner en botones), `initTheme` (modo oscuro con persistencia en `localStorage`), `initModalEscape` (cerrar modales con Escape), `focusFirst`, y la constante `PAGE_SIZE` (50 para paginación).
- **`auth.js`**: Contiene `ADMIN_PASSWORD`, maneja el login con checkbox "Recordar sesión" (guarda en `localStorage` o `sessionStorage`), define `isAdminLoggedIn()` (revisa ambos storages) y `logoutUser()` (limpia ambos storages).
- **`admin.js`**: Carga la lista de trabajadores con una doble suscripción (workers + advances global) que elimina el N+1 al calcular saldos. Permite crear/editar trabajadores, abrir detalle, agregar/editar/eliminar adelantos individuales (con paginación de 50 en filas), copiar enlace, enviar mensajes de WhatsApp, buscar trabajadores en vivo, y generar un reporte filtrable por trabajador y rango de fechas (filtro aplicado en servidor con `where` sobre `date` + paginación; el total se calcula desde un cache en memoria alimentado por la suscripción global a `advances`). Inicializa modo oscuro y soporta cierre de modales con Escape + gestión de foco.
- **`worker.js`**: Lee el parámetro `id` de la URL, carga los datos del trabajador y sus adelantos (con paginación de 50), y muestra saldo completo (consultado una sola vez sin `orderBy`) e historial. Inicializa modo oscuro.

### Hojas de estilo

- **`css/styles.css`**: Usa variables CSS, diseño mobile-first, clases utilitarias y estilos para login, tarjetas, tablas, listas de trabajadores y modales.

---

## 4. Modelo de datos en Firestore

### Colección `workers`

```
workers/{workerId}
  - name        string
  - phone       string   (código de país sin + ni espacios, ej: 573001234567)
  - notes       string
  - createdAt   timestamp
```

### Colección `advances`

```
advances/{advanceId}
  - workerId    string   (referencia al documento del trabajador)
  - date        string   (formato ISO yyyy-mm-dd)
  - amount      number
  - concept     string
  - createdAt   timestamp
```

### Índices necesarios

El archivo `firestore.indexes.json` define los índices compuestos requeridos:

- Colección `advances`:
  - `workerId` ASCENDING + `date` DESCENDING (detalle del trabajador)
  - `workerId` ASCENDING + `date` ASCENDING (filtro de fechas + trabajador)
  - `date` DESCENDING (reporte sin filtro de trabajador)
  - `date` ASCENDING (reporte con rango ascendente)

> Los índices de un solo campo (`date`) son creados automáticamente por Firestore, pero se declaran para mayor claridad.

Desplegar con:

```bash
firebase deploy --only firestore:indexes
```

Si se agregan nuevas consultas con `orderBy` + `where`, habrá que añadir los índices correspondientes y desplegarlos en Firebase.

---

## 5. Proceso de construcción y ejecución

No hay pasos de build. Es una aplicación estática.

### Para probar localmente

Servir la carpeta raíz con cualquier servidor estático. Por ejemplo:

```bash
python -m http.server 8080
```

Luego abrir `http://localhost:8080`.

### Despliegue

Opción A - Firebase Hosting:

```bash
firebase deploy
```

Requiere tener instalado Firebase CLI y haber iniciado sesión.

Opción B - GitHub Pages:

Subir los archivos a la rama configurada para GitHub Pages. El README indica la URL `https://lojanoe.github.io/Cuentas_FINCA/`.

> Nota: `firebase.json` configura un rewrite que redirige cualquier ruta a `/index.html`. Esto es útil para Firebase Hosting, pero puede no ser el comportamiento deseado en GitHub Pages si se accede directamente a `worker.html?id=...`.

---

## 6. Convenciones de desarrollo

- **Idioma del código y de la interfaz:** Español. Mantener mensajes, comentarios, nombres de variables descriptivas y UI en español.
- **Módulos ES:** Los scripts se cargan con `<script type="module">` y usan `import`/`export`.
- **Busting de caché:** Los archivos CSS y JS se referencian con un parámetro `?v=N` (por ejemplo, `?v=6` en `admin.html`). Al realizar cambios importantes conviene incrementar este número para forzar la recarga en navegadores.
- **Manipulación del DOM:** Directa con `document.getElementById` y plantillas de strings.
- **Escape de HTML:** Existe una función `escapeHtml()` en `admin.js` y `worker.js` para evitar inyección al renderizar texto dinámico.
- **Manejo de errores:** Se muestran mensajes en elementos con clase `.message` y clases `.error`, `.info` o `.success`.
- **Firestore:** Se usan `onSnapshot` para actualizaciones en tiempo real y `serverTimestamp()` para fechas de creación.

---

## 7. Instrucciones de prueba

El proyecto **no tiene pruebas automatizadas** ni framework de testing configurado.

Validación manual recomendada:

1. Abrir `index.html` e ingresar la contraseña `Mirador1`.
2. En `admin.html`, crear un trabajador con nombre y número de celular.
3. Hacer clic en el trabajador, verificar que se abra el modal de detalle.
4. Agregar uno o más adelantos y confirmar que el saldo y la tabla se actualicen.
5. Probar los botones de WhatsApp y copiar enlace.
6. Abrir el enlace del trabajador en `worker.html?id=WORKER_ID` y verificar que se muestren saldo e historial.
7. En la sección **Reporte de adelantos**, probar el filtro por trabajador, por rango de fechas y la combinación de ambos; verificar que la tabla y el total se actualicen correctamente.
8. Probar el cierre de sesión y que redirija al login.

---

## 8. Consideraciones de seguridad

La aplicación prioriza la simplicidad sobre la seguridad. Antes de usarla con datos sensibles, considerar lo siguiente:

- **Contraseña hardcodeada:** La contraseña del administrador (`Mirador1`) está escrita directamente en `js/auth.js` y es visible en el cliente.
- **Sin autenticación de Firebase:** Solo se usa `sessionStorage` para recordar que el admin inició sesión. Cualquiera puede manipular ese valor.
- **Reglas de Firestore abiertas:** `firestore.rules` permite lectura y escritura a cualquiera (`allow read, write: if true;`).
- **Enlaces de trabajadores son públicos:** Cualquier persona con el enlace `worker.html?id=WORKER_ID` puede ver el saldo e historial de ese trabajador.
- **Sin sanitización exhaustiva:** Aunque existe `escapeHtml()`, el proyecto no usa un framework con binding seguro.

> Esta versión es para uso interno y confiado. No exponer datos sensibles sin implementar autenticación real, reglas restrictivas y validación en backend.

---

## 9. Notas para agentes

- Si se cambia la lógica de autenticación, mantener compatibilidad con el flujo actual de `index.html` -> `admin.html`.
- Si se agregan nuevas consultas a Firestore, verificar y actualizar `firestore.indexes.json`.
- El reporte de adelantos aplica el filtro de fechas en el cliente para evitar requerir índices compuestos adicionales más allá del ya definido para el detalle del trabajador.
- Si se cambian estilos o scripts, considerar incrementar el parámetro `?v=N` en las etiquetas `<link>` y `<script>` de los HTML para invalidar la caché.
- No agregar dependencias de npm/webpack a menos que se solicite explícitamente; el proyecto está diseñado para funcionar sin build.
- Mantener la interfaz, comentarios y mensajes de usuario en español.

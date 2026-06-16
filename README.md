# 🏡 Cuentas FINCA

Aplicación web para llevar el control de adelantos del personal de una finca.

- El **administrador** inicia sesión con Firebase Auth, registra trabajadores y sus adelantos por fecha, valor y concepto.
- Cada **trabajador** inicia sesión con un usuario y contraseña creados por el administrador, y ve únicamente su propio saldo e historial.

## Tecnologías

- HTML5 + CSS3 + JavaScript vanilla
- Firebase Authentication (solo para el administrador)
- Firebase Firestore (base de datos en la nube)
- Firebase Hosting (opcional, para publicar la app)

## Estructura del proyecto

```
Cuentas_FINCA/
├── index.html              # Página de inicio de sesión (admin y trabajador)
├── admin.html              # Panel del administrador
├── worker.html             # Panel del trabajador
├── css/
│   └── styles.css          # Estilos
├── js/
│   ├── firebase-config.js  # Configuración de Firebase (tú la completas)
│   ├── auth.js             # Login, hash de contraseñas y redirecciones
│   ├── admin.js            # Lógica del administrador
│   └── worker.js           # Lógica del trabajador
├── firestore.rules         # Reglas de seguridad de Firestore
├── firebase.json           # Configuración de Firebase Hosting
└── README.md               # Este archivo
```

## Estructura de datos en Firestore

```
users/{uid}
  - email
  - name
  - role: "admin"

workers/{workerId}
  - name
  - username
  - passwordHash    ← hash SHA-256 de la contraseña
  - phone           ← número para WhatsApp
  - notes
  - createdAt
  - createdBy       ← UID del admin

advances/{advanceId}
  - workerId
  - date
  - amount
  - concept
  - createdAt
  - createdBy       ← UID del admin
```

## Configuración paso a paso

### 1. Crear proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/).
2. Crea un nuevo proyecto.
3. Registra una aplicación web y copia la configuración de Firebase.
4. Ve a **Project settings > General > Your apps > Firebase SDK snippet** y copia los valores.

### 2. Configurar Firebase en la app

Abre `js/firebase-config.js` y reemplaza los valores de ejemplo por los de tu proyecto:

```js
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};
```

### 3. Habilitar Authentication (solo para admin)

1. En Firebase Console, ve a **Build > Authentication**.
2. Haz clic en **Get started**.
3. Habilita el proveedor **Email/Password**.
4. Guarda los cambios.

### 4. Crear el primer administrador

1. Ve a **Authentication > Users**.
2. Haz clic en **Add user**.
3. Ingresa el correo y la contraseña del administrador.
4. Guarda. Firebase generará un **UID**.
5. Ve a **Firestore Database > Data**.
6. Crea una colección llamada `users` y un documento con el UID del admin.
7. Dentro del documento agrega estos campos:

```
email: "correo@ejemplo.com"
name: "Nombre del Admin"
role: "admin"
```

El campo `role` debe ser exactamente `"admin"`.

### 5. Crear índice en Firestore

El login de los trabajadores usa una consulta que compara `username` y `passwordHash`. La primera vez que un trabajador intente iniciar sesión, Firebase pedirá crear un índice compuesto.

1. Abre la consola del navegador (F12) cuando intentes iniciar sesión como trabajador.
2. Busca el enlace que Firebase te da para crear el índice.
3. Haz clic en él y luego en **Create index**.

O créalo manualmente en **Firestore Database > Indexes > Composite indexes** con:
- Colección: `workers`
- Campos: `username` (Ascending), `passwordHash` (Ascending)

### 6. Subir reglas de seguridad

1. Ve a **Firestore Database > Rules**.
2. Copia el contenido de `firestore.rules` de este proyecto.
3. Publica las reglas.

## Uso de la app

### Iniciar sesión como administrador

1. Abre la app y selecciona **"Soy administrador"**.
2. Ingresa tu correo y contraseña de Firebase.
3. Haz clic en **Iniciar sesión**.

### Crear un trabajador

1. En el panel de administración, haz clic en **+ Nuevo trabajador**.
2. Completa:
   - **Nombre completo**
   - **Usuario** (único, el trabajador lo usará para iniciar sesión)
   - **Contraseña**
   - **Número de celular** (para WhatsApp, incluye código de país sin `+` ni espacios, ejemplo: `573001234567`)
   - **Notas** (opcional)
3. Haz clic en **Crear trabajador**.
4. Para avisarle, haz clic en **📱 Avisar por WhatsApp**. Esto abrirá WhatsApp con un mensaje pre-escrito que incluye el usuario y el enlace de la app.

### Registrar adelantos

1. En el listado de trabajadores, haz clic en el trabajador.
2. En el panel de detalle, ingresa la **fecha**, el **valor** y el **concepto**.
3. Haz clic en **Guardar adelanto**.

### Iniciar sesión como trabajador

1. Abre la app y selecciona **"Soy trabajador"**.
2. Ingresa el **usuario** y la **contraseña** que le dio el administrador.
3. Haz clic en **Iniciar sesión**.
4. El trabajador verá su saldo total y el historial de sus adelantos.

## Despliegue opcional con Firebase Hosting

Si quieres publicar la app en internet:

1. Instala Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```
2. Inicia sesión:
   ```bash
   firebase login
   ```
3. Selecciona el proyecto:
   ```bash
   firebase init hosting
   ```
   - Selecciona tu proyecto de Firebase.
   - Cuando pregunte por el directorio público, escribe `.` (punto, que significa raíz).
   - Configúrala como SPA: **Yes**.
4. Despliega:
   ```bash
   firebase deploy
   ```

## Despliegue con GitHub Pages

Los archivos de la app ya están en la raíz del repositorio para que GitHub Pages pueda servirlos.

1. Ve a tu repositorio en GitHub.
2. Entra a **Settings > Pages**.
3. En **Source** selecciona **Deploy from a branch**.
4. Selecciona la rama `main` y la carpeta `/ (root)`.
5. Guarda y espera unos minutos. GitHub te dará la URL de la app.

## Despliegue con Firebase Hosting

Si más adelante prefieres usar Firebase Hosting en lugar de GitHub Pages:

## Notas de seguridad

- **Solo el administrador usa Firebase Authentication.**
- **Las contraseñas de los trabajadores se guardan hasheadas** con SHA-256 en Firestore, nunca en texto plano.
- **Las colecciones `workers` y `advances` tienen lectura pública** porque los trabajadores no tienen sesión de Firebase. Cualquiera con el enlace de la app podría ver los datos. Si necesitas más privacidad en el futuro, se recomienda volver a usar Firebase Authentication para todos los usuarios.
- **Solo el administrador puede escribir** en `workers` y `advances` gracias a las reglas de seguridad.

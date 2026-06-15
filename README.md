# 🏡 Cuentas FINCA

Aplicación web para llevar el control de adelantos del personal de una finca.

- El **administrador** registra trabajadores y sus adelantos por fecha, valor y concepto.
- Cada **trabajador** puede iniciar sesión y ver únicamente su propio saldo e historial.

## Tecnologías

- HTML5 + CSS3 + JavaScript vanilla
- Firebase Authentication (login seguro)
- Firebase Firestore (base de datos en la nube)
- Firebase Hosting (opcional, para publicar la app)

## Estructura de datos en Firestore

```
users/{uid}
  - email
  - name
  - role: "admin" | "worker"

workers/{uid}
  - name
  - phone
  - notes
  - userId  ← mismo UID del usuario

advances/{advanceId}
  - workerId
  - userId   ← para que el trabajador pueda leer solo los suyos
  - date
  - amount
  - concept
```

## Estructura del proyecto

```
Cuentas_FINCA/
├── public/
│   ├── index.html              # Página de inicio de sesión
│   ├── admin.html              # Panel del administrador
│   ├── worker.html             # Panel del trabajador
│   ├── css/styles.css          # Estilos
│   └── js/
│       ├── firebase-config.js  # Configuración de Firebase (tú la completas)
│       ├── auth.js             # Login, roles y redirecciones
│       ├── admin.js            # Lógica del administrador
│       └── worker.js           # Lógica del trabajador
├── firestore.rules             # Reglas de seguridad de Firestore
├── firebase.json               # Configuración de Firebase Hosting
└── README.md                   # Este archivo
```

## Configuración paso a paso

### 1. Crear proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/).
2. Crea un nuevo proyecto.
3. Registra una aplicación web y copia la configuración de Firebase.
4. Ve a **Project settings > General > Your apps > Firebase SDK snippet** y copia los valores.

### 2. Configurar Firebase en la app

Abre `public/js/firebase-config.js` y reemplaza los valores de ejemplo por los de tu proyecto:

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

### 3. Habilitar Authentication

1. En Firebase Console, ve a **Build > Authentication**.
2. Haz clic en **Get started**.
3. Habilita el proveedor **Email/Password**.
4. Guarda los cambios.

### 4. Crear el primer administrador

Este paso se hace manualmente porque no se permite crear usuarios desde la app por seguridad.

1. Ve a **Authentication > Users**.
2. Haz clic en **Add user**.
3. Ingresa el correo y la contraseña del administrador.
4. Guarda. Firebase generará un **UID** (un identificador único).
5. Ve a **Firestore Database > Data**.
6. Crea una colección llamada `users` y un documento con el UID del admin.
7. Dentro del documento agrega estos campos:

```
email: "correo@ejemplo.com"
name: "Nombre del Admin"
role: "admin"
```

El campo `role` debe ser exactamente `"admin"`.

### 5. Subir reglas de seguridad

1. Ve a **Firestore Database > Rules**.
2. Copia el contenido de `firestore.rules` de este proyecto.
3. Publica las reglas.

### 6. Crear trabajadores

1. El administrador inicia sesión en la app con su correo y contraseña.
2. En Firebase Console, va a **Authentication > Users > Add user** y crea el usuario del trabajador (correo y contraseña).
3. Copia el UID generado.
4. En la app, hace clic en **+ Nuevo trabajador**, pega el UID, completa el nombre, correo y demás datos, y guarda.
5. Listo. El trabajador ya puede iniciar sesión y ver solo sus adelantos.

## Uso de la app

### Administrador
- Ve el listado de todos los trabajadores con su saldo total.
- Hace clic en un trabajador para ver su historial de adelantos.
- Agrega nuevos adelantos indicando fecha, valor y concepto.
- Vincula nuevos trabajadores creados previamente en Firebase Console.

### Trabajador
- Inicia sesión con el correo y contraseña asignados por el administrador.
- Ve su saldo total acumulado.
- Ve el historial de adelantos ordenado por fecha.
- No puede editar ni agregar información.

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
   firebase init
   ```
4. Despliega:
   ```bash
   firebase deploy
   ```

## Notas de seguridad

- Las contraseñas nunca se guardan en Firestore; se manejan mediante Firebase Authentication.
- Los trabajadores solo pueden leer sus propios datos gracias a las reglas de seguridad.
- Solo los administradores pueden escribir en las colecciones `users`, `workers` y `advances`.
- No se permite crear usuarios desde la app para evitar exposición de la API key o problemas de sesión.

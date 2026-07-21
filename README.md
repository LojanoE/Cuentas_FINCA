# 🏡 Cuentas FINCA

Aplicación web simple para llevar el control de adelantos del personal de una finca.

- Solo hay **un administrador**.
- La contraseña de administrador es: **`Mirador1`**
- El administrador puede registrar trabajadores, sus números de celular y los adelantos por fecha, valor y concepto.
- Cada trabajador tiene un **enlace único** para ver su cuenta.
- El admin puede enviar el enlace por WhatsApp.
- El panel de administración incluye un **reporte de adelantos** con filtro por trabajador y rango de fechas.

## Tecnologías

- HTML5 + CSS3 + JavaScript vanilla
- Firebase Firestore (base de datos en la nube)
- GitHub Pages (para publicar la app)

## Estructura del proyecto

```
Cuentas_FINCA/
├── index.html              # Login de administrador
├── admin.html              # Panel del administrador
├── worker.html             # Vista pública del trabajador
├── css/
│   └── styles.css          # Estilos
├── js/
│   ├── firebase-config.js  # Configuración de Firebase
│   ├── auth.js             # Login con contraseña fija
│   ├── admin.js            # Lógica del administrador
│   └── worker.js           # Lógica de la vista del trabajador
├── firestore.rules         # Reglas abiertas (uso interno)
├── firestore.indexes.json  # Índices compuestos de Firestore
├── firebase.json           # Configuración de Firebase Hosting
└── README.md               # Este archivo
```

## Configuración de Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/) y crea un proyecto.
2. Copia la configuración de Firebase.
3. Abre `js/firebase-config.js` y reemplaza los valores.
4. Ve a **Firestore Database > Rules** y pega el contenido de `firestore.rules`:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

5. Haz clic en **Publish**.

### Crear índices en Firestore

La app necesita un índice compuesto en la colección `advances`. Puedes crearlo de dos formas:

**Opción A - Firebase CLI (recomendada):**

```bash
firebase login
firebase deploy --only firestore:indexes
```

**Opción B - Consola manual:**

Ve a **Firestore Database > Indexes > Composite indexes** y crea:

1. Colección: `advances`
   - `workerId` (Ascending)
   - `date` (Descending)

## Cómo usar

1. Abre la URL de GitHub Pages.
2. Ingresa la contraseña: **`Mirador1`**
3. Crea trabajadores con nombre y número de celular.
4. Haz clic en un trabajador para ver su cuenta y agregar adelantos.
5. Después de guardar un adelanto, usa el botón **📱 Avisar este adelanto por WhatsApp**.
6. Usa el botón **🔗 Copiar enlace del trabajador** para copiar su enlace único.
7. Usa el botón **📱 Avisar por WhatsApp** para enviar el aviso de registro con el enlace.
8. En la sección **📊 Reporte de adelantos**, selecciona un trabajador y/o un rango de fechas, luego presiona **Filtrar** para ver el detalle y el total.

### Enlace del trabajador

Cada trabajador accede con un enlace como este:

```
https://lojanoe.github.io/Cuentas_FINCA/worker.html?id=WORKER_ID
```

Reemplaza `WORKER_ID` por el ID del documento del trabajador en Firestore, o usa el botón de copiar enlace en el panel de administración.

## Estructura de datos

```
workers/{workerId}
  - name
  - phone
  - notes
  - createdAt

advances/{advanceId}
  - workerId
  - date
  - amount
  - concept
  - createdAt
```

## Nota de seguridad

Esta es una versión simplificada para uso interno. La contraseña está en el código JavaScript y las reglas de Firestore están abiertas. No uses esta app para datos sensibles sin agregar más seguridad.

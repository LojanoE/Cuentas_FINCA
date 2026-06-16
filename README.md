# 🏡 Cuentas FINCA

Aplicación web simple para llevar el control de adelantos del personal de una finca.

- Solo hay **un administrador**.
- La contraseña de administrador es: **`Mirador1`**
- El administrador puede registrar trabajadores, sus números de celular y los adelantos por fecha, valor y concepto.
- Puede enviar un mensaje por WhatsApp avisando al trabajador.

## Tecnologías

- HTML5 + CSS3 + JavaScript vanilla
- Firebase Firestore (base de datos en la nube)
- GitHub Pages (para publicar la app)

## Estructura del proyecto

```
Cuentas_FINCA/
├── index.html              # Login de administrador
├── admin.html              # Panel del administrador
├── worker.html             # Redirección al login
├── css/
│   └── styles.css          # Estilos
├── js/
│   ├── firebase-config.js  # Configuración de Firebase
│   ├── auth.js             # Login con contraseña fija
│   └── admin.js            # Lógica del administrador
├── firestore.rules         # Reglas abiertas (uso interno)
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

## Cómo usar

1. Abre la URL de GitHub Pages.
2. Ingresa la contraseña: **`Mirador1`**
3. Crea trabajadores con nombre y número de celular.
4. Haz clic en un trabajador para ver su cuenta y agregar adelantos.
5. Usa el botón **📱 Avisar por WhatsApp** para enviar el aviso.

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

// CONFIGURACIÓN DE FIREBASE
// Proyecto: cuentas-finca-sl

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA5zNyjtQwt9T0tGP7bX7_J8P0R39oa9Hc",
  authDomain: "cuentas-finca-sl.firebaseapp.com",
  projectId: "cuentas-finca-sl",
  storageBucket: "cuentas-finca-sl.firebasestorage.app",
  messagingSenderId: "6851617129",
  appId: "1:6851617129:web:a81458bdea66ca92661df8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;

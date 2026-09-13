// src/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBbo4zonOoWoIZyBJP88k5PQlAIF7xcJQo",
  authDomain: "releaseradar-app-472a8.firebaseapp.com",
  databaseURL: "https://releaseradar-app-472a8-default-rtdb.firebaseio.com",
  projectId: "releaseradar-app-472a8",
  storageBucket: "releaseradar-app-472a8.firebasestorage.app",
  messagingSenderId: "7525822161",
  appId: "1:7525822161:web:2ac4c6f8b687075f88dff0"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
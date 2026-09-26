import { initializeApp }
from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import { getAuth }
from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import { getFirestore }
from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const firebaseConfig = {

  apiKey: "AIzaSyAfjg2guzdb7yHwhVCkrUyJfs_FmcbTtkE",

  authDomain:
  "lotterie-proximus.firebaseapp.com",

  projectId:
  "lotterie-proximus",

  storageBucket:
  "lotterie-proximus.firebasestorage.app",

  messagingSenderId:
  "1082108067568",

  appId:
  "1:1082108067568:web:97ad8f468e27c078f40c35"
};

const app =
    initializeApp(firebaseConfig);

export const auth = getAuth(app);

export const db = getFirestore(app);

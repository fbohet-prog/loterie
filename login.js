import { auth } from "./firebase.js";

import {
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

const loginForm =
  document.getElementById("loginForm");

const message =
  document.getElementById("message");

loginForm.addEventListener(
  "submit",
  async function(event) {

    event.preventDefault();

    try {

      await signInWithEmailAndPassword(
        auth,
        email.value,
        password.value
      );

      message.textContent =
        "✅ Connexion réussie";

    }
    catch(error) {

      message.textContent =
        error.message;
    }
});

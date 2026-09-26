import { auth } from "./firebase.js";

import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    message.textContent = "Connexion en cours...";
    message.style.color = "#5c2d91";

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    try {
        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        message.textContent = "✅ Connexion réussie.";
        message.style.color = "green";

        window.location.href = "dashboard.html";

    } catch (error) {
        console.error("Erreur de connexion :", error);

        message.style.color = "red";

        switch (error.code) {
            case "auth/invalid-email":
                message.textContent =
                    "L'adresse e-mail n'est pas valide.";
                break;

            case "auth/invalid-credential":
                message.textContent =
                    "Adresse e-mail ou mot de passe incorrect.";
                break;

            case "auth/user-disabled":
                message.textContent =
                    "Ce compte a été désactivé.";
                break;

            case "auth/too-many-requests":
                message.textContent =
                    "Trop de tentatives. Réessayez ultérieurement.";
                break;

            default:
                message.textContent =
                    "Connexion impossible : " + error.message;
        }
    }
});

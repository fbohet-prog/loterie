import { auth, db } from "./firebase.js";

import {
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");

registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    message.textContent = "Création du compte...";
    message.style.color = "#5c2d91";

    const prenom = document.getElementById("prenom").value.trim();
    const nom = document.getElementById("nom").value.trim();
    const societe = document.getElementById("societe").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

        await setDoc(
            doc(db, "users", userCredential.user.uid),
            {
                prenom: prenom,
                nom: nom,
                societe: societe,
                email: email.toLowerCase(),
                role: "participant",
                eligible: false,
                scanCount: 0,
                createdAt: serverTimestamp()
            }
        );

        message.textContent =
            "✅ Inscription réussie. Votre compte a été créé.";

        message.style.color = "green";

       registerForm.reset();

setTimeout(() => {
    window.location.href = "dashboard.html";
}, 1500);

    } catch (error) {
        console.error("Erreur d'inscription :", error);

        message.style.color = "red";

        switch (error.code) {
            case "auth/email-already-in-use":
                message.textContent =
                    "Cette adresse e-mail est déjà utilisée.";
                break;

            case "auth/invalid-email":
                message.textContent =
                    "L'adresse e-mail n'est pas valide.";
                break;

            case "auth/weak-password":
                message.textContent =
                    "Le mot de passe n'est pas suffisamment sécurisé.";
                break;

            case "auth/operation-not-allowed":
                message.textContent =
                    "L'inscription par e-mail n'est pas activée dans Firebase.";
                break;

            default:
                message.textContent =
                    "Impossible de créer le compte : " + error.message;
        }
    }
});


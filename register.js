import { auth, db } from "./firebase.js";

import {
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

window.inscription = async function () {

    try {

        const prenom =
            document.getElementById("prenom").value;

        const nom =
            document.getElementById("nom").value;

        const email =
            document.getElementById("email").value;

        const password =
            document.getElementById("password").value;

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
                email: email,
                role: "participant"
            }
        );

        document.getElementById("message").innerHTML =
            "✅ Compte créé avec succès";

    } catch (error) {

        document.getElementById("message").innerHTML =
            error.message;
    }
}

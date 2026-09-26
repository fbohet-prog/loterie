import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
}
from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
    doc,
    getDoc
}
from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

onAuthStateChanged(auth, async (user) => {

    if (!user) {

        window.location.href =
            "login.html";

        return;
    }

    const userRef =
        doc(db, "users", user.uid);

    const userSnap =
        await getDoc(userRef);

    const data =
        userSnap.data();

    document.getElementById("welcome")
        .innerHTML =
        "Bienvenue " +
        data.prenom +
        " " +
        data.nom;

    const count =
        data.scanCount || 0;

    document.getElementById("count")
        .innerHTML =
        count;

    document.getElementById("progress")
        .style.width =
        (count * 10) + "%";

    if (count >= 10) {

        document.getElementById("status")
            .innerHTML =
            "✅ Vous êtes qualifié pour le tirage.";

    } else {

        document.getElementById("status")
            .innerHTML =
            "Encore " +
            (10 - count) +
            " stand(s) à visiter.";
    }
});

window.logout = async function () {

    await signOut(auth);

    window.location.href =
        "index.html";
}

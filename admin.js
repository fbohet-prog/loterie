import { auth, db }
from "./firebase.js";

import {
    onAuthStateChanged
}
from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
    collection,
    getDocs,
    addDoc,
    serverTimestamp
}
from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const participantCount =
    document.getElementById(
        "participantCount"
    );

const eligibleCount =
    document.getElementById(
        "eligibleCount"
    );

const drawButton =
    document.getElementById(
        "drawButton"
    );

const winner =
    document.getElementById(
        "winner"
    );

let eligibleParticipants = [];

onAuthStateChanged(
    auth,
    async (user) => {

        if (!user) {

            window.location.href =
                "login.html";

            return;
        }

        await loadParticipants();
    }
);

async function loadParticipants() {

    const snapshot =
        await getDocs(
            collection(
                db,
                "users"
            )
        );

    participantCount.textContent =
        snapshot.size;

    eligibleParticipants = [];

    snapshot.forEach(doc => {

        const data =
            doc.data();

        if (data.eligible === true) {

            eligibleParticipants.push({
                id: doc.id,
                ...data
            });
        }
    });

    eligibleCount.textContent =
        eligibleParticipants.length;
}

drawButton.addEventListener(
    "click",
    async () => {

        if (
            eligibleParticipants.length === 0
        ) {

            alert(
                "Aucun participant qualifié."
            );

            return;
        }

        const randomIndex =
            Math.floor(
                Math.random() *
                eligibleParticipants.length
            );

        const selected =
            eligibleParticipants[
                randomIndex
            ];

        winner.innerHTML =
            `
            🎉 Gagnant

            <br><br>

            ${selected.prenom}
            ${selected.nom}

            <br>

            ${selected.societe}

            <br>

            ${selected.email}
            `;

        await addDoc(
            collection(
                db,
                "draws"
            ),
            {
                participantId:
                    selected.id,

                prenom:
                    selected.prenom,

                nom:
                    selected.nom,

                societe:
                    selected.societe,

                email:
                    selected.email,

                drawDate:
                    serverTimestamp()
            }
        );
    }
);

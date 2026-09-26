import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

import {
    collection,
    doc,
    getDocs,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";

const participantCountElement = document.getElementById("participantCount");
const eligibleCountElement = document.getElementById("eligibleCount");
const availableCountElement = document.getElementById("availableCount");
const adminMessage = document.getElementById("adminMessage");
const drawButton = document.getElementById("drawButton");
const reloadButton = document.getElementById("reloadButton");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");

let participants = [];

function setMessage(text, color = "") {
    adminMessage.textContent = text;
    adminMessage.style.color = color;
}

function isTrue(value) {
    return value === true || value === "true" || value === 1;
}

function isEligible(participant) {
    return isTrue(participant.eligible)
        || isTrue(participant.qualified)
        || isTrue(participant.isEligible);
}

function isSelected(participant) {
    return isTrue(participant.selected)
        || isTrue(participant.drawn)
        || Boolean(participant.winner);
}

function getParticipantName(participant) {
    const firstName = participant.prenom
        || participant.firstName
        || participant.firstname
        || "Participant";

    const lastName = participant.nom
        || participant.lastName
        || participant.lastname
        || "";

    return `${firstName} ${lastName}`.trim();
}

function updateStats() {
    const eligibleParticipants = participants.filter(isEligible);
    const availableParticipants = eligibleParticipants.filter(
        (participant) => !isSelected(participant)
    );

    participantCountElement.textContent = participants.length;
    eligibleCountElement.textContent = eligibleParticipants.length;
    availableCountElement.textContent = availableParticipants.length;
    drawButton.disabled = availableParticipants.length < 3;
}

async function loadParticipants() {
    setMessage("Chargement des participants...");
    drawButton.disabled = true;

    try {
        // Les inscriptions créent les profils dans "users".
        // La collection "participants" n'est donc pas utilisée ici.
        const snapshot = await getDocs(collection(db, "users"));

        participants = snapshot.docs
            .map((participantDocument) => ({
                id: participantDocument.id,
                ...participantDocument.data()
            }))
            .filter((participant) => {
                // Les utilisateurs inscrits par register.js ont role="participant".
                // Les anciens documents sans role restent acceptés.
                return !participant.role
                    || participant.role === "participant";
            });

        updateStats();
        setMessage(`${participants.length} participant(s) chargé(s).`, "green");
    } catch (error) {
        console.error("Erreur lors du chargement des participants :", error);
        participantCountElement.textContent = "0";
        eligibleCountElement.textContent = "0";
        availableCountElement.textContent = "0";
        setMessage(
            `Impossible de charger les participants : ${error.message}`,
            "#b42318"
        );
    }
}

function displayResults(winners) {
    const resultIds = [
        "firstWinner",
        "secondWinner",
        "thirdWinner"
    ];

    winners.forEach((winner, index) => {
        const resultElement = document.getElementById(resultIds[index]);
        resultElement.textContent = getParticipantName(winner);
    });

    document.getElementById("resultsSection").classList.remove("hidden");
}

async function drawWinners() {
    const availableParticipants = participants.filter(
        (participant) => isEligible(participant) && !isSelected(participant)
    );

    if (availableParticipants.length < 3) {
        setMessage(
            "Il faut au moins 3 participants qualifiés et disponibles.",
            "#b42318"
        );
        return;
    }

    drawButton.disabled = true;
    setMessage("Tirage en cours...");

    const shuffledParticipants = [...availableParticipants];

    for (let index = shuffledParticipants.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [shuffledParticipants[index], shuffledParticipants[randomIndex]] = [
            shuffledParticipants[randomIndex],
            shuffledParticipants[index]
        ];
    }

    const winners = shuffledParticipants.slice(0, 3);

    try {
        await Promise.all(
            winners.map((winner) => updateDoc(
                doc(db, "users", winner.id),
                {
                    selected: true,
                    drawn: true
                }
            ))
        );

        winners.forEach((winner) => {
            winner.selected = true;
            winner.drawn = true;
        });

        displayResults(winners);
        updateStats();
        setMessage("✅ Tirage terminé !", "green");
    } catch (error) {
        console.error("Erreur lors du tirage :", error);
        drawButton.disabled = false;
        setMessage(
            `Le tirage a échoué : ${error.message}`,
            "#b42318"
        );
    }
}

loginButton.addEventListener("click", () => {
    window.location.href = "login.html";
});

logoutButton.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.href = "login.html";
    } catch (error) {
        console.error("Erreur de déconnexion :", error);
        setMessage("Impossible de se déconnecter.", "#b42318");
    }
});

reloadButton.addEventListener("click", loadParticipants);
drawButton.addEventListener("click", drawWinners);

onAuthStateChanged(auth, (user) => {
    if (!user) {
        loginButton.style.display = "block";
        logoutButton.style.display = "none";
        drawButton.disabled = true;
        setMessage("Connectez-vous pour accéder aux participants.");
        return;
    }

    loginButton.style.display = "none";
    logoutButton.style.display = "block";
    loadParticipants();
});

import { auth, db } from "./firebase.js";
import { collection, getDocs, query, where, updateDoc, doc } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";

let participants = [];
let currentUser = null;

// Vérifier l'authentification
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('loginButton').style.display = 'none';
        document.getElementById('logoutButton').style.display = 'block';
        loadParticipants();
    } else {
        document.getElementById('loginButton').style.display = 'block';
        document.getElementById('logoutButton').style.display = 'none';
        document.getElementById('adminMessage').textContent = 'Vous devez être connecté pour accéder à cette page.';
    }
});

// Charger les participants depuis Firestore
async function loadParticipants() {
    try {
        document.getElementById('adminMessage').textContent = 'Chargement des participants...';
        
        const q = query(collection(db, "participants"));
        const querySnapshot = await getDocs(q);
        
        participants = [];
        querySnapshot.forEach((doc) => {
            participants.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        updateStats();
        document.getElementById('adminMessage').textContent = `${participants.length} participant(s) chargé(s)`;
        
    } catch (error) {
        console.error("Erreur lors du chargement:", error);
        document.getElementById('adminMessage').textContent = `Erreur: ${error.message}`;
    }
}

// Mettre à jour les statistiques
function updateStats() {
    const participantCount = participants.length;
    
    const eligibleCount = participants.filter(p => 
        p.eligible === true || p.qualified === true
    ).length;
    
    const availableCount = participants.filter(p => 
        (p.eligible === true || p.qualified === true) && p.selected !== true
    ).length;
    
    document.getElementById('participantCount').textContent = participantCount;
    document.getElementById('eligibleCount').textContent = eligibleCount;
    document.getElementById('availableCount').textContent = availableCount;
    
    // Activer le bouton de tirage si au moins 3 participants sont disponibles
    document.getElementById('drawButton').disabled = availableCount < 3;
}

// Tirer les 3 gagnants
document.getElementById('drawButton').addEventListener('click', async function() {
    const availableParticipants = participants.filter(p => 
        (p.eligible === true || p.qualified === true) && p.selected !== true
    );
    
    if (availableParticipants.length < 3) {
        alert('Pas assez de participants disponibles pour le tirage.');
        return;
    }
    
    // Sélectionner 3 gagnants aléatoires
    const winners = [];
    const shuffled = [...availableParticipants].sort(() => 0.5 - Math.random());
    
    for (let i = 0; i < 3; i++) {
        winners.push(shuffled[i]);
    }
    
    try {
        // Marquer les gagnants dans Firestore
        for (const winner of winners) {
            await updateDoc(doc(db, "participants", winner.id), {
                selected: true
            });
        }
        
        // Afficher les résultats
        displayResults(winners);
        document.getElementById('drawButton').disabled = true;
        
    } catch (error) {
        console.error("Erreur lors du tirage:", error);
        alert(`Erreur: ${error.message}`);
    }
});

// Afficher les résultats du tirage
function displayResults(winners) {
    const resultsSection = document.getElementById('resultsSection');
    resultsSection.classList.remove('hidden');
    
    // Premier prix
    const firstName = winners[0]?.firstName || 'Inconnu';
    const firstLastName = winners[0]?.lastName || '';
    document.getElementById('firstWinner').textContent = `${firstName} ${firstLastName}`;
    
    // Deuxième prix
    const secondName = winners[1]?.firstName || 'Inconnu';
    const secondLastName = winners[1]?.lastName || '';
    document.getElementById('secondWinner').textContent = `${secondName} ${secondLastName}`;
    
    // Troisième prix
    const thirdName = winners[2]?.firstName || 'Inconnu';
    const thirdLastName = winners[2]?.lastName || '';
    document.getElementById('thirdWinner').textContent = `${thirdName} ${thirdLastName}`;
    
    document.getElementById('adminMessage').textContent = '✅ Tirage terminé !';
}

// Bouton Recharger
document.getElementById('reloadButton').addEventListener('click', function() {
    location.reload();
});

// Boutons de connexion/déconnexion
document.getElementById('loginButton').addEventListener('click', function() {
    window.location.href = 'login.html';
});

document.getElementById('logoutButton').addEventListener('click', function() {
    auth.signOut().then(() => {
        localStorage.removeItem('authToken');
        sessionStorage.clear();
        window.location.href = 'login.html';
    }).catch((error) => {
        console.error('Erreur de déconnexion:', error);
    });
});

function tirage() {
    const nombre = Math.floor(Math.random() * 100) + 1;
    document.getElementById("resultat").innerHTML =
        "Numéro gagnant : " + nombre;
}
body {
    font-family: Arial, sans-serif;
    text-align: center;
    background: #f5f5f5;
}

.welcome {
    margin-top: 30px;
}

.logo {
    width: 250px;
    max-width: 90%;
    margin-bottom: 20px;
}

h1 {
    color: #5C2D91;
    font-size: 2.5em;
}

h2 {
    color: #333;
    margin-bottom: 20px;
}

button {
    background: #5C2D91;
    color: white;
    border: none;
    padding: 15px 30px;
    font-size: 18px;
    border-radius: 8px;
    cursor: pointer;
}

button:hover {
    background: #4a2475;
}

.footer {
    margin-top: 40px;
    color: #666;
}

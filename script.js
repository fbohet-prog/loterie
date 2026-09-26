function tirage() {

    const nombre = Math.floor(Math.random() * 100) + 1;

    document.getElementById("resultat").innerHTML =
        "🎉 Numéro gagnant : " + nombre;

}

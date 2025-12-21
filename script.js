// script.js

// L'URL de ton API (celle configurée dans Cloudflare)
const API_URL = "https://api.brawl-track.com"; 

// --- GESTION DE L'AFFICHAGE ---
function toggleForms() {
    document.getElementById('login-form').classList.toggle('hidden');
    document.getElementById('register-form').classList.toggle('hidden');
    document.getElementById('message').innerText = "";
}

// --- INSCRIPTION ---
async function register() {
    const username = document.getElementById('reg-username').value;
    const tag = document.getElementById('reg-tag').value;
    const password = document.getElementById('reg-password').value;

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, tag, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert("Compte créé ! Connecte-toi maintenant.");
            toggleForms();
        } else {
            document.getElementById('message').innerText = "Erreur: " + data.message;
        }
    } catch (error) {
        document.getElementById('message').innerText = "Erreur de connexion au serveur.";
        console.error(error);
    }
}

// --- CONNEXION ---
async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            // On sauvegarde le Token magique dans le navigateur
            localStorage.setItem('token', data.token);
            localStorage.setItem('userTag', data.tag);
            // On redirige vers le dashboard
            window.location.href = "dashboard.html";
        } else {
            document.getElementById('message').innerText = data.message;
        }
    } catch (error) {
        document.getElementById('message').innerText = "Impossible de joindre l'API.";
    }
}

// --- LOGOUT ---
function logout() {
    localStorage.removeItem('token');
    window.location.href = "index.html";
}

// --- VÉRIFICATION SÉCURITÉ (Pour dashboard.html) ---
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = "index.html"; // Oust ! Retour à l'accueil
    } else {
        // Si on est sur le dashboard, on charge les infos
        if(document.getElementById('user-tag')) {
            document.getElementById('user-tag').innerText = localStorage.getItem('userTag');
            loadMyStats(); // Chargement auto
        }
    }
}

// --- CHARGEMENT DES STATS ---
async function loadMyStats() {
    const token = localStorage.getItem('token');
    const statsDiv = document.getElementById('stats-area');
    const msg = document.getElementById('dashboard-msg');
    
    msg.innerText = "Chargement des données Supercell...";

    try {
        const response = await fetch(`${API_URL}/api/my-stats`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}` // On montre patte blanche
            }
        });

        const data = await response.json();

        if (response.ok) {
            // Affichage dynamique des stats
            statsDiv.innerHTML = `
                <div class="stat-card">
                    <div>Trophées</div>
                    <div class="stat-value">${data.trophies} 🏆</div>
                </div>
                <div class="stat-card">
                    <div>Victoires 3v3</div>
                    <div class="stat-value" style="color:#007bff">${data['3vs3Victories']} ⚔️</div>
                </div>
                <div class="stat-card">
                    <div>Solo</div>
                    <div class="stat-value" style="color:#28a745">${data.soloVictories} 🥇</div>
                </div>
                <div class="stat-card">
                    <div>Duo</div>
                    <div class="stat-value" style="color:#17a2b8">${data.duoVictories} 🤝</div>
                </div>
            `;
            msg.innerText = "Données mises à jour !";
        } else {
            msg.innerText = "Erreur: " + (data.message || "Impossible de lire les stats");
        }
    } catch (error) {
        msg.innerText = "Erreur réseau.";
    }
}

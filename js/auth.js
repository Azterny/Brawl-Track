// =========================================================
// === AUTH.JS — Authentification & Intercepteur global ====
// =========================================================

// Fix #1 — Intercepteur global 401
// Toutes les requêtes authentifiées doivent passer par fetchAuth().
// Si le serveur retourne 401, la session est invalidée et l'utilisateur
// est redirigé vers la page de connexion.
async function fetchAuth(url, options = {}) {
    let response;
    try {
        response = await fetch(url, options);
    } catch (e) {
        // Erreur réseau — on ne déconnecte pas, on propage
        throw e;
    }
    if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        // Redirection uniquement si on n'est pas déjà sur la page de login
        if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
            window.location.href = '/';
        }
        return null;
    }
    return response;
}

// --- VÉRIFICATION D'ACCÈS (pages protégées) ---
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = "/";
        return;
    }

    const nav = document.getElementById('main-navigation');
    if (nav) nav.classList.remove('hidden');

    if (typeof loadMyStats === 'function') {
        loadMyStats();
    }
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = "/";
}

async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const msg = document.getElementById('message');

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            localStorage.setItem('token', data.token);
            if (data.username) localStorage.setItem('username', data.username);
            window.location.href = "userhome.html";
        } else {
            if (msg) msg.innerText = data.message;
        }
    } catch (e) {
        if (msg) msg.innerText = "Erreur serveur";
    }
}

async function register() {
    const username = document.getElementById('reg-username').value;
    const password = document.getElementById('reg-password').value;
    const msg = document.getElementById('message');

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            alert("Compte créé ! Connecte-toi.");
            toggleForms();
        } else {
            if (msg) {
                msg.innerHTML = `<img src="/assets/icons/pin_crysmile.png" alt="" style="height: 1.2em; vertical-align: middle; margin-right: 5px;" onerror="this.style.display='none'"> ` + data.message;
            }
        }
    } catch (e) {
        if (msg) msg.innerText = "Erreur serveur";
    }
}

// --- AUTHENTIFICATION ---

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = "index.html";
        return;
    }
    // Si on est sur le dashboard, on active le menu et on charge les stats
    const burger = document.getElementById('burger-menu');
    if(burger) burger.classList.remove('hidden');
    
    // Fonction définie dans dashboard.js
    if(typeof loadMyStats === 'function') {
        loadMyStats();
    }
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = "index.html";
}

async function login() {
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const msg = document.getElementById('message');

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        
        if (res.ok) {
            localStorage.setItem('token', data.token);
            window.location.href = "dashboard.html";
        } else {
            if(msg) msg.innerText = "❌ " + data.message;
        }
    } catch (e) { if(msg) msg.innerText = "❌ Erreur serveur"; }
}

async function register() {
    const username = document.getElementById('reg-username').value;
    // SUPPRIMER : const tag = document.getElementById('reg-tag').value;
    const password = document.getElementById('reg-password').value;
    const msg = document.getElementById('message');

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            // MODIFIER LA LIGNE SUIVANTE (retirer 'tag')
            body: JSON.stringify({ username, password }) 
        });
        const data = await res.json();
        
        if (res.ok) {
            alert("✅ Compte créé ! Connecte-toi.");
            toggleForms();
        } else {
            if(msg) msg.innerText = "⚠️ " + data.message;
        }
    } catch (e) { if(msg) msg.innerText = "❌ Erreur serveur"; }
}

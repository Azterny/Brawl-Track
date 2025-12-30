// --- AUTHENTIFICATION ---

function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = "index.html";
        return;
    }
    
    const nav = document.getElementById('main-navigation');
    if(nav) nav.classList.remove('hidden');
    
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
            // MODIFICATION ICI : dashboard.html -> userhome.html
            window.location.href = "userhome.html";
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

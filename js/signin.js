// --- LOGIQUE PAGE INSCRIPTION ---

window.onload = function() {
    // Si déjà connecté, rediriger vers /home
    const token = localStorage.getItem('token');
    if (token) {
        window.location.href = '/home';
    }
};

async function doRegister() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm  = document.getElementById('reg-confirm').value;
    const msgEl    = document.getElementById('reg-message');
    const btnEl    = document.getElementById('btn-register');

    msgEl.style.color = '#ff5555';
    msgEl.innerText = '';

    // Validation côté client
    if (!username || !password || !confirm) {
        msgEl.innerText = '❌ Veuillez remplir tous les champs.';
        return;
    }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        msgEl.innerText = '❌ Pseudo invalide (3–20 caractères alphanumériques ou _).';
        return;
    }
    if (password.length < 8) {
        msgEl.innerText = '❌ Le mot de passe doit contenir au moins 8 caractères.';
        return;
    }
    if (password !== confirm) {
        msgEl.innerText = '❌ Les mots de passe ne correspondent pas.';
        return;
    }

    btnEl.disabled = true;
    btnEl.innerText = 'Inscription en cours...';

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok) {
            // Inscription réussie → redirection vers / avec paramètre
            window.location.href = '/?registered=1';
        } else {
            msgEl.innerText = '❌ ' + (data.message || 'Erreur lors de l\'inscription.');
            btnEl.disabled = false;
            btnEl.innerText = 'S\'INSCRIRE';
        }
    } catch (e) {
        msgEl.innerText = '❌ Erreur de connexion. Réessayez plus tard.';
        btnEl.disabled = false;
        btnEl.innerText = 'S\'INSCRIRE';
    }
}

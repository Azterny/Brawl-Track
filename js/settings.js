// =========================================================
// === SETTINGS.JS — Paramètres du compte utilisateur ===
// =========================================================

// --- CONFIGURATION INTERVALLE ---
function setupIntervalUI(tier, interval) {
    document.getElementById('interval-basic').classList.add('hidden');
    document.getElementById('interval-custom').classList.add('hidden');
    const minutesContainer = document.getElementById('container-minutes');

    if (tier === 'basic') {
        document.getElementById('interval-basic').classList.remove('hidden');
        document.getElementById('select-interval-basic').value = interval || 720;
    } else {
        document.getElementById('interval-custom').classList.remove('hidden');

        const h = Math.floor(interval / 60);
        const m = interval % 60;
        document.getElementById('input-hours').value = h;
        document.getElementById('input-minutes').value = m;

        const msg = document.getElementById('interval-limit-msg');

        if (tier === 'subscriber') {
            msg.innerText = "⭐ Abonné : Réglage en Heures uniquement (Min 1h).";
            minutesContainer.classList.add('hidden');
        } else {
            msg.innerText = "👑 Premium : Précision à la minute (Min 15 min).";
            minutesContainer.classList.remove('hidden');
        }
    }
}

async function saveInterval() {
    const token = localStorage.getItem('token');
    let min = 720;

    if (currentUserTier === 'basic') {
        min = parseInt(document.getElementById('select-interval-basic').value);
    } else {
        const h = parseInt(document.getElementById('input-hours').value) || 0;
        let m = 0;
        if (!document.getElementById('container-minutes').classList.contains('hidden')) {
            m = parseInt(document.getElementById('input-minutes').value) || 0;
        }
        min = (h * 60) + m;
    }

    try {
        const res = await fetchAuth(`${API_URL}/api/settings/interval`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ minutes: min })
        });
        if (!res) return; // 401 géré par fetchAuth
        const data = await res.json();
        if (res.ok) alert("✅ " + data.message);
        else alert("⚠️ " + data.message);
    } catch (e) {
        alert("❌ Erreur de connexion au serveur.");
    }
}

// --- GESTION DU COMPTE ---
async function updateProfile() {
    const u = document.getElementById('new-username').value.trim();
    const p = document.getElementById('new-password').value;
    if (!u && !p) return;

    const token = localStorage.getItem('token');

    try {
        const res = await fetchAuth(`${API_URL}/api/settings/update-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ username: u || undefined, password: p || undefined })
        });
        if (!res) return; // 401 géré par fetchAuth

        const data = await res.json();
        alert(data.message || (res.ok ? "✅ Profil mis à jour" : "⚠️ Erreur"));

        // Fix #9 — Mise à jour du nom en localStorage pour la navbar
        if (res.ok && u) {
            localStorage.setItem('username', u);
        }
    } catch (e) {
        alert("❌ Erreur de connexion au serveur.");
    }
}

async function deleteAccount() {
    if (!confirm("SUPPRIMER DÉFINITIVEMENT votre compte ? Cette action est irréversible.")) return;

    const token = localStorage.getItem('token');

    try {
        // Fix #5 — Vérification du statut HTTP avant de déconnecter
        const res = await fetchAuth(`${API_URL}/api/settings/delete-account`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res) return; // 401 géré par fetchAuth

        if (res.ok) {
            localStorage.removeItem('token');
            localStorage.removeItem('username');
            window.location.href = "/";
        } else {
            const data = await res.json().catch(() => ({}));
            alert("⚠️ Suppression échouée : " + (data.message || `HTTP ${res.status}`));
        }
    } catch (e) {
        alert("❌ Erreur réseau. Le compte n'a pas été supprimé.");
    }
}

// --- ARCHIVES ---
async function deleteArchives() {
    const s = document.getElementById('delete-select').value;
    if (!confirm("Supprimer ces archives ? Cette action est irréversible.")) return;

    const token = localStorage.getItem('token');

    try {
        const res = await fetchAuth(`${API_URL}/api/archive/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ mode: s === 'all' ? 'all' : 'older_than', days: s })
        });
        if (!res) return;

        const data = await res.json();
        alert(data.message || (res.ok ? "✅ Archives supprimées" : "⚠️ Erreur"));
        if (typeof loadMyStats === 'function') loadMyStats();
    } catch (e) {
        alert("❌ Erreur de connexion au serveur.");
    }
}

// --- TIMER PROCHAINE ARCHIVE ---
function updateNextArchiveTimer(lastDateStr, intervalMinutes) {
    const display = document.getElementById('next-update-timer');
    if (!lastDateStr) {
        display.innerText = "En attente de la première archive...";
        return;
    }

    const lastDate  = new Date(lastDateStr);
    const nextDateMs = lastDate.getTime() + (intervalMinutes * 60000);
    const diffMs    = nextDateMs - Date.now();

    if (diffMs <= 0) {
        display.innerHTML = "<span style='color: #ffce00'>En cours / En attente du Worker...</span>";
    } else {
        const diffMins = Math.floor(diffMs / 60000);
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        let text = h > 0 ? `${h}h ` : '';
        text += `${m}min`;
        display.innerText = "Dans environ " + text;
    }
}

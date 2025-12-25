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
        
        // Calcul Heures / Minutes
        const h = Math.floor(interval / 60);
        const m = interval % 60;
        document.getElementById('input-hours').value = h;
        document.getElementById('input-minutes').value = m;
        
        const msg = document.getElementById('interval-limit-msg');
        
        if (tier === 'subscriber') {
            msg.innerText = "⭐ Abonné : Réglage en Heures uniquement (Min 1h).";
            // On cache totalement les minutes
            minutesContainer.classList.add('hidden');
        } else {
            msg.innerText = "👑 Premium : Précision à la minute (Min 15 min).";
            // On affiche les minutes
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
        // On ne lit les minutes que si ce n'est pas caché (donc Premium)
        if (!document.getElementById('container-minutes').classList.contains('hidden')) {
            m = parseInt(document.getElementById('input-minutes').value) || 0;
        }
        min = (h * 60) + m;
    }

    try {
        const res = await fetch(`${API_URL}/api/settings/interval`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ minutes: min })
        });
        const data = await res.json();
        
        if(res.ok) alert("✅ " + data.message);
        else alert("⚠️ " + data.message);
        
    } catch(e) { alert("Erreur connexion"); }
}

// --- GESTION DU COMPTE ---
async function updateProfile() {
    const u = document.getElementById('new-username').value;
    const p = document.getElementById('new-password').value;
    if(!u && !p) return;
    
    await fetch(`${API_URL}/api/settings/update-profile`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ username: u, password: p })
    }).then(r => r.json()).then(d => alert(d.message));
}

async function deleteAccount() {
    if(!confirm("SUPPRIMER DÉFINITIVEMENT ?")) return;
    await fetch(`${API_URL}/api/settings/delete-account`, { 
        method: 'DELETE', 
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    localStorage.removeItem('token');
    window.location.href = "index.html";
}

// --- ARCHIVES (Suppression manuelle retirée) ---
async function deleteArchives() {
    const s = document.getElementById('delete-select').value;
    if(!confirm("Supprimer ?")) return;
    
    await fetch(`${API_URL}/api/archive/delete`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ mode: s === 'all' ? 'all' : 'older_than', days: s })
    }).then(r => r.json()).then(d => {
        alert(d.message);
        loadMyStats(); // Recharger le graph
    });
}

// --- TIMER PROCHAINE ARCHIVE ---
function updateNextArchiveTimer(lastDateStr, intervalMinutes) {
    const display = document.getElementById('next-update-timer');
    if (!lastDateStr) {
        display.innerText = "En attente de la première archive...";
        return;
    }

    // Calcul de la date cible
    const lastDate = new Date(lastDateStr);
    const nextDateMs = lastDate.getTime() + (intervalMinutes * 60000);
    const now = new Date().getTime();
    
    const diffMs = nextDateMs - now;

    if (diffMs <= 0) {
        display.innerHTML = "<span style='color: #ffce00'>En cours / En attente du Worker...</span>";
    } else {
        const diffMins = Math.floor(diffMs / 60000);
        const h = Math.floor(diffMins / 60);
        const m = diffMins % 60;
        
        let text = "";
        if (h > 0) text += `${h}h `;
        text += `${m}min`;
        
        display.innerText = "Dans environ " + text;
    }
}

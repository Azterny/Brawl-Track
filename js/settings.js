// --- CONFIGURATION INTERVALLE ---
function setupIntervalUI(tier, interval) {
    document.getElementById('interval-basic').classList.add('hidden');
    document.getElementById('interval-custom').classList.add('hidden');
    
    if (tier === 'basic') {
        document.getElementById('interval-basic').classList.remove('hidden');
        document.getElementById('select-interval-basic').value = interval || 720;
    } else {
        document.getElementById('interval-custom').classList.remove('hidden');
        document.getElementById('input-hours').value = Math.floor(interval / 60);
        document.getElementById('input-minutes').value = interval % 60;
        
        const msg = document.getElementById('interval-limit-msg');
        if (tier === 'subscriber') {
            msg.innerText = "⭐ Abonné : Min 1H. Minutes ignorées.";
            document.getElementById('input-minutes').disabled = true;
        } else {
            msg.innerText = "👑 Premium : Min 15 Minutes.";
            document.getElementById('input-minutes').disabled = false;
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
        const m = parseInt(document.getElementById('input-minutes').value) || 0;
        min = (h * 60) + m;
    }
    
    try {
        const res = await fetch(`${API_URL}/api/settings/interval`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ minutes: min })
        });
        const data = await res.json();
        alert(data.message);
    } catch(e) { alert("Erreur serveur"); }
}

// --- ACTIONS PROFIL ---
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

// --- ARCHIVES ---
async function manualArchive() {
    if(!confirm("Sauvegarder ?")) return;
    await fetch(`${API_URL}/api/archive/manual`, { 
        method: 'POST', 
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } 
    });
    loadMyStats();
}

async function deleteArchives() {
    const s = document.getElementById('delete-select').value;
    if(!confirm("Supprimer ?")) return;
    
    await fetch(`${API_URL}/api/archive/delete`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, 
        body: JSON.stringify({ mode: s==='all'?'all':'older_than', days: s }) 
    });
    loadMyStats();
}

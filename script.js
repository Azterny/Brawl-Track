const API_URL = "https://api.brawl-track.com"; 
let fullHistoryData = [];
let currentLiveTrophies = null;
let globalBrawlersList = [];
let currentUserTier = 'basic'; 

// ==========================================
// 1. FONCTIONS POUR LA PAGE D'ACCUEIL
// ==========================================

function toggleForms() {
    const loginForm = document.getElementById('login-form');
    const regForm = document.getElementById('register-form');
    const msg = document.getElementById('message');
    if(loginForm && regForm) {
        loginForm.classList.toggle('hidden');
        regForm.classList.toggle('hidden');
        if(msg) msg.innerText = "";
    }
}

function publicSearch() {
    const tagInput = document.getElementById('public-tag');
    if(!tagInput) return;
    const tag = tagInput.value.trim().replace('#', '');
    if(tag) window.location.href = `dashboard.html?tag=${tag}`;
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
    const tag = document.getElementById('reg-tag').value;
    const password = document.getElementById('reg-password').value;
    const msg = document.getElementById('message');

    try {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ username, tag, password })
        });
        const data = await res.json();
        if (res.ok) {
            alert("✅ Compte créé avec succès ! Connecte-toi maintenant.");
            toggleForms();
        } else {
            if(msg) msg.innerText = "⚠️ " + data.message;
        }
    } catch (e) { if(msg) msg.innerText = "❌ Erreur serveur"; }
}

// ==========================================
// 2. LOGIQUE DU DASHBOARD
// ==========================================

function toggleMenu() { document.getElementById('menu-dropdown').classList.toggle('active'); }
window.onclick = function(e) { 
    const burger = document.getElementById('burger-menu');
    if (burger && !burger.contains(e.target)) {
        const menu = document.getElementById('menu-dropdown');
        if(menu) menu.classList.remove('active');
    }
}
function switchView(view) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`view-${view}`);
    if(target) target.classList.add('active');
    const menu = document.getElementById('menu-dropdown');
    if(menu) menu.classList.remove('active');
}

function logout() { localStorage.removeItem('token'); window.location.href = "index.html"; }

function checkAuth() {
    if (!localStorage.getItem('token')) window.location.href = "index.html";
    const burger = document.getElementById('burger-menu');
    if(burger) burger.classList.remove('hidden');
    loadMyStats();
}

async function loadMyStats() {
    try {
        const res = await fetch(`${API_URL}/api/my-stats`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
        const data = await res.json();
        if (!res.ok) throw new Error();
        currentUserTier = data.internal_tier || 'basic';
        if(document.getElementById('player-name')) {
            renderProfile(data);
            setupIntervalUI(data.internal_tier, data.internal_interval);
            loadBrawlersGrid(data.brawlers);
            loadHistoryChart(localStorage.getItem('token'), data.trophies);
        }
    } catch (e) { logout(); }
}

function renderProfile(data) {
    document.getElementById('player-name').innerText = data.name;
    document.getElementById('player-tag').innerText = data.tag;
    const badge = document.getElementById('tier-badge');
    badge.className = `badge badge-${currentUserTier}`;
    badge.innerText = currentUserTier === 'subscriber' ? 'Abonné' : currentUserTier;
    
    document.getElementById('stats-area').innerHTML = `
        <div class="stat-card"><div>Trophées</div><div class="stat-value" style="color:#ffce00">🏆 ${data.trophies}</div></div>
        <div class="stat-card"><div>3vs3</div><div class="stat-value" style="color:#007bff">⚔️ ${data['3vs3Victories']}</div></div>
        <div class="stat-card"><div>Solo</div><div class="stat-value" style="color:#28a745">🥇 ${data.soloVictories}</div></div>
        <div class="stat-card"><div>Duo</div><div class="stat-value" style="color:#17a2b8">🤝 ${data.duoVictories}</div></div>
    `;
}

function setupIntervalUI(tier, interval) {
    const basicDiv = document.getElementById('interval-basic');
    if(!basicDiv) return;
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
    let min = 720;
    if (currentUserTier === 'basic') min = parseInt(document.getElementById('select-interval-basic').value);
    else min = (parseInt(document.getElementById('input-hours').value)||0)*60 + (parseInt(document.getElementById('input-minutes').value)||0);
    await fetch(`${API_URL}/api/settings/interval`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ minutes: min })
    }).then(r => r.json()).then(d => alert(d.message));
}

async function updateProfile() {
    const u = document.getElementById('new-username').value, p = document.getElementById('new-password').value;
    if(!u && !p) return;
    await fetch(`${API_URL}/api/settings/update-profile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ username: u, password: p })
    }).then(r => r.json()).then(d => alert(d.message));
}

async function deleteAccount() {
    if(!confirm("SUPPRIMER DÉFINITIVEMENT ?")) return;
    await fetch(`${API_URL}/api/settings/delete-account`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }});
    logout();
}

async function loadBrawlersGrid(playerBrawlers) {
    if(!document.getElementById('brawlers-grid')) return;
    const res = await fetch(`${API_URL}/api/brawlers`);
    const data = await res.json();
    globalBrawlersList = (data.items || []).map(b => {
        const owned = playerBrawlers.find(pb => pb.id === b.id);
        return { id: b.id, name: b.name, imageUrl: `https://cdn.brawlify.com/brawlers/borderless/${b.id}.png`, owned: !!owned, trophies: owned ? owned.trophies : 0 };
    });
    sortBrawlers();
}

function sortBrawlers() {
    const el = document.getElementById('sort-brawlers');
    if(!el) return;
    const c = el.value;
    if (c === 'trophies') globalBrawlersList.sort((a, b) => b.trophies - a.trophies);
    else if (c === 'name') globalBrawlersList.sort((a, b) => a.name.localeCompare(b.name));
    else globalBrawlersList.sort((a, b) => a.id - b.id);
    const grid = document.getElementById('brawlers-grid');
    grid.innerHTML = '';
    globalBrawlersList.forEach(b => {
        const d = document.createElement('div');
        d.className = 'brawler-card';
        if (!b.owned) d.style.filter = "grayscale(100%) opacity(0.3)";
        else d.style.border = "1px solid #ffce00";
        d.innerHTML = `<img src="${b.imageUrl}" style="width:100%;aspect-ratio:1/1;object-fit:contain;"><div style="font-size:0.8em;overflow:hidden;text-overflow:ellipsis;">${b.name}</div>${b.owned ? `<div style="color:#ffce00;font-size:0.7em;">🏆 ${b.trophies}</div>` : ''}`;
        grid.appendChild(d);
    });
}

// --- GRAPHIQUE CORRIGÉ (Responsif) ---
async function loadHistoryChart(token, liveTrophies) {
    currentLiveTrophies = liveTrophies;
    try {
        const res = await fetch(`${API_URL}/api/history`, { headers: { 'Authorization': `Bearer ${token}` } });
        if(res.ok) fullHistoryData = await res.json();
        else fullHistoryData = [];
    } catch(e) { fullHistoryData = []; }
    updateChartFilter(0);
}

function updateChartFilter(days) {
    const canvas = document.getElementById('trophyChart');
    if (!canvas) return;
    let data = [...fullHistoryData];
    if (days > 0) {
        const limit = new Date(); limit.setDate(new Date().getDate() - days);
        data = fullHistoryData.filter(i => new Date(i.date) >= limit);
    }
    const dataset = data.map(h => ({ x: h.date, y: h.trophies }));
    if (currentLiveTrophies) dataset.push({ x: new Date().toISOString(), y: currentLiveTrophies });
    
    if(dataset.length === 0) return;

    if(window.myChart) window.myChart.destroy();
    window.myChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { datasets: [{ data: dataset, borderColor: '#ffce00', backgroundColor: 'rgba(255, 206, 0, 0.1)', borderWidth: 2, tension: 0.1, fill: true, pointRadius: 3 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Important: permet au graph de s'adapter au conteneur de 300px
            plugins: { legend: {display:false} }, 
            scales: { x: { type: 'time', time: { unit: 'day', displayFormats: { day: 'dd/MM' } }, grid: {color:'#333'} }, y: { grid: {color:'#333'} } } 
        }
    });
}

// --- PUBLIC & ARCHIVES ---
async function loadPublicProfile(tag) {
    const actions = document.getElementById('public-actions');
    if(actions) actions.classList.remove('hidden');
    const burger = document.getElementById('burger-menu');
    if(burger) burger.classList.add('hidden');
    try {
        const res = await fetch(`${API_URL}/api/public/player/${tag}`);
        const data = await res.json();
        renderProfile(data); loadBrawlersGrid(data.brawlers);
    } catch (e) { alert("Joueur introuvable"); }
}
async function manualArchive() {
    if(!confirm("Sauvegarder ?")) return;
    await fetch(`${API_URL}/api/archive/manual`, { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` } });
    loadMyStats();
}
async function deleteArchives() {
    const s = document.getElementById('delete-select').value;
    if(!confirm("Supprimer ?")) return;
    await fetch(`${API_URL}/api/archive/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` }, body: JSON.stringify({ mode: s==='all'?'all':'older_than', days: s }) });
    loadMyStats();
}

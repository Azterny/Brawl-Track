// --- MOUCHARD D'ERREURS (Affiche l'erreur sur l'écran) ---
window.onerror = function(message, source, lineno, colno, error) {
    const loader = document.getElementById('loading');
    if(loader) {
        loader.innerHTML = `
            <div style="color:red; font-weight:bold; background:black; padding:20px; border-radius:10px; text-align:left;">
                ☠️ ERREUR CRITIQUE :<br>
                ${message}<br><br>
                👉 Le problème est à la ligne : ${lineno}<br>
                (Vérifiez que index.html contient bien les bons IDs)
            </div>
        `;
        loader.classList.remove('hidden');
    }
};

const API_BASE = "https://api.brawl-track.com/api";
const CDN_BRAWLER = "https://cdn.brawlify.com/brawlers/borderless/";
const CDN_MODE = "https://cdn.brawlify.com/gamemodes/"; 
let ALL_BRAWLERS = [];

document.addEventListener("DOMContentLoaded", () => {
    // VÉRIFICATION DE SÉCURITÉ HTML
    const requiredIds = ['home-section', 'content', 'player-view', 'club-view', 'leaderboard-view'];
    for (const id of requiredIds) {
        if (!document.getElementById(id)) {
            throw new Error(`L'élément HTML avec l'ID '${id}' est introuvable ! Mettez à jour index.html.`);
        }
    }

    loadGlobalData();
    if (sessionStorage.redirect) {
        const path = sessionStorage.redirect;
        delete sessionStorage.redirect;
        history.replaceState(null, null, path);
        handleRouting(path);
    } else {
        handleRouting(location.pathname);
    }
    window.onpopstate = () => handleRouting(location.pathname);
});

async function loadGlobalData() {
    try {
        const eventRes = await fetch(`${API_BASE}/events/rotation`);
        if(eventRes.ok) displayEvents(await eventRes.json());
        
        const brawlerRes = await fetch(`${API_BASE}/brawlers`);
        if(brawlerRes.ok) {
            const data = await brawlerRes.json();
            ALL_BRAWLERS = data.items;
        }
    } catch(e) { console.error(e); }
}

function handleRouting(path) {
    // C'est souvent ici que ça plante si le HTML est vieux
    document.getElementById('home-section').classList.add('hidden');
    document.getElementById('content').classList.add('hidden');
    document.getElementById('player-view').classList.add('hidden');
    document.getElementById('club-view').classList.add('hidden');
    document.getElementById('leaderboard-view').classList.add('hidden');
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error-msg').classList.add('hidden');

    if (path === "/" || path === "") {
        document.getElementById('home-section').classList.remove('hidden');
    } 
    else if (path.includes('/stats/player/')) {
        const tag = path.split('/stats/player/')[1];
        if (tag) {
            document.getElementById('tagInput').value = tag;
            searchPlayer(tag, false);
        }
    } 
    else if (path.includes('/stats/club/')) {
        const tag = path.split('/stats/club/')[1];
        searchClub(tag, false);
    }
    else if (path.includes('/leaderboard/')) {
        const country = path.split('/leaderboard/')[1];
        searchLeaderboard(country, false);
    }
}

window.goTo = function(url) {
    history.pushState(null, '', url);
    handleRouting(url);
    return false;
}

async function searchPlayer(tag, updateUrl) {
    if (updateUrl) history.pushState(null, '', `/stats/player/${tag}`);
    document.getElementById('home-section').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');
    document.getElementById('loading').classList.remove('hidden');
    
    try {
        const res = await fetch(`${API_BASE}/players/%23${tag}`);
        if(!res.ok) throw new Error("Joueur introuvable");
        const data = await res.json();
        displayProfile(data);
        
        // Battlelog
        fetch(`${API_BASE}/players/%23${tag}/battlelog`)
            .then(r => r.json())
            .then(d => displayBattleLog(d.items))
            .catch(e => console.log("No battlelog"));

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('player-view').classList.remove('hidden');
    } catch(e) { showError(e); }
}

async function searchClub(tag, updateUrl) {
    tag = tag.replace('#', '');
    if (updateUrl) history.pushState(null, '', `/stats/club/${tag}`);
    document.getElementById('home-section').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');
    document.getElementById('loading').classList.remove('hidden');

    try {
        const res = await fetch(`${API_BASE}/clubs/%23${tag}`);
        if(!res.ok) throw new Error("Club introuvable");
        const data = await res.json();
        displayClub(data);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('club-view').classList.remove('hidden');
    } catch(e) { showError(e); }
}

async function searchLeaderboard(country, updateUrl) {
    if (updateUrl) history.pushState(null, '', `/leaderboard/${country}`);
    document.getElementById('home-section').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');
    document.getElementById('loading').classList.remove('hidden');

    try {
        const res = await fetch(`${API_BASE}/rankings/${country}/players`);
        if(!res.ok) throw new Error("Classement indisponible");
        const data = await res.json();
        displayLeaderboard(data.items, country);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('leaderboard-view').classList.remove('hidden');
    } catch(e) { showError(e); }
}

function showError(error) {
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error-msg').innerText = error.message;
    document.getElementById('error-msg').classList.remove('hidden');
}

// --- AFFICHAGE (Raccourci pour gagner de la place, mais fonctionnel) ---
function displayEvents(events) {
    const grid = document.getElementById('eventsGrid');
    if(!grid) return;
    grid.innerHTML = "";
    if(!events || !events.length) { grid.innerHTML = "<small>Aucun event</small>"; return; }
    
    events.slice(0, 6).forEach(e => {
        let name = e.event.mode.replace(/\s+/g, '-');
        if(name.includes("Showdown")) name = "Showdown";
        grid.innerHTML += `
            <div class="event-card">
                <img src="${CDN_MODE}${name}.png" class="event-img" onerror="this.src='https://cdn.brawlify.com/gamemodes/Gem-Grab.png'">
                <div class="event-info"><div class="event-mode">${e.event.mode}</div><div class="event-map">${e.event.map}</div></div>
            </div>`;
    });
}

function displayProfile(data) {
    document.getElementById('pName').innerText = data.name;
    document.getElementById('pName').style.color = "#" + data.nameColor.substring(4);
    document.getElementById('pTag').innerText = data.tag;
    const cLink = data.club.name ? `<a href="#" onclick="return goTo('/stats/club/${data.club.tag.replace('#','')}')">🏠 ${data.club.name}</a>` : "Pas de club";
    document.getElementById('pClub').innerHTML = cLink;
    
    document.getElementById('statTrophies').innerText = data.trophies.toLocaleString();
    document.getElementById('statHighest').innerText = data.highestTrophies.toLocaleString();
    document.getElementById('stat3v3').innerText = data['3vs3Victories'].toLocaleString();
    
    const grid = document.getElementById('brawlersGrid');
    grid.innerHTML = "";
    let list = (ALL_BRAWLERS.length ? ALL_BRAWLERS : data.brawlers).map(gb => {
        const pb = data.brawlers.find(b => b.id === gb.id);
        return pb ? {...pb, unlocked:true} : {...gb, trophies:0, power:0, unlocked:false};
    }).sort((a,b) => (b.unlocked - a.unlocked) || (b.trophies - a.trophies));

    list.forEach(b => {
        const style = b.unlocked ? '' : 'filter:grayscale(100%); opacity:0.5;';
        const info = b.unlocked ? `🏆 ${b.trophies} <span style="background:#d63031; padding:2px; border-radius:3px; font-size:0.7em;">LVL ${b.power}</span>` : '🔒';
        grid.innerHTML += `
            <div class="brawler-card" style="${style}">
                <img src="${CDN_BRAWLER}${b.id}.png" style="width:60px">
                <div>${b.name}</div>
                <div>${info}</div>
            </div>`;
    });
}

function displayClub(data) {
    document.getElementById('cName').innerText = data.name;
    document.getElementById('cDesc').innerText = data.description || "";
    document.getElementById('cTrophies').innerText = data.trophies;
    document.getElementById('cMembers').innerText = data.members.length;
    const list = document.getElementById('membersList');
    list.innerHTML = "";
    data.members.sort((a,b)=>b.trophies - a.trophies).forEach(m => {
        let color = m.role === "president" ? "red" : m.role === "vicePresident" ? "orange" : "white";
        list.innerHTML += `
            <div class="member-item" onclick="goTo('/stats/player/${m.tag.replace('#','')}')">
                <div><span style="color:#${m.nameColor.substring(4)}">${m.name}</span> <span style="font-size:0.8em; color:${color}">(${m.role})</span></div>
                <div style="color:#f1c40f">🏆 ${m.trophies}</div>
            </div>`;
    });
}

function displayLeaderboard(items, country) {
    document.getElementById('lbTitle').innerText = country === 'global' ? "Mondial" : "France";
    const list = document.getElementById('lbList');
    list.innerHTML = "";
    items.forEach(p => {
        let icon = p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : p.rank;
        list.innerHTML += `
            <div class="rank-item" onclick="goTo('/stats/player/${p.tag.replace('#','')}')">
                <div style="width:40px; text-align:center; font-weight:bold;">${icon}</div>
                <div style="flex:1"><span style="color:#${p.nameColor.substring(4)}">${p.name}</span> <small>${p.club ? p.club.name : ''}</small></div>
                <div style="color:#f1c40f">🏆 ${p.trophies}</div>
            </div>`;
    });
}

function displayBattleLog(battles) {
    const list = document.getElementById('battleList');
    list.innerHTML = "";
    let wins = battles.filter(b => b.battle.result === "victory" || (b.battle.trophyChange > 0)).length;
    if(document.getElementById('winRate')) document.getElementById('winRate').innerText = `Win Rate: ${Math.round(wins/battles.length*100)}%`;
    
    battles.slice(0,10).forEach(b => {
        let res = b.battle.result === "victory" || (b.battle.trophyChange > 0) ? "VICTOIRE" : "DÉFAITE";
        let color = res === "VICTOIRE" ? "#2ecc71" : "#e74c3c";
        list.innerHTML += `
            <div class="battle-item" style="border-left: 5px solid ${color}">
                <div><b>${res}</b> <small>${b.battle.mode}</small></div>
                <div>${b.battleTime.substring(9,11)}h${b.battleTime.substring(11,13)}</div>
            </div>`;
    });
}

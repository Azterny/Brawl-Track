const API_BASE = "https://api.brawl-track.com/api";
const CDN_BRAWLER = "https://cdn.brawlify.com/brawlers/borderless/";
const CDN_MODE = "https://cdn.brawlify.com/gamemodes/"; 

let ALL_BRAWLERS = [];

// --- INITIALISATION ---
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Charger les données globales (Brawlers + Maps)
    loadGlobalData();

    // 2. Gérer le Routing (URL)
    if (sessionStorage.redirect) {
        const path = sessionStorage.redirect;
        delete sessionStorage.redirect;
        history.replaceState(null, null, path);
        handleRouting(path);
    } else {
        handleRouting(location.pathname);
    }

    // Gestion bouton Précédent
    window.onpopstate = () => handleRouting(location.pathname);
});

async function loadGlobalData() {
    try {
        // Events
        const eventRes = await fetch(`${API_BASE}/events/rotation`);
        if(eventRes.ok) {
            const eventData = await eventRes.json();
            displayEvents(eventData);
        }

        // Tous les Brawlers (pour les grisés)
        const brawlerRes = await fetch(`${API_BASE}/brawlers`);
        if(brawlerRes.ok) {
            const brawlerData = await brawlerRes.json();
            ALL_BRAWLERS = brawlerData.items;
        }
    } catch (e) {
        console.error("Erreur Global Data:", e);
        document.getElementById('eventsGrid').innerHTML = "<small>Impossible de charger les événements.</small>";
    }
}

// --- ROUTING & NAVIGATION ---
function handleRouting(path) {
    if (path === "/" || path === "") {
        // Accueil : On montre les events
        document.getElementById('events-section').classList.remove('hidden');
        document.getElementById('content').classList.add('hidden');
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
        if (tag) searchClub(tag, false);
    }
}

window.goTo = function(url) {
    history.pushState(null, '', url);
    handleRouting(url);
    return false;
}

// --- FONCTIONS SEARCH ---

async function searchPlayer(tagOverride = null, updateUrl = true) {
    let tag = tagOverride || document.getElementById('tagInput').value.trim().toUpperCase().replace('#', '');
    if (!tag) return;

    if (updateUrl) history.pushState(null, '', `/stats/player/${tag}`);

    // UI Reset
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('events-section').classList.add('hidden'); // Cacher events
    document.getElementById('content').classList.add('hidden');
    document.getElementById('player-view').classList.remove('hidden');
    document.getElementById('club-view').classList.add('hidden');
    document.getElementById('error-msg').classList.add('hidden');

    try {
        // Profil
        const profileRes = await fetch(`${API_BASE}/players/%23${tag}`);
        if (!profileRes.ok) throw new Error("Joueur introuvable");
        const profileData = await profileRes.json();
        
        displayProfile(profileData);

        // BattleLog (non bloquant si erreur)
        try {
            const battleRes = await fetch(`${API_BASE}/players/%23${tag}/battlelog`);
            if (battleRes.ok) {
                const battleData = await battleRes.json();
                displayBattleLog(battleData.items);
            }
        } catch(e) { console.log("Pas de battlelog"); }

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('content').classList.remove('hidden');

    } catch (error) {
        showError(error);
    }
}

async function searchClub(tag, updateUrl = true) {
    tag = tag.replace('#', '');
    if (updateUrl) history.pushState(null, '', `/stats/club/${tag}`);
    
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('events-section').classList.add('hidden');
    document.getElementById('content').classList.add('hidden');
    document.getElementById('player-view').classList.add('hidden');
    document.getElementById('club-view').classList.remove('hidden');
    document.getElementById('error-msg').classList.add('hidden');
    
    try {
        const res = await fetch(`${API_BASE}/clubs/%23${tag}`);
        if (!res.ok) throw new Error("Club introuvable");
        const data = await res.json();

        displayClub(data);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('content').classList.remove('hidden');
    } catch (error) {
        showError(error);
    }
}

// --- AFFICHAGE (DISPLAY) ---

function displayEvents(events) {
    const grid = document.getElementById('eventsGrid');
    if(!grid) return;
    grid.innerHTML = "";
    
    if(!events || events.length === 0) {
        grid.innerHTML = "<small>Aucun événement.</small>";
        return;
    }

    events.slice(0, 6).forEach(e => {
        const div = document.createElement('div');
        div.className = 'event-card';
        
        // Correction nom image
        let modeName = e.event.mode.replace(/\s+/g, '-'); 
        if (modeName === "Solo-Showdown") modeName = "Showdown";
        if (modeName === "Duo-Showdown") modeName = "Showdown";

        const modeImg = `${CDN_MODE}${modeName}.png`;
        const fallbackImg = "https://cdn.brawlify.com/gamemodes/Gem-Grab.png";

        div.innerHTML = `
            <img src="${modeImg}" class="event-img" loading="lazy" onerror="this.onerror=null; this.src='${fallbackImg}'">
            <div class="event-info">
                <div class="event-mode">${e.event.mode}</div>
                <div class="event-map">${e.event.map}</div>
            </div>
        `;
        grid.appendChild(div);
    });
}

function displayProfile(data) {
    document.getElementById('pName').innerText = data.name;
    document.getElementById('pName').style.color = "#" + data.nameColor.substring(4);
    document.getElementById('pTag').innerText = data.tag;

    // Club Link
    const clubDiv = document.getElementById('pClub');
    if (data.club && data.club.name) {
        const clubTag = data.club.tag.replace('#', '');
        clubDiv.innerHTML = `<a href="#" onclick="return goTo('/stats/club/${clubTag}')" style="text-decoration:none; color:inherit;">🏠 ${data.club.name}</a>`;
    } else {
        clubDiv.innerText = "Pas de Club";
    }
    
    document.getElementById('statTrophies').innerText = data.trophies.toLocaleString();
    document.getElementById('statHighest').innerText = data.highestTrophies.toLocaleString();
    document.getElementById('stat3v3').innerText = data['3vs3Victories'].toLocaleString();
    
    // Brawlers
    const grid = document.getElementById('brawlersGrid');
    grid.innerHTML = "";
    
    let baseList = ALL_BRAWLERS.length > 0 ? ALL_BRAWLERS : data.brawlers;

    let mergedList = baseList.map(globalBrawler => {
        const playerBrawler = data.brawlers.find(pb => pb.id === globalBrawler.id);
        if (playerBrawler) return { ...playerBrawler, unlocked: true };
        return { ...globalBrawler, trophies: 0, rank: 0, power: 0, unlocked: false };
    });

    mergedList.sort((a, b) => {
        if (a.unlocked && !b.unlocked) return -1;
        if (!a.unlocked && b.unlocked) return 1;
        if (a.unlocked) return b.trophies - a.trophies;
        return a.id - b.id;
    });

    mergedList.forEach(b => {
        const div = document.createElement('div');
        div.className = 'brawler-card ' + (b.unlocked ? '' : 'brawler-locked');
        
        let footerHtml = "";
        if (b.unlocked) {
            let gadgets = b.gadgets ? b.gadgets.length : 0;
            let sp = b.starPowers ? b.starPowers.length : 0;
            footerHtml = `
                <div style="color:#f1c40f">🏆 ${b.trophies}</div>
                <div class="brawler-details">
                    <span class="power-badge">LVL ${b.power}</span>
                    ${gadgets > 0 ? `<span class="gear-icon" style="background:#2ecc71;" title="Gadget"></span>` : ''}
                    ${sp > 0 ? `<span class="gear-icon" style="background:#f1c40f;" title="Star Power"></span>` : ''}
                </div>`;
        } else {
            footerHtml = `<div style="color:#7f8c8d; margin-top:5px; font-size:0.8em;">🔒 Bloqué</div>`;
        }

        div.innerHTML = `
            <img src="${CDN_BRAWLER}${b.id}.png" class="brawler-img" loading="lazy">
            <div style="font-weight:bold; font-size:0.9em">${b.name}</div>
            ${footerHtml}
        `;
        grid.appendChild(div);
    });
}

function displayClub(data) {
    document.getElementById('cName').innerText = data.name;
    document.getElementById('cDesc').innerText = data.description || "Pas de description";
    document.getElementById('cTrophies').innerText = data.trophies.toLocaleString();
    document.getElementById('cMembers').innerText = data.members.length + "/30";

    const list = document.getElementById('membersList');
    list.innerHTML = "";
    data.members.sort((a, b) => b.trophies - a.trophies);

    data.members.forEach(m => {
        const div = document.createElement('div');
        div.className = 'member-item';
        const pTag = m.tag.replace('#', '');
        div.onclick = () => goTo(`/stats/player/${pTag}`);
        
        let roleClass = "";
        if(m.role === "president") roleClass = "role-president";
        if(m.role === "senior") roleClass = "role-senior";

        div.innerHTML = `
            <div style="display:flex; align-items:center;">
                <span style="font-weight:bold; color: #${m.nameColor.substring(4)}">${m.name}</span>
                <span class="member-role ${roleClass}">${m.role}</span>
            </div>
            <div style="color:#f1c40f; font-weight:bold;">🏆 ${m.trophies}</div>
        `;
        list.appendChild(div);
    });
}

function displayBattleLog(battles) {
    const list = document.getElementById('battleList');
    list.innerHTML = "";
    
    let winCount = 0;
    battles.forEach(battle => {
        if (battle.battle.result === "victory" || (battle.battle.trophyChange && battle.battle.trophyChange > 0)) winCount++;
    });
    const winRate = battles.length > 0 ? Math.round((winCount / battles.length) * 100) : 0;
    
    const rateBadge = document.getElementById('winRate');
    if(rateBadge) {
        rateBadge.innerText = `Win Rate : ${winRate}%`;
        rateBadge.classList.remove('rate-high', 'rate-mid', 'rate-low');
        if (winRate >= 60) rateBadge.classList.add('rate-high');
        else if (winRate >= 45) rateBadge.classList.add('rate-mid');
        else rateBadge.classList.add('rate-low');
    }

    battles.slice(0, 10).forEach(battle => {
        const div = document.createElement('div');
        let result = "Égalité"; let className = "draw";
        let change = battle.battle.trophyChange || 0;

        if (change > 0) { result = "VICTOIRE"; className = "victory"; }
        else if (change < 0) { result = "DÉFAITE"; className = "defeat"; }
        else if (battle.battle.result === "victory") { result = "VICTOIRE"; className = "victory"; }

        const dateStr = battle.battleTime;
        const timeDisplay = dateStr.substring(9, 11) + "h" + dateStr.substring(11, 13);

        div.className = `battle-item ${className}`;
        div.innerHTML = `
            <div class="battle-info">
                <span class="battle-result">${result} <small>(${change > 0 ? '+' : ''}${change} 🏆)</small></span>
                <span class="battle-mode">${battle.battle.mode} - ${battle.map ? battle.map.name : 'Map inconnue'}</span>
            </div>
            <div style="font-size: 0.9em; color: #aaa;">${timeDisplay}</div>
        `;
        list.appendChild(div);
    });
}

function showError(error) {
    console.error(error);
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error-msg').innerText = "Erreur : " + error.message;
    document.getElementById('error-msg').classList.remove('hidden');
}

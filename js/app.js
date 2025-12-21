const API_BASE = "https://api.brawl-track.com/api";
const CDN_BRAWLER = "https://cdn.brawlify.com/brawlers/borderless/";
// On utilise le CDN GameMode pour les images d'event, c'est plus fiable que les maps
const CDN_MODE = "https://cdn.brawlify.com/gamemodes/"; 

let ALL_BRAWLERS = [];

// --- INITIALISATION ---
document.addEventListener("DOMContentLoaded", async () => {
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
        const eventData = await eventRes.json();
        if(eventRes.ok) displayEvents(eventData);

        const brawlerRes = await fetch(`${API_BASE}/brawlers`);
        const brawlerData = await brawlerRes.json();
        if(brawlerRes.ok) ALL_BRAWLERS = brawlerData.items;
    } catch (e) {
        console.error("Erreur Global Data:", e);
        document.getElementById('eventsGrid').innerHTML = "<small>Impossible de charger les événements.</small>";
    }
}

// --- ROUTING ---
function handleRouting(path) {
    // Reset de base
    document.getElementById('home-section').classList.add('hidden');
    document.getElementById('content').classList.add('hidden');
    document.getElementById('player-view').classList.add('hidden');
    document.getElementById('club-view').classList.add('hidden');
    document.getElementById('leaderboard-view').classList.add('hidden');

    if (path === "/" || path === "") {
        document.getElementById('home-section').classList.remove('hidden');
    } 
    else if (path.includes('/stats/player/')) {
        const tag = path.split('/stats/player/')[1];
        if (tag) {
            document.getElementById('content').classList.remove('hidden');
            document.getElementById('tagInput').value = tag;
            searchPlayer(tag, false);
        }
    } 
    else if (path.includes('/stats/club/')) {
        const tag = path.split('/stats/club/')[1];
        if (tag) {
            document.getElementById('content').classList.remove('hidden');
            searchClub(tag, false);
        }
    }
    else if (path.includes('/leaderboard/')) {
        const country = path.split('/leaderboard/')[1]; // 'global' ou 'fr'
        if (country) {
            document.getElementById('content').classList.remove('hidden');
            searchLeaderboard(country, false);
        }
    }
}

window.goTo = function(url) {
    history.pushState(null, '', url);
    handleRouting(url);
    return false;
}

// --- RECHERCHES ---

async function searchPlayer(tagOverride = null, updateUrl = true) {
    let tag = tagOverride || document.getElementById('tagInput').value.trim().toUpperCase().replace('#', '');
    if (!tag) return;

    if (updateUrl) history.pushState(null, '', `/stats/player/${tag}`);

    // UI Handling
    document.getElementById('home-section').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');
    
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('player-view').classList.add('hidden');
    document.getElementById('club-view').classList.add('hidden');
    document.getElementById('leaderboard-view').classList.add('hidden');
    document.getElementById('error-msg').classList.add('hidden');

    try {
        const profileRes = await fetch(`${API_BASE}/players/%23${tag}`);
        const profileData = await profileRes.json();
        if (!profileRes.ok) throw new Error(profileData.error || "Joueur introuvable");
        
        displayProfile(profileData);

        const battleRes = await fetch(`${API_BASE}/players/%23${tag}/battlelog`);
        const battleData = await battleRes.json();
        if (battleRes.ok) displayBattleLog(battleData.items);

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('player-view').classList.remove('hidden');

    } catch (error) {
        showError(error);
    }
}

async function searchClub(tag, updateUrl = true) {
    tag = tag.replace('#', '');
    if (updateUrl) history.pushState(null, '', `/stats/club/${tag}`);
    
    document.getElementById('home-section').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('player-view').classList.add('hidden');
    document.getElementById('club-view').classList.add('hidden');
    document.getElementById('leaderboard-view').classList.add('hidden');

    try {
        const res = await fetch(`${API_BASE}/clubs/%23${tag}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Club introuvable");

        displayClub(data);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('club-view').classList.remove('hidden');
    } catch (error) {
        showError(error);
    }
}

async function searchLeaderboard(country, updateUrl = true) {
    if (updateUrl) history.pushState(null, '', `/leaderboard/${country}`);

    document.getElementById('home-section').classList.add('hidden');
    document.getElementById('content').classList.remove('hidden');
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('player-view').classList.add('hidden');
    document.getElementById('club-view').classList.add('hidden');
    document.getElementById('leaderboard-view').classList.add('hidden');

    try {
        // L'API Brawl Stars utilise 'global' ou le code pays (ex: 'fr')
        const res = await fetch(`${API_BASE}/rankings/${country}/players`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Classement introuvable");

        displayLeaderboard(data.items, country);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('leaderboard-view').classList.remove('hidden');
    } catch (error) {
        showError(error);
    }
}

// --- AFFICHAGE ---

function displayEvents(events) {
    const grid = document.getElementById('eventsGrid');
    if (!grid) return; // Sécurité si la page n'est pas prête
    
    grid.innerHTML = "";
    
    // Si pas d'events, on affiche un message
    if (!events || events.length === 0) {
        grid.innerHTML = "<small>Aucun événement disponible.</small>";
        return;
    }

    events.slice(0, 6).forEach(e => {
        const div = document.createElement('div');
        div.className = 'event-card';
        
        // CORRECTION DU NOM DE L'IMAGE
        // On remplace les espaces par des tirets (ex: "Gem Grab" -> "Gem-Grab")
        let modeName = e.event.mode.replace(/\s+/g, '-');
        
        // Cas particuliers (Showdown se nomme parfois Solo-Showdown sur le CDN)
        if (modeName === "Solo-Showdown") modeName = "Showdown";
        if (modeName === "Duo-Showdown") modeName = "Showdown";

        const modeImg = `${CDN_MODE}${modeName}.png`;

        // CORRECTION DU ONERROR : On met une image qui existe vraiment (Gem Grab par défaut)
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
    
    // Brawlers logic
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
        let footerHtml = b.unlocked ? 
            `<div style="color:#f1c40f">🏆 ${b.trophies}</div><div class="brawler-details"><span class="power-badge">LVL ${b.power}</span></div>` : 
            `<div style="color:#7f8c8d; margin-top:5px; font-size:0.8em;">🔒 Bloqué</div>`;

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
        if(m.role === "vicePresident") roleClass = "role-vice"; // Couleur Orange ajoutée !
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

function displayLeaderboard(items, country) {
    const title = country === 'global' ? "🌍 Top Mondial" : "🇫🇷 Top France";
    document.getElementById('lbTitle').innerText = title;
    
    const list = document.getElementById('lbList');
    list.innerHTML = "";

    items.forEach(p => {
        const div = document.createElement('div');
        div.className = 'rank-item';
        const pTag = p.tag.replace('#', '');
        div.onclick = () => goTo(`/stats/player/${pTag}`);

        let rankClass = "";
        if(p.rank === 1) rankClass = "rank-1";
        else if(p.rank === 2) rankClass = "rank-2";
        else if(p.rank === 3) rankClass = "rank-3";
        else rankClass = "rank-num";

        let rankDisplay = p.rank;
        if(p.rank === 1) rankDisplay = "🥇";
        if(p.rank === 2) rankDisplay = "🥈";
        if(p.rank === 3) rankDisplay = "🥉";

        div.innerHTML = `
            <div class="${rankClass}" style="width:50px; text-align:center;">${rankDisplay}</div>
            <div style="flex-grow:1; display:flex; flex-direction:column;">
                <span style="font-weight:bold; font-size:1.1em; color: #${p.nameColor.substring(4)}">${p.name}</span>
                <span style="font-size:0.8em; color:#bdc3c7;">${p.club ? p.club.name : 'Sans Club'}</span>
            </div>
            <div style="color:#f1c40f; font-weight:bold;">🏆 ${p.trophies.toLocaleString()}</div>
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

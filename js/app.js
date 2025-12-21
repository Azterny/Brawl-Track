const API_BASE = "https://api.brawl-track.com/api";
const CDN_BRAWLER = "https://cdn.brawlify.com/brawlers/borderless/";

// --- 1. GESTION DU ROUTING ---

document.addEventListener("DOMContentLoaded", () => {
    // Cas A : Redirection 404
    if (sessionStorage.redirect) {
        const path = sessionStorage.redirect;
        delete sessionStorage.redirect;
        history.replaceState(null, null, path);
        handleRouting(path);
    } 
    // Cas B : Accès direct ou rechargement
    else {
        handleRouting(location.pathname);
    }

    // Cas C : Bouton Précédent/Suivant
    window.onpopstate = function() {
        handleRouting(location.pathname);
    };
});

function handleRouting(path) {
    if (path.includes('/stats/player/')) {
        const tag = path.split('/stats/player/')[1];
        if (tag) {
            document.getElementById('tagInput').value = tag;
            searchPlayer(tag, false);
        }
    } else if (path.includes('/stats/club/')) {
        const tag = path.split('/stats/club/')[1];
        if (tag) searchClub(tag, false);
    }
}

// Fonction pour cliquer sur un lien interne (SPA)
window.goTo = function(url) {
    history.pushState(null, '', url);
    handleRouting(url);
    return false; // Empêche le rechargement
}

// --- 2. FONCTIONS DE RECHERCHE ---

// RECHERCHE JOUEUR
async function searchPlayer(tagOverride = null, updateUrl = true) {
    let tag = tagOverride || document.getElementById('tagInput').value.trim().toUpperCase().replace('#', '');
    if (!tag) return;

    if (updateUrl) history.pushState(null, '', `/stats/player/${tag}`);

    // UI : On affiche la vue Joueur
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('content').classList.add('hidden');
    document.getElementById('player-view').classList.remove('hidden');
    document.getElementById('club-view').classList.add('hidden');
    document.getElementById('error-msg').classList.add('hidden');

    try {
        // Profil
        const profileRes = await fetch(`${API_BASE}/players/%23${tag}`);
        const profileData = await profileRes.json();
        if (!profileRes.ok) throw new Error(profileData.error || "Joueur introuvable");
        displayProfile(profileData);

        // BattleLog
        const battleRes = await fetch(`${API_BASE}/players/%23${tag}/battlelog`);
        const battleData = await battleRes.json();
        if (battleRes.ok) displayBattleLog(battleData.items);

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('content').classList.remove('hidden');
    } catch (error) {
        showError(error);
    }
}

// RECHERCHE CLUB
async function searchClub(tag, updateUrl = true) {
    tag = tag.replace('#', '');
    if (updateUrl) history.pushState(null, '', `/stats/club/${tag}`);

    // UI : On affiche la vue Club
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('content').classList.add('hidden');
    document.getElementById('player-view').classList.add('hidden'); // On cache le joueur
    document.getElementById('club-view').classList.remove('hidden'); // On montre le club
    document.getElementById('error-msg').classList.add('hidden');

    try {
        // L'URL magique qui marche grâce au proxy Python
        const res = await fetch(`${API_BASE}/clubs/%23${tag}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || "Club introuvable");

        displayClub(data);

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('content').classList.remove('hidden');
    } catch (error) {
        showError(error);
    }
}

// --- 3. AFFICHAGE ---

function displayProfile(data) {
    document.getElementById('pName').innerText = data.name;
    document.getElementById('pName').style.color = "#" + data.nameColor.substring(4);
    document.getElementById('pTag').innerText = data.tag;

    // LIEN CLUB CLIQUABLE
    const clubDiv = document.getElementById('pClub');
    if (data.club && data.club.name) {
        const clubTag = data.club.tag.replace('#', '');
        // On utilise notre fonction goTo() pour ne pas recharger la page
        clubDiv.innerHTML = `<a href="#" onclick="return goTo('/stats/club/${clubTag}')" style="text-decoration:none; color:inherit;">🏠 ${data.club.name}</a>`;
        clubDiv.style.cursor = "pointer";
    } else {
        clubDiv.innerText = "Pas de Club";
    }
    
    document.getElementById('statTrophies').innerText = data.trophies.toLocaleString();
    document.getElementById('statHighest').innerText = data.highestTrophies.toLocaleString();
    document.getElementById('stat3v3').innerText = data['3vs3Victories'].toLocaleString();
    
    // Brawlers...
    const grid = document.getElementById('brawlersGrid');
    grid.innerHTML = "";
    data.brawlers.sort((a, b) => b.trophies - a.trophies);
    data.brawlers.forEach(b => {
        const div = document.createElement('div');
        div.className = 'brawler-card';
        div.innerHTML = `
            <img src="${CDN_BRAWLER}${b.id}.png" class="brawler-img" loading="lazy">
            <div style="font-weight:bold; font-size:0.9em">${b.name}</div>
            <div style="color:#f1c40f">🏆 ${b.trophies}</div>
            <div class="rank-badge">Rang ${b.rank}</div>
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

    // On trie les membres par trophées
    data.members.sort((a, b) => b.trophies - a.trophies);

    data.members.forEach(m => {
        const div = document.createElement('div');
        div.className = 'member-item';
        // On rend chaque membre cliquable pour retourner vers son profil
        const pTag = m.tag.replace('#', '');
        div.onclick = () => goTo(`/stats/player/${pTag}`);
        
        // Couleur du rôle
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
    // ... (Gardez votre fonction displayBattleLog existante ici) ...
    // Je la remets abrégée pour l'exemple, mais gardez la vôtre avec le calcul du Win Rate !
    const list = document.getElementById('battleList');
    list.innerHTML = "";
    
    // Calcul Win Rate (à réintégrer)
    let winCount = 0;
    battles.forEach(battle => {
        if (battle.battle.result === "victory" || (battle.battle.trophyChange && battle.battle.trophyChange > 0)) winCount++;
    });
    const winRate = battles.length > 0 ? Math.round((winCount / battles.length) * 100) : 0;
    document.getElementById('winRate').innerText = `Win Rate : ${winRate}%`;
    // ... classes de couleurs ...

    battles.slice(0, 10).forEach(battle => {
        // ... création des divs combats ...
        // Astuce : copiez-collez votre ancienne fonction displayBattleLog ici
        const div = document.createElement('div');
        let result = "Égalité"; let className = "draw";
        let change = battle.battle.trophyChange || 0;
        if (change > 0) { result = "VICTOIRE"; className = "victory"; }
        else if (change < 0) { result = "DÉFAITE"; className = "defeat"; }
        else if (battle.battle.result === "victory") { result = "VICTOIRE"; className = "victory"; }

        div.className = `battle-item ${className}`;
        div.innerHTML = `<div class="battle-info"><span class="battle-result">${result} <small>(${change>0?'+':''}${change})</small></span><span class="battle-mode">${battle.battle.mode}</span></div>`;
        list.appendChild(div);
    });
}

function showError(error) {
    console.error(error);
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('error-msg').innerText = "Erreur : " + error.message;
    document.getElementById('error-msg').classList.remove('hidden');
}

const API_BASE = (typeof API_URL !== 'undefined') ? API_URL : '';
let currentClubTag = null;
let currentClubData = null; // Sauvegarde des données pour le tri rapide

async function initClub() {
    const urlParams = new URLSearchParams(window.location.search);
    let tag = urlParams.get('tag');

    const pathParts = window.location.pathname.split('/').filter(p => p);
    if (pathParts[0] === 'club' && pathParts[1]) {
        tag = pathParts[1];
    }

    if (!tag) {
        window.location.href = "/";
        return;
    }

    currentClubTag = tag.toUpperCase().replace('#', '');
    document.title = `Brawl Track - Club #${currentClubTag}`;

    if (window.location.pathname.includes('club.html')) {
        window.history.replaceState({}, '', `/club/${currentClubTag}`);
    }

    await loadClubData(currentClubTag);
}

async function loadClubData(tag) {
    try {
        const res = await fetch(`${API_BASE}/api/public/club/${tag}`);
        if (!res.ok) throw new Error("Club introuvable");
        const data = await res.json();
        renderClub(data);
    } catch (e) {
        console.error(e);
        window.location.href = `/404.html?target=${currentClubTag}`;
    }
}

function renderClub(club) {
    currentClubData = club; // On sauvegarde les données

    // 1. En-tête
    document.getElementById('club-name').innerText = club.name;
    document.getElementById('club-tag').innerText = club.tag;

    const badgeId = club.badgeId || 8000000;
    const iconUrl = `https://brawlify.com/images/club-badges/96/${badgeId}.webp`;
    document.getElementById('club-icon').src = iconUrl;

    // 2. Description
    const descElem = document.getElementById('club-description');
    if (club.description) {
        descElem.innerText = `"${club.description}"`;
    } else {
        descElem.innerText = "Aucune description.";
    }

    // 3. Statistiques Complètes
    const membersCount = club.members ? club.members.length : 0;
    document.getElementById('members-count').innerText = membersCount;

    // Calcul de la moyenne
    const avgTrophies = membersCount > 0 ? Math.round(club.trophies / membersCount) : 0;
    
    // Traduction de l'accès
    const typeTranslations = {
        'open': '🟢 Ouvert',
        'inviteOnly': '🟠 Invitation',
        'closed': '🔴 Fermé'
    };
    const clubType = typeTranslations[club.type] || club.type;

    document.getElementById('stats-area').innerHTML = `
        <div class="stat-card"><div>Total Trophées</div><div class="stat-value" style="color:#ffce00; display:flex; align-items:center; justify-content:center; gap:5px;"><img src="/assets/trophy_normal.png" style="height:0.9em;"> ${club.trophies.toLocaleString('fr-FR')}</div></div>
        <div class="stat-card"><div>Moyenne / Joueur</div><div class="stat-value" style="color:#28a745; display:flex; align-items:center; justify-content:center; gap:5px;"><img src="/assets/trophy_normal.png" style="height:0.9em;"> ${avgTrophies.toLocaleString('fr-FR')}</div></div>
        <div class="stat-card"><div>Trophées Requis</div><div class="stat-value" style="color:#ff5555; display:flex; align-items:center; justify-content:center; gap:5px;"><img src="/assets/trophy_normal.png" style="height:0.9em;"> ${(club.requiredTrophies || 0).toLocaleString('fr-FR')}</div></div>
        <div class="stat-card"><div>Accès</div><div class="stat-value" style="color:#fff; font-size: 1.1rem;">${clubType}</div></div>
    `;

    // 4. Lancement du rendu des membres
    sortClubMembers();
}

function sortClubMembers() {
    if (!currentClubData || !currentClubData.members) return;
    
    const criteria = document.getElementById('sort-members').value;
    let members = [...currentClubData.members];

    const roleValues = { 'president': 4, 'vicePresident': 3, 'senior': 2, 'member': 1 };

    members.sort((a, b) => {
        if (criteria === 'trophies') {
            return b.trophies - a.trophies;
        } else if (criteria === 'role') {
            const rA = roleValues[a.role] || 0;
            const rB = roleValues[b.role] || 0;
            if (rA !== rB) return rB - rA;
            return b.trophies - a.trophies; // Si même grade -> tri par trophées
        } else if (criteria === 'name') {
            return a.name.localeCompare(b.name);
        }
        return 0;
    });

    renderMembers(members);
}

function renderMembers(members) {
    const container = document.getElementById('members-list');
    container.innerHTML = '';

    members.forEach((m, index) => {
        const roleLabels = { 'member': '', 'senior': 'Senior', 'vicePresident': 'Vice-Président', 'president': 'Président' };
        const roleClasses = { 'member': '', 'senior': 'role-senior', 'vicePresident': 'role-vice', 'president': 'role-president' };

        const roleName = roleLabels[m.role] || '';
        const roleClass = roleClasses[m.role] || '';

        let nameColor = m.nameColor || '#ffffff';
        if (nameColor.startsWith('0x')) nameColor = '#' + (nameColor.length >= 10 ? nameColor.slice(4) : nameColor.slice(2));

        const row = document.createElement('div');
        row.className = 'member-row';
        row.onclick = () => window.location.href = `/player/${m.tag.replace('#', '')}`;

        // Aligné à gauche et avec sécurité d'image (onerror)
        row.innerHTML = `
            <div class="member-rank">${index + 1}</div>
            <img src="https://cdn.brawlify.com/profile-icons/regular/${m.icon.id}.png" class="member-icon" onerror="this.src='/assets/default_icon.png'">
            <div class="member-info" style="text-align: left;">
                <div class="member-name" style="color: ${nameColor};">${m.name}</div>
                <div class="member-tag">${m.tag}</div>
            </div>
            <div class="member-role-container">
                ${roleName ? `<span class="member-role ${roleClass}">${roleName}</span>` : ''}
            </div>
            <div class="member-trophies">
                ${m.trophies.toLocaleString('fr-FR')} <img src="/assets/trophy_normal.png">
            </div>
        `;
        container.appendChild(row);
    });
}

document.addEventListener('DOMContentLoaded', initClub);

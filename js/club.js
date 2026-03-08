const API_BASE = (typeof API_URL !== 'undefined') ? API_URL : '';
let currentClubTag = null;
let currentClubData = null;

// BUG-C FIX : Utilitaire d'échappement HTML pour les données externes (noms API)
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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
    currentClubData = club;

    document.getElementById('club-name').innerText = club.name;
    document.getElementById('club-tag').innerText = club.tag;

    const badgeId = club.badgeId || 8000000;
    const iconUrl = `https://brawlify.com/images/club-badges/96/${badgeId}.webp`;
    document.getElementById('club-icon').src = iconUrl;

    const descElem = document.getElementById('club-description');
    if (club.description) {
        descElem.innerHTML = formatBrawlText(club.description);
    } else {
        descElem.innerText = "Aucune description.";
    }

    const membersCount = club.members ? club.members.length : 0;
    document.getElementById('members-count').innerText = membersCount;

    const avgTrophies = membersCount > 0 ? Math.round(club.trophies / membersCount) : 0;
    
    const typeTranslations = {
        'open': '🟢 Ouvert',
        'inviteOnly': '🟠 Invitation',
        'closed': '🔴 Fermé'
    };
    const clubType = typeTranslations[club.type] || club.type;

    document.getElementById('stats-area').innerHTML = `
        <div class="stat-card" style="display: flex; justify-content: space-between; align-items: center; text-align: left;">
            <div>
                <div style="font-size: 0.9em; color: #ccc; margin-bottom: 4px;">Trophées</div>
                <div class="stat-value" style="color:#ffce00;">${club.trophies.toLocaleString('fr-FR')}</div>
            </div>
            <img src="/assets/trophy_normal.png" style="height: 2.5em; object-fit: contain;">
        </div>
        <div class="stat-card" style="display: flex; justify-content: space-between; align-items: center; text-align: left;">
            <div>
                <div style="font-size: 0.9em; color: #ccc; margin-bottom: 4px;">Moyenne</div>
                <div class="stat-value" style="color:#28a745;">${avgTrophies.toLocaleString('fr-FR')}</div>
            </div>
            <img src="/assets/trophy_normal.png" style="height: 2.5em; object-fit: contain;">
        </div>
        <div class="stat-card" style="display: flex; justify-content: space-between; align-items: center; text-align: left;">
            <div>
                <div style="font-size: 0.9em; color: #ccc; margin-bottom: 4px;">Requis</div>
                <div class="stat-value" style="color:#ff5555;">${(club.requiredTrophies || 0).toLocaleString('fr-FR')}</div>
            </div>
            <img src="/assets/trophy_normal.png" style="height: 2.5em; object-fit: contain;">
        </div>
        <div class="stat-card" style="display: flex; justify-content: space-between; align-items: center; text-align: left;">
            <div>
                <div style="font-size: 0.9em; color: #ccc; margin-bottom: 4px;">Accès</div>
                <div class="stat-value" style="color:#fff; font-size: 1.1rem;">${clubType}</div>
            </div>
        </div>
    `;

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
            return b.trophies - a.trophies;
        } else if (criteria === 'name') {
            return a.name.localeCompare(b.name);
        }
        return 0;
    });

    renderMembers(members);
}

function formatBrawlText(text) {
    if (!text) return "";
    
    let safeText = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    const brawlColors = {
        '0': '#222222', '1': '#ffffff', '2': '#ff5555', '3': '#54ff54',
        '4': '#3388ff', '5': '#00d2ff', '6': '#ff99cc', '7': '#ffce00',
        '8': '#ff00ff', '9': '#cc0000', '10': '#ffffff'
    };

    safeText = safeText.replace(/&lt;c([0-9a-fA-F]{6}|\d+)&gt;/gi, (match, colorCode) => {
        const color = colorCode.length === 6 ? '#' + colorCode : (brawlColors[colorCode] || '#ffffff');
        return `<span style="color: ${color};">`;
    });

    safeText = safeText.replace(/&lt;\/c&gt;/gi, '</span>');
    safeText = safeText.replace(/&lt;c(?!\w)/gi, '</span>');

    return `"${safeText}"`;
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

        // BUG-C FIX : m.name échappé avant injection dans innerHTML.
        // Les noms Brawl Stars peuvent contenir <, >, & etc.
        // m.tag est toujours #[A-Z0-9], pas de risque — laissé tel quel.
        const safeName = escapeHtml(m.name);

        row.innerHTML = `
            <div class="member-rank">${index + 1}</div>
            <img src="https://cdn.brawlify.com/profile-icons/regular/${m.icon.id}.png" class="member-icon ${roleClass ? roleClass + '-border' : ''}" onerror="this.src='/assets/default_icon.png'">
            <div class="member-info" style="text-align: left;">
                <div class="member-name" style="color: ${nameColor};">${safeName}</div>
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

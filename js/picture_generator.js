/* =========================================
   PICTURE GENERATOR — Module d'exportation d'images
   Fix #10 : détection des échecs CORS avant le rendu html2canvas.
   Si des images externes n'ont pas pu être chargées avec crossOrigin=anonymous,
   l'utilisateur est averti avant que la capture soit lancée.
   ========================================= */

let currentExportType = null;

document.addEventListener("DOMContentLoaded", () => {
    const modalHTML = `
    <div id="export-modal" class="export-modal-overlay">
        <div class="export-modal-content">
            <span class="export-close-btn" onclick="closeExportModal()">&times;</span>

            <div id="modal-step-config">
                <h2 style="font-family:'Lilita One',cursive; color:#ffce00; margin:0 0 5px 0;">Exporter la carte</h2>
                <p style="color:#aaa; font-size:0.9rem; margin-bottom:20px;">Sélectionnez le format adapté :</p>

                <div class="export-format-options">
                    <label class="export-format-card selected" id="card-vertical" onclick="selectExportFormat('vertical')">
                        <input type="radio" name="export-format" value="vertical" checked>
                        <div style="text-align:left;">
                            <h3>📱 Mode Portrait</h3>
                            <p>Optimisé pour les smartphones</p>
                        </div>
                    </label>
                    <label class="export-format-card" id="card-horizontal" onclick="selectExportFormat('horizontal')">
                        <input type="radio" name="export-format" value="horizontal">
                        <div style="text-align:left;">
                            <h3>💻 Mode Paysage</h3>
                            <p>Idéal pour PC ou Twitter</p>
                        </div>
                    </label>
                </div>

                <button class="btn-3d btn-yellow w-100" onclick="startImageGeneration()" style="padding:10px;">
                    <img src="/assets/icons/picture.png" style="height:16px; vertical-align:middle; margin-right:6px;">
                    Générer maintenant
                </button>
            </div>

            <div id="modal-step-loading" style="display:none;">
                <h3 style="color:#fff; margin-bottom:15px;">Création de l'image...</h3>
                <img src="/assets/loading_icon.png" class="spin" style="width:40px; margin:0 auto 15px auto; display:block;">
                <p id="export-status" style="color:#888; font-size:0.85rem;">Lecture des données...</p>
            </div>

            <div id="modal-step-result" style="display:none;">
                <h3 style="color:#28a745; margin-bottom:15px;">✓ Carte générée</h3>
                <div id="export-preview-area" style="display:flex; flex-direction:column; align-items:center; gap:15px;"></div>
            </div>
        </div>
    </div>`;

    const wrapperHTML = `<div id="export-wrapper"><div id="export-content"></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.insertAdjacentHTML('beforeend', wrapperHTML);
});

function openExportModal(type) {
    currentExportType = type;
    document.getElementById('export-modal').style.display = 'flex';
    document.getElementById('modal-step-config').style.display = 'block';
    document.getElementById('modal-step-loading').style.display = 'none';
    document.getElementById('modal-step-result').style.display = 'none';
    document.getElementById('export-preview-area').innerHTML = '';
}

function closeExportModal() {
    document.getElementById('export-modal').style.display = 'none';
}

function selectExportFormat(format) {
    document.getElementById('card-vertical').classList.remove('selected');
    document.getElementById('card-horizontal').classList.remove('selected');
    document.getElementById(`card-${format}`).classList.add('selected');
    document.querySelector(`input[name="export-format"][value="${format}"]`).checked = true;
}

function getBrawlerRankForExport(trophies) {
    if (trophies >= 3000) return 'prestige3';
    if (trophies >= 2000) return 'prestige2';
    if (trophies >= 1000) return 'prestige1';
    if (trophies >= 750)  return 'gold';
    if (trophies >= 500)  return 'silver';
    if (trophies >= 250)  return 'bronze';
    return 'wood';
}

// Fix #10 — Vérification CORS des images externes avant le rendu
// Teste chaque <img> présent dans exportContent en tentant un rechargement
// avec crossOrigin=anonymous. Retourne la liste des URLs en échec.
async function checkImagesForCORS(container) {
    const imgs = Array.from(container.querySelectorAll('img[crossorigin]'));
    const failed = [];

    await Promise.all(imgs.map(img => new Promise(resolve => {
        const test = new Image();
        test.crossOrigin = 'anonymous';
        test.onload  = resolve;
        test.onerror = () => { failed.push(img.src.split('?')[0]); resolve(); };
        test.src = img.src.includes('?') ? img.src : `${img.src}?_cors_check=${Date.now()}`;
    })));

    return failed;
}

async function startImageGeneration() {
    const mode          = document.querySelector('input[name="export-format"]:checked')?.value || 'vertical';
    const exportContent = document.getElementById('export-content');
    const statusDiv     = document.getElementById('export-status');

    document.getElementById('modal-step-config').style.display  = 'none';
    document.getElementById('modal-step-loading').style.display = 'block';

    try {
        let finalHtml = '';
        let fileName  = 'BrawlTrack_export.png';

        if (currentExportType === 'player') {
            const targetData = window.playerData;
            if (!targetData) throw new Error("Données du joueur non disponibles.");
            statusDiv.innerText = "Assemblage du profil joueur...";
            finalHtml = await buildPlayerTemplate(targetData, mode);
            fileName  = `BrawlTrack_${targetData.name}_${mode}.png`;
        }

        exportContent.innerHTML = finalHtml;
        statusDiv.innerText = "Vérification des ressources...";

        // Fix #10 — Vérification CORS avant capture
        const failedUrls = await checkImagesForCORS(exportContent);
        if (failedUrls.length > 0) {
            console.warn('[PictureGen] CORS failures sur', failedUrls.length, 'image(s):', failedUrls);
            statusDiv.innerHTML = `<span style="color:#fb8c00;">⚠ Certaines images ne se chargeront pas correctement (CORS). La carte peut être partiellement vide.</span>`;
            // On laisse 2s à l'utilisateur pour voir l'avertissement avant de continuer
            await new Promise(r => setTimeout(r, 2000));
        }

        statusDiv.innerText = "Assemblage final en HD...";

        await new Promise(resolve => setTimeout(resolve, 500));

        const canvas = await html2canvas(exportContent, {
            backgroundColor: '#1a1a1a',
            useCORS: true,
            scale: 2
        });

        // Fix #10 — Détection canvas vide (cas extrême où html2canvas retourne un canvas noir)
        const ctx     = canvas.getContext('2d');
        const sample  = ctx.getImageData(10, 10, 1, 1).data;
        const isEmpty = sample[0] === 26 && sample[1] === 26 && sample[2] === 26; // #1a1a1a pur = rien rendu

        const imgDataUrl  = canvas.toDataURL('image/png');
        const previewArea = document.getElementById('export-preview-area');

        const img      = document.createElement('img');
        img.src        = imgDataUrl;
        img.className  = 'export-preview-image';

        const btn = document.createElement('button');
        btn.className = 'btn-3d btn-green w-100';
        btn.style.padding = '10px';
        btn.textContent = 'Télécharger';
        btn.addEventListener('click', () => downloadImage(imgDataUrl, fileName));

        previewArea.innerHTML = '';
        if (isEmpty) {
            const warn = document.createElement('p');
            warn.style.color   = '#fb8c00';
            warn.style.fontSize = '0.85rem';
            warn.innerHTML = '⚠ Le rendu semble vide (erreur CORS externe). Vérifiez votre connexion ou réessayez plus tard.';
            previewArea.appendChild(warn);
        }
        previewArea.appendChild(img);
        previewArea.appendChild(btn);

        document.getElementById('modal-step-loading').style.display = 'none';
        document.getElementById('modal-step-result').style.display  = 'block';

        const apiBaseUrl = (typeof API_URL !== 'undefined') ? API_URL : '';
        fetch(`${apiBaseUrl}/api/analytics/track-image`, { method: 'POST' })
            .catch(() => {});

    } catch (e) {
        statusDiv.innerHTML = `<span style='color:#ff5555;'>Erreur : ${e.message}</span>`;
    }
}

function downloadImage(dataUrl, fileName) {
    const link    = document.createElement('a');
    link.download = fileName;
    link.href     = dataUrl;
    link.click();
}

/* =========================================
   GÉNÉRATEUR DE TEMPLATES
   ========================================= */
async function buildPlayerTemplate(data, mode) {
    let nameColor = data.nameColor
        ? (data.nameColor.startsWith('0x') ? '#' + data.nameColor.slice(4) : data.nameColor)
        : '#fff';
    let iconUrl = (data.icon && data.icon.id)
        ? `https://cdn.brawlify.com/profile-icons/regular/${data.icon.id}.png?t=${Date.now()}`
        : '/assets/default_icon.png';

    // Préchargement icône profil
    await new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = img.onerror = resolve;
        img.src = iconUrl;
    });

    const trophies     = (data.trophies || 0).toLocaleString('fr-FR');
    const prestige     = data.totalPrestigeLevel ?? 0;
    const victories3v3 = (data['3vs3Victories'] || data.victories3v3 || 0).toLocaleString('fr-FR');

    // Club
    let clubHTML = '';
    let badgeId  = 8000000;
    if (data.club && data.club.tag) {
        try {
            const apiBase   = (typeof API_URL !== 'undefined') ? API_URL : '';
            const clubRes   = await fetch(`${apiBase}/api/public/club/${data.club.tag.replace('#', '')}`);
            if (clubRes.ok) {
                const clubData = await clubRes.json();
                if (clubData.badgeId) badgeId = clubData.badgeId;
            }
        } catch (e) { /* club non disponible */ }

        const badgeUrl = `https://brawlify.com/images/club-badges/96/${badgeId}.webp?t=${Date.now()}`;
        await new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = img.onerror = resolve;
            img.src = badgeUrl;
        });

        clubHTML = `
        <div style="display:flex; align-items:center; gap:10px; border-left:2px solid rgba(255,255,255,0.1); border-right:2px solid rgba(255,255,255,0.1); padding:0 15px; flex-grow:1; justify-content:center; overflow:hidden;">
            <img src="${badgeUrl}" crossorigin="anonymous" style="height:40px; width:auto; object-fit:contain; filter:drop-shadow(0 2px 2px rgba(0,0,0,0.5)); flex-shrink:0;">
            <div style="line-height:1.1; overflow:hidden; text-align:left;">
                <div style="color:#fff; font-weight:bold; font-size:1.1rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${data.club.name}</div>
                <div style="color:#ffce00; font-family:monospace; font-size:0.8rem;">${data.club.tag}</div>
            </div>
        </div>`;
    }

    // Brawlers
    const ownedBrawlers = (data.brawlers || [])
        .filter(b => b.trophies >= 0)
        .sort((a, b) => b.trophies - a.trophies)
        .slice(0, mode === 'vertical' ? 6 : 10);

    const brawlerHTMLs = await Promise.all(ownedBrawlers.map(async b => {
        const rank    = getBrawlerRankForExport(b.trophies);
        const imgUrl  = `https://cdn.brawlify.com/brawlers/borderless/${b.id}.png?t=${Date.now()}`;
        await new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = img.onerror = resolve;
            img.src = imgUrl;
        });
        return `
        <div style="display:flex; flex-direction:column; align-items:center; background:rgba(255,255,255,0.05); border-radius:10px; padding:8px; gap:4px; min-width:70px;">
            <img src="${imgUrl}" crossorigin="anonymous" style="height:50px; width:50px; object-fit:contain;">
            <span style="color:#ffce00; font-size:0.85rem; font-weight:bold;">${b.trophies.toLocaleString('fr-FR')}</span>
        </div>`;
    }));

    if (mode === 'vertical') {
        return `
        <div style="background:linear-gradient(135deg,#1a1a2e,#16213e); color:#fff; width:400px; padding:25px; font-family:'Segoe UI',sans-serif; border-radius:15px; border:1px solid rgba(255,206,0,0.3);">
            <div style="display:flex; align-items:center; gap:15px; margin-bottom:20px;">
                <img src="${iconUrl}" crossorigin="anonymous" style="width:70px; height:70px; border-radius:50%; border:3px solid #ffce00;">
                <div>
                    <div style="font-size:1.4rem; font-weight:bold; color:${nameColor};">${data.name}</div>
                    <div style="color:#888; font-size:0.85rem; font-family:monospace;">${data.tag}</div>
                </div>
            </div>
            <div style="display:flex; gap:15px; margin-bottom:20px;">
                <div style="flex:1; background:rgba(255,206,0,0.1); border-radius:10px; padding:12px; text-align:center;">
                    <div style="color:#ffce00; font-size:1.5rem; font-weight:bold;">${trophies}</div>
                    <div style="color:#888; font-size:0.8rem;">Trophées</div>
                </div>
                <div style="flex:1; background:rgba(138,79,232,0.1); border-radius:10px; padding:12px; text-align:center;">
                    <div style="color:#8A4FE8; font-size:1.5rem; font-weight:bold;">${prestige}</div>
                    <div style="color:#888; font-size:0.8rem;">Prestige</div>
                </div>
            </div>
            ${clubHTML ? `<div style="margin-bottom:20px;">${clubHTML}</div>` : ''}
            <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center;">
                ${brawlerHTMLs.join('')}
            </div>
            <div style="text-align:center; margin-top:15px; color:#555; font-size:0.75rem;">brawl-track.com</div>
        </div>`;
    } else {
        return `
        <div style="background:linear-gradient(135deg,#1a1a2e,#16213e); color:#fff; width:700px; padding:25px; font-family:'Segoe UI',sans-serif; border-radius:15px; border:1px solid rgba(255,206,0,0.3);">
            <div style="display:flex; align-items:center; gap:20px; margin-bottom:20px;">
                <img src="${iconUrl}" crossorigin="anonymous" style="width:80px; height:80px; border-radius:50%; border:3px solid #ffce00;">
                <div style="flex:1;">
                    <div style="font-size:1.6rem; font-weight:bold; color:${nameColor};">${data.name}</div>
                    <div style="color:#888; font-size:0.85rem; font-family:monospace;">${data.tag}</div>
                </div>
                <div style="display:flex; gap:20px;">
                    <div style="text-align:center;">
                        <div style="color:#ffce00; font-size:1.4rem; font-weight:bold;">${trophies}</div>
                        <div style="color:#888; font-size:0.75rem;">Trophées</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="color:#8A4FE8; font-size:1.4rem; font-weight:bold;">${prestige}</div>
                        <div style="color:#888; font-size:0.75rem;">Prestige</div>
                    </div>
                    <div style="text-align:center;">
                        <div style="color:#28a745; font-size:1.4rem; font-weight:bold;">${victories3v3}</div>
                        <div style="color:#888; font-size:0.75rem;">Victoires</div>
                    </div>
                </div>
            </div>
            ${clubHTML ? `<div style="margin-bottom:20px;">${clubHTML}</div>` : ''}
            <div style="display:flex; flex-wrap:wrap; gap:8px; justify-content:center;">
                ${brawlerHTMLs.join('')}
            </div>
            <div style="text-align:center; margin-top:12px; color:#555; font-size:0.75rem;">brawl-track.com</div>
        </div>`;
    }
}

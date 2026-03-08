/* =========================================
   PICTURE GENERATOR — Module d'exportation d'images
   Gère la création de la modale, le rendu HTML2Canvas 
   et l'injection des templates.
   ========================================= */

let currentExportType = null;

// Initialisation au chargement de la page : on injecte la modale et la zone fantôme
document.addEventListener("DOMContentLoaded", () => {
    // 1. UI Modale Allégée et plus moderne (Zéro Lag)
    const modalHTML = `
    <div id="export-modal" class="export-modal-overlay">
        <div class="export-modal-content">
            <span class="export-close-btn" onclick="closeExportModal()">&times;</span>
            
            <div id="modal-step-config">
                <h2 style="font-family: 'Lilita One', cursive; color: #ffce00; margin: 0 0 5px 0;">Exporter la carte</h2>
                <p style="color: #aaa; font-size: 0.9rem; margin-bottom: 20px;">Sélectionnez le format adapté :</p>
                
                <div class="export-format-options">
                    <label class="export-format-card selected" id="card-vertical" onclick="selectExportFormat('vertical')">
                        <input type="radio" name="export-format" value="vertical" checked>
                        <div style="text-align: left;">
                            <h3>📱 Mode Portrait</h3>
                            <p>Optimisé pour les smartphones</p>
                        </div>
                    </label>
                    <label class="export-format-card" id="card-horizontal" onclick="selectExportFormat('horizontal')">
                        <input type="radio" name="export-format" value="horizontal">
                        <div style="text-align: left;">
                            <h3>💻 Mode Paysage</h3>
                            <p>Idéal pour PC ou Twitter</p>
                        </div>
                    </label>
                </div>
                
                <button class="btn-3d btn-yellow w-100" onclick="startImageGeneration()" style="padding: 10px;">
                    <img src="/assets/icons/picture.png" style="height: 16px; vertical-align: middle; margin-right: 6px;"> 
                    Générer maintenant
                </button>
            </div>

            <div id="modal-step-loading" style="display: none;">
                <h3 style="color: #fff; margin-bottom: 15px;">Création de l'image...</h3>
                <img src="/assets/loading_icon.png" class="spin" style="width: 40px; margin: 0 auto 15px auto; display: block;">
                <p id="export-status" style="color: #888; font-size: 0.85rem;">Lecture des données...</p>
            </div>

            <div id="modal-step-result" style="display: none;">
                <h3 style="color: #28a745; margin-bottom: 15px;">✓ Carte générée</h3>
                <div id="export-preview-area" style="display:flex; flex-direction:column; align-items:center; gap:15px;"></div>
            </div>
        </div>
    </div>`;

    // 2. Création de la Zone Fantôme (Canvas cible)
    const wrapperHTML = `<div id="export-wrapper"><div id="export-content"></div></div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    document.body.insertAdjacentHTML('beforeend', wrapperHTML);
});

// Ouvre la modale. (ex: openExportModal('player'))
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

// Fonction utilitaire pour les rangs (identique à celle du dashboard)
function getBrawlerRankForExport(trophies) {
    if (trophies >= 3000) return 'prestige3';
    if (trophies >= 2000) return 'prestige2';
    if (trophies >= 1000) return 'prestige1';
    if (trophies >= 750)  return 'gold';
    if (trophies >= 500)  return 'silver';
    if (trophies >= 250)  return 'bronze';
    return 'wood';
}

/* =========================================
   GÉNÉRATEUR DE TEMPLATES
   ========================================= */
async function buildPlayerTemplate(data, mode) {
    let nameColor = data.nameColor ? (data.nameColor.startsWith('0x') ? '#' + data.nameColor.slice(4) : data.nameColor) : '#fff';
    let iconUrl = (data.icon && data.icon.id) ? `https://cdn.brawlify.com/profile-icons/regular/${data.icon.id}.png` : '/assets/default_icon.png';
    
    let totalVictories = (data['3vs3Victories'] || 0) + (data.soloVictories || 0) + (data.duoVictories || 0);
    let totalPrestige = 0;

    // Construit les brawlers
    let brawlersHTML = "";
    const activeBrawlers = data.brawlers.filter(b => b.trophies !== -1).sort((a, b) => b.trophies - a.trophies);
    
    activeBrawlers.forEach(b => {
        const rankName = getBrawlerRankForExport(b.trophies);
        totalPrestige += Math.floor(b.trophies / 1000);

        let fontSize = "0.75rem";
        if (b.name.length > 9) fontSize = "0.65rem";
        if (b.name.length > 12) fontSize = "0.55rem";

        // FIX : Ajout de crossorigin="anonymous" sur l'image du brawler
        brawlersHTML += `
            <div class="brawler-card rank-${rankName}" style="padding: 4px 6px !important; border-radius: 6px; border-width: 1.5px !important; display: flex; align-items: center; justify-content: space-between; box-shadow: none !important; height: auto !important; min-height: 0 !important;">
                <div style="display: flex; align-items: center; gap: 5px; max-width: 78%; overflow: hidden;">
                    <img src="https://cdn.brawlify.com/brawlers/borderless/${b.id}.png" crossorigin="anonymous" style="width: 26px; height: 26px; object-fit: contain; background: #111; border: 1px solid #444; border-radius: 4px; flex-shrink: 0;">
                    <div style="display: flex; flex-direction: column; align-items: flex-start; overflow: hidden; line-height: 1.1;">
                        <div style="color: #fff; font-weight: 800; font-size: ${fontSize}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; text-transform: uppercase;">
                            ${b.name}
                        </div>
                        <div style="color: #ffce00; font-weight: 900; font-size: 0.95rem; margin-top: 1px;">
                            ${b.trophies}
                        </div>
                    </div>
                </div>
                <img src="/assets/ranks/${rankName}.webp" style="height: 22px; width: auto; max-width: 24px; object-fit: contain; flex-shrink: 0; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));">
            </div>`;
    });

    // Chargement du badge club si horizontal
    let clubHTML = `<div style="display: none;"></div>`;
    if (data.club && data.club.name && mode === 'horizontal') {
        let badgeId = "8000000"; // Défaut
        try {
            const apiBase = (typeof API_URL !== 'undefined') ? API_URL : '';
            const clubRes = await fetch(`${apiBase}/api/public/club/${data.club.tag.replace('#', '')}`);
            if (clubRes.ok) {
                const clubData = await clubRes.json();
                if (clubData.badgeId) badgeId = clubData.badgeId;
            }
        } catch(e) { console.error("Erreur fetch club :", e); }

        // FIX ANTI-CACHE : On ajoute "?t=..." pour forcer un téléchargement neuf et éviter le blocage CORS
        let badgeUrl = `https://brawlify.com/images/club-badges/96/${badgeId}.webp?t=${new Date().getTime()}`;

        // FIX CORS : On force l'anonymat sur le preloader
        await new Promise((resolve) => {
            let img = new Image();
            img.crossOrigin = "anonymous"; // Indispensable !
            img.onload = resolve;
            img.onerror = resolve;
            img.src = badgeUrl;
        });

        clubHTML = `
        <div style="display: flex; align-items: center; gap: 10px; border-left: 2px solid rgba(255,255,255,0.1); border-right: 2px solid rgba(255,255,255,0.1); padding: 0 15px; flex-grow: 1; justify-content: center; overflow: hidden;">
            <img src="${badgeUrl}" crossorigin="anonymous" style="height: 40px; width: auto; object-fit: contain; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.5)); flex-shrink: 0;">
            <div style="line-height: 1.1; overflow: hidden; text-align: left;">
                <div style="color: #fff; font-weight: bold; font-size: 1.1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.club.name}</div>
                <div style="color: #ffce00; font-family: monospace; font-size: 0.8rem;">${data.club.tag}</div>
            </div>
        </div>`;
    }

    // Assemblage final du DOM Fantôme
    return `
        <div class="export-header">
            <div style="display: flex; align-items: center; gap: 15px; max-width: 35%; flex-shrink: 0;">
                <img src="${iconUrl}" crossorigin="anonymous" style="width: 50px; height: 50px; border-radius: 8px; border: 2px solid rgba(255,255,255,0.2); flex-shrink: 0;">
                <div style="line-height: 1.1; overflow: hidden;">
                    <h2 style="margin: 0; font-size: 1.6rem; color: ${nameColor}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${data.name}</h2>
                    <div style="color: #888; font-family: monospace; font-size: 0.9rem;">${data.tag}</div>
                </div>
            </div>

            ${clubHTML}

            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 15px; flex-shrink: 0;">
                <div class="export-stat-box" style="color: #ccc;">
                    <img src="/assets/icons/wipeout.png" class="export-stat-img" style="filter: grayscale(100%) brightness(1.5);">
                    <span class="export-stat-text">${totalVictories.toLocaleString('en-US')}</span>
                </div>
                <div class="export-stat-box" style="color: #C83FA0;">
                    <img src="/assets/total prestige.png" class="export-stat-img" style="filter: drop-shadow(0 0 2px rgba(200,63,160,0.5));">
                    <span class="export-stat-text">${totalPrestige}</span>
                </div>
                <div class="export-stat-box export-stat-trophy-text">
                    <img src="/assets/trophy_normal.png" class="export-stat-trophy-img">
                    <span>${data.trophies.toLocaleString('en-US')}</span>
                </div>
            </div>
        </div>

        <div class="export-brawlers-grid">${brawlersHTML}</div>
        
        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; margin-top: auto; padding-top: 15px; color: #555; font-family: 'Audiowide', cursive; font-size: 0.85rem;">
            <img src="/assets/logo.png" style="height: 16px; opacity: 0.7; filter: grayscale(50%);">
            BRAWL-TRACK.COM
        </div>`;
}

/* =========================================
   PROCESSUS DE GÉNÉRATION HTML2CANVAS
   ========================================= */
async function startImageGeneration() {
    const mode = document.querySelector('input[name="export-format"]:checked').value;
    const statusDiv = document.getElementById('export-status');
    const exportContent = document.getElementById('export-content');
    
    document.getElementById('modal-step-config').style.display = 'none';
    document.getElementById('modal-step-loading').style.display = 'block';

    try {
        statusDiv.innerText = "Construction de l'interface...";
        exportContent.className = `mode-${mode}`;
        
        let targetData = null;
        let finalHtml = "";
        let fileName = "BrawlTrack_Export.png";

        if (currentExportType === 'player') {
            // Lecture de la variable window.playerData depuis dashboard.js
            if (typeof window.playerData !== 'undefined' && window.playerData) {
                targetData = window.playerData;
            } else {
                throw new Error("Veuillez attendre la fin du chargement du profil.");
            }
            finalHtml = await buildPlayerTemplate(targetData, mode);
            fileName = `BrawlTrack_${targetData.name}_${mode}.png`;
        } 

        exportContent.innerHTML = finalHtml;
        statusDiv.innerText = "Assemblage final en HD...";

        setTimeout(() => {
            html2canvas(exportContent, {
                backgroundColor: '#1a1a1a',
                useCORS: true,
                scale: 2
            }).then(canvas => {
             const imgDataUrl = canvas.toDataURL("image/png");
         
             const previewArea = document.getElementById('export-preview-area');
         
             const img = document.createElement('img');
             img.src = imgDataUrl;
             img.className = 'export-preview-image';
         
             const btn = document.createElement('button');
             btn.className = 'btn-3d btn-green w-100';
             btn.style.padding = '10px';
             btn.textContent = '⬇️ Télécharger';
         
             // Closure sur imgDataUrl et fileName — aucun attribut inline
             btn.addEventListener('click', () => downloadImage(imgDataUrl, fileName));
         
             previewArea.innerHTML = '';
             previewArea.appendChild(img);
             previewArea.appendChild(btn);
         
             document.getElementById('modal-step-loading').style.display = 'none';
             document.getElementById('modal-step-result').style.display = 'block';
         
         }).catch(err => {
                console.error(err);
                statusDiv.innerHTML = `<span style='color: #ff5555;'>Erreur de capture. Réessayez.</span>`;
            });
        }, 500);

    } catch (e) {
        statusDiv.innerHTML = `<span style='color: #ff5555;'>Erreur : ${e.message}</span>`;
    }
}

function downloadImage(dataUrl, fileName) {
    let link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
}

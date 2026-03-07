/* =========================================
   PICTURE GENERATOR — Module d'exportation d'images
   Gère la création de la modale, le rendu HTML2Canvas 
   et l'injection des templates.
   ========================================= */

let currentExportType = null;

document.addEventListener("DOMContentLoaded", () => {
    // 1. UI Modale Allégée et plus moderne
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

// ... (GARDE LA FONCTION getBrawlerRankForExport ET buildPlayerTemplate TELLES QUELLES ICI) ...

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
            // FIX : Lecture de la variable window.playerData depuis dashboard.js
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
                previewArea.innerHTML = `
                    <img src="${imgDataUrl}" class="export-preview-image">
                    <button class="btn-3d btn-green w-100" style="padding: 10px;" onclick="downloadImage('${imgDataUrl}', '${fileName}')">
                        ⬇️ Télécharger
                    </button>
                `;

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

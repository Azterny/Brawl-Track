const GLOBAL_MAINTENANCE = true; // À synchroniser avec le 404.html
const isBypassMode = new URLSearchParams(window.location.search).get('bypass') === 'true';

if (GLOBAL_MAINTENANCE && !window.location.pathname.includes('maintenance.html') && !isBypassMode) {
    window.location.replace('/maintenance.html');
}

// Configuration Globale
const API_URL = "https://api.brawl-track.com"; 

// Variables d'état partagées
let currentUserTier = 'basic'; 
let globalBrawlersList = [];
let fullHistoryData = [];
let currentLiveTrophies = null;
window.myChart = null;

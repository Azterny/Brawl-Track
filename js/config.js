// Configuration Globale
const API_URL = "https://api.brawl-track.com"; 

// Variables d'état partagées
let currentUserTier = 'basic'; 
let globalBrawlersList = [];
let fullHistoryData = [];
let currentLiveTrophies = null;
let myChart = null; // Instance du graphique

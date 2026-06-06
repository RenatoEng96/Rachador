import { AdMob, BannerAdSize, BannerAdPosition } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

// Unidades de Teste do AdMob
const BANNER_AD_ID = 'ca-app-pub-3940256099942544/6300978111'; // Android (modificar para prod se necessário)
const INTERSTITIAL_AD_ID = 'ca-app-pub-3940256099942544/1033173712'; // Android

export async function initAdMob() {
    if (Capacitor.isNativePlatform()) {
        try {
            await AdMob.initialize({});
            console.log("AdMob initialized");
            
            // Exibir Banner
            const options = {
                adId: BANNER_AD_ID,
                adSize: BannerAdSize.BANNER,
                position: BannerAdPosition.BOTTOM_CENTER,
                margin: 0,
                isTesting: true // TODO: Mudar para false em produção
            };
            await AdMob.showBanner(options);
        } catch(e) {
            console.error("Erro AdMob init/banner:", e);
        }
    }
}

export async function showInterstitialAd() {
    if (Capacitor.isNativePlatform()) {
        try {
            const options = {
                adId: INTERSTITIAL_AD_ID,
                isTesting: true // TODO: Mudar para false em produção
            };
            await AdMob.prepareInterstitial(options);
            await AdMob.showInterstitial();
        } catch(e) {
            console.error("Erro Interstitial AdMob:", e);
        }
    }
}

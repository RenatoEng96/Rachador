import { toggleDraftMode, getLevelInfo, getCategoryInfo, getTeamName, getDailyPlayerStats, updateLiveEloPreview, updateSorteioCounters, changeHistoryPage, openPlayerHistoryModal, exportPlayerHistory, setFormMode, editPlayer, resetForm, renderPublic, renderRanking, getNextDueDate, getPlayerLateChargesCount, renderSorteioTable, renderAdminTable, renderTeams, renderPlacarTeams, renderMatchHistory, togglePlacarLock, forceUnlockPlacar, toggleAuthMode, setGroupRoleFilter, filterUserGroups, renderUserGroups, renderAll, openPlacarConfigModal, closePlacarConfigModal, savePlacarConfig, playBeepSound, goHome, openTermsModal, closeTermsModal, openPrivacyModal, closePrivacyModal, openSupportModal, closeSupportModal, copySupportEmail } from '../ui.js';

import { state } from '../state.js';
import { calculateEloMatch } from '../services/rankingService.js';
import { settingsRef, updateDoc } from '../firebase.js';
import { domToBlob } from 'https://unpkg.com/modern-screenshot?module';

// ============================================================================
// CONTROLE DE NAVEGAÇÃO E MODAIS
// ============================================================================

/**
 * Abre o modal de transferência de jogador, definindo a origem
 * e populando as opções de destino.
 */
export const openMoveModal = (teamId, playerId) => {
    // 1. Bloqueia se houver jogo em andamento
    const t1 = document.getElementById('team1Select')?.value;
    const t2 = document.getElementById('team2Select')?.value;
    if (t1 && t2 && (state.score1 > 0 || state.score2 > 0)) {
        showToast("Transferência bloqueada! Um jogo está em andamento no placar.", "error");
        return;
    }

    // 2. Guarda os dados da origem no estado global
    state.moveData = { sourceTeamId: teamId, playerId: playerId };

    // 3. Procura o jogador para exibir o nome no modal
    const team = state.drawnTeams.find(t => t.id === teamId);
    const player = team?.players.find(p => p.id === playerId);
    
    if (!player) return;
    document.getElementById('movePlayerName').innerText = player.name;
    
    // 4. Gera as opções de destino (excluindo o time atual)
    let options = '';
    const sortedTeams = [...state.drawnTeams].sort((a,b) => 
        a.isWaitlist ? 1 : (b.isWaitlist ? -1 : parseInt(a.label) - parseInt(b.label))
    );
    
    sortedTeams.forEach(t => {
        if (t.id !== teamId) {
            options += `<option value="${t.id}">${t.isWaitlist ? "Time Fora" : getTeamName(t)}</option>`;
        }
    });
    
    // Adiciona a opção de remover o jogador completamente
    options += `<option value="REMOVE" class="text-red-400 font-bold">❌ Remover Jogador</option>`;
    
    // 5. Atualiza o HTML e exibe o modal
    document.getElementById('moveDestination').innerHTML = options;
    const modal = document.getElementById('movePlayerModal');
    modal.classList.remove('hidden'); 
    modal.classList.add('flex');

    if (typeof lucide !== 'undefined') lucide.createIcons();
};

export const showToast = (msg, type = 'success') => {
    const toast = document.getElementById('toast');
    document.getElementById('toastMsg').innerText = msg;
    
    let bgColor = type === 'success' ? 'bg-green-600' : (type === 'error' ? 'bg-red-600' : 'bg-blue-600');
    toast.className = `fixed bottom-5 right-5 ${bgColor} text-white px-4 py-2 rounded-xl shadow-2xl transition-transform duration-300 flex items-center gap-2 z-[60] text-sm`;
    toast.classList.remove('translate-y-24');
    
    setTimeout(() => toast.classList.add('translate-y-24'), 3500);
};

export const switchView = (view) => {
    // Early return para o admin (Painel)
    if (view === 'admin' && state.isAuthenticated && !(state.currentUserRole === 'admin' || state.isMaster)) {
        showToast("Você não é administrador deste grupo.", "error");
        return;
    }

    // 1. Esconde TODAS as views
    ['public', 'sorteio', 'auth', 'admin', 'placar', 'groups', 'pagamentos', 'landing'].forEach(v => { 
        const e = document.getElementById(`view-${v}`); 
        if(e) e.classList.add('hidden-view'); 
    });
    
    // 2. Remove o status de "ativo" de todos os botões do menu topo
    ['btn-public', 'btn-sorteio', 'btn-admin', 'btn-placar', 'btn-groups', 'btn-pagamentos'].forEach(b => { 
        const e = document.getElementById(b); 
        if(e) e.classList.remove('active'); 
    });
    
    // 3. Controle da visibilidade do Menu de Navegação (Só aparece se estiver DENTRO de um grupo)
    const navButtons = document.getElementById('mainNavButtons');
    const mainNav = document.querySelector('nav');
    
    if (view === 'auth' || view === 'groups' || view === 'landing') {
        if(navButtons) navButtons.classList.add('hidden-view');
    } else {
        if(navButtons) navButtons.classList.remove('hidden-view');
    }

    if (view === 'landing') {
        if (mainNav) mainNav.classList.add('hidden');
    } else {
        if (mainNav) mainNav.classList.remove('hidden');
    }

    // Controle do título "Rachador" na nav bar
    const navBrandText = document.getElementById('navBrandText');
    if (navBrandText) {
        if (view === 'groups' || view === 'auth' || view === 'admin') {
            navBrandText.classList.remove('hidden');
            navBrandText.classList.add('block');
            navBrandText.style.display = 'inline-block'; // Garante que fique visível mesmo com cache ou conflitos de CSS
        } else {
            navBrandText.classList.remove('block');
            navBrandText.classList.add('hidden');
            navBrandText.style.display = ''; // Volta a usar o CSS do Tailwind
        }
    }

    // 4. Mostra a view correta e ativa o botão correspondente
    if (view === 'public') { 
        document.getElementById('view-public').classList.remove('hidden-view'); 
        document.getElementById('btn-public').classList.add('active'); 
    } else if (view === 'sorteio') { 
        document.getElementById('view-sorteio').classList.remove('hidden-view'); 
        document.getElementById('btn-sorteio').classList.add('active'); 
    } else if (view === 'placar') { 
        document.getElementById('view-placar').classList.remove('hidden-view'); 
        document.getElementById('btn-placar').classList.add('active'); 
    } else if (view === 'groups') {
        document.getElementById('view-groups').classList.remove('hidden-view'); 
        if(document.getElementById('btn-groups')) document.getElementById('btn-groups').classList.add('active');
    } else if (view === 'auth') {
        document.getElementById('view-auth').classList.remove('hidden-view');
    } else if (view === 'landing') {
        document.getElementById('view-landing').classList.remove('hidden-view');
    } else if (view === 'admin') { 
        // Proteção resolvida no início da função
        if (state.isAuthenticated) {
            document.getElementById('view-admin').classList.remove('hidden-view');
            document.getElementById('btn-admin').classList.add('active'); 
        } else {
            document.getElementById('view-auth').classList.remove('hidden-view');
        }
    } else if (view === 'pagamentos') {
        if (state.isAuthenticated) {
            document.getElementById('view-pagamentos').classList.remove('hidden-view');
            document.getElementById('btn-pagamentos').classList.add('active');
            
            // Check if user is admin, if so show admin panel
            if (state.currentUserRole === 'admin' || state.isMaster) {
                document.querySelector('.admin-only-section').classList.remove('hidden');
                document.querySelector('.admin-only-section').classList.add('flex');
            } else {
                document.querySelector('.admin-only-section').classList.add('hidden');
                document.querySelector('.admin-only-section').classList.remove('flex');
            }
            
            // Call render payments function (will be defined in paymentController)
            if (typeof window.renderPaymentsView === 'function') {
                window.renderPaymentsView();
            }
        } else {
            document.getElementById('view-auth').classList.remove('hidden-view');
        }
    }
    
    // Atualiza os dados apenas se estiver numa tela de grupo
    if(view !== 'auth' && view !== 'groups' && view !== 'landing') {
        renderAll();
    }
};

export const openConfirmModal = (title, message, callback) => {
    document.getElementById('confirmTitle').innerText = title; 
    document.getElementById('confirmMessage').innerText = message;
    state.confirmActionCallback = callback;
    document.getElementById('confirmModal').classList.remove('hidden'); 
    document.getElementById('confirmModal').classList.add('flex'); 
    if(typeof lucide !== 'undefined') lucide.createIcons();
};

export const closeConfirmModal = () => { 
    document.getElementById('confirmModal').classList.add('hidden'); 
    document.getElementById('confirmModal').classList.remove('flex'); 
    state.confirmActionCallback = null; 
};

export const closeVictoryModalOnly = async () => { 
    const modal = document.getElementById('victoryModal');
    if(modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }

    state.score1 = 0; state.score2 = 0;
    state.currentTeam1 = ''; state.currentTeam2 = '';

    // GARANTE QUE O CACHE DO GRUPO TAMBÉM SEJA ZERADO
    if (state.currentGroupId && state.groupMatchStates[state.currentGroupId]) {
        state.groupMatchStates[state.currentGroupId].score1 = 0;
        state.groupMatchStates[state.currentGroupId].score2 = 0;
        state.groupMatchStates[state.currentGroupId].currentTeam1 = '';
        state.groupMatchStates[state.currentGroupId].currentTeam2 = '';
    }

    const s1 = document.getElementById('score1'); if(s1) s1.innerText = '0'; 
    const s2 = document.getElementById('score2'); if(s2) s2.innerText = '0'; 
    const t1 = document.getElementById('team1Select'); if(t1) t1.value = ''; 
    const t2 = document.getElementById('team2Select'); if(t2) t2.value = ''; 

    // Liberta o placar na nuvem para que outros possam usar e zera tudo lá
    try { 
        if (settingsRef) {
            await updateDoc(settingsRef, { 
                matchInProgress: false, 
                matchOwner: null,
                score1: 0,
                score2: 0,
                currentTeam1: '',
                currentTeam2: ''
            }); 
        }
    } catch(e) { console.warn("Erro ao limpar placar na nuvem", e); }
    
    // Zera o cronômetro para a próxima partida do grupo
    if (typeof window.resetTimer === 'function') {
        window.resetTimer();
    }
    
    if (typeof updateLiveEloPreview === 'function') updateLiveEloPreview();
};

export const closeMoveModal = () => { 
    const modal = document.getElementById('movePlayerModal');
    if(modal) {
        modal.classList.add('hidden'); 
        modal.classList.remove('flex'); 
    }
    state.moveData = { sourceTeamId: null, playerId: null }; 
};

export const closePlayerHistoryModal = () => {
    const modal = document.getElementById('playerHistoryModal');
    if(modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};


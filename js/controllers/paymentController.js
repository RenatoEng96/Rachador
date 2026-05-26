import { state } from '../state.js';
import { db, collection, addDoc, doc, setDoc, query, where, onSnapshot, getDoc, updateDoc, getDocs, deleteDoc } from '../firebase.js';
import { showToast, openConfirmModal } from '../ui.js';

let unsubscribeCharges = null;
let unsubscribeCaixa = null;
let currentPixKey = '';
let currentMonthlyValue = 0;
let currentMonthlyDay = 10;
let currentCaixaVisibility = false;
let currentCaixaBalance = 0;

// Filtros e Paginação de Caixa/Extrato
let cachedEntries = [];
let adminCaixaCurrentPage = 1;
let playerCaixaCurrentPage = 1;
let adminCaixaSelectedMonth = 'all';
let adminCaixaSelectedYear = 'all';
let playerCaixaSelectedMonth = 'all';
let playerCaixaSelectedYear = 'all';

export const setPaymentAdminTab = (tab) => {
    ['config', 'monthly', 'daily', 'caixa'].forEach(t => {
        const el = document.getElementById(`pay-admin-${t}`);
        const btn = document.getElementById(`tab-pay-${t}`);
        if (el) el.classList.add('hidden');
        if (btn) {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-slate-700', 'text-slate-300');
        }
    });
    const el = document.getElementById(`pay-admin-${tab}`);
    const btn = document.getElementById(`tab-pay-${tab}`);
    if (el) el.classList.remove('hidden');
    if (btn) {
        btn.classList.remove('bg-slate-700', 'text-slate-300');
        btn.classList.add('bg-blue-600', 'text-white');
    }
};

export const renderPaymentsView = async () => {
    if (!state.currentGroupId) return;

    if (unsubscribeCharges) unsubscribeCharges();
    if (unsubscribeCaixa) unsubscribeCaixa();

    const isAdmin = state.currentUserRole === 'admin' || state.isMaster;

    try {
        const settingsDoc = await getDoc(doc(db, 'groups', state.currentGroupId, 'paymentSettings', 'global'));
        if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            currentPixKey = data.pixKey || '';
            currentMonthlyValue = parseFloat(data.monthlyValue) || 0;
            currentMonthlyDay = parseInt(data.monthlyDay) || 10;
            currentCaixaVisibility = data.caixaVisibility || false;

            if (isAdmin) {
                const pixInput = document.getElementById('adminPixKey');
                if (pixInput) pixInput.value = currentPixKey;

                const mvInput = document.getElementById('payMonthlyValue');
                if (mvInput) mvInput.value = currentMonthlyValue || '';

                const mdInput = document.getElementById('payMonthlyDay');
                if (mdInput) mdInput.value = currentMonthlyDay || '';

                const cvCheck = document.getElementById('caixaVisibility');
                if (cvCheck) cvCheck.checked = currentCaixaVisibility;

                // Popula lista de jogadores para diária
                const list = document.getElementById('diariaPlayersList');
                if (list) {
                    list.innerHTML = '';
                    state.players.forEach(p => {
                        list.innerHTML += `
                            <label class="flex items-center gap-3 p-2 hover:bg-slate-800 rounded-lg cursor-pointer">
                                <input type="checkbox" class="diaria-player-cb w-4 h-4 text-purple-500 bg-slate-950 border-slate-700 rounded" value='${JSON.stringify({id: p.id, name: p.name, email: p.email})}'>
                                <span class="text-sm font-bold text-white">${p.name} <span class="text-xs text-slate-500 font-normal">(${p.email || 'Sem e-mail'})</span></span>
                            </label>
                        `;
                    });
                }
            }
        }
    } catch (err) {
        console.error('Erro ao carregar paymentSettings:', err);
    }

    const adminMonthlyTable = document.getElementById('adminMonthlyTable');
    const adminDailyTable = document.getElementById('adminPaymentsTable');
    const userList = document.getElementById('userPendingChargesList');

    // Cria sub-containers dedicados no painel do jogador para evitar que
    // mensalidade e cobranças diárias se sobrescrevam mutuamente.
    if (userList) {
        userList.innerHTML = `
            <div id="user-monthly-charges"></div>
            <div id="user-daily-charges"></div>
            <div id="user-pix-info"></div>
        `;
    }

    const userMonthlyEl = document.getElementById('user-monthly-charges');
    const userDailyEl   = document.getElementById('user-daily-charges');
    const userPixEl     = document.getElementById('user-pix-info');

    // Renderiza status mensal (sem PIX aqui — PIX será unificado depois)
    renderMonthlyView(isAdmin, currentMonthlyDay, adminMonthlyTable, userMonthlyEl);

    // Renderiza cobranças diárias em tempo real
    renderDailyView(isAdmin, adminDailyTable, userDailyEl, userPixEl);

    renderCaixaView(isAdmin, userList);
};

const renderMonthlyView = (isAdmin, monthlyDay, adminTable, userMonthlyEl) => {
    const now = new Date();

    if (isAdmin && adminTable) {
        adminTable.innerHTML = '';
        state.players.forEach(p => {
            let nextDue = getNextDueDate(p.paidUntil, monthlyDay);
            let isOverdue = now > nextDue;
            const statusColor = isOverdue ? 'text-red-500' : 'text-green-500';
            const statusText = isOverdue ? 'Atrasado' : 'Em dia';
            adminTable.innerHTML += `
                <tr>
                    <td class="px-4 py-3 font-bold text-white">${p.name}</td>
                    <td class="px-4 py-3 text-center text-slate-300">${nextDue.toLocaleDateString()}</td>
                    <td class="px-4 py-3 text-center font-bold ${statusColor}">${statusText}</td>
                    <td class="px-4 py-3 text-right">
                        <button onclick="addMonthlyPayment('${p.id}', '${p.name.replace(/'/g, "\\'")}',-1)" class="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded text-xs font-bold transition-colors mr-1">-1 Mês</button>
                        <button onclick="addMonthlyPayment('${p.id}', '${p.name.replace(/'/g, "\\'")}', 1)" class="bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold transition-colors">+1 Mês</button>
                    </td>
                </tr>
            `;
        });
    }

    if (!userMonthlyEl) return;

    const myPlayer = state.players.find(p => p.email === state.user.email);
    if (!myPlayer) {
        userMonthlyEl.innerHTML = `<div class="text-center text-slate-400 py-4 text-sm italic">Jogador não encontrado no grupo.</div>`;
        return;
    }

    let nextDue = getNextDueDate(myPlayer.paidUntil, monthlyDay);
    const isOverdue = now > nextDue;
    const statusColor = isOverdue ? 'text-red-400' : 'text-green-400';
    const statusText  = isOverdue ? 'Atrasado' : 'Em dia';
    const borderColor = isOverdue ? 'border-red-500/40' : 'border-slate-700';

    userMonthlyEl.innerHTML = `
        <div class="bg-slate-900 border ${borderColor} rounded-xl p-4 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
                <div class="bg-blue-500/10 p-2 rounded-lg border border-blue-500/20 shrink-0">
                    <i data-lucide="calendar" class="w-4 h-4 text-blue-400"></i>
                </div>
                <div>
                    <p class="text-xs text-slate-400 font-bold uppercase">Mensalidade</p>
                    <p class="text-sm text-slate-300">Venc: <span class="font-bold text-white">${nextDue.toLocaleDateString()}</span></p>
                </div>
            </div>
            <span class="text-sm font-black ${statusColor} uppercase">${statusText}</span>
        </div>
    `;
    if (isOverdue && currentPixKey) {
        userMonthlyEl.innerHTML += renderPixKeyInfoHTML('Pague a mensalidade via PIX:');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.addMonthlyPayment = async (playerId, playerName = '', direction = 1) => {
    if (!state.currentGroupId) return;

    const actionText = direction > 0 ? 'Adicionar' : 'Remover';
    const dirText    = direction > 0 ? '+1 Mês'    : '-1 Mês';

    openConfirmModal(`Confirmar ${dirText}`, `${actionText} 1 mês de pagamento para o jogador ${playerName}?`, async () => {
        const settingsDoc = await getDoc(doc(db, 'groups', state.currentGroupId, 'paymentSettings', 'global'));
        let monthlyDay   = 10;
        let monthlyValue = 0;
        if (settingsDoc.exists()) {
            const data = settingsDoc.data();
            monthlyDay   = data.monthlyDay   || 10;
            monthlyValue = parseFloat(data.monthlyValue) || 0;
        }

        const playerRef = doc(db, 'groups', state.currentGroupId, 'players', playerId);
        const playerDoc = await getDoc(playerRef);
        if (!playerDoc.exists()) return;

        const pData = playerDoc.data();
        let nextDue = getNextDueDate(pData.paidUntil, monthlyDay);
        const targetDueDateStr = nextDue.toLocaleDateString();
        nextDue.setMonth(nextDue.getMonth() + direction);

        try {
            await updateDoc(playerRef, { paidUntil: nextDue.getTime() });

            if (monthlyValue > 0) {
                const desc = `Mensalidade - ${playerName} (Venc: ${targetDueDateStr})`;
                await addDoc(collection(db, 'groups', state.currentGroupId, 'caixa'), {
                    description: desc,
                    value: monthlyValue,
                    type: direction > 0 ? 'credit' : 'debit',
                    createdAt: Date.now()
                });
            }

            showToast('Pagamento de 1 mês registrado com sucesso!', 'success');
            const pIndex = state.players.findIndex(p => p.id === playerId);
            if (pIndex !== -1) state.players[pIndex].paidUntil = nextDue.getTime();
            renderPaymentsView();
        } catch (e) {
            console.error(e);
            showToast('Erro ao atualizar pagamento.', 'error');
        }
    });
};

// Retorna HTML da info PIX (string, sem fazer appendChild)
const renderPixKeyInfoHTML = (message) => {
    if (!currentPixKey) return '';
    return `
        <div class="mt-2 bg-slate-950 p-3 rounded-xl border border-slate-700 w-full text-center">
            <p class="text-xs text-slate-400 mb-2">${message}</p>
            <div class="flex items-center justify-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
                <span class="text-white font-mono text-sm break-all">${currentPixKey}</span>
                <button onclick="copyAdminPixString()" class="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded transition-colors" title="Copiar PIX">
                    <i data-lucide="copy" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `;
};
const getNextDueDate = (paidUntilMillis, monthlyDay) => {
    if (paidUntilMillis) {
        return new Date(paidUntilMillis);
    } else {
        // Se não tem, o primeiro vencimento é o próximo 'monthlyDay' a partir de hoje
        const today = new Date();
        let nextDue = new Date(today.getFullYear(), today.getMonth(), monthlyDay);
        if (today > nextDue) {
            nextDue.setMonth(nextDue.getMonth() + 1);
        }
        return nextDue;
    }
};



const renderDailyView = (isAdmin, adminTable, userDailyEl, userPixEl) => {
    let chargesQuery;

    if (isAdmin) {
        chargesQuery = collection(db, 'groups', state.currentGroupId, 'charges');
    } else {
        chargesQuery = query(collection(db, 'groups', state.currentGroupId, 'charges'), where('playerEmail', '==', state.user.email));
    }

    unsubscribeCharges = onSnapshot(chargesQuery, (snapshot) => {
        const charges = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

        if (adminTable) adminTable.innerHTML = '';
        // NÃO limpa userDailyEl de uma só vez — reconstrói abaixo

        let dailyPendingHTML = '';
        let hasPending = false;

        charges.forEach(charge => {
            // Tabela admin
            if (adminTable) {
                const statusColor = charge.status === 'paid' ? 'text-green-500' : 'text-yellow-500';
                const statusText  = charge.status === 'paid' ? 'Pago' : 'Pendente';
                adminTable.innerHTML += `
                    <tr>
                        <td class="px-4 py-3 font-bold text-white">${charge.playerName}</td>
                        <td class="px-4 py-3 text-slate-300">${charge.description}</td>
                        <td class="px-4 py-3 text-white">R$ ${charge.value.toFixed(2)}</td>
                        <td class="px-4 py-3 text-center font-bold ${statusColor}">${statusText}</td>
                        <td class="px-4 py-3 text-right">
                            <div class="flex justify-end gap-2">
                                ${charge.status !== 'paid' ? `<button onclick="markChargeAsPaid('${charge.id}', '${(charge.playerName||'Jogador').replace(/'/g,"\\'")}')"
                                    class="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded text-xs font-bold transition-colors">Pago</button>` : '<span class="text-slate-500 text-xs">-</span>'}
                                <button onclick="deleteCharge('${charge.id}', '${(charge.playerName||'Jogador').replace(/'/g,"\\'")}')"
                                    class="bg-red-600 hover:bg-red-500 text-white p-1 rounded transition-colors" title="Excluir">
                                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            }

            // Painel do jogador — apenas pendentes do próprio usuário
            if (charge.playerEmail === state.user?.email && charge.status !== 'paid') {
                hasPending = true;
                dailyPendingHTML += `
                    <div class="bg-slate-900 border border-yellow-500/30 rounded-xl p-4 flex items-center justify-between gap-3">
                        <div class="flex items-center gap-3">
                            <div class="bg-purple-500/10 p-2 rounded-lg border border-purple-500/20 shrink-0">
                                <i data-lucide="zap" class="w-4 h-4 text-purple-400"></i>
                            </div>
                            <div>
                                <p class="text-xs text-slate-400 font-bold uppercase">Diária</p>
                                <p class="text-sm font-bold text-white">${charge.description}</p>
                                <p class="text-xs text-slate-400">${new Date(charge.createdAt).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <span class="text-base font-black text-yellow-400 whitespace-nowrap">R$ ${charge.value.toFixed(2)}</span>
                    </div>
                `;
            }
        });

        if (userDailyEl) {
            if (hasPending) {
                userDailyEl.innerHTML = dailyPendingHTML;
            } else {
                userDailyEl.innerHTML = '';
            }
        }

        // Atualiza o bloco PIX unificado: mostra se houver qualquer pendência
        if (userPixEl && currentPixKey) {
            const userMonthlyEl = document.getElementById('user-monthly-charges');
            const monthlyOverdue = userMonthlyEl && userMonthlyEl.innerHTML.includes('Atrasado');
            if (hasPending || monthlyOverdue) {
                userPixEl.innerHTML = renderPixKeyInfoHTML('Realize o pagamento via PIX e envie o comprovante:');
            } else {
                userPixEl.innerHTML = `<div class="text-center text-slate-400 py-6 text-sm italic">Você está em dia com todas as cobranças! 🎉</div>`;
            }
        } else if (userPixEl) {
            if (!hasPending) {
                const userMonthlyEl = document.getElementById('user-monthly-charges');
                const monthlyOverdue = userMonthlyEl && userMonthlyEl.innerHTML.includes('Atrasado');
                if (!monthlyOverdue) {
                    userPixEl.innerHTML = `<div class="text-center text-slate-400 py-6 text-sm italic">Você está em dia com todas as cobranças! 🎉</div>`;
                }
            }
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
    });
};

const renderPixKeyInfo = (container, message) => {
    if (currentPixKey) {
        container.innerHTML += `
            <div class="mt-4 bg-slate-950 p-4 rounded-xl border border-slate-700 w-full text-center">
                <p class="text-xs text-slate-400 mb-2">${message}</p>
                <div class="flex items-center justify-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-700">
                    <span class="text-white font-mono text-sm break-all" id="userPixKeyDisplay">${currentPixKey}</span>
                    <button onclick="copyAdminPixString()" class="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded transition-colors" title="Copiar PIX">
                        <i data-lucide="copy" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
};

window.copyAdminPixString = () => {
    if (!currentPixKey) return;
    navigator.clipboard.writeText(currentPixKey);
    showToast("Chave PIX copiada!", "success");
};

window.markChargeAsPaid = async (chargeId, playerName = '') => {
    openConfirmModal("Confirmar Pagamento", `Marcar a cobrança de ${playerName} como paga?`, async () => {
        try {
            const chargeRef = doc(db, 'groups', state.currentGroupId, 'charges', chargeId);
            const chargeDoc = await getDoc(chargeRef);
            await updateDoc(chargeRef, {
                status: 'paid',
                paidAt: Date.now()
            });
            showToast("Cobrança marcada como paga!", "success");

            if (chargeDoc.exists()) {
                const cData = chargeDoc.data();
                // Add to Caixa
                await addDoc(collection(db, 'groups', state.currentGroupId, 'caixa'), {
                    description: `Pagamento: ${cData.description} (${playerName})`,
                    value: cData.value,
                    type: 'credit',
                    createdAt: Date.now()
                });
            }

        } catch (e) {
            console.error(e);
            showToast("Erro ao atualizar cobrança.", "error");
        }
    });
};

window.deleteCharge = async (chargeId, playerName = '') => {
    openConfirmModal("Excluir Cobrança", `Tem certeza que deseja excluir a cobrança de ${playerName}? Esta ação não pode ser desfeita.`, async () => {
        try {
            const chargeRef = doc(db, 'groups', state.currentGroupId, 'charges', chargeId);
            await deleteDoc(chargeRef);
            showToast("Cobrança excluída com sucesso!", "success");
        } catch (e) {
            console.error(e);
            showToast("Erro ao excluir cobrança.", "error");
        }
    });
};

window.showPaymentSaveBtn = () => {
    const btn = document.getElementById('btnSaveConfig');
    if (btn) btn.classList.remove('hidden');
};

window.showMensalistaSaveBtn = () => {
    const btn = document.getElementById('btnSaveMensalista');
    if (btn) btn.classList.remove('hidden');
};

// Salva apenas a chave PIX
window.savePixKeyOnly = async () => {
    if (!state.currentGroupId) return;
    const pixKey = document.getElementById('adminPixKey').value.trim();
    try {
        await setDoc(doc(db, 'groups', state.currentGroupId, 'paymentSettings', 'global'), { pixKey }, { merge: true });
        showToast('Chave PIX salva!', 'success');
        const btn = document.getElementById('btnSaveConfig');
        if (btn) btn.classList.add('hidden');
        currentPixKey = pixKey;
    } catch (e) {
        console.error(e);
        showToast('Erro ao salvar PIX.', 'error');
    }
};

// Salva configurações de mensalidade
window.saveMensalistaSettings = async () => {
    if (!state.currentGroupId) return;
    const monthlyValue = parseFloat(document.getElementById('payMonthlyValue').value) || 0;
    const monthlyDay = parseInt(document.getElementById('payMonthlyDay').value) || 1;
    try {
        await setDoc(doc(db, 'groups', state.currentGroupId, 'paymentSettings', 'global'), { monthlyValue, monthlyDay }, { merge: true });
        showToast('Configurações de mensalidade salvas!', 'success');
        const btn = document.getElementById('btnSaveMensalista');
        if (btn) btn.classList.add('hidden');
        currentMonthlyValue = monthlyValue;
        currentMonthlyDay = monthlyDay;
        // Atualiza tabela de mensalistas
        const adminMonthlyTable = document.getElementById('adminMonthlyTable');
        renderMonthlyView(true, currentMonthlyDay, adminMonthlyTable, null);
    } catch (e) {
        console.error(e);
        showToast('Erro ao salvar mensalidade.', 'error');
    }
};

export const savePaymentSettings = async () => {
    if (!state.currentGroupId) return;
    const pixKey = document.getElementById('adminPixKey')?.value.trim() || '';
    const monthlyValue = parseFloat(document.getElementById('payMonthlyValue')?.value) || 0;
    const monthlyDay = parseInt(document.getElementById('payMonthlyDay')?.value) || 1;
    const payload = { pixKey, monthlyValue, monthlyDay };
    try {
        await setDoc(doc(db, 'groups', state.currentGroupId, 'paymentSettings', 'global'), payload, { merge: true });
        currentPixKey = pixKey;
        currentMonthlyValue = monthlyValue;
        currentMonthlyDay = monthlyDay;
    } catch (e) {
        console.error(e);
    }
};

export const generateDailyCharges = async () => {

    const desc = document.getElementById('diariaDesc').value.trim();
    const val = parseFloat(document.getElementById('diariaValue').value);
    const type = document.getElementById('diariaType').value;
    
    if (!desc) return showToast("Digite uma descrição para a cobrança.", "error");
    if (!val || val <= 0) return showToast("Digite um valor válido.", "error");

    const checkboxes = document.querySelectorAll('.diaria-player-cb:checked');
    if (checkboxes.length === 0) return showToast("Selecione ao menos um jogador.", "error");

    const players = Array.from(checkboxes).map(cb => JSON.parse(cb.value));
    
    let valuePerPlayer = val;
    if (type === 'split') {
        valuePerPlayer = val / players.length;
    }

    if (valuePerPlayer <= 0) {
        return showToast("O valor mínimo por jogador deve ser maior que 0.", "error");
    }

    showToast(`Gerando ${players.length} cobranças...`, "info");
    
    const chargesRef = collection(db, 'groups', state.currentGroupId, 'charges');
    
    try {
        const promises = players.map(async p => {
            const q = query(chargesRef, where('playerId', '==', p.id));
            const snapshot = await getDocs(q);
            const deletePromises = [];
            snapshot.docs.forEach(d => {
                if (d.data().status === 'paid') {
                    deletePromises.push(deleteDoc(d.ref));
                }
            });
            await Promise.all(deletePromises);

            return addDoc(chargesRef, {
                playerId: p.id,
                playerName: p.name,
                playerEmail: p.email || "",
                description: desc,
                value: valuePerPlayer,
                status: 'pending',
                dueDate: Date.now() + (24 * 60 * 60 * 1000), // Vence em 24h
                createdAt: Date.now()
            });
        });
        
        await Promise.all(promises);
        
        showToast("Cobranças enviadas com sucesso!", "success");
        document.getElementById('diariaDesc').value = '';
        document.getElementById('diariaValue').value = '';
        document.querySelectorAll('.diaria-player-cb').forEach(cb => cb.checked = false);
        setPaymentAdminTab('daily');
    } catch (e) {
        console.error(e);
        showToast("Erro ao criar cobranças.", "error");
    }
};

function renderCaixaView(isAdmin, userList) {
    if (unsubscribeCaixa) unsubscribeCaixa();
    
    // Reset filters and page when changing view / group
    adminCaixaCurrentPage = 1;
    playerCaixaCurrentPage = 1;
    adminCaixaSelectedMonth = 'all';
    adminCaixaSelectedYear = 'all';
    playerCaixaSelectedMonth = 'all';
    playerCaixaSelectedYear = 'all';
    
    const filterMonthEl = document.getElementById('caixaFilterMonth');
    if (filterMonthEl) filterMonthEl.value = 'all';
    const filterYearEl = document.getElementById('caixaFilterYear');
    if (filterYearEl) filterYearEl.value = 'all';
    const pFilterMonthEl = document.getElementById('playerFilterMonth');
    if (pFilterMonthEl) pFilterMonthEl.value = 'all';
    const pFilterYearEl = document.getElementById('playerFilterYear');
    if (pFilterYearEl) pFilterYearEl.value = 'all';

    const caixaQuery = collection(db, 'groups', state.currentGroupId, 'caixa');
    
    unsubscribeCaixa = onSnapshot(caixaQuery, (snapshot) => {
        const entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        // Ordenar por data mais recente
        entries.sort((a, b) => b.createdAt - a.createdAt);
        cachedEntries = entries;

        // Popular os seletores de anos dinamicamente
        updateYearSelectors(entries);

        // Renderiza tudo (caixa do admin e extrato do jogador)
        renderCaixaTables(isAdmin);
    });
}

function updateYearSelectors(entries) {
    const years = new Set();
    years.add(new Date().getFullYear()); // Sempre inclui o ano atual
    entries.forEach(entry => {
        if (entry.createdAt) {
            const y = new Date(entry.createdAt).getFullYear();
            years.add(y);
        }
    });
    const sortedYears = Array.from(years).sort((a, b) => b - a);

    const populateSelect = (selectId, currentValue) => {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = '<option value="all">Todos os Anos</option>';
        sortedYears.forEach(y => {
            select.innerHTML += `<option value="${y}">${y}</option>`;
        });
        select.value = currentValue;
    };

    populateSelect('caixaFilterYear', adminCaixaSelectedYear);
    populateSelect('playerFilterYear', playerCaixaSelectedYear);
}

function renderCaixaTables(isAdmin) {
    // 1. Filtragem das entradas
    const filteredAdminEntries = cachedEntries.filter(entry => {
        if (!entry.createdAt) return false;
        const date = new Date(entry.createdAt);
        const m = date.getMonth().toString();
        const y = date.getFullYear().toString();
        
        const matchesMonth = adminCaixaSelectedMonth === 'all' || m === adminCaixaSelectedMonth;
        const matchesYear = adminCaixaSelectedYear === 'all' || y === adminCaixaSelectedYear;
        return matchesMonth && matchesYear;
    });

    const filteredPlayerEntries = cachedEntries.filter(entry => {
        if (!entry.createdAt) return false;
        const date = new Date(entry.createdAt);
        const m = date.getMonth().toString();
        const y = date.getFullYear().toString();
        
        const matchesMonth = playerCaixaSelectedMonth === 'all' || m === playerCaixaSelectedMonth;
        const matchesYear = playerCaixaSelectedYear === 'all' || y === playerCaixaSelectedYear;
        return matchesMonth && matchesYear;
    });

    // 2. Cálculo do Saldo Total com base em TODAS as transações
    let total = 0;
    cachedEntries.forEach(entry => {
        const isCredit = entry.type === 'credit';
        const value = parseFloat(entry.value) || 0;
        total += isCredit ? value : -value;
    });

    // 3. Renderizar a tabela do Admin
    const tbody = document.getElementById('caixaTableBody');
    if (isAdmin && tbody) {
        tbody.innerHTML = '';
        
        // Paginação do Admin
        const totalItems = filteredAdminEntries.length;
        const totalPages = Math.ceil(totalItems / 30);
        if (adminCaixaCurrentPage > totalPages) adminCaixaCurrentPage = Math.max(1, totalPages);
        
        const start = (adminCaixaCurrentPage - 1) * 30;
        const end = start + 30;
        const pagedEntries = filteredAdminEntries.slice(start, end);

        pagedEntries.forEach(entry => {
            const isCredit = entry.type === 'credit';
            const value = parseFloat(entry.value) || 0;
            const dateStr = new Date(entry.createdAt).toLocaleDateString();
            const color = isCredit ? 'text-green-500' : 'text-red-500';
            const sign = isCredit ? '+' : '-';
            const typeText = isCredit ? 'Crédito' : 'Débito';
            
            tbody.innerHTML += `
                <tr>
                    <td class="px-2 py-2 sm:px-4 sm:py-3 text-slate-300">${dateStr}</td>
                    <td class="px-2 py-2 sm:px-4 sm:py-3 text-white font-bold break-words">${entry.description}</td>
                    <td class="px-2 py-2 sm:px-4 sm:py-3 ${color} font-bold">${typeText}</td>
                    <td class="px-2 py-2 sm:px-4 sm:py-3 text-right ${color} font-bold whitespace-nowrap">${sign} R$ ${value.toFixed(2)}</td>
                </tr>
            `;
        });

        renderPagination('caixaPagination', adminCaixaCurrentPage, totalPages, 'changeAdminCaixaPage');
    }

    // 4. Renderizar a tabela do Player (Extrato)
    const tbodyPlayer = document.getElementById('playerCaixaTableBody');
    if (tbodyPlayer) {
        tbodyPlayer.innerHTML = '';
        
        // Paginação do Player
        const totalItems = filteredPlayerEntries.length;
        const totalPages = Math.ceil(totalItems / 30);
        if (playerCaixaCurrentPage > totalPages) playerCaixaCurrentPage = Math.max(1, totalPages);
        
        const start = (playerCaixaCurrentPage - 1) * 30;
        const end = start + 30;
        const pagedEntries = filteredPlayerEntries.slice(start, end);

        pagedEntries.forEach(entry => {
            const isCredit = entry.type === 'credit';
            const value = parseFloat(entry.value) || 0;
            const dateStr = new Date(entry.createdAt).toLocaleDateString();
            const color = isCredit ? 'text-green-500' : 'text-red-500';
            const sign = isCredit ? '+' : '-';
            
            tbodyPlayer.innerHTML += `
                <tr>
                    <td class="px-2 py-2 sm:px-3 sm:py-2 text-slate-300">${dateStr}</td>
                    <td class="px-2 py-2 sm:px-3 sm:py-2 text-white font-bold text-xs break-words">${entry.description}</td>
                    <td class="px-2 py-2 sm:px-3 sm:py-2 text-right ${color} font-bold whitespace-nowrap">${sign} R$ ${value.toFixed(2)}</td>
                </tr>
            `;
        });

        renderPagination('playerCaixaPagination', playerCaixaCurrentPage, totalPages, 'changePlayerCaixaPage');
    }

    // 5. Atualizar Saldos e Visibilidades
    currentCaixaBalance = total;
    
    const balanceEl = document.getElementById('caixaBalance');
    if (balanceEl) {
        balanceEl.textContent = `R$ ${total.toFixed(2)}`;
        balanceEl.className = `text-2xl font-black ${total >= 0 ? 'text-green-400' : 'text-red-400'}`;
    }

    const playerCaixaView = document.getElementById('playerCaixaView');
    const playerCaixaExtratoPanel = document.getElementById('playerCaixaExtratoPanel');
    
    const isRegularPlayer = !(state.currentUserRole === 'admin' || state.isMaster);
    const shouldShowExtrato = isRegularPlayer && currentCaixaVisibility;
    const shouldShowBalance = currentCaixaVisibility || isAdmin;

    if (playerCaixaView) {
        if (shouldShowBalance) {
            playerCaixaView.classList.remove('hidden');
            const playerBalance = document.getElementById('playerCaixaBalance');
            if (playerBalance) {
                playerBalance.textContent = `R$ ${total.toFixed(2)}`;
                playerBalance.className = `text-sm font-black ${total >= 0 ? 'text-green-400' : 'text-red-400'}`;
            }
        } else {
            playerCaixaView.classList.add('hidden');
        }
    }

    if (playerCaixaExtratoPanel) {
        if (shouldShowExtrato) {
            playerCaixaExtratoPanel.classList.remove('hidden');
            playerCaixaExtratoPanel.classList.add('flex');
        } else {
            playerCaixaExtratoPanel.classList.add('hidden');
            playerCaixaExtratoPanel.classList.remove('flex');
        }
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderPagination(containerId, currentPage, totalPages, callbackName) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    
    if (totalPages <= 1) {
        container.classList.add('hidden');
        container.classList.remove('flex');
        return;
    }
    container.classList.remove('hidden');
    container.classList.add('flex');

    // Botão de Anterior
    const prevDisabled = currentPage === 1;
    container.innerHTML += `
        <button onclick="${prevDisabled ? '' : `${callbackName}(${currentPage - 1})`}" 
            class="px-2 py-1 text-xs font-bold rounded transition-colors ${prevDisabled ? 'text-slate-600 bg-slate-800/30 cursor-not-allowed' : 'text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white'}" 
            ${prevDisabled ? 'disabled' : ''}>
            &lt;
        </button>
    `;

    // Botões Numerados
    for (let i = 1; i <= totalPages; i++) {
        const isActive = i === currentPage;
        container.innerHTML += `
            <button onclick="${callbackName}(${i})" 
                class="px-3 py-1 text-xs font-black rounded transition-all ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 scale-105' : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'}">
                ${i}
            </button>
        `;
    }

    // Botão de Próximo
    const nextDisabled = currentPage === totalPages;
    container.innerHTML += `
        <button onclick="${nextDisabled ? '' : `${callbackName}(${currentPage + 1})`}" 
            class="px-2 py-1 text-xs font-bold rounded transition-colors ${nextDisabled ? 'text-slate-600 bg-slate-800/30 cursor-not-allowed' : 'text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white'}" 
            ${nextDisabled ? 'disabled' : ''}>
            &gt;
        </button>
    `;
}

export const toggleCaixaVisibility = async (isVisible) => {
    if (!state.currentGroupId) return;
    try {
        await setDoc(doc(db, 'groups', state.currentGroupId, 'paymentSettings', 'global'), { caixaVisibility: isVisible }, { merge: true });
        currentCaixaVisibility = isVisible;
        showToast("Visibilidade do caixa atualizada!", "success");
        // Força renderização do painel do jogador se necessário, mas o snapListener de groups talvez não dispare.
        // Vou apenas mudar a classe localmente:
        const playerCaixaView = document.getElementById('playerCaixaView');
        if (playerCaixaView) {
            if (isVisible || state.currentUserRole === 'admin' || state.isMaster) {
                playerCaixaView.classList.remove('hidden');
            } else {
                playerCaixaView.classList.add('hidden');
            }
        }
        const playerCaixaExtratoPanel = document.getElementById('playerCaixaExtratoPanel');
        if (playerCaixaExtratoPanel) {
            const isRegularPlayer = !(state.currentUserRole === 'admin' || state.isMaster);
            if (isVisible && isRegularPlayer) {
                playerCaixaExtratoPanel.classList.remove('hidden');
                playerCaixaExtratoPanel.classList.add('flex');
            } else {
                playerCaixaExtratoPanel.classList.add('hidden');
                playerCaixaExtratoPanel.classList.remove('flex');
            }
        }
    } catch (e) {
        console.error(e);
        showToast("Erro ao atualizar visibilidade.", "error");
    }
};

// Window-scoped callbacks
window.changeAdminCaixaPage = (page) => {
    adminCaixaCurrentPage = page;
    renderCaixaTables(state.currentUserRole === 'admin' || state.isMaster);
};

window.changePlayerCaixaPage = (page) => {
    playerCaixaCurrentPage = page;
    renderCaixaTables(state.currentUserRole === 'admin' || state.isMaster);
};

window.applyCaixaFilters = () => {
    const monthEl = document.getElementById('caixaFilterMonth');
    const yearEl = document.getElementById('caixaFilterYear');
    if (monthEl) adminCaixaSelectedMonth = monthEl.value;
    if (yearEl) adminCaixaSelectedYear = yearEl.value;
    
    adminCaixaCurrentPage = 1; // Reset to page 1
    renderCaixaTables(state.currentUserRole === 'admin' || state.isMaster);
};

window.applyPlayerCaixaFilters = () => {
    const monthEl = document.getElementById('playerFilterMonth');
    const yearEl = document.getElementById('playerFilterYear');
    if (monthEl) playerCaixaSelectedMonth = monthEl.value;
    if (yearEl) playerCaixaSelectedYear = yearEl.value;
    
    playerCaixaCurrentPage = 1; // Reset to page 1
    renderCaixaTables(state.currentUserRole === 'admin' || state.isMaster);
};

export const addCaixaEntry = async () => {
    if (!state.currentGroupId) return;
    
    const desc = document.getElementById('caixaDesc').value.trim();
    const valueStr = document.getElementById('caixaValue').value;
    const type = document.getElementById('caixaType').value;
    
    if (!desc) return showToast("Digite uma descrição.", "error");
    const val = parseFloat(valueStr);
    if (isNaN(val) || val <= 0) return showToast("Digite um valor válido.", "error");

    try {
        await addDoc(collection(db, 'groups', state.currentGroupId, 'caixa'), {
            description: desc,
            value: val,
            type: type, // 'credit' ou 'debit'
            createdAt: Date.now()
        });
        showToast("Registro adicionado ao Caixa!", "success");
        document.getElementById('caixaDesc').value = '';
        document.getElementById('caixaValue').value = '';
    } catch (e) {
        console.error(e);
        showToast("Erro ao adicionar registro.", "error");
    }
};


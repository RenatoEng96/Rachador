const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// Função para excluir a conta do usuário
exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'O usuário deve estar autenticado.');
    }

    const uid = context.auth.uid;
    const email = context.auth.token.email;

    try {
        // 1. Atualizar o usuário global para "Excluído"
        const userRef = db.collection('users').doc(uid);
        await userRef.update({
            name: 'Usuário Excluído',
            email: 'excluido@anonimo.com',
            photo: '',
            deletedAt: admin.firestore.FieldValue.serverTimestamp()
        }).catch(err => {
            if (err.code !== 5) { // Se o documento não existir, ignorar
                throw err;
            }
        });

        // 2. Buscar todos os grupos onde o usuário é membro
        const groupsSnapshot = await db.collection('groups')
            .where('memberEmails', 'array-contains', email)
            .get();

        const batch = db.batch();

        for (const groupDoc of groupsSnapshot.docs) {
            const groupId = groupDoc.id;
            
            // Atualizar o player específico neste grupo
            const playersSnapshot = await db.collection(`groups/${groupId}/players`)
                .where('email', '==', email)
                .get();
            
            playersSnapshot.forEach(playerDoc => {
                batch.update(playerDoc.ref, {
                    name: 'Excluído',
                    email: 'excluido@anonimo.com',
                    photo: '',
                    updatedAt: Date.now()
                });
            });

            // Opcional: remover o email do array memberEmails do grupo
            batch.update(groupDoc.ref, {
                memberEmails: admin.firestore.FieldValue.arrayRemove(email)
            });
        }

        await batch.commit();

        // 3. Deletar do Firebase Auth
        await admin.auth().deleteUser(uid);

        return { success: true, message: 'Conta excluída com sucesso.' };
    } catch (error) {
        console.error('Erro ao excluir conta:', error);
        throw new functions.https.HttpsError('internal', 'Erro ao excluir a conta.');
    }
});

function getBaseEloChange(team1Elo, team2Elo, isTeam1Winner, isTie) {
    const K_FACTOR = 32;
    const LOSS_PENALTY_FACTOR = 0.7;

    const expectedT1 = 1 / (1 + Math.pow(10, (team2Elo - team1Elo) / 400));
    const expectedT2 = 1 / (1 + Math.pow(10, (team1Elo - team2Elo) / 400));

    let changeT1, changeT2;

    if (isTie) {
        changeT1 = Math.round(K_FACTOR * (0.5 - expectedT1));
        changeT2 = Math.round(K_FACTOR * (0.5 - expectedT2));
    } else {
        if (isTeam1Winner) {
            changeT1 = Math.round(K_FACTOR * (1 - expectedT1));
            changeT2 = Math.round(K_FACTOR * (0 - expectedT2) * LOSS_PENALTY_FACTOR);
        } else {
            changeT1 = Math.round(K_FACTOR * (0 - expectedT1) * LOSS_PENALTY_FACTOR);
            changeT2 = Math.round(K_FACTOR * (1 - expectedT2));
        }
    }

    return { changeT1, changeT2 };
}

function calculatePlayerFinalEloChange(baseChange, isWinActual, currentStreak) {
    let finalChange = baseChange;
    if (isWinActual) {
        const newStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
        if (newStreak >= 3) {
            finalChange += 5; // STREAK_BONUS
        }
    }
    return finalChange;
}

exports.submitMatchResult = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const { groupId, team1Players, team2Players, score1, score2, isTie, isTeam1Winner } = data;

    if (!groupId || !team1Players || !team2Players) {
        throw new functions.https.HttpsError('invalid-argument', 'Dados da partida incompletos.');
    }

    try {
        const groupRef = db.collection('groups').doc(groupId);
        const groupDoc = await groupRef.get();
        if (!groupDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Grupo não encontrado.');
        }

        const groupData = groupDoc.data();
        const userEmail = context.auth.token.email;
        const uid = context.auth.uid;

        // Verificar permissões
        const isAdmin = groupData.adminUids?.includes(uid) || groupData.moderatorEmails?.includes(userEmail) || userEmail === 'renato96.ram@gmail.com';
        
        const settingsDoc = await groupRef.collection('settings').doc('global').get();
        const eloEnabled = settingsDoc.exists ? settingsDoc.data().eloEnabled : false;

        // Se o Elo não está habilitado, apenas administradores podem salvar resultados manualmente (conforme regra do frontend)
        if (!isAdmin && !eloEnabled) {
             throw new functions.https.HttpsError('permission-denied', 'Apenas administradores podem salvar placares quando o Elo está desativado.');
        }

        if (!isAdmin && !groupData.memberEmails?.includes(userEmail)) {
            throw new functions.https.HttpsError('permission-denied', 'Você não é membro deste grupo.');
        }

        const batch = db.batch();
        const playersRef = groupRef.collection('players');

        // Buscar dados atuais dos jogadores para calcular médias e atualizar
        const team1Docs = await Promise.all(team1Players.map(p => playersRef.doc(p.id).get()));
        const team2Docs = await Promise.all(team2Players.map(p => playersRef.doc(p.id).get()));

        let totalEloT1 = 0;
        team1Docs.forEach(d => totalEloT1 += d.exists ? (d.data().eloRating || 0) : 0);
        const avgEloT1 = team1Docs.length > 0 ? totalEloT1 / team1Docs.length : 0;

        let totalEloT2 = 0;
        team2Docs.forEach(d => totalEloT2 += d.exists ? (d.data().eloRating || 0) : 0);
        const avgEloT2 = team2Docs.length > 0 ? totalEloT2 / team2Docs.length : 0;

        const { changeT1, changeT2 } = getBaseEloChange(avgEloT1, avgEloT2, isTeam1Winner, isTie);

        const processTeam = (docs, change, isWinActual, isTieActual) => {
            docs.forEach(dbPlayerDoc => {
                if (!dbPlayerDoc.exists) return;
                const dbPlayer = dbPlayerDoc.data();
                
                const partidas = (dbPlayer.partidas || 0) + 1;
                const vitorias = (dbPlayer.vitorias || 0) + ((isWinActual && !isTieActual) ? 1 : 0);
                const currentStreak = dbPlayer.streak || 0;
                
                const newStreak = isTieActual ? currentStreak : (isWinActual ? (currentStreak >= 0 ? currentStreak + 1 : 1) : (currentStreak <= 0 ? currentStreak - 1 : -1));
                const finalChange = isTieActual ? change : calculatePlayerFinalEloChange(change, isWinActual, currentStreak);
                const newElo = Math.max(0, (dbPlayer.eloRating || 0) + finalChange);

                batch.update(dbPlayerDoc.ref, {
                    eloRating: newElo,
                    partidas,
                    vitorias,
                    streak: newStreak,
                    updatedAt: Date.now()
                });
            });
        };

        processTeam(team1Docs, changeT1, isTeam1Winner, isTie);
        processTeam(team2Docs, changeT2, !isTeam1Winner, isTie);

        // Adicionar Histórico
        const historyRef = groupRef.collection('matchHistory').doc();
        batch.set(historyRef, {
            timestamp: Date.now(),
            dateString: new Date().toLocaleDateString('pt-BR'),
            team1: { 
                name: data.team1Name || 'Time 1', 
                score: score1, 
                players: team1Docs.map(d => d.exists ? d.data().name : '') 
            },
            team2: { 
                name: data.team2Name || 'Time 2', 
                score: score2, 
                players: team2Docs.map(d => d.exists ? d.data().name : '') 
            },
            winner: isTie ? 0 : (isTeam1Winner ? 1 : 2),
            eloChangeT1: changeT1,
            eloChangeT2: changeT2,
            eloGain: isTie ? Math.max(Math.abs(changeT1), Math.abs(changeT2)) : (isTeam1Winner ? changeT1 : changeT2),
            savedBy: userEmail
        });

        await batch.commit();

        return { success: true, changeT1, changeT2 };

    } catch (error) {
        console.error('Erro ao salvar partida:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Erro ao processar partida.');
    }
});

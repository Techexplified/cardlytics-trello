import { APP_KEY } from './constants';

export async function calculateMatchCount(t) {
    let criteria = await t.get('card', 'shared', 'dashFilter');

    // Fallback: Check description for config if not found in shared data
    // (This handles cards created via the Board Button where t.set wasn't possible on the new card)
    if (!criteria) {
        try {
            const card = await t.card('desc');
            if (card && card.desc && card.desc.startsWith('DASHCARD_CONFIG|')) {
                const jsonStr = card.desc.replace('DASHCARD_CONFIG|', '');
                criteria = JSON.parse(jsonStr);

                // Self-heal: Save to shared storage so we don't depend on description forever
                // (We don't await this to keep the badge render fast/non-blocking)
                t.set('card', 'shared', 'dashFilter', criteria);
            }
        } catch (e) { console.error("Config parse error:", e); }
    }

    if (!criteria) {
        console.log("Dashcard: No criteria found.");
        return { text: '', color: null, count: 0 };
    }

    try {
        const allCards = await t.board('all').get('cards', 'all');
        if (!Array.isArray(allCards)) return { text: '', color: null, count: 0 };

        const me = (await t.member('id')).id;
        const now = new Date();

        const matchedCards = allCards.filter(card => {
            if (card.closed) return false;
            if (criteria.cardId && card.id === criteria.cardId) return false;
            if (criteria.listId && criteria.listId !== 'any' && card.idList !== criteria.listId) return false;
            if (criteria.memberId && criteria.memberId !== 'any') {
                // Normalize 'me' to the current user's ID
                const targetMemberId = (criteria.memberId === 'me') ? me : criteria.memberId;

                if (!card.idMembers || !Array.isArray(card.idMembers)) return false;
                if (!card.idMembers.includes(targetMemberId)) return false;
            }
            if (criteria.labelId && criteria.labelId !== 'any' && (!card.idLabels || !card.idLabels.includes(criteria.labelId))) return false;
            if (criteria.due && criteria.due !== 'any') {
                if (!card.due) return false;
                const dueDate = new Date(card.due);
                const isComplete = card.dueComplete;
                if (criteria.due === 'overdue') {
                    if (dueDate >= now || isComplete) return false;
                } else if (criteria.due === 'week') {
                    const nextWeek = new Date();
                    nextWeek.setDate(now.getDate() + 7);
                    if (dueDate < now || dueDate > nextWeek || isComplete) return false;
                }
            }
            return true;
        });

        const count = matchedCards.length;

        // --- Auto-Update Cover Logic ---
        // Check if count changed and update cover if possible
        const lastCount = await t.get('card', 'shared', 'lastKnownCount');
        if (lastCount !== count) {
            await t.set('card', 'shared', 'lastKnownCount', count);

            // Attempt to update cover (This might fail in badge context without token, but worth a shot if authorized)
            if (criteria.background && criteria.background.type === 'color') {
                const hex = criteria.background.hex || '#0079bf';
                try {
                    const rest = t.getRestApi();
                    // Only proceed if we already have a token to avoid popup blocking
                    if (await rest.isAuthorized()) {
                        const token = await rest.getToken();
                        const cardId = await t.card('id').then(c => c.id);

                        // Generate new image
                        const cleanHex = hex.replace('#', '');
                        const imageUrl = `https://placehold.co/600x400/${cleanHex}/ffffff.png?text=${count}`;

                        // 1. Upload new attachment
                        const attachRes = await fetch(`https://api.trello.com/1/cards/${cardId}/attachments?key=${APP_KEY}&token=${token}&url=${encodeURIComponent(imageUrl)}`, { method: 'POST' });
                        if (attachRes.ok) {
                            const attachData = await attachRes.json();
                            // 2. Set as cover
                            await fetch(`https://api.trello.com/1/cards/${cardId}?key=${APP_KEY}&token=${token}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    cover: {
                                        idAttachment: attachData.id,
                                        size: 'full',
                                        brightness: 'dark'
                                    }
                                })
                            });
                        }
                    }
                } catch (e) {
                    // Silent fail if we can't update cover from badge context
                }
            }
        }

        return { text: count.toString(), color: null, count };
    } catch (error) {
        return { text: 'Err', count: 0 };
    }
}

export function getUrlParam(name) {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

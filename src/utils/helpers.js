export async function calculateMatchCount(t) {
    try {
        // Use t.card('id') to get the current card ID
        const cardData = await t.card('id');
        const selfCardId = cardData.id;

        const criteria = await t.get('card', 'shared', 'dashFilter');
        if (!criteria) return [];

        // Fetch board cards using the correct board capability
        const boardData = await t.board('cards');
        const allCards = boardData.cards;

        if (!Array.isArray(allCards)) return [];

        const now = new Date();
        const matchedCards = allCards.filter(card => {
            if (card.closed) return false;
            if (card.id === selfCardId) return false;

            // List Filter
            if (criteria.listId && criteria.listId !== 'any' && card.idList !== criteria.listId) return false;

            // Member Filter
            if (criteria.memberId && criteria.memberId !== 'any') {
                if (!card.idMembers?.includes(criteria.memberId)) return false;
            }

            // Label Filter
            if (criteria.labelId && criteria.labelId !== 'any') {
                if (!card.idLabels?.some(l => l.id === criteria.labelId)) return false;
            }

            // Due Date Filter
            if (criteria.due && criteria.due !== 'any') {
                if (!card.due) return false;
                const d = new Date(card.due);
                if (criteria.due === 'overdue') {
                    if (d >= now || card.dueComplete) return false;
                }
                if (criteria.due === 'week') {
                    const next = new Date();
                    next.setDate(now.getDate() + 7);
                    if (d < now || d > next || card.dueComplete) return false;
                }
            }
            return true;
        });

        return [{
            text: String(matchedCards.length),
            color: null
        }];
    } catch (e) {
        console.error('Dashcard count failed:', e);
        return [];
    }
}

export const getFilteredCards = async (t, filters) => {
    try {
        const allCards = await t.cards("all")

        if (!Array.isArray(allCards)) return [];

        return allCards.filter(card => {
            if (card.closed) return false;

            if (filters.cardId && card.id === filters.cardId) return false;

            if (filters.listId && filters.listId !== 'any' && card.idList !== filters.listId) return false;
            if (filters.memberId && filters.memberId !== 'any') {
                const memberIds = Array.isArray(card.members) ? card.members.map(m => m.id) : [];
                if (!memberIds.includes(filters.memberId)) return false;
            }

            if (filters.labelId && filters.labelId !== 'any') {
                const labelIds = Array.isArray(card.labels) ? card.labels.map(l => l.id) : [];
                if (!labelIds.includes(filters.labelId)) return false;
            }

            return true;
        });
    } catch (e) {
        console.error("Filter logic error:", e);
        return [];
    }
};

export function getUrlParam(name) {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

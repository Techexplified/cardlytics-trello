import { APP_KEY } from './constants';

export async function calculateMatchCount(t) {
    try {
        const { id: selfCardId } = await t.card('id');

        let criteria = await t.get('card', 'shared', 'dashFilter');
        if (!criteria) {
            return [];
        }

        const allCards = await t.board('all').get('cards', 'all');
        if (!Array.isArray(allCards)) {
            return [];
        }

        const now = new Date();

        const matchedCards = allCards.filter(card => {
            if (card.closed) return false;
            if (card.id === selfCardId) return false;

            if (criteria.listId && criteria.listId !== 'any' && card.idList !== criteria.listId) {
                return false;
            }

            if (criteria.memberId && criteria.memberId !== 'any') {
                if (!card.idMembers?.includes(criteria.memberId)) return false;
            }

            if (criteria.labelId && criteria.labelId !== 'any') {
                if (!card.idLabels?.includes(criteria.labelId)) return false;
            }

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

        return [
            {
                text: String(matchedCards.length),
                color: null
            }
        ];
    } catch (e) {
        console.error('Dashcard count failed:', e);
        return [];
    }
}

export function getUrlParam(name) {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}

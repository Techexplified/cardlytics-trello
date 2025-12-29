export async function calculateMatchCount(t) {
    try {
        const cardData = await t.card('id');
        const selfCardId = cardData.id;

        const criteria = await t.get('card', 'shared', 'dashFilter');
        if (!criteria) return [];
        const allCards = await t.cards('all');

        if (!Array.isArray(allCards)) return [];

        const now = new Date();
        const matchedCards = allCards.filter(card => {
            if (card.closed) return false;
            if (card.id === selfCardId) return false;

            if (criteria.listId && criteria.listId !== 'any' && card.idList !== criteria.listId) return false;

            if (criteria.memberId && criteria.memberId !== 'any') {
                const members = card.idMembers || (card.members ? card.members.map(m => m.id) : []);
                if (!members.includes(criteria.memberId)) return false;
            }

            if (criteria.labelId && criteria.labelId !== 'any') {
                const labels = card.idLabels || (card.labels ? card.labels.map(l => l.id) : []);
                if (!labels.includes(criteria.labelId)) return false;
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
                const members = card.idMembers || (card.members ? card.members.map(m => m.id) : []);
                if (!members.includes(filters.memberId)) return false;
            }

            if (filters.labelId && filters.labelId !== 'any') {
                const labels = card.idLabels || (card.labels ? card.labels.map(l => l.id) : []);
                if (!labels.includes(filters.labelId)) return false;
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

export const createCompositeImage = (bg, count, title) => {
    return new Promise((resolve, reject) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 600;
        canvas.height = 320;

        const drawContent = () => {
            // Dark overlay for readability if image
            if (bg.type === 'image') {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // Draw Count
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 140px "Arial", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(count, canvas.width / 2, (canvas.height / 2) - 20);

            // Draw Title
            ctx.font = 'bold 30px "Arial", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(title || "Dashcard", 30, canvas.height - 30);

            canvas.toBlob(blob => {
                resolve(blob);
            }, 'image/png');
        };

        if (bg.type === 'color') {
            ctx.fillStyle = bg.hex || bg.value || '#0079bf';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawContent();
        } else if (bg.type === 'image') {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
                const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
                const x = (canvas.width / 2) - (img.width / 2) * scale;
                const y = (canvas.height / 2) - (img.height / 2) * scale;
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
                drawContent();
            };
            img.onerror = (err) => {
                console.error("Image load failed", err);
                ctx.fillStyle = '#333333';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                drawContent();
            };
            img.src = bg.value;
        } else {
            ctx.fillStyle = '#0079bf';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawContent();
        }
    });
};

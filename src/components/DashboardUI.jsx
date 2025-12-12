import React, { useEffect, useState } from "react";
import { APP_KEY } from "../utils/constants";

export default function DashboardUI() {
    const t = window.TrelloPowerUp ? window.TrelloPowerUp.iframe({ appKey: APP_KEY, appName: 'Dashcards' }) : null;
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDashContext, setIsDashContext] = useState(false);

    const isDashboard = typeof document !== 'undefined' && (!!document.getElementById("trello-dashboard-root") || window.location.pathname.includes("dashboard.html"));

    useEffect(() => {
        if (isDashboard) {
            document.body.style.backgroundColor = 'transparent';
            document.documentElement.style.backgroundColor = 'transparent';
        }
    }, [isDashboard]);

    useEffect(() => {
        if (!t) return;
        const fetchContext = async () => {
            try {
                const context = t.getContext();
                if (context.card) {
                    setIsDashContext(true);
                    const filter = await t.get('card', 'shared', 'dashFilter');
                    if (filter) {
                        const allCards = await t.board('all').get('cards', 'all');
                        if (!Array.isArray(allCards)) {
                            setMatches([]); setLoading(false); return;
                        }

                        const me = (await t.member('id')).id;
                        const now = new Date();
                        const filtered = allCards.filter(card => {
                            if (card.closed) return false;
                            if (filter.cardId && card.id === filter.cardId) return false;
                            if (filter.listId && filter.listId !== 'any' && card.idList !== filter.listId) return false;
                            if (filter.memberId && filter.memberId !== 'any') {
                                if (filter.memberId === 'me') {
                                    if (!card.idMembers || !card.idMembers.includes(me)) return false;
                                } else if (!card.idMembers || !card.idMembers.includes(filter.memberId)) return false;
                            }
                            if (filter.labelId && filter.labelId !== 'any' && (!card.idLabels || !card.idLabels.includes(filter.labelId))) return false;
                            if (filter.due && filter.due !== 'any') {
                                if (!card.due) return false;
                                const d = new Date(card.due);
                                if (filter.due === 'overdue' && (d >= now || card.dueComplete)) return false;
                                if (filter.due === 'week') {
                                    const next = new Date(); next.setDate(now.getDate() + 7);
                                    if (d < now || d > next || card.dueComplete) return false;
                                }
                            }
                            return true;
                        });
                        setMatches(filtered);
                    }
                }
            } catch (e) { } finally { setLoading(false); }
        };
        fetchContext();

        t.sizeTo('#trello-dashboard-root').catch(() => { });
    }, [t]);

    if (loading) return <div className="loading-state">Loading...</div>;

    if (isDashContext) {
        return (
            <div style={{ padding: 12, backgroundColor: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, color: '#172b4d' }}>Matched Cards ({matches.length})</h3>
                </div>
                {matches.length === 0 ? <div style={{ color: '#6b778c', fontStyle: 'italic' }}>No cards match.</div> : (
                    <div className="list-group">
                        {matches.map(c => (
                            <div key={c.id} className="list-item" style={{ padding: '8px 4px', borderBottom: '1px solid #eee' }}>
                                <a href={c.url} target="_blank" style={{ textDecoration: 'none', color: '#172b4d', fontWeight: 500 }} rel="noreferrer">{c.name}</a>
                                <div style={{ fontSize: 12, color: '#5e6c84' }}>{c.due ? `Due: ${new Date(c.due).toLocaleDateString()}` : ''}</div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{ padding: 20, textAlign: 'center' }}>
            <h2>Use "Track with Dashcard" on any card!</h2>
            <p>Open a card and click the Dashcard button to convert it into a tracker.</p>
        </div>
    )
}

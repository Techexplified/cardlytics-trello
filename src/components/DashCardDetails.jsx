import React, { useEffect, useState, useCallback, useMemo } from "react";
import { APP_KEY } from "../utils/constants";
import { getFilteredCards } from "../utils/helpers";

export default function DashCardDetails() {
    const t = useMemo(() => window.TrelloPowerUp.iframe({
        appKey: APP_KEY,
        appName: 'Dashcards'
    }), []);

    const [matchedCards, setMatchedCards] = useState([]);
    const [filter, setFilter] = useState(null);
    const [memberMap, setMemberMap] = useState({});
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            // 1. Get filter from the current card
            const storedFilter = await t.get('card', 'shared', 'dashFilter');

            if (!storedFilter) {
                setLoading(false);
                return;
            }

            // 2. Fetch only the members field to avoid PluginModelSerializer errors
            const boardMembers = await t.board('members');
            const lookup = {};
            const membersArray = boardMembers.members || boardMembers;
            if (Array.isArray(membersArray)) {
                membersArray.forEach(m => lookup[m.id] = m.fullName);
            }
            setMemberMap(lookup);

            // 3. Pass to the fixed helper
            const matched = await getFilteredCards(t, storedFilter);

            setMatchedCards(matched);
            setFilter(storedFilter);
        } catch (err) {
            console.error("Detail View Load Error:", err);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (!loading) {
            const timer = setTimeout(() => {
                t.sizeTo('#detail-root').catch(() => { });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [loading, matchedCards, t]);

    if (loading) {
        return <div id="detail-root" style={{ color: '#ccc', padding: '10px' }}>Loading mapped cards...</div>;
    }

    if (!filter) {
        return <div id="detail-root" style={{ color: '#ccc', padding: '10px' }}>No filter configuration found on this card.</div>;
    }

    return (
        <div id="detail-root" style={{ color: 'white', padding: '10px' }}>
            <h4 style={{ marginBottom: '10px', fontSize: '14px', borderBottom: '1px solid #444', paddingBottom: '5px' }}>
                {filter.name || 'Dashcard'} — Matched Cards ({matchedCards.length})
            </h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {matchedCards.length > 0 ? (
                    matchedCards.map(card => (
                        <li key={card.id} style={{
                            background: '#282c34',
                            padding: '15px',
                            marginBottom: '6px',
                            borderRadius: '4px',
                            borderLeft: `4px solid ${filter.background?.hex || '#0079bf'}`
                        }}>
                            <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{card.name}</div>
                            {card.idMembers?.length > 0 && (
                                <div style={{ fontSize: '11px', color: '#0079bf', marginTop: '4px' }}>
                                    Assigned: {card.idMembers.map(id => memberMap[id] || 'Member').join(', ')}
                                </div>
                            )}
                        </li>
                    ))
                ) : (
                    <li style={{ color: '#999', fontSize: '12px' }}>No cards match the filter criteria.</li>
                )}
            </ul>
        </div>
    );
}
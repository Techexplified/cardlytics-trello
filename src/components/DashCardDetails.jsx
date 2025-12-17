import React, { useEffect, useState, useCallback } from "react";
import { APP_KEY } from "../utils/constants";
import { getFilteredCards } from "../utils/helpers";

export default function DashCardDetails() {
    const t = window.TrelloPowerUp.iframe({ appKey: APP_KEY, appName: 'Dashcards' });

    const [matchedCards, setMatchedCards] = useState([]);
    const [filter, setFilter] = useState(null);
    const [memberMap, setMemberMap] = useState({});
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        try {
            const storedFilter = await t.get('card', 'shared', 'dashFilter');
            if (!storedFilter) {
                setLoading(false);
                return;
            }
            const boardMembers = await t.board('members');
            const memberLookup = {};
            if (boardMembers?.members) {
                boardMembers.members.forEach(m => memberLookup[m.id] = m.fullName);
            }
            setMemberMap(memberLookup);
            const matched = await getFilteredCards(t, storedFilter);

            setMatchedCards(matched);
            setFilter(storedFilter);
        } catch (err) {
            console.error("Detail View Load Error:", err);
        } finally {
            setLoading(false);
            t.sizeTo('#detail-root').done();
        }
    }, [t]);

    useEffect(() => {
        t.render(() => {
            loadData();
        });
    }, [t, loadData]);

    if (loading) return <div style={{ color: '#ccc', padding: '10px' }}>Loading mapped cards...</div>;
    if (!filter) return null;

    return (
        <div id="detail-root" style={{ color: 'white', padding: '10px' }}>
            <h4 style={{ marginBottom: '10px', fontSize: '14px' }}>
                {filter.name || 'Dashcard'} - Matched Cards ({matchedCards.length})
            </h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
                {matchedCards.map(card => (
                    <li key={card.id} style={{
                        background: '#282c34',
                        padding: '8px',
                        marginBottom: '5px',
                        borderRadius: '4px',
                        borderLeft: `4px solid ${filter.background?.hex || '#0079bf'}`
                    }}>
                        <div style={{ fontWeight: 'bold' }}>{card.name}</div>
                        {card.members?.length > 0 && (
                            <div style={{ fontSize: '11px', color: '#0079bf' }}>
                                Assigned to: {card.members.map(m => memberMap[m.id] || m.fullName).join(', ')}
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
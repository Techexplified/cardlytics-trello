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
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const storedFilter = await t.get('card', 'shared', 'dashFilter');
            if (!storedFilter) {
                setLoading(false);
                return;
            }

            const boardMembers = await t.board('members');
            const lookup = {};
            const membersArray = boardMembers.members || boardMembers;
            if (Array.isArray(membersArray)) {
                membersArray.forEach(m => lookup[m.id] = m.fullName);
            }
            const matched = await getFilteredCards(t, storedFilter);
            setMatchedCards(matched);
            setFilter(storedFilter);
        } catch (err) {

        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        if (!loading) {
            const timer = setTimeout(() => {
                t.sizeTo('#detail-root').catch(() => { });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [loading, matchedCards, t]);

    const COLORS = {
        background: '#242528',
        cardItem: '#2c333a',
        textMain: '#b6c2cf',
        textDim: '#8c9bab',
        border: '#38414a'
    };

    if (loading) return <div id="detail-root" style={{ color: COLORS.textDim, padding: '20px', textAlign: 'center', background: COLORS.background }}>Loading...</div>;
    if (!filter) return null;

    return (
        <div id="detail-root" style={{
            background: COLORS.background,
            padding: '12px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
            }}>
                <span style={{ fontSize: '14px', fontWeight: '600', color: COLORS.textMain }}>
                    {filter.name || 'Dashcard'}
                </span>
                <span style={{
                    background: '#38414a',
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: '700',
                    color: COLORS.textMain
                }}>
                    {matchedCards.length}
                </span>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
                {matchedCards.length > 0 ? (
                    matchedCards.map(card => (
                        <div key={card.id} style={{
                            background: COLORS.cardItem,
                            border: `1px solid ${COLORS.border}`,
                            padding: '12px',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            borderLeft: `3px solid ${filter.background?.hex || '#0079bf'}`,
                        }}
                            onClick={() => t.showCard(card.id)}
                        >
                            <div style={{ fontSize: '14px', color: COLORS.textMain, marginBottom: '8px', fontWeight: '500' }}>
                                {card.name}
                            </div>

                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                                {card.labels?.map(label => (
                                    <span key={label.id} style={{
                                        width: '32px',
                                        height: '8px',
                                        borderRadius: '4px',
                                        background: label.color === 'black' ? '#000' : label.color,
                                        opacity: 0.8
                                    }} />
                                ))}

                                {/* Date Badge */}
                                {card.due && (
                                    <span style={{
                                        fontSize: '11px',
                                        color: card.dueComplete ? '#4bce97' : COLORS.textDim,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}>
                                        🕒 {new Date(card.due).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </span>
                                )}

                                {card.members?.length > 0 && (
                                    <div style={{
                                        display: 'flex',
                                        flexWrap: 'wrap',
                                        gap: '6px',
                                        marginLeft: 'auto',
                                        justifyContent: 'flex-end'
                                    }}>
                                        {card.members.map(item => (
                                            <div
                                                key={item.id}
                                                title={item.fullName}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '2px 8px 3px 3px',
                                                    background: '#454f59',
                                                    borderRadius: '12px',
                                                    border: '1px solid #22272b',
                                                    height: '26px'
                                                }}
                                            >
                                                <div style={{
                                                    width: '20px',
                                                    height: '20px',
                                                    borderRadius: '50%',
                                                    overflow: 'hidden',
                                                    background: '#2c333a',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    {item.avatar ? (
                                                        <img
                                                            src={item.avatar}
                                                            alt={item.fullName}
                                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        />
                                                    ) : (
                                                        <span style={{ fontSize: '9px', color: '#b6c2cf' }}>
                                                            {item.fullName.charAt(0).toUpperCase()}
                                                        </span>
                                                    )}
                                                </div>
                                                <span style={{
                                                    fontSize: '11px',
                                                    color: '#b6c2cf',
                                                    fontWeight: '500',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {item.fullName}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: COLORS.textDim,
                        fontSize: '13px',
                        border: `1px dashed ${COLORS.border}`
                    }}>
                        No cards currently match filters
                    </div>
                )}
            </div>
        </div>
    );
}
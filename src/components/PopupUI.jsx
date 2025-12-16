import React, { useEffect, useState } from "react";
import { APP_KEY, BACKGROUNDS } from "../utils/constants";
import { getUrlParam } from "../utils/helpers";

export default function PopupUI() {
    const t = window.TrelloPowerUp ? window.TrelloPowerUp.iframe({ appKey: APP_KEY, appName: 'Dashcards' }) : null;
    const [name, setName] = useState("Dashcard");
    const [bg, setBg] = useState(BACKGROUNDS[0]);
    const [showBgPicker, setShowBgPicker] = useState(false);
    const DEFAULT_FILTERS = { listId: 'any', memberId: 'any', labelId: 'any' };
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [previewCount, setPreviewCount] = useState(0);
    const [matchedCards, setMatchedCards] = useState([]);
    const [lists, setLists] = useState([]);
    const [labels, setLabels] = useState({});
    const [members, setMembers] = useState({});
    const [loading, setLoading] = useState(true);

    const creationMode = getUrlParam("mode") === "create";
    const [targetListId, setTargetListId] = useState("");

    useEffect(() => {
        if (!t) return;
        document.body.classList.add('popup-window');
        const init = async () => {
            try {
                const [boardLists, boardLabels, boardMembers] = await Promise.all([
                    t.lists('all'),
                    t.board('labels'),
                    t.board('members')
                ]);

                setLists(boardLists);

                if (boardLabels && Array.isArray(boardLabels.Labels)) {
                    setLabels(boardLabels.Labels);
                } else if (boardLabels && Array.isArray(boardLabels.labels)) {
                    setLabels(boardLabels.labels);
                } else {
                    setLabels(boardLabels);
                }

                if (boardMembers && boardMembers.members) {
                    setMembers(boardMembers.members);
                } else {
                    setMembers(boardMembers);
                }

                if (!creationMode) {
                    let storedFilter = await t.get('card', 'shared', 'dashFilter');

                    if (!storedFilter) {
                        try {
                            const c = await t.card('desc');
                            if (c && c.desc && c.desc.startsWith('DASHCARD_CONFIG|')) {
                                storedFilter = JSON.parse(c.desc.replace('DASHCARD_CONFIG|', ''));
                            }
                        } catch (e) {
                            // console.log(e); Removed
                        }
                    }

                    if (storedFilter) {
                        const cleanedFilter = (({ due, ...rest }) => rest)(storedFilter);
                        setFilters(cleanedFilter);

                        if (storedFilter.name) setName(storedFilter.name);
                        if (storedFilter.background) {
                            const b = storedFilter.background;
                            if (typeof b === 'string') {
                                const matched = BACKGROUNDS.find(x => x.hex === b || x.value === b);
                                setBg(matched || BACKGROUNDS[0]);
                            } else if (b.value) {
                                const matched = BACKGROUNDS.find(x => x.value === b.value || x.hex === b.value);
                                setBg(matched || b);
                            }
                        }
                    } else {
                        setFilters(DEFAULT_FILTERS);
                    }
                }

                if (creationMode && boardLists && boardLists.length > 0) {
                    setTargetListId(boardLists[0].id);
                }
            } catch (error) {
            } finally {
                setLoading(false);
            }
        };
        init();
    }, [t, creationMode]);


    useEffect(() => {
        if (!t) return;
        // console.log("here inside useEffect"); Removed
        const calculateActiveCount = async () => {
            // console.log("here inside calculateActiveCount"); Removed
            try {
                const allCards = await t.cards('all');

                // console.log("The value of allCards is here", allCards); Removed for final code
                if (!Array.isArray(allCards)) return;

                const matched = allCards.filter(card => {
                    if (card.closed) return false;

                    if (filters.cardId && card.id === filters.cardId) return false;

                    if (filters.listId && filters.listId !== 'any' && card.idList !== filters.listId) return false;

                    // Member Filter: Use card.members and map to IDs
                    if (filters.memberId && filters.memberId !== 'any') {
                        const memberIds = Array.isArray(card.members) ? card.members.map(m => m.id) : [];
                        if (!memberIds.includes(filters.memberId)) return false;
                    }

                    // Label Filter: Use card.labels and map to IDs
                    if (filters.labelId && filters.labelId !== 'any') {
                        const labelIds = Array.isArray(card.labels) ? card.labels.map(l => l.id) : [];
                        if (!labelIds.includes(filters.labelId)) return false;
                    }

                    return true;
                });

                // console.log("The value of matched is here", matched); Removed for final code
                setPreviewCount(matched.length);
                setMatchedCards(matched);
            } catch (e) {
                console.error("Error calculating active count:", e);
            }
        };
        const debounce = setTimeout(calculateActiveCount, 500);
        return () => clearTimeout(debounce);
    }, [filters, lists, loading, t]);


    const saveConfiguration = async () => {
        if (!t) return;

        const closeWindow = () => {
            try { t.closeModal(); } catch (e) {
                try { t.closePopup(); } catch (e2) { /* ignore */ }
            }
        };

        const getCoverUrl = (hexColor, count) => {
            const cleanHex = hexColor.replace('#', '');
            return `https://placehold.co/600x400/${cleanHex}/ffffff.png?text=${count}`;
        };

        if (creationMode) {
            // --- CREATE MODE ---
            if (!targetListId) {
                t.alert({ message: "Please select a destination list.", duration: 3, display: 'warning' });
                return;
            }

            try {
                let token = null;
                try {
                    const rest = t.getRestApi();
                    if (await rest.isAuthorized()) {
                        token = await rest.getToken();
                    }
                } catch (err) { /* ignore */ }

                // 1. Create the Dashcard
                const newCard = await t.createCard(targetListId, {
                    name: name || "Dashcard",
                    desc: "Temporary config holder",
                    pos: "top"
                });

                const updatedFilters = { listId: filters.listId, memberId: filters.memberId, labelId: filters.labelId, cardId: newCard.id };
                setFilters(updatedFilters);

                const config = {
                    ...updatedFilters,
                    name,
                    background: bg,
                    listId: targetListId,
                    cardId: newCard.id
                };

                const descPayload = `DASHCARD_CONFIG|${JSON.stringify(config)}`;

                await fetch(`https://api.trello.com/1/cards/${newCard.id}?key=${APP_KEY}&token=${token || ""}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ desc: descPayload })
                });

                // 3. Set visual cover
                if (token && bg.type === 'color') {
                    const imageUrl = getCoverUrl(bg.hex || "#0079bf", previewCount);

                    // Upload attachment
                    const attachRes = await fetch(
                        `https://api.trello.com/1/cards/${newCard.id}/attachments?key=${APP_KEY}&token=${token}&url=${encodeURIComponent(imageUrl)}`,
                        { method: "POST" }
                    );

                    if (attachRes.ok) {
                        const attachData = await attachRes.json();

                        await fetch(`https://api.trello.com/1/cards/${newCard.id}?key=${APP_KEY}&token=${token}`, {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                cover: {
                                    idAttachment: attachData.id,
                                    color: null,
                                    size: "full",
                                    brightness: "dark"
                                }
                            })
                        });
                    }
                }

                t.alert({ message: `Dashcard "${name}" created!`, duration: 3, display: 'success' });
                setTimeout(closeWindow, 1000);

            } catch (e) {
                console.error("Creation Error:", e);
                t.alert({ message: "Error creating card", display: 'error' });
            }

        } else {
            // --- EDIT MODE ---
            const executeUpdate = async () => {

                const card = await t.card('id');

                const updatedFilters = { listId: filters.listId, memberId: filters.memberId, labelId: filters.labelId, cardId: card.id };
                setFilters(updatedFilters);

                const config = {
                    ...updatedFilters,
                    name,
                    background: bg,
                    cardId: card.id
                };

                await t.set('card', 'shared', 'dashFilter', config);
                await t.set('card', 'shared', 'isDashCard', true);

                t.render();

                let token = null;
                try {
                    const rest = t.getRestApi();
                    if (await rest.isAuthorized()) {
                        token = await rest.getToken();
                    } else {
                        await rest.authorize({ scope: 'read,write', expiration: 'never' });
                        token = await rest.getToken();
                    }
                } catch (authErr) {
                    console.warn("REST API auth failed:", authErr);
                }

                if (token) {
                    try {
                        const cardId = card.id;

                        // Update name
                        if (name) {
                            await fetch(`https://api.trello.com/1/cards/${cardId}?key=${APP_KEY}&token=${token}`, {
                                method: "PUT",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ name })
                            });
                        }

                        // Update cover
                        if (bg.type === 'color') {
                            const imageUrl = getCoverUrl(bg.hex || "#0079bf", previewCount);

                            const attachRes = await fetch(
                                `https://api.trello.com/1/cards/${cardId}/attachments?key=${APP_KEY}&token=${token}&url=${encodeURIComponent(imageUrl)}`,
                                { method: "POST" }
                            );

                            if (attachRes.ok) {
                                const attachData = await attachRes.json();

                                await fetch(`https://api.trello.com/1/cards/${cardId}?key=${APP_KEY}&token=${token}`, {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({
                                        cover: {
                                            idAttachment: attachData.id,
                                            color: null,
                                            size: "full",
                                            brightness: "dark"
                                        }
                                    })
                                });
                            }
                        }
                    } catch (apiErr) {
                        console.error("API Update failed:", apiErr);
                    }
                }
            };

            try {
                await executeUpdate();
                t.alert({ message: "Dashcard updated!", duration: 2, display: 'success' });
                setTimeout(closeWindow, 500);
            } catch (err) {
                console.error("Update failed", err);
                t.alert({ message: "Update failed.", display: 'error' });
            }
        }
    };


    const getTrelloColorName = (hex) => {
        const preset = BACKGROUNDS.find(b => b.hex === hex || b.value === hex);
        return preset ? preset.value : 'blue';
    };

    const getMemberName = (id) => {
        const memberArray = Array.isArray(members) ? members : Object.values(members);
        const member = memberArray.find(m => m.id === id);
        return member ? member.fullName : 'Unknown Member';
    }

    if (!t || loading) return <div className="loading-state" style={{ color: 'white' }}>Loading options...</div>;

    return (
        <div className="dashcard-popup">
            <div className="popup-body">

                <div className="top-section">
                    <div className="preview-section">
                        <div className="preview-card" style={{
                            backgroundColor: bg.type === 'color' ? (bg.hex || '#0079bf') : '#0065ff',
                            backgroundImage: bg.type === 'image' ? `url(${bg.value})` : 'none'
                        }}>
                            <div className="preview-count">{previewCount}</div>
                            <div className="preview-label">{name || 'Dashcard'}</div>
                        </div>
                    </div>

                    <div className="basic-config-section">
                        <div className="dark-input-group" style={{ marginBottom: '10px' }}>
                            <label>NAME</label>
                            <input type="text" className="dark-input" placeholder="Dashcard" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>

                        <div className="dark-input-group" style={{ position: 'relative' }}>
                            <label>APPEARANCE</label>
                            <div className="bg-button" onClick={() => setShowBgPicker(!showBgPicker)}>
                                Change background
                            </div>
                            {showBgPicker && (
                                <div className="bg-picker-grid">
                                    {BACKGROUNDS.map((b, i) => (
                                        <div key={i} className="bg-option" style={{
                                            backgroundColor: b.type === 'color' ? (b.hex || b.value) : '#ccc',
                                            backgroundImage: b.type === 'image' ? `url(${b.value})` : 'none',
                                            backgroundSize: 'cover'
                                        }} onClick={() => { setBg(b); setShowBgPicker(false); }}></div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="filter-section">

                    <div className="dark-input-group">
                        <label>Board</label>
                        <select className="dark-select" disabled>
                            <option>any</option>
                        </select>
                    </div>

                    <div className="dark-input-group">
                        <label>List</label>
                        {creationMode ? (
                            <select className="dark-select" value={targetListId} onChange={(e) => setTargetListId(e.target.value)}>
                                {Array.isArray(lists) && lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        ) : (
                            <select className="dark-select" value={filters.listId} onChange={(e) => setFilters({ ...filters, listId: e.target.value })}>
                                <option value="any">Any list</option>
                                {Array.isArray(lists) && lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                            </select>
                        )}
                    </div>

                    <div className="dark-input-group">
                        <label>Assigned</label>
                        <select
                            className="dark-select"
                            value={filters.memberId}
                            onChange={(e) =>
                                setFilters({ ...filters, memberId: e.target.value })
                            }
                        >
                            <option value="any">Any member</option>

                            {Array.isArray(members) && members.map((m) => (
                                <option key={m.id} value={m.id}>
                                    Assigned to {m.fullName}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="dark-input-group">
                        <label>Labels</label>
                        <select className="dark-select" value={filters.labelId} onChange={(e) => setFilters({ ...filters, labelId: e.target.value })}>
                            <option value="any">Any label</option>
                            {Array.isArray(labels) && labels.map(l => <option key={l.id} value={l.id}>{l.name} ({l.color})</option>)}
                        </select>
                    </div>
                </div>

                <div className="matched-cards-section" style={{ marginTop: '20px', borderTop: '1px solid #333', paddingTop: '15px' }}>
                    <h4 style={{ color: 'white', marginBottom: '10px' }}>Matched Cards ({matchedCards.length})</h4>
                    <ul style={{ listStyle: 'none', padding: 0, maxHeight: '150px', overflowY: 'auto' }}>
                        {matchedCards.length > 0 ? (
                            matchedCards.map(card => (
                                <li key={card.id} style={{
                                    backgroundColor: '#282c34',
                                    padding: '8px',
                                    marginBottom: '5px',
                                    borderRadius: '4px',
                                    fontSize: '12px',
                                    color: '#ccc'
                                }}>
                                    <strong>{card.name}</strong>
                                    {card.members && card.members.length > 0 &&
                                        <span style={{ marginLeft: '10px', color: '#0079bf' }}>
                                            (Assigned to: {card.members.map(m => m.fullName || m.id).join(', ')})
                                        </span>
                                    }
                                </li>
                            ))
                        ) : (
                            <li style={{ color: '#999', fontSize: '12px' }}>No cards matched the current filters.</li>
                        )}
                    </ul>
                </div>

            </div>

            <div className="popup-footer">
                <button className="btn btn-secondary" onClick={() => t.closePopup()}>Cancel</button>
                <button className="btn btn-primary" onClick={saveConfiguration}>Start tracking</button>
            </div>
        </div>
    );
}
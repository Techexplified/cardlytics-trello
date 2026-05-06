import React, { useEffect, useState } from "react";
import { APP_KEY, BACKGROUNDS } from "../utils/constants";
import { searchUnsplashPhotos } from "../utils/unsplashApi";
import { getUrlParam, createCompositeImage } from "../utils/helpers";

export default function PopupUI() {
    const t = window.TrelloPowerUp ? window.TrelloPowerUp.iframe() : null;
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

    const [unsplashQuery, setUnsplashQuery] = useState("");
    const [unsplashImages, setUnsplashImages] = useState([]);
    const [isSearchingUnsplash, setIsSearchingUnsplash] = useState(false);

    const handleUnsplashSearch = async () => {
        if (!unsplashQuery) return;
        setIsSearchingUnsplash(true);
        const images = await searchUnsplashPhotos(unsplashQuery);
        setUnsplashImages(images);
        setIsSearchingUnsplash(false);
    };

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
                            // silently ignore
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
                            } else if (b.type === 'image') {
                                setBg(b);
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
        const calculateActiveCount = async () => {
            try {
                const allCards = await t.cards('all');

                if (!Array.isArray(allCards)) return;

                const matched = allCards.filter(card => {
                    if (card.closed) return false;

                    if (filters.cardId && card.id === filters.cardId) return false;

                    if (filters.listId && filters.listId !== 'any' && card.idList !== filters.listId) return false;
                    if (filters.memberId && filters.memberId !== 'any') {
                        // Trello API 'cards/all' returns idMembers array, not full member objects
                        if (card.idMembers) {
                            if (!card.idMembers.includes(filters.memberId)) return false;
                        } else if (card.members) {
                            // Fallback if some context provides members
                            const memberIds = card.members.map(m => m.id);
                            if (!memberIds.includes(filters.memberId)) return false;
                        } else {
                            // If user selected a member filter but card has no member info, skip it
                            return false;
                        }
                    }

                    if (filters.labelId && filters.labelId !== 'any') {
                        // Trello API 'cards/all' returns idLabels array
                        if (card.idLabels) {
                            if (!card.idLabels.includes(filters.labelId)) return false;
                        } else if (card.labels) {
                            const labelIds = card.labels.map(l => l.id);
                            if (!labelIds.includes(filters.labelId)) return false;
                        } else {
                            return false;
                        }
                    }

                    return true;
                });

                setPreviewCount(matched.length);
                setMatchedCards(matched);
            } catch (e) {

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

        if (creationMode) {
            // --- CREATE MODE ---
            if (!targetListId) {
                t.alert({ message: "Please select a destination list.", duration: 3, display: 'warning' });
                return;
            }

            try {
                let token = null;
                try {
                    const restApi = t.getRestApi();

                    await restApi.authorize({
                        scope: 'read,write',
                        expiration: 'never'
                    });

                    token = await restApi.getToken();
                    console.log("TOKEN:", token);

                } catch (err) { /* ignore */ }

                if (!token) {
                    t.alert({ message: "Authorization is required to create a Dashcard. Please try again.", duration: 5, display: 'warning' });
                    return;
                }

                // 1. Create the Dashcard (Using REST API because t.createCard is not a standard Power-Up client method for this context)
                let newCard;
                const restApi = t.getRestApi();

                await restApi.authorize({
                    scope: 'read,write',
                    expiration: 'never'
                });

                newCard = await restApi.post(`/cards`, {
                    idList: targetListId,
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
                    cardId: newCard.id,
                    lastCount: previewCount
                };

                const descPayload = `DASHCARD_CONFIG|${JSON.stringify(config)}`;

                await restApi.put(`/cards/${newCard.id}`, {
                    desc: descPayload
                });

                // 3. Generate and Set visual cover
                if (token) {
                    try {
                        const blob = await createCompositeImage(bg, previewCount, name);
                        const formData = new FormData();
                        formData.append('file', blob, 'cover.png');

                        // Upload attachment
                        const attachData = await restApi.post(
                            `/cards/${newCard.id}/attachments`,
                            formData
                        );

                        await restApi.put(`/cards/${newCard.id}`, {
                            cover: {
                                idAttachment: attachData.id,
                                color: null,
                                size: "full",
                                brightness: "dark"
                            }
                        });

                    } catch (imgErr) {

                    }
                }

                t.alert({ message: `Dashcard "${name}" created!`, duration: 3, display: 'success' });
                setTimeout(closeWindow, 1000);

            } catch (e) {

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
                    cardId: card.id,
                    lastCount: previewCount
                };

                await t.set('card', 'shared', 'dashFilter', config);
                await t.set('card', 'shared', 'isDashCard', true);

                let token = null;
                try {
                    const restApi = t.getRestApi();

                    await restApi.authorize({
                        scope: 'read,write',
                        expiration: 'never'
                    });

                    token = await restApi.getToken();
                    console.log("TOKEN:", token);

                } catch (authErr) {

                }

                if (token) {
    try {
        const restApi = t.getRestApi();

        const cardId = card.id;

        if (name) {
            await restApi.put(`/cards/${cardId}`, {
                name
            });
        }

        const blob = await createCompositeImage(bg, previewCount, name);

        const formData = new FormData();
        formData.append('file', blob, 'cover.png');

        const attachData = await restApi.post(
            `/cards/${cardId}/attachments`,
            formData
        );

        await restApi.put(`/cards/${cardId}`, {
            cover: {
                idAttachment: attachData.id,
                color: null,
                size: "full",
                brightness: "dark"
            }
        });

    } catch (apiErr) {

    }
}
            };

            try {
                await executeUpdate();
                t.alert({ message: "Dashcard updated!", duration: 2, display: 'success' });
                setTimeout(closeWindow, 500);
            } catch (err) {

                t.alert({ message: "Update failed.", display: 'error' });
            }
        }
    };

    if (!t || loading) return <div className="loading-state" style={{ color: 'white' }}>Loading options...</div>;

    const COLORS = {
        background: '#242528',
        cardItem: '#2c333a',
        textMain: '#ffffff',
        textDim: '#8c9bab',
        border: '#38414a'
    };

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
                                <div className="bg-picker-grid" style={{ width: '320px', maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                                        {BACKGROUNDS.map((b, i) => (
                                            <div key={i} className="bg-option" style={{
                                                backgroundColor: b.type === 'color' ? (b.hex || b.value) : '#ccc',
                                                backgroundImage: b.type === 'image' ? `url(${b.value})` : 'none',
                                                backgroundSize: 'cover',
                                                height: '40px'
                                            }} onClick={() => { setBg(b); setShowBgPicker(false); }}></div>
                                        ))}
                                    </div>

                                    <div style={{ borderTop: '1px solid #383b45', paddingTop: '10px' }}>
                                        <label style={{ fontSize: '12px', color: '#9fadbc', marginBottom: '5px', display: 'block' }}>UNSPLASH</label>
                                        <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
                                            <input
                                                type="text"
                                                className="dark-input"
                                                style={{ padding: '6px', fontSize: '12px' }}
                                                placeholder="Search photos..."
                                                value={unsplashQuery}
                                                onChange={(e) => setUnsplashQuery(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleUnsplashSearch()}
                                            />
                                            <button className="btn btn-primary" style={{ padding: '6px 10px', fontSize: '12px' }} onClick={handleUnsplashSearch} disabled={isSearchingUnsplash}>
                                                Go
                                            </button>
                                        </div>

                                        {unsplashImages.length > 0 && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                                                {unsplashImages.map((img) => (
                                                    <div key={img.id} className="bg-option" style={{
                                                        backgroundImage: `url(${img.thumb})`,
                                                        backgroundSize: 'cover',
                                                        height: '60px',
                                                        borderRadius: '4px'
                                                    }} onClick={() => {
                                                        setBg({ type: 'image', value: img.url });
                                                        setShowBgPicker(false);
                                                    }}></div>
                                                ))}
                                            </div>
                                        )}
                                        {unsplashImages.length === 0 && !isSearchingUnsplash && unsplashQuery && (
                                            <div style={{ fontSize: '12px', color: '#9fadbc', textAlign: 'center' }}>No results</div>
                                        )}
                                    </div>
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

                    {creationMode && (
                        <div className="dark-input-group">
                            <label>Create Dashcard In</label>

                            <select
                                className="dark-select"
                                value={targetListId}
                                onChange={(e) => setTargetListId(e.target.value)}
                            >
                                {Array.isArray(lists) &&
                                    lists.map(l => (
                                        <option key={l.id} value={l.id}>
                                            {l.name}
                                        </option>
                                    ))}
                            </select>
                        </div>
                    )}

                    <div className="dark-input-group">
                        <label>Filter By List</label>

                        <select
                            className="dark-select"
                            value={filters.listId}
                            onChange={(e) =>
                                setFilters({
                                    ...filters,
                                    listId: e.target.value
                                })
                            }
                        >
                            <option value="any">Any list</option>

                            {Array.isArray(lists) &&
                                lists.map(l => (
                                    <option key={l.id} value={l.id}>
                                        {l.name}
                                    </option>
                                ))}
                        </select>
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
                        <div style={{ display: 'grid', gap: '8px' }}>
                            {matchedCards.length > 0 ? (
                                matchedCards.map(card => (
                                    <div key={card.id} style={{
                                        background: COLORS.cardItem,
                                        border: `1px solid ${COLORS.border}`,
                                        padding: '10px',
                                        borderRadius: '3px',
                                        cursor: 'pointer',
                                        borderLeft: `3px solid '#0079bf'`,
                                    }}
                                        onClick={() => t.showCard(card.id)}
                                    >
                                        <div style={{ fontSize: '14px', color: COLORS.textMain, fontWeight: '500' }}>
                                            {card.name}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div style={{
                                    padding: '20px',
                                    textAlign: 'center',
                                    color: COLORS.textDim,
                                    fontSize: '13px',
                                    border: `1px dashed ${COLORS.border}`,
                                    borderRightColor: '#00a0fdff',
                                }}>
                                    No cards currently match filters
                                </div>
                            )}
                        </div>
                    </ul>
                </div>

            </div>

            <div className="popup-footer">
                <button className="btn btn-primary" onClick={saveConfiguration}>Start tracking</button>
            </div>
        </div>
    );
}
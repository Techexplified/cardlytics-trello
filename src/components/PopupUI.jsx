import React, { useEffect, useState } from "react";
import { APP_KEY, BACKGROUNDS } from "../utils/constants";
import { searchUnsplashPhotos } from "../utils/unsplashApi";
import { createCompositeImage } from "../utils/helpers";

export default function PopupUI() {
    const t = window.TrelloPowerUp ? window.TrelloPowerUp.iframe() : null;

    const [name, setName] = useState("Dashcard");
    const [bg, setBg] = useState(BACKGROUNDS[0]);
    const [showBgPicker, setShowBgPicker] = useState(false);

    const DEFAULT_FILTERS = {
        listId: "any",
        memberId: "any",
        labelId: "any"
    };

    const [filters, setFilters] = useState(DEFAULT_FILTERS);

    const [previewCount, setPreviewCount] = useState(0);
    const [matchedCards, setMatchedCards] = useState([]);

    const [lists, setLists] = useState([]);
    const [labels, setLabels] = useState([]);
    const [members, setMembers] = useState([]);

    const [loading, setLoading] = useState(true);

    const creationMode = true;

    const [targetListId, setTargetListId] = useState("");

    const [unsplashQuery, setUnsplashQuery] = useState("");
    const [unsplashImages, setUnsplashImages] = useState([]);
    const [isSearchingUnsplash, setIsSearchingUnsplash] = useState(false);

    const handleUnsplashSearch = async () => {
        if (!unsplashQuery) return;

        setIsSearchingUnsplash(true);

        try {
            const images = await searchUnsplashPhotos(unsplashQuery);
            setUnsplashImages(images || []);
        } catch (err) {
            console.error(err);
        }

        setIsSearchingUnsplash(false);
    };

    useEffect(() => {
        if (!t) return;

        document.body.classList.add("popup-window");

        const init = async () => {
            try {
                const [boardLists, boardLabels, boardMembers] =
                    await Promise.all([
                        t.lists("all"),
                        t.board("labels"),
                        t.board("members")
                    ]);

                setLists(boardLists || []);

                if (Array.isArray(boardLabels?.labels)) {
                    setLabels(boardLabels.labels);
                } else if (Array.isArray(boardLabels?.Labels)) {
                    setLabels(boardLabels.Labels);
                } else if (Array.isArray(boardLabels)) {
                    setLabels(boardLabels);
                }

                if (Array.isArray(boardMembers?.members)) {
                    setMembers(boardMembers.members);
                } else if (Array.isArray(boardMembers)) {
                    setMembers(boardMembers);
                }

                if (
                    creationMode &&
                    boardLists &&
                    boardLists.length > 0
                ) {
                    setTargetListId(boardLists[0].id);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [t]);

    useEffect(() => {
        if (!t) return;

        const calculateActiveCount = async () => {
            try {
                const allCards = await t.cards("all");

                if (!Array.isArray(allCards)) return;

                const matched = allCards.filter((card) => {
                    if (card.closed) return false;

                    if (
                        filters.listId !== "any" &&
                        card.idList !== filters.listId
                    ) {
                        return false;
                    }

                    if (filters.memberId !== "any") {
                        if (
                            !card.idMembers ||
                            !card.idMembers.includes(filters.memberId)
                        ) {
                            return false;
                        }
                    }

                    if (filters.labelId !== "any") {
                        if (
                            !card.idLabels ||
                            !card.idLabels.includes(filters.labelId)
                        ) {
                            return false;
                        }
                    }

                    return true;
                });

                setPreviewCount(matched.length);
                setMatchedCards(matched);
            } catch (err) {
                console.error(err);
            }
        };

        const debounce = setTimeout(calculateActiveCount, 300);

        return () => clearTimeout(debounce);
    }, [filters, t]);

    const authorizeUser = async () => {
        try {
            const token = await t.authorize(
                "https://trello.com/1/authorize?" +
                new URLSearchParams({
                    expiration: "never",
                    name: "Dashcard",
                    scope: "read,write",
                    response_type: "token",
                    key: APP_KEY,
                    return_url: `${window.location.origin}/auth.html`
                }).toString()
            );

            if (token) {
                localStorage.setItem("trello_token", token);
            }

            return token;
        } catch (err) {
            console.error(err);
            return null;
        }
    };

    const uploadCover = async (
        cardId,
        token
    ) => {
        try {
            const blob = await createCompositeImage(
                bg,
                previewCount,
                name
            );

            const formData = new FormData();

            formData.append("file", blob, "cover.png");

            const uploadResponse = await fetch(
                `https://api.trello.com/1/cards/${cardId}/attachments?key=${APP_KEY}&token=${token}`,
                {
                    method: "POST",
                    body: formData
                }
            );

            const attachData = await uploadResponse.json();

            await fetch(
                `https://api.trello.com/1/cards/${cardId}?key=${APP_KEY}&token=${token}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        cover: {
                            idAttachment: attachData.id,
                            size: "full",
                            brightness: "dark"
                        }
                    })
                }
            );
        } catch (err) {
            console.error(err);
        }
    };

    const saveConfiguration = async () => {
        if (!t) return;

        if (!targetListId) {
            t.alert({
                message: "Please select a destination list",
                display: "warning"
            });

            return;
        }

        try {
            let token =
                localStorage.getItem("trello_token");

            if (!token) {
                token = await authorizeUser();
            }

            if (!token) {
                t.alert({
                    message: "Authorization failed",
                    display: "error"
                });

                return;
            }

            const createResponse = await fetch(
                `https://api.trello.com/1/cards?idList=${targetListId}&name=${encodeURIComponent(
                    name || "Dashcard"
                )}&pos=top&key=${APP_KEY}&token=${token}`,
                {
                    method: "POST"
                }
            );

            if (!createResponse.ok) {
                const errorText =
                    await createResponse.text();

                console.error(errorText);

                t.alert({
                    message: "Failed to create card",
                    display: "error"
                });

                return;
            }

            const newCard =
                await createResponse.json();

            console.log("CARD CREATED:", newCard);

            const config = {
                ...filters,
                name,
                background: bg,
                cardId: newCard.id,
                lastCount: previewCount
            };

            const descPayload =
                `DASHCARD_CONFIG|${JSON.stringify(
                    config
                )}`;

            await fetch(
                `https://api.trello.com/1/cards/${newCard.id}?key=${APP_KEY}&token=${token}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        desc: descPayload
                    })
                }
            );

            await uploadCover(newCard.id, token);

            t.alert({
                message: `Dashcard "${name}" created!`,
                display: "success"
            });

            setTimeout(() => {
                try {
                    t.closePopup();
                } catch (e) {
                    console.error(e);
                }
            }, 1000);

        } catch (err) {
            console.error(err);

            t.alert({
                message: "Error creating Dashcard",
                display: "error"
            });
        }
    };

    if (!t || loading) {
        return (
            <div
                style={{
                    color: "white",
                    padding: "20px"
                }}
            >
                Loading...
            </div>
        );
    }

    const COLORS = {
        background: "#242528",
        cardItem: "#2c333a",
        textMain: "#ffffff",
        textDim: "#8c9bab",
        border: "#38414a"
    };

    return (
        <div className="dashcard-popup">
            <div className="popup-body">

                <div className="top-section">

                    <div className="preview-section">
                        <div
                            className="preview-card"
                            style={{
                                backgroundColor:
                                    bg.type === "color"
                                        ? (bg.hex || "#0079bf")
                                        : "#0065ff",

                                backgroundImage:
                                    bg.type === "image"
                                        ? `url(${bg.value})`
                                        : "none"
                            }}
                        >
                            <div className="preview-count">
                                {previewCount}
                            </div>

                            <div className="preview-label">
                                {name || "Dashcard"}
                            </div>
                        </div>
                    </div>

                    <div className="basic-config-section">

                        <div className="dark-input-group">
                            <label>NAME</label>

                            <input
                                type="text"
                                className="dark-input"
                                value={name}
                                onChange={(e) =>
                                    setName(e.target.value)
                                }
                            />
                        </div>

                        <div
                            className="dark-input-group"
                            style={{ position: "relative" }}
                        >
                            <label>APPEARANCE</label>

                            <div
                                className="bg-button"
                                onClick={() =>
                                    setShowBgPicker(
                                        !showBgPicker
                                    )
                                }
                            >
                                Change background
                            </div>

                            {showBgPicker && (
                                <div
                                    className="bg-picker-grid"
                                    style={{
                                        width: "320px",
                                        background: "#1f2229",
                                        border: "1px solid #383b45",
                                        borderRadius: "6px",
                                        padding: "12px"
                                    }}
                                >

                                    {/* COLOR GRID */}
                                    <div
                                        style={{
                                            display: "grid",
                                            gridTemplateColumns: "repeat(5, 1fr)",
                                            gap: "8px",
                                            marginBottom: "12px"
                                        }}
                                    >
                                        {BACKGROUNDS.map((b, i) => (
                                            <div
                                                key={i}
                                                className="bg-option"
                                                style={{
                                                    backgroundColor:
                                                        b.type === "color"
                                                            ? (b.hex || b.value)
                                                            : "#ccc",

                                                    backgroundImage:
                                                        b.type === "image"
                                                            ? `url(${b.value})`
                                                            : "none",

                                                    backgroundSize: "cover",
                                                    backgroundPosition: "center",
                                                    height: "42px",
                                                    borderRadius: "4px",
                                                    cursor: "pointer"
                                                }}
                                                onClick={() => {
                                                    setBg(b);
                                                    setShowBgPicker(false);
                                                }}
                                            />
                                        ))}
                                    </div>

                                    {/* UNSPLASH LABEL */}
                                    <div
                                        style={{
                                            borderTop: "1px solid #383b45",
                                            paddingTop: "10px"
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: "12px",
                                                color: "#9fadbc",
                                                marginBottom: "8px",
                                                fontWeight: 500
                                            }}
                                        >
                                            UNSPLASH
                                        </div>

                                        {/* SEARCH ROW */}
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "6px"
                                            }}
                                        >
                                            <input
                                                type="text"
                                                className="dark-input"
                                                placeholder="Search photos..."
                                                value={unsplashQuery}
                                                onChange={(e) =>
                                                    setUnsplashQuery(e.target.value)
                                                }
                                                onKeyDown={(e) =>
                                                    e.key === "Enter" &&
                                                    handleUnsplashSearch()
                                                }
                                                style={{
                                                    flex: 1,
                                                    height: "32px",
                                                    fontSize: "12px",
                                                    padding: "0 10px"
                                                }}
                                            />

                                            <button
                                                className="btn btn-primary"
                                                onClick={handleUnsplashSearch}
                                                disabled={isSearchingUnsplash}
                                                style={{
                                                    height: "32px",
                                                    padding: "0 14px",
                                                    fontSize: "12px",
                                                    whiteSpace: "nowrap"
                                                }}
                                            >
                                                Go
                                            </button>
                                        </div>

                                        {/* RESULTS */}
                                        {unsplashImages.length > 0 && (
                                            <div
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns:
                                                        "repeat(3, 1fr)",
                                                    gap: "8px",
                                                    marginTop: "10px"
                                                }}
                                            >
                                                {unsplashImages.map((img) => (
                                                    <div
                                                        key={img.id}
                                                        className="bg-option"
                                                        style={{
                                                            backgroundImage:
                                                                `url(${img.thumb})`,
                                                            backgroundSize: "cover",
                                                            backgroundPosition: "center",
                                                            height: "60px",
                                                            borderRadius: "4px",
                                                            cursor: "pointer"
                                                        }}
                                                        onClick={() => {
                                                            setBg({
                                                                type: "image",
                                                                value: img.url
                                                            });

                                                            setShowBgPicker(false);
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                        )}

                                        {/* EMPTY STATE */}
                                        {unsplashImages.length === 0 &&
                                            !isSearchingUnsplash &&
                                            unsplashQuery && (
                                                <div
                                                    style={{
                                                        fontSize: "12px",
                                                        color: "#9fadbc",
                                                        textAlign: "center",
                                                        marginTop: "10px"
                                                    }}
                                                >
                                                    No results
                                                </div>
                                            )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="filter-section">

                    <div className="dark-input-group">
                        <label>Create Dashcard In</label>

                        <select
                            className="dark-select"
                            value={targetListId}
                            onChange={(e) =>
                                setTargetListId(
                                    e.target.value
                                )
                            }
                        >
                            {lists.map((l) => (
                                <option
                                    key={l.id}
                                    value={l.id}
                                >
                                    {l.name}
                                </option>
                            ))}
                        </select>
                    </div>

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
                            <option value="any">
                                Any list
                            </option>

                            {lists.map((l) => (
                                <option
                                    key={l.id}
                                    value={l.id}
                                >
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
                                setFilters({
                                    ...filters,
                                    memberId: e.target.value
                                })
                            }
                        >
                            <option value="any">
                                Any member
                            </option>

                            {members.map((m) => (
                                <option
                                    key={m.id}
                                    value={m.id}
                                >
                                    {m.fullName}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="dark-input-group">
                        <label>Labels</label>

                        <select
                            className="dark-select"
                            value={filters.labelId}
                            onChange={(e) =>
                                setFilters({
                                    ...filters,
                                    labelId: e.target.value
                                })
                            }
                        >
                            <option value="any">
                                Any label
                            </option>

                            {labels.map((l) => (
                                <option
                                    key={l.id}
                                    value={l.id}
                                >
                                    {l.name} ({l.color})
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div
                    className="matched-cards-section"
                    style={{
                        marginTop: "20px"
                    }}
                >
                    <h4
                        style={{
                            color: "white"
                        }}
                    >
                        Matched Cards ({matchedCards.length})
                    </h4>

                    <div
                        style={{
                            display: "grid",
                            gap: "8px",
                            maxHeight: "150px",
                            overflowY: "auto"
                        }}
                    >
                        {matchedCards.map((card) => (
                            <div
                                key={card.id}
                                style={{
                                    background: COLORS.cardItem,
                                    border: `1px solid ${COLORS.border}`,
                                    padding: "10px",
                                    borderRadius: "4px",
                                    color: "white"
                                }}
                            >
                                {card.name}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="popup-footer">
                <button
                    className="btn btn-primary"
                    onClick={saveConfiguration}
                >
                    Start tracking
                </button>
            </div>
        </div>
    );
}
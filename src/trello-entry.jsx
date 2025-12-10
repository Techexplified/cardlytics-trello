import React, { useEffect, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const TrelloPowerUp = window.TrelloPowerUp;
const DEPLOY_URL = "https://localhost:4173";
const APP_KEY = '0919ce48a7f8507be8f698a755ffeda';

// Helper to detect context - Defined at top level for use in components
const isPopup = typeof document !== 'undefined' && (!!document.getElementById("trello-popup-root") || window.location.pathname.includes("popup.html"));
const isDashboard = typeof document !== 'undefined' && (!!document.getElementById("trello-dashboard-root") || window.location.pathname.includes("dashboard.html"));
const isSettings = typeof document !== 'undefined' && (!!document.getElementById("trello-settings-root") || window.location.pathname.includes("settings.html"));
const isModal = typeof window !== 'undefined' && window.location.search.includes("mode=");
const isConnector = !isPopup && !isDashboard && !isModal && !isSettings;

const BACKGROUNDS = [
	{ type: 'color', value: 'blue', name: 'Blue', hex: '#0079bf' },
	{ type: 'color', value: 'orange', name: 'Orange', hex: '#d29034' },
	{ type: 'color', value: 'green', name: 'Green', hex: '#519839' },
	{ type: 'color', value: 'red', name: 'Red', hex: '#b04632' },
	{ type: 'color', value: 'purple', name: 'Purple', hex: '#89609e' },
	{ type: 'color', value: 'pink', name: 'Pink', hex: '#cd5a91' },
	{ type: 'color', value: 'sky', name: 'Sky', hex: '#00aecc' },
	{ type: 'color', value: 'lime', name: 'Lime', hex: '#4bbf6b' },
	{ type: 'color', value: 'yellow', name: 'Yellow', hex: '#f2d600' },
	{ type: 'color', value: 'black', name: 'Black', hex: '#091e42' },
	{ type: 'image', value: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=80', name: 'Business' },
	{ type: 'image', value: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1000&q=80', name: 'Tech' },
	{ type: 'image', value: 'https://images.unsplash.com/photo-1493934558415-9d19f0b2b4d2?auto=format&fit=crop&w=1000&q=80', name: 'Creative' },
	{ type: 'image', value: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1000&q=80', name: 'Gradient' },
	{ type: 'image', value: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1000&q=80', name: 'Sea' },
];

async function calculateMatchCount(t) {
	const criteria = await t.get('card', 'shared', 'dashFilter');
	if (!criteria) return { text: '', color: null, count: 0 };

	try {
		const allCards = await t.board('all').get('cards', 'all');
		if (!Array.isArray(allCards)) return { text: '', color: null, count: 0 };

		const me = await t.member('id');
		const now = new Date();

		const matchedCards = allCards.filter(card => {
			if (card.closed) return false;
			if (criteria.listId && criteria.listId !== 'any' && card.idList !== criteria.listId) return false;
			if (criteria.memberId && criteria.memberId !== 'any') {
				if (criteria.memberId === 'me') {
					if (!card.idMembers || !card.idMembers.includes(me)) return false;
				} else if (!card.idMembers || !card.idMembers.includes(criteria.memberId)) return false;
			}
			if (criteria.labelId && criteria.labelId !== 'any' && (!card.idLabels || !card.idLabels.includes(criteria.labelId))) return false;
			if (criteria.due && criteria.due !== 'any') {
				if (!card.due) return false;
				const dueDate = new Date(card.due);
				const isComplete = card.dueComplete;
				if (criteria.due === 'overdue') {
					if (dueDate >= now || isComplete) return false;
				} else if (criteria.due === 'week') {
					const nextWeek = new Date();
					nextWeek.setDate(now.getDate() + 7);
					if (dueDate < now || dueDate > nextWeek || isComplete) return false;
				}
			}
			return true;
		});

		const count = matchedCards.length;
		return { text: count.toString(), color: null, count };
	} catch (error) {
		console.error("Error calculating match count:", error);
		return { text: 'Err', count: 0 };
	}
}

function getUrlParam(name) {
	if (typeof window === "undefined") return null;
	const params = new URLSearchParams(window.location.search);
	return params.get(name);
}

function PopupUI() {
	const t = window.TrelloPowerUp ? window.TrelloPowerUp.iframe() : null;
	const [name, setName] = useState("Dashcard");
	const [bg, setBg] = useState(BACKGROUNDS[0]); // Default to first (Blue)
	const [showBgPicker, setShowBgPicker] = useState(false);
	const [filters, setFilters] = useState({ listId: 'any', memberId: 'any', labelId: 'any', due: 'any' });
	const [previewCount, setPreviewCount] = useState(0);
	const [lists, setLists] = useState([]);
	const [labels, setLabels] = useState([]);
	const [members, setMembers] = useState([]);
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

				if (!creationMode) {
					const storedFilter = await t.get('card', 'shared', 'dashFilter');
					if (storedFilter) {
						setFilters(storedFilter);
						if (storedFilter.name) setName(storedFilter.name);
						if (storedFilter.background) {
							// Ensure stored background matches current schema
							const b = storedFilter.background;
							// If it's a legacy hex string, try to match it
							if (typeof b === 'string') {
								const matched = BACKGROUNDS.find(x => x.hex === b || x.value === b);
								setBg(matched || BACKGROUNDS[0]);
							} else if (b.value) {
								const matched = BACKGROUNDS.find(x => x.value === b.value || x.hex === b.value);
								setBg(matched || b);
							}
						}
					}
				}

				setLists(boardLists || []);
				setLabels(boardLabels || []);
				setMembers(boardMembers || []);

				if (creationMode && boardLists && boardLists.length > 0) {
					setTargetListId(boardLists[0].id);
				}
			} catch (error) {
				console.error("Failed to fetch data:", error);
			} finally {
				setLoading(false);
			}
		};
		init();
	}, [t, creationMode]);

	useEffect(() => {
		if (!t || loading) return;
		const calculateActiveCount = async () => {
			try {
				const allCards = await t.board('all').get('cards', 'all');
				if (!Array.isArray(allCards)) return;

				const me = await t.member('id');
				const now = new Date();
				const matched = allCards.filter(card => {
					if (card.closed) return false;
					if (filters.listId && filters.listId !== 'any' && card.idList !== filters.listId) return false;
					if (filters.memberId && filters.memberId !== 'any') {
						if (filters.memberId === 'me') {
							if (!card.idMembers || !card.idMembers.includes(me)) return false;
						} else if (!card.idMembers || !card.idMembers.includes(filters.memberId)) return false;
					}
					if (filters.labelId && filters.labelId !== 'any' && (!card.idLabels || !card.idLabels.includes(filters.labelId))) return false;
					if (filters.due && filters.due !== 'any') {
						if (!card.due) return false;
						const d = new Date(card.due);
						if (filters.due === 'overdue' && (d >= now || card.dueComplete)) return false;
						if (filters.due === 'week') {
							const next = new Date(); next.setDate(now.getDate() + 7);
							if (d < now || d > next || card.dueComplete) return false;
						}
					}
					return true;
				});
				setPreviewCount(matched.length);
			} catch (e) {
				console.error("Live preview error", e);
			}
		};
		const debounce = setTimeout(calculateActiveCount, 500);
		return () => clearTimeout(debounce);
	}, [filters, lists, loading, t]);

	const saveConfiguration = async () => {
		if (!t) return;

		// Helper to close window
		const closeWindow = () => {
			try { t.closeModal(); } catch (e) {
				try { t.closePopup(); } catch (e2) { /* ignore */ }
			}
		};

		if (creationMode) {
			// --- CREATION MODE (Board Button) ---
			if (!targetListId) {
				t.alert({ message: "Please select a destination list.", duration: 3, display: 'warning' });
				return;
			}

			// We need to create a new card first to apply settings
			try {
				const newCard = await t.createCard(targetListId, {
					name: name || "Dashcard",
					pos: 'top'
				});

				// Now try to set the context on that new card (Tricky from board button, usually we just alert user)
				// Since we can't easily set context on a remote card from here without more scope,
				// we'll guide the user.
				// ACTUALLY: Basic Power-Ups can't easily write to *other* cards' pluginData from a board button context 
				// without advanced scopes or storing in board shared data referencing the card.
				// For this simplified version, we just create the card. The user has to click "Track" on it.
				// BUT: The user expects it to work.
				// Workaround: We can't automatically 'convert' the remote card from here easily.
				t.alert({
					message: `Dashcard "${name}" created! Open it and click "Track" to activate filters.`,
					duration: 6,
					display: 'success'
				});
				setTimeout(() => closeWindow(), 1000);
			} catch (e) {
				console.error("Creation Error", e);
				t.alert({ message: "Error creating card", display: 'error' });
			}
		} else {
			// --- EDIT MODE (Card Button) ---
			try {
				// 1. Save Power-Up Data
				const config = { ...filters, name, background: bg };
				await t.set('card', 'shared', 'dashFilter', config);
				await t.set('card', 'shared', 'isDashCard', true);

				// 2. Update Card Name
				if (name) {
					// We are contextually on the card, so this works
					await t.card('name', name).catch(e => console.warn("Rename failed", e));
				}

				// 3. Update Card Cover (STRICT TRELLO COLORS)
				try {
					const validTrelloColors = ['blue', 'orange', 'green', 'red', 'purple', 'pink', 'sky', 'lime', 'yellow', 'black'];

					if (bg.type === 'color') {
						// Ensure we use the 'value' which should be the color name
						let colorName = bg.value;

						// Safety check: if by some legacy reason it's a hex, try to map it
						if (!validTrelloColors.includes(colorName)) {
							// Try to find by hex
							const found = BACKGROUNDS.find(b => b.hex === colorName || b.value === colorName);
							if (found && validTrelloColors.includes(found.value)) {
								colorName = found.value;
							} else {
								colorName = 'blue'; // Fallback
							}
						}

						await t.card('cover', {
							color: colorName,
							size: 'full',
							brightness: 'dark' // Ensures white text title
						});
					} else if (bg.type === 'image') {
						if (bg.value.startsWith('http')) {
							await t.card('cover', {
								url: bg.value,
								size: 'full',
								brightness: 'dark'
							});
						}
					}
				} catch (coverError) {
					console.warn("Could not set card cover:", coverError);
				}

				// Show success message
				t.alert({ message: "Dashcard updated!", duration: 2, display: 'success' });
				setTimeout(closeWindow, 500);

			} catch (saveError) {
				console.error("Save Error", saveError);
				t.alert({ message: "Failed to save settings.", display: 'error' });
			}
		}
	};

	// Deprecated helper - logic is now direct
	const getTrelloColorName = (hex) => {
		const preset = BACKGROUNDS.find(b => b.hex === hex || b.value === hex);
		return preset ? preset.value : 'blue';
	};

	if (!t || loading) return <div className="loading-state" style={{ color: 'white' }}>Loading options...</div>;

	return (
		<div className="dashcard-popup">
			<div className="popup-body">

				{/* TOP SECTION: Preview & Basic Config */}
				<div className="top-section">
					{/* LEFT: Preview */}
					<div className="preview-section">
						<div className="preview-card" style={{
							backgroundColor: bg.type === 'color' ? (bg.hex || '#0079bf') : '#0065ff',
							backgroundImage: bg.type === 'image' ? `url(${bg.value})` : 'none'
						}}>
							<div className="preview-count">{previewCount}</div>
							<div className="preview-label">{name || 'Dashcard'}</div>
						</div>
					</div>

					{/* RIGHT: Name & Appearance */}
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

					{/* Row 1: Board & List */}
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
							<select className="dark-select" value="any" disabled>
								<option>any</option>
							</select>
						)}
					</div>

					{/* Row 2: Assigned & Due */}
					<div className="dark-input-group">
						<label>Assigned</label>
						<select className="dark-select" value={filters.memberId} onChange={(e) => setFilters({ ...filters, memberId: e.target.value })}>
							<option value="any">Any member</option>
							<option value="me">Assigned to me</option>
							{Array.isArray(members) && members.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
						</select>
					</div>

					<div className="dark-input-group">
						<label>clock Due</label>
						<select className="dark-select" value={filters.due} onChange={(e) => setFilters({ ...filters, due: e.target.value })}>
							<option value="any">Any time</option>
							<option value="overdue">Overdue</option>
							<option value="week">Due within a week</option>
						</select>
					</div>

					{/* Row 3: Labels */}
					<div className="dark-input-group">
						<label>Labels</label>
						<select className="dark-select" value={filters.labelId} onChange={(e) => setFilters({ ...filters, labelId: e.target.value })}>
							<option value="any">select</option>
							{Array.isArray(labels) && labels.map(l => <option key={l.id} value={l.id}>{l.name} ({l.color})</option>)}
						</select>
					</div>
				</div>

			</div>

			<div className="popup-footer">
				<button className="btn btn-secondary" onClick={() => t.closePopup()}>Cancel</button>
				<button className="btn btn-primary" onClick={saveConfiguration}>Start tracking</button>
			</div>
		</div>
	);
}

function DashboardUI() {
	const t = window.TrelloPowerUp ? window.TrelloPowerUp.iframe() : null;
	const [matches, setMatches] = useState([]);
	const [loading, setLoading] = useState(true);
	const [isDashContext, setIsDashContext] = useState(false);

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

						const me = await t.member('id');
						const now = new Date();
						const filtered = allCards.filter(card => {
							if (card.closed) return false;
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
			} catch (e) { console.log("Error", e); } finally { setLoading(false); }
		};
		fetchContext();

		// Auto-resize
		t.sizeTo('#trello-dashboard-root').catch(() => { });
	}, [t]);

	if (loading) return <div className="loading-state">Loading...</div>;

	if (isDashContext) {
		return (
			<div style={{ padding: 12 }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
					<h3 style={{ margin: 0 }}>Matched Cards ({matches.length})</h3>
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





// STRICTLY only initialize capabilities in the connector.
if (isConnector && typeof window !== "undefined" && window.TrelloPowerUp) {
	window.TrelloPowerUp.initialize({
		"card-buttons": function (t) {
			return [{
				icon: 'https://cdn-icons-png.flaticon.com/512/3208/3208726.png',
				text: "Track with Dashcard",
				callback: function (t) {
					return t.modal({ title: "Dashcard", url: `${DEPLOY_URL}/popup.html?mode=edit`, height: 700 });
				},
			}];
		},
		"card-badges": function (t) {
			return t.get('card', 'shared', 'dashFilter')
				.then(filter => {
					if (!filter) return [];
					return [{
						dynamic: function () {
							return calculateMatchCount(t)
								.then(result => ({ title: 'Dashcard', text: result.text, color: 'light-gray', refresh: 10 }))
								.catch(() => ({ text: '?' }));
						}
					}];
				})
				.catch(() => []);
		},
		"card-back-section": function (t) {
			return {
				title: 'Dashcard Actions',
				icon: 'https://cdn-icons-png.flaticon.com/512/3208/3208726.png',
				content: {
					type: 'iframe',
					url: t.signUrl(`${DEPLOY_URL}/dashboard.html`),
					height: 300
				}
			};
		},

		"board-buttons": function (t) {
			return [{
				icon: {
					dark: "https://icon.icepanel.io/Technology/svg/Trello.svg",
					light: "https://icon.icepanel.io/Technology/svg/Trello.svg"
				},
				text: "Create Dashcard",
				callback: function (t) {
					return t.modal({
						title: "Dashcard",
						url: `${DEPLOY_URL}/popup.html?mode=create`,
						height: 700
					});
				}
			}];
		},
		"show-settings": function (t) {
			return t.popup({
				title: 'Dashcard Settings',
				url: `${DEPLOY_URL}/settings.html`,
				height: 184
			});
		}
	});
}

function mount() {
	if (isConnector) return;

	// Re-check DOM elements inside mount ensuring they exist
	const popupRoot = document.getElementById("trello-popup-root");
	const dashboardRoot = document.getElementById("trello-dashboard-root");

	// Check URL params for mode
	const params = new URLSearchParams(window.location.search);
	const mode = params.get('mode');

	if (popupRoot || document.getElementById("root") || mode || window.location.href.includes("popup.html") || isSettings) {
		const rootEl = popupRoot || document.getElementById("root") || document.body;

		// Ensure we clear previous content if using body
		if (rootEl === document.body) {
			// Create a container if none exists
			let container = document.getElementById('app-container');
			if (!container) {
				container = document.createElement('div');
				container.id = 'app-container';
				document.body.appendChild(container);
			}
		}

		const target = document.getElementById('app-container') || rootEl;



		if (dashboardRoot) {
			createRoot(dashboardRoot).render(<DashboardUI />);
		} else {
			// Default is PopupUI (Create/Edit)
			createRoot(target).render(<PopupUI />);
		}
	}
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', mount); } else { mount(); }

export default TrelloPowerUp;
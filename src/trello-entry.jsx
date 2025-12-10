import React, { useEffect, useState, useMemo } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const TrelloPowerUp = window.TrelloPowerUp;
const DEPLOY_URL = "https://localhost:4173";
const APP_KEY = '0919ce48a7f8507be8f698a755ffeda';

const BACKGROUNDS = [
	{ type: 'color', value: '#0079bf', name: 'Blue' },
	{ type: 'color', value: '#d29034', name: 'Orange' },
	{ type: 'color', value: '#519839', name: 'Green' },
	{ type: 'color', value: '#b04632', name: 'Red' },
	{ type: 'color', value: '#89609e', name: 'Purple' },
	{ type: 'image', value: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=80', name: 'Business' },
	{ type: 'image', value: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=400&q=80', name: 'Tech' },
	{ type: 'image', value: 'https://images.unsplash.com/photo-1493934558415-9d19f0b2b4d2?auto=format&fit=crop&w=400&q=80', name: 'Creative' },
	{ type: 'image', value: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=400&q=80', name: 'Gradient' },
	{ type: 'image', value: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=400&q=80', name: 'Sea' },
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
	const [bg, setBg] = useState(BACKGROUNDS[0]);
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
						if (storedFilter.background) setBg(storedFilter.background);
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

		if (creationMode) {
			// --- CREATION MODE (Board Button) ---
			// We cannot access card context here. We simulate creation.
			if (!targetListId) {
				t.alert({ message: "Please select a destination list.", duration: 3, display: 'warning' });
				return;
			}

			try {
				// Simulated Creation
				t.alert({
					message: `Dashcard "${name}" created in list "${lists.find(l => l.id === targetListId)?.name || 'Selected List'}". (Simulated)`,
					duration: 5,
					display: 'success'
				});
				// Close popup after a short delay to let user read message
				setTimeout(() => {
					t.closePopup();
				}, 1500);
			} catch (e) {
				console.error("Creation Error", e);
				t.alert({ message: "Error simulation failed.", display: 'error' });
			}
		} else {
			// --- EDIT MODE (Card Button) ---
			// We have a card context. We save data.
			try {
				const config = { ...filters, name, background: bg };

				// 1. Save Power-Up Data
				await t.set('card', 'shared', 'dashFilter', config);
				await t.set('card', 'shared', 'isDashCard', true);

				// 2. Update Card Name
				if (name) {
					try {
						await t.card('name', name);
					} catch (e) {
						console.warn("Could not set card name:", e);
					}
				}

				// 3. Update Card Cover
				try {
					if (bg.type === 'color') {
						const colorName = getTrelloColorName(bg.value) || 'blue';
						await t.card('cover', { color: colorName, size: 'full' });
					} else if (bg.type === 'image') {
						if (bg.value.startsWith('http')) {
							await t.card('cover', { url: bg.value, size: 'full' });
						} else {
							// If not a valid URL (e.g. data URI), Trello might reject it for cover.
							// We skip or user sees warning.
						}
					}
				} catch (coverError) {
					console.warn("Could not set card cover. Trello may strictly validate URLs.", coverError);
				}

				t.closePopup();
			} catch (saveError) {
				console.error("Save Error", saveError);
				t.alert({ message: "Failed to save settings. Please try again.", display: 'error' });
			}
		}
	};

	const getTrelloColorName = (hex) => {
		const preset = BACKGROUNDS.find(b => b.value === hex);
		return preset ? preset.name.toLowerCase() : 'blue';
	};

	if (!t || loading) return <div className="loading-state" style={{ color: 'white' }}>Loading options...</div>;

	return (
		<div className="dashcard-popup">
			<div className="popup-header">
				<h3>Dashcards — Track</h3>
				<div style={{ cursor: 'pointer' }} onClick={() => t.closePopup()}>✕</div>
			</div>

			{/* Body */}
			<div className="popup-body">

				{/* TOP SECTION: Preview & Basic Config */}
				<div className="top-section">
					{/* LEFT: Preview */}
					<div className="preview-section">
						<div className="preview-card" style={{
							backgroundColor: bg.type === 'color' ? bg.value : '#0065ff',
							backgroundImage: bg.type === 'image' ? `url(${bg.value})` : 'none'
						}}>
							<div className="preview-count">{previewCount}</div>
							<div className="preview-label">{name || 'Dashcard'}</div>
						</div>
					</div>

					{/* RIGHT: Name & Appearance */}
					<div className="basic-config-section">
						<div className="dark-input-group">
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
											backgroundColor: b.type === 'color' ? b.value : '#ccc',
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
						<label>⚏ Board</label>
						<select className="dark-select" disabled>
							<option>any</option>
						</select>
					</div>

					<div className="dark-input-group">
						<label>⚏ List</label>
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
						<label>👤 Assigned</label>
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
						<label>P Labels</label>
						<select className="dark-select" value={filters.labelId} onChange={(e) => setFilters({ ...filters, labelId: e.target.value })}>
							<option value="any">select ⌄</option>
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

// Card Back Section Component (Photo 2)
function CardBackUI() {
	const t = window.TrelloPowerUp ? window.TrelloPowerUp.iframe() : null;
	const [count, setCount] = useState(0);

	useEffect(() => {
		if (!t) return;
		// Mock fetch count
		calculateMatchCount(t).then(res => {
			// res.text is string e.g. "4 matches"
			const num = parseInt(res.text) || 0;
			setCount(num);
		});
	}, [t]);

	const openExplorer = () => {
		t.modal({
			title: "Dashcard", // Full dashboard
			url: `${DEPLOY_URL}/popup.html?mode=explorer`,
			height: 800,
			fullscreen: false // Large modal
		});
	};

	return (
		<div className="card-back-container">
			<div className="cb-toggle-row">
				<div className="cb-toggle"></div>
				<div>Allow members who can view this card to explore</div>
			</div>
			{/* Label Row */}
			<div className="cb-label-row">
				<div className="cb-label-color"></div>
				<div className="cb-label-text">Dashcard</div>
			</div>
			{/* Summary Row */}
			<div className="cb-summary-bar">
				<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
					<div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: 16, height: 16, textAlign: 'center', fontSize: 10, lineHeight: '16px' }}>ℹ</div>
					<div>Showing the first {count} of {count} matching cards</div>
				</div>
				<button className="cb-button" onClick={openExplorer}>Explore and edit</button>
			</div>
		</div>
	);
}

// Explorer / Dashboard Component (Photo 3)
function ExplorerUI() {
	const t = window.TrelloPowerUp ? window.TrelloPowerUp.iframe() : null;
	const [matches, setMatches] = useState([]);
	const [cardName, setCardName] = useState("Dashcard");
	const [bg, setBg] = useState({ type: 'color', value: '#0065ff' }); // Mock default

	useEffect(() => {
		if (!t) return;
		// Load context
		t.get('card', 'shared', 'dashFilter').then(filter => {
			if (filter) {
				setCardName(filter.name || "Dashcard");
				if (filter.background) setBg(filter.background);
			}
		});

		// Mock Data Load (using existing logic)
		calculateMatchCount(t).then(() => {
			// In a real app we would load full cards. Here we mock some rows.
			setMatches([
				{ id: 1, name: "Project Alpha Kickoff", board: "My Trello board", status: "Active", date: "6 DEC", list: "Doing" },
				{ id: 2, name: "Design Review", board: "My Trello board", status: "Active", date: "7 DEC", list: "To Do" },
				{ id: 3, name: "Client Meeting", board: "My Trello board", status: "Completed", date: "5 DEC", list: "Done" },
				{ id: 4, name: "Deployed to Prod", board: "My Trello board", status: "Completed", date: "6 DEC", list: "Done" }
			]);
		});
	}, [t]);

	return (
		<div className="explorer-container">
			{/* Header */}
			<div className="explorer-header">
				<div className="explorer-preview-micro" style={{
					backgroundColor: bg.type === 'color' ? bg.value : '#222',
					backgroundImage: bg.type === 'image' ? `url(${bg.value})` : 'none'
				}}>
					<div className="count">{matches.length}</div>
				</div>
				<div className="explorer-info">
					<h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0' }}>{cardName}</h2>
					<div className="explorer-meta-row">
						<span>⚏ Board</span> is one of <span className="meta-tag" style={{ background: '#a855f7' }}>My Trello board</span>
					</div>
					<div className="explorer-meta-row">
						<span>⚏ List</span> is one of <span className="meta-tag">This Week</span>
					</div>
					<div className="explorer-actions">
						<button className="btn btn-secondary" style={{ background: '#2c2e35' }} onClick={() => t.modal({ url: `${DEPLOY_URL}/popup.html`, height: 700 })}>✎ Edit filters</button>
						<button className="btn btn-secondary" style={{ background: '#2c2e35' }}>Clone Dashcard</button>
					</div>
				</div>
			</div>

			{/* Tabs */}
			<div className="explorer-tabs">
				<div className="explorer-tab active">Table ({matches.length} cards)</div>
				<div className="explorer-tab">Metrics (1)</div>
				<div className="explorer-tab">History</div>
				<div className="explorer-tab">Alerts</div>
			</div>

			{/* Content Table */}
			<div className="explorer-content">
				<div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
					<button className="btn btn-secondary" style={{ marginRight: 8 }}>Columns</button>
					<button className="btn btn-secondary">Export</button>
				</div>
				<table className="data-table">
					<thead>
						<tr>
							<th>Name</th>
							<th>Board</th>
							<th>Complete</th>
							<th>Created</th>
							<th>List</th>
						</tr>
					</thead>
					<tbody>
						{matches.map(m => (
							<tr key={m.id}>
								<td>{m.name}</td>
								<td>{m.board}</td>
								<td><span className="status-indicator" style={{ background: m.status === 'Completed' ? '#57d9a3' : '#AEB9C6' }}></span></td>
								<td>{m.date}</td>
								<td>{m.list}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}

// Helper to detect context
const isPopup = !!document.getElementById("trello-popup-root") || window.location.pathname.includes("popup.html");
const isDashboard = !!document.getElementById("trello-dashboard-root") || window.location.pathname.includes("dashboard.html");
const isSettings = !!document.getElementById("trello-settings-root") || window.location.pathname.includes("settings.html");
const isModal = window.location.search.includes("mode=");
const isConnector = !isPopup && !isDashboard && !isModal && !isSettings;

// STRICTLY only initialize capabilities in the connector.
if (isConnector && typeof window !== "undefined" && window.TrelloPowerUp) {
	window.TrelloPowerUp.initialize({
		"card-buttons": function (t) {
			return [{
				icon: 'https://cdn-icons-png.flaticon.com/512/3208/3208726.png',
				text: "Track with Dashcard",
				callback: function (t) {
					return t.modal({ title: "Dashcard", url: `${DEPLOY_URL}/popup.html`, height: 700 });
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
			return t.get('card', 'shared', 'isDashCard').then(isDash => {
				if (isDash) {
					return {
						title: 'Dashcard',
						icon: 'https://cdn-icons-png.flaticon.com/512/3208/3208726.png',
						content: {
							type: 'iframe',
							url: t.signUrl(`${DEPLOY_URL}/popup.html?mode=card-back`),
							height: 140
						}
					}
				}
				return [];
			}).catch(() => []);
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

		if (mode === 'card-back') {
			createRoot(target).render(<CardBackUI />);
		} else if (mode === 'explorer') {
			createRoot(target).render(<ExplorerUI />);
		} else if (dashboardRoot) {
			createRoot(dashboardRoot).render(<DashboardUI />);
		} else {
			// Default is PopupUI (Create/Edit)
			createRoot(target).render(<PopupUI />);
		}
	}
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', mount); } else { mount(); }

export default TrelloPowerUp;
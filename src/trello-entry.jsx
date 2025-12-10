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
		// We use t.board('all') here, which might fail or be restricted. 
		// For production, consider using REST API with token if needed, but for Power-Ups usually 'all' works if context allows.
		const allCards = await t.board('all').get('cards', 'all');
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
				const storedFilter = await t.get('card', 'shared', 'dashFilter');
				if (storedFilter) {
					setFilters(storedFilter);
					if (storedFilter.name) setName(storedFilter.name);
					if (storedFilter.background) setBg(storedFilter.background);
				}
				setLists(boardLists || []);
				setLabels(boardLabels || []);
				setMembers(boardMembers || []);
			} catch (error) {
				console.error("Failed to fetch data:", error);
			} finally {
				setLoading(false);
			}
		};
		init();
	}, [t]);

	useEffect(() => {
		if (!t || loading) return;
		const calculateActiveCount = async () => {
			try {
				const allCards = await t.board('all').get('cards', 'all');
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
		const config = { ...filters, name, background: bg };
		await t.set('card', 'shared', 'dashFilter', config);
		if (bg.type === 'color') {
			await t.card('cover', { color: getTrelloColorName(bg.value) || 'blue', size: 'full' });
		} else {
			await t.card('cover', { url: bg.value, size: 'full' });
		}
		if (name) await t.card('name', name);
		await t.set('card', 'shared', 'isDashCard', true);
		t.closePopup();
	};

	const getTrelloColorName = (hex) => {
		const preset = BACKGROUNDS.find(b => b.value === hex);
		return preset ? preset.name.toLowerCase() : 'blue';
	};

	if (!t || loading) return <div className="loading-state" style={{ color: 'white' }}>Loading options...</div>;

	return (
		<div className="dashcard-popup">
			<div className="popup-header">
				<h3 style={{ margin: 0, fontSize: 16 }}>Configuration</h3>
				<button className="btn btn-sm" style={{ background: 'transparent', color: '#9fadbc' }} onClick={() => t.closePopup()}>Cancel</button>
			</div>
			<div className="popup-body">
				<div className="preview-section">
					<div className="preview-card" style={{ backgroundColor: bg.type === 'color' ? bg.value : 'transparent', backgroundImage: bg.type === 'image' ? `url(${bg.value})` : 'none' }}>
						{bg.type === 'image' && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}></div>}
						<div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
							<div className="preview-count">{previewCount}</div>
							<div className="preview-label">{name}</div>
						</div>
					</div>
				</div>
				<div className="form-section">
					<div className="dark-input-group">
						<label>NAME</label>
						<input type="text" className="dark-input" value={name} onChange={(e) => setName(e.target.value)} />
					</div>
					<div className="dark-input-group">
						<label>APPEARANCE</label>
						<button className="btn btn-sm" style={{ backgroundColor: '#253858', color: 'white', border: '1px solid #344563' }} onClick={() => setShowBgPicker(!showBgPicker)}>
							{bg.type === 'image' ? '🖼️ Image' : '🎨 Color'} - Change background
						</button>
						{showBgPicker && (
							<div className="bg-picker-grid">
								{BACKGROUNDS.map((b, i) => (
									<div key={i} className={`bg-option ${bg.value === b.value ? 'active' : ''}`} style={{ backgroundColor: b.type === 'color' ? b.value : '#ccc', backgroundImage: b.type === 'image' ? `url(${b.value})` : 'none', backgroundSize: 'cover' }} onClick={() => { setBg(b); setShowBgPicker(false); }}></div>
								))}
							</div>
						)}
					</div>
					<hr style={{ borderColor: '#344563', opacity: 0.5, margin: '20px 0' }} />
					<div className="filter-row">
						<div className="filter-label">List</div>
						<div className="filter-control">
							<select className="dark-select" value={filters.listId} onChange={(e) => setFilters({ ...filters, listId: e.target.value })}>
								<option value="any">any</option>
								{Array.isArray(lists) && lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
							</select>
						</div>
					</div>
					<div className="filter-row">
						<div className="filter-label">Assigned</div>
						<div className="filter-control">
							<select className="dark-select" value={filters.memberId} onChange={(e) => setFilters({ ...filters, memberId: e.target.value })}>
								<option value="any">Select...</option>
								<option value="me"> assigned to me </option>
								{Array.isArray(members) && members.map(m => <option key={m.id} value={m.id}>{m.fullName}</option>)}
							</select>
						</div>
					</div>
					<div className="filter-row">
						<div className="filter-label">Due</div>
						<div className="filter-control">
							<select className="dark-select" value={filters.due} onChange={(e) => setFilters({ ...filters, due: e.target.value })}>
								<option value="any">Select...</option>
								<option value="overdue">Overdue</option>
								<option value="week">Due this week</option>
							</select>
						</div>
					</div>
					<div className="filter-row">
						<div className="filter-label">Labels</div>
						<div className="filter-control">
							<select className="dark-select" value={filters.labelId} onChange={(e) => setFilters({ ...filters, labelId: e.target.value })}>
								<option value="any">Select...</option>
								{Array.isArray(labels) && labels.map(l => (<option key={l.id} value={l.id}>{l.name ? l.name : l.color}</option>))}
							</select>
						</div>
					</div>
					<div style={{ marginTop: 12 }}>
						<button className="btn btn-sm" style={{ background: 'transparent', color: '#9fadbc', border: '1px solid #344563' }}>+ More filters</button>
					</div>
				</div>
			</div>
			<div className="popup-footer">
				<button className="btn" style={{ color: '#9fadbc', background: 'transparent' }} onClick={() => t.closePopup()}>Cancel</button>
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

// initialization guard
const isPopup = document.getElementById("trello-popup-root");
const isDashboard = document.getElementById("trello-dashboard-root");

if (typeof window !== "undefined" && window.TrelloPowerUp && window.TrelloPowerUp.initialize && !isPopup && !isDashboard) {
	window.TrelloPowerUp.initialize({
		"card-buttons": function (t) {
			return [{
				icon: 'https://cdn-icons-png.flaticon.com/512/3208/3208726.png',
				text: "Track with Dashcard",
				callback: function (t) {
					return t.popup({ title: "Dashcards — Track", url: `${DEPLOY_URL}/popup.html`, height: 600 });
				},
			}];
		},
		"card-badges": function (t) {
			return t.get('card', 'shared', 'dashFilter').then(filter => {
				if (!filter) return [];
				return [{
					dynamic: function () {
						return calculateMatchCount(t).then(result => ({ title: 'Dashcard', text: result.text, color: 'light-gray', refresh: 10 }));
					}
				}];
			});
		},
		/* 
		   NOTE: To enable the "Dashcard Matches" section on the back of cards:
		   1. Go to https://trello.com/power-ups/admin
		   2. Open your Power-Up -> Capabilities
		   3. Enable "Card Back Section"
		   4. Uncomment the code below.
		*/
		// "card-back-section": function (t) {
		// 	return t.get('card', 'shared', 'isDashCard').then(isDash => {
		// 		if (!isDash) return [];
		// 		return {
		// 			title: 'Dashcard Matches',
		// 			icon: 'https://cdn-icons-png.flaticon.com/512/3208/3208726.png',
		// 			content: { type: 'iframe', url: t.signUrl(`${DEPLOY_URL}/dashboard.html`), height: 400 }
		// 		}
		// 	});
		// },
		"board-buttons": function (t) {
			return [];
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
	const popupRoot = document.getElementById("trello-popup-root");
	const dashboardRoot = document.getElementById("trello-dashboard-root");
	if (popupRoot) { createRoot(popupRoot).render(<PopupUI />); }
	else if (dashboardRoot) { createRoot(dashboardRoot).render(<DashboardUI />); }
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', mount); } else { mount(); }

export default TrelloPowerUp;
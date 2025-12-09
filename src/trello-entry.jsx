import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

// The Trello client library must be loaded via <script> tag in HTML first.
// We keep this declaration synchronous as required, but rely minimally on it
// for the capabilities array construction below.
const TrelloPowerUp = window.TrelloPowerUp;

const DEPLOY_URL = "https://statuesque-sfogliatella-0c9a46.netlify.app";

async function isDashCard(t) {
	return t.get('card', 'shared', 'isDashCard', false);
}

async function calculateMatchCount(t) {
	const criteria = await t.get('card', 'shared', 'filterCriteria');

	if (!criteria) return { text: 'N/A', color: 'light-gray' };

	const allCards = await t.board('all').get('cards', 'all');

	const matchedCards = allCards.filter(card => {
		let match = true;

		if (criteria.labelId && !card.idLabels.includes(criteria.labelId)) {
			match = false;
		}

		const now = new Date();
		const isPastDue = card.due && new Date(card.due) < now && !card.dueComplete;

		if (criteria.isOverdue) {
			if (!isPastDue) {
				match = false;
			}
		}

		return match;
	});

	const count = matchedCards.length;
	const color = count > 0 ? 'green' : 'light-gray';

	return { text: `${count} Cards`, color, rawCount: count };
}

if (typeof window !== "undefined" && window.TrelloPowerUp && window.TrelloPowerUp.initialize) {
	try {
		window.TrelloPowerUp.initialize({

			// Reverting to the simplest, most reliable handler style.
			"card-buttons": function (t) {
				return [
					{
						// Using a generic Trello icon constant ID (e.g., 'attachment')
						icon: 'attachment',
						text: "Configure DashCard",
						callback: function (t) {
							// FIX: Using the hardcoded HTTPS URL for configuration popup
							return t.popup({
								title: "DashCard Setup",
								url: `${DEPLOY_URL}/popup.html`,
								height: 300,
							});
						},
					},
				];
			},

			"card-badges": function (t) {
				return isDashCard(t).then(isCard => {
					if (!isCard) return [];

					return [{
						dynamic: function () {
							return calculateMatchCount(t).then(result => ({
								title: 'Matched Cards',
								text: result.text,
								color: result.color,
								refresh: 15
							}));
						}
					}];
				});
			},

			"board-buttons": function (t) {
				return [
					{
						// Using a generic Trello icon constant ID (e.g., 'attachment')
						icon: 'attachment',
						text: "DashFlow Dashboard",
						callback: function (t) {
							// FIX: Using the hardcoded HTTPS URL for the modal
							return t.modal({
								title: "Board Dashboard",
								url: `${DEPLOY_URL}/dashboard.html`,
								fullscreen: true,
								accentColor: '#42b983'
							});
						},
					},
				];
			},

			"show-settings": function (t) {
				return {
					// FIX: Using the hardcoded HTTPS URL for settings
					url: `${DEPLOY_URL}/settings.html`,
					height: 240
				};
			},
		});
		console.log("TrelloPowerUp.initialize called (registered handlers).");
	} catch (e) {
		console.warn("Error registering TrelloPowerUp.initialize:", e);
	}
}

async function getApiCredentials(t) {
	try {
		const saved = await t.get("board", "private", "trelloApi");
		if (saved && saved.key && saved.token) return saved;
	} catch (e) {
		console.warn("No saved API credentials:", e);
	}
	const FALLBACK = {
		key: "",
		token: "",
	};
	return FALLBACK;
}

function CardUI() {
	const [card, setCard] = useState(null);
	const [error, setError] = useState(null);

	useEffect(() => {
		const tClient = window.TrelloPowerUp && window.TrelloPowerUp.iframe();

		if (!tClient) {
			return;
		}

		tClient.card("id", "name", "labels", "due", "desc")
			.then((c) => {
				setCard(c || null);
			})
			.catch((err) => {
				console.error(err);
				setError("Failed to load card data");
			});
	}, []);

	if (error) return <div style={{ padding: 12 }}>{error}</div>;
	if (!card) return <div style={{ padding: 12 }}>Loading card data…</div>;

	return (
		<div style={{ fontFamily: "system-ui, Arial", padding: 12 }}>
			<h3 style={{ marginTop: 0 }}>{card.name}</h3>
			<div style={{ marginBottom: 8 }}>
				<strong>Due:</strong>{" "}
				{card.due ? new Date(card.due).toLocaleString() : "No due date"}
			</div>
			<div style={{ marginBottom: 8 }}>
				<strong>Labels:</strong>
				<div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
					{Array.isArray(card.labels) && card.labels.length ? (
						card.labels.map((l) => (
							<div
								key={l.id}
								style={{
									background: l.color || "#ddd",
									color: "#111",
									padding: "4px 8px",
									borderRadius: 6,
									fontSize: 12,
								}}
							>
								{l.name || (l.color ? l.color : "label")}
							</div>
						))
					) : (
						<span>No labels</span>
					)}
				</div>
			</div>

			<div style={{ marginTop: 12 }}>
				<button
					onClick={async () => {
						const t = window.TrelloPowerUp.iframe();
						await t.popup({
							title: "Open popup",
							url: "/popup.html",
							height: 140,
						});
					}}
				>
					Open popup
				</button>
				<span style={{ marginLeft: 8, color: "#666", fontSize: 13 }}>
					(small actions)
				</span>
			</div>
		</div>
	);
}

function PopupUI() {
	const t = window.TrelloPowerUp ? window.TrelloPowerUp.iframe() : null;
	const [boardLabels, setBoardLabels] = useState([]);
	const [filter, setFilter] = useState({ labelId: '', isOverdue: false });

	useEffect(() => {
		const fetchLabels = async () => {
			if (!t) return;
			try {
				const labels = await t.board('labels').get('labels');
				setBoardLabels(labels);
			} catch (error) {
				console.error("Failed to fetch labels:", error);
			}
		};
		fetchLabels();
	}, [t]);

	if (!t) return <div style={{ padding: 12 }}>loading…</div>;

	const saveConfiguration = async () => {
		await t.set('card', 'shared', 'filterCriteria', filter);
		await t.set('card', 'shared', 'isDashCard', true);
		t.closePopup();
	};

	const handleLabelChange = (e) => {
		setFilter({ ...filter, labelId: e.target.value });
	};

	return (
		<div style={{ fontFamily: "system-ui, Arial", padding: 12 }}>
			<h3>DashCard Configuration</h3>

			<label style={{ display: 'block', marginBottom: '10px' }}>
				Track Overdue Cards:
				<input
					type="checkbox"
					checked={filter.isOverdue}
					onChange={(e) => setFilter({ ...filter, isOverdue: e.target.checked })}
					style={{ marginLeft: '5px' }}
				/>
			</label>

			<label style={{ display: 'block', marginBottom: '15px' }}>
				Filter by Label:
				<select value={filter.labelId} onChange={handleLabelChange} style={{ width: '100%', padding: '5px', marginTop: '5px' }}>
					<option value="">(None)</option>
					{boardLabels.map(label => (
						<option key={label.id} value={label.id} style={{ color: label.color }}>
							{label.name || `(${label.color})`}
						</option>
					))}
				</select>
			</label>

			<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
				<button onClick={saveConfiguration} style={{ padding: '8px 15px', backgroundColor: '#5aac44', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
					Save DashCard
				</button>
			</div>
		</div>
	);
}

function DashboardUI() {
	const [loading, setLoading] = useState(true);
	const [summary, setSummary] = useState(null);
	const [error, setError] = useState(null);

	useEffect(() => {
		(async () => {
			const t = window.TrelloPowerUp && window.TrelloPowerUp.iframe();
			if (!t) {
				setError("Trello client unavailable");
				setLoading(false);
				return;
			}

			try {
				const board = await t.board("id", "name");
				const creds = await getApiCredentials(t);
				if (!creds.key || !creds.token) {
					setError(
						"No Trello key/token found. Open the Power-Up Settings and save them for this board."
					);
					setLoading(false);
					return;
				}

				const url = `https://api.trello.com/1/boards/${board.id}/cards?fields=name,labels,due&key=${creds.key}&token=${creds.token}`;
				const res = await fetch(url);
				if (!res.ok) {
					const text = await res.text();
					throw new Error(`Trello API error: ${res.status} ${text}`);
				}
				const cards = await res.json();

				const labelCounts = {};
				const upcoming = [];
				const now = Date.now();
				for (const c of cards) {
					if (c.labels && c.labels.length) {
						for (const l of c.labels) {
							const key = l.name || l.color || "label";
							labelCounts[key] = (labelCounts[key] || 0) + 1;
						}
					}
					if (c.due) {
						const dueTs = new Date(c.due).getTime();
						if (dueTs >= now) {
							upcoming.push({ name: c.name, due: c.due });
						}
					}
				}
				upcoming.sort((a, b) => new Date(a.due) - new Date(b.due));
				setSummary({ labelCounts, upcoming });
				setLoading(false);
			} catch (err) {
				console.error(err);
				setError(String(err.message || err));
				setLoading(false);
			}
		})();
	}, []);

	if (loading) return <div style={{ padding: 12 }}>Loading dashboard…</div>;
	if (error) return <div style={{ padding: 12, color: "crimson" }}>{error}</div>;
	if (!summary) return <div style={{ padding: 12 }}>No data</div>;

	return (
		<div style={{ fontFamily: "system-ui, Arial", padding: 12 }}>
			<h3>Board Dashboard</h3>
			<section style={{ marginBottom: 12 }}>
				<strong>Labels</strong>
				<div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
					{Object.keys(summary.labelCounts).length ? (
						Object.entries(summary.labelCounts).map(([label, count]) => (
							<div
								key={label}
								style={{
									padding: "6px 10px",
									borderRadius: 8,
									background: "#eee",
									fontSize: 13,
								}}
							>
								{label} — {count}
							</div>
						))
					) : (
						<div>No labels found</div>
					)}
				</div>
			</section>

			<section>
				<strong>Upcoming due dates</strong>
				<ul>
					{summary.upcoming.length ? (
						summary.upcoming.slice(0, 10).map((c, i) => (
							<li key={i}>
								{c.name} — {new Date(c.due).toLocaleString()}
							</li>
						))
					) : (
						<li>No upcoming due dates</li>
					)}
				</ul>
			</section>
		</div>
	);
}

function SettingsUI() {
	const [keyVal, setKeyVal] = useState("");
	const [tokenVal, setTokenVal] = useState("");
	const [status, setStatus] = useState("");
	const t = window.TrelloPowerUp ? window.TrelloPowerUp.iframe() : null;

	useEffect(() => {
		if (!t) return;
		(async () => {
			try {
				const saved = await t.get("board", "private", "trelloApi");
				if (saved) {
					setKeyVal(saved.key || "");
					setTokenVal(saved.token || "");
				}
			} catch (e) {
				console.warn(e);
			}
		})();
	}, [t]);

	async function save() {
		if (!t) return;
		try {
			await t.set("board", "private", "trelloApi", { key: keyVal, token: tokenVal });
			setStatus("Saved.");
			setTimeout(() => t.closePopup && t.closePopup(), 800);
		} catch (e) {
			setStatus("Failed to save: " + e.message);
		}
	}

	return (
		<div style={{ padding: 12, fontFamily: "system-ui, Arial" }}>
			<h3>Power-Up Settings</h3>
			<div style={{ marginBottom: 8 }}>
				<label style={{ display: 'block', marginBottom: '4px' }}>Trello API Key (dev)</label>
				<input value={keyVal} onChange={(e) => setKeyVal(e.target.value)} style={{ width: "100%", padding: '6px' }} />
			</div>
			<div style={{ marginBottom: 8 }}>
				<label style={{ display: 'block', marginBottom: '4px' }}>Trello Token (dev)</label>
				<input value={tokenVal} onChange={(e) => setTokenVal(e.target.value)} style={{ width: "100%", padding: '6px' }} />
			</div>
			<div>
				<button onClick={save} style={{ padding: '8px 15px', backgroundColor: '#0079bf', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Save to board</button>
				<span style={{ marginLeft: 8 }}>{status}</span>
			</div>
			<p style={{ marginTop: 8, color: "#666", fontSize: 13 }}>
				These credentials are stored private to this board in Trello.
			</p>
		</div>
	);
}

function mount() {
	const cardRoot = document.getElementById("trello-card-root");
	const popupRoot = document.getElementById("trello-popup-root");
	const dashboardRoot = document.getElementById("trello-dashboard-root");
	const settingsRoot = document.getElementById("trello-settings-root");

	if (cardRoot) {
		const root = createRoot(cardRoot);
		root.render(<CardUI />);
	} else if (popupRoot) {
		const root = createRoot(popupRoot);
		root.render(<PopupUI />);
	} else if (dashboardRoot) {
		const root = createRoot(dashboardRoot);
		root.render(<DashboardUI />);
	} else if (settingsRoot) {
		const root = createRoot(settingsRoot);
		root.render(<SettingsUI />);
	}
}

mount();
export default TrelloPowerUp;
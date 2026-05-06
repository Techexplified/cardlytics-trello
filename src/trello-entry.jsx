import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import { APP_KEY, DEPLOY_URL } from "./utils/constants";
import { calculateMatchCount, createCompositeImage } from "./utils/helpers";
import PopupUI from "./components/PopupUI";
import DashboardUI from "./components/DashboardUI";
import DashCardDetails from "./components/DashCardDetails";

const TrelloPowerUp = window.TrelloPowerUp;

const isPopup = typeof document !== 'undefined' && (!!document.getElementById("trello-popup-root") || window.location.pathname.includes("popup.html"));
const isDashboard = typeof document !== 'undefined' && (!!document.getElementById("trello-dashboard-root") || window.location.pathname.includes("dashboard.html"));
const isSettings = typeof document !== 'undefined' && (!!document.getElementById("trello-settings-root") || window.location.pathname.includes("settings.html"));
const isDetail = typeof document !== 'undefined' && window.location.pathname.includes("detail.html");
const isModal = typeof window !== 'undefined' && window.location.search.includes("mode=");
const isConnector = !isPopup && !isDashboard && !isModal && !isSettings && !isDetail;

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
				.then(async filter => {
					if (!filter) return [];
					return [{
						dynamic: async function () {
							try {
								const result = await calculateMatchCount(t);
								if (result && result.length > 0) {
									const count = result[0].text;

									// Auto-update cover if count changed
									if (filter.lastCount != count) {
										try {
											const rest = t.getRestApi();
											if (await rest.isAuthorized()) {
												const token = await rest.getToken();
												if (token) {
													const card = await t.card('id');

													const blob = await createCompositeImage(filter.background, count, filter.name);

													const formData = new FormData();
													formData.append('file', blob, 'cover.png');
													formData.append('key', APP_KEY);
													formData.append('token', token);

													const attachRes = await fetch(
														`https://api.trello.com/1/cards/${card.id}/attachments`,
														{ method: "POST", body: formData }
													);

													if (attachRes.ok) {
														const attachData = await attachRes.json();
														// Set cover
														await fetch(`https://api.trello.com/1/cards/${card.id}?key=${APP_KEY}&token=${token}`, {
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

														// Cleanup old attachments (optional but good)
														// Skipping for speed/simplicity in auto-update to avoid race conditions

														// Update stored lastCount
														filter.lastCount = count;
														await t.set('card', 'shared', 'dashFilter', filter);
													}
												}
											}
										} catch (err) {
											// console.warn("Auto-update failed", err);
										}
									}

									return { title: 'Dashcard', text: count, color: 'light-gray', refresh: 10 };
								}
								return { text: '?' };
							} catch (e) {
								return { text: '?' };
							}
						}
					}];
				})
				.catch(() => []);
		},

		"card-back-section": function (t) {
			return t.get('card', 'shared', 'dashFilter')
				.then(filter => {
					if (!filter) return [];

					return [{
						title: 'Dashcard Filter Details',
						icon: 'https://cdn-icons-png.flaticon.com/512/3208/3208726.png',
						content: {
							type: 'iframe',
							url: t.signUrl(`${DEPLOY_URL}/detail.html`),
							height: 250
						}
					}];
				})
				.catch(() => []);
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

    const rootEl = document.getElementById("trello-popup-root") ||
        document.getElementById("trello-dashboard-root") ||
        document.getElementById("app-container") || // Add this for detail.html
        document.getElementById("root");

    // Improved detail view detection
    if (isDetail || window.location.pathname.includes("detail.html")) {
        const detailRoot = document.getElementById("app-container") || rootEl;
        createRoot(detailRoot).render(<DashCardDetails />);
        return;
    }

	if (rootEl) {
		const dashboardRoot = document.getElementById("trello-dashboard-root");
		if (dashboardRoot) {
			createRoot(dashboardRoot).render(<DashboardUI />);
		} else {
			createRoot(rootEl).render(<PopupUI />);
		}
	}
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', mount);
} else {
	mount();
}

export default TrelloPowerUp;
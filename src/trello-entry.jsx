import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

import { APP_KEY, DEPLOY_URL } from "./utils/constants";
import { calculateMatchCount } from "./utils/helpers";
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
		appKey: APP_KEY,
		appName: 'Dashcards',
		"card-buttons": function (t) {
			return [{
				icon: 'https://cdn-icons-png.flaticon.com/512/3208/3208726.png',
				text: "Track with Dashcard",
				callback: function (t) {
					return t.modal({ title: "Dashcard", url: `${DEPLOY_URL}/popup.html?mode=edit`, height: 700 });
				},
			}];
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
		document.getElementById("root") ||
		document.body;

	if (isDetail || window.location.href.includes("detail.html")) {
		createRoot(rootEl).render(<DashCardDetails />);
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
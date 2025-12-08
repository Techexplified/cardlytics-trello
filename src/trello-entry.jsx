// src/trello-entry.jsx
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

/**
 * IMPORTANT: register TrelloPowerUp handlers synchronously and as early as possible.
 * Trello will iframe your connector URL and wait ~30s for initialize() to run.
 * Keep these handlers lightweight and synchronous (no awaits).
 */
if (typeof window !== "undefined" && window.TrelloPowerUp && window.TrelloPowerUp.initialize) {
  try {
window.TrelloPowerUp.initialize({
  "card-buttons": function (t, opts) {
    return [
      {
        text: "DashFlow",
        callback: function (t) {
          return t.popup({
            title: "DashFlow Card",
            url: "https://gleeful-biscochitos-c16ce9.netlify.app/card-button.html",
            height: 140,
          });
        },
      },
    ];
  },

  "board-buttons": function (t, opts) {
    return [
      {
        text: "Board Dashboard",
        callback: function (t) {
          return t.popup({
            title: "Board Dashboard",
            url: "https://gleeful-biscochitos-c16ce9.netlify.app/dashboard.html",
            height: 420,
          });
        },
      },
    ];
  },

  "show-settings": function (t, opts) {
    return {
      url: "https://gleeful-biscochitos-c16ce9.netlify.app/settings.html",
      height: 240
    };
  },
});


    // Helpful console message while debugging
    // (will appear in Trello's console for the hidden connector iframe)
    // eslint-disable-next-line no-console
    console.log("TrelloPowerUp.initialize called (registered handlers).");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("Error registering TrelloPowerUp.initialize:", e);
  }
}

/* ---------------- Helper: API credentials retrieval ---------------- */
async function getApiCredentials(t) {
  try {
    const saved = await t.get("board", "private", "trelloApi");
    if (saved && saved.key && saved.token) return saved;
  } catch (e) {
    console.warn("No saved API credentials:", e);
  }
  // Fallback for quick dev (not recommended for production)
  const FALLBACK = {
    key: "",
    token: "",
  };
  return FALLBACK;
}

/* ---------------- Card UI ---------------- */
function CardUI() {
  const [card, setCard] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const t = window.TrelloPowerUp && window.TrelloPowerUp.iframe();
    if (!t) {
      setError("Trello client not available");
      return;
    }

    t.card("id", "name", "labels", "due", "desc")
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

/* ---------------- Popup UI ---------------- */
function PopupUI() {
  const [t, setT] = useState(null);
  useEffect(() => {
    setT(window.TrelloPowerUp ? window.TrelloPowerUp.iframe() : null);
  }, []);
  if (!t) return <div style={{ padding: 12 }}>loading…</div>;

  return (
    <div style={{ fontFamily: "system-ui, Arial", padding: 12 }}>
      <h3>Quick Actions</h3>
      <div>
        <button
          onClick={async () => {
            await t.set("card", "shared", "lastAction", { ts: Date.now() });
            await t.closePopup();
          }}
        >
          Save small value
        </button>
        <button style={{ marginLeft: 8 }} onClick={() => t.closePopup()}>
          Close
        </button>
      </div>
    </div>
  );
}

/* ---------------- Dashboard UI ---------------- */
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

/* ---------------- Settings UI ---------------- */
function SettingsUI() {
  const [keyVal, setKeyVal] = useState("");
  const [tokenVal, setTokenVal] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const t = window.TrelloPowerUp && window.TrelloPowerUp.iframe();
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
  }, []);

  async function save() {
    const t = window.TrelloPowerUp.iframe();
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
        <label>Trello API Key (dev)</label>
        <input value={keyVal} onChange={(e) => setKeyVal(e.target.value)} style={{ width: "100%" }} />
      </div>
      <div style={{ marginBottom: 8 }}>
        <label>Trello Token (dev)</label>
        <input value={tokenVal} onChange={(e) => setTokenVal(e.target.value)} style={{ width: "100%" }} />
      </div>
      <div>
        <button onClick={save}>Save to board</button>
        <span style={{ marginLeft: 8 }}>{status}</span>
      </div>
      <p style={{ marginTop: 8, color: "#666", fontSize: 13 }}>
        These credentials are stored private to this board in Trello. For production, use a server-side flow and Netlify Functions to avoid exposing secrets in client code.
      </p>
    </div>
  );
}

/* ---------------- Mount logic ---------------- */
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

/* global TrelloPowerUp */

var t = TrelloPowerUp.iframe();

// Capability: Board button
TrelloPowerUp.initialize({
    'board-buttons': function (t, opts) {
        return [{
            icon: 'https://cdn-icons-png.flaticon.com/512/1828/1828778.png',
            text: 'Create Dashcard',
            callback: function () {
                return t.popup({
                    title: 'Create Dashcard',
                    url: './popup.html',
                    height: 300
                });
            }
        }];
    },

    // Card badges (later you will add logic)
    'card-badges': function (t, opts) {
        return [];
    }
});
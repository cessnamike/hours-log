// Landing page helper. Plain ES5 so it runs on old phones and in-app browsers.
// Shows a warning when the page is opened inside Facebook, Instagram or a similar
// app's built-in browser, where Hours Log can't be installed and saved records can be lost.
(function () {
  var ua = navigator.userAgent || '';
  var apps = [
    [/FBAN|FBAV|FB_IAB|FBIOS|FB4A/i, 'Facebook'],
    [/Messenger|MessengerForiOS|Orca-Android/i, 'Messenger'],
    [/Instagram/i, 'Instagram'],
    [/musical_ly|TikTok|BytedanceWebview/i, 'TikTok'],
    [/Snapchat/i, 'Snapchat'],
    [/Twitter/i, 'X (Twitter)'],
    [/Line\//i, 'LINE'],
  ];
  var name = null;
  for (var i = 0; i < apps.length; i++) {
    if (apps[i][0].test(ua)) { name = apps[i][1]; break; }
  }
  if (!name) return;

  var box = document.getElementById('inapp');
  document.getElementById('inapp-name').textContent = name;
  box.hidden = false;

  // Android: an intent link can hand the page to Chrome directly.
  if (/Android/i.test(ua)) document.getElementById('inapp-chrome').hidden = false;

  var link = 'https://hours.mikesheridandigital.com/start/';
  document.getElementById('inapp-copy').addEventListener('click', function () {
    var done = function () { document.getElementById('inapp-copied').hidden = false; };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(done, function () { fallback(); });
        return;
      }
    } catch (e) {}
    fallback();
    function fallback() {
      var t = document.createElement('textarea');
      t.value = link; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); done(); } catch (e) { window.prompt('Copy this link:', link); }
      document.body.removeChild(t);
    }
  });
})();

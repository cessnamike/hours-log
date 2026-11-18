// Shown after "Delete everything". Uses no storage, so nothing gets recreated.
export function Deleted() {
  return (
    <main class="welcome">
      <h1>Everything is deleted</h1>
      <p>Your records and this app's saved files are gone from this device.</p>
      <h2>To remove the icon too</h2>
      <ul class="plain">
        <li><b>Android:</b> press and hold the Hours Log icon, then tap <b>Uninstall</b> (or drag it to <b>Uninstall</b>).</li>
        <li><b>iPhone or iPad:</b> press and hold the icon, then tap <b>Remove App</b> or <b>Delete Bookmark</b>.</li>
        <li><b>Computer:</b> in the app window, open the menu (⋮ or …) and choose <b>Uninstall</b>.</li>
      </ul>
      <p class="muted small">If you open the app again, it starts fresh with no records.</p>
    </main>
  );
}

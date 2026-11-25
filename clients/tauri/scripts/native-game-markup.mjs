// Compile the server-owned HEEx game layout into static native markup.
// Client UI and server UI share one source of truth for cockpit structure.
const icons = {
  "hero-bars-3": "☰", "hero-user": "♙", "hero-archive-box": "▣",
  "hero-signal": "◉", "hero-clipboard-document-list": "▤",
  "hero-rocket-launch": "✦", "hero-map": "◎", "hero-wrench-screwdriver": "⚙",
  "hero-power": "⏻", "hero-globe-alt": "◉", "hero-eye-slash": "◌",
  "hero-chevron-up": "⌃", "hero-chevron-down": "⌄",
  "hero-lock-closed": "▣", "hero-lock-open": "□",
  "hero-adjustments-horizontal": "☷", "hero-arrow-path": "↻", "hero-bolt": "ϟ",
}

const atlasSvgIcons = {
  "hero-bars-3": "<path d='M4 6h16M4 12h16M4 18h16'/>",
  "hero-user": "<circle cx='12' cy='7' r='4'/><path d='M4 21v-2a8 8 0 0 1 16 0v2z'/>",
  "hero-archive-box": "<path d='M3 7 12 3l9 4v13H3zM3 7l9 4 9-4M12 11v9'/>",
  "hero-wrench-screwdriver": "<path d='m4 20 9-9a6 6 0 0 1 7-7l-4 4 3 3 4-4a6 6 0 0 1-7 7l-9 9z'/>",
  "hero-signal": "<circle cx='12' cy='12' r='2'/><path d='M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16'/>",
  "hero-clipboard-document-list": "<rect x='5' y='4' width='14' height='18' rx='2'/><rect x='9' y='2' width='6' height='4' rx='1'/><path d='M9 10h6M9 14h6M9 18h6'/>"
}

function nativeHotbar() {
  return Array.from({length: 10}, (_, i) => {
    const slot = i + 1
    const key = slot === 10 ? "0" : String(slot)
    return [
      '<button id="hotbar-slot-' + slot + '" type="button" data-hotbar-slot="' + slot + '" aria-label="' + key + ' Empty" aria-pressed="false"',
      'class="hotbar-slot hotbar-slot-empty group relative aspect-square min-w-0 overflow-hidden rounded-lg border border-slate-800/90 bg-slate-900/90 text-slate-500 transition duration-150 focus:outline-none focus:ring-2 focus:ring-cyan-300/60 active:scale-95 sm:rounded-xl">',
      '<span data-hotbar-cooldown class="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-0 bg-slate-950/75 transition-[height] duration-100"></span>',
      '<span class="absolute left-1 top-0.5 z-20 font-mono text-[0.5rem] font-bold text-slate-500 sm:left-1.5 sm:top-1 sm:text-[0.58rem]">' + key + '</span>',
      '<span class="relative z-20 grid h-full place-items-center text-cyan-200">ϟ</span>',
      '<span data-hotbar-label class="pointer-events-none absolute inset-x-1 bottom-0.5 z-20 hidden truncate text-[0.42rem] font-semibold text-cyan-100 sm:block">Empty</span>',
      '</button>',
    ].join("\n")
  }).join("\n")
}

export function convertGameMarkup(template) {
  // Windows checkout uses CRLF; normalize before locating HEEx delimiters.
  template = template.replace(/\r\n?/g, "\n")
  if (!template.includes('<div\n  id="game-client"') ||
      !template.includes("<%= for slot <- @action_hotbar do %>")) {
    throw Error("Game template structure changed; review native markup conversion before shipping.")
  }

  let game = template.replace(/<%!--[\s\S]*?--%>/g, "")
  const first = game.indexOf("<%= for slot <- @action_hotbar do %>")
  const marker = "      <% end %>\n    </div>\n  </nav>"
  const last = game.indexOf(marker, first)
  if (last < first || last < 0) {
    throw Error("Unable to locate the closing hotbar loop in the game template.")
  }
  game = game.slice(0, first) + nativeHotbar() + "\n" +
    game.slice(last + "      <% end %>".length)
  // Native CSP rejects inline HTML style attributes. Put initially closed
  // overlays under an external CSS default instead. Existing CSSOM writes
  // to element.style.display override that default when a panel opens/closes.
  game = game
    .replace(/\bstyle="display:\s*none\s*;?"/g, 'data-native-initially-hidden')
    .replace('id="game-client"', 'id="game-client" hidden')
    .replace("data-socket-token={@socket_token}",
      'data-socket-token="" data-server-origin="" data-native-client="true"')
    .replace("data-layout-player-id={@layout_player_id}", 'data-layout-player-id=""')
    .replace(/href=\{~p"\/equipment"\}/g, 'href="#" data-native-equipment')
    .replace(/<\.form\b[\s\S]*?>/,
      '<form id="pilot-logout-form" class="pointer-events-auto">')
    .replace("</.form>", "</form>")
    .replace(/<\.icon\b[^>]*\/>/g, tag => {
      const name = tag.match(/name="([^"]+)"/)?.[1] || ""
      const klass = tag.match(/class="([^"]+)"/)?.[1] || ""
      if (atlasSvgIcons[name]) return '<svg class="' + klass + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + atlasSvgIcons[name] + "</svg>"
      return '<span class="' + klass + '" aria-hidden="true">' +
        (icons[name] || "•") + "</span>"
    })

  if (/<%|<\/?\.|{@|{~p"|{slot\.|{if slot/.test(game)) {
    throw Error("Unresolved Phoenix template expressions in native game markup.")
  }
  return game
}

export function nativeGameDocument(markup) {
  return [
    '<!doctype html>',
    '<html lang="en"><head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="theme-color" content="#020914">',
    '<title>SpaceNova — Standalone Game</title>',
    '<link rel="stylesheet" href="./native_game.css">',
    '<link rel="stylesheet" href="./spacenova-home.css">',
    '<link rel="stylesheet" href="./native_shell.css">',
    '<script type="module" src="./native_bootstrap.mjs"></script>',
    '</head><body>',
    '<section id="native-login" class="native-login nova-title-screen" aria-label="Pilot authentication">',
    '<div class="nova-main">',
    '<header class="nova-brand">',
    '<h1 class="nova-wordmark">Space<span>Nova</span></h1>',
    '<p class="nova-tagline">Space exploration <span>·</span> Trade <span>·</span> Combat <span>·</span> Adventure</p>',
    '</header>',
    '<div class="native-login-card">',
    '<p class="native-eyebrow">PILOT AUTHENTICATION / SECURE UPLINK</p>',
    '<h2>Welcome to the flight deck.</h2>',
    '<p class="native-server">Server: <span id="native-server-name"></span></p>',
    '<form id="native-login-form">',
    '<label for="native-username">Pilot username</label>',
    '<input id="native-username" name="username" autocomplete="username" autofocus required maxlength="80">',
    '<label for="native-password">Password</label>',
    '<input id="native-password" type="password" name="password" autocomplete="current-password" required maxlength="512">',
    '<p id="native-login-error" role="alert" hidden></p>',
    '<button id="native-login-submit" class="nova-button nova-button-primary" type="submit">Sign in and launch</button>',
    '</form>',
    '<div class="native-login-links"><a id="native-password-reset" href="#">Forgot your password?</a>',
    '<a href="./index.html">← Return to launcher / network settings</a></div>',
    '</div>',
    '</div>',
    '<footer class="nova-footer"><span>SpaceNova · Solar System playtest</span><span>Desktop client · Live multiplayer</span></footer>',
    '</section>',
    '<div id="native-session-status" class="native-session-status" role="status" aria-live="polite">Local rendering / awaiting pilot authentication</div>',
    markup,
    '</body></html>',
  ].join("\n")
}

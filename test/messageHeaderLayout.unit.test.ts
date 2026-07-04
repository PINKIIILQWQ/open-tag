// Unit regression for chat message agent header layout.
// Run: npx tsx --test --test-force-exit test/messageHeaderLayout.unit.test.ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const chatSrc = fs.readFileSync(new URL("../web/src/views/Chat.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../web/src/styles.css", import.meta.url), "utf8");

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  assert.ok(m, `missing CSS rule for ${selector}`);
  return m[1]!;
}

test("member badge renders on a second header line while agent status text remains", () => {
  assert.match(chatSrc, /className="msg-subhead"/);
  assert.match(chatSrc, /isMember \? <div className="msg-subhead"><span className="member-badge">member<\/span><\/div> : null/);
  assert.match(chatSrc, /const agActivity = agentActivityText\(ag\);/);
  assert.match(chatSrc, /className=\{"msg-activity "\s*\+\s*agLive\}/);
  assert.match(chatSrc, /className="msg-role"/);
  assert.doesNotMatch(chatSrc, /<div className="msg-head">[\s\S]{0,700}\{isMember \? <span className="member-badge">member<\/span> : null\}/);
});

test("message avatar is the positioning anchor for the live status dot", () => {
  const body = ruleBody(".msg-av");
  assert.match(body, /position\s*:\s*relative\b/, `avatar wrapper must anchor .av-status: ${body}`);
  assert.match(body, /width\s*:\s*36px\b/, `avatar wrapper should hug the avatar so .av-status overlaps the avatar, not the whole column: ${body}`);
  assert.match(body, /margin-top\s*:\s*3px\b/, `avatar should sit slightly lower against the two-line message header: ${body}`);
  assert.match(body, /align-self\s*:\s*start\b/, `avatar wrapper must not stretch to message height: ${body}`);
  assert.match(body, /justify-self\s*:\s*start\b/, `avatar should stay anchored inside the fixed avatar column: ${body}`);
  assert.match(body, /line-height\s*:\s*0\b/, `avatar wrapper should not add extra inline height: ${body}`);
});

test("message first line keeps name and timestamp together", () => {
  const head = ruleBody(".msg-head");
  assert.match(head, /align-items\s*:\s*baseline\b/);
  assert.match(head, /gap\s*:\s*7px\b/);
  const ts = ruleBody(".msg-head .ts");
  assert.match(ts, /margin-left\s*:\s*0\b/, `timestamp spacing should be controlled by .msg-head gap: ${ts}`);
});

test("app chrome headings keep the upstream classic title face", () => {
  const titleFace = /font-family\s*:\s*'EB Garamond','Times New Roman',serif/;
  assert.match(ruleBody(".sb-title"), titleFace, "sidebar section titles should not inherit the Markdown/body font experiment");
  const headTitle = ruleBody(".head h1");
  assert.match(headTitle, titleFace, "main channel/page header titles should keep the upstream title face");
  assert.match(headTitle, /font-weight\s*:\s*400\b/, "main channel/page header titles should keep the upstream lighter weight");
  assert.match(ruleBody(".thread-head"), titleFace, "thread panel title should keep the same upstream title face");
});

test("avatar status dot covers the same agent state colors as live dots", () => {
  assert.match(css, /--status-blue:#92B6FF/i);
  assert.match(css, /--status-green:hsl\(137 36% 64%\)/);
  assert.match(css, /--status-orange:hsl\(46 66% 50%\)/);
  assert.match(css, /--status-badge-bg:rgba\(240,239,237,.4\)/);
  assert.match(css, /\.dot\.sleeping\{background:var\(--status-blue\)\}/);
  assert.match(css, /\.dot\.online,\.dot\.active\{background:var\(--status-green\)\}/);
  assert.match(css, /\.dot\.working,\.dot\.thinking\{background:var\(--status-orange\)\}/);
  assert.match(css, /\.dot\.error\{background:var\(--status-red\)\}/);
  assert.match(css, /\.av-status\.sleeping\{background:var\(--status-blue\)\}/);
  assert.match(css, /\.av-status\.offline,\.av-status\.inactive\{background:var\(--muted-soft\)\}/);
  assert.match(css, /\.av-status\.online,\.av-status\.active\{background:var\(--status-green\)\}/);
  assert.match(css, /\.av-status\.working,\.av-status\.thinking\{background:var\(--status-orange\)\}/);
  assert.match(css, /\.av-status\.error\{background:var\(--status-red\)\}/);
});

test("message body has breathing room after the second header line", () => {
  const body = ruleBody(".msg-subhead + .mbody");
  assert.match(body, /margin-top\s*:\s*8px\b/, `message body should not sit tight against the second header line: ${body}`);
});

test("agent activity badge uses a quiet code style without colored outline", () => {
  const body = ruleBody(".msg-activity");
  assert.match(body, /border\s*:\s*0\b/, `activity badge must not draw a colored outline: ${body}`);
  assert.doesNotMatch(body, /border-color\s*:/, `activity badge base rule should not set border-color: ${body}`);
  assert.match(css, /\.msg-activity\.sleeping\{color:var\(--status-blue\);background:var\(--status-badge-bg\)\}/);
  assert.match(css, /\.msg-activity\.online,\.msg-activity\.active\{color:var\(--status-green\);background:var\(--status-badge-bg\)\}/);
  assert.match(css, /\.msg-activity\.working,\.msg-activity\.thinking\{color:var\(--status-orange\);background:var\(--status-badge-bg\)\}/);
});

test("avatar status dot pulses only while the agent is working", () => {
  const working = ruleBody(".av-status.working::after");
  assert.match(working, /animation\s*:\s*lb-ping\b/, `working avatar status should reuse live-bar pulse: ${working}`);
  assert.doesNotMatch(css, /\.av-status\.thinking::after/, "thinking status should not pulse");
  assert.doesNotMatch(css, /\.av-status\.sleeping::after/, "sleeping status should not pulse");
});

test("generic working status dots reuse the live pulse without animating thinking", () => {
  const base = ruleBody(".dot.working:not(.live-bar__pip)");
  assert.match(base, /position\s*:\s*relative\b/, `generic working status dots should anchor their pulse locally: ${base}`);
  assert.doesNotMatch(css, /\.dot\.working\{position:relative\}/, "generic working rule must not override live-bar pip positioning");
  const working = ruleBody(".dot.working:not(.live-bar__pip)::after");
  assert.match(working, /animation\s*:\s*lb-ping\b/, `generic working status dots should reuse live-bar pulse: ${working}`);
  assert.doesNotMatch(css, /\.dot\.thinking::after/, "thinking status should not pulse");
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.live-bar__pip::after,\.dot\.working:not\(\.live-bar__pip\)::after,\.av-status\.working::after\{animation:none;opacity:0\}\}/);
});

test("message hover uses a subtle border instead of a filled background", () => {
  const base = ruleBody(".msg");
  assert.match(base, /display\s*:\s*grid\b/, `message row should use a fixed avatar column plus content column: ${base}`);
  assert.match(base, /grid-template-columns\s*:\s*44px minmax\(0,1fr\)/, `avatar column should be fixed while content owns the right column: ${base}`);
  assert.match(base, /max-width\s*:\s*calc\(var\(--read-measure\) \+ 72px\)/, `message row should center avatar and body as one readable block: ${base}`);
  assert.match(base, /margin\s*:\s*0 auto 8px\b/, `message row should stay compact now that the reaction footer is restored: ${base}`);
  assert.match(base, /padding\s*:\s*7px 12px 5px\b/, `message row should keep the footer close to the last text line: ${base}`);
  assert.match(base, /transition\s*:\s*box-shadow \.5s ease\b/, `message card shadow should ease softly: ${base}`);
  assert.match(base, /box-shadow\s*:\s*inset 0 0 0 \.5px rgba\(87,96,106,\.10\)/, `message card should keep a permanent 10% hairline: ${base}`);

  const hover = ruleBody(".msg:hover");
  assert.match(hover, /background\s*:\s*transparent\b/, `hover must not dim or gray-fill message body: ${hover}`);
  assert.match(hover, /box-shadow\s*:\s*inset 0 0 0 \.5px rgba\(87,96,106,\.18\),0 6px 18px rgba\(15,23,42,\.035\)/, `hover should raise the hairline to 18% while keeping the smaller shadow: ${hover}`);
});

test("new messages expand from below so existing messages move smoothly", () => {
  const frames = css.match(/@keyframes msg-enter\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(frames, /transform:\s*translateY\(18px\)/, `message should start below its final position: ${frames}`);
  assert.match(frames, /max-height:0/, `message should start collapsed so it pushes prior messages smoothly: ${frames}`);
  assert.match(frames, /max-height:40rem/, `message should expand during enter animation: ${frames}`);
  const enter = ruleBody(".msg-enter");
  assert.match(enter, /overflow\s*:\s*hidden\b/, `entering messages should clip during height expansion: ${enter}`);
  assert.match(enter, /animation-duration\s*:\s*1s\b/, `human and persisted messages should finish their enter animation in 1 second: ${enter}`);
  assert.match(enter, /animation-timing-function\s*:\s*var\(--ease-expo\)/, `enter animation should move fast first and slow down: ${enter}`);
  assert.match(enter, /animation-fill-mode\s*:\s*backwards\b/, `enter animation should not leave max-height constraints after completion: ${enter}`);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.msg-enter\{animation:none\}\}/, "reduced-motion users should not get message enter movement");
});

test("message toolbar stays inside the message border and exposes save/copy/more directly", () => {
  assert.match(chatSrc, /const copyMarkdown = \(content: string\) => \{ navigator\.clipboard\?\.writeText\(content\)\.catch\(\(\) => \{\}\); \};/);
  assert.match(chatSrc, /<button className=\{isSaved \? "on" : ""\} title=\{isSaved \? t\("chat\.unsave"\) : t\("chat\.saveMessage"\)\} onClick=\{\(\) => \{ isSaved \? unsaveMsg\(m\.id\) : saveMsg\(m\.id\); \}\}><Bookmark size=\{15\} fill=\{isSaved \? "currentColor" : "none"\} \/><\/button>/);
  assert.match(chatSrc, /<button title=\{t\("chat\.copyMarkdown"\)\} onClick=\{\(\) => copyMarkdown\(m\.content\)\}><Clipboard size=\{15\} \/><\/button>/);
  assert.match(chatSrc, /<button title=\{t\("chat\.more"\)\} onClick=\{\(e\) => \{ const r = e\.currentTarget\.getBoundingClientRect\(\); setCtxMenu\(\{ m, x: r\.right - 212, y: r\.bottom \+ 4 \}\); \}\}><MoreHorizontal size=\{15\} \/><\/button>/);
  assert.match(chatSrc, /className="ctx-item" onClick=\{\(\) => copy\(m\.content\)\}/);

  const toolbar = ruleBody(".msg-toolbar");
  assert.match(toolbar, /top\s*:\s*7px\b/, `toolbar should sit inside the message border: ${toolbar}`);
  assert.match(toolbar, /right\s*:\s*10px\b/, `toolbar should sit inside the message border: ${toolbar}`);
  assert.match(toolbar, /background\s*:\s*transparent\b/, `toolbar must not look like a detached floating pill: ${toolbar}`);
  assert.match(toolbar, /border\s*:\s*0\b/, `toolbar must not draw a separate border: ${toolbar}`);
  assert.match(toolbar, /box-shadow\s*:\s*none\b/, `toolbar must not cast a floating shadow: ${toolbar}`);
  assert.match(toolbar, /transition\s*:\s*opacity \.5s ease\b/, `toolbar should fade in with the message hairline timing: ${toolbar}`);
  assert.match(ruleBody(".msg-toolbar button.on"), /color\s*:\s*var\(--ink\)/, "saved toolbar button should render as filled/dark");
});

test("reaction footer keeps the upstream add-reaction entry even with no reactions", () => {
  assert.doesNotMatch(chatSrc, /if \(!rs\.length\) return null;/);
  assert.match(chatSrc, /<div className="msg-rx">/);
  assert.match(chatSrc, /<button className="rx-add" title=\{i18n\.t\("chat\.addReaction"\)\}/);
  const add = ruleBody(".rx-add");
  assert.match(add, /border\s*:\s*0\b/, `add-reaction should not draw an outer pill border: ${add}`);
  assert.match(add, /background\s*:\s*transparent\b/, `add-reaction should read as a bare icon affordance: ${add}`);
  assert.match(add, /opacity\s*:\s*0\b/, `add-reaction should stay quiet until hover/focus: ${add}`);
  assert.match(add, /transition\s*:\s*opacity \.5s ease\b/, `add-reaction should fade in with the message hairline timing: ${add}`);
  assert.match(chatSrc, /<Smile size=\{17\}/, "add-reaction smile icon should be slightly larger without restoring the old border");
});

test("composer removes the hard divider and aligns its input with the message column", () => {
  const mainScroll = ruleBody("main.content-col > .scroll");
  assert.match(mainScroll, /padding-bottom\s*:\s*176px\b/, `main chat scroller should reserve space for the overlaid composer: ${mainScroll}`);
  assert.match(mainScroll, /background\s*:\s*var\(--surface\)/, `message scroller should keep the scrollbar rail pure white: ${mainScroll}`);
  assert.doesNotMatch(mainScroll, /border-right\s*:/, `message scroller should not draw a hard line beside the scrollbar: ${mainScroll}`);
  assert.match(ruleBody("main.content-col > .scroll::-webkit-scrollbar-track"), /background\s*:\s*var\(--surface\)/, "scrollbar track should stay white");
  assert.doesNotMatch(ruleBody("main.content-col > .scroll::-webkit-scrollbar-track"), /border-left\s*:/, "scrollbar track should not draw a vertical rail line");
  const thumb = ruleBody("main.content-col > .scroll::-webkit-scrollbar-thumb");
  assert.match(thumb, /background\s*:\s*rgba\(87,96,106,\.32\)/, "scrollbar thumb should remain visible on the white track");
  assert.match(thumb, /border\s*:\s*3px solid var\(--surface\)/, "scrollbar thumb should be inset without reintroducing a rail line");

  const composer = ruleBody(".composer");
  assert.match(composer, /border-top\s*:\s*0\b/, `composer should not draw a hard horizontal divider: ${composer}`);
  assert.match(composer, /background\s*:\s*var\(--surface\)/, `composer base should stay opaque below the fade: ${composer}`);
  assert.match(composer, /padding\s*:\s*20px 28px 26px\b/, `composer inner padding should stay symmetric once the container avoids the scroller gutter: ${composer}`);

  const mainComposer = ruleBody("main.content-col > .composer");
  assert.match(mainComposer, /position\s*:\s*absolute\b/, `main chat composer should overlay instead of shortening the scroller: ${mainComposer}`);
  assert.match(mainComposer, /right\s*:\s*var\(--scrollbar-gutter\)/, `main chat composer should not cover the scrollbar gutter: ${mainComposer}`);
  assert.match(mainComposer, /bottom\s*:\s*0\b/, `main chat composer should pin to the bottom: ${mainComposer}`);

  const fade = ruleBody(".composer::before");
  assert.match(fade, /left\s*:\s*0(?:;|$)/, `composer fade should span the composer container so there is no visible side cut: ${fade}`);
  assert.match(fade, /right\s*:\s*0(?:;|$)/, `composer fade should span the composer container so there is no visible side cut: ${fade}`);
  assert.doesNotMatch(fade, /max-width\s*:/, `composer fade should avoid finite-width side edges: ${fade}`);
  assert.match(fade, /top\s*:\s*-30px\b/, `composer fade should be thinner and sit close to the input: ${fade}`);
  assert.match(fade, /height\s*:\s*30px\b/, `composer fade should not consume too much reading space: ${fade}`);
  assert.doesNotMatch(fade, /transform\s*:/, `composer fade should not need centering transforms that create side boundaries: ${fade}`);
  assert.doesNotMatch(fade, /clip-path\s*:/, `composer fade should not use hard-clipped edges: ${fade}`);
  assert.match(fade, /linear-gradient\(to bottom,rgba\(255,255,255,0\),rgba\(255,255,255,\.58\) 72%,var\(--surface\)\)/, `composer fade should stay translucent until it disappears against the input: ${fade}`);
  assert.doesNotMatch(fade, /mask-image\s*:/, `composer fade should avoid mask seams at the side edges: ${fade}`);
  assert.match(fade, /pointer-events\s*:\s*none\b/, `composer fade should not block scroll or message clicks: ${fade}`);

  const box = ruleBody(".composer-box");
  assert.match(box, /max-width\s*:\s*calc\(var\(--read-measure\) \+ 72px\)/, `composer box should align to the message card width: ${box}`);
  assert.match(box, /margin\s*:\s*0 auto\b/, `composer box should be centered with messages: ${box}`);
  assert.match(box, /border\s*:\s*0\b/, `composer should avoid a full 1px border: ${box}`);
  assert.match(box, /box-shadow\s*:\s*inset 0 0 0 \.5px var\(--card-line-strong\),0 10px 30px rgba\(15,23,42,\.055\)/, `composer border should match the fine message hover line: ${box}`);
  assert.match(box, /padding\s*:\s*10px 14px 10px\b/, `composer box should give toolbar icons room without inflating the card: ${box}`);
  assert.match(box, /transition\s*:\s*box-shadow \.5s ease\b/, `composer focus shadow should ease softly: ${box}`);
  assert.equal(ruleBody(".composer-box:hover"), "box-shadow:inset 0 0 0 .5px var(--card-line-strong),0 10px 30px rgba(15,23,42,.055)", "composer hover should not change the resting visual state");
  assert.match(ruleBody(".composer-box:focus-within"), /box-shadow\s*:\s*inset 0 0 0 \.5px var\(--card-line-strong\),0 12px 34px rgba\(15,23,42,\.065\)/, "composer focus can keep a slightly stronger depth cue");

  const input = ruleBody(".composer-input");
  assert.match(input, /font-size\s*:\s*15px\b/, `composer input text should match message markdown body size: ${input}`);

  const bar = ruleBody(".composer-bar");
  assert.match(bar, /min-height\s*:\s*30px\b/, `composer toolbar should reserve a stable icon row height: ${bar}`);
  assert.match(bar, /margin-top\s*:\s*8px\b/, `composer toolbar should not crowd the input text: ${bar}`);
  const cbIcon = ruleBody(".cb-icon");
  assert.match(cbIcon, /width\s*:\s*28px\b/, `composer utility icons should use a stable button box: ${cbIcon}`);
  assert.match(cbIcon, /height\s*:\s*28px\b/, `composer utility icons should use a stable button box: ${cbIcon}`);
  assert.match(cbIcon, /justify-content\s*:\s*center\b/, `composer utility icons should be centered in their box: ${cbIcon}`);
  const cbIconSvg = ruleBody(".cb-icon svg");
  assert.match(cbIconSvg, /width\s*:\s*15px\b/, `composer utility icons should be lighter than the old 16px default: ${cbIconSvg}`);
  assert.match(cbIconSvg, /height\s*:\s*15px\b/, `composer utility icons should be lighter than the old 16px default: ${cbIconSvg}`);
  const send = ruleBody(".send-btn");
  assert.match(send, /width\s*:\s*32px\b/, `send button should be compact but still tappable: ${send}`);
  assert.match(send, /height\s*:\s*32px\b/, `send button should be compact but still tappable: ${send}`);

  const chatHead = ruleBody(".chat-head");
  assert.match(chatHead, /border-bottom\s*:\s*0\b/, `chat header should not draw a hard divider above messages: ${chatHead}`);
  assert.match(chatHead, /position\s*:\s*relative\b/, `chat header should anchor its soft fade: ${chatHead}`);
  const topFade = ruleBody(".chat-head::after");
  assert.match(topFade, /linear-gradient\(to bottom,var\(--surface\),rgba\(255,255,255,\.72\) 32%,rgba\(255,255,255,0\)\)/, `chat header should use a soft fade instead of a line: ${topFade}`);
  assert.match(topFade, /pointer-events\s*:\s*none\b/, `chat header fade should not block scroll or clicks: ${topFade}`);
  assert.doesNotMatch(ruleBody("aside.traj-col"), /border-left\s*:/, "trajectory panel should not draw a hard vertical divider");
  assert.doesNotMatch(ruleBody(".thread-panel"), /border-left\s*:/, "thread panel should not draw a hard vertical divider");

  const jump = ruleBody(".jump-bottom");
  assert.match(jump, /bottom\s*:\s*154px\b/, `jump button should float above the composer with visible air: ${jump}`);
  assert.match(jump, /width\s*:\s*32px\b/, `jump button should become a compact icon button: ${jump}`);
  assert.match(jump, /height\s*:\s*32px\b/, `jump button should become a compact icon button: ${jump}`);
  assert.match(jump, /background\s*:\s*var\(--surface\)/, `jump button should use a white surface instead of a black pill: ${jump}`);
  assert.match(jump, /color\s*:\s*var\(--ink-2\)/, `jump arrow should stay dark on white: ${jump}`);
  assert.match(jump, /border\s*:\s*0\b/, `jump button should not use a full 1px border: ${jump}`);
  assert.match(jump, /box-shadow\s*:\s*inset 0 0 0 \.5px var\(--card-line-strong\),0 8px 24px rgba\(15,23,42,\.12\)/, `jump button should share the fine message-border weight: ${jump}`);
  assert.match(jump, /font-size\s*:\s*0\b/, `jump button should hide the text label visually: ${jump}`);
  assert.match(ruleBody(".jump-bottom svg"), /width\s*:\s*17px\b/, "jump button should emphasize the arrow icon");

  assert.match(css, /@media \(max-width:700px\)\{[\s\S]*?--read-pad:16px[\s\S]*?\.scroll\{padding-left:16px;padding-right:16px\}/, "mobile chat should reduce side gutters and give width back to message cards");

  const meta = ruleBody(".msg-meta");
  assert.match(meta, /margin-top\s*:\s*4px\b/, `reaction footer should sit closer to the last text line: ${meta}`);
});

test("composer uses reachability as placeholder instead of a separate wake hint row", () => {
  const composerSrc = fs.readFileSync(new URL("../web/src/views/Composer.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(composerSrc, /className="wake-hint/, "wake state should no longer render as a separate row above the composer");
  assert.match(composerSrc, /const reachPlaceholder = reach \?/, "reachability state should feed the textarea placeholder");
  assert.match(composerSrc, /reach\.kind === "off" \? t\("chat\.machineOfflineComposerPlaceholder"/, "offline machine hint should have a composer placeholder");
  assert.match(composerSrc, /t\("chat\.agentSleepingComposerPlaceholder"/, "sleeping agent hint should have a composer placeholder");
});

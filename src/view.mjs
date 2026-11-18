import { doorState, specialDays, unlockAt } from './calendar.mjs';
export const escape = value => String(value).replace(/[&<>"']/g, char =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export function page(t, lang, body) {
  return `<!doctype html><html lang="${escape(lang)}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>${escape(t.title)}</title><link rel="stylesheet" href="/assets/style.css">
<script type="module" src="/assets/countdown.js"></script></head><body>
<header><a href="/">✦ &nbsp;${escape(t.welcome)}</a><span aria-hidden="true">✦</span></header>
<main id="principal">${body}</main><footer aria-hidden="true">✧ &nbsp; ✦ &nbsp; ✧</footer></body></html>`;
}

export function countdown(t, calendar, now) {
  const times = calendar.days.map(({day}) => unlockAt(calendar, day));
  const next = times.find(time => time > now);
  if (!next) {
    if (!calendar.todayOnly) return `<p class="count">${escape(t.all)}</p>`;
    const end = unlockAt(calendar, 25);
    return now >= end ? `<p class="count">${escape(t.ended)}</p>` :
      `<span hidden data-refresh-after="${end - now}"></span>`;
  }
  return `<div class="count"><span>${escape(t.next)}</span><time datetime="${new Date(next).toISOString()}" data-remaining="${next - now}" data-units="${escape(JSON.stringify(t.units))}">${escape(new Intl.DateTimeFormat(calendar.language, {dateStyle:'long', timeZone:calendar.timezone}).format(next))}</time></div>`;
}

export function welcome(t, calendar, now, demo, error) {
  return `<section class="hero"><span class="ornament" aria-hidden="true">✦</span>
${demo ? `<p class="eyebrow">${escape(t.demo)}</p>` : ''}
<h1>${escape(t.title)}</h1><p class="intro">${escape(t.intro)}</p>
${calendar ? countdown(t, calendar, now) + `<a class="button" href="/calendario">${escape(t.enter)} <span aria-hidden="true">↗</span></a>` :
`<form method="post" action="/acceso"><label for="code">${escape(t.code)}</label>
<input id="code" name="code" type="password" maxlength="256" autocomplete="current-password" required>
${error ? `<p role="alert">${escape(error)}</p>` : ''}<button>${escape(t.login)}</button></form>`}</section>`;
}

export function grid(t, calendar, now, privateMode) {
  return `<section class="calendar"><p class="eyebrow">${calendar.year}</p><h1>${escape(t.calendar)}</h1>
<p>${escape(calendar.todayOnly ? t.todayOnly : t.soon)}</p>${countdown(t, calendar, now)}
<ol class="doors">${calendar.days.map(({day}) => {
  const open = doorState(calendar, day, now) === 'open';
  return `<li><a class="door ${specialDays.has(day) ? 'special' : ''} ${open ? 'open' : ''}" href="/contenido/${day}" aria-label="${escape(t.day)} ${day}${open ? '' : ', ' + escape(t.locked)}">
<span aria-hidden="true">${day}</span><small>${escape(day === 24 ? t.finale : specialDays.has(day) ? t.special : open ? '✦' : '◇')}</small></a></li>`;
}).join('')}</ol>${privateMode ? `<form method="post" action="/salir"><button class="subtle">${escape(t.logout)}</button></form>` : ''}</section>`;
}

export function door(t, calendar, day, now, demo) {
  const entry = calendar.days[day - 1];
  const time = unlockAt(calendar, day);
  const state = doorState(calendar, day, now);
  const open = state === 'open';
  const date = new Intl.DateTimeFormat(calendar.language, {dateStyle:'full', timeZone:calendar.timezone}).format(time);
  return `<article class="letter"${calendar.todayOnly && open ? ` data-refresh-after="${unlockAt(calendar, day + 1) - now}"` : ''}><a class="back" href="/calendario">← ${escape(t.back)}</a>
<p class="eyebrow">${escape(t.day)} ${day}${day === 24 ? ' · ' + escape(t.finale) : ''}</p>
<h1>${escape(open ? entry.title : t.locked)}</h1>
${open ? `<img width="960" height="640" src="${demo ? '/demo/invierno.svg' : '/foto/' + day}" alt="${escape(entry.alt || t.photo)}">
<p class="message">${escape(entry.message)}</p>${day === 24 ? '<div class="finale" aria-hidden="true">✧ ✦ ✧</div>' : ''}` : state === 'past' ? `<p>${escape(t.past)}</p>` :
`<p>${escape(t.opens)} <time datetime="${new Date(time).toISOString()}">${escape(date)}</time>.</p>`}</article>`;
}

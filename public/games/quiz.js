// Scout Quiz: Kahoot-style. Big screen shows the question, phones show it too, with 4 coloured buttons.
// Each question: [category, question, correct answer, wrong, wrong, wrong]. Correct is shuffled at runtime.
export const QUESTIONS = {
  en: [
    ['📻', 'Radio alphabet: which word stands for S?', 'Sierra', 'Sugar', 'Samba', 'Sunny'],
    ['📻', 'Radio alphabet: which word stands for J?', 'Juliett', 'Jungle', 'Jupiter', 'Jamboree'],
    ['📻', 'Kilo – November – Oscar – Tango spells…', 'KNOT', 'KNIT', 'NOTE', 'KNOB'],
    ['📻', 'Radio alphabet: “Echo” is which letter?', 'E', 'X', 'O', 'H'],
    ['📻', 'What does JOTA stand for?', 'Jamboree On The Air', 'Join Others Talking Abroad', 'Jamboree Of Tent Adventures', 'Just Over The Antenna'],
    ['📻', 'What does JOTI stand for?', 'Jamboree On The Internet', 'Join Our Team Instantly', 'Jamboree Of Tiny Islands', 'Just Online To Interact'],
    ['📻', 'A radio amateur calls “CQ CQ CQ”. What does it mean?', 'Calling any station', 'I am leaving now', 'Please repeat', 'Battery low'],
    ['📻', 'What is SOS in Morse code?', '··· −−− ···', '−−− ··· −−−', '·−· ·−· ·−·', '·· −− ··'],
    ['📻', 'Radio amateurs often end with “73”. What does it mean?', 'Best regards', 'See you at 7:30', 'Message 73 received', 'Channel 73'],
    ['📻', 'What is a QSL card?', 'A card confirming a radio contact', 'A radio licence', 'A list of frequencies', 'A membership card'],
    ['📻', 'The Q-code “QTH” means…', 'My location is…', 'Stop sending', 'Who is calling me?', 'There is interference'],
    ['📻', 'Call signs starting with “DL” come from…', 'Germany', 'Denmark', 'Poland', 'Netherlands'],
    ['📻', 'Call signs starting with “PA” come from…', 'Netherlands', 'Panama', 'Paraguay', 'Portugal'],
    ['📻', 'Call signs starting with “VK” come from…', 'Australia', 'Vietnam', 'Venezuela', 'Kenya'],
    ['📻', 'In which month is JOTA-JOTI every year?', 'October', 'July', 'February', 'December'],
    ['⚜️', 'Who founded Scouting?', 'Robert Baden-Powell', 'Charles Darwin', 'Roald Amundsen', 'Florence Nightingale'],
    ['⚜️', 'Where was the first experimental scout camp in 1907?', 'Brownsea Island', 'Isle of Wight', 'Gilwell Park', 'Kandersteg'],
    ['⚜️', 'What is the scout motto?', 'Be Prepared', 'Never Give Up', 'Stay Together', 'Look Wide'],
    ['⚜️', 'With which hand do scouts shake hands?', 'Left', 'Right', 'Both', 'They wave instead'],
    ['⚜️', 'How many fingers do you hold up for the scout sign?', '3', '2', '4', '5'],
    ['⚜️', 'What is the symbol of World Scouting?', 'Fleur-de-lis', 'Oak leaf', 'Compass rose', 'Campfire'],
    ['⚜️', 'In which country is the Kandersteg International Scout Centre?', 'Switzerland', 'Austria', 'Norway', 'Canada'],
    ['⚜️', 'Where is the 2027 World Scout Jamboree?', 'Poland', 'Brazil', 'Japan', 'Canada'],
    ['⚜️', 'When was the very first World Scout Jamboree?', '1920', '1907', '1945', '1969'],
    ['⚜️', 'In how many countries is there Scouting (WOSM)?', 'More than 170', 'About 50', 'About 100', 'Exactly 200'],
    ['⚜️', 'Founder’s Day, 22 February, is the birthday of…', 'Robert & Olave Baden-Powell', 'Queen Victoria', 'Neil Armstrong', 'Mahatma Gandhi'],
    ['🪢', 'Which knot joins two ropes of the same thickness?', 'Reef knot', 'Bowline', 'Clove hitch', 'Figure eight'],
    ['🪢', 'Which knot makes a loop that won’t slip — used in rescue?', 'Bowline', 'Reef knot', 'Sheet bend', 'Half hitch'],
    ['🪢', 'Which knot joins two ropes of different thickness?', 'Sheet bend', 'Reef knot', 'Clove hitch', 'Granny knot'],
    ['🪢', 'Which knot do you use to start a lashing?', 'Clove hitch', 'Bowline', 'Reef knot', 'Sheepshank'],
    ['🧭', 'Which star shows you north at night?', 'Polaris (North Star)', 'Sirius', 'Betelgeuse', 'Rigel'],
    ['🧭', 'Where does the sun rise?', 'East', 'West', 'North', 'South'],
    ['🧭', 'On a compass, which direction is 90°?', 'East', 'North', 'South', 'West'],
    ['🧭', 'Trail sign: two crossed sticks ✕ mean…', 'Don’t go this way', 'Treasure here', 'Camp here', 'Go straight on'],
    ['🌍', '“Leave No Trace” means…', 'Leave nature as you found it', 'Walk backwards to hide footprints', 'Never leave the campsite', 'Burn all your rubbish'],
  ],
  de: [
    ['📻', 'Internationales Funkalphabet: Welches Wort steht für S?', 'Sierra', 'Sonne', 'Samba', 'Salat'],
    ['📻', 'Internationales Funkalphabet: Welches Wort steht für J?', 'Juliett', 'Jaguar', 'Jupiter', 'Jamboree'],
    ['📻', 'Lima – Alfa – Golf – Echo – Romeo ergibt…', 'LAGER', 'REGAL', 'LAGEN', 'ALGER'],
    ['📻', 'Funkalphabet: Welcher Buchstabe ist „Echo“?', 'E', 'X', 'O', 'H'],
    ['📻', 'Wofür steht JOTA?', 'Jamboree On The Air', 'Join Others Talking Abroad', 'Jamboree Of Tent Adventures', 'Just Over The Antenna'],
    ['📻', 'Wofür steht JOTI?', 'Jamboree On The Internet', 'Join Our Team Instantly', 'Jamboree Of Tiny Islands', 'Just Online To Interact'],
    ['📻', 'Jemand funkt „CQ CQ CQ“. Was heißt das?', 'Allgemeiner Anruf an alle', 'Ich gehe jetzt', 'Bitte wiederholen', 'Akku leer'],
    ['📻', 'Wie sieht SOS im Morsecode aus?', '··· −−− ···', '−−− ··· −−−', '·−· ·−· ·−·', '·· −− ··'],
    ['📻', 'Funkamateure verabschieden sich oft mit „73“. Was heißt das?', 'Viele Grüße', 'Bis um 7:30', 'Nachricht 73 erhalten', 'Kanal 73'],
    ['📻', 'Was ist eine QSL-Karte?', 'Eine Karte, die einen Funkkontakt bestätigt', 'Ein Funkführerschein', 'Eine Frequenzliste', 'Ein Mitgliedsausweis'],
    ['📻', 'Der Q-Code „QTH“ bedeutet…', 'Mein Standort ist…', 'Hör auf zu senden', 'Wer ruft mich?', 'Es gibt Störungen'],
    ['📻', 'Rufzeichen mit „DL“ kommen aus…', 'Deutschland', 'Dänemark', 'Polen', 'den Niederlanden'],
    ['📻', 'Rufzeichen mit „PA“ kommen aus…', 'den Niederlanden', 'Panama', 'Paraguay', 'Portugal'],
    ['📻', 'Rufzeichen mit „VK“ kommen aus…', 'Australien', 'Vietnam', 'Venezuela', 'Kenia'],
    ['📻', 'In welchem Monat ist jedes Jahr JOTA-JOTI?', 'Oktober', 'Juli', 'Februar', 'Dezember'],
    ['⚜️', 'Wer hat die Pfadfinderbewegung gegründet?', 'Robert Baden-Powell', 'Charles Darwin', 'Roald Amundsen', 'Florence Nightingale'],
    ['⚜️', 'Wo fand 1907 das erste Probe-Pfadfinderlager statt?', 'Brownsea Island', 'Isle of Wight', 'Gilwell Park', 'Kandersteg'],
    ['⚜️', 'Wie lautet der Wahlspruch der Pfadfinder?', 'Allzeit bereit', 'Niemals aufgeben', 'Immer zusammen', 'Weit schauen'],
    ['⚜️', 'Mit welcher Hand geben sich Pfadfinder die Hand?', 'Links', 'Rechts', 'Mit beiden', 'Sie winken nur'],
    ['⚜️', 'Wie viele Finger zeigt man beim Pfadfindergruß?', '3', '2', '4', '5'],
    ['⚜️', 'Was ist das Symbol der Weltpfadfinderbewegung?', 'Lilie', 'Eichenblatt', 'Kompassrose', 'Lagerfeuer'],
    ['⚜️', 'In welchem Land liegt das internationale Pfadfinderzentrum Kandersteg?', 'Schweiz', 'Österreich', 'Norwegen', 'Kanada'],
    ['⚜️', 'Wo findet das World Scout Jamboree 2027 statt?', 'Polen', 'Brasilien', 'Japan', 'Kanada'],
    ['⚜️', 'Wann war das allererste World Scout Jamboree?', '1920', '1907', '1945', '1969'],
    ['⚜️', 'In wie vielen Ländern gibt es Pfadfinder (WOSM)?', 'Mehr als 170', 'Etwa 50', 'Etwa 100', 'Genau 200'],
    ['⚜️', 'Am 22. Februar (Thinking Day) haben Geburtstag…', 'Robert & Olave Baden-Powell', 'Queen Victoria', 'Neil Armstrong', 'Mahatma Gandhi'],
    ['🪢', 'Welcher Knoten verbindet zwei gleich dicke Seile?', 'Kreuzknoten', 'Palstek', 'Mastwurf', 'Achtknoten'],
    ['🪢', 'Welcher Knoten macht eine Schlaufe, die sich nicht zuzieht – z. B. zur Rettung?', 'Palstek', 'Kreuzknoten', 'Schotstek', 'Halber Schlag'],
    ['🪢', 'Welcher Knoten verbindet zwei unterschiedlich dicke Seile?', 'Schotstek', 'Kreuzknoten', 'Mastwurf', 'Altweiberknoten'],
    ['🪢', 'Mit welchem Knoten beginnt man einen Bund?', 'Mastwurf', 'Palstek', 'Kreuzknoten', 'Trompetenstek'],
    ['🧭', 'Welcher Stern zeigt nachts nach Norden?', 'Polarstern', 'Sirius', 'Beteigeuze', 'Rigel'],
    ['🧭', 'Wo geht die Sonne auf?', 'Im Osten', 'Im Westen', 'Im Norden', 'Im Süden'],
    ['🧭', 'Welche Richtung ist auf dem Kompass 90°?', 'Osten', 'Norden', 'Süden', 'Westen'],
    ['🧭', 'Waldläuferzeichen: Zwei gekreuzte Stöcke ✕ bedeuten…', 'Hier nicht lang', 'Hier ist ein Schatz', 'Hier zelten', 'Geradeaus'],
    ['🌍', '„Leave No Trace“ heißt…', 'Die Natur so verlassen, wie man sie vorgefunden hat', 'Rückwärts gehen, um Spuren zu verwischen', 'Den Lagerplatz nie verlassen', 'Allen Müll verbrennen'],
  ],
};
const TXT = {
  en: { q: 'Question', scores: 'SCORES', answered: 'answered', nobody: 'Nobody got it…', right: 'Correct!', wrong: '✗ Wrong', slow: '⏱ Too slow', answer: 'Answer:' },
  de: { q: 'Frage', scores: 'PUNKTE', answered: 'haben geantwortet', nobody: 'Keiner wusste es…', right: 'Richtig!', wrong: '✗ Falsch', slow: '⏱ Zu langsam', answer: 'Antwort:' },
};
const COUNT = 10, Q_S = 20;
const SHAPES = ['▲', '◆', '●', '■'], COLORS = ['#d4213d', '#1368ce', '#c98a00', '#26890c'];
const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);

export function start(api) {
  const t = TXT[api.lang] ?? TXT.en;
  const score = new Map(api.players.map(p => [p, 0]));
  const picks = new Map(); // player -> { i, at }
  const qs = shuffle(QUESTIONS[api.lang] ?? QUESTIONS.en).slice(0, COUNT);
  let n = -1, q, options, correct, t0, open = false, tick, next;

  api.stage.innerHTML = `<style>
    .qz { height: 100%; display: grid; grid-template-columns: 1fr 18em; gap: 2vw; padding: 2vw 3vw; }
    .qz main { display: flex; flex-direction: column; gap: 1.5vw; min-height: 0; }
    .qz .top { display: flex; justify-content: space-between; color: var(--muted); font-size: 1.2em; }
    .qz .bar { height: .6em; border-radius: .3em; background: var(--panel); overflow: hidden; }
    .qz .bar div { height: 100%; background: var(--fire); transition: width 1s linear; }
    .qz h2 { font-size: 2.6em; text-transform: none; letter-spacing: 0; color: var(--text); text-align: center; flex: 1; display: grid; place-items: center; }
    .qz .opts { display: grid; grid-template-columns: 1fr 1fr; gap: 1vw; }
    .qz .opt { display: flex; align-items: center; gap: .6em; padding: .8em 1em; border-radius: .6em; font-size: 1.6em; font-weight: 800; color: #fff; transition: opacity .3s, transform .3s; }
    .qz .opt b { font-size: 1.2em; }
    .qz .opt.dim { opacity: .2; } .qz .opt.win { transform: scale(1.03); outline: .2em solid #fff; }
    .qz .who { min-height: 2.2em; font-size: 1.4em; display: flex; flex-wrap: wrap; gap: .3em; }
    .qz aside { background: var(--panel); border-radius: 1em; padding: 1em; display: flex; flex-direction: column; gap: .4em; overflow: hidden; }
    .qz aside div { display: flex; gap: .5em; } .qz aside span:last-child { margin-left: auto; font-weight: 900; }
  </style>
  <div class="qz">
    <main>
      <div class="top"><span class="num"></span><span class="cat"></span></div>
      <div class="bar"><div></div></div>
      <h2></h2>
      <div class="opts"></div>
      <div class="who"></div>
    </main>
    <aside></aside>
  </div>`;
  const $ = s => api.stage.querySelector(s);

  function ask() {
    if (++n >= qs.length) return api.end([...score]);
    const [cat, text, ...answers] = qs[n];
    q = text;
    options = shuffle(answers);
    correct = options.indexOf(answers[0]);
    picks.clear();
    open = true;
    t0 = Date.now();
    $('.num').textContent = `${t.q} ${n + 1} / ${qs.length}`;
    $('.cat').textContent = cat;
    $('h2').textContent = text;
    $('.opts').innerHTML = options.map((o, i) => `<div class="opt" style="background:${COLORS[i]}"><b>${SHAPES[i]}</b><span>${api.esc(o)}</span></div>`).join('');
    $('.who').textContent = '';
    const bar = $('.bar div');
    bar.style.transition = 'none'; bar.style.width = '100%'; bar.offsetWidth; // restart the countdown bar
    bar.style.transition = `width ${Q_S}s linear`; bar.style.width = '0%';
    for (const p of score.keys()) sendQ(p);
    board();
    tick = setTimeout(reveal, Q_S * 1000);
  }
  const sendQ = p => api.send(p, { layout: 'choices', round: n, options, text: q, sub: `${t.q} ${n + 1} / ${qs.length}` });

  function reveal() {
    open = false;
    clearTimeout(tick);
    [...$('.opts').children].forEach((el, i) => el.classList.add(i === correct ? 'win' : 'dim'));
    for (const p of score.keys()) {
      const pk = picks.get(p), ok = pk?.i === correct;
      const pts = ok ? 50 + Math.round(50 * Math.max(0, 1 - (pk.at - t0) / (Q_S * 1000))) : 0;
      score.set(p, score.get(p) + pts);
      api.send(p, { layout: 'wait', text: ok ? `✓ ${t.right} +${pts}` : pk ? t.wrong : t.slow, sub: `${q}\n${t.answer} ${SHAPES[correct]} ${options[correct]}`, buzz: ok ? 80 : 300 });
    }
    $('.who').innerHTML = [...picks].filter(([, pk]) => pk.i === correct).map(([p]) => `<span title="${api.esc(p.name)}">${p.avatar}</span>`).join('') || `<span class="muted">${t.nobody}</span>`;
    board();
    next = setTimeout(ask, 5000);
  }

  function board() {
    $('aside').innerHTML = `<b class="muted">${t.scores}</b>` + [...score].sort((a, b) => b[1] - a[1])
      .map(([p, s]) => `<div><span>${p.avatar}</span><span>${api.esc(p.name)}</span><span>${s}</span></div>`).join('');
  }

  next = setTimeout(ask, 300);

  return {
    input(p, d) {
      if (!open || d.t !== 'pick' || picks.has(p) || !score.has(p)) return;
      const i = Number(d.i);
      if (!(i >= 0 && i < 4)) return;
      picks.set(p, { i, at: Date.now() });
      $('.who').innerHTML = [...picks.keys()].map(p => `<span>${p.avatar}</span>`).join('') + ` <span class="muted">${t.answered}</span>`;
      if ([...score.keys()].every(p => picks.has(p) || !p.online)) reveal();
    },
    join(p) { score.set(p, 0); if (open) sendQ(p); board(); },
    stop() { clearTimeout(tick); clearTimeout(next); open = false; n = qs.length; },
  };
}

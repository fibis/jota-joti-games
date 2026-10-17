// The game cards in the lobby. Adding a game: a folder with its component, plus an entry here.
import type { GameDefinition } from './types';

export const GAMES: GameDefinition[] = [
  {
    id: 'foxhunt',
    emoji: '🦊',
    info: {
      en: {
        title: 'Fox Hunt', controller: 'Joystick',
        description: 'A hidden transmitter beeps “MO”. Follow the signal on your phone and grab the fox first!',
        howTo: [
          'Your phone is a radio receiver and a joystick: drag anywhere on it to walk.',
          'The beeps get louder, higher and faster the closer you get to the hidden fox 🦊.',
          'Touch the fox to catch it. First to catch 5 foxes wins!',
        ],
      },
      de: {
        title: 'Fuchsjagd', controller: 'Joystick',
        description: 'Ein versteckter Sender piept „MO“. Folge dem Signal auf deinem Handy und schnapp dir den Fuchs zuerst!',
        howTo: [
          'Dein Handy ist Funkempfänger und Joystick: irgendwo darauf ziehen zum Laufen.',
          'Je näher du dem versteckten Fuchs 🦊 kommst, desto lauter, höher und schneller piept es.',
          'Berühre den Fuchs, um ihn zu fangen. Wer zuerst 5 Füchse hat, gewinnt!',
        ],
      },
    },
    load: () => import('./foxhunt/FoxHunt.vue'),
  },
  {
    id: 'morse-master',
    emoji: '📡',
    info: {
      en: {
        title: 'Morse Master', controller: 'Telegraph key',
        description: 'Your phone is a Morse key. Tap the word in dits and dahs before the others.',
        howTo: [
          'Your phone is a Morse key: short tap = · (dit), long press = − (dah).',
          'Key the word from the big screen letter by letter, with a short pause after each letter.',
          'The fastest scouts score most. Rounds 1-3 show hints, after that use the code sheet!',
        ],
      },
      de: {
        title: 'Morse-Meister', controller: 'Morsetaste',
        description: 'Dein Handy ist eine Morsetaste. Morse das Wort in Punkten und Strichen – schneller als die anderen.',
        howTo: [
          'Dein Handy ist eine Morsetaste: kurz tippen = · (Punkt), lang drücken = − (Strich).',
          'Morse das Wort vom großen Bildschirm Buchstabe für Buchstabe, nach jedem Buchstaben kurz Pause.',
          'Die Schnellsten bekommen die meisten Punkte. In Runde 1-3 gibt es Hilfe, danach die Tabelle!',
        ],
      },
    },
    load: () => import('./morse-master/MorseMaster.vue'),
  },
  {
    id: 'quiz',
    emoji: '⚜️',
    info: {
      en: {
        title: 'Scout Quiz', controller: '4 buttons',
        description: 'Radio alphabet, Q-codes, knots and scouting history. Quick answers score more!',
        howTo: [
          'The question shows up on the big screen and on your phone.',
          'Tap one of the 4 coloured answers – you only get one try.',
          'Right and fast scores most. 10 questions!',
        ],
      },
      de: {
        title: 'Pfadfinder-Quiz', controller: '4 Knöpfe',
        description: 'Funkalphabet, Q-Codes, Knoten und Pfadfindergeschichte. Schnelle Antworten bringen mehr Punkte!',
        howTo: [
          'Die Frage erscheint auf dem großen Bildschirm und auf deinem Handy.',
          'Tippe auf eine der 4 farbigen Antworten – du hast nur einen Versuch.',
          'Richtig und schnell gibt die meisten Punkte. 10 Fragen!',
        ],
      },
    },
    load: () => import('./quiz/ScoutQuiz.vue'),
  },
  {
    id: 'callsign',
    emoji: '🔤',
    info: {
      en: {
        title: 'Call Sign Speller', controller: '4 buttons',
        description: 'A station calls in. Spell its call sign in the radio alphabet – Papa, Alfa, Three… – faster than the others!',
        howTo: [
          'A station calls in with its call sign, e.g. PA3XYZ.',
          'Spell it character by character: tap the right radio-alphabet word (P = Papa, 3 = Three).',
          'A wrong word costs a moment. The fastest spellers score most – 6 rounds.',
        ],
      },
      de: {
        title: 'Rufzeichen-Buchstabierer', controller: '4 Knöpfe',
        description: 'Eine Station meldet sich. Buchstabiere ihr Rufzeichen im Funkalphabet – Papa, Alfa, Drei… – schneller als die anderen!',
        howTo: [
          'Eine Station meldet sich mit ihrem Rufzeichen, z. B. PA3XYZ.',
          'Buchstabiere es Zeichen für Zeichen: tippe das richtige Wort aus dem Funkalphabet (P = Papa, 3 = Drei).',
          'Ein falsches Wort kostet kurz Zeit. Die Schnellsten bekommen die meisten Punkte – 6 Runden.',
        ],
      },
    },
    load: () => import('./callsign/CallSignSpeller.vue'),
  },
  {
    id: 'signal-lamp',
    emoji: '🔦',
    info: {
      en: {
        title: 'Signal Lamp', controller: '4 buttons',
        description: 'The lamp flashes a word in Morse. Read the light and pick the right word before the others!',
        howTo: [
          'The lamp flashes a word in Morse: short flash = ·, long flash = −.',
          'Read the light (the code sheet below helps) and tap the right one of 4 words on your phone.',
          'Quick answers score more. It gets faster, and from round 5 there is no sound!',
        ],
      },
      de: {
        title: 'Lichtmorsen', controller: '4 Knöpfe',
        description: 'Die Lampe blinkt ein Wort im Morsecode. Lies das Licht und wähle das richtige Wort – schneller als die anderen!',
        howTo: [
          'Die Lampe blinkt ein Wort im Morsecode: kurz = ·, lang = −.',
          'Lies das Licht (die Tabelle unten hilft) und tippe auf deinem Handy das richtige von 4 Wörtern.',
          'Schnelle Antworten bringen mehr Punkte. Es wird schneller, und ab Runde 5 gibt es keinen Ton mehr!',
        ],
      },
    },
    load: () => import('./signal-lamp/SignalLamp.vue'),
  },
  {
    id: 'iss-pass',
    emoji: '🛰️',
    info: {
      en: {
        title: 'ISS Pass', controller: 'Joystick',
        description: 'The space station flies over! Point your antenna at it and hold the contact as long as you can.',
        howTo: [
          'Everyone has an antenna at the bottom of the screen. Turn it with the joystick ← →.',
          'Point your beam at the ISS 🛰️ as it crosses the sky – the beeps tell you how good your signal is.',
          'Hold the signal to log a QSO for bonus points. 5 passes; from pass 3 AO-91 scores double!',
        ],
      },
      de: {
        title: 'ISS-Überflug', controller: 'Joystick',
        description: 'Die Raumstation fliegt über uns! Richte deine Antenne auf sie und halte den Kontakt so lange wie möglich.',
        howTo: [
          'Jeder hat unten eine Antenne. Dreh sie mit dem Joystick ← →.',
          'Richte deinen Strahl auf die ISS 🛰️, wenn sie über den Himmel fliegt – das Piepen zeigt, wie gut dein Signal ist.',
          'Halte das Signal, dann loggst du ein QSO mit Bonuspunkten. 5 Überflüge; ab dem 3. zählt AO-91 doppelt!',
        ],
      },
    },
    load: () => import('./iss-pass/IssPass.vue'),
  },
  {
    id: 'tower',
    emoji: '🪵',
    info: {
      en: {
        title: 'Pioneering Tower', controller: 'Joystick + button',
        description: 'Teams take turns dropping poles and frames. Build the tallest tower – before it comes crashing down!',
        howTo: [
          'Two teams build side by side. When it is your turn, your phone says “Your turn!”.',
          'Joystick ← → moves the piece, ↑ ↓ turns it, the button drops it.',
          'After 2½ minutes the tallest standing tower wins. Careful – towers can crash!',
        ],
      },
      de: {
        title: 'Lagerbau-Turm', controller: 'Joystick + Knopf',
        description: 'Die Teams lassen abwechselnd Stangen und Rahmen fallen. Baut den höchsten Turm – bevor er einstürzt!',
        howTo: [
          'Zwei Teams bauen nebeneinander. Wenn du dran bist, zeigt dein Handy „Du bist dran!“.',
          'Joystick ← → verschiebt das Teil, ↑ ↓ dreht es, der Knopf lässt es fallen.',
          'Nach 2½ Minuten gewinnt der höchste stehende Turm. Vorsicht – Türme können einstürzen!',
        ],
      },
    },
    load: () => import('./tower/PioneeringTower.vue'),
  },
  {
    id: 'qso-partner',
    emoji: '🤝',
    info: {
      en: {
        title: 'Find Your QSO Partner', controller: 'Number pad (phones only)',
        description: 'Every phone gets a call sign and a clue. Walk around, find your partner and log the contact with their code!',
        howTo: [
          'Your phone shows your call sign 📻, your code 🔑 and a clue to your partner.',
          'Walk around and call “CQ CQ, this is …!” until you find your partner.',
          'Show each other your codes and both type the other one’s code. Quick QSOs score most – 4 rounds.',
        ],
      },
      de: {
        title: 'Funkpartner finden', controller: 'Zahlenfeld (nur Handys)',
        description: 'Jedes Handy bekommt ein Rufzeichen und einen Hinweis. Lauf herum, finde deinen Partner und logge den Kontakt mit seinem Code!',
        howTo: [
          'Dein Handy zeigt dein Rufzeichen 📻, deinen Code 🔑 und einen Hinweis auf deinen Partner.',
          'Lauf herum und ruf „CQ CQ, hier ist …!“, bis du deinen Partner findest.',
          'Zeigt euch eure Codes und tippt beide den Code des anderen ein. Schnelle QSOs bringen die meisten Punkte – 4 Runden.',
        ],
      },
    },
    phonesOnly: true,
    load: () => import('./qso-partner/QsoPartner.vue'),
  },
  {
    id: 'capture-flag',
    emoji: '🚩',
    info: {
      en: {
        title: 'Capture the Flag', controller: 'Joystick + dash',
        description: 'Two teams, two flags. Sneak into the other half, grab their flag and run home. Tag intruders to send them to jail!',
        howTo: [
          'Two teams: each one defends its half, its flag 🚩 and its jail.',
          'Tag intruders in your half to send them to jail. Caught team mates sit in the other team’s jail – touch it to free them.',
          'Grab the enemy flag and run it home! Button = dash 💨. First to 3 captures wins.',
        ],
      },
      de: {
        title: 'Fahnenklau', controller: 'Joystick + Sprint',
        description: 'Zwei Teams, zwei Fahnen. Schleich dich in die andere Hälfte, schnapp dir ihre Fahne und lauf heim. Fang Eindringlinge und schick sie ins Gefängnis!',
        howTo: [
          'Zwei Teams: jedes verteidigt seine Hälfte, seine Fahne 🚩 und sein Gefängnis.',
          'Fang Eindringlinge in deiner Hälfte, dann müssen sie ins Gefängnis. Gefangene sitzen im Gefängnis der anderen – berühr es, um sie zu befreien.',
          'Schnapp dir die gegnerische Fahne und bring sie heim! Knopf = Sprint 💨. Wer zuerst 3-mal klaut, gewinnt.',
        ],
      },
    },
    load: () => import('./capture-flag/CaptureFlag.vue'),
  },
];

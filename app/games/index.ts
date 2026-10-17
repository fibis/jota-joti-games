// The game cards in the lobby. Adding a game: a folder with its component, plus an entry here.
import type { GameDefinition } from './types';

export const GAMES: GameDefinition[] = [
  {
    id: 'foxhunt',
    emoji: '🦊',
    info: {
      en: { title: 'Fox Hunt', controller: 'Joystick', description: 'A hidden transmitter beeps “MO”. Follow the signal on your phone and grab the fox first!' },
      de: { title: 'Fuchsjagd', controller: 'Joystick', description: 'Ein versteckter Sender piept „MO“. Folge dem Signal auf deinem Handy und schnapp dir den Fuchs zuerst!' },
    },
    load: () => import('./foxhunt/FoxHunt.vue'),
  },
  {
    id: 'morse-master',
    emoji: '📡',
    info: {
      en: { title: 'Morse Master', controller: 'Telegraph key', description: 'Your phone is a Morse key. Tap the word in dits and dahs before the others.' },
      de: { title: 'Morse-Meister', controller: 'Morsetaste', description: 'Dein Handy ist eine Morsetaste. Morse das Wort in Punkten und Strichen – schneller als die anderen.' },
    },
    load: () => import('./morse-master/MorseMaster.vue'),
  },
  {
    id: 'quiz',
    emoji: '⚜️',
    info: {
      en: { title: 'Scout Quiz', controller: '4 buttons', description: 'Radio alphabet, Q-codes, knots and scouting history. Quick answers score more!' },
      de: { title: 'Pfadfinder-Quiz', controller: '4 Knöpfe', description: 'Funkalphabet, Q-Codes, Knoten und Pfadfindergeschichte. Schnelle Antworten bringen mehr Punkte!' },
    },
    load: () => import('./quiz/ScoutQuiz.vue'),
  },
];

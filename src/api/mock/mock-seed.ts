import type {
  Agent,
  AgentSkill,
  AgentWorkItem,
  ChannelKey,
  Queue,
  Skill,
  WorkItem,
} from '../types'
import { workItemIconFields } from '../../utils/salesforce-object-icon'

// Deterministic seed — baseline snapshot for mock mode. On each refresh,
// `mock-state` applies small incremental changes so the contact center evolves
// naturally over time without re-shuffling on hot-reload.

type QueueDef = { id: string; name: string }

const QUEUE_DEFS: QueueDef[] = [
  { id: 'ac', name: 'Atenció Client' },
  { id: 'in', name: 'Incidències' },
  { id: 've', name: 'Vendes' },
  { id: 'st', name: 'Suport Tècnic' },
  { id: 're', name: 'Retenció' },
]

const SKILL_DEFS: Skill[] = [
  { id: 'ca', name: 'Català', type: 'Language', agents: 14, backlog: 3 },
  { id: 'es', name: 'Castellà', type: 'Language', agents: 18, backlog: 7 },
  { id: 'en', name: 'Anglès', type: 'Language', agents: 9, backlog: 2 },
  { id: 'fr', name: 'Francès', type: 'Language', agents: 5, backlog: 0 },
  { id: 'de', name: 'Alemany', type: 'Language', agents: 2, backlog: 1 },
  { id: 'tec', name: 'Suport tècnic L2', type: 'Expertise', agents: 6, backlog: 5 },
  { id: 'tec3', name: 'Suport tècnic L3', type: 'Expertise', agents: 3, backlog: 2 },
  { id: 'ven', name: 'Vendes outbound', type: 'Expertise', agents: 4, backlog: 1 },
  { id: 'ret', name: 'Retenció premium', type: 'Expertise', agents: 3, backlog: 4 },
  { id: 'med', name: 'Mediació contractes', type: 'Expertise', agents: 2, backlog: 0 },
  { id: 'acc', name: 'Accessibilitat', type: 'Certification', agents: 7, backlog: 1 },
  { id: 'gdpr', name: 'Compliment GDPR', type: 'Certification', agents: 11, backlog: 0 },
]

type AgentSpec = {
  id: string
  name: string
  role: string
  status: 'online' | 'busy' | 'away' | 'offline'
  max: number
  used: number
  queueIds: string[]
  loginMin: number
  chans: Record<ChannelKey, number>
  work: { channelKey: ChannelKey; subject: string; queueId: string; ageSec: number }[]
  skillIds: string[]
}

/* Profile photos bundled locally (downloaded from randomuser.me) so the mock
   has no network dependency. Vite turns each import into a hashed asset URL.
   `eager: true` resolves them at module load; the filename stem (e.g. "w0",
   "m1") is the lookup key. */
const AVATAR_MODULES = import.meta.glob<string>('./avatars/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
})

const AVATAR_URLS: Record<string, string> = {}
for (const [path, url] of Object.entries(AVATAR_MODULES)) {
  const stem = path.split('/').pop()?.replace('.jpg', '') ?? ''
  AVATAR_URLS[stem] = url
}

/* Agent → avatar-file mapping. A handful of agents are deliberately left out
   (no entry) so the UI exercises its no-photo fallback, exactly as happens in
   production when a Salesforce user has no profile picture. */
const AGENT_PHOTOS: Record<string, string> = {
  a0: 'w0', a1: 'm1', a2: 'w2', a3: 'm3', a4: 'w4', a5: 'm5', a6: 'w6',
  a7: 'm7', a8: 'w8', a9: 'm9', a10: 'w10', a11: 'w11', a12: 'm12',
  a13: 'w13', a14: 'm14', a15: 'm15', a16: 'm16', a17: 'w17', a18: 'm18',
  a19: 'w19', a20: 'm20', a21: 'w21', a22: 'w22', a23: 'm23', a24: 'w24',
  a25: 'm25', a26: 'w26', a27: 'm27', a28: 'w28', a29: 'w29', a30: 'm30',
  a31: 'w31', a32: 'm32', a33: 'w33',
}

// Agents intentionally without a photo (mirrors production gaps).
const NO_PHOTO_AGENTS = new Set(['a9', 'a17', 'a24', 'a27', 'a32'])

function agentPhoto(agentId: string): string | null {
  if (NO_PHOTO_AGENTS.has(agentId)) return null
  const stem = AGENT_PHOTOS[agentId]
  return stem ? AVATAR_URLS[stem] ?? null : null
}

const AGENT_SPECS: AgentSpec[] = [
  // --- ONLINE agents ---
  {
    id: 'a0', name: 'Núria Ferran', role: 'Sènior · Atenció', status: 'online',
    max: 5, used: 3, queueIds: ['ac', 've'], loginMin: 210,
    chans: { veu: 1, chat: 1, email: 1, wa: 0, cas: 0 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 'ac', ageSec: 245 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 've', ageSec: 87 },
      { channelKey: 'email', subject: 'Consulta facturació', queueId: 'ac', ageSec: 1340 },
    ],
    skillIds: ['ca', 'es', 'en', 'gdpr'],
  },
  {
    id: 'a1', name: 'Pau Vidal', role: 'Agent · Vendes', status: 'online',
    max: 4, used: 2, queueIds: ['ve', 're'], loginMin: 95,
    chans: { veu: 0, chat: 1, email: 0, wa: 1, cas: 0 },
    work: [
      { channelKey: 'chat', subject: 'Xat web', queueId: 've', ageSec: 543 },
      { channelKey: 'wa', subject: 'WhatsApp', queueId: 're', ageSec: 312 },
    ],
    skillIds: ['ca', 'es', 'ven', 'ret'],
  },
  {
    id: 'a2', name: 'Aisha Khan', role: 'Agent · Suport', status: 'online',
    max: 6, used: 4, queueIds: ['st', 'in'], loginMin: 178,
    chans: { veu: 1, chat: 2, email: 0, wa: 0, cas: 1 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 'st', ageSec: 120 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 'st', ageSec: 890 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 'in', ageSec: 67 },
      { channelKey: 'cas', subject: 'Cas #48312', queueId: 'in', ageSec: 4200 },
    ],
    skillIds: ['en', 'fr', 'tec', 'tec3', 'acc'],
  },
  {
    id: 'a3', name: 'Marc Soler', role: 'Sènior · Incidències', status: 'online',
    max: 5, used: 1, queueIds: ['in', 'st'], loginMin: 340,
    chans: { veu: 0, chat: 0, email: 0, wa: 0, cas: 1 },
    work: [
      { channelKey: 'cas', subject: 'Cas #48890', queueId: 'in', ageSec: 720 },
    ],
    skillIds: ['ca', 'es', 'tec', 'tec3', 'gdpr'],
  },
  {
    id: 'a4', name: 'Lucía Ortega', role: 'Agent · Atenció', status: 'online',
    max: 5, used: 5, queueIds: ['ac', 're'], loginMin: 55,
    chans: { veu: 2, chat: 1, email: 1, wa: 0, cas: 1 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 'ac', ageSec: 44 },
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 're', ageSec: 155 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 'ac', ageSec: 900 },
      { channelKey: 'email', subject: 'Email reclamació', queueId: 'ac', ageSec: 2780 },
      { channelKey: 'cas', subject: 'Cas #48451', queueId: 're', ageSec: 630 },
    ],
    skillIds: ['es', 'ca', 'gdpr', 'acc'],
  },
  {
    id: 'a5', name: 'Tariq Aziz', role: 'Agent · Retenció', status: 'online',
    max: 4, used: 2, queueIds: ['re', 've'], loginMin: 132,
    chans: { veu: 1, chat: 0, email: 0, wa: 1, cas: 0 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 're', ageSec: 388 },
      { channelKey: 'wa', subject: 'WhatsApp', queueId: 've', ageSec: 211 },
    ],
    skillIds: ['ca', 'es', 'en', 'ret', 'med'],
  },
  {
    id: 'a6', name: 'Emma Roca', role: 'Agent · Vendes', status: 'online',
    max: 5, used: 3, queueIds: ['ve', 'ac'], loginMin: 260,
    chans: { veu: 0, chat: 2, email: 1, wa: 0, cas: 0 },
    work: [
      { channelKey: 'chat', subject: 'Xat web', queueId: 've', ageSec: 70 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 'ac', ageSec: 450 },
      { channelKey: 'email', subject: 'Email proposta comercial', queueId: 've', ageSec: 1890 },
    ],
    skillIds: ['ca', 'es', 'ven', 'gdpr'],
  },
  {
    id: 'a7', name: 'Jordi Camps', role: 'Sènior · Suport', status: 'online',
    max: 6, used: 2, queueIds: ['st', 'in'], loginMin: 305,
    chans: { veu: 1, chat: 0, email: 0, wa: 0, cas: 1 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 'st', ageSec: 99 },
      { channelKey: 'cas', subject: 'Cas #48677', queueId: 'st', ageSec: 5400 },
    ],
    skillIds: ['ca', 'tec', 'tec3', 'gdpr'],
  },
  {
    id: 'a8', name: 'Sara Lloret', role: 'Agent · Atenció', status: 'online',
    max: 4, used: 4, queueIds: ['ac', 've'], loginMin: 47,
    chans: { veu: 1, chat: 1, email: 1, wa: 1, cas: 0 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 'ac', ageSec: 23 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 'ac', ageSec: 1120 },
      { channelKey: 'email', subject: 'Email', queueId: 've', ageSec: 3300 },
      { channelKey: 'wa', subject: 'WhatsApp', queueId: 've', ageSec: 178 },
    ],
    skillIds: ['es', 'ca', 'en', 'acc'],
  },
  {
    id: 'a9', name: 'Hugo Marín', role: 'Agent · Incidències', status: 'online',
    max: 5, used: 1, queueIds: ['in', 'st'], loginMin: 158,
    chans: { veu: 0, chat: 0, email: 0, wa: 0, cas: 1 },
    work: [
      { channelKey: 'cas', subject: 'Cas #48521', queueId: 'in', ageSec: 1800 },
    ],
    skillIds: ['es', 'tec'],
  },
  // --- BUSY agents ---
  {
    id: 'a10', name: 'Mei Chen', role: 'Agent · Suport', status: 'busy',
    max: 5, used: 5, queueIds: ['st', 'in'], loginMin: 220,
    chans: { veu: 1, chat: 2, email: 1, wa: 0, cas: 1 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 'st', ageSec: 567 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 'st', ageSec: 234 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 'in', ageSec: 789 },
      { channelKey: 'email', subject: 'Email consulta tècnica', queueId: 'st', ageSec: 4500 },
      { channelKey: 'cas', subject: 'Cas #48234', queueId: 'in', ageSec: 9800 },
    ],
    skillIds: ['en', 'tec', 'tec3', 'acc'],
  },
  {
    id: 'a11', name: 'Olga Prats', role: 'Agent · Retenció', status: 'busy',
    max: 4, used: 4, queueIds: ['re', 've'], loginMin: 88,
    chans: { veu: 2, chat: 0, email: 1, wa: 1, cas: 0 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 're', ageSec: 678 },
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 've', ageSec: 45 },
      { channelKey: 'email', subject: 'Email oferta retenció', queueId: 're', ageSec: 2100 },
      { channelKey: 'wa', subject: 'WhatsApp', queueId: 've', ageSec: 330 },
    ],
    skillIds: ['es', 'ca', 'ret', 'med', 'gdpr'],
  },
  {
    id: 'a12', name: 'Iván Mora', role: 'Agent · Vendes', status: 'busy',
    max: 5, used: 3, queueIds: ['ve', 'ac'], loginMin: 192,
    chans: { veu: 1, chat: 1, email: 0, wa: 0, cas: 1 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 've', ageSec: 188 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 'ac', ageSec: 940 },
      { channelKey: 'cas', subject: 'Cas #48703', queueId: 've', ageSec: 2700 },
    ],
    skillIds: ['es', 'ven'],
  },
  {
    id: 'a13', name: 'Carla Bru', role: 'Sènior · Atenció', status: 'busy',
    max: 6, used: 6, queueIds: ['ac', 're'], loginMin: 375,
    chans: { veu: 2, chat: 2, email: 1, wa: 0, cas: 1 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 'ac', ageSec: 112 },
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 're', ageSec: 430 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 'ac', ageSec: 220 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 're', ageSec: 88 },
      { channelKey: 'email', subject: 'Email queixa formal', queueId: 'ac', ageSec: 7200 },
      { channelKey: 'cas', subject: 'Cas #48811', queueId: 're', ageSec: 1560 },
    ],
    skillIds: ['ca', 'es', 'en', 'gdpr', 'acc'],
  },
  {
    id: 'a14', name: 'Pol Esteve', role: 'Agent · Retenció', status: 'busy',
    max: 5, used: 5, queueIds: ['re', 'ac'], loginMin: 233,
    chans: { veu: 2, chat: 1, email: 1, wa: 1, cas: 0 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 're', ageSec: 78 },
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 'ac', ageSec: 920 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 're', ageSec: 411 },
      { channelKey: 'email', subject: 'Email oferta', queueId: 'ac', ageSec: 1230 },
      { channelKey: 'wa', subject: 'WhatsApp', queueId: 're', ageSec: 290 },
    ],
    skillIds: ['ca', 'ret', 'med', 'gdpr'],
  },
  {
    id: 'a15', name: 'Guillem Rius', role: 'Agent · Suport', status: 'busy',
    max: 5, used: 5, queueIds: ['st', 're'], loginMin: 249,
    chans: { veu: 1, chat: 2, email: 1, wa: 0, cas: 1 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 'st', ageSec: 445 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 'st', ageSec: 102 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 're', ageSec: 388 },
      { channelKey: 'email', subject: 'Email tècnic', queueId: 'st', ageSec: 2900 },
      { channelKey: 'cas', subject: 'Cas #48622', queueId: 'st', ageSec: 11200 },
    ],
    skillIds: ['ca', 'tec', 'tec3', 'gdpr'],
  },
  // --- AWAY agents ---
  {
    id: 'a16', name: 'Adam Novak', role: 'Agent · Incidències', status: 'away',
    max: 5, used: 1, queueIds: ['in', 'st'], loginMin: 144,
    chans: { veu: 0, chat: 0, email: 0, wa: 0, cas: 1 },
    work: [
      { channelKey: 'cas', subject: 'Cas #48555', queueId: 'in', ageSec: 3600 },
    ],
    skillIds: ['en', 'de', 'tec'],
  },
  {
    id: 'a17', name: 'Laia Pons', role: 'Agent · Suport', status: 'away',
    max: 4, used: 0, queueIds: ['st', 've'], loginMin: 67,
    chans: { veu: 0, chat: 0, email: 0, wa: 0, cas: 0 },
    work: [],
    skillIds: ['ca', 'tec', 'acc'],
  },
  {
    id: 'a18', name: 'Èric Sala', role: 'Agent · Atenció', status: 'away',
    max: 5, used: 1, queueIds: ['ac', 'in'], loginMin: 280,
    chans: { veu: 1, chat: 0, email: 0, wa: 0, cas: 0 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 'ac', ageSec: 890 },
    ],
    skillIds: ['ca', 'es', 'gdpr'],
  },
  {
    id: 'a19', name: 'Júlia Vives', role: 'Agent · Vendes', status: 'away',
    max: 4, used: 0, queueIds: ['ve', 're'], loginMin: 112,
    chans: { veu: 0, chat: 0, email: 0, wa: 0, cas: 0 },
    work: [],
    skillIds: ['es', 'fr', 'ven', 'ret'],
  },
  {
    id: 'a20', name: 'Omar Haddad', role: 'Agent · Suport', status: 'away',
    max: 5, used: 2, queueIds: ['st', 'in'], loginMin: 198,
    chans: { veu: 0, chat: 1, email: 0, wa: 0, cas: 1 },
    work: [
      { channelKey: 'chat', subject: 'Xat web', queueId: 'st', ageSec: 670 },
      { channelKey: 'cas', subject: 'Cas #48399', queueId: 'in', ageSec: 2340 },
    ],
    skillIds: ['fr', 'tec'],
  },
  {
    id: 'a21', name: 'Ona Serra', role: 'Agent · Vendes', status: 'away',
    max: 4, used: 1, queueIds: ['ve', 'ac'], loginMin: 145,
    chans: { veu: 0, chat: 0, email: 0, wa: 1, cas: 0 },
    work: [
      { channelKey: 'wa', subject: 'WhatsApp', queueId: 've', ageSec: 750 },
    ],
    skillIds: ['es', 'en', 'ven'],
  },
  // --- OFFLINE agents ---
  {
    id: 'a22', name: 'Berta Coll', role: 'Agent · Incidències', status: 'online',
    max: 5, used: 3, queueIds: ['in', 'ac'], loginMin: 48,
    chans: { veu: 0, chat: 1, email: 0, wa: 0, cas: 2 },
    work: [
      { channelKey: 'cas', subject: 'Cas #48901', queueId: 'in', ageSec: 540 },
      { channelKey: 'cas', subject: 'Cas #48902', queueId: 'in', ageSec: 1200 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 'in', ageSec: 95 },
    ],
    skillIds: ['ca', 'es', 'tec'],
  },
  {
    id: 'a23', name: 'Nil Bosch', role: 'Agent · Retenció', status: 'offline',
    max: 4, used: 0, queueIds: ['re', 've'], loginMin: 0,
    chans: { veu: 0, chat: 0, email: 0, wa: 0, cas: 0 },
    work: [],
    skillIds: ['es', 'ret', 'med'],
  },
  {
    id: 'a24', name: 'Paula Gil', role: 'Sènior · Vendes', status: 'offline',
    max: 6, used: 0, queueIds: ['ve', 'ac'], loginMin: 0,
    chans: { veu: 0, chat: 0, email: 0, wa: 0, cas: 0 },
    work: [],
    skillIds: ['es', 'en', 'ven', 'gdpr'],
  },
  {
    id: 'a25', name: 'Roger Mas', role: 'Agent · Suport', status: 'offline',
    max: 5, used: 0, queueIds: ['st', 'in'], loginMin: 0,
    chans: { veu: 0, chat: 0, email: 0, wa: 0, cas: 0 },
    work: [],
    skillIds: ['ca', 'tec3'],
  },
  {
    id: 'a26', name: 'Anna Tort', role: 'Agent · Atenció', status: 'offline',
    max: 4, used: 0, queueIds: ['ac', 're'], loginMin: 0,
    chans: { veu: 0, chat: 0, email: 0, wa: 0, cas: 0 },
    work: [],
    skillIds: ['ca', 'es', 'gdpr', 'acc'],
  },
  {
    id: 'a27', name: 'Dani Reig', role: 'Agent · Incidències', status: 'offline',
    max: 5, used: 0, queueIds: ['in', 'st'], loginMin: 0,
    chans: { veu: 0, chat: 0, email: 0, wa: 0, cas: 0 },
    work: [],
    skillIds: ['es', 'tec'],
  },
  {
    id: 'a28', name: 'Clara Vega', role: 'Agent · Vendes', status: 'online',
    max: 5, used: 2, queueIds: ['ve', 're'], loginMin: 144,
    chans: { veu: 1, chat: 1, email: 0, wa: 0, cas: 0 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 've', ageSec: 345 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 're', ageSec: 123 },
    ],
    skillIds: ['es', 'en', 'ven', 'ret'],
  },
  {
    id: 'a29', name: 'Marta Pi', role: 'Agent · Suport', status: 'online',
    max: 4, used: 1, queueIds: ['st', 've'], loginMin: 88,
    chans: { veu: 0, chat: 0, email: 1, wa: 0, cas: 0 },
    work: [
      { channelKey: 'email', subject: 'Email consulta tècnica', queueId: 'st', ageSec: 6700 },
    ],
    skillIds: ['ca', 'es', 'tec', 'gdpr'],
  },
  {
    id: 'a30', name: 'Saïd Amraoui', role: 'Agent · Suport', status: 'online',
    max: 5, used: 3, queueIds: ['st', 'in'], loginMin: 167,
    chans: { veu: 1, chat: 1, email: 0, wa: 0, cas: 1 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 'st', ageSec: 190 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 'in', ageSec: 560 },
      { channelKey: 'cas', subject: 'Cas #48760', queueId: 'st', ageSec: 3200 },
    ],
    skillIds: ['fr', 'tec', 'tec3'],
  },
  {
    id: 'a31', name: 'Vera Soto', role: 'Agent · Atenció', status: 'online',
    max: 4, used: 2, queueIds: ['ac', 've'], loginMin: 310,
    chans: { veu: 1, chat: 0, email: 1, wa: 0, cas: 0 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 'ac', ageSec: 830 },
      { channelKey: 'email', subject: 'Email consulta', queueId: 've', ageSec: 4100 },
    ],
    skillIds: ['es', 'gdpr', 'acc'],
  },
  {
    id: 'a32', name: 'Bru Llopis', role: 'Agent · Incidències', status: 'online',
    max: 5, used: 2, queueIds: ['in', 'st'], loginMin: 72,
    chans: { veu: 1, chat: 0, email: 0, wa: 0, cas: 1 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 'in', ageSec: 310 },
      { channelKey: 'cas', subject: 'Cas #48910', queueId: 'in', ageSec: 890 },
    ],
    skillIds: ['ca', 'tec'],
  },
  {
    id: 'a33', name: 'Mireia Font', role: 'Sènior · Retenció', status: 'online',
    max: 5, used: 3, queueIds: ['re', 'ac'], loginMin: 189,
    chans: { veu: 1, chat: 1, email: 0, wa: 1, cas: 0 },
    work: [
      { channelKey: 'veu', subject: 'Trucada entrant', queueId: 're', ageSec: 290 },
      { channelKey: 'chat', subject: 'Xat web', queueId: 'ac', ageSec: 477 },
      { channelKey: 'wa', subject: 'WhatsApp', queueId: 're', ageSec: 134 },
    ],
    skillIds: ['ca', 'es', 'en', 'ret', 'gdpr'],
  },
]

const MOCK_SKILL_EPOCH = Date.UTC(2025, 0, 1)

const queueNameById = new Map(QUEUE_DEFS.map((q) => [q.id, q.name]))

function agentSkillRows(spec: AgentSpec): AgentSkill[] {
  return spec.skillIds.map((skillId, si) => {
    const skillDef = SKILL_DEFS.find((s) => s.id === skillId)
    const span = (spec.id.length + si) * 37
    const start = MOCK_SKILL_EPOCH + span * 86_400_000
    return {
      id: `${spec.id}-${skillId}`,
      skillId,
      name: skillDef?.name ?? skillId,
      type: skillDef?.type ?? null,
      level: (si % 5) + 1,
      startDate: new Date(start).toISOString(),
      lastModifiedDate: new Date(start + 86_400_000 * (si + 1)).toISOString(),
      lastModifiedBy: 'Sistema (mock)',
    }
  })
}

function buildAgent(spec: AgentSpec): Agent {
  const workItems: AgentWorkItem[] = spec.work.map((w, wi) => ({
    id: `${spec.id}-work-${wi}`,
    recordId: null,
    label: w.subject,
    subject: w.subject,
    channel: null,
    channelKey: w.channelKey,
    status: 'assigned',
    queue: queueNameById.get(w.queueId) ?? null,
    queueId: w.queueId,
    ageMin: Math.max(1, Math.floor(w.ageSec / 60)),
  }))

  return {
    id: spec.id,
    name: spec.name,
    role: spec.role,
    recordUrl: null,
    status: spec.status,
    max: spec.max,
    used: spec.used,
    queueIds: spec.queueIds,
    loginMin: spec.loginMin,
    photo: agentPhoto(spec.id),
    chans: spec.chans,
    work: workItems,
    skills: [],
  }
}

function buildQueues(agentRoster: Agent[]): Queue[] {
  const QUEUE_DATA: Record<string, { backlog: number; longest: number; avg: number }> = {
    ac: { backlog: 4, longest: 145, avg: 67 },
    in: { backlog: 8, longest: 312, avg: 180 },
    ve: { backlog: 3, longest: 78, avg: 45 },
    st: { backlog: 6, longest: 230, avg: 110 },
    re: { backlog: 2, longest: 55, avg: 30 },
  }
  return QUEUE_DEFS.map((q) => ({
    ...q,
    ...(QUEUE_DATA[q.id] ?? { backlog: 2, longest: 60, avg: 40 }),
    online:
      agentRoster.filter(
        (a) => a.queueIds.includes(q.id) && a.status === 'online',
      ).length || 1,
  }))
}

function buildWork(agentRoster: Agent[]): WorkItem[] {
  const items: WorkItem[] = []
  let n = 0

  agentRoster.forEach((agent) => {
    agent.work.forEach((workItem) => {
      const icon = workItemIconFields(workItem.channelKey)
      items.push({
        id: `w${n++}`,
        subject: workItem.subject ?? workItem.label,
        channelKey: workItem.channelKey,
        queueId: workItem.queueId,
        agentId: agent.id,
        status: 'assigned',
        ageSec: (workItem.ageMin ?? 1) * 60,
        workItemId: workItem.recordId,
        objectApiName: icon.objectApiName,
        iconName: icon.iconName,
        iconSprite: icon.iconSprite,
        iconSymbol: icon.iconSymbol,
      })
    })
  })

  const QUEUED_ITEMS: { queueId: string; channelKey: ChannelKey; subject: string; ageSec: number }[] = [
    { queueId: 'ac', channelKey: 'veu', subject: 'Trucada entrant', ageSec: 45 },
    { queueId: 'ac', channelKey: 'chat', subject: 'Xat web', ageSec: 78 },
    { queueId: 'ac', channelKey: 'email', subject: 'Email consulta general', ageSec: 920 },
    { queueId: 'ac', channelKey: 'wa', subject: 'WhatsApp', ageSec: 234 },
    { queueId: 'in', channelKey: 'cas', subject: 'Cas #48991', ageSec: 1200 },
    { queueId: 'in', channelKey: 'cas', subject: 'Cas #48992', ageSec: 3450 },
    { queueId: 'in', channelKey: 'cas', subject: 'Cas #48993', ageSec: 5670 },
    { queueId: 'in', channelKey: 'veu', subject: 'Trucada entrant', ageSec: 190 },
    { queueId: 'in', channelKey: 'email', subject: 'Email incidència crítica', ageSec: 8900 },
    { queueId: 'in', channelKey: 'chat', subject: 'Xat web', ageSec: 340 },
    { queueId: 'in', channelKey: 'wa', subject: 'WhatsApp urgència', ageSec: 670 },
    { queueId: 'in', channelKey: 'chat', subject: 'Xat web', ageSec: 120 },
    { queueId: 've', channelKey: 'veu', subject: 'Trucada entrant', ageSec: 33 },
    { queueId: 've', channelKey: 'chat', subject: 'Xat web', ageSec: 67 },
    { queueId: 've', channelKey: 'wa', subject: 'WhatsApp', ageSec: 145 },
    { queueId: 'st', channelKey: 'cas', subject: 'Cas #48998', ageSec: 2300 },
    { queueId: 'st', channelKey: 'cas', subject: 'Cas #48999', ageSec: 7800 },
    { queueId: 'st', channelKey: 'email', subject: 'Email suport tècnic', ageSec: 4200 },
    { queueId: 'st', channelKey: 'veu', subject: 'Trucada entrant', ageSec: 88 },
    { queueId: 'st', channelKey: 'chat', subject: 'Xat web', ageSec: 560 },
    { queueId: 'st', channelKey: 'chat', subject: 'Xat web', ageSec: 210 },
    { queueId: 're', channelKey: 'veu', subject: 'Trucada entrant', ageSec: 22 },
    { queueId: 're', channelKey: 'wa', subject: 'WhatsApp oferta', ageSec: 390 },
  ]

  QUEUED_ITEMS.forEach((q) => {
    const icon = workItemIconFields(q.channelKey)
    items.push({
      id: `w${n++}`,
      subject: q.subject,
      channelKey: q.channelKey,
      queueId: q.queueId,
      agentId: null,
      status: 'queued',
      ageSec: q.ageSec,
      workItemId: null,
      objectApiName: icon.objectApiName,
      iconName: icon.iconName,
      iconSprite: icon.iconSprite,
      iconSymbol: icon.iconSymbol,
    })
  })

  return items
}

export function skillAgentSlice(skill: Skill, roster: Agent[]): Agent[] {
  const want = Math.min(skill.agents, roster.length)
  if (!want) return []
  let seed = 0
  for (let i = 0; i < skill.id.length; i++) {
    seed = (seed * 31 + skill.id.charCodeAt(i)) % roster.length
  }
  const picked: Agent[] = []
  for (let i = 0; i < want; i++) {
    picked.push(roster[(seed + i) % roster.length])
  }
  return picked
}

export const agents: Agent[] = AGENT_SPECS.map(buildAgent)
export const queues: Queue[] = buildQueues(agents)
export const skills: Skill[] = SKILL_DEFS.slice()
export const work: WorkItem[] = buildWork(agents)

export function getAgentSkills(agentId: string): AgentSkill[] {
  const spec = AGENT_SPECS.find((s) => s.id === agentId)
  return spec ? agentSkillRows(spec) : []
}

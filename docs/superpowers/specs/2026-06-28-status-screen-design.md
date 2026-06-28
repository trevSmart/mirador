# StatusScreen — sistema de pantalles d'estat full-screen

Data: 2026-06-28

## Problema

Quan hi ha un error d'autenticació (`authError`), l'app queda inservible però no ho comunica:

- `authError` ve d'un text cru de Salesforce al callback OAuth (p.ex. «External client app
  is not installed in this org»), propagat com a valor fins a `authError`
  ([bootstrap-auth.ts:34-36](../../../src/auth/bootstrap-auth.ts)).
- Amb `authError` actiu, `isAuthenticated = false` i l'auto-login es **bloqueja
  expressament** per evitar el bucle redirect→error→redirect
  ([AuthProvider.tsx:139](../../../src/auth/AuthProvider.tsx)).
- Tot i així es renderitza `AppContent` amb el `DockviewShell` buit i el header mostrant
  «Redirigint a Salesforce…» — un **spinner penjat infinit** sobre una app morta.
- L'error real es degrada a un `<span className="app-header__error">` al header que, a
  més, la cascada CSS despinta del seu color d'alerta (el selector
  `.app-header span:not(...)` té més especificitat i guanya `--text-body`).

Resultat: l'usuari veu un spinner que no avança i un text gris minúscul que no sembla un
error.

## Objectiu

Un sistema **nou, autònom i ben fet** per a qualsevol estat que ocupi tota la finestra
(error d'auth, redirecció en curs, crash de render). Es dissenya com si el sistema vell no
existís: vocabulari visual propi (`status-screen__*`), API pròpia. El codi vell d'abast
full-screen (`ErrorFallback` global, el `<span>` del header, la branca «Redirigint…») se
**substitueix**, no es concilia.

L'abast d'aquesta spec és **només full-screen**. La convergència de la resta d'abasts
(panells, drawers, inline, header chips, search, settings, dev console) cap a aquest
vocabulari queda anotada com a deute conscient a `docs/TODO.md`.

## Component: `StatusScreen`

Component pur de presentació, sense lògica de negoci. Ubicació:
`src/components/status/StatusScreen.tsx`.

```ts
type StatusScreenTone = 'error' | 'info' | 'neutral'

interface StatusScreenAction {
  label: string
  onClick: () => void
  variant?: 'primary' | 'secondary' // default: 'secondary'
}

interface StatusScreenProps {
  tone?: StatusScreenTone           // default 'neutral' — color de l'accent/dot
  title: string
  message?: string                  // paràgraf explicatiu opcional
  detail?: string                   // text cru (p.ex. error de Salesforce) → bloc monospace
  detailLabel?: string              // capçalera del bloc detail
  actions?: StatusScreenAction[]    // 0..N botons; buit/undefined → cap fila d'accions
  busy?: boolean                    // spinner en comptes del dot (transicions reals)
}
```

Comportament:

- `busy` true → mostra un spinner animat en lloc del dot de color. S'usa per a transicions
  legítimes (una redirecció que SÍ s'està executant), no per a estats penjats.
- `actions` buit o absent → no es renderitza la fila de botons.
- `tone` aplica la classe/color de l'accent: `error` (alerta), `info` (watch), `neutral`.
- `role="alert"` quan `tone === 'error'`; en cas contrari `role="status"`.

Estils: secció pròpia `status-screen` a `src/index.css` (seguint la convenció del
projecte d'un sol full d'estils). Classes `status-screen`, `status-screen__card`,
`__header`, `__dot`, `__spinner`, `__title`, `__message`, `__detail`, `__detail-label`,
`__pre`, `__actions`, `__btn`, `__btn--primary`. **No** reutilitza les classes
`error-fallback__*` (que continuen sent del sistema vell, encara viu a nivell de panell).

## Connexió a l'app

### Decisió d'auth — `AppGate`

Nou component `AppGate` dins de l'arbre del `AuthProvider`. Llegeix `useAuth()` i decideix
què es renderitza a tota la finestra:

- `authError` →
  `<StatusScreen tone="error" title="No s'ha pogut connectar a Salesforce"
  message="Hi ha hagut un problema en autenticar amb Salesforce." detail={authError}
  detailLabel="Detalls" actions={[{label:'Reintenta', onClick: login, variant:'primary'},
  {label:'Recarrega la pàgina', onClick: () => window.location.reload()}]} />`
  - `login` ja fa `setAuthError(null)` + reinicia el flux OAuth
    ([AuthProvider.tsx:120-123](../../../src/auth/AuthProvider.tsx)).
- redirecció real en curs (`isSalesforceEnabled && !isAuthenticated && !authError`) →
  `<StatusScreen busy tone="info" title="Connectant amb Salesforce…" />`. Aquí l'auto-login
  SÍ s'està executant, per tant l'spinner és legítim.
- cas normal → l'app (`AppContent`).

`AppGate` substitueix la decisió actual i elimina d'arrel l'spinner penjat: amb `authError`
ja no es renderitza ni el header enganyós ni el Dockview mort.

### Crash de render — boundary global

La classe `ErrorBoundary` ([ErrorBoundary.tsx](../../../src/components/error/ErrorBoundary.tsx))
és genèrica i es **reutilitza tal qual** (també l'usa el sistema per-panell). Només canvia
el seu fallback global a [App.tsx:51](../../../src/App.tsx):

```tsx
<ErrorBoundary
  fallback={(error, reset) => (
    <StatusScreen
      tone="error"
      title="Alguna cosa ha fallat"
      message="S'ha produït un error inesperat i no s'ha pogut mostrar aquesta vista."
      detail={error.message}
      detailLabel="Detalls de l'error"
      actions={[
        { label: 'Torna-ho a provar', onClick: reset, variant: 'primary' },
        { label: 'Recarrega la pàgina', onClick: () => window.location.reload() },
      ]}
    />
  )}
>
```

## Neteja (part del tracte)

- Elimino `app-header__error` i la branca «Redirigint a Salesforce…» del header
  ([AppHeader.tsx:94-98, 121-122](../../../src/components/AppHeader.tsx)). L'estat d'auth
  ja no es mostra mai al header.
- Elimino el component global `ErrorFallback`
  ([ErrorFallback.tsx](../../../src/components/error/ErrorFallback.tsx)) i la classe
  `error-fallback--global`.
- **Conservo** `PanelErrorFallback` i les classes `error-fallback--panel` /
  `error-fallback__panel-card` / `error-fallback__*` compartides: són d'abast panell, fora
  d'aquesta spec. Van al TODO de migració.

## TODO de migració (deute conscient)

Afegir a `docs/TODO.md` una entrada que llisti els abasts pendents de convergir cap al
vocabulari `status-screen` / un sistema d'estats unificat:

- `PanelState` (6 panells) i `PanelErrorFallback`
- drawers (`dd-empty`)
- inline (`panel-section__empty`, `color-playground__empty`, espais)
- header chips (`app-header__status`, `app-header__warning`)
- `qsearch-empty` (GlobalSearch)
- settings (`settings-error-text`, estats de connexió)
- dev console (`dev-console__empty`)

## Tests

`StatusScreen`:

- renderitza `title`, `message` i `detail` quan es passen;
- N `actions` → N botons; sense `actions` → cap fila de botons;
- clic en una acció dispara el seu `onClick`;
- `busy` → mostra spinner, no dot;
- `tone` aplica la classe/role correctes (`error` → `role="alert"`).

`AppGate` / auth:

- amb `authError` mostra `StatusScreen` (no `AppContent`);
- "Reintenta" crida `login`;
- redirecció real (`isSalesforceEnabled && !isAuthenticated && !authError`) mostra l'estat
  `busy`.

## Fora d'abast

- Migrar panells, drawers, inline, header chips, search, settings, dev console (TODO).
- Tocar la classe `ErrorBoundary` o el sistema d'errors per-panell.
- Internacionalització dels textos crus que retorna Salesforce.

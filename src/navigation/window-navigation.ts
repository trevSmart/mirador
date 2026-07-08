/* Detecció de la Navigation API. lib.dom la tipa com a sempre present,
   però Firefox (i jsdom als tests) encara no la implementen. */

export function getWindowNavigation(): Navigation | undefined {
  return 'navigation' in window ? window.navigation : undefined
}

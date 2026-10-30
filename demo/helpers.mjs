// Scrolls the gallery page to a section heading; reel-mesh has no scroll step.
export const scrollTo = (id) => async (ctx) => {
  await ctx.evaluate('page', (target) => document.getElementById(target).scrollIntoView({ behavior: 'smooth', block: 'start' }), id)
}

// Picks a style set without moving the pointer, so the gallery stays in view while it changes.
export const pick = (label) => async (ctx) => {
  await ctx.evaluate('page', (title) => document.querySelector(`button[title="${title}"]`).click(), label)
}

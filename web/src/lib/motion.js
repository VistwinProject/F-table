export const easing = 'cubic-bezier(0.16, 1, 0.3, 1)'

export const springs = {
  snappy:   { tension: 400, friction: 30, mass: 1 },
  smooth:   { tension: 200, friction: 26, mass: 1 },
  elastic:  { tension: 300, friction: 18, mass: 1 },
  hefty:    { tension: 160, friction: 32, mass: 2 },
  carousel: { tension: 260, friction: 28, mass: 1 },
}

export const duration = {
  fast:   120,
  normal: 220,
  slow:   380,
  xslow:  600,
}

export const transitions = {
  snappy:  `all ${duration.fast}ms ${easing}`,
  smooth:  `all ${duration.normal}ms ${easing}`,
  slow:    `all ${duration.slow}ms ${easing}`,
}

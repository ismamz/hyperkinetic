import { gsap } from "gsap";

import type { AnimatedOutletProps } from "hyperkinetic";

export const config = {
  // Switches de depuración, apagados salvo que se pida por entorno; sólo
  // actúan en desarrollo (el engine los elimina en producción):
  //   VITE_HYPERKINETIC_DEVTOOLS=1 FILTER=basic pnpm dev:example
  //   VITE_HYPERKINETIC_RETAIN=1 FILTER=basic pnpm dev:example
  debug: {
    devTools: import.meta.env.VITE_HYPERKINETIC_DEVTOOLS === "1",
    retainPages: import.meta.env.VITE_HYPERKINETIC_RETAIN === "1",
  },
  // Omite los hooks y la animación de primera carga: solo animamos navegaciones.
  // Así, siempre hay una saliente y una entrante, sin comprobar `!initial`.
  initial: false,
  before: () => {
    // Evita que el navegador restaure el scroll durante la transición al volver
    // atrás o avanzar. Los hooks controlan cuándo llevarlo al inicio.
    history.scrollRestoration = "manual";
  },
  beforeEnter: ({ next }) => {
    // Si se interrumpe una transición, la entrante anterior vuelve al flujo
    // como saliente. Ajustamos el scroll para conservar su posición visual.
    // if (interrupted) window.scrollTo(0, 0);
    // Oculta la entrante antes del primer frame para que aparezca con el fade.
    // La primera carga queda visible porque `initial: false` omite este hook.
    gsap.set(next.container, { autoAlpha: 0 });
  },
  afterEnter: () => {
    // La saliente ya es invisible y la entrante sigue fija: podemos volver al
    // inicio sin moverla, antes de que el engine quite la saliente del DOM.
    window.scrollTo(0, 0);
  },
  choreograph: ({ tl, current, next, leaveEnd }) => {
    tl.addLabel("outro", 0);

    const duration = 0.6;
    const outroEnd = leaveEnd("outro");
    // El crossfade empieza cuando terminan las salidas locales agrupadas.
    tl.to(current.container, { autoAlpha: 0, duration, ease: "none" }, outroEnd);
    tl.to(next.container, { autoAlpha: 1, duration, ease: "none" }, "<");

    tl.addLabel("intro", outroEnd + duration * 0.4);
  },
} satisfies AnimatedOutletProps;

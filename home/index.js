import { tr } from "../app-core.js";

export const homePage = () => `
  <section class="home-page">
    <div class="home-copy">
      <p class="eyebrow">${tr("homeEyebrow")}</p>
      <h1>${tr("homeTitle")}</h1>
      <p class="lede">${tr("homeLede")}</p>
    </div>
    <div class="home-visual" aria-hidden="true">
      <div class="hero-glow"></div>
      <img src="assets/trickster-hero.png" alt="" />
    </div>
    <div class="home-features">
      <div><span>01</span><strong>${tr("feature1")}</strong><p>${tr("feature1Text")}</p></div>
      <div><span>02</span><strong>${tr("feature2")}</strong><p>${tr("feature2Text")}</p></div>
      <div><span>03</span><strong>${tr("feature3")}</strong><p>${tr("feature3Text")}</p></div>
    </div>
  </section>`;

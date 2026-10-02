import { useLocalization } from "../LocalizationProvider";

const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;

export default function Home() {
  const { t } = useLocalization();
  return <section className="home-page">
    <div className="home-copy">
      <p className="eyebrow">{t("homeEyebrow")}</p>
      <h1>{t("homeTitleFirst")}<br /><em>{t("homeTitleEmphasis")}</em></h1>
      <p className="lede">{t("homeLede")}</p>
    </div>
    <div className="home-visual" aria-hidden="true">
      <div className="hero-glow" />
      <img src={asset("trickster-hero.png")} alt="" />
    </div>
    <div className="home-features">
      {[1, 2, 3].map((number) => <div key={number}>
        <span>{String(number).padStart(2, "0")}</span>
        <strong>{t(`feature${number}`)}</strong>
        <p>{t(`feature${number}Text`)}</p>
      </div>)}
    </div>
  </section>;
}

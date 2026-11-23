"use client";

import { useTranslation } from "@/components/LanguageProvider";
import { danishRuleGroups } from "./content.da";
import { translations } from "./translations";
import HubIcon from "@/components/HubIcon";
import PageHeader from "@/components/PageHeader";
import { ruleGroups as englishRuleGroups } from "./content";
import styles from "./rules.module.css";

export default function RulesHandbook() {
  const { language } = useTranslation();
  const copy = translations[language];
  const ruleGroups = language === "da" ? danishRuleGroups : englishRuleGroups;
  return (
    <main className={`hub-page ${styles.page}`} id="top" lang={language}>
      <PageHeader
        icon="shield"
        eyebrow={copy.eyebrow}
        title={copy.title}
        description={copy.description}
      />

      <div className={styles.intro}>
        <div>
          <p className={styles.kicker}>{copy.kicker}</p>
          <blockquote>{copy.quoteStart}<br />{copy.quoteEnd}</blockquote>
          <p className={styles.introText}>{copy.intro}</p>
        </div>
        <div className={styles.principle}>
          <HubIcon name="shield" width="24" height="24" />
          <h2>{copy.principleTitle}</h2>
          <p>{copy.principle}</p>
          <a href="#roleplay">{copy.etiquetteLink}</a>
        </div>
      </div>

      <div className={styles.layout}>
        <nav className={styles.contents} aria-label={copy.categories}>
          <p className={styles.contentsLabel}>{copy.contents}</p>
          {ruleGroups.map((group) => (
            <a key={group.id} href={`#${group.id}`}>
              <HubIcon name={group.icon} width="18" height="18" />
              <span>{group.title}</span>
            </a>
          ))}
          <p className={styles.source}>{copy.source}<br /><cite>the Strays.pdf</cite></p>
        </nav>

        <div className={styles.sections}>
          {ruleGroups.map((group) => (
            <section className={styles.section} id={group.id} key={group.id} aria-labelledby={`${group.id}-title`}>
              <header className={styles.sectionHeader}>
                <span className={styles.sectionIcon}><HubIcon name={group.icon} width="22" height="22" /></span>
                <div>
                  <h2 id={`${group.id}-title`}>{group.title}</h2>
                  <p>{group.description}</p>
                </div>
              </header>
              <div className={group.id === "language" ? styles.glossary : styles.rules}>
                {group.rules.map((rule) => (
                  <article className={styles.rule} key={rule.title}>
                    <h3>{rule.title}</h3>
                    {rule.text && <p>{rule.text}</p>}
                    {rule.points && (rule.ordered ? (
                      <ol>{rule.points.map((point) => <li key={point}>{point}</li>)}</ol>
                    ) : (
                      <ul>{rule.points.map((point) => <li key={point}>{point}</li>)}</ul>
                    ))}
                  </article>
                ))}
              </div>
              {group.id === "communication" && (
                <div className={styles.message}>
                  <h3>{copy.messageTitle}</h3>
                  <pre>{copy.message}</pre>
                </div>
              )}
            </section>
          ))}
          <footer className={styles.footer}>
            <p>{copy.footerStart}<br />{copy.footerEnd}</p>
            <a href="#top">{copy.backToTop}</a>
          </footer>
        </div>
      </div>
    </main>
  );
}

import { Accordion } from "./strength-accordion";
import { PROFILE, STRENGTHS, TECH_STACK, PROJECTS } from "./portfolio-data";

export function Hero() {
  return (
    <header className="hero">
      <div className="container hero-inner">
        <p className="eyebrow">PORTFOLIO</p>
        <h1>{PROFILE.name}</h1>
        <p className="target-sentence">{PROFILE.targetSentence}</p>
        <div className="hero-highlights">
          {PROFILE.heroSummaryItems.map((s) => (
            <span className="chip" key={s}>{s}</span>
          ))}
          <a
            className="chip chip-link"
            href={PROFILE.evidence.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {PROFILE.evidence.label}
          </a>
        </div>
      </div>
    </header>
  );
}

export function Strengths() {
  return (
    <section id="strengths" className="section" aria-labelledby="strengths-heading">
      <div className="container">
        <h2 id="strengths-heading">강점</h2>
        <p className="section-desc">항목을 눌러 상황·행동·결과를 자세히 볼 수 있습니다.</p>
        <div className="strength-list">
          {STRENGTHS.map((s) => (
            <Accordion
              key={s.id}
              title={s.title}
              rows={[
                { label: "상황", text: s.situation },
                { label: "행동", text: s.action },
                { label: "결과", text: s.result },
              ]}
              evidence={
                s.evidenceUrl && s.evidenceLabel
                  ? { label: s.evidenceLabel, url: s.evidenceUrl }
                  : null
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function Projects() {
  return (
    <section id="projects" className="section" aria-labelledby="projects-heading">
      <div className="container">
        <h2 id="projects-heading">프로젝트</h2>
        <p className="section-desc">
          직접 만든 프로젝트와, 만들면서 실제로 겪은 결함·해결 과정입니다.
        </p>
        <div className="project-list">
          {PROJECTS.map((p) => (
            <article className="project-card" key={p.id}>
              <div className="project-head">
                <h3 className="project-name">{p.name}</h3>
                {p.link && (
                  <a href={p.link.url} target="_blank" rel="noopener noreferrer" className="chip chip-link">
                    {p.link.label}
                  </a>
                )}
              </div>
              <p className="project-description">{p.description}</p>
              <div className="project-tech">
                {p.techUsed.map((t) => (
                  <span className="tech-chip" key={t}>{t}</span>
                ))}
              </div>
              <div className="project-ts">
                <p className="project-ts-label">겪은 결함 · 해결</p>
                {p.troubleshooting.map((t) => (
                  <div className="ts-card" key={t.id}>
                    <Accordion
                      title={t.problem}
                      rows={[
                        { label: "시도", text: t.attempt },
                        { label: "비교", text: t.comparison },
                        { label: "배운 점", text: t.lesson },
                      ]}
                    />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function TechStack() {
  return (
    <section id="techstack" className="section" aria-labelledby="techstack-heading">
      <div className="container">
        <h2 id="techstack-heading">기술</h2>
        <p className="section-desc">숙련도 표시 대신, 왜 배우거나 선택했는지를 적었습니다.</p>
        <div className="techstack-list">
          {TECH_STACK.map((t) => (
            <div className="tech-card" key={t.name}>
              <div className="tech-card-head">
                <span className="tech-name">{t.name}</span>
                <span className="tech-status">{t.status}</span>
              </div>
              <p className="tech-reason">{t.reason}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Disclosure() {
  return (
    <section id="disclosure" className="section" aria-labelledby="disclosure-heading">
      <div className="container">
        <h2 id="disclosure-heading">공개 범위</h2>
        <div className="disclosure-grid">
          <div className="disclosure-col public">
            <h3>공개하는 것</h3>
            <ul>
              {PROFILE.publicItems.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
          <div className="disclosure-col private">
            <h3>공개하지 않는 것</h3>
            <ul>
              {PROFILE.privateItems.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="notice">
          이 소개 페이지의 내용은 학습·연습용으로 <strong>지어낸(fabricated)</strong> 것입니다.
          실제 연락처·주소·신분증 번호 같은 개인정보는 넣지 않았습니다. 아래 "비공개 영역"은
          패스키로 잠긴 별도의 자리이며, 심사할 때는 이 공개 페이지까지만 보시면 됩니다.
        </p>
      </div>
    </section>
  );
}

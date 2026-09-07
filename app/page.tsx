import type { CSSProperties } from "react";
import { AppIcon } from "@/components/AppIcon";
import { LandingCta, LandingHeaderAuth } from "@/components/LandingAuth";
import { ScrollProgress } from "@/components/ScrollProgress";
import { Sheet } from "@/components/Sheet";

/**
 * 소개 페이지 — 루트(`/`).
 *
 * **로그인하지 않아도 볼 수 있다.** 예전에는 루트가 곧 로그인 화면이어서
 * 이 앱이 무엇을 하는 곳인지 알 방법이 없었다. 로그인 화면은 `/login`으로 옮겼고,
 * 포털에서 들어오는 링크는 `/home`을 가리킨다.
 *
 * 결쩜사 패턴 그대로 **시트를 쌓는다** — 전체 폭 섹션을 쓰지 않고 둥근 카드를
 * 세로로 얹고, 마지막에 어두운 푸터로 문서를 닫는다.
 * 근거: my-obsidian-vault → 20-Design/결쩜사 페이지 패턴.md
 */
export default function LandingPage() {
  return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
        <header style={headerStyle}>
          <div className="page" style={{ ...headerInner, paddingTop: 14, paddingBottom: 14 }}>
            <span className="row" style={{ gap: 9 }}>
              <AppIcon size={30} priority />
              <span style={{ fontWeight: 900, letterSpacing: "-0.02em" }}>SnapWord</span>
            </span>
            <LandingHeaderAuth />
          </div>
          {/* 헤더가 sticky 라서 띠가 스크롤을 따라온다 */}
          <ScrollProgress />
        </header>

        <main className="page">
          <Sheet
            tone="dark"
            point
            eyebrow="SNAPWORD · VOCABULARY"
            headline={
              <>
                찍으면,
                <br />
                <span style={{ color: "#ead58c" }}>단어장이 됩니다.</span>
              </>
            }
            lead="교재나 화면을 사진 한 장으로 찍으면 단어와 뜻을 뽑아 나만의 단어장으로 만듭니다. 옮겨 적는 시간을 없앴습니다."
          >
            <div style={{ marginTop: 24 }}>
              <LandingCta variant="hero" />
            </div>
          </Sheet>

          <Sheet tone="tint" eyebrow="HOW IT WORKS" headline="세 걸음이면 됩니다">
            {/* 번호 원과 연결선은 app/elements.css 의 .flow 가 그린다.
                예전 인라인 stepNumStyle 은 번호에 면적용 var(--accent) 를 글자색으로
                썼다 — .flow-num 은 글자용 var(--accent-ink) 를 쓴다 */}
            <ol className="flow">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flow-step">
                  <span className="flow-num" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3>{s.title}</h3>
                    <p>{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Sheet>

          <Sheet eyebrow="WHAT YOU GET" headline={<><span className="mark">옮겨 적지 않아도</span> 됩니다</>}>
            <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
              {FEATURES.map((f) => (
                <div key={f.name} className="card--point" style={featureStyle}>
                  <strong style={{ fontSize: "0.92rem" }}>{f.name}</strong>
                  <p style={stepDescStyle}>{f.desc}</p>
                </div>
              ))}
            </div>
          </Sheet>

          <Sheet
            tone="gold"
            eyebrow="ONE ACCOUNT"
            headline="계정만 공유해요"
            lead="myjane 계정 하나로 여러 기록 서비스를 골라 씁니다. 기록과 데이터는 서비스마다 따로 쌓여요."
          >
            <p className="note-block">
              <strong>NOTE</strong>
              쓰지 않는 서비스는 열지 않아도 돼요. 이 앱만 써도 충분합니다.
            </p>
          </Sheet>

          <Sheet center point eyebrow="START" headline="오늘 한 장만 찍어 볼까요?">
            <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
              <LandingCta variant="closing" />
            </div>
          </Sheet>
        </main>

        <footer style={footerStyle}>
          <div className="page" style={{ textAlign: "center", paddingBottom: 28 }}>
            <p style={{ margin: "0 0 14px", fontWeight: 800, letterSpacing: "-0.02em" }}>
              SnapWord
            </p>
            <p style={{ margin: 0 }}>
              <a href="https://www.myjane.co.kr" className="myjane-mark" style={{ color: "var(--on-dark)" }}>
                my<span>jane</span>
              </a>
            </p>
            {/*
              법적 고지 — 세 페이지는 포털(myjane)에 한 벌만 둔다.
              여섯 앱이 회원과 세션을 공유하므로 방침도 한 곳이어야 한다.
              → my-obsidian-vault / 50-Plans/C 법적 페이지.md
            */}
            <p style={footerLegalStyle}>
              <a href="https://www.myjane.co.kr/legal/privacy" style={footerLegalLinkStyle}>
                개인정보처리방침
              </a>
              <span style={footerLegalSepStyle}>·</span>
              <a href="https://www.myjane.co.kr/legal/terms" style={footerLegalLinkStyle}>
                이용약관
              </a>
              <span style={footerLegalSepStyle}>·</span>
              <a href="https://www.myjane.co.kr/legal/cookies" style={footerLegalLinkStyle}>
                쿠키 안내
              </a>
            </p>
            <p style={footerLineStyle}>@2026 myjane All rights reserved</p>
          </div>
        </footer>
      </div>
  );
}

const STEPS = [
  {
    "title": "교재를 찍는다",
    "desc": "종이책이든 화면이든 사진 한 장이면 됩니다."
  },
  {
    "title": "단어와 뜻을 뽑아 준다",
    "desc": "찍은 곳에서 단어와 뜻을 읽어 단어장으로 정리합니다."
  },
  {
    "title": "외운 것과 나눠 테스트",
    "desc": "외운 단어와 틀린 단어를 나눠 다시 볼 것만 남깁니다."
  }
];

const FEATURES = [
  {
    "name": "사진으로 단어 추출",
    "desc": "손으로 옮겨 적지 않습니다. 찍은 곳에서 바로 뽑습니다."
  },
  {
    "name": "폴더로 묶는 단어장",
    "desc": "단원·시험 범위대로 묶어 두면 나중에 찾기 쉽습니다."
  },
  {
    "name": "학습과 테스트",
    "desc": "외운 것은 접어 두고 틀린 것만 반복합니다."
  }
];

const headerStyle: CSSProperties = {
  position: "sticky",
  top: 0,
  zIndex: 40,
  background: "var(--bg-primary)",
  borderBottom: "1px solid var(--border-subtle)",
};

const headerInner: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const stepDescStyle: CSSProperties = {
  margin: "5px 0 0",
  fontSize: "0.82rem",
  lineHeight: 1.75,
  color: "var(--text-secondary)",
  wordBreak: "keep-all",
};

const featureStyle: CSSProperties = {
  padding: "15px 17px",
  // ⚠️ 좌상·우하는 .card--point 가 깎는다 (app/elements.css). 인라인
  // borderRadius shorthand 를 쓰면 네 모서리를 모두 세워 그 깎임을 덮어쓴다 —
  // 그래서 남는 두 모서리만 longhand 로 적는다
  borderTopRightRadius: "var(--radius-sm)",
  borderBottomLeftRadius: "var(--radius-sm)",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border-subtle)",
};

const footerStyle: CSSProperties = {
  marginTop: 40,
  paddingTop: 30,
  background: "var(--footer-bg)",
  color: "var(--on-dark)",
};

const footerLineStyle: CSSProperties = {
  margin: "8px 0 0",
  fontSize: "0.78rem",
  lineHeight: 1.8,
  color: "var(--on-dark-faint)",
  wordBreak: "keep-all",
};

/*
 * 어두운 푸터의 법적 고지 링크. 짙은 면 위이므로 --on-dark 계열을 쓴다
 * (밝은 면용 토큰을 쓰면 2~3:1 로 떨어진다).
 * 다섯 앱이 같은 모양이다 — 고칠 때 함께 고친다.
 */
const footerLegalStyle: CSSProperties = {
  margin: "12px 0 0",
  fontSize: "0.78rem",
  lineHeight: 1.9,
};

const footerLegalLinkStyle: CSSProperties = {
  color: "var(--on-dark-dim)",
  textDecoration: "none",
  fontWeight: 600,
};

const footerLegalSepStyle: CSSProperties = {
  margin: "0 8px",
  color: "var(--on-dark-faint)",
};

import { VocabWorkbench } from "@/components/VocabWorkbench";

export default function DevPage() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1 style={{ marginTop: 0 }}>SnapWord / dev</h1>
      <p style={{ marginTop: "0.25rem", color: "#4b5563" }}>
        OpenAI Vision·일괄 저장 테스트용. 운영 UI는 홈(<code>/home</code>)에서 이용하세요.
      </p>
      <VocabWorkbench />
    </main>
  );
}

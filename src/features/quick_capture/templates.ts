export interface QuickCaptureTemplate {
  id: string;
  label: string;
  description: string;
  content: string;
  tags: string[];
}

export const QUICK_CAPTURE_TEMPLATES: QuickCaptureTemplate[] = [
  {
    id: "task",
    label: "タスク",
    description: "作業と次の一歩をチェックリストで整理",
    content: "## タスク\n\n- [ ] ",
    tags: ["task"],
  },
  {
    id: "meeting",
    label: "会議メモ",
    description: "議題・決定事項・次のアクションを記録",
    content:
      "## 議題\n\n- \n\n## 決定事項\n\n- \n\n## 次のアクション\n\n- [ ] ",
    tags: ["meeting"],
  },
  {
    id: "idea",
    label: "アイデア",
    description: "概要と、すぐ試せる一歩を書き出す",
    content: "## アイデア\n\n### 概要\n\n\n### 次の一歩\n\n- [ ] ",
    tags: ["idea"],
  },
  {
    id: "daily",
    label: "日報",
    description: "やったこと・気づき・明日の予定を残す",
    content:
      "## 今日の記録\n\n### やったこと\n\n- \n\n### 気づき\n\n- \n\n### 明日やること\n\n- [ ] ",
    tags: ["daily"],
  },
];

const errorMessages: Array<[RegExp, string]> = [
  [
    /GOOGLE_CALENDAR_CLIENT_ID|not configured/i,
    "このビルドではGoogle Calendar連携を利用できません。",
  ],
  [
    /google authorization timed out/i,
    "Googleの認証が時間切れになりました。もう一度接続してください。",
  ],
  [
    /authorization was cancelled|access_denied|cancelled/i,
    "Googleアカウントの接続がキャンセルされました。",
  ],
  [
    /not connected|refresh token|invalid_grant|401|unauthorized/i,
    "Google Calendarの接続が切れています。接続し直してください。",
  ],
  [
    /403|forbidden|insufficient permissions?/i,
    "Google Calendarへのアクセス権限がありません。Google側の権限を確認して接続し直してください。",
  ],
  [
    /429|too many requests|rate limit/i,
    "Google Calendarへのアクセスが集中しています。少し待ってから再同期してください。",
  ],
  [
    /5\d\d|server error|service unavailable/i,
    "Google Calendarのサービスを一時的に利用できません。少し待ってから再同期してください。",
  ],
  [
    /database is locked|database is busy/i,
    "別のカレンダー処理が進行中です。完了してからもう一度お試しください。",
  ],
  [
    /error sending request|connect error|dns error|tcp connect|network|timed?\s*out/i,
    "Google Calendarに接続できませんでした。通信環境を確認して、もう一度お試しください。",
  ],
];

export const formatGoogleCalendarError = (reason: unknown) => {
  const message = (
    reason instanceof Error ? reason.message : String(reason ?? "")
  )
    .replace(/^Error:\s*/i, "")
    .trim();
  return (
    errorMessages.find(([pattern]) => pattern.test(message))?.[1] ||
    message ||
    "Google Calendarの処理を完了できませんでした。もう一度お試しください。"
  );
};

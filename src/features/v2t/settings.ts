export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function normalizeModelName(model: string): string {
  return model.trim();
}

export function normalizeLanguageCode(language: string): string {
  return language.trim().toLowerCase();
}

export function validateBaseUrl(baseUrl: string): string | undefined {
  const value = normalizeBaseUrl(baseUrl);
  if (!value) return "APIエンドポイントを入力してください。";

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "http:// または https:// で始まるURLを入力してください。";
    }
  } catch {
    return "有効なAPIエンドポイントURLを入力してください。";
  }

  return undefined;
}

export function validateModelName(model: string): string | undefined {
  return normalizeModelName(model) ? undefined : "モデル名を入力してください。";
}

export function validateLanguageCode(language: string): string | undefined {
  return /^[a-z]{2,3}$/.test(normalizeLanguageCode(language))
    ? undefined
    : "2〜3文字の言語コード（例: ja）を入力してください。";
}

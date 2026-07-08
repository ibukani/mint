export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

export function normalizeModelName(model: string): string {
  return model.trim();
}

export function normalizeLanguageCode(language: string): string {
  return language.trim().toLowerCase();
}

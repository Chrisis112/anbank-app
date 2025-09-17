export default function buildUrl(action: string, params: URLSearchParams): string {
  const base = 'https://phantom.app/ul/v1';
  return `${base}/${action}?${params.toString()}`;
}
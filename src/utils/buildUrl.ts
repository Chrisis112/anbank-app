export default function buildUrl(action: string, params: URLSearchParams): string {
  const base = 'https://phantom.app/ul/v1';
  console.log('Phantom deeplink params:', params.toString());
const url = buildUrl("signAndSendTransaction", params);
console.log('Phantom deeplink url:', url);
window.open(url, "_blank");
  return `${base}/${action}?${params.toString()}`;
  
}

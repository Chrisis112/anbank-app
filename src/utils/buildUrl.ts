export const buildUrl = (method: string, params: URLSearchParams): string => {
  return `https://phantom.app/ul/v1/${method}?${params.toString()}`;
};

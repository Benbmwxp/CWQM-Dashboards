/** Mock sign-in: which persona the app is "signed in" as. Replaced by SSO in live mode. */
const KEY = 'cwqm-mock-user';
export const DEFAULT_MOCK_USER = 'priya';

export const getMockUser = () => {
  try { return localStorage.getItem(KEY) ?? DEFAULT_MOCK_USER; } catch { return DEFAULT_MOCK_USER; }
};
export const setMockUser = (id: string) => {
  try { localStorage.setItem(KEY, id); } catch { /* storage blocked - stays default */ }
};

export const leesCode = () => { try { return localStorage.getItem('fd-code') || '' } catch { return '' } }
export const bewaarCode = c => { try { localStorage.setItem('fd-code', c) } catch { /* privémodus */ } }

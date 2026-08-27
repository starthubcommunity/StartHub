// hub-member.js — giriş yapmış üyenin rol context'i.
// hub-app.jsx auth/rol kapısı bu Provider'ı besler; sayfalar useHubMember()
// ile rolü okur. Ayrı dosya: table.jsx / candidate.jsx ↔ hub-app.jsx arası
// dairesel import'u önler.
import { createContext, useContext } from 'react';

export const HubMemberContext = createContext(null);

// Giriş yapmış kullanıcının hub rolünü döner ('cofounder' | 'recruiter' |
// 'project_owner' | null). Yalnızca menü/uyarı görünürlüğü için — gerçek
// kısıt RLS'te (HUB_SPEC §5.2).
export function useHubMember() {
  return useContext(HubMemberContext);
}

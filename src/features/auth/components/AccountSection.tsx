import { useAuth } from '../AuthProvider';
import { AccountPanel } from './AccountPanel';
export function AccountSection() {
  const { session, signOut } = useAuth();
  return <AccountPanel email={session?.user.email} signOut={signOut} />;
}

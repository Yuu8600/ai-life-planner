import { AuthForm } from './components/AuthForm';
import { getAuthErrorMessage } from './errors';
import { useAuth } from './AuthProvider';

export function AuthScreen() {
  const { restorationError, signIn, signUp } = useAuth();

  return (
    <AuthForm
      onSignIn={signIn}
      onSignUp={signUp}
      restorationError={restorationError ? getAuthErrorMessage(restorationError) : null}
    />
  );
}

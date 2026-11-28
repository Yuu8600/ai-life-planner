import { AuthForm } from './components/AuthForm';
import { getAuthErrorMessage } from './errors';
import { useAuth } from './AuthProvider';

export function AuthScreen() {
  const { resetPassword, restorationError, signIn, signUp } = useAuth();

  return (
    <AuthForm
      onResetPassword={resetPassword}
      onSignIn={signIn}
      onSignUp={signUp}
      restorationError={restorationError ? getAuthErrorMessage(restorationError) : null}
    />
  );
}

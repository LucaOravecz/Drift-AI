export const MIN_PASSWORD_LENGTH = 12;

export function validatePasswordPolicy(password: string) {
  const issues: string[] = [];

  if (password.length < MIN_PASSWORD_LENGTH) {
    issues.push(`must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (!/[A-Z]/.test(password)) {
    issues.push("must include an uppercase letter");
  }
  if (!/[a-z]/.test(password)) {
    issues.push("must include a lowercase letter");
  }
  if (!/[0-9]/.test(password)) {
    issues.push("must include a number");
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    issues.push("must include a special character");
  }

  return {
    isValid: issues.length === 0,
    issues,
  };
}

export function passwordPolicyMessage() {
  return "Password must be at least 12 characters and include uppercase, lowercase, number, and special character.";
}

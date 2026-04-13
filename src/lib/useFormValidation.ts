import { useState, useCallback } from "react";

interface ValidationRule {
  required?: boolean;
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  custom?: (value: string) => string | null;
}

interface ValidationRules {
  [fieldName: string]: ValidationRule;
}

interface FormErrors {
  [fieldName: string]: string | null;
}

export function useFormValidation(rules: ValidationRules) {
  const [errors, setErrors] = useState<FormErrors>({});

  const validateField = useCallback(
    (name: string, value: string): string | null => {
      const rule = rules[name];
      if (!rule) return null;

      if (rule.required && !value.trim()) {
        return "This field is required";
      }

      if (value && rule.pattern && !rule.pattern.test(value)) {
        return "Invalid format";
      }

      if (value && rule.minLength && value.length < rule.minLength) {
        return `Minimum ${rule.minLength} characters required`;
      }

      if (value && rule.maxLength && value.length > rule.maxLength) {
        return `Maximum ${rule.maxLength} characters allowed`;
      }

      if (rule.custom) {
        return rule.custom(value);
      }

      return null;
    },
    [rules]
  );

  const validateForm = useCallback(
    (formData: Record<string, string>): boolean => {
      const newErrors: FormErrors = {};

      Object.keys(rules).forEach((fieldName) => {
        const error = validateField(fieldName, formData[fieldName] || "");
        if (error) {
          newErrors[fieldName] = error;
        }
      });

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [rules, validateField]
  );

  const getFieldError = useCallback(
    (fieldName: string): string | null => {
      return errors[fieldName] || null;
    },
    [errors]
  );

  const clearError = useCallback((fieldName: string) => {
    setErrors((prev) => ({
      ...prev,
      [fieldName]: null,
    }));
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    errors,
    validateField,
    validateForm,
    getFieldError,
    clearError,
    clearAllErrors,
  };
}

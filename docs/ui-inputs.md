## UI Inputs, React Hook Form, & Validation (React 19+)

### Core Integration Rules

- **Native Ref Props:** Do not use `React.forwardRef` (deprecated). Destructure `ref` directly from the component's standard props instead, passing it directly to the underlying DOM node.
- **Controlled Fallbacks:** Use RHF's `<Controller />` wrapper ONLY for complex, non-native third-party components (e.g., custom dropdowns, date pickers). Use native register for text inputs, checkboxes, and textareas.
- **Visual Error States:** Controlled inputs must visually reflect validation errors immediately via state props.
- **Accessibility (a11y):** Always tie input elements to error messages using `aria-invalid` and `aria-describedby`.

### Styling Error States (styled-components)

Always utilize transient props (`$hasError`) to inject visual error feedback without passing non-standard attributes to the DOM.

```tsx
import styled from 'styled-components';

export const StyledInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  width: 100%;
`;

export const StyledLabel = styled.label`
  font-size: 0.875rem;
  font-weight: ${({ theme }) => theme.fontWeights.medium};
  color: ${({ theme }) => theme.colors.text};
`;

export const StyledInput = styled.input<{ \$hasError?: boolean }>`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.sm};
  border: 1px solid ${({ theme, $hasError }) =>
    $hasError ? theme.colors.error : theme.colors.border};
  border-radius: 4px;
  font-size: 16px; /* Prevents iOS auto-zoom on focus */

  &:focus {
    outline: none;
    border-color: ${({ theme, $hasError }) =>
      $hasError ? theme.colors.error : theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme, $hasError }) =>
      $hasError ? theme.colors.errorLight : theme.colors.primaryLight};
  }
`;

export const StyledErrorMessage = styled.p`
  font-size: 0.75rem;
  color: ${({ theme }) => theme.colors.error};
  margin: 0;
`;
```

### Complete Standard Implementation Pattern

This standard pattern couples a **Zod Validation Schema**, **React Hook Form**, and a **React 19 Modern Ref Prop Input**:

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import React from 'react';
import * as S from './Form.styles';

// 1. Define Strict Validation Schema
const loginSchema = z.object({
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// 2. Reusable Component passing ref natively (React 19)
interface InputFieldProps extends React.ComponentProps<'input'> {
  label: string;
  error?: string;
  ref?: React.Ref<HTMLInputElement>; // Explicit type for TS
}

export function InputField({ label, error, id, ref, ...props }: InputFieldProps) {
  return (
    <S.StyledInputGroup>
      <S.StyledLabel htmlFor={id}>{label}</S.StyledLabel>
      <S.StyledInput
        id={id}
        ref={ref}
        \$hasError={!!error}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && <S.StyledErrorMessage id={`${id}-error`}>{error}</S.StyledErrorMessage>}
    </S.StyledInputGroup>
  );
}

// 3. Form Component
export function LoginForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onTouched', // Validates when user blurs/leaves an input
  });

  const onSubmit = (data: LoginFormValues) => {
    console.log('Valid Form Data Submitted:', data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <InputField
        id="email"
        label="Email Address"
        type="email"
        error={errors.email?.message}
        {...register('email')}
      />

      <InputField
        id="password"
        label="Password"
        type="password"
        error={errors.password?.message}
        {...register('password')}
      />

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
}
```

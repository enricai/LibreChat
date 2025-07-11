import { useForm } from 'react-hook-form';
import { useState, ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useRequestPasswordResetMutation } from 'librechat-data-provider/react-query';
import type { TRequestPasswordReset, TRequestPasswordResetResponse } from 'librechat-data-provider';
import type { FC } from 'react';
import type { TLoginLayoutContext } from '~/common';
import { Spinner, Button } from '~/components';
import { useLocalize } from '~/hooks';

const BodyTextWrapper: FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <div
      className="relative mt-6 rounded-xl border border-green-500/20 bg-green-50/50 px-6 py-4 text-green-700 shadow-sm transition-all dark:bg-green-950/30 dark:text-green-100"
      role="alert"
    >
      {children}
    </div>
  );
};

const ResetPasswordBodyText = () => {
  const localize = useLocalize();
  return (
    <div className="flex flex-col">
      {localize('com_auth_reset_password_if_email_exists')}
      <span>
        <a className="text-sm text-primary hover:underline" href="/login">
          {localize('com_auth_back_to_login')}
        </a>
      </span>
    </div>
  );
};

function RequestPasswordReset() {
  const localize = useLocalize();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TRequestPasswordReset>();
  const [bodyText, setBodyText] = useState<ReactNode | undefined>(undefined);
  const { startupConfig, setHeaderText } = useOutletContext<TLoginLayoutContext>();

  const requestPasswordReset = useRequestPasswordResetMutation();

  const onSubmit = (data: TRequestPasswordReset) => {
    requestPasswordReset.mutate(data, {
      onSuccess: (data: TRequestPasswordResetResponse) => {
        if (data.link && !startupConfig?.emailEnabled) {
          setHeaderText('com_auth_reset_password');
          setBodyText(
            <span>
              {localize('com_auth_click')}{' '}
              <a className="text-primary hover:underline" href={data.link}>
                {localize('com_auth_here')}
              </a>{' '}
              {localize('com_auth_to_reset_your_password')}
            </span>,
          );
        } else {
          setHeaderText('com_auth_reset_password_link_sent');
          setBodyText(<ResetPasswordBodyText />);
        }
      },
      onError: () => {
        setHeaderText('com_auth_reset_password_link_sent');
        setBodyText(<ResetPasswordBodyText />);
      },
    });
  };

  if (bodyText) {
    return <BodyTextWrapper>{bodyText}</BodyTextWrapper>;
  }

  return (
    <form
      className="mt-8 space-y-6"
      aria-label="Password reset form"
      method="POST"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="space-y-2">
        <div className="relative">
          <input
            type="email"
            id="email"
            autoComplete="off"
            aria-label={localize('com_auth_email')}
            {...register('email', {
              required: localize('com_auth_email_required'),
              minLength: {
                value: 3,
                message: localize('com_auth_email_min_length'),
              },
              maxLength: {
                value: 120,
                message: localize('com_auth_email_max_length'),
              },
              pattern: {
                value: /\S+@\S+\.\S+/,
                message: localize('com_auth_email_pattern'),
              },
            })}
            aria-invalid={!!errors.email}
            className="webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light bg-surface-primary px-3.5 pb-2.5 pt-3 text-text-primary duration-200 focus:border-green-500 focus:outline-none"
            placeholder=" "
          />
          <label
            htmlFor="email"
            className="
            absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200
            peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100
            peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-primary
            rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4
            "
          >
            {localize('com_auth_email_address')}
          </label>
        </div>
        {errors.email && (
          <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">
            {errors.email.message}
          </p>
        )}
      </div>
      <div className="space-y-4">
        <button
          type="submit"
          disabled={!!errors.email}
          className="
            w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-medium text-white
            transition-colors hover:bg-green-700 focus:outline-none focus:ring-2
            focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50
            disabled:hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700
          "
        >
         {localize('com_auth_continue')}
        </button>
        <div className="mt-4 flex justify-center">
          <a href="/login" className="text-sm text-primary">
            {localize('com_auth_back_to_login')}
          </a>
        </div>
      </div>
    </form>
  );
}

export default RequestPasswordReset;

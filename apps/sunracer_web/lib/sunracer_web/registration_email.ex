defmodule SunracerWeb.RegistrationEmail do
  @moduledoc "Email confirmation for newly created SunRacer pilot accounts."

  import Swoosh.Email

  def verification(account, verification_url) when is_binary(verification_url) do
    from_address =
      Application.get_env(:sunracer_web, :registration_from, "noreply@localhost")

    new()
    |> to(account.email)
    |> from({"SunRacer", from_address})
    |> subject("Confirm your SunRacer pilot account")
    |> text_body("""
    Welcome to SunRacer, #{account.pilot_name}!

    Confirm your email address to activate your pilot account:

    #{verification_url}

    This link expires after 24 hours. Opening it shows a confirmation page;
    activating the account requires selecting Confirm email.
    If it expired or delivery failed, request a replacement at:
    https://sunracer.ddns.net/register/resend

    If you did not request this account, you can ignore this email.
    """)
  end
  def password_reset(account, recovery_url) when is_binary(recovery_url) do
    from_address = Application.get_env(:sunracer_web, :registration_from, "noreply@localhost")

    new()
    |> to(account.email)
    |> from({"SunRacer", from_address})
    |> subject("Reset your SunRacer password")
    |> text_body("""
    A password reset was requested for your SunRacer pilot account.

    Pilot username: #{account.username}

    #{recovery_url}

    This link expires in 30 minutes and can be used only once.
    If you did not request a reset, ignore this email. Your password remains unchanged.
    """)
  end
end

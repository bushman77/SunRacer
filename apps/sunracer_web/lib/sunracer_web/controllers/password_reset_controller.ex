defmodule SunracerWeb.PasswordResetController do
  use SunracerWeb, :controller
  require Logger

  alias Sunracer.Accounts
  alias Sunracer.Mailer
  alias SunracerWeb.RegistrationEmail

  plug :private_response

  def new(conn, _params), do: render_request(conn)

  def create(conn, params) do
    if email_enabled?() do
      email = case params do
        %{"recovery" => %{"email" => email}} -> email
        _ -> nil
      end
      case Accounts.request_password_reset(email) do
        {:ok, {account, token}} -> deliver(account, token)
        {:error, _} -> Logger.error("SunRacer password reset request failed")
        _ -> :ok
      end

      conn
      |> put_flash(:info, "If an eligible account matches this email, a recovery link will be sent. Check your inbox and spam folder.")
      |> redirect(to: ~p"/forgot-password")
    else
      conn |> put_status(:service_unavailable) |> render_request()
    end
  end

  def edit(conn, %{"id" => id, "token" => token})
      when is_binary(id) and byte_size(id) <= 19 and is_binary(token) and byte_size(token) == 43 do
    render_reset(conn, id, token, nil)
  end

  def edit(conn, _), do: invalid_link(conn)

  def update(conn, %{"reset" => %{"id" => id, "token" => token,
      "password" => password, "password_confirmation" => confirmation}})
      when is_binary(id) and byte_size(id) <= 19 and is_binary(token) and byte_size(token) == 43 do
    result =
      case Integer.parse(id) do
        {user_id, ""} when user_id > 0 and user_id <= 9223372036854775807 ->
          Accounts.reset_password(user_id, token, password, confirmation)
        _ -> {:error, :invalid_or_expired_token}
      end

    case result do
      {:ok, account} ->
        SunracerWeb.Endpoint.broadcast("player_socket:#{account.id}", "disconnect", %{})
        conn
        |> delete_session(:player_id)
        |> delete_session(:account_session_id)
        |> configure_session(renew: true)
        |> put_flash(:info, "Password changed. Sign in with your new password.")
        |> redirect(to: ~p"/login")

      {:error, :invalid_password} ->
        conn
        |> put_status(:unprocessable_entity)
        |> render_reset(id, token, "Use 8–72 bytes and enter the same password twice.")

      _ -> invalid_link(conn)
    end
  end

  def update(conn, _), do: invalid_link(conn)

  defp invalid_link(conn) do
    conn
    |> put_flash(:error, "This recovery link is invalid, expired or already used. Request a new one.")
    |> redirect(to: ~p"/forgot-password")
  end

  defp render_request(conn) do
    render(conn, :new, page_title: "Recover pilot account", email_enabled: email_enabled?(),
      form: Phoenix.Component.to_form(%{}, as: :recovery))
  end

  defp render_reset(conn, id, token, error) do
    render(conn, :edit, page_title: "Reset pilot password", error: error,
      form: Phoenix.Component.to_form(%{"id" => id, "token" => token}, as: :reset))
  end

  defp email_enabled? do
    Application.get_env(:sunracer_web, :email_delivery_configured,
      Application.get_env(:sunracer_web, :registration_email_enabled, false))
  end

  defp deliver(account, token) do
    recovery_url = url(~p"/reset-password?#{%{id: account.id, token: token}}")
    mailer = Application.get_env(:sunracer_web, :registration_mailer, Mailer)

    case mailer.deliver(RegistrationEmail.password_reset(account, recovery_url)) do
      {:ok, _} -> :ok
      _ -> Logger.error("SunRacer password reset email delivery failed")
    end
  rescue
    _ -> Logger.error("SunRacer password reset email delivery failed")
  end

  defp private_response(conn, _opts) do
    conn |> put_resp_header("cache-control", "no-store")
    |> put_resp_header("referrer-policy", "no-referrer")
  end
end

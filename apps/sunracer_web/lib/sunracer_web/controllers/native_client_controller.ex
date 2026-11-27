defmodule SunracerWeb.NativeClientController do
  @moduledoc """
  Stateless JSON bootstrap for the locally bundled desktop game client.
  The browser's Phoenix cookie session is not used or exposed.
  """
  use SunracerWeb, :controller

  alias Sunracer.Accounts
  alias SunracerWeb.{GameAuth, NativeLoginLimiter}

  @token_lifetime_seconds 900

  # Credential-free diagnostic: exercises the same native CORS and JSON API
  # pipeline as login without consuming rate limits or transmitting secrets.
  def probe(conn, _params) do
    conn
    |> put_resp_header("cache-control", "no-store")
    |> json(%{status: "ok"})
  end

  def login(conn, %{"username" => username, "password" => password} = params)
      when is_binary(username) and is_binary(password) do
    cond do
      byte_size(username) > 80 or byte_size(password) > 512 or
          String.trim(username) == "" or password == "" ->
        invalid_login(conn)

      not NativeLoginLimiter.allow?(username) ->
        conn
        |> put_resp_header("retry-after", "300")
        |> put_status(:too_many_requests)
        |> json(%{error: "Too many attempts. Try again in a few minutes."})

      true ->
        case Accounts.login_account(username, password) do
          {:ok, account} ->
            NativeLoginLimiter.clear(username)
            payload = credentials(account)
            payload =
              if params["remember_me"] == true do
                Map.merge(payload, %{remember_token: GameAuth.remember_token(account, :native),
                  remember_expires_in: GameAuth.remember_max_age()})
              else
                payload
              end

            conn |> put_resp_header("cache-control", "no-store") |> json(payload)

          {:error, _} ->
            invalid_login(conn)
        end
    end
  end

  def login(conn, _), do: invalid_login(conn)

  # Remember credentials cannot join a world; resume issues a short socket token.
  def resume(conn, _params) do
    with {:ok, account} <- GameAuth.verify_remember_token(bearer_token(conn), :native) do
      conn |> put_resp_header("cache-control", "no-store") |> json(credentials(account))
    else
      _ -> unauthorized(conn)
    end
  end

  def refresh(conn, _params) do
    with {:ok, account} <- authenticate_bearer(conn) do
      conn |> put_resp_header("cache-control", "no-store") |> json(credentials(account))
    else
      _ -> unauthorized(conn)
    end
  end

  def logout(conn, _params) do
    with {:ok, account} <- authenticate_bearer(conn),
         {:ok, _} <- Accounts.logout_account(account.id, account.session_id) do
      send_resp(conn, :no_content, "")
    else
      _ -> unauthorized(conn)
    end
  end

  defp credentials(account) do
    %{
      token: GameAuth.socket_token(account),
      expires_in: @token_lifetime_seconds,
      pilot_id: account.id,
      pilot_name: account.pilot_name
    }
  end

  defp authenticate_bearer(conn), do: GameAuth.verify_socket_token(bearer_token(conn))

  defp bearer_token(conn) do
    get_req_header(conn, "authorization")
    |> Enum.find_value(fn
      "Bearer " <> value -> value
      _ -> nil
    end)
  end

  defp invalid_login(conn) do
    conn
    |> put_status(:unauthorized)
    |> json(%{error: "Invalid or unverified pilot credentials."})
  end

  defp unauthorized(conn) do
    conn
    |> put_status(:unauthorized)
    |> json(%{error: "Pilot session expired. Sign in again."})
  end
end

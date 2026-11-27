defmodule SunracerWeb.GameAuth do
  @moduledoc "Browser-session and signed game-socket authentication."

  import Phoenix.Controller
  import Plug.Conn

  alias Sunracer.Accounts
  alias Sunracer.Accounts.PlayerAccount

  @socket_salt "game socket"
  @socket_max_age 900
  @remember_max_age 30 * 24 * 60 * 60
  @remember_cookie "_sunracer_remember"

  def init(action), do: action

  def call(conn, :fetch_current_player), do: fetch_current_player(conn)

  def call(conn, :require_authenticated_player) do
    if conn.assigns[:current_player] do
      conn
    else
      conn
      |> put_flash(:error, "Sign in to launch your ship.")
      |> redirect(to: "/login")
      |> halt()
    end
  end

  def fetch_current_player(conn) do
    player_id = get_session(conn, :player_id)
    session_id = get_session(conn, :account_session_id)

    account =
      case session_id do
        session_id when is_binary(session_id) -> Accounts.get_by_session_id(session_id)
        _other -> nil
      end

    if match?(%PlayerAccount{id: ^player_id, verification: %{"verified" => true}}, account) do
      assign(conn, :current_player, account)
    else
      conn
      |> delete_session(:player_id)
      |> delete_session(:account_session_id)
      |> restore_remembered_player()
    end
  end

  def log_in_player(conn, %PlayerAccount{} = account, remember? \\ false) do
    conn = establish_session(conn, account)

    if remember? do
      put_resp_cookie(conn, @remember_cookie, remember_token(account, :browser),
        Keyword.put(cookie_options(conn), :max_age, @remember_max_age))
    else
      delete_resp_cookie(conn, @remember_cookie, cookie_options(conn))
    end
  end

  defp establish_session(conn, account) do
    conn
    |> configure_session(renew: true)
    |> put_session(:player_id, account.id)
    |> put_session(:account_session_id, account.session_id)
    |> assign(:current_player, account)
  end

  defp restore_remembered_player(conn) do
    conn = fetch_cookies(conn)

    case Map.get(conn.req_cookies, @remember_cookie) do
      nil -> assign(conn, :current_player, nil)
      token ->
        case verify_remember_token(token, :browser) do
          {:ok, account} -> establish_session(conn, account)
          :error ->
            conn
            |> delete_resp_cookie(@remember_cookie, cookie_options(conn))
            |> assign(:current_player, nil)
        end
    end
  end

  defp cookie_options(conn),
    do: [http_only: true, secure: conn.scheme == :https, same_site: "Lax", path: "/"]

  def remember_max_age, do: @remember_max_age

  def remember_token(%PlayerAccount{} = account, audience)
      when audience in [:browser, :native] do
    Phoenix.Token.sign(SunracerWeb.Endpoint, remember_salt(audience), %{
      player_id: account.id, session_id: account.session_id
    })
  end

  def verify_remember_token(token, audience)
      when is_binary(token) and byte_size(token) <= 4096 and audience in [:browser, :native] do
    with {:ok, %{player_id: player_id, session_id: session_id}} <-
           Phoenix.Token.verify(SunracerWeb.Endpoint, remember_salt(audience), token,
             max_age: @remember_max_age),
         %PlayerAccount{id: ^player_id, verification: %{"verified" => true}} = account <-
           Accounts.get_by_session_id(session_id) do
      {:ok, account}
    else
      _ -> :error
    end
  end

  def verify_remember_token(_, _), do: :error

  defp remember_salt(:browser), do: "browser remembered pilot v1"
  defp remember_salt(:native), do: "native remembered pilot v1"

  def log_out_player(conn) do
    if account = conn.assigns[:current_player] do
      _result = Accounts.logout_account(account.id, account.session_id)
    end

    conn
    |> delete_resp_cookie(@remember_cookie, cookie_options(conn))
    |> configure_session(drop: true)
  end

  def socket_token(%PlayerAccount{} = account) do
    Phoenix.Token.sign(SunracerWeb.Endpoint, @socket_salt, %{
      player_id: account.id,
      session_id: account.session_id
    })
  end

  def verify_socket_token(token) when is_binary(token) do
    with {:ok, %{player_id: player_id, session_id: session_id}} <-
           Phoenix.Token.verify(SunracerWeb.Endpoint, @socket_salt, token,
             max_age: @socket_max_age
           ),
         %PlayerAccount{id: ^player_id, verification: %{"verified" => true}} = account <-
           Accounts.get_by_session_id(session_id) do
      {:ok, account}
    else
      _error -> :error
    end
  end

  def verify_socket_token(_token), do: :error
end

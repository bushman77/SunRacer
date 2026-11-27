defmodule SunracerWeb.SessionControllerTest do
  use SunracerWeb.ConnCase

  import Sunracer.AccountsFixtures

  test "public account pages share the SpaceNova theme", %{conn: _conn} do
    for {path, id} <- [
          {~p"/login", "login-page"},
          {~p"/register", "registration-page"},
          {~p"/register/resend", "pilot-resend-page"},
          {~p"/register/success", "registration-success"},
          {~p"/forgot-password", "pilot-recovery-page"}
        ] do
      html = html_response(get(build_conn(), path), 200)
      document = LazyHTML.from_document(html)

      assert Enum.count(LazyHTML.query(document, "#" <> id <> ".nova-auth-screen")) == 1
      assert Enum.count(LazyHTML.query(document, ".nova-auth-wordmark[aria-label='SpaceNova home']")) == 1
      assert Enum.count(LazyHTML.query(document, ".hud-auth-layout main")) == 1
      refute html =~ "SUNRACER / ACCOUNT"
      refute html =~ "SunRacer mission briefing"
    end
  end

  test "hosted gameplay redirects anonymous visitors to the desktop download", %{conn: conn} do
    conn = get(conn, ~p"/play")

    assert redirected_to(conn) == ~p"/"
    assert get_resp_header(conn, "cache-control") == ["no-store"]
    home = get(recycle(conn), ~p"/")
    assert html_response(home, 200) =~ "Download desktop client"
    refute html_response(home, 200) =~ ~s(id="game-client")
  end

  test "a verified pilot can sign in for account services, but cannot launch hosted gameplay", %{conn: conn} do
    password = "sector-access-123"

    account =
      verified_player_account_fixture(%{
        username: "channel_pilot_#{System.unique_integer([:positive])}",
        password: password
      })

    conn =
      post(conn, ~p"/login", %{
        "session" => %{"username" => account.username, "password" => password}
      })

    assert redirected_to(conn) == ~p"/"

    conn = get(recycle(conn), ~p"/play")
    assert redirected_to(conn) == ~p"/"
    home = get(recycle(conn), ~p"/")
    response = html_response(home, 200)
    document = LazyHTML.from_document(response)
    assert Enum.count(LazyHTML.query(document, "#nova-equipment-link[href='/equipment']")) == 1
    assert Enum.count(LazyHTML.query(document, "#game-client")) == 0
    refute response =~ "data-socket-token"

    conn = delete(recycle(home), ~p"/logout")
    assert redirected_to(conn) == ~p"/login"

    conn = get(recycle(conn), ~p"/equipment")
    assert redirected_to(conn) == ~p"/login"
  end

  test "remember me restores a verified browser session and logout revokes it", %{conn: conn} do
    password = "remember-private-pilot"
    account = verified_player_account_fixture(%{password: password})
    login = post(conn, ~p"/login", %{"session" => %{"username" => account.username,
      "password" => password, "remember_me" => "true"}})
    assert redirected_to(login) == ~p"/"
    cookie = login.resp_cookies["_sunracer_remember"]
    assert cookie.max_age == 2_592_000
    assert cookie.http_only
    assert cookie.same_site == "Lax"
    remembered = fn -> Plug.Test.put_req_cookie(build_conn(), "_sunracer_remember", cookie.value) end
    assert redirected_to(get(remembered.(), ~p"/login")) == ~p"/"
    logout = delete(remembered.(), ~p"/logout")
    assert logout.resp_cookies["_sunracer_remember"].max_age == 0
    assert redirected_to(get(remembered.(), ~p"/equipment")) == ~p"/login"
  end

  test "ordinary login never sets a persistent credential and invalid cookies cannot log in", %{conn: conn} do
    password = "ordinary-private-pilot"
    account = verified_player_account_fixture(%{password: password})
    login = post(conn, ~p"/login", %{"session" => %{"username" => account.username,
      "password" => password, "remember_me" => "false"}})
    assert login.resp_cookies["_sunracer_remember"].max_age == 0
    assert redirected_to(get(build_conn(), ~p"/equipment")) == ~p"/login"
    bad = Plug.Test.put_req_cookie(build_conn(), "_sunracer_remember", "invalid")
    assert redirected_to(get(bad, ~p"/equipment")) == ~p"/login"
  end

  test "invalid credentials do not create a browser session", %{conn: conn} do
    conn =
      post(conn, ~p"/login", %{
        "session" => %{"username" => "missing-pilot", "password" => "wrong-password"}
      })

    assert html_response(conn, 422) =~ ~s(id="pilot-login-form")
    assert get_session(conn, :player_id) == nil
  end
end

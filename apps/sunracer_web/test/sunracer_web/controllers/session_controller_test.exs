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

  test "the game route requires an authenticated pilot", %{conn: conn} do
    conn = get(conn, ~p"/play")

    assert redirected_to(conn) == ~p"/login"
  end

  test "a verified pilot can sign in, launch the client, and sign out", %{conn: conn} do
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

    assert redirected_to(conn) == ~p"/play"

    conn = get(conn, ~p"/play")
    response = html_response(conn, 200)
    document = LazyHTML.from_document(response)

    assert Enum.count(
             LazyHTML.query(
               document,
               "#game-client[data-map-id='1-1'][data-layout-player-id='#{account.id}']"
             )
           ) == 1

    assert Enum.count(LazyHTML.query(document, "#space-viewport[tabindex='0']")) == 1
    assert Enum.count(LazyHTML.query(document, "#action-hotbar")) == 1
    assert Enum.count(LazyHTML.query(document, "#equipment-open[href='/equipment']")) == 1

    assert Enum.count(
             LazyHTML.query(
               document,
               "#hotbar-slot-1[data-action-id='x1_laser'][data-action-type='ammunition'][data-activation-mode='toggle']"
             )
           ) == 1

    assert Enum.count(LazyHTML.query(document, "#hotbar-slot-10")) == 1
    # The old target-info window was retired; the active cockpit HUD has
    # ship-status and minimap windows. The Solar Atlas is now the entry view.
    assert Enum.count(LazyHTML.query(document, "[data-cockpit-window]")) == 2
    assert Enum.count(LazyHTML.query(document, "[data-cockpit-window='ship_status']")) == 1
    assert Enum.count(LazyHTML.query(document, "[data-cockpit-window='minimap']")) == 1
    assert Enum.count(LazyHTML.query(document, "#navigation-computer")) == 1
    assert Enum.count(LazyHTML.query(document, "#nav-solar-view")) == 1
    assert Enum.count(LazyHTML.query(document, "#nav-solar-engage")) == 1
    assert Enum.count(LazyHTML.query(document, "#cockpit-minimap-canvas")) == 1
    assert Enum.count(LazyHTML.query(document, "#minimap-decrease")) == 1
    assert Enum.count(LazyHTML.query(document, "#minimap-increase")) == 1
    assert Enum.count(LazyHTML.query(document, "#cockpit-lock-toggle")) == 1
    assert Enum.count(LazyHTML.query(document, "#cockpit-reset-layout")) == 1

    conn = delete(conn, ~p"/logout")
    assert redirected_to(conn) == ~p"/login"

    conn = get(conn, ~p"/play")
    assert redirected_to(conn) == ~p"/login"
  end

  test "remember me restores a verified browser session and logout revokes it", %{conn: conn} do
    password = "remember-private-pilot"
    account = verified_player_account_fixture(%{password: password})
    login = post(conn, ~p"/login", %{"session" => %{"username" => account.username,
      "password" => password, "remember_me" => "true"}})
    assert redirected_to(login) == ~p"/play"
    cookie = login.resp_cookies["_sunracer_remember"]
    assert cookie.max_age == 2_592_000
    assert cookie.http_only
    assert cookie.same_site == "Lax"
    remembered = fn -> Plug.Test.put_req_cookie(build_conn(), "_sunracer_remember", cookie.value) end
    assert redirected_to(get(remembered.(), ~p"/login")) == ~p"/play"
    logout = delete(remembered.(), ~p"/logout")
    assert logout.resp_cookies["_sunracer_remember"].max_age == 0
    assert redirected_to(get(remembered.(), ~p"/play")) == ~p"/login"
  end

  test "ordinary login never sets a persistent credential and invalid cookies cannot log in", %{conn: conn} do
    password = "ordinary-private-pilot"
    account = verified_player_account_fixture(%{password: password})
    login = post(conn, ~p"/login", %{"session" => %{"username" => account.username,
      "password" => password, "remember_me" => "false"}})
    assert login.resp_cookies["_sunracer_remember"].max_age == 0
    assert redirected_to(get(build_conn(), ~p"/play")) == ~p"/login"
    bad = Plug.Test.put_req_cookie(build_conn(), "_sunracer_remember", "invalid")
    assert redirected_to(get(bad, ~p"/play")) == ~p"/login"
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

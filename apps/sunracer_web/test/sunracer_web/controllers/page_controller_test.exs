defmodule SunracerWeb.PageControllerTest do
  use SunracerWeb.ConnCase

  test "GET / introduces SpaceNova and exposes pilot actions", %{conn: conn} do
    conn = get(conn, ~p"/")
    html = html_response(conn, 200)
    document = LazyHTML.from_document(html)

    assert html =~ "SpaceNova"
    assert html =~ "Space exploration"
    assert Enum.count(LazyHTML.query(document, "#landing-page.nova-title-screen")) == 1
    assert Enum.count(LazyHTML.query(document, "#nova-title")) == 1
    assert Enum.count(LazyHTML.query(document, "#primary-launch-link[href='https://github.com/bushman77/SunRacer/releases/latest']")) == 1
    assert html =~ "Download desktop client"
    assert html =~ "Desktop client · Live multiplayer"
    assert Enum.count(LazyHTML.query(document, "a[href='/play']")) == 0
    assert Enum.count(LazyHTML.query(document, "#launch-client-link")) == 0
    assert Enum.count(LazyHTML.query(document, "a[href='/login']")) == 1
    assert Enum.count(LazyHTML.query(document, "#nova-settings-toggle[popovertarget='nova-settings-panel']")) == 1
    assert Enum.count(LazyHTML.query(document, "#nova-settings-panel[popover='auto']")) == 1
    assert Enum.count(LazyHTML.query(document, "#nova-network-settings summary")) == 1
    assert Enum.count(LazyHTML.query(document, "#nova-network-test")) == 1
    assert Enum.count(LazyHTML.query(document, "#nova-network-status[role='status']")) == 1
    assert Enum.count(LazyHTML.query(document, "#hero-register-link[href='/register']")) == 1
    assert Enum.count(LazyHTML.query(document, "a[href='/forgot-password']")) == 1
    assert Enum.count(LazyHTML.query(document, "a[href='/register/resend']")) == 1
    assert Enum.count(LazyHTML.query(document, "#nova-equipment-link")) == 0
    assert Enum.count(LazyHTML.query(document, "#nova-logout-link")) == 0
  end
end

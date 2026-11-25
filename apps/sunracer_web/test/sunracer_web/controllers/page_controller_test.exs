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
    assert Enum.count(LazyHTML.query(document, "#primary-launch-link[href='/login']")) == 1
    assert Enum.count(LazyHTML.query(document, "#launch-client-link[href='/login']")) == 1
    assert Enum.count(LazyHTML.query(document, "#hero-register-link[href='/register']")) == 1
    assert Enum.count(LazyHTML.query(document, "a[href='/forgot-password']")) == 1
    assert Enum.count(LazyHTML.query(document, "a[href='/register/resend']")) == 1
    assert Enum.count(LazyHTML.query(document, "#nova-equipment-link")) == 0
    assert Enum.count(LazyHTML.query(document, "#nova-logout-link")) == 0
  end
end

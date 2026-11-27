defmodule SunracerWeb.GameController do
  use SunracerWeb, :controller

  @doc "Hosted gameplay is retired; the native renderer is bundled at build time."
  def retired(conn, _params) do
    conn
    |> put_resp_header("cache-control", "no-store")
    |> put_flash(:info, "SpaceNova gameplay is available in the desktop client. Download it or open your installed copy.")
    |> redirect(to: ~p"/")
  end
end

defmodule SunracerWeb.PageController do
  use SunracerWeb, :controller

  def home(conn, _params) do
    render(conn, :home, page_title: "SpaceNova", spacenova_home: true)
  end
end

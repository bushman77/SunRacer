defmodule SunracerWeb.PageController do
  use SunracerWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end
end

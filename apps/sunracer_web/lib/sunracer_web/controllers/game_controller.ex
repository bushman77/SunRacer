defmodule SunracerWeb.GameController do
  use SunracerWeb, :controller

  alias Sunracer.World
  alias SunracerWeb.GameAuth

  def show(conn, _params) do
    account = conn.assigns.current_player

    render(conn, :show,
      page_title: "Solar System Atlas",
      socket_token: GameAuth.socket_token(account),
      layout_player_id: account.id,
      action_hotbar: World.action_hotbar(),
      logout_form: Phoenix.Component.to_form(%{}, as: :logout)
    )
  end
end

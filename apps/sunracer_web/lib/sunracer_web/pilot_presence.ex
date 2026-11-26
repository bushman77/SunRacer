defmodule SunracerWeb.PilotPresence do
  @moduledoc "Online communications directory; public pilot names only."
  use Phoenix.Presence,
    otp_app: :sunracer_web,
    pubsub_server: Sunracer.PubSub
end

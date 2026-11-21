defmodule Sunracer.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    world_options = Application.get_env(:core, Core.World, [])

    # The Core physics simulator stays independent of PostgreSQL; the
    # actual game supervisor supplies server-only persistence callbacks.
    world_options =
      if Application.get_env(:sunracer, :persist_pilot_locations, true) do
        Keyword.merge(world_options,
          voyage_loader: &Sunracer.PilotLocation.load_navigation/1,
          voyage_saver: &Sunracer.PilotLocation.save_navigation/2)
      else
        world_options
      end

    children = [
      Sunracer.Repo,
      {DNSCluster, query: Application.get_env(:sunracer, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Sunracer.PubSub},
      {Core.World.Supervisor, world_options}
    ]

    Supervisor.start_link(children, strategy: :one_for_one, name: Sunracer.Supervisor)
  end
end

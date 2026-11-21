defmodule SunracerWeb.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application

  @impl true
  def start(_type, _args) do
    children = [
      SunracerWeb.Telemetry,
      SunracerWeb.HelmetManager,
      SunracerWeb.NativeLoginLimiter,
      # Start a worker by calling: SunracerWeb.Worker.start_link(arg)
      # {SunracerWeb.Worker, arg},
      # Start to serve requests, typically the last entry
      SunracerWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: SunracerWeb.Supervisor]
    Supervisor.start_link(children, opts)
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    SunracerWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
